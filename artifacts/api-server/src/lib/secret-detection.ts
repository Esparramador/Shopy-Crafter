/**
 * Detección de credenciales filtradas en HTML/JS/código (escáneres de Web Lab y
 * Security Lab). Criterios:
 *  - Solo formatos con prefijo o estructura inequívoca. Nada de "cualquier cadena
 *    de 40 caracteres" (antes: cada hash de un bundle minificado salía como clave
 *    secreta de AWS) ni "cualquier UUID" (salía como clave de HubSpot).
 *  - Las claves públicas por diseño (Stripe pk_, Google Maps/Firebase AIza, JWT
 *    anon de Supabase) no se presentan como fuga crítica: se explica qué restringir.
 *  - Nunca se devuelve el valor completo: ni en la respuesta, ni en el contexto,
 *    ni en el informe guardado.
 */

export type SecretSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface SecretRule {
  id: string;
  service: string;
  type: string;
  severity: SecretSeverity;
  cvss: number;
  re: RegExp;
  fix: string;
  /** Grupo de captura con el valor (si la regex incluye el nombre de la variable). */
  group?: number;
  /** Entropía Shannon mínima del valor (reglas genéricas). */
  minEntropy?: number;
  publicByDesign?: boolean;
}

export interface DetectedSecret {
  ruleId: string;
  service: string;
  type: string;
  severity: SecretSeverity;
  cvss: number;
  /** Valor completo. Solo para respuestas solo-admin; nunca en informes compartidos. */
  value: string;
  masked: string;
  /** Fragmento alrededor del hallazgo con el valor ya enmascarado. */
  context: string;
  lineNumber: number;
  recommendation: string;
  publicByDesign: boolean;
}

export const SECRET_RULES: SecretRule[] = [
  { id: "stripe-secret-live", service: "Stripe", type: "Clave secreta live", severity: "critical", cvss: 9.8, re: /\b(?:sk|rk)_live_[0-9a-zA-Z]{24,}/g, fix: "Revocar en dashboard.stripe.com → Developers → API keys y usarla solo en el servidor (STRIPE_SECRET_KEY)." },
  { id: "stripe-secret-test", service: "Stripe", type: "Clave secreta de pruebas", severity: "high", cvss: 7.5, re: /\b(?:sk|rk)_test_[0-9a-zA-Z]{24,}/g, fix: "Moverla al servidor: con la clave de pruebas se leen datos de la cuenta de test." },
  { id: "stripe-publishable", service: "Stripe", type: "Clave publicable", severity: "info", cvss: 0, re: /\bpk_(?:live|test)_[0-9a-zA-Z]{24,}/g, publicByDesign: true, fix: "Es pública por diseño (Stripe.js). Correcto mientras la clave secreta sk_ no esté también en el cliente." },
  { id: "openai", service: "OpenAI", type: "API key", severity: "critical", cvss: 9.8, re: /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g, fix: "Revocar en platform.openai.com → API keys; llamar a OpenAI solo desde el servidor." },
  { id: "anthropic", service: "Anthropic", type: "API key", severity: "critical", cvss: 9.8, re: /\bsk-ant-(?:api|admin)\d{2}-[A-Za-z0-9_-]{80,}/g, fix: "Revocar en console.anthropic.com → API keys; ANTHROPIC_API_KEY solo en el servidor." },
  { id: "google-api-key", service: "Google (Maps/Firebase/Cloud)", type: "API key", severity: "medium", cvss: 5.3, re: /\bAIza[0-9A-Za-z_-]{35}\b/g, publicByDesign: true, fix: "Maps y Firebase la exponen por diseño: restríngela por referer HTTP y a las APIs que uses en Google Cloud → Credenciales. Si da acceso a Gemini u otras APIs de pago, rótala." },
  { id: "google-oauth", service: "Google OAuth", type: "Access token", severity: "critical", cvss: 9.8, re: /\bya29\.[0-9A-Za-z_-]{50,}/g, fix: "Revocar en myaccount.google.com → Seguridad → Acceso de terceros." },
  { id: "aws-access-key", service: "AWS", type: "Access Key ID", severity: "critical", cvss: 9.8, re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, fix: "Desactivar en IAM, revisar CloudTrail y usar roles en lugar de claves estáticas." },
  { id: "aws-secret-key", service: "AWS", type: "Secret Access Key", severity: "critical", cvss: 9.8, re: /(?:aws_secret_access_key|aws_secret_key|secretAccessKey)["'\s]*[:=]\s*["']?([A-Za-z0-9/+=]{40})(?![A-Za-z0-9/+=])/gi, group: 1, fix: "Rotar en IAM inmediatamente; nunca en código cliente." },
  { id: "github-pat", service: "GitHub", type: "Personal access token", severity: "critical", cvss: 9.8, re: /\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{82}\b/g, fix: "Revocar en github.com → Settings → Developer settings → Tokens." },
  { id: "github-app", service: "GitHub", type: "Token OAuth/App", severity: "high", cvss: 8.1, re: /\bgh[osur]_[A-Za-z0-9]{36}\b/g, fix: "Revocar en GitHub → Settings → Applications." },
  { id: "shopify-admin", service: "Shopify", type: "Token de Admin API / app", severity: "critical", cvss: 9.5, re: /\bshp(?:at|ca|pa|ss)_[A-Fa-f0-9]{32}\b/g, fix: "Revocar en Shopify Admin → Apps → Desarrollar apps; el token de Admin API nunca va al tema ni al frontend." },
  { id: "sendgrid", service: "SendGrid", type: "API key", severity: "critical", cvss: 9.1, re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, fix: "Revocar en app.sendgrid.com → Settings → API Keys." },
  { id: "mailgun", service: "Mailgun", type: "API key", severity: "critical", cvss: 9.1, re: /\bkey-[0-9a-f]{32}\b/g, fix: "Revocar en Mailgun → API Security." },
  { id: "mailchimp", service: "Mailchimp", type: "API key", severity: "high", cvss: 8.1, re: /\b[0-9a-f]{32}-us\d{1,2}\b/g, fix: "Revocar en Mailchimp → Account → Extras → API keys." },
  { id: "slack-token", service: "Slack", type: "Token", severity: "critical", cvss: 9.1, re: /\bxox[baprs]-[0-9A-Za-z-]{10,}/g, fix: "Revocar en api.slack.com → Your Apps → OAuth & Permissions." },
  { id: "slack-webhook", service: "Slack", type: "Webhook entrante", severity: "high", cvss: 7.5, re: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]{20,}/g, fix: "Regenerar el webhook: cualquiera puede publicar en tu canal." },
  { id: "telegram-bot", service: "Telegram", type: "Token de bot", severity: "critical", cvss: 9.1, re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g, fix: "Revocar con /revoke en @BotFather." },
  { id: "twilio-api-key", service: "Twilio", type: "API Key SID", severity: "medium", cvss: 5.3, re: /\bSK[0-9a-f]{32}\b/g, fix: "El SID solo no basta para autenticar; comprueba que su secreto no esté también en el código." },
  { id: "firebase-legacy", service: "Firebase FCM", type: "Legacy server key", severity: "critical", cvss: 9.1, re: /\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}\b/g, fix: "Migrar a FCM v1 (OAuth) y eliminar la server key heredada." },
  { id: "npm-token", service: "npm", type: "Access token", severity: "critical", cvss: 9.1, re: /\bnpm_[A-Za-z0-9]{36}\b/g, fix: "Revocar en npmjs.com → Access Tokens." },
  { id: "replicate", service: "Replicate", type: "API token", severity: "critical", cvss: 9.1, re: /\br8_[A-Za-z0-9]{37}\b/g, fix: "Revocar en replicate.com → Account → API tokens." },
  { id: "huggingface", service: "Hugging Face", type: "Token", severity: "high", cvss: 7.5, re: /\bhf_[A-Za-z0-9]{34}\b/g, fix: "Revocar en huggingface.co → Settings → Access Tokens." },
  { id: "private-key", service: "Criptografía", type: "Clave privada PEM/SSH", severity: "critical", cvss: 10, re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g, fix: "Eliminarla del código y regenerar el par de claves." },
  { id: "db-url", service: "Base de datos", type: "URL de conexión con contraseña", severity: "critical", cvss: 9.8, re: /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^:@\s"'/]+:([^@\s"']{4,})@[^\s"']{4,}/gi, group: 1, fix: "Cambiar la contraseña de la base de datos y moverla a una variable de entorno del servidor." },
  { id: "generic-password", service: "Genérico", type: "Contraseña o secreto en el código", severity: "high", cvss: 8.1, re: /\b(?:password|passwd|db_pass(?:word)?|client_secret|api_secret|secret_key)\b["'\s]*[:=]\s*["']([^"'\s]{8,})["']/gi, group: 1, minEntropy: 3, fix: "Moverlo a variables de entorno del servidor y rotarlo." },
  { id: "generic-api-key", service: "Genérico", type: "API key en el código", severity: "medium", cvss: 5.3, re: /\b(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token)\b["'\s]*[:=]\s*["']([A-Za-z0-9_\-]{20,})["']/gi, group: 1, minEntropy: 3.5, fix: "Comprobar a qué servicio pertenece; si no es pública por diseño, moverla al servidor y rotarla." },
];

// Valores de ejemplo: solo "xxxx"/"****" completos, o que empiecen por una palabra típica de plantilla.
const PLACEHOLDER = /^(?:x+|\*+|•+)$|^(?:your[_-]|tu[_-]|<|\$\{|process\.env|changeme|example|placeholder|test|dummy|password|secret|null|undefined|true|false)/i;

export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) { const p = n / s.length; h -= p * Math.log2(p); }
  return h;
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return value.slice(0, 2) + "•".repeat(Math.max(3, value.length - 2));
  return value.slice(0, 6) + "•".repeat(Math.min(12, value.length - 8)) + value.slice(-2);
}

/** Decodifica el payload de un JWT sin verificar (solo para clasificar el riesgo). */
function jwtRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch { return null; }
}

const MAX_PER_RULE = 25;

export function detectSecrets(content: string): DetectedSecret[] {
  const out: DetectedSecret[] = [];
  const seen = new Set<string>();
  // Inicio de cada línea para calcular el número de línea en O(log n).
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) lineStarts.push(i + 1);
  const lineOf = (idx: number) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };

  const push = (rule: Pick<SecretRule, "id" | "service" | "type" | "severity" | "cvss" | "fix" | "publicByDesign">, value: string, idx: number) => {
    const key = `${rule.id}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    const masked = maskSecret(value);
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + value.length + 40);
    const context = content.slice(start, end).split(value).join(masked).replace(/\s+/g, " ").trim();
    out.push({
      ruleId: rule.id, service: rule.service, type: rule.type, severity: rule.severity, cvss: rule.cvss,
      value, masked, context, lineNumber: lineOf(idx), recommendation: rule.fix, publicByDesign: Boolean(rule.publicByDesign),
    });
  };

  for (const rule of SECRET_RULES) {
    let count = 0;
    for (const m of content.matchAll(new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g"))) {
      const value = rule.group ? m[rule.group] : m[0];
      if (!value) continue;
      // Claves de ejemplo de la documentación oficial (p. ej. AKIAIOSFODNN7EXAMPLE).
      if (/EXAMPLE/.test(value)) continue;
      // Reglas genéricas: descartar plantillas y texto normal (un secreto real lleva dígitos o símbolos).
      if (rule.minEntropy !== undefined && (PLACEHOLDER.test(value) || shannonEntropy(value) < rule.minEntropy || !/[^A-Za-zÀ-ÿ]/.test(value))) continue;
      const idx = (m.index ?? 0) + (rule.group ? m[0].indexOf(value) : 0);
      push(rule, value, idx);
      if (++count >= MAX_PER_RULE) break;
    }
  }

  // JWT: el riesgo depende del rol. service_role de Supabase = acceso total a la BD.
  let jwtCount = 0;
  for (const m of content.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
    const role = jwtRole(m[0]);
    const rule = role === "service_role"
      ? { id: "jwt-service-role", service: "Supabase", type: "JWT service_role", severity: "critical" as const, cvss: 9.8, fix: "Rotar el JWT secret del proyecto en Supabase; la clave service_role ignora RLS y nunca va al cliente." }
      : role === "anon"
      ? { id: "jwt-anon", service: "Supabase", type: "JWT anon (público)", severity: "info" as const, cvss: 0, publicByDesign: true, fix: "La clave anon es pública por diseño: la seguridad depende de tener RLS activo en todas las tablas." }
      : { id: "jwt", service: "Autenticación", type: "JWT incrustado", severity: "medium" as const, cvss: 5.3, fix: "Un token de sesión no debe ir fijo en el código: revisa qué permisos da y si caduca." };
    push(rule, m[0], m.index ?? 0);
    if (++jwtCount >= MAX_PER_RULE) break;
  }

  const order: Record<SecretSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.lineNumber - b.lineNumber);
}
