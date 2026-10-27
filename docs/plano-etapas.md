# Plano das etapas (versão atual)

**Escopo:** o sistema é **somente para colaboradores do SESI**. Não há alunos, grupos nem extracurriculares.
Existe um único grupo interno, "Colaboradores" (não aparece em nenhuma tela).

## Etapa 1 — Banco e telas públicas ✅
Supabase (migrations, RLS e funções), Home, Cardápio e Lista de Almoço ligados ao banco; privacidade por funções;
código de acesso da cozinha; relatório Excel/PDF de refeições por dia, semana e período.

## Etapa 2 — Painel admin (mesmo design do app) ✅
Feita e testada contra Postgres local (74 testes de banco + 50 de tela). **Falta só conferir no Supabase real:** veja
`docs/checklist-teste-supabase.md`. O que foi decidido na execução:
- Marcações manuais gravam num **histórico só do admin** (`marcacoes_manuais`), com motivo opcional e sem edição/exclusão.
- Importação valida **no navegador e no banco** (mesmas regras); linhas repetidas na planilha: a primeira entra.
- Pessoas: **sem excluir** (desativar preserva o histórico dos relatórios).
- Duplicar semana **não copia a foto**. Fotos ficam no bucket público `cardapio-fotos` (só o admin escreve).
- O **aviso da Home** já é salvo nas Configurações, mas só **aparece na Home na Etapa 3** (junto do banner de prazo).
- O Cardápio público passou a mostrar a foto do prato (cartões sem foto não mudaram).
- Login por e-mail e senha (Supabase Auth), rota protegida `/admin`, botão sair.
- **Dashboard:** KPIs (refeições de hoje, previsão da semana, taxa de adesão, pessoas cadastradas);
  **gráfico de refeições por dia** e **total semanal** (Recharts, cores do tema); lista de quem ainda não marcou a semana.
- **Pessoas:** CRUD, ativar/desativar e **importação em massa Excel/CSV só com as colunas `nome` e `nif`**, com pré-visualização.
  Validações antes de gravar: linhas vazias, **NIF ausente**, **NIF duplicado** (dentro da planilha e contra o banco); só as
  linhas válidas são importadas.
- **Cardápio:** editor semanal por dia, "duplicar semana anterior", foto do prato (com câmera no celular).
- **Marcações:** marcar/desmarcar qualquer pessoa em qualquer dia, com motivo opcional. Após o prazo, só o admin edita.
- **Relatório:** o mesmo da Lista (por dia, semana e período; Excel e PDF), dentro do painel.
- **Configurações:** prazo limite, dias sem almoço, aviso na Home, nome da unidade e **código de acesso da cozinha**.
- Navegação: menu lateral no PC e barra inferior com abas no celular, no estilo da navegação existente.
- ~~Gestão de grupos~~ e ~~dashboard por grupo~~: **removidos do plano**.

## Etapa 3 — Acabamento e portfólio
- Modo demonstração (dados 100% fictícios, sem tocar nos dados reais).
- Log de auditoria simples (quem, o quê, quando) com aba para o admin.
- Exportar PDF da lista de almoço (nomes) e do cardápio, com a identidade visual do app.
  (O PDF do relatório de refeições já existe desde a Etapa 1.)
- PWA instalável (manifest, ícones, service worker básico, instruções para Android e iPhone).
- Banner de prazo na Home vindo das configurações.
- Revisão final em 360px, 390px e desktop.
- README profissional.
