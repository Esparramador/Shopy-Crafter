/**
 * Tokens de un solo uso para invitaciones y recuperación de contraseña.
 *
 * El enlace lleva el token en claro; en la base de datos solo se guarda su
 * SHA-256, así una lectura de la tabla `users` no permite tomar cuentas con
 * invitaciones o resets pendientes. `tokenLookupValues` acepta además el valor
 * en claro para que los enlaces emitidos antes de este cambio sigan valiendo
 * hasta que caduquen (48 h invitación, 1 h reset).
 */
import { createHash, randomBytes } from "crypto";
import type { Request } from "express";

const TOKEN_RE = /^[a-f0-9]{64}$/;

export function newAccountToken(): { token: string; stored: string } {
  const token = randomBytes(32).toString("hex");
  return { token, stored: hashAccountToken(token) };
}

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Valores a buscar en BD para un token recibido; `null` si el formato no es válido. */
export function tokenLookupValues(token: unknown): string[] | null {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  return [hashAccountToken(token), token];
}

/**
 * URL pública de la app para enlaces enviados por email. Solo desde el entorno
 * (APP_URL, dominio de despliegue de Replit o dominio de desarrollo): nunca de
 * la cabecera Host de una petición anónima, que un atacante controla.
 */
export function publicAppUrl(): string | null {
  const fromEnv = process.env.APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const deployDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (deployDomain) return `https://${deployDomain}`;
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;
  return null;
}

export interface SessionUser {
  id: string;
  role: "admin" | "client";
  clientId: string | null;
  name: string;
  email: string;
}

/**
 * Inicia sesión con un id de sesión nuevo (evita fijación de sesión: un id
 * plantado antes del login no queda autenticado).
 */
export function establishSession(req: Request, user: SessionUser): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate(err => {
      if (err) { reject(err); return; }
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.clientId = user.clientId ?? null;
      req.session.name = user.name;
      req.session.email = user.email;
      req.session.save(saveErr => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}
