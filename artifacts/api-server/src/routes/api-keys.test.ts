import { afterEach, describe, expect, it, vi } from "vitest";

let dbRows: Array<{ key_name: string; key_value: string }> = [];
vi.mock("@workspace/db", () => ({
  db: { execute: async () => ({ rows: dbRows }) },
}));
vi.mock("../lib/auth.js", () => ({ requireAdmin: (_q: unknown, _s: unknown, next: () => void) => next() }));
vi.mock("../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { injectDbApiKeys } = await import("./api-keys");
const { encrypt, validateEncryptionKey } = await import("../lib/crypto");
validateEncryptionKey();

describe("injectDbApiKeys", () => {
  afterEach(() => { delete process.env.TEST_PROVIDER_API_KEY; });

  it("la clave del panel manda sobre la del entorno (antes se ignoraba tras reiniciar)", async () => {
    process.env.TEST_PROVIDER_API_KEY = "vieja-del-entorno";
    dbRows = [{ key_name: "TEST_PROVIDER_API_KEY", key_value: "nueva-del-panel" }];
    await injectDbApiKeys();
    expect(process.env.TEST_PROVIDER_API_KEY).toBe("nueva-del-panel");
  });

  it("descifra las claves guardadas cifradas", async () => {
    dbRows = [{ key_name: "TEST_PROVIDER_API_KEY", key_value: encrypt("secreta") }];
    await injectDbApiKeys();
    expect(process.env.TEST_PROVIDER_API_KEY).toBe("secreta");
  });

  it("nunca sobrescribe variables del sistema", async () => {
    const before = process.env.NODE_ENV;
    dbRows = [
      { key_name: "NODE_ENV", key_value: "hackeado" },
      { key_name: "DATABASE_URL", key_value: "postgres://evil" },
      { key_name: "lower_case", key_value: "x" },
    ];
    await injectDbApiKeys();
    expect(process.env.NODE_ENV).toBe(before);
    expect(process.env.DATABASE_URL).not.toBe("postgres://evil");
    expect(process.env.lower_case).toBeUndefined();
  });
});
