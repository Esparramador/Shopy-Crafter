/**
 * Todo HTML (o SVG) que sirve el API sale de la IA, de webs ajenas o de datos que
 * escriben clientes y visitantes. Se sirve en el mismo origen que el panel, así que
 * sin aislar un <script> dentro tendría la sesión del admin.
 *
 * `sandbox allow-scripts` lo carga en un origen opaco: los informes siguen pudiendo
 * usar sus scripts (gráficas), pero no leen cookies ni llaman al API como el usuario.
 */
import type { NextFunction, Request, Response } from "express";
import type { ServerResponse } from "http";

export const GENERATED_HTML_CSP =
  "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals";

const ISOLATE_TYPES = /^\s*(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml)/i;

/** Añade la CSP de aislamiento si la respuesta es HTML/SVG y la ruta no ha puesto una propia. */
export function applySandboxIfHtml(res: ServerResponse): void {
  if (res.headersSent || res.getHeader("Content-Security-Policy")) return;
  const ct = String(res.getHeader("Content-Type") ?? "");
  if (ISOLATE_TYPES.test(ct)) res.setHeader("Content-Security-Policy", GENERATED_HTML_CSP);
}

export function sandboxHtmlResponses(_req: Request, res: Response, next: NextFunction): void {
  const original = res.writeHead;
  // writeHead es el último punto antes de enviar cabeceras (res.send/end/static pasan por aquí).
  res.writeHead = function patchedWriteHead(this: Response, ...args: unknown[]) {
    const headersArg = args.find((a, i) => i > 0 && a && typeof a === "object" && !Array.isArray(a)) as
      | Record<string, unknown>
      | undefined;
    if (headersArg) {
      const key = Object.keys(headersArg).find(k => k.toLowerCase() === "content-type");
      if (key && !this.getHeader("Content-Type")) this.setHeader("Content-Type", String(headersArg[key]));
    }
    applySandboxIfHtml(this);
    return (original as (...a: unknown[]) => Response).apply(this, args);
  } as typeof res.writeHead;
  next();
}
