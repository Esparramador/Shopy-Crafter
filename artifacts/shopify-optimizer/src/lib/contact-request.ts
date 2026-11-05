/** A failed proxy response is often HTML, not the API's JSON error envelope. */
export async function sendContactRequest(url: string, init: RequestInit): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = response.status < 500 && typeof data?.error === "string"
        ? data.error.slice(0, 240)
        : "No se ha podido confirmar el envío. El servicio no está disponible; conserva tus datos e inténtalo más tarde.";
      throw new Error(detail);
    }
    if (data?.success !== true) {
      throw new Error("No se ha podido confirmar que recibimos tu solicitud. Tus datos siguen en el formulario.");
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("El envío ha tardado demasiado y no se pudo confirmar. Tus datos siguen en el formulario; comprueba si recibiste confirmación antes de reenviar.");
    }
    if (error instanceof TypeError) {
      throw new Error("No se ha podido conectar para confirmar el envío. Revisa tu conexión; tus datos siguen en el formulario.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
