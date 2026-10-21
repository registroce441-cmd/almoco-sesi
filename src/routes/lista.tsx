import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChefHat, Printer, FileSpreadsheet, Search, Users, Briefcase, Bot, CircleHelp, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { diasDaSemana, isoData, segundaDaSemana, type Grupo } from "@/lib/almoco-data";
import { listaDoDia, totais, type Status } from "@/lib/lista-data";
import { usePessoas } from "@/hooks/use-pessoas";
import { useMarcacoesDaSemana } from "@/hooks/use-marcacoes";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lista")({
  head: () => ({
    meta: [
      { title: "Lista de Almoço (Cozinha) — Almoço SESI" },
      { name: "description", content: "Totais e lista de quem vai almoçar em cada dia, para a cozinha." },
      { property: "og:title", content: "Lista de Almoço — Almoço SESI" },
      { property: "og:description", content: "Quantos almoços preparar por dia, com impressão e exportação." },
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
  const [grupo, setGrupo] = useState<"Todos" | Grupo>("Todos");
  const pessoas = usePessoas();
  const marcacoes = useMarcacoesDaSemana(seg); // tempo real: atualiza sozinha quando alguém marca
  const carregando = pessoas.isLoading || marcacoes.isLoading;
  const erro = pessoas.error ?? marcacoes.error;
  const linhas = useMemo(
    () => listaDoDia(pessoas.data ?? [], marcacoes.data ?? new Map(), isoData(dias[dia]!)),
    [pessoas.data, marcacoes.data, dias, dia],
  );

  useEffect(() => {
    const dow = new Date().getDay();
    if (dow >= 1 && dow <= 5) setDia(dow - 1);
  }, []);

  const t = totais(linhas);
  const filtradas = linhas.filter((l) => {
    const s = q.trim().toLowerCase();
    return (grupo === "Todos" || l.grupo === grupo) && (!s || l.nome.toLowerCase().includes(s) || (l.nif ?? "").includes(s));
  });

  const exportar = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(filtradas.map((l) => ({ Nome: l.nome, NIF: l.nif ?? "", Grupo: l.grupo, Status: STATUS[l.status].label })));
    ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 15 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, NOMES[dia]!);
    XLSX.writeFile(wb, `almoco-${NOMES[dia]!.toLowerCase()}-${fmt(dias[dia]!).replace("/", "-")}.xlsx`);
  };

  const CARDS = [
    { label: "Total de almoços", v: t.total, icon: Users, cls: "bg-on text-primary-foreground shadow-glow" },
    { label: "Funcionários", v: t.funcionarios, icon: Briefcase, cls: "bg-card" },
    { label: "Alunos", v: t.alunos, icon: Bot, cls: "bg-card" },
    { label: "Sem marcação", v: t.sem, icon: CircleHelp, cls: "bg-card" },
  ];

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

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Almoço SESI — Lista de {NOMES[dia]} ({fmt(dias[dia]!)})</h1>
        <p className="mt-1 text-sm">Total: {t.total} · Funcionários: {t.funcionarios} · Alunos: {t.alunos} · Sem marcação: {t.sem}</p>
      </div>

      <main className="relative mx-auto -mt-8 max-w-5xl px-4 md:px-6 print:m-0 print:max-w-none print:p-0">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
          {CARDS.map(({ label, v, icon: Icon, cls }, i) => (
            <div key={label} style={{ animationDelay: `${i * 60}ms` }} className={cn("rounded-3xl border p-4 animate-rise", cls)}>
              <Icon className="h-5 w-5 opacity-70" />
              <p className="mt-3 text-3xl font-extrabold tabular-nums">{carregando ? "–" : v}</p>
              <p className="text-xs font-medium opacity-75">{label}</p>
            </div>
          ))}
        </div>

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
          <div className="grid grid-cols-3 gap-1 rounded-2xl border bg-card p-1">
            {(["Todos", "Colaboradores", "Robótica"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGrupo(g)}
                className={cn("h-10 rounded-xl px-3 text-sm font-semibold transition", grupo === g ? "bg-on text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
              >
                {g === "Colaboradores" ? "Funcionários" : g === "Robótica" ? "Alunos" : g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:flex md:justify-end print:hidden">
          <button onClick={() => window.print()} className="flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card px-5 text-sm font-semibold transition hover:bg-muted active:scale-[.97]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={exportar} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-success px-5 text-sm font-semibold text-success-foreground transition active:scale-[.97]">
            <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
          </button>
        </div>

        {erro ? (
          <EstadoErro erro={erro} onTentar={() => { void pessoas.refetch(); void marcacoes.refetch(); }} />
        ) : carregando ? (
          <div className="mt-5 space-y-2" aria-busy="true" aria-label="Carregando a lista">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            <p className="mt-5 mb-2 text-sm text-muted-foreground print:hidden">{filtradas.length} pessoa{filtradas.length !== 1 && "s"} · ordem alfabética</p>

            {/* Cards (celular) */}
            <ul className="space-y-2 md:hidden print:hidden">
              {filtradas.map((l) => (
                <li key={l.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">{l.nif ? `NIF ${l.nif} · ` : ""} {l.grupo === "Robótica" ? "Aluno" : "Funcionário"}</p>
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
                    <th className="px-5 py-3 print:px-2">Grupo</th>
                    <th className="px-5 py-3 print:px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((l, i) => (
                    <tr key={l.id} className="border-t transition hover:bg-muted/50 print:break-inside-avoid">
                      <td className="px-5 py-3 tabular-nums text-muted-foreground print:px-2 print:py-1">{i + 1}</td>
                      <td className="px-5 py-3 font-semibold print:px-2 print:py-1">{l.nome}</td>
                      <td className="px-5 py-3 tabular-nums print:px-2 print:py-1">{l.nif ?? "—"}</td>
                      <td className="px-5 py-3 print:px-2 print:py-1">{l.grupo === "Robótica" ? "Aluno (Robótica)" : "Funcionário"}</td>
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
