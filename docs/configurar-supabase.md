# Configurar o Supabase (passo a passo)

O app guarda os colaboradores, o cardápio e as marcações num banco do [Supabase](https://supabase.com).
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
   4. `supabase/migrations/20261022000001_escopo_colaboradores.sql`
   5. `supabase/migrations/20261022000002_privacidade.sql`
   6. `supabase/migrations/20261025000001_painel_admin.sql` (painel do administrador: marcações manuais, importação, fotos do cardápio)
   7. `supabase/seed.sql` (30 colaboradores **fictícios** e 4 semanas de cardápio; pode rodar de novo sem duplicar)

Cada arquivo deve terminar com "Success". Se algum der erro, não pule para o próximo: leia a mensagem e corrija antes.

> **Já tinha rodado as migrations 1 a 5?** Rode só a **6** (e pode rodá-la de novo sem problema).
>
> **Já tinha rodado as migrations 1 a 3 (e o seed antigo, com alunos)?** Rode a **4**, a **5** e a **6**.
> A 4 apaga o grupo "Robótica", os alunos e as marcações deles, e torna o NIF obrigatório. Se ainda houver
> algum colaborador sem NIF, ela **para antes de apagar qualquer coisa** e diz quantos faltam: preencha e rode de novo.
> Depois pode rodar o `seed.sql` novo para incluir os colaboradores de teste.

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

## 5. Definir o código de acesso da cozinha

Os **nomes** de quem vai almoçar só aparecem para a cozinha e a administração. A cozinha entra com um código.
No **SQL Editor**, escolha o seu (mínimo de 6 caracteres) e rode:

```sql
select public.definir_codigo_cozinha('troque-por-um-codigo-seu');
```

- Para trocar o código, rode o comando de novo com outro valor (o código antigo deixa de valer na hora).
- Para desligar o acesso por código: `select public.remover_codigo_cozinha();`
- O código fica guardado só como *hash* (ninguém consegue ler o original, nem pelo painel).
- **Proteção contra chute:** depois de 10 códigos errados em 5 minutos, o acesso por código fica bloqueado por alguns
  minutos. O administrador logado nunca é bloqueado.
- Também dá para definir/trocar o código **pelo painel** (Administração → Configurações → Código de acesso da cozinha).

## 6. Preparar o login do administrador

1. Em **Authentication → Sign In / Providers** (ou **Settings**), **desligue o cadastro público de novos usuários**.
2. Em **Authentication → Users**, clique em **Add user** e crie o seu usuário (e-mail e senha).
3. No **SQL Editor**, torne esse usuário administrador (troque o e-mail):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com';
```

4. Abra `/admin/login` no app (por exemplo `http://localhost:8080/admin/login`) e entre com esse e-mail e senha.
   O endereço do painel não aparece em nenhuma tela pública: guarde o link.

> Ao criar o usuário em **Add user**, marque **Auto Confirm User**; senão o login pede confirmação por e-mail.

Para testar tudo no Supabase de verdade, siga o `docs/checklist-teste-supabase.md`.

## Como a privacidade funciona

| Quem | O que vê |
|---|---|
| **Qualquer pessoa** (sem login) | Cardápio; **total de refeições por dia** e da semana; busca de colaboradores (só o nome; o NIF nunca sai inteiro, só `***482` para diferenciar homônimos); marcar ou desmarcar os próprios dias |
| **Cozinha** (código) | Tudo isso + **quem vai em cada dia** (nome e NIF) + relatório de refeições por dia, semana e período |
| **Admin** (login) | Tudo, e edita pessoas, cardápio e configurações |

- O público **não consegue ler** as tabelas de pessoas nem de marcações: ele só chama funções do banco que devolvem o mínimo necessário.
- **Prazo:** `configuracoes.prazo_limite` é o horário limite **no próprio dia do almoço**, fuso de São Paulo (padrão 09:00).
  Dias em `dias_bloqueados` não aceitam marcação. Tudo é validado **no banco**, então vale mesmo se alguém tentar burlar o app.
- **NIF:** obrigatório, único e sem espaços nas pontas.
- As telas se atualizam sozinhas a cada 15 segundos (a Lista e os totais).

Prazo e dias sem almoço agora se mudam pelo painel (**Configurações**). Se preferir o SQL Editor:

```sql
update public.configuracoes set prazo_limite = '10:30';
update public.configuracoes set dias_bloqueados = array['2026-11-02', '2026-11-15']::date[];
```

## Regerar os tipos do TypeScript (opcional)

`src/integrations/supabase/types.ts` foi escrito à mão. Depois de mudar o banco, você pode regerá-lo:

```
npx supabase gen types typescript --project-id SEU_ID > src/integrations/supabase/types.ts
```
