-- =====================================================================
-- Almoço SESI — 2/3: funções e regras de prazo (validadas NO BANCO)
-- =====================================================================

-- O usuário logado é admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  );
$$;

-- Data de hoje no fuso de São Paulo.
create or replace function public.hoje_sp()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Devolve o MOTIVO pelo qual o público não pode marcar a data (ou NULL se pode).
-- Regras: dia útil, não bloqueado, não passou e, se for hoje, antes do prazo.
create or replace function public.motivo_bloqueio_marcacao(p_data date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg   public.configuracoes;
  agora timestamp := now() at time zone 'America/Sao_Paulo';
begin
  select * into cfg from public.configuracoes where id = 1;
  if not found then
    return 'As marcações estão indisponíveis no momento.';
  end if;

  if extract(isodow from p_data) not between 1 and 5 then
    return 'Esse dia não tem almoço.';
  end if;
  if p_data = any (cfg.dias_bloqueados) then
    return 'Não haverá almoço nesse dia.';
  end if;
  if p_data < agora::date then
    return 'Esse dia já passou.';
  end if;
  if p_data = agora::date and agora::time > cfg.prazo_limite then
    return 'O prazo para marcar esse dia já encerrou.';
  end if;
  return null;
end;
$$;

create or replace function public.marcacao_aberta(p_data date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.motivo_bloqueio_marcacao(p_data) is null;
$$;

-- Gatilho: dá mensagens claras em português para o público.
-- Admin e acessos internos (SQL Editor, service_role) passam direto.
-- (A policy de RLS na migration 3 repete a regra como segunda barreira.)
create or replace function public.validar_marcacao()
returns trigger
language plpgsql
as $$
declare
  motivo text;
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' and (new.pessoa_id <> old.pessoa_id or new.data <> old.data) then
    raise exception 'Não é permitido trocar a pessoa ou a data de uma marcação.';
  end if;

  motivo := public.motivo_bloqueio_marcacao(new.data);
  if motivo is not null then
    raise exception '%', motivo using hint = 'MARCACAO_FECHADA';
  end if;

  if not exists (
    select 1 from public.pessoas p where p.id = new.pessoa_id and p.ativo
  ) then
    raise exception 'Pessoa não encontrada ou inativa.';
  end if;

  return new;
end;
$$;

create trigger marcacoes_validar
  before insert or update on public.marcacoes
  for each row execute function public.validar_marcacao();

revoke all on function public.is_admin() from public;
revoke all on function public.motivo_bloqueio_marcacao(date) from public;
revoke all on function public.marcacao_aberta(date) from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.motivo_bloqueio_marcacao(date) to anon, authenticated;
grant execute on function public.marcacao_aberta(date) to anon, authenticated;
