import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BellRing, CalendarDays, ChevronDown, Percent, UtensilsCrossed, Users } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Cartao } from "@/components/admin/ui";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import { useListaAdmin, usePessoasAdmin } from "@/hooks/use-admin-pessoas";
import { estatisticasSemana } from "@/lib/admin-data";
import { diasDaSemana, isoData, segundaDaSemana } from "@/lib/almoco-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({ component: Painel });

const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const PENDENTES_VISIVEIS = 8;

function Painel() {
  const seg = useMemo(() => segundaDaSemana(), []);
  const dias = useMemo(() => diasDaSemana(seg), [seg]);
  const isos = useMemo(() => dias.map(isoData), [dias]);
  const lista = useListaAdmin(seg);
  const cadastradas = usePessoasAdmin();
  const [todos, setTodos] = useState(false);

  const stats = useMemo(() => estatisticasSemana(lista.data ?? [], isos), [lista.data, isos]);
  const hoje = isoData(new Date());
  // Fim de semana: não há "hoje" útil, então o destaque é o primeiro dia da semana que vem.
  const foco = Math.max(0, isos.indexOf(hoje));
  const ehHoje = isos[foco] === hoje;
  const carregando = lista.isLoading;
  const semGente = lista.isSuccess && stats.ativas === 0;
  const pendentes = todos ? stats.pendentes : stats.pendentes.slice(0, PENDENTES_VISIVEIS);

  const grafico = dias.map((d, i) => ({
    dia: NOMES[i]!.slice(0, 3),
    total: stats.porDia[i] ?? 0,
    destaque: i === foco,
  }));

  return (
    <div className="min-h-dvh-screen bg-background pb-28 md:pb-12">
      <AdminHeader title="Visão geral">
        <p className="mt-2 text-sm opacity-80">
          Semana {fmt(dias[0]!)} – {fmt(dias[4]!)}
        </p>
      </AdminHeader>

      <main className="relative mx-auto -mt-8 max-w-5xl space-y-4 px-4 md:px-6">
        {lista.isError ? (
          <EstadoErro erro={lista.error} onTentar={() => lista.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                destaque
                icone={<UtensilsCrossed className="h-5 w-5" />}
                valor={carregando ? "–" : stats.porDia[foco]}
                rotulo={ehHoje ? "Refeições hoje" : `Refeições na ${NOMES[foco]!.toLowerCase()}`}
                atraso={0}
              />
              <Kpi
                icone={<CalendarDays className="h-5 w-5" />}
                valor={carregando ? "–" : stats.totalSemana}
                rotulo="Previsão da semana"
                atraso={60}
              />
              <Kpi
                icone={<Percent className="h-5 w-5" />}
                valor={carregando ? "–" : `${stats.adesao}%`}
                rotulo={
                  carregando
                    ? "Adesão"
                    : `Adesão · ${stats.responderam} de ${stats.ativas} marcaram`
                }
                atraso={120}
              />
              <Kpi
                icone={<Users className="h-5 w-5" />}
                valor={cadastradas.data ? cadastradas.data.length : "–"}
                rotulo={
                  cadastradas.data
                    ? `Pessoas · ${cadastradas.data.filter((p) => p.ativo).length} ativas`
                    : "Pessoas"
                }
                atraso={180}
              />
            </div>

            {semGente ? (
              <Cartao
                icone={<Users className="h-5 w-5" />}
                titulo="Nenhuma pessoa cadastrada ainda"
              >
                <p className="text-sm text-muted-foreground">
                  Importe a planilha de colaboradores (só nome e NIF) para começar a receber
                  marcações.
                </p>
                <Link
                  to="/admin/pessoas"
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-on px-5 text-sm font-semibold text-primary-foreground shadow-glow transition active:scale-[.97] md:w-auto md:max-w-xs"
                >
                  Ir para Pessoas
                </Link>
              </Cartao>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <Cartao
                  icone={<CalendarDays className="h-5 w-5" />}
                  titulo="Refeições por dia"
                  descricao={`Total da semana: ${stats.totalSemana}`}
                >
                  {carregando ? (
                    <Skeleton className="h-56 rounded-2xl" />
                  ) : (
                    <div
                      className="h-56 w-full"
                      role="img"
                      aria-label={`Refeições por dia: ${grafico.map((g) => `${g.dia} ${g.total}`).join(", ")}`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={grafico}
                          margin={{ top: 22, right: 4, left: -22, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="dia"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fill: "var(--muted-foreground)",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <YAxis
                            allowDecimals={false}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                          />
                          <Tooltip
                            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                            formatter={(v) => [`${v} refeições`, ""]}
                            separator=""
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--border)",
                              borderRadius: 12,
                              fontSize: 13,
                            }}
                          />
                          <Bar
                            dataKey="total"
                            radius={[10, 10, 4, 4]}
                            isAnimationActive={false}
                            maxBarSize={56}
                          >
                            {grafico.map((g) => (
                              <Cell
                                key={g.dia}
                                style={{ fill: g.destaque ? "var(--accent)" : "var(--primary)" }}
                              />
                            ))}
                            <LabelList
                              dataKey="total"
                              position="top"
                              style={{ fill: "var(--foreground)", fontSize: 13, fontWeight: 800 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Cartao>

                <Cartao
                  icone={<BellRing className="h-5 w-5" />}
                  titulo="Ainda não marcaram"
                  descricao={
                    carregando
                      ? "Carregando…"
                      : stats.pendentes.length === 0
                        ? "Todo mundo já respondeu"
                        : `${stats.pendentes.length} pessoa${stats.pendentes.length !== 1 ? "s" : ""} sem nenhuma marcação nesta semana`
                  }
                >
                  {carregando ? (
                    <div className="space-y-2">
                      <Skeleton className="h-11 rounded-2xl" />
                      <Skeleton className="h-11 rounded-2xl" />
                      <Skeleton className="h-11 rounded-2xl" />
                    </div>
                  ) : stats.pendentes.length === 0 ? (
                    <p className="rounded-2xl bg-success/15 px-4 py-3 text-sm font-semibold text-success">
                      Nenhuma pendência. 🎉
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-2">
                        {pendentes.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-3 rounded-2xl border bg-card px-3 py-2.5"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-on text-xs font-bold text-primary-foreground">
                              {p.nome
                                .split(" ")
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((s) => s[0])
                                .join("")}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{p.nome}</span>
                              <span className="block text-xs text-muted-foreground">
                                NIF {p.nif}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {stats.pendentes.length > PENDENTES_VISIVEIS && (
                        <button
                          onClick={() => setTodos((t) => !t)}
                          className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                        >
                          {todos ? "Mostrar menos" : `Ver todas (${stats.pendentes.length})`}
                          <ChevronDown
                            className={cn("h-4 w-4 transition", todos && "rotate-180")}
                          />
                        </button>
                      )}
                    </>
                  )}
                </Cartao>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({
  icone,
  valor,
  rotulo,
  destaque,
  atraso,
}: {
  icone: React.ReactNode;
  valor: React.ReactNode;
  rotulo: string;
  destaque?: boolean;
  atraso: number;
}) {
  return (
    <div
      style={{ animationDelay: `${atraso}ms` }}
      className={cn(
        "rounded-3xl border p-4 animate-rise",
        destaque ? "border-transparent bg-on text-primary-foreground shadow-glow" : "bg-card",
      )}
    >
      <span className={cn("opacity-70", !destaque && "text-muted-foreground")}>{icone}</span>
      <p className="mt-2 text-3xl font-extrabold tabular-nums">{valor}</p>
      <p className={cn("text-xs font-medium", destaque ? "opacity-75" : "text-muted-foreground")}>
        {rotulo}
      </p>
    </div>
  );
}
