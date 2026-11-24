-- =====================================================================
-- Animalia Cash — valores de custo por mês
-- Rodar no Supabase: SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado mais de uma vez. Não apaga nem altera dados existentes.
--
-- tipo 'fixo': valor de um custo fixo A PARTIR do mês informado (vale até o próximo valor gravado).
--              Sem nenhum valor gravado, o custo usa custos_fixos.valor em todos os meses.
-- tipo 'variavel': custo extra lançado só naquele mês (ex: exame externo, manutenção).
-- =====================================================================

begin;

create table if not exists public.custos_mensais (
  id uuid primary key default gen_random_uuid(),
  mes date not null check (extract(day from mes) = 1),   -- sempre o dia 1 do mês
  tipo text not null check (tipo in ('fixo', 'variavel')),
  custo_fixo_id uuid references public.custos_fixos (id) on delete cascade,
  nome text not null,
  categoria text,
  valor numeric(12, 2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check ((tipo = 'fixo') = (custo_fixo_id is not null)),
  unique (custo_fixo_id, mes)
);

create index if not exists custos_mensais_mes_idx on public.custos_mensais (mes, tipo);

alter table public.custos_mensais enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'custos_mensais' and policyname = 'Usuarios logados acessam a clinica'
  ) then
    create policy "Usuarios logados acessam a clinica" on public.custos_mensais
      for all to authenticated using (true) with check (true);
  end if;
end $$;

revoke all on public.custos_mensais from anon;
grant select, insert, update, delete on public.custos_mensais to authenticated;

commit;
