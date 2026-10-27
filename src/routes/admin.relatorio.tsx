import { createFileRoute } from "@tanstack/react-router";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Relatorio } from "@/components/Relatorio";

export const Route = createFileRoute("/admin/relatorio")({ component: RelatorioAdmin });

function RelatorioAdmin() {
  return (
    <div className="min-h-dvh-screen bg-background pb-28 md:pb-12">
      <AdminHeader title="Relatório">
        <p className="mt-2 text-sm opacity-80">
          Refeições por dia, semana e período, com Excel e PDF.
        </p>
      </AdminHeader>
      <main className="relative mx-auto -mt-8 max-w-5xl px-4 md:px-6">
        <Relatorio comoAdmin inicialmenteAberto />
      </main>
    </div>
  );
}
