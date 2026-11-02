/**
 * POST a /api/shopybrain/execute-action con confirmación humana.
 *
 * Las acciones destructivas (borrar, editar código o tema, cambios masivos) vuelven
 * con `requiresConfirmation` y un `confirmToken` de un solo uso. Aquí se pregunta a
 * la persona con un diálogo del navegador: la IA del chat no puede pulsarlo, así que
 * un texto inyectado no puede confirmar nada por su cuenta.
 *
 * Misma firma que fetch(): sustituye a `fetch(url, init)` sin tocar el resto.
 */
function plain(md: string): string {
  return md.replace(/\*\*/g, "").replace(/`/g, "").replace(/[#>]/g, "").trim();
}

export async function fetchBrainAction(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok || typeof window === "undefined") return res;
  const data = await res.clone().json().catch(() => null) as
    | { requiresConfirmation?: boolean; confirmToken?: string; message?: string }
    | null;
  if (!data?.requiresConfirmation || !data.confirmToken) return res;

  const ok = window.confirm(`${plain(data.message ?? "¿Confirmas esta acción?")}\n\nPulsa Aceptar para aplicarla.`);
  if (!ok) {
    return new Response(JSON.stringify({ error: true, cancelled: true, message: "Acción cancelada: no se ha hecho ningún cambio." }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  let body: { action?: string; params?: Record<string, unknown> } = {};
  try { body = JSON.parse(String(init.body ?? "{}")); } catch { /* cuerpo no JSON: no se reintenta */ return res; }
  return fetch(url, {
    ...init,
    body: JSON.stringify({ ...body, params: { ...(body.params ?? {}), confirmed: true, confirmToken: data.confirmToken } }),
  });
}
