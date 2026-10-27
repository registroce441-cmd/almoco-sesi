import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/integrations/supabase/client";
import { isoData } from "@/lib/almoco-data";
import type { DiaTotal, PessoaDaLista } from "@/lib/lista-data";

const CHAVE = "almoco:codigo-cozinha";

export type MotivoRecusa = "invalido" | "bloqueado" | "nao_configurado" | "codigo_necessario" | "periodo_invalido";
export const MENSAGEM_RECUSA: Record<MotivoRecusa, string> = {
  invalido: "Código incorreto. Confira e tente de novo.",
  bloqueado: "Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.",
  nao_configurado: "O acesso por código ainda não foi configurado. Fale com o administrador.",
  codigo_necessario: "Digite o código de acesso.",
  periodo_invalido: "Período inválido.",
};

type Resposta<T> = ({ ok: true } & T) | { ok: false; motivo: MotivoRecusa };

/** Código de acesso da cozinha: guardado só nesta aba do navegador (sessionStorage), nunca em disco. */
export function useCodigoCozinha() {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    try {
      setCodigo(sessionStorage.getItem(CHAVE));
    } catch {
      /* navegador sem sessionStorage: segue sem lembrar */
    }
    setPronto(true);
  }, []);
  const definir = (c: string) => {
    try {
      sessionStorage.setItem(CHAVE, c);
    } catch {
      /* ignora */
    }
    setCodigo(c);
  };
  const limpar = () => {
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      /* ignora */
    }
    setCodigo(null);
  };
  return { codigo, pronto, definir, limpar };
}

/** Quem vai (ou não) em cada dia. Só responde com admin logado ou código correto. */
export function useListaCozinha(seg: Date, codigo: string | null) {
  const inicio = isoData(seg);
  return useQuery({
    queryKey: ["lista-cozinha", inicio, codigo],
    enabled: Boolean(codigo),
    retry: false, // cada tentativa errada conta para o bloqueio: nunca repetir sozinho
    // Só atualiza sozinha enquanto o acesso está liberado (não insiste em código errado).
    refetchInterval: (q) => (q.state.data?.ok ? 15_000 : false),
    queryFn: async (): Promise<Resposta<{ pessoas: PessoaDaLista[] }>> => {
      const { data, error } = await getSupabase().rpc("lista_cozinha", { p_inicio: inicio, p_codigo: codigo! });
      if (error) throw error;
      return data as unknown as Resposta<{ pessoas: PessoaDaLista[] }>;
    },
  });
}

/** Total de refeições de cada dia útil do período (relatório de gastos). */
export function useRelatorio(inicio: string, fim: string, codigo: string | null, ativo: boolean, comoAdmin = false) {
  return useQuery({
    queryKey: ["relatorio", inicio, fim, comoAdmin ? "admin" : codigo],
    enabled: ativo && (comoAdmin || Boolean(codigo)) && Boolean(inicio) && Boolean(fim) && fim >= inicio,
    retry: false,
    staleTime: 30_000,
    queryFn: async (): Promise<Resposta<{ dias: DiaTotal[] }>> => {
      // O admin logado não precisa de código: o banco o reconhece pelo login.
      const { data, error } = await getSupabase().rpc("relatorio_totais", {
        p_inicio: inicio,
        p_fim: fim,
        ...(codigo ? { p_codigo: codigo } : {}),
      });
      if (error) throw error;
      return data as unknown as Resposta<{ dias: DiaTotal[] }>;
    },
  });
}
