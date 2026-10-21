import type { Pessoa } from "./almoco-data";

export type Status = "vai" | "nao" | "sem";
export interface Linha extends Pessoa {
  status: Status;
}

/** Chave de uma marcação no mapa devolvido pelo banco: "pessoaId|AAAA-MM-DD" → vai almoçar? */
export const chaveMarcacao = (pessoaId: string, data: string) => `${pessoaId}|${data}`;

/** Lista de almoço de um dia: só o que está no banco. Sem registro = "sem marcação". */
export function listaDoDia(pessoas: Pessoa[], marcas: Map<string, boolean>, data: string): Linha[] {
  return pessoas
    .map((p) => {
      const vai = marcas.get(chaveMarcacao(p.id, data));
      const status: Status = vai === undefined ? "sem" : vai ? "vai" : "nao";
      return { ...p, status };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function totais(l: Linha[]) {
  const vai = l.filter((x) => x.status === "vai");
  return {
    total: vai.length,
    funcionarios: vai.filter((x) => x.grupo === "Colaboradores").length,
    alunos: vai.filter((x) => x.grupo === "Robótica").length,
    sem: l.filter((x) => x.status === "sem").length,
  };
}
