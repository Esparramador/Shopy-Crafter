/**
 * stripe-tenant.ts — The Vault / Dynamic Stripe Client Injector
 * ─────────────────────────────────────────────────────────────────────────────
 * Resuelve el cliente correcto de Stripe para cada tenant (proyecto):
 *   · "direct"         → la clave API secreta del cliente (guardada encriptada)
 *   · "connect_custom" → cuenta Connect Custom creada desde la cuenta Master
 *   · "connect_oauth"  → cuenta Connect Standard/Express (OAuth flow)
 *   · "platform"       → fallback a la cuenta Master (STRIPE_SECRET_KEY)
 *
 * Uso como middleware Express:
 *   router.post("/charge", injectStripeTenant, (req, res) => {
 *     const { stripe, stripeMode, stripeAccountId } = req as StripeTenantRequest;
 *   });
 */

import type { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { sql } from "drizzle-orm";
import { encrypt, decrypt, safeDecrypt } from "./crypto.js";
import { logger } from "./logger.js";

export type StripeMode = "direct" | "connect_custom" | "connect_oauth" | "platform";

export interface StripeTenantRequest extends Request {
  stripe: Stripe;
  stripeMode: StripeMode;
  stripeAccountId?: string;
  tenantProjectId?: number;
}

const STRIPE_API_VERSION = "2024-11-20.acacia" as const;

function getPlatformStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurado en el entorno");
  return key;
}

export function getPlatformStripe(): Stripe {
  return new Stripe(getPlatformStripeKey(), { apiVersion: STRIPE_API_VERSION });
}

/**
 * Resuelve el cliente Stripe correcto para un proyecto dado.
 * Prioridad: direct key → connect_custom → connect_oauth → platform fallback
 */
export async function resolveStripeForProject(projectId: number): Promise<{
  stripe: Stripe;
  mode: StripeMode;
  accountId?: string;
}> {
  try {
    const { db } = await import("@workspace/db");
    const result = await db.execute(sql`
      SELECT
        account_id,
        account_type,
        access_token_enc,
        stripe_key_enc,
        onboarding_complete
      FROM stripe_accounts
      WHERE project_id = ${projectId}
      LIMIT 1
    `);

    if (!result.rows.length) {
      return { stripe: getPlatformStripe(), mode: "platform" };
    }

    const row = result.rows[0] as any;

    if (row.stripe_key_enc) {
      const secretKey = safeDecrypt(row.stripe_key_enc);
      if (secretKey) {
        return {
          stripe: new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION }),
          mode: "direct",
          accountId: row.account_id,
        };
      }
    }

    if (row.account_type === "custom" && row.account_id) {
      const platform = getPlatformStripe();
      return {
        stripe: new Stripe(getPlatformStripeKey(), {
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
          stripe: new Stripe(token, { apiVersion: STRIPE_API_VERSION }),
          mode: "connect_oauth",
          accountId: row.account_id,
        };
      }
    }
  } catch (err) {
    logger.warn({ err }, "stripe-tenant: falling back to platform Stripe");
  }

  return { stripe: getPlatformStripe(), mode: "platform" };
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
 * Encripta y guarda la clave API directa de un cliente en stripe_accounts.
 * Crea el registro si no existe.
 */
export async function saveDirectApiKey(
  projectId: number,
  secretKey: string,
  publishableKey?: string
): Promise<{ accountId: string; displayName: string; email: string }> {
  if (!secretKey.startsWith("sk_")) {
    throw new Error("La clave debe empezar por sk_test_ o sk_live_");
  }

  const tempStripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  const account = await tempStripe.accounts.retrieve();

  const keyEnc = encrypt(secretKey);
  const mode = secretKey.startsWith("sk_live_") ? "live" : "test";
  const accountId = `direct_${account.id ?? projectId}`;

  const { db } = await import("@workspace/db");
  await db.execute(sql`
    INSERT INTO stripe_accounts
      (project_id, account_id, stripe_key_enc, publishable_key, account_type,
       onboarding_complete, display_name, email, country, currency, metadata)
    VALUES (
      ${projectId}, ${accountId}, ${keyEnc},
      ${publishableKey ?? null}, 'direct', TRUE,
      ${(account as any).settings?.dashboard?.display_name ?? "Cuenta directa"},
      ${(account as any).email ?? null},
      ${(account as any).country ?? "ES"},
      ${(account as any).default_currency ?? "eur"},
      ${JSON.stringify({ mode, stripeAccountId: account.id })}
    )
    ON CONFLICT (account_id) DO UPDATE SET
      stripe_key_enc = EXCLUDED.stripe_key_enc,
      publishable_key = COALESCE(EXCLUDED.publishable_key, stripe_accounts.publishable_key),
      onboarding_complete = TRUE,
      metadata = EXCLUDED.metadata
  `);

  return {
    accountId,
    displayName: (account as any).settings?.dashboard?.display_name ?? "Cuenta directa",
    email: (account as any).email ?? "",
  };
}
