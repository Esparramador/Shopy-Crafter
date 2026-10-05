/**
 * stripe-tenant.ts — The Vault / Dynamic Stripe Client Injector
 * ─────────────────────────────────────────────────────────────────────────────
 * Resuelve el cliente correcto de Stripe para cada tenant (proyecto):
 *   · "direct"         → la clave API secreta del cliente (guardada encriptada)
 *   · "connect_custom" → cuenta Connect Custom creada desde la cuenta Master
 *   · "connect_oauth"  → cuenta Connect Standard/Express (OAuth flow)
 *   · "platform"       → fallback a la cuenta Master (STRIPE_SECRET_KEY)
 *
 * Reglas:
 *   · Un proyecto de plataforma "stripe" NUNCA cae en silencio a la cuenta Master:
 *     resolveStripeForProject(pid, { strict: true }) lanza StripeNotLinkedError.
 *   · Si un proyecto stripe no tiene fila en stripe_accounts pero guarda una sk_
 *     en projects.client_secret (creado desde "Nuevo proyecto"), se auto-repara
 *     registrando la cuenta (ensureStripeAccountForProject).
 *
 * Uso como middleware Express:
 *   router.post("/charge", injectStripeTenant, (req, res) => {
 *     const { stripe, stripeMode, stripeAccountId } = req as StripeTenantRequest;
 *   });
 */

import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { sql } from "drizzle-orm";
import { encrypt, safeDecrypt } from "./crypto.js";
import { logger } from "./logger.js";

export type StripeMode = "direct" | "connect_custom" | "connect_oauth" | "platform";
export type StripeKeyMode = "live" | "test";

export interface StripeTenantRequest extends Request {
  stripe: Stripe;
  stripeMode: StripeMode;
  stripeAccountId?: string;
  tenantProjectId?: number;
}

export interface StripeConnectionInfo {
  connected: boolean;
  mode: StripeMode | null;
  keyMode: StripeKeyMode | null;
  /** id interno en stripe_accounts (direct_acct_…, acct_…) */
  accountId: string | null;
  /** id real de la cuenta en Stripe (acct_…) */
  stripeAccountId: string | null;
  displayName: string | null;
  email: string | null;
  country: string | null;
  currency: string | null;
  connectedAt: string | null;
  /** true si la fila se creó ahora mismo a partir de projects.client_secret */
  selfHealed?: boolean;
}

export class StripeNotLinkedError extends Error {
  statusCode = 409;
  code = "STRIPE_NOT_LINKED";
  constructor(projectId: number) {
    super(`El proyecto ${projectId} no tiene ninguna cuenta Stripe vinculada. Añade la clave secreta (sk_…) desde el proyecto.`);
    this.name = "StripeNotLinkedError";
  }
}

export class StripeKeyInvalidError extends Error {
  statusCode = 400;
  code = "STRIPE_KEY_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "StripeKeyInvalidError";
  }
}

const STRIPE_API_VERSION = "2026-05-27.dahlia" as const;

/**
 * Solo para pruebas: STRIPE_API_BASE=http://localhost:12111 dirige el SDK a
 * stripe-mock (servidor oficial de Stripe que valida cada petición contra su
 * OpenAPI). Sin la variable se usa api.stripe.com.
 */
function stripeHostOptions(): { host?: string; port?: number; protocol?: "http" | "https" } {
  const base = process.env.STRIPE_API_BASE;
  if (!base) return {};
  const u = new URL(base);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : undefined,
    protocol: u.protocol === "http:" ? "http" : "https",
  };
}

function getPlatformStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurado en el entorno");
  return key;
}

export function getPlatformStripe(): Stripe {
  return new Stripe(getPlatformStripeKey(), { ...stripeHostOptions(), apiVersion: STRIPE_API_VERSION });
}

export function keyModeOf(secretKey: string): StripeKeyMode {
  return secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_") ? "live" : "test";
}

/**
 * Valida una clave secreta contra Stripe y devuelve la cuenta a la que pertenece.
 * Lanza StripeKeyInvalidError con mensaje legible si la clave no sirve.
 */
export async function verifyStripeSecretKey(secretKey: string): Promise<Stripe.Account> {
  const key = (secretKey ?? "").trim();
  if (!/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    throw new StripeKeyInvalidError("La clave debe ser una clave secreta de Stripe (sk_test_… o sk_live_…).");
  }
  const tempStripe = new Stripe(key, { ...stripeHostOptions(), apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 1, timeout: 15_000 });
  try {
    return await (tempStripe.accounts as any).retrieve() as Stripe.Account;
  } catch (err: any) {
    const type = err?.type ?? err?.rawType;
    if (type === "StripeAuthenticationError" || err?.statusCode === 401) {
      throw new StripeKeyInvalidError("Stripe ha rechazado la clave (clave inválida, revocada o de otra cuenta).");
    }
    if (type === "StripePermissionError" || err?.statusCode === 403) {
      throw new StripeKeyInvalidError("La clave no tiene permiso para leer la cuenta. Usa la clave secreta estándar o una restringida con permiso de lectura de 'Account'.");
    }
    throw new StripeKeyInvalidError(`No se pudo verificar la clave con Stripe: ${err?.message ?? "error de red"}`);
  }
}

async function selectAccountRow(projectId: number): Promise<any | null> {
  const { db } = await import("@workspace/db");
  const result = await db.execute(sql`
    SELECT
      account_id, account_type, access_token_enc, stripe_key_enc,
      onboarding_complete, display_name, email, country, currency,
      connected_at, metadata
    FROM stripe_accounts
    WHERE project_id = ${projectId}
    ORDER BY (stripe_key_enc IS NOT NULL) DESC, connected_at DESC NULLS LAST
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

function clientFromRow(row: any): { stripe: Stripe; mode: StripeMode; accountId?: string } | null {
  if (row.stripe_key_enc) {
    const secretKey = safeDecrypt(row.stripe_key_enc);
    if (secretKey) {
      return {
        stripe: new Stripe(secretKey, { ...stripeHostOptions(), apiVersion: STRIPE_API_VERSION }),
        mode: "direct",
        accountId: row.account_id,
      };
    }
  }
  if (row.account_type === "custom" && row.account_id) {
    return {
      stripe: new Stripe(getPlatformStripeKey(), {
        ...stripeHostOptions(),
        apiVersion: STRIPE_API_VERSION,
        stripeAccount: row.account_id,
      } as any),
      mode: "connect_custom",
      accountId: row.account_id,
    };
  }
  if (row.access_token_enc) {
    const token = safeDecrypt(row.access_token_enc);
    if (token) {
      return {
        stripe: new Stripe(token, { ...stripeHostOptions(), apiVersion: STRIPE_API_VERSION }),
        mode: "connect_oauth",
        accountId: row.account_id,
      };
    }
  }
  return null;
}

/**
 * Auto-reparación: si el proyecto es de plataforma "stripe", no tiene fila en
 * stripe_accounts y projects.client_secret contiene una sk_, la registra.
 * Devuelve true si creó la vinculación.
 */
export async function ensureStripeAccountForProject(projectId: number): Promise<boolean> {
  const { db } = await import("@workspace/db");
  const existing = await selectAccountRow(projectId);
  if (existing) return false;

  const proj = await db.execute(sql`
    SELECT platform_type, client_secret FROM projects WHERE id = ${projectId} LIMIT 1
  `);
  const p = proj.rows[0] as any;
  if (!p || p.platform_type !== "stripe" || !p.client_secret) return false;

  const secret = safeDecrypt(p.client_secret);
  if (!secret || !/^(sk|rk)_(test|live)_/.test(secret)) return false;

  try {
    await saveDirectApiKey(projectId, secret);
    logger.info({ projectId }, "stripe-tenant: cuenta Stripe auto-registrada desde projects.client_secret");
    return true;
  } catch (err) {
    logger.warn({ projectId, err }, "stripe-tenant: no se pudo auto-registrar la clave del proyecto");
    return false;
  }
}

/**
 * Resuelve el cliente Stripe correcto para un proyecto dado.
 * Prioridad: direct key → connect_custom → connect_oauth → platform fallback
 *
 * opts.strict = true → no hace fallback a la cuenta Master: lanza StripeNotLinkedError.
 * Úsalo siempre que el resultado se muestre como "la cuenta del cliente".
 */
export async function resolveStripeForProject(
  projectId: number,
  opts: { strict?: boolean } = {},
): Promise<{ stripe: Stripe; mode: StripeMode; accountId?: string }> {
  try {
    let row = await selectAccountRow(projectId);
    if (!row) {
      const healed = await ensureStripeAccountForProject(projectId);
      if (healed) row = await selectAccountRow(projectId);
    }
    if (row) {
      const resolved = clientFromRow(row);
      if (resolved) return resolved;
    }
  } catch (err) {
    if (err instanceof StripeNotLinkedError) throw err;
    logger.warn({ err, projectId }, "stripe-tenant: error resolviendo cuenta del proyecto");
    if (opts.strict) throw err;
  }

  if (opts.strict) throw new StripeNotLinkedError(projectId);
  return { stripe: getPlatformStripe(), mode: "platform" };
}

/**
 * Estado de la vinculación Stripe de un proyecto (sin lanzar). Para cabeceras
 * de UI, badges y el chatbot.
 */
export async function getStripeConnection(projectId: number): Promise<StripeConnectionInfo> {
  const empty: StripeConnectionInfo = {
    connected: false, mode: null, keyMode: null, accountId: null, stripeAccountId: null,
    displayName: null, email: null, country: null, currency: null, connectedAt: null,
  };
  try {
    let row = await selectAccountRow(projectId);
    let selfHealed = false;
    if (!row) {
      selfHealed = await ensureStripeAccountForProject(projectId);
      if (selfHealed) row = await selectAccountRow(projectId);
    }
    if (!row) return empty;
    const resolved = clientFromRow(row);
    if (!resolved) return empty;

    const meta = (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) ?? {};
    let keyMode: StripeKeyMode | null = meta.mode === "live" || meta.mode === "test" ? meta.mode : null;
    if (!keyMode && row.stripe_key_enc) {
      const k = safeDecrypt(row.stripe_key_enc);
      if (k) keyMode = keyModeOf(k);
    }
    if (!keyMode && row.access_token_enc) {
      const t = safeDecrypt(row.access_token_enc);
      if (t) keyMode = keyModeOf(t);
    }
    return {
      connected: true,
      mode: resolved.mode,
      keyMode,
      accountId: row.account_id ?? null,
      stripeAccountId: meta.stripeAccountId ?? (String(row.account_id ?? "").startsWith("acct_") ? row.account_id : null),
      displayName: row.display_name ?? null,
      email: row.email ?? null,
      country: row.country ?? null,
      currency: row.currency ?? null,
      connectedAt: row.connected_at ? new Date(row.connected_at).toISOString() : null,
      selfHealed,
    };
  } catch (err) {
    logger.warn({ err, projectId }, "stripe-tenant: getStripeConnection failed");
    return empty;
  }
}

/**
 * Resuelve el cliente Stripe por account_id de stripe_accounts (rutas /stripe/accounts/:accountId/*).
 * Soporta cuentas directas (stripe_key_enc), Custom y OAuth. Lanza si no existe.
 */
export async function resolveStripeForAccount(accountId: string): Promise<{
  stripe: Stripe; mode: StripeMode; row: any;
}> {
  const { db } = await import("@workspace/db");
  const result = await db.execute(sql`
    SELECT account_id, project_id, account_type, access_token_enc, stripe_key_enc,
           display_name, email, country, currency, metadata
    FROM stripe_accounts WHERE account_id = ${accountId} LIMIT 1
  `);
  const row = result.rows[0] as any;
  if (!row) {
    const e: any = new Error("Cuenta Stripe no encontrada");
    e.statusCode = 404;
    throw e;
  }
  const resolved = clientFromRow(row);
  if (!resolved) {
    const e: any = new Error("La cuenta Stripe no tiene credenciales utilizables (clave no descifrable). Vuelve a vincularla.");
    e.statusCode = 409;
    throw e;
  }
  return { stripe: resolved.stripe, mode: resolved.mode, row };
}

/**
 * Express middleware — inyecta req.stripe, req.stripeMode, req.stripeAccountId
 * Lee projectId desde: req.params.projectId | req.body.projectId | req.query.projectId
 */
export async function injectStripeTenant(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = parseInt(
    String(
      (req as any).params?.projectId ??
      (req as any).body?.projectId ??
      (req as any).query?.projectId ??
      "0"
    ),
    10
  );

  if (!projectId) {
    const r = req as StripeTenantRequest;
    r.stripe = getPlatformStripe();
    r.stripeMode = "platform";
    return next();
  }

  const { stripe, mode, accountId } = await resolveStripeForProject(projectId);
  const r = req as StripeTenantRequest;
  r.stripe = stripe;
  r.stripeMode = mode;
  r.stripeAccountId = accountId;
  r.tenantProjectId = projectId;
  next();
}

/**
 * Valida, encripta y guarda la clave API directa de un cliente en stripe_accounts.
 * Crea el registro si no existe; sustituye la clave directa anterior del proyecto.
 */
export async function saveDirectApiKey(
  projectId: number,
  secretKey: string,
  publishableKey?: string
): Promise<{ accountId: string; stripeAccountId: string; displayName: string; email: string; keyMode: StripeKeyMode }> {
  const key = (secretKey ?? "").trim();
  const account = await verifyStripeSecretKey(key);

  const keyEnc = encrypt(key);
  const keyMode = keyModeOf(key);
  const stripeAccountId = account.id;
  const accountId = `direct_${stripeAccountId}`;
  const displayName =
    account.settings?.dashboard?.display_name ??
    account.business_profile?.name ??
    "Cuenta directa";

  const { db } = await import("@workspace/db");

  // La misma cuenta Stripe no puede estar vinculada a dos proyectos distintos
  const clash = await db.execute(sql`
    SELECT project_id FROM stripe_accounts WHERE account_id = ${accountId} AND project_id <> ${projectId} LIMIT 1
  `);
  if (clash.rows.length) {
    throw new StripeKeyInvalidError(
      `Esta cuenta Stripe (${stripeAccountId}) ya está vinculada al proyecto #${(clash.rows[0] as any).project_id}. Desvincúlala allí primero.`
    );
  }

  // Sustituir cualquier clave directa anterior de este proyecto (rotación / cambio de cuenta)
  await db.execute(sql`
    DELETE FROM stripe_accounts
    WHERE project_id = ${projectId} AND stripe_key_enc IS NOT NULL AND account_id <> ${accountId}
  `);

  await db.execute(sql`
    INSERT INTO stripe_accounts
      (project_id, account_id, stripe_key_enc, publishable_key, account_type,
       onboarding_complete, display_name, email, country, currency, metadata)
    VALUES (
      ${projectId}, ${accountId}, ${keyEnc},
      ${publishableKey ?? null}, 'direct', TRUE,
      ${displayName},
      ${account.email ?? null},
      ${account.country ?? "ES"},
      ${account.default_currency ?? "eur"},
      ${JSON.stringify({ mode: keyMode, stripeAccountId })}
    )
    ON CONFLICT (account_id) DO UPDATE SET
      stripe_key_enc = EXCLUDED.stripe_key_enc,
      publishable_key = COALESCE(EXCLUDED.publishable_key, stripe_accounts.publishable_key),
      display_name = EXCLUDED.display_name,
      email = COALESCE(EXCLUDED.email, stripe_accounts.email),
      onboarding_complete = TRUE,
      metadata = EXCLUDED.metadata
  `);

  return { accountId, stripeAccountId, displayName, email: account.email ?? "", keyMode };
}

/** Elimina la vinculación Stripe de un proyecto (todas sus filas). */
export async function unlinkStripeForProject(projectId: number): Promise<number> {
  const { db } = await import("@workspace/db");
  const r = await db.execute(sql`DELETE FROM stripe_accounts WHERE project_id = ${projectId}`);
  return Number((r as any).rowCount ?? 0);
}
