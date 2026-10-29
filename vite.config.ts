import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const bruto = process.env["BASE_PATH"] ?? "/";
const miolo = bruto.replace(/^\/+|\/+$/g, "");
const base = miolo === "" ? "/" : `/${miolo}/`;

function paginasEstaticas(): Plugin {
  let saida = "dist";
  return {
    name: "paginas-estaticas",
    apply: "build",
    configResolved(config) {
      saida = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml: {
      order: "post",
      handler: () => [
        { tag: "link", attrs: { rel: "icon", href: `${base}favicon.ico`, type: "image/x-icon" }, injectTo: "head" },
        { tag: "link", attrs: { rel: "manifest", href: `${base}manifest.webmanifest` }, injectTo: "head" },
        { tag: "link", attrs: { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` }, injectTo: "head" },
      ],
    },
    closeBundle() {
      const indice = path.join(saida, "index.html");
      if (!existsSync(indice)) return;
      copyFileSync(indice, path.join(saida, "404.html"));
      writeFileSync(path.join(saida, ".nojekyll"), "");
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    paginasEstaticas(),
  ],
  server: { port: 8080 },
  build: { outDir: "dist" },
});