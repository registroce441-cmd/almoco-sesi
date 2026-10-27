import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { EstadoErro } from "@/components/EstadoErro";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useAdminSessao, useSairAdmin } from "@/hooks/use-admin";
import { useTema } from "@/lib/theme";

// Rota protegida: tudo em /admin/* (menos /admin/login) exige estar logado COMO administrador.
// "ssr: false" porque a sessão vive no navegador; o servidor nunca sabe quem está logado.
// (A proteção de verdade dos dados é do banco — RLS; esta tela só evita mostrar telas vazias.)
export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel — Almoço SESI" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const sessao = useAdminSessao();
  const { dark } = useTema();

  if (sessao.isPending) return <Carregando />;
  if (sessao.isError) {
    return (
      <div className="min-h-dvh-screen bg-background px-4 pt-16">
        <div className="mx-auto max-w-md">
          <EstadoErro erro={sessao.error} onTentar={() => sessao.refetch()} />
        </div>
      </div>
    );
  }
  const s = sessao.data;
  if (s.status === "anonimo") return <Navigate to="/admin/login" replace />;
  if (s.status === "nao_admin") return <SemPermissao email={s.email} />;

  return (
    <AdminShell email={s.email}>
      <Outlet />
      <Toaster position="top-center" theme={dark ? "dark" : "light"} />
    </AdminShell>
  );
}

function Carregando() {
  return (
    <div
      className="min-h-dvh-screen bg-background"
      aria-busy="true"
      aria-label="Carregando o painel"
    >
      <div className="bg-hero h-56" />
      <div className="mx-auto -mt-8 max-w-5xl space-y-3 px-4 md:px-6">
        <Skeleton className="h-28 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
      </div>
    </div>
  );
}

function SemPermissao({ email }: { email: string }) {
  const sair = useSairAdmin();
  return (
    <div className="min-h-dvh-screen bg-background px-4 pt-16">
      <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border bg-card px-6 py-10 text-center animate-rise">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-accent/12 text-accent">
          <Shield className="h-7 w-7" />
        </div>
        <p className="mt-4 text-lg font-bold">Sem acesso ao painel</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          O usuário {email} está logado, mas não é administrador. Peça para incluí-lo na lista de
          administradores.
        </p>
        <button
          onClick={() => sair.mutate()}
          className="mt-5 flex h-12 items-center justify-center rounded-2xl border bg-card px-5 text-sm font-semibold transition hover:bg-muted active:scale-[.97]"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
