import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { diasDaSemana, isoData } from "@/lib/almoco-data";
import type { Refeicao } from "@/lib/cardapio-data";

/** Cardápio de segunda a sexta da semana que começa em `seg`. Dia sem cadastro = `null`. */
export function useCardapio(seg: Date) {
  const dias = diasDaSemana(seg).map(isoData);
  return useQuery({
    queryKey: ["cardapio", dias[0]],
    staleTime: 60_000,
    queryFn: async (): Promise<(Refeicao | null)[]> => {
      const { data, error } = await getSupabase()
        .from("cardapio")
        .select("data, prato, acompanhamento, sobremesa, tags, foto_url")
        .gte("data", dias[0]!)
        .lte("data", dias[4]!);
      if (error) throw error;
      const porDia = new Map(data.map((r) => [r.data, r]));
      return dias.map((d) => {
        const r = porDia.get(d);
        return r ? { prato: r.prato, acompanhamento: r.acompanhamento, sobremesa: r.sobremesa, tags: r.tags, foto: r.foto_url } : null;
      });
    },
  });
}
