import { logger } from "./logger.js";

const MAX_CONCURRENT = 8;
const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 1500;

let active = 0;
const waiting: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiting.push(() => {
      active++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  active--;
  const next = waiting.shift();
  if (next) next();
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes("429") || msg.includes("rate")) return true;
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("529")) return true;
    if (msg.includes("overloaded")) return true;
  }
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: number }).status;
    if (status === 429 || status >= 500) return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withClaudeQueue<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot();
  let lastErr: unknown;
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (err) {
        lastErr = err;
        if (attempt < MAX_RETRIES && isRetryable(err)) {
          const jitter = Math.random() * 500;
          const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + jitter;
          logger.warn({ attempt: attempt + 1, delay: Math.round(delay) }, "Claude API transient error — retrying with backoff");
          releaseSlot();
          await sleep(delay);
          await acquireSlot();
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  } finally {
    releaseSlot();
  }
}
