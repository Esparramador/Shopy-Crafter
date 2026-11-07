const KEY_PREFIX = "shopycrafter:contact-idempotency:";
const memoryKeys = new Map<string, string>();
const KEY_RE = /^[A-Za-z0-9._~-]{16,128}$/;
const IDEMPOTENCY_KEY_REUSED = "IDEMPOTENCY_KEY_REUSED";

function storageKey(scope: string): string {
  if (!/^[a-z0-9-]{1,64}$/i.test(scope)) throw new Error("Invalid contact request scope");
  return `${KEY_PREFIX}${scope}`;
}

function createKey(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("Este navegador no permite proteger los reintentos del formulario.");
  }
  return globalThis.crypto.randomUUID();
}

function getKey(scope: string): string {
  const name = storageKey(scope);
  try {
    const saved = globalThis.sessionStorage?.getItem(name);
    if (saved && KEY_RE.test(saved)) return saved;
  } catch {
    // Private browsing may disable sessionStorage; retain the key in memory.
  }
  const existing = memoryKeys.get(name);
  if (existing) return existing;
  const key = createKey();
  memoryKeys.set(name, key);
  try {
    globalThis.sessionStorage?.setItem(name, key);
  } catch {
    // The in-memory key still protects retries on this mounted page.
  }
  return key;
}

function saveKey(scope: string, key: string): void {
  const name = storageKey(scope);
  memoryKeys.set(name, key);
  try {
    globalThis.sessionStorage?.setItem(name, key);
  } catch {
    // The in-memory key still protects retries on this mounted page.
  }
}

export function clearContactRequestKey(scope: string): void {
  const name = storageKey(scope);
  memoryKeys.delete(name);
  try {
    globalThis.sessionStorage?.removeItem(name);
  } catch {
    // Storage is optional; successful submissions still work without it.
  }
}

/** A failed proxy response is often HTML, not the API's JSON error envelope. */
export async function sendContactRequest(url: string, init: RequestInit, scope: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    let key = getKey(scope);
    const send = async (requestKey: string) => {
      const headers = new Headers(init.headers);
      headers.set("Idempotency-Key", requestKey);
      return fetch(url, { ...init, headers, signal: controller.signal });
    };
    let response = await send(key);
    let data = await response.json().catch(() => null);
    if (response.status === 409 && data?.code === IDEMPOTENCY_KEY_REUSED) {
      // The same browser tab may have kept a key while the visitor edited the
      // form. The API rejected the mismatch, so retry this new payload once
      // with a fresh key; a lost-response retry with the same payload stays
      // on the original key and never starts the work twice.
      key = createKey();
      saveKey(scope, key);
      response = await send(key);
      data = await response.json().catch(() => null);
    }
    if (!response.ok) {
      const detail = response.status < 500 && typeof data?.error === "string"
        ? data.error.slice(0, 240)
        : "No se ha podido confirmar el envío. El servicio no está disponible; conserva tus datos e inténtalo más tarde.";
      throw new Error(detail);
    }
    if (data?.success !== true) {
      throw new Error("No se ha podido confirmar que recibimos tu solicitud. Tus datos siguen en el formulario.");
    }
    clearContactRequestKey(scope);
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
