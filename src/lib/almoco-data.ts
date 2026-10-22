/** Pessoa devolvida pela busca. O NIF nunca vem inteiro: só os 3 últimos dígitos ("***482"). */
export interface Pessoa {
  id: string;
  nome: string;
  nifMascarado: string;
  /** Existe outra pessoa com o mesmo nome: mostramos o NIF mascarado para diferenciar. */
  homonimo: boolean;
}

/** Monday of the current week; on Sat/Sun returns next week's Monday. */
export function segundaDaSemana(hoje = new Date()): Date {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dow = d.getDay();
  const diff = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

export function diasDaSemana(seg: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(seg);
    d.setDate(seg.getDate() + i);
    return d;
  });
}

/** Data local no formato AAAA-MM-DD (o formato das colunas `date` do banco). */
export function isoData(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const FUSO = "America/Sao_Paulo";

/** Data e hora de agora no fuso de São Paulo (o mesmo usado pelo banco para o prazo). */
export function agoraSP(agora = new Date()): { data: string; hora: string } {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSO,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(agora)
      .map((p) => [p.type, p.value]),
  );
  return {
    data: `${partes["year"]}-${partes["month"]}-${partes["day"]}`,
    hora: `${partes["hour"]}:${partes["minute"]}:${partes["second"]}`,
  };
}

export interface RegrasDePrazo {
  prazo_limite: string;
  dias_bloqueados: string[];
}

/**
 * Por que o dia não aceita marcação do público (ou `null` se aceita).
 * É só para a interface desabilitar o dia: quem decide de verdade é o banco.
 */
export function motivoFechado(
  dataISO: string,
  regras: RegrasDePrazo | undefined,
  agora = new Date(),
): "sem-almoco" | "encerrado" | null {
  if (!regras) return null;
  if (regras.dias_bloqueados.includes(dataISO)) return "sem-almoco";
  const { data: hoje, hora } = agoraSP(agora);
  if (dataISO < hoje) return "encerrado";
  if (dataISO === hoje && hora > regras.prazo_limite) return "encerrado";
  return null;
}
