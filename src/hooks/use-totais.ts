import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { isoData } from "@/lib/almoco-data";
import type { DiaTotal } from "@/lib/lista-data";

/** Total de refeições por dia (seg–sex). É a única informação pública: nunca traz nomes. Atualiza a cada 15 s. */
export function useTotaisDaSemana(seg: Date) {
  const inicio = isoData(seg);
  return useQuery({
    queryKey: ["totais", inicio],
    refetchInterval: 15_000,
    queryFn: async (): Promise<DiaTotal[]> => {
      const { data, error } = await getSupabase().rpc("totais_por_dia", { p_inicio: inicio });
      if (error) throw error;
      return data.map((d) => ({ data: d.data, total: d.total }));
    },
  });
}
