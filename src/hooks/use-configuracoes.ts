import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";

/** Configurações da unidade (prazo, dias sem almoço, aviso da Home, nome). */
export function useConfiguracoes() {
  return useQuery({
    queryKey: ["configuracoes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("configuracoes").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
}
