-- Financeiro MCL — permissões por usuário e por aba.
-- Aplicada ao projeto Supabase Financeiro MCL (jeuecmmnxvlzpruyoraw) como migração "permissoes_por_aba".
-- Cada usuário pode ter uma matriz {aba:{acao:boolean}} em financeiro_permissoes. Quem não tem linha usa o
-- padrão do perfil: Administrador = tudo; demais = Documentos (ver/criar/editar), Orçamentos (ver) e
-- Viagens (ver/criar/editar). A ação registers.permissoes ("Gerenciar permissões") define quem edita a tabela.
-- Enquanto nenhum usuário ativo tiver essa ação salva, todos os administradores ativos podem gerenciar.
-- Para desfazer: supabase/permissoes-reverter.sql.
begin;

create table if not exists public.financeiro_permissoes (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  permissoes jsonb not null default '{}'::jsonb check (jsonb_typeof(permissoes)='object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.financeiro_permissoes enable row level security;
grant select,insert,update,delete on public.financeiro_permissoes to authenticated;

-- Catálogo: mesmas chaves de mcl-permissoes.js (ABAS). Os ids são os data-view do menu.
create or replace function public.mcl_catalogo_permissoes() returns jsonb language sql immutable as $$
  select '{
    "dashboard":["ver"],
    "accounts":["ver","criar","editar","excluir","ia"],
    "receivables":["ver","criar","editar","excluir","importar","exportar"],
    "documents":["ver","criar","editar","excluir","ia"],
    "cashflow":["ver","criar","editar","excluir","importar","ia"],
    "budgets":["ver","criar","editar","excluir","exportar"],
    "trips":["ver","criar","editar","excluir"],
    "planning":["ver","criar","editar","excluir"],
    "rh":["ver","criar","editar","excluir"],
    "registers":["ver","criar","editar","excluir","permissoes"],
    "users":["ver","criar","editar"]
  }'::jsonb
$$;

-- Padrão de quem não tem linha salva (espelhado em mcl-permissoes.js: padrao()).
create or replace function public.mcl_padrao_permissao(p_admin boolean,p_aba text,p_acao text) returns boolean language sql immutable as $$
  select case
    when p_aba='registers' and p_acao='permissoes' then false
    when p_admin then true
    else (p_aba,p_acao) in (('documents','ver'),('documents','criar'),('documents','editar'),('budgets','ver'),('trips','ver'),('trips','criar'),('trips','editar'))
  end
$$;

create or replace function public.mcl_existe_gestor_permissoes() returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.financeiro_permissoes fp join public.profiles pr on pr.id=fp.usuario_id
    where pr.ativo=true and coalesce((fp.permissoes->'registers'->>'permissoes')::boolean,false)
  )
$$;

create or replace function public.mcl_pode_de(p_usuario uuid,p_aba text,p_acao text) returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_tipo text; v_ativo boolean; v_val jsonb; v_admin boolean;
begin
  if p_usuario is null or p_aba is null or p_acao is null then return false; end if;
  if not coalesce((public.mcl_catalogo_permissoes()->p_aba) ? p_acao,false) then return false; end if;
  select tipo,ativo into v_tipo,v_ativo from public.profiles where id=p_usuario;
  if not found or v_ativo is distinct from true then return false; end if;
  v_admin:=(v_tipo='Administrador');
  select permissoes->p_aba->p_acao into v_val from public.financeiro_permissoes where usuario_id=p_usuario;
  if v_val is not null and jsonb_typeof(v_val)='boolean' then return v_val::text::boolean; end if;
  if p_aba='registers' and p_acao='permissoes' then return v_admin and not public.mcl_existe_gestor_permissoes(); end if;
  return public.mcl_padrao_permissao(v_admin,p_aba,p_acao);
end $$;

create or replace function public.mcl_pode(p_aba text,p_acao text) returns boolean language sql stable security definer set search_path=public as $$
  select public.mcl_pode_de(auth.uid(),p_aba,p_acao)
$$;

create or replace function public.mcl_gere_permissoes() returns boolean language sql stable security definer set search_path=public as $$
  select public.mcl_pode_de(auth.uid(),'registers','permissoes')
$$;

-- Matriz efetiva completa. Sem argumento: do próprio usuário. Com argumento: só para quem gerencia permissões.
create or replace function public.mcl_matriz_permissoes(p_usuario uuid default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_user uuid:=coalesce(p_usuario,auth.uid()); v_out jsonb:='{}'::jsonb; r record;
begin
  if v_user is null then return '{}'::jsonb; end if;
  if v_user<>auth.uid() and not public.mcl_gere_permissoes() then
    raise exception 'Sem permissão para consultar as permissões de outro usuário' using errcode='42501';
  end if;
  for r in select key as aba, value as acoes from jsonb_each(public.mcl_catalogo_permissoes()) loop
    v_out:=v_out||jsonb_build_object(r.aba,(select coalesce(jsonb_object_agg(a,public.mcl_pode_de(v_user,r.aba,a)),'{}'::jsonb) from jsonb_array_elements_text(r.acoes) a));
  end loop;
  return v_out;
end $$;

revoke all on function public.mcl_catalogo_permissoes() from public,anon;
revoke all on function public.mcl_padrao_permissao(boolean,text,text) from public,anon;
revoke all on function public.mcl_existe_gestor_permissoes() from public,anon;
revoke all on function public.mcl_pode_de(uuid,text,text) from public,anon;
revoke all on function public.mcl_pode(text,text) from public,anon;
revoke all on function public.mcl_gere_permissoes() from public,anon;
revoke all on function public.mcl_matriz_permissoes(uuid) from public,anon;
grant execute on function public.mcl_catalogo_permissoes() to authenticated,service_role;
grant execute on function public.mcl_padrao_permissao(boolean,text,text) to authenticated,service_role;
grant execute on function public.mcl_existe_gestor_permissoes() to authenticated,service_role;
grant execute on function public.mcl_pode_de(uuid,text,text) to authenticated,service_role;
grant execute on function public.mcl_pode(text,text) to authenticated,service_role;
grant execute on function public.mcl_gere_permissoes() to authenticated,service_role;
grant execute on function public.mcl_matriz_permissoes(uuid) to authenticated,service_role;

-- Guarda: quem gerencia não pode tirar de si mesmo a permissão de gerenciar; limpa chaves fora do catálogo.
create or replace function public.mcl_permissoes_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare v_limpa jsonb:='{}'::jsonb; r record; v_acoes jsonb;
begin
  if tg_op='DELETE' then
    if old.usuario_id=auth.uid() and public.mcl_gere_permissoes() then
      raise exception 'Você não pode remover a sua própria permissão de gerenciar permissões.';
    end if;
    return old;
  end if;
  for r in select key as aba, value as acoes from jsonb_each(coalesce(new.permissoes,'{}'::jsonb)) loop
    v_acoes:=public.mcl_catalogo_permissoes()->r.aba;
    if v_acoes is null or jsonb_typeof(r.acoes)<>'object' then continue; end if;
    v_limpa:=v_limpa||jsonb_build_object(r.aba,(
      select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from jsonb_each(r.acoes) e
      where v_acoes ? e.key and jsonb_typeof(e.value)='boolean'));
  end loop;
  new.permissoes:=v_limpa;
  if new.usuario_id=auth.uid() and public.mcl_gere_permissoes() and not coalesce((new.permissoes->'registers'->>'permissoes')::boolean,false) then
    raise exception 'Você não pode remover a sua própria permissão de gerenciar permissões.';
  end if;
  new.updated_at:=now();
  new.updated_by:=coalesce(auth.uid(),new.updated_by);
  return new;
end $$;
drop trigger if exists financeiro_permissoes_guard on public.financeiro_permissoes;
create trigger financeiro_permissoes_guard before insert or update or delete on public.financeiro_permissoes for each row execute function public.mcl_permissoes_guard();

drop policy if exists permissoes_select on public.financeiro_permissoes;
drop policy if exists permissoes_insert on public.financeiro_permissoes;
drop policy if exists permissoes_update on public.financeiro_permissoes;
drop policy if exists permissoes_delete on public.financeiro_permissoes;
create policy permissoes_select on public.financeiro_permissoes for select to authenticated using (usuario_id=(select auth.uid()) or (select public.mcl_gere_permissoes()));
create policy permissoes_insert on public.financeiro_permissoes for insert to authenticated with check ((select public.mcl_gere_permissoes()));
create policy permissoes_update on public.financeiro_permissoes for update to authenticated using ((select public.mcl_gere_permissoes())) with check ((select public.mcl_gere_permissoes()));
create policy permissoes_delete on public.financeiro_permissoes for delete to authenticated using ((select public.mcl_gere_permissoes()));

-- Políticas das tabelas de dados: ver/criar/editar/excluir da aba correspondente substituem mcl_is_admin().
do $$
declare t record; p record;
  m jsonb:='{"financeiro_contas":"accounts","financeiro_pagamentos":"accounts","financeiro_fluxo":"cashflow","financeiro_orcamentos":"budgets","financeiro_planejamento":"planning","financeiro_planejamento_itens":"planning","financeiro_receitas":"planning","financeiro_naturezas":"registers","financeiro_setores":"registers","financeiro_rh_colaboradores":"rh","financeiro_rh_pagamentos":"rh","financeiro_rh_variaveis_mensais":"rh","fin_receb_municipios":"receivables","fin_receb_remessas":"receivables","fin_receb_clientes":"receivables","fin_receb_parcelas":"receivables","fin_receb_importacoes":"receivables","financeiro_documentos":"documents","financeiro_viagens":"trips"}'::jsonb;
  v_own text;
begin
  for t in select key as tabela, value #>> '{}' as aba from jsonb_each(m) loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t.tabela loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t.tabela);
    end loop;
    -- Documentos e viagens: quem criou continua vendo e editando os próprios registros.
    v_own:=case when t.tabela in ('financeiro_documentos','financeiro_viagens') then 'created_by=(select auth.uid()) or ' else '' end;
    if t.tabela in ('financeiro_naturezas','financeiro_setores') then
      execute format('create policy mcl_ver on public.%I for select to authenticated using (true)',t.tabela);
    else
      execute format('create policy mcl_ver on public.%I for select to authenticated using (%s(select public.mcl_pode(%L,''ver'')))',t.tabela,v_own,t.aba);
    end if;
    execute format('create policy mcl_criar on public.%I for insert to authenticated with check (%s(select public.mcl_pode(%L,''criar'')))',t.tabela,v_own,t.aba);
    execute format('create policy mcl_editar on public.%I for update to authenticated using (%s(select public.mcl_pode(%L,''editar''))) with check (%s(select public.mcl_pode(%L,''editar'')))',t.tabela,v_own,t.aba,v_own,t.aba);
    execute format('create policy mcl_excluir on public.%I for delete to authenticated using (%s(select public.mcl_pode(%L,''excluir'')))',t.tabela,v_own,t.aba);
  end loop;
end $$;

drop policy if exists mcl_update on public.profiles;
create policy mcl_update on public.profiles for update to authenticated using (id=(select auth.uid()) or (select public.mcl_pode('users','editar'))) with check (id=(select auth.uid()) or (select public.mcl_pode('users','editar')));

notify pgrst,'reload schema';
commit;
