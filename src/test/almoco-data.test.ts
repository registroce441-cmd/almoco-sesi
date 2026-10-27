import { describe, it, expect } from "vitest";
import { segundaDaSemana, isoData, agoraSP, motivoFechado } from "@/lib/almoco-data";
import {
  agruparPorSemana,
  contagem,
  formatarData,
  linhasDoDia,
  nomeDoDia,
  periodoPronto,
  totalDoPeriodo,
  type PessoaDaLista,
} from "@/lib/lista-data";

describe("almoco data", () => {
  it("wednesday maps to monday of same week", () => {
    expect(segundaDaSemana(new Date(2026, 9, 21)).getDate()).toBe(19);
  });
  it("saturday maps to next monday", () => {
    expect(segundaDaSemana(new Date(2026, 9, 24)).getDate()).toBe(26);
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

describe("lista de almoço (só colaboradores)", () => {
  const dia = "2026-10-21";
  const pessoas: PessoaDaLista[] = [
    { id: "1", nome: "Fábio Martins", nif: "1040210", marcas: { [dia]: true } },
    { id: "2", nome: "Ana Paula Souza", nif: "1040247", marcas: {} },
    { id: "3", nome: "Carla Mendes", nif: "1040284", marcas: { [dia]: false, "2026-10-22": true } },
  ];
  const linhas = linhasDoDia(pessoas, dia);

  it("sem registro = sem marcação; só o dia pedido conta", () => {
    expect(Object.fromEntries(linhas.map((l) => [l.id, l.status]))).toEqual({
      "1": "vai",
      "2": "sem",
      "3": "nao",
    });
  });
  it("ordena por nome", () => {
    expect(linhas.map((l) => l.nome)).toEqual(["Ana Paula Souza", "Carla Mendes", "Fábio Martins"]);
  });
  it("conta vão / não vão / sem marcação (sem grupos)", () => {
    expect(contagem(linhas)).toEqual({ vai: 1, nao: 1, sem: 1 });
  });
});

describe("relatório de refeições", () => {
  const dias = [
    { data: "2026-10-19", total: 20 },
    { data: "2026-10-20", total: 18 },
    { data: "2026-10-23", total: 22 },
    { data: "2026-10-26", total: 25 },
    { data: "2026-10-27", total: 19 },
  ];

  it("soma por semana (seg–sex) e no período, inclusive semanas incompletas", () => {
    const semanas = agruparPorSemana(dias);
    expect(semanas.map((s) => [s.inicio, s.fim, s.total, s.dias.length])).toEqual([
      ["2026-10-19", "2026-10-23", 60, 3],
      ["2026-10-26", "2026-10-30", 44, 2],
    ]);
    expect(totalDoPeriodo(dias)).toBe(104);
    expect(semanas.reduce((s, x) => s + x.total, 0)).toBe(totalDoPeriodo(dias));
  });
  it("virada de mês fica na semana certa", () => {
    const s = agruparPorSemana([
      { data: "2026-10-30", total: 5 },
      { data: "2026-11-02", total: 7 },
    ]);
    expect(s.map((x) => [x.inicio, x.total])).toEqual([
      ["2026-10-26", 5],
      ["2026-11-02", 7],
    ]);
  });
  it("períodos prontos", () => {
    const hoje = new Date(2026, 9, 22); // quinta, 22/10/2026
    expect(periodoPronto("semana", hoje)).toEqual({ inicio: "2026-10-19", fim: "2026-10-25" });
    expect(periodoPronto("semana-passada", hoje)).toEqual({
      inicio: "2026-10-12",
      fim: "2026-10-18",
    });
    expect(periodoPronto("mes", hoje)).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(periodoPronto("mes-passado", hoje)).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
    expect(periodoPronto("mes-passado", new Date(2026, 0, 10))).toEqual({
      inicio: "2025-12-01",
      fim: "2025-12-31",
    });
  });
  it("formatação de datas", () => {
    expect(formatarData("2026-10-21")).toBe("21/10/2026");
    expect(nomeDoDia("2026-10-21")).toBe("Quarta");
  });
});
