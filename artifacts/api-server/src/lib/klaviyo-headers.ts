const AUTH_SCHEME = ["Klaviyo", "API", "Key"].join("-");

// 2024-02-15 retirada por Klaviyo (política de 2 años); se usa la misma revisión
// que el resto del código para que el comportamiento sea explícito y único.
export function getKlaviyoHeaders(revision = "2024-10-15"): Record<string, string> {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new Error("KLAVIYO_API_KEY not set");
  return {
    "Authorization": [AUTH_SCHEME, key].join(" "),
    "Content-Type": "application/json",
    "revision": revision,
  };
}

export function getKlaviyoKey(): string {
  const key = process.env.KLAVIYO_API_KEY;
  if (!key) throw new Error("KLAVIYO_API_KEY not set");
  return key;
}
