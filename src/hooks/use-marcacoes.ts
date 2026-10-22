import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { diasDaSemana, isoData } from "@/lib/almoco-data";

/** Marcações de UMA pessoa na semana: [seg..sex] com true/false (ou `null` se nunca marcou). */
export function useMarcacoesDaPessoa(pessoaId: string | undefined, seg: Date) {
  const inicio = isoData(seg);
  const dias = diasDaSemana(seg).map(isoData);
  return useQuery({
    queryKey: ["marcacoes", "pessoa", pessoaId, inicio],
    enabled: Boolean(pessoaId),
    queryFn: async (): Promise<(boolean | null)[]> => {
      const { data, error } = await getSupabase().rpc("marcacoes_da_pessoa", { p_pessoa_id: pessoaId!, p_inicio: inicio });
      if (error) throw error;
      const porDia = new Map(data.map((m) => [m.data, m.vai_almocar]));
      return dias.map((d) => porDia.get(d) ?? null);
    },
  });
}

export interface MarcacaoParaSalvar {
  data: string;
  vai: boolean;
}

/** Grava as marcações de uma pessoa. O banco valida prazo e dias bloqueados (tudo ou nada). */
export function useSalvarMarcacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pessoaId, itens }: { pessoaId: string; itens: MarcacaoParaSalvar[] }) => {
      if (itens.length === 0) return;
      const { error } = await getSupabase().rpc("salvar_marcacoes", {
        p_pessoa_id: pessoaId,
        p_marcas: itens.map((i) => ({ data: i.data, vai: i.vai })),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["marcacoes"] });
      void qc.invalidateQueries({ queryKey: ["totais"] });
      void qc.invalidateQueries({ queryKey: ["lista-cozinha"] });
    },
  });
}
