/**
 * Importação de colaboradores por planilha. A planilha só pode ter as colunas "nome" e "nif":
 * qualquer outra coluna é IGNORADA (nem chega a sair do navegador) e a tela avisa quais foram.
 * As regras de validação são as mesmas da função admin_importar_pessoas do banco, que confere tudo de novo.
 */

export const LIMITE_LINHAS = 2000;
export const LIMITE_BYTES = 2 * 1024 * 1024;
export const NOME_MAXIMO = 120;
export const NIF_MAXIMO = 30;

export class ErroPlanilha extends Error {}

export interface LinhaPlanilha {
  /** Número da linha na planilha (a do cabeçalho conta), para o admin achar o problema. */
  linha: number;
  nome: string;
  nif: string;
}

export interface LeituraPlanilha {
  linhas: LinhaPlanilha[];
  /** Cabeçalhos de colunas que foram ignoradas (qualquer coisa além de nome e nif). */
  ignoradas: string[];
}

/** Junta espaços repetidos (inclusive o espaço "duro" do Excel) e tira os das pontas. */
export const limparTexto = (t: unknown): string =>
  String(t ?? "")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();

const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const chaveCabecalho = (t: unknown) => semAcento(limparTexto(t)).toLowerCase();

// ---------------------------------------------------------------------------
// CSV (leitor próprio: aceita ; , ou tab, aspas, BOM e acentos do Excel brasileiro)
// ---------------------------------------------------------------------------

/** UTF-8 se for válido; senão Windows-1252 (o CSV "padrão" do Excel no Brasil). */
export function decodificarCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

export function lerCsv(textoBruto: string): string[][] {
  const texto = textoBruto.replace(/^\uFEFF/, "");
  const primeira = texto.split(/\r?\n/).find((l) => l.trim() !== "") ?? "";
  const dica = /^sep=(.)\s*$/i.exec(primeira.trim());
  const corpo = dica
    ? texto.slice(texto.indexOf(primeira) + primeira.length).replace(/^\r?\n/, "")
    : texto;
  const cabecalho = dica ? (corpo.split(/\r?\n/).find((l) => l.trim() !== "") ?? "") : primeira;
  const conta = (c: string) => cabecalho.split(c).length - 1;
  const sep = dica?.[1] ?? [";", "\t", ","].reduce((m, c) => (conta(c) > conta(m) ? c : m), ";");

  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;
  const fechaCampo = () => {
    linha.push(campo);
    campo = "";
  };
  for (let i = 0; i < corpo.length; i++) {
    const ch = corpo[i]!;
    if (entreAspas) {
      if (ch === '"' && corpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') entreAspas = false;
      else campo += ch;
    } else if (ch === '"') entreAspas = true;
    else if (ch === sep) fechaCampo();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && corpo[i + 1] === "\n") i++;
      fechaCampo();
      linhas.push(linha);
      linha = [];
    } else campo += ch;
  }
  if (campo !== "" || linha.length > 0) {
    fechaCampo();
    linhas.push(linha);
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Matriz (CSV ou Excel) -> linhas { nome, nif }
// ---------------------------------------------------------------------------

/**
 * `matriz` é a planilha como lista de linhas; `primeiraLinha` é o número (1, 2, …) da linha 0 da matriz.
 * Procura o cabeçalho nas primeiras linhas (aceita "Nome"/"NOME"/"NIF" em qualquer posição de coluna).
 */
export function extrairNomeNif(matriz: unknown[][], primeiraLinha = 1): LeituraPlanilha {
  let cab = -1;
  let colNome = -1;
  let colNif = -1;
  for (let i = 0; i < Math.min(matriz.length, 10) && cab < 0; i++) {
    const chaves = (matriz[i] ?? []).map(chaveCabecalho);
    const n = chaves.indexOf("nome");
    const f = chaves.indexOf("nif");
    if (n >= 0 && f >= 0) {
      cab = i;
      colNome = n;
      colNif = f;
    }
  }
  if (cab < 0) {
    throw new ErroPlanilha(
      "Não encontrei as colunas “nome” e “nif” na primeira linha da planilha. Confira os títulos das colunas.",
    );
  }

  const ignoradas = (matriz[cab] ?? [])
    .map((c, i) => ({ c: limparTexto(c), i }))
    .filter(({ c, i }) => c !== "" && i !== colNome && i !== colNif)
    .map(({ c }) => c);

  const linhas: LinhaPlanilha[] = [];
  let comConteudo = 0;
  for (let i = cab + 1; i < matriz.length; i++) {
    const row = matriz[i] ?? [];
    const nome = limparTexto(row[colNome]);
    const nif = limparTexto(row[colNif]);
    if (nome !== "" || nif !== "") comConteudo++;
    // Linhas totalmente vazias entram na lista (o preview conta quantas foram ignoradas).
    linhas.push({ linha: primeiraLinha + i, nome, nif });
  }
  if (comConteudo > LIMITE_LINHAS) {
    throw new ErroPlanilha(
      `A planilha tem ${comConteudo} linhas. Importe no máximo ${LIMITE_LINHAS} por vez (divida em arquivos menores).`,
    );
  }
  if (comConteudo === 0) {
    throw new ErroPlanilha("A planilha não tem nenhuma pessoa abaixo do cabeçalho.");
  }
  // tira o "rabo" de linhas vazias que o Excel costuma deixar no fim
  while (
    linhas.length > 0 &&
    linhas[linhas.length - 1]!.nome === "" &&
    linhas[linhas.length - 1]!.nif === ""
  ) {
    linhas.pop();
  }
  return { linhas, ignoradas };
}

/** Lê o arquivo escolhido (.csv, .xlsx, .xls ou .ods) e devolve só nome e NIF. */
export async function lerArquivo(file: File): Promise<LeituraPlanilha> {
  if (file.size > LIMITE_BYTES) throw new ErroPlanilha("O arquivo é grande demais (máximo 2 MB).");
  const nome = file.name.toLowerCase();
  const buf = await file.arrayBuffer();

  if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    return extrairNomeNif(lerCsv(decodificarCsv(buf)));
  }
  if (/\.(xlsx|xls|ods)$/.test(nome)) {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const nomeAba = wb.SheetNames[0];
      const ws = nomeAba ? wb.Sheets[nomeAba] : undefined;
      if (!ws) throw new ErroPlanilha("A planilha está vazia.");
      const inicio = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s.r : 0;
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: true,
      });
      // Número vira texto sem casas ("1040210" e não "1040210.0"); texto fica como está (zeros à esquerda preservados).
      const textual = matriz.map((l) => l.map((c) => (typeof c === "number" ? String(c) : c)));
      return extrairNomeNif(textual, inicio + 1);
    } catch (e) {
      if (e instanceof ErroPlanilha) throw e;
      throw new ErroPlanilha(
        "Não consegui abrir esse arquivo. Confira se é uma planilha válida e sem senha.",
      );
    }
  }
  throw new ErroPlanilha("Formato não aceito. Envie um arquivo .xlsx, .xls ou .csv.");
}

// ---------------------------------------------------------------------------
// Validação (mesmas regras e mesmas mensagens da função admin_importar_pessoas)
// ---------------------------------------------------------------------------

export interface LinhaValidada extends LinhaPlanilha {
  /** `null` = linha válida; "vazia" = totalmente vazia (ignorada, não é erro); senão, o motivo. */
  problema: string | "vazia" | null;
}

export interface ResultadoValidacao {
  linhas: LinhaValidada[];
  /** Só o que será enviado ao banco. */
  validas: LinhaPlanilha[];
  vazias: number;
  comProblema: number;
}

/** `existentes`: NIF -> nome de quem já está cadastrado (ativos e inativos). */
export function validarImportacao(
  linhas: LinhaPlanilha[],
  existentes: ReadonlyMap<string, string>,
): ResultadoValidacao {
  const vistos = new Map<string, number>(); // nif -> linha onde apareceu primeiro
  const saida: LinhaValidada[] = linhas.map((l) => {
    let problema: string | null = null;
    if (l.nome === "" && l.nif === "") return { ...l, problema: "vazia" };
    if (l.nif === "") problema = "NIF ausente";
    else if (l.nome === "") problema = "Nome ausente";
    else if (l.nif.includes(" ")) problema = "NIF não pode ter espaços";
    else if (l.nif.length > NIF_MAXIMO)
      problema = `NIF muito longo (máximo ${NIF_MAXIMO} caracteres)`;
    else if (l.nome.length > NOME_MAXIMO)
      problema = `Nome muito longo (máximo ${NOME_MAXIMO} caracteres)`;
    else if (vistos.has(l.nif))
      problema = `NIF repetido na planilha (já aparece na linha ${vistos.get(l.nif)})`;

    if (problema === null) {
      vistos.set(l.nif, l.linha);
      const dono = existentes.get(l.nif);
      if (dono !== undefined) problema = `NIF já cadastrado (${dono})`;
    }
    return { ...l, problema };
  });

  return {
    linhas: saida,
    validas: saida
      .filter((l) => l.problema === null)
      .map(({ linha, nome, nif }) => ({ linha, nome, nif })),
    vazias: saida.filter((l) => l.problema === "vazia").length,
    comProblema: saida.filter((l) => l.problema !== null && l.problema !== "vazia").length,
  };
}
