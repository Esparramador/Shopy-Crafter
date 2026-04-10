import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify.js";

const router = Router();

const M4_PIXEL_SRC = "https://cdn.shopycrafter.com/pixel/m4-tracker.js";

router.get("/projects/:projectId/scripttags", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    if (!project.accessToken) { res.status(400).json({ error: "Tienda no conectada" }); return; }
  
    try {
      const data = await shopifyRequest<{ script_tags: Array<{ id: number; src: string; event: string; display_scope: string }> }>(
        projectId, project.shopDomain, "/script_tags.json"
      );
  
      const m4Tag = data.script_tags.find(t => t.src.includes("m4-tracker") || t.src.includes("shopycrafter"));
  
      res.json({
        scriptTags: data.script_tags,
        m4Installed: !!m4Tag,
        m4TagId: m4Tag?.id ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      res.status(500).json({ error: message });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/projects/:projectId/scripttags/m4", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    if (!project.accessToken) { res.status(400).json({ error: "Tienda no conectada" }); return; }
  
    const src = M4_PIXEL_SRC;
  
    try {
      const existing = await shopifyRequest<{ script_tags: Array<{ id: number; src: string }> }>(
        projectId, project.shopDomain, "/script_tags.json"
      );
  
      const alreadyInstalled = existing.script_tags.find(t => t.src.includes("m4-tracker") || t.src.includes("shopycrafter"));
      if (alreadyInstalled) {
        res.json({ success: true, message: "M4 pixel ya está instalado", tagId: alreadyInstalled.id, alreadyInstalled: true });
        return;
      }
  
      const result = await shopifyRequest<{ script_tag: { id: number; src: string } }>(
        projectId, project.shopDomain, "/script_tags.json",
        {
          method: "POST",
          body: JSON.stringify({
            script_tag: {
              event: "onload",
              src,
              display_scope: "all",
            },
          }),
        }
      );
  
      res.json({
        success: true,
        message: "M4 tracking pixel instalado correctamente",
        tagId: result.script_tag.id,
        src: result.script_tag.src,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      res.status(500).json({ error: `No se pudo instalar el pixel: ${message}` });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.delete("/projects/:projectId/scripttags/m4", async (req, res): Promise<void> => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  
    if (!project) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }
    if (!project.accessToken) { res.status(400).json({ error: "Tienda no conectada" }); return; }
  
    try {
      const existing = await shopifyRequest<{ script_tags: Array<{ id: number; src: string }> }>(
        projectId, project.shopDomain, "/script_tags.json"
      );
  
      const m4Tag = existing.script_tags.find(t => t.src.includes("m4-tracker") || t.src.includes("shopycrafter"));
      if (!m4Tag) {
        res.json({ success: true, message: "No hay pixel M4 instalado" });
        return;
      }
  
      await shopifyRequest(
        projectId, project.shopDomain, `/script_tags/${m4Tag.id}.json`,
        { method: "DELETE" }
      );
  
      res.json({ success: true, message: "M4 tracking pixel eliminado correctamente" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      res.status(500).json({ error: `No se pudo eliminar el pixel: ${message}` });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
