import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  ChefHat,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Lock,
  Printer,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import { diasDaSemana, isoData, segundaDaSemana } from "@/lib/almoco-data";
import {
  agruparPorSemana,
  contagem,
  formatarData,
  formatarDiaMes,
  linhasDoDia,
  nomeDoDia,
  periodoPronto,
  PERIODOS,
  totalDoPeriodo,
  type Periodo,
  type Status,
} from "@/lib/lista-data";
import { exportarRelatorioExcel, exportarRelatorioPdf } from "@/lib/exportar-relatorio";
import { useTotaisDaSemana } from "@/hooks/use-totais";
import { useConfiguracoes } from "@/hooks/use-configuracoes";
import { MENSAGEM_RECUSA, useCodigoCozinha, useListaCozinha, useRelatorio } from "@/hooks/use-acesso-cozinha";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lista")({
  head: () => ({
    meta: [
      { title: "Lista de Almoço (Cozinha) — Almoço SESI" },
      { name: "description", content: "Total de refeições por dia e na semana. Nomes só para a cozinha e a administração." },
      { property: "og:title", content: "Lista de Almoço — Almoço SESI" },
      { property: "og:description", content: "Quantas refeições preparar por dia e na semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lista,
});

const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const STATUS: Record<Status, { label: string; cls: string }> = {
  vai: { label: "Vai almoçar", cls: "bg-success/15 text-success" },
  nao: { label: "Não vai", cls: "bg-muted text-muted-foreground" },
  sem: { label: "Sem marcação", cls: "bg-accent/12 text-accent" },
};

function Lista() {
  const seg = useMemo(() => segundaDaSemana(), []);
  const dias = useMemo(() => diasDaSemana(seg), [seg]);
  const [dia, setDia] = useState(0);
  const [q, setQ] = useState("");
  const [recusa, setRecusa] = useState<string | null>(null);

  const totais = useTotaisDaSemana(seg); // público: só números, atualiza a cada 15 s
  const acesso = useCodigoCozinha();
  const lista = useListaCozinha(seg, acesso.codigo);

  useEffect(() => {
    const dow = new Date().getDay();
    if (dow >= 1 && dow <= 5) setDia(dow - 1);
  }, []);

  // Código recusado: mostra o motivo no formulário e esquece o código digitado.
  const motivo = lista.data && !lista.data.ok ? lista.data.motivo : null;
  useEffect(() => {
    if (motivo) {
      setRecusa(MENSAGEM_RECUSA[motivo]);
      acesso.limpar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motivo]);

  const liberado = lista.data?.ok === true;
  const pessoas = lista.data?.ok ? lista.data.pessoas : [];
  const linhas = useMemo(() => linhasDoDia(pessoas, isoData(dias[dia]!)), [pessoas, dias, dia]);
  const c = contagem(linhas);
  const filtradas = linhas.filter((l) => {
    const s = q.trim().toLowerCase();
    return !s || l.nome.toLowerCase().includes(s) || l.nif.includes(s);
  });

  const total = (i: number) => totais.data?.[i]?.total;
  const totalSemana = totais.data?.reduce((s, d) => s + d.total, 0);
  const carregandoTotais = totais.isLoading;

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(filtradas.map((l) => ({ Nome: l.nome, NIF: l.nif, Status: STATUS[l.status].label })));
    ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, NOMES[dia]!);
    XLSX.writeFile(wb, `almoco-${NOMES[dia]!.toLowerCase()}-${fmt(dias[dia]!).replace("/", "-")}.xlsx`);
  };

  return (
    <div className="min-h-dvh-screen bg-background pb-28 md:pb-12 print:bg-card print:pb-0">
      <PageHeader eyebrow={<><ChefHat className="h-3.5 w-3.5 text-accent" /> Área da cozinha</>} title="Lista de Almoço">
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {dias.map((d, i) => (
            <button
              key={i}
              onClick={() => setDia(i)}
              className={cn(
                "flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold backdrop-blur transition",
                dia === i ? "border-transparent bg-header-foreground text-primary" : "border-header-foreground/15 bg-header-foreground/10",
              )}
            >
              {NOMES[i]!.slice(0, 3)} <span className="opacity-70">{d.getDate()}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Cabeçalho de impressão (só com nomes liberados) */}
      {liberado && (
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">Almoço SESI — Lista de {NOMES[dia]} ({fmt(dias[dia]!)})</h1>
          <p className="mt-1 text-sm">Vão almoçar: {c.vai} · Não vão: {c.nao} · Sem marcação: {c.sem}</p>
        </div>
      )}

      <main className="relative mx-auto -mt-8 max-w-5xl px-4 md:px-6 print:m-0 print:max-w-none print:p-0">
        {/* Totais de refeições: a visão pública */}
        {totais.isError ? (
          <EstadoErro erro={totais.error} onTentar={() => totais.refetch()} />
        ) : (
          <div className="grid grid-cols-5 gap-2 md:grid-cols-[1.4fr_repeat(5,1fr)] md:gap-3 print:hidden">
            <div className="col-span-5 flex items-center gap-4 rounded-3xl border bg-on p-4 text-primary-foreground shadow-glow animate-rise md:col-span-1 md:block">
              <CalendarDays className="h-5 w-5 shrink-0 opacity-70" />
              <div>
                <p className="text-3xl font-extrabold tabular-nums md:mt-3">{carregandoTotais ? "–" : totalSemana}</p>
                <p className="text-xs font-medium opacity-75">Refeições na semana</p>
              </div>
            </div>
            {dias.map((d, i) => (
              <button
                key={i}
                onClick={() => setDia(i)}
                aria-pressed={dia === i}
                style={{ animationDelay: `${(i + 1) * 60}ms` }}
                className={cn(
                  "rounded-3xl border p-2.5 text-center transition animate-rise md:p-4 md:text-left",
                  dia === i ? "border-primary bg-card ring-2 ring-primary/25" : "bg-card hover:border-primary/40",
                )}
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  <span className="md:hidden">{NOMES[i]!.slice(0, 3)}</span>
                  <span className="hidden md:inline">{NOMES[i]}</span> <span className="opacity-70">{d.getDate()}</span>
                </p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums md:mt-3 md:text-3xl">{carregandoTotais ? "–" : total(i)}</p>
                <p className="hidden text-xs font-medium text-muted-foreground md:block">refeições</p>
              </button>
            ))}
          </div>
        )}

        {!liberado ? (
          <AcessoNomes
            mensagem={recusa}
            verificando={Boolean(acesso.codigo) && lista.isPending}
            erroDeRede={lista.isError ? lista.error : null}
            onTentar={() => lista.refetch()}
            onEntrar={(codigo) => {
              setRecusa(null);
              acesso.definir(codigo);
            }}
          />
        ) : (
          <>
            <Relatorio codigo={acesso.codigo} />

            <div className="mt-4 flex flex-col gap-3 md:flex-row print:hidden">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar nome ou NIF"
                  aria-label="Buscar nome ou NIF"
                  className="h-12 w-full rounded-2xl border bg-card pl-12 pr-12 text-base outline-none focus:ring-2 focus:ring-ring/40"
                />
                {q && (
                  <button onClick={() => setQ("")} aria-label="Limpar" className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-muted-foreground">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 md:flex">
                <button onClick={() => window.print()} className="flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card px-5 text-sm font-semibold transition hover:bg-muted active:scale-[.97]">
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
                <button onClick={exportar} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-success px-5 text-sm font-semibold text-success-foreground transition active:scale-[.97]">
                  <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
                </button>
              </div>
            </div>

            <div className="mt-5 mb-2 flex items-center justify-between gap-3 text-sm text-muted-foreground print:hidden">
              <p>
                {filtradas.length} pessoa{filtradas.length !== 1 && "s"} · {c.vai} vão · {c.nao} não vão · {c.sem} sem marcação
              </p>
              <button onClick={() => { acesso.limpar(); setRecusa(null); }} className="shrink-0 font-semibold text-primary hover:underline">
                Ocultar nomes
              </button>
            </div>

            {/* Cards (celular) */}
            <ul className="space-y-2 md:hidden print:hidden">
              {filtradas.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">NIF {l.nif}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", STATUS[l.status].cls)}>{STATUS[l.status].label}</span>
                </li>
              ))}
            </ul>

            {/* Tabela (PC e impressão) */}
            <div className="hidden overflow-hidden rounded-3xl border bg-card md:block print:block print:rounded-none print:border-0">
              <table className="w-full text-left text-sm print:text-[11pt]">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground print:bg-transparent">
                  <tr>
                    <th className="px-5 py-3 print:px-2">#</th>
                    <th className="px-5 py-3 print:px-2">Nome</th>
                    <th className="px-5 py-3 print:px-2">NIF</th>
                    <th className="px-5 py-3 print:px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((l, i) => (
                    <tr key={l.id} className="border-t transition hover:bg-muted/50 print:break-inside-avoid">
                      <td className="px-5 py-3 tabular-nums text-muted-foreground print:px-2 print:py-1">{i + 1}</td>
                      <td className="px-5 py-3 font-semibold print:px-2 print:py-1">{l.nome}</td>
                      <td className="px-5 py-3 tabular-nums print:px-2 print:py-1">{l.nif}</td>
                      <td className="px-5 py-3 print:px-2 print:py-1">
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold print:p-0 print:text-[11pt]", STATUS[l.status].cls)}>{STATUS[l.status].label}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/** Pedido do código de acesso: os nomes só aparecem para a cozinha e a administração. */
function AcessoNomes({
  mensagem,
  verificando,
  erroDeRede,
  onTentar,
  onEntrar,
}: {
  mensagem: string | null;
  verificando: boolean;
  erroDeRede: unknown;
  onTentar: () => void;
  onEntrar: (codigo: string) => void;
}) {
  const [codigo, setCodigo] = useState("");
  if (erroDeRede) return <EstadoErro erro={erroDeRede} onTentar={onTentar} />;
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (codigo.trim()) onEntrar(codigo.trim());
  };
  return (
    <div className="mt-5 flex flex-col items-center rounded-3xl border bg-card px-6 py-8 text-center animate-rise print:hidden">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-bold">Quem vai almoçar</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Os nomes ficam disponíveis só para a cozinha e a administração. Digite o código de acesso.
      </p>
      <form onSubmit={enviar} className="mt-5 flex w-full max-w-sm flex-col gap-3">
        <input
          type="password"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Código de acesso"
          aria-label="Código de acesso"
          autoComplete="off"
          className="h-14 w-full rounded-2xl bg-muted px-4 text-center text-base font-medium outline-none transition placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40"
        />
        {mensagem && (
          <p role="alert" className="text-sm font-semibold text-accent">
            {mensagem}
          </p>
        )}
        <button
          type="submit"
          disabled={verificando || !codigo.trim()}
          className="h-14 rounded-2xl bg-on px-4 text-base font-bold text-primary-foreground shadow-glow transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60"
        >
          {verificando ? "Verificando…" : "Ver nomes"}
        </button>
      </form>
    </div>
  );
}

/** Relatório de refeições por dia, semana e período, com exportação para Excel e PDF. */
function Relatorio({ codigo }: { codigo: string | null }) {
  const [aberto, setAberto] = useState(false);
  const [preset, setPreset] = useState<Periodo | null>("mes");
  const [{ inicio, fim }, setIntervalo] = useState(() => periodoPronto("mes"));
  const config = useConfiguracoes();
  const rel = useRelatorio(inicio, fim, codigo, aberto);

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
      <button onClick={() => setAberto((a) => !a)} aria-expanded={aberto} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Relatório de refeições</span>
          <span className="block text-xs text-muted-foreground">Total por dia, semana e período, para o controle de gastos</span>
        </span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition", aberto && "rotate-180")} />
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
                  preset === p.id ? "bg-on text-primary-foreground" : "border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {p.rotulo}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([["De", inicio, (v: string) => setIntervalo({ inicio: v, fim })], ["Até", fim, (v: string) => setIntervalo({ inicio, fim: v })]] as const).map(([rotulo, valor, mudar]) => (
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
            <p role="alert" className="text-sm font-semibold text-accent">A data final precisa ser igual ou depois da inicial.</p>
          ) : rel.isError ? (
            <EstadoErro erro={rel.error} onTentar={() => rel.refetch()} />
          ) : rel.data && !rel.data.ok ? (
            <p role="alert" className="text-sm font-semibold text-accent">
              {rel.data.motivo === "periodo_invalido" ? "Escolha um período de até 400 dias." : MENSAGEM_RECUSA[rel.data.motivo]}
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
                  <p className="text-xs font-medium opacity-75">refeições de {formatarData(inicio)} a {formatarData(fim)}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold">Por semana</p>
                  <ul className="max-h-72 space-y-2 overflow-y-auto">
                    {semanas.map((s) => (
                      <li key={s.inicio} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
                        <div>
                          <p className="font-semibold">{formatarDiaMes(s.inicio)} a {formatarDiaMes(s.fim)}</p>
                          <p className="text-xs text-muted-foreground">{s.dias.length} dia{s.dias.length !== 1 && "s"} úteis</p>
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
                      <li key={d.data} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3">
                        <p className="font-semibold">
                          {formatarDiaMes(d.data)} <span className="font-normal text-muted-foreground">· {nomeDoDia(d.data)}</span>
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
