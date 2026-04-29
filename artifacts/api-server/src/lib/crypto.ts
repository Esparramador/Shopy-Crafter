import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

let tempKeyGenerated = false;

export function validateEncryptionKey(): void {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    // SECURITY FIX C5: In production, fail hard instead of generating a
    // temporary key that would be lost on restart — silently corrupting all
    // previously-encrypted data (Shopify tokens, etc.).
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production. Generate a persistent key with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
        "then set it as an environment variable.",
      );
    }
    const generated = randomBytes(32).toString("hex");
    process.env.ENCRYPTION_KEY = generated;
    tempKeyGenerated = true;
    console.warn("╔══════════════════════════════════════════════════════════════╗");
    console.warn("║  ⚠️  WARNING: ENCRYPTION_KEY not set!                       ║");
    console.warn("║  A temporary key has been generated for this session.       ║");
    console.warn("║  Data encrypted now will NOT be decryptable after restart.  ║");
    console.warn("║  Set ENCRYPTION_KEY env var with a 64-char hex string.      ║");
    console.warn("║  (In production, the service would refuse to boot.)         ║");
    console.warn("╚══════════════════════════════════════════════════════════════╝");
  } else if (keyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
}

export function isUsingTemporaryKey(): boolean {
  return tempKeyGenerated;
}

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) throw new Error("ENCRYPTION_KEY not set — call validateEncryptionKey() at startup");
  return Buffer.from(keyHex, "hex");
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const key = getKey();
  const [ivHex, tagHex, encHex] = data.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function safeDecrypt(data: string | null | undefined): string {
  if (!data) return "";
  try {
    return decrypt(data);
  } catch {
    return "";
  }
}
