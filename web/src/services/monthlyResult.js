// Resultado mensal da clínica, montado com o que o sistema já registra:
// - atendimentos = baixas de estoque agrupadas por "atendimento_id" (cada "Registrar realização")
// - insumos reais = quantidade baixada × custo do lote usado
// - perdas = baixas por vencimento, quebra ou ajuste
// - custos fixos e taxas de pagamento cadastrados
// A receita ainda é ESTIMADA pelo preço da ficha, porque o sistema não guarda o valor cobrado.
import { supabase } from '../supabase';
import { calculateProcedure } from '../utils/costCalculations';
import { procedureStockItems } from './stockService';

export const PAYMENT_FORMS = [
  { key: 'pix', label: 'Pix / à vista', forma: 'À vista / Instantâneo' },
  { key: 'debito', label: 'Débito', forma: 'Débito' },
  { key: 'creditoVista', label: 'Crédito à vista', forma: 'Crédito à vista' },
  { key: 'creditoParcelado', label: 'Crédito parcelado', forma: 'Crédito Parcelado (2x a 6x)' },
];

export const DEFAULT_MIX = { pix: 35, debito: 20, creditoVista: 30, creditoParcelado: 15 };

export const monthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function lastMonths(count, from = new Date()) {
  const list = [];
  for (let i = count - 1; i >= 0; i--) list.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  return list;
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ---------- Dados do banco ----------

export async function loadData(months) {
  const [start] = months;
  const from = `${start}-01T00:00:00`;
  const movements = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('estoque_movimentos')
      .select('id, insumo_id, tipo, quantidade, custo_unitario, procedure_id, procedure_name, atendimento_id, created_at')
      .gte('created_at', from)
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(`Não foi possível ler as movimentações do estoque: ${error.message}`);
    movements.push(...data);
    if (data.length < 1000) break;
  }
  const [fixos, taxas] = await Promise.all([
    supabase.from('custos_fixos').select('nome, valor'),
    supabase.from('taxas_pagamento').select('bandeira, forma, taxa'),
  ]);
  if (fixos.error) throw new Error(`Não foi possível ler os custos fixos: ${fixos.error.message}`);
  if (taxas.error) throw new Error(`Não foi possível ler as taxas: ${taxas.error.message}`);
  return { movements, fixedCosts: fixos.data ?? [], fees: taxas.data ?? [] };
}

/** Taxa usada para cada forma: a cadastrada pela clínica (média, se houver mais de uma) ou a média do BCB. */
export function resolveFees(clinicFees, bcbRates) {
  const result = {};
  PAYMENT_FORMS.forEach(({ key, forma }) => {
    const rows = clinicFees.filter((fee) => fee.forma === forma);
    const clinic = rows.length > 0 ? rows.reduce((sum, row) => sum + Number(row.taxa || 0), 0) / rows.length : null;
    const bcb = bcbRates?.[key] ?? null;
    result[key] = {
      clinic,
      bcb,
      used: clinic ?? bcb ?? 0,
      source: clinic != null ? 'clínica' : bcb != null ? 'Banco Central' : 'sem taxa',
    };
  });
  return result;
}

// ---------- Cálculo ----------

function groupAttendances(movements) {
  const map = new Map();
  movements
    .filter((m) => m.tipo === 'consumo')
    .forEach((m) => {
      const id = m.atendimento_id ?? m.id;
      const entry = map.get(id) ?? {
        id,
        date: m.created_at,
        procedureId: m.procedure_id,
        procedureName: m.procedure_name || 'Procedimento',
        realStockCost: 0,
      };
      entry.realStockCost += Math.abs(Number(m.quantidade)) * Number(m.custo_unitario || 0);
      map.set(id, entry);
    });
  return [...map.values()];
}

/** Monta o resultado de um mês. */
export function computeMonth({ month, movements, fixedCosts, fees, procedures, insumosMap, settings, mix }) {
  const inMonth = movements.filter((m) => monthKey(m.created_at) === month);
  const procById = new Map(procedures.map((p) => [p.id, p]));
  const mixTotal = Object.values(mix).reduce((sum, v) => sum + Number(v || 0), 0) || 1;
  const feePercent = PAYMENT_FORMS.reduce((sum, { key }) => sum + (Number(mix[key] || 0) / mixTotal) * fees[key].used, 0);

  const attendances = groupAttendances(inMonth).map((att) => {
    const procedure = procById.get(att.procedureId);
    if (!procedure) {
      return { ...att, revenue: 0, fee: 0, external: 0, commission: 0, expectedStockCost: 0, missingProcedure: true };
    }
    const { breakdown } = calculateProcedure(procedure, insumosMap, settings);
    const revenue = procedure.suggestedPrice > 0 ? procedure.suggestedPrice : breakdown.suggestedPriceByMargin;
    const expectedStockCost = procedureStockItems(procedure, insumosMap, 1)
      .reduce((sum, item) => sum + item.quantity * (insumosMap.get(item.insumoId)?.costPerUnit ?? 0), 0);
    return {
      ...att,
      revenue,
      fee: revenue * (feePercent / 100),
      external: breakdown.externalProfessionalCost,
      commission: breakdown.vetCommissionCost,
      expectedStockCost,
      category: procedure.category,
    };
  });

  const sum = (key) => attendances.reduce((total, att) => total + (att[key] || 0), 0);
  const losses = inMonth
    .filter((m) => m.tipo === 'perda' || (m.tipo === 'ajuste' && Number(m.quantidade) < 0))
    .reduce((total, m) => total + Math.abs(Number(m.quantidade)) * Number(m.custo_unitario || 0), 0);
  const fixed = fixedCosts.reduce((total, c) => total + Number(c.valor || 0), 0);

  const revenue = sum('revenue');
  const fees_ = sum('fee');
  const supplies = sum('realStockCost');
  const external = sum('external');
  const commission = sum('commission');
  const contribution = revenue - fees_ - supplies - external - commission;
  const profit = contribution - fixed - losses;
  const contributionPerAttendance = attendances.length > 0 ? contribution / attendances.length : 0;

  // Procedimentos que mais deixaram margem no mês
  const byProcedure = new Map();
  attendances.forEach((att) => {
    const entry = byProcedure.get(att.procedureName) ?? { name: att.procedureName, count: 0, revenue: 0, margin: 0 };
    entry.count += 1;
    entry.revenue += att.revenue;
    entry.margin += att.revenue - att.fee - att.realStockCost - att.external - att.commission;
    byProcedure.set(att.procedureName, entry);
  });

  return {
    month,
    attendances,
    count: attendances.length,
    revenue,
    fees: fees_,
    feePercent,
    supplies,
    external,
    commission,
    contribution,
    fixed,
    losses,
    profit,
    breakEven: contributionPerAttendance > 0 ? Math.ceil((fixed + losses) / contributionPerAttendance) : null,
    ranking: [...byProcedure.values()].sort((a, b) => b.margin - a.margin),
  };
}

/** Consumo diário por insumo nos últimos N dias (para prever quando o estoque acaba). */
export function dailyUsage(movements, days, today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const usage = new Map();
  movements
    .filter((m) => m.tipo === 'consumo' && new Date(m.created_at) >= start)
    .forEach((m) => {
      const day = Math.floor((new Date(m.created_at) - start) / 86400000);
      const list = usage.get(m.insumo_id) ?? [];
      list.push({ day, quantity: Math.abs(Number(m.quantidade)) });
      usage.set(m.insumo_id, list);
    });
  return usage;
}

// ---------- Modo demonstração ----------

// Gerador pseudoaleatório com semente: a demonstração sai igual toda vez
function seededRandom(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seis meses de atendimentos simulados, no mesmo formato das movimentações reais.
 * Nada é gravado: serve só para ver a previsão funcionando com histórico.
 */
export function generateDemoMovements({ procedures, insumosMap, months, today = new Date() }) {
  const random = seededRandom(20261116);
  const usable = procedures.filter((p) => procedureStockItems(p, insumosMap, 1).length > 0);
  if (usable.length === 0) return [];
  const movements = [];
  let seq = 0;

  months.forEach((month, index) => {
    const [y, m] = month.split('-').map(Number);
    const isCurrent = index === months.length - 1;
    const lastDay = isCurrent ? today.getDate() : new Date(y, m, 0).getDate();
    // Clínica crescendo: ~+3 atendimentos por mês, com variação
    const fullMonthCount = 16 + index * 3 + Math.round((random() - 0.5) * 6);
    const count = Math.max(1, Math.round(fullMonthCount * (lastDay / new Date(y, m, 0).getDate())));

    for (let i = 0; i < count; i++) {
      const procedure = usable[Math.floor(random() * usable.length)];
      const day = 1 + Math.floor(random() * lastDay);
      const date = new Date(y, m - 1, day, 9 + Math.floor(random() * 9), Math.floor(random() * 60)).toISOString();
      const attendanceId = `demo-${month}-${i}`;
      // Algumas realizações gastam bem mais que a ficha (para a detecção de anomalias encontrar)
      const factor = random() < 0.04 ? 1.45 + random() * 0.2 : 0.95 + random() * 0.12;
      procedureStockItems(procedure, insumosMap, 1).forEach((item) => {
        movements.push({
          id: `demo-${++seq}`,
          insumo_id: item.insumoId,
          tipo: 'consumo',
          quantidade: -item.quantity * factor,
          custo_unitario: insumosMap.get(item.insumoId)?.costPerUnit ?? 0,
          procedure_id: procedure.id,
          procedure_name: procedure.name,
          atendimento_id: attendanceId,
          created_at: date,
        });
      });
    }

    // Uma ou duas perdas por mês (vencimento ou quebra)
    const losses = 1 + Math.floor(random() * 2);
    for (let i = 0; i < losses; i++) {
      const ids = [...insumosMap.keys()];
      const insumo = insumosMap.get(ids[Math.floor(random() * ids.length)]);
      movements.push({
        id: `demo-${++seq}`,
        insumo_id: insumo.id,
        tipo: 'perda',
        quantidade: -(2 + Math.floor(random() * 10)),
        custo_unitario: insumo.costPerUnit,
        created_at: new Date(y, m - 1, Math.min(lastDay, 5 + i * 10)).toISOString(),
      });
    }
  });
  return movements.sort((a, b) => a.created_at.localeCompare(b.created_at));
}
