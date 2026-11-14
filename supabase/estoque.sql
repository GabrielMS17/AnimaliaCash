-- =====================================================================
-- Animalia Cash — estoque (lotes, validade, entradas por embalagem e consumo pelos procedimentos)
-- Rodar no Supabase: SQL Editor > New query > colar este arquivo > Run.
-- Pode ser executado mais de uma vez. Não apaga nem altera dados existentes.
-- Depende de supabase/schema.sql (tabelas insumos e clinic_settings).
-- =====================================================================

begin;

-- 1. Correção: o app já envia esta configuração, mas a coluna não existia e o envio falhava
alter table public.clinic_settings
  add column if not exists average_product_waste_percent numeric(5, 2) not null default 0;

-- 2. Dados de estoque no cadastro de insumos
alter table public.insumos add column if not exists brand text;                                  -- marca / fabricante
alter table public.insumos add column if not exists min_stock numeric(14, 3) check (min_stock >= 0); -- alerta de estoque baixo
alter table public.insumos add column if not exists track_stock boolean; -- null = automático (kWh, minuto, hora e diária não têm estoque)

-- 3. Lotes: cada compra vira um lote, com número e validade opcionais
create table if not exists public.estoque_lotes (
  id uuid primary key default gen_random_uuid(),
  insumo_id text not null references public.insumos (id) on delete cascade,
  numero_lote text,
  validade date,
  embalagem text,                                               -- caixa, frasco... (como foi comprado)
  quantidade_embalagens numeric(14, 3) check (quantidade_embalagens > 0),
  unidades_por_embalagem numeric(14, 3) check (unidades_por_embalagem > 0), -- ex: caixa com 10 ampolas
  quantidade_inicial numeric(14, 3) not null check (quantidade_inicial > 0), -- na unidade de uso do insumo
  quantidade_atual numeric(14, 3) not null check (quantidade_atual >= 0),
  custo_total numeric(12, 2) not null check (custo_total >= 0),
  custo_unitario numeric(14, 6) not null check (custo_unitario >= 0),
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists estoque_lotes_insumo_idx on public.estoque_lotes (insumo_id);

-- 4. Histórico de tudo que entra e sai
create table if not exists public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  insumo_id text not null references public.insumos (id) on delete cascade,
  lote_id uuid references public.estoque_lotes (id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'consumo', 'perda', 'ajuste')),
  quantidade numeric(14, 3) not null,     -- positiva = entrada; negativa = saída
  custo_unitario numeric(14, 6),
  procedure_id text,                      -- sem chave estrangeira: o histórico continua se o procedimento for apagado
  procedure_name text,
  atendimento_id uuid,                    -- agrupa os itens consumidos numa mesma realização
  observacao text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists estoque_movimentos_insumo_idx on public.estoque_movimentos (insumo_id, created_at desc);

-- 5. Mesma regra das outras tabelas da clínica: só usuários logados acessam
alter table public.estoque_lotes enable row level security;
alter table public.estoque_movimentos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['estoque_lotes', 'estoque_movimentos'] loop
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

grant select, insert, update, delete on public.estoque_lotes, public.estoque_movimentos to authenticated;

-- 6. Entrada de compra: cria o lote e registra a movimentação juntos
create or replace function public.registrar_entrada_estoque(
  p_insumo_id text,
  p_quantidade_embalagens numeric,
  p_unidades_por_embalagem numeric,
  p_custo_total numeric,
  p_embalagem text default null,
  p_numero_lote text default null,
  p_validade date default null,
  p_observacao text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_quantidade numeric := p_quantidade_embalagens * p_unidades_por_embalagem;
  v_custo_unitario numeric;
  v_lote_id uuid;
begin
  if v_quantidade is null or v_quantidade <= 0 then
    raise exception 'Informe a quantidade comprada.';
  end if;
  if p_custo_total is null or p_custo_total < 0 then
    raise exception 'Informe o valor pago.';
  end if;
  v_custo_unitario := p_custo_total / v_quantidade;

  insert into estoque_lotes (
    insumo_id, numero_lote, validade, embalagem, quantidade_embalagens, unidades_por_embalagem,
    quantidade_inicial, quantidade_atual, custo_total, custo_unitario, observacao
  ) values (
    p_insumo_id, nullif(trim(p_numero_lote), ''), p_validade, p_embalagem, p_quantidade_embalagens, p_unidades_por_embalagem,
    v_quantidade, v_quantidade, p_custo_total, v_custo_unitario, nullif(trim(p_observacao), '')
  ) returning id into v_lote_id;

  insert into estoque_movimentos (insumo_id, lote_id, tipo, quantidade, custo_unitario, observacao)
  values (p_insumo_id, v_lote_id, 'entrada', v_quantidade, v_custo_unitario, nullif(trim(p_observacao), ''));

  return v_lote_id;
end $$;

-- 7. Consumo de um procedimento realizado. p_itens = [{"insumo_id": "...", "quantidade": 2}, ...]
-- Gasta primeiro os lotes que vencem antes (lotes vencidos não são usados).
-- Se faltar algum item, nada é baixado e o erro lista o que falta.
create or replace function public.registrar_consumo_estoque(
  p_itens jsonb,
  p_procedure_id text default null,
  p_procedure_name text default null,
  p_observacao text default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_atendimento uuid := gen_random_uuid();
  v_item record;
  v_lote record;
  v_disponivel numeric;
  v_restante numeric;
  v_usar numeric;
  v_faltando jsonb := '[]'::jsonb;
begin
  -- Trava os lotes envolvidos para dois consumos ao mesmo tempo não usarem o mesmo saldo
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

-- 8. Baixa manual de um lote: perda (vencido, quebrado) ou ajuste de inventário
create or replace function public.registrar_baixa_estoque(
  p_lote_id uuid,
  p_quantidade numeric,
  p_tipo text default 'perda',
  p_observacao text default null
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_lote record;
begin
  if p_tipo not in ('perda', 'ajuste') then
    raise exception 'Tipo de baixa inválido.';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe a quantidade da baixa.';
  end if;

  select * into v_lote from estoque_lotes where id = p_lote_id for update;
  if not found then
    raise exception 'Lote não encontrado.';
  end if;
  if p_quantidade > v_lote.quantidade_atual then
    raise exception 'O lote tem só % disponível.', v_lote.quantidade_atual;
  end if;

  update estoque_lotes set quantidade_atual = quantidade_atual - p_quantidade where id = p_lote_id;
  insert into estoque_movimentos (insumo_id, lote_id, tipo, quantidade, custo_unitario, observacao)
  values (v_lote.insumo_id, p_lote_id, p_tipo, -p_quantidade, v_lote.custo_unitario, nullif(trim(p_observacao), ''));
end $$;

revoke all on function public.registrar_entrada_estoque(text, numeric, numeric, numeric, text, text, date, text) from public, anon;
revoke all on function public.registrar_consumo_estoque(jsonb, text, text, text) from public, anon;
revoke all on function public.registrar_baixa_estoque(uuid, numeric, text, text) from public, anon;
grant execute on function public.registrar_entrada_estoque(text, numeric, numeric, numeric, text, text, date, text) to authenticated;
grant execute on function public.registrar_consumo_estoque(jsonb, text, text, text) to authenticated;
grant execute on function public.registrar_baixa_estoque(uuid, numeric, text, text) to authenticated;

commit;
