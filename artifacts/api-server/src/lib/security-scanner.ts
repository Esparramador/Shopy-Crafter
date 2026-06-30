/**
 * Passive Website Security Scanner
 * ─────────────────────────────────────────────────────────────────────────────
 * Reconnaissance-only (no exploitation, no payload injection against
 * third-party infra). Checks security headers, TLS, cookies, CORS, exposed
 * sensitive paths, fingerprint leakage, mixed content, outdated JS libraries
 * and leaked secrets in client-side code.
 *
 * Each finding is mapped to the 817-skill cybersec catalog (MITRE ATT&CK /
 * NIST CSF) so the report can explain "how an attacker would exploit this"
 * (reverse-psychology framing) and "how to harden it" with concrete steps.
 */
import * as tls from "node:tls";
import { validateUrlWithDnsCheck } from "./web-scraper.js";
import { detectTechStack, type TechStack } from "./site-crawler.js";
import { searchCybersecSkills } from "./cybersec-knowledge.js";
import { logger } from "./logger.js";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityFinding {
  id: string;
  category: string;
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
  attackerPerspective: string;
  hardeningSteps: string[];
  mitreAttack: string[];
  nistCsf: string[];
  relatedSkills: { id: string; name: string }[];
}

export interface SecurityScanResult {
  url: string;
  scannedAt: string;
  techStack: TechStack | null;
  findings: SecurityFinding[];
  score: number;
  countsBySeverity: Record<Severity, number>;
}

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/, "");
}

async function safeFetch(url: string, opts: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, ...((opts.headers as Record<string, string>) || {}) },
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      ...opts,
    });
  } catch {
    return null;
  }
}

function enrichFinding(
  partial: Omit<SecurityFinding, "mitreAttack" | "nistCsf" | "relatedSkills">,
  searchTerm: string
): SecurityFinding {
  const matches = searchCybersecSkills(searchTerm, 3);
  const toList = (v: unknown): string[] => Array.isArray(v) ? v.filter(Boolean) : v ? [String(v)] : [];
  const mitreAttack = Array.from(new Set(matches.flatMap(m => toList(m.mitre_attack))));
  const nistCsf = Array.from(new Set(matches.flatMap(m => toList(m.nist_csf))));
  return {
    ...partial,
    mitreAttack,
    nistCsf,
    relatedSkills: matches.map(m => ({ id: m.id, name: m.name })),
  };
}

/** 1. TLS / HTTPS enforcement */
async function checkTls(parsed: URL): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  if (parsed.protocol !== "https:") {
    findings.push(enrichFinding({
      id: "tls-no-https",
      category: "tls",
      severity: "critical",
      title: "El sitio no fuerza HTTPS",
      description: "El sitio responde sobre HTTP sin redirigir a HTTPS, exponiendo todo el tráfico (credenciales, cookies de sesión) a interceptación.",
      attackerPerspective: "Un atacante en la misma red (WiFi público, MITM) puede leer y modificar el tráfico en texto plano, robar cookies de sesión y suplantar al usuario sin que la víctima note nada.",
      hardeningSteps: [
        "Forzar redirección 301 de HTTP a HTTPS en todas las rutas",
        "Activar HSTS (Strict-Transport-Security) con includeSubDomains y preload",
        "Renovar certificado TLS y validar cadena completa",
      ],
    }, "transport security https enforcement"));
    return findings;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect(443, parsed.hostname, { servername: parsed.hostname, timeout: 8000 }, () => {
        const cert = socket.getPeerCertificate();
        const now = Date.now();
        const validTo = cert?.valid_to ? new Date(cert.valid_to).getTime() : 0;
        const daysLeft = Math.round((validTo - now) / 86_400_000);
        if (validTo && daysLeft < 14) {
          findings.push(enrichFinding({
            id: "tls-cert-expiring",
            category: "tls",
            severity: daysLeft < 0 ? "critical" : "high",
            title: daysLeft < 0 ? "Certificado TLS expirado" : "Certificado TLS próximo a expirar",
            description: `El certificado TLS ${daysLeft < 0 ? "ya expiró" : `expira en ${daysLeft} días`} (${cert.valid_to}).`,
            attackerPerspective: "Un certificado expirado rompe la confianza del navegador; un atacante puede aprovechar la confusión del usuario ('continuar de todos modos') para servir un certificado propio en un ataque MITM.",
            hardeningSteps: ["Renovar el certificado de inmediato", "Automatizar renovación con Let's Encrypt / ACME antes de la fecha límite"],
          }, "tls certificate expiration man in the middle"));
        }
        socket.end();
        resolve();
      });
      socket.on("error", () => resolve());
      socket.on("timeout", () => { socket.destroy(); resolve(); });
    });
  } catch {
    // best-effort; ignore TLS introspection failures
  }

  return findings;
}

/** 2. Security headers */
function checkSecurityHeaders(headers: Headers): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const get = (k: string) => headers.get(k);

  if (!get("strict-transport-security")) {
    findings.push(enrichFinding({
      id: "header-no-hsts",
      category: "headers",
      severity: "medium",
      title: "Falta el header Strict-Transport-Security (HSTS)",
      description: "Sin HSTS, el navegador puede intentar conexiones HTTP antes de la redirección a HTTPS en visitas futuras.",
      attackerPerspective: "Un atacante de red puede forzar un downgrade a HTTP en la primera conexión (SSL stripping) e interceptar el tráfico antes de que el HSTS del navegador entre en juego.",
      hardeningSteps: ["Agregar `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`"],
    }, "hsts ssl stripping downgrade attack"));
  }

  if (!get("content-security-policy")) {
    findings.push(enrichFinding({
      id: "header-no-csp",
      category: "headers",
      severity: "high",
      title: "Falta Content-Security-Policy (CSP)",
      description: "Sin CSP, el navegador ejecuta cualquier script inline o de terceros sin restricción.",
      attackerPerspective: "Si un atacante logra inyectar un <script> (vía un formulario sin sanitizar, un widget comprometido o una dependencia de terceros), se ejecutará sin restricciones — robo de cookies, keylogging, redirecciones a phishing.",
      hardeningSteps: [
        "Definir CSP restrictiva: `default-src 'self'; script-src 'self' <dominios de confianza>; object-src 'none'`",
        "Usar nonces o hashes para scripts inline necesarios",
        "Monitorear violaciones con `report-uri` / `report-to`",
      ],
    }, "content security policy cross site scripting"));
  }

  if (!get("x-frame-options") && !/frame-ancestors/i.test(get("content-security-policy") || "")) {
    findings.push(enrichFinding({
      id: "header-no-frame-options",
      category: "headers",
      severity: "medium",
      title: "Sin protección contra Clickjacking (X-Frame-Options / frame-ancestors)",
      description: "El sitio puede ser embebido en un <iframe> de un dominio externo.",
      attackerPerspective: "Un atacante crea una página que carga tu sitio en un iframe invisible superpuesto a botones falsos, engañando al usuario para que haga clic en acciones reales (comprar, cambiar contraseña) sin saberlo — clickjacking clásico.",
      hardeningSteps: ["Agregar `X-Frame-Options: DENY` o `frame-ancestors 'none'` en la CSP"],
    }, "clickjacking frame ancestors ui redress"));
  }

  if (!get("x-content-type-options")) {
    findings.push(enrichFinding({
      id: "header-no-nosniff",
      category: "headers",
      severity: "low",
      title: "Falta X-Content-Type-Options: nosniff",
      description: "El navegador puede inferir (\"sniff\") el tipo MIME real de un recurso, ignorando el declarado.",
      attackerPerspective: "Un atacante puede subir un archivo disfrazado de imagen que en realidad es HTML/JS ejecutable; sin nosniff, algunos navegadores lo interpretan como script.",
      hardeningSteps: ["Agregar `X-Content-Type-Options: nosniff` a todas las respuestas"],
    }, "mime sniffing content type"));
  }

  if (!get("referrer-policy")) {
    findings.push(enrichFinding({
      id: "header-no-referrer-policy",
      category: "headers",
      severity: "low",
      title: "Falta Referrer-Policy",
      description: "Sin esta cabecera, la URL completa (incluyendo tokens en query strings) puede filtrarse a sitios de terceros enlazados.",
      attackerPerspective: "Si tus URLs internas contienen tokens de sesión o IDs sensibles en query params, un enlace externo clicado por el usuario filtra esa URL completa al servidor de destino vía el header Referer.",
      hardeningSteps: ["Agregar `Referrer-Policy: strict-origin-when-cross-origin` o `no-referrer`"],
    }, "referrer policy information leakage"));
  }

  if (!get("permissions-policy")) {
    findings.push(enrichFinding({
      id: "header-no-permissions-policy",
      category: "headers",
      severity: "info",
      title: "Falta Permissions-Policy",
      description: "No se restringe explícitamente el acceso a APIs sensibles del navegador (cámara, micrófono, geolocalización) para terceros embebidos.",
      attackerPerspective: "Un script de terceros comprometido (ej. un widget de chat o analytics hackeado) podría solicitar acceso a cámara/micrófono sin restricción adicional del propio sitio.",
      hardeningSteps: ["Agregar `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`"],
    }, "permissions policy browser api restriction"));
  }

  const cors = get("access-control-allow-origin");
  if (cors === "*" && get("access-control-allow-credentials") === "true") {
    findings.push(enrichFinding({
      id: "cors-wildcard-credentials",
      category: "cors",
      severity: "critical",
      title: "CORS mal configurado: wildcard '*' con credenciales habilitadas",
      description: "El servidor permite cualquier origen Y credenciales (cookies/auth) simultáneamente, una combinación normalmente inválida pero peligrosa si el servidor la acepta reflejando el Origin.",
      attackerPerspective: "Un atacante alojando una página maliciosa puede hacer fetch() con credenciales del usuario logueado y leer datos privados de la API como si fuera el propio usuario — exfiltración total de la sesión.",
      hardeningSteps: [
        "Nunca combinar `Access-Control-Allow-Origin: *` con `Access-Control-Allow-Credentials: true`",
        "Whitelistear orígenes explícitos en vez de wildcard",
      ],
    }, "cors misconfiguration credential theft"));
  } else if (cors === "*") {
    findings.push(enrichFinding({
      id: "cors-wildcard",
      category: "cors",
      severity: "low",
      title: "CORS abierto a cualquier origen",
      description: "La API permite peticiones cross-origin desde cualquier dominio.",
      attackerPerspective: "Si la API expone datos no públicos sin autenticación, cualquier sitio puede consumirla directamente desde el navegador del usuario.",
      hardeningSteps: ["Restringir Access-Control-Allow-Origin a dominios conocidos si la API maneja datos sensibles"],
    }, "cors wildcard data exposure"));
  }

  const server = get("server");
  const poweredBy = get("x-powered-by");
  if (server || poweredBy) {
    findings.push(enrichFinding({
      id: "fingerprint-leak",
      category: "fingerprinting",
      severity: "info",
      title: "El servidor revela su stack tecnológico en las cabeceras",
      description: `Header(s) expuestos: ${[server && `Server: ${server}`, poweredBy && `X-Powered-By: ${poweredBy}`].filter(Boolean).join(", ")}.`,
      attackerPerspective: "Conocer la versión exacta del servidor/framework permite a un atacante buscar directamente CVEs públicos para esa versión y lanzar exploits dirigidos en vez de probar a ciegas.",
      hardeningSteps: ["Eliminar o genericizar los headers Server y X-Powered-By en la configuración del servidor/proxy"],
    }, "server fingerprinting reconnaissance version disclosure"));
  }

  return findings;
}

/** 3. Cookie flags */
function checkCookies(headers: Headers): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const setCookieRaw = (headers as any).getSetCookie ? (headers as any).getSetCookie() as string[] : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);

  for (const cookie of setCookieRaw) {
    const name = cookie.split("=")[0].trim();
    const lower = cookie.toLowerCase();
    const missing: string[] = [];
    if (!lower.includes("secure")) missing.push("Secure");
    if (!lower.includes("httponly")) missing.push("HttpOnly");
    if (!lower.includes("samesite")) missing.push("SameSite");

    if (missing.length > 0) {
      findings.push(enrichFinding({
        id: `cookie-flags-${name}`,
        category: "cookies",
        severity: missing.includes("HttpOnly") ? "high" : "medium",
        title: `Cookie "${name}" sin flags de seguridad: ${missing.join(", ")}`,
        description: `La cookie "${name}" no establece ${missing.join(", ")}.`,
        attackerPerspective: missing.includes("HttpOnly")
          ? "Sin HttpOnly, cualquier XSS exitoso puede leer esta cookie con `document.cookie` y robar la sesión completa del usuario."
          : "Sin Secure/SameSite, la cookie puede viajar por HTTP sin cifrar o ser enviada en peticiones cross-site (CSRF).",
        hardeningSteps: [
          missing.includes("Secure") ? "Agregar el flag `Secure` para que solo viaje por HTTPS" : "",
          missing.includes("HttpOnly") ? "Agregar `HttpOnly` para bloquear acceso desde JavaScript" : "",
          missing.includes("SameSite") ? "Agregar `SameSite=Lax` o `Strict` para mitigar CSRF" : "",
        ].filter(Boolean),
      }, "cookie security session hijacking xss"));
    }
  }
  return findings;
}

/** 4. Exposed sensitive paths (safe HEAD/GET probes on the target's own host) */
const SENSITIVE_PATHS: Array<{ path: string; severity: Severity; label: string }> = [
  { path: "/.env", severity: "critical", label: "Archivo .env expuesto" },
  { path: "/.git/config", severity: "critical", label: "Repositorio .git expuesto" },
  { path: "/wp-config.php.bak", severity: "critical", label: "Backup de configuración WordPress expuesto" },
  { path: "/.aws/credentials", severity: "critical", label: "Credenciales AWS expuestas" },
  { path: "/phpinfo.php", severity: "high", label: "phpinfo() expuesto" },
  { path: "/.well-known/security.txt", severity: "info", label: "security.txt (positivo si existe)" },
  { path: "/server-status", severity: "high", label: "Apache server-status expuesto" },
  { path: "/.htaccess", severity: "medium", label: ".htaccess accesible" },
  { path: "/config.json", severity: "medium", label: "config.json potencialmente expuesto" },
  { path: "/backup.sql", severity: "critical", label: "Backup SQL expuesto" },
];

async function checkExposedPaths(baseUrl: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const results = await Promise.all(
    SENSITIVE_PATHS.map(async (entry) => {
      const resp = await safeFetch(baseUrl + entry.path, { method: "GET", redirect: "manual" });
      return { entry, ok: resp && resp.status >= 200 && resp.status < 300 };
    })
  );

  for (const { entry, ok } of results) {
    if (entry.path === "/.well-known/security.txt") {
      if (!ok) {
        findings.push(enrichFinding({
          id: "no-security-txt",
          category: "exposure",
          severity: "info",
          title: "No existe /.well-known/security.txt",
          description: "No hay un canal de divulgación responsable de vulnerabilidades publicado.",
          attackerPerspective: "Investigadores de buena fe que encuentren una falla no tendrán un canal claro para reportarla, aumentando el riesgo de divulgación pública sin coordinación.",
          hardeningSteps: ["Publicar /.well-known/security.txt con contacto de seguridad (RFC 9116)"],
        }, "security.txt responsible disclosure"));
      }
      continue;
    }
    if (ok) {
      findings.push(enrichFinding({
        id: `exposed-${entry.path.replace(/[^a-z0-9]/gi, "-")}`,
        category: "exposure",
        severity: entry.severity,
        title: entry.label,
        description: `La ruta ${entry.path} responde con un código 2xx y es accesible públicamente.`,
        evidence: baseUrl + entry.path,
        attackerPerspective: `Un atacante que descubra ${entry.path} obtiene acceso directo a información sensible (credenciales, configuración, historial de código) sin necesidad de explotar ninguna vulnerabilidad — es una puerta abierta.`,
        hardeningSteps: [
          `Bloquear el acceso público a ${entry.path} a nivel de servidor/proxy`,
          "Mover archivos sensibles fuera del directorio público (webroot)",
          "Auditar el control de versiones para asegurarse de que no se desplieguen archivos .git/.env a producción",
        ],
      }, `exposed sensitive file ${entry.label} information disclosure`));
    }
  }
  return findings;
}

/** 5. HTML-based checks: mixed content, outdated libs, leaked secrets, forms, directory listing */
const OUTDATED_LIB_PATTERNS: Array<{ re: RegExp; name: string; safeBelow: string }> = [
  { re: /jquery[.-](1\.\d+|2\.\d+|3\.[0-4]\.\d+)/i, name: "jQuery", safeBelow: "3.5.0" },
  { re: /bootstrap[.-](2\.\d+|3\.\d+)/i, name: "Bootstrap", safeBelow: "4.0" },
  { re: /angular(?:js)?[.-](1\.[0-5])/i, name: "AngularJS", safeBelow: "1.6" },
];

const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /AKIA[0-9A-Z]{16}/, label: "AWS Access Key ID" },
  { re: /sk_live_[0-9a-zA-Z]{24,}/, label: "Stripe Secret Key (live)" },
  { re: /AIza[0-9A-Za-z\-_]{35}/, label: "Google API Key" },
  { re: /ghp_[0-9A-Za-z]{36}/, label: "GitHub Personal Access Token" },
  { re: /xox[baprs]-[0-9A-Za-z-]{10,}/, label: "Slack Token" },
];

function checkHtmlContent(html: string, ssl: boolean): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  if (ssl) {
    const mixed = html.match(/(?:src|href)=["']http:\/\/[^"']+["']/gi);
    if (mixed && mixed.length > 0) {
      findings.push(enrichFinding({
        id: "mixed-content",
        category: "tls",
        severity: "medium",
        title: "Contenido mixto (HTTP) en una página HTTPS",
        description: `Se detectaron ${mixed.length} recurso(s) cargados por HTTP en una página servida por HTTPS.`,
        evidence: mixed.slice(0, 3).join(" | "),
        attackerPerspective: "Cualquier recurso cargado por HTTP (script, imagen, CSS) puede ser interceptado y modificado en tránsito por un atacante de red, aunque la página principal sea HTTPS.",
        hardeningSteps: ["Cambiar todas las URLs de recursos a HTTPS o protocolo relativo (`//`)", "Agregar `upgrade-insecure-requests` en la CSP"],
      }, "mixed content downgrade man in the middle"));
    }
  }

  for (const lib of OUTDATED_LIB_PATTERNS) {
    const m = html.match(lib.re);
    if (m) {
      findings.push(enrichFinding({
        id: `outdated-lib-${lib.name.toLowerCase()}`,
        category: "dependencies",
        severity: "medium",
        title: `Librería JS potencialmente obsoleta: ${lib.name}`,
        description: `Se detectó una versión de ${lib.name} anterior a ${lib.safeBelow}, rango con vulnerabilidades conocidas (XSS/prototype pollution).`,
        evidence: m[0],
        attackerPerspective: `Un atacante puede buscar el CVE público asociado a esta versión exacta de ${lib.name} y usar un exploit ya documentado en lugar de descubrir una falla nueva.`,
        hardeningSteps: [`Actualizar ${lib.name} a la última versión estable`, "Revisar el changelog de seguridad antes de actualizar en producción"],
      }, `${lib.name} outdated library known vulnerability`));
    }
  }

  for (const secret of SECRET_PATTERNS) {
    const m = html.match(secret.re);
    if (m) {
      findings.push(enrichFinding({
        id: `leaked-secret-${secret.label.replace(/\s+/g, "-").toLowerCase()}`,
        category: "secrets",
        severity: "critical",
        title: `Posible secreto filtrado en el código fuente: ${secret.label}`,
        description: `Se encontró un patrón coincidente con ${secret.label} directamente en el HTML/JS servido al cliente.`,
        evidence: m[0].slice(0, 6) + "••••••••",
        attackerPerspective: `Cualquier visitante puede ver el código fuente y extraer esta credencial directamente — no requiere ningún ataque, solo "Ver código fuente". Con ${secret.label} comprometida, un atacante puede acceder a servicios de pago, infraestructura cloud o repos privados.`,
        hardeningSteps: [
          "Revocar y rotar la credencial inmediatamente",
          "Mover todas las claves a variables de entorno del servidor, nunca al bundle del cliente",
          "Auditar el historial de Git por si la clave quedó commiteada anteriormente",
        ],
      }, `${secret.label} secret exposure credential leakage`));
    }
  }

  const formsWithoutHttps = html.match(/<form[^>]+action=["']http:\/\/[^"']+["']/gi);
  if (formsWithoutHttps && formsWithoutHttps.length > 0) {
    findings.push(enrichFinding({
      id: "form-action-http",
      category: "forms",
      severity: "high",
      title: "Formulario que envía datos por HTTP sin cifrar",
      description: `${formsWithoutHttps.length} formulario(s) tienen un \`action\` apuntando a HTTP.`,
      attackerPerspective: "Los datos del formulario (potencialmente contraseñas, tarjetas, datos personales) viajan en texto plano y pueden ser capturados por cualquiera en la misma red.",
      hardeningSteps: ["Cambiar todas las acciones de formulario a HTTPS"],
    }, "form submission cleartext credential interception"));
  }

  return findings;
}

async function checkDirectoryListing(baseUrl: string): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const probes = ["/images/", "/assets/", "/uploads/", "/backup/"];
  const results = await Promise.all(probes.map(p => safeFetch(baseUrl + p)));
  for (let i = 0; i < probes.length; i++) {
    const resp = results[i];
    if (resp && resp.status === 200) {
      const text = await resp.text().catch(() => "");
      if (/index of \//i.test(text) || /<title>directory listing/i.test(text)) {
        findings.push(enrichFinding({
          id: `dir-listing-${probes[i].replace(/\//g, "")}`,
          category: "exposure",
          severity: "medium",
          title: `Listado de directorio expuesto en ${probes[i]}`,
          description: "El servidor muestra el contenido completo del directorio en lugar de un index controlado.",
          evidence: baseUrl + probes[i],
          attackerPerspective: "Un atacante puede navegar libremente la estructura de archivos del servidor, descubriendo backups, logs o archivos olvidados que nunca debieron ser públicos.",
          hardeningSteps: ["Desactivar el listado de directorios en la configuración del servidor (`Options -Indexes` en Apache, `autoindex off` en Nginx)"],
        }, "directory listing information disclosure"));
      }
    }
  }
  return findings;
}

export async function runSecurityScan(rawUrl: string): Promise<SecurityScanResult> {
  const url = normalizeUrl(rawUrl);
  await validateUrlWithDnsCheck(url);
  const parsed = new URL(url);
  const baseUrl = `${parsed.protocol}//${parsed.host}`;

  const mainResp = await safeFetch(url);
  let html = "";
  let headers: Headers = new Headers();
  if (mainResp) {
    headers = mainResp.headers;
    try {
      html = await mainResp.text();
    } catch {
      html = "";
    }
  }

  const [tlsFindings, exposedFindings, dirFindings] = await Promise.all([
    checkTls(parsed),
    checkExposedPaths(baseUrl),
    checkDirectoryListing(baseUrl),
  ]);

  const headerFindings = checkSecurityHeaders(headers);
  const cookieFindings = checkCookies(headers);
  const htmlFindings = checkHtmlContent(html, parsed.protocol === "https:");

  let techStack: TechStack | null = null;
  try {
    const headersObj: Record<string, string> = {};
    headers.forEach((value, key) => { headersObj[key] = value; });
    techStack = detectTechStack(html, headersObj);
  } catch (err) {
    logger.warn({ err }, "[security-scanner] tech stack detection failed");
  }

  const findings = [
    ...tlsFindings,
    ...headerFindings,
    ...cookieFindings,
    ...exposedFindings,
    ...dirFindings,
    ...htmlFindings,
  ];

  const countsBySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let deduction = 0;
  for (const f of findings) {
    countsBySeverity[f.severity]++;
    deduction += SEVERITY_WEIGHT[f.severity];
  }
  const score = Math.max(0, Math.min(100, 100 - deduction));

  return {
    url,
    scannedAt: new Date().toISOString(),
    techStack,
    findings,
    score,
    countsBySeverity,
  };
}
