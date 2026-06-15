import { Router } from "express";
import {
  SKILLS_LIBRARY, SKILL_CATEGORIES,
  getSkillById, getSkillsByCategory, searchSkills, resolveTemplate,
} from "../lib/skills-library.js";
import { askAMR } from "../lib/amr.js";
import { saveToVault } from "../lib/vault.js";

const router = Router();

// GET /api/skills — list all skills (with optional search/filter)
router.get("/skills", (req, res) => {
  const { q, category, premium, outputType } = req.query as Record<string, string>;

  let skills = q ? searchSkills(q) : [...SKILLS_LIBRARY];
  if (category) skills = skills.filter(s => s.category === category);
  if (premium === "true")  skills = skills.filter(s => s.isPremium);
  if (premium === "false") skills = skills.filter(s => !s.isPremium);
  if (outputType) skills = skills.filter(s => s.outputType === outputType);

  res.json({
    skills,
    total: skills.length,
    categories: SKILL_CATEGORIES,
  });
});

// GET /api/skills/categories — list categories with counts
router.get("/skills/categories", (_req, res) => {
  res.json({ categories: SKILL_CATEGORIES });
});

// GET /api/skills/:id — get a single skill
router.get("/skills/:id", (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) { res.status(404).json({ error: "Skill no encontrada" }); return; }
  res.json(skill);
});

// POST /api/skills/:id/execute — execute a skill (with variable resolution + AI call)
router.post("/skills/:id/execute", async (req, res) => {
  const skill = getSkillById(req.params.id);
  if (!skill) { res.status(404).json({ error: "Skill no encontrada" }); return; }

  const { variables = {}, modelId, projectId, saveVault } = req.body as {
    variables?: Record<string, string>;
    modelId?: string;
    projectId?: number;
    saveVault?: boolean;
  };

  const resolvedPrompt = resolveTemplate(skill, variables);
  const model = modelId ?? skill.preferredModel ?? "claude-sonnet";

  // Streaming mode
  if (req.headers.accept?.includes("text/event-stream")) {
    const { streamAMR } = await import("../lib/amr.js");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    await streamAMR(
      [{ role: "system", content: "Eres un experto de marketing y diseño web. Devuelve exactamente lo que se solicita, sin preámbulos ni explicaciones extra." },
       { role: "user", content: resolvedPrompt }],
      model, res
    );
    return;
  }

  // Non-streaming
  try {
    const output = await askAMR(
      [{ role: "system", content: "Eres un experto de marketing y diseño web. Devuelve exactamente lo que se solicita, sin preámbulos ni explicaciones extra." },
       { role: "user", content: resolvedPrompt }],
      model,
      { maxTokens: skill.estimatedTokens + 1000 }
    );

    // Optionally save to vault
    if (saveVault && projectId) {
      try {
        await saveToVault({ projectId, title: `Skill: ${skill.name}`, content: output, category: skill.category } as never);
      } catch { /* non-critical */ }
    }

    res.json({ output, skill: { id: skill.id, name: skill.name, category: skill.category }, model });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// GET /api/skills/by-category/:category — skills by category
router.get("/skills/by-category/:category", (req, res) => {
  const skills = getSkillsByCategory(req.params.category as never);
  res.json({ skills, category: req.params.category });
});

export default router;
