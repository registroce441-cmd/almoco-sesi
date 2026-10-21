-- =====================================================================
-- Almoço SESI — 3/3: segurança (RLS) e tempo real
--
-- Público (sem login):
--   LÊ    pessoas ativas, grupos, cardápio, configurações e marcações
--   GRAVA marcações, somente dentro do prazo e em dias liberados
-- Admin autenticado (tabela public.admins): tudo o resto.
-- =====================================================================

alter table public.grupos        enable row level security;
alter table public.pessoas       enable row level security;
alter table public.cardapio      enable row level security;
alter table public.marcacoes     enable row level security;
alter table public.configuracoes enable row level security;
alter table public.admins        enable row level security;

-- Começa sem nenhuma permissão e libera só o necessário.
revoke all on public.grupos, public.pessoas, public.cardapio,
              public.marcacoes, public.configuracoes, public.admins
  from anon, authenticated;

-- Leitura pública
grant select on public.grupos, public.pessoas, public.cardapio,
                public.marcacoes, public.configuracoes
  to anon, authenticated;

-- Gravação pública de marcações (só estas colunas)
grant insert (pessoa_id, data, vai_almocar) on public.marcacoes to anon, authenticated;
grant update (pessoa_id, data, vai_almocar) on public.marcacoes to anon, authenticated;

-- Admin (as policies abaixo garantem que só admin de verdade usa isto)
grant insert, update, delete on public.grupos, public.pessoas, public.cardapio, public.marcacoes
  to authenticated;
grant update on public.configuracoes to authenticated;
grant select on public.admins to authenticated;
grant all on public.marcacoes, public.pessoas, public.grupos, public.cardapio,
             public.configuracoes, public.admins
  to service_role;

-- ---------------------------------------------------------------------
-- Policies: leitura pública
-- ---------------------------------------------------------------------
create policy "grupos: leitura publica" on public.grupos
  for select to anon, authenticated using (true);

create policy "pessoas: leitura publica de ativas" on public.pessoas
  for select to anon, authenticated using (ativo);

create policy "cardapio: leitura publica" on public.cardapio
  for select to anon, authenticated using (true);

create policy "configuracoes: leitura publica" on public.configuracoes
  for select to anon, authenticated using (true);

create policy "marcacoes: leitura publica" on public.marcacoes
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- Policies: marcações pelo público (prazo e dias validados no banco)
-- ---------------------------------------------------------------------
create policy "marcacoes: publico insere dentro do prazo" on public.marcacoes
  for insert to anon, authenticated
  with check (
    public.marcacao_aberta(data)
    and exists (select 1 from public.pessoas p where p.id = pessoa_id and p.ativo)
  );

create policy "marcacoes: publico atualiza dentro do prazo" on public.marcacoes
  for update to anon, authenticated
  using (public.marcacao_aberta(data))
  with check (public.marcacao_aberta(data));

-- ---------------------------------------------------------------------
-- Policies: admin
-- ---------------------------------------------------------------------
create policy "grupos: admin" on public.grupos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "pessoas: admin" on public.pessoas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "cardapio: admin" on public.cardapio
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "marcacoes: admin" on public.marcacoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "configuracoes: admin atualiza" on public.configuracoes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admins: cada um ve o proprio registro" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Tempo real: a Lista de Almoço escuta mudanças em "marcacoes".
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.marcacoes;
  end if;
exception when duplicate_object then
  null; -- já estava na publicação
end;
$$;
