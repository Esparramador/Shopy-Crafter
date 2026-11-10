import { describe, expect, it } from "vitest";
import { buildEventsUrl, channelsForGate, formatDuration, formatWhen, gateInfo, kindInfo, statusInfo, summarizeEvents, type BrainEvent } from "./brain-events";

const ev = (p: Partial<BrainEvent>): BrainEvent => ({
  id: 1, createdAt: "2026-11-10T10:00:00Z", gate: "admin", channel: "admin_chat", userId: null, projectId: null,
  input: "hola", kind: "answer", engine: null, model: null, actions: null, droppedActions: null, status: "ok", detail: null, durationMs: null, ...p,
});

describe("panel Cerebro", () => {
  it("URL con filtros y cursor", () => {
    expect(buildEventsUrl("", {})).toBe("/api/shopybrain/events?limit=40");
    expect(buildEventsUrl("/app", { gate: "public", channel: "studio-fusion", before: 120, limit: 20 }))
      .toBe("/app/api/shopybrain/events?gate=public&channel=studio-fusion&limit=20&before=120");
  });

  it("duraciones legibles", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(840)).toBe("840 ms");
    expect(formatDuration(12_400)).toBe("12,4 s");
    expect(formatDuration(185_000)).toBe("3 min 5 s");
    expect(formatDuration(120_000)).toBe("2 min");
  });

  it("hora relativa", () => {
    const now = new Date("2026-11-10T10:30:00Z");
    expect(formatWhen("2026-11-10T10:29:50Z", now)).toBe("ahora");
    expect(formatWhen("2026-11-10T10:10:00Z", now)).toBe("hace 20 min");
    expect(formatWhen("no-date", now)).toBe("—");
  });

  it("cifras: acciones, descartadas, fallos y media", () => {
    expect(summarizeEvents([
      ev({ actions: [{ action: "a" }, { action: "b" }], durationMs: 1000 }),
      ev({ droppedActions: [{ action: "stripe_create_refund" }], status: "denied", durationMs: 3000 }),
      ev({ status: "error" }),
    ])).toEqual({ total: 3, actions: 2, dropped: 1, failures: 2, avgMs: 2000 });
    expect(summarizeEvents([]).avgMs).toBeNull();
  });

  it("canales por puerta, sumados y ordenados", () => {
    const list = [
      { channel: "admin_chat", gate: "admin", count: 5 },
      { channel: "landing_chat", gate: "public", count: 9 },
      { channel: "studio-fusion", gate: "admin", count: 7 },
      { channel: "studio-fusion", gate: "client", count: 1 },
    ];
    expect(channelsForGate(list, "admin")).toEqual([{ channel: "studio-fusion", count: 7 }, { channel: "admin_chat", count: 5 }]);
    expect(channelsForGate(list, "")[0]).toEqual({ channel: "landing_chat", count: 9 });
    expect(channelsForGate(list, "")[1]).toEqual({ channel: "studio-fusion", count: 8 });
  });

  it("etiquetas, con respaldo para valores desconocidos", () => {
    expect(gateInfo("public").label).toBe("Público");
    expect(kindInfo("handoff").label).toBe("Derivación");
    expect(statusInfo("denied").tone).toBe("crim");
    expect(statusInfo("raro")).toEqual({ label: "raro", tone: "gray" });
  });
});
