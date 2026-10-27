import type { ReactNode } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campos: mesmo desenho dos campos da Lista (borda, cantos grandes, 16px para o iPhone não dar zoom). */
export const CLASSE_CAMPO =
  "h-12 w-full rounded-2xl border bg-card px-4 text-base outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 disabled:opacity-60";
/** Campo grande, como o de busca da Home. */
export const CLASSE_CAMPO_GRANDE =
  "h-14 w-full rounded-2xl bg-muted px-4 text-base font-medium text-card-foreground outline-none transition placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-ring/40";
export const CLASSE_BOTAO_SECUNDARIO =
  "flex h-12 items-center justify-center gap-2 rounded-2xl border bg-card px-5 text-sm font-semibold transition hover:bg-muted active:scale-[.97] disabled:pointer-events-none disabled:opacity-60";
export const CLASSE_BOTAO_PRIMARIO =
  "flex h-12 items-center justify-center gap-2 rounded-2xl bg-on px-5 text-sm font-semibold text-primary-foreground shadow-glow transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60";
export const CLASSE_BOTAO_SUCESSO =
  "flex h-12 items-center justify-center gap-2 rounded-2xl bg-success px-5 text-sm font-semibold text-success-foreground transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60";

/** Seção em cartão, no estilo do "Relatório de refeições" da Lista. */
export function Cartao({
  icone,
  titulo,
  descricao,
  children,
  className,
}: {
  icone?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl border bg-card animate-rise", className)}>
      <header className="flex items-center gap-3 p-4 pb-0 md:p-5 md:pb-0">
        {icone && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            {icone}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{titulo}</h2>
          {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        </div>
      </header>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

export function Rotulo({
  children,
  dica,
  ...rest
}: {
  children: ReactNode;
  dica?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="block" {...rest}>
      <span className="text-xs font-semibold text-muted-foreground">{children}</span>
      {dica && <span className="ml-1 text-xs text-muted-foreground/70">{dica}</span>}
    </label>
  );
}

export function Aviso({
  children,
  tipo = "erro",
}: {
  children: ReactNode;
  tipo?: "erro" | "info" | "ok";
}) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={cn(
        "rounded-2xl px-4 py-3 text-sm font-semibold",
        tipo === "erro" && "bg-accent/12 text-accent",
        tipo === "info" && "bg-primary/10 text-primary",
        tipo === "ok" && "bg-success/15 text-success",
      )}
    >
      {children}
    </p>
  );
}

export function Girando({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden />;
}

/**
 * Barra fixa de salvar (mesmo desenho da barra "Confirmar marcação" da Home).
 * No celular fica acima das abas de navegação; no PC, ao lado do menu lateral.
 */
export function BarraSalvar({
  visivel,
  resumo,
  detalhe,
  salvando,
  erro,
  onSalvar,
  onDescartar,
  rotulo = "Salvar alterações",
}: {
  visivel: boolean;
  resumo: ReactNode;
  detalhe?: ReactNode;
  salvando: boolean;
  erro?: string | null;
  onSalvar: () => void;
  onDescartar: () => void;
  rotulo?: string;
}) {
  if (!visivel) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 animate-rise md:bottom-0 md:left-64 md:pb-safe print:hidden">
      {erro && (
        <p
          role="alert"
          className="mx-auto mb-2 max-w-3xl rounded-2xl border bg-card px-4 py-3 text-sm font-semibold text-accent shadow-lg"
        >
          {erro}
        </p>
      )}
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-3xl border bg-glass p-2.5 pl-4 shadow-2xl backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-extrabold leading-tight">{resumo}</p>
          {detalhe && (
            <p className="hidden truncate text-xs text-muted-foreground md:block">{detalhe}</p>
          )}
        </div>
        <button
          onClick={onDescartar}
          disabled={salvando}
          aria-label="Descartar as alterações"
          className="grid h-14 w-12 shrink-0 place-items-center rounded-2xl text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-60 md:w-auto md:px-3"
        >
          <Undo2 className="h-5 w-5 md:hidden" aria-hidden />
          <span className="hidden md:inline">Descartar</span>
        </button>
        <button
          onClick={onSalvar}
          disabled={salvando}
          className="shimmer flex h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-cta px-5 text-base font-bold text-accent-foreground shadow-glow-accent transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-60"
        >
          {salvando ? (
            <>
              <Girando /> Salvando…
            </>
          ) : (
            rotulo
          )}
        </button>
      </div>
    </div>
  );
}
