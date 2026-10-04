import { aiContextMiddleware } from "./lib/ai-context.js";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { keepRawBodyForWebhooks } from "./lib/raw-body.js";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import ConnectPg from "connect-pg-simple";
import pinoHttp from "pino-http";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { pool } from "@workspace/db";
import { msgUploadHeaders, parseMsgUploadName } from "./lib/msg-uploads.js";
import { PgRateLimitStore, startRateLimitCleanup } from "./lib/pg-rate-limit-store.js";
import { validateEncryptionKey } from "./lib/crypto.js";
import { revalidateSession } from "./lib/auth.js";

// BE-8: validar ENCRYPTION_KEY ANTES de cualquier inicialización (fail-fast)
validateEncryptionKey();

const PgSession = ConnectPg(session);

const app: Express = express();

app.set("trust proxy", 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip compression for all responses ──────────────────────────────────────
// Skip compression when X-No-Compression header is set by enableLongRunning(),
// otherwise the heartbeat whitespace gets buffered and the proxy still times
// out at ~60s. Long-running endpoints opt out via that header.
app.use(
  compression({
    filter: (req, res) => {
      if (res.getHeader("X-No-Compression")) return false;
      return compression.filter(req, res);
    },
  }),
);

// ── Request logger ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production: only allow requests from the app's own Replit domain.
// sameSite:strict on the session cookie provides a second layer of protection.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    const allowed = new Set<string>();
    const appUrl = process.env.APP_URL;
    if (appUrl) allowed.add(appUrl);
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (domain) allowed.add(`https://${domain}`);
    if (allowed.has(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
}));

// ── Rate limiting (PostgreSQL-backed — persists across restarts) ──────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("auth"),
  message: { error: "Demasiados intentos. Espera 15 minutos antes de reintentar.", code: "RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("api"),
  message: { error: "Límite de peticiones alcanzado. Inténtalo en un momento.", code: "RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("ai"),
  message: { error: "Demasiadas solicitudes de IA simultáneas. Espera un momento.", code: "AI_RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

// Chat público de la landing (sin sesión, Gemini con búsqueda): con solo el límite
// general (300/min por IP) cualquiera podía gastar IA a coste de la plataforma.
const publicQrLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("public_qr"),
  message: { error: "Demasiadas peticiones. Espera un momento.", code: "RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

const publicAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("public_ai"),
  message: { error: "Demasiados mensajes seguidos. Espera un momento.", code: "RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

// Llamada de voz pública (ElevenLabs ConvAI se factura por minuto) y formulario de
// contacto (genera un informe con IA por envío): sin sesión, por IP y por hora.
const publicVoiceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("public_voice"),
  message: { error: "Has alcanzado el máximo de llamadas por hora. Escríbenos desde el formulario.", code: "RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("contact"),
  message: { error: "Has enviado varias solicitudes seguidas. Te responderemos en breve.", code: "RATE_LIMITED" },
  skip: (req) => req.method !== "POST" || process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

// Chat de la landing: además del límite por minuto, 80 mensajes al día por IP.
const publicAiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("public_ai_day"),
  message: { error: "Has alcanzado el máximo de mensajes de hoy. Escríbenos desde el formulario de contacto.", code: "RATE_LIMITED" },
  skip: (_req) => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test",
});

startRateLimitCleanup();

// ── Body parsing ──────────────────────────────────────────────────────────────
// 50mb to support up to 5 base64-encoded high-res images in reference analysis
// Las rutas de webhook necesitan el cuerpo exacto para verificar la firma.
app.use(express.json({ limit: "50mb", verify: keepRawBodyForWebhooks }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── Global input sanitization — strips prototype pollution on all POST/PUT ──
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    const bodyStr = JSON.stringify(req.body);
    if (bodyStr.length > 50_000_000) {
      const err: any = new Error("Request body too large");
      err.status = 413;
      return next(err);
    }
    const sanitize = (obj: any): any => {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      const clean: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        clean[key] = sanitize(value);
      }
      return clean;
    };
    req.body = sanitize(req.body);
  }
  next();
});

// ── Session ───────────────────────────────────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET not set");

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24h (extended from 8h)
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
  }),
);
// Sesiones de usuarios borrados/desactivados dejan de valer en la siguiente petición.
app.use(revalidateSession);
// Imputa el gasto de IA de cada petición a su proyecto (topes por plan en lib/ai-budget.ts).
app.use("/api", aiContextMiddleware);

// ── No-cache for all API responses (prevents stale data in production) ────────
app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ── Static reports (auth-protected) ──────────────────────────────────────────
const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const reportsDir = path.join(__dirname2, "..", "public", "reports");
const reportAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const sess = req.session as { userId?: string; role?: string; clientId?: string | number | null } | undefined;
  if (!sess?.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Per-project ownership check for A/B test reports: filename pattern `ab-test-<testId>-<ts>.html`.
  // Se comprueba la ruta DECODIFICADA (express.static decodifica: %61b-test-… se
  // saltaba el control) y cualquier otro fichero del directorio es solo admin.
  let filePath = "";
  try { filePath = decodeURIComponent(req.path).replace(/^\/+/, ""); } catch { res.status(400).end(); return; }
  const abMatch = filePath.match(/^ab-test-(\d+)-\d+\.html$/);
  if (!abMatch && sess.role !== "admin") { res.status(403).json({ error: "Forbidden" }); return; }
  if (abMatch) {
    try {
      const { db, abTestsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const { canAccessProject } = await import("./lib/access.js");
      const testId = parseInt(abMatch[1], 10);
      const [t] = await db.select({ projectId: abTestsTable.projectId })
        .from(abTestsTable).where(eq(abTestsTable.id, testId)).limit(1);
      if (!t) { res.status(404).json({ error: "Report not found" }); return; }
      const ok = await canAccessProject(sess.role, sess.clientId, t.projectId);
      if (!ok) { res.status(403).json({ error: "Forbidden" }); return; }
    } catch (e) {
      logger.warn({ err: e instanceof Error ? e.message : String(e) }, "[reportAuth] ab-test ownership check failed");
      res.status(500).json({ error: "Auth check failed" });
      return;
    }
  }
  next();
};
app.use("/api/reports", (req, res, next) => { void reportAuth(req, res, next); }, express.static(reportsDir));
app.use("/reports", (req, res, next) => { void reportAuth(req, res, next); }, express.static(reportsDir));

const msgUploadsDir = path.resolve(process.cwd(), "msg-uploads");
app.use("/api/msg-uploads", async (req: Request, res: Response, next: NextFunction) => {
  const sess = req.session as { userId?: string; role?: string; clientId?: string | number | null } | undefined;
  if (!sess?.userId) { res.status(401).end(); return; }
  if (sess.role === "admin") { next(); return; }
  // Cliente: solo adjuntos de su proyecto.
  let name = "";
  try { name = decodeURIComponent(req.path.replace(/^\/+/, "")); } catch { /* URL mal codificada → 404 */ }
  const parsed = parseMsgUploadName(name);
  const own = Number(sess.clientId);
  if (!parsed || !Number.isInteger(own) || own <= 0) { res.status(404).end(); return; }
  if (parsed.projectId !== null) {
    if (parsed.projectId === own) { next(); return; }
    res.status(404).end();
    return;
  }
  // Fichero antiguo sin prefijo: vale si un mensaje de su proyecto lo cita.
  try {
    const url = `/api/msg-uploads/${name}`;
    const r = await pool.query(
      `SELECT 1 FROM messages WHERE project_id = $1 AND (file_url = $2 OR files_json::text LIKE $3) LIMIT 1`,
      [String(own), url, `%"${url}"%`],
    );
    if (r.rowCount) { next(); return; }
    res.status(404).end();
  } catch (err) {
    logger.warn({ err }, "[msg-uploads] ownership check failed");
    res.status(500).end();
  }
}, express.static(msgUploadsDir, { setHeaders: (res, filePath) => msgUploadHeaders(res, filePath) }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/public/landing-chat", publicAiLimiter);
app.use("/api/public/landing-chat", publicAiDailyLimiter);
app.use("/api/voice/public-call-url", publicVoiceLimiter);
app.use("/api/contact", contactLimiter);
// Tarjetas públicas por id secuencial: limita la enumeración masiva (un QR
// real se abre unas pocas veces por minuto desde una misma IP).
app.use("/api/public/qr", publicQrLimiter);
app.use("/api/shopybrain/study", aiLimiter);
app.use("/api/intelligence", aiLimiter);
app.use("/api/redesign", aiLimiter);
app.use("/api/seo", aiLimiter);
app.use("/api/emails", aiLimiter);
app.use("/api/reference", aiLimiter);
app.use("/api/agency/analyze", aiLimiter);
app.use("/api/agency/proposal", aiLimiter);
app.use("/api", apiLimiter);

// ── Anti-502 middleware — regex-based auto-detection of AI-heavy routes ───────
const AI_ROUTE_PATTERNS = [
  /^\/api\/shopybrain\/(absorb|create-product|supplier|research|audit|search|study|execute|chat)/,
  /^\/api\/fusion-studio\//,
  /^\/api\/agency\/(analyze|quote|budget|proposal)/,
  /^\/api\/research\//,
  /^\/api\/intelligence\//,
  /^\/api\/competitors\/(scan|auto-discover)/,
  /^\/api\/web-lab\//,
  /^\/api\/generator\/run/,
  /^\/api\/email-templates\/generate/,
  /^\/api\/emails\/(generate|flows)/,
  /^\/api\/enrichment\//,
  /^\/api\/klaviyo-ai\//,
  /^\/api\/reference\/analyze/,
  /^\/api\/inventory\/restock-email/,
  /^\/api\/push\/vapid-generate/,
  /^\/api\/voice\/command/,
  /^\/api\/entity-research\//,
  /^\/api\/absorber\//,
  /\/audit\/run$/,
  /\/visual-dna$/,
  /\/repair-consistency$/,
  /\/ab-tests$/,
  /\/seo\/(generate|keyword|blog|fix-alt|generate-schemas)/,
  /\/products\/create$/,
  /\/catalog-opportunities$/,
  /\/financial-forecast$/,
  /\/analyze-competitors$/,
  /\/calculate-optimal-price$/,
  /\/ai-estimate-cogs$/,
  /\/bulk-redesign$/,
  /\/images\/generate/,
  /\/exports\/(generate|run-full)/,
  /\/redesign$/,
  /\/apply-redesign$/,
  /\/enrich-batch$/,
  /\/build-image-prompt$/,
  /\/plan\/check$/,
];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "POST" && req.method !== "PUT") return next();
  const isAiHeavy = AI_ROUTE_PATTERNS.some(pattern => pattern.test(req.path));
  if (isAiHeavy) {
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Cache-Control", "no-cache");
  }
  next();
});

app.use("/api", router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada", path: req.path });
});

// ── Global error handler (Express 5 catches async errors automatically) ──────
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    logger.error({ err: err?.message, path: req.path }, "Error after headers sent");
    // Cerrar la respuesta: antes quedaba abierta hasta el timeout del servidor
    // (60 min). SSE recibe un evento de error; JSON tras latido, el cuerpo de
    // error con su código (ver long-running.ts).
    if (!res.writableEnded) {
      try {
        const ct = String(res.getHeader("Content-Type") ?? "");
        if (ct.includes("text/event-stream")) {
          res.write(`data: ${JSON.stringify({ type: "error", error: "Error interno del servidor" })}\n\n`);
        } else if (ct.includes("application/json")) {
          res.write(JSON.stringify({ error: "Error interno del servidor", __httpStatus: 500 }));
        }
      } catch { /* socket ya cerrado */ }
      res.end();
    }
    return;
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Error interno del servidor";

  if (status >= 500) {
    logger.error({ err, method: req.method, path: req.path, body: req.body ? Object.keys(req.body) : [] }, `[UNHANDLED ${status}] ${req.method} ${req.path}`);
  } else {
    logger.warn({ message, path: req.path, status }, `[${status}] ${req.method} ${req.path}`);
  }

  if (status === 429 || message.includes("429") || message.includes("rate limit")) {
    res.status(429).json({ error: "Límite de solicitudes alcanzado. Espera un momento.", code: 429 });
    return;
  }
  if (status === 413 || message.includes("too large") || message.includes("payload")) {
    res.status(413).json({ error: "El contenido es demasiado grande. Reduce el tamaño.", code: 413 });
    return;
  }
  if (status === 401) {
    res.status(401).json({ error: "No autenticado. Inicia sesión.", code: 401 });
    return;
  }
  if (status === 403) {
    res.status(403).json({ error: "No autorizado para esta acción.", code: 403 });
    return;
  }
  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    res.status(504).json({ error: "Tiempo de espera agotado — inténtalo de nuevo.", code: 504 });
    return;
  }
  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    res.status(503).json({ error: "Servicio temporalmente no disponible.", code: 503 });
    return;
  }

  const safeMessage = status >= 500
    ? "Error interno del servidor. Inténtalo de nuevo."
    : message;

  res.status(status).json({
    error: safeMessage,
    code: status,
    ...(process.env.NODE_ENV !== "production" ? { debug: message } : {}),
  });
});

export default app;
