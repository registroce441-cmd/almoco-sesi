import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Leaf, Salad, IceCreamCone, Share2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { diasDaSemana, segundaDaSemana } from "@/lib/almoco-data";
import { useCardapio } from "@/hooks/use-cardapio";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio da Semana — Almoço SESI" },
      { name: "description", content: "Veja o cardápio de segunda a sexta do almoço SESI." },
      { property: "og:title", content: "Cardápio da Semana — Almoço SESI" },
      { property: "og:description", content: "Prato, acompanhamento e sobremesa de cada dia da semana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Cardapio,
});

const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const TAG_PADRAO = "bg-muted text-muted-foreground";
const TAG_ESTILO: Record<string, string> = {
  Vegetariano: "bg-success/15 text-success",
  "Sem glúten": "bg-accent/12 text-accent",
  "Sem lactose": "bg-primary/10 text-primary",
  Leve: "bg-muted text-muted-foreground",
};

function Cardapio() {
  const [offset, setOffset] = useState(0);
  const [hoje, setHoje] = useState<Date | null>(null);
  const [ativo, setAtivo] = useState(0);
  useEffect(() => setHoje(new Date()), []);

  const seg = useMemo(() => {
    const s = segundaDaSemana();
    s.setDate(s.getDate() + offset * 7);
    return s;
  }, [offset]);
  const dias = useMemo(() => diasDaSemana(seg), [seg]);
  const cardapio = useCardapio(seg);
  const menu = cardapio.data;
  const idxHoje = hoje ? dias.findIndex((d) => d.toDateString() === hoje.toDateString()) : -1;

  useEffect(() => setAtivo(idxHoje >= 0 ? idxHoje : 0), [idxHoje, offset]);

  const irPara = (i: number) => {
    setAtivo(i);
    document.getElementById(`dia-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const compartilhar = () => {
    if (!menu) return;
    const linhas = menu.flatMap((m, i) => (m ? [`*${NOMES[i]} (${fmt(dias[i]!)})*\n🍽️ ${m.prato}\n🥗 ${m.acompanhamento}\n🍮 ${m.sobremesa}`] : []));
    if (linhas.length === 0) return;
    const texto = `*Cardápio SESI — ${fmt(dias[0]!)} a ${fmt(dias[4]!)}*\n\n${linhas.join("\n\n")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  return (
    <div className="min-h-dvh-screen bg-background pb-28 md:pb-12">
      <PageHeader
        eyebrow={<><Sparkles className="h-3.5 w-3.5 text-accent" /> {offset === 0 ? "Esta semana" : offset > 0 ? `Daqui a ${offset} semana${offset > 1 ? "s" : ""}` : `${-offset} semana${offset < -1 ? "s" : ""} atrás`}</>}
        title="Cardápio da Semana"
      >
        <div className="mt-5 flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Semana anterior" className="grid h-12 w-12 place-items-center rounded-2xl border border-header-foreground/15 bg-header-foreground/10 backdrop-blur active:scale-95">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-header-foreground/10 text-sm font-bold backdrop-blur sm:flex-none sm:px-6">
            {fmt(dias[0]!)} – {fmt(dias[4]!)}
          </div>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Próxima semana" className="grid h-12 w-12 place-items-center rounded-2xl border border-header-foreground/15 bg-header-foreground/10 backdrop-blur active:scale-95">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </PageHeader>

      <main className="relative mx-auto -mt-8 max-w-5xl px-4 md:px-6">
        {/* Chips (celular) */}
        <div className="sticky top-0 z-20 -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-2 pt-safe md:hidden [scrollbar-width:none]">
          {dias.map((d, i) => (
            <button
              key={i}
              onClick={() => irPara(i)}
              className={cn(
                "flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold shadow-sm transition",
                ativo === i ? "border-transparent bg-on text-primary-foreground shadow-glow" : "bg-card",
              )}
            >
              {NOMES[i]!.slice(0, 3)} <span className="opacity-70">{d.getDate()}</span>
              {i === idxHoje && <span className="h-2 w-2 rounded-full bg-accent" />}
            </button>
          ))}
        </div>

        {cardapio.isError && <EstadoErro erro={cardapio.error} onTentar={() => cardapio.refetch()} />}
        {cardapio.isLoading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5" aria-busy="true" aria-label="Carregando o cardápio">
            {dias.map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-3xl" />
            ))}
          </div>
        )}
        <div key={offset} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {(menu ?? []).map((m, i) => {
            const isHoje = i === idxHoje;
            return (
              <article
                id={`dia-${i}`}
                key={i}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cn(
                  "relative flex scroll-mt-24 flex-col overflow-hidden rounded-3xl border p-5 animate-rise",
                  isHoje ? "border-transparent bg-on text-primary-foreground shadow-glow lg:-translate-y-2" : "bg-card",
                )}
              >
                <span className={cn("pointer-events-none absolute -right-3 -top-6 text-8xl font-black", isHoje ? "opacity-15" : "opacity-[.05]")}>{dias[i]!.getDate()}</span>
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-lg font-extrabold">{NOMES[i]}</p>
                    <p className={cn("text-sm", isHoje ? "opacity-80" : "text-muted-foreground")}>{fmt(dias[i]!)}</p>
                  </div>
                  {isHoje && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-glow-accent">HOJE</span>}
                </div>
                {!m ? (
                  <p className={cn("relative mt-4 text-base font-semibold leading-snug", isHoje ? "opacity-90" : "text-muted-foreground")}>
                    Cardápio ainda não divulgado
                  </p>
                ) : (
                  <>
                    <h3 className="relative mt-4 text-xl font-bold leading-snug lg:text-lg">{m.prato}</h3>
                    <ul className={cn("relative mt-3 space-y-2 text-sm", isHoje ? "opacity-90" : "text-muted-foreground")}>
                      {m.acompanhamento && <li className="flex gap-2"><Salad className="mt-0.5 h-4 w-4 shrink-0" /> {m.acompanhamento}</li>}
                      {m.sobremesa && <li className="flex gap-2"><IceCreamCone className="mt-0.5 h-4 w-4 shrink-0" /> {m.sobremesa}</li>}
                    </ul>
                  </>
                )}
                {m && m.tags.length > 0 && (
                  <div className="relative mt-auto flex flex-wrap gap-1.5 pt-4">
                    {m.tags.map((t) => (
                      <span key={t} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", isHoje ? "bg-primary-foreground/20" : (TAG_ESTILO[t] ?? TAG_PADRAO))}>
                        {t === "Vegetariano" && <Leaf className="h-3 w-3" />} {t}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <button
          onClick={compartilhar}
          disabled={!menu?.some(Boolean)}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-success font-bold text-success-foreground shadow-lg transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-60 md:mx-auto md:w-auto md:px-8"
        >
          <Share2 className="h-5 w-5" /> Compartilhar no WhatsApp
        </button>
      </main>
    </div>
  );
}
