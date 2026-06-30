import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In the bundle, __dirname = dist/ and data is at dist/data/
// Fallback to src/data during initial cold start before first build
const _distData = join(__dirname, "data");
const _srcData  = join(__dirname, "../src/data");
const DATA_DIR  = existsSync(join(_distData, "cybersec-catalog.json")) ? _distData
                : existsSync(join(_srcData,  "cybersec-catalog.json")) ? _srcData
                : join(process.cwd(), "src/data");
const SKILLS_DIR = join(DATA_DIR, "cybersec-skills");

export interface CybersecSkillMeta {
  id: string;
  name: string;
  description: string;
  subdomain: string;
  tags: string[];
  mitre_attack: string[];
  nist_csf: string[];
  overview: string;
  when_to_use: string[];
  version: string;
}

let _catalog: CybersecSkillMeta[] | null = null;

export function getCybersecCatalog(): CybersecSkillMeta[] {
  if (_catalog) return _catalog;
  try {
    const raw = readFileSync(join(DATA_DIR, "cybersec-catalog.json"), "utf-8");
    _catalog = JSON.parse(raw).skills as CybersecSkillMeta[];
  } catch {
    _catalog = [];
  }
  return _catalog;
}

export function getSkillContent(skillId: string): string | null {
  const skillPath = join(SKILLS_DIR, skillId, "SKILL.md");
  if (!existsSync(skillPath)) return null;
  return readFileSync(skillPath, "utf-8");
}

export function searchCybersecSkills(query: string, limit = 15): CybersecSkillMeta[] {
  const catalog = getCybersecCatalog();
  const q = query.toLowerCase().replace(/-/g, " ");
  return catalog
    .map(s => {
      let score = 0;
      const name = s.name.replace(/-/g, " ").toLowerCase();
      if (name === q) score += 30;
      else if (name.startsWith(q)) score += 20;
      else if (name.includes(q)) score += 12;
      if (s.description.toLowerCase().includes(q)) score += 6;
      if (s.overview?.toLowerCase().includes(q)) score += 4;
      if (s.subdomain?.toLowerCase().includes(q)) score += 8;
      if (s.tags?.some(t => t.toLowerCase().includes(q))) score += 5;
      if (s.mitre_attack?.some(m => m.toLowerCase().includes(q))) score += 7;
      return { ...s, _score: score };
    })
    .filter(s => (s as any)._score > 0)
    .sort((a, b) => ((b as any)._score) - ((a as any)._score))
    .slice(0, limit);
}

export function getCybersecDomains(): Array<{ name: string; count: number }> {
  const catalog = getCybersecCatalog();
  const counts = catalog.reduce((acc, s) => {
    acc[s.subdomain] = (acc[s.subdomain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function buildCybersecKnowledgeBlock(): string {
  const domains = getCybersecDomains();
  return `
╔═════════════════════════════════════════════════════════════════════════╗
║  🔐 BASE DE CONOCIMIENTO CIBERSEGURIDAD — 817 SKILLS · 30 DOMINIOS     ║
║  Frameworks: MITRE ATT&CK v19.1 · NIST CSF 2.0 · MITRE ATLAS          ║
║  MITRE D3FEND · NIST AI RMF · MITRE Fight Fraud Framework v1.1         ║
╚═════════════════════════════════════════════════════════════════════════╝

Eres un experto en ciberseguridad de nivel senior. Tienes acceso a 817 skills
de seguridad con guías técnicas paso a paso para:

DOMINIOS DISPONIBLES:
${domains.slice(0, 20).map(d => `  • ${d.name.replace(/-/g," ")} (${d.count} skills)`).join("\n")}
  ... y ${domains.length - 20} dominios más.

CÓMO USAR LAS SKILLS:
- security_skill {skillId}: guía técnica completa de cualquier skill
- security_skill_search {query}: busca skills por término

EXEMPLOS DE SKILLS DISPONIBLES:
  • Análisis de malware: analyzing-malware-behavior-with-cuckoo-sandbox
  • Red team AD: abusing-shadow-credentials-for-privesc
  • Cloud security: analyzing-azure-activity-logs-for-threats
  • Web OWASP: analyzing-api-gateway-access-logs
  • Forensics: acquiring-disk-image-with-dd-and-dcfldd
  • Phishing: analyzing-email-headers-for-phishing-investigation
  • Compliance: achieving-cmmc-level-2-compliance
  • Threat hunting: analyzing-apt-group-with-mitre-navigator

⚠️ IMPORTANTE: Usa este conocimiento ÚNICAMENTE para análisis defensivo,
hardening, auditorías autorizadas, diseño seguro y protección de sistemas.
`;
}
