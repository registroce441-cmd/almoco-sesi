-- =====================================================================
-- Almoço SESI — 6/6: painel do administrador (Etapa 2)
--   * marcações manuais com motivo opcional (tabela que SÓ o admin lê)
--   * importação de colaboradores por planilha (nome + NIF), validada NO BANCO
--   * duplicar a semana anterior do cardápio
--   * status do código da cozinha (sem expor o hash)
--   * foto do prato (Storage) e limites nas configurações
--   * reforço de permissões: funções internas deixam de ser chamáveis pelo público
-- Rode depois das migrations 1 a 5. Pode rodar de novo sem estragar nada.
-- =====================================================================

-- Texto sem espaços sobrando: junta espaços repetidos (inclusive o espaço "duro"
-- que o Excel gosta de colocar) e tira os das pontas.
create or replace function public.limpar_texto(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(t, ''), '[\s\u00a0]+', ' ', 'g'));
$$;

-- ---------------------------------------------------------------------
-- Marcações manuais: quem o admin marcou/desmarcou, em que dia e por quê.
-- É um registro (log) que só o admin lê e só cresce: não há update nem delete.
--   anterior / novo: true = vai, false = não vai, null = sem marcação.
-- ---------------------------------------------------------------------
create table if not exists public.marcacoes_manuais (
  id        uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas (id) on delete cascade,
  data      date not null,
  anterior  boolean,
  novo      boolean,
  motivo    text check (motivo is null or (length(btrim(motivo)) > 0 and length(motivo) <= 200)),
  admin_id  uuid default auth.uid() references auth.users (id) on delete set null,
  criado_em timestamptz not null default clock_timestamp(), -- hora real de cada registro (now() repetiria dentro da mesma chamada)
  constraint marcacoes_manuais_mudou check (anterior is distinct from novo)
);

alter table public.marcacoes_manuais alter column criado_em set default clock_timestamp();

create index if not exists marcacoes_manuais_criado_em_idx on public.marcacoes_manuais (criado_em desc);
create index if not exists marcacoes_manuais_pessoa_idx on public.marcacoes_manuais (pessoa_id);

alter table public.marcacoes_manuais enable row level security;

revoke all on public.marcacoes_manuais from anon, authenticated;
grant select, insert on public.marcacoes_manuais to authenticated;
grant all on public.marcacoes_manuais to service_role;

drop policy if exists "marcacoes_manuais: admin le" on public.marcacoes_manuais;
create policy "marcacoes_manuais: admin le" on public.marcacoes_manuais
  for select to authenticated using (public.is_admin());

drop policy if exists "marcacoes_manuais: admin registra" on public.marcacoes_manuais;
create policy "marcacoes_manuais: admin registra" on public.marcacoes_manuais
  for insert to authenticated with check (public.is_admin());

-- Marca/desmarca uma pessoa em vários dias, a qualquer momento (inclusive depois do prazo).
-- p_marcas: [{"data": "2026-10-21", "vai": true}, ...]   vai = true | false | null (null = tirar a marcação)
-- Tudo ou nada. Só registra no log o que realmente mudou. Devolve {"ok": true, "alteradas": n}.
-- Roda com os direitos de quem chama: as policies de admin continuam valendo como segunda barreira.
create or replace function public.admin_salvar_marcacoes(p_pessoa_id uuid, p_marcas jsonb, p_motivo text default null)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  item      jsonb;
  d         date;
  novo      boolean;
  anterior  boolean;
  alteradas int := 0;
  motivo    text := nullif(public.limpar_texto(p_motivo), '');
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode fazer isso.' using errcode = '42501';
  end if;
  if length(coalesce(p_motivo, '')) > 200 then
    raise exception 'O motivo pode ter no máximo 200 caracteres.';
  end if;
  if not exists (select 1 from public.pessoas where id = p_pessoa_id and ativo) then
    raise exception 'Pessoa não encontrada ou inativa.';
  end if;
  if jsonb_typeof(p_marcas) is distinct from 'array' then
    raise exception 'Dados inválidos.';
  end if;
  if jsonb_array_length(p_marcas) not between 1 and 31 then
    raise exception 'Dados inválidos.';
  end if;

  for item in select * from jsonb_array_elements(p_marcas) loop
    if jsonb_typeof(item) is distinct from 'object'
       or not (item ? 'data')
       or not (item ? 'vai')
       or jsonb_typeof(item -> 'vai') not in ('boolean', 'null') then
      raise exception 'Dados inválidos.';
    end if;

    d := (item ->> 'data')::date;
    if d is null then
      raise exception 'Dados inválidos.';
    end if;
    if extract(isodow from d) not between 1 and 5 then
      raise exception 'Esse dia não tem almoço (fim de semana).';
    end if;
    novo := case when jsonb_typeof(item -> 'vai') = 'boolean' then (item ->> 'vai')::boolean end;

    select m.vai_almocar into anterior
    from public.marcacoes m
    where m.pessoa_id = p_pessoa_id and m.data = d;
    if not found then
      anterior := null;
    end if;

    if novo is null then
      delete from public.marcacoes where pessoa_id = p_pessoa_id and data = d;
    else
      insert into public.marcacoes (pessoa_id, data, vai_almocar)
      values (p_pessoa_id, d, novo)
      on conflict (pessoa_id, data) do update set vai_almocar = excluded.vai_almocar;
    end if;

    if anterior is distinct from novo then
      insert into public.marcacoes_manuais (pessoa_id, data, anterior, novo, motivo)
      values (p_pessoa_id, d, anterior, novo, motivo);
      alteradas := alteradas + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'alteradas', alteradas);
end;
$$;

-- ---------------------------------------------------------------------
-- Importação de colaboradores (planilha com SÓ nome e NIF)
-- p_linhas: [{"linha": 2, "nome": "Ana Souza", "nif": "1040210"}, ...]   (máx. 2000)
-- Linha vazia é ignorada. As demais só entram se forem válidas; o resto volta em "rejeitadas"
-- com o motivo. Devolve {"ok": true, "inseridas": n, "vazias": n, "rejeitadas": [...]}.
-- ---------------------------------------------------------------------
create or replace function public.admin_importar_pessoas(p_linhas jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  item       jsonb;
  n          int := 0;
  linha      int;
  nome_      text;
  nif_       text;
  motivo     text;
  inseridas  int := 0;
  vazias     int := 0;
  vistos     text[] := '{}';
  rejeitadas jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode fazer isso.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'Dados inválidos.';
  end if;
  if jsonb_array_length(p_linhas) > 2000 then
    raise exception 'Importe no máximo 2000 pessoas por vez.';
  end if;

  for item in select * from jsonb_array_elements(p_linhas) loop
    n := n + 1;
    linha := coalesce(nullif(item ->> 'linha', '')::int, n);
    nome_ := public.limpar_texto(item ->> 'nome');
    nif_  := public.limpar_texto(item ->> 'nif');
    motivo := null;

    if nome_ = '' and nif_ = '' then
      vazias := vazias + 1;
      continue;
    elsif nif_ = '' then
      motivo := 'NIF ausente';
    elsif nome_ = '' then
      motivo := 'Nome ausente';
    elsif position(' ' in nif_) > 0 then
      motivo := 'NIF não pode ter espaços';
    elsif length(nif_) > 30 then
      motivo := 'NIF muito longo (máximo 30 caracteres)';
    elsif length(nome_) > 120 then
      motivo := 'Nome muito longo (máximo 120 caracteres)';
    elsif nif_ = any (vistos) then
      motivo := 'NIF repetido na planilha';
    end if;

    if motivo is null then
      vistos := vistos || nif_;
      insert into public.pessoas (nome, nif) values (nome_, nif_)
      on conflict (nif) do nothing;
      if found then
        inseridas := inseridas + 1;
      else
        motivo := 'NIF já cadastrado';
      end if;
    end if;

    if motivo is not null then
      rejeitadas := rejeitadas || jsonb_build_array(
        jsonb_build_object('linha', linha, 'nome', nome_, 'nif', nif_, 'motivo', motivo)
      );
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'inseridas', inseridas, 'vazias', vazias, 'rejeitadas', rejeitadas);
end;
$$;

-- ---------------------------------------------------------------------
-- Cardápio: copia a semana p_origem (uma segunda-feira) para a semana p_destino (outra segunda).
-- Por padrão só preenche os dias que ainda estão vazios; com p_substituir = true troca os já preenchidos.
-- A FOTO NÃO é copiada (o prato pode mudar de uma semana para outra). Dias do destino que não existem
-- na origem ficam como estão. Devolve {"ok": true, "copiados": n, "mantidos": n, "origem_vazia": bool}.
-- ---------------------------------------------------------------------
create or replace function public.admin_duplicar_cardapio(p_origem date, p_destino date, p_substituir boolean default false)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  na_origem int;
  copiados  int;
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode fazer isso.' using errcode = '42501';
  end if;
  if p_origem is null or p_destino is null
     or extract(isodow from p_origem) <> 1 or extract(isodow from p_destino) <> 1 then
    raise exception 'As semanas precisam começar na segunda-feira.';
  end if;
  if p_origem = p_destino then
    raise exception 'Escolha uma semana diferente da que será copiada.';
  end if;

  select count(*) into na_origem from public.cardapio c where c.data between p_origem and p_origem + 4;

  if coalesce(p_substituir, false) then
    with feitos as (
      insert into public.cardapio (data, prato, acompanhamento, sobremesa, tags)
      select c.data + (p_destino - p_origem), c.prato, c.acompanhamento, c.sobremesa, c.tags
      from public.cardapio c
      where c.data between p_origem and p_origem + 4
      on conflict (data) do update
        set prato = excluded.prato,
            acompanhamento = excluded.acompanhamento,
            sobremesa = excluded.sobremesa,
            tags = excluded.tags,
            foto_url = null
      returning 1
    )
    select count(*)::int into copiados from feitos;
  else
    with feitos as (
      insert into public.cardapio (data, prato, acompanhamento, sobremesa, tags)
      select c.data + (p_destino - p_origem), c.prato, c.acompanhamento, c.sobremesa, c.tags
      from public.cardapio c
      where c.data between p_origem and p_origem + 4
      on conflict (data) do nothing
      returning 1
    )
    select count(*)::int into copiados from feitos;
  end if;

  return jsonb_build_object(
    'ok', true,
    'copiados', copiados,
    'mantidos', na_origem - copiados,
    'origem_vazia', na_origem = 0
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Código da cozinha: o painel mostra SE existe código e quando foi trocado,
-- sem nunca receber o hash nem o sal.
-- ---------------------------------------------------------------------
create or replace function public.admin_status_codigo_cozinha()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode fazer isso.' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_build_object('configurado', true, 'atualizado_em', a.updated_at)
     from public.acesso_cozinha a where a.id = 1),
    jsonb_build_object('configurado', false, 'atualizado_em', null)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Configurações: limites para o painel não gravar lixo (a linha única já existe).
-- ---------------------------------------------------------------------
alter table public.configuracoes drop constraint if exists configuracoes_nome_unidade_ok;
alter table public.configuracoes
  add constraint configuracoes_nome_unidade_ok check (length(btrim(nome_unidade)) between 1 and 80);

alter table public.configuracoes drop constraint if exists configuracoes_aviso_home_ok;
alter table public.configuracoes
  add constraint configuracoes_aviso_home_ok
  check (aviso_home is null or length(btrim(aviso_home)) between 1 and 280);

alter table public.configuracoes drop constraint if exists configuracoes_dias_bloqueados_ok;
alter table public.configuracoes
  add constraint configuracoes_dias_bloqueados_ok check (cardinality(dias_bloqueados) <= 400);

-- ---------------------------------------------------------------------
-- Foto do prato: bucket público para LER (as fotos aparecem no Cardápio) e
-- escrita só do admin. Só roda se o Storage existir (no Supabase sempre existe).
-- Imagem de até 2 MB (o painel já reduz a foto antes de enviar).
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('cardapio-fotos', 'cardapio-fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update
      set public = true,
          file_size_limit = 2097152,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

    drop policy if exists "cardapio-fotos: admin le" on storage.objects;
    create policy "cardapio-fotos: admin le" on storage.objects
      for select to authenticated
      using (bucket_id = 'cardapio-fotos' and public.is_admin());

    drop policy if exists "cardapio-fotos: admin envia" on storage.objects;
    create policy "cardapio-fotos: admin envia" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'cardapio-fotos' and public.is_admin());

    drop policy if exists "cardapio-fotos: admin troca" on storage.objects;
    create policy "cardapio-fotos: admin troca" on storage.objects
      for update to authenticated
      using (bucket_id = 'cardapio-fotos' and public.is_admin())
      with check (bucket_id = 'cardapio-fotos' and public.is_admin());

    drop policy if exists "cardapio-fotos: admin apaga" on storage.objects;
    create policy "cardapio-fotos: admin apaga" on storage.objects
      for delete to authenticated
      using (bucket_id = 'cardapio-fotos' and public.is_admin());
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Quem pode chamar o quê
--   Novas funções do painel: SÓ usuário logado (e elas ainda conferem is_admin()).
--   Reforço: no Supabase, funções novas nascem executáveis por "anon". As internas abaixo
--   nunca devem ser chamadas pelo público: a Lista/Relatório as usam por dentro
--   (funções "security definer" não precisam que quem chama tenha permissão).
-- ---------------------------------------------------------------------
revoke all on function
  public.limpar_texto(text),
  public.admin_salvar_marcacoes(uuid, jsonb, text),
  public.admin_importar_pessoas(jsonb),
  public.admin_duplicar_cardapio(date, date, boolean),
  public.admin_status_codigo_cozinha()
from public, anon;

grant execute on function
  public.limpar_texto(text),
  public.admin_salvar_marcacoes(uuid, jsonb, text),
  public.admin_importar_pessoas(jsonb),
  public.admin_duplicar_cardapio(date, date, boolean),
  public.admin_status_codigo_cozinha()
to authenticated;

revoke all on function
  public.definir_codigo_cozinha(text),
  public.remover_codigo_cozinha(),
  public.grupo_padrao()
from public, anon;

revoke all on function public.verificar_acesso(text) from public, anon, authenticated;
