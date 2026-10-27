# Almoco Da Semana

Crie um web app responsivo (celular e PC) chamado "Almoço SESI", para confirmação de almoço de funcionários e alunos de extracurriculares. Mobile-first (360px), funcionando bem no Chrome Android e Safari iPhone, e expandindo para desktop.

Stack: React + TypeScript + Tailwind + shadcn/ui. Português do Brasil. Visual moderno e limpo, azul-escuro #0B2E6B como principal, vermelho #E30613 como destaque, modo claro/escuro, fonte Inter, placeholder no lugar do logo.

Tela inicial (sem login):

- Cabeçalho com a semana atual

- Busca por nome ou NIF com autocomplete

- Ao escolher a pessoa, 5 cards (Seg a Sex) com toggle grande "Vou almoçar / Não vou"

- Botões "Marcar semana toda" e "Limpar"

- Barra fixa inferior com "Confirmar marcação" e resumo ("4 de 5 dias")

- Tela de sucesso animada

Regras mobile: botões de no mínimo 48px, inputs com fonte 16px, 100dvh, safe-area, sem rolagem horizontal, barra inferior que não fique atrás do teclado.

Por enquanto use dados fictícios locais (~30 pessoas, 2 grupos: Colaboradores e Robótica). Ainda não conecte banco.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4717343f-9bb2-4fd1-b664-03de585abc09).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Testes

- `npm test`: testes das telas e da lógica (rápido, não precisa de banco).
- `npm run test:db`: testes do **banco** (funções, RLS e Storage) rodando as migrations num Postgres local.
  Precisa de um Postgres 15+ acessível (padrão `postgres://postgres:postgres@localhost:5432/postgres`, ou defina `TEST_DATABASE_URL`).
  Com Docker: `docker run -d -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`.
  Cada arquivo cria e apaga o próprio banco; nada do seu Postgres é alterado.
- O que ainda precisa ser conferido no Supabase de verdade está em `docs/checklist-teste-supabase.md`.
