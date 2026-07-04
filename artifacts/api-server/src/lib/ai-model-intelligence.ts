/**
 * AI Model Intelligence System (AMIS)
 * ────────────────────────────────────────────────────────────────────────────
 * Investiga, descubre y mantiene actualizado el catálogo de modelos IA de
 * todos los proveedores integrados en la plataforma.
 *
 * Principios de diseño:
 *  • SIN hardcoding — el catálogo vive en DB y se auto-actualiza
 *  • Multi-proveedor — Replicate, OpenAI, Gemini, ElevenLabs, xAI, Freepik,
 *    Runway, Anthropic, y cualquier nuevo proveedor que se agregue
 *  • Clasificación inteligente — economy→balanced→quality por tarea
 *  • Gemini Search — detecta nuevos modelos antes de que lleguen a las APIs
 *  • Routing dinámico — getBestModelForTask() siempre devuelve el óptimo
 *
 * Tablas DB:
 *  ai_model_catalog   — catálogo activo de modelos
 *  ai_model_updates   — log de cambios descubiertos
 *  ai_routing_rules   — reglas task→model por budget
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { askGeminiWithSearch } from "./gemini.js";
import { logger } from "./logger.js";

// ─── DB MIGRATION ─────────────────────────────────────────────────────────────

let migrated = false;
export async function ensureAmisMigration(): Promise<void> {
  if (migrated) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_model_catalog (
      id                SERIAL PRIMARY KEY,
      model_key         VARCHAR(150) UNIQUE NOT NULL,
      provider          VARCHAR(80)  NOT NULL,
      provider_model_id VARCHAR(300),
      category          VARCHAR(50)  NOT NULL,
      subcategory       VARCHAR(80),
      display_name      VARCHAR(300),
      description       TEXT,
      cost_per_unit     DECIMAL(12,8) DEFAULT 0,
      cost_unit         VARCHAR(60)  DEFAULT 'per_request',
      quality_score     SMALLINT     DEFAULT 5,
      speed_score       SMALLINT     DEFAULT 5,
      economy_score     SMALLINT     DEFAULT 5,
      best_for          TEXT[]       DEFAULT '{}',
      capabilities      JSONB        DEFAULT '[]',
      aspect_ratios     TEXT[]       DEFAULT '{}',
      max_resolution    VARCHAR(50),
      is_active         BOOLEAN      DEFAULT true,
      is_deprecated     BOOLEAN      DEFAULT false,
      auto_discovered   BOOLEAN      DEFAULT false,
      last_verified     TIMESTAMPTZ  DEFAULT NOW(),
      created_at        TIMESTAMPTZ  DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_model_updates (
      id            SERIAL PRIMARY KEY,
      discovered_at TIMESTAMPTZ  DEFAULT NOW(),
      provider      VARCHAR(80),
      model_key     VARCHAR(150),
      change_type   VARCHAR(60),
      old_value     JSONB,
      new_value     JSONB,
      source        VARCHAR(200),
      applied       BOOLEAN      DEFAULT false,
      notes         TEXT
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_routing_rules (
      id               SERIAL PRIMARY KEY,
      task_type        VARCHAR(120) NOT NULL,
      budget           VARCHAR(20)  NOT NULL DEFAULT 'balanced',
      model_key        VARCHAR(150) NOT NULL,
      priority         SMALLINT     DEFAULT 0,
      fallback_model   VARCHAR(150),
      is_active        BOOLEAN      DEFAULT true,
      notes            TEXT,
      updated_at       TIMESTAMPTZ  DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ai_routing_rules_task_budget_idx
      ON ai_routing_rules (task_type, budget, priority)
  `);
  migrated = true;
  await seedInitialCatalog();
  await seedInitialRoutingRules();
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────

export interface CatalogModel {
  model_key: string;
  provider: string;
  provider_model_id?: string;
  category: string;
  subcategory?: string;
  display_name: string;
  description?: string;
  cost_per_unit?: number;
  cost_unit?: string;
  quality_score?: number;
  speed_score?: number;
  economy_score?: number;
  best_for?: string[];
  capabilities?: string[];
  aspect_ratios?: string[];
  max_resolution?: string;
  is_active?: boolean;
}

export interface ModelUpdate {
  provider: string;
  model_key: string;
  change_type: "new_model" | "price_change" | "deprecated" | "new_capability" | "speed_change";
  old_value?: Record<string, unknown>;
  new_value: Record<string, unknown>;
  source: string;
  notes?: string;
}

export interface RoutingResult {
  model_key: string;
  provider: string;
  display_name: string;
  cost_tier: string;
  fallback?: string;
  reason: string;
}

// ─── SEED CATÁLOGO INICIAL ────────────────────────────────────────────────────

async function seedInitialCatalog(): Promise<void> {
  const models: CatalogModel[] = [
    // ── IMAGE · economy ──
    { model_key: "freepik-mystic",         provider: "freepik",          category: "image", subcategory: "t2i",    display_name: "Freepik Mystic",              cost_per_unit: 0.002, cost_unit: "per_image",   quality_score: 6,  speed_score: 8, economy_score: 9, best_for: ["social_media","marketing","fast_concepts"],           capabilities: ["t2i","style-control","aspect-ratio"] },
    { model_key: "flux-schnell",           provider: "replicate",        category: "image", subcategory: "t2i",    display_name: "Flux Schnell",                cost_per_unit: 0.003, cost_unit: "per_image",   quality_score: 6,  speed_score: 9, economy_score: 9, best_for: ["rapid_iteration","prototyping"],                       capabilities: ["t2i","fast"] },
    { model_key: "freepik-bg-removal",     provider: "freepik",          category: "edit",  subcategory: "remove-bg", display_name: "Freepik BG Removal",       cost_per_unit: 0.001, cost_unit: "per_image",   quality_score: 7,  speed_score: 9, economy_score: 10,best_for: ["product_photography","ecommerce"],                      capabilities: ["background-removal","transparent-png"] },
    { model_key: "freepik-recolor",        provider: "freepik",          category: "edit",  subcategory: "recolor",display_name: "Freepik Recolor",             cost_per_unit: 0.002, cost_unit: "per_image",   quality_score: 7,  speed_score: 8, economy_score: 9, best_for: ["product_variants","color_testing"],                    capabilities: ["recolor","color-palette"] },
    { model_key: "freepik-upscaler",       provider: "freepik",          category: "upscale",subcategory:"4x",     display_name: "Freepik AI Upscaler 4×",     cost_per_unit: 0.003, cost_unit: "per_image",   quality_score: 7,  speed_score: 8, economy_score: 9, best_for: ["image_enhancement","print_quality"],                   capabilities: ["upscale-4x"] },
    { model_key: "freepik-expand",         provider: "freepik",          category: "edit",  subcategory: "outpaint",display_name: "Freepik Image Expand",       cost_per_unit: 0.004, cost_unit: "per_image",   quality_score: 7,  speed_score: 7, economy_score: 8, best_for: ["banner_creation","aspect_ratio_change"],               capabilities: ["outpainting","expand"] },
    // ── IMAGE · balanced ──
    { model_key: "flux-1.1-pro",           provider: "replicate",        category: "image", subcategory: "t2i",    display_name: "Flux 1.1 Pro",                cost_per_unit: 0.04,  cost_unit: "per_image",   quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["product_photography","marketing_campaigns"],           capabilities: ["t2i","reference-image"], aspect_ratios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3","4:5","5:4","21:9"] },
    { model_key: "freepik-i2i",            provider: "freepik",          category: "image", subcategory: "i2i",    display_name: "Freepik Image to Image",      cost_per_unit: 0.005, cost_unit: "per_image",   quality_score: 7,  speed_score: 7, economy_score: 8, best_for: ["style_transfer","concept_iteration"],                  capabilities: ["i2i","strength-control"] },
    { model_key: "ideogram-v3",            provider: "replicate",        category: "image", subcategory: "t2i",    display_name: "Ideogram v3",                 cost_per_unit: 0.08,  cost_unit: "per_image",   quality_score: 8,  speed_score: 6, economy_score: 5, best_for: ["text_in_images","typography","logos"],                 capabilities: ["t2i","text-rendering"], aspect_ratios: ["1:1","16:9","9:16","4:3","3:4"] },
    { model_key: "recraft-v4",             provider: "replicate",        category: "image", subcategory: "t2i",    display_name: "Recraft v4",                  cost_per_unit: 0.04,  cost_unit: "per_image",   quality_score: 9,  speed_score: 6, economy_score: 5, best_for: ["brand_assets","commercial","illustration"],            capabilities: ["t2i","vector","brand"], aspect_ratios: ["1:1","16:9","9:16","4:3","3:4"] },
    { model_key: "freepik-flux-dev",       provider: "freepik",          category: "image", subcategory: "t2i",    display_name: "Flux Dev via Freepik",        cost_per_unit: 0.025, cost_unit: "per_image",   quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["creative_concepts","detailed_scenes"],                 capabilities: ["t2i","detailed"] },
    // ── IMAGE · quality ──
    { model_key: "flux-1.1-pro-ultra",     provider: "replicate",        category: "image", subcategory: "t2i",    display_name: "Flux 1.1 Pro Ultra",          cost_per_unit: 0.06,  cost_unit: "per_image",   quality_score: 10, speed_score: 5, economy_score: 4, best_for: ["hero_images","advertising","ultra_quality"],           capabilities: ["t2i","ultra-quality"], aspect_ratios: ["1:1","16:9","9:16","4:3","3:4","3:2","2:3","21:9"] },
    { model_key: "gpt-image-2",            provider: "openai",           category: "image", subcategory: "t2i",    display_name: "GPT Image 2 (DALL-E 3+)",     cost_per_unit: 0.211, cost_unit: "per_image",   quality_score: 10, speed_score: 5, economy_score: 2, best_for: ["creative_direction","unique_concepts"],                capabilities: ["t2i","editing","inpainting"] },
    { model_key: "freepik-virtual-model",  provider: "freepik",          category: "image", subcategory: "avatar", display_name: "Freepik Virtual Fashion Model",cost_per_unit: 0.02,  cost_unit: "per_image",   quality_score: 8,  speed_score: 6, economy_score: 7, best_for: ["fashion","virtual_tryon","apparel"],                    capabilities: ["virtual-tryon","fashion","avatar","garment-swap"] },
    // ── VIDEO · economy ──
    { model_key: "wan-2.5-t2v",            provider: "replicate",        category: "video", subcategory: "t2v",    display_name: "Wan 2.5 T2V",                 cost_per_unit: 0.02,  cost_unit: "per_second",  quality_score: 6,  speed_score: 8, economy_score: 9, best_for: ["rapid_video","concept_video"],                          capabilities: ["t2v"] },
    { model_key: "seedance-1-lite",        provider: "replicate",        category: "video", subcategory: "t2v",    display_name: "Seedance 1 Lite",             cost_per_unit: 0.03,  cost_unit: "per_second",  quality_score: 7,  speed_score: 7, economy_score: 8, best_for: ["social_video","quick_ads"],                            capabilities: ["t2v","i2v"] },
    // ── VIDEO · balanced ──
    { model_key: "kling-v3.0-turbo",       provider: "replicate",        category: "video", subcategory: "t2v",    display_name: "Kling v3.0 Turbo",            cost_per_unit: 0.04,  cost_unit: "per_second",  quality_score: 8,  speed_score: 8, economy_score: 6, best_for: ["marketing_video","product_showcase"],                  capabilities: ["t2v","i2v","fast"] },
    { model_key: "freepik-t2v-kling",      provider: "freepik",          category: "video", subcategory: "t2v",    display_name: "Kling vía Freepik (T2V)",     cost_per_unit: 0.05,  cost_unit: "per_second",  quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["creative_video","character_ref"],                      capabilities: ["t2v","kling","character-reference","subject-reference"] },
    { model_key: "freepik-i2v-kling",      provider: "freepik",          category: "video", subcategory: "i2v",    display_name: "Kling vía Freepik (I2V)",     cost_per_unit: 0.05,  cost_unit: "per_second",  quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["product_animation","image_animate"],                   capabilities: ["i2v","kling","character-swap"] },
    { model_key: "freepik-t2v-hailuo",     provider: "freepik",          category: "video", subcategory: "t2v",    display_name: "Hailuo vía Freepik (T2V)",    cost_per_unit: 0.05,  cost_unit: "per_second",  quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["cinematic_video","storytelling"],                      capabilities: ["t2v","hailuo","minimax"] },
    { model_key: "freepik-i2v-hailuo",     provider: "freepik",          category: "video", subcategory: "i2v",    display_name: "Hailuo vía Freepik (I2V)",    cost_per_unit: 0.05,  cost_unit: "per_second",  quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["cinematic_animation","image_to_video"],                 capabilities: ["i2v","hailuo"] },
    // ── VIDEO · quality ──
    { model_key: "kling-v3.0-master",      provider: "replicate",        category: "video", subcategory: "t2v",    display_name: "Kling v3.0 Master",           cost_per_unit: 0.07,  cost_unit: "per_second",  quality_score: 10, speed_score: 5, economy_score: 3, best_for: ["premium_ads","film_quality"],                          capabilities: ["t2v","i2v","ultra-quality"] },
    { model_key: "veo-3",                  provider: "gemini",           category: "video", subcategory: "t2v",    display_name: "Veo 3 (Google)",              cost_per_unit: 0.10,  cost_unit: "per_second",  quality_score: 10, speed_score: 4, economy_score: 3, best_for: ["cinematic","photorealistic_video"],                    capabilities: ["t2v","audio","photorealistic"] },
    { model_key: "veo-4",                  provider: "gemini",           category: "video", subcategory: "t2v",    display_name: "Veo 4 (Google)",              cost_per_unit: 0.15,  cost_unit: "per_second",  quality_score: 10, speed_score: 4, economy_score: 2, best_for: ["premium_production","broadcast"],                      capabilities: ["t2v","audio","8k","ultra-photorealistic"] },
    // ── AUDIO / TTS ──
    { model_key: "eleven_flash_v2_5",      provider: "elevenlabs",       category: "audio", subcategory: "tts",    display_name: "ElevenLabs Flash v2.5",       cost_per_unit: 0.0001,cost_unit: "per_char",    quality_score: 7,  speed_score: 10,economy_score: 10,best_for: ["quick_tts","bulk_narration"],                           capabilities: ["tts","low-latency","streaming"] },
    { model_key: "eleven_v3",              provider: "elevenlabs",       category: "audio", subcategory: "tts",    display_name: "ElevenLabs v3",               cost_per_unit: 0.0003,cost_unit: "per_char",    quality_score: 10, speed_score: 7, economy_score: 7, best_for: ["professional_voiceover","multilingual_tts"],           capabilities: ["tts","74-languages","highest-quality"] },
    // ── TEXT / LLM ──
    { model_key: "claude-haiku",           provider: "anthropic",        category: "text",  subcategory: "chat",   display_name: "Claude Haiku 4.5",            cost_per_unit: 0.001, cost_unit: "per_1k_tokens",quality_score: 7, speed_score: 10,economy_score: 10,best_for: ["quick_tasks","classification","data_extraction"],      capabilities: ["chat","fast","json","tools"] },
    { model_key: "claude-sonnet",          provider: "anthropic",        category: "text",  subcategory: "chat",   display_name: "Claude Sonnet 4.6",           cost_per_unit: 0.015, cost_unit: "per_1k_tokens",quality_score: 9, speed_score: 8, economy_score: 6, best_for: ["complex_analysis","content_creation","coding"],        capabilities: ["chat","reasoning","tools","vision"] },
    { model_key: "claude-opus",            provider: "anthropic",        category: "text",  subcategory: "chat",   display_name: "Claude Opus 4.8",             cost_per_unit: 0.075, cost_unit: "per_1k_tokens",quality_score: 10,speed_score: 5, economy_score: 3, best_for: ["research","complex_strategy","expert_analysis"],        capabilities: ["chat","extended-thinking","frontier"] },
    { model_key: "gemini-fast",            provider: "google",           category: "text",  subcategory: "chat",   display_name: "Gemini 3.5 Flash",            cost_per_unit: 0.0005,cost_unit: "per_1k_tokens",quality_score: 7, speed_score: 10,economy_score: 10,best_for: ["quick_search","grounding","real_time"],                 capabilities: ["chat","search","grounding","vision","fast"] },
    { model_key: "gemini-smart",           provider: "google",           category: "text",  subcategory: "chat",   display_name: "Gemini 3.1 Pro",              cost_per_unit: 0.02,  cost_unit: "per_1k_tokens",quality_score: 9, speed_score: 7, economy_score: 5, best_for: ["multimodal","document_analysis","long_context"],        capabilities: ["chat","vision","search","2M-context"] },
    // ── 3D ──
    { model_key: "meshy-t2t",             provider: "meshy",            category: "3d",    subcategory: "t2t",    display_name: "Meshy Text to 3D",           cost_per_unit: 0.1,   cost_unit: "per_model",   quality_score: 8,  speed_score: 7, economy_score: 6, best_for: ["3d_product","game_asset"],                             capabilities: ["text-to-3d","animation","glb","fbx"] },
    { model_key: "tripo3d",               provider: "tripo",            category: "3d",    subcategory: "t2t",    display_name: "Tripo3D",                    cost_per_unit: 0.08,  cost_unit: "per_model",   quality_score: 9,  speed_score: 7, economy_score: 7, best_for: ["high_quality_3d","product_visualization"],            capabilities: ["text-to-3d","image-to-3d","rigging","animation","glb"] },
  ];

  for (const m of models) {
    await db.execute(sql`
      INSERT INTO ai_model_catalog (
        model_key, provider, provider_model_id, category, subcategory,
        display_name, description, cost_per_unit, cost_unit,
        quality_score, speed_score, economy_score,
        best_for, capabilities, aspect_ratios, max_resolution, auto_discovered
      ) VALUES (
        ${m.model_key}, ${m.provider}, ${m.provider_model_id ?? null}, ${m.category}, ${m.subcategory ?? null},
        ${m.display_name}, ${m.description ?? null}, ${m.cost_per_unit ?? 0}, ${m.cost_unit ?? "per_request"},
        ${m.quality_score ?? 5}, ${m.speed_score ?? 5}, ${m.economy_score ?? 5},
        ${`{${(m.best_for ?? []).join(",")}}`}, ${JSON.stringify(m.capabilities ?? [])}, ${`{${(m.aspect_ratios ?? []).join(",")}}`}, ${m.max_resolution ?? null},
        false
      )
      ON CONFLICT (model_key) DO NOTHING
    `);
  }
}

async function seedInitialRoutingRules(): Promise<void> {
  const rules: Array<{ task: string; budget: string; model: string; fallback?: string; priority?: number }> = [
    // product_photography
    { task: "product_photography", budget: "economy",  model: "freepik-mystic",       fallback: "flux-1.1-pro" },
    { task: "product_photography", budget: "balanced", model: "flux-1.1-pro",         fallback: "freepik-mystic" },
    { task: "product_photography", budget: "quality",  model: "flux-1.1-pro-ultra",   fallback: "gpt-image-2" },
    // image_upscaling
    { task: "image_upscaling",     budget: "economy",  model: "freepik-upscaler",     fallback: "freepik-upscaler" },
    { task: "image_upscaling",     budget: "balanced", model: "freepik-upscaler" },
    { task: "image_upscaling",     budget: "quality",  model: "freepik-upscaler" },
    // background_removal
    { task: "background_removal",  budget: "economy",  model: "freepik-bg-removal" },
    { task: "background_removal",  budget: "balanced", model: "freepik-bg-removal" },
    { task: "background_removal",  budget: "quality",  model: "freepik-bg-removal" },
    // image_editing
    { task: "image_editing",       budget: "economy",  model: "freepik-i2i",          fallback: "freepik-recolor" },
    { task: "image_editing",       budget: "balanced", model: "freepik-i2i",          fallback: "flux-1.1-pro" },
    { task: "image_editing",       budget: "quality",  model: "gpt-image-2",          fallback: "freepik-i2i" },
    // recolor
    { task: "recolor",             budget: "economy",  model: "freepik-recolor" },
    { task: "recolor",             budget: "balanced", model: "freepik-recolor",      fallback: "gpt-image-2" },
    { task: "recolor",             budget: "quality",  model: "gpt-image-2",          fallback: "freepik-recolor" },
    // expand_image
    { task: "expand_image",        budget: "economy",  model: "freepik-expand" },
    { task: "expand_image",        budget: "balanced", model: "freepik-expand" },
    { task: "expand_image",        budget: "quality",  model: "freepik-expand",       fallback: "gpt-image-2" },
    // logo_design
    { task: "logo_design",         budget: "economy",  model: "freepik-mystic",       fallback: "recraft-v4" },
    { task: "logo_design",         budget: "balanced", model: "ideogram-v3",          fallback: "recraft-v4" },
    { task: "logo_design",         budget: "quality",  model: "recraft-v4",           fallback: "gpt-image-2" },
    // social_media_image
    { task: "social_media_image",  budget: "economy",  model: "freepik-mystic",       fallback: "flux-schnell" },
    { task: "social_media_image",  budget: "balanced", model: "flux-1.1-pro",         fallback: "freepik-mystic" },
    { task: "social_media_image",  budget: "quality",  model: "recraft-v4",           fallback: "flux-1.1-pro-ultra" },
    // fashion / virtual tryon
    { task: "virtual_tryon",       budget: "economy",  model: "freepik-virtual-model" },
    { task: "virtual_tryon",       budget: "balanced", model: "freepik-virtual-model" },
    { task: "virtual_tryon",       budget: "quality",  model: "freepik-virtual-model" },
    // video_generation
    { task: "video_generation",    budget: "economy",  model: "wan-2.5-t2v",          fallback: "seedance-1-lite" },
    { task: "video_generation",    budget: "balanced", model: "kling-v3.0-turbo",     fallback: "freepik-t2v-kling" },
    { task: "video_generation",    budget: "quality",  model: "veo-4",                fallback: "kling-v3.0-master" },
    // image_to_video
    { task: "image_to_video",      budget: "economy",  model: "seedance-1-lite",      fallback: "wan-2.5-t2v" },
    { task: "image_to_video",      budget: "balanced", model: "freepik-i2v-kling",    fallback: "kling-v3.0-turbo" },
    { task: "image_to_video",      budget: "quality",  model: "freepik-i2v-kling",    fallback: "veo-4" },
    // video_with_character
    { task: "video_with_character",budget: "economy",  model: "freepik-t2v-kling",    fallback: "kling-v3.0-turbo" },
    { task: "video_with_character",budget: "balanced", model: "freepik-t2v-kling",    fallback: "kling-v3.0-master" },
    { task: "video_with_character",budget: "quality",  model: "freepik-t2v-kling",    fallback: "veo-4" },
    // text_to_speech
    { task: "text_to_speech",      budget: "economy",  model: "eleven_flash_v2_5",    fallback: "eleven_v3" },
    { task: "text_to_speech",      budget: "balanced", model: "eleven_v3",            fallback: "eleven_flash_v2_5" },
    { task: "text_to_speech",      budget: "quality",  model: "eleven_v3" },
    // chat / text generation
    { task: "chat",                budget: "economy",  model: "claude-haiku",         fallback: "gemini-fast" },
    { task: "chat",                budget: "balanced", model: "claude-sonnet",        fallback: "gemini-smart" },
    { task: "chat",                budget: "quality",  model: "claude-opus",          fallback: "claude-sonnet" },
    // 3D
    { task: "3d_generation",       budget: "economy",  model: "tripo3d",              fallback: "meshy-t2t" },
    { task: "3d_generation",       budget: "balanced", model: "tripo3d" },
    { task: "3d_generation",       budget: "quality",  model: "tripo3d",              fallback: "meshy-t2t" },
  ];

  for (const r of rules) {
    await db.execute(sql`
      INSERT INTO ai_routing_rules (task_type, budget, model_key, priority, fallback_model, is_active)
      VALUES (${r.task}, ${r.budget}, ${r.model}, ${r.priority ?? 0}, ${r.fallback ?? null}, true)
      ON CONFLICT (task_type, budget, priority) DO NOTHING
    `);
  }
}

// ─── INVESTIGACIÓN POR PROVEEDOR ──────────────────────────────────────────────

async function researchReplicateModels(): Promise<CatalogModel[]> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return [];

  const trackedOwners = [
    "black-forest-labs","kwaivgi","minimax","stability-ai","google-deepmind",
    "bytedance","recraft-ai","ideogram-ai","wan-video","seedance",
  ];

  const discovered: CatalogModel[] = [];
  for (const owner of trackedOwners) {
    try {
      const res = await fetch(`https://api.replicate.com/v1/models?owner=${owner}`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!res.ok) continue;
      const data = await res.json() as { results: Array<{ name: string; description?: string; latest_version?: { id: string }; url: string }> };
      for (const m of data.results ?? []) {
        const key = `${owner}/${m.name}`.toLowerCase().replace(/[^a-z0-9.\-_/]/g, "-");
        discovered.push({
          model_key:         key,
          provider:          "replicate",
          provider_model_id: `${owner}/${m.name}`,
          category:          inferCategory(m.name, m.description ?? ""),
          display_name:      m.name,
          description:       m.description,
          auto_discovered:   true,
        } as CatalogModel & { auto_discovered: boolean });
      }
    } catch {
      // proveedores con timeout o rate limit — continuar
    }
  }
  return discovered;
}

async function researchOpenAIModels(): Promise<CatalogModel[]> {
  const key = process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!key) return [];
  try {
    const base = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com";
    const res  = await fetch(`${base}/v1/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return [];
    const data = await res.json() as { data: Array<{ id: string; created?: number }> };
    return data.data
      .filter(m => m.id.startsWith("gpt-") || m.id.startsWith("o") || m.id.includes("image"))
      .map(m => ({
        model_key:    m.id,
        provider:     "openai",
        category:     m.id.includes("image") ? "image" : "text",
        display_name: m.id,
      }));
  } catch { return []; }
}

async function researchGeminiModels(): Promise<CatalogModel[]> {
  const key = process.env.GEMINI_API_KEY ?? process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!key) return [];
  try {
    const base = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
    const res  = await fetch(`${base}/v1beta/models?key=${key}`);
    if (!res.ok) return [];
    const data = await res.json() as { models: Array<{ name: string; displayName?: string; description?: string }> };
    return (data.models ?? []).map(m => ({
      model_key:    m.name.replace("models/", "gemini-"),
      provider:     "google",
      category:     inferCategory(m.name, m.description ?? ""),
      display_name: m.displayName ?? m.name,
      description:  m.description,
    }));
  } catch { return []; }
}

async function researchElevenLabsModels(): Promise<CatalogModel[]> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/models", {
      headers: { "xi-api-key": key },
    });
    if (!res.ok) return [];
    const data = await res.json() as Array<{ model_id: string; name: string; description?: string; can_do_text_to_speech?: boolean }>;
    return data
      .filter(m => m.can_do_text_to_speech)
      .map(m => ({
        model_key:    `eleven_${m.model_id}`.replace(/[^a-z0-9_]/gi, "_"),
        provider:     "elevenlabs",
        category:     "audio",
        subcategory:  "tts",
        display_name: m.name,
        description:  m.description,
      }));
  } catch { return []; }
}

async function researchXAIModels(): Promise<CatalogModel[]> {
  const key = process.env.XAI_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://api.x.ai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { data: Array<{ id: string; created?: number }> };
    return (data.data ?? []).map(m => ({
      model_key:    `xai-${m.id}`,
      provider:     "xai",
      category:     m.id.includes("vision") || m.id.includes("aurora") || m.id.includes("image") ? "image" : "text",
      display_name: m.id,
    }));
  } catch { return []; }
}

async function researchFreepikEngines(): Promise<CatalogModel[]> {
  if (!process.env.FREEPIK_API_KEY) return [];
  const { getFreepikEngines } = await import("./freepik.js");
  const engines = await getFreepikEngines();
  return engines.map(e => ({
    model_key:    e.id,
    provider:     "freepik",
    category:     e.category as string,
    display_name: e.name,
    capabilities: e.capabilities,
  }));
}

// ─── BÚSQUEDA DE NOTICIAS CON GEMINI SEARCH ──────────────────────────────────

async function searchNewModelAnnouncements(): Promise<Array<{ model: string; provider: string; summary: string }>> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const prompt = `Busca lanzamientos y actualizaciones de modelos de IA en los últimos 7 días (hoy es ${today}).
Devuelve SOLO modelos nuevos o actualizados significativamente.
Formato JSON array: [{"model":"nombre","provider":"empresa","summary":"qué hay de nuevo","category":"image|video|audio|text|3d"}]
Enfócate en: Replicate, OpenAI, Anthropic, Google, ElevenLabs, xAI, Runway, Freepik, Kling, Hailuo, Stability AI, Black Forest Labs.
Devuelve solo el JSON, sin markdown.`;

    const result = await askGeminiWithSearch(prompt, "Eres un experto en modelos de inteligencia artificial. Responde siempre en JSON válido.");
    const text = result?.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as Array<{ model: string; provider: string; summary: string }>;
  } catch {
    return [];
  }
}

// ─── COMPARACIÓN Y ACTUALIZACIÓN ─────────────────────────────────────────────

async function getExistingCatalog(): Promise<Set<string>> {
  const rows = await db.execute(sql`SELECT model_key FROM ai_model_catalog WHERE is_active = true`);
  return new Set((rows.rows as Array<{ model_key: string }>).map(r => r.model_key));
}

async function upsertModel(m: CatalogModel & { auto_discovered?: boolean }): Promise<void> {
  await db.execute(sql`
    INSERT INTO ai_model_catalog (
      model_key, provider, provider_model_id, category, subcategory,
      display_name, description, cost_per_unit, cost_unit,
      quality_score, speed_score, economy_score,
      best_for, capabilities, aspect_ratios, auto_discovered, last_verified
    ) VALUES (
      ${m.model_key}, ${m.provider}, ${m.provider_model_id ?? null}, ${m.category}, ${m.subcategory ?? null},
      ${m.display_name}, ${m.description ?? null}, ${m.cost_per_unit ?? 0}, ${m.cost_unit ?? "per_request"},
      ${m.quality_score ?? 5}, ${m.speed_score ?? 5}, ${m.economy_score ?? 5},
      ${m.best_for ?? []}, ${JSON.stringify(m.capabilities ?? [])}, ${m.aspect_ratios ?? []},
      ${m.auto_discovered ?? true}, NOW()
    )
    ON CONFLICT (model_key) DO UPDATE SET
      last_verified   = NOW(),
      updated_at      = NOW(),
      is_deprecated   = false,
      is_active       = true,
      display_name    = EXCLUDED.display_name,
      description     = COALESCE(EXCLUDED.description, ai_model_catalog.description)
  `);
}

async function logUpdate(update: ModelUpdate): Promise<void> {
  await db.execute(sql`
    INSERT INTO ai_model_updates (provider, model_key, change_type, old_value, new_value, source, notes)
    VALUES (
      ${update.provider}, ${update.model_key}, ${update.change_type},
      ${JSON.stringify(update.old_value ?? {})},
      ${JSON.stringify(update.new_value)},
      ${update.source}, ${update.notes ?? null}
    )
  `);
}

// ─── INFERENCIA DE CATEGORÍA ──────────────────────────────────────────────────

function inferCategory(name: string, description: string): string {
  const txt = `${name} ${description}`.toLowerCase();
  if (/video|film|movie|animate|wan|kling|hailuo|seedance|veo|runway/.test(txt))  return "video";
  if (/audio|tts|voice|speech|music|sound|elevenlabs/.test(txt))                  return "audio";
  if (/3d|mesh|tripo|model|glb|fbx|sculpt/.test(txt))                             return "3d";
  if (/embed|vector|retrieval|search/.test(txt))                                   return "embedding";
  if (/image|photo|picture|flux|stable|dall|aurora|recraft|ideogram|mystic/.test(txt)) return "image";
  return "text";
}

// ─── JOB PRINCIPAL: INVESTIGACIÓN DE MODELOS ─────────────────────────────────

export interface ResearchSummary {
  started_at: string;
  finished_at: string;
  providers_checked: string[];
  new_models: number;
  updated_models: number;
  news_items: number;
  catalog_total: number;
  errors: string[];
}

export async function runAiModelResearch(): Promise<ResearchSummary> {
  const started_at = new Date().toISOString();
  const errors: string[] = [];
  let new_models = 0;
  let updated_models = 0;

  logger.info({ job: "ai-model-research" }, "🤖 Iniciando investigación de modelos IA…");
  await ensureAmisMigration();

  const existing = await getExistingCatalog();

  // Investigar todos los proveedores en paralelo
  const [replicateModels, openaiModels, geminiModels, elevenModels, xaiModels, freepikModels] =
    await Promise.allSettled([
      researchReplicateModels(),
      researchOpenAIModels(),
      researchGeminiModels(),
      researchElevenLabsModels(),
      researchXAIModels(),
      researchFreepikEngines(),
    ]).then(results => results.map(r => r.status === "fulfilled" ? r.value : [] as CatalogModel[]));

  const allDiscovered = [
    ...replicateModels, ...openaiModels, ...geminiModels,
    ...elevenModels, ...xaiModels, ...freepikModels,
  ];

  // Buscar noticias de nuevos modelos
  const newsItems = await searchNewModelAnnouncements();

  // Registrar modelos de noticias como updates pendientes
  for (const news of newsItems) {
    await logUpdate({
      provider:   news.provider,
      model_key:  news.model.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-"),
      change_type: "new_model",
      new_value:  { ...news },
      source:     "gemini-search",
      notes:      news.summary,
    });
  }

  // Procesar modelos descubiertos
  for (const m of allDiscovered) {
    try {
      const isNew = !existing.has(m.model_key);
      await upsertModel(m as CatalogModel & { auto_discovered: boolean });
      if (isNew) {
        new_models++;
        await logUpdate({
          provider:   m.provider,
          model_key:  m.model_key,
          change_type: "new_model",
          new_value:  { ...m },
          source:     `${m.provider}-api`,
          applied:    true,
        } as ModelUpdate & { applied: boolean });
      } else {
        updated_models++;
      }
    } catch (err: unknown) {
      errors.push(`${m.model_key}: ${(err as Error).message}`);
    }
  }

  // Obtener total del catálogo
  const totalRow = await db.execute(sql`SELECT COUNT(*) as cnt FROM ai_model_catalog WHERE is_active = true`);
  const catalog_total = Number((totalRow.rows[0] as { cnt: string }).cnt ?? 0);

  const summary: ResearchSummary = {
    started_at,
    finished_at: new Date().toISOString(),
    providers_checked: ["replicate","openai","gemini","elevenlabs","xai","freepik"],
    new_models,
    updated_models,
    news_items: newsItems.length,
    catalog_total,
    errors: errors.slice(0, 10),
  };

  logger.info({ job: "ai-model-research", summary }, `✅ Investigación completa: ${new_models} nuevos, ${catalog_total} total`);
  return summary;
}

// ─── SMART ROUTING ────────────────────────────────────────────────────────────

export async function getBestModelForTask(
  taskType: string,
  budget: "economy" | "balanced" | "quality" = "balanced",
): Promise<RoutingResult[]> {
  await ensureAmisMigration();

  const rows = await db.execute(sql`
    SELECT r.model_key, r.fallback_model, r.priority, r.notes,
           c.provider, c.display_name, c.cost_per_unit, c.cost_unit,
           c.quality_score, c.speed_score, c.economy_score
    FROM   ai_routing_rules r
    JOIN   ai_model_catalog  c ON c.model_key = r.model_key AND c.is_active = true AND NOT c.is_deprecated
    WHERE  r.task_type = ${taskType}
      AND  r.budget    = ${budget}
      AND  r.is_active = true
    ORDER BY r.priority DESC
    LIMIT 3
  `);

  if (!rows.rows.length) {
    // Fallback genérico basado en categoría implícita del task
    const fallbackBudget = budget === "economy" ? "economy" : budget === "quality" ? "quality" : "balanced";
    const fallbackRows = await db.execute(sql`
      SELECT model_key, provider, display_name, cost_per_unit, cost_unit,
             quality_score, speed_score, economy_score
      FROM   ai_model_catalog
      WHERE  is_active = true AND NOT is_deprecated
        AND  ${fallbackBudget} = CASE
               WHEN economy_score >= 8 THEN 'economy'
               WHEN quality_score >= 9 THEN 'quality'
               ELSE 'balanced'
             END
      ORDER BY CASE ${fallbackBudget}
               WHEN 'economy' THEN economy_score
               WHEN 'quality' THEN quality_score
               ELSE (quality_score + speed_score) / 2
             END DESC
      LIMIT 3
    `);
    return (fallbackRows.rows as Array<Record<string, unknown>>).map(r => ({
      model_key:    String(r.model_key),
      provider:     String(r.provider),
      display_name: String(r.display_name),
      cost_tier:    budget,
      reason:       `Fallback genérico para task desconocido: ${taskType}`,
    }));
  }

  return (rows.rows as Array<Record<string, unknown>>).map(r => ({
    model_key:    String(r.model_key),
    provider:     String(r.provider),
    display_name: String(r.display_name),
    cost_tier:    budget,
    fallback:     r.fallback_model ? String(r.fallback_model) : undefined,
    reason:       `Routing rule: ${taskType} · ${budget}`,
  }));
}

// ─── QUERIES DE CATÁLOGO ──────────────────────────────────────────────────────

export async function getCatalogModels(filters: {
  category?: string;
  provider?: string;
  budget?: "economy" | "balanced" | "quality";
  search?: string;
  limit?: number;
} = {}): Promise<Record<string, unknown>[]> {
  await ensureAmisMigration();

  let q = `
    SELECT model_key, provider, category, subcategory, display_name, description,
           cost_per_unit, cost_unit, quality_score, speed_score, economy_score,
           best_for, capabilities, is_active, is_deprecated, auto_discovered, last_verified
    FROM   ai_model_catalog
    WHERE  is_active = true AND NOT is_deprecated
  `;
  const params: unknown[] = [];
  if (filters.category) { params.push(filters.category); q += ` AND category = $${params.length}`; }
  if (filters.provider) { params.push(filters.provider); q += ` AND provider = $${params.length}`; }
  if (filters.budget === "economy")  q += " AND economy_score >= 7";
  if (filters.budget === "quality")  q += " AND quality_score >= 8";
  if (filters.search)   { params.push(`%${filters.search}%`); q += ` AND (display_name ILIKE $${params.length} OR description ILIKE $${params.length})`; }
  q += " ORDER BY quality_score DESC, speed_score DESC";
  if (filters.limit) { params.push(filters.limit); q += ` LIMIT $${params.length}`; }

  const rows = await db.execute(sql.raw(q, params));
  return rows.rows as Record<string, unknown>[];
}

export async function getRecentUpdates(limit = 50): Promise<Record<string, unknown>[]> {
  await ensureAmisMigration();
  const rows = await db.execute(sql`
    SELECT * FROM ai_model_updates ORDER BY discovered_at DESC LIMIT ${limit}
  `);
  return rows.rows as Record<string, unknown>[];
}

export async function getCatalogStats(): Promise<Record<string, unknown>> {
  await ensureAmisMigration();
  const [total, byCategory, byProvider, recentUpdates] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as cnt FROM ai_model_catalog WHERE is_active=true AND NOT is_deprecated`),
    db.execute(sql`SELECT category, COUNT(*) as cnt FROM ai_model_catalog WHERE is_active=true GROUP BY category ORDER BY cnt DESC`),
    db.execute(sql`SELECT provider, COUNT(*) as cnt FROM ai_model_catalog WHERE is_active=true GROUP BY provider ORDER BY cnt DESC`),
    db.execute(sql`SELECT COUNT(*) as cnt FROM ai_model_updates WHERE discovered_at > NOW() - INTERVAL '24 hours'`),
  ]);
  return {
    total:         Number((total.rows[0] as { cnt: string }).cnt),
    by_category:   byCategory.rows,
    by_provider:   byProvider.rows,
    recent_updates: Number((recentUpdates.rows[0] as { cnt: string }).cnt),
    last_research: new Date().toISOString(),
  };
}

export async function updateRoutingRule(opts: {
  task_type: string;
  budget: string;
  model_key: string;
  fallback_model?: string;
  priority?: number;
}): Promise<void> {
  await ensureAmisMigration();
  await db.execute(sql`
    INSERT INTO ai_routing_rules (task_type, budget, model_key, priority, fallback_model, is_active, updated_at)
    VALUES (${opts.task_type}, ${opts.budget}, ${opts.model_key}, ${opts.priority ?? 0}, ${opts.fallback_model ?? null}, true, NOW())
    ON CONFLICT (task_type, budget, priority) DO UPDATE SET
      model_key      = EXCLUDED.model_key,
      fallback_model = EXCLUDED.fallback_model,
      is_active      = true,
      updated_at     = NOW()
  `);
}
