/**
 * client-advisor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Personal Business Advisor Engine for Client Panel Chatbot.
 *
 * Every piece of knowledge the client shares — via chat, explicit "teach",
 * or file upload — is stored in `client_knowledge` and automatically absorbed
 * into ShopyBrain OmniCore as sector memories, so the whole platform learns
 * from every client interaction.
 *
 * Key exports:
 *  · ensureClientKnowledgeTable()  — idempotent migration (call on startup)
 *  · loadClientProfile(pid)        — build system-prompt block from stored knowledge
 *  · extractAndLearnFromChat(...)  — fire-and-forget: extract facts → DB + OmniCore
 *  · teachClientAdvisor(...)       — explicit knowledge injection from teach route
 */

import { randomBytes } from "crypto";
import { z } from "zod";
import { db, clientKnowledgeTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "./logger.js";
import { ingestToShopyBrain } from "./brain-ingester.js";
import { getClaudeClient } from "./claude.js";
import { claudeMessagesJson } from "./ai-json.js";
import { lenientArray, optionalLooseNumber } from "./ai-schema.js";

// ── Extracción de hechos del chat: esquema y modelo ─────────────────────────
const learnedFactsSchema = z.object({
  facts: lenientArray(z.object({
    category: z.string().min(1).catch("free_knowledge"),
    title: z.string().min(1),
    content: z.string().min(1),
    confidence: optionalLooseNumber,
  })),
  sector: z.string().min(1).nullable().optional().catch(null),
});

const FAST_MODEL = "claude-sonnet-4-5";

// ── Category labels ──────────────────────────────────────────────────────────
export const KNOWLEDGE_CATEGORIES: Record<string, string> = {
  company_info:      "🏢 Empresa",
  sector:            "🏭 Sector / Industria",
  competitors:       "⚔️ Competidores",
  goals:             "🎯 Objetivos y Metas",
  pain_points:       "🔴 Problemas y Retos",
  customer_profile:  "👤 Perfil del Cliente Final",
  product_catalog:   "📦 Catálogo y Productos",
  pricing_strategy:  "💰 Estrategia de Precios",
  marketing:         "📣 Marketing y Canales",
  free_knowledge:    "💡 Conocimiento General",
  file_content:      "📎 Archivos y Documentos",
};

// ── Idempotent table migration ────────────────────────────────────────────────
export async function ensureClientKnowledgeTable(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS client_knowledge (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'free_knowledge',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT DEFAULT 'chat',
        confidence REAL DEFAULT 0.85,
        tags TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    ` as any);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_ck_project ON client_knowledge(project_id)
    ` as any);
    logger.info("✅ client_knowledge table ready");
  } catch (err: any) {
    logger.warn({ err: err.message }, "client_knowledge migration warning (may already exist)");
  }
}

// ── Load profile for system prompt injection ─────────────────────────────────
export async function loadClientProfile(projectId: string | number): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(clientKnowledgeTable)
      .where(eq(clientKnowledgeTable.projectId, String(projectId)))
      .orderBy(desc(clientKnowledgeTable.updatedAt))
      .limit(60);

    if (rows.length === 0) return "";

    // Group by category
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      const cat = row.category ?? "free_knowledge";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(row);
    }

    const lines: string[] = ["══ PERFIL DE NEGOCIO DEL CLIENTE (conocimiento acumulado) ══"];
    for (const [cat, entries] of Object.entries(grouped)) {
      const label = KNOWLEDGE_CATEGORIES[cat] ?? cat;
      lines.push(`\n${label}:`);
      for (const e of entries.slice(0, 6)) {
        lines.push(`  • ${e.title}: ${e.content.slice(0, 300)}${e.content.length > 300 ? "…" : ""}`);
      }
    }
    lines.push(`\n[Total: ${rows.length} entradas de conocimiento sobre este cliente]`);
    lines.push("INSTRUCCIÓN: Usa este perfil activamente en tus respuestas. Refiérete a datos concretos del cliente. Si ves nuevas oportunidades basadas en lo que sabes de su sector, señálalas proactivamente.");

    return lines.join("\n");
  } catch {
    return "";
  }
}

// ── Extract and learn from conversation (fire-and-forget) ────────────────────
export function extractAndLearnFromChat(params: {
  projectId: string | number;
  niche?: string | null;
  userMessage: string;
  aiReply: string;
}): void {
  const { projectId, niche, userMessage, aiReply } = params;

  if (userMessage.length < 20) return; // skip trivial messages

  setImmediate(async () => {
    try {
      // Antes: new Anthropic({ apiKey: ANTHROPIC_API_KEY }) — sin esa variable (p. ej.
      // con la integración de Replit) la extracción fallaba siempre y solo quedaba en
      // un log de debug. Ahora el mismo cliente que el resto del API.
      const client = await getClaudeClient(Number(projectId) || 0);
      const parsed = await claudeMessagesJson(client, {
        model: FAST_MODEL,
        maxTokens: 1200,
        schema: learnedFactsSchema,
        label: "client-advisor:extract-facts",
        system: `Eres un extractor de inteligencia de negocio. Analiza la conversación entre un cliente y su asesor IA y extrae hechos concretos y relevantes sobre el negocio del cliente.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "facts": [
    {
      "category": "company_info|sector|competitors|goals|pain_points|customer_profile|product_catalog|pricing_strategy|marketing|free_knowledge",
      "title": "Título corto del hecho (máx 80 chars)",
      "content": "Descripción detallada del hecho aprendido (máx 400 chars)",
      "confidence": 0.6-1.0
    }
  ],
  "sector": "sector del negocio en 2-3 palabras o null si no se menciona"
}

REGLAS:
- Solo extrae hechos NUEVOS y CONCRETOS sobre el negocio del cliente
- Si el cliente no revela info nueva, devuelve {"facts":[],"sector":null}
- No extraigas conversación genérica, solo datos de negocio reales
- Máx 5 hechos por conversación`,
        prompt: `MENSAJE DEL CLIENTE: "${userMessage}"\n\nRESPUESTA DEL ASESOR: "${aiReply.slice(0, 600)}"`,
      });

      if (!parsed.facts.length) return;

      const resolvedNiche = parsed.sector ?? niche ?? null;

      for (const fact of parsed.facts) {
const id = randomBytes(12).toString("hex");
        await db
          .insert(clientKnowledgeTable)
          .values({
            id,
            projectId: String(projectId),
            category: fact.category ?? "free_knowledge",
            title: fact.title.slice(0, 200),
            content: fact.content.slice(0, 2000),
            source: "chat",
            confidence: Math.min(1, Math.max(0.5, fact.confidence ?? 0.8)),
            tags: resolvedNiche ? JSON.stringify([resolvedNiche]) : null,
          })
          .catch(() => {});

        // Absorb into ShopyBrain so the whole platform learns
        ingestToShopyBrain({
          sourceType: "manual",
          rawIntelligence: `[Cliente ${projectId} — ${fact.category}]\n${fact.title}: ${fact.content}`,
          niche: resolvedNiche,
          title: `Cliente: ${fact.title}`,
          confidence: fact.confidence ?? 0.8,
          skipStructuredExtraction: true,
        });
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, "client-advisor: extracción de hechos omitida");
    }
  });
}

// ── Explicit knowledge injection (from /teach route or file upload) ──────────
export async function teachClientAdvisor(params: {
  projectId: string | number;
  category: string;
  title: string;
  content: string;
  source?: string;
  niche?: string | null;
  confidence?: number;
}): Promise<{ id: string }> {
  const {
    projectId,
    category = "free_knowledge",
    title,
    content,
    source = "teach",
    niche = null,
    confidence = 0.9,
  } = params;

  const id = randomBytes(12).toString("hex");

  await db.insert(clientKnowledgeTable).values({
    id,
    projectId: String(projectId),
    category,
    title: title.slice(0, 200),
    content: content.slice(0, 5000),
    source,
    confidence,
    tags: niche ? JSON.stringify([niche]) : null,
  });

  // Absorb into ShopyBrain
  ingestToShopyBrain({
    sourceType: "manual",
    rawIntelligence: `[Enseñanza directa — Cliente ${projectId} — ${category}]\n${title}: ${content}`,
    niche,
    title: `Enseñanza cliente: ${title}`,
    confidence,
    skipStructuredExtraction: content.length < 300,
  });

  return { id };
}

// ── Delete a knowledge entry ──────────────────────────────────────────────────
export async function deleteClientKnowledge(id: string, projectId: string | number): Promise<void> {
  const { sql: drizzleSql } = await import("drizzle-orm");
  await db
    .delete(clientKnowledgeTable)
    .where(
      drizzleSql`${clientKnowledgeTable.id} = ${id} AND ${clientKnowledgeTable.projectId} = ${String(projectId)}`
    );
}

// ── Summarise profile as one paragraph (used by ShopyBrain if needed) ────────
export async function buildClientSummary(projectId: string | number): Promise<string> {
  try {
    const rows = await db
      .select({ category: clientKnowledgeTable.category, title: clientKnowledgeTable.title, content: clientKnowledgeTable.content })
      .from(clientKnowledgeTable)
      .where(eq(clientKnowledgeTable.projectId, String(projectId)))
      .orderBy(desc(clientKnowledgeTable.confidence))
      .limit(30);

    if (!rows.length) return "";
    return rows.map(r => `[${r.category}] ${r.title}: ${r.content.slice(0, 200)}`).join(" | ");
  } catch {
    return "";
  }
}
