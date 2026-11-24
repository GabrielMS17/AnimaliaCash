-- =====================================================================
-- Animalia Cash — comissão gravada em cada atendimento
-- Rodar no Supabase: SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado mais de uma vez. Não apaga nem altera dados existentes.
-- Depende de supabase/atendimentos.sql.
--
-- Atendimentos antigos ficam com os campos vazios e seguem o percentual atual da ficha.
-- =====================================================================

alter table public.atendimentos
  add column if not exists comissao_percentual numeric(5, 2) check (comissao_percentual >= 0),  -- 0 quando é valor fixo
  add column if not exists comissao_valor numeric(12, 2) check (comissao_valor >= 0);           -- comissão em R$ no dia
