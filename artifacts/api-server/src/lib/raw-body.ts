import type { IncomingMessage } from "http";

export type RequestWithRawBody = IncomingMessage & { rawBody?: Buffer };

/**
 * `verify` de express.json(): guarda el cuerpo EXACTO en `req.rawBody` para las
 * rutas de webhook, que lo necesitan para verificar la firma (Stripe
 * constructEvent, HMAC de Shopify/WooCommerce). Re-serializar el JSON no
 * garantiza los mismos bytes. Solo esas rutas, para no duplicar memoria.
 */
export function keepRawBodyForWebhooks(req: IncomingMessage, _res: unknown, buf: Buffer): void {
  if (req.url?.includes("/webhook")) (req as RequestWithRawBody).rawBody = Buffer.from(buf);
}
