-- =====================================================================
-- Almoço SESI — dados FICTÍCIOS para testar o app (somente colaboradores)
-- Rode DEPOIS das migrations. Pode rodar de novo sem duplicar nada.
-- Todos os nomes e NIFs abaixo são inventados. Há dois pares de homônimos
-- (Marcos Vinícius Lima e Renata Figueiredo) para testar o desempate pelo NIF.
-- O código de acesso da cozinha NÃO vem aqui: defina o seu (veja docs/configurar-supabase.md).
-- =====================================================================

-- Grupo único
insert into public.grupos (nome) values ('Colaboradores')
on conflict (nome) do nothing;

-- 30 colaboradores fictícios
insert into public.pessoas (nome, nif, grupo_id)
select v.nome, v.nif, g.id
from (values
    ('Ana Paula Souza', '1040210'),
    ('Bruno Henrique Lima', '1040247'),
    ('Carla Mendes', '1040284'),
    ('Daniel Ferreira', '1040321'),
    ('Eduarda Rocha', '1040358'),
    ('Fábio Martins', '1040395'),
    ('Gabriela Nunes', '1040432'),
    ('Helena Carvalho', '1040469'),
    ('Igor Santos', '1040506'),
    ('Juliana Alves', '1040543'),
    ('Leonardo Costa', '1040580'),
    ('Marina Oliveira', '1040617'),
    ('Natália Ribeiro', '1040654'),
    ('Otávio Pereira', '1040691'),
    ('Patrícia Gomes', '1040728'),
    ('Rafael Barbosa', '1040765'),
    ('Sandra Dias', '1040802'),
    ('Thiago Araújo', '1040839'),
    ('Alessandra Moura', '1041000'),
    ('Cláudio Batista', '1041029'),
    ('Débora Siqueira', '1041058'),
    ('Eduardo Campos', '1041087'),
    ('Fernanda Lacerda', '1041116'),
    ('Gustavo Pires', '1041145'),
    ('Ingrid Valadares', '1041174'),
    ('José Carlos Nogueira', '1041203'),
    ('Marcos Vinícius Lima', '1041232'),
    ('Marcos Vinícius Lima', '1041261'),
    ('Renata Figueiredo', '1041290'),
    ('Renata Figueiredo', '1041319')
) as v (nome, nif)
cross join (select id from public.grupos where nome = 'Colaboradores') g
on conflict (nif) do nothing;

-- Cardápio de 4 semanas, a partir da segunda-feira da semana atual
-- (se hoje for sábado ou domingo, começa na próxima segunda — igual ao app).
with inicio as (
  select (date_trunc('week', public.hoje_sp())::date
          + case when extract(isodow from public.hoje_sp()) > 5 then 7 else 0 end) as seg
),
pratos (idx, prato, acompanhamento, sobremesa, tags) as (values
    (0, 'Frango grelhado ao limão', 'Arroz, feijão e legumes no vapor', 'Gelatina de morango', array['Sem glúten','Leve']::text[]),
    (1, 'Strogonoff de carne', 'Arroz branco e batata palha', 'Pudim de leite', '{}'::text[]),
    (2, 'Lasanha de berinjela', 'Salada verde e arroz integral', 'Salada de frutas', array['Vegetariano']::text[]),
    (3, 'Peixe assado com ervas', 'Purê de mandioquinha e salada', 'Mousse de maracujá', array['Sem glúten']::text[]),
    (4, 'Feijoada light', 'Arroz, couve e farofa', 'Laranja', array['Sem lactose']::text[]),
    (5, 'Escondidinho de carne seca', 'Arroz e salada de tomate', 'Doce de abóbora', array['Sem glúten']::text[]),
    (6, 'Risoto de cogumelos', 'Salada caprese', 'Brownie', array['Vegetariano']::text[]),
    (7, 'Carne de panela', 'Arroz, feijão e polenta', 'Banana caramelada', array['Sem lactose']::text[]),
    (8, 'Grão-de-bico ao curry', 'Arroz basmati e legumes', 'Melancia', array['Vegetariano','Sem glúten','Sem lactose']::text[]),
    (9, 'Macarrão à bolonhesa', 'Salada mista', 'Sorvete de creme', '{}'::text[])
),
dias as (
  select s as semana, d as dia
  from generate_series(0, 3) s, generate_series(0, 4) d
)
insert into public.cardapio (data, prato, acompanhamento, sobremesa, tags)
select i.seg + (dias.semana * 7 + dias.dia),
       p.prato, p.acompanhamento, p.sobremesa, p.tags
from inicio i
cross join dias
join pratos p
  on p.idx = (((dias.semana * 3) % 10) + dias.dia * 2 + (case when dias.dia > 2 then 1 else 0 end)) % 10
on conflict (data) do nothing;
