/**
 * Characters routes — sistema "Character Lock" para preservar la identidad
 * del presentador/modelo entre generaciones de anuncios.
 *
 * Endpoints (admin):
 *   GET    /projects/:projectId/characters              → lista
 *   POST   /projects/:projectId/characters              → crear (multipart con refImage)
 *   GET    /projects/:projectId/characters/:cid         → detalle (sin contenido binario)
 *   GET    /projects/:projectId/characters/:cid/image   → imagen ref (binary)
 *   PATCH  /projects/:projectId/characters/:cid         → actualizar metadatos
 *   DELETE /projects/:projectId/characters/:cid         → borrar
 */
import { Router } from "express";
import multer from "multer";
import { db, charactersTable, projectsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { saveToVault, getVaultContent } from "../lib/vault.js";
import { ObjectStorageService } from "../lib/objectStorage.js";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { learnFromOperation } from "../lib/claude.js";

let _osCharacters: ObjectStorageService | null = null;
function getStorageForCharacters(): ObjectStorageService {
  if (!_osCharacters) _osCharacters = new ObjectStorageService();
  return _osCharacters;
}

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo de imagen no permitido: ${file.mimetype}`) as any, false);
  },
});

function s(v: unknown, max = 500): string | undefined {
  if (v === null || v === undefined) return undefined;
  const t = String(v).trim();
  if (!t) return undefined;
  return t.slice(0, max);
}

// ─── LIST ───────────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/characters",
  requireAdmin,
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const rows = await db
        .select({
          id: charactersTable.id,
          name: charactersTable.name,
          gender: charactersTable.gender,
          ageRange: charactersTable.ageRange,
          identityDescription: charactersTable.identityDescription,
          voiceId: charactersTable.voiceId,
          voiceGender: charactersTable.voiceGender,
          voiceLanguage: charactersTable.voiceLanguage,
          refVaultFileId: charactersTable.refVaultFileId,
          refMimeType: charactersTable.refMimeType,
          styleNotes: charactersTable.styleNotes,
          createdAt: charactersTable.createdAt,
          updatedAt: charactersTable.updatedAt,
        })
        .from(charactersTable)
        .where(eq(charactersTable.projectId, projectId))
        .orderBy(desc(charactersTable.updatedAt));

      const items = rows.map((r) => ({
        ...r,
        imageUrl: r.refVaultFileId
          ? `/api/projects/${projectId}/characters/${r.id}/image`
          : null,
      }));
      res.json({ items, characters: items, total: items.length });
    } catch (err: any) {
      logger.error({ err: err?.message }, "characters list failed");
      res.status(500).json({ error: err?.message || "Error listando personajes" });
    }
  },
);

// ─── CREATE ─────────────────────────────────────────────────────────────────
router.post(
  "/projects/:projectId/characters",
  requireAdmin,
  upload.single("refImage"),
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      if (!project) {
        res.status(404).json({ error: "Proyecto no encontrado" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Falta la imagen de referencia (campo 'refImage')" });
        return;
      }
      const name = s(req.body?.name, 80);
      const identityDescription = s(req.body?.identityDescription, 1500);
      if (!name) {
        res.status(400).json({ error: "Falta el nombre del personaje" });
        return;
      }
      if (!identityDescription) {
        res.status(400).json({ error: "Falta la descripción de identidad" });
        return;
      }

      const gender = s(req.body?.gender, 30);
      const ageRange = s(req.body?.ageRange, 30);
      const voiceId = s(req.body?.voiceId, 80);
      const voiceGender = s(req.body?.voiceGender, 30);
      const voiceLanguage = s(req.body?.voiceLanguage, 10);
      const styleNotes = s(req.body?.styleNotes, 800);

      // Persistimos la imagen ref en el vault (autodetecta tamaño, mime, etc.)
      const vaultId = await saveToVault({
        projectId,
        fileType: "image",
        category: "character_reference",
        title: `Character ref — ${name}`,
        description: `Imagen de referencia del personaje "${name}". ${identityDescription.slice(0, 200)}`,
        mimeType: file.mimetype || "image/png",
        generatedBy: "character_upload",
        content: file.buffer.toString("base64"),
        metadata: {
          characterName: name,
          gender, ageRange,
          uploadedAt: new Date().toISOString(),
        },
      });

      if (!vaultId) {
        res.status(500).json({ error: "No se pudo guardar la imagen del personaje" });
        return;
      }

      const [created] = await db
        .insert(charactersTable)
        .values({
          projectId,
          name,
          gender: gender ?? null,
          ageRange: ageRange ?? null,
          identityDescription,
          voiceId: voiceId ?? null,
          voiceGender: voiceGender ?? null,
          voiceLanguage: voiceLanguage ?? null,
          refVaultFileId: vaultId,
          refMimeType: file.mimetype || "image/png",
          styleNotes: styleNotes ?? null,
        })
        .returning();

      learnFromOperation({
        operationType: "character_creation",
        title: `Personaje: ${name} — proyecto ${projectId}`,
        content: `Nuevo personaje creado. Nombre: "${name}". Género: ${gender || "no especificado"}. Edad: ${ageRange || "no especificada"}. Identidad: ${identityDescription.slice(0, 300)}. Voz: ${voiceId || "sin asignar"} (${voiceGender || "?"}, ${voiceLanguage || "?"}). Notas estilo: ${styleNotes || "ninguna"}`,
        confidence: 0.85,
        tags: ["character", "identity", name, gender, voiceLanguage].filter(Boolean) as string[],
      });

      res.status(201).json({
        success: true,
        character: {
          ...created,
          imageUrl: `/api/projects/${projectId}/characters/${created.id}/image`,
        },
      });
    } catch (err: any) {
      logger.error({ err: err?.message, stack: err?.stack }, "character create failed");
      res.status(500).json({ error: err?.message || "Error creando personaje" });
    }
  },
);

// ─── GET DETAIL ─────────────────────────────────────────────────────────────
router.get(
  "/projects/:projectId/characters/:cid",
  requireAdmin,
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const cid = parseInt(String(req.params.cid), 10);
      const [row] = await db
        .select()
        .from(charactersTable)
        .where(and(eq(charactersTable.id, cid), eq(charactersTable.projectId, projectId)));
      if (!row) {
        res.status(404).json({ error: "Personaje no encontrado" });
        return;
      }
      res.json({
        ...row,
        imageUrl: row.refVaultFileId
          ? `/api/projects/${projectId}/characters/${row.id}/image`
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Error" });
    }
  },
);

// ─── GET REF IMAGE (binary) ─────────────────────────────────────────────────
router.get(
  "/projects/:projectId/characters/:cid/image",
  requireAdmin,
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const cid = parseInt(String(req.params.cid), 10);
      const [row] = await db
        .select({ refVaultFileId: charactersTable.refVaultFileId, refMimeType: charactersTable.refMimeType })
        .from(charactersTable)
        .where(and(eq(charactersTable.id, cid), eq(charactersTable.projectId, projectId)));
      if (!row || !row.refVaultFileId) {
        res.status(404).json({ error: "Imagen no disponible" });
        return;
      }
      const file = await getVaultContent(row.refVaultFileId, projectId);
      if (!file) {
        res.status(404).json({ error: "Imagen no disponible" });
        return;
      }
      const ct = row.refMimeType || file.mimeType || "image/png";
      // PRIORIDAD: objectPath → content (refs grandes se offloadean a Object Storage)
      if (file.objectPath) {
        try {
          const gcs = await getStorageForCharacters().getObjectEntityFile(file.objectPath);
          const response = await getStorageForCharacters().downloadObject(gcs);
          const buf = Buffer.from(await response.arrayBuffer());
          res.setHeader("Content-Type", ct);
          res.setHeader("Cache-Control", "private, max-age=3600");
          res.end(buf);
          return;
        } catch (e: any) {
          logger.warn({ err: e?.message, vaultId: row.refVaultFileId }, "character image: object storage fetch failed, fallback to content");
        }
      }
      if (!file.content) {
        res.status(404).json({ error: "Contenido vacío" });
        return;
      }
      const buf = Buffer.from(file.content, "base64");
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.end(buf);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Error" });
    }
  },
);

// ─── PATCH ──────────────────────────────────────────────────────────────────
router.patch(
  "/projects/:projectId/characters/:cid",
  requireAdmin,
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const cid = parseInt(String(req.params.cid), 10);
      const updates: Record<string, unknown> = {};
      const fields = ["name", "gender", "ageRange", "identityDescription", "voiceId", "voiceGender", "voiceLanguage", "styleNotes"] as const;
      for (const f of fields) {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, f)) {
          updates[f] = s(req.body[f], f === "identityDescription" ? 1500 : f === "styleNotes" ? 800 : 80) ?? null; // nosemgrep: remote-property-injection
        }
      }
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "Nada que actualizar" });
        return;
      }
      const [updated] = await db
        .update(charactersTable)
        .set(updates)
        .where(and(eq(charactersTable.id, cid), eq(charactersTable.projectId, projectId)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Personaje no encontrado" });
        return;
      }
      res.json({ success: true, character: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Error" });
    }
  },
);

// ─── DELETE ─────────────────────────────────────────────────────────────────
router.delete(
  "/projects/:projectId/characters/:cid",
  requireAdmin,
  async (req, res) => {
    try {
      const projectId = parseInt(String(req.params.projectId), 10);
      const cid = parseInt(String(req.params.cid), 10);
      const result = await db
        .delete(charactersTable)
        .where(and(eq(charactersTable.id, cid), eq(charactersTable.projectId, projectId)))
        .returning({ id: charactersTable.id });
      if (result.length === 0) {
        res.status(404).json({ error: "Personaje no encontrado" });
        return;
      }
      res.json({ success: true, deletedId: cid });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Error" });
    }
  },
);

export default router;
