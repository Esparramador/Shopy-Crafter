import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

export const MSG_UPLOADS_DIR = path.resolve(process.cwd(), "msg-uploads");
if (!fs.existsSync(MSG_UPLOADS_DIR)) {
  fs.mkdirSync(MSG_UPLOADS_DIR, { recursive: true });
}

(async () => {
  try {
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type TEXT`);
    await db.execute(sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size INTEGER`);
    logger.info("messages file columns ensured");
  } catch (e: any) {
    logger.warn({ err: e?.message }, "messages file columns migration non-fatal");
  }
})();

export const msgUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MSG_UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      cb(null, `${randomBytes(14).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});
