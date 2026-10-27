import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import {
  Aviso,
  CLASSE_BOTAO_PRIMARIO,
  CLASSE_BOTAO_SECUNDARIO,
  Cartao,
  Girando,
} from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useImportarPessoas,
  type PessoaAdmin,
  type ResultadoImportacao,
} from "@/hooks/use-admin-pessoas";
import {
  ErroPlanilha,
  lerArquivo,
  validarImportacao,
  type LeituraPlanilha,
} from "@/lib/importacao";
import { mensagemDeErro } from "@/lib/erros";
import { cn } from "@/lib/utils";

const VISIVEIS = 100;

/** Baixa um modelo com só as duas colunas (UTF-8 com BOM para o Excel entender os acentos). */
function baixarModelo() {
  const blob = new Blob(["\uFEFFnome;nif\r\nMaria da Silva;1040210\r\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-colaboradores.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Importação em 3 passos: escolher o arquivo, conferir a pré-visualização e confirmar. */
export function ImportarPlanilha({
  pessoas,
  carregando,
}: {
  pessoas: PessoaAdmin[] | undefined;
  carregando: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [leitura, setLeitura] = useState<LeituraPlanilha | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [soProblemas, setSoProblemas] = useState(false);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const importar = useImportarPessoas();

  const existentes = useMemo(() => new Map((pessoas ?? []).map((p) => [p.nif, p.nome])), [pessoas]);
  const validacao = useMemo(
    () => (leitura ? validarImportacao(leitura.linhas, existentes) : null),
    [leitura, existentes],
  );

  const reiniciar = () => {
    setLeitura(null);
    setNomeArquivo("");
    setErro(null);
    setResultado(null);
    setSoProblemas(false);
    setMostrarTodas(false);
    importar.reset();
    if (entrada.current) entrada.current.value = "";
  };

  const abrir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    reiniciar();
    setLendo(true);
    try {
      const l = await lerArquivo(arquivo);
      setLeitura(l);
      setNomeArquivo(arquivo.name);
      const v = validarImportacao(l.linhas, existentes);
      setSoProblemas(v.comProblema > 0 && v.validas.length > 0);
    } catch (e) {
      setErro(e instanceof ErroPlanilha ? e.message : "Não consegui ler esse arquivo.");
    } finally {
      setLendo(false);
    }
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    void abrir(e.dataTransfer.files[0]);
  };

  const confirmar = () => {
    if (!validacao || validacao.validas.length === 0) return;
    importar.mutate(validacao.validas, {
      onSuccess: (r) => {
        setResultado(r);
        setLeitura(null);
        toast.success(
          `${r.inseridas} pessoa${r.inseridas !== 1 ? "s" : ""} importada${r.inseridas !== 1 ? "s" : ""}.`,
        );
      },
    });
  };

  const linhasMostradas = useMemo(() => {
    if (!validacao) return [];
    const base = soProblemas
      ? validacao.linhas.filter((l) => l.problema !== null && l.problema !== "vazia")
      : validacao.linhas.filter((l) => l.problema !== "vazia");
    return mostrarTodas ? base : base.slice(0, VISIVEIS);
  }, [validacao, soProblemas, mostrarTodas]);
  const totalListavel = validacao ? validacao.linhas.length - validacao.vazias : 0;

  return (
    <Cartao
      icone={<FileSpreadsheet className="h-5 w-5" />}
      titulo="Importar planilha"
      descricao="Excel ou CSV com só duas colunas: nome e nif"
    >
      <input
        ref={entrada}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        className="sr-only"
        aria-label="Escolher planilha"
        onChange={(e) => void abrir(e.target.files?.[0])}
      />

      {/* Passo 1: escolher o arquivo */}
      {!leitura && !resultado && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={soltar}
            className={cn(
              "flex flex-col items-center rounded-3xl border-2 border-dashed px-4 py-8 text-center transition",
              arrastando ? "border-primary bg-primary/5" : "bg-muted/40",
            )}
          >
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              {lendo ? <Girando className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
            </div>
            <p className="mt-3 font-bold">{lendo ? "Lendo a planilha…" : "Escolha o arquivo"}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Formatos .xlsx, .xls e .csv, até {LIMITE_TEXTO}. Você confere tudo antes de importar.
            </p>
            <button
              onClick={() => entrada.current?.click()}
              disabled={lendo}
              className={cn(CLASSE_BOTAO_PRIMARIO, "mt-4 w-full max-w-xs")}
            >
              <FileSpreadsheet className="h-4 w-4" /> Escolher planilha
            </button>
          </div>
          {erro && <Aviso>{erro}</Aviso>}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <p>
              <strong className="text-foreground">Dica:</strong> formate a coluna NIF como{" "}
              <em>Texto</em> no Excel, para não perder zeros à esquerda.
            </p>
            <button
              onClick={baixarModelo}
              className="flex h-11 shrink-0 items-center gap-2 self-start font-semibold text-primary hover:underline"
            >
              <Download className="h-4 w-4" /> Baixar modelo
            </button>
          </div>
        </div>
      )}

      {/* Passo 2: pré-visualização e validação */}
      {leitura && validacao && (
        <div className="space-y-4">
          <p className="truncate text-sm text-muted-foreground">
            Arquivo: <strong className="text-foreground">{nomeArquivo}</strong>
          </p>

          {carregando ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Resumo
                n={validacao.validas.length}
                rotulo="prontas"
                cls="bg-success/15 text-success"
              />
              <Resumo
                n={validacao.comProblema}
                rotulo="com problema"
                cls={
                  validacao.comProblema
                    ? "bg-accent/12 text-accent"
                    : "bg-muted text-muted-foreground"
                }
              />
              <Resumo
                n={validacao.vazias}
                rotulo="vazias (ignoradas)"
                cls="bg-muted text-muted-foreground"
              />
            </div>
          )}

          {leitura.ignoradas.length > 0 && (
            <Aviso tipo="info">
              Só nome e NIF são lidos. Colunas ignoradas: {leitura.ignoradas.join(", ")}.
            </Aviso>
          )}
          {validacao.comProblema > 0 && validacao.validas.length > 0 && (
            <Aviso tipo="info">
              As linhas com problema NÃO serão importadas. Corrija na planilha e importe de novo, se
              quiser.
            </Aviso>
          )}
          {validacao.validas.length === 0 && !carregando && (
            <Aviso>
              Nenhuma linha válida para importar. Corrija a planilha e escolha o arquivo de novo.
            </Aviso>
          )}

          {validacao.comProblema > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={soProblemas}
                onChange={(e) => setSoProblemas(e.target.checked)}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              Mostrar só as linhas com problema
            </label>
          )}

          {/* Celular: cartões */}
          <ul className="space-y-2 md:hidden">
            {linhasMostradas.map((l) => (
              <li key={l.linha} className="rounded-2xl border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {l.nome || <span className="text-muted-foreground">(sem nome)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      NIF {l.nif || "—"} · linha {l.linha}
                    </p>
                  </div>
                  <Situacao problema={l.problema} />
                </div>
                {l.problema && l.problema !== "vazia" && (
                  <p className="mt-2 text-xs font-semibold text-accent">{l.problema}</p>
                )}
              </li>
            ))}
          </ul>
          {/* PC: tabela */}
          <div className="hidden overflow-hidden rounded-3xl border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Linha</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">NIF</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhasMostradas.map((l) => (
                  <tr key={l.linha} className="border-t">
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l.linha}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {l.nome || (
                        <span className="font-normal text-muted-foreground">(sem nome)</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{l.nif || "—"}</td>
                    <td className="px-4 py-2.5">
                      <Situacao problema={l.problema} detalhe />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!mostrarTodas && (soProblemas ? validacao.comProblema : totalListavel) > VISIVEIS && (
            <button
              onClick={() => setMostrarTodas(true)}
              className="flex h-11 items-center text-sm font-semibold text-primary hover:underline"
            >
              Mostrando {VISIVEIS} de {soProblemas ? validacao.comProblema : totalListavel} · ver
              todas
            </button>
          )}

          {importar.isError && <Aviso>{mensagemDeErro(importar.error)}</Aviso>}
          <div className="grid gap-3 md:flex md:justify-end">
            <button
              onClick={reiniciar}
              disabled={importar.isPending}
              className={CLASSE_BOTAO_SECUNDARIO}
            >
              Escolher outro arquivo
            </button>
            <button
              onClick={confirmar}
              disabled={importar.isPending || carregando || validacao.validas.length === 0}
              className={CLASSE_BOTAO_PRIMARIO}
            >
              {importar.isPending ? (
                <>
                  <Girando /> Importando…
                </>
              ) : (
                `Importar ${validacao.validas.length} pessoa${validacao.validas.length !== 1 ? "s" : ""}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Passo 3: resultado */}
      {resultado && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-3xl bg-success/15 p-4 text-success">
            <CheckCircle2 className="h-8 w-8 shrink-0" />
            <div>
              <p className="text-lg font-extrabold">
                {resultado.inseridas} pessoa{resultado.inseridas !== 1 ? "s" : ""} importada
                {resultado.inseridas !== 1 ? "s" : ""}
              </p>
              {resultado.rejeitadas.length > 0 && (
                <p className="text-sm font-semibold">{resultado.rejeitadas.length} ficou de fora</p>
              )}
            </div>
          </div>
          {resultado.rejeitadas.length > 0 && (
            <>
              <Aviso>
                O banco recusou estas linhas (alguém pode ter cadastrado o mesmo NIF no meio tempo):
              </Aviso>
              <ul className="space-y-2">
                {resultado.rejeitadas.map((r) => (
                  <li key={r.linha} className="rounded-2xl border bg-card p-3 text-sm">
                    <span className="font-semibold">{r.nome || "(sem nome)"}</span> · NIF{" "}
                    {r.nif || "—"} · linha {r.linha}
                    <span className="mt-1 block text-xs font-semibold text-accent">{r.motivo}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button onClick={reiniciar} className={cn(CLASSE_BOTAO_SECUNDARIO, "w-full md:w-auto")}>
            Nova importação
          </button>
        </div>
      )}
    </Cartao>
  );
}

const LIMITE_TEXTO = "2 MB e 2000 linhas";

function Resumo({ n, rotulo, cls }: { n: number; rotulo: string; cls: string }) {
  return (
    <div className={cn("rounded-2xl px-2 py-3 text-center", cls)}>
      <p className="text-2xl font-extrabold tabular-nums">{n}</p>
      <p className="text-[11px] font-semibold leading-tight">{rotulo}</p>
    </div>
  );
}

function Situacao({ problema, detalhe }: { problema: string | null; detalhe?: boolean }) {
  if (problema === null) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
        <CheckCircle2 className="h-3.5 w-3.5" /> OK
      </span>
    );
  }
  if (problema === "vazia")
    return (
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Vazia
      </span>
    );
  return detalhe ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {problema}
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-xs font-semibold text-accent">
      <AlertTriangle className="h-3.5 w-3.5" /> Erro
    </span>
  );
}
