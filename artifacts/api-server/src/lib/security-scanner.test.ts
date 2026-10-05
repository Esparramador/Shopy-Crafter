import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("./web-scraper.js", () => ({ validateUrlWithDnsCheck: vi.fn(async () => {}) }));
vi.mock("./site-crawler.js", () => ({ detectTechStack: () => null }));
vi.mock("./cybersec-knowledge.js", () => ({ searchCybersecSkills: () => [] }));
vi.mock("./logger.js", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("node:tls", () => ({
  connect: () => { const s = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void }; s.end = () => {}; s.destroy = () => {}; setTimeout(() => s.emit("error", new Error("offline")), 0); return s; },
}));

const { runSecurityScan } = await import("./security-scanner");

const page = `<!doctype html><html><head><script src="/app.js"></script></head><body>Tienda</body></html>`;
const SECURE_HEADERS = {
  "content-type": "text/html", "strict-transport-security": "max-age=63072000", "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff", "referrer-policy": "strict-origin", "permissions-policy": "camera=()",
};

function mockSite(routes: Record<string, { status?: number; body?: string; headers?: Record<string, string> }>, fallback: { status?: number; body?: string; headers?: Record<string, string> }) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
    const u = new URL(String(input));
    const r = routes[`${u.protocol}//${u.host}${u.pathname}`] ?? routes[u.pathname] ?? fallback;
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: r.headers ?? { "content-type": "text/html" } });
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("escáner de seguridad pasivo", () => {
  it("analiza la página final tras la redirección y no da .env expuesto por un soft 404", async () => {
    mockSite({
      "https://tienda.test/": { status: 301, headers: { location: "https://www.tienda.test/" } },
      "http://tienda.test/": { status: 301, headers: { location: "https://tienda.test/" } },
      "https://www.tienda.test/": { body: page, headers: SECURE_HEADERS },
      "/app.js": { body: "console.log('ok')", headers: { "content-type": "application/javascript" } },
    }, { status: 200, body: page, headers: { "content-type": "text/html" } });
    const r = await runSecurityScan("tienda.test");
    expect(r.url).toBe("https://www.tienda.test/");
    const ids = r.findings.map(f => f.id);
    expect(ids.some(id => id.startsWith("exposed-"))).toBe(false);
    expect(ids).not.toContain("header-no-csp");
  });

  it("detecta un .env real y una clave secreta en el JS del propio sitio", async () => {
    mockSite({
      "https://tienda.test/": { body: page, headers: SECURE_HEADERS },
      "http://tienda.test/": { status: 301, headers: { location: "https://tienda.test/" } },
      "/.env": { body: "DATABASE_URL=postgres://u:p@h/db\nSTRIPE_KEY=abc", headers: { "content-type": "text/plain" } },
      "/app.js": { body: `Stripe("sk_live_${"aB3dE5fG7hJ9kL2mN4pQ6rS8".slice(0, 26)}")`, headers: { "content-type": "application/javascript" } },
    }, { status: 404, body: "not found" });
    const r = await runSecurityScan("https://tienda.test");
    const ids = r.findings.map(f => f.id);
    expect(ids).toContain("exposed---env");
    const leak = r.findings.find(f => f.id.startsWith("leaked-secret-stripe-secret-live"));
    expect(leak).toBeDefined();
    // El valor completo va en secretValue (solo lo ve el admin); la evidencia visible queda enmascarada.
    const key = `sk_live_${"aB3dE5fG7hJ9kL2mN4pQ6rS8".slice(0, 26)}`;
    expect(leak!.secretValue).toBe(key);
    expect(leak!.evidence).not.toContain(key);
  });

  it("avisa si http:// no redirige a https://", async () => {
    mockSite({
      "https://tienda.test/": { body: page, headers: SECURE_HEADERS },
      "http://tienda.test/": { status: 200, body: page },
    }, { status: 404, body: "" });
    const r = await runSecurityScan("https://tienda.test");
    expect(r.findings.map(f => f.id)).toContain("tls-http-not-redirected");
  });
});
