import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { InstalarApp } from "@/components/InstalarApp";
import { AvisoOffline } from "@/components/AvisoOffline";
import { CHAVE_INSTALAR_FECHADO, ehIOS } from "@/lib/pwa";

// ---------- Service worker: carrega o arquivo real de public/ ----------
const ORIGEM = "https://app.test";
const mod: {
  exports: { decidir?: (...a: unknown[]) => string; ehAnonimo?: (a?: string) => boolean };
} = { exports: {} };
new Function("module", "self", readFileSync("public/sw.js", "utf8"))(mod, {
  location: { origin: ORIGEM },
  addEventListener() {},
});
const decidir = (url: string, o: { metodo?: string; modo?: string; auth?: string | null } = {}) =>
  mod.exports.decidir!(o.metodo ?? "GET", url, o.modo ?? "cors", o.auth ?? null);
const jwt = (role: string) => `h.${btoa(JSON.stringify({ role })).replace(/=/g, "")}.s`;
const SUPA = "https://xyz.supabase.co";

describe("service worker: o que entra no cache", () => {
  it("guarda o app, as páginas públicas, o cardápio anônimo e as fotos públicas", () => {
    expect(decidir(`${ORIGEM}/`, { modo: "navigate" })).toBe("pagina");
    expect(decidir(`${ORIGEM}/cardapio`, { modo: "navigate" })).toBe("pagina");
    expect(decidir(`${ORIGEM}/assets/index-abc123.js`)).toBe("app");
    expect(decidir(`${ORIGEM}/icon-192.png`)).toBe("app");
    expect(
      decidir(`${SUPA}/rest/v1/cardapio?select=*&data=gte.2026-10-26`, {
        auth: `Bearer ${jwt("anon")}`,
      }),
    ).toBe("cardapio");
    expect(
      decidir(`${SUPA}/rest/v1/cardapio?select=*`, { auth: "Bearer sb_publishable_abc" }),
    ).toBe("cardapio");
    expect(decidir(`${SUPA}/rest/v1/cardapio?select=*`)).toBe("cardapio");
    expect(decidir(`${SUPA}/storage/v1/object/public/cardapio-fotos/2026-10-26/a.jpg`)).toBe(
      "foto",
    );
  });

  it("NUNCA guarda a Lista com nomes, relatório, busca, marcações nem login", () => {
    for (const fn of [
      "lista_cozinha",
      "relatorio_totais",
      "buscar_pessoas",
      "marcacoes_da_pessoa",
      "salvar_marcacoes",
      "totais_por_dia",
    ]) {
      expect(decidir(`${SUPA}/rest/v1/rpc/${fn}`, { auth: `Bearer ${jwt("anon")}` }), fn).toBe(
        "rede",
      );
    }
    expect(decidir(`${SUPA}/rest/v1/rpc/lista_cozinha`, { metodo: "POST" })).toBe("rede");
    expect(decidir(`${SUPA}/auth/v1/token?grant_type=password`, { metodo: "POST" })).toBe("rede");
    expect(decidir(`${SUPA}/rest/v1/configuracoes?select=*`)).toBe("rede");
  });

  it("NUNCA guarda chamadas feitas com o login do administrador, nem tabelas do painel", () => {
    expect(
      decidir(`${SUPA}/rest/v1/cardapio?select=*`, { auth: `Bearer ${jwt("authenticated")}` }),
    ).toBe("rede");
    expect(
      decidir(`${SUPA}/rest/v1/pessoas?select=*`, { auth: `Bearer ${jwt("authenticated")}` }),
    ).toBe("rede");
    expect(
      decidir(`${SUPA}/rest/v1/marcacoes_manuais?select=*`, {
        auth: `Bearer ${jwt("authenticated")}`,
      }),
    ).toBe("rede");
    expect(decidir(`${SUPA}/rest/v1/cardapio?select=*`, { auth: "Bearer token-estranho" })).toBe(
      "rede",
    ); // na dúvida, não guarda
    expect(
      decidir(`${SUPA}/storage/v1/object/cardapio-fotos/x.jpg`, {
        auth: `Bearer ${jwt("authenticated")}`,
      }),
    ).toBe("rede");
  });

  it("páginas /lista e /admin não são guardadas (só têm a página offline de reserva)", () => {
    for (const p of ["/lista", "/admin", "/admin/pessoas", "/admin/login"])
      expect(decidir(`${ORIGEM}${p}`, { modo: "navigate" }), p).toBe("pagina-sem-cache");
  });

  it("qualquer coisa que não seja GET passa direto", () => {
    expect(decidir(`${ORIGEM}/cardapio`, { metodo: "POST", modo: "navigate" })).toBe("rede");
    expect(decidir(`${SUPA}/rest/v1/cardapio`, { metodo: "PATCH" })).toBe("rede");
  });
});


describe("service worker em subpasta (GitHub Pages)", () => {
  const modBase: { exports: { decidir?: (...a: unknown[]) => string } } = { exports: {} };
  new Function("module", "self", readFileSync("public/sw.js", "utf8"))(modBase, {
    location: { origin: ORIGEM, pathname: "/almoco/sw.js" },
    addEventListener() {},
  });
  const d = (url: string, modo = "cors") => modBase.exports.decidir!("GET", url, modo, null);

  it("entende o caminho base nas páginas e nos arquivos do app", () => {
    expect(d(`${ORIGEM}/almoco/`, "navigate")).toBe("pagina");
    expect(d(`${ORIGEM}/almoco/cardapio`, "navigate")).toBe("pagina");
    expect(d(`${ORIGEM}/almoco/cardapio/`, "navigate")).toBe("pagina");
    expect(d(`${ORIGEM}/almoco/assets/index-abc.js`)).toBe("app");
    expect(d(`${ORIGEM}/almoco/icon-192.png`)).toBe("app");
  });

  it("Lista e painel continuam sem cache, e o que está fora da subpasta passa direto", () => {
    for (const p of ["/almoco/lista", "/almoco/admin", "/almoco/admin/login"])
      expect(d(`${ORIGEM}${p}`, "navigate"), p).toBe("pagina-sem-cache");
    expect(d(`${ORIGEM}/outro/cardapio`, "navigate")).toBe("rede");
    expect(d(`${ORIGEM}/assets/x.js`)).toBe("rede");
  });
});

// ---------- Manifest e ícones ----------
const tamanhoPng = (arq: string) => {
  const b = readFileSync(arq);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
describe("manifest", () => {
  const m = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  it("tem nome, cores do tema e abre como aplicativo", () => {
    expect(m.name).toBe("Almoço SESI");
    expect(m.display).toBe("standalone");
    expect(m.theme_color).toBe("#0B2E6B");
    expect(m.start_url).toBe("./");
    expect(m.scope).toBe("./");
  });
  it("tem ícones 192 e 512, com versão maskable, e os arquivos existem com o tamanho declarado", () => {
    const por = (s: string, p: string) =>
      m.icons.find((i: { sizes: string; purpose: string }) => i.sizes === s && i.purpose === p);
    for (const [s, p] of [
      ["192x192", "any"],
      ["512x512", "any"],
      ["192x192", "maskable"],
      ["512x512", "maskable"],
    ]) {
      const ic = por(s!, p!);
      expect(ic, `${s} ${p}`).toBeTruthy();
      const [w, h] = tamanhoPng(`public/${ic.src}`);
      expect(`${w}x${h}`).toBe(s);
    }
    expect(tamanhoPng("public/apple-touch-icon.png")).toEqual([180, 180]);
  });
  it("o app aponta para o manifest e o ícone do iPhone, respeitando o caminho base", () => {
    const html = readFileSync("index.html", "utf8");
    const vite = readFileSync("vite.config.ts", "utf8");
    expect(html).toContain('name="theme-color"');
    expect(vite).toContain("${base}manifest.webmanifest");
    expect(vite).toContain("${base}apple-touch-icon.png");
    expect(vite).toContain("404.html");
  });
});

// ---------- Convite de instalação ----------
describe("detecção de iPhone", () => {
  it("reconhece iPhone, iPad e iPad que se apresenta como Mac", () => {
    expect(ehIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", "iPhone", 5)).toBe(true);
    expect(ehIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
    expect(ehIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(ehIOS("Mozilla/5.0 (Linux; Android 14)", "Linux armv8l", 5)).toBe(false);
  });
});

describe("InstalarApp", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("iPhone: mostra as instruções (Compartilhar > Adicionar à Tela de Início) e some para sempre ao fechar", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const { unmount } = render(<InstalarApp />);
    expect(screen.getByText("Compartilhar")).toBeTruthy();
    expect(screen.getByText("Adicionar à Tela de Início")).toBeTruthy();
    expect(screen.queryByText("Instalar")).toBeNull(); // no iPhone não existe botão de instalar
    fireEvent.click(screen.getByLabelText("Fechar o convite"));
    expect(screen.queryByText("Compartilhar")).toBeNull();
    expect(localStorage.getItem(CHAVE_INSTALAR_FECHADO)).toBe("1");
    unmount();
    render(<InstalarApp />); // "reabrir o app": continua fechado
    expect(screen.queryByText("Compartilhar")).toBeNull();
  });

  it("já instalado (modo standalone): não mostra nada", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    render(<InstalarApp />);
    expect(screen.queryByText("Compartilhar")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("Android: usa o evento beforeinstallprompt, instala e não reaparece", async () => {
    render(<InstalarApp />);
    expect(screen.queryByText("Instalar")).toBeNull(); // sem o evento, nada
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    act(() => void window.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(true); // o mini-aviso do Chrome é substituído pelo nosso
    await act(async () => fireEvent.click(await screen.findByText("Instalar")));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByText("Instalar")).toBeNull();
  });

  it("Android: 'Agora não' guarda e o convite não volta", () => {
    const ev = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" as const }),
    });
    const { unmount } = render(<InstalarApp />);
    act(() => void window.dispatchEvent(ev));
    fireEvent.click(screen.getByText("Agora não"));
    expect(localStorage.getItem(CHAVE_INSTALAR_FECHADO)).toBe("1");
    unmount();
    render(<InstalarApp />);
    act(() => void window.dispatchEvent(ev));
    expect(screen.queryByText("Instalar")).toBeNull();
  });
});

describe("AvisoOffline", () => {
  const setOnline = (v: boolean) => {
    Object.defineProperty(navigator, "onLine", { value: v, configurable: true });
    act(() => void window.dispatchEvent(new Event(v ? "online" : "offline")));
  };
  it("avisa quando cai a internet e confirma quando volta", () => {
    vi.useFakeTimers();
    render(<AvisoOffline />);
    expect(screen.queryByRole("status")).toBeNull();
    setOnline(false);
    expect(screen.getByRole("status").textContent).toContain("sem internet");
    setOnline(true);
    expect(screen.getByRole("status").textContent).toContain("Conexão restabelecida");
    act(() => void vi.advanceTimersByTime(3100));
    expect(screen.queryByRole("status")).toBeNull();
    vi.useRealTimers();
  });
});