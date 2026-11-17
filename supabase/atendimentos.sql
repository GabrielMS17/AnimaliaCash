-- =====================================================================
-- Animalia Cash — atendimentos (data, status, valor cobrado e forma de pagamento)
--               e verificação do CRMV dos veterinários
-- Rodar no Supabase: SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado mais de uma vez. Não apaga dados existentes.
-- Depende de supabase/schema.sql e supabase/estoque.sql.
-- =====================================================================

begin;

-- 1. Verificação do CRMV: quando e por quem o registro foi conferido no site do CFMV
alter table public.profiles add column if not exists crmv_verificado_em timestamptz;
alter table public.profiles add column if not exists crmv_verificado_por uuid;

-- 2. Atendimentos: cada procedimento feito (ou agendado), com a data em que aconteceu
create table if not exists public.atendimentos (
  id uuid primary key default gen_random_uuid(),
  procedure_id text,                       -- sem chave estrangeira: o histórico continua se a ficha for apagada
  procedure_name text not null,
  categoria text check (categoria in ('banho_tosa', 'cirurgia', 'internacao')),
  quantidade integer not null default 1 check (quantidade > 0),   -- quantas vezes foi feito neste registro
  data_realizacao date not null default current_date,             -- mês em que entra no resultado
  status text not null default 'realizado' check (status in ('agendado', 'realizado', 'cancelado')),
  valor_cobrado numeric(12, 2) check (valor_cobrado >= 0),       -- total cobrado do tutor
  forma_pagamento text check (forma_pagamento in (
    'À vista / Instantâneo', 'Débito', 'Crédito à vista', 'Crédito Parcelado (2x a 6x)'
  )),
  taxa_percentual numeric(5, 2) check (taxa_percentual >= 0),     -- taxa da forma de pagamento no dia
  paciente text,
  observacao text,
  estoque_baixado boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create index if not exists atendimentos_data_idx on public.atendimentos (data_realizacao, status);

alter table public.atendimentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'atendimentos' and policyname = 'Usuarios logados acessam a clinica'
  ) then
    create policy "Usuarios logados acessam a clinica" on public.atendimentos
      for all to authenticated using (true) with check (true);
  end if;
end $$;

grant select, insert, update, delete on public.atendimentos to authenticated;

-- 3. A baixa do estoque passa a poder ser ligada a um atendimento
--    (o parâmetro novo é opcional, então o app que já está instalado continua funcionando)
drop function if exists public.registrar_consumo_estoque(jsonb, text, text, text);

create or replace function public.registrar_consumo_estoque(
  p_itens jsonb,
  p_procedure_id text default null,
  p_procedure_name text default null,
  p_observacao text default null,
  p_atendimento_id uuid default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_atendimento uuid := coalesce(p_atendimento_id, gen_random_uuid());
  v_item record;
  v_lote record;
  v_disponivel numeric;
  v_restante numeric;
  v_usar numeric;
  v_faltando jsonb := '[]'::jsonb;
begin
  perform 1 from estoque_lotes
  where insumo_id in (select x.insumo_id from jsonb_to_recordset(p_itens) as x (insumo_id text, quantidade numeric))
  for update;

  for v_item in
    select x.insumo_id, sum(x.quantidade) as quantidade
    from jsonb_to_recordset(p_itens) as x (insumo_id text, quantidade numeric)
    where x.quantidade > 0
    group by x.insumo_id
  loop
    select coalesce(sum(quantidade_atual), 0) into v_disponivel
    from estoque_lotes
    where insumo_id = v_item.insumo_id and quantidade_atual > 0 and (validade is null or validade >= current_date);

    if v_disponivel < v_item.quantidade then
      v_faltando := v_faltando || jsonb_build_object(
        'insumo_id', v_item.insumo_id, 'necessario', v_item.quantidade, 'disponivel', v_disponivel
      );
    end if;
  end loop;

  if jsonb_array_length(v_faltando) > 0 then
    raise exception 'ESTOQUE_INSUFICIENTE' using detail = v_faltando::text;
  end if;

  for v_item in
    select x.insumo_id, sum(x.quantidade) as quantidade
    from jsonb_to_recordset(p_itens) as x (insumo_id text, quantidade numeric)
    where x.quantidade > 0
    group by x.insumo_id
  loop
    v_restante := v_item.quantidade;
    for v_lote in
      select id, quantidade_atual, custo_unitario
      from estoque_lotes
      where insumo_id = v_item.insumo_id and quantidade_atual > 0 and (validade is null or validade >= current_date)
      order by validade asc nulls last, created_at asc
    loop
      exit when v_restante <= 0;
      v_usar := least(v_lote.quantidade_atual, v_restante);
      update estoque_lotes set quantidade_atual = quantidade_atual - v_usar where id = v_lote.id;
      insert into estoque_movimentos (
        insumo_id, lote_id, tipo, quantidade, custo_unitario, procedure_id, procedure_name, atendimento_id, observacao
      ) values (
        v_item.insumo_id, v_lote.id, 'consumo', -v_usar, v_lote.custo_unitario,
        p_procedure_id, p_procedure_name, v_atendimento, nullif(trim(p_observacao), '')
      );
      v_restante := v_restante - v_usar;
    end loop;
  end loop;

  return jsonb_build_object('atendimento_id', v_atendimento);
end $$;

-- 4. Registra um atendimento. Se já foi realizado, baixa o estoque na mesma operação
--    (se faltar estoque, nada é gravado). Agendado não mexe no estoque.
create or replace function public.registrar_atendimento(
  p_procedure_id text,
  p_procedure_name text,
  p_categoria text,
  p_data date,
  p_status text,
  p_quantidade integer,
  p_valor numeric,
  p_forma text,
  p_taxa numeric,
  p_paciente text,
  p_observacao text,
  p_itens jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_status not in ('agendado', 'realizado') then
    raise exception 'Status inválido para um novo atendimento.';
  end if;
  if p_status = 'realizado' and p_data > current_date then
    raise exception 'Um atendimento realizado não pode ter data futura. Use "agendado".';
  end if;

  insert into atendimentos (
    procedure_id, procedure_name, categoria, quantidade, data_realizacao, status,
    valor_cobrado, forma_pagamento, taxa_percentual, paciente, observacao
  ) values (
    p_procedure_id, p_procedure_name, p_categoria, coalesce(p_quantidade, 1), coalesce(p_data, current_date), p_status,
    p_valor, p_forma, p_taxa, nullif(trim(p_paciente), ''), nullif(trim(p_observacao), '')
  ) returning id into v_id;

  if p_status = 'realizado' and jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 0 then
    perform registrar_consumo_estoque(p_itens, p_procedure_id, p_procedure_name, p_observacao, v_id);
    update atendimentos set estoque_baixado = true where id = v_id;
  end if;

  return v_id;
end $$;

-- 5. Conclui um atendimento agendado: muda para realizado e baixa o estoque
create or replace function public.concluir_atendimento(
  p_id uuid,
  p_data date,
  p_itens jsonb
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_at record;
begin
  select * into v_at from atendimentos where id = p_id for update;
  if not found then
    raise exception 'Atendimento não encontrado.';
  end if;
  if v_at.status <> 'agendado' then
    raise exception 'Só atendimentos agendados podem ser concluídos.';
  end if;
  if coalesce(p_data, current_date) > current_date then
    raise exception 'A data de realização não pode ser futura.';
  end if;

  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 0 then
    perform registrar_consumo_estoque(p_itens, v_at.procedure_id, v_at.procedure_name, v_at.observacao, p_id);
  end if;

  update atendimentos
  set status = 'realizado',
      data_realizacao = coalesce(p_data, current_date),
      estoque_baixado = jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 0,
      updated_at = now()
  where id = p_id;
end $$;

revoke all on function public.registrar_consumo_estoque(jsonb, text, text, text, uuid) from public, anon;
revoke all on function public.registrar_atendimento(text, text, text, date, text, integer, numeric, text, numeric, text, text, jsonb) from public, anon;
revoke all on function public.concluir_atendimento(uuid, date, jsonb) from public, anon;
grant execute on function public.registrar_consumo_estoque(jsonb, text, text, text, uuid) to authenticated;
grant execute on function public.registrar_atendimento(text, text, text, date, text, integer, numeric, text, numeric, text, text, jsonb) to authenticated;
grant execute on function public.concluir_atendimento(uuid, date, jsonb) to authenticated;

commit;
