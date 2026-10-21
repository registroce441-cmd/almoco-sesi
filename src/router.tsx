import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ERRO_NAO_CONFIGURADO } from "./lib/erros";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Não adianta tentar de novo se o .env nem foi preenchido.
        retry: (tentativas, erro) => tentativas < 1 && (erro as Error).message !== ERRO_NAO_CONFIGURADO,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
