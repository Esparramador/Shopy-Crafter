import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import axios from "axios";
import { afterEach, describe, expect, it } from "vitest";
import { isAllowedTestHost, takeBlockedAttempts } from "./network-guard.js";

describe("barrera de red de las pruebas", () => {
  afterEach(() => {
    // Los bloqueos de este archivo son intencionados: que no hagan fallar la prueba.
    takeBlockedAttempts();
  });

  it("solo deja pasar la propia máquina", () => {
    for (const h of ["localhost", "127.0.0.1", "127.8.9.1", "::1", "api.localhost"]) {
      expect(isAllowedTestHost(h)).toBe(true);
    }
    for (const h of ["mitienda.myshopify.com", "api.stripe.com", "8.8.8.8", "localhost.evil.com"]) {
      expect(isAllowedTestHost(h)).toBe(false);
    }
  });

  it("bloquea fetch a una tienda real con un mensaje claro", async () => {
    await expect(fetch("https://mitienda.myshopify.com/admin/api/2024-01/orders.json"))
      .rejects.toThrow(/barrera de red de pruebas.*mitienda\.myshopify\.com/);
    expect(takeBlockedAttempts()).toEqual(["https://mitienda.myshopify.com"]);
  });

  it("bloquea https, http crudo y axios en el socket", async () => {
    const viaHttps = new Promise<Error>(resolve => {
      https.get("https://api.stripe.com/v1/charges", () => resolve(new Error("salió"))).on("error", resolve);
    });
    expect((await viaHttps).message).toMatch(/Conexión bloqueada a api\.stripe\.com:443/);

    const viaHttp = new Promise<Error>(resolve => {
      http.get({ host: "93.184.216.34", port: 80, path: "/" }, () => resolve(new Error("salió"))).on("error", resolve);
    });
    expect((await viaHttp).message).toMatch(/Conexión bloqueada a 93\.184\.216\.34:80/);

    await expect(axios.get("https://tienda-real.example.com/wp-json/wc/v3/orders"))
      .rejects.toThrow(/Conexión bloqueada a tienda-real\.example\.com/);
    expect(takeBlockedAttempts().length).toBeGreaterThanOrEqual(3);
  });

  it("los servidores locales efímeros siguen funcionando", async () => {
    const server = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    try {
      expect(await (await fetch(`http://127.0.0.1:${port}/`)).text()).toBe("ok");
      expect(await (await fetch(`http://localhost:${port}/`)).text()).toBe("ok");
      expect((await axios.get(`http://127.0.0.1:${port}/`)).data).toBe("ok");
    } finally {
      await new Promise(r => server.close(r));
    }
    expect(takeBlockedAttempts()).toEqual([]);
  });
});
