import { Router } from "express";
import { requireAuth } from "../lib/auth.js";
import {
  getCybersecCatalog,
  getSkillContent,
  searchCybersecSkills,
  getCybersecDomains,
} from "../lib/cybersec-knowledge.js";

const router = Router();

// ── GET /api/cybersec/catalog ───────────────────────────────────────────────
router.get("/cybersec/catalog", requireAuth, (req, res) => {
  const { q, domain, tag, limit = "50", offset = "0" } = req.query as Record<string, string>;
  const lim = Math.min(parseInt(limit) || 50, 200);
  const off = parseInt(offset) || 0;

  if (q) {
    const results = searchCybersecSkills(q, lim + off);
    res.json({
      total: results.length,
      skills: results.slice(off, off + lim),
      domains: getCybersecDomains(),
    });
    return;
  }

  let catalog = getCybersecCatalog();
  if (domain) catalog = catalog.filter(s => s.subdomain === domain);
  if (tag)    catalog = catalog.filter(s => s.tags?.includes(tag));

  res.json({
    total: catalog.length,
    skills: catalog.slice(off, off + lim),
    domains: getCybersecDomains(),
  });
});

// ── GET /api/cybersec/skill/:id ─────────────────────────────────────────────
router.get("/cybersec/skill/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const content = getSkillContent(id);
  if (!content) {
    const suggestions = searchCybersecSkills(id, 8);
    res.status(404).json({ error: "Skill no encontrada", suggestions });
    return;
  }
  const meta = getCybersecCatalog().find(s => s.id === id);
  res.json({ id, content, meta });
});

// ── GET /api/cybersec/domains ───────────────────────────────────────────────
router.get("/cybersec/domains", requireAuth, (_req, res) => {
  res.json({ domains: getCybersecDomains() });
});

// ── GET /api/cybersec/search?q= ─────────────────────────────────────────────
router.get("/cybersec/search", requireAuth, (req, res) => {
  const { q = "", limit = "20" } = req.query as Record<string, string>;
  const results = searchCybersecSkills(q, parseInt(limit) || 20);
  res.json({ total: results.length, skills: results });
});

export default router;
