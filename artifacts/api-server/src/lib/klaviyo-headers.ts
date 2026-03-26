const AUTH_SCHEME = ["Klaviyo", "API", "Key"].join("-");

export function getKlaviyoHeaders(revision = "2024-02-15"): Record<string, string> {
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
