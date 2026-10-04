/**
 * Web Designer Engine — Claude AI Web Designer
 * Multi-model HTML page generation with streaming (Claude / Gemini / GPT-4.1)
 * 3-panel: Chat | Live Preview | Code Editor
 */
import type { DnaVars } from "./visme-effects.js";

export const DESIGN_SYSTEM_PROMPT = `You are an expert web designer & 3D developer building pages like claude.ai/design, Apple.com, and award-winning Awwwards sites.

CORE RULES:
- Return ONLY valid HTML starting with <!DOCTYPE html>
- Everything inline: <style> in <head>, <script> before </body>
- Modern, beautiful, award-winning design — CSS variables, flexbox/grid, smooth transitions
- Fully responsive (mobile first: 320px to 1920px)
- Use Google Fonts + CDN libraries as needed for 3D/animation
- Include micro-interactions, hover effects, subtle animations
- Semantic HTML5: header, main, section, article, nav, footer
- Accessible: aria-labels, alt text, WCAG AA color contrast
- Dark mode: both CSS prefers-color-scheme AND a runtime JS toggle button (top-right corner) that saves preference to localStorage
- Always include a smooth preloader (fade-out on window.load) for pages with 3D or heavy assets
- NEVER truncate output — complete HTML from <!DOCTYPE html> to </html>, always

3D EFFECT SELECTION GUIDE — choose the right tech for the page type:
• SaaS / Tech / AI platform     → Three.js BufferGeometry particle field + GSAP ScrollTrigger
• Restaurant / Luxury / Food    → Video scrubbing hero (currentTime sync to scroll, 300vh sticky)
• Product / E-commerce / Phone  → Three.js MeshPhysicalMaterial glass product + OrbitControls
• Portfolio / Artist / Designer → SplitType cinematic text reveal + WebGL displacement shader
• Agency / Branding / Studio    → Custom cursor elastic lag + magnetic buttons + horizontal scroll gallery
• Gaming / Hardware / Esports   → RGB cycling PointLights + UnrealBloomPass + scan-line CSS
• Luxury / Jewelry / Perfume    → MeshPhysicalMaterial transmission glass objects + RectAreaLight
• Real Estate / Hotel / Venue   → Procedural 3D building + click-to-teleport navigation
• Nature / Travel / Landscape   → 5-layer CSS parallax (speeds 0.1x to 0.7x) + JS RAF
• Collectibles / NFT / Art      → Interactive 3D product cards + raycaster hover/click
• Clean / Corporate / Finance   → Scroll-snap glassmorphism + backdrop-filter panels
• Interactive / Fun / Kids      → Canvas 2D physics (gravity + bounce + click-to-add balls)

3D TECH STACK (use as needed):
- Three.js: importmap {"imports":{"three":"https://unpkg.com/three@0.158.0/build/three.module.js"}}
- GSAP: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
- ScrollTrigger: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js
- SplitType: https://unpkg.com/split-type@0.3.4/umd/index.min.js
- Lenis smooth scroll: https://unpkg.com/lenis@1.0.45/dist/lenis.min.js
- EffectComposer/Bloom: https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/
- OrbitControls: https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js

VISME EFFECTS LIBRARY — 594 design patterns available. Use freely.
Categories: 3d_effects · animated_characters · animated_icons · audio_visualization ·
background_effects · celebration_effects · charts · data_viz · flowcharts ·
infographics · interactive_effects · landing_pages · logo_animations · micro_interactions ·
mind_maps · mockups · motion_graphics · overlay_effects · parallax_effects ·
particle_effects · presentations · social_media · text_effects · timelines ·
transition_effects · typography_effects · ui_components · video_effects · web_graphics

30 PRE-BUILT EFFECT SNIPPETS (pure CSS/JS, no extra deps unless noted):
particle_rain · aurora_bg · magnetic_btn · text_reveal_scroll · glass_card ·
neon_glow · tilt_3d_card · gradient_mesh · typing_text · svg_stroke_anim ·
confetti_burst · floating_element · ripple_click · skeleton_loader ·
scroll_progress_bar · count_up · blob_morph · text_scramble · clip_path_reveal ·
cursor_glow_trail · flip_card · marquee_infinite · grid_hover_glow ·
wave_svg_bg · stagger_entrance · gsap_text_split · threejs_particle_sphere ·
parallax_hero · overlay_hover_reveal · color_shift_bg

STYLE GUIDE:
- Typography: display serif (Cormorant Garamond) for headings, Inter/Space Grotesk for body
- Colors: meaningful palette with CSS vars --primary, --bg, --text, --accent
- Spacing: 8px base grid
- Glass: backdrop-filter:blur(20px) saturate(180%), rgba(255,255,255,0.08)

When user provides brand DNA, inject it throughout (colors, fonts, names, CTAs).
When EDITING: return COMPLETE updated HTML.
OUTPUT: Raw HTML only. No markdown. No explanations. Just <!DOCTYPE html>...</html>`;

export interface DesignerTemplate {
  id: string;
  name: string;
  icon: string;
  category: string;
  prompt: string;
}

export const DESIGNER_TEMPLATES: DesignerTemplate[] = [
  { id: "landing_saas", name: "SaaS Landing", icon: "🚀", category: "landing",
    prompt: "Create a modern SaaS landing page with hero section, features grid (3 columns), pricing table (3 tiers), testimonials, and CTA. Dark theme with purple/blue gradient accent. GSAP entrance animations, scroll progress bar, glassmorphism cards." },
  { id: "landing_ecommerce", name: "E-commerce", icon: "🛍️", category: "landing",
    prompt: "Create a product landing page with hero, product showcase grid with hover tilt 3D, features list, social proof section with count-up stats, and buy CTA. Dark luxury aesthetic with gold accents." },
  { id: "landing_agency", name: "Agencia Premium", icon: "✨", category: "landing",
    prompt: "Create a premium creative agency homepage with bold cinematic hero (Three.js particle sphere background), magnetic buttons, horizontal scroll gallery of work, team grid with glass cards, and contact form. Black/gold design, Cormorant Garamond headings." },
  { id: "landing_portfolio", name: "Portfolio", icon: "💼", category: "landing",
    prompt: "Create a personal portfolio with animated hero (text scramble on load), projects grid with overlay hover reveal, skills section with animated progress bars, and contact. Dark minimalist aesthetic with subtle cursor glow trail." },
  { id: "landing_restaurant", name: "Restaurante", icon: "🍽️", category: "landing",
    prompt: "Create an elegant restaurant landing page with full-screen scroll-scrubbing video hero, animated menu section with floating cards, reservation form, chef story with parallax. Warm dark tones, serif headings, aurora background effect." },
  { id: "landing_app", name: "App Móvil", icon: "📱", category: "landing",
    prompt: "Create a mobile app landing with phone mockup 3D (Three.js MeshPhysicalMaterial), features with stagger entrance animations, screenshots carousel, reviews, and download CTAs. Gradient tech feel, glassmorphism panels." },
  { id: "landing_full_pro", name: "Landing Completa", icon: "🌐", category: "landing",
    prompt: "Create a COMPLETE professional landing page: sticky navbar (logo + links + CTA + dark/light toggle), hero (headline + sub + dual CTA + gradient mesh animated background), features (6-card grid with SVG icons), benefits (split layout), testimonials (3 cards with stars), pricing (3 tiers with monthly/annual toggle), FAQ (animated accordion), footer (4 columns + newsletter + social). GSAP ScrollTrigger reveals. Glassmorphism cards. Mobile-first. Preloader." },
  { id: "dashboard_admin", name: "Dashboard Admin", icon: "📊", category: "dashboard",
    prompt: "Create an admin dashboard with sticky sidebar navigation (collapsible), KPI metric cards with trend arrows and count-up animation, line/bar chart placeholders (CSS only), sortable data table, notification bell, user avatar. Dark glassmorphism theme." },
  { id: "3d_particle_hero", name: "Particle Hero 3D", icon: "✨", category: "3d",
    prompt: "Create a stunning Three.js particle field hero page. Import via importmap. Create 8000 particles in a flowing field that responds to mouse movement. Add GSAP text animation for headline. Floating glassmorphism card below hero with stats. Pure black background, brand color particles." },
  { id: "3d_scroll_scrubbing", name: "3D Scroll Scrubbing", icon: "🎬", category: "3d",
    prompt: "Create a premium scroll-driven video scrubbing page using pure JavaScript. As user scrolls, advance video frame-by-frame (video.currentTime = scroll% * video.duration). Use placeholder video from commondatastorage. Sticky container 500vh. Overlay text at scroll milestones. Progress bar. After sticky: 3 glassmorphism feature cards. Pure black background, gold accents." },
  { id: "3d_product_viewer", name: "Visor Producto 3D", icon: "🔮", category: "3d",
    prompt: "Create a product showcase page with Three.js MeshPhysicalMaterial glass object (iridescent sphere/torus). OrbitControls for rotation. RectAreaLight + PointLights with brand colors. Below: feature grid with glass cards. Smooth preloader. GSAP entrance." },
  { id: "form_contact", name: "Contacto", icon: "📬", category: "form",
    prompt: "Create a beautiful contact page with floating-label form, animated map placeholder (CSS gradient), contact info cards with hover effects, FAQ accordion. Clean minimal design with ripple click effects on buttons." },
  { id: "sidebar_docs", name: "Docs / Portal", icon: "📚", category: "app",
    prompt: "Create a documentation portal with: persistent left sidebar (category tree, collapsible, search), sticky topbar (logo + breadcrumb + dark/light toggle), main content (markdown-style article, TOC right), prev/next navigation. Inter font. GSAP fade-in on load." },
  { id: "landing_event", name: "Evento / Conferencia", icon: "🎤", category: "landing",
    prompt: "Create an event/conference landing with countdown timer (JS, to a date 30 days from now), speaker cards with tilt 3D hover, schedule timeline with CSS animations, venue section with parallax, registration CTA with confetti burst on click." },
  { id: "3d_neon_city", name: "Ciudad Neon 3D", icon: "🌆", category: "3d",
    prompt: "Create an immersive Three.js neon cyberpunk city landing page. Imports: importmap three@0.158.0 + EffectComposer + UnrealBloomPass + OrbitControls (all from unpkg three examples/jsm). Generate 200+ buildings procedurally (grid layout, random heights), neon tubes with TubeGeometry, 2000 rain particles, FogExp2. UnrealBloomPass (threshold:0.2, strength:1.5). Camera slow fly-through via CatmullRomCurve3. HTML overlay: scanlines CSS, HUD elements, glitch text on h1, neon buttons. Below 3D: CTA section." },
  { id: "3d_product_glass", name: "Producto Glass 3D", icon: "💎", category: "3d",
    prompt: "Create a luxury 3D product page with 7 transparent glass objects using Three.js MeshPhysicalMaterial. Importmap three@0.158.0. Background: #080810 void. Objects: 2 spheres, 2 torus, 1 icosahedron, 2 boxes — all transmission:0.9-1.0, ior:1.5-1.7, roughness:0. RectAreaLight x2 (purple + gold). Each object unique slow rotation. GSAP ScrollTrigger scatter/reassemble. HTML overlay: huge Cormorant Garamond italic title 10vw. Minimal nav, product description in elegant serif." },
  { id: "3d_exploded_view", name: "Vista Explosión 3D", icon: "🔩", category: "3d",
    prompt: "Create a 3D product exploded view page like Apple M2 chip teardown. Importmap three@0.158.0 + GSAP 3.12.5 + ScrollTrigger. Camera PerspectiveCamera(45). Layers as BoxGeometry components: screen glass (transmission:0.9), display (emissive blue), mainboard (green PCB), battery (dark slab), chassis (aluminum metalness:1). ScrollTrigger 400vh pin scrub:1.4 — layers explode apart 30-70%, reassemble 70-100%. SVG label overlays per mesh. Dark industrial, amber labels, monospace annotations, blueprint grid CSS background." },
  { id: "cinematic_scroll", name: "Cinematic Agency", icon: "🎬", category: "3d",
    prompt: "Create a cinematic agency landing with Codrops-style animations. GSAP 3.12.5 + ScrollTrigger + SplitType (unpkg.com/split-type@0.3.4/umd/index.min.js). Animations: SplitType char-by-char hero, film grain canvas overlay (random noise requestAnimationFrame mix-blend-mode:overlay), clip-path section transitions, parallax hero image, horizontal pinned gallery (4 work items), letter-spacing collapse animation, custom cursor with lerp 0.12 mix-blend-mode:difference. Sections: Hero→About→Work→Process→Contact. Charcoal #0f0f0f, off-white #f0ede8, gold #c9a961, Cormorant Garamond + Inter." },
  { id: "magnetic_agency", name: "Agencia Magnética", icon: "🖋️", category: "3d",
    prompt: "Create an ultra-premium boutique agency website. GSAP 3.12.5 + SplitType. Custom cursor: dot (6px) + circle (40px border) with lerp 0.12, mix-blend-mode:difference on hover, scales 2.5x. Magnetic buttons: mousemove translates toward cursor (factor 0.35), elastic.out(1,0.4) on leave. GSAP hero: SplitType chars y:110%→0, stagger 0.035. Layout: giant display text 3 lines mixed sizes (12vw/7vw/4vw), pinned horizontal gallery 5 case studies, numbered services list 01-06 expands on hover. Black #0a0a0a, off-white #f2f0ec, pure monochrome." },
  { id: "physics_canvas", name: "Física Canvas", icon: "⚽", category: "3d",
    prompt: "Create an interactive physics simulation landing page with Canvas 2D API (no external deps). Ball class: gravity=0.45, wall collisions with energy loss, ball-ball elastic collisions (mass-weighted velocity exchange), max speed 15. 20 initial balls random HSL colors radii 15-35px with radialGradient fill, trail effect (last 5 positions low opacity). Click spawns new ball upward velocity. Full-width 55vh canvas with dark gradient bg. Below: service sections with GSAP reveals. Dark bg #080810, colorful balls, purple theme." },
  { id: "glass_snap", name: "Glass Snap Scroll", icon: "💫", category: "3d",
    prompt: "Create a full-page scroll-snap glassmorphism landing page. CSS scroll-snap type:y mandatory, 5 sections exactly 100vh each. Each section: centered glass card (backdrop-filter:blur(24px), background:rgba(255,255,255,0.06), border rgba(255,255,255,0.14), border-radius:24px). Background: 3 gradient orbs per section animating slowly (8-15s CSS keyframes). Sections: Hero (title+CTAs), Features (3 icon cards), Stats (count-up numbers), Testimonials, CTA form. Fixed right-side navigation dots. Deep void #030308, vibrant gradient blobs, white text." },
  { id: "apple_product", name: "Apple-Style Producto", icon: "📱", category: "3d",
    prompt: "Create an Apple iPhone-style 3D product launch page. Importmap three@0.158.0 + GSAP 3.12.5 + ScrollTrigger. Section 1: video scrubbing hero 300vh sticky — sync video.currentTime to scroll progress with requestAnimationFrame lerp, overlay text fades at 33% and 66%. Section 2: Three.js phone (BoxGeometry 7x14x0.8, MeshPhysicalMaterial metalness:1), screen (PlaneGeometry emissive blue), GSAP scrub rotation.y 0→2π, 5 color swatches click-to-change. Section 3: split-screen feature callouts ScrollTrigger slide-in. Section 4: specs grid monospace counter animations. Section 5: full-width gradient CTA. White #fff body, #000 hero sections." },
  { id: "parallax_nature", name: "Parallax Multicapa", icon: "🏔️", category: "3d",
    prompt: "Create a 6-layer CSS/JS parallax landing page with nature landscape. Pure JS requestAnimationFrame, NO external deps. Layers with CSS gradient backgrounds: sky (linear-gradient 0a0a2e→1a1a6e→8b5cf6→ec4899, speed:0.05), distant mountains SVG silhouette (speed:0.15), mid mountains (speed:0.25), hills (speed:0.38), trees (speed:0.52), foreground (speed:0.70). 200 star divs with CSS @keyframes twinkle. Hero text centered absolute parallax at 0.3. Sections below: Services, About, CTA with standard scroll animations. Twilight purple/pink sky, geometric landscape, dreamy atmosphere." },
];

// Model name normalization
export function normalizeModel(model: string): { provider: "claude" | "gemini" | "openai"; apiModel: string } {
  const m = model.toLowerCase();
  if (m.startsWith("gemini")) {
    const gmap: Record<string, string> = {
      "gemini-fast": "gemini-2.5-flash", "gemini-best": "gemini-2.5-pro",
      "gemini-2.5-flash": "gemini-2.5-flash", "gemini-2.5-pro": "gemini-2.5-pro",
      "gemini": "gemini-2.5-flash",
    };
    return { provider: "gemini", apiModel: gmap[m] ?? "gemini-2.5-flash" };
  }
  if (m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3")) {
    const omap: Record<string, string> = {
      "gpt-fast": "gpt-4.1-nano", "gpt-balanced": "gpt-4.1-mini", "gpt-best": "gpt-4.1",
      "gpt-4.1": "gpt-4.1", "gpt-4.1-mini": "gpt-4.1-mini", "gpt": "gpt-4.1",
    };
    return { provider: "openai", apiModel: omap[m] ?? "gpt-4.1" };
  }
  const cmap: Record<string, string> = {
    "fast": "claude-haiku-4-5", "balanced": "claude-sonnet-4-5", "best": "claude-opus-4-5",
    "claude-sonnet-4-6": "claude-sonnet-4-5", "claude-opus-4-8": "claude-opus-4-5",
    "claude-haiku-4-5": "claude-haiku-4-5", "claude-sonnet-4-5": "claude-sonnet-4-5",
    "claude-opus-4-5": "claude-opus-4-5",
  };
  return { provider: "claude", apiModel: cmap[m] ?? "claude-sonnet-4-5" };
}

function buildUserMessage(prompt: string, currentHtml: string, dna?: DnaVars): string {
  const dnaStr = dna ? `\n\nBRAND DNA (inject throughout):
- Name: ${dna.name} | Sector: ${dna.sector}
- Primary: ${dna.primary} | Secondary: ${dna.secondary} | Accent: ${dna.accent}
- BG: ${dna.bg} | Font: ${dna.font}
- Headline: "${dna.headline}" | Tagline: "${dna.tagline}" | CTA: "${dna.cta}"` : "";
  if (currentHtml && currentHtml.length > 50) {
    // La página completa: con un recorte el modelo devolvía la página truncada.
    return `EDIT THIS PAGE:\n\n${currentHtml.slice(0, 120_000)}\n\nINSTRUCTION: ${prompt}${dnaStr}`;
  }
  return `CREATE A WEB PAGE: ${prompt}${dnaStr}`;
}

/** Margen de salida: una página con Three.js/GSAP supera con facilidad 16k tokens. */
const MAX_OUTPUT_TOKENS = 32_000;

export interface StreamHtmlOptions {
  projectId?: number | null;
  /** Se llama al terminar: truncated = el modelo agotó el máximo de salida. */
  onFinish?: (info: { truncated: boolean; inputTokens: number; outputTokens: number; costUsd: number }) => void;
}

function historyTurns(history: Array<{ role: string; content: string }>): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const turn of history.slice(-8)) {
    if ((turn.role === "user" || turn.role === "assistant") && turn.content) {
      const content = turn.content.slice(0, 4000);
      const last = out[out.length - 1];
      if (last && last.role === turn.role) last.content += "\n" + content;
      else out.push({ role: turn.role, content });
    }
  }
  return out;
}

async function logUsage(provider: "claude" | "gemini" | "openai", model: string, projectId: number | null | undefined,
  inTok: number, outTok: number): Promise<number> {
  const { recordApiUsage, calcClaudeCost, calcGeminiCost, calcOpenAiCost } = await import("./api-usage.js");
  const costUsd = provider === "claude" ? calcClaudeCost(model, inTok, outTok)
    : provider === "gemini" ? calcGeminiCost(model, inTok, outTok)
    : calcOpenAiCost(model, inTok, outTok);
  void recordApiUsage({
    provider, operation: "web-designer", model, projectId: projectId || null,
    inputUnits: inTok, outputUnits: outTok, unitsLabel: "tokens", costUsd,
  });
  return costUsd;
}

export async function* streamHtmlClaude(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars,
  opts: StreamHtmlOptions = {},
): AsyncGenerator<string> {
  const { apiModel } = normalizeModel(model);
  // Mismo cliente que el resto de la plataforma (key propia, directa o proxy de integraciones).
  const { getClaudeClient } = await import("./claude.js");
  const client = await getClaudeClient(opts.projectId ?? 0);
  const messages = historyTurns(history);
  const userMsg = buildUserMessage(prompt, currentHtml, dna);
  if (messages.length && messages[messages.length - 1].role === "user") messages[messages.length - 1].content += "\n" + userMsg;
  else messages.push({ role: "user", content: userMsg });
  if (messages[0]?.role === "assistant") messages.shift();

  const stream = client.messages.stream(
    { model: apiModel, max_tokens: MAX_OUTPUT_TOKENS, system: DESIGN_SYSTEM_PROMPT, messages },
    { signal: AbortSignal.timeout(300_000) },
  );
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) yield ev.delta.text;
  }
  const final = await stream.finalMessage();
  const inTok = final.usage?.input_tokens ?? 0;
  const outTok = final.usage?.output_tokens ?? 0;
  const costUsd = await logUsage("claude", apiModel, opts.projectId, inTok, outTok);
  opts.onFinish?.({ truncated: final.stop_reason === "max_tokens", inputTokens: inTok, outputTokens: outTok, costUsd });
}

export async function* streamHtmlGemini(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars,
  opts: StreamHtmlOptions = {},
): AsyncGenerator<string> {
  const { apiModel } = normalizeModel(model);
  const { getGeminiClient } = await import("./gemini.js");
  const ai = getGeminiClient();
  const contents = historyTurns(history).map(t => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] }));
  contents.push({ role: "user", parts: [{ text: buildUserMessage(prompt, currentHtml, dna) }] });

  const stream = await ai.models.generateContentStream({
    model: apiModel,
    contents,
    // Gemini 2.5 cuenta el razonamiento dentro del máximo de salida: se reserva aparte.
    config: { systemInstruction: DESIGN_SYSTEM_PROMPT, maxOutputTokens: 65_536, temperature: 0.7, thinkingConfig: { thinkingBudget: 2048 } },
  });
  let usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } = {};
  let finishReason = "";
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
    if (chunk.usageMetadata) usage = chunk.usageMetadata;
    const fr = chunk.candidates?.[0]?.finishReason;
    if (fr) finishReason = String(fr);
  }
  const inTok = usage.promptTokenCount ?? 0;
  const outTok = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  const costUsd = await logUsage("gemini", apiModel, opts.projectId, inTok, outTok);
  opts.onFinish?.({ truncated: finishReason === "MAX_TOKENS", inputTokens: inTok, outputTokens: outTok, costUsd });
}

export async function* streamHtmlOpenai(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars,
  opts: StreamHtmlOptions = {},
): AsyncGenerator<string> {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (!key) throw new Error("OPENAI_API_KEY no configurada: elige un modelo de Claude o Gemini.");
  const { apiModel } = normalizeModel(model);
  const messages: Array<{role: string; content: string}> = [{ role: "system", content: DESIGN_SYSTEM_PROMPT }, ...historyTurns(history)];
  messages.push({ role: "user", content: buildUserMessage(prompt, currentHtml, dna) });
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    // gpt-4.1 admite hasta 32.768 tokens de salida.
    body: JSON.stringify({ model: apiModel, max_tokens: MAX_OUTPUT_TOKENS, stream: true, stream_options: { include_usage: true }, messages }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`OpenAI respondió ${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let inTok = 0, outTok = 0, finish = "";
  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break outer;
      try {
        const ev = JSON.parse(data);
        const chunk = ev.choices?.[0]?.delta?.content ?? "";
        if (ev.choices?.[0]?.finish_reason) finish = ev.choices[0].finish_reason;
        if (ev.usage) { inTok = ev.usage.prompt_tokens ?? 0; outTok = ev.usage.completion_tokens ?? 0; }
        if (chunk) yield chunk;
      } catch { /* línea parcial */ }
    }
  }
  const costUsd = await logUsage("openai", apiModel, opts.projectId, inTok, outTok);
  opts.onFinish?.({ truncated: finish === "length", inputTokens: inTok, outputTokens: outTok, costUsd });
}

/**
 * Genera la página en streaming. Errores reales (sin key, cuota, proveedor caído)
 * se lanzan: nunca se devuelve una página de relleno como si fuera el diseño.
 */
export async function* streamHtml(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars,
  opts: StreamHtmlOptions = {},
): AsyncGenerator<string> {
  const { assertAiBudget } = await import("./ai-budget.js");
  await assertAiBudget(opts.projectId ?? null);
  const { provider } = normalizeModel(model);
  if (provider === "gemini") { yield* streamHtmlGemini(prompt, currentHtml, model, history, dna, opts); return; }
  if (provider === "openai") { yield* streamHtmlOpenai(prompt, currentHtml, model, history, dna, opts); return; }
  yield* streamHtmlClaude(prompt, currentHtml, model, history, dna, opts);
}

function stripFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:html)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
  const start = t.search(/<!DOCTYPE/i);
  if (start > 0) t = t.slice(start);
  return t;
}

export { stripFences };

// ── Sesiones persistentes (antes vivían en memoria y se perdían al reiniciar) ──
export interface DesignSession {
  id: string;
  title: string;
  currentHtml: string;
  history: Array<{role: string; content: string}>;
  model: string;
  projectId?: number | null;
  createdAt: string;
  updatedAt: string;
}

let sessionsTableReady: Promise<void> | null = null;
function ensureSessionsTable(): Promise<void> {
  sessionsTableReady ??= (async () => {
    const { db } = await import("@workspace/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS web_designer_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Nuevo diseño',
        current_html TEXT NOT NULL DEFAULT '',
        history JSONB NOT NULL DEFAULT '[]'::jsonb,
        model TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
        project_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  })().catch(err => { sessionsTableReady = null; throw err; });
  return sessionsTableReady;
}

function rowToSession(r: Record<string, unknown>): DesignSession {
  return {
    id: String(r.id), title: String(r.title ?? "Nuevo diseño"), currentHtml: String(r.current_html ?? ""),
    history: Array.isArray(r.history) ? r.history as DesignSession["history"] : [],
    model: String(r.model ?? "claude-sonnet-4-5"),
    projectId: r.project_id == null ? null : Number(r.project_id),
    createdAt: new Date(String(r.created_at)).toISOString(), updatedAt: new Date(String(r.updated_at)).toISOString(),
  };
}

export async function getSession(id: string): Promise<DesignSession | null> {
  await ensureSessionsTable();
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const r = await db.execute(sql`SELECT * FROM web_designer_sessions WHERE id = ${id}`);
  return r.rows[0] ? rowToSession(r.rows[0] as Record<string, unknown>) : null;
}

export async function saveSession(data: Partial<DesignSession> & { id: string }): Promise<DesignSession> {
  await ensureSessionsTable();
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const existing = await getSession(data.id);
  const history = (data.history ?? existing?.history ?? []).slice(-40);
  const firstUser = history.find(h => h.role === "user")?.content;
  const title = (data.title ?? (existing && existing.title !== "Nuevo diseño" ? existing.title : firstUser) ?? "Nuevo diseño").slice(0, 80);
  const currentHtml = data.currentHtml ?? existing?.currentHtml ?? "";
  const model = data.model ?? existing?.model ?? "claude-sonnet-4-5";
  const projectId = data.projectId ?? existing?.projectId ?? null;
  const r = await db.execute(sql`
    INSERT INTO web_designer_sessions (id, title, current_html, history, model, project_id)
    VALUES (${data.id}, ${title}, ${currentHtml}, ${JSON.stringify(history)}::jsonb, ${model}, ${projectId})
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, current_html = EXCLUDED.current_html,
      history = EXCLUDED.history, model = EXCLUDED.model, project_id = EXCLUDED.project_id, updated_at = NOW()
    RETURNING *
  `);
  return rowToSession(r.rows[0] as Record<string, unknown>);
}

export async function listSessions(): Promise<DesignSession[]> {
  await ensureSessionsTable();
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const r = await db.execute(sql`SELECT * FROM web_designer_sessions ORDER BY updated_at DESC LIMIT 50`);
  return (r.rows as Record<string, unknown>[]).map(rowToSession);
}

export async function deleteSession(id: string): Promise<void> {
  await ensureSessionsTable();
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`DELETE FROM web_designer_sessions WHERE id = ${id}`);
}
