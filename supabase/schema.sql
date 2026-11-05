-- =====================================================================
-- Animalia Cash — módulo de custos (insumos, procedimentos e configurações)
-- Rodar no Supabase: SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado mais de uma vez: só cria o que ainda não existe.
-- Não altera nem depende de tabelas existentes, como public.profiles.
--
-- Versão para UMA clínica: todos os usuários logados compartilham os mesmos dados.
-- Quem não está logado não acessa nada. Permissões por papel ficam para depois.
-- Os ids são texto porque o app gera ids próprios (ex: 'cir_luva_esteril', 'proc_1727...').
-- =====================================================================

begin;

-- Configurações da clínica (sempre uma única linha: id = true)
create table if not exists public.clinic_settings (
  id boolean primary key default true check (id),
  project_name text,
  clinic_name text not null,
  logo_url text,
  hourly_operational_rate numeric(12, 2) not null default 0,       -- custo operacional por hora (R$/h)
  default_anesthesia_cost numeric(12, 2),                          -- legado: custo padrão do anestesista
  default_vet_commission_surgery_percent numeric(5, 2),
  default_vet_commission_internment_percent numeric(5, 2),
  default_vet_commission_bath_percent numeric(5, 2),
  include_labor_in_cost boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Profissionais terceirizados (anestesistas, especialistas)
create table if not exists public.external_professionals (
  id text primary key,
  name text not null,
  specialty text not null,
  default_cost numeric(12, 2) not null default 0 check (default_cost >= 0),
  updated_at timestamptz not null default now()
);

-- Insumos: custo unitário calculado pela embalagem (preço ÷ quantidade) ou informado direto (ex: kWh, diária)
create table if not exists public.insumos (
  id text primary key,
  name text not null,
  category text not null check (category in ('banho_tosa', 'cirurgia', 'internacao', 'geral')),
  unit text not null check (unit in ('un', 'ml', 'l', 'g', 'kg', 'par', 'm', 'kwh', 'min', 'dose', 'diaria', 'hora')),
  cost_per_unit numeric(14, 6) not null check (cost_per_unit >= 0),
  package_type text check (package_type in ('caixa', 'pacote', 'frasco', 'galao', 'ampola', 'bolsa', 'rolo', 'fardo', 'kit', 'unidade')),
  package_price numeric(12, 2) check (package_price >= 0),
  package_size numeric(14, 3) check (package_size > 0),
  notes text,
  updated_at timestamptz not null default now()
);

-- Procedimentos: cirurgias, diárias de internação e banho & tosa
create table if not exists public.procedures (
  id text primary key,
  name text not null,
  category text not null check (category in ('banho_tosa', 'cirurgia', 'internacao')),
  description text not null default '',
  target_weight_kg numeric(6, 2),
  duration_minutes integer not null check (duration_minutes > 0),  -- na internação, o período total (1440 = 1 diária)
  labor_minutes integer check (labor_minutes >= 0),                -- tempo de equipe que entra no custo operacional
  anesthesia_cost numeric(12, 2),                                  -- legado (hoje o anestesista é um terceirizado)
  fixed_overhead_cost numeric(12, 2),
  vet_commission_type text check (vet_commission_type in ('percent', 'fixed')),
  vet_commission_value numeric(12, 2),
  vet_commission_role text,
  suggested_price numeric(12, 2),                                  -- preço cobrado do tutor
  target_margin_percent numeric(5, 2),
  updated_at timestamptz not null default now()
);

-- Insumos usados em cada procedimento (ficha técnica)
create table if not exists public.procedure_items (
  procedure_id text not null references public.procedures (id) on delete cascade,
  position integer not null,
  insumo_id text not null references public.insumos (id) on delete cascade,
  quantity numeric(14, 3) not null check (quantity >= 0),
  notes text,
  primary key (procedure_id, position)
);

-- Terceirizados de cada procedimento, com o custo naquele procedimento
create table if not exists public.procedure_professionals (
  procedure_id text not null references public.procedures (id) on delete cascade,
  professional_id text not null references public.external_professionals (id) on delete cascade,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  primary key (procedure_id, professional_id)
);

create index if not exists procedure_items_insumo_idx on public.procedure_items (insumo_id);
create index if not exists procedure_professionals_professional_idx on public.procedure_professionals (professional_id);

-- Row Level Security: só usuários logados acessam
alter table public.clinic_settings enable row level security;
alter table public.external_professionals enable row level security;
alter table public.insumos enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_items enable row level security;
alter table public.procedure_professionals enable row level security;

-- Cria a política só se ela ainda não existir
do $$
declare
  t text;
begin
  foreach t in array array[
    'clinic_settings', 'external_professionals', 'insumos',
    'procedures', 'procedure_items', 'procedure_professionals'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'Usuarios logados acessam a clinica'
    ) then
      execute format(
        'create policy "Usuarios logados acessam a clinica" on public.%I for all to authenticated '
        'using (true) with check (true)',
        t
      );
    end if;
  end loop;
end $$;

grant select, insert, update, delete on
  public.clinic_settings,
  public.external_professionals,
  public.insumos,
  public.procedures,
  public.procedure_items,
  public.procedure_professionals
to authenticated;

commit;
