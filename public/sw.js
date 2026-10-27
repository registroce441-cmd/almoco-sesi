/* Service worker do Almoço SESI.
 *
 * O que ele guarda no aparelho (para abrir com internet fraca ou sem internet):
 *   - o próprio app (arquivos /assets/*, ícones, fontes) e as páginas PÚBLICAS "/" e "/cardapio";
 *   - o cardápio da semana (GET /rest/v1/cardapio feito SEM login) e as fotos públicas dos pratos.
 *
 * O que NUNCA guarda (vai sempre direto para a rede):
 *   - a Lista com nomes e o relatório (chamadas rpc/*), busca de pessoas, marcações, login, e qualquer
 *     chamada feita com o login do administrador;
 *   - as páginas /lista e /admin (se estiver sem internet, mostra a página offline).
 * Mudou algo aqui? Aumente VERSAO para limpar os caches antigos.
 */
const VERSAO = "v1";
const CACHE_APP = `almoco-app-${VERSAO}`;
const CACHE_PAGINAS = `almoco-paginas-${VERSAO}`;
const CACHE_CARDAPIO = `almoco-cardapio-${VERSAO}`;
const CACHE_FOTOS = `almoco-fotos-${VERSAO}`;
const TODOS = [CACHE_APP, CACHE_PAGINAS, CACHE_CARDAPIO, CACHE_FOTOS];
const PRE_CACHE = ["/offline.html", "/icon-192.png", "/manifest.webmanifest"];
const PAGINAS_PUBLICAS = ["/", "/cardapio"];
const ESPERA_REDE_MS = 3500; // internet fraca: depois disso, usa o que já está guardado
const MAX_FOTOS = 60;

/** O pedido foi feito sem login de usuário? (chave anon/publishable ou nenhum login) */
function ehAnonimo(authorization) {
  if (!authorization) return true;
  const token = String(authorization).replace(/^Bearer\s+/i, "");
  if (token.startsWith("sb_publishable_")) return true;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  try {
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return payload.role === "anon";
  } catch {
    return false; // na dúvida, trata como logado e não guarda nada
  }
}

/** Decide o que fazer com um pedido. Nada além das regras abaixo passa pelo cache. */
function decidir(metodo, urlTexto, modo, authorization) {
  if (metodo !== "GET") return "rede";
  const url = new URL(urlTexto);
  const mesmaOrigem = url.origin === self.location.origin;

  if (mesmaOrigem && modo === "navigate") {
    if (PAGINAS_PUBLICAS.includes(url.pathname)) return "pagina";
    return "pagina-sem-cache"; // /lista, /admin e o resto: só rede (com página offline de reserva)
  }
  if (mesmaOrigem) {
    if (url.pathname.startsWith("/assets/")) return "app";
    if (/^\/(icon-|apple-touch-icon|favicon|manifest\.webmanifest|offline\.html)/.test(url.pathname)) return "app";
    return "rede";
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return "fonte";
  if (url.pathname === "/rest/v1/cardapio") return ehAnonimo(authorization) ? "cardapio" : "rede";
  if (url.pathname.startsWith("/storage/v1/object/public/cardapio-fotos/")) return "foto";
  return "rede";
}

async function redeComLimite(request, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(request, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function redePrimeiro(request, nomeCache, ms) {
  const cache = await caches.open(nomeCache);
  try {
    const resp = await redeComLimite(request, ms);
    if (resp.ok) await cache.put(request, resp.clone());
    return resp;
  } catch {
    const guardado = await cache.match(request, { ignoreVary: true });
    if (guardado) return guardado;
    throw new Error("sem rede e sem cópia guardada");
  }
}

async function cachePrimeiro(request, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardado = await cache.match(request);
  if (guardado) return guardado;
  const resp = await fetch(request);
  if (resp.ok) await cache.put(request, resp.clone());
  return resp;
}

async function atualizaEmSegundoPlano(request, nomeCache, max) {
  const cache = await caches.open(nomeCache);
  const guardado = await cache.match(request);
  const buscar = fetch(request)
    .then(async (resp) => {
      if (resp.ok || resp.type === "opaque") {
        await cache.put(request, resp.clone());
        if (max) {
          const chaves = await cache.keys();
          for (const k of chaves.slice(0, Math.max(0, chaves.length - max))) await cache.delete(k);
        }
      }
      return resp;
    })
    .catch(() => undefined);
  return guardado || (await buscar) || Response.error();
}

const paginaOffline = () => caches.match("/offline.html");

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE_APP)
      .then((c) => c.addAll(PRE_CACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith("almoco-") && !TODOS.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const acao = decidir(r.method, r.url, r.mode, r.headers.get("authorization"));
  if (acao === "rede") return; // não mexe: segue direto para a rede
  if (acao === "pagina") e.respondWith(redePrimeiro(r, CACHE_PAGINAS, ESPERA_REDE_MS).catch(paginaOffline));
  else if (acao === "pagina-sem-cache") e.respondWith(fetch(r).catch(paginaOffline));
  else if (acao === "app") e.respondWith(cachePrimeiro(r, CACHE_APP));
  else if (acao === "fonte") e.respondWith(atualizaEmSegundoPlano(r, CACHE_APP));
  else if (acao === "cardapio") e.respondWith(redePrimeiro(r, CACHE_CARDAPIO, ESPERA_REDE_MS));
  else if (acao === "foto") e.respondWith(atualizaEmSegundoPlano(r, CACHE_FOTOS, MAX_FOTOS));
});

// Para os testes automáticos (no navegador `module` não existe).
if (typeof module !== "undefined") module.exports = { decidir, ehAnonimo };
