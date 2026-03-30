import express, { type Express, type Request, type Response, type NextFunction } from "express";
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
import { PgRateLimitStore, startRateLimitCleanup } from "./lib/pg-rate-limit-store.js";

const PgSession = ConnectPg(session);

const app: Express = express();

app.set("trust proxy", 1);

// ── Security headers (Helmet) ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// ── Gzip compression for all responses ──────────────────────────────────────
app.use(compression());

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
  skip: (req) => process.env.NODE_ENV !== "production",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("api"),
  message: { error: "Límite de peticiones alcanzado. Inténtalo en un momento.", code: "RATE_LIMITED" },
  skip: (req) => process.env.NODE_ENV !== "production",
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore("ai"),
  message: { error: "Demasiadas solicitudes de IA simultáneas. Espera un momento.", code: "AI_RATE_LIMITED" },
  skip: (req) => process.env.NODE_ENV !== "production",
});

startRateLimitCleanup();

// ── Body parsing ──────────────────────────────────────────────────────────────
// 50mb to support up to 5 base64-encoded high-res images in reference analysis
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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

// ── No-cache for all API responses (prevents stale data in production) ────────
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ── Static reports (auth-protected) ──────────────────────────────────────────
const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = path.dirname(__filename2);
const reportsDir = path.join(__dirname2, "..", "public", "reports");
const reportAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req.session as any)?.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
app.use("/api/reports", reportAuth, express.static(reportsDir));
app.use("/reports", reportAuth, express.static(reportsDir));
if (process.env.NODE_ENV !== "production") {
  app.use("/api/public-reports", express.static(reportsDir));
  app.use("/public-reports", express.static(reportsDir));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/shopybrain/study", aiLimiter);
app.use("/api/intelligence", aiLimiter);
app.use("/api/redesign", aiLimiter);
app.use("/api/seo", aiLimiter);
app.use("/api/emails", aiLimiter);
app.use("/api/reference", aiLimiter);
app.use("/api/agency/analyze", aiLimiter);
app.use("/api/agency/proposal", aiLimiter);
app.use("/api", apiLimiter);
app.use("/api", router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada", path: req.path });
});

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Error interno del servidor";
  const stack = err instanceof Error ? err.stack : undefined;

  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");

  // Don't leak stack traces in production
  const body: Record<string, unknown> = { error: message };
  if (process.env.NODE_ENV !== "production" && stack) {
    body.stack = stack;
  }

  // Handle specific error types
  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    res.status(504).json({ error: "Tiempo de espera agotado — inténtalo de nuevo", code: "TIMEOUT" });
    return;
  }
  if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND")) {
    res.status(503).json({ error: "Servicio temporalmente no disponible", code: "SERVICE_UNAVAILABLE" });
    return;
  }

  res.status(500).json(body);
});

export default app;
