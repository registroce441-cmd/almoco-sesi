import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";

/** Marca ou desmarca uma pessoa em vários dias (a qualquer hora), com motivo opcional que fica no histórico. */
export function useSalvarMarcacoesAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pessoaId,
      marcas,
      motivo,
    }: {
      pessoaId: string;
      marcas: { data: string; vai: boolean | null }[];
      motivo: string;
    }) => {
      const texto = motivo.trim();
      const { data, error } = await getSupabase().rpc("admin_salvar_marcacoes", {
        p_pessoa_id: pessoaId,
        p_marcas: marcas,
        ...(texto ? { p_motivo: texto } : {}),
      });
      if (error) throw error;
      return data as unknown as { ok: boolean; alteradas: number };
    },
    onSuccess: () => {
      for (const chave of [
        ["admin", "lista"],
        ["admin", "historico"],
        ["totais"],
        ["lista-cozinha"],
        ["marcacoes"],
        ["relatorio"],
      ]) {
        void qc.invalidateQueries({ queryKey: chave });
      }
    },
  });
}

export interface RegistroManual {
  id: string;
  data: string;
  anterior: boolean | null;
  novo: boolean | null;
  motivo: string | null;
  criado_em: string;
  nome: string;
}

/** Últimas marcações manuais (quem, quando, de/para e motivo). Só o admin consegue ler. */
export function useHistoricoManual() {
  return useQuery({
    queryKey: ["admin", "historico"],
    queryFn: async (): Promise<RegistroManual[]> => {
      const { data, error } = await getSupabase()
        .from("marcacoes_manuais")
        .select("id, data, anterior, novo, motivo, criado_em, pessoas(nome)")
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data.map((r) => ({
        id: r.id,
        data: r.data,
        anterior: r.anterior,
        novo: r.novo,
        motivo: r.motivo,
        criado_em: r.criado_em,
        nome: r.pessoas?.nome ?? "(pessoa removida)",
      }));
    },
  });
}
