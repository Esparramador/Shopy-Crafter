import { describe, expect, it } from "vitest";
import { businessDayBounds, businessYmd, previousBusinessYmd } from "./tz";

describe("fechas en Europe/Madrid", () => {
  it("00:30 hora de Madrid pertenece al día de Madrid, no al de UTC", () => {
    // 2026-09-26T22:30Z = 27-09 00:30 CEST
    expect(businessYmd(new Date("2026-09-26T22:30:00Z"))).toBe("2026-09-27");
    expect(previousBusinessYmd(new Date("2026-09-26T22:30:00Z"))).toBe("2026-09-26");
  });

  it("límites del día en verano (CEST, +2)", () => {
    const { start, end } = businessDayBounds("2026-07-15");
    expect(start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-15T22:00:00.000Z");
  });

  it("día del cambio de hora de octubre dura 25 h", () => {
    const { start, end } = businessDayBounds("2026-10-25");
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

import { nextCronRun } from "./tz";
describe("nextCronRun (Europe/Madrid)", () => {
  const from = new Date("2026-09-27T10:10:00Z"); // 12:10 CEST, domingo
  it("diario a las 02:00 Madrid", () => {
    expect(nextCronRun("0 2 * * *", from)?.toISOString()).toBe("2026-09-28T00:00:00.000Z");
  });
  it("30 */6 respeta el minuto", () => {
    expect(nextCronRun("30 */6 * * *", from)?.toISOString()).toBe("2026-09-27T10:30:00.000Z"); // 12:30 CEST
  });
  it("domingo 00:00 → siguiente domingo", () => {
    expect(nextCronRun("0 0 * * 0", from)?.toISOString()).toBe("2026-10-03T22:00:00.000Z");
  });
});
