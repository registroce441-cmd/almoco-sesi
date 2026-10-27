import { useState } from "react";
import { BarChart3, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import {
  agruparPorSemana,
  formatarData,
  formatarDiaMes,
  nomeDoDia,
  periodoPronto,
  PERIODOS,
  totalDoPeriodo,
  type Periodo,
} from "@/lib/lista-data";
import { exportarRelatorioExcel, exportarRelatorioPdf } from "@/lib/exportar-relatorio";
import { useConfiguracoes } from "@/hooks/use-configuracoes";
import { MENSAGEM_RECUSA, useRelatorio } from "@/hooks/use-acesso-cozinha";
import { cn } from "@/lib/utils";

/** Relatório de refeições por dia, semana e período, com exportação para Excel e PDF. */
export function Relatorio({
  codigo = null,
  comoAdmin = false,
  inicialmenteAberto = false,
}: {
  /** Código da cozinha (quem entra pela Lista). */
  codigo?: string | null;
  /** Admin logado: o banco o reconhece pelo login, sem código. */
  comoAdmin?: boolean;
  inicialmenteAberto?: boolean;
}) {
  const [aberto, setAberto] = useState(inicialmenteAberto);
  const [preset, setPreset] = useState<Periodo | null>("mes");
  const [{ inicio, fim }, setIntervalo] = useState(() => periodoPronto("mes"));
  const config = useConfiguracoes();
  const rel = useRelatorio(inicio, fim, codigo, aberto, comoAdmin);

  const escolher = (p: Periodo) => {
    setPreset(p);
    setIntervalo(periodoPronto(p));
  };
  const invalido = Boolean(inicio && fim && fim < inicio);
  const dias = rel.data?.ok ? rel.data.dias : [];
  const semanas = agruparPorSemana(dias);
  const meta = { unidade: config.data?.nome_unidade ?? "SESI", inicio, fim };
  const pronto = rel.data?.ok === true && dias.length > 0;

  return (
    <section className="mt-4 rounded-3xl border bg-card print:hidden">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Relatório de refeições</span>
          <span className="block text-xs text-muted-foreground">
            Total por dia, semana e período, para o controle de gastos
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="space-y-4 border-t p-4 animate-rise">
          <div className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => escolher(p.id)}
                className={cn(
                  "h-10 rounded-xl px-3 text-sm font-semibold transition",
                  preset === p.id
                    ? "bg-on text-primary-foreground"
                    : "border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["De", inicio, (v: string) => setIntervalo({ inicio: v, fim })],
                ["Até", fim, (v: string) => setIntervalo({ inicio, fim: v })],
              ] as const
            ).map(([rotulo, valor, mudar]) => (
              <label key={rotulo} className="block">
                <span className="text-xs font-semibold text-muted-foreground">{rotulo}</span>
                <input
                  type="date"
                  value={valor}
                  onChange={(e) => {
                    setPreset(null);
                    mudar(e.target.value);
                  }}
                  className="mt-1 h-12 w-full rounded-2xl border bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
            ))}
          </div>

          {invalido ? (
            <p role="alert" className="text-sm font-semibold text-accent">
              A data final precisa ser igual ou depois da inicial.
            </p>
          ) : rel.isError ? (
            <EstadoErro erro={rel.error} onTentar={() => rel.refetch()} />
          ) : rel.data && !rel.data.ok ? (
            <p role="alert" className="text-sm font-semibold text-accent">
              {rel.data.motivo === "periodo_invalido"
                ? "Escolha um período de até 400 dias."
                : MENSAGEM_RECUSA[rel.data.motivo]}
            </p>
          ) : rel.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Carregando o relatório">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 rounded-3xl bg-on p-4 text-primary-foreground shadow-glow">
                <div>
                  <p className="text-4xl font-extrabold tabular-nums">{totalDoPeriodo(dias)}</p>
                  <p className="text-xs font-medium opacity-75">
                    refeições de {formatarData(inicio)} a {formatarData(fim)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold">Por semana</p>
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {semanas.map((s) => (
                      <li
                        key={s.inicio}
                        className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3"
                      >
                        <div>
                          <p className="font-semibold">
                            {formatarDiaMes(s.inicio)} a {formatarDiaMes(s.fim)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.dias.length} dia{s.dias.length !== 1 && "s"} úteis
                          </p>
                        </div>
                        <p className="text-xl font-extrabold tabular-nums">{s.total}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold">Por dia</p>
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {dias.map((d) => (
                      <li
                        key={d.data}
                        className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3"
                      >
                        <p className="font-semibold">
                          {formatarDiaMes(d.data)}{" "}
                          <span className="font-normal text-muted-foreground">
                            · {nomeDoDia(d.data)}
                          </span>
                        </p>
                        <p className="text-lg font-extrabold tabular-nums">{d.total}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
                <button
                  disabled={!pronto}
                  onClick={() => void exportarRelatorioExcel(dias, meta)}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-success px-5 text-sm font-semibold text-success-foreground transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60"
                >
                  <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
                </button>
                <button
                  disabled={!pronto}
                  onClick={() => void exportarRelatorioPdf(dias, meta)}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-on px-5 text-sm font-semibold text-primary-foreground transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" /> Exportar PDF
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
