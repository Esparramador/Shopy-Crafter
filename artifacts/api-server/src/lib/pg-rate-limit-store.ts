import type { Store, IncrementResponse, Options } from "express-rate-limit";
import { pool } from "@workspace/db";
import { logger } from "./logger.js";

let cleanupStarted = false;

export class PgRateLimitStore implements Store {
  private static _tableReady = false;
  windowMs!: number;
  prefix: string;

  constructor(prefix = "rl") {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    if (!PgRateLimitStore._tableReady) {
      PgRateLimitStore._tableReady = true;
      pool.query(`
        DO $$ BEGIN
          CREATE TABLE IF NOT EXISTS express_rate_limits (
            key TEXT PRIMARY KEY,
            total_hits INTEGER NOT NULL DEFAULT 0,
            reset_at TIMESTAMPTZ NOT NULL
          );
        EXCEPTION WHEN duplicate_object OR unique_violation THEN NULL;
        END $$;
      `).then(() => {
        pool.query(`DELETE FROM express_rate_limits WHERE reset_at <= NOW()`).catch(() => {});
      }).catch((err) => logger.error({ err }, "Failed to ensure express_rate_limits table"));
    }
  }

  private prefixedKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const pk = this.prefixedKey(key);
    const resetAt = new Date(Date.now() + this.windowMs);

    try {
      const result = await pool.query(
        `INSERT INTO express_rate_limits (key, total_hits, reset_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE SET
           total_hits = CASE
             WHEN express_rate_limits.reset_at <= NOW() THEN 1
             ELSE express_rate_limits.total_hits + 1
           END,
           reset_at = CASE
             WHEN express_rate_limits.reset_at <= NOW() THEN $2
             ELSE express_rate_limits.reset_at
           END
         RETURNING total_hits, reset_at`,
        [pk, resetAt]
      );

      const row = result.rows[0];
      return {
        totalHits: row.total_hits,
        resetTime: new Date(row.reset_at),
      };
    } catch (err) {
      logger.error({ err, key: pk }, "PgRateLimitStore increment failed — fail-closed");
      return { totalHits: Number.MAX_SAFE_INTEGER, resetTime: resetAt };
    }
  }

  async decrement(key: string): Promise<void> {
    const pk = this.prefixedKey(key);
    try {
      await pool.query(
        `UPDATE express_rate_limits SET total_hits = GREATEST(total_hits - 1, 0) WHERE key = $1`,
        [pk]
      );
    } catch {}
  }

  async resetKey(key: string): Promise<void> {
    const pk = this.prefixedKey(key);
    try {
      await pool.query(`DELETE FROM express_rate_limits WHERE key = $1`, [pk]);
    } catch {}
  }

  async resetAll(): Promise<void> {
    try {
      await pool.query(`DELETE FROM express_rate_limits WHERE key LIKE $1`, [`${this.prefix}:%`]);
    } catch {}
  }
}

export function startRateLimitCleanup(intervalMs = 5 * 60 * 1000): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    pool.query(`DELETE FROM express_rate_limits WHERE reset_at <= NOW()`)
      .catch(() => {});
  }, intervalMs);
}
