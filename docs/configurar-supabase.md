# Configurar o Supabase (passo a passo)

O app guarda pessoas, cardápio e marcações num banco do [Supabase](https://supabase.com).
Você só precisa fazer isso uma vez. (Os nomes dos menus do painel podem mudar um pouco com o tempo.)

## 1. Criar o projeto

1. Crie uma conta em supabase.com e clique em **New project**.
2. Escolha um nome, defina uma **senha do banco** (guarde-a) e a região **South America (São Paulo)**.
3. Espere o projeto terminar de ser criado (1–2 minutos).

## 2. Criar as tabelas e os dados de teste

1. No menu lateral, abra **SQL Editor** e clique em **New query**.
2. Abra os arquivos abaixo **nesta ordem**, copie o conteúdo, cole no editor e clique em **Run**:
   1. `supabase/migrations/20261021000001_schema.sql`
   2. `supabase/migrations/20261021000002_regras_de_prazo.sql`
   3. `supabase/migrations/20261021000003_seguranca_rls.sql`
   4. `supabase/seed.sql` (30 pessoas **fictícias** e 4 semanas de cardápio; pode rodar de novo sem duplicar)

Cada arquivo deve terminar com "Success". Se algum der erro, não pule para o próximo: leia a mensagem e corrija antes.

## 3. Pegar a URL e a chave pública

1. Abra **Project Settings → API** (ou **API Keys**).
2. Copie a **Project URL** (algo como `https://abcdefgh.supabase.co`).
3. Copie a chave pública: **anon** (ou **publishable**).

> Use **somente** a chave pública. A chave `service_role` dá acesso total ao banco e **nunca** deve ir para o app nem para o GitHub.

## 4. Preencher o `.env`

1. Na pasta do projeto, copie `.env.example` para `.env`.
2. Preencha:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
```

3. Rode `npm install` e depois `npm run dev`. O arquivo `.env` já está no `.gitignore` e não vai para o GitHub.

## 5. Preparar o login do administrador (para a Etapa 2)

1. Em **Authentication → Sign In / Providers** (ou **Settings**), **desligue o cadastro público de novos usuários**.
   Assim ninguém consegue criar conta sozinho.
2. Em **Authentication → Users**, clique em **Add user** e crie o seu usuário (e-mail e senha).
3. No **SQL Editor**, torne esse usuário administrador (troque o e-mail):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com';
```

## Como as regras funcionam

- **Público (sem login):** lê pessoas ativas, grupos, cardápio, configurações e marcações, e grava marcações **apenas** em dias úteis liberados e dentro do prazo.
- **Prazo:** `configuracoes.prazo_limite` é o horário limite **no próprio dia do almoço**, no fuso de São Paulo (padrão 09:00). Dias em `dias_bloqueados` não aceitam marcação.
- **Admin:** quem está na tabela `admins` e logado pode editar todo o resto.
- As regras vivem **no banco** (função, gatilho e RLS), então valem mesmo se alguém tentar burlar o app.

Para mudar o prazo ou bloquear um dia antes de existir o painel admin, use o SQL Editor:

```sql
update public.configuracoes set prazo_limite = '10:30';
update public.configuracoes set dias_bloqueados = array['2026-11-02', '2026-11-15']::date[];
```

## Tempo real

A Lista de Almoço se atualiza sozinha quando alguém marca ou desmarca. A migration 3 já inclui a tabela
`marcacoes` na publicação `supabase_realtime`. Se não atualizar sozinha, confira em **Database → Publications**.

## Regerar os tipos do TypeScript (opcional)

`src/integrations/supabase/types.ts` foi escrito à mão. Depois de mudar o banco, você pode regerá-lo:

```
npx supabase gen types typescript --project-id SEU_ID > src/integrations/supabase/types.ts
```
