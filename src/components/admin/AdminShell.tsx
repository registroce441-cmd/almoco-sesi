import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarCheck,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Shield,
  Sun,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useSairAdmin } from "@/hooks/use-admin";
import { useTema } from "@/lib/theme";

const ITENS = [
  { to: "/admin", label: "Painel", curto: "Painel", icon: LayoutDashboard, exato: true },
  { to: "/admin/pessoas", label: "Pessoas", curto: "Pessoas", icon: Users, exato: false },
  {
    to: "/admin/cardapio",
    label: "Cardápio",
    curto: "Cardápio",
    icon: UtensilsCrossed,
    exato: false,
  },
  {
    to: "/admin/marcacoes",
    label: "Marcações",
    curto: "Marcações",
    icon: CalendarCheck,
    exato: false,
  },
  { to: "/admin/relatorio", label: "Relatório", curto: "Relatório", icon: BarChart3, exato: false },
  {
    to: "/admin/configuracoes",
    label: "Configurações",
    curto: "Ajustes",
    icon: Settings,
    exato: false,
  },
] as const;

/** Menu lateral (PC) e abas inferiores (celular), no mesmo estilo da navegação do app. */
export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const { dark, toggle } = useTema();
  const sair = useSairAdmin();
  return (
    <div className="min-h-dvh-screen bg-background md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-glass backdrop-blur-xl md:flex print:hidden">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-dashed text-[9px] font-bold uppercase text-muted-foreground">
            Logo
          </div>
          <div className="min-w-0">
            <p className="font-extrabold leading-none">
              Almoço <span className="text-accent">SESI</span>
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Administração
            </p>
          </div>
        </div>
        <nav
          aria-label="Painel do administrador"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
        >
          {ITENS.map(({ to, label, icon: Icon, exato }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: exato }}
              className="flex h-12 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground data-[status=active]:bg-on data-[status=active]:text-primary-foreground data-[status=active]:shadow-glow"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <p className="truncate px-4 pb-1 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
          <Link
            to="/"
            className="flex h-11 items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" /> Ver o app
          </Link>
          <button
            onClick={toggle}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{" "}
            {dark ? "Tema claro" : "Tema escuro"}
          </button>
          <button
            onClick={() => sair.mutate()}
            disabled={sair.isPending}
            className="flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {children}

      <nav
        aria-label="Painel do administrador"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-glass pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden print:hidden"
      >
        <div className="grid h-16 grid-cols-6">
          {ITENS.map(({ to, curto, icon: Icon, exato }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: exato }}
              className="group flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-tight text-muted-foreground data-[status=active]:text-primary"
            >
              <span className="grid h-8 w-10 place-items-center rounded-full transition group-data-[status=active]:bg-primary/12">
                <Icon className="h-5 w-5" />
              </span>
              {curto}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Botão "Sair" para a barra do celular (no PC o Sair fica no menu lateral). */
function BotaoSairCelular() {
  const sair = useSairAdmin();
  return (
    <button
      onClick={() => sair.mutate()}
      disabled={sair.isPending}
      aria-label="Sair do painel"
      className="grid h-12 w-12 place-items-center rounded-2xl border border-header-foreground/15 bg-header-foreground/10 backdrop-blur transition active:scale-95 disabled:opacity-60 md:hidden"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}

/** Cabeçalho (hero) das telas do painel. */
export function AdminHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <PageHeader
      eyebrow={
        eyebrow ?? (
          <>
            <Shield className="h-3.5 w-3.5 text-accent" /> Painel do administrador
          </>
        )
      }
      title={title}
      acoes={<BotaoSairCelular />}
    >
      {children}
    </PageHeader>
  );
}
