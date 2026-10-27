import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  decodificarCsv,
  extrairNomeNif,
  ErroPlanilha,
  lerArquivo,
  lerCsv,
  limparTexto,
  validarImportacao,
} from "@/lib/importacao";
import casos from "../../supabase/tests/casos-importacao.json";

/** File mínimo (o jsdom antigo não tem File.arrayBuffer): lerArquivo só usa name, size e arrayBuffer(). */
const arquivo = (nome: string, bytes: Uint8Array | ArrayBuffer): File => {
  const buf = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
  return { name: nome, size: buf.byteLength, arrayBuffer: async () => buf } as unknown as File;
};
const utf8 = (t: string) => new TextEncoder().encode(t);

describe("leitura de CSV", () => {
  it("separa por ponto e vírgula (Excel brasileiro) e ignora o BOM", () => {
    expect(lerCsv("\uFEFFnome;nif\r\nAna Souza;1040210\r\nBruno;1040247\r\n")).toEqual([
      ["nome", "nif"],
      ["Ana Souza", "1040210"],
      ["Bruno", "1040247"],
    ]);
  });
  it("separa por vírgula e por tab", () => {
    expect(lerCsv("nome,nif\nAna,1")[1]).toEqual(["Ana", "1"]);
    expect(lerCsv("nome\tnif\nAna\t1")[1]).toEqual(["Ana", "1"]);
  });
  it("entende aspas, vírgula dentro do texto e aspas escapadas", () => {
    expect(lerCsv('nome,nif\n"Silva, Ana ""Aninha""",12\n')[1]).toEqual([
      'Silva, Ana "Aninha"',
      "12",
    ]);
  });
  it("respeita a dica sep=; do Excel", () => {
    expect(lerCsv("sep=;\nnome;nif\nAna;1")).toEqual([
      ["nome", "nif"],
      ["Ana", "1"],
    ]);
  });
  it("último registro sem quebra de linha também entra", () => {
    expect(lerCsv("nome;nif\nAna;1").length).toBe(2);
  });
  it("lê Windows-1252 (acentos do Excel antigo) quando não é UTF-8 válido", () => {
    const bytes = new Uint8Array([
      ...utf8("nome;nif\nJos"),
      0xe9,
      ...utf8(" Concei"),
      0xe7,
      0xe3,
      ...utf8("o;1"),
    ]);
    expect(decodificarCsv(bytes.buffer)).toContain("José Conceição");
    expect(decodificarCsv(utf8("Conceição").buffer as ArrayBuffer)).toBe("Conceição");
  });
});

describe("extrairNomeNif", () => {
  it("acha as colunas em qualquer ordem, sem ligar para maiúsculas/acentos/espaços", () => {
    const r = extrairNomeNif([
      [" NIF ", "Nome"],
      ["1040210", " Ana   Paula "],
    ]);
    expect(r.linhas).toEqual([{ linha: 2, nome: "Ana Paula", nif: "1040210" }]);
    expect(r.ignoradas).toEqual([]);
  });
  it("IGNORA as demais colunas e diz quais foram (não vazam dados além de nome e NIF)", () => {
    const r = extrairNomeNif([
      ["nome", "CPF", "nif", "Salário", ""],
      ["Ana", "111.222.333-44", "1", "9000", ""],
    ]);
    expect(r.ignoradas).toEqual(["CPF", "Salário"]);
    expect(r.linhas).toEqual([{ linha: 2, nome: "Ana", nif: "1" }]);
    expect(JSON.stringify(r)).not.toContain("111.222");
  });
  it("encontra o cabeçalho mesmo com linhas de título antes e numera pela linha da planilha", () => {
    const r = extrairNomeNif([["Lista de colaboradores"], [], ["nome", "nif"], ["Ana", "1"]]);
    expect(r.linhas).toEqual([{ linha: 4, nome: "Ana", nif: "1" }]);
  });
  it("respeita a linha inicial informada (planilha que começa na linha 3)", () => {
    expect(
      extrairNomeNif(
        [
          ["nome", "nif"],
          ["Ana", "1"],
        ],
        3,
      ).linhas[0]?.linha,
    ).toBe(4);
  });
  it("mantém linhas vazias no meio e tira as do final", () => {
    const r = extrairNomeNif([
      ["nome", "nif"],
      ["Ana", "1"],
      ["", ""],
      ["Bia", "2"],
      ["", ""],
      ["", ""],
    ]);
    expect(r.linhas.map((l) => l.linha)).toEqual([2, 3, 4]);
  });
  it("erra com mensagem clara sem cabeçalho, sem pessoas ou com linhas demais", () => {
    expect(() =>
      extrairNomeNif([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toThrow(ErroPlanilha);
    expect(() => extrairNomeNif([["a", "b"]])).toThrow(/colunas “nome” e “nif”/);
    expect(() => extrairNomeNif([["nome", "nif"]])).toThrow(/nenhuma pessoa/);
    const muitas = [["nome", "nif"], ...Array.from({ length: 2001 }, (_, i) => [`P${i}`, `${i}`])];
    expect(() => extrairNomeNif(muitas)).toThrow(/2001 linhas/);
  });
  it("limparTexto junta espaços e trata o espaço duro", () => {
    expect(limparTexto("  A\u00a0\u00a0 B\t C ")).toBe("A B C");
    expect(limparTexto(null)).toBe("");
  });
});

describe("lerArquivo", () => {
  it("lê CSV em UTF-8", async () => {
    const r = await lerArquivo(arquivo("pessoas.csv", utf8("nome;nif\nAna Souza;1040210\n")));
    expect(r.linhas).toEqual([{ linha: 2, nome: "Ana Souza", nif: "1040210" }]);
  });
  it("lê Excel: NIF numérico vira texto sem casas e NIF em texto preserva os zeros", async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["nome", "nif"],
      ["Ana", 1040210],
      ["Bia", "0012345"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plan1");
    const bytes = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const r = await lerArquivo(arquivo("pessoas.xlsx", bytes));
    expect(r.linhas).toEqual([
      { linha: 2, nome: "Ana", nif: "1040210" },
      { linha: 3, nome: "Bia", nif: "0012345" },
    ]);
  });
  it("recusa formato desconhecido, arquivo grande e arquivo corrompido", async () => {
    await expect(lerArquivo(arquivo("foto.png", utf8("x")))).rejects.toThrow(/Formato não aceito/);
    await expect(
      lerArquivo(arquivo("grande.csv", new Uint8Array(2 * 1024 * 1024 + 1))),
    ).rejects.toThrow(/grande demais/);
    await expect(
      lerArquivo(arquivo("quebrado.xlsx", utf8("isto não é um xlsx"))),
    ).rejects.toBeInstanceOf(ErroPlanilha);
  });
});

describe("validarImportacao", () => {
  const existentes = new Map([["999", "Fábio Martins"]]);
  const l = (linha: number, nome: string, nif: string) => ({ linha, nome, nif });

  it("separa válidas, vazias e com problema", () => {
    const r = validarImportacao(
      [l(2, "Ana", "1"), l(3, "", ""), l(4, "Bia", ""), l(5, "Caio", "999")],
      existentes,
    );
    expect(r.validas).toEqual([l(2, "Ana", "1")]);
    expect(r.vazias).toBe(1);
    expect(r.comProblema).toBe(2);
    expect(r.linhas.map((x) => x.problema)).toEqual([
      null,
      "vazia",
      "NIF ausente",
      "NIF já cadastrado (Fábio Martins)",
    ]);
  });
  it("NIF repetido aponta a linha da primeira ocorrência, que continua válida", () => {
    const r = validarImportacao([l(2, "Ana", "1"), l(3, "Ana B.", "1")], new Map());
    expect(r.linhas[1]?.problema).toBe("NIF repetido na planilha (já aparece na linha 2)");
    expect(r.validas).toHaveLength(1);
  });

  // Mesmos casos que o banco testa: os dois lados precisam concordar.
  it("concorda com a lista de casos compartilhada com o teste do banco", () => {
    const linhas = casos.casos.map((c, i) => l(i + 2, c.nome, c.nif));
    const r = validarImportacao(linhas, new Map(Object.entries(casos.existentes)));
    casos.casos.forEach((c, i) => {
      const problema = r.linhas[i]!.problema;
      if (c.esperado === null) expect(problema, `linha ${i + 2}`).toBeNull();
      else
        expect(problema, `linha ${i + 2}`).toMatch(
          new RegExp(`^${c.esperado.replace(/[()]/g, "\\$&")}`),
        );
    });
  });
});
