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
cp .env.example .env     # e preencha com os dados do seu projeto Supabase
npm run dev              # abre em http://localhost:8080
```

Painel do administrador: `http://localhost:8080/admin/login` (o endereço não aparece em nenhuma tela pública).

## Configurar o Supabase

Resumo (o passo a passo ilustrado está em [`docs/configurar-supabase.md`](docs/configurar-supabase.md)):

1. Crie um projeto em supabase.com (região São Paulo).
2. No **SQL Editor**, rode **em ordem** os arquivos de `supabase/migrations/` (6 arquivos) e, para dados de demonstração, `supabase/seed.sql`
   (30 colaboradores fictícios e 4 semanas de cardápio).
3. Copie a **Project URL** e a chave **anon/publishable** para o `.env`
   (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`). **Nunca** use a chave `service_role` no app.
4. Em **Authentication**, desligue o cadastro público, crie o usuário administrador e inclua-o em `public.admins`
   (o comando está no guia).
5. Entre em `/admin/login` e, em **Configurações**, defina o **código da cozinha**.

Depois de configurar, siga [`docs/checklist-teste-supabase.md`](docs/checklist-teste-supabase.md) para conferir RLS, login, fotos e importação.

## Testes e qualidade

```sh
npm test            # telas e lógica (não precisa de banco)
npm run test:db     # banco: roda as migrations num Postgres local e testa funções, RLS e Storage
npx tsc --noEmit    # tipos
npm run build       # build de produção
```

`npm run test:db` precisa de um Postgres 15+ (padrão `postgres://postgres:postgres@localhost:5432/postgres`, ou defina
`TEST_DATABASE_URL`). Com Docker: `docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`.
Cada arquivo de teste cria e apaga o próprio banco.

## Estrutura

```
src/routes/        páginas (Home, Cardápio, Lista, painel em admin.*)
src/components/    componentes (admin/ = painel; ui/ = shadcn)
src/hooks/         acesso aos dados (React Query + Supabase)
src/lib/           regras puras: prazo, planilhas, PDFs, mensagens de erro
supabase/          migrations, seed e testes do banco
docs/              guia do Supabase, plano das etapas e checklist de testes
```

## Documentação

- [`docs/configurar-supabase.md`](docs/configurar-supabase.md): configuração do projeto, código da cozinha e login do admin
- [`docs/checklist-teste-supabase.md`](docs/checklist-teste-supabase.md): o que conferir no Supabase real
- [`docs/plano-etapas.md`](docs/plano-etapas.md): etapas do projeto
