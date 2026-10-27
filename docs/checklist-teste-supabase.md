# Checklist de teste no Supabase real (Etapa 2)

Tudo da Etapa 2 foi testado **sem** o Supabase de verdade:

- **74 testes de banco** (`npm run test:db`) rodam as 6 migrations num Postgres local, com `anon`, `authenticated`, `auth.uid()` e
  permissões padrão imitando o Supabase. Cobrem as funções novas, a RLS e as regras das fotos (policies).
- **50 testes de tela** (`npm test`): leitura/validação da planilha, regras do cardápio, logout, mensagens de erro.
- O painel inteiro foi aberto num navegador (360 px e desktop) contra esse Postgres, via PostgREST (a mesma API REST do
  Supabase), com um login e um Storage **de mentira**.

O que **não** dá para provar assim, e por isso está aqui: o login de verdade (GoTrue), o Storage de verdade, as permissões padrão
do seu projeto, e o comportamento em celulares reais. Marque cada item conforme for conferindo.

> Convenção: `$URL` = a Project URL (`https://xxxx.supabase.co`), `$ANON` = a chave **anon/publishable**. Nunca use a `service_role`.

---

## 0. Preparação

- [ ] Rodou as migrations **1 a 5** e o **`seed.sql`** (veja `docs/configurar-supabase.md`).
- [ ] Rodou a **migration 6**: `supabase/migrations/20261025000001_painel_admin.sql`. Terminou com **Success**.
- [ ] **Rodou a 6 uma segunda vez** e continuou com Success (ela foi feita para poder repetir).
- [ ] `.env` preenchido (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) e `npm run dev` abre sem a tela "Supabase não configurado".
- [ ] **Authentication → Users → Add user**: criou o **admin** (marque *Auto Confirm User*, senão o login pede confirmação por e-mail).
- [ ] Rodou o `insert into public.admins ...` do guia para esse usuário.
- [ ] Criou um **segundo usuário comum** (ex.: `comum@teste.com`), **sem** entrar na tabela `admins`. Serve para provar que estar logado não basta.
- [ ] **Cadastro público de usuários desligado** (Authentication → Sign In / Providers → *Allow new users to sign up* desligado).

---

## 1. Banco: permissões e RLS (SQL Editor)

Estas consultas confirmam o que os testes locais só **emulam**.

### 1.1 Quem pode executar cada função

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'execute')          as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as logado
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;
```

Esperado:

- [ ] `admin_salvar_marcacoes`, `admin_importar_pessoas`, `admin_duplicar_cardapio`, `admin_status_codigo_cozinha`,
      `definir_codigo_cozinha`, `remover_codigo_cozinha`, `limpar_texto`, `grupo_padrao`: **anon = false**, logado = true.
- [ ] `verificar_acesso`: **anon = false e logado = false** (só é usada por dentro de outras funções).
- [ ] `buscar_pessoas`, `marcacoes_da_pessoa`, `salvar_marcacoes`, `totais_por_dia`, `lista_cozinha`, `relatorio_totais`: **anon = true**.

> Motivo: no Supabase, funções novas em `public` nascem executáveis pelo público. A migration 6 fecha isso nas internas.
> Se alguma linha vier diferente, **pare** e me avise, em vez de seguir testando.

### 1.2 RLS ligada em tudo

```sql
select relname, relrowsecurity as rls
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by 1;
```

- [ ] **Todas** as tabelas aparecem com `rls = true`, inclusive a nova `marcacoes_manuais`.

### 1.3 Storage

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'cardapio-fotos';
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'cardapio-fotos%';
```

- [ ] Bucket `cardapio-fotos`: `public = true`, `file_size_limit = 2097152`, tipos `image/jpeg, image/png, image/webp`.
- [ ] 4 policies (`admin le`, `admin envia`, `admin troca`, `admin apaga`), todas para `authenticated`.
- [ ] Se o `create policy ... on storage.objects` deu erro de permissão: crie as 4 policies por **Storage → Policies** com a
      expressão `bucket_id = 'cardapio-fotos' and public.is_admin()`.

### 1.4 O público não lê nada sensível (API com a chave anon)

```bash
for t in pessoas marcacoes marcacoes_manuais acesso_cozinha tentativas_cozinha admins grupos; do
  echo -n "$t: "; curl -s -o /dev/null -w "%{http_code}\n" "$URL/rest/v1/$t?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
done
```

- [ ] Todas respondem **401** (ou 403). Nunca 200 com dados.
- [ ] Com o **usuário comum** (token pego em `POST $URL/auth/v1/token?grant_type=password`), as mesmas URLs devolvem `[]` (200 vazio) ou
      erro, **nunca** linhas de pessoas/marcações.
- [ ] `curl "$URL/rest/v1/cardapio?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` devolve o cardápio (isso é público de propósito).

---

## 2. Login e rota protegida

| # | Ação | Esperado | OK |
|---|---|---|---|
| 2.1 | Sem login, abrir `/admin` (e `/admin/pessoas`, `/admin/cardapio`…) | Vai para `/admin/login` | [ ] |
| 2.2 | Login com **senha errada** | "E-mail ou senha incorretos." (sem dizer qual dos dois) | [ ] |
| 2.3 | Login com **e-mail que não existe** | A **mesma** frase da 2.2 | [ ] |
| 2.4 | Login com o **usuário comum** (não admin) | "Este usuário não tem acesso ao painel." e **não** fica logado | [ ] |
| 2.5 | Login com o **admin** | Entra no painel (Visão geral) | [ ] |
| 2.6 | Recarregar a página (F5) dentro do painel | Continua logado | [ ] |
| 2.7 | Fechar e abrir o navegador | Continua logado (sessão salva) | [ ] |
| 2.8 | Com sessão, abrir `/admin/login` | Vai direto para o painel | [ ] |
| 2.9 | **Sair** (menu lateral no PC; botão no topo no celular) | Volta ao login; voltar com o botão do navegador **não** mostra dados | [ ] |
| 2.10 | Depois de sair, abrir `/admin/pessoas` | Vai para o login | [ ] |
| 2.11 | Errar a senha **muitas vezes seguidas** | Em algum momento: "Muitas tentativas. Aguarde alguns minutos…" (limite do Supabase) | [ ] |
| 2.12 | Se o projeto exige confirmação de e-mail e o usuário não confirmou | Mensagem pedindo para confirmar no painel do Supabase | [ ] |
| 2.13 | Deixar o painel aberto **mais de 1 hora** e voltar a usar | Renova sozinho **ou** pede login; **nunca** mostra erro técnico (`JWT expired`) | [ ] |
| 2.14 | Logar em **duas abas** e sair numa delas | A outra volta ao login na próxima ação, sem travar | [ ] |
| 2.15 | A Home, Cardápio, Lista e Marcar (público) **não mostram link** para o admin | Nenhum link para `/admin` | [ ] |

> A proteção **de verdade** é do banco (RLS e `is_admin()`); a rota protegida só evita mostrar telas vazias. Por isso os itens
> da seção 1.4 são os mais importantes.

---

## 3. Código da cozinha (Configurações)

| # | Ação | Esperado | OK |
|---|---|---|---|
| 3.1 | Abrir Configurações **sem** código definido | Aviso vermelho "Nenhum código definido…" | [ ] |
| 3.2 | Tentar definir `abc` | "O código precisa ter pelo menos 6 caracteres." (nada é gravado) | [ ] |
| 3.3 | Definir `cozinha-teste-1` | Aviso verde "Código definido · trocado em dd/mm/aaaa hh:mm" | [ ] |
| 3.4 | Em outra aba **sem login**, abrir **Cozinha** e entrar com `cozinha-teste-1` | Mostra a Lista com nomes | [ ] |
| 3.5 | Trocar para `cozinha-teste-2` (confirma no diálogo) | Código antigo **para de funcionar na hora**; o novo funciona | [ ] |
| 3.6 | Na aba **Network** do navegador, olhar as respostas ao abrir Configurações | Nunca aparece o código nem o hash (só `configurado` e `atualizado_em`) | [ ] |
| 3.7 | Errar o código **10 vezes** na Cozinha | "Muitas tentativas…" (bloqueio de alguns minutos) | [ ] |
| 3.8 | Durante o bloqueio, **trocar o código** pelo painel | Desbloqueia; o novo código entra | [ ] |
| 3.9 | Logado como admin, abrir a Lista da Cozinha | Entra **sem** pedir código e nunca é bloqueado | [ ] |
| 3.10 | Chamar `definir_codigo_cozinha` com a chave **anon** (`$URL/rest/v1/rpc/definir_codigo_cozinha`) | Erro de permissão; código não muda | [ ] |
| 3.11 | Idem com o **usuário comum** | Erro ("row-level security"); código não muda | [ ] |

---

## 4. Importação de colaboradores

Faça com planilhas **geradas no Excel de verdade** (não só CSV de teste).

| # | Arquivo | Esperado | OK |
|---|---|---|---|
| 4.1 | `.xlsx` com colunas `nome` e `nif` (NIF como **número**) | Pré-visualização; NIF sem ".0"; importa | [ ] |
| 4.2 | `.xlsx` com NIF formatado como **Texto** e zeros à esquerda (`0012345`) | Zeros preservados no banco (Table Editor) | [ ] |
| 4.3 | `.xlsx` com NIF **número** `0012345` | Entra como `12345` (o Excel já tinha perdido o zero): a tela avisa na dica; confirme que isso é aceitável para o seu NIF | [ ] |
| 4.4 | CSV salvo como **"CSV (separado por vírgulas)"** do Excel pt-BR (`;` e ANSI/Windows-1252) | Acentos corretos (José, Conceição); colunas separadas | [ ] |
| 4.5 | CSV **UTF-8** (com e sem BOM) | Idem | [ ] |
| 4.6 | Planilha **com coluna extra** (CPF, e-mail, salário…) | Aviso "Colunas ignoradas: …"; **nenhum** dado dessas colunas aparece no banco nem na aba Network (confira o corpo da chamada `admin_importar_pessoas`) | [ ] |
| 4.7 | Planilha sem cabeçalho `nome`/`nif` | "Não encontrei as colunas “nome” e “nif”…" | [ ] |
| 4.8 | Linha sem NIF / sem nome / NIF com espaço no meio / NIF repetido / NIF já cadastrado / linha vazia | Cada uma com o motivo certo; só as válidas são importadas | [ ] |
| 4.9 | Importar **a mesma planilha de novo** | Todas viram "NIF já cadastrado"; "Importar 0" fica desabilitado; nada duplica | [ ] |
| 4.10 | Planilha com **exatamente 2000** pessoas | Importa tudo em poucos segundos, sem erro de tamanho de requisição | [ ] |
| 4.11 | Planilha com **2001** pessoas | Recusada com mensagem clara | [ ] |
| 4.12 | Arquivo **maior que 2 MB** / formato `.png` / arquivo corrompido | Mensagem clara, sem tela quebrada | [ ] |
| 4.13 | Depois de importar, na **Home** (sem login), buscar um nome recém-importado | Aparece com NIF mascarado (`***482`); a pessoa consegue marcar | [ ] |
| 4.14 | Duas pessoas importando ao mesmo tempo o mesmo NIF (duas abas) | Uma entra; a outra vê "NIF já cadastrado" no resultado final | [ ] |
| 4.15 | Chamar `admin_importar_pessoas` com a chave **anon** ou com o **usuário comum** | Erro de permissão; nada gravado | [ ] |

---

## 5. Cardápio e fotos (Storage)

| # | Ação | Esperado | OK |
|---|---|---|---|
| 5.1 | Editar pratos/tags de uma semana e **Salvar semana** | Aparece no Cardápio público (aba anônima) | [ ] |
| 5.2 | Enviar **JPG grande de câmera** (4000×3000, vários MB) | Vira ~1280 px e algumas dezenas de KB (Storage → `cardapio-fotos`) | [ ] |
| 5.3 | Enviar **PNG** e **WebP** | Funcionam; ficam JPEG no bucket | [ ] |
| 5.4 | Enviar foto **HEIC** (iPhone, escolhida da galeria) | Funciona **ou** mostra "Não consegui ler essa imagem…"; nunca trava | [ ] |
| 5.5 | **Celular real (iPhone/Safari)**: botão "Tirar foto" abre a câmera traseira; foto sobe | [ ] |
| 5.6 | **Celular real (Android/Chrome)**: idem | [ ] |
| 5.7 | Copiar o link da foto e abrir em **aba anônima** | Abre sem login (bucket público) | [ ] |
| 5.8 | **Trocar** a foto e salvar | A foto antiga **some do bucket** | [ ] |
| 5.9 | **Remover** a foto e salvar | O arquivo some do bucket | [ ] |
| 5.10 | Enviar uma foto e **Descartar** (ou trocar de semana descartando) | O arquivo enviado some do bucket | [ ] |
| 5.11 | Fechar a aba **no meio** de uma edição com foto enviada e não salva | Fica um arquivo "órfão" no bucket (esperado; só ocupa espaço). Anote se incomodar | [ ] |
| 5.12 | **Limpar o dia** e salvar | O cardápio daquele dia some do público | [ ] |
| 5.13 | Salvar prato vazio com sobremesa preenchida | "Informe o prato do dia."; nada é gravado | [ ] |
| 5.14 | **Copiar da semana anterior** para uma semana vazia | 5 dias copiados; **fotos não copiadas** | [ ] |
| 5.15 | Copiar para uma semana **já preenchida** | Pergunta: preencher só os vazios ou substituir | [ ] |
| 5.16 | Mudar de semana com alterações não salvas | Pergunta antes de descartar | [ ] |
| 5.17 | Cardápio público: cartão **com** foto e cartão **sem** foto, claro e escuro, 360 px e desktop | Foto não estoura o cartão; sem foto = igual ao de antes | [ ] |
| 5.18 | Upload via API com a chave **anon** (`POST $URL/storage/v1/object/cardapio-fotos/x.jpg`) | Recusado (RLS) | [ ] |
| 5.19 | Idem com o token do **usuário comum** | Recusado (RLS) | [ ] |
| 5.20 | Idem com o token do **admin**, mas arquivo **PDF** ou **> 2 MB** | Recusado (tipo/tamanho do bucket) | [ ] |
| 5.21 | Listar o bucket com a chave anon (`POST $URL/storage/v1/object/list/cardapio-fotos`) | Vazio/recusado (só as URLs públicas funcionam) | [ ] |

---

## 6. Marcações manuais

| # | Ação | Esperado | OK |
|---|---|---|---|
| 6.1 | Marcar "Vai" para alguém **depois do prazo** (ou em dia já passado) | Salva; o público **não** conseguiria | [ ] |
| 6.2 | Mudar Vai → Não vai e "Sem marcação" | Salva; "Sem marcação" remove a marcação | [ ] |
| 6.3 | Escrever motivo e salvar | Aparece no **Histórico** com de/para, data e hora | [ ] |
| 6.4 | Salvar sem mudar nada | Botão "Nenhuma alteração" desabilitado | [ ] |
| 6.5 | Motivo com 200 caracteres / 201 | 200 passa; 201 é barrado já na tela | [ ] |
| 6.6 | As marcações aparecem na **Lista da Cozinha** e nos **totais** públicos em até ~15 s | [ ] |
| 6.7 | Tentar ler `marcacoes_manuais` com a chave anon | 401 | [ ] |
| 6.8 | Idem com o **usuário comum** | Vazio/erro | [ ] |
| 6.9 | Com o **token do admin**, `PATCH` e `DELETE` em `$URL/rest/v1/marcacoes_manuais` | Erro de permissão (`42501`): o histórico só cresce. (O Table Editor do painel do Supabase **não serve** para este teste: ele usa o dono do banco e ignora a RLS.) | [ ] |
| 6.10 | O **público** ainda não consegue marcar depois do prazo | "O prazo para marcar esse dia já encerrou." | [ ] |
| 6.11 | Chamar `admin_salvar_marcacoes` com anon / usuário comum | Erro de permissão | [ ] |
| 6.12 | Sábado/domingo | Não existem na tela; a função também recusa fim de semana | [ ] |

---

## 7. Configurações

| # | Ação | Esperado | OK |
|---|---|---|---|
| 7.1 | Mudar **nome da unidade** e salvar | Persistido; aparece nos relatórios exportados (Excel/PDF) | [ ] |
| 7.2 | Mudar o **prazo** para um horário **daqui a poucos minutos** e tentar marcar na Home perto do limite (horário de **São Paulo**) | Marca antes do horário; recusa depois | [ ] |
| 7.3 | Adicionar um **dia sem almoço** futuro | No Home, esse dia não aceita marcação ("Não haverá almoço nesse dia.") | [ ] |
| 7.4 | Tentar adicionar sábado/domingo | "Esse dia é fim de semana…" | [ ] |
| 7.5 | Remover o dia e salvar | Volta a aceitar marcação | [ ] |
| 7.6 | "Limpar datas que já passaram" | Remove só as passadas | [ ] |
| 7.7 | Escrever **aviso da Home** e salvar | Persistido. **A exibição na Home é da Etapa 3**; por ora confira só no Table Editor | [ ] |
| 7.8 | Aviso com 280 / 281 caracteres; nome em branco | 280 passa; 281 e nome vazio são barrados | [ ] |
| 7.9 | Tentar `PATCH` em `configuracoes` com anon / usuário comum | Nenhuma linha alterada | [ ] |
| 7.10 | **Descartar** com alterações | Volta ao que estava salvo | [ ] |

---

## 8. Pessoas e Relatório

- [ ] Criar uma pessoa pelo botão **Nova pessoa** e editar nome/NIF.
- [ ] NIF repetido ao cadastrar/editar: "Já existe uma pessoa com esse NIF." (e **não** uma mensagem técnica).
- [ ] **Desativar** uma pessoa: some da busca pública; o histórico dela continua nos relatórios. Reativar: volta.
- [ ] Busca por nome sem acento e por várias palavras (`jose conceicao`).
- [ ] Lista com **mais de 1000 pessoas** (importe 2 planilhas): a contagem do painel mostra todas (o painel busca em páginas de 1000).
- [ ] **Relatório** no painel abre **sem** pedir código e baixa **Excel** e **PDF** (teste no iPhone/Safari também).
- [ ] O relatório do painel e o da Lista da Cozinha mostram os **mesmos números** para o mesmo período.

---

## 9. Visão geral (dashboard)

- [ ] "Refeições hoje", "Previsão da semana", "Adesão" e "Pessoas" batem com o que a Lista da Cozinha mostra.
- [ ] Fim de semana: o primeiro cartão passa a mostrar a **próxima segunda**.
- [ ] "Ainda não marcaram" lista só quem **não marcou nenhum dia** (quem marcou "Não vou" já conta como respondeu).
- [ ] Os números se atualizam sozinhos (até ~20 s) quando alguém marca na Home.

---

## 10. Aparelhos reais

- [ ] **iPhone (Safari)**: campos de data e hora; teclado não dá zoom na página; barra de salvar não fica atrás do teclado; abas
      inferiores respeitam a área do "home indicator"; painéis que sobem de baixo rolam bem.
- [ ] **Android (Chrome)**: idem.
- [ ] 360 px de largura: **nenhuma** tela com rolagem horizontal; alvos de toque confortáveis.
- [ ] Tema **escuro** em todas as telas do painel.
- [ ] Notebook/desktop (1280 px): menu lateral; tabelas; gráfico.

---

## 11. Decisões que valem confirmar com você

1. **Linhas repetidas na planilha:** a **primeira** entra; as seguintes viram erro ("NIF repetido na planilha, já aparece na linha X").
2. **Fotos não são copiadas** ao duplicar a semana (o prato pode mudar e ficaria uma foto errada). Dá para copiar também, se preferir.
3. **Desativar em vez de excluir** pessoas: excluir apagaria o histórico de refeições nos relatórios. Não há botão de excluir.
4. **Adesão** = pessoas que marcaram pelo menos um dia (vai **ou** não vai) ÷ pessoas ativas.
5. **Código da cozinha** só pode ser definido/trocado (não há botão "remover" no painel; continua possível por SQL).
6. A biblioteca de planilhas (`xlsx` 0.18) tem avisos de segurança conhecidos ao abrir arquivos **maliciosos**. Aqui só o admin importa
   arquivos **seus**, então o risco é baixo; evite abrir planilhas de origem desconhecida. CSV não usa essa biblioteca.

---

## 11b. Etapa 3A: aviso da Home, banner de prazo e PDF do cardápio

| # | Ação | Esperado | OK |
|---|---|---|---|
| 11b.1 | Salvar um **aviso** em Configurações e abrir a Home (aba anônima) | O aviso aparece no topo, acima da busca, em até ~1 min (cache de 60 s) | [ ] |
| 11b.2 | Apagar o aviso e salvar | O cartão do aviso some | [ ] |
| 11b.3 | Aviso longo (280 caracteres) e com quebra de linha | Quebra bem em 360 px, sem estourar a largura | [ ] |
| 11b.4 | Home **antes do prazo**, num dia útil | "Marque o almoço de hoje até as HH:MM · faltam X"; vira tom de alerta nos últimos 30 min | [ ] |
| 11b.5 | Home **depois do prazo** | "O prazo de hoje encerrou às HH:MM…"; marcar hoje continua bloqueado (o banco decide) | [ ] |
| 11b.6 | Hoje em **dia sem almoço** (Configurações) | "Hoje não haverá almoço." | [ ] |
| 11b.7 | Sábado ou domingo | "Cada dia pode ser marcado até as HH:MM do próprio dia." | [ ] |
| 11b.8 | Mudar o prazo em Configurações | O banner passa a mostrar o novo horário (até ~1 min) | [ ] |
| 11b.9 | Celular com o fuso configurado **fora** do Brasil | O banner segue o horário de **São Paulo**, igual ao banco | [ ] |
| 11b.10 | Recarregar a Home várias vezes | Sem aviso de "hydration" no console (o relógio só roda no navegador) | [ ] |
| 11b.11 | Cardápio → **Baixar PDF** (Chrome, Safari iPhone, Android) | Baixa `cardapio_AAAA-MM-DD_a_AAAA-MM-DD.pdf`; acentos corretos; nome da unidade certo | [ ] |
| 11b.12 | PDF de semana com dias **sem cardápio** e com textos longos | "Cardápio ainda não divulgado" nos vazios; textos quebram sem cortar; segue para a 2ª página se precisar | [ ] |
| 11b.13 | Botão Baixar PDF numa semana **sem nenhum** cardápio | Desabilitado | [ ] |
| 11b.14 | Imprimir o PDF em A4 | Cabe numa folha (semana normal) | [ ] |

## 12. Depois de testar

- [ ] Apagar as pessoas/marcações/cardápio de teste e as fotos do bucket (ou rodar o `seed.sql` num projeto de teste separado).
- [ ] **Trocar o código da cozinha** e a senha do admin por valores definitivos.
- [ ] Remover o usuário `comum@teste.com`.
- [ ] Conferir que a chave `service_role` **não** está no `.env` nem no GitHub.
