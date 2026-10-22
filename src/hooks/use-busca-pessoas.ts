import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import type { Pessoa } from "@/lib/almoco-data";
import { useDebounced } from "./use-debounced";

/** Mínimo de letras (nome) para buscar. Para NIF são 3 dígitos — o banco valida. */
export const BUSCA_MINIMA = 2;

/**
 * Autocomplete da Home: busca no banco por nome (sem acento) ou NIF.
 * O público não lê a tabela de pessoas; o banco devolve no máximo 8 resultados, com o NIF mascarado.
 */
export function useBuscaPessoas(termo: string) {
  const digitado = termo.trim();
  const termoBusca = useDebounced(digitado);
  const query = useQuery({
    queryKey: ["busca-pessoas", termoBusca],
    enabled: termoBusca.length >= BUSCA_MINIMA,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<Pessoa[]> => {
      const { data, error } = await getSupabase().rpc("buscar_pessoas", { p_termo: termoBusca });
      if (error) throw error;
      return data.map((p) => ({ id: p.id, nome: p.nome, nifMascarado: p.nif_mascarado, homonimo: p.homonimo }));
    },
  });
  return {
    ...query,
    /** Ainda esperando o usuário parar de digitar ou a resposta chegar. */
    buscando: digitado.length >= BUSCA_MINIMA && (digitado !== termoBusca || query.isFetching),
    curto: digitado.length < BUSCA_MINIMA,
  };
}
