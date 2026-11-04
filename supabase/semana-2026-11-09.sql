insert into public.cardapio (data, prato, acompanhamento, sobremesa) values
('2026-11-09', E'Arroz Branco\nFeijão Carioca\nSassami acebolado\nSalada de repolho roxo e verde', E'Escondidinho de lentilha', 'Laranja'),
('2026-11-10', E'Arroz Branco\nFeijão Carioca\nPicadinho húngaro\nTabule', E'PTS escura chinesa', 'Banana'),
('2026-11-11', E'Arroz Branco\nArroz Integral\nFilé mignon suíno assado\nFarofa rica\nSalada de alface crespa + molho de limão', E'Quibe de ervilha', 'Maçã'),
('2026-11-12', E'Arroz Branco\nFeijão Carioca\nCarne de panela com entrecasca de melancia\nSalada de cenoura cozida com ervilha', E'Tomate recheado com purê de feijão branco', 'Melancia'),
('2026-11-13', E'Arroz Branco\nFeijão Carioca\nFrango grelhado\nSalada de alface', E'Panache de legumes', 'Pavê de chocolate')
on conflict (data) do update set
  prato = excluded.prato,
  acompanhamento = excluded.acompanhamento,
  sobremesa = excluded.sobremesa;
