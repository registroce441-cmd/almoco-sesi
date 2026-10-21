import { CloudOff, RefreshCw } from "lucide-react";
import { mensagemDeErro } from "@/lib/erros";

/** Aviso amigável de erro, no mesmo estilo dos cards do app. */
export function EstadoErro({ erro, onTentar }: { erro: unknown; onTentar?: () => void }) {
  return (
    <div role="alert" className="mt-8 flex flex-col items-center rounded-3xl border bg-card px-6 py-10 text-center animate-rise">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/12 text-accent">
        <CloudOff className="h-7 w-7" />
      </div>
      <p className="mt-4 text-lg font-bold">Ops, algo deu errado</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{mensagemDeErro(erro)}</p>
      {onTentar && (
        <button
          onClick={onTentar}
          className="mt-5 flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card px-5 text-sm font-semibold transition hover:bg-muted active:scale-[.97]"
        >
          <RefreshCw className="h-4 w-4" /> Tentar de novo
        </button>
      )}
    </div>
  );
}
