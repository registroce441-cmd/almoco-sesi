import { describe, it, expect } from "vitest";
import { segundaDaSemana, buscarPessoas, isoData, agoraSP, motivoFechado, type Pessoa } from "@/lib/almoco-data";
import { chaveMarcacao, listaDoDia, totais } from "@/lib/lista-data";

const PESSOAS: Pessoa[] = [
  { id: "1", nome: "Fábio Martins", nif: "1040210", grupo: "Colaboradores" },
  { id: "2", nome: "Ana Paula Souza", nif: null, grupo: "Colaboradores" },
  { id: "3", nome: "Arthur Moreira", nif: "2085300", grupo: "Robótica" },
];

describe("almoco data", () => {
  it("wednesday maps to monday of same week", () => {
    expect(segundaDaSemana(new Date(2026, 9, 21)).getDate()).toBe(19);
  });
  it("saturday maps to next monday", () => {
    expect(segundaDaSemana(new Date(2026, 9, 24)).getDate()).toBe(26);
  });
  it("search ignores accents", () => {
    expect(buscarPessoas(PESSOAS, "fabio")[0]?.nome).toBe("Fábio Martins");
  });
  it("search by NIF works and tolerates people without NIF", () => {
    expect(buscarPessoas(PESSOAS, "2085")[0]?.nome).toBe("Arthur Moreira");
    expect(buscarPessoas(PESSOAS, "ana")[0]?.nome).toBe("Ana Paula Souza");
  });
  it("formats local dates as YYYY-MM-DD", () => {
    expect(isoData(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("prazo (America/Sao_Paulo)", () => {
  // 12:00 UTC = 09:00 em São Paulo
  const agora = new Date("2026-10-21T12:00:00Z");
  const regras = { prazo_limite: "09:00:00", dias_bloqueados: ["2026-10-23"] };

  it("converte para o fuso de São Paulo", () => {
    expect(agoraSP(agora)).toEqual({ data: "2026-10-21", hora: "09:00:00" });
    expect(agoraSP(new Date("2026-10-21T01:30:00Z")).data).toBe("2026-10-20"); // ainda é "ontem" em SP
  });
  it("dia passado está encerrado", () => {
    expect(motivoFechado("2026-10-20", regras, agora)).toBe("encerrado");
  });
  it("hoje: aberto até o prazo, encerrado depois", () => {
    expect(motivoFechado("2026-10-21", regras, agora)).toBeNull();
    expect(motivoFechado("2026-10-21", regras, new Date("2026-10-21T12:00:01Z"))).toBe("encerrado");
  });
  it("dia futuro fica aberto, exceto se estiver bloqueado", () => {
    expect(motivoFechado("2026-10-22", regras, agora)).toBeNull();
    expect(motivoFechado("2026-10-23", regras, agora)).toBe("sem-almoco");
  });
  it("sem configurações carregadas, não bloqueia (o banco decide)", () => {
    expect(motivoFechado("2026-10-01", undefined, agora)).toBeNull();
  });
});

describe("lista de almoço", () => {
  const dia = "2026-10-21";
  const marcas = new Map([
    [chaveMarcacao("1", dia), true],
    [chaveMarcacao("3", dia), false],
  ]);
  const lista = listaDoDia(PESSOAS, marcas, dia);

  it("mostra só o que está no banco: sem registro = sem marcação", () => {
    expect(Object.fromEntries(lista.map((l) => [l.id, l.status]))).toEqual({ "1": "vai", "2": "sem", "3": "nao" });
  });
  it("ordena por nome", () => {
    expect(lista.map((l) => l.nome)).toEqual(["Ana Paula Souza", "Arthur Moreira", "Fábio Martins"]);
  });
  it("calcula os totais", () => {
    expect(totais(lista)).toEqual({ total: 1, funcionarios: 1, alunos: 0, sem: 1 });
  });
});
