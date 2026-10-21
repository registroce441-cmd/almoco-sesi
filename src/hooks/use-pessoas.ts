import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import type { Pessoa } from "@/lib/almoco-data";

/** Pessoas ativas (o banco só entrega as ativas ao público). Ordenadas por nome. */
export function usePessoas() {
  return useQuery({
    queryKey: ["pessoas"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await getSupabase()
        .from("pessoas")
        .select("id, nome, nif, grupos(nome)")
        .order("nome")
        .range(0, 999); // limite padrão do Supabase por consulta
      if (error) throw error;
      return data.map((p) => ({ id: p.id, nome: p.nome, nif: p.nif, grupo: p.grupos?.nome ?? "" }));
    },
  });
}
