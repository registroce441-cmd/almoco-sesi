import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";

export interface ConfiguracoesParaSalvar {
  prazo_limite: string;
  dias_bloqueados: string[];
  aviso_home: string | null;
  nome_unidade: string;
}

export function useSalvarConfiguracoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: ConfiguracoesParaSalvar) => {
      const { data, error } = await getSupabase()
        .from("configuracoes")
        .update(cfg)
        .eq("id", 1)
        .select("id");
      if (error) throw error;
      // Sem permissão, a RLS não dá erro: simplesmente não altera nenhuma linha.
      if (data.length === 0) throw Object.assign(new Error("sem permissão"), { code: "42501" });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["configuracoes"] });
    },
  });
}

export interface StatusCodigo {
  configurado: boolean;
  atualizado_em: string | null;
}

/** Existe código da cozinha? Quando foi trocado? (Nunca devolve o código nem o hash.) */
export function useStatusCodigo() {
  return useQuery({
    queryKey: ["admin", "status-codigo"],
    queryFn: async (): Promise<StatusCodigo> => {
      const { data, error } = await getSupabase().rpc("admin_status_codigo_cozinha");
      if (error) throw error;
      return data as unknown as StatusCodigo;
    },
  });
}

export function useDefinirCodigo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (codigo: string) => {
      const { error } = await getSupabase().rpc("definir_codigo_cozinha", { p_codigo: codigo });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "status-codigo"] });
    },
  });
}
