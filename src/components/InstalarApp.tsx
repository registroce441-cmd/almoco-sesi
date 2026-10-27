import { Download, Share, SquarePlus, X } from "lucide-react";
import { useInstalacao } from "@/lib/pwa";

/** Convite "Adicionar à tela inicial": botão no Android, instruções no iPhone. Some para sempre depois de fechado. */
export function InstalarApp() {
  const { modo, instalar, fechar } = useInstalacao();
  if (modo === "nenhum") return null;

  return (
    <section
      aria-label="Instalar o aplicativo"
      className="relative z-20 mb-3 rounded-3xl border bg-card p-4 shadow-glow animate-rise"
    >
      <div className="flex items-start gap-3">
        <img
          src="/icon-192.png"
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">Adicione à tela inicial</p>
          {modo === "android" ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Abra o Almoço SESI como um aplicativo, direto do celular.
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Toque em <Share className="inline h-4 w-4 align-[-3px]" aria-hidden />{" "}
              <strong className="text-foreground">Compartilhar</strong> e depois em{" "}
              <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden />{" "}
              <strong className="text-foreground">Adicionar à Tela de Início</strong>.
            </p>
          )}
        </div>
        <button
          onClick={fechar}
          aria-label="Fechar o convite"
          className="-mr-2 -mt-2 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-muted-foreground transition hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {modo === "android" && (
        <div className="mt-3 grid grid-cols-[1fr_1.5fr] gap-2">
          <button
            onClick={fechar}
            className="h-12 rounded-2xl text-sm font-semibold text-muted-foreground transition hover:bg-muted"
          >
            Agora não
          </button>
          <button
            onClick={() => void instalar()}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-on text-sm font-semibold text-primary-foreground shadow-glow transition active:scale-[.97]"
          >
            <Download className="h-4 w-4" /> Instalar
          </button>
        </div>
      )}
    </section>
  );
}
