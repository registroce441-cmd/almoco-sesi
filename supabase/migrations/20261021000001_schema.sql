-- =====================================================================
-- Almoço SESI — 1/3: estrutura do banco (tabelas, índices, gatilhos)
-- Rode esta migration primeiro, depois a 2 e a 3.
-- =====================================================================

-- Atualiza "updated_at" automaticamente em qualquer UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Grupos (ex.: Colaboradores, Robótica)
-- ---------------------------------------------------------------------
create table public.grupos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique check (length(btrim(nome)) > 0),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pessoas (funcionários e alunos). NIF é opcional, mas único quando existe.
-- ---------------------------------------------------------------------
create table public.pessoas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(btrim(nome)) > 0),
  nif        text unique check (nif is null or length(btrim(nif)) > 0),
  grupo_id   uuid not null references public.grupos (id) on delete restrict,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pessoas_grupo_id_idx on public.pessoas (grupo_id);
create index pessoas_nome_idx on public.pessoas (lower(nome));

create trigger pessoas_set_updated_at
  before update on public.pessoas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Cardápio: um registro por dia útil.
-- ---------------------------------------------------------------------
create table public.cardapio (
  id              uuid primary key default gen_random_uuid(),
  data            date not null unique,
  prato           text not null check (length(btrim(prato)) > 0),
  acompanhamento  text not null default '',
  sobremesa       text not null default '',
  tags            text[] not null default '{}',
  foto_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cardapio_dia_util check (extract(isodow from data) between 1 and 5)
);

create trigger cardapio_set_updated_at
  before update on public.cardapio
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Marcações: quem vai (ou não vai) almoçar em cada dia.
-- Uma linha por pessoa e dia. Sem linha = "sem marcação".
-- ---------------------------------------------------------------------
create table public.marcacoes (
  id          uuid primary key default gen_random_uuid(),
  pessoa_id   uuid not null references public.pessoas (id) on delete cascade,
  data        date not null,
  vai_almocar boolean not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint marcacoes_pessoa_data_key unique (pessoa_id, data),
  constraint marcacoes_dia_util check (extract(isodow from data) between 1 and 5)
);

create index marcacoes_data_idx on public.marcacoes (data);

create trigger marcacoes_set_updated_at
  before update on public.marcacoes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Configurações: sempre UMA única linha (id = 1).
--   prazo_limite    -> horário limite, NO PRÓPRIO DIA do almoço (fuso de São Paulo)
--   dias_bloqueados -> datas sem almoço (feriados, recessos…)
--   aviso_home      -> mensagem exibida na Home
--   nome_unidade    -> nome da unidade
-- ---------------------------------------------------------------------
create table public.configuracoes (
  id              smallint primary key default 1 check (id = 1),
  prazo_limite    time not null default '09:00',
  dias_bloqueados date[] not null default '{}',
  aviso_home      text,
  nome_unidade    text not null default 'SESI',
  updated_at      timestamptz not null default now()
);

insert into public.configuracoes (id) values (1);

create trigger configuracoes_set_updated_at
  before update on public.configuracoes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Administradores: quem está nesta tabela é admin (veja a migration 3).
-- Só é preenchida pelo SQL Editor / service_role — nunca pelo app.
-- ---------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
