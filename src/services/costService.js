// Custos da clínica por mês: fixos (com valor que pode mudar a cada mês), variáveis extras e taxas.
// Tabela dos valores mensais em supabase/custos_mensais.sql.
import { supabase } from '../supabase';

export const FIXED_CATEGORIES = ['Estrutura', 'Utilidades', 'Pessoal', 'Administrativo', 'Manutenção'];
export const EXTRA_CATEGORIES = ['Cirurgia', 'Internação', 'Banho & Tosa', 'Geral'];
export const FEE_FORMS = ['À vista / Instantâneo', 'Débito', 'Crédito à vista', 'Crédito Parcelado (2x a 6x)'];
export const HOURS_PER_MONTH = 160;

// Guarda o valor que valia antes da primeira alteração, para os meses antigos não mudarem
const FIRST_MONTH = '2000-01-01';
const MISSING_CODES = new Set(['PGRST205', '42P01']);

export const monthDate = (key) => `${key}-01`;

export function nextMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function monthKeyOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ---------- Cálculo ----------

/** Valor de um custo fixo num mês: o último gravado até aquele mês; sem nenhum, o valor do cadastro. */
export function fixedValueFor(cost, month, monthly) {
  const date = monthDate(month);
  let latest = null;
  (monthly ?? []).forEach((row) => {
    if (row.tipo !== 'fixo' || row.custo_fixo_id !== cost.id || row.mes > date) return;
    if (!latest || row.mes > latest.mes) latest = row;
  });
  return Number(latest ? latest.valor : cost.valor || 0);
}

/** Custos fixos com o valor do mês, do maior para o menor (os que não valem no mês ficam no fim). */
export function fixedCostsFor(month, fixedCosts, monthly) {
  return fixedCosts
    .map((cost) => ({ ...cost, value: fixedValueFor(cost, month, monthly) }))
    .sort((a, b) => b.value - a.value || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Meses seguintes que já têm um valor próprio diferente (mudam junto em 'deste mês em diante'). */
export function laterChanges(cost, month, value, monthly) {
  return (monthly ?? []).filter((row) => row.tipo === 'fixo' && row.custo_fixo_id === cost.id
    && row.mes > monthDate(month) && Number(row.valor) !== value).length;
}

/** Custos variáveis extras lançados no mês. */
export function extrasFor(month, monthly) {
  return (monthly ?? []).filter((row) => row.tipo === 'variavel' && row.mes === monthDate(month));
}

/**
 * Linhas a gravar para mudar um custo fixo num mês.
 * scope 'forward': deste mês em diante (inclui meses seguintes que já tinham outro valor); 'only': só neste mês (o seguinte volta ao valor de antes).
 */
export function fixedValueRows({ cost, month, value, scope, monthly }) {
  const own = (monthly ?? []).filter((row) => row.tipo === 'fixo' && row.custo_fixo_id === cost.id);
  const has = (date) => own.some((row) => row.mes === date);
  const row = (mes, valor) => ({ mes, tipo: 'fixo', custo_fixo_id: cost.id, nome: cost.nome, categoria: cost.categoria ?? null, valor });
  const before = fixedValueFor(cost, month, monthly);
  const next = monthDate(nextMonthKey(month));
  const rows = [];
  if (!has(FIRST_MONTH)) rows.push(row(FIRST_MONTH, Number(cost.valor || 0)));
  rows.push(row(monthDate(month), value));
  if (scope === 'only' && !has(next)) rows.push(row(next, before));
  if (scope === 'forward') own.filter((old) => old.mes > monthDate(month)).forEach((old) => rows.push(row(old.mes, value)));
  return rows;
}

const merge = (monthly, rows) => [
  ...(monthly ?? []).filter((old) => !rows.some((row) => row.custo_fixo_id === old.custo_fixo_id && row.mes === old.mes)),
  ...rows,
];

// ---------- Banco ----------

function costError(error) {
  if (MISSING_CODES.has(error?.code)) return new Error('Os custos por mês ainda não foram criados no banco (falta rodar supabase/custos_mensais.sql).');
  return new Error(error?.message || 'Erro desconhecido ao salvar os custos.');
}

/** Valores mensais gravados. Retorna null se a tabela ainda não existe. */
export async function fetchMonthlyCosts() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('custos_mensais')
      .select('id, mes, tipo, custo_fixo_id, nome, categoria, valor')
      .order('mes', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + 999);
    if (error) {
      if (MISSING_CODES.has(error.code)) return null;
      throw new Error(`Não foi possível ler os custos do mês: ${error.message}`);
    }
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function upsertFixedRows(rows) {
  const { error } = await supabase
    .from('custos_mensais')
    .upsert(rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })), { onConflict: 'custo_fixo_id,mes' });
  if (error) throw costError(error);
}

/** Altera nome, categoria e valor de um custo fixo a partir de um mês, ou só nele. */
export async function saveFixedCost({ cost, nome, categoria, value, month, scope, monthly }) {
  const changes = {};
  if (nome !== cost.nome) changes.nome = nome;
  if (categoria !== cost.categoria) changes.categoria = categoria;
  let current = Number(cost.valor || 0);
  if (value !== fixedValueFor(cost, month, monthly)) {
    const rows = fixedValueRows({ cost: { ...cost, nome, categoria }, month, value, scope, monthly });
    await upsertFixedRows(rows);
    // custos_fixos.valor acompanha o valor do mês atual
    current = fixedValueFor(cost, monthKeyOf(), merge(monthly, rows));
  }
  if (current !== Number(cost.valor || 0)) changes.valor = current;
  if (Object.keys(changes).length === 0) return;
  const { error } = await supabase.from('custos_fixos').update(changes).eq('id', cost.id);
  if (error) throw costError(error);
}

/** Novo custo fixo, valendo a partir do mês escolhido (os meses anteriores não mudam). */
export async function createFixedCost({ nome, categoria, value, month, scope }) {
  const now = monthKeyOf();
  const startsLater = month > now;
  const endsBefore = scope === 'only' && month < now;
  const { data, error } = await supabase
    .from('custos_fixos')
    .insert([{ nome, categoria, valor: startsLater || endsBefore ? 0 : value }])
    .select('id')
    .single();
  if (error) throw costError(error);
  const cost = { id: data.id, nome, categoria, valor: 0 };
  try {
    await upsertFixedRows(fixedValueRows({ cost, month, value, scope, monthly: [] }));
  } catch (rowsError) {
    // Sem o histórico, o custo valeria em todos os meses: desfaz o cadastro
    await supabase.from('custos_fixos').delete().eq('id', cost.id);
    throw rowsError;
  }
}

export async function deleteFixedCost(id) {
  const { error } = await supabase.from('custos_fixos').delete().eq('id', id);
  if (error) throw costError(error);
}

export async function saveExtra({ id, nome, categoria, value, month }) {
  const row = { nome, categoria, valor: value, updated_at: new Date().toISOString() };
  const { error } = id
    ? await supabase.from('custos_mensais').update(row).eq('id', id)
    : await supabase.from('custos_mensais').insert([{ ...row, tipo: 'variavel', mes: monthDate(month) }]);
  if (error) throw costError(error);
}

export async function deleteExtra(id) {
  const { error } = await supabase.from('custos_mensais').delete().eq('id', id);
  if (error) throw costError(error);
}

export async function saveFee({ id, bandeira, forma, taxa }) {
  const { error } = id
    ? await supabase.from('taxas_pagamento').update({ bandeira, forma, taxa }).eq('id', id)
    : await supabase.from('taxas_pagamento').insert([{ bandeira, forma, taxa }]);
  if (error) throw costError(error);
}

export async function deleteFee(id) {
  const { error } = await supabase.from('taxas_pagamento').delete().eq('id', id);
  if (error) throw costError(error);
}
