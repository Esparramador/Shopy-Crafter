/**
 * Barrera de red de las pruebas del API (se carga como `setupFiles` en
 * vitest.config.ts, en cada worker y antes de cada archivo de prueba).
 *
 * El API habla con tiendas y proveedores reales (Shopify, WooCommerce, Stripe,
 * ElevenLabs, Gemini, OpenAI, Anthropic, Replicate...). Una prueba nueva que
 * olvide un mock no debe poder crear un pedido, cobrar o gastar crédito. Por eso
 * aquí se corta TODA conexión saliente que no vaya a la propia máquina:
 *
 *  - `net.Socket.prototype.connect`: lo usan http/https, tls, undici (el fetch
 *    de Node), axios, los SDK y el driver de Postgres. Es la red de seguridad.
 *  - `globalThis.fetch`: se envuelve para fallar con un mensaje claro en vez del
 *    «fetch failed» genérico de undici.
 *
 * Permitido: localhost, 127.0.0.0/8, ::1, *.localhost y sockets Unix (los
 * servidores efímeros `app.listen(0)` de las pruebas). Para permitir otro host
 * en una prueba concreta, de forma explícita y visible en la revisión:
 *
 *     TEST_NET_ALLOW="api.ejemplo.com,otro.host" pnpm test
 *
 * Cada intento bloqueado, aunque el código lo capture y lo silencie, hace
 * fallar la prueba en curso (afterEach), para que nadie descubra la llamada
 * real por casualidad en producción.
 */
import net from "node:net";
import { afterEach } from "vitest";

const LOOPBACK_HOSTS = new Set(["localhost", "::1", "[::1]", "0.0.0.0", "::"]);

function extraAllowed(): Set<string> {
  return new Set(
    (process.env.TEST_NET_ALLOW ?? "")
      .split(",")
      .map(h => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAllowedTestHost(host: string | undefined | null): boolean {
  // Sin host, Node conecta a localhost.
  if (!host) return true;
  const h = host.toLowerCase().replace(/\.$/, "");
  if (LOOPBACK_HOSTS.has(h)) return true;
  if (h.endsWith(".localhost")) return true;
  if (/^127(\.\d{1,3}){3}$/.test(h)) return true;
  if (h === "::ffff:127.0.0.1" || h.startsWith("::ffff:127.")) return true;
  return extraAllowed().has(h);
}

export class BlockedNetworkError extends Error {
  readonly code = "ERR_TEST_NETWORK_BLOCKED";
  constructor(target: string) {
    super(
      `[barrera de red de pruebas] Conexión bloqueada a ${target}. ` +
        "Las pruebas del API no pueden llamar a tiendas ni proveedores reales: " +
        "usa un mock (vi.mock / vi.stubGlobal('fetch')) o un servidor local app.listen(0). " +
        "Si de verdad hace falta, añade el host a TEST_NET_ALLOW (lista separada por comas).",
    );
    this.name = "BlockedNetworkError";
  }
}

const blockedAttempts: string[] = [];

/** Vacía y devuelve los intentos bloqueados (solo para probar la propia barrera). */
export function takeBlockedAttempts(): string[] {
  return blockedAttempts.splice(0);
}

function recordBlocked(target: string): BlockedNetworkError {
  blockedAttempts.push(target);
  return new BlockedNetworkError(target);
}

// ── Sockets (cubre http, https, tls, undici, axios, SDK y Postgres) ──────────
const originalConnect = net.Socket.prototype.connect as (...args: unknown[]) => net.Socket;

function describeTarget(args: unknown[]): { host?: string; port?: unknown; path?: string } {
  let first = args[0];
  // Node a veces llama internamente con [options, cb] envuelto en un array.
  if (Array.isArray(first)) first = first[0];
  if (first && typeof first === "object") {
    const o = first as { host?: string; hostname?: string; port?: unknown; path?: string };
    return { host: o.host ?? o.hostname, port: o.port, path: o.path };
  }
  if (typeof first === "string" && Number.isNaN(Number(first))) return { path: first };
  return { port: first, host: typeof args[1] === "string" ? args[1] : undefined };
}

net.Socket.prototype.connect = function guardedConnect(this: net.Socket, ...args: unknown[]) {
  const { host, port, path } = describeTarget(args);
  if (path || isAllowedTestHost(host)) return originalConnect.apply(this, args);
  const err = recordBlocked(`${host}:${String(port ?? "?")}`);
  // Igual que un fallo real de conexión: asíncrono, por el evento «error».
  process.nextTick(() => this.destroy(err));
  return this;
} as unknown as typeof net.Socket.prototype.connect;

// ── fetch (mensaje claro antes de que undici abra el socket) ────────────────
const realFetch = globalThis.fetch;
if (typeof realFetch === "function") {
  const guardedFetch: typeof fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let url: URL | null = null;
    try { url = new URL(raw); } catch { /* URL relativa o inválida: que la trate fetch */ }
    if (url && (url.protocol === "http:" || url.protocol === "https:") && !isAllowedTestHost(url.hostname.replace(/^\[|\]$/g, ""))) {
      throw recordBlocked(url.origin);
    }
    return realFetch(input as Parameters<typeof fetch>[0], init);
  };
  globalThis.fetch = guardedFetch;
}

afterEach(() => {
  if (blockedAttempts.length === 0) return;
  const targets = [...new Set(blockedAttempts.splice(0))].join(", ");
  throw new Error(
    `[barrera de red de pruebas] La prueba intentó salir a la red real (${targets}). ` +
      "Añade un mock para ese cliente; ver src/test/network-guard.ts.",
  );
});
