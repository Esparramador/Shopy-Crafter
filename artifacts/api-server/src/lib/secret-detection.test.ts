import { describe, expect, it } from "vitest";
import { detectSecrets, maskSecret } from "./secret-detection";

// Valores sintéticos con el formato de cada proveedor (no son credenciales reales).
const fake = (prefix: string, len: number, alphabet = "aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY") =>
  prefix + Array.from({ length: len }, (_, i) => alphabet[(i * 7) % alphabet.length]).join("");
const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("detector de secretos", () => {
  it("no confunde hashes, base64 ni UUID con credenciales", () => {
    const bundle = [
      `const h="${"Zm9vYmFyYmF6cXV4".repeat(3).slice(0, 40)}";`,
      `id:"123e4567-e89b-12d3-a456-426614174000"`,
      `sri="sha384-${"a".repeat(64)}" webhook`,
      `etag:"${"0123456789abcdef".repeat(2)}" shopify`,
    ].join("\n");
    expect(detectSecrets(bundle)).toEqual([]);
  });

  it("detecta una clave secreta de Stripe como crítica y la enmascara también en el contexto", () => {
    const key = fake("sk_live_", 30);
    const [hit] = detectSecrets(`const stripe = Stripe("${key}");`);
    expect(hit.severity).toBe("critical");
    expect(hit.masked).not.toBe(key);
    expect(hit.context).not.toContain(key);
    expect(JSON.stringify(hit)).not.toContain(key);
  });

  it("marca las claves públicas por diseño sin presentarlas como fuga", () => {
    const pk = detectSecrets(`Stripe("${fake("pk_live_", 30)}")`)[0];
    expect(pk.severity).toBe("info");
    expect(pk.publicByDesign).toBe(true);
    const google = detectSecrets(`maps?key=${fake("AIza", 35)}&`)[0];
    expect(google.severity).toBe("medium");
  });

  it("clasifica los JWT de Supabase por rol", () => {
    const jwt = (role: string) => `eyJ${b64url({ alg: "HS256" }).slice(3)}.${b64url({ role, iss: "supabase" })}.${"s".repeat(20)}`;
    expect(detectSecrets(`k="${jwt("service_role")}"`)[0].severity).toBe("critical");
    expect(detectSecrets(`k="${jwt("anon")}"`)[0].severity).toBe("info");
  });

  it("ignora contraseñas de ejemplo y detecta las reales", () => {
    expect(detectSecrets(`password: "changeme123"`)).toEqual([]);
    expect(detectSecrets(`password = "process.env.DB_PASS"`)).toEqual([]);
    const real = detectSecrets(`db_password = "Xk9#mQ2$vL7@pR4z"`);
    expect(real[0]?.ruleId).toBe("generic-password");
  });

  it("enmascara siempre dejando solo prefijo y final", () => {
    expect(maskSecret("sk_live_abcdefghijklmnop")).toMatch(/^sk_liv•+op$/);
  });
});
