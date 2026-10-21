-- =====================================================================
-- Almoço SESI — dados FICTÍCIOS para testar o app
-- Rode DEPOIS das 3 migrations. Pode rodar de novo sem duplicar nada.
-- Todos os nomes e NIFs abaixo são inventados.
-- =====================================================================

-- Grupos
insert into public.grupos (nome) values ('Colaboradores'), ('Robótica')
on conflict (nome) do nothing;

-- 30 pessoas fictícias (18 colaboradores + 12 alunos da Robótica)
insert into public.pessoas (nome, nif, grupo_id)
select v.nome, v.nif, g.id
from (values
    ('Ana Paula Souza', '1040210', 'Colaboradores'),
    ('Bruno Henrique Lima', '1040247', 'Colaboradores'),
    ('Carla Mendes', '1040284', 'Colaboradores'),
    ('Daniel Ferreira', '1040321', 'Colaboradores'),
    ('Eduarda Rocha', '1040358', 'Colaboradores'),
    ('Fábio Martins', '1040395', 'Colaboradores'),
    ('Gabriela Nunes', '1040432', 'Colaboradores'),
    ('Helena Carvalho', '1040469', 'Colaboradores'),
    ('Igor Santos', '1040506', 'Colaboradores'),
    ('Juliana Alves', '1040543', 'Colaboradores'),
    ('Leonardo Costa', '1040580', 'Colaboradores'),
    ('Marina Oliveira', '1040617', 'Colaboradores'),
    ('Natália Ribeiro', '1040654', 'Colaboradores'),
    ('Otávio Pereira', '1040691', 'Colaboradores'),
    ('Patrícia Gomes', '1040728', 'Colaboradores'),
    ('Rafael Barbosa', '1040765', 'Colaboradores'),
    ('Sandra Dias', '1040802', 'Colaboradores'),
    ('Thiago Araújo', '1040839', 'Colaboradores'),
    ('Arthur Moreira', '2085300', 'Robótica'),
    ('Beatriz Cardoso', '2085341', 'Robótica'),
    ('Caio Teixeira', '2085382', 'Robótica'),
    ('Davi Correia', '2085423', 'Robótica'),
    ('Elisa Pinto', '2085464', 'Robótica'),
    ('Felipe Azevedo', '2085505', 'Robótica'),
    ('Giovanna Lopes', '2085546', 'Robótica'),
    ('Heitor Freitas', '2085587', 'Robótica'),
    ('Isabela Monteiro', '2085628', 'Robótica'),
    ('João Pedro Vieira', '2085669', 'Robótica'),
    ('Laura Cunha', '2085710', 'Robótica'),
    ('Miguel Ramos', '2085751', 'Robótica')
) as v (nome, nif, grupo)
join public.grupos g on g.nome = v.grupo
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
