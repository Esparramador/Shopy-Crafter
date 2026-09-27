/**
 * Fechas de negocio en la zona de la agencia (Europe/Madrid). Los crons corren
 * en esa zona; usar toISOString() (UTC) asignaba ventas al día equivocado.
 */
export const BUSINESS_TZ = "Europe/Madrid";

/** "YYYY-MM-DD" del instante dado en la zona de negocio. */
export function businessYmd(d: Date = new Date(), tz = BUSINESS_TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Desfase en minutos de la zona respecto a UTC en un instante dado (p. ej. +120 en CEST). */
function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const n = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Instante UTC del inicio (00:00) del día `ymd` en la zona de negocio. */
export function businessDayStart(ymd: string, tz = BUSINESS_TZ): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  // Dos pasadas: el desfase puede cambiar cerca del cambio de hora.
  let start = new Date(guess.getTime() - offsetMinutes(guess, tz) * 60000);
  start = new Date(guess.getTime() - offsetMinutes(start, tz) * 60000);
  return start;
}

/** Día anterior (YYYY-MM-DD) al día de negocio actual. */
export function previousBusinessYmd(now: Date = new Date(), tz = BUSINESS_TZ): string {
  const todayStart = businessDayStart(businessYmd(now, tz), tz);
  return businessYmd(new Date(todayStart.getTime() - 60 * 60 * 1000), tz);
}

/** [inicio, fin) del día de negocio `ymd` como instantes UTC. */
export function businessDayBounds(ymd: string, tz = BUSINESS_TZ): { start: Date; end: Date } {
  const start = businessDayStart(ymd, tz);
  const next = businessYmd(new Date(start.getTime() + 36 * 60 * 60 * 1000), tz);
  return { start, end: businessDayStart(next, tz) };
}

// ─── Próxima ejecución de una expresión cron (5 campos) en una zona horaria ───
function cronFieldMatches(field: string, value: number, min: number): boolean {
  return field.split(",").some(part => {
    const [range, stepStr] = part.split("/");
    const step = stepStr ? Number(stepStr) : 1;
    let lo: number, hi: number;
    if (range === "*") { lo = min; hi = Number.MAX_SAFE_INTEGER; }
    else if (range.includes("-")) { [lo, hi] = range.split("-").map(Number); }
    else { lo = Number(range); hi = stepStr ? Number.MAX_SAFE_INTEGER : lo; }
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

/**
 * Siguiente instante que cumple `expr` (min hora dom mes dow) en la zona `tz`.
 * Busca hasta 8 días. Las zonas con desfase de horas enteras (Madrid) permiten
 * evaluar los minutos en UTC.
 */
export function nextCronRun(expr: string, from: Date = new Date(), tz = BUSINESS_TZ): Date | null {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return null;
  const [mi, ho, dom, mon, dow] = f;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", day: "2-digit", month: "2-digit", weekday: "short" });
  const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const startHour = Math.floor(from.getTime() / 3_600_000) * 3_600_000;
  for (let h = 0; h < 8 * 24 + 1; h++) {
    const hourStart = new Date(startHour + h * 3_600_000);
    const parts = fmt.formatToParts(hourStart);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    const lh = Number(get("hour")), ld = Number(get("day")), lm = Number(get("month")), lw = WD[get("weekday")] ?? -1;
    if (!cronFieldMatches(ho, lh, 0) || !cronFieldMatches(dom, ld, 1) || !cronFieldMatches(mon, lm, 1)) continue;
    if (!(cronFieldMatches(dow, lw, 0) || (lw === 0 && cronFieldMatches(dow, 7, 0)))) continue;
    for (let m = 0; m < 60; m++) {
      if (!cronFieldMatches(mi, m, 0)) continue;
      const t = new Date(hourStart.getTime() + m * 60_000);
      if (t.getTime() > from.getTime()) return t;
    }
  }
  return null;
}
