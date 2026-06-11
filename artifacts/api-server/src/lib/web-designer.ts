/**
 * Web Designer Engine — Claude AI Web Designer
 * Multi-model HTML page generation with streaming (Claude / Gemini / GPT-4.1)
 * 3-panel: Chat | Live Preview | Code Editor
 */
import { DnaVars, DEFAULT_DNA, applyDna } from "./visme-effects.js";

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
    return `EDIT THIS PAGE:\n\n${currentHtml.slice(0, 12000)}\n\nINSTRUCTION: ${prompt}${dnaStr}`;
  }
  return `CREATE A WEB PAGE: ${prompt}${dnaStr}`;
}

export async function* streamHtmlClaude(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars
): AsyncGenerator<string> {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  if (!key) { yield _fallback(prompt); return; }
  const { apiModel } = normalizeModel(model);
  const messages: Array<{role: string; content: string}> = [];
  for (const turn of history.slice(-8)) {
    if (["user", "assistant"].includes(turn.role) && turn.content) {
      messages.push({ role: turn.role, content: turn.content.slice(0, 4000) });
    }
  }
  messages.push({ role: "user", content: buildUserMessage(prompt, currentHtml, dna) });
  const clean: typeof messages = [];
  for (const m of messages) {
    if (clean.length && clean[clean.length - 1].role === m.role) {
      clean[clean.length - 1].content += "\n" + m.content;
    } else { clean.push({ ...m }); }
  }
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: apiModel, max_tokens: 16000, stream: true, system: DESIGN_SYSTEM_PROMPT, messages: clean }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok || !resp.body) { yield `<!-- Claude ${resp.status} -->`; return; }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "content_block_delta") {
          const chunk = ev.delta?.text ?? "";
          if (chunk) yield chunk;
        }
      } catch {}
    }
  }
}

export async function* streamHtmlGemini(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars
): AsyncGenerator<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY ?? "";
  if (!key) { yield _fallback(prompt); return; }
  const { apiModel } = normalizeModel(model);
  const contents: Array<{role: string; parts: Array<{text: string}>}> = [];
  for (const turn of history.slice(-8)) {
    const role = turn.role === "assistant" ? "model" : "user";
    if (["user", "model"].includes(role) && turn.content) {
      contents.push({ role, parts: [{ text: turn.content.slice(0, 4000) }] });
    }
  }
  contents.push({ role: "user", parts: [{ text: buildUserMessage(prompt, currentHtml, dna) }] });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system_instruction: { parts: [{ text: DESIGN_SYSTEM_PROMPT }] }, contents, generationConfig: { maxOutputTokens: 16000, temperature: 0.7 } }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok) { yield `<!-- Gemini ${resp.status} -->`; return; }
  const data = await resp.json() as any;
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  yield text || _fallback(prompt);
}

export async function* streamHtmlOpenai(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars
): AsyncGenerator<string> {
  const key = process.env.OPENAI_API_KEY ?? "";
  if (!key) { yield _fallback(prompt); return; }
  const { apiModel } = normalizeModel(model);
  const messages: Array<{role: string; content: string}> = [{ role: "system", content: DESIGN_SYSTEM_PROMPT }];
  for (const turn of history.slice(-8)) {
    if (["user", "assistant"].includes(turn.role) && turn.content) {
      messages.push({ role: turn.role, content: turn.content.slice(0, 4000) });
    }
  }
  messages.push({ role: "user", content: buildUserMessage(prompt, currentHtml, dna) });
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: apiModel, max_tokens: 16000, stream: true, messages }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok || !resp.body) { yield `<!-- GPT ${resp.status} -->`; return; }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const ev = JSON.parse(data);
        const chunk = ev.choices?.[0]?.delta?.content ?? "";
        if (chunk) yield chunk;
      } catch {}
    }
  }
}

export async function* streamHtml(
  prompt: string, currentHtml: string, model: string, history: Array<{role: string; content: string}>, dna?: DnaVars
): AsyncGenerator<string> {
  const { provider } = normalizeModel(model);
  if (provider === "gemini") { yield* streamHtmlGemini(prompt, currentHtml, model, history, dna); return; }
  if (provider === "openai") { yield* streamHtmlOpenai(prompt, currentHtml, model, history, dna); return; }
  yield* streamHtmlClaude(prompt, currentHtml, model, history, dna);
}

function stripFences(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:html)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
  const start = t.indexOf("<!DOCTYPE");
  if (start > 0) t = t.slice(start);
  return t;
}

export { stripFences };

function _fallback(prompt: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>AI Web Designer</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#f0f0f0;min-height:100vh;display:flex;align-items:center;justify-content:center}.card{max-width:600px;padding:60px 40px;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:16px}h1{font-size:2.5rem;font-weight:300;margin-bottom:1rem;color:#c9a961}p{color:#999;font-size:1rem;line-height:1.7}.note{margin-top:2rem;padding:16px;background:rgba(201,169,97,.1);border-radius:8px;font-size:.85rem;color:#c9a961}</style>
</head>
<body><div class="card"><h1>AI Web Designer</h1><p>Configura tu API Key en Configuración para generar diseños con IA.</p><div class="note">Prompt: ${prompt.slice(0, 100)}</div></div></body>
</html>`;
}

// Simple in-memory session store
interface DesignSession {
  id: string;
  title: string;
  currentHtml: string;
  history: Array<{role: string; content: string}>;
  model: string;
  projectId?: number;
  createdAt: string;
  updatedAt: string;
}

const _sessions = new Map<string, DesignSession>();

export function getSession(id: string): DesignSession {
  return _sessions.get(id) ?? {
    id, title: "New Design", currentHtml: "", history: [],
    model: "claude-sonnet-4-5", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function saveSession(data: Partial<DesignSession> & { id: string }): DesignSession {
  const existing = _sessions.get(data.id) ?? {
    id: data.id, title: "New Design", currentHtml: "", history: [],
    model: "claude-sonnet-4-5", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const updated: DesignSession = { ...existing, ...data, updatedAt: new Date().toISOString() };
  _sessions.set(data.id, updated);
  // Auto-title from first message
  if (!data.title && updated.history.length === 1 && updated.history[0].role === "user") {
    updated.title = updated.history[0].content.slice(0, 60);
  }
  return updated;
}

export function listSessions(): DesignSession[] {
  return [..._sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50);
}
