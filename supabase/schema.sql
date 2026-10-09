-- =====================================================================
-- Animalia Cash — módulo de custos (insumos, procedimentos e configurações)
-- Rodar no Supabase: SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado mais de uma vez (idempotente).
--
-- Cada linha pertence a um usuário (owner_id = auth.uid()). As políticas de RLS
-- garantem que cada usuário só lê e grava os próprios dados.
-- Os ids são texto porque o app gera ids próprios (ex: 'cir_luva_esteril', 'proc_1727...').
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configurações da clínica (1 linha por usuário)
-- ---------------------------------------------------------------------
create table if not exists public.clinic_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
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

-- ---------------------------------------------------------------------
-- Profissionais terceirizados (anestesistas, especialistas)
-- ---------------------------------------------------------------------
create table if not exists public.external_professionals (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  specialty text not null,
  default_cost numeric(12, 2) not null default 0 check (default_cost >= 0),
  primary key (owner_id, id)
);

-- ---------------------------------------------------------------------
-- Insumos: custo unitário calculado a partir da embalagem (preço ÷ quantidade)
-- ou informado diretamente (ex: kWh, diária)
-- ---------------------------------------------------------------------
create table if not exists public.insumos (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  category text not null check (category in ('banho_tosa', 'cirurgia', 'internacao', 'geral')),
  unit text not null check (unit in ('un', 'ml', 'l', 'g', 'kg', 'par', 'm', 'kwh', 'min', 'dose', 'diaria', 'hora')),
  cost_per_unit numeric(14, 6) not null check (cost_per_unit >= 0),
  package_type text check (package_type in ('caixa', 'pacote', 'frasco', 'galao', 'ampola', 'bolsa', 'rolo', 'fardo', 'kit', 'unidade')),
  package_price numeric(12, 2) check (package_price >= 0),
  package_size numeric(14, 3) check (package_size > 0),
  notes text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

-- ---------------------------------------------------------------------
-- Procedimentos: cirurgias, diárias de internação e banho & tosa
-- ---------------------------------------------------------------------
create table if not exists public.procedures (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  category text not null check (category in ('banho_tosa', 'cirurgia', 'internacao')),
  description text not null default '',
  target_weight_kg numeric(6, 2),
  duration_minutes integer not null check (duration_minutes > 0),  -- na internação, o período total (1440 = 1 diária)
  labor_minutes integer check (labor_minutes >= 0),                 -- tempo de equipe que entra no custo operacional
  anesthesia_cost numeric(12, 2),                                   -- legado (hoje o anestesista é um profissional terceirizado)
  fixed_overhead_cost numeric(12, 2),
  vet_commission_type text check (vet_commission_type in ('percent', 'fixed')),
  vet_commission_value numeric(12, 2),
  vet_commission_role text,
  suggested_price numeric(12, 2),                                   -- preço cobrado do tutor
  target_margin_percent numeric(5, 2),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

-- Insumos usados em cada procedimento (ficha técnica)
create table if not exists public.procedure_items (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  procedure_id text not null,
  position integer not null,
  insumo_id text not null,
  quantity numeric(14, 3) not null check (quantity >= 0),
  notes text,
  primary key (owner_id, procedure_id, position),
  foreign key (owner_id, procedure_id) references public.procedures (owner_id, id) on delete cascade,
  foreign key (owner_id, insumo_id) references public.insumos (owner_id, id) on delete cascade
);

-- Profissionais terceirizados escalados em cada procedimento (com o custo naquele procedimento)
create table if not exists public.procedure_professionals (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  procedure_id text not null,
  professional_id text not null,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  primary key (owner_id, procedure_id, professional_id),
  foreign key (owner_id, procedure_id) references public.procedures (owner_id, id) on delete cascade,
  foreign key (owner_id, professional_id) references public.external_professionals (owner_id, id) on delete cascade
);

create index if not exists procedure_items_insumo_idx on public.procedure_items (owner_id, insumo_id);
create index if not exists procedure_professionals_professional_idx on public.procedure_professionals (owner_id, professional_id);

-- ---------------------------------------------------------------------
-- Row Level Security: cada usuário acessa apenas as próprias linhas
-- ---------------------------------------------------------------------
alter table public.clinic_settings enable row level security;
alter table public.external_professionals enable row level security;
alter table public.insumos enable row level security;
alter table public.procedures enable row level security;
alter table public.procedure_items enable row level security;
alter table public.procedure_professionals enable row level security;

-- Cria a política só se ela ainda não existir (permite rodar o script de novo sem apagar nada)
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
      where schemaname = 'public' and tablename = t and policyname = 'Dono acessa os próprios dados'
    ) then
      execute format(
        'create policy "Dono acessa os próprios dados" on public.%I for all to authenticated '
        'using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
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
