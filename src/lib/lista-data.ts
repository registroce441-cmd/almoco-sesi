export type Status = "vai" | "nao" | "sem";

/** Pessoa como a cozinha a recebe: `marcas` = { "AAAA-MM-DD": vai almoçar? } (dia ausente = sem marcação). */
export interface PessoaDaLista {
  id: string;
  nome: string;
  nif: string;
  marcas: Record<string, boolean>;
}
export interface Linha {
  id: string;
  nome: string;
  nif: string;
  status: Status;
}

/** Lista de almoço de um dia, em ordem alfabética. Sem registro = "sem marcação". */
export function linhasDoDia(pessoas: PessoaDaLista[], data: string): Linha[] {
  return pessoas
    .map((p): Linha => {
      const vai = p.marcas[data];
      return { id: p.id, nome: p.nome, nif: p.nif, status: vai === undefined ? "sem" : vai ? "vai" : "nao" };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function contagem(l: Linha[]) {
  return {
    vai: l.filter((x) => x.status === "vai").length,
    nao: l.filter((x) => x.status === "nao").length,
    sem: l.filter((x) => x.status === "sem").length,
  };
}

// ---------------------------------------------------------------------------
// Relatório de refeições (controle de gastos)
// ---------------------------------------------------------------------------

export interface DiaTotal {
  data: string; // AAAA-MM-DD
  total: number;
}
export interface SemanaTotal {
  inicio: string; // segunda-feira
  fim: string; // sexta-feira
  total: number;
  dias: DiaTotal[];
}

/** "2026-10-21" -> Date local (sem pegadinhas de fuso). */
export function dataDeISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

const dois = (n: number) => String(n).padStart(2, "0");
export const paraISO = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const formatarData = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
export const formatarDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
export const NOME_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const nomeDoDia = (iso: string) => NOME_DIA[dataDeISO(iso).getDay()]!;

function segundaDe(iso: string): string {
  const d = dataDeISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return paraISO(d);
}

/** Soma os dias por semana (segunda a sexta). Semanas incompletas no começo/fim do período também entram. */
export function agruparPorSemana(dias: DiaTotal[]): SemanaTotal[] {
  const mapa = new Map<string, DiaTotal[]>();
  for (const d of dias) {
    const seg = segundaDe(d.data);
    mapa.set(seg, [...(mapa.get(seg) ?? []), d]);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicio, ds]) => {
      const fim = dataDeISO(inicio);
      fim.setDate(fim.getDate() + 4);
      return { inicio, fim: paraISO(fim), total: ds.reduce((s, x) => s + x.total, 0), dias: ds };
    });
}

export const totalDoPeriodo = (dias: DiaTotal[]) => dias.reduce((s, d) => s + d.total, 0);

export type Periodo = "semana" | "semana-passada" | "mes" | "mes-passado";
export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "semana", rotulo: "Esta semana" },
  { id: "semana-passada", rotulo: "Semana passada" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes-passado", rotulo: "Mês passado" },
];

export function periodoPronto(p: Periodo, hoje = new Date()): { inicio: string; fim: string } {
  const d0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (p === "semana" || p === "semana-passada") {
    const seg = new Date(d0);
    seg.setDate(d0.getDate() - ((d0.getDay() + 6) % 7) - (p === "semana-passada" ? 7 : 0));
    const dom = new Date(seg);
    dom.setDate(seg.getDate() + 6);
    return { inicio: paraISO(seg), fim: paraISO(dom) };
  }
  const mes = p === "mes" ? d0.getMonth() : d0.getMonth() - 1;
  return { inicio: paraISO(new Date(d0.getFullYear(), mes, 1)), fim: paraISO(new Date(d0.getFullYear(), mes + 1, 0)) };
}
