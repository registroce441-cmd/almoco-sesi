export const ERRO_NAO_CONFIGURADO = "SUPABASE_NAO_CONFIGURADO";

/** Transforma qualquer erro técnico em uma frase amigável em português. */
export function mensagemDeErro(erro: unknown): string {
  const e = erro as { message?: string; code?: string } | null;
  if (e?.message === ERRO_NAO_CONFIGURADO) {
    return "O banco de dados ainda não foi configurado. Preencha o arquivo .env (veja docs/configurar-supabase.md).";
  }
  // P0001 = mensagens escritas por nós nas regras do banco (ex.: "O prazo para marcar esse dia já encerrou.")
  if (e?.code === "P0001" && e.message) return e.message;
  if (e?.code === "42501") return "Você não tem permissão para fazer isso.";
  if (e?.code === "23505") {
    return e.message?.includes("pessoas_nif_key")
      ? "Já existe uma pessoa com esse NIF."
      : "Já existe um cadastro com esses dados.";
  }
  if (e?.code === "23514") return "Algum dado informado é inválido. Confira os campos e tente de novo.";
  // Sessão do administrador vencida (o Supabase responde 401 / JWT expired)
  if (e?.code === "PGRST301" || e?.message?.toLowerCase().includes("jwt expired")) {
    return "Sua sessão expirou. Entre de novo.";
  }
  return "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";
}

/** Erro nosso (não do Supabase) durante o login: o usuário existe, mas não está na tabela admins. */
export class ErroAcesso extends Error {
  constructor() {
    super("NAO_ADMIN");
  }
}

/** Mensagens da tela de login. Nunca revela se o e-mail existe: errou e-mail ou senha, a frase é a mesma. */
export function mensagemDeLogin(erro: unknown): string {
  if (erro instanceof ErroAcesso) return "Este usuário não tem acesso ao painel.";
  const e = erro as { message?: string; code?: string; status?: number } | null;
  if (e?.code === "invalid_credentials" || e?.message === "Invalid login credentials") {
    return "E-mail ou senha incorretos.";
  }
  if (e?.status === 429 || e?.code === "over_request_rate_limit") {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  if (e?.code === "email_not_confirmed") {
    return "Esse e-mail ainda não foi confirmado. Confirme o usuário no painel do Supabase.";
  }
  return mensagemDeErro(erro);
}
