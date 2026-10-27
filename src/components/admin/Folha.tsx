import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Painel que sobe de baixo no celular e abre na lateral no PC. */
export function Folha({
  aberto,
  onFechar,
  titulo,
  descricao,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  const celular = useIsMobile();
  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent
        side={celular ? "bottom" : "right"}
        // o "X" padrão é pequeno demais para o dedo: escondemos e usamos o nosso, de 48px
        className={cn(
          "flex flex-col gap-0 p-0 [&>button]:hidden",
          celular ? "max-h-[92dvh] rounded-t-3xl" : "w-full sm:max-w-md",
        )}
      >
        <div className="flex items-start gap-3 p-5 pb-3">
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-xl font-extrabold">{titulo}</SheetTitle>
            <SheetDescription className={cn(!descricao && "sr-only")}>
              {descricao ?? titulo}
            </SheetDescription>
          </div>
          <SheetClose
            aria-label="Fechar"
            className="-mr-2 -mt-1 grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </SheetClose>
        </div>
        <div className="flex-1 overflow-y-auto px-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/** Confirmação de ações que mudam muita coisa. */
export function Confirmar({
  aberto,
  titulo,
  descricao,
  children,
  onFechar,
}: {
  aberto: boolean;
  titulo: ReactNode;
  descricao: ReactNode;
  /** Botões de resposta (cada um com h-12, estilo dos botões do painel). */
  children: ReactNode;
  onFechar: () => void;
}) {
  return (
    <AlertDialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-3xl p-6">
        <AlertDialogTitle className="text-xl font-extrabold">{titulo}</AlertDialogTitle>
        <AlertDialogDescription className="mt-2">{descricao}</AlertDialogDescription>
        <div className="mt-5 flex flex-col gap-2">{children}</div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
