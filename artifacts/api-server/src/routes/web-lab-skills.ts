import { Router, type Request, type Response } from "express";
import { enableLongRunning } from "../lib/long-running.js";
import { logger } from "../lib/logger.js";
import { saveToVault } from "../lib/vault.js";
import {
  listWebLabSkills,
  getWebLabSkill,
  getWebLabSkillContent,
  runWebLabSkill,
  SkillRunError,
  type SkillRunInputs,
} from "../lib/web-lab-skills.js";

// Skills del Web Lab: catálogo, detalle y ejecución real. Se monta desde
// routes/web-lab.ts, así que queda detrás del requireAdmin global de
// routes/index.ts como el resto del Web Lab.
const router = Router();

router.get("/web-lab/skills", (_req: Request, res: Response): void => {
  const { skills, engines } = listWebLabSkills();
  const executable = skills.filter(s => s.executable).length;
  res.json({
    total: skills.length,
    executable,
    notExecutable: skills.length - executable,
    engines,
    skills,
  });
});

router.get("/web-lab/skills/:id", (req: Request, res: Response): void => {
  const id = String(req.params.id);
  const skill = getWebLabSkill(id);
  if (!skill) { res.status(404).json({ error: `La skill «${id}» no existe en el catálogo.` }); return; }
  const content = getWebLabSkillContent(skill) ?? "";
  res.json({ skill, skillMd: content.slice(0, 6000), skillMdChars: content.length });
});

router.post("/web-lab/skills/run", async (req: Request, res: Response): Promise<void> => {
  const body = (req.body ?? {}) as { id?: unknown; inputs?: Record<string, unknown>; projectId?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) { res.status(400).json({ error: "Falta el id de la skill.", code: "MISSING_ID" }); return; }
  const raw = body.inputs ?? {};
  const inputs: SkillRunInputs = {};
  for (const k of ["text", "url", "imageUrl", "format"] as const) {
    if (typeof raw[k] === "string") inputs[k] = raw[k] as string;
  }
  const projectId = Number(body.projectId) || 0;

  const lr = enableLongRunning(res);
  try {
    const result = await runWebLabSkill(id, inputs, {
      projectId,
      saveFile: async ({ title, mimeType, buffer, format, skillId }) => saveToVault({
        projectId,
        fileType: `agent_skill_${format}`,
        category: "agent_skills",
        title,
        description: `Documento .${format} generado por la skill «${skillId}» desde el Web Lab`,
        mimeType,
        fileSizeBytes: buffer.length,
        content: buffer.toString("base64"),
        generatedBy: `web_lab_skill:${skillId}`,
      }),
    });
    logger.info({ id, ms: result.durationMs, kind: result.output.kind }, "[web-lab skills] ejecutada");
    res.json(result);
  } catch (err) {
    const e = err instanceof SkillRunError ? err : new SkillRunError(500, "Error interno al ejecutar la skill.", "RUN_FAILED");
    if (e.status >= 500) logger.error({ id, err: err instanceof Error ? err.message : String(err) }, "[web-lab skills] fallo");
    res.status(e.status).json({ error: e.message, code: e.code });
  } finally {
    lr.stop();
  }
});

export default router;
