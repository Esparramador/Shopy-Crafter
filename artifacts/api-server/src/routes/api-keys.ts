/**
 * GET  /api/admin/api-keys          — lista todas las API keys configuradas (masked)
 * POST /api/admin/api-keys          — añade/actualiza una API key en DB
 * POST /api/admin/api-keys/:id/test — prueba la key en vivo
 * DELETE /api/admin/api-keys/:id    — elimina una key de DB
 */
import { Router, Request, Response } from "express";
import { requireAdmin } from "../lib/auth.js";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { encrypt, isUsingTemporaryKey, safeDecrypt } from "../lib/crypto.js";

const router = Router();

// ── Aplicación de claves al proceso ──────────────────────────────────────────
// La clave guardada en el panel es la decisión más reciente del admin: manda
// sobre la del entorno (antes, tras reiniciar, la clave vieja del entorno ganaba
// y la actualizada en el panel se ignoraba). Se guarda el valor original del
// entorno para restaurarlo al desactivar o borrar la clave del panel.
const originalEnv = new Map<string, string | undefined>();

function applyKey(name: string, value: string): void {
  if (!originalEnv.has(name)) originalEnv.set(name, process.env[name]);
  process.env[name] = value;
}

function revertKey(name: string): void {
  if (!originalEnv.has(name)) return;
  const original = originalEnv.get(name);
  if (original === undefined) delete process.env[name];
  else process.env[name] = original;
  originalEnv.delete(name);
}

/** En BD cifrada (si hay ENCRYPTION_KEY persistente); filas antiguas en claro siguen valiendo. */
function sealKey(value: string): string {
  return isUsingTemporaryKey() ? value : encrypt(value);
}
function openKey(stored: string): string {
  return safeDecrypt(stored) || stored;
}

// Solo nombres de variable de credenciales; nunca la configuración del propio
// servidor (BD, sesión, cifrado, entorno).
const KEY_NAME_RE = /^[A-Z][A-Z0-9_]{2,119}$/;
const PROTECTED_ENV = new Set([
  "DATABASE_URL", "SESSION_SECRET", "ENCRYPTION_KEY", "NODE_ENV", "PORT", "PATH", "HOME",
  "PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "APP_URL", "BASE_PATH",
  "REPL_IDENTITY", "WEB_REPL_RENEWAL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN", "REPLIT_CONNECTORS_HOSTNAME",
]);
function isAllowedKeyName(name: unknown): name is string {
  return typeof name === "string" && KEY_NAME_RE.test(name) && !PROTECTED_ENV.has(name) && !name.startsWith("PG") && !name.startsWith("REPL");
}

// ── Ensure table ─────────────────────────────────────────────────────────────
async function ensureApiKeysTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS platform_api_keys (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(80) NOT NULL,
      key_name VARCHAR(120) NOT NULL,
      key_value TEXT NOT NULL,
      description TEXT DEFAULT '',
      category VARCHAR(60) DEFAULT 'other',
      is_active BOOLEAN DEFAULT TRUE,
      last_tested_at TIMESTAMP,
      last_test_ok BOOLEAN,
      last_test_error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(provider, key_name)
    )
  `);
}
ensureApiKeysTable().catch(e => logger.error({ e }, "api-keys table init failed"));

function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 8) return "••••••••";
  return k.slice(0, 4) + "••••••••••••" + k.slice(-4);
}

// Known providers catalog
const PROVIDER_CATALOG = [
  { provider: "xai", key_name: "XAI_API_KEY", label: "xAI / Grok", icon: "⚡", category: "ai", description: "Grok 3, imágenes Aurora, vídeo xAI", docs: "https://console.x.ai" },
  { provider: "anthropic", key_name: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)", icon: "🧠", category: "ai", description: "Claude Sonnet, Opus — guiones, copy, análisis", docs: "https://console.anthropic.com" },
  { provider: "gemini", key_name: "GEMINI_API_KEY", label: "Google Gemini", icon: "♊", category: "ai", description: "Gemini Flash/Pro, Imagen 4/5, Veo 3/4", docs: "https://aistudio.google.com" },
  { provider: "replicate", key_name: "REPLICATE_API_TOKEN", label: "Replicate", icon: "🔵", category: "media", description: "Flux, Seedance, Kling, Hailuo, Wan, Sora", docs: "https://replicate.com/account/api-tokens" },
  { provider: "runway", key_name: "RUNWAY_API_KEY", label: "Runway ML", icon: "🏃", category: "media", description: "Gen4.5, Gen4.5 Turbo, Seedance2 — vídeo cinematográfico", docs: "https://app.runwayml.com/settings" },
  { provider: "elevenlabs", key_name: "ELEVENLABS_API_KEY", label: "ElevenLabs", icon: "🎙️", category: "audio", description: "TTS, clonado de voz, Dubbing Studio", docs: "https://elevenlabs.io/app/settings" },
  { provider: "tripo3d", key_name: "TRIPO_API_KEY", label: "Tripo3D", icon: "🧊", category: "media", description: "Generación de modelos 3D, rigging, animaciones", docs: "https://platform.tripo3d.ai" },
  { provider: "meshy", key_name: "MESHY_API_KEY", label: "Meshy AI", icon: "🟣", category: "media", description: "3D con animaciones — 134 presets de movimiento", docs: "https://app.meshy.ai" },
  { provider: "stitch", key_name: "STITCH_API_KEY", label: "Google Stitch", icon: "🎨", category: "design", description: "MCP para diseño UI/UX con IA", docs: "https://stitch.googleapis.com" },
  { provider: "youtube", key_name: "YOUTUBE_CLIENT_ID", label: "YouTube OAuth", icon: "▶️", category: "social", description: "Subir vídeos, gestionar canal, estadísticas", docs: "https://console.cloud.google.com" },
  { provider: "stripe", key_name: "STRIPE_SECRET_KEY", label: "Stripe — Clave Secreta (sk_...)", icon: "💳", category: "payments", description: "Cobros SaaS via Stripe Checkout — usa sk_test_ para pruebas, sk_live_ en producción", docs: "https://dashboard.stripe.com/apikeys" },
  { provider: "stripe", key_name: "STRIPE_PUBLISHABLE_KEY", label: "Stripe — Clave Publicable (pk_...)", icon: "💳", category: "payments", description: "Clave pública Stripe (pk_test_ o pk_live_) para el frontend", docs: "https://dashboard.stripe.com/apikeys" },
  { provider: "stripe", key_name: "STRIPE_WEBHOOK_SECRET", label: "Stripe — Webhook Secret (whsec_...)", icon: "🔔", category: "payments", description: "Firma de webhooks (Stripe Dashboard → Webhooks → Signing secret). Activa activación automática tras pago.", docs: "https://dashboard.stripe.com/webhooks" },
  { provider: "openai", key_name: "OPENAI_API_KEY", label: "OpenAI", icon: "🤖", category: "ai", description: "GPT-4o, gpt-image-2, whisper, embeddings", docs: "https://platform.openai.com/api-keys" },
];

// ── GET /api/admin/api-keys ───────────────────────────────────────────────────
router.get("/admin/api-keys", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, provider, key_name, key_value, description, category, is_active,
             last_tested_at, last_test_ok, last_test_error, created_at, updated_at
      FROM platform_api_keys ORDER BY category, provider
    `);

    // Merge DB keys with env-var detected keys
    const dbKeys = rows.rows as any[];
    const dbKeyMap = new Map(dbKeys.map(r => [`${r.provider}:${r.key_name}`, r]));

    const merged = PROVIDER_CATALOG.map(cat => {
      const dbRow = dbKeyMap.get(`${cat.provider}:${cat.key_name}`);
      const envVal = process.env[cat.key_name];
      const hasEnv = !!envVal;
      return {
        id: dbRow?.id || null,
        provider: cat.provider,
        key_name: cat.key_name,
        label: cat.label,
        icon: cat.icon,
        category: cat.category,
        description: cat.description,
        docs: cat.docs,
        source: dbRow ? "db" : hasEnv ? "env" : "missing",
        is_active: dbRow ? dbRow.is_active : hasEnv,
        masked_value: dbRow ? maskKey(openKey(dbRow.key_value)) : hasEnv ? maskKey(envVal!) : null,
        last_tested_at: dbRow?.last_tested_at || null,
        last_test_ok: dbRow?.last_test_ok ?? (hasEnv ? null : false),
        last_test_error: dbRow?.last_test_error || null,
      };
    });

    // Also include any DB keys not in catalog
    dbKeys.filter(r => !PROVIDER_CATALOG.find(c => c.provider === r.provider && c.key_name === r.key_name))
      .forEach(r => merged.push({
        id: r.id, provider: r.provider, key_name: r.key_name, label: r.provider,
        icon: "🔑", category: r.category || "other", description: r.description || "",
        docs: "", source: "db", is_active: r.is_active,
        masked_value: maskKey(openKey(r.key_value)),
        last_tested_at: r.last_tested_at, last_test_ok: r.last_test_ok,
        last_test_error: r.last_test_error,
      }));

    res.json({ keys: merged, categories: [...new Set(PROVIDER_CATALOG.map(c => c.category))] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/api-keys ──────────────────────────────────────────────────
router.post("/admin/api-keys", requireAdmin, async (req: Request, res: Response) => {
  const { provider, key_name, key_value, description, category } = req.body;
  if (!provider || !key_name || typeof key_value !== "string" || !key_value.trim()) {
    res.status(400).json({ error: "provider, key_name y key_value son requeridos" }); return;
  }
  if (!isAllowedKeyName(key_name)) {
    res.status(400).json({ error: "key_name debe ser una variable de credencial (MAYÚSCULAS_CON_GUIONES) y no una variable del sistema" }); return;
  }
  const cleanValue = key_value.trim();
  try {
    await db.execute(sql`
      INSERT INTO platform_api_keys (provider, key_name, key_value, description, category, updated_at)
      VALUES (${provider}, ${key_name}, ${sealKey(cleanValue)}, ${description || ""}, ${category || "other"}, NOW())
      ON CONFLICT (provider, key_name) DO UPDATE SET
        key_value = EXCLUDED.key_value,
        is_active = TRUE,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        updated_at = NOW(),
        last_test_ok = NULL,
        last_test_error = NULL
    `);
    // Efecto inmediato en este proceso (los clientes SDK se recrean al detectar la clave nueva).
    applyKey(key_name, cleanValue);
    logger.info({ provider, key_name }, "api-key saved and injected to env");
    res.json({ success: true, message: `Key ${key_name} guardada y activada en tiempo real` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/api-keys/:id/test ────────────────────────────────────────
router.post("/admin/api-keys/:id/test", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    const rows = await db.execute(sql`SELECT * FROM platform_api_keys WHERE id = ${id}`);
    const key = rows.rows[0] as any;
    if (!key) { res.status(404).json({ error: "Key no encontrada" }); return; }

    let ok = false;
    let detail = "";
    const val = openKey(key.key_value);
    const kn = key.key_name as string;

    try {
      if (kn.includes("XAI") || kn.includes("GROK")) {
        const r = await fetch("https://api.x.ai/v1/models", { headers: { Authorization: `Bearer ${val}` } });
        ok = r.ok; detail = ok ? "xAI API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("ANTHROPIC")) {
        const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": val, "anthropic-version": "2023-06-01" } });
        ok = r.ok; detail = ok ? "Anthropic API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("GEMINI") || kn.includes("GOOGLE_API")) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${val}`);
        ok = r.ok; detail = ok ? "Gemini API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("REPLICATE")) {
        const r = await fetch("https://api.replicate.com/v1/account", { headers: { Authorization: `Token ${val}` } });
        ok = r.ok; detail = ok ? "Replicate API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("RUNWAY")) {
        const r = await fetch("https://api.dev.runwayml.com/v1/organization", { headers: { Authorization: `Bearer ${val}`, "X-Runway-Version": "2024-11-06" } });
        ok = r.ok || r.status === 403; detail = ok ? "Runway API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("ELEVENLABS")) {
        const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": val } });
        ok = r.ok; detail = ok ? "ElevenLabs API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("TRIPO")) {
        const r = await fetch("https://platform.tripo3d.ai/api/v2/user/balance", { headers: { Authorization: `Bearer ${val}` } });
        ok = r.ok; detail = ok ? "Tripo3D API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("MESHY")) {
        const r = await fetch("https://api.meshy.ai/openapi/v2/animations?page_num=0&page_size=1", { headers: { Authorization: `Bearer ${val}` } });
        ok = r.ok; detail = ok ? "Meshy API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("STRIPE")) {
        const r = await fetch("https://api.stripe.com/v1/account", { headers: { Authorization: `Bearer ${val}` } });
        ok = r.ok; detail = ok ? "Stripe API accesible" : `HTTP ${r.status}`;
      } else if (kn.includes("OPENAI")) {
        const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${val}` } });
        ok = r.ok; detail = ok ? "OpenAI API accesible" : `HTTP ${r.status}`;
      } else {
        ok = !!val && val.length > 8;
        detail = ok ? "Key válida (test básico de longitud)" : "Key demasiado corta";
      }
    } catch (e: any) {
      ok = false; detail = `Error de red: ${e.message}`;
    }

    await db.execute(sql`
      UPDATE platform_api_keys SET last_tested_at = NOW(), last_test_ok = ${ok}, last_test_error = ${ok ? null : detail}, updated_at = NOW()
      WHERE id = ${id}
    `);

    res.json({ ok, detail, provider: key.provider, key_name: kn });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/admin/api-keys/:id ───────────────────────────────────────────
router.delete("/admin/api-keys/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    const rows = await db.execute(sql`DELETE FROM platform_api_keys WHERE id = ${id} RETURNING key_name`);
    const name = (rows.rows[0] as { key_name?: string } | undefined)?.key_name;
    // Antes la clave borrada seguía activa en el proceso hasta reiniciar.
    if (name) revertKey(name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/admin/api-keys/:id/toggle ───────────────────────────────────────
router.put("/admin/api-keys/:id/toggle", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  try {
    const rows = await db.execute(sql`UPDATE platform_api_keys SET is_active = NOT is_active, updated_at = NOW() WHERE id = ${id} RETURNING key_name, key_value, is_active`);
    const row = rows.rows[0] as { key_name: string; key_value: string; is_active: boolean } | undefined;
    // Antes desactivar no tenía efecto hasta reiniciar.
    if (row && isAllowedKeyName(row.key_name)) {
      if (row.is_active) applyKey(row.key_name, openKey(row.key_value));
      else revertKey(row.key_name);
    }
    res.json({ success: true, is_active: row?.is_active ?? null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/billing-config ────────────────────────────────────────────
router.get("/admin/billing-config", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_settings_kv (
        key VARCHAR(120) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const rows = await db.execute(sql`SELECT value FROM platform_settings_kv WHERE key = 'billing_provider'`);
    const provider = (rows.rows[0] as any)?.value || "shopify";
    res.json({ provider });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/admin/billing-config ───────────────────────────────────────────
router.post("/admin/billing-config", requireAdmin, async (req: Request, res: Response) => {
  const { provider } = req.body;
  if (!["shopify", "stripe"].includes(provider)) return res.status(400).json({ error: "provider must be shopify or stripe" }) as any;
  try {
    await db.execute(sql`
      INSERT INTO platform_settings_kv (key, value, updated_at)
      VALUES ('billing_provider', ${provider}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${provider}, updated_at = NOW()
    `);
    res.json({ success: true, provider });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/api-keys/startup-inject ──────────────────────────────────
// Called at startup to inject DB keys into process.env
export async function injectDbApiKeys() {
  try {
    const rows = await db.execute(sql`SELECT key_name, key_value FROM platform_api_keys WHERE is_active = TRUE`);
    const applied: string[] = [];
    const overridden: string[] = [];
    for (const row of rows.rows as Array<{ key_name: string; key_value: string }>) {
      if (!isAllowedKeyName(row.key_name)) {
        logger.warn({ key_name: row.key_name }, "api-keys: nombre de variable no permitido — ignorado");
        continue;
      }
      const value = openKey(row.key_value);
      if (!value) continue;
      if (process.env[row.key_name] && process.env[row.key_name] !== value) overridden.push(row.key_name);
      applyKey(row.key_name, value);
      applied.push(row.key_name);
    }
    if (applied.length) logger.info({ applied, overridden }, "api-keys: claves del panel aplicadas (mandan sobre el entorno)");
  } catch (err) {
    logger.error({ err }, "api-keys: no se pudieron cargar las claves del panel");
  }
}

export default router;
