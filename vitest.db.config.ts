import { defineConfig } from "vitest/config";

// Testes do BANCO (Postgres local). Separados dos testes de tela: `npm test` não precisa de Postgres.
//   npm run test:db
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
