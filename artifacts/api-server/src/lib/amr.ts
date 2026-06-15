/**
 * AMR — AI Model Router
 * Routes requests to 20+ models with a unified interface.
 * Supports: Claude, GPT, Gemini, DeepSeek, Grok, Mistral, Groq/Llama
 */
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import fetch from "node-fetch";
import type { Response } from "express";
import { logger } from "./logger.js";

// ─── Model catalog ────────────────────────────────────────────────────────────

export interface AMRModel {
  id: string;
  name: string;
  provider: "claude" | "openai" | "gemini" | "deepseek" | "grok" | "mistral" | "groq";
  apiModel: string;
  contextWindow: number;
  description: string;
  tags: string[];
  isPremium: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
}

export const AMR_MODELS: AMRModel[] = [
  // ── Claude ────────────────────────────────────────────────────────────────
  { id: "claude-sonnet",   name: "Claude Sonnet 4",  provider: "claude",   apiModel: "claude-sonnet-4-5",             contextWindow: 200000, description: "Balanceado, rápido y creativo — ideal para la mayoría de tareas", tags: ["smart","fast","creative"], isPremium: false, supportsVision: true,  supportsStreaming: true },
  { id: "claude-opus",     name: "Claude Opus 4",    provider: "claude",   apiModel: "claude-opus-4-5",               contextWindow: 200000, description: "Máxima inteligencia Claude — análisis profundo y razonamiento", tags: ["genius","deep","analysis"], isPremium: true,  supportsVision: true,  supportsStreaming: true },
  { id: "claude-haiku",    name: "Claude Haiku 3.5", provider: "claude",   apiModel: "claude-haiku-3-5-20241022",     contextWindow: 200000, description: "Ultra rápido y económico — tareas simples en milisegundos",        tags: ["fast","cheap","simple"],   isPremium: false, supportsVision: true,  supportsStreaming: true },
  // ── GPT ───────────────────────────────────────────────────────────────────
  { id: "gpt-4.1",         name: "GPT-4.1",          provider: "openai",   apiModel: "gpt-4.1",                       contextWindow: 128000, description: "Última versión GPT — gran rendimiento en código y razonamiento",  tags: ["smart","code","reasoning"], isPremium: false, supportsVision: true,  supportsStreaming: true },
  { id: "gpt-4o",          name: "GPT-4o",            provider: "openai",   apiModel: "gpt-4o",                        contextWindow: 128000, description: "Multimodal omni — visión, audio y texto en un solo modelo",        tags: ["multimodal","vision"],      isPremium: false, supportsVision: true,  supportsStreaming: true },
  { id: "gpt-4o-mini",     name: "GPT-4o Mini",       provider: "openai",   apiModel: "gpt-4o-mini",                   contextWindow: 128000, description: "Versión ligera de GPT-4o — rápido y económico",                    tags: ["fast","cheap"],            isPremium: false, supportsVision: true,  supportsStreaming: true },
  { id: "o3-mini",         name: "o3-mini",           provider: "openai",   apiModel: "o3-mini",                       contextWindow: 200000, description: "Razonamiento avanzado OpenAI — matemáticas y lógica compleja",     tags: ["reasoning","math","logic"], isPremium: true,  supportsVision: false, supportsStreaming: false },
  { id: "o1-mini",         name: "o1-mini",           provider: "openai",   apiModel: "o1-mini",                       contextWindow: 128000, description: "Modelo de razonamiento cadena-de-pensamiento",                     tags: ["reasoning","cot"],         isPremium: true,  supportsVision: false, supportsStreaming: false },
  // ── Gemini ────────────────────────────────────────────────────────────────
  { id: "gemini-2.5-pro",  name: "Gemini 2.5 Pro",   provider: "gemini",   apiModel: "gemini-2.5-pro",                contextWindow: 1000000, description: "Contexto de 1M tokens — documentos largos y análisis exhaustivo", tags: ["long-context","analysis"],  isPremium: true,  supportsVision: true,  supportsStreaming: true },
  { id: "gemini-2.5-flash",name: "Gemini 2.5 Flash",  provider: "gemini",   apiModel: "gemini-2.5-flash",              contextWindow: 1000000, description: "Flash de Google — velocidad excepcional con contexto enorme",      tags: ["fast","long-context"],     isPremium: false, supportsVision: true,  supportsStreaming: true },
  { id: "gemini-2.0-flash",name: "Gemini 2.0 Flash",  provider: "gemini",   apiModel: "gemini-2.0-flash",              contextWindow: 1000000, description: "Gemini 2.0 con búsqueda web en tiempo real integrada",            tags: ["search","grounding"],      isPremium: false, supportsVision: true,  supportsStreaming: true },
  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { id: "deepseek-v3",     name: "DeepSeek V3",       provider: "deepseek", apiModel: "deepseek-chat",                 contextWindow: 128000, description: "Modelo chino de vanguardia — excelente en código y ciencias",      tags: ["code","science","chinese"], isPremium: false, supportsVision: false, supportsStreaming: true },
  { id: "deepseek-r1",     name: "DeepSeek R1",       provider: "deepseek", apiModel: "deepseek-reasoner",             contextWindow: 128000, description: "Razonador DeepSeek — chain-of-thought abierto",                    tags: ["reasoning","cot","open"],  isPremium: false, supportsVision: false, supportsStreaming: true },
  // ── Grok ──────────────────────────────────────────────────────────────────
  { id: "grok-3",          name: "Grok 3",            provider: "grok",     apiModel: "grok-3",                        contextWindow: 131072, description: "xAI Grok 3 — conocimiento en tiempo real de X/Twitter",           tags: ["realtime","twitter","xai"], isPremium: true,  supportsVision: false, supportsStreaming: true },
  { id: "grok-3-mini",     name: "Grok 3 Mini",       provider: "grok",     apiModel: "grok-3-mini",                   contextWindow: 131072, description: "Versión ligera de Grok 3 con razonamiento eficiente",              tags: ["fast","reasoning"],        isPremium: false, supportsVision: false, supportsStreaming: true },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { id: "mistral-large",   name: "Mistral Large",     provider: "mistral",  apiModel: "mistral-large-latest",          contextWindow: 128000, description: "Flagship europeo de Mistral — multilingual y preciso",             tags: ["multilingual","european"],  isPremium: false, supportsVision: false, supportsStreaming: true },
  { id: "mistral-small",   name: "Mistral Small",     provider: "mistral",  apiModel: "mistral-small-latest",          contextWindow: 128000, description: "Mistral pequeño — eficiente y asequible para producción",          tags: ["fast","cheap","production"],isPremium: false, supportsVision: false, supportsStreaming: true },
  // ── Groq / Llama ─────────────────────────────────────────────────────────
  { id: "llama-3.3-70b",   name: "Llama 3.3 70B",    provider: "groq",     apiModel: "llama-3.3-70b-versatile",       contextWindow: 128000, description: "Meta Llama 3.3 via Groq — open-source ultrarrápido",              tags: ["open-source","fast"],      isPremium: false, supportsVision: false, supportsStreaming: true },
  { id: "llama-3.1-405b",  name: "Llama 3.1 405B",   provider: "groq",     apiModel: "llama-3.1-405b-reasoning",      contextWindow: 128000, description: "Modelo más grande de Meta — razonamiento de nivel GPT-4",         tags: ["open-source","large"],     isPremium: true,  supportsVision: false, supportsStreaming: true },
  { id: "mixtral-8x7b",    name: "Mixtral 8x7B",      provider: "groq",     apiModel: "mixtral-8x7b-32768",            contextWindow: 32768,  description: "Mezcla de expertos de Mistral via Groq — muy eficiente",          tags: ["moe","efficient"],         isPremium: false, supportsVision: false, supportsStreaming: true },
  { id: "gemma2-9b",       name: "Gemma 2 9B",        provider: "groq",     apiModel: "gemma2-9b-it",                  contextWindow: 8192,   description: "Google Gemma 2 via Groq — ligero y open-source",                  tags: ["open-source","small"],     isPremium: false, supportsVision: false, supportsStreaming: true },
];

export function getModelById(id: string): AMRModel | undefined {
  return AMR_MODELS.find(m => m.id === id);
}

export function getModelsByProvider(provider: AMRModel["provider"]): AMRModel[] {
  return AMR_MODELS.filter(m => m.provider === provider);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
}

function getGeminiClient() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "" });
}

// ─── Provider-specific callers ───────────────────────────────────────────────

async function callClaude(messages: Array<{ role: string; content: string }>, model: string, maxTokens = 4096): Promise<string> {
  const client = getAnthropicClient();
  const sysMsgs = messages.filter(m => m.role === "system");
  const userMsgs = messages.filter(m => m.role !== "system") as Array<{ role: "user" | "assistant"; content: string }>;
  const system = sysMsgs.map(m => m.content).join("\n") || undefined;
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: userMsgs,
  });
  const block = resp.content[0];
  return block.type === "text" ? block.text : "";
}

async function callGemini(messages: Array<{ role: string; content: string }>, model: string): Promise<string> {
  const client = getGeminiClient();
  const userMsg = messages.filter(m => m.role !== "system").map(m => m.content).join("\n\n");
  const result = await client.models.generateContent({ model, contents: userMsg });
  return result.text ?? "";
}

async function callOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  model: string,
  baseUrl: string,
  apiKey: string
): Promise<string> {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 4096, temperature: 0.7 }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AMR ${baseUrl} error ${resp.status}: ${err}`);
  }
  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Main unified callers ────────────────────────────────────────────────────

export async function askAMR(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  options: { maxTokens?: number } = {}
): Promise<string> {
  const model = getModelById(modelId) ?? AMR_MODELS[0];
  try {
    switch (model.provider) {
      case "claude":
        return await callClaude(messages, model.apiModel, options.maxTokens ?? 4096);
      case "gemini":
        return await callGemini(messages, model.apiModel);
      case "openai":
        return await callOpenAICompatible(messages, model.apiModel,
          "https://api.openai.com/v1", process.env.OPENAI_API_KEY ?? "");
      case "deepseek":
        return await callOpenAICompatible(messages, model.apiModel,
          "https://api.deepseek.com/v1", process.env.DEEPSEEK_API_KEY ?? "");
      case "grok":
        return await callOpenAICompatible(messages, model.apiModel,
          "https://api.x.ai/v1", process.env.XAI_API_KEY ?? process.env.GROK_API_KEY ?? "");
      case "mistral":
        return await callOpenAICompatible(messages, model.apiModel,
          "https://api.mistral.ai/v1", process.env.MISTRAL_API_KEY ?? "");
      case "groq":
        return await callOpenAICompatible(messages, model.apiModel,
          "https://api.groq.com/openai/v1", process.env.GROQ_API_KEY ?? "");
      default:
        throw new Error(`Unknown provider: ${(model as AMRModel).provider}`);
    }
  } catch (err) {
    logger.error({ err, modelId }, "AMR call failed");
    throw err;
  }
}

export async function streamAMR(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  res: Response
): Promise<void> {
  const model = getModelById(modelId) ?? AMR_MODELS[0];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendChunk = (text: string) => {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  };
  const sendDone = () => {
    res.write("data: [DONE]\n\n");
    res.end();
  };

  try {
    if (model.provider === "claude") {
      const client = getAnthropicClient();
      const sysMsgs = messages.filter(m => m.role === "system");
      const userMsgs = messages.filter(m => m.role !== "system") as Array<{ role: "user" | "assistant"; content: string }>;
      const stream = await client.messages.stream({
        model: model.apiModel,
        max_tokens: 4096,
        system: sysMsgs.map(m => m.content).join("\n") || undefined,
        messages: userMsgs,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          sendChunk(event.delta.text);
        }
      }
      sendDone();
      return;
    }

    // OpenAI-compatible streaming (GPT, DeepSeek, Grok, Mistral, Groq)
    const providerMap: Record<string, { baseUrl: string; keyEnv: string }> = {
      openai:   { baseUrl: "https://api.openai.com/v1",       keyEnv: "OPENAI_API_KEY" },
      deepseek: { baseUrl: "https://api.deepseek.com/v1",     keyEnv: "DEEPSEEK_API_KEY" },
      grok:     { baseUrl: "https://api.x.ai/v1",             keyEnv: "XAI_API_KEY" },
      mistral:  { baseUrl: "https://api.mistral.ai/v1",       keyEnv: "MISTRAL_API_KEY" },
      groq:     { baseUrl: "https://api.groq.com/openai/v1",  keyEnv: "GROQ_API_KEY" },
    };

    if (model.provider in providerMap) {
      const cfg = providerMap[model.provider];
      const apiKey = process.env[cfg.keyEnv] ?? "";
      const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: model.apiModel, messages, stream: true, max_tokens: 4096 }),
      });
      if (!resp.ok || !resp.body) throw new Error(`AMR stream error ${resp.status}`);
      const reader = resp.body;
      for await (const chunk of reader) {
        const text = chunk.toString();
        const lines = text.split("\n").filter((l: string) => l.startsWith("data: "));
        for (const line of lines) {
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") { sendDone(); return; }
          try {
            const parsed = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }> };
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) sendChunk(content);
          } catch { /* skip malformed chunks */ }
        }
      }
      sendDone();
      return;
    }

    // Gemini (non-streaming fallback)
    const text = await callGemini(messages, model.apiModel);
    sendChunk(text);
    sendDone();
  } catch (err) {
    logger.error({ err, modelId }, "AMR stream failed");
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildMessages(system: string, userPrompt: string): Array<{ role: string; content: string }> {
  return [
    { role: "system", content: system },
    { role: "user",   content: userPrompt },
  ];
}

export function getAvailableModels(): AMRModel[] {
  const available: AMRModel[] = [];
  for (const m of AMR_MODELS) {
    const keyMap: Record<string, string> = {
      claude:   "ANTHROPIC_API_KEY",
      openai:   "OPENAI_API_KEY",
      gemini:   "GEMINI_API_KEY",
      deepseek: "DEEPSEEK_API_KEY",
      grok:     "XAI_API_KEY",
      mistral:  "MISTRAL_API_KEY",
      groq:     "GROQ_API_KEY",
    };
    const envKey = keyMap[m.provider];
    if (process.env[envKey]) available.push(m);
  }
  return available;
}
