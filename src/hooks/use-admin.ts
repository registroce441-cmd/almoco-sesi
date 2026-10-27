import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, supabaseConfigurado } from "@/integrations/supabase/client";
import { ErroAcesso } from "@/lib/erros";

export type SessaoAdmin =
  | { status: "anonimo" }
  | { status: "nao_admin"; email: string }
  | { status: "admin"; email: string };

export const CHAVE_SESSAO = ["admin", "sessao"] as const;

async function lerSessao(): Promise<SessaoAdmin> {
  const sb = getSupabase();
  const {
    data: { session },
    error,
  } = await sb.auth.getSession();
  if (error) throw error;
  if (!session) return { status: "anonimo" };
  const email = session.user.email ?? "";
  const { data: admin, error: erroAdmin } = await sb.rpc("is_admin");
  if (erroAdmin) {
    // Token vencido/revogado: trata como "não logado" em vez de mostrar um erro técnico.
    if (erroAdmin.code === "PGRST301" || erroAdmin.message.toLowerCase().includes("jwt")) {
      await sb.auth.signOut({ scope: "local" });
      return { status: "anonimo" };
    }
    throw erroAdmin;
  }
  return admin ? { status: "admin", email } : { status: "nao_admin", email };
}

/** Quem está logado e se é administrador (tabela admins). Atualiza sozinho quando o login muda. */
export function useAdminSessao() {
  const qc = useQueryClient();
  useEffect(() => {
    if (!supabaseConfigurado) return;
    const { data } = getSupabase().auth.onAuthStateChange((evento) => {
      if (evento === "INITIAL_SESSION") return;
      // Não chamar o Supabase aqui dentro (pode travar): deixa para o próximo ciclo.
      setTimeout(() => void qc.invalidateQueries({ queryKey: CHAVE_SESSAO }), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return useQuery({
    queryKey: CHAVE_SESSAO,
    queryFn: lerSessao,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useEntrarAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      senha,
    }: {
      email: string;
      senha: string;
    }): Promise<SessaoAdmin> => {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) throw error;
      const { data: admin, error: erroAdmin } = await sb.rpc("is_admin");
      if (erroAdmin) throw erroAdmin;
      if (!admin) {
        await sb.auth.signOut();
        throw new ErroAcesso();
      }
      return { status: "admin", email: data.user.email ?? email };
    },
    onSuccess: (sessao) => qc.setQueryData(CHAVE_SESSAO, sessao),
  });
}

export function useSairAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await getSupabase().auth.signOut();
    },
    // Mesmo se a rede falhar, esquecemos tudo deste lado (nada do painel fica em cache).
    // ORDEM IMPORTANTE: primeiro avisa quem está "ouvindo" a sessão (o guarda de rota) e só depois
    // apaga o resto. Usar qc.clear() aqui deixava o guarda preso à query antiga e a tela não saía do painel.
    onSettled: () => {
      qc.setQueryData(CHAVE_SESSAO, { status: "anonimo" } satisfies SessaoAdmin);
      qc.removeQueries({
        predicate: (q) => !(q.queryKey[0] === CHAVE_SESSAO[0] && q.queryKey[1] === CHAVE_SESSAO[1]),
      });
    },
  });
}
