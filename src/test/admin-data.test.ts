import { describe, expect, it } from "vitest";
import {
  adicionarTag,
  combinaBusca,
  caminhoDaFoto,
  DIA_VAZIO,
  diaEstaVazio,
  diasIguais,
  ehDiaUtil,
  estadoDe,
  estatisticasSemana,
  horaCurta,
  limparDia,
  marcasAlteradas,
  problemaDoDia,
  valorDe,
} from "@/lib/admin-data";
import { dimensoesReduzidas } from "@/lib/imagem";
import { mensagemDeErro } from "@/lib/erros";
import type { PessoaDaLista } from "@/lib/lista-data";

describe("editor do cardápio", () => {
  it("dia totalmente vazio é válido (= sem cardápio) e não conta como alteração", () => {
    expect(diaEstaVazio(DIA_VAZIO)).toBe(true);
    expect(problemaDoDia(DIA_VAZIO)).toBeNull();
    expect(diasIguais(DIA_VAZIO, { ...DIA_VAZIO, prato: "   " })).toBe(true);
  });
  it("sem prato mas com outro campo, pede o prato", () => {
    expect(problemaDoDia({ ...DIA_VAZIO, sobremesa: "Pudim" })).toBe("Informe o prato do dia.");
    expect(problemaDoDia({ ...DIA_VAZIO, foto_url: "https://x/f.jpg" })).toBe(
      "Informe o prato do dia.",
    );
    expect(problemaDoDia({ ...DIA_VAZIO, prato: "Frango" })).toBeNull();
    expect(problemaDoDia({ ...DIA_VAZIO, prato: "x".repeat(121) })).toMatch(/muito longo/);
  });
  it("limparDia tira espaços repetidos e tags repetidas (ignorando maiúsculas)", () => {
    const d = limparDia({
      prato: "  Frango   grelhado ",
      acompanhamento: "",
      sobremesa: "",
      tags: ["Leve", " leve ", "", "Vegetariano"],
      foto_url: null,
    });
    expect(d.prato).toBe("Frango grelhado");
    expect(d.tags).toEqual(["Leve", "Vegetariano"]);
  });
  it("adicionarTag respeita limite de tamanho, de quantidade e duplicidade", () => {
    expect(adicionarTag([], "  Sem   ovo ")).toEqual(["Sem ovo"]);
    expect(adicionarTag(["Leve"], "LEVE")).toEqual(["Leve"]);
    expect(adicionarTag([], "   ")).toEqual([]);
    expect(adicionarTag([], "x".repeat(40))[0]).toHaveLength(24);
    const cheio = ["a", "b", "c", "d", "e", "f"];
    expect(adicionarTag(cheio, "g")).toEqual(cheio);
  });
  it("descobre o caminho da foto no bucket pela URL pública (para apagar a foto antiga)", () => {
    const base = "https://abc.supabase.co/storage/v1/object/public/cardapio-fotos";
    expect(caminhoDaFoto(`${base}/2026-10-26/a%20b.jpg?t=1`)).toBe("2026-10-26/a b.jpg");
    expect(caminhoDaFoto("https://outro-site.com/foto.jpg")).toBeNull();
    expect(caminhoDaFoto(null)).toBeNull();
  });
});

describe("marcações manuais", () => {
  it("converte entre estado da tela e valor do banco", () => {
    expect([estadoDe(true), estadoDe(false), estadoDe(undefined)]).toEqual(["vai", "nao", "sem"]);
    expect([valorDe("vai"), valorDe("nao"), valorDe("sem")]).toEqual([true, false, null]);
  });
  it("manda só os dias que mudaram", () => {
    const base = { "2026-10-26": true, "2026-10-27": false };
    const novo = {
      "2026-10-26": "vai",
      "2026-10-27": "sem",
      "2026-10-28": "nao",
      "2026-10-29": "sem",
    } as const;
    expect(marcasAlteradas(base, novo)).toEqual([
      { data: "2026-10-27", vai: null },
      { data: "2026-10-28", vai: false },
    ]);
    expect(marcasAlteradas(base, { "2026-10-26": "vai" })).toEqual([]);
  });
});

describe("dashboard", () => {
  const dias = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"];
  const p = (nome: string, marcas: Record<string, boolean>): PessoaDaLista => ({
    id: nome,
    nome,
    nif: nome,
    marcas,
  });
  const pessoas = [
    p("Zeca", {}),
    p("Ana", { "2026-10-26": true, "2026-10-27": true }),
    p("Bia", { "2026-10-26": true, "2026-10-28": false }),
    p("Caio", { "2026-10-30": false }),
    p("Ágata", {}),
  ];
  it("conta refeições por dia, total, adesão e quem ainda não marcou (em ordem alfabética)", () => {
    const e = estatisticasSemana(pessoas, dias);
    expect(e.porDia).toEqual([2, 1, 0, 0, 0]);
    expect(e.totalSemana).toBe(3);
    expect(e.ativas).toBe(5);
    expect(e.responderam).toBe(3);
    expect(e.adesao).toBe(60);
    expect(e.pendentes.map((x) => x.nome)).toEqual(["Ágata", "Zeca"]);
  });
  it("marcações fora da semana não contam; lista vazia não quebra", () => {
    expect(estatisticasSemana([p("Ana", { "2026-11-02": true })], dias).responderam).toBe(0);
    expect(estatisticasSemana([], dias)).toMatchObject({
      adesao: 0,
      totalSemana: 0,
      pendentes: [],
    });
  });
});

describe("configurações e imagem", () => {
  it("horaCurta e ehDiaUtil", () => {
    expect(horaCurta("09:00:00")).toBe("09:00");
    expect(ehDiaUtil("2026-10-26")).toBe(true); // segunda
    expect(ehDiaUtil("2026-10-24")).toBe(false); // sábado
    expect(ehDiaUtil("2026-10-25")).toBe(false); // domingo
  });
  it("reduz foto grande mantendo a proporção e nunca aumenta foto pequena", () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1280, altura: 960 });
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 960, altura: 1280 });
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 });
  });
});

describe("mensagens de erro do painel", () => {
  it("traduz os erros mais comuns", () => {
    expect(
      mensagemDeErro({
        code: "23505",
        message: 'duplicate key value violates unique constraint "pessoas_nif_key"',
      }),
    ).toBe("Já existe uma pessoa com esse NIF.");
    expect(mensagemDeErro({ code: "23505", message: "outra" })).toBe(
      "Já existe um cadastro com esses dados.",
    );
    expect(mensagemDeErro({ code: "23514", message: "x" })).toMatch(/inválido/);
    expect(mensagemDeErro({ code: "PGRST301", message: "JWT expired" })).toBe(
      "Sua sessão expirou. Entre de novo.",
    );
    expect(mensagemDeErro({ code: "P0001", message: "Pessoa não encontrada ou inativa." })).toBe(
      "Pessoa não encontrada ou inativa.",
    );
    expect(mensagemDeErro({ code: "42501", message: "x" })).toBe(
      "Você não tem permissão para fazer isso.",
    );
  });
});

describe("busca", () => {
  it("casa todas as palavras, sem ligar para acento, maiúsculas ou ordem", () => {
    expect(combinaBusca("José da Conceição 1040210", "jose conceicao")).toBe(true);
    expect(combinaBusca("José da Conceição 1040210", "CONCEICAO 1040")).toBe(true);
    expect(combinaBusca("José da Conceição 1040210", "jose maria")).toBe(false);
    expect(combinaBusca("Ana", "   ")).toBe(true);
  });
});
