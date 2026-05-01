/**
 * Helpers críticos para shopybrain.ts (CRIT-1, CRIT-2, CRIT-3, CRIT-4, CRIT-5, CRIT-6)
 *
 * - getSessionProjectId / tryGetSessionProjectId : projectId sin hardcoded fallback
 * - fetchImageWithSizeLimit : descarga de imagen con protección anti-bomba
 * - DESTRUCTIVE_ACTIONS + requireConfirmation : confirmación de acciones destructivas
 * - validateFixCodePath : whitelist de paths para fix_code / modify_ui
 * - normalizeListDirectory : path normalizado para list_source_files
 */

import type { Request } from "express";
import path from "path";

// ─── CRIT-2, CRIT-3: projectId sin hardcoded fallback ────────────────────────

export function getSessionProjectId(
  req: Request,
  params: Record<string, unknown> | undefined,
): number {
  const paramId = params?.projectId;
  if (paramId !== undefined && paramId !== null && paramId !== "") {
    const parsed = parseInt(String(paramId), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  const sessionClientId = (req.session as { clientId?: number | string | null } | undefined)?.clientId;
  if (sessionClientId !== null && sessionClientId !== undefined) {
    const parsed = typeof sessionClientId === "number"
      ? sessionClientId
      : parseInt(String(sessionClientId), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  throw new Error(
    "No se pudo determinar el projectId. Proporciona params.projectId explícitamente " +
    "o asegúrate de estar autenticado con un proyecto asociado."
  );
}

export function tryGetSessionProjectId(
  req: Request,
  params: Record<string, unknown> | undefined,
): number | null {
  try {
    return getSessionProjectId(req, params);
  } catch {
    return null;
  }
}

// ─── CRIT-4: descarga de imagen con límite de tamaño ────────────────────────

const DEFAULT_MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DEFAULT_IMAGE_TIMEOUT_MS = 60_000;
const HEAD_TIMEOUT_MS = 10_000;

export interface FetchedImage {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
}

export async function fetchImageWithSizeLimit(
  url: string,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES,
  options: { timeoutMs?: number } = {},
): Promise<FetchedImage> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS;

  try {
    const headResp = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    const contentLength = headResp.headers.get("content-length");
    if (contentLength) {
      const declaredBytes = parseInt(contentLength, 10);
      if (!isNaN(declaredBytes) && declaredBytes > maxBytes) {
        throw new Error(
          `Imagen demasiado grande: ${Math.round(declaredBytes / 1024 / 1024)}MB (máx ${maxBytes / 1024 / 1024}MB)`,
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Imagen demasiado grande")) {
      throw err;
    }
  }

  const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!resp.ok) {
    throw new Error(`No se pudo descargar la imagen: HTTP ${resp.status} ${resp.statusText}`);
  }

  const mimeType = resp.headers.get("content-type") || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    throw new Error(`La URL no apunta a una imagen (content-type: ${mimeType})`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error("No se pudo leer el body de la respuesta");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw new Error(
          `Imagen demasiado grande: excedió ${maxBytes / 1024 / 1024}MB durante la descarga`,
        );
      }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }

  return {
    buffer: Buffer.concat(chunks),
    mimeType,
    sizeBytes: totalBytes,
  };
}

// ─── CRIT-6: confirmación destructiva ───────────────────────────────────────

export const DESTRUCTIVE_ACTIONS = new Set<string>([
  "delete_product",
  "delete_collection",
  "delete_variant",
  "delete_email_flow",
  "delete_character",
  "deactivate_user",
  "reset_user_password",
  "reset_cms",
  "fix_unpublished",
  "fix_missing_compare_prices",
  "sync_catalog_prices",
  "optimize_all_products",
  "bulk_redesign",
  "bulk_update_prices",
  "bulk_update_stock",
  "auto_collections",
  "design_all_pages",
  "setup_full_store",
  "fix_code",
  "modify_ui",
  "edit_theme_file",
  "edit_theme_css",
  "edit_theme_settings",
  "create_theme_section",
  "sync_store_theme",
]);

export interface ConfirmationPreview {
  summary: string;
  items?: unknown[];
  estimatedCost?: string;
}

export interface ConfirmationResult {
  requiresConfirmation: true;
  action: string;
  preview: ConfirmationPreview;
  message: string;
}

export function requireConfirmation(
  params: Record<string, unknown> | undefined,
  action: string,
  preview: ConfirmationPreview,
): ConfirmationResult | null {
  if (!DESTRUCTIVE_ACTIONS.has(action)) return null;
  if (params?.confirmed === true || params?.confirmed === "true") return null;

  return {
    requiresConfirmation: true,
    action,
    preview,
    message:
      `⚠️ **Confirmación requerida para \`${action}\`**\n\n` +
      `${preview.summary}\n` +
      (preview.estimatedCost ? `\n💰 **Coste:** ${preview.estimatedCost}\n` : "") +
      `\nRe-envía la acción añadiendo \`"confirmed": true\` en los parámetros.`,
  };
}

// ─── CRIT-1: whitelist de paths modificables ────────────────────────────────

const ALLOWED_FIX_CODE_PATHS = [
  /^(src\/)?(pages|components|hooks|contexts|lib|styles|utils)\//,
  /^(src\/)?(routes|services|helpers|lib|middlewares)\//,
];

const FORBIDDEN_FIX_CODE_FILES = new Set([
  "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "tsconfig.json", "vite.config.ts", "capacitor.config.ts",
  ".env", ".env.production", ".env.development", ".env.local",
  "drizzle.config.ts", "SKILLS.md", "README.md",
]);

const FORBIDDEN_FIX_CODE_PATH_PATTERNS = [
  /^(src\/)?(db|schema|migrations)\//,
  /^(src\/)?(\.env|\.git)/,
  /node_modules\//,
  /dist\//,
  /build\//,
  /\.env/,
];

const ALLOWED_FIX_CODE_EXTS = /\.(tsx?|jsx?|css|scss|md)$/;

export function validateFixCodePath(filePath: string): string | null {
  const pathStr = String(filePath).replace(/^\.?\/+/, "");
  const basename = pathStr.split("/").pop() || "";

  if (pathStr.includes("..") || pathStr.includes("\0")) {
    return "Path inválido: no se permiten '..' ni caracteres nulos";
  }

  const isAllowedPath = ALLOWED_FIX_CODE_PATHS.some((re) => re.test(pathStr));
  if (!isAllowedPath) {
    return (
      `Path no permitido: ${filePath}. Solo se pueden modificar archivos en ` +
      `src/pages, src/components, src/routes, src/lib, src/services, src/hooks, src/styles.`
    );
  }

  if (FORBIDDEN_FIX_CODE_FILES.has(basename)) {
    return `Archivo protegido: ${basename} no se puede modificar vía fix_code.`;
  }

  if (FORBIDDEN_FIX_CODE_PATH_PATTERNS.some((re) => re.test(pathStr))) {
    return `Path protegido: ${filePath} (rutas de DB, env, node_modules o build están bloqueadas).`;
  }

  if (!ALLOWED_FIX_CODE_EXTS.test(basename)) {
    return `Extensión no permitida: ${basename}. Solo .ts, .tsx, .js, .jsx, .css, .scss, .md.`;
  }

  return null;
}

// ─── CRIT-5: validación de directory para list_source_files ─────────────────

export function normalizeListDirectory(
  input: string,
  workspaceRoot: string,
): string | null {
  if (input.includes("..") || (input.length > 0 && /^[A-Za-z]:[\\/]/.test(input)) ||
      input.startsWith("/") || input.includes("\0")) {
    return null;
  }

  const rawDir = input
    ? (input.startsWith("src") ? input : `src/${input}`).replace(/\/+/g, "/").replace(/\/$/, "")
    : "src";

  const candidate = path.resolve(workspaceRoot, rawDir);
  const srcRoot = path.resolve(workspaceRoot, "src");

  if (!candidate.startsWith(srcRoot)) return null;

  return path.relative(workspaceRoot, candidate);
}

// ─── HTML escape utility ─────────────────────────────────────────────────────

export function escHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
