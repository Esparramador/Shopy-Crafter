"""
CRAFTER WEB DESIGNER - claude.ai/design parity
===============================================
Full-featured AI web design studio:
- 3-panel: Chat | Live Preview | Code editor
- Real-time streaming generation with Claude
- Responsive preview (mobile/tablet/desktop)
- Template gallery (10+ templates)
- Version history + undo/redo
- Export + Deploy to client landing
2026-05-22 - claude-haiku-4-5 / claude-sonnet-4-5
"""
from __future__ import annotations
import os, json, uuid
from pathlib import Path
from typing import Dict, List, Optional, AsyncGenerator
from datetime import datetime, timezone
from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

CRAFTER_BASE = Path(os.getenv("CRAFTER_BASE", str(Path(__file__).parent.parent)))
DESIGN_SESSIONS = CRAFTER_BASE / "_design_sessions"
DESIGN_SESSIONS.mkdir(parents=True, exist_ok=True)

DESIGN_SYSTEM_PROMPT = """You are an expert web designer & 3D developer building pages like claude.ai/design, Apple.com, and award-winning Awwwards sites.

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

VISME EFFECTS LIBRARY — 594 design patterns available (use freely):
Categories: 3d_effects · animated_characters · animated_icons · audio_visualization ·
background_effects · celebration_effects · charts · data_viz · flowcharts ·
infographics · interactive_effects · landing_pages · logo_animations · micro_interactions ·
mind_maps · mockups · motion_graphics · overlay_effects · parallax_effects ·
particle_effects · presentations · social_media · text_effects · timelines ·
transition_effects · typography_effects · ui_components · video_effects · web_graphics

30 PRE-BUILT EFFECT SNIPPETS (pure CSS/JS, no extra deps unless noted):
- particle_rain: Canvas 2D falling particles, color from brand primary
- aurora_bg: CSS conic-gradient animated aurora background
- magnetic_btn: JS mousemove translate — buttons follow cursor magnetically
- text_reveal_scroll: IntersectionObserver word-by-word reveal
- glass_card: CSS backdrop-filter glassmorphism card
- neon_glow: CSS keyframe pulsing neon text shadow
- tilt_3d_card: CSS perspective + JS mousemove 3D tilt card
- gradient_mesh: Multiple CSS radial gradients in motion
- typing_text: CSS steps() typewriter with blinking cursor
- svg_stroke_anim: SVG stroke-dasharray "drawing" animation
- confetti_burst: Canvas 2D confetti explosion on click
- floating_element: CSS keyframe float up/down
- ripple_click: CSS+JS click ripple expanding circle
- skeleton_loader: CSS shimmer placeholder loader
- scroll_progress_bar: JS scroll → CSS width progress indicator
- count_up: IntersectionObserver + RAF animated counter
- blob_morph: CSS border-radius keyframe organic blob
- text_scramble: JS character scramble on hover
- clip_path_reveal: CSS clip-path IntersectionObserver reveal
- cursor_glow_trail: JS mousemove radial-gradient light aura
- flip_card: CSS 3D rotateY card flip on hover
- marquee_infinite: CSS animation infinite scrolling ticker
- color_shift_bg: CSS hue-rotate infinite background shift
- grid_hover_glow: JS + CSS custom properties grid spotlight
- wave_svg_bg: SVG sinusoidal animated wave divider
- stagger_entrance: IntersectionObserver CSS stagger entrance
- gsap_text_split: GSAP character-by-character entrance (needs GSAP CDN)
- threejs_particle_sphere: Three.js r158 rotating particle sphere (needs Three.js CDN)
- parallax_hero: JS scroll parallax hero section
- overlay_hover_reveal: CSS clip-path image reveal on hover

IMPLEMENTATION RULES FOR EFFECTS:
- Always use requestAnimationFrame (never setInterval) for animations
- Add will-change: transform to animated elements for GPU compositing
- CSS animations: use cubic-bezier for easing, not linear
- Dark/light toggle must preserve effect colors via CSS vars
- Effects must degrade gracefully when CDN fails (try/catch for Three.js/GSAP)

STYLE GUIDE:
- Typography: display serif (Cormorant Garamond) for headings, Inter/Space Grotesk for body, JetBrains Mono for code/labels
- Colors: meaningful palette with CSS vars --primary, --bg, --text, --accent
- Spacing: 8px base grid
- Shadows: layered, subtle
- Glass: backdrop-filter:blur(20px) saturate(180%), rgba(255,255,255,0.08), border rgba(255,255,255,0.12)

When EDITING: return COMPLETE updated HTML.
When user says "make X darker/lighter/bigger": apply consistently.
When user requests an effect by name: implement it using the technique described above.

OUTPUT: Raw HTML only. No markdown. No explanations. Just <!DOCTYPE html>...</html>"""


# ── Effect auto-selector ──────────────────────────────────────────────────────
import json as _json
_3D_REFS_PATH = Path(__file__).parent / "knowledge" / "3d_refs.json"
_3D_REFS: dict = {}

def _load_3d_refs():
    global _3D_REFS
    if _3D_REFS: return _3D_REFS
    try:
        _3D_REFS = _json.loads(_3D_REFS_PATH.read_text(encoding="utf-8"))
    except Exception:
        _3D_REFS = {}
    return _3D_REFS

def _detect_3d_effect(prompt: str) -> str:
    """Return a blueprint snippet to inject into prompt based on detected page type."""
    refs = _load_3d_refs()
    rules = refs.get("effect_selector", {}).get("rules", [])
    prompt_lower = prompt.lower()
    for rule in rules:
        if any(kw in prompt_lower for kw in rule.get("keywords", [])):
            primary = rule.get("primary", "")
            # Find repo blueprint
            for repo in refs.get("repos", []):
                if repo.get("id") == primary:
                    snippet = repo.get("prompt_snippet", "")
                    return f"\n\n[AUTO-EFFECT HINT — integrate this technique]: {snippet}\n"
    return ""


class DesignRequest(BaseModel):
    session_id: Optional[str] = None
    prompt: str
    current_html: Optional[str] = None
    model: str = "claude-sonnet-4-6"
    stream: bool = False
    history: List[Dict] = []  # [{role: "user"|"assistant", content: str}, ...]


class DeployRequest(BaseModel):
    session_id: str
    client_slug: str
    page_name: str = "home"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_session(sid: str) -> dict:
    f = DESIGN_SESSIONS / f"{sid}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    return {"session_id": sid, "title": "New Design", "current_html": "",
            "history": [], "versions": [], "created_at": _now(), "updated_at": _now()}


def _save_session(data: dict) -> None:
    data["updated_at"] = _now()
    f = DESIGN_SESSIONS / f"{data['session_id']}.json"
    f.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


async def _generate_html(prompt: str, current_html: str, model: str, history: List[Dict] = []) -> AsyncGenerator[str, None]:
    """Route HTML generation to Claude / Gemini / GPT-4.1 based on model prefix."""
    effect_hint = _detect_3d_effect(prompt)
    full_prompt = prompt + effect_hint

    if model.startswith("gemini"):
        async for chunk in _generate_html_gemini(full_prompt, current_html, model, history):
            yield chunk
        return
    if model.startswith("gpt") or model.startswith("o1") or model.startswith("o3"):
        async for chunk in _generate_html_openai(full_prompt, current_html, model, history):
            yield chunk
        return
    async for chunk in _generate_html_claude(full_prompt, current_html, model, history):
        yield chunk


async def _generate_html_claude(prompt: str, current_html: str, model: str, history: List[Dict] = []) -> AsyncGenerator[str, None]:
    """Stream HTML generation from Claude with multi-turn history."""
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        yield _fallback_template(prompt)
        return
    import httpx
    _map = {
        "fast": "claude-haiku-4-5", "balanced": "claude-sonnet-4-5", "best": "claude-opus-4-5",
        "claude-3-5-sonnet-20240620": "claude-haiku-4-5", "claude-3-5-sonnet-20241022": "claude-haiku-4-5",
        "claude-3-haiku-20240307": "claude-haiku-4-5", "claude-3-5-haiku-20241022": "claude-haiku-4-5",
        "claude-3-opus-20240229": "claude-opus-4-5",
        "claude-sonnet-4-6": "claude-sonnet-4-5", "claude-opus-4-7": "claude-opus-4-5",
        "claude-sonnet-4-20250514": "claude-sonnet-4-5", "claude-haiku-4-20250514": "claude-haiku-4-5",
    }
    model = _map.get(model, model)
    if not model.startswith("claude-"):
        model = "claude-sonnet-4-5"
    # Build multi-turn messages from history (last 8 turns max to stay within token budget)
    messages = []
    for turn in history[-8:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)[:4000]})
    # Current user message — include current HTML as context if present
    user_msg = (f"EDIT THIS PAGE:\n\n{current_html[:12000]}\n\nINSTRUCTION: {prompt}"
                if current_html and len(current_html) > 50 else f"CREATE A WEB PAGE: {prompt}")
    messages.append({"role": "user", "content": user_msg})
    # Ensure alternating roles (Claude API requirement)
    clean_messages = []
    for m in messages:
        if clean_messages and clean_messages[-1]["role"] == m["role"]:
            clean_messages[-1]["content"] += "\n" + m["content"]
        else:
            clean_messages.append(m)
    async with httpx.AsyncClient(timeout=120) as c:
        async with c.stream(
            "POST", "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": model, "max_tokens": 16000, "stream": True,
                  "system": DESIGN_SYSTEM_PROMPT,
                  "messages": clean_messages}
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield f"<!-- ERROR {resp.status_code}: {body.decode()[:200]} -->"
                return
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]": break
                    try:
                        ev = json.loads(data)
                        if ev.get("type") == "content_block_delta":
                            chunk = ev["delta"].get("text", "")
                            if chunk: yield chunk
                    except Exception: pass


async def _generate_html_gemini(prompt: str, current_html: str, model: str, history: List[Dict] = []) -> AsyncGenerator[str, None]:
    """Stream HTML generation from Gemini 2.5 with history."""
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY", "")
    if not key:
        yield _fallback_template("[Gemini] " + prompt)
        return
    import httpx
    _gmap = {"gemini-fast": "gemini-2.5-flash", "gemini-best": "gemini-2.5-pro", "gemini": "gemini-2.5-flash"}
    model = _gmap.get(model, model) or "gemini-2.5-flash"
    contents = []
    for turn in history[-8:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role == "assistant": role = "model"
        if role in ("user", "model") and content:
            contents.append({"role": role, "parts": [{"text": str(content)[:4000]}]})
    user_msg = (f"EDIT THIS PAGE:\n\n{current_html[:12000]}\n\nINSTRUCTION: {prompt}"
                if current_html and len(current_html) > 50 else f"CREATE A WEB PAGE: {prompt}")
    contents.append({"role": "user", "parts": [{"text": user_msg}]})
    payload = {
        "system_instruction": {"parts": [{"text": DESIGN_SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 16000, "temperature": 0.7},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    async with httpx.AsyncClient(timeout=120) as c:
        try:
            resp = await c.post(url, json=payload)
            if resp.status_code != 200:
                yield f"<!-- Gemini ERROR {resp.status_code}: {resp.text[:200]} -->"
                return
            data = resp.json()
            text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            yield text or _fallback_template(prompt)
        except Exception as e:
            yield f"<!-- Gemini exception: {e} -->"


async def _generate_html_openai(prompt: str, current_html: str, model: str, history: List[Dict] = []) -> AsyncGenerator[str, None]:
    """Stream HTML generation from GPT-4.1 with history."""
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        yield _fallback_template("[GPT] " + prompt)
        return
    import httpx
    _omap = {"gpt-fast": "gpt-4.1-nano", "gpt-balanced": "gpt-4.1-mini", "gpt-best": "gpt-4.1", "gpt": "gpt-4.1"}
    model = _omap.get(model, model) or "gpt-4.1"
    messages = [{"role": "system", "content": DESIGN_SYSTEM_PROMPT}]
    for turn in history[-8:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)[:4000]})
    user_msg = (f"EDIT THIS PAGE:\n\n{current_html[:12000]}\n\nINSTRUCTION: {prompt}"
                if current_html and len(current_html) > 50 else f"CREATE A WEB PAGE: {prompt}")
    messages.append({"role": "user", "content": user_msg})
    async with httpx.AsyncClient(timeout=120) as c:
        async with c.stream(
            "POST", "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "max_tokens": 16000, "stream": True,
                  "messages": messages}
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield f"<!-- GPT ERROR {resp.status_code}: {body.decode()[:200]} -->"
                return
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data.strip() == "[DONE]": break
                    try:
                        ev = json.loads(data)
                        chunk = ev.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if chunk: yield chunk
                    except Exception: pass


def _fallback_template(prompt: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Crafter Design</title>
<style>
:root{{--bg:#0a0a0f;--text:#f0f0f0;--accent:#c9a961;--border:rgba(255,255,255,0.08)}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center}}
.card{{max-width:600px;padding:60px 40px;text-align:center;border:1px solid var(--border);border-radius:16px}}
h1{{font-size:2.5rem;font-weight:300;margin-bottom:1rem;color:var(--accent)}}
p{{color:#999;font-size:1rem;line-height:1.7}}
.note{{margin-top:2rem;padding:16px;background:rgba(201,169,97,0.1);border-radius:8px;font-size:.85rem;color:var(--accent)}}
</style>
</head>
<body>
<div class="card">
  <h1>Crafter Designer</h1>
  <p>Configura tu ANTHROPIC_API_KEY en Configuracion para generar disenos con IA.</p>
  <div class="note">Prompt: {prompt[:100]}</div>
</div>
</body>
</html>"""


def _strip_md_fences(text: str) -> str:
    """Remove markdown code fences from HTML response."""
    import re
    text = text.strip()
    # Remove ```html ... ``` or ``` ... ```
    text = re.sub(r'^```(?:html)?\s*\n?', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n?```\s*$', '', text, flags=re.MULTILINE)
    text = text.strip()
    # Find first <!DOCTYPE or <html
    start = text.find('<!DOCTYPE')
    if start == -1:
        start = text.find('<html')
    if start > 0:
        text = text[start:]
    return text

TEMPLATES = {
    "landing_saas": {"name": "SaaS Landing", "icon": "🚀", "prompt": "Create a modern SaaS landing page with hero section, features grid (3 columns), pricing table (3 tiers), testimonials, and CTA. Dark theme with purple/blue gradient accent."},
    "landing_restaurant": {"name": "Restaurante", "icon": "🍽️", "prompt": "Create an elegant restaurant landing page with full-screen hero, menu section, reservation form, chef story, and footer. Warm dark tones, serif headings."},
    "landing_ecommerce": {"name": "E-commerce", "icon": "🛍️", "prompt": "Create a product landing page with hero, product showcase grid, features list, social proof, and buy CTA. Clean white minimal design."},
    "landing_portfolio": {"name": "Portfolio", "icon": "💼", "prompt": "Create a personal portfolio with animated hero, projects grid with hover effects, skills section, and contact form. Dark minimalist aesthetic."},
    "landing_blog": {"name": "Blog/Media", "icon": "📝", "prompt": "Create a modern blog homepage with featured post hero, article cards grid, category filters, newsletter signup. Clean editorial design."},
    "landing_agency": {"name": "Agencia", "icon": "✨", "prompt": "Create a creative agency homepage with bold typography hero, services section, work showcase, team grid, and contact. Black/gold premium design."},
    "landing_app": {"name": "App Movil", "icon": "📱", "prompt": "Create a mobile app landing with phone mockup hero, features with icons, screenshots, reviews, and download CTAs. Gradient tech feel."},
    "landing_event": {"name": "Evento", "icon": "🎤", "prompt": "Create an event/conference landing with countdown timer, speaker cards, schedule timeline, venue info, and registration CTA."},
    "dashboard_admin": {"name": "Dashboard Admin", "icon": "📊", "prompt": "Create an admin dashboard with sticky sidebar navigation (collapsible on mobile), KPI metric cards with trend arrows, bar/line chart placeholders using CSS, sortable data table, notification bell, and user avatar. Dark theme with glassmorphism cards."},
    "form_contact": {"name": "Contacto", "icon": "📬", "prompt": "Create a beautiful contact page with floating-label form, map placeholder, contact info cards, and FAQ accordion. Clean minimal design with micro-interactions."},
    "sidebar_docs": {"name": "Docs / Portal", "icon": "📚", "prompt": "Create a documentation/portal layout with: persistent left sidebar (category tree, collapsible sections, search), sticky top navbar (logo + breadcrumb + dark/light toggle), main content area (markdown-style article with TOC on right), and bottom prev/next navigation. Light + dark mode. Inter font. Subtle GSAP fade-in on page load."},
    "sidebar_app": {"name": "App con Sidebar", "icon": "🗂️", "prompt": "Create a full SPA-style app layout with: left sidebar (logo, nav items with icons, active state, badge counters, user profile at bottom), top header (search bar, notifications, avatar), and main content area with a responsive card grid. Dark theme. Sidebar collapses to icon-only on mobile. GSAP entrance animations."},
    "landing_full_pro": {"name": "Landing Profesional Completa", "icon": "🌐", "prompt": "Create a complete professional landing page with ALL sections: sticky navbar (logo + links + CTA + dark/light toggle), hero (headline + sub + dual CTA + animated gradient background), features (6-card grid with SVG icons), benefits (split layout with image and bullets), testimonials (3 cards with stars), pricing (3 tiers with monthly/annual toggle), FAQ (animated accordion), team section (4 cards), footer (4 columns + newsletter + social). GSAP ScrollTrigger reveals. Dark/light mode. Glassmorphism cards. Mobile-first. Preloader."},

    # ─── 3D / Immersive Web Templates ────────────────────────────────────────
    "3d_scroll_scrubbing": {
        "name": "3D Video Scrubbing", "icon": "🎬",
        "prompt": """Create a premium scroll-driven video scrubbing page using pure JavaScript (no external libs except importmap three.js).
TECHNIQUE: As the user scrolls, advance a video frame-by-frame (video.currentTime = scroll% * video.duration).
STRUCTURE:
- Hero: full-viewport sticky container with <video> element (use a placeholder src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" muted playsinline preload="auto")
- Sticky scroll container: height 500vh so 5x viewport of scroll travel
- Overlay text that fades in/out at different scroll milestones (0%, 25%, 50%, 75%, 100%)
- Progress bar at bottom showing scroll position
- Smooth RAF-based lerp for currentTime updates (lerp factor 0.1)
- After the sticky section: 3 feature cards with dark glassmorphism
DESIGN: Pure black background, white typography, gold (#c9a961) accents, JetBrains Mono for captions
JavaScript: Use IntersectionObserver + scroll events, requestAnimationFrame loop for smooth scrubbing
Make it feel like Apple's AirPods Pro scroll storytelling page."""
    },

    "3d_particle_hero": {
        "name": "Particle Hero 3D", "icon": "✨",
        "prompt": """Create a stunning Three.js particle field hero page.
IMPORTS: Use importmap {"imports":{"three":"https://unpkg.com/three@0.158.0/build/three.module.js"}}
SCENE SETUP:
- PerspectiveCamera(75, aspect, 0.1, 1000), renderer antialias + alpha, setPixelRatio(devicePixelRatio)
- 5000 particles using BufferGeometry + BufferAttribute (position Float32Array, random sphere distribution radius 8)
- Custom ShaderMaterial: vertex shader sizes particles by distance, fragment shader draws soft circular point with glow
- Two particle systems: small stars (white/blue) + larger bokeh blobs (purple/pink, opacity 0.3)
- Mouse parallax: track mousemove, lerp camera position toward (mouseX*2, mouseY*1, 5) with factor 0.05
- Rotation: particles.rotation.y += 0.0003 per frame, particles.rotation.x += 0.0001
- UnrealBloomPass via EffectComposer (use CDN: https://unpkg.com/three@0.158.0/examples/jsm/postprocessing/)
CONTENT OVERLAY (HTML/CSS, absolute positioned, z-index 10):
- Brand logo area top-left
- Hero center: massive display type "The Future\\nIs Now" with gradient text (indigo→violet→pink)
- Subtitle and two CTAs (primary gradient button + ghost button)
- Scroll indicator bottom center with animated arrow
DESIGN: Void black bg, space feel, premium agency aesthetic"""
    },

    "3d_product_glass": {
        "name": "Glass Product 3D", "icon": "💎",
        "prompt": """Create a luxury 3D product showcase using Three.js MeshPhysicalMaterial with glass/transmission.
IMPORTS: importmap three@0.158.0 + GLTFLoader from examples/jsm/loaders/GLTFLoader.js + OrbitControls
SCENE:
- Background: dark void with subtle gradient shader plane
- Central product: TorusKnot geometry (fallback while GLTF loads) with MeshPhysicalMaterial:
  transmission: 1.0, thickness: 1.5, roughness: 0.05, metalness: 0.0, ior: 1.5,
  color: 0xaaaaff, envMapIntensity: 1.0, clearcoat: 1.0, clearcoatRoughness: 0.0
- PMREMGenerator + RGBELoader for environment map (use: https://threejs.org/examples/textures/equirectangular/royal_esplanade_1k.hdr)
- 3 point lights: key (white 1.5), fill (purple 0.8), rim (gold 0.6)
- Auto-rotate Y axis += 0.005/frame, OrbitControls damping enabled
- Floating label annotations (HTML overlays positioned via Three.js project() onto screen)
SCROLL EFFECT (GSAP ScrollTrigger via CDN):
- On scroll 0→100%: product scales 0.5→1.2, rotation.z goes 0→Math.PI*2, lights change color
- Section below with product specs in monospace table
- CTA section with gradient button
DESIGN: Ultra-premium, Apple-like, #0a0a0f background, gold highlights #c9a961"""
    },

    "3d_gsap_scroll": {
        "name": "GSAP ScrollTrigger", "icon": "⚡",
        "prompt": """Create a GSAP ScrollTrigger showcase landing page with cinematic scroll animations.
CDN IMPORTS:
- GSAP: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
- ScrollTrigger: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js
- SplitType: https://unpkg.com/split-type@0.3.4/umd/index.min.js
ANIMATIONS:
1. Hero section: SplitType char-by-char entrance, stagger 0.03s, y: 80→0, opacity 0→1
2. Horizontal scroll section: pin a container, translate 4 cards horizontally as user scrolls (scrub:true)
3. Counter section: animate numbers 0→target on scroll enter (gsap.to with modifiers)
4. Parallax images: multiple layers moving at different speeds (y: 0→-150 vs y: 0→-50)
5. Staggered card reveal: grid of service cards, each rotateX 30→0, y 60→0, stagger 0.1
6. SVG path drawing: an SVG line that draws itself on scroll (strokeDashoffset animation)
7. Color scheme shift: background morphs from dark to light as user scrolls through sections
8. Footer reveal: mask-image clip-path from bottom
SECTIONS: Hero → Services (horizontal) → Numbers → Work → Process (SVG path) → CTA → Footer
DESIGN: Monochrome base (#111, #fff), gold accent (#c9a961), Inter + Space Grotesk fonts, editorial feel"""
    },

    "3d_exploded_view": {
        "name": "Exploded 3D View", "icon": "🔩",
        "prompt": """Create a 3D product exploded view page (like Apple M2 chip teardown).
IMPORTS: importmap three@0.158.0 + GSAP CDN 3.12.5 + ScrollTrigger CDN
TECHNIQUE: Multiple mesh layers that explode apart on scroll
THREE.JS SCENE:
- Camera: PerspectiveCamera(45, aspect, 0.1, 100), position z=10
- Product layers (use BoxGeometry with different dimensions as component stand-ins):
  Layer 0: Screen glass (0.1 thin, large, MeshPhysicalMaterial transmission:0.9)
  Layer 1: Display panel (box, emissive blue glow)
  Layer 2: Main board (green PCB material)
  Layer 3: Battery (dark slab, metalness 0.8)
  Layer 4: Bottom chassis (aluminum MeshStandardMaterial metalness:1, roughness:0.2)
- All layers start stacked (y=0), will animate apart
SCROLL GSAP ANIMATION (ScrollTrigger scrub:true):
  - 0-20%: camera orbits around product (camera.position.x lerp)
  - 20-80%: layers explode: each layer moves to unique y offset (glass→+4, display→+2, board→0, battery→-2, chassis→-4)
  - 80-100%: layers reassemble back together
HTML OVERLAY LABELS: Absolute positioned labels for each component, connected by thin lines (CSS pseudo-elements), fade in when layer is at exploded position
DESIGN: Dark industrial aesthetic, amber (#f59e0b) labels, monospace annotations, blueprint grid background (CSS)"""
    },

    "3d_neon_city": {
        "name": "Neon City 3D", "icon": "🌆",
        "prompt": """Create an immersive Three.js neon cyberpunk city landing page.
IMPORTS: importmap three@0.158.0 + EffectComposer + UnrealBloomPass + OrbitControls (all from unpkg three examples/jsm)
SCENE — Procedural city grid:
- Ground plane: MeshStandardMaterial black metallic, 50x50 units
- Buildings: generate 200+ BoxGeometry buildings procedurally in nested for loops (grid layout), random heights 0.5–8 units, emissive neon colors (cyan, magenta, amber, deep blue) varying by building
- Neon tubes: CatmullRomCurve3 paths along streets, TubeGeometry with MeshBasicMaterial emissive pink/cyan
- Rain particles: 2000 LineSegments moving downward, reset when below ground
- Fog: scene.fog = new THREE.FogExp2(0x000011, 0.04)
- Bloom post-processing: EffectComposer → RenderPass → UnrealBloomPass (threshold:0.2, strength:1.5, radius:0.4)
CAMERA: Slow automated fly-through using CatmullRomCurve3 path above city, camera.lookAt(target) along path
SCROLL: GSAP ScrollTrigger controls camera speed along path (fast scroll = fast fly)
HTML OVERLAY: Cyberpunk UI — scanlines CSS overlay, HUD elements (speed, altitude, coordinates), glitch text effect on h1, neon glow on buttons
CTA section below the 3D canvas with "Enter the Network" button"""
    },

    # ─── Repo-Inspired Templates (15 GitHub references) ─────────────────────
    "3d_r3f_scroll_journey": {
        "name": "R3F Scroll Journey", "icon": "🚀",
        "prompt": """Create a scroll-driven 3D journey using Three.js (React Three Fiber concept, pure JS).
IMPORTS: importmap three@0.158.0 + OrbitControls + GSAP ScrollTrigger CDN
TECHNIQUE: Camera travels along CatmullRomCurve3 path as user scrolls.
SCENE:
- Dark space void background (scene.background = new THREE.Color(0x020008))
- 12 floating geometric objects scattered in 3D space: IcosahedronGeometry, TorusGeometry, OctahedronGeometry, DodecahedronGeometry (random positions in -20 to 20 range on X,Y,Z)
- Each mesh: MeshStandardMaterial with emissive color (indigo, violet, pink, gold), metalness:0.8, roughness:0.2
- Particle nebula: 3000 points in sphere distribution, white+purple colors
- Camera path: CatmullRomCurve3 through ~10 control points spanning the scene
- Camera.lookAt follows a second parallel curve (slightly offset) for natural movement
SCROLL: GSAP ScrollTrigger scrub:true, scroll progress (0 to 1) = position along curve (curve.getPoint(progress))
ATMOSPHERE: Bloom effect, soft directional light, ambient 0.3
SECTIONS BELOW: 3 feature cards with dark glassmorphism
DESIGN: Ultra-dark, purple nebula feel, JetBrains Mono labels"""
    },

    "cinematic_scroll_reveal": {
        "name": "Cinematic Scroll", "icon": "🎬",
        "prompt": """Create a cinematic agency landing with Codrops-style animations.
CDN: GSAP 3.12.5 + ScrollTrigger + SplitType (unpkg.com/split-type@0.3.4/umd/index.min.js)
ANIMATIONS:
1. Hero: SplitType on h1, animate each char: gsap.from(chars, {y:100, opacity:0, stagger:0.025, ease:'expo.out', duration:1.2})
2. Film grain overlay: <canvas> with requestAnimationFrame drawing random noise (ctx.putImageData with random alpha 0-30), position:fixed, pointer-events:none, mix-blend-mode:overlay, opacity:0.4
3. Section transitions: clip-path:"inset(100% 0 0 0)" → "inset(0% 0 0 0)" on ScrollTrigger enter
4. Parallax hero image: CSS transform:translateY() synced to scrollY * 0.4
5. Horizontal gallery: GSAP pin, translateX reveals 4 work items as user scrolls (scrub:true)
6. Letter-spacing collapse: gsap.from(heading, {letterSpacing:'0.4em', duration:1.4})
7. Cursor: 20px div follows mouse with lerp 0.12, mix-blend-mode:difference
SECTIONS: Hero → About → Work (horizontal) → Process → Contact
DESIGN: Charcoal #0f0f0f, off-white #f0ede8, gold #c9a961 accent, Cormorant Garamond + Inter"""
    },

    "parallax_nature": {
        "name": "Parallax Multi-Layer", "icon": "🏔️",
        "prompt": """Create a 6-layer CSS/JS parallax landing page inspired by nature landscapes.
TECHNIQUE: Pure JS requestAnimationFrame, NO external deps.
LAYERS (created with CSS background-image gradients as placeholders):
- Layer 1 (sky): linear-gradient(180deg, #0a0a2e 0%, #1a1a6e 40%, #8b5cf6 70%, #ec4899 100%), speed: 0.05
- Layer 2 (distant mountains): SVG path dark silhouette, speed: 0.15
- Layer 3 (mid mountains): SVG path lighter silhouette, speed: 0.25
- Layer 4 (hills): SVG path, speed: 0.38
- Layer 5 (trees): SVG path dark, speed: 0.52
- Layer 6 (ground/foreground): dark solid, speed: 0.70
JS: window.addEventListener('scroll', () => { layers.forEach((l,i) => { l.style.transform = \`translateY(\${scrollY * speeds[i]}px)\` }) })
Stars: 200 small divs in sky layer, CSS @keyframes twinkle
HERO TEXT: Centered absolute, bold display font, text-shadow, parallax at speed 0.3
SECTIONS BELOW: Services, About, CTA — standard scroll animations
DESIGN: Twilight purple/pink sky gradient, geometric landscape, dreamy atmosphere"""
    },

    "glass_snap_scroll": {
        "name": "Glass Snap Scroll", "icon": "💫",
        "prompt": """Create a full-page scroll-snap glassmorphism landing page.
TECHNIQUE: CSS scroll-snap + JS for active section detection + CSS blob animations
STRUCTURE: 5 sections, each exactly 100vh, scroll-snap-type:y mandatory on html
GLASS PANELS: Each section has centered glassmorphism card:
  backdrop-filter:blur(24px) saturate(200%), background:rgba(255,255,255,0.06),
  border:1px solid rgba(255,255,255,0.14), border-radius:24px, padding:60px
BACKGROUND BLOBS: 3 gradient orbs per section, slowly animate position (CSS @keyframes, 8-15s duration):
  Blob 1: radial-gradient(ellipse, #6366f1 0%, transparent 70%), position:absolute, filter:blur(60px), opacity:0.5
  Blob 2: radial-gradient(ellipse, #8b5cf6 0%, transparent 70%), different position
  Blob 3: radial-gradient(ellipse, #ec4899 0%, transparent 70%)
SECTION CONTENT:
  1. Hero: large title + subtitle + two CTAs (primary glass + ghost)
  2. Features: 3 icon cards inside glass panel
  3. Stats: large numbers with labels (501 skills, 32 tools, etc.)
  4. Testimonials: quote + avatar
  5. CTA: bold text + form
NAVIGATION: Fixed dots on right side showing current section
DESIGN: Deep void #030308, vibrant gradient blobs, pure white text"""
    },

    "apple_product_scroll": {
        "name": "Apple-Style Product", "icon": "📱",
        "prompt": """Create an Apple iPhone-style 3D product launch page.
IMPORTS: importmap three@0.158.0 + GSAP 3.12.5 + ScrollTrigger CDN
SECTION 1 — Video scrubbing hero (300vh sticky):
  - <video> element muted playsinline, src placeholder video
  - Sticky container height:300vh, video position:sticky top:0 height:100vh width:100% object-fit:cover
  - JS: sync video.currentTime = (scrollProgress * video.duration) with requestAnimationFrame lerp
  - Overlay text that fades in at 33% scroll, fades out at 66%
SECTION 2 — Three.js 3D product (200vh sticky):
  - Phone approximation: BoxGeometry(7, 14, 0.8) body (dark MeshPhysicalMaterial metalness:1 roughness:0.1)
  - Screen: PlaneGeometry(6.2, 12.8) with emissive blue gradient
  - GSAP ScrollTrigger scrub: rotation.y goes 0→Math.PI*2, scale 0.8→1.2→0.8
  - 5 color swatches below canvas: Black/White/Gold/Blue/Red. Click → animate material.color
SECTION 3 — Feature callouts:
  - Split-screen: image left, text right, alternating, ScrollTrigger slide-in from sides
SECTION 4 — Specs grid: monospace table, counter animations
SECTION 5 — CTA: full-width gradient, big text, buy button
DESIGN: White #ffffff body, #000 hero sections, SF Pro system-ui font"""
    },

    "gaming_rgb_showcase": {
        "name": "Gaming RGB Showcase", "icon": "🎮",
        "prompt": """Create an MSI gaming hardware 3D product page.
IMPORTS: importmap three@0.158.0 + EffectComposer + UnrealBloomPass + GSAP CDN
THREE.JS SCENE:
  - Laptop model: 5 BoxGeometry parts — base(20,1,14), lid(20,0.5,14) hinged back, keyboard deck (many 0.4x0.4x0.1 key boxes in grid), screen plane with emissive texture, ventilation slots
  - 4 RGB PointLights: positions around model, each cycles hue at different phase offset (r=sin(t+0), g=sin(t+2), b=sin(t+4)), intensity:3, distance:20
  - UnrealBloomPass: threshold:0.1, strength:2.5, radius:0.4
  - Camera: angled perspective 45°, slight auto-orbit Y +=0.002
CSS EFFECTS:
  - Scanline overlay: ::after with repeating-linear-gradient(transparent 50%, rgba(0,255,0,0.03) 50%), background-size:100% 4px, pointer-events:none, position:fixed
  - Speed lines: 20 divs, position:absolute, thin white lines, CSS animation moving right at different speeds
  - Diagonal section dividers: clip-path:polygon(0 0, 100% 5%, 100% 100%, 0 95%)
SECTIONS: Hero (canvas) → Specs (counter animations: 4.2GHz, 32GB, 240Hz, 165W) → Features grid → Performance charts (pure CSS bars) → Buy CTA
DESIGN: Pure black #000, red #e60000 + cyan #00e5ff accents, condensed Roboto Condensed font"""
    },

    "luxury_glass_objects": {
        "name": "Luxury Glass 3D", "icon": "💎",
        "prompt": """Create a luxury product page with transparent glass 3D objects using Three.js.
IMPORTS: importmap three@0.158.0
SCENE:
  - Background: #080810 void, soft radial gradient via CSS behind canvas
  - 7 transparent glass objects at varying positions/depths:
    * 2x SphereGeometry(1.5), MeshPhysicalMaterial{transmission:1.0, thickness:1.5, roughness:0.0, ior:1.5, color:0xccccff}
    * 2x TorusGeometry(1,0.4,32,100), MeshPhysicalMaterial{transmission:0.9, ior:1.7, color:0xaaccff}
    * 1x IcosahedronGeometry(1.2), MeshPhysicalMaterial{transmission:0.95, roughness:0.05, color:0xffccff}
    * 2x BoxGeometry(1.5,1.5,1.5), MeshPhysicalMaterial{transmission:0.85, metalness:0.1, color:0xeeeeff}
  - RectAreaLight x2 (soft box, 4x4, intensity 8): one purple, one gold
  - Ambient light intensity 0.3
  - Each object gets unique slow rotation (different axes, speeds 0.003-0.007)
  - Objects drift slowly (position += sin(time + offset) * 0.0008)
SCROLL: GSAP ScrollTrigger — on scroll, objects scatter outward, then reassemble on next section
HTML OVERLAY:
  - Hero: huge Cormorant Garamond italic title (10vw), thin weight, letter-spacing 0.1em
  - Minimal nav, centered content
  - Product description in elegant serif below canvas
DESIGN: Dark void, iridescent glass, pure luxury, Cormorant Garamond font throughout"""
    },

    "3d_venue_walkthrough": {
        "name": "3D Venue Tour", "icon": "🏛️",
        "prompt": """Create a 3D architectural venue walkthrough using Three.js.
IMPORTS: importmap three@0.158.0 + OrbitControls + GSAP CDN
SCENE — Procedural modern interior:
  Floor: PlaneGeometry(40,40), rotateX(-π/2), MeshStandardMaterial{color:0xe8e0d0, roughness:0.8, metalness:0.1}
  Walls: 4x BoxGeometry(40,6,0.3) walls forming room perimeter, white material
  Ceiling: PlaneGeometry(40,40) at y=6, white
  Windows: 6x PlaneGeometry(4,3) with MeshPhysicalMaterial{transmission:0.9, color:0x88aaff}
  Furniture: BoxGeometry approximations — reception desk (8x1.2x2), sofa (4x0.8x1.5), chairs, tables
  Ceiling lights: 8x PointLight(0xfff5e0, 2, 12) in grid pattern at y=5.8 + cylinder lamp geometry
  Sunlight shaft: DirectionalLight(0xffeedd, 3) at 45°, castShadow:true
NAVIGATION: 4 floor hotspots (RingGeometry, golden material, hover glow):
  Reception (0,0,5), Lounge (-8,0,-5), Hall (8,0,-5), Terrace (0,0,-15)
  Click hotspot → GSAP tween camera.position to new location + camera.lookAt(center) over 2s ease
SVG MINIMAP: Absolute positioned bottom-right, shows room layout with dot for camera position
LABELS: HTML div labels floating above each hotspot, positioned via vector3.project(camera)
OVERLAY UI: Navigation menu top, room name, "Request Tour" CTA
DESIGN: Bright airy space, warm white/beige palette, minimal Scandinavian aesthetic"""
    },

    "product_lenis_showcase": {
        "name": "Smooth Product Showcase", "icon": "✨",
        "prompt": """Create a premium SaaS product marketing page with Lenis smooth scroll.
CDN: Lenis (unpkg.com/lenis@1.0.45/dist/lenis.min.js) + GSAP 3.12.5 + ScrollTrigger + Three.js importmap
SETUP: new Lenis({lerp:0.08, duration:1.2}); RAF loop: requestAnimationFrame(raf); raf=(t)=>{lenis.raf(t);requestAnimationFrame(raf)}
GSAP: ScrollTrigger.scrollerProxy for Lenis compat
THREE.JS HERO — Product crystal:
  Scene: dark navy #080f1c bg, central CrystalMesh (custom IcosahedronGeometry detail:2, scale non-uniform 1,1.5,1)
  Material: MeshPhysicalMaterial{color:0x3b82f6, metalness:0.0, roughness:0.0, transmission:0.6, ior:1.8, thickness:1.0, envMapIntensity:1.5}
  PMREMGenerator with solid color scene as environment
  Auto-rotate Y += 0.005; On scroll, morphs: rotation.z += scrollProgress*Math.PI, scale changes
  3 point lights orbiting crystal (animated position along circle path)
SECTIONS (all GSAP ScrollTrigger, scrub:false, trigger:enter):
  1. Hero: crystal + massive headline "The Platform" + subtitle + 2 CTAs
  2. Features: 3-column grid, cards enter stagger 0.1s, y:40→0, opacity:0→1
  3. Numbers: 501 / 100% / 32 / 213 — count-up on enter
  4. Pricing: 3 cards, center one highlighted with gradient border
  5. Testimonials: horizontal drag carousel (pointer events)
  6. CTA: full-width, gradient bg, newsletter form
DESIGN: Deep navy #080f1c, electric blue #3b82f6, gold #c9a961, Space Grotesk + Inter fonts"""
    },

    "bespoke_magnetic_agency": {
        "name": "Bespoke Magnetic Agency", "icon": "🖋️",
        "prompt": """Create an ultra-premium boutique agency website with magnetic interactions.
CDN: GSAP 3.12.5 + SplitType (unpkg.com/split-type@0.3.4/umd/index.min.js)
CUSTOM CURSOR:
  Two elements: cursor-dot (6px, white) + cursor-circle (40px, border 1px white, border-radius 50%)
  RAF loop: dot follows mouse instantly; circle lerps (factor 0.12): circleX += (mouseX - circleX) * 0.12
  On hoverable elements: circle scales 2.5x and inverts (mix-blend-mode:difference); cursor-dot hides
  class="hover-magnetic" on buttons triggers both effects
MAGNETIC BUTTONS (class="btn-magnetic"):
  mousemove → measure distance; if within 80px: translate toward cursor: x = (mx-btnCX)*0.35, y = (my-btnCY)*0.35
  mouseleave → gsap.to(btn, {x:0, y:0, duration:0.6, ease:'elastic.out(1,0.4)'})
TYPOGRAPHY ANIMATIONS (GSAP + SplitType):
  Hero h1: split into chars, gsap.from(chars, {y:'110%', stagger:0.035, duration:1.4, ease:'expo.out'})
  Sections: reveal on enter with clip-path:'inset(0 100% 0 0)'→'inset(0 0% 0 0)'
LAYOUT:
  - Nav: horizontal left logo, right menu links with magnetic effect
  - Hero: full viewport, left: giant display text 3 lines mixed sizes (12vw / 7vw / 4vw), right: small descriptor text
  - About: alternating image + text blocks (image in thin vertical strip), text enters from right
  - Work horizontal gallery: pinned section, 5 case study cards slide left on scroll (scrub)
  - Services: numbered list (01-06), each expands on hover
  - Footer: massive centered logo, minimal links
DESIGN: Black #0a0a0a, off-white #f2f0ec, NO accent colors — pure monochrome with micro-texture"""
    },

    "interactive_collectibles_3d": {
        "name": "3D Product Gallery", "icon": "🎯",
        "prompt": """Create an interactive 3D product card gallery using Three.js.
IMPORTS: importmap three@0.158.0 + GSAP CDN
SCENE SETUP:
  Camera: PerspectiveCamera(50, aspect, 0.1, 100), position (0, 0, 12)
  Background: gradient sky (scene.background = texture generated from canvas gradient)
  Sparkle particles: 500 small sprites moving slowly upward, reset at top
6 PRODUCT CARDS (PlaneGeometry(2.8, 3.8)):
  Arrange in arc: angle = -Math.PI/3 + i*(Math.PI/3/2.5), radius=7
  Each card: CanvasTexture showing product info (title, price, category badge, rating stars, color bg)
  MeshStandardMaterial with card texture, double-sided
  Cards face viewer: quaternion.setFromAxisAngle(up, angle) to keep cards facing camera
INTERACTIONS (Raycaster):
  onMouseMove: raycaster intersects cards → hovered card: gsap.to(card.position, {z:card.origZ+1.5, duration:0.3}) + PointLight follows cursor
  onClick hovered card: GSAP tween card to center (0,0,8), scale 1→1.8, show HTML detail panel (DOM overlay)
  Click backdrop/close → card returns to original position
PRODUCT DATA: 6 fake products with names, prices, descriptions, categories
BELOW CANVAS: Product listing grid in HTML (filter by category buttons)
DESIGN: Soft pastel gradient bg (lavender→rose→peach), white cards, gentle shadows, playful Nunito font"""
    },

    "physics_canvas_hero": {
        "name": "Physics Canvas Hero", "icon": "⚽",
        "prompt": """Create an interactive physics simulation landing page.
TECHNIQUE: Canvas 2D API physics, NO external dependencies.
PHYSICS ENGINE (pure JS):
  Ball class: {x, y, vx, vy, r, color, mass}
  gravity = 0.45
  Update per frame: vy += gravity; x += vx; y += vy
  Wall collision: if x-r < 0 || x+r > W: vx *= -0.88; if y+r > H: vy *= -0.78, vx *= 0.98 (friction); if y-r < 0: vy *= -0.7
  Ball-ball collision: distance check, elastic collision response (mass-weighted velocity exchange)
  Energy cap: max speed 15 to prevent tunneling
CANVAS:
  Full width, 55vh height, dark gradient background (#080810 → #120820)
  20 initial balls with random colors (HSL hue variety), sizes 15-35px radius
  Each ball: ctx.beginPath, arc, radialGradient fill (lighter center, darker edge), subtle shadow
  Trail effect: draw previous positions with low opacity (store last 5 positions per ball)
INTERACTIONS:
  Click/touch canvas: spawn new ball at cursor with upward velocity (vy = -12 + random, vx = random±8)
  Long press: spawn 5 balls burst
  Touch on mobile: handle touchstart events
  Ball count display: top-right "⚽ N balls"
BELOW CANVAS: Service/product sections with standard GSAP ScrollTrigger reveals
DESIGN: Dark bg #080810, colorful balls, purple/indigo page theme, fun sans-serif font"""
    },
}

TEMPLATES_JSON = json.dumps(TEMPLATES)

EDITOR_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Crafter Designer Studio</title>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0a0a0f;--bg2:#0f0f17;--bg3:#141420;--bg4:#1a1a2a;
  --border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.12);--border3:rgba(255,255,255,0.18);
  --text:#e2e2ec;--text2:#8888a8;--text3:#444460;
  --gold:#c9a961;--gold2:#e8c97a;--gold-bg:rgba(201,169,97,0.08);
  --blue:#6366f1;--blue2:#818cf8;--blue-bg:rgba(99,102,241,0.08);
  --green:#22c55e;--red:#ef4444;--purple:#a855f7;
  --radius:10px;--radius-sm:6px;
}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);display:flex;flex-direction:column;font-size:13px;-webkit-font-smoothing:antialiased}

/* ── Topbar ── */
.topbar{height:52px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:14px;flex-shrink:0;z-index:200}
.topbar-logo{display:flex;align-items:center;gap:8px;white-space:nowrap}
.topbar-logo-mark{width:26px;height:26px;background:linear-gradient(135deg,var(--gold),#b8973a);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#000}
.topbar-logo-text{font-weight:600;font-size:14px;color:var(--text);letter-spacing:-0.01em}
.topbar-logo-text span{color:var(--gold);font-weight:700}
.topbar-sep{width:1px;height:22px;background:var(--border2);margin:0 2px}
.topbar-mid{flex:1;display:flex;align-items:center;justify-content:center;gap:10px}
.vp-btns{display:flex;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:2px;gap:1px}
.vp-btn{padding:4px 12px;border-radius:4px;border:none;background:transparent;color:var(--text2);cursor:pointer;font-size:11px;font-family:'Inter',sans-serif;transition:all .15s;display:flex;align-items:center;gap:4px}
.vp-btn.active,.vp-btn:hover{background:var(--bg4);color:var(--text)}
.topbar-right{display:flex;align-items:center;gap:8px}
.btn{padding:7px 15px;border-radius:var(--radius-sm);border:none;cursor:pointer;font-size:12px;font-family:'Inter',sans-serif;font-weight:500;transition:all .15s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;line-height:1}
.btn-primary{background:var(--gold);color:#000}
.btn-primary:hover{background:var(--gold2);transform:translateY(-1px)}
.btn-ghost{background:transparent;color:var(--text2);border:1px solid var(--border2)}
.btn-ghost:hover{color:var(--text);background:var(--bg3);border-color:var(--border3)}
.btn-blue{background:var(--blue);color:#fff}
.btn-blue:hover{background:#4f52d8}
.btn-stop{background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)}
.btn-stop:hover{background:rgba(239,68,68,0.25)}
.model-select{background:var(--bg3);border:1px solid var(--border2);color:var(--text);padding:6px 10px;border-radius:var(--radius-sm);font-size:11px;font-family:'Inter',sans-serif;cursor:pointer;outline:none;max-width:200px}

/* ── Layout ── */
.workspace{flex:1;display:flex;overflow:hidden}

/* ── Left Panel (Tab-based) ── */
.left-panel{width:360px;min-width:280px;max-width:480px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}
.tabs-nav{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;padding:0 4px}
.tab-btn{flex:1;padding:12px 4px;border:none;background:transparent;color:var(--text2);cursor:pointer;font-size:11px;font-family:'Inter',sans-serif;font-weight:500;letter-spacing:0.02em;transition:all .15s;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;justify-content:center;gap:5px}
.tab-btn.active{color:var(--text);border-bottom-color:var(--blue)}
.tab-btn:hover:not(.active){color:var(--text);background:rgba(255,255,255,0.03)}
.tab-content{flex:1;overflow-y:auto;display:none}
.tab-content.active{display:flex;flex-direction:column}
.tab-content::-webkit-scrollbar{width:3px}
.tab-content::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}

/* ── Chat Tab ── */
.chat-messages{flex:1;padding:16px 14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
.chat-messages::-webkit-scrollbar{width:3px}
.chat-messages::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px}
.msg-wrap{display:flex;gap:8px;align-items:flex-start}
.msg-wrap.user{flex-direction:row-reverse}
.msg-avatar{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:1px}
.msg-avatar.ai-av{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.msg-avatar.user-av{background:linear-gradient(135deg,var(--gold),#b8973a);color:#000}
.msg-bubble{max-width:85%;padding:10px 13px;border-radius:12px;font-size:12.5px;line-height:1.65;word-break:break-word}
.msg-wrap.user .msg-bubble{background:var(--bg4);border:1px solid var(--border2);border-top-right-radius:4px}
.msg-wrap.ai .msg-bubble{background:var(--blue-bg);border:1px solid rgba(99,102,241,0.2);border-top-left-radius:4px}
.msg-system-line{text-align:center;font-size:11px;color:var(--text3);padding:4px 0}
.msg-bubble strong{color:var(--text);font-weight:600}
.msg-bubble code{background:rgba(255,255,255,0.06);padding:1px 5px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:11px}
.typing-wrap{display:flex;gap:8px;align-items:center}
.typing-dots{display:flex;gap:4px;padding:10px 13px;background:var(--blue-bg);border:1px solid rgba(99,102,241,0.2);border-radius:12px;border-top-left-radius:4px}
.td{width:6px;height:6px;border-radius:50%;background:var(--blue2);animation:tdBounce 1.4s ease infinite}
.td:nth-child(2){animation-delay:.15s}
.td:nth-child(3){animation-delay:.3s}
@keyframes tdBounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-6px);opacity:1}}

/* ── Input area ── */
.chat-input-area{padding:12px 14px;border-top:1px solid var(--border);flex-shrink:0;display:flex;flex-direction:column;gap:8px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{padding:4px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:20px;font-size:11px;color:var(--text2);cursor:pointer;transition:all .15s;white-space:nowrap}
.chip:hover{border-color:var(--gold);color:var(--gold);background:var(--gold-bg)}
.input-row{display:flex;gap:8px;align-items:flex-end}
.chat-textarea{flex:1;padding:10px 12px;background:var(--bg3);border:1px solid var(--border2);color:var(--text);border-radius:var(--radius);font-family:'Inter',sans-serif;font-size:12.5px;line-height:1.55;outline:none;resize:none;overflow:hidden;min-height:42px;max-height:180px;transition:border-color .2s}
.chat-textarea:focus{border-color:rgba(99,102,241,0.5);background:var(--bg4)}
.chat-textarea::placeholder{color:var(--text3)}
.send-btn{width:40px;height:40px;border-radius:var(--radius-sm);border:none;background:var(--blue);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:all .15s}
.send-btn:hover{background:#4f52d8;transform:translateY(-1px)}
.send-btn:disabled{background:var(--bg3);color:var(--text3);cursor:not-allowed;transform:none}
.dna-row{display:flex;gap:6px}
.dna-input{flex:1;padding:6px 10px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);font-size:11px;font-family:'Inter',sans-serif;outline:none}
.dna-input::placeholder{color:var(--text3)}
.dna-btn{padding:6px 10px;background:var(--bg3);border:1px solid var(--border2);color:var(--text2);border-radius:var(--radius-sm);cursor:pointer;font-size:11px;font-family:'Inter',sans-serif;transition:all .15s;white-space:nowrap}
.dna-btn:hover{border-color:var(--gold);color:var(--gold)}

/* ── Templates Tab ── */
.tpl-search{margin:12px;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);font-size:12px;font-family:'Inter',sans-serif;outline:none;width:calc(100% - 24px)}
.tpl-search::placeholder{color:var(--text3)}
.tpl-section-label{padding:8px 14px 4px;font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--text3)}
.tpl-section-label.gold{color:rgba(201,169,97,0.6)}
.tpl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:4px 12px 12px}
.tpl-card{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;gap:6px}
.tpl-card:hover{border-color:var(--gold);background:var(--gold-bg);transform:translateY(-2px)}
.tpl-card:active{transform:translateY(0)}
.tpl-icon{font-size:22px;line-height:1}
.tpl-name{font-size:11px;font-weight:600;color:var(--text);line-height:1.3}
.tpl-card.gold-card{border-color:rgba(201,169,97,0.2);background:rgba(201,169,97,0.03)}
.tpl-card.gold-card:hover{border-color:var(--gold);background:var(--gold-bg)}

/* ── Effects Tab ── */
.effects-search{margin:12px;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);font-size:12px;font-family:'Inter',sans-serif;outline:none;width:calc(100% - 24px)}
.effects-search::placeholder{color:var(--text3)}
.effects-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:4px 12px 12px}
.fx-card{background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);padding:12px;cursor:pointer;transition:all .2s}
.fx-card:hover{border-color:var(--purple);background:rgba(168,85,247,0.06);transform:translateY(-2px)}
.fx-icon{font-size:20px;margin-bottom:5px}
.fx-name{font-size:11px;font-weight:600;color:var(--text);margin-bottom:2px}
.fx-desc{font-size:10px;color:var(--text2);line-height:1.4}
.effects-loading{padding:40px;text-align:center;color:var(--text3);font-size:12px}

/* ── History Tab ── */
.hist-empty{padding:40px 20px;text-align:center;color:var(--text3);font-size:12px}
.hist-list{padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.hist-item{padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;transition:all .15s}
.hist-item:hover{border-color:var(--border3);background:var(--bg4)}
.hist-item-label{font-size:12px;font-weight:500;color:var(--text);margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hist-item-meta{font-size:10px;color:var(--text3);display:flex;justify-content:space-between}
.hist-item-current{border-color:var(--gold);background:var(--gold-bg)}

/* ── Preview Panel ── */
.preview-panel{flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg);position:relative}
.preview-toolbar{height:38px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 14px;gap:8px;flex-shrink:0}
.preview-url-bar{flex:1;background:var(--bg3);border:1px solid var(--border);color:var(--text2);padding:4px 10px;border-radius:20px;font-size:10.5px;font-family:'JetBrains Mono',monospace;cursor:default}
.preview-wrap{flex:1;overflow:auto;background:var(--bg);position:relative;display:flex;align-items:stretch;justify-content:center}
.preview-wrap.desktop iframe{width:100%;height:100%}
.preview-wrap.tablet{background:var(--bg3)}
.preview-wrap.tablet iframe{width:768px;height:100%;border-left:1px solid var(--border2);border-right:1px solid var(--border2)}
.preview-wrap.mobile{background:var(--bg3)}
.preview-wrap.mobile iframe{width:390px;height:100%;border-left:1px solid var(--border2);border-right:1px solid var(--border2);border-radius:14px;overflow:hidden;margin:12px auto}
iframe{border:0;display:block;min-height:100%;background:#fff}
.preview-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);flex-direction:column;gap:16px;z-index:10}
.spinner{width:32px;height:32px;border:2px solid var(--border2);border-top-color:var(--blue);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.preview-gen-label{font-size:12px;color:var(--text2);text-align:center}
.preview-gen-label small{display:block;font-size:10px;color:var(--text3);margin-top:4px}
.preview-empty{opacity:.35;text-align:center}
.preview-empty-icon{font-size:56px;margin-bottom:12px;display:block}
.preview-empty p{font-size:12px;color:var(--text2)}
.preview-empty small{font-size:11px;color:var(--text3);display:block;margin-top:4px}
.gen-progress{width:200px;height:2px;background:var(--border2);border-radius:2px;overflow:hidden}
.gen-progress-bar{height:100%;width:0%;background:linear-gradient(90deg,var(--blue),var(--purple));animation:genPulse 1.5s ease infinite}
@keyframes genPulse{0%{width:0%}50%{width:80%}100%{width:95%}}

/* ── Code Panel ── */
.code-panel{width:300px;min-width:220px;background:var(--bg2);border-left:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0}
.code-panel-header{height:38px;padding:0 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.code-panel-title{font-size:10px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:var(--text2)}
.code-editor-area{flex:1;overflow:auto}
.code-textarea{width:100%;height:100%;min-height:200px;background:transparent;border:none;color:#a8b4d8;font-family:'JetBrains Mono',monospace;font-size:10.5px;line-height:1.65;padding:12px;resize:none;outline:none}
.code-footer{padding:8px 10px;border-top:1px solid var(--border);display:flex;gap:6px;border-bottom:1px solid var(--border)}
.versions-section{flex-shrink:0;max-height:160px;overflow-y:auto}
.version-item{padding:7px 12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
.version-item:hover{background:var(--bg3)}
.version-item.current{border-left:2px solid var(--gold)}
.vi-label{font-size:11px;color:var(--text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
.vi-ts{font-size:9px;color:var(--text3)}

/* ── Status bar ── */
.statusbar{height:24px;background:var(--bg3);border-top:1px solid var(--border);display:flex;align-items:center;padding:0 18px;gap:16px;font-size:10px;color:var(--text3);flex-shrink:0}
.status-dot{width:6px;height:6px;border-radius:50%;background:var(--green);flex-shrink:0}
.status-dot.gen{background:var(--gold);animation:statusPulse 1s ease infinite}
.status-dot.err{background:var(--red)}
@keyframes statusPulse{0%,100%{opacity:1}50%{opacity:.3}}

/* ── Resizer ── */
.resizer{width:4px;background:transparent;cursor:col-resize;flex-shrink:0;transition:background .2s;position:relative}
.resizer:hover,.resizer.dragging{background:var(--blue)}

/* ── Modals ── */
.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:500;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px)}
.modal-backdrop.open{display:flex}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:14px;padding:28px;width:420px;max-width:92vw;max-height:90vh;overflow-y:auto}
.modal h3{font-size:16px;font-weight:600;margin-bottom:18px;color:var(--text)}
.modal label{display:block;font-size:11px;color:var(--text2);margin-bottom:5px;margin-top:12px}
.modal input,.modal textarea{width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);font-size:12px;outline:none;font-family:'Inter',sans-serif}
.modal textarea{resize:vertical;height:80px}
.modal-btns{display:flex;gap:8px;margin-top:20px}
.modal-btns .btn{flex:1;justify-content:center}
.modal-result{margin-top:10px;font-size:11px;color:var(--text2)}

/* ── Notification ── */
.notif{position:fixed;bottom:20px;right:20px;padding:11px 16px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);font-size:12px;color:var(--text);z-index:9999;animation:notifIn .25s ease;display:flex;align-items:center;gap:7px;max-width:300px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.notif.success{border-color:rgba(34,197,94,.4)}
.notif.error{border-color:rgba(239,68,68,.4);color:#fca5a5}
@keyframes notifIn{from{transform:translateY(10px);opacity:0}}

/* ── Responsive ── */
@media(max-width:1200px){.code-panel{display:none}}
@media(max-width:900px){.left-panel{width:300px}}
@media(max-width:700px){.left-panel{width:260px}}
</style>
</head>
<body>

<!-- ══════════════════════ TOPBAR ══════════════════════ -->
<div class="topbar">
  <div class="topbar-logo">
    <div class="topbar-logo-mark">C</div>
    <div class="topbar-logo-text"><span>Crafter</span> Designer</div>
  </div>
  <div class="topbar-sep"></div>
  <div class="topbar-mid">
    <div class="vp-btns">
      <button class="vp-btn" id="vpMobile" onclick="setViewport('mobile',this)">📱 Mobile</button>
      <button class="vp-btn" id="vpTablet" onclick="setViewport('tablet',this)">📲 Tablet</button>
      <button class="vp-btn active" id="vpDesktop" onclick="setViewport('desktop',this)">🖥 Desktop</button>
    </div>
    <div class="topbar-sep"></div>
    <select class="model-select" id="modelSelect" onchange="updateEngineBadge()">
      <optgroup label="Claude (Anthropic)">
        <option value="claude-haiku-4-5">⚡ Haiku 4.5 – rápido</option>
        <option value="claude-sonnet-4-5" selected>⚖ Sonnet 4.5 – equilibrado</option>
        <option value="claude-opus-4-5">🧠 Opus 4.5 – máxima calidad</option>
      </optgroup>
      <optgroup label="Gemini (Google)">
        <option value="gemini-2.5-flash">⚡ Gemini Flash</option>
        <option value="gemini-2.5-pro">🌟 Gemini Pro</option>
      </optgroup>
      <optgroup label="GPT-4.1 (OpenAI)">
        <option value="gpt-4.1-nano">⚡ GPT-4.1 Nano</option>
        <option value="gpt-4.1-mini">⚖ GPT-4.1 Mini</option>
        <option value="gpt-4.1">🧠 GPT-4.1</option>
      </optgroup>
          <optgroup label="Stitch (Google AI)">
        <option value="stitch">🧵 Stitch Generate</option>
        <option value="stitch-landing">🚀 Stitch Landing</option>
        <option value="stitch-component">🧩 Stitch Component</option>
      </optgroup>
      </select>
    <span id="engineBadge" style="font-size:10px;padding:4px 9px;border-radius:20px;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.25)">Claude</span>
  </div>
  <div class="topbar-right">
    <button class="btn btn-ghost" onclick="undoVersion()" title="Deshacer último cambio">↩ Undo</button>
    <button class="btn btn-ghost" onclick="copyHTML()">📋 Copy</button>
    <button class="btn btn-ghost" onclick="exportHTML()">⬇ Export</button>
    <button class="btn btn-ghost" onclick="openNewTab()">↗ Open</button>
    <button class="btn btn-ghost" onclick="openModal('importModal')">🔗 Import URL</button>
    <button class="btn btn-primary" onclick="openModal('deployModal')">🚀 Deploy</button>
  </div>
</div>

<!-- ══════════════════════ WORKSPACE ══════════════════════ -->
<div class="workspace">

  <!-- ── LEFT PANEL ── -->
  <div class="left-panel" id="leftPanel">

    <!-- Tab nav -->
    <div class="tabs-nav">
      <button class="tab-btn active" data-tab="chat" onclick="switchTab('chat')">💬 Chat</button>
      <button class="tab-btn" data-tab="templates" onclick="switchTab('templates')">📐 Templates</button>
      <button class="tab-btn" data-tab="effects" onclick="switchTab('effects')">✨ Effects</button>
      <button class="tab-btn" data-tab="history" onclick="switchTab('history')">🕐 History</button>
    </div>

    <!-- ── CHAT TAB ── -->
    <div class="tab-content active" id="tab-chat" style="flex-direction:column">
      <div class="chat-messages" id="chatMessages">
        <div class="msg-system-line">Bienvenido a Crafter Designer Studio</div>
        <div class="msg-wrap ai">
          <div class="msg-avatar ai-av">✦</div>
          <div class="msg-bubble">Hola! Soy tu asistente de diseño web. Descríbeme la página que quieres crear, elige un template o un efecto. Generaré HTML completo con animaciones y efectos profesionales. <strong>Tip:</strong> después de generar puedes pedirme cambios directamente aquí.</div>
        </div>
      </div>
      <div class="chat-input-area">
        <div class="chips" id="promptChips">
          <span class="chip" onclick="setChip('Añade modo oscuro con toggle')">🌙 Dark mode</span>
          <span class="chip" onclick="setChip('Hazlo más moderno y minimalista')">✨ Modernizar</span>
          <span class="chip" onclick="setChip('Añade sección de precios con 3 planes')">💰 Precios</span>
          <span class="chip" onclick="setChip('Añade animaciones GSAP ScrollTrigger')">⚡ Animaciones</span>
          <span class="chip" onclick="setChip('Añade formulario de contacto con validación')">📬 Contacto</span>
          <span class="chip" onclick="setChip('Hazlo mobile-first responsive')">📱 Mobile</span>
        </div>
        <div class="dna-row">
          <input class="dna-input" id="dnaClientId" placeholder="🧬 Client ID para cargar DNA...">
          <button class="dna-btn" onclick="loadDNA()">Cargar DNA</button>
        </div>
        <div class="input-row">
          <textarea class="chat-textarea" id="chatInput" placeholder="Describe la página que quieres crear... (Ctrl+Enter para enviar)" rows="2"></textarea>
          <button class="send-btn" id="btnSend" onclick="sendMessage()" title="Enviar (Ctrl+Enter)">▶</button>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-stop" id="btnStop" onclick="stopGeneration()" style="display:none;flex:1;justify-content:center">⏹ Detener</button>
          <button class="btn btn-ghost" onclick="newSession()" style="flex:1;justify-content:center;font-size:11px">+ Nueva sesión</button>
        </div>
      </div>
    </div>

    <!-- ── TEMPLATES TAB ── -->
    <div class="tab-content" id="tab-templates">
      <input class="tpl-search" id="tplSearch" placeholder="🔍 Buscar template..." oninput="filterTemplates()">
      <div id="tplContainer"></div>
    </div>

    <!-- ── EFFECTS TAB ── -->
    <div class="tab-content" id="tab-effects">
      <input class="effects-search" id="fxSearch" placeholder="🔍 Buscar efecto..." oninput="filterEffects()">
      <div id="fxContainer"><div class="effects-loading">Cargando efectos...</div></div>
    </div>

    <!-- ── HISTORY TAB ── -->
    <div class="tab-content" id="tab-history">
      <div class="hist-list" id="histList">
        <div class="hist-empty">No hay versiones aún.<br>Genera tu primera página para ver el historial.</div>
      </div>
    </div>

  </div><!-- /left-panel -->

  <!-- ── RESIZER ── -->
  <div class="resizer" id="resizer"></div>

  <!-- ── PREVIEW PANEL ── -->
  <div class="preview-panel" id="previewPanel">
    <div class="preview-toolbar">
      <span style="font-size:9px;color:var(--text3);font-weight:600;letter-spacing:0.1em">PREVIEW</span>
      <div class="preview-url-bar" id="previewUrlBar">about:blank</div>
      <button class="btn btn-ghost" onclick="refreshPreview()" style="padding:4px 9px;font-size:11px">↻</button>
    </div>
    <div class="preview-wrap desktop" id="previewWrap">
      <div class="preview-overlay" id="previewOverlay">
        <div class="preview-empty">
          <span class="preview-empty-icon">🎨</span>
          <p>Tu diseño aparecerá aquí</p>
          <small>Escribe un prompt o elige un template</small>
        </div>
      </div>
      <iframe id="previewFrame" srcdoc="" style="display:none;width:100%;height:100%;border:0"></iframe>
    </div>
  </div>

  <!-- ── CODE PANEL ── -->
  <div class="resizer" id="resizer2"></div>
  <div class="code-panel" id="codePanel">
    <div class="code-panel-header">
      <span class="code-panel-title">HTML Code</span>
      <button class="btn btn-ghost" onclick="applyCode()" style="padding:3px 8px;font-size:10px">▶ Apply</button>
    </div>
    <div class="code-editor-area">
      <textarea class="code-textarea" id="codeEditor" spellcheck="false" placeholder="<!-- El HTML generado aparecerá aquí... -->"></textarea>
    </div>
    <div class="code-footer">
      <button class="btn btn-ghost" onclick="formatCode()" style="flex:1;justify-content:center;font-size:10px">Format</button>
      <button class="btn btn-ghost" onclick="clearAll()" style="font-size:10px;color:var(--red);border-color:rgba(239,68,68,.3)">🗑</button>
    </div>
    <div class="code-panel-header" style="height:32px">
      <span class="code-panel-title">Versions</span>
      <span id="versionCount" style="font-size:10px;color:var(--text3)">0</span>
    </div>
    <div class="versions-section" id="versionsList"></div>
  </div>

</div><!-- /workspace -->

<!-- ── STATUS BAR ── -->
<div class="statusbar">
  <div class="status-dot" id="statusDot"></div>
  <span id="statusText">Ready</span>
  <span id="statusModel" style="color:var(--text2)"></span>
  <span id="statusSize" style="color:var(--text2)"></span>
  <span style="margin-left:auto;color:var(--text3)">Crafter Designer Studio 2026 · <span id="sessionIdBadge"></span></span>
</div>

<!-- ══════════════════════ MODALS ══════════════════════ -->
<div class="modal-backdrop" id="deployModal">
  <div class="modal">
    <h3>🚀 Deploy to Client</h3>
    <label>Client Slug</label>
    <input id="deploySlug" type="text" placeholder="mi-restaurante">
    <label>Page Name</label>
    <input id="deployPage" type="text" value="home">
    <div class="modal-btns">
      <button class="btn btn-blue" onclick="doDeploy()" style="flex:1;justify-content:center">Deploy</button>
      <button class="btn btn-ghost" onclick="closeModal('deployModal')" style="flex:1;justify-content:center">Cancel</button>
    </div>
    <div class="modal-result" id="deployResult"></div>
  </div>
</div>

<div class="modal-backdrop" id="importModal">
  <div class="modal">
    <h3>🔗 Importar desde URL</h3>
    <p style="font-size:11px;color:var(--text2);margin-bottom:4px">Lee cualquier landing, la analiza y la mejora con IA.</p>
    <label>URL de la página</label>
    <input id="importUrl" type="url" placeholder="https://mi-cliente.com">
    <label>Instrucción de mejora (opcional)</label>
    <textarea id="importInstruction" placeholder="Ej: Moderniza el diseño, añade animaciones..."></textarea>
    <div class="modal-btns">
      <button class="btn btn-blue" onclick="doImportURL()" id="btnImport" style="flex:1;justify-content:center">🔗 Importar</button>
      <button class="btn btn-ghost" onclick="closeModal('importModal')" style="flex:1;justify-content:center">Cancelar</button>
    </div>
    <div class="modal-result" id="importResult"></div>
  </div>
</div>

<!-- ══════════════════════ SCRIPT ══════════════════════ -->
<script>
const TEMPLATES = """ + TEMPLATES_JSON + """;

// ── State ──
let sessionId = 'design_' + Date.now();
let currentHTML = '';
let versions = [];
let chatHistory = [];  // [{role:'user'|'assistant', content:str}]
let generating = false;
let abortCtrl = null;
let allEffects = [];

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  // Import from other pages (Web Lab → Designer, Stitch Studio → Designer)
  const importedHtml = sessionStorage.getItem('designerImport');
  if (importedHtml) {
    sessionStorage.removeItem('designerImport');
    currentHTML = importedHtml;
    updatePreview(importedHtml, true);
    document.getElementById('codeEditor').value = importedHtml;
    addMsg('ai', '✅ **Diseño importado** desde Web Lab / Stitch Studio — ya puedes editarlo con AI');
  }
  const importedPrompt = sessionStorage.getItem('designerPrompt');
  if (importedPrompt) {
    sessionStorage.removeItem('designerPrompt');
    setTimeout(() => {
      document.getElementById('chatInput').value = importedPrompt;
      addMsg('system', '💡 Prompt cargado desde Web Lab — presiona Ctrl+Enter para generar');
    }, 500);
  }
  updateEngineBadge();
  renderTemplates(Object.entries(TEMPLATES));
  loadEffects();
  autoResizeTextarea(document.getElementById('chatInput'));
  document.getElementById('sessionIdBadge').textContent = '#' + sessionId.slice(-6);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('codeEditor').addEventListener('input', debounce(() => {
    const html = document.getElementById('codeEditor').value;
    if (html.includes('</html>')) updatePreview(html, false);
  }, 900));
  setupResizer('resizer','leftPanel','previewPanel');
  setupResizer('resizer2','previewPanel','codePanel');
});

// ── Tab switching ──
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + name));
}

// ── Engine badge ──
function updateEngineBadge() {
  const val = document.getElementById('modelSelect').value;
  const b = document.getElementById('engineBadge');
  if (val.startsWith('gemini'))       { b.textContent='🌟 Gemini'; b.style.background='rgba(66,133,244,0.1)'; b.style.color='#74a9ff'; b.style.borderColor='rgba(66,133,244,0.3)'; }
  else if (val.startsWith('gpt'))     { b.textContent='🤖 GPT'; b.style.background='rgba(16,185,129,0.1)'; b.style.color='#6ee7b7'; b.style.borderColor='rgba(16,185,129,0.3)'; }
  else                                { b.textContent='🧠 Claude'; b.style.background='rgba(99,102,241,0.1)'; b.style.color='#818cf8'; b.style.borderColor='rgba(99,102,241,0.25)'; }
}

// ── Chips ──
function setChip(text) {
  const ta = document.getElementById('chatInput');
  ta.value = text;
  ta.dispatchEvent(new Event('input'));
  ta.focus();
  switchTab('chat');
}

// ── Templates ──
function renderTemplates(entries) {
  const c = document.getElementById('tplContainer');
  c.innerHTML = '';
  const std = entries.filter(([k]) => !k.startsWith('3d_') && !k.startsWith('cinematic') && !k.startsWith('parallax') && !k.startsWith('glass') && !k.startsWith('apple') && !k.startsWith('gaming') && !k.startsWith('luxury') && !k.startsWith('agency') && !k.startsWith('interactive') && !k.startsWith('physics'));
  const immersive = entries.filter(([k]) => k.startsWith('3d_') || k.startsWith('cinematic') || k.startsWith('parallax') || k.startsWith('glass') || k.startsWith('apple') || k.startsWith('gaming') || k.startsWith('luxury') || k.startsWith('agency') || k.startsWith('interactive') || k.startsWith('physics'));
  if (std.length) {
    c.innerHTML += '<div class="tpl-section-label">Landing & UI</div>';
    const g = document.createElement('div'); g.className = 'tpl-grid'; c.appendChild(g);
    std.forEach(([key, t]) => {
      const card = document.createElement('div');
      card.className = 'tpl-card';
      card.innerHTML = '<div class="tpl-icon">' + t.icon + '</div><div class="tpl-name">' + t.name + '</div>';
      card.onclick = () => { document.getElementById('chatInput').value = t.prompt; switchTab('chat'); sendMessage(); };
      g.appendChild(card);
    });
  }
  if (immersive.length) {
    c.innerHTML += '<div class="tpl-section-label gold">✦ 3D Immersive</div>';
    const g2 = document.createElement('div'); g2.className = 'tpl-grid'; c.appendChild(g2);
    immersive.forEach(([key, t]) => {
      const card = document.createElement('div');
      card.className = 'tpl-card gold-card';
      card.innerHTML = '<div class="tpl-icon">' + t.icon + '</div><div class="tpl-name">' + t.name + '</div>';
      card.onclick = () => { document.getElementById('chatInput').value = t.prompt; switchTab('chat'); sendMessage(); };
      g2.appendChild(card);
    });
  }
  if (!std.length && !immersive.length) c.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text3);font-size:12px">No hay templates que coincidan</div>';
}

function filterTemplates() {
  const q = document.getElementById('tplSearch').value.toLowerCase();
  if (!q) { renderTemplates(Object.entries(TEMPLATES)); return; }
  renderTemplates(Object.entries(TEMPLATES).filter(([k,t]) => t.name.toLowerCase().includes(q) || k.includes(q)));
}

// ── Effects ──
async function loadEffects() {
  try {
    const r = await fetch('/api/prompts/effects');
    const data = await r.json();
    // Accept array or object with templates key
    allEffects = Array.isArray(data) ? data : (data.templates || data.effects || []);
    if (!allEffects.length && typeof data === 'object') {
      allEffects = Object.entries(data).map(([k,v]) => ({id:k, name:v.name||k, icon:v.icon||'✨', description:v.description||'', prompt:v.prompt||''}));
    }
    renderEffects(allEffects);
  } catch(e) {
    // Fallback to 3D refs
    try {
      const r = await fetch('/api/designer/effects');
      const data = await r.json();
      const repos = data.repos || [];
      allEffects = repos.map(r => ({id:r.id, name:r.title||r.id, icon:'✨', description:r.description||'', prompt:r.prompt_snippet||''}));
      renderEffects(allEffects);
    } catch(e2) {
      document.getElementById('fxContainer').innerHTML = '<div class="effects-loading">No se pudieron cargar los efectos</div>';
    }
  }
}

function renderEffects(effects) {
  const c = document.getElementById('fxContainer');
  if (!effects.length) { c.innerHTML = '<div class="effects-loading">No hay efectos disponibles</div>'; return; }
  const g = document.createElement('div'); g.className = 'effects-grid';
  effects.forEach(fx => {
    const card = document.createElement('div');
    card.className = 'fx-card';
    card.innerHTML = '<div class="fx-icon">' + (fx.icon||'✨') + '</div><div class="fx-name">' + (fx.name||fx.id) + '</div><div class="fx-desc">' + (fx.description||'').slice(0,80) + '</div>';
    card.onclick = () => {
      const p = fx.prompt || ('Añade el efecto ' + (fx.name||fx.id) + ' a la página actual');
      document.getElementById('chatInput').value = p.slice(0,500);
      switchTab('chat');
      sendMessage();
    };
    g.appendChild(card);
  });
  c.innerHTML = ''; c.appendChild(g);
}

function filterEffects() {
  const q = document.getElementById('fxSearch').value.toLowerCase();
  renderEffects(q ? allEffects.filter(f => (f.name||'').toLowerCase().includes(q) || (f.description||'').toLowerCase().includes(q)) : allEffects);
}

// ── Chat ──
function addMsg(role, text) {
  const msgs = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + role;
  const av = document.createElement('div');
  av.className = 'msg-avatar ' + (role === 'user' ? 'user-av' : 'ai-av');
  av.textContent = role === 'user' ? 'U' : '✦';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  // Simple markdown-ish rendering
  bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
  wrap.appendChild(av); wrap.appendChild(bubble);
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
  return wrap;
}

function showTyping() {
  const msgs = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = 'typing-wrap'; el.id = 'typingEl';
  const av = document.createElement('div'); av.className = 'msg-avatar ai-av'; av.textContent = '✦';
  const dots = document.createElement('div'); dots.className = 'typing-dots';
  dots.innerHTML = '<div class="td"></div><div class="td"></div><div class="td"></div>';
  el.appendChild(av); el.appendChild(dots);
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() { const e = document.getElementById('typingEl'); if(e) e.remove(); }

function scrollChat() { const c = document.getElementById('chatMessages'); c.scrollTop = c.scrollHeight; }

// ── Auto-resize textarea ──
function autoResizeTextarea(el) {
  el.addEventListener('input', () => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  });
}

// ── Send + Generate ──
async function sendMessage() {
  if (generating) return;
  const input = document.getElementById('chatInput');
  const prompt = input.value.trim();
  if (!prompt) return;
  input.value = ''; input.style.height = 'auto';
  addMsg('user', prompt);
  await generate(prompt);
}

async function generate(prompt) {
    // Stitch integration
    if (model && model.startsWith('stitch')) {
      await generateWithStitch(prompt, model);
      return;
    }

  generating = true;
  abortCtrl = new AbortController();
  const model = document.getElementById('modelSelect').value;
  setStatus('gen');
  document.getElementById('btnSend').disabled = true;
  document.getElementById('btnSend').style.opacity = '0.5';
  document.getElementById('btnStop').style.display = 'flex';
  showTyping();

  // Show overlay with progress animation
  const overlay = document.getElementById('previewOverlay');
  const engineLabel = model.startsWith('gemini') ? '🌟 Gemini' : model.startsWith('gpt') ? '🤖 GPT-4.1' : '🧠 Claude';
  overlay.style.display = 'flex';
  overlay.innerHTML = '<div class="spinner"></div><div class="preview-gen-label">Generando con ' + engineLabel + '<small>' + model + '</small></div><div class="gen-progress"><div class="gen-progress-bar"></div></div>';
  document.getElementById('previewFrame').style.display = 'none';

  try {
    const resp = await fetch('/api/designer/generate-stream', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      signal: abortCtrl.signal,
      body: JSON.stringify({
        session_id: sessionId,
        prompt,
        current_html: currentHTML,
        model,
        stream: true,
        history: chatHistory.slice(-12)
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({detail:'Error'}));
      throw new Error(err.detail || 'Generation failed');
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let lastPreview = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      html += decoder.decode(value, {stream:true});
      document.getElementById('codeEditor').value = html;
      document.getElementById('statusSize').textContent = (html.length/1024).toFixed(1) + ' KB';
      const now = Date.now();
      if (now - lastPreview > 450 && html.length > 300) {
        updatePreview(html.includes('</html>') ? html : html + '</html>', false);
        lastPreview = now;
      }
    }
    removeTyping();
    currentHTML = html;
    updatePreview(html, true);
    saveVersion(prompt);
    document.getElementById('codeEditor').value = html;
    // Update chat history for multi-turn
    chatHistory.push({role:'user', content: prompt});
    chatHistory.push({role:'assistant', content: '[HTML generado: ' + (html.length/1024).toFixed(1) + 'KB]'});
    if (chatHistory.length > 24) chatHistory = chatHistory.slice(-24);
    addMsg('ai', '✅ **Generado:** ' + (html.length/1024).toFixed(1) + 'KB · Puedes pedir cambios directamente: _"hazlo más oscuro"_, _"añade precios"_, _"cambia los colores"_...');
    setStatus('ok');
  } catch(e) {
    removeTyping();
    if (e.name === 'AbortError') {
      addMsg('ai', '⏹ Generación detenida.');
      if (currentHTML) updatePreview(currentHTML, true);
      else overlay.style.display = 'flex';
    } else {
      addMsg('ai', '❌ Error: ' + e.message + '. Verifica que **ANTHROPIC_API_KEY** esté configurada.');
      overlay.innerHTML = '<p style="color:var(--red);font-size:12px">Error: ' + e.message + '</p>';
    }
    setStatus('err');
  } finally {
    generating = false;
    abortCtrl = null;
    document.getElementById('btnSend').disabled = false;
    document.getElementById('btnSend').style.opacity = '1';
    document.getElementById('btnStop').style.display = 'none';
  }
}

function stopGeneration() {
  if (abortCtrl) { abortCtrl.abort(); }
}

// ── Preview ──
function updatePreview(html, final) {
  const frame = document.getElementById('previewFrame');
  frame.srcdoc = html;
  frame.style.display = 'block';
  if (final) {
    document.getElementById('previewOverlay').style.display = 'none';
    document.getElementById('previewUrlBar').textContent = 'preview://' + sessionId.slice(-8);
  }
}

function setViewport(mode, btn) {
  document.getElementById('previewWrap').className = 'preview-wrap ' + mode;
  document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function refreshPreview() { if(currentHTML) updatePreview(currentHTML, true); }

// ── Versions (History tab) ──
function saveVersion(prompt) {
  versions.unshift({id:Date.now(), label:prompt.slice(0,50), html:currentHTML, ts:new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})});
  if (versions.length > 25) versions.pop();
  renderVersions();
  document.getElementById('versionCount').textContent = versions.length;
}

function renderVersions() {
  // Sidebar code panel versions
  const list = document.getElementById('versionsList');
  list.innerHTML = '';
  versions.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'version-item' + (i===0?' current':'');
    el.innerHTML = '<div class="vi-label">' + (i===0?'★ ':'') + 'v'+(versions.length-i)+': '+v.label+'</div><div class="vi-ts">'+v.ts+'</div>';
    el.onclick = () => { currentHTML=v.html; document.getElementById('codeEditor').value=v.html; updatePreview(v.html,true); notify('Version restaurada','success'); };
    list.appendChild(el);
  });
  // History tab
  const hist = document.getElementById('histList');
  if (!versions.length) {
    hist.innerHTML = '<div class="hist-empty">No hay versiones aún.<br>Genera tu primera página para ver el historial.</div>';
    return;
  }
  hist.innerHTML = '';
  versions.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'hist-item' + (i===0?' hist-item-current':'');
    el.innerHTML = '<div class="hist-item-label">' + (i===0?'★ Actual · ':'') + v.label + '</div><div class="hist-item-meta"><span>v'+(versions.length-i)+'</span><span>'+v.ts+'</span></div>';
    el.onclick = () => { currentHTML=v.html; document.getElementById('codeEditor').value=v.html; updatePreview(v.html,true); notify('Version restaurada','success'); };
    hist.appendChild(el);
  });
}

function undoVersion() {
  if (versions.length < 2) { notify('No hay versión anterior','error'); return; }
  const prev = versions[1];
  currentHTML = prev.html;
  document.getElementById('codeEditor').value = prev.html;
  updatePreview(prev.html, true);
  notify('Versión anterior restaurada','success');
}

// ── Code panel actions ──
function applyCode() { const h=document.getElementById('codeEditor').value; if(h){currentHTML=h;updatePreview(h,true);notify('Aplicado','success');} }
function formatCode() { const ta=document.getElementById('codeEditor'); ta.value=ta.value.replace(/></g,'>\n<').replace(/\n{3,}/g,'\n\n'); notify('Formateado','success'); }
function copyHTML() { if(!currentHTML){notify('Nada que copiar','error');return;} navigator.clipboard.writeText(currentHTML).then(()=>notify('¡Copiado!','success')); }
function exportHTML() {
  if(!currentHTML){notify('Nada que exportar','error');return;}
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([currentHTML],{type:'text/html'}));
  a.download='crafter-design-'+sessionId.slice(-8)+'.html'; a.click(); notify('¡Descargado!','success');
}
function openNewTab() {
  if(!currentHTML){notify('Nada que previsualizar','error');return;}
  const w=window.open(); w.document.write(currentHTML); w.document.close();
}
function clearAll() {
  if(!confirm('¿Limpiar todo?')) return;
  currentHTML=''; document.getElementById('codeEditor').value='';
  document.getElementById('previewFrame').style.display='none';
  document.getElementById('previewOverlay').style.display='flex';
  document.getElementById('previewOverlay').innerHTML='<div class="preview-empty"><span class="preview-empty-icon">🎨</span><p>Tu diseño aquí</p></div>';
}

// ── Session ──
function newSession() {
  sessionId='design_'+Date.now(); currentHTML=''; versions=[]; chatHistory=[];
  document.getElementById('codeEditor').value='';
  document.getElementById('chatMessages').innerHTML='<div class="msg-system-line">Nueva sesión iniciada</div>';
  document.getElementById('previewFrame').style.display='none';
  document.getElementById('previewOverlay').style.display='flex';
  document.getElementById('previewOverlay').innerHTML='<div class="preview-empty"><span class="preview-empty-icon">🎨</span><p>Tu diseño aquí</p><small>Escribe un prompt o elige un template</small></div>';
  document.getElementById('sessionIdBadge').textContent='#'+sessionId.slice(-6);
  renderVersions();
  document.getElementById('versionCount').textContent='0';
  notify('Nueva sesión','success');
}

// ── DNA ──
async function loadDNA() {
  const clientId = document.getElementById('dnaClientId').value.trim();
  if (!clientId) { notify('Introduce un client ID','error'); return; }
  try {
    const r = await fetch('/api/dna/' + encodeURIComponent(clientId));
    if (!r.ok) throw new Error('DNA no encontrado');
    const dna = await r.json();
    const ctx = [
      dna.identity?.brand_name ? 'Marca: '+dna.identity.brand_name : '',
      dna.identity?.sector ? 'Sector: '+dna.identity.sector : '',
      dna.voice?.tone ? 'Tono: '+dna.voice.tone : '',
      dna.preferences?.colors?.length ? 'Colores: '+dna.preferences.colors.join(', ') : '',
      dna.preferences?.fonts?.length ? 'Tipografías: '+dna.preferences.fonts.join(', ') : '',
    ].filter(Boolean).join(' · ');
    const ta = document.getElementById('chatInput');
    const prefix = '[DNA '+(dna.identity?.brand_name||clientId)+': '+ctx+'] ';
    if (!ta.value.startsWith('[DNA')) ta.value = prefix + ta.value;
    notify('🧬 DNA de '+(dna.identity?.brand_name||clientId)+' cargado','success');
  } catch(e) { notify('DNA error: '+e.message,'error'); }
}

// ── Modals ──
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) closeModal(e.target.id);
});

// ── Deploy ──
async function doDeploy() {
  const slug=document.getElementById('deploySlug').value.trim();
  const page=document.getElementById('deployPage').value.trim()||'home';
  if(!slug){notify('Introduce un client slug','error');return;}
  document.getElementById('deployResult').textContent='Deploying...';
  try {
    const r=await fetch('/api/designer/deploy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sessionId,client_slug:slug,page_name:page})});
    const data=await r.json();
    if(data.url) document.getElementById('deployResult').innerHTML='✅ Deployed: <a href="'+data.url+'" target="_blank" style="color:var(--gold)">'+data.url+'</a>';
  } catch(e) { document.getElementById('deployResult').textContent='Error: '+e.message; }
}

// ── Import URL ──
async function doImportURL() {
  const url=document.getElementById('importUrl').value.trim();
  const instruction=document.getElementById('importInstruction').value.trim();
  if(!url){notify('Introduce una URL válida','error');return;}
  const btn=document.getElementById('btnImport'); const res=document.getElementById('importResult');
  btn.disabled=true; btn.textContent='⏳ Importando...'; res.textContent='Leyendo la página...';
  try {
    const r=await fetch('/api/designer/import-url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,instruction})});
    if(!r.ok) { const e=await r.json().catch(()=>({detail:'Error'})); throw new Error(e.detail||'Error'); }
    const data=await r.json();
    currentHTML=data.html||'';
    document.getElementById('codeEditor').value=currentHTML;
    updatePreview(currentHTML,true);
    closeModal('importModal');
    addMsg('ai','✅ Importado desde '+url+' ('+(currentHTML.length/1024).toFixed(1)+'KB). Puedes pedir mejoras directamente aquí.');
    saveVersion('Import: '+url.replace('https://','').slice(0,40));
    setStatus('ok');
    notify('¡Importado!','success');
  } catch(e) { res.innerHTML='<span style="color:var(--red)">❌ '+e.message+'</span>'; }
  finally { btn.disabled=false; btn.textContent='🔗 Importar'; }
}

// ── Status ──
function setStatus(type) {
  const dot=document.getElementById('statusDot'); const txt=document.getElementById('statusText');
  dot.className='status-dot'+(type==='gen'?' gen':type==='err'?' err':'');
  txt.textContent=type==='gen'?'Generando...':type==='err'?'Error':'Ready';
  const sel=document.getElementById('modelSelect');
  document.getElementById('statusModel').textContent=sel.options[sel.selectedIndex]?.text||'';
}

// ── Resizable panels ──
function setupResizer(resizerId, leftId, rightId) {
  const r=document.getElementById(resizerId);
  const L=document.getElementById(leftId);
  const R=document.getElementById(rightId);
  if(!r||!L||!R) return;
  let dragging=false, startX=0, startLW=0;
  r.addEventListener('mousedown', e=>{dragging=true;startX=e.clientX;startLW=L.getBoundingClientRect().width;r.classList.add('dragging');e.preventDefault();});
  document.addEventListener('mousemove', e=>{
    if(!dragging) return;
    const delta=e.clientX-startX;
    const nw=Math.max(200,Math.min(600,startLW+delta));
    L.style.width=nw+'px';
  });
  document.addEventListener('mouseup', ()=>{dragging=false;document.getElementById(resizerId)?.classList.remove('dragging');});
}

// ── Notify ──
function notify(msg, type='success') {
  const el=document.createElement('div'); el.className='notif '+type;
  el.innerHTML=(type==='success'?'✅ ':'❌ ')+msg;
  document.body.appendChild(el); setTimeout(()=>el.remove(),3000);
}

function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

// ── Stitch Integration ──────────────────────────────────────────────────────
async function generateWithStitch(prompt, model) {
  const skill = model === 'stitch-landing' ? 'stitch::generate-landing' :
                model === 'stitch-component' ? 'stitch::generate-component' :
                'stitch::generate-design';
  addMsg('ai', '🧵 Generando con Google Stitch (' + skill + ')...');
  setStatus('gen');
  try {
    const resp = await fetch('/api/stitch/generate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        prompt: prompt,
        style: 'modern',
        output_format: 'html',
        responsive: true,
        include_animations: true,
      }),
    });
    const data = await resp.json();
    const html = data.result || data.output || '';
    if (html && html.length > 100) {
      currentHTML = html;
      updatePreview(html, true);
      document.getElementById('codeEditor').value = html;
      const via = data.via === 'claude-fallback' ? '⚡ vía Claude fallback' : '🧵 vía Stitch MCP';
      addMsg('ai', '✅ **Stitch generó:** ' + (html.length/1024).toFixed(1) + 'KB ' + via);
      saveVersion('[Stitch] ' + prompt.slice(0,40));
    } else {
      addMsg('ai', '⚠️ Stitch devolvió resultado vacío. Usa el modo Claude.');
    }
  } catch(e) {
    addMsg('ai', '❌ Error Stitch: ' + e.message);
  } finally {
    setStatus('ok');
  }
}
</script>
</body>
</html>"""


def register_designer(app: FastAPI):
    r = APIRouter(prefix="/api/designer", tags=["claude-designer"])

    @r.get("/studio")
    async def studio_ui():
        return HTMLResponse(EDITOR_HTML)

    @r.post("/generate")
    async def generate(req: DesignRequest):
        html_chunks = []
        async for chunk in _generate_html(req.prompt, req.current_html or "", req.model, req.history):
            html_chunks.append(chunk)
        html = _strip_md_fences("".join(html_chunks))
        session = _load_session(req.session_id or f"design_{uuid.uuid4().hex[:8]}")
        session["current_html"] = html
        session["title"] = req.prompt[:50]
        if not session.get("versions"):
            session["versions"] = []
        session["versions"].insert(0, {"html": html, "prompt": req.prompt[:60], "ts": _now()})
        session["versions"] = session["versions"][:20]
        _save_session(session)
        return {"html": html, "session_id": session["session_id"], "size": len(html)}

    @r.post("/generate-stream")
    async def generate_stream(req: DesignRequest):
        async def streamer():
            html_chunks = []
            first_sent = False
            async for chunk in _generate_html(req.prompt, req.current_html or "", req.model, req.history):
                html_chunks.append(chunk)
                # Skip markdown fence prefix before yielding
                if not first_sent:
                    combined = "".join(html_chunks)
                    doc_start = combined.find('<!DOCTYPE')
                    if doc_start == -1:
                        doc_start = combined.find('<html')
                    if doc_start > 0:
                        yield combined[doc_start:]
                        html_chunks = [combined[doc_start:]]
                        first_sent = True
                    elif doc_start == 0:
                        yield chunk
                        first_sent = True
                    # else: still collecting prefix, don't yield yet
                else:
                    yield chunk
            html = _strip_md_fences("".join(html_chunks))
            session = _load_session(req.session_id or f"design_{uuid.uuid4().hex[:8]}")
            session["current_html"] = html
            session["title"] = req.prompt[:50]
            if not session.get("versions"):
                session["versions"] = []
            session["versions"].insert(0, {"html": html, "prompt": req.prompt[:60], "ts": _now()})
            session["versions"] = session["versions"][:20]
            _save_session(session)
        return StreamingResponse(streamer(), media_type="text/plain")

    @r.get("/sessions")
    async def sessions():
        result = []
        for f in DESIGN_SESSIONS.glob("*.json"):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                result.append({"session_id": data["session_id"], "title": data.get("title","Untitled"),
                    "updated_at": data.get("updated_at",""), "size": len(data.get("current_html",""))})
            except Exception:
                pass
        result.sort(key=lambda x: x["updated_at"], reverse=True)
        return {"sessions": result}

    @r.get("/sessions/{session_id}")
    async def get_session(session_id: str):
        return _load_session(session_id)

    @r.delete("/sessions/{session_id}")
    async def delete_session(session_id: str):
        f = DESIGN_SESSIONS / f"{session_id}.json"
        if f.exists():
            f.unlink()
            return {"deleted": True}
        return {"deleted": False}

    @r.post("/deploy")
    async def deploy_to_client(req: DeployRequest):
        session = _load_session(req.session_id)
        html = session.get("current_html", "")
        if not html:
            raise HTTPException(400, "No HTML in session")
        client_dir = CRAFTER_BASE / "clients" / req.client_slug / "landings"
        client_dir.mkdir(parents=True, exist_ok=True)
        page_file = client_dir / f"{req.page_name}.html"
        page_file.write_text(html, encoding="utf-8")
        url = f"/sites/{req.client_slug}/{req.page_name}"
        return {"ok": True, "url": url, "path": str(page_file), "size": len(html)}

    @r.get("/templates")
    async def get_templates():
        from fastapi.responses import JSONResponse
        import json as _json
        return JSONResponse(content={"templates": TEMPLATES}, headers={"Content-Type": "application/json; charset=utf-8"})

    @r.get("/effects")
    async def get_3d_effects():
        """Return 3D effect reference library."""
        from fastapi.responses import JSONResponse
        refs = _load_3d_refs()
        return JSONResponse(content=refs)

    @r.get("/sessions/{session_id}/export")
    async def export_session_html(session_id: str):
        """Download session HTML as a file."""
        from fastapi.responses import Response
        session = _load_session(session_id)
        html = session.get("current_html", "")
        if not html:
            raise HTTPException(404, "No HTML in session")
        title = session.get("title", "crafter-design")[:30].replace(" ", "-").lower()
        fname = f"{title}-{session_id[-8:]}.html"
        return Response(content=html, media_type="text/html",
                        headers={"Content-Disposition": f'attachment; filename="{fname}"'})

    @r.post("/import-url")
    async def import_url_page(request: Request):
        """Fetch a live URL, extract its HTML, optionally improve it with AI."""
        body = await request.json()
        url = body.get("url", "").strip()
        instruction = body.get("instruction", "").strip()
        if not url:
            raise HTTPException(400, "URL requerida")
        if not url.startswith("http"):
            url = "https://" + url
        try:
            import httpx
            async with httpx.AsyncClient(timeout=20, follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (compatible; CrafterBot/1.0)"}) as c:
                resp = await c.get(url)
                raw_html = resp.text
        except Exception as e:
            raise HTTPException(502, f"No se pudo leer la URL: {e}")
        # Truncate to first 80KB to avoid huge pages
        raw_html = raw_html[:80000]
        if not instruction:
            # Return as-is (just import, no AI improvement)
            return {"html": raw_html, "improved": False, "url": url, "size": len(raw_html)}
        # Use AI to improve the page
        improve_prompt = (
            f"Aqui tienes el HTML de una landing existente extraida de {url}. "
            f"Tu tarea: {instruction}. "
            f"Devuelve el HTML completo mejorado, moderno y con mejor diseño. "
            f"Mantén la estructura y contenido originales. Mejora CSS, animaciones, tipografía, layout y UX."
        )
        html_chunks = []
        async for chunk in _generate_html(improve_prompt, raw_html, "claude-sonnet-4-5"):
            html_chunks.append(chunk)
        improved_html = _strip_md_fences("".join(html_chunks))
        if not improved_html or len(improved_html) < 200:
            improved_html = raw_html
        return {"html": improved_html, "improved": True, "url": url, "size": len(improved_html)}

    @r.get("/health")
    async def health():
        key = os.environ.get("ANTHROPIC_API_KEY", "")
        return {
            "version": "claude-designer-v2-2026",
            "model_default": "claude-sonnet-4-5",
            "models_available": ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"],
            "features": ["streaming", "templates", "sessions", "deploy", "responsive_preview", "code_editor", "versions"],
            "api_key_configured": bool(key),
            "templates_count": len(TEMPLATES),
        }

    app.include_router(r)
