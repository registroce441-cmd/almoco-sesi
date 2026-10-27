import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Sessão de mentira: começa logada como admin; signOut apaga a sessão.
let logado = true;
const signOut = vi.fn(async () => {
  logado = false;
  return { error: null };
});
vi.mock("@/integrations/supabase/client", () => ({
  supabaseConfigurado: true,
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: logado ? { user: { email: "admin@sesi.local" } } : null },
        error: null,
      }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut,
    },
    rpc: async () => ({ data: true, error: null }),
  }),
}));

import { useAdminSessao, useSairAdmin } from "@/hooks/use-admin";

/** Imita o guarda de rota: um componente que SÓ lê a sessão, separado do botão que faz o logout. */
function Guarda() {
  const s = useAdminSessao();
  return <p data-testid="estado">{s.isPending ? "carregando" : s.data?.status}</p>;
}
function BotaoSair() {
  const sair = useSairAdmin();
  return <button onClick={() => sair.mutate()}>Sair</button>;
}

describe("sessão do admin", () => {
  beforeEach(() => {
    logado = true;
    signOut.mockClear();
  });

  it("Sair derruba o guarda de rota para 'anônimo' (regressão: com qc.clear() a tela ficava presa)", async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <Guarda />
        <BotaoSair />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("admin"));
    await act(async () => {
      fireEvent.click(screen.getByText("Sair"));
    });
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("anonimo"));
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("Sair apaga do cache os dados do painel (nada fica na memória para o próximo usuário)", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["admin", "pessoas"], [{ nome: "Ana", nif: "1" }]);
    qc.setQueryData(["admin", "historico"], [{ motivo: "segredo" }]);
    render(
      <QueryClientProvider client={qc}>
        <Guarda />
        <BotaoSair />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("admin"));
    await act(async () => {
      fireEvent.click(screen.getByText("Sair"));
    });
    await waitFor(() => expect(screen.getByTestId("estado").textContent).toBe("anonimo"));
    expect(qc.getQueryData(["admin", "pessoas"])).toBeUndefined();
    expect(qc.getQueryData(["admin", "historico"])).toBeUndefined();
  });
});
