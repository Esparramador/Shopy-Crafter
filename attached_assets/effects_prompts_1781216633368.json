"""
_web_lab_engine.py
DNA Extractor + Parallel Brand Research + AI Redesign
Routes: /api/weblab/*

Flow:
  POST /api/weblab/analyze  → SSE stream: fetch → DNA → 8 parallel sources
  POST /api/weblab/improve  → SSE stream: Claude redesign generation
  GET  /api/weblab/proxy    → CORS-free URL proxy for frontend
"""
import os, re, json, asyncio, httpx
from urllib.parse import urlparse, quote_plus, urljoin
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
TIMEOUT = 14.0
HDR = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
}

# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    url: str
    deep: bool = True

class ImproveRequest(BaseModel):
    dna: dict
    research: dict
    instructions: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Low-level fetch
# ─────────────────────────────────────────────────────────────────────────────
async def _fetch(url: str, extra_headers: dict = None) -> dict:
    try:
        h = {**HDR, **(extra_headers or {})}
        async with httpx.AsyncClient(headers=h, timeout=TIMEOUT, follow_redirects=True) as c:
            r = await c.get(url)
            return {"html": r.text, "status": r.status_code, "url": str(r.url)}
    except Exception as e:
        return {"html": "", "status": 0, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# DNA extraction
# ─────────────────────────────────────────────────────────────────────────────
_TRIVIAL_COLORS = {
    "#ffffff","#fff","#000000","#000","#333333","#333","#555555","#555",
    "#666666","#666","#777777","#777","#888888","#888","#999999","#999",
    "#aaaaaa","#aaa","#bbbbbb","#bbb","#cccccc","#ccc","#dddddd","#ddd",
    "#eeeeee","#eee","transparent","inherit","initial","unset",
}

def _extract_palette(css: str) -> list:
    """Return up to 8 distinct non-trivial hex colors found in CSS."""
    seen, out = set(), []
    # CSS variable values first (highest semantic value)
    for m in re.finditer(
        r'--[\w-]*(?:color|primary|secondary|accent|brand|bg|background)[\w-]*\s*:\s*(#[0-9a-fA-F]{3,8})',
        css, re.I
    ):
        h = m.group(1)[:7].lower()
        if h not in _TRIVIAL_COLORS and h not in seen:
            seen.add(h); out.append(h)
    # All hex colors in property values
    for m in re.finditer(r'(?:background|color|border|fill|stroke)[^:;{]*:\s*(#[0-9a-fA-F]{6})', css, re.I):
        h = m.group(1).lower()
        if h not in _TRIVIAL_COLORS and h not in seen and len(out) < 8:
            seen.add(h); out.append(h)
    return out[:8]

def _extract_fonts(html: str) -> list:
    fonts = []
    # Google Fonts URL (most reliable)
    for chunk in re.findall(r'fonts\.googleapis\.com/css[^"\']*family=([^&"\'#\s]+)', html):
        for name in chunk.replace('%7C', '|').split('|'):
            clean = re.sub(r':[^|&\s]*', '', name).replace('+', ' ').strip()
            if clean: fonts.append(clean)
    # @font-face / font-family declarations
    skip = {'inherit','initial','unset','sans-serif','serif','monospace','cursive',
            'fantasy','system-ui','-apple-system','arial','helvetica','georgia',
            'times new roman','verdana','trebuchet ms','impact','comic sans ms'}
    for f in re.findall(r'font-family\s*:\s*["\']?([^,;"\'\n}{/]+)', html, re.I)[:12]:
        clean = f.strip().strip('"\'').split(',')[0].strip()
        if clean.lower() not in skip and 2 < len(clean) < 60:
            fonts.append(clean)
    seen, out = set(), []
    for f in fonts:
        if f.lower() not in seen: seen.add(f.lower()); out.append(f)
    return out[:4]

def _meta(html: str, prop: str) -> str:
    """Extract content from meta og or name tag."""
    for pat in [
        rf'<meta[^>]+property="{prop}"[^>]+content="([^"]+)"',
        rf'<meta[^>]+content="([^"]+)"[^>]+property="{prop}"',
        rf'<meta[^>]+name="{prop}"[^>]+content="([^"]+)"',
        rf'<meta[^>]+content="([^"]+)"[^>]+name="{prop}"',
    ]:
        m = re.search(pat, html, re.I)
        if m: return re.sub(r'\s+', ' ', m.group(1)).strip()
    return ""

def _extract_dna(html: str, url: str) -> dict:
    dna = {"source_url": url}

    # ── Brand name ──
    candidates = [
        _meta(html, "og:site_name"),
        _meta(html, "application-name"),
    ]
    title_m = re.search(r'<title[^>]*>([^<|·–\-—·]+)', html, re.I)
    if title_m: candidates.append(re.sub(r'\s+', ' ', title_m.group(1)).strip())
    for c in candidates:
        if c and 1 < len(c) < 80: dna["name"] = c; break

    # ── Tagline / description ──
    for val in [
        _meta(html, "og:description"),
        _meta(html, "description"),
        _meta(html, "twitter:description"),
    ]:
        if val and 8 < len(val) < 300: dna["tagline"] = val[:250]; break
    if "tagline" not in dna:
        h1 = re.search(r'<h1[^>]*>([^<]{8,200})</h1>', html, re.I)
        if h1: dna["tagline"] = re.sub(r'<[^>]+>', '', h1.group(1)).strip()[:200]

    # ── Logo URL ──
    for pat in [
        r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"',
        r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"',
        r'<link[^>]+rel="(?:shortcut )?icon"[^>]+href="([^"]+)"',
        r'<img[^>]+(?:class|id)="[^"]*logo[^"]*"[^>]+src="([^"]+)"',
        r'<img[^>]+src="([^"]*logo[^"]*\.(?:png|svg|jpg|webp))"',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            logo = m.group(1)
            if not logo.startswith("http"): logo = urljoin(url, logo)
            dna["logo_url"] = logo; break

    # ── Colors from style tags + inline ──
    styles = " ".join(re.findall(r'<style[^>]*>(.*?)</style>', html, re.S | re.I))
    inline = " ".join(re.findall(r'style="([^"]+)"', html, re.I))
    palette = _extract_palette(styles + " " + inline)
    if palette:
        dna["primary_color"] = palette[0]
        if len(palette) > 1: dna["secondary_color"] = palette[1]
        if len(palette) > 2: dna["accent_color"] = palette[2]
        dna["palette"] = palette

    # ── Fonts ──
    fonts = _extract_fonts(html)
    if fonts: dna["primary_font"] = fonts[0]; dna["all_fonts"] = fonts

    # ── CTA text (best-effort from prominent buttons) ──
    btns = re.findall(
        r'<(?:button|a)[^>]*(?:class|id)="[^"]*(?:cta|btn-primary|hero|primary-btn)[^"]*"[^>]*>([\s\S]{2,60}?)</(?:button|a)>',
        html, re.I
    )[:3]
    if not btns:
        btns = re.findall(r'<button[^>]*>([\s\S]{3,40}?)</button>', html, re.I)[:4]
    ctas = []
    for b in btns:
        t = re.sub(r'<[^>]+>', '', b).strip()
        t = re.sub(r'\s+', ' ', t)
        if t and len(t) < 60: ctas.append(t)
    if ctas: dna["cta"] = ctas[0]; dna["cta_list"] = ctas

    # ── Social handles from page links ──
    _BAD_HANDLES = {'share','sharer','intent','dialog','login','signup','p','photo','video',
                    'posts','pages','groups','hashtag','explore','reel','stories'}
    social = {}
    for plat, pat in [
        ("instagram", r'instagram\.com/([a-zA-Z0-9_.]{2,40})'),
        ("tiktok",    r'tiktok\.com/@([a-zA-Z0-9_.]{2,40})'),
        ("twitter",   r'(?:twitter|x)\.com/([a-zA-Z0-9_]{2,40})'),
        ("facebook",  r'facebook\.com/([a-zA-Z0-9_.]{3,60})'),
        ("linkedin",  r'linkedin\.com/(?:company/)?([a-zA-Z0-9_-]{3,60})'),
        ("youtube",   r'youtube\.com/(?:@|c/|channel/|user/)?([a-zA-Z0-9_-]{3,60})'),
    ]:
        m = re.search(pat, html, re.I)
        if m:
            h = m.group(1).rstrip('/')
            if h.lower() not in _BAD_HANDLES: social[plat] = h
    if social: dna["social_handles"] = social

    # ── Domain ──
    parsed = urlparse(url)
    dna["domain"] = parsed.netloc.replace("www.", "")

    # ── Sector heuristic ──
    kw = {
        "restaurante":  ["menu","carta","restaurante","gastronomia","reserva","plato"],
        "ecommerce":    ["shop","tienda","cart","carrito","comprar","pedido","envio"],
        "salud":        ["clinica","medico","salud","health","wellness","spa","tratamiento"],
        "tecnologia":   ["software","saas","app","platform","dashboard","api","developer"],
        "moda":         ["moda","fashion","ropa","coleccion","talla","tejido","boutique"],
        "turismo":      ["hotel","viaje","turismo","travel","reserva","alojamiento","vuelo"],
        "educacion":    ["curso","formacion","escuela","academia","aprender","clases","online"],
        "agencia":      ["agencia","studio","branding","marketing","campana","creativo"],
    }
    txt = html[:10000].lower()
    scores = {s: sum(1 for k in ks if k in txt) for s, ks in kw.items()}
    best = max(scores, key=scores.get)
    if scores[best] > 0: dna["sector"] = best

    return dna


# ─────────────────────────────────────────────────────────────────────────────
# Brand research — individual scrapers
# ─────────────────────────────────────────────────────────────────────────────
async def _ddg_instant(query: str) -> dict:
    """DuckDuckGo Instant Answers — free, no auth."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.get("https://api.duckduckgo.com/", params={
                "q": query, "format": "json", "no_html": "1", "skip_disambig": "1"
            })
            d = r.json()
            result = {"source": "ddg_instant", "query": query, "items": []}
            if d.get("AbstractText"):
                result["abstract"] = d["AbstractText"][:500]
                result["abstract_url"] = d.get("AbstractURL", "")
            for rt in d.get("RelatedTopics", [])[:5]:
                if isinstance(rt, dict) and rt.get("Text"):
                    result["items"].append({"text": rt["Text"][:200]})
            return result
    except Exception as e:
        return {"source": "ddg_instant", "query": query, "error": str(e)}

async def _ddg_search(query: str, n: int = 5) -> dict:
    """DuckDuckGo HTML search results scrape."""
    try:
        async with httpx.AsyncClient(
            headers={**HDR, "Referer": "https://duckduckgo.com/"}, timeout=TIMEOUT
        ) as c:
            r = await c.get("https://duckduckgo.com/html/", params={"q": query})
            html = r.text
            titles   = re.findall(r'class="result__a"[^>]*>([^<]+)', html)[:n]
            snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)(?:<\/span>|$)', html, re.S)[:n]
            urls_raw = re.findall(r'class="result__url"[^>]*>\s*([^\s<]+)', html)[:n]
            items = []
            for i, s in enumerate(snippets):
                clean = re.sub(r'<[^>]+>', '', s).strip()
                if clean: items.append({
                    "title":   titles[i].strip() if i < len(titles) else "",
                    "snippet": clean[:280],
                    "url":     urls_raw[i].strip() if i < len(urls_raw) else "",
                })
            return {"source": "ddg_search", "query": query, "items": items}
    except Exception as e:
        return {"source": "ddg_search", "query": query, "error": str(e)}

async def _scrape_instagram(handle: str) -> dict:
    p = await _fetch(f"https://www.instagram.com/{handle}/")
    html = p.get("html", "")
    d = {"source": "instagram", "handle": handle, "url": f"https://www.instagram.com/{handle}/"}
    if not html: d["error"] = p.get("error", "no response"); return d
    # og:description = "X Followers, Y Following, Z Posts - bio text - See Instagram..."
    desc = _meta(html, "og:description")
    if desc:
        m = re.search(r'([\d,.kKmM]+)\s*Followers', desc, re.I)
        if m: d["followers"] = m.group(1)
        parts = desc.split(" - ")
        if len(parts) >= 2: d["bio"] = parts[-1][:200]
    title = _meta(html, "og:title")
    if title: d["display_name"] = title
    return d

async def _scrape_tiktok(handle: str) -> dict:
    p = await _fetch(f"https://www.tiktok.com/@{handle}")
    html = p.get("html", "")
    d = {"source": "tiktok", "handle": handle, "url": f"https://www.tiktok.com/@{handle}"}
    if not html: d["error"] = p.get("error", "no response"); return d
    m = re.search(r'"followerCount"\s*:\s*(\d+)', html)
    if m:
        n = int(m.group(1))
        d["followers"] = f"{n/1000000:.1f}M" if n >= 1000000 else (f"{n/1000:.0f}K" if n >= 1000 else str(n))
    m2 = re.search(r'"signature"\s*:\s*"([^"]{1,300})"', html)
    if m2: d["bio"] = m2.group(1)
    m3 = re.search(r'"nickname"\s*:\s*"([^"]+)"', html)
    if m3: d["display_name"] = m3.group(1)
    return d

async def _scrape_twitter(handle: str) -> dict:
    # Try multiple nitter mirrors
    for base in [
        "https://nitter.net",
        "https://nitter.privacydev.net",
        "https://nitter.poast.org",
        "https://nitter.1d4.us",
    ]:
        try:
            async with httpx.AsyncClient(headers=HDR, timeout=10.0, follow_redirects=True) as c:
                r = await c.get(f"{base}/{handle}")
                if r.status_code != 200: continue
                html = r.text
                d = {"source": "twitter", "handle": handle, "url": f"https://x.com/{handle}"}
                # follower count
                m = re.search(r'class="profile-stat-num"[^>]*>([\d,.]+)', html)
                if not m:
                    m = re.search(r'Followers.*?<span[^>]*>([\d,.KkMm]+)', html, re.S)
                if m: d["followers"] = m.group(1)
                # bio
                m2 = re.search(r'class="profile-bio"[^>]*><p[^>]*>(.*?)</p>', html, re.S)
                if m2: d["bio"] = re.sub(r'<[^>]+>', '', m2.group(1)).strip()[:200]
                # display name
                m3 = re.search(r'class="profile-card-fullname"[^>]*>(.*?)</a>', html, re.S)
                if m3: d["display_name"] = re.sub(r'<[^>]+>', '', m3.group(1)).strip()
                return d
        except Exception:
            continue
    # Fallback: DDG search
    res = await _ddg_instant(f'site:x.com {handle} OR site:twitter.com {handle}')
    return {
        "source": "twitter", "handle": handle,
        "url": f"https://x.com/{handle}",
        "ddg_info": res.get("abstract", "No disponible"),
    }

async def _scrape_facebook(handle: str) -> dict:
    p = await _fetch(f"https://www.facebook.com/{handle}")
    html = p.get("html", "")
    d = {"source": "facebook", "handle": handle, "url": f"https://www.facebook.com/{handle}"}
    if not html: d["error"] = p.get("error", "no response"); return d
    desc = _meta(html, "og:description")
    if desc: d["description"] = desc[:200]
    title = _meta(html, "og:title")
    if title: d["display_name"] = title
    return d

async def _scrape_linkedin(handle: str) -> dict:
    p = await _fetch(f"https://www.linkedin.com/company/{handle}")
    html = p.get("html", "")
    d = {"source": "linkedin", "handle": handle, "url": f"https://www.linkedin.com/company/{handle}"}
    if not html: d["error"] = p.get("error", "no response"); return d
    desc = _meta(html, "og:description")
    if desc: d["description"] = desc[:200]
    title = _meta(html, "og:title")
    if title: d["display_name"] = title
    return d

# ─────────────────────────────────────────────────────────────────────────────
# Parallel research orchestrator
# ─────────────────────────────────────────────────────────────────────────────
async def _research_brand(brand: str, domain: str, social: dict) -> dict:
    """Fire all 8+ research tasks simultaneously via asyncio.gather."""
    # Best-guess handles from DNA or sanitized brand name
    slug = brand.lower().replace(" ", "").replace("-", "")[:30]
    ig = social.get("instagram", slug)
    tt = social.get("tiktok",    slug)
    tw = social.get("twitter",   slug)
    fb = social.get("facebook",  slug)
    li = social.get("linkedin",  slug)

    tasks = [
        # Search engines
        _ddg_instant(f"{brand} {domain}"),
        _ddg_search(f'"{brand}" empresa historia about'),
        _ddg_search(f'"{brand}" instagram tiktok twitter redes sociales'),
        _ddg_search(f'"{brand}" reviews opiniones clientes valoracion'),
        _ddg_search(f'"{brand}" {domain} competitors competencia'),
        # Social platforms
        _scrape_instagram(ig),
        _scrape_tiktok(tt),
        _scrape_twitter(tw),
        _scrape_facebook(fb),
        _scrape_linkedin(li),
    ]
    keys = [
        "ddg_general", "ddg_about", "ddg_social", "ddg_reviews", "ddg_competitors",
        "instagram", "tiktok", "twitter", "facebook", "linkedin",
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return {k: (v if not isinstance(v, Exception) else {"error": str(v)}) for k, v in zip(keys, results)}


# ─────────────────────────────────────────────────────────────────────────────
# Claude redesign — streaming
# ─────────────────────────────────────────────────────────────────────────────
async def _stream_redesign(dna: dict, research: dict, instructions: str):
    if not ANTHROPIC_API_KEY:
        yield 'data: {"error":"ANTHROPIC_API_KEY no configurado"}\n\n'
        return

    # Summarize research into text
    lines = []
    for k, v in research.items():
        if not isinstance(v, dict) or v.get("error"): continue
        if k == "ddg_general" and v.get("abstract"):
            lines.append(f"[Descripción DDG] {v['abstract'][:350]}")
        elif k in ("ddg_about", "ddg_reviews", "ddg_social", "ddg_competitors"):
            for it in (v.get("items") or [])[:2]:
                if it.get("snippet"): lines.append(f"[{k}] {it['snippet'][:200]}")
        elif k in ("instagram", "tiktok", "twitter", "facebook", "linkedin"):
            parts = [f"[{v['source'].upper()} @{v.get('handle','?')}]"]
            if v.get("followers"): parts.append(f"{v['followers']} seguidores")
            if v.get("bio"):       parts.append(f'bio: "{v["bio"][:120]}"')
            if v.get("ddg_info"):  parts.append(v["ddg_info"][:150])
            if len(parts) > 1: lines.append(" · ".join(parts))

    brand    = dna.get("name",    dna.get("domain", "Brand"))
    palette  = dna.get("palette", [dna.get("primary_color", "#6366f1")])
    font     = dna.get("primary_font", "Inter")
    tagline  = dna.get("tagline", "")
    cta      = dna.get("cta", "Empezar ahora")
    social_h = dna.get("social_handles", {})
    sector   = dna.get("sector", "general")
    logo     = dna.get("logo_url", "")

    system = """Eres el mejor diseñador web del mundo. Generas HTML completo, standalone y ejecutable.

REGLAS ABSOLUTAS (ninguna es negociable):
1. UN ÚNICO archivo HTML — CSS y JS inline. Funciona abriéndolo directamente en el navegador.
2. requestAnimationFrame para TODAS las animaciones — nunca setInterval/setTimeout para animaciones.
3. will-change: transform en TODOS los elementos que se animen.
4. CSS custom properties (variables) para colores y tipografía en :root.
5. Responsive: mobile-first con media queries.
6. try/catch alrededor de cualquier librería CDN (Three.js, GSAP, Lenis).
7. CERO placeholders, CERO "TODO", CERO "insert image here" — contenido REAL de la marca.
8. Footer con links a redes sociales REALES si se proporcionan handles.
9. Meta viewport y charset correctos.
10. Efectos: elige la tecnología según complejidad — Canvas 2D, CSS puro, GSAP/ScrollTrigger, Three.js."""

    user = f"""Crea una landing page premium y memorable para la marca "{brand}".

═══ DNA EXTRAÍDO DEL SITIO ORIGINAL ═══
Nombre:          {brand}
Dominio:         {dna.get("domain","")}
Sector:          {sector}
Tagline:         {tagline[:180] or "no detectado"}
CTA principal:   {cta}
Paleta:          {", ".join(palette[:6])}
Fuente:          {font}
Logo URL:        {logo or "no detectado — crea logotipo textual"}
Redes detectadas en el sitio: {json.dumps(social_h, ensure_ascii=False)}

═══ INVESTIGACIÓN DE MARCA (paralela: Google · DuckDuckGo · IG · TT · TW · FB · LinkedIn) ═══
{chr(10).join(lines[:14]) if lines else "(sin datos — usa contexto del DNA)"}

═══ INSTRUCCIONES DE MEJORA ═══
{instructions or "Diseño moderno, premium, con efectos visuales avanzados. Mantén identidad de marca pero eleva el nivel estético significativamente. Inspírate en Awwwards y Dribbble."}

═══ ESTRUCTURA MÍNIMA REQUERIDA ═══
1. HERO — animación de impacto apropiada al sector: partículas canvas, gradiente animado, o Three.js mesh
2. PROPUESTA DE VALOR — 3-4 cards con iconos SVG inline, glassmorphism o tilt 3D
3. SOCIAL PROOF — datos REALES de redes (seguidores, bio) si están disponibles; si no, estadísticas de sector
4. CTA SECTION — prominente con efecto magnético (mousemove JS)
5. FOOTER — links reales a redes sociales detectadas, copyright, logo
Extras opcionales según sector: galería, precios, testimonios, mapa, video embed.

Genera el HTML COMPLETO ahora:"""

    async with httpx.AsyncClient(timeout=180.0) as c:
        async with c.stream(
            "POST", "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 8192,
                "stream": True,
                "system": system,
                "messages": [{"role": "user", "content": user}],
            },
        ) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    try:
                        ev = json.loads(line[6:])
                        if ev.get("type") == "content_block_delta":
                            chunk = ev["delta"].get("text", "")
                            if chunk:
                                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                    except Exception:
                        pass
    yield 'data: {"done":true}\n\n'


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI registration
# ─────────────────────────────────────────────────────────────────────────────
def register_web_lab_engine(app) -> dict:
    router = APIRouter()

    @router.post("/api/weblab/analyze")
    async def analyze(req: AnalyzeRequest):
        """SSE stream: page fetch → DNA extraction → 10 parallel brand research sources."""
        async def gen():
            yield f'data: {json.dumps({"phase":"fetch","msg":"Obteniendo página..."})}\n\n'
            page = await _fetch(req.url)

            if page["status"] == 0:
                yield f'data: {json.dumps({"phase":"error","msg":page.get("error","Sin respuesta del servidor")})}\n\n'
                return

            yield f'data: {json.dumps({"phase":"dna","msg":"Extrayendo DNA de marca (colores, fuentes, copy, handles)..."})}\n\n'
            dna = _extract_dna(page["html"], page["url"])
            yield f'data: {json.dumps({"phase":"dna_done","dna":dna})}\n\n'

            if not req.deep:
                yield f'data: {json.dumps({"phase":"complete"})}\n\n'
                return

            brand  = dna.get("name",   dna.get("domain", ""))
            domain = dna.get("domain", "")
            social = dna.get("social_handles", {})

            msg = f'Investigando "{brand}" en 10 fuentes paralelas: Google · DuckDuckGo · Instagram · TikTok · Twitter/X · Facebook · LinkedIn...'
            yield f'data: {json.dumps({"phase":"research","msg":msg})}\n\n'

            research = await _research_brand(brand, domain, social)

            for src, data in research.items():
                yield f'data: {json.dumps({"phase":"source","source":src,"data":data})}\n\n'

            yield f'data: {json.dumps({"phase":"complete","research":research})}\n\n'

        return StreamingResponse(gen(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    @router.post("/api/weblab/improve")
    async def improve(req: ImproveRequest):
        """SSE stream: Claude redesign generation from DNA + research."""
        return StreamingResponse(
            _stream_redesign(req.dna, req.research, req.instructions or ""),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @router.get("/api/weblab/proxy")
    async def proxy(url: str):
        """CORS-free URL proxy for displaying external pages in iframe."""
        p = await _fetch(url)
        return JSONResponse({
            "html":   p.get("html",  "")[:65000],
            "status": p.get("status", 0),
            "error":  p.get("error",  ""),
        })

    app.include_router(router)
    return {
        "status": "ok",
        "routes": ["/api/weblab/analyze", "/api/weblab/improve", "/api/weblab/proxy"],
    }
