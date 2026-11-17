-- =====================================================================
-- Remove o histórico de exemplo inserido em 17/11/2026 (maio a dezembro de 2026):
-- 441 atendimentos (406 realizados + 35 agendados), 5.826 baixas de insumos e 9 perdas.
--
-- Como reconhecer esses registros sem afetar os reais:
-- - atendimentos: created_at exatamente às 12:00:00 (horário de Brasília), sem frações de segundo
--   (os registrados pelo sistema têm o horário real do clique, com microssegundos)
-- - baixas de insumo: sem lote (lote_id nulo) e ligadas a esses atendimentos
--   (as baixas reais sempre saem de um lote)
-- - perdas: sem lote e com a observação 'Vencido / avariado'
-- O saldo do estoque (estoque_lotes) não foi alterado na inserção, então não precisa ser corrigido.
--
-- Rodar no Supabase: SQL Editor > New query > colar > Run. Confira as contagens antes de apagar.
-- =====================================================================

-- 1. Conferência (deve dar 441 / 5826 / 9)
select
  (select count(*) from public.atendimentos a
     where (a.created_at at time zone 'America/Sao_Paulo')::time = '12:00:00'
       and a.created_at = date_trunc('second', a.created_at)) as atendimentos,
  (select count(*) from public.estoque_movimentos m
     where m.lote_id is null and m.tipo = 'consumo'
       and m.atendimento_id in (
         select a.id from public.atendimentos a
         where (a.created_at at time zone 'America/Sao_Paulo')::time = '12:00:00'
           and a.created_at = date_trunc('second', a.created_at))) as baixas,
  (select count(*) from public.estoque_movimentos m
     where m.lote_id is null and m.tipo = 'perda' and m.observacao = 'Vencido / avariado') as perdas;

-- 2. Remoção (descomente para rodar)
-- begin;
-- delete from public.estoque_movimentos m
--  where m.lote_id is null and m.tipo = 'consumo'
--    and m.atendimento_id in (
--      select a.id from public.atendimentos a
--      where (a.created_at at time zone 'America/Sao_Paulo')::time = '12:00:00'
--        and a.created_at = date_trunc('second', a.created_at));
-- delete from public.estoque_movimentos m
--  where m.lote_id is null and m.tipo = 'perda' and m.observacao = 'Vencido / avariado';
-- delete from public.atendimentos a
--  where (a.created_at at time zone 'America/Sao_Paulo')::time = '12:00:00'
--    and a.created_at = date_trunc('second', a.created_at);
-- commit;
