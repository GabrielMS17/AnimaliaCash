// Estoque: lotes, entradas, baixas e consumo dos procedimentos realizados.
// Diferente do catálogo (insumos e procedimentos), o estoque é gravado direto no Supabase:
// o saldo é compartilhado entre todos e não pode ter duas versões, uma em cada aparelho.
// As regras ficam em funções do banco (supabase/estoque.sql) para cada operação ser completa ou nada.
import { supabase } from '../supabase';

/** Unidades que não são guardadas em estoque (energia, tempo, diária). */
export const NON_STOCK_UNITS = ['kwh', 'min', 'hora', 'diaria'];

export const WRITE_OFF_REASONS = [
  { value: 'Vencido', label: 'Vencido' },
  { value: 'Avaria / quebra', label: 'Avaria / quebra' },
  { value: 'Perda / extravio', label: 'Perda / extravio' },
  { value: 'Ajuste de inventário', label: 'Ajuste de inventário' },
];

export const EXPIRING_DAYS = 30;

export function isStockTracked(insumo) {
  if (!insumo) return false;
  return insumo.trackStock ?? !NON_STOCK_UNITS.includes(insumo.unit);
}

/** Data de hoje em AAAA-MM-DD, no horário local. */
export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Dias entre hoje e a validade (negativo = vencido). */
export function daysUntil(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  return Math.round((target - Date.UTC(ty, tm - 1, td)) / 86400000);
}

export function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Converte "31/12/2026" em "2026-12-31". Retorna null se vazio e lança erro se inválida. */
export function parseDateBR(text) {
  const value = text.trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error('Informe a validade no formato DD/MM/AAAA.');
  const [, d, m, y] = match;
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error('Informe uma data de validade válida.');
  return iso;
}

/** Digita a barra da data sozinha: "3112" vira "31/12". */
export function maskDateBR(text) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function friendlyError(error) {
  const code = error?.code;
  if (code === 'PGRST205' || code === 'PGRST202' || code === '42P01' || code === '42883') {
    return new Error('O estoque ainda não foi criado no banco de dados (falta rodar supabase/estoque.sql).');
  }
  if (code === '23503') {
    return new Error('Este insumo ainda não chegou ao banco. Aguarde a sincronização e tente de novo.');
  }
  return new Error(error?.message || 'Erro desconhecido ao acessar o estoque.');
}

const num = (value) => (value === null || value === undefined ? 0 : Number(value));

function toLot(row) {
  return {
    id: row.id,
    insumoId: row.insumo_id,
    lotNumber: row.numero_lote ?? '',
    expiresAt: row.validade ?? null,
    packageType: row.embalagem ?? null,
    packages: row.quantidade_embalagens == null ? null : Number(row.quantidade_embalagens),
    unitsPerPackage: row.unidades_por_embalagem == null ? null : Number(row.unidades_por_embalagem),
    initialQuantity: num(row.quantidade_inicial),
    quantity: num(row.quantidade_atual),
    totalCost: num(row.custo_total),
    unitCost: num(row.custo_unitario),
    notes: row.observacao ?? '',
    createdAt: row.created_at,
  };
}

/** Lotes com saldo (inclui os vencidos, que precisam de baixa). */
export async function fetchLots() {
  const lots = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('estoque_lotes')
      .select('*')
      .gt('quantidade_atual', 0)
      .order('validade', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error) throw friendlyError(error);
    lots.push(...data.map(toLot));
    if (data.length < 1000) return lots;
  }
}

export async function fetchMovements(insumoId, limit = 30) {
  const { data, error } = await supabase
    .from('estoque_movimentos')
    .select('id, tipo, quantidade, custo_unitario, procedure_name, observacao, created_at, estoque_lotes(numero_lote)')
    .eq('insumo_id', insumoId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw friendlyError(error);
  return data.map((row) => ({
    id: row.id,
    type: row.tipo,
    quantity: num(row.quantidade),
    unitCost: num(row.custo_unitario),
    procedureName: row.procedure_name ?? '',
    notes: row.observacao ?? '',
    lotNumber: row.estoque_lotes?.numero_lote ?? '',
    createdAt: row.created_at,
  }));
}

/** Saldo por insumo, considerando só lotes dentro da validade, mais os alertas de validade. */
export function summarizeLots(lots) {
  const map = new Map();
  lots.forEach((lot) => {
    const entry = map.get(lot.insumoId) ?? { available: 0, expired: 0, value: 0, lots: [], nextExpiry: null };
    const days = daysUntil(lot.expiresAt);
    if (days !== null && days < 0) {
      entry.expired += lot.quantity;
    } else {
      entry.available += lot.quantity;
      entry.value += lot.quantity * lot.unitCost;
      if (lot.expiresAt && (!entry.nextExpiry || lot.expiresAt < entry.nextExpiry)) entry.nextExpiry = lot.expiresAt;
    }
    entry.lots.push(lot);
    map.set(lot.insumoId, entry);
  });
  map.forEach((entry) => {
    entry.averageCost = entry.available > 0 ? entry.value / entry.available : 0;
  });
  return map;
}

export async function registerEntry({ insumoId, packages, unitsPerPackage, totalCost, packageType, lotNumber, expiresAt, notes }) {
  const { data, error } = await supabase.rpc('registrar_entrada_estoque', {
    p_insumo_id: insumoId,
    p_quantidade_embalagens: packages,
    p_unidades_por_embalagem: unitsPerPackage,
    p_custo_total: totalCost,
    p_embalagem: packageType ?? null,
    p_numero_lote: lotNumber || null,
    p_validade: expiresAt || null,
    p_observacao: notes || null,
  });
  if (error) throw friendlyError(error);
  return data;
}

export async function registerWriteOff({ lotId, quantity, type = 'perda', notes }) {
  const { error } = await supabase.rpc('registrar_baixa_estoque', {
    p_lote_id: lotId,
    p_quantidade: quantity,
    p_tipo: type,
    p_observacao: notes || null,
  });
  if (error) throw friendlyError(error);
}

/** Itens de estoque que um procedimento gasta, multiplicados pelo número de realizações. */
export function procedureStockItems(procedure, insumosMap, times = 1) {
  const totals = new Map();
  procedure.items.forEach((item) => {
    const insumo = insumosMap.get(item.insumoId);
    if (!isStockTracked(insumo) || !(item.quantity > 0)) return;
    totals.set(item.insumoId, (totals.get(item.insumoId) ?? 0) + item.quantity * times);
  });
  return [...totals].map(([insumoId, quantity]) => ({ insumoId, quantity: Number(quantity.toFixed(3)) }));
}

/**
 * Baixa do estoque os itens de um procedimento realizado. Se faltar algo, nada é baixado e o erro
 * traz `missing`: [{ insumoId, needed, available }].
 */
export async function consumeProcedure({ procedure, items, notes }) {
  const { data, error } = await supabase.rpc('registrar_consumo_estoque', {
    p_itens: items.map((item) => ({ insumo_id: item.insumoId, quantidade: item.quantity })),
    p_procedure_id: procedure.id,
    p_procedure_name: procedure.name,
    p_observacao: notes || null,
  });
  if (error) {
    if (error.message === 'ESTOQUE_INSUFICIENTE') {
      const missing = JSON.parse(error.details || '[]').map((row) => ({
        insumoId: row.insumo_id,
        needed: Number(row.necessario),
        available: Number(row.disponivel),
      }));
      const shortage = new Error('Estoque insuficiente para registrar este procedimento.');
      shortage.missing = missing;
      throw shortage;
    }
    throw friendlyError(error);
  }
  return data;
}
