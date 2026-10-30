import { Router } from "express";
import { getFile } from "../lib/file-store.js";
import { SHARE_NS, isShareExpired } from "../lib/public-share.js";

// Enlaces públicos temporales (ver lib/public-share.ts). Sin sesión: los descarga
// el proveedor externo. Nombre aleatorio y caducidad de 24 h.
const router = Router();

router.get("/share/:key", async (req, res): Promise<void> => {
  const key = String(req.params.key);
  if (!/^[a-f0-9]{32}\.[a-z0-9]{2,4}$/.test(key)) { res.status(404).end(); return; }
  const f = await getFile(SHARE_NS, key).catch(() => null);
  if (!f || isShareExpired(f.createdAt)) { res.status(404).end(); return; }
  res.setHeader("Content-Type", f.mime);
  res.setHeader("Content-Length", String(f.size));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.end(f.bytes);
});

export default router;
