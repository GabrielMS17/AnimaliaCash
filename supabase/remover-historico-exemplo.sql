-- =====================================================================
-- Remove o histórico FICTÍCIO usado para treinar a previsão (regressão linear):
-- - 17/11/2026: 441 atendimentos (maio a dezembro de 2026), 5.826 baixas de insumos e 9 perdas.
-- - 24/11/2026: 250 atendimentos (novembro de 2025 a abril de 2026) e 3.793 baixas,
--   todos com a observação 'Registro fictício'.
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

-- 1. Conferência (deve dar 691 / 9619 / 9)
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

-- 3. Só os 250 marcados como 'Registro fictício' (descomente para rodar)
-- begin;
-- delete from public.estoque_movimentos where observacao = 'Registro fictício' and lote_id is null;
-- delete from public.atendimentos where observacao = 'Registro fictício';
-- commit;
