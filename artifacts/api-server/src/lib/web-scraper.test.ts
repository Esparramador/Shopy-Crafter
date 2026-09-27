import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./logger.js", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { isPrivateIp, safeFetch } from "./web-scraper";

describe("isPrivateIp", () => {
  it("detecta IPv4 privadas, locales, CGNAT y de metadatos", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "0.0.0.0", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "198.18.0.1", "224.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("detecta IPv6 locales, también entre corchetes y mapeadas a IPv4", () => {
    for (const ip of ["::1", "[::1]", "fd00::1", "fe80::1", "[::ffff:7f00:1]", "::ffff:127.0.0.1", "::ffff:a9fe:a9fe"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("no marca IPs públicas", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:808:808"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("safeFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rechaza una redirección hacia una IP interna", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("http://93.184.216.34/")).rejects.toThrow(/no permitida/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rechaza IPv6 mapeada a localhost desde el principio", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("http://[::ffff:127.0.0.1]/")).rejects.toThrow(/no permitida/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sigue redirecciones públicas y devuelve la respuesta final", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/nueva" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await safeFetch("http://93.184.216.34/");
    expect(await r.text()).toBe("ok");
    expect(fetchMock.mock.calls[1][0]).toBe("http://93.184.216.34/nueva");
  });
});
