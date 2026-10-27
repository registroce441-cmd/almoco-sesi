import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { diasDaSemana, isoData } from "@/lib/almoco-data";
import {
  BUCKET_FOTOS,
  caminhoDaFoto,
  diaEstaVazio,
  limparDia,
  type DiaCardapio,
} from "@/lib/admin-data";
import { reduzirImagem } from "@/lib/imagem";

/** Cardápio da semana que começa em `seg`, para edição: [seg..sex], `null` = dia sem cardápio. */
export function useCardapioAdmin(seg: Date) {
  const dias = diasDaSemana(seg).map(isoData);
  return useQuery({
    queryKey: ["admin", "cardapio", dias[0]],
    queryFn: async (): Promise<(DiaCardapio | null)[]> => {
      const { data, error } = await getSupabase()
        .from("cardapio")
        .select("data, prato, acompanhamento, sobremesa, tags, foto_url")
        .gte("data", dias[0]!)
        .lte("data", dias[4]!);
      if (error) throw error;
      const porDia = new Map(data.map((r) => [r.data, r]));
      return dias.map((d) => {
        const r = porDia.get(d);
        return r
          ? {
              prato: r.prato,
              acompanhamento: r.acompanhamento,
              sobremesa: r.sobremesa,
              tags: r.tags,
              foto_url: r.foto_url,
            }
          : null;
      });
    },
  });
}

/** Apaga fotos do Storage. É só limpeza: se falhar, não atrapalha ninguém. */
export async function removerFotos(urls: (string | null | undefined)[]) {
  const caminhos = urls.map(caminhoDaFoto).filter((c): c is string => Boolean(c));
  if (caminhos.length === 0) return;
  try {
    await getSupabase().storage.from(BUCKET_FOTOS).remove(caminhos);
  } catch {
    /* ignora */
  }
}

function useInvalidarCardapio() {
  const qc = useQueryClient();
  // Devolve uma promessa: a mutation só termina depois do cardápio do painel ser recarregado.
  return async () => {
    void qc.invalidateQueries({ queryKey: ["cardapio"] }); // a página pública
    await qc.invalidateQueries({ queryKey: ["admin", "cardapio"] });
  };
}

export interface AlteracaoDia {
  data: string;
  dia: DiaCardapio;
  /** Foto que estava salva antes (para apagar do Storage se foi trocada ou removida). */
  fotoAnterior: string | null;
}

/** Grava os dias alterados: dia preenchido vira upsert; dia esvaziado apaga o cardápio daquele dia. */
export function useSalvarCardapio() {
  const invalidar = useInvalidarCardapio();
  return useMutation({
    mutationFn: async (alteracoes: AlteracaoDia[]) => {
      const sb = getSupabase();
      const limpas = alteracoes.map((a) => ({ ...a, dia: limparDia(a.dia) }));
      const gravar = limpas.filter((a) => !diaEstaVazio(a.dia));
      const apagar = limpas.filter((a) => diaEstaVazio(a.dia)).map((a) => a.data);

      if (gravar.length > 0) {
        const { error } = await sb.from("cardapio").upsert(
          gravar.map((a) => ({ data: a.data, ...a.dia })),
          { onConflict: "data" },
        );
        if (error) throw error;
      }
      if (apagar.length > 0) {
        const { error } = await sb.from("cardapio").delete().in("data", apagar);
        if (error) throw error;
      }
      // Só depois de gravar com sucesso: apaga as fotos que deixaram de ser usadas.
      await removerFotos(
        limpas
          .filter((a) => a.fotoAnterior && a.fotoAnterior !== a.dia.foto_url)
          .map((a) => a.fotoAnterior),
      );
    },
    onSuccess: invalidar,
  });
}

const novoNome = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Reduz a foto no navegador e envia para o Storage. Devolve a URL pública. */
export function useEnviarFoto() {
  return useMutation({
    mutationFn: async ({ data, arquivo }: { data: string; arquivo: File }): Promise<string> => {
      const blob = await reduzirImagem(arquivo);
      const storage = getSupabase().storage.from(BUCKET_FOTOS);
      const caminho = `${data}/${novoNome()}.jpg`;
      const { error } = await storage.upload(caminho, blob, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      return storage.getPublicUrl(caminho).data.publicUrl;
    },
  });
}

export interface ResultadoDuplicacao {
  copiados: number;
  mantidos: number;
  origem_vazia: boolean;
}

export function useDuplicarCardapio() {
  const invalidar = useInvalidarCardapio();
  return useMutation({
    mutationFn: async ({
      origem,
      destino,
      substituir,
    }: {
      origem: string;
      destino: string;
      substituir: boolean;
    }) => {
      const { data, error } = await getSupabase().rpc("admin_duplicar_cardapio", {
        p_origem: origem,
        p_destino: destino,
        p_substituir: substituir,
      });
      if (error) throw error;
      return data as unknown as ResultadoDuplicacao;
    },
    onSuccess: invalidar,
  });
}
