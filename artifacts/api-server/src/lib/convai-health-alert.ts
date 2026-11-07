/**
 * Aviso por email cuando las llamadas de voz (ElevenLabs ConvAI) dejan de
 * funcionar, y otro cuando se recuperan (#86).
 *
 * Lo lanza un cron horario (scheduler.ts). Usa la MISMA comprobación de solo
 * lectura que GET /api/voice/convai/health (nunca PATCH ni creación de agentes).
 * Solo avisa en un cambio de estado: el último estado notificado vive en
 * platform_settings_kv (clave convai_health_alert_state) y se reclama con un
 * UPDATE condicional, así que varias instancias no envían el mismo aviso dos
 * veces. Si el email falla, se devuelve el estado anterior para reintentar en
 * la siguiente ejecución.
 *
 * Ámbar (config desactualizada) NO avisa: la próxima llamada la repara sola.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

export const CONVAI_HEALTH_ALERT_STATE_KEY = "convai_health_alert_state";
export const CONVAI_HEALTH_ALERT_EMAIL_KEY = "convai_health_alert_email";

export type ConvAIAlertLevel = "ok" | "red";

export interface ConvAIHealthForAlert {
  healthy: boolean;
  degraded: boolean;
  checkedAt: string;
  voice: { voiceId: string | null; ok: boolean; code?: string; error?: string };
  agents: Array<{ type: string; agentId: string | null; status: string; code?: string; error?: string }>;
}

/** Rojo = una llamada fallaría ahora; verde y ámbar cuentan como "funciona". */
export function alertLevelOf(report: ConvAIHealthForAlert): ConvAIAlertLevel {
  return report.healthy || report.degraded ? "ok" : "red";
}

const AGENT_LABEL: Record<string, string> = { admin: "Panel admin", client: "Panel cliente", landing: "Landing pública" };

/** Motivos legibles: voz rechazada por el plan, agente borrado, API caída… */
export function describeConvAIFailure(report: ConvAIHealthForAlert): string[] {
  const reasons: string[] = [];
  if (!report.voice.ok) {
    const code = report.voice.code;
    const why = code === "voice_not_allowed_on_plan" ? "el plan de ElevenLabs rechaza la voz configurada"
      : code === "voice_not_found" ? "la voz configurada ya no existe en ElevenLabs"
      : "no se pudo comprobar la voz (¿API de ElevenLabs caída o clave inválida?)";
    reasons.push(`Voz ${report.voice.voiceId ?? "—"}: ${why}${report.voice.error ? ` — ${report.voice.error}` : ""}`);
  }
  for (const agent of report.agents) {
    if (agent.status !== "error") continue;
    const err = agent.error ?? "";
    const why = /\b404\b|not[_ ]found/i.test(err) ? "el agente se ha borrado en ElevenLabs"
      : /\b(5\d\d|timeout|fetch failed|ECONN)/i.test(err) ? "la API de ElevenLabs no responde"
      : /\b40[13]\b/.test(err) ? "la clave de ElevenLabs no es válida"
      : "la llamada fallaría";
    reasons.push(`${AGENT_LABEL[agent.type] ?? agent.type} (${agent.agentId ?? "sin id"}): ${why}${err ? ` — ${err}` : ""}`);
  }
  if (!reasons.length) reasons.push("La comprobación de salud indica que las llamadas fallarían.");
  return reasons;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}

export function buildConvAIAlertEmail(
  level: ConvAIAlertLevel,
  report: ConvAIHealthForAlert,
  panelUrl: string | null,
): { subject: string; html: string } {
  const when = new Date(report.checkedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
  const link = panelUrl
    ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(panelUrl)}" style="color:#c8a84b;font-weight:700;">Abrir Fusion Studio Pro → Audio AI Tools → ConvAI Agents</a></p>`
    : `<p style="margin:18px 0 0;color:#888;">Panel: Fusion Studio Pro → Audio AI Tools → ConvAI Agents.</p>`;
  if (level === "red") {
    const items = describeConvAIFailure(report).map(r => `<li style="margin:4px 0;">${escapeHtml(r)}</li>`).join("");
    return {
      subject: "🔴 Las llamadas de voz de Arturo han dejado de funcionar",
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0f0f1a;color:#e8e0cc;padding:28px;border-radius:14px;">
  <h1 style="margin:0 0 6px;font-size:20px;color:#ef4444;">Las llamadas de voz NO funcionarían ahora mismo</h1>
  <p style="margin:0 0 16px;font-size:12px;color:#888;">Comprobado el ${escapeHtml(when)}</p>
  <ul style="padding-left:18px;font-size:13px;color:#ddd;">${items}</ul>
  <p style="font-size:12px;color:#aaa;">Revisa la tarjeta de salud de ConvAI y usa «Re-sincronizar» si hace falta. Te avisaremos otra vez cuando se recupere.</p>
  ${link}
</div>`,
    };
  }
  return {
    subject: "🟢 Las llamadas de voz de Arturo vuelven a funcionar",
    html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#0f0f1a;color:#e8e0cc;padding:28px;border-radius:14px;">
  <h1 style="margin:0 0 6px;font-size:20px;color:#22c55e;">Llamadas de voz operativas de nuevo</h1>
  <p style="margin:0;font-size:12px;color:#888;">Comprobado el ${escapeHtml(when)}${report.degraded ? " · hay configuración desactualizada que se corrige en la próxima llamada" : ""}</p>
  ${link}
</div>`,
  };
}

interface StoredAlertState { level: ConvAIAlertLevel; since: string }

function parseState(raw: unknown): StoredAlertState | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && (parsed.level === "ok" || parsed.level === "red") ? parsed as StoredAlertState : null;
  } catch { return null; }
}

export interface ConvAIHealthAlertDeps {
  check: () => Promise<ConvAIHealthForAlert>;
  send: (to: string, subject: string, html: string) => Promise<boolean>;
  gmailAvailable: () => boolean;
  panelUrl: () => string | null;
  execute?: typeof db.execute;
}

export type ConvAIHealthAlertResult =
  | { action: "skipped"; reason: string }
  | { action: "unchanged"; level: ConvAIAlertLevel }
  | { action: "recorded"; level: ConvAIAlertLevel }
  | { action: "notified"; level: ConvAIAlertLevel; to: string }
  | { action: "send_failed"; level: ConvAIAlertLevel };

export async function runConvAIHealthAlert(deps: ConvAIHealthAlertDeps): Promise<ConvAIHealthAlertResult> {
  const execute = deps.execute ?? db.execute.bind(db);
  let report: ConvAIHealthForAlert;
  try {
    report = await deps.check();
  } catch (err) {
    // Sin dato fiable no se cambia el estado ni se avisa.
    logger.warn({ err: (err as Error)?.message }, "ConvAI health alert: check failed; state unchanged");
    return { action: "skipped", reason: "check_failed" };
  }
  const level = alertLevelOf(report);

  await execute(sql`
    CREATE TABLE IF NOT EXISTS platform_settings_kv (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ DEFAULT NOW())
  `);
  const rows = await execute(sql`
    SELECT key, value FROM platform_settings_kv
    WHERE key IN (${CONVAI_HEALTH_ALERT_STATE_KEY}, ${CONVAI_HEALTH_ALERT_EMAIL_KEY})
  `);
  const byKey = new Map(((rows as any).rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  const previousRaw = (byKey.get(CONVAI_HEALTH_ALERT_STATE_KEY) as string | undefined) ?? null;
  const previous = parseState(previousRaw);
  if (previous?.level === level) return { action: "unchanged", level };

  // Primera ejecución con todo bien: solo se guarda la línea base, sin email.
  const shouldNotify = !(previous === null && level === "ok");
  const nextRaw = JSON.stringify({ level, since: report.checkedAt } satisfies StoredAlertState);

  // Reclamar la transición: solo la instancia que cambia la fila envía el aviso.
  const claimed = previousRaw === null
    ? await execute(sql`
        INSERT INTO platform_settings_kv (key, value, updated_at)
        VALUES (${CONVAI_HEALTH_ALERT_STATE_KEY}, ${nextRaw}, NOW())
        ON CONFLICT (key) DO NOTHING
        RETURNING key
      `)
    : await execute(sql`
        UPDATE platform_settings_kv SET value = ${nextRaw}, updated_at = NOW()
        WHERE key = ${CONVAI_HEALTH_ALERT_STATE_KEY} AND value = ${previousRaw}
        RETURNING key
      `);
  if (!((claimed as any).rows ?? []).length) return { action: "skipped", reason: "claimed_by_other_instance" };
  if (!shouldNotify) return { action: "recorded", level };

  const revert = async () => {
    await execute(previousRaw === null
      ? sql`DELETE FROM platform_settings_kv WHERE key = ${CONVAI_HEALTH_ALERT_STATE_KEY} AND value = ${nextRaw}`
      : sql`UPDATE platform_settings_kv SET value = ${previousRaw}, updated_at = NOW() WHERE key = ${CONVAI_HEALTH_ALERT_STATE_KEY} AND value = ${nextRaw}`);
  };
  if (!deps.gmailAvailable()) {
    await revert();
    logger.warn("ConvAI health alert: Gmail not available; will retry next run");
    return { action: "send_failed", level };
  }
  const to = (byKey.get(CONVAI_HEALTH_ALERT_EMAIL_KEY) as string | undefined)?.trim()
    || process.env.ADMIN_EMAIL?.trim() || "craftershopy@gmail.com";
  const base = deps.panelUrl();
  const { subject, html } = buildConvAIAlertEmail(level, report, base ? `${base}/fusion-studio-pro` : null);
  let sent = false;
  try { sent = await deps.send(to, subject, html); } catch { sent = false; }
  if (!sent) {
    await revert();
    logger.warn({ level }, "ConvAI health alert: email failed; state reverted to retry next run");
    return { action: "send_failed", level };
  }
  logger.info({ level, to }, "ConvAI health alert email sent");
  return { action: "notified", level, to };
}

/** Punto de entrada del cron: cablea la comprobación real, Gmail y la URL pública. */
export async function runConvAIHealthAlertJob(): Promise<ConvAIHealthAlertResult> {
  const [{ checkConvAIHealth }, gmail, { publicAppUrl }] = await Promise.all([
    import("../routes/voice.js"),
    import("./gmail.js"),
    import("./account-tokens.js"),
  ]);
  if (!process.env.ELEVENLABS_API_KEY) return { action: "skipped", reason: "missing_key" };
  return runConvAIHealthAlert({
    check: checkConvAIHealth,
    send: gmail.sendEmail,
    gmailAvailable: gmail.isGmailAvailable,
    panelUrl: publicAppUrl,
  });
}
