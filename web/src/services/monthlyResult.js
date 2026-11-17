// Resultado mensal da clínica, montado com o que o sistema registra:
// - atendimentos (tabela "atendimentos"): entram no mês da DATA DE REALIZAÇÃO, com o valor cobrado,
//   a forma de pagamento e a taxa do dia. Os agendados viram previsão do mês em que estão marcados.
// - insumos reais = quantidade baixada × custo do lote usado, ligada ao atendimento pelo "atendimento_id"
// - baixas antigas (de antes da tabela de atendimentos) entram pela data da baixa, com receita estimada
// - perdas = baixas por vencimento, quebra ou ajuste
// - custos fixos e taxas de pagamento cadastrados
import { supabase } from '../supabase';
import { calculateProcedure } from '../utils/costCalculations';
import { fetchAttendances } from './attendanceService';
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
  const [fixos, taxas, attendances] = await Promise.all([
    supabase.from('custos_fixos').select('nome, valor'),
    supabase.from('taxas_pagamento').select('bandeira, forma, taxa'),
    fetchAttendances(`${start}-01`),
  ]);
  if (fixos.error) throw new Error(`Não foi possível ler os custos fixos: ${fixos.error.message}`);
  if (taxas.error) throw new Error(`Não foi possível ler as taxas: ${taxas.error.message}`);
  // attendances = null quando a tabela ainda não existe no banco
  return { movements, attendances, fixedCosts: fixos.data ?? [], fees: taxas.data ?? [] };
}

/**
 * Taxa usada para cada forma: a cadastrada pela clínica (média, se houver mais de uma) ou a média do BCB.
 * Também aponta taxas repetidas: mesma forma e mesma bandeira cadastradas mais de uma vez.
 */
export function resolveFees(clinicFees, bcbRates) {
  const result = {};
  PAYMENT_FORMS.forEach(({ key, forma }) => {
    const rows = clinicFees.filter((fee) => fee.forma === forma);
    const clinic = rows.length > 0 ? rows.reduce((sum, row) => sum + Number(row.taxa || 0), 0) / rows.length : null;
    const bcb = bcbRates?.[key] ?? null;
    const byBrand = new Map();
    rows.forEach((row) => {
      const brand = (row.bandeira || 'Sem bandeira').trim();
      byBrand.set(brand, [...(byBrand.get(brand) ?? []), Number(row.taxa || 0)]);
    });
    const duplicates = [...byBrand]
      .filter(([, values]) => values.length > 1)
      .map(([brand, values]) => ({ brand, values }));
    result[key] = {
      clinic,
      bcb,
      used: clinic ?? bcb ?? 0,
      source: clinic != null ? 'clínica' : bcb != null ? 'Banco Central' : 'sem taxa',
      rowCount: rows.length,
      brands: byBrand.size,
      duplicates,
    };
  });
  return result;
}

const FORM_KEY = new Map(PAYMENT_FORMS.map(({ key, forma }) => [forma, key]));

/** Mês (AAAA-MM) de uma data do banco sem passar por fuso horário. */
const dateMonth = (isoDate) => String(isoDate).slice(0, 7);

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

/** Preço, custos da ficha e custo de estoque previsto de UMA realização do procedimento. */
function procedureEconomics(procedure, insumosMap, settings) {
  if (!procedure) return null;
  const { breakdown } = calculateProcedure(procedure, insumosMap, settings);
  return {
    price: procedure.suggestedPrice > 0 ? procedure.suggestedPrice : breakdown.suggestedPriceByMargin,
    external: breakdown.externalProfessionalCost,
    commission: breakdown.vetCommissionCost,
    expectedStockCost: procedureStockItems(procedure, insumosMap, 1)
      .reduce((sum, item) => sum + item.quantity * (insumosMap.get(item.insumoId)?.costPerUnit ?? 0), 0),
  };
}

/** Taxa média ponderada pelo mix estimado (usada quando a forma de pagamento não foi informada). */
export function mixFeePercent(mix, fees) {
  const mixTotal = Object.values(mix).reduce((sum, v) => sum + Number(v || 0), 0) || 1;
  return PAYMENT_FORMS.reduce((sum, { key }) => sum + (Number(mix[key] || 0) / mixTotal) * fees[key].used, 0);
}

/** Valor esperado de um atendimento: o cobrado, se informado; senão o preço da ficha. */
function attendanceRevenue(row, eco) {
  if (row.valor_cobrado != null) return { revenue: Number(row.valor_cobrado), estimated: false };
  return { revenue: (eco?.price ?? 0) * (row.quantidade || 1), estimated: true };
}

/** Taxa de um atendimento: a gravada no dia, a da forma de pagamento, ou a média do mix. */
function attendanceFeePercent(row, fees, fallbackPercent) {
  if (row.taxa_percentual != null) return { percent: Number(row.taxa_percentual), source: 'gravada no atendimento' };
  const key = FORM_KEY.get(row.forma_pagamento);
  if (key && fees[key].source !== 'sem taxa') return { percent: fees[key].used, source: fees[key].source };
  return { percent: fallbackPercent, source: 'mix estimado' };
}

/** Monta o resultado de um mês. */
export function computeMonth({ month, movements, attendances: registered, fixedCosts, fees, procedures, insumosMap, settings, mix }) {
  const procById = new Map(procedures.map((p) => [p.id, p]));
  const ecoCache = new Map();
  const economics = (procedureId) => {
    if (!ecoCache.has(procedureId)) ecoCache.set(procedureId, procedureEconomics(procById.get(procedureId), insumosMap, settings));
    return ecoCache.get(procedureId);
  };
  const feePercent = mixFeePercent(mix, fees);
  const rows = registered ?? [];
  const registeredIds = new Set(rows.map((row) => row.id));

  // Custo real dos insumos de cada atendimento (a baixa pode ter sido lançada em outro dia)
  const stockByAttendance = new Map();
  movements
    .filter((m) => m.tipo === 'consumo' && m.atendimento_id && registeredIds.has(m.atendimento_id))
    .forEach((m) => {
      const cost = Math.abs(Number(m.quantidade)) * Number(m.custo_unitario || 0);
      stockByAttendance.set(m.atendimento_id, (stockByAttendance.get(m.atendimento_id) ?? 0) + cost);
    });

  // 1. Atendimentos realizados neste mês, pela data de realização
  const fromTable = rows
    .filter((row) => row.status === 'realizado' && dateMonth(row.data_realizacao) === month)
    .map((row) => {
      const eco = economics(row.procedure_id);
      const times = row.quantidade || 1;
      const { revenue, estimated } = attendanceRevenue(row, eco);
      const fee = attendanceFeePercent(row, fees, feePercent);
      return {
        id: row.id,
        date: row.data_realizacao,
        procedureId: row.procedure_id,
        procedureName: row.procedure_name || 'Procedimento',
        patient: row.paciente,
        count: times,
        revenue,
        revenueEstimated: estimated,
        form: row.forma_pagamento,
        feePercent: fee.percent,
        feeSource: fee.source,
        fee: revenue * (fee.percent / 100),
        realStockCost: stockByAttendance.get(row.id) ?? 0,
        stockTracked: row.estoque_baixado,
        external: (eco?.external ?? 0) * times,
        commission: (eco?.commission ?? 0) * times,
        expectedStockCost: (eco?.expectedStockCost ?? 0) * times,
        category: row.categoria,
        missingProcedure: !eco,
      };
    });

  // 2. Baixas antigas, sem atendimento na tabela: entram pela data da baixa, com receita estimada
  const legacy = groupAttendances(movements.filter((m) => monthKey(m.created_at) === month && !registeredIds.has(m.atendimento_id)))
    .map((att) => {
      const eco = economics(att.procedureId);
      if (!eco) return { ...att, count: 1, revenue: 0, fee: 0, external: 0, commission: 0, expectedStockCost: 0, missingProcedure: true, legacy: true };
      return {
        ...att,
        count: 1,
        revenue: eco.price,
        revenueEstimated: true,
        feePercent,
        feeSource: 'mix estimado',
        fee: eco.price * (feePercent / 100),
        stockTracked: true,
        external: eco.external,
        commission: eco.commission,
        expectedStockCost: eco.expectedStockCost,
        legacy: true,
      };
    });

  const attendances = [...fromTable, ...legacy];

  // 3. Agendados para este mês (previsão)
  const scheduledRows = rows.filter((row) => row.status === 'agendado' && dateMonth(row.data_realizacao) === month);
  const scheduled = {
    count: scheduledRows.reduce((total, row) => total + (row.quantidade || 1), 0),
    revenue: scheduledRows.reduce((total, row) => total + attendanceRevenue(row, economics(row.procedure_id)).revenue, 0),
  };

  // Como os clientes pagaram de verdade neste mês (pelo valor), quando a forma foi informada
  const paidMix = {};
  let paidTotal = 0;
  fromTable.forEach((att) => {
    const key = FORM_KEY.get(att.form);
    if (!key) return;
    paidMix[key] = (paidMix[key] ?? 0) + att.revenue;
    paidTotal += att.revenue;
  });
  const realMix = paidTotal > 0
    ? Object.fromEntries(PAYMENT_FORMS.map(({ key }) => [key, ((paidMix[key] ?? 0) / paidTotal) * 100]))
    : null;

  const sum = (key) => attendances.reduce((total, att) => total + (att[key] || 0), 0);
  const losses = movements
    .filter((m) => monthKey(m.created_at) === month)
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
  const count = sum('count');
  const contributionPerAttendance = count > 0 ? contribution / count : 0;

  // Procedimentos que mais deixaram margem no mês
  const byProcedure = new Map();
  attendances.forEach((att) => {
    const entry = byProcedure.get(att.procedureName) ?? { name: att.procedureName, count: 0, revenue: 0, margin: 0 };
    entry.count += att.count;
    entry.revenue += att.revenue;
    entry.margin += att.revenue - att.fee - att.realStockCost - att.external - att.commission;
    byProcedure.set(att.procedureName, entry);
  });

  return {
    month,
    attendances,
    count,
    registeredCount: fromTable.reduce((total, att) => total + att.count, 0),
    legacyCount: legacy.length,
    estimatedRevenueCount: attendances.filter((att) => att.revenueEstimated).length,
    scheduled,
    realMix,
    revenue,
    fees: fees_,
    feePercent: revenue > 0 ? (fees_ / revenue) * 100 : feePercent,
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

const isoDay = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

function pickForm(random) {
  const total = Object.values(DEFAULT_MIX).reduce((sum, v) => sum + v, 0);
  let roll = random() * total;
  const found = PAYMENT_FORMS.find(({ key }) => {
    roll -= DEFAULT_MIX[key];
    return roll < 0;
  });
  return (found ?? PAYMENT_FORMS[0]).forma;
}

/**
 * Seis meses de atendimentos simulados, no mesmo formato das tabelas reais (atendimentos + movimentações),
 * mais alguns agendados até o mês que vem. Nada é gravado: serve só para ver o resultado e a previsão com histórico.
 */
export function generateDemoData({ procedures, insumosMap, settings, months, today = new Date() }) {
  const random = seededRandom(20261116);
  const usable = procedures.filter((p) => procedureStockItems(p, insumosMap, 1).length > 0);
  if (usable.length === 0) return { movements: [], attendances: [] };
  const movements = [];
  const attendances = [];
  const priceOf = (procedure) => procedureEconomics(procedure, insumosMap, settings).price;
  const newAttendance = (procedure, id, date, status) => ({
    id,
    procedure_id: procedure.id,
    procedure_name: procedure.name,
    categoria: procedure.category,
    quantidade: 1,
    data_realizacao: date,
    status,
    // Descontos e arredondamentos: o cobrado varia um pouco em torno do preço da ficha
    valor_cobrado: Math.round(priceOf(procedure) * (0.9 + random() * 0.15)),
    forma_pagamento: status === 'realizado' || random() < 0.5 ? pickForm(random) : null,
    taxa_percentual: null,
    estoque_baixado: status === 'realizado',
  });
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
      attendances.push(newAttendance(procedure, attendanceId, isoDay(y, m, day), 'realizado'));
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

  // Agenda: o resto deste mês e o mês que vem
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  for (let day = today.getDate() + 1; day <= daysInMonth; day += 2) {
    const procedure = usable[Math.floor(random() * usable.length)];
    attendances.push(newAttendance(procedure, `demo-ag-${++seq}`, isoDay(today.getFullYear(), today.getMonth() + 1, day), 'agendado'));
  }
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextDays = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  for (let i = 0; i < 12; i++) {
    const procedure = usable[Math.floor(random() * usable.length)];
    const day = 1 + Math.floor(random() * nextDays);
    attendances.push(newAttendance(procedure, `demo-ag-${++seq}`, isoDay(next.getFullYear(), next.getMonth() + 1, day), 'agendado'));
  }

  return {
    movements: movements.sort((a, b) => a.created_at.localeCompare(b.created_at)),
    attendances: attendances.sort((a, b) => a.data_realizacao.localeCompare(b.data_realizacao)),
  };
}
