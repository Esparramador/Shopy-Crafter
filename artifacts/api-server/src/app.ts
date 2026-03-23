import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import ConnectPg from "connect-pg-simple";
import pinoHttp from "pino-http";
import compression from "compression";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { pool } from "@workspace/db";

const PgSession = ConnectPg(session);

const app: Express = express();

app.set("trust proxy", 1);

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
app.use(cors({ origin: true, credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Session ───────────────────────────────────────────────────────────────────
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET not set");

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false,
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

// ── Routes ────────────────────────────────────────────────────────────────────
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
