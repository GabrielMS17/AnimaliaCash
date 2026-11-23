// Atendimentos: cada procedimento realizado ou agendado, com data, valor cobrado e forma de pagamento.
// Tabela e funções em supabase/atendimentos.sql.
import { supabase } from '../supabase';
import { stockRpcError } from './stockService';

export const STATUS_LABEL = { agendado: 'Agendado', realizado: 'Realizado', cancelado: 'Cancelado' };

const MISSING_CODES = new Set(['PGRST205', 'PGRST202', '42P01', '42883']);

function attendanceError(error) {
  if (MISSING_CODES.has(error?.code)) {
    return new Error('Os atendimentos ainda não foram criados no banco (falta rodar supabase/atendimentos.sql).');
  }
  return stockRpcError(error);
}

/** Data de hoje no fuso do aparelho, no formato do banco (AAAA-MM-DD). */
export function todayISO(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

const toItems = (items) => items.map((item) => ({ insumo_id: item.insumoId, quantidade: item.quantity }));

export async function registerAttendance({ procedure, date, status, times, value, form, feePercent, patient, notes, items }) {
  const { data, error } = await supabase.rpc('registrar_atendimento', {
    p_procedure_id: procedure.id,
    p_procedure_name: procedure.name,
    p_categoria: procedure.category ?? null,
    p_data: date,
    p_status: status,
    p_quantidade: times,
    p_valor: value,
    p_forma: form || null,
    p_taxa: feePercent ?? null,
    p_paciente: patient || null,
    p_observacao: notes || null,
    p_itens: status === 'realizado' ? toItems(items) : [],
  });
  if (error) throw attendanceError(error);
  return data;
}

export async function concludeAttendance({ id, date, items }) {
  const { error } = await supabase.rpc('concluir_atendimento', { p_id: id, p_data: date, p_itens: toItems(items) });
  if (error) throw attendanceError(error);
}

export async function cancelAttendance(id) {
  const { error } = await supabase
    .from('atendimentos')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'agendado');
  if (error) throw attendanceError(error);
}

/** Acrescenta um texto à observação de um atendimento (ex: ajuste feito ao concluir). */
export async function appendAttendanceNote(id, currentNote, text) {
  const observacao = [currentNote, text].filter(Boolean).join(' | ');
  const { error } = await supabase.from('atendimentos').update({ observacao, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw attendanceError(error);
}

/** Itens baixados do estoque em cada atendimento: Map(atendimentoId -> [{ insumoId, quantity, cost }]). */
export async function fetchAttendanceItems(ids) {
  const result = new Map();
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    const { data, error } = await supabase
      .from('estoque_movimentos')
      .select('atendimento_id, insumo_id, quantidade, custo_unitario')
      .eq('tipo', 'consumo')
      .in('atendimento_id', chunk);
    if (error) throw new Error(`Não foi possível ler os itens usados: ${error.message}`);
    data.forEach((row) => {
      const list = result.get(row.atendimento_id) ?? [];
      const quantity = Math.abs(Number(row.quantidade));
      const existing = list.find((item) => item.insumoId === row.insumo_id);
      // Um mesmo insumo pode sair de mais de um lote: junta numa linha
      if (existing) {
        existing.quantity += quantity;
        existing.cost += quantity * Number(row.custo_unitario || 0);
      } else {
        list.push({ insumoId: row.insumo_id, quantity, cost: quantity * Number(row.custo_unitario || 0) });
      }
      result.set(row.atendimento_id, list);
    });
  }
  return result;
}

/**
 * Atendimentos a partir de uma data (inclui os agendados no futuro).
 * Retorna null se a tabela ainda não existe, para as telas caírem no modo antigo.
 */
export async function fetchAttendances(fromDate) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('id, procedure_id, procedure_name, categoria, quantidade, data_realizacao, status, valor_cobrado, forma_pagamento, taxa_percentual, paciente, observacao, estoque_baixado, created_at')
      .gte('data_realizacao', fromDate)
      .order('data_realizacao', { ascending: true })
      .range(offset, offset + 999);
    if (error) {
      if (MISSING_CODES.has(error.code)) return null;
      throw new Error(`Não foi possível ler os atendimentos: ${error.message}`);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
