import { useCallback, useEffect, useState } from "react";

/** Chave guardada no aparelho quando a pessoa fecha o convite de instalação (ou instala): não aparece de novo. */
export const CHAVE_INSTALAR_FECHADO = "almoco:instalar-fechado";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// O Chrome/Android avisa uma vez só: guardamos o evento desde que o arquivo é carregado.
let eventoGuardado: EventoInstalar | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoGuardado = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    eventoGuardado = null;
    marcarFechado();
    avisar();
  });
}

function marcarFechado() {
  try {
    localStorage.setItem(CHAVE_INSTALAR_FECHADO, "1");
  } catch {
    /* sem armazenamento (modo privado): só vale até recarregar */
  }
}
function foiFechado(): boolean {
  try {
    return localStorage.getItem(CHAVE_INSTALAR_FECHADO) === "1";
  } catch {
    return false;
  }
}

/** iPhone/iPad (inclui iPad "disfarçado" de Mac). */
export function ehIOS(userAgent: string, platform: string, toquesMaximos: number): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && toquesMaximos > 1);
}

/** O app já está instalado/aberto pela tela inicial? */
export function jaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export type ModoInstalacao = "nenhum" | "android" | "ios";

/** Estado do convite "Adicionar à tela inicial". No servidor e antes de montar, sempre "nenhum". */
export function useInstalacao() {
  const [modo, setModo] = useState<ModoInstalacao>("nenhum");

  useEffect(() => {
    const atualizar = () => {
      if (foiFechado() || jaInstalado()) return setModo("nenhum");
      if (eventoGuardado) return setModo("android");
      setModo(
        ehIOS(navigator.userAgent, navigator.platform, navigator.maxTouchPoints) ? "ios" : "nenhum",
      );
    };
    atualizar();
    ouvintes.add(atualizar);
    return () => void ouvintes.delete(atualizar);
  }, []);

  const fechar = useCallback(() => {
    marcarFechado();
    setModo("nenhum");
  }, []);

  const instalar = useCallback(async () => {
    const ev = eventoGuardado;
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    eventoGuardado = null; // o navegador só deixa usar o evento uma vez
    // Aceitou: o "appinstalled" marca. Recusou no diálogo do sistema: respeitamos e não insistimos.
    if (outcome === "dismissed") marcarFechado();
    setModo("nenhum");
  }, []);

  return { modo, instalar, fechar };
}

/** Está com internet? (o aviso é só informativo: o navegador pode errar em redes muito ruins) */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);
  return online;
}

/** Registra o service worker (só no app publicado: em desenvolvimento atrapalharia o recarregar automático). */
export function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !import.meta.env.PROD)
    return;
  const registrar = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* sem service worker o app funciona normalmente, só não abre offline */
    });
  };
  // Espera a página terminar de carregar para não competir com ela; se já terminou, registra agora.
  if (document.readyState === "complete") registrar();
  else window.addEventListener("load", registrar, { once: true });
}
