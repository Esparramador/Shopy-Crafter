import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ══════════════════════════════════════════════════════════════════════════
// AGENT SKILLS KNOWLEDGE — real disk-backed catalog of the 81 `.agents/skills`
// Each skill dir has a SKILL.md with YAML frontmatter (name/description) +
// full markdown instructions. This module reads the REAL files from disk so
// the authenticated platform chatbot can KNOW and genuinely EXECUTE them
// (not a hardcoded/fake list — same pattern as cybersec-knowledge.ts).
// ══════════════════════════════════════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Walk up from this file's directory until we find a `.agents/skills` folder. */
function resolveSkillsDir(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, ".agents", "skills");
    if (existsSync(candidate)) return candidate;
    dir = join(dir, "..");
  }
  // Fallback: relative to process.cwd() (monorepo root is 2 levels above api-server)
  return join(process.cwd(), "../../.agents/skills");
}

const SKILLS_DIR = resolveSkillsDir();

export interface AgentSkillMeta {
  id: string;
  name: string;
  description: string;
  category: "document" | "media" | "business" | "marketing" | "meta" | "dev" | "other";
}

// Meta/build-time skills relevant only to the coding agent itself — never
// exposed as a user-facing executable action in the SaaS chatbot.
const META_SKILL_IDS = new Set([
  "skill-creator", "skill-finder", "find-skills", "brainstorming", "executing-plans",
  "vercel-composition-patterns", "vercel-react-best-practices", "vercel-react-native-skills",
  "web-component-design", "web-design-guidelines", "next-best-practices",
  "better-auth-best-practices", "supabase-postgres-best-practices",
  "threejs-animation", "threejs-fundamentals", "threejs-geometry", "threejs-interaction",
  "threejs-lighting", "threejs-loaders", "threejs-materials", "threejs-textures",
  "remotion-best-practices", "web-artifacts-builder", "github-solution-finder",
]);

const DOCUMENT_SKILL_IDS = new Set([
  "docx", "pdf", "pptx", "xlsx", "excel-generator", "invoice-generator", "resume-maker",
]);
const MEDIA_SKILL_IDS = new Set([
  "photo-editor", "video-editing", "podcast-generator", "podcast-marketing",
  "canvas-design", "ad-creative", "infographic-builder", "storyboard", "recreate-screenshot",
  "flashcard-generator", "file-converter",
]);
const MARKETING_SKILL_IDS = new Set([
  "copywriting", "content-machine", "seo-audit", "seo-auditor", "programmatic-seo", "geo",
  "competitive-analysis", "branding-generator", "audit-website", "ai-sdr", "ai-recruiter",
  "ai-secretary", "adaptador-copia-multiples-plataformas", "adaptador-posts-multiples-redes",
  "business-builder", "product-manager",
]);

function categorize(id: string): AgentSkillMeta["category"] {
  if (META_SKILL_IDS.has(id)) return "meta";
  if (DOCUMENT_SKILL_IDS.has(id)) return "document";
  if (MEDIA_SKILL_IDS.has(id)) return "media";
  if (MARKETING_SKILL_IDS.has(id)) return "marketing";
  return "business";
}

function parseFrontmatter(raw: string): { name?: string; description?: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const nameMatch = block.match(/^name:\s*(.+)$/m);

  // description can be: single-line (quoted or not), a YAML block scalar
  // (`description: |` / `description: >` followed by indented lines), or
  // the first line of a multi-line plain value.
  let description: string | undefined;
  const blockScalarMatch = block.match(/^description:\s*[|>][+-]?\s*\n((?:[ \t]+.*\n?)*)/m);
  if (blockScalarMatch) {
    description = blockScalarMatch[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(" ")
      .trim();
  } else {
    const descMatch = block.match(/^description:\s*(.+)$/m);
    description = descMatch?.[1]?.trim();
    if (description) description = description.replace(/^["']/, "").replace(/["']$/, "");
  }
  return { name: nameMatch?.[1]?.trim(), description };
}

let _catalog: AgentSkillMeta[] | null = null;

export function getAgentSkillsCatalog(): AgentSkillMeta[] {
  if (_catalog) return _catalog;
  const list: AgentSkillMeta[] = [];
  try {
    const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of dirs) {
      const skillMdPath = join(SKILLS_DIR, d.name, "SKILL.md");
      if (!existsSync(skillMdPath)) continue;
      try {
        const raw = readFileSync(skillMdPath, "utf-8");
        const { name, description } = parseFrontmatter(raw);
        list.push({
          id: d.name,
          name: name || d.name,
          description: description || "",
          category: categorize(d.name),
        });
      } catch { /* skip unreadable skill */ }
    }
  } catch {
    /* SKILLS_DIR not found — return empty catalog, callers handle gracefully */
  }
  _catalog = list;
  return _catalog;
}

export function getAgentSkillContent(skillId: string): string | null {
  const skillPath = join(SKILLS_DIR, skillId, "SKILL.md");
  if (!existsSync(skillPath)) return null;
  return readFileSync(skillPath, "utf-8");
}

const STOPWORDS = new Set(["a", "de", "el", "la", "los", "las", "en", "y", "con", "para", "the", "of", "and", "or", "to", "in", "on", "un", "una"]);

export function searchAgentSkills(query: string, limit = 15, excludeMeta = true): AgentSkillMeta[] {
  const catalog = getAgentSkillsCatalog().filter(s => !excludeMeta || s.category !== "meta");
  const q = query.toLowerCase().replace(/-/g, " ").trim();
  const words = q.split(/\s+/).filter(w => w.length > 2 && !STOPWORDS.has(w));
  const terms = words.length > 0 ? words : [q];

  return catalog
    .map(s => {
      let score = 0;
      const id = s.id.replace(/-/g, " ").toLowerCase();
      const name = s.name.toLowerCase();
      const description = s.description.toLowerCase();
      if (id === q || name === q) score += 30;
      else if (id.startsWith(q) || name.startsWith(q)) score += 20;
      else if (id.includes(q) || name.includes(q)) score += 12;
      for (const w of terms) {
        if (id.includes(w)) score += 6;
        if (name.includes(w)) score += 5;
        if (description.includes(w)) score += 3;
      }
      return { ...s, _score: score };
    })
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...s }) => s);
}

export function getAgentSkillCategories(): Array<{ name: string; count: number }> {
  const catalog = getAgentSkillsCatalog().filter(s => s.category !== "meta");
  const counts = catalog.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

export function buildAgentSkillsKnowledgeBlock(): string {
  const catalog = getAgentSkillsCatalog().filter(s => s.category !== "meta");
  const categories = getAgentSkillCategories();
  return `
╔═════════════════════════════════════════════════════════════════════════╗
║  🧩 CATÁLOGO DE ${catalog.length} SKILLS DE AGENCIA — conocimiento + ejecución real ║
╚═════════════════════════════════════════════════════════════════════════╝

Tienes acceso real (lectura de disco, no inventado) a ${catalog.length} skills de agencia
que cubren generación de documentos, marketing, media y negocio.

CATEGORÍAS DISPONIBLES:
${categories.map(c => `  • ${c.name} (${c.count} skills)`).join("\n")}

CÓMO USARLAS:
- agent_skill {skillId}: recupera la guía completa de una skill y actúa siguiéndola al pie de la letra.
- agent_skill_search {query}: busca la skill correcta cuando no conoces el ID exacto.
- Para documentos reales (Word/Excel/PowerPoint) usa además generate_office_document, que produce el archivo REAL (no solo texto) usando las librerías docx/exceljs/pptxgenjs ya instaladas y lo guarda en el Vault.

EJEMPLOS: docx, pdf, pptx, xlsx, excel-generator, invoice-generator, resume-maker,
copywriting, seo-audit, branding-generator, ad-creative, photo-editor, video-editing,
competitive-analysis, product-manager, legal-contract, meal-planner, travel-assistant...
`;
}
