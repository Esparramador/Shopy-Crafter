import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: { execute: vi.fn() } }));
vi.mock("./logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  CONVAI_HEALTH_ALERT_STATE_KEY, alertLevelOf, buildConvAIAlertEmail, describeConvAIFailure, runConvAIHealthAlert,
  type ConvAIHealthForAlert,
} from "./convai-health-alert.js";
import { convaiHealthToProvider } from "./provider-health.js";

const dialect = new PgDialect();
const kv = new Map<string, string>();

async function execute(query: unknown) {
  const { sql, params } = dialect.sqlToQuery(query as Parameters<PgDialect["sqlToQuery"]>[0]);
  if (sql.includes("SELECT key, value")) {
    return { rows: params.map(String).filter(k => kv.has(k)).map(key => ({ key, value: kv.get(key) })) };
  }
  if (sql.includes("INSERT INTO platform_settings_kv")) {
    if (kv.has(String(params[0]))) return { rows: [] };
    kv.set(String(params[0]), String(params[1]));
    return { rows: [{ key: params[0] }] };
  }
  if (sql.trim().startsWith("UPDATE platform_settings_kv")) {
    const [value, key, expected] = params.map(String);
    if (kv.get(key) !== expected) return { rows: [] };
    kv.set(key, value);
    return { rows: [{ key }] };
  }
  if (sql.trim().startsWith("DELETE FROM platform_settings_kv")) {
    if (kv.get(String(params[0])) === String(params[1])) kv.delete(String(params[0]));
    return { rows: [] };
  }
  return { rows: [] };
}

const green: ConvAIHealthForAlert = {
  healthy: true, degraded: false, checkedAt: "2026-11-07T10:00:00.000Z",
  voice: { voiceId: "v1", ok: true },
  agents: [{ type: "admin", agentId: "a1", status: "ok" }, { type: "client", agentId: null, status: "not_created" }],
};
const amber: ConvAIHealthForAlert = { ...green, healthy: false, degraded: true, agents: [{ type: "admin", agentId: "a1", status: "drift", error: "stability" }] };
const red: ConvAIHealthForAlert = {
  ...green, healthy: false, degraded: false,
  agents: [{ type: "client", agentId: "c1", status: "error", error: "ElevenLabs ConvAI get 404: not found" }],
};
const redVoice: ConvAIHealthForAlert = {
  ...green, healthy: false, degraded: false,
  voice: { voiceId: "clone", ok: false, code: "voice_not_allowed_on_plan", error: "clon instantáneo" },
  agents: [{ type: "admin", agentId: "a1", status: "error", code: "voice_not_allowed_on_plan", error: "clon instantáneo" }],
};

describe("aviso por email de las llamadas de voz (#86)", () => {
  let current: ConvAIHealthForAlert;
  const send = vi.fn<(to: string, subject: string, html: string) => Promise<boolean>>();
  const run = () => runConvAIHealthAlert({
    check: async () => current, send, gmailAvailable: () => true,
    panelUrl: () => "https://app.example.invalid", execute: execute as never,
  });

  beforeEach(() => {
    kv.clear();
    send.mockReset().mockResolvedValue(true);
    current = green;
  });

  it("verde → rojo avisa una vez con el motivo y el enlace; rojo repetido no vuelve a avisar", async () => {
    expect(await run()).toMatchObject({ action: "recorded", level: "ok" });
    expect(send).not.toHaveBeenCalled();
    current = red;
    expect(await run()).toMatchObject({ action: "notified", level: "red" });
    expect(send).toHaveBeenCalledTimes(1);
    const [, subject, html] = send.mock.calls[0];
    expect(subject).toMatch(/dejado de funcionar/);
    expect(html).toContain("el agente se ha borrado en ElevenLabs");
    expect(html).toContain("https://app.example.invalid/fusion-studio-pro");
    expect(await run()).toMatchObject({ action: "unchanged", level: "red" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("al recuperarse envía el aviso de vuelta a verde", async () => {
    kv.set(CONVAI_HEALTH_ALERT_STATE_KEY, JSON.stringify({ level: "red", since: "x" }));
    current = green;
    expect(await run()).toMatchObject({ action: "notified", level: "ok" });
    expect(send.mock.calls[0][1]).toMatch(/vuelven a funcionar/);
  });

  it("ámbar (deriva) no avisa", async () => {
    await run();
    current = amber;
    expect(await run()).toMatchObject({ action: "unchanged", level: "ok" });
    expect(send).not.toHaveBeenCalled();
  });

  it("si el email falla, el estado vuelve atrás para reintentar en la siguiente hora", async () => {
    await run();
    current = red;
    send.mockResolvedValueOnce(false);
    expect(await run()).toMatchObject({ action: "send_failed" });
    expect(JSON.parse(kv.get(CONVAI_HEALTH_ALERT_STATE_KEY)!).level).toBe("ok");
    expect(await run()).toMatchObject({ action: "notified", level: "red" });
  });

  it("primera ejecución ya en rojo avisa", async () => {
    current = red;
    expect(await run()).toMatchObject({ action: "notified", level: "red" });
  });

  it("un fallo de la comprobación no cambia el estado ni avisa", async () => {
    await run();
    const r = await runConvAIHealthAlert({
      check: async () => { throw new Error("db down"); }, send, gmailAvailable: () => true,
      panelUrl: () => null, execute: execute as never,
    });
    expect(r).toMatchObject({ action: "skipped" });
    expect(send).not.toHaveBeenCalled();
  });

  it("usa el email configurado en platform_settings_kv", async () => {
    kv.set("convai_health_alert_email", "voz@example.invalid");
    current = red;
    await run();
    expect(send.mock.calls[0][0]).toBe("voz@example.invalid");
  });

  it("explica una voz rechazada por el plan y escapa el HTML", () => {
    expect(alertLevelOf(redVoice)).toBe("red");
    expect(describeConvAIFailure(redVoice)[0]).toMatch(/plan de ElevenLabs rechaza la voz/);
    const { html } = buildConvAIAlertEmail("red", { ...red, agents: [{ type: "admin", agentId: "<b>", status: "error", error: "<script>" }] }, null);
    expect(html).not.toContain("<script>");
  });
});

describe("badge «Voz llamadas» en la barra de Motores IA (#85)", () => {
  it("verde, ámbar y rojo", () => {
    expect(convaiHealthToProvider(green).status).toBe("ok");
    expect(convaiHealthToProvider(amber).status).toBe("degraded");
    expect(convaiHealthToProvider(red)).toMatchObject({ provider: "convai", status: "down" });
    expect(convaiHealthToProvider(redVoice).detail).toMatch(/voz rechazada/);
  });
});
