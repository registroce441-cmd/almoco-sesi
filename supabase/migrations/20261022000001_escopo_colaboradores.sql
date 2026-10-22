-- =====================================================================
-- Almoço SESI — 4/5: escopo SOMENTE colaboradores do SESI
--   * remove o grupo "Robótica" e todos os alunos (e as marcações deles)
--   * mantém um único grupo: "Colaboradores"
--   * NIF passa a ser obrigatório e único
-- Rode depois das migrations 1, 2 e 3 (não altera o que elas fizeram).
-- =====================================================================

-- Antes de mexer em qualquer coisa: avisa com clareza se ainda existir alguém sem NIF
-- (alunos serão apagados, então só conta quem é colaborador).
do $$
declare
  faltando int;
begin
  select count(*) into faltando
  from public.pessoas p
  join public.grupos g on g.id = p.grupo_id and g.nome <> 'Robótica'
  where p.nif is null or btrim(p.nif) = '';
  if faltando > 0 then
    raise exception 'Existem % pessoa(s) sem NIF. Preencha o NIF de todas (ou apague) e rode esta migration de novo.', faltando;
  end if;
end;
$$;

insert into public.grupos (nome) values ('Colaboradores')
on conflict (nome) do nothing;

-- Alunos: apaga as pessoas do grupo Robótica (as marcações caem junto, por "on delete cascade").
delete from public.pessoas
where grupo_id in (select id from public.grupos where nome = 'Robótica');

delete from public.grupos where nome = 'Robótica';

update public.pessoas set nif = btrim(nif) where nif <> btrim(nif);

alter table public.pessoas drop constraint if exists pessoas_nif_check;
alter table public.pessoas alter column nif set not null;
alter table public.pessoas
  add constraint pessoas_nif_preenchido check (nif = btrim(nif) and length(nif) > 0);
-- (a unicidade já existe: constraint "pessoas_nif_key" da migration 1)

-- Só existe um grupo, então quem cadastra pessoas (importação, painel) não precisa informá-lo.
create or replace function public.grupo_padrao()
returns uuid
language sql
stable
as $$
  select id from public.grupos where nome = 'Colaboradores';
$$;

alter table public.pessoas alter column grupo_id set default public.grupo_padrao();
