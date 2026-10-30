import express from "express";
import { describe, expect, it } from "vitest";
import { GENERATED_HTML_CSP, sandboxHtmlResponses } from "./html-sandbox";
import { isAllowedHeadlessUrl } from "./headless-guard";

async function get(app: express.Express, path: string) {
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  try {
    const r = await fetch(`http://127.0.0.1:${port}${path}`);
    return { csp: r.headers.get("content-security-policy"), type: r.headers.get("content-type") };
  } finally { server.close(); }
}

describe("HTML generado servido aislado", () => {
  const app = express();
  app.use(sandboxHtmlResponses);
  app.get("/html", (_req, res) => { res.setHeader("Content-Type", "text/html"); res.send("<script>x</script>"); });
  app.get("/json", (_req, res) => { res.json({ ok: true }); });
  app.get("/svg", (_req, res) => { res.type("image/svg+xml").send("<svg/>"); });
  app.get("/own", (_req, res) => { res.setHeader("Content-Security-Policy", "default-src 'none'"); res.type("html").send("ok"); });

  it("HTML y SVG llevan CSP sandbox", async () => {
    expect((await get(app, "/html")).csp).toBe(GENERATED_HTML_CSP);
    expect((await get(app, "/svg")).csp).toBe(GENERATED_HTML_CSP);
  });
  it("JSON no se toca y una CSP propia se respeta", async () => {
    expect((await get(app, "/json")).csp).toBeNull();
    expect((await get(app, "/own")).csp).toBe("default-src 'none'");
  });
});

describe("navegador headless: solo recursos públicos", () => {
  it("bloquea red interna y esquemas raros", async () => {
    expect(await isAllowedHeadlessUrl("http://127.0.0.1:8080/api/admin")).toBe(false);
    expect(await isAllowedHeadlessUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(await isAllowedHeadlessUrl("http://localhost/x")).toBe(false);
    expect(await isAllowedHeadlessUrl("file:///etc/passwd")).toBe(false);
  });
  it("deja data: y about:", async () => {
    expect(await isAllowedHeadlessUrl("data:image/png;base64,AAAA")).toBe(true);
    expect(await isAllowedHeadlessUrl("about:blank")).toBe(true);
  });
});
