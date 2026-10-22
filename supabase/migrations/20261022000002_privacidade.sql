-- =====================================================================
-- Almoço SESI — 5/5: privacidade
--   * o público NÃO lê mais as tabelas pessoas/marcacoes/grupos
--   * busca de pessoas, marcações e totais passam por funções que devolvem só o necessário
--   * nomes por dia: somente admin logado OU código de acesso da cozinha
-- =====================================================================

-- Texto sem acento e em minúsculas (busca que ignora acentos).
create or replace function public.normalizar(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(coalesce(t, ''), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ', 'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'));
$$;

-- ---------------------------------------------------------------------
-- Código de acesso da cozinha (guardado só como hash + sal) e controle de tentativas
-- ---------------------------------------------------------------------
create table public.acesso_cozinha (
  id          smallint primary key default 1 check (id = 1),
  salt        text not null,
  codigo_hash text not null,
  updated_at  timestamptz not null default now()
);

create table public.tentativas_cozinha (
  id        bigint generated always as identity primary key,
  criado_em timestamptz not null default now()
);

alter table public.acesso_cozinha     enable row level security;
alter table public.tentativas_cozinha enable row level security;

revoke all on public.acesso_cozinha, public.tentativas_cozinha from anon, authenticated;
grant select, insert, update, delete on public.acesso_cozinha to authenticated;
grant select, delete on public.tentativas_cozinha to authenticated;
grant all on public.acesso_cozinha, public.tentativas_cozinha to service_role;

create policy "acesso_cozinha: admin" on public.acesso_cozinha
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "tentativas_cozinha: admin" on public.tentativas_cozinha
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Define (ou troca) o código. Admin logado ou SQL Editor. Mínimo de 6 caracteres.
create or replace function public.definir_codigo_cozinha(p_codigo text)
returns void
language plpgsql
as $$
declare
  novo_salt text := gen_random_uuid()::text;
  codigo    text := btrim(coalesce(p_codigo, ''));
begin
  if length(codigo) < 6 then
    raise exception 'O código da cozinha precisa ter pelo menos 6 caracteres.';
  end if;
  insert into public.acesso_cozinha (id, salt, codigo_hash)
  values (1, novo_salt, encode(sha256(convert_to(novo_salt || codigo, 'UTF8')), 'hex'))
  on conflict (id) do update
    set salt = excluded.salt, codigo_hash = excluded.codigo_hash, updated_at = now();
  delete from public.tentativas_cozinha;
end;
$$;

-- Desativa o acesso por código (só o admin logado passa a ver os nomes).
create or replace function public.remover_codigo_cozinha()
returns void
language sql
as $$
  delete from public.acesso_cozinha where id = 1;
$$;

-- Interna: quem pode ver nomes? 'ok' | 'invalido' | 'bloqueado' | 'nao_configurado' | 'codigo_necessario'.
-- Nunca dá erro (para a tentativa falha ficar registrada). 10 falhas em 5 min bloqueiam o código
-- por alguns minutos; o admin logado nunca é bloqueado.
create or replace function public.verificar_acesso(p_codigo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      public.acesso_cozinha;
  falhas int;
begin
  if public.is_admin() then
    return 'ok';
  end if;

  select * into a from public.acesso_cozinha where id = 1;
  if not found then
    return 'nao_configurado';
  end if;

  if p_codigo is null or btrim(p_codigo) = '' then
    return 'codigo_necessario';
  end if;

  select count(*) into falhas from public.tentativas_cozinha
  where criado_em > now() - interval '5 minutes';
  if falhas >= 10 then
    return 'bloqueado';
  end if;

  if encode(sha256(convert_to(a.salt || btrim(p_codigo), 'UTF8')), 'hex') = a.codigo_hash then
    return 'ok';
  end if;

  insert into public.tentativas_cozinha default values;
  delete from public.tentativas_cozinha where criado_em < now() - interval '1 day';
  return 'invalido';
end;
$$;

-- ---------------------------------------------------------------------
-- Funções PÚBLICAS (anon): só devolvem o mínimo necessário
-- ---------------------------------------------------------------------

-- Autocomplete da Home. Nome (2+ letras, sem acento) ou NIF (3+ dígitos, do começo).
-- O NIF nunca sai inteiro: só "***482". "homonimo" avisa que existe outra pessoa com o mesmo nome.
create or replace function public.buscar_pessoas(p_termo text)
returns table (id uuid, nome text, nif_mascarado text, homonimo boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text := public.normalizar(btrim(coalesce(p_termo, '')));
begin
  if length(t) < 2 then
    return;
  end if;
  return query
  select p.id,
         p.nome,
         '***' || right(p.nif, 3),
         exists (
           select 1 from public.pessoas o
           where o.ativo and o.id <> p.id and public.normalizar(o.nome) = public.normalizar(p.nome)
         )
  from public.pessoas p
  where p.ativo
    and (
      position(t in public.normalizar(p.nome)) > 0
      or (t ~ '^[0-9]{3,}$' and left(p.nif, length(t)) = t)
    )
  order by public.normalizar(p.nome), p.nif
  limit 8;
end;
$$;

-- Marcações de UMA pessoa na semana que começa em p_inicio (segunda).
create or replace function public.marcacoes_da_pessoa(p_pessoa_id uuid, p_inicio date)
returns table (data date, vai_almocar boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select m.data, m.vai_almocar
  from public.marcacoes m
  join public.pessoas p on p.id = m.pessoa_id and p.ativo
  where m.pessoa_id = p_pessoa_id
    and m.data between p_inicio and p_inicio + 4;
$$;

-- Grava as marcações de uma pessoa. Valida prazo/dias bloqueados no banco (tudo ou nada).
-- p_marcas: [{"data": "2026-10-21", "vai": true}, ...]
create or replace function public.salvar_marcacoes(p_pessoa_id uuid, p_marcas jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item   jsonb;
  d      date;
  motivo text;
begin
  if not exists (select 1 from public.pessoas where id = p_pessoa_id and ativo) then
    raise exception 'Pessoa não encontrada ou inativa.';
  end if;
  if jsonb_typeof(p_marcas) is distinct from 'array' or jsonb_array_length(p_marcas) > 31 then
    raise exception 'Dados inválidos.';
  end if;

  for item in select * from jsonb_array_elements(p_marcas) loop
    d := (item ->> 'data')::date;
    motivo := public.motivo_bloqueio_marcacao(d);
    if motivo is not null then
      raise exception '%', motivo using hint = 'MARCACAO_FECHADA';
    end if;
    insert into public.marcacoes (pessoa_id, data, vai_almocar)
    values (p_pessoa_id, d, (item ->> 'vai')::boolean)
    on conflict (pessoa_id, data) do update set vai_almocar = excluded.vai_almocar;
  end loop;
end;
$$;

-- TOTAL de refeições por dia (a única visão pública). Semana que começa em p_inicio.
create or replace function public.totais_por_dia(p_inicio date)
returns table (data date, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select d::date,
         (select count(*)::int from public.marcacoes m where m.data = d::date and m.vai_almocar)
  from generate_series(p_inicio, p_inicio + 4, interval '1 day') d
  order by 1;
$$;

-- ---------------------------------------------------------------------
-- Funções de COZINHA/ADMIN: exigem admin logado ou o código de acesso.
-- Devolvem jsonb: {"ok": true, ...} ou {"ok": false, "motivo": "..."}.
-- ---------------------------------------------------------------------

-- Quem vai (ou não) em cada dia da semana que começa em p_inicio.
-- (Volátil de propósito: pode registrar tentativas de código inválidas.)
create or replace function public.lista_cozinha(p_inicio date, p_codigo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := public.verificar_acesso(p_codigo);
begin
  if st <> 'ok' then
    return jsonb_build_object('ok', false, 'motivo', st);
  end if;

  return jsonb_build_object(
    'ok', true,
    'pessoas', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'nome', p.nome,
          'nif', p.nif,
          'marcas', coalesce((
            select jsonb_object_agg(m.data::text, m.vai_almocar)
            from public.marcacoes m
            where m.pessoa_id = p.id and m.data between p_inicio and p_inicio + 4
          ), '{}'::jsonb)
        )
        order by p.nome
      )
      from public.pessoas p
      where p.ativo
    ), '[]'::jsonb)
  );
end;
$$;

-- Total de refeições de CADA dia útil do período (para o relatório de gastos).
-- Conta todas as marcações "vai almoçar", mesmo de quem foi desativado depois.
create or replace function public.relatorio_totais(p_inicio date, p_fim date, p_codigo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := public.verificar_acesso(p_codigo);
begin
  if st <> 'ok' then
    return jsonb_build_object('ok', false, 'motivo', st);
  end if;
  if p_inicio is null or p_fim is null or p_fim < p_inicio or p_fim - p_inicio > 400 then
    return jsonb_build_object('ok', false, 'motivo', 'periodo_invalido');
  end if;

  return jsonb_build_object(
    'ok', true,
    'dias', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'data', d::date,
          'total', (select count(*)::int from public.marcacoes m where m.data = d::date and m.vai_almocar)
        )
        order by d
      )
      from generate_series(p_inicio, p_fim, interval '1 day') d
      where extract(isodow from d) between 1 and 5
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Fecha o acesso direto do público às tabelas
-- ---------------------------------------------------------------------
drop policy "grupos: leitura publica" on public.grupos;
drop policy "pessoas: leitura publica de ativas" on public.pessoas;
drop policy "marcacoes: leitura publica" on public.marcacoes;
drop policy "marcacoes: publico insere dentro do prazo" on public.marcacoes;
drop policy "marcacoes: publico atualiza dentro do prazo" on public.marcacoes;

revoke all on public.grupos, public.pessoas, public.marcacoes from anon;
-- (cardápio e configurações continuam públicos; as policies de admin continuam valendo)

-- ---------------------------------------------------------------------
-- Quem pode chamar o quê
-- ---------------------------------------------------------------------
revoke all on function
  public.normalizar(text),
  public.definir_codigo_cozinha(text),
  public.remover_codigo_cozinha(),
  public.verificar_acesso(text),
  public.buscar_pessoas(text),
  public.marcacoes_da_pessoa(uuid, date),
  public.salvar_marcacoes(uuid, jsonb),
  public.totais_por_dia(date),
  public.lista_cozinha(date, text),
  public.relatorio_totais(date, date, text),
  public.grupo_padrao()
from public;

grant execute on function
  public.buscar_pessoas(text),
  public.marcacoes_da_pessoa(uuid, date),
  public.salvar_marcacoes(uuid, jsonb),
  public.totais_por_dia(date),
  public.lista_cozinha(date, text),
  public.relatorio_totais(date, date, text)
to anon, authenticated;

grant execute on function
  public.definir_codigo_cozinha(text),
  public.remover_codigo_cozinha(),
  public.grupo_padrao()
to authenticated;
grant execute on function public.grupo_padrao() to service_role;
