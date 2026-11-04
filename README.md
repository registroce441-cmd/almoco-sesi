# Almoço SESI

Aplicativo web para os **colaboradores do SESI** confirmarem, pelo celular ou pelo computador, em quais dias da semana vão almoçar.
A cozinha vê a lista e os totais; a administração cadastra pessoas, publica o cardápio e acompanha tudo por um painel.
Mobile-first (pensado para 360 px), em português do Brasil, com modo claro e escuro.

## O que o sistema faz

| Quem | O que faz |
|---|---|
| **Colaborador** (sem login) | Busca o próprio nome ou NIF, marca ou desmarca os dias da semana até o prazo, vê o **cardápio** (com foto, compartilha no WhatsApp ou baixa em **PDF**) e lê o **aviso** e o **prazo de hoje** na Home. |
| **Cozinha** (código de acesso) | Vê **quem vai** em cada dia, os totais por dia e semana, e o **relatório** de refeições (Excel e PDF). |
| **Administração** (login em `/admin`) | Painel com visão geral, **pessoas** (cadastro e importação por planilha só com nome e NIF), **cardápio** (editor semanal, duplicar semana, foto do prato), **marcações manuais** com motivo, **relatório** e **configurações** (prazo, dias sem almoço, aviso da Home, nome da unidade e código da cozinha). |

**Aplicativo instalável (PWA):** dá para adicionar à tela inicial no Android e no iPhone. O cardápio abre mesmo com internet fraca ou sem internet;
a Lista da cozinha e o painel **nunca** ficam guardados no aparelho.

**Privacidade:** o público não lê as tabelas de pessoas nem de marcações; só chama funções do banco que devolvem o mínimo
(o NIF aparece mascarado, `***482`). Regras de prazo e permissões são validadas **no banco** (RLS), não só na tela.

## Como funciona por dentro

O sistema roda **100% em planos gratuitos**:

| Peça | O que é | Onde fica |
|---|---|---|
| **Site** | O aplicativo que as pessoas abrem | GitHub Pages (workflow **Publicar no GitHub Pages**, a cada push na `main`) |
| **Banco, login e fotos** | Dados, regras de segurança, login do admin e fotos do cardápio | Supabase (plano Free, região São Paulo) |
| **Despertador** | Tarefa diária que consulta o banco para ele não pausar | Workflow **Despertador do banco** |
| **Backup** | Cópia mensal dos dados para o Google Drive | Workflow **Backup mensal para o Google Drive** |

## Tecnologias

- **React 19** + **TypeScript**, **TanStack Start / Router / Query**, **Vite**
- **Tailwind CSS 4** + componentes **shadcn/ui** (Radix)
- **Supabase**: Postgres com RLS e funções SQL, Auth (login do administrador) e Storage (fotos do cardápio)
- **Recharts** (gráficos), **jsPDF** (PDFs), **SheetJS** (Excel/CSV)
- **Vitest** para testes (telas e banco)

## Como rodar

Precisa de Node.js 20+ e de um projeto no Supabase (veja a próxima seção).

```sh
npm install
copy .env.example .env   # Windows (no Mac/Linux: cp .env.example .env) e preencha com os dados do seu projeto Supabase
npm run dev              # abre em http://localhost:8080
```

Painel do administrador: `http://localhost:8080/admin/login` (o endereço não aparece em nenhuma tela pública).
Depois de editar o `.env`, pare o servidor e rode `npm run dev` de novo.

## Configurar o Supabase

Resumo (o passo a passo ilustrado está em [`docs/configurar-supabase.md`](docs/configurar-supabase.md)):

1. Crie um projeto em supabase.com (região São Paulo).
2. No **SQL Editor**, rode **em ordem** os arquivos de `supabase/migrations/` (6 arquivos) e, para dados de demonstração, `supabase/seed.sql`
   (30 colaboradores fictícios e 4 semanas de cardápio). **Não rode o seed em produção.**
3. Copie a **Project URL** e a chave **anon/publishable** para o `.env`
   (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`). **Nunca** use a chave `service_role` no app.
4. Em **Authentication**, desligue o cadastro público, crie o usuário administrador (marque **Auto Confirm User**) e inclua-o em `public.admins`
   (o comando está no guia).
5. Entre em `/admin/login` e, em **Configurações**, defina o **código da cozinha**.

Depois de configurar, siga [`docs/checklist-teste-supabase.md`](docs/checklist-teste-supabase.md) para conferir RLS, login, fotos e importação.

## Operação do dia a dia

Tudo é feito pelo painel em `/admin/login`:

| Tarefa | Onde |
|---|---|
| Trocar o código da cozinha | Configurações |
| Importar pessoas novas (planilha com `nome` e `nif`) | Pessoas → Importar |
| Desativar quem saiu (não exclua, para manter os relatórios) | Pessoas |
| Editar cardápio e foto, ou duplicar a semana | Cardápio |
| Ajustar prazo, dias sem almoço, aviso e nome da unidade | Configurações |
| Marcar ou desmarcar por alguém, com motivo | Marcações |
| Exportar o relatório (Excel ou PDF) | Relatório |

## Se algo parar

Confira nesta ordem:

1. **O site não abre:** em **Actions**, veja a última execução de **Publicar no GitHub Pages**. Se falhou, abra a execução e leia o erro.
2. **O site abre, mas não carrega dados:** o banco provavelmente **pausou** (o plano Free pausa após cerca de 7 dias sem uso). No Supabase, clique em **Restore project**. Os dados não são apagados.
3. **Aviso de "Supabase não configurado":** faltam `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na publicação.
4. **Erro `permission denied` (42501):** falta permissão em alguma tabela ou função; revise `supabase/migrations/`.
5. **Sem acesso ao painel:** confira o usuário em **Authentication → Users** e em `public.admins`.
6. **Erros no banco:** Supabase → **Logs** e **Advisors**. **Erros no navegador:** F12 → aba **Console** (anote a mensagem exata).

## Despertador (evita a pausa do banco)

O workflow **Despertador do banco** (`.github/workflows/despertador.yml`) faz uma consulta real ao banco todo dia, usando a chave anon guardada em **Settings → Secrets and variables → Actions**.

- **Como conferir:** aba **Actions → Despertador do banco**, execução diária em verde.
- **Se parar:** o GitHub desativa tarefas agendadas após cerca de 60 dias sem atividade no repositório. Selecione o workflow e clique em **Enable workflow** e depois **Run workflow**.
- **Outras causas:** chave trocada sem atualizar o secret, ou repositório movido ou apagado.

## Backup mensal (automático)

O plano gratuito do Supabase **não tem backup automático**, então o workflow **Backup mensal para o Google Drive** (`.github/workflows/backup-mensal.yml`) copia os dados para o Drive do setor **todo dia 1º do mês**.

- **Como conferir:** aba **Actions → Backup mensal para o Google Drive**. A última execução deve estar em verde, e a pasta do Drive deve ter o arquivo do mês.
- **Rodar na hora:** abra o workflow, clique em **Run workflow** e escolha a branch `main`.
- **Se falhar:** abra a execução com o ícone vermelho e leia o erro. As causas mais comuns são credencial do Google expirada ou removida, pasta do Drive sem permissão ou secret do Supabase trocado. Atualize em **Settings → Secrets and variables → Actions** e rode de novo.
- **Verificação periódica:** uma vez por trimestre, abra um arquivo do backup e confira se os dados estão completos.
- **Nunca envie o backup por e-mail:** ele tem nomes e NIFs (LGPD). Compartilhe a pasta do Drive só com os donos do sistema.

## Acessos e continuidade

- E-mails e senhas ficam **só no gerenciador de senhas do setor**, nunca neste repositório.
- Supabase, GitHub e hospedagem usam a conta do setor, com **pelo menos 2 donos** em cada uma.
- Há um plano pago do Supabase que elimina a pausa e inclui backup diário (confira o valor atual no site deles).
- Dependências sensíveis: `@lovable.dev/vite-tanstack-config` e `nitro` (versão beta). Não atualize sem testar.

## Testes e qualidade

```sh
npm test            # telas e lógica (não precisa de banco)
npm run test:db     # banco: roda as migrations num Postgres local e testa funções, RLS e Storage
npx tsc --noEmit    # tipos
npm run build       # build de produção
```

`npm run test:db` precisa de um Postgres 15+ (padrão `postgres://postgres:postgres@localhost:5432/postgres`, ou defina `TEST_DATABASE_URL`).
Com Docker: `docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`. Cada arquivo de teste cria e apaga o próprio banco.

## Estrutura

```
src/routes/        páginas (Home, Cardápio, Lista, painel em admin.*)
src/components/    componentes (admin/ = painel; ui/ = shadcn)
src/hooks/         acesso aos dados (React Query + Supabase)
src/lib/           regras puras: prazo, planilhas, PDFs, mensagens de erro
supabase/          migrations, seed e testes do banco
docs/              guia do Supabase, plano das etapas e checklist de testes
.github/workflows/ publicação, despertador do banco e backup mensal
```

## Documentação

- [`docs/configurar-supabase.md`](docs/configurar-supabase.md): configuração do projeto, código da cozinha e login do admin
- [`docs/checklist-teste-supabase.md`](docs/checklist-teste-supabase.md): o que conferir no Supabase real
- [`docs/plano-etapas.md`](docs/plano-etapas.md): etapas do projeto
