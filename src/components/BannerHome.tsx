import { useEffect, useState } from "react";
import { Clock, Megaphone } from "lucide-react";
import { statusDoPrazo, type RegrasDePrazo } from "@/lib/almoco-data";
import { cn } from "@/lib/utils";

type Config = (RegrasDePrazo & { aviso_home: string | null }) | undefined;

const duracao = (min: number) => {
  if (min <= 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
};

/** Aviso da administração e situação do prazo de hoje (vêm das Configurações). */
export function BannerHome({ config }: { config: Config }) {
  // O relógio só existe no navegador: evita diferença entre servidor e tela na hora de montar.
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const aviso = config?.aviso_home?.trim();
  const prazo = agora ? statusDoPrazo(config, agora) : null;
  if (!aviso && !prazo) return null;

  const urgente = prazo?.tipo === "aberto" && prazo.faltam <= 30;
  return (
    <div className="relative z-20 mb-3 space-y-2">
      {aviso && (
        <div
          role="status"
          className="flex gap-3 rounded-3xl border bg-card p-4 shadow-glow animate-rise"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent">
            <Megaphone className="h-5 w-5" />
          </span>
          <p className="min-w-0 flex-1 self-center whitespace-pre-line break-words text-sm font-semibold">
            {aviso}
          </p>
        </div>
      )}
      {prazo && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-3xl border p-3 pr-4 text-sm font-semibold animate-rise",
            prazo.tipo === "aberto" && !urgente && "border-transparent bg-success/15 text-success",
            urgente && "border-transparent bg-accent/12 text-accent",
            (prazo.tipo === "encerrado" || prazo.tipo === "sem-almoco" || prazo.tipo === "geral") &&
              "bg-card text-muted-foreground",
          )}
        >
          <Clock className="h-5 w-5 shrink-0" />
          <p>
            {prazo.tipo === "aberto" && (
              <>
                Marque o almoço de hoje até as {prazo.prazo} · faltam {duracao(prazo.faltam)}
              </>
            )}
            {prazo.tipo === "encerrado" && (
              <>
                O prazo de hoje encerrou às {prazo.prazo}. Para mudar o de hoje, fale com a
                administração.
              </>
            )}
            {prazo.tipo === "sem-almoco" && <>Hoje não haverá almoço.</>}
            {prazo.tipo === "geral" && (
              <>Cada dia pode ser marcado até as {prazo.prazo} do próprio dia.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
