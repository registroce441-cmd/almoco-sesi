import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, supabaseConfigurado } from "@/integrations/supabase/client";
import { diasDaSemana, isoData } from "@/lib/almoco-data";
import { chaveMarcacao } from "@/lib/lista-data";

/** Marcações de UMA pessoa na semana: [seg..sex] com true/false (ou `null` se nunca marcou). */
export function useMarcacoesDaPessoa(pessoaId: string | undefined, seg: Date) {
  const dias = diasDaSemana(seg).map(isoData);
  return useQuery({
    queryKey: ["marcacoes", "pessoa", pessoaId, dias[0]],
    enabled: Boolean(pessoaId),
    queryFn: async (): Promise<(boolean | null)[]> => {
      const { data, error } = await getSupabase()
        .from("marcacoes")
        .select("data, vai_almocar")
        .eq("pessoa_id", pessoaId!)
        .gte("data", dias[0]!)
        .lte("data", dias[4]!);
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

/** Grava (cria ou atualiza) as marcações de uma pessoa. O banco valida prazo e dias bloqueados. */
export function useSalvarMarcacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pessoaId, itens }: { pessoaId: string; itens: MarcacaoParaSalvar[] }) => {
      if (itens.length === 0) return;
      const { error } = await getSupabase()
        .from("marcacoes")
        .upsert(
          itens.map((i) => ({ pessoa_id: pessoaId, data: i.data, vai_almocar: i.vai })),
          { onConflict: "pessoa_id,data" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marcacoes"] }),
  });
}

/**
 * Todas as marcações da semana (para a Lista da cozinha), atualizadas em TEMPO REAL:
 * quando alguém marca ou desmarca, a lista se atualiza sozinha.
 */
export function useMarcacoesDaSemana(seg: Date) {
  const qc = useQueryClient();
  const dias = diasDaSemana(seg).map(isoData);
  const inicio = dias[0]!;
  const fim = dias[4]!;
  const queryKey = ["marcacoes", "semana", inicio];
  const [aoVivo, setAoVivo] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("marcacoes")
        .select("pessoa_id, data, vai_almocar")
        .gte("data", inicio)
        .lte("data", fim)
        .range(0, 4999);
      if (error) throw error;
      return new Map(data.map((m) => [chaveMarcacao(m.pessoa_id, m.data), m.vai_almocar]));
    },
  });

  useEffect(() => {
    if (!supabaseConfigurado) return;
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canal = supabase
      .channel(`marcacoes-${inicio}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "marcacoes" }, () => {
        clearTimeout(timer); // agrupa vários eventos seguidos em uma única atualização
        timer = setTimeout(() => qc.invalidateQueries({ queryKey: ["marcacoes", "semana", inicio] }), 250);
      })
      .subscribe((status) => setAoVivo(status === "SUBSCRIBED"));
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(canal);
    };
  }, [inicio, qc]);

  return { ...query, aoVivo };
}
