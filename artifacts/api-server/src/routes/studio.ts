import { recordClaudeMessageUsage, recordGeminiResponseUsage } from "../lib/api-usage.js";
import { Router } from "express";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { generateCompleteText } from "../lib/ai-json.js";
import { AiTruncatedError, aiOutputErrorMessage, isAiOutputError } from "../lib/ai-errors.js";

const router = Router();

const STUDIO_ROOT = "/home/runner/workspace/artifacts/shopify-optimizer/src";

function resolveSafe(filePath: string): string | null {
  const clean = filePath.replace(/\.\.\//g, "").replace(/^\//, "");
  const abs = path.join(STUDIO_ROOT, clean);
  if (!abs.startsWith(STUDIO_ROOT + path.sep) && abs !== STUDIO_ROOT) return null;
  return abs;
}

router.get("/studio/file", async (req, res): Promise<void> => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ error: "path required" }); return; }
  const abs = resolveSafe(filePath);
  if (!abs) { res.status(403).json({ error: "path not allowed" }); return; }
  try {
    const content = await readFile(abs, "utf-8");
    res.json({ content, path: filePath });
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

router.post("/studio/file", async (req, res): Promise<void> => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) { res.status(400).json({ error: "path and content required" }); return; }
  const abs = resolveSafe(filePath);
  if (!abs) { res.status(403).json({ error: "path not allowed" }); return; }
  try {
    await writeFile(abs, content, "utf-8");
    res.json({ success: true, path: filePath });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/studio/edit", async (req, res): Promise<void> => {
  const { filePath, instruction, model = "claude" } = req.body;
  if (!filePath || !instruction) { res.status(400).json({ error: "filePath and instruction required" }); return; }
  const abs = resolveSafe(filePath);
  if (!abs) { res.status(403).json({ error: "path not allowed" }); return; }

  let original: string;
  try { original = await readFile(abs, "utf-8"); }
  catch { res.status(404).json({ error: `No encontrado: ${filePath}` }); return; }

  const ext = path.extname(filePath).toLowerCase();
  const lang = ext === ".css" ? "CSS" : [".tsx", ".ts", ".jsx", ".js"].includes(ext) ? "TypeScript/React (TSX)" : "code";

  const SYSTEM = `Eres un editor de código experto para Shopy Crafter, plataforma de optimización Shopify con IA.
Tarea: modifica este archivo ${lang} según la instrucción del usuario.

REGLAS CRÍTICAS — sin excepción:
1. Devuelve ÚNICAMENTE el contenido completo del archivo modificado — nada más
2. SIN bloques markdown, SIN explicaciones, SIN comentarios sobre los cambios
3. Conserva TODA la funcionalidad existente, imports, exports y lógica
4. Haz SÓLO los cambios solicitados — no refactorices código no relacionado
5. Si es CSS: conserva todas las reglas existentes, sólo añade/modifica lo pedido
6. Si es TSX/TS: conserva tipos, props y estructura del componente
7. La salida se escribe DIRECTAMENTE al disco — debe ser ${lang} válido`;

  const USER = `ARCHIVO: ${filePath}

INSTRUCCIÓN: ${instruction}

--- CONTENIDO ACTUAL ---
${original}
--- FIN ---`;

  try {
    let modified = "";

    if (model === "gemini") {
      const { GoogleGenAI } = await import("@google/genai");
      const key = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
      const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      if (!key) throw new Error("Gemini no configurado — falta GEMINI_API_KEY");
      const opts: any = baseUrl
        ? { apiKey: key, httpOptions: { apiVersion: "", baseUrl } }
        : { apiKey: key };
      const ai = new GoogleGenAI(opts);
      const resp = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `${SYSTEM}\n\n${USER}`,
        config: { maxOutputTokens: 65536 },
      });
      recordGeminiResponseUsage("studio-edit", "gemini-2.5-pro", resp.usageMetadata);
      // La salida es el archivo ENTERO: si se corta, sería un archivo roto.
      if (resp.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        throw new AiTruncatedError("[studio/edit:gemini] El archivo modificado se cortó por longitud", { label: "studio/edit:gemini" });
      }
      modified = resp.text ?? "";
    } else if (model === "grok") {
      const key = process.env.XAI_API_KEY ?? process.env.GROK_API_KEY;
      if (!key) throw new Error("XAI_API_KEY no configurado");
      const resp = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "grok-3",
          messages: [{ role: "system", content: SYSTEM }, { role: "user", content: USER }],
          max_tokens: 32000,
        }),
      });
      const data: any = await resp.json();
      if (data.choices?.[0]?.finish_reason === "length") {
        throw new AiTruncatedError("[studio/edit:grok] El archivo modificado se cortó por longitud", { label: "studio/edit:grok" });
      }
      modified = data.choices?.[0]?.message?.content ?? "";
    } else {
      const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
      if (!apiKey) throw new Error("Claude no configurado — falta ANTHROPIC_API_KEY");
      const client = baseURL ? new Anthropic({ apiKey, baseURL }) : new Anthropic({ apiKey });
      // Antes: 16000 tokens sin mirar stop_reason — un archivo largo volvía cortado
      // y se escribía a disco así. Ahora, si se corta, se pide que continúe; si
      // sigue cortado, error (nunca medio archivo).
      modified = await generateCompleteText({
        prompt: USER,
        label: "studio/edit:claude",
        call: async (messages) => {
          const msg = await client.messages.create({
            model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
            max_tokens: 16000,
            system: SYSTEM,
            messages,
          });
          recordClaudeMessageUsage("studio-edit", msg.model, msg.usage);
          return { text: msg.content.map(b => (b.type === "text" ? b.text : "")).join(""), truncated: msg.stop_reason === "max_tokens" };
        },
      });
    }

    modified = modified.replace(/^```[\w]*\n?/, "").replace(/\n?```[\w]*\s*$/, "").trim();
    res.json({ modified, original, filePath });
  } catch (e: any) {
    console.error("[studio] edit error:", e.message);
    if (isAiOutputError(e)) { res.status(502).json({ error: aiOutputErrorMessage(e), code: e.code }); return; }
    res.status(500).json({ error: e.message });
  }
});

export default router;
