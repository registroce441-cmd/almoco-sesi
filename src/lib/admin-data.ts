import type { PessoaDaLista } from "./lista-data";

// ---------------------------------------------------------------------------
// Cardápio (editor semanal)
// ---------------------------------------------------------------------------

export const TAGS_PADRAO = ["Vegetariano", "Sem glúten", "Sem lactose", "Leve"] as const;
export const TAG_MAXIMO = 24;
export const TAGS_POR_DIA = 6;

export interface DiaCardapio {
  prato: string;
  acompanhamento: string;
  sobremesa: string;
  tags: string[];
  foto_url: string | null;
}

export const DIA_VAZIO: DiaCardapio = {
  prato: "",
  acompanhamento: "",
  sobremesa: "",
  tags: [],
  foto_url: null,
};

const aparar = (t: string) => t.replace(/\s+/g, " ").trim();

/** Versão limpa do dia (espaços repetidos, tags sem repetição), pronta para comparar e gravar. */
export function limparDia(d: DiaCardapio): DiaCardapio {
  const vistas = new Set<string>();
  const tags = d.tags.map(aparar).filter((t) => {
    const k = t.toLowerCase();
    if (!t || vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  return {
    prato: aparar(d.prato),
    acompanhamento: aparar(d.acompanhamento),
    sobremesa: aparar(d.sobremesa),
    tags,
    foto_url: d.foto_url,
  };
}

export const diaEstaVazio = (d: DiaCardapio) => {
  const l = limparDia(d);
  return !l.prato && !l.acompanhamento && !l.sobremesa && l.tags.length === 0 && !l.foto_url;
};

export const diasIguais = (a: DiaCardapio, b: DiaCardapio) =>
  JSON.stringify(limparDia(a)) === JSON.stringify(limparDia(b));

/** Mensagem de problema (ou `null`). Dia totalmente vazio é válido: significa "sem cardápio". */
export function problemaDoDia(d: DiaCardapio): string | null {
  const l = limparDia(d);
  if (diaEstaVazio(l)) return null;
  if (!l.prato) return "Informe o prato do dia.";
  if (l.prato.length > 120) return "O nome do prato está muito longo (máximo 120 letras).";
  return null;
}

/** Acrescenta uma tag respeitando limites e sem repetir (ignora maiúsculas). */
export function adicionarTag(tags: string[], nova: string): string[] {
  const t = aparar(nova).slice(0, TAG_MAXIMO);
  if (!t || tags.length >= TAGS_POR_DIA) return tags;
  if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return tags;
  return [...tags, t];
}

export const BUCKET_FOTOS = "cardapio-fotos";

/** Caminho do arquivo dentro do bucket, a partir da URL pública (ou `null` se não for do nosso bucket). */
export function caminhoDaFoto(url: string | null | undefined): string | null {
  if (!url) return null;
  const marca = `/storage/v1/object/public/${BUCKET_FOTOS}/`;
  const i = url.indexOf(marca);
  if (i < 0) return null;
  const caminho = decodeURIComponent(url.slice(i + marca.length).split("?")[0] ?? "");
  return caminho || null;
}

// ---------------------------------------------------------------------------
// Marcações manuais
// ---------------------------------------------------------------------------

export type Estado = "vai" | "nao" | "sem";
export const estadoDe = (v: boolean | undefined): Estado =>
  v === undefined ? "sem" : v ? "vai" : "nao";
export const valorDe = (e: Estado): boolean | null => (e === "sem" ? null : e === "vai");

/** Só os dias que mudaram, no formato que a função admin_salvar_marcacoes espera. */
export function marcasAlteradas(
  base: Record<string, boolean>,
  novo: Record<string, Estado>,
): { data: string; vai: boolean | null }[] {
  return Object.entries(novo)
    .filter(([data, e]) => e !== estadoDe(base[data]))
    .map(([data, e]) => ({ data, vai: valorDe(e) }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface EstatisticasSemana {
  /** Refeições (vai almoçar) em cada dia, na ordem de `dias`. */
  porDia: number[];
  totalSemana: number;
  ativas: number;
  /** Pessoas que marcaram pelo menos um dia (vai ou não vai). */
  responderam: number;
  /** % de pessoas ativas que já responderam (0–100, inteiro). */
  adesao: number;
  /** Quem ainda não marcou nenhum dia da semana, em ordem alfabética. */
  pendentes: PessoaDaLista[];
}

export function estatisticasSemana(pessoas: PessoaDaLista[], dias: string[]): EstatisticasSemana {
  const porDia = dias.map((d) => pessoas.filter((p) => p.marcas[d] === true).length);
  const pendentes = pessoas
    .filter((p) => !dias.some((d) => p.marcas[d] !== undefined))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const responderam = pessoas.length - pendentes.length;
  return {
    porDia,
    totalSemana: porDia.reduce((s, n) => s + n, 0),
    ativas: pessoas.length,
    responderam,
    adesao: pessoas.length ? Math.round((responderam / pessoas.length) * 100) : 0,
    pendentes,
  };
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

/** "09:00:00" -> "09:00" (o campo de hora do navegador não usa segundos). */
export const horaCurta = (t: string) => t.slice(0, 5);

/** Dia útil (segunda a sexta) de uma data AAAA-MM-DD. */
export function ehDiaUtil(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const dow = new Date(y, m - 1, d).getDay();
  return dow >= 1 && dow <= 5;
}

export const AVISO_MAXIMO = 280;
export const UNIDADE_MAXIMO = 80;

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Todas as palavras digitadas precisam aparecer (sem ligar para acento ou maiúsculas), em qualquer ordem. */
export function combinaBusca(alvo: string, termo: string): boolean {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const texto = semAcento(alvo);
  return palavras.every((p) => texto.includes(p));
}
