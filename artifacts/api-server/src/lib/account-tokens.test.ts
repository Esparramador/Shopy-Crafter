import { afterEach, describe, expect, it, vi } from "vitest";
import { establishSession, hashAccountToken, newAccountToken, publicAppUrl, tokenLookupValues } from "./account-tokens";

describe("tokens de invitación / reset", () => {
  it("guarda el hash, no el token en claro", () => {
    const { token, stored } = newAccountToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(stored).toBe(hashAccountToken(token));
    expect(stored).not.toBe(token);
  });

  it("busca por hash y por valor en claro (enlaces emitidos antes del cambio)", () => {
    const { token, stored } = newAccountToken();
    expect(tokenLookupValues(token)).toEqual([stored, token]);
  });

  it("rechaza formatos inválidos sin tocar la BD", () => {
    expect(tokenLookupValues("")).toBeNull();
    expect(tokenLookupValues("abc")).toBeNull();
    expect(tokenLookupValues(undefined)).toBeNull();
    expect(tokenLookupValues("g".repeat(64))).toBeNull();
  });
});

describe("publicAppUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prioriza APP_URL y quita la barra final", () => {
    vi.stubEnv("APP_URL", "https://app.example.com/");
    vi.stubEnv("REPLIT_DOMAINS", "x.replit.app");
    expect(publicAppUrl()).toBe("https://app.example.com");
  });

  it("usa el dominio de despliegue antes que el de desarrollo", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("REPLIT_DOMAINS", "prod.replit.app,otro.replit.app");
    vi.stubEnv("REPLIT_DEV_DOMAIN", "dev.replit.dev");
    expect(publicAppUrl()).toBe("https://prod.replit.app");
  });

  it("null si no hay nada configurado (nunca inventa dominio)", () => {
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("REPLIT_DOMAINS", "");
    vi.stubEnv("REPLIT_DEV_DOMAIN", "");
    expect(publicAppUrl()).toBeNull();
  });
});

describe("establishSession", () => {
  it("regenera el id de sesión antes de autenticar", async () => {
    const order: string[] = [];
    const session: any = {
      regenerate: (cb: (e?: unknown) => void) => { order.push("regenerate"); cb(); },
      save: (cb: (e?: unknown) => void) => { order.push("save"); cb(); },
    };
    await establishSession({ session } as any, { id: "u1", role: "client", clientId: "7", name: "Ana", email: "a@b.c" });
    expect(order).toEqual(["regenerate", "save"]);
    expect(session).toMatchObject({ userId: "u1", role: "client", clientId: "7", name: "Ana", email: "a@b.c" });
  });

  it("propaga el error de regenerate", async () => {
    const session: any = { regenerate: (cb: (e?: unknown) => void) => cb(new Error("store caído")) };
    await expect(establishSession({ session } as any, { id: "u1", role: "client", clientId: null, name: "", email: "" }))
      .rejects.toThrow("store caído");
  });
});
