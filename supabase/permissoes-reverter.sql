-- Desfaz supabase/permissoes.sql: volta as políticas baseadas em mcl_is_admin() e remove a tabela de permissões.
begin;
do $$
declare t text; p record;
begin
  foreach t in array array['financeiro_contas','financeiro_pagamentos','financeiro_fluxo','financeiro_orcamentos','financeiro_planejamento','financeiro_planejamento_itens','financeiro_receitas','financeiro_naturezas','financeiro_setores','financeiro_rh_colaboradores','financeiro_rh_pagamentos','financeiro_rh_variaveis_mensais','fin_receb_municipios','fin_receb_remessas','fin_receb_clientes','fin_receb_parcelas','fin_receb_importacoes','financeiro_documentos','financeiro_viagens'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
  end loop;
end $$;
-- Tabelas só de administrador
do $$
declare t text;
begin
  foreach t in array array['financeiro_contas','financeiro_pagamentos','financeiro_fluxo','financeiro_planejamento','financeiro_receitas','financeiro_rh_colaboradores','financeiro_rh_pagamentos','financeiro_rh_variaveis_mensais'] loop
    execute format('create policy mcl_select on public.%I for select to authenticated using (mcl_is_admin())',t);
    execute format('create policy mcl_insert on public.%I for insert to authenticated with check (mcl_is_admin())',t);
    execute format('create policy mcl_update on public.%I for update to authenticated using (mcl_is_admin()) with check (mcl_is_admin())',t);
    execute format('create policy mcl_delete on public.%I for delete to authenticated using (mcl_is_admin())',t);
  end loop;
  foreach t in array array['financeiro_naturezas','financeiro_setores','financeiro_orcamentos'] loop
    execute format('create policy mcl_select on public.%I for select to authenticated using (true)',t);
    execute format('create policy mcl_insert on public.%I for insert to authenticated with check (mcl_is_admin())',t);
    execute format('create policy mcl_update on public.%I for update to authenticated using (mcl_is_admin()) with check (mcl_is_admin())',t);
    execute format('create policy mcl_delete on public.%I for delete to authenticated using (mcl_is_admin())',t);
  end loop;
  foreach t in array array['financeiro_documentos','financeiro_viagens'] loop
    execute format('create policy mcl_select on public.%I for select to authenticated using (mcl_is_admin() or created_by=auth.uid())',t);
    execute format('create policy mcl_insert on public.%I for insert to authenticated with check (created_by=auth.uid() or mcl_is_admin())',t);
    execute format('create policy mcl_update on public.%I for update to authenticated using (mcl_is_admin() or created_by=auth.uid()) with check (mcl_is_admin() or created_by=auth.uid())',t);
    execute format('create policy mcl_delete on public.%I for delete to authenticated using (mcl_is_admin() or created_by=auth.uid())',t);
  end loop;
  foreach t in array array['fin_receb_municipios','fin_receb_remessas','fin_receb_clientes','fin_receb_parcelas','fin_receb_importacoes'] loop
    execute format('create policy %I on public.%I for all to authenticated using ((select mcl_is_admin()) or exists(select 1 from profiles p where p.id=(select auth.uid()) and (lower(coalesce(p.tipo,''''))=''financeiro'' or lower(coalesce(p.setor,''''))=''financeiro''))) with check ((select mcl_is_admin()) or exists(select 1 from profiles p where p.id=(select auth.uid()) and (lower(coalesce(p.tipo,''''))=''financeiro'' or lower(coalesce(p.setor,''''))=''financeiro'')))',replace(t,'fin_receb_','mcl_receb_')||'_access',t);
  end loop;
end $$;
create policy planejamento_itens_select_auth on public.financeiro_planejamento_itens for select to authenticated using (true);
create policy planejamento_itens_insert_auth on public.financeiro_planejamento_itens for insert to authenticated with check (true);
create policy planejamento_itens_update_auth on public.financeiro_planejamento_itens for update to authenticated using (true) with check (true);
create policy planejamento_itens_delete_auth on public.financeiro_planejamento_itens for delete to authenticated using (true);
drop policy if exists mcl_update on public.profiles;
create policy mcl_update on public.profiles for update to authenticated using (id=auth.uid() or mcl_is_admin()) with check (id=auth.uid() or mcl_is_admin());
drop table if exists public.financeiro_permissoes cascade;
drop function if exists public.mcl_permissoes_guard();
drop function if exists public.mcl_matriz_permissoes(uuid);
drop function if exists public.mcl_gere_permissoes();
drop function if exists public.mcl_pode(text,text);
drop function if exists public.mcl_pode_de(uuid,text,text);
drop function if exists public.mcl_existe_gestor_permissoes();
drop function if exists public.mcl_padrao_permissao(boolean,text,text);
drop function if exists public.mcl_catalogo_permissoes();
notify pgrst,'reload schema';
commit;
