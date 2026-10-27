import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, ChefHat, UtensilsCrossed, Moon, Sun } from "lucide-react";
import { useTema } from "@/lib/theme";

const ITENS = [
  { to: "/", label: "Marcar", icon: CalendarCheck },
  { to: "/cardapio", label: "Cardápio", icon: UtensilsCrossed },
  { to: "/lista", label: "Cozinha", icon: ChefHat },
] as const;

export function AppNav() {
  const { dark, toggle } = useTema();
  const noPainel = useRouterState({ select: (s) => s.location.pathname.startsWith("/admin") });
  // O painel do administrador tem a própria navegação.
  if (noPainel) return null;
  return (
    <>
      {/* Desktop: topo */}
      <nav className="sticky top-0 z-40 hidden border-b bg-glass backdrop-blur-xl md:block print:hidden">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-6">
          <div className="mr-4 grid h-9 w-9 place-items-center rounded-xl border border-dashed text-[9px] font-bold uppercase text-muted-foreground">Logo</div>
          <p className="mr-auto font-extrabold">
            Almoço <span className="text-accent">SESI</span>
          </p>
          {ITENS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground data-[status=active]:bg-on data-[status=active]:text-primary-foreground data-[status=active]:shadow-glow"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
          <button onClick={toggle} aria-label="Alternar tema" className="ml-2 grid h-12 w-12 place-items-center rounded-2xl border transition hover:bg-muted">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Celular: barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-glass backdrop-blur-xl md:hidden pb-[env(safe-area-inset-bottom)] print:hidden">
        <div className="grid h-16 grid-cols-3">
          {ITENS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="group flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground data-[status=active]:text-primary"
            >
              <span className="grid h-8 w-14 place-items-center rounded-full transition group-data-[status=active]:bg-primary/12">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
