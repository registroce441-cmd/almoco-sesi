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
  return "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";
}
