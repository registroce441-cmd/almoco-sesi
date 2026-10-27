import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { limparTexto, type LinhaPlanilha } from "@/lib/importacao";
import type { PessoaDaLista } from "@/lib/lista-data";
import { isoData } from "@/lib/almoco-data";

export interface PessoaAdmin {
  id: string;
  nome: string;
  nif: string;
  ativo: boolean;
}

const POR_PAGINA = 1000; // limite padrão do Supabase por consulta

/** Todas as pessoas (ativas e inativas), em páginas, para não esbarrar no limite de 1000 linhas. */
export function usePessoasAdmin() {
  return useQuery({
    queryKey: ["admin", "pessoas"],
    queryFn: async (): Promise<PessoaAdmin[]> => {
      const sb = getSupabase();
      const todas: PessoaAdmin[] = [];
      for (let de = 0; ; de += POR_PAGINA) {
        const { data, error } = await sb
          .from("pessoas")
          .select("id, nome, nif, ativo")
          .order("nome")
          .order("id")
          .range(de, de + POR_PAGINA - 1);
        if (error) throw error;
        todas.push(...data);
        if (data.length < POR_PAGINA) break;
      }
      return todas;
    },
  });
}

/** Quem vai em cada dia da semana (nomes e NIF): o admin logado não precisa do código da cozinha. */
export function useListaAdmin(seg: Date) {
  const inicio = isoData(seg);
  return useQuery({
    queryKey: ["admin", "lista", inicio],
    refetchInterval: 20_000,
    queryFn: async (): Promise<PessoaDaLista[]> => {
      const { data, error } = await getSupabase().rpc("lista_cozinha", { p_inicio: inicio });
      if (error) throw error;
      const r = data as unknown as { ok: boolean; pessoas?: PessoaDaLista[]; motivo?: string };
      if (!r.ok) throw Object.assign(new Error(r.motivo ?? "negado"), { code: "42501" });
      return r.pessoas ?? [];
    },
  });
}

function useInvalidarPessoas() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin", "pessoas"] });
    void qc.invalidateQueries({ queryKey: ["admin", "lista"] });
    void qc.invalidateQueries({ queryKey: ["busca-pessoas"] });
  };
}

export function useSalvarPessoa() {
  const invalidar = useInvalidarPessoas();
  return useMutation({
    mutationFn: async ({ id, nome, nif }: { id?: string; nome: string; nif: string }) => {
      const dados = { nome: limparTexto(nome), nif: limparTexto(nif) };
      const sb = getSupabase();
      const { error } = id
        ? await sb.from("pessoas").update(dados).eq("id", id)
        : await sb.from("pessoas").insert(dados);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });
}

export function useAlternarAtiva() {
  const invalidar = useInvalidarPessoas();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await getSupabase()
        .from("pessoas")
        .update({ ativo })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (data.length === 0) throw Object.assign(new Error("sem permissão"), { code: "42501" });
    },
    onSuccess: invalidar,
  });
}

export interface ResultadoImportacao {
  inseridas: number;
  vazias: number;
  rejeitadas: { linha: number; nome: string; nif: string; motivo: string }[];
}

/** Envia as linhas já validadas; o banco valida tudo de novo e devolve o que foi recusado. */
export function useImportarPessoas() {
  const invalidar = useInvalidarPessoas();
  return useMutation({
    mutationFn: async (linhas: LinhaPlanilha[]): Promise<ResultadoImportacao> => {
      const { data, error } = await getSupabase().rpc("admin_importar_pessoas", {
        p_linhas: linhas.map((l) => ({ linha: l.linha, nome: l.nome, nif: l.nif })),
      });
      if (error) throw error;
      return data as unknown as ResultadoImportacao;
    },
    onSuccess: invalidar,
  });
}
