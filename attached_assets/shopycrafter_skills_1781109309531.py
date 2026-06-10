"""
shopycrafter_skills.py — AI Skills Backend para shopycrafter.com
=================================================================
Desplegable en Replit como main.py  (o impórtalo desde tu main existente).

SKILLS INCLUIDAS
  1. Landing Design AI   — genera landing pages HTML completas desde un brief
  2. Image Generation    — DALL-E 3 / Gemini Imagen 3 / Stability SD3 / FLUX
  3. Video Generation    — Runway / Kling / Luma / Minimax / Seedance (async)
  4. Mega Prompt Library — ~6 300 efectos desde vault JSON + builtin

VARIABLES DE ENTORNO (en Replit Secrets — nunca hardcodeadas):
  ANTHROPIC_API_KEY      → Claude (Landing AI)
  OPENAI_API_KEY         → DALL-E 3
  GEMINI_API_KEY         → Imagen 3 + Veo
  STABILITY_API_KEY      → Stability AI SD3
  REPLICATE_API_TOKEN    → FLUX / Seedance / WAN / Kling vía Replicate
  RUNWAY_API_KEY         → Runway Gen-4.5
  KLING_API_KEY          → Kling AI directo
  KLING_API_SECRET       → Kling AI directo
  LUMA_API_KEY           → Luma Ray3.14
  MINIMAX_API_KEY        → Minimax Hailuo-2.3
  FAL_API_KEY            → fal.ai (Pika v2.2)
  ALLOWED_ORIGINS        → "https://shopycrafter.com,https://www.shopycrafter.com"
                           (deja vacío para permitir todo en desarrollo)

INSTALAR EN REPLIT:
  pip install fastapi uvicorn httpx python-multipart

EJECUTAR:
  uvicorn shopycrafter_skills:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

def _k(name: str, default: str = "") -> str:
    return os.environ.get(name, default)

def _origins() -> list[str]:
    raw = _k("ALLOWED_ORIGINS")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return ["*"]

app = FastAPI(
    title="ShopyCrafter AI Skills",
    description="Landing Design · Image Generation · Video Generation · Mega Prompts",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_DATA = Path("data")
(_DATA / "jobs").mkdir(parents=True, exist_ok=True)
(_DATA / "images").mkdir(parents=True, exist_ok=True)

_NOW = lambda: datetime.now(timezone.utc).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS — HTTP CLIENTS
# ─────────────────────────────────────────────────────────────────────────────

def _anthropic_headers() -> dict:
    return {
        "x-api-key": _k("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

def _openai_headers() -> dict:
    return {
        "Authorization": f"Bearer {_k('OPENAI_API_KEY')}",
        "Content-Type": "application/json",
    }

def _gemini_headers() -> dict:
    return {"Content-Type": "application/json"}

async def _claude(prompt: str, system: str = "", max_tokens: int = 16000) -> str:
    """Llama Claude claude-sonnet-4-6 y devuelve el texto."""
    payload: dict[str, Any] = {
        "model": "claude-sonnet-4-6",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post(
            "https://api.anthropic.com/v1/messages",
            headers=_anthropic_headers(),
            json=payload,
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]


# ─────────────────────────────────────────────────────────────────────────────
# SKILL 1 — LANDING DESIGN AI
# ─────────────────────────────────────────────────────────────────────────────

class LandingRequest(BaseModel):
    brief: str                          # "Quiero una landing para mi salón de belleza..."
    business_name: str
    business_type: str = "general"      # restaurant, saas, ecommerce, beauty, gym, etc.
    primary_color: str = "#0066CC"
    secondary_color: str = "#FF6B35"
    cta_text: str = "Empezar Ahora"
    sections: List[str] = ["hero", "services", "testimonials", "contact"]
    language: str = "es"
    style: str = "modern"               # modern | minimal | bold | elegant | dark


_LANDING_SYSTEM = """Eres un experto desarrollador web y diseñador UI/UX senior.
Genera ÚNICAMENTE código HTML completo y funcional — sin explicaciones, sin markdown, sin backticks.
El código debe comenzar con <!DOCTYPE html> y terminar con </html>.

REQUISITOS OBLIGATORIOS:
- HTML5 semántico completo con CSS inline en <style> y JS en <script>
- Responsive mobile-first con media queries
- Sección hero full-viewport impactante
- Navegación sticky con smooth scroll
- Animaciones CSS suaves en scroll (IntersectionObserver)
- Formulario de contacto funcional (preventDefault + feedback visual)
- Paleta de colores coherente con las variables CSS
- Google Fonts cargadas desde CDN
- Sin dependencias externas salvo Google Fonts (sin jQuery, sin frameworks)
- Listo para producción, zero errores de sintaxis"""

_INDUSTRY_TEMPLATES: Dict[str, dict] = {
    "restaurant":      {"icon": "🍽️",  "desc": "Restaurante con reservas online"},
    "beauty_salon":    {"icon": "💅",   "desc": "Salón de belleza con catálogo de servicios"},
    "gym":             {"icon": "💪",   "desc": "Gimnasio con membresías y clases"},
    "spa":             {"icon": "💆",   "desc": "Spa & Wellness con tratamientos"},
    "ecommerce":       {"icon": "🛍️",   "desc": "Tienda online con catálogo y carrito"},
    "saas":            {"icon": "🚀",   "desc": "SaaS/Startup con waitlist y precios"},
    "real_estate":     {"icon": "🏡",   "desc": "Inmobiliaria con buscador de propiedades"},
    "dental_clinic":   {"icon": "🦷",   "desc": "Clínica dental con citas online"},
    "law_firm":        {"icon": "⚖️",   "desc": "Despacho de abogados corporativo"},
    "photography":     {"icon": "📷",   "desc": "Fotógrafo con galería por categoría"},
    "yoga":            {"icon": "🧘",   "desc": "Centro de yoga con horarios y retiros"},
    "coaching":        {"icon": "🎯",   "desc": "Coach personal/negocios con servicios"},
    "marketing_agency":{"icon": "📈",   "desc": "Agencia de marketing con casos de éxito"},
    "tech_agency":     {"icon": "💻",   "desc": "Agencia de desarrollo web con portfolio"},
    "architecture":    {"icon": "🏛️",   "desc": "Estudio de arquitectura con proyectos"},
    "bakery":          {"icon": "🥐",   "desc": "Panadería artesanal con pedidos online"},
    "hotel":           {"icon": "🏨",   "desc": "Hotel boutique con reservas"},
    "music":           {"icon": "🎵",   "desc": "Artista musical con discografía"},
    "fintech":         {"icon": "💳",   "desc": "App financiera / neo-banco"},
    "general":         {"icon": "🌐",   "desc": "Landing page de propósito general"},
}


@app.get("/api/skills/landing/templates", tags=["landing"])
async def list_landing_templates():
    """Lista todos los tipos de industria disponibles para landing pages."""
    return JSONResponse({
        "templates": [
            {"id": k, "icon": v["icon"], "description": v["desc"]}
            for k, v in _INDUSTRY_TEMPLATES.items()
        ],
        "total": len(_INDUSTRY_TEMPLATES),
    })


@app.post("/api/skills/landing/generate", tags=["landing"])
async def generate_landing(req: LandingRequest):
    """
    Genera una landing page HTML completa con IA (Claude).
    Devuelve el HTML listo para desplegar.
    """
    if not _k("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada en Secrets")

    industry_info = _INDUSTRY_TEMPLATES.get(req.business_type, _INDUSTRY_TEMPLATES["general"])

    prompt = f"""Genera una landing page profesional completa para:

NEGOCIO: {req.business_name}
TIPO: {req.business_type} — {industry_info['desc']}
BRIEF: {req.brief}
COLOR PRIMARIO: {req.primary_color}
COLOR SECUNDARIO: {req.secondary_color}
CTA PRINCIPAL: {req.cta_text}
SECCIONES: {', '.join(req.sections)}
ESTILO: {req.style}
IDIOMA: {req.language}

Genera el HTML completo ahora:"""

    html = await _claude(prompt, system=_LANDING_SYSTEM, max_tokens=16000)

    # Asegurar que empieza con DOCTYPE
    if not html.strip().startswith("<!"):
        idx = html.find("<!DOCTYPE")
        if idx > 0:
            html = html[idx:]

    return JSONResponse({
        "html": html,
        "bytes": len(html.encode()),
        "business": req.business_name,
        "type": req.business_type,
        "generated_at": _NOW(),
    })


@app.post("/api/skills/landing/ai-brief", tags=["landing"])
async def landing_from_brief(brief: str = Query(..., description="Describe tu negocio en lenguaje natural")):
    """
    Genera una landing a partir de una descripción en lenguaje natural.
    Claude infiere el tipo de industria, paleta y secciones automáticamente.
    """
    if not _k("ANTHROPIC_API_KEY"):
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada")

    prompt = f"""El cliente dice: "{brief}"

Infiere el tipo de negocio, colores de marca apropiados y secciones necesarias.
Luego genera la landing page HTML completa — sin preguntas, sin preámbulo.
Empieza directamente con <!DOCTYPE html>."""

    html = await _claude(prompt, system=_LANDING_SYSTEM, max_tokens=16000)
    if not html.strip().startswith("<!"):
        idx = html.find("<!DOCTYPE")
        if idx >= 0:
            html = html[idx:]

    return JSONResponse({"html": html, "bytes": len(html.encode()), "generated_at": _NOW()})


# ─────────────────────────────────────────────────────────────────────────────
# SKILL 2 — IMAGE GENERATION (multi-provider con fallback)
# ─────────────────────────────────────────────────────────────────────────────

class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = ""
    style: str = "photorealistic"       # photorealistic | illustration | 3d | anime | abstract
    aspect_ratio: str = "1:1"          # 1:1 | 16:9 | 9:16 | 4:3 | 3:4
    provider: str = "auto"             # auto | dalle3 | gemini | stability | flux
    quality: str = "standard"          # standard | hd (DALL-E 3 only)
    n: int = 1


_ASPECT_SIZES = {
    "1:1":  {"w": 1024, "h": 1024},
    "16:9": {"w": 1792, "h": 1024},
    "9:16": {"w": 1024, "h": 1792},
    "4:3":  {"w": 1024, "h": 768},
    "3:4":  {"w": 768,  "h": 1024},
}

_STYLE_MODIFIERS = {
    "photorealistic": "ultra-photorealistic, DSLR photo, 8K, sharp focus, professional lighting",
    "illustration":   "digital illustration, clean lines, vibrant colors, professional design",
    "3d":             "3D render, CGI, Blender, cinema4D, glossy materials, soft studio lighting",
    "anime":          "anime style, cel shading, vibrant Japanese animation, detailed",
    "abstract":       "abstract art, geometric, colorful, modern design, artistic",
}


async def _img_dalle3(prompt: str, size: str = "1024x1024", quality: str = "standard") -> dict:
    payload = {
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality,
        "response_format": "url",
    }
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(
            "https://api.openai.com/v1/images/generations",
            headers=_openai_headers(),
            json=payload,
        )
        r.raise_for_status()
        data = r.json()["data"][0]
        return {
            "url": data.get("url", ""),
            "revised_prompt": data.get("revised_prompt", prompt),
            "provider": "dall-e-3",
        }


async def _img_gemini(prompt: str) -> dict:
    key = _k("GEMINI_API_KEY") or _k("GOOGLE_AI_API_KEY")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key={key}"
    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {"sampleCount": 1, "aspectRatio": "1:1"},
    }
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(url, headers=_gemini_headers(), json=payload)
        r.raise_for_status()
        b64 = r.json()["predictions"][0]["bytesBase64Encoded"]
        return {"b64": b64, "mime": "image/png", "provider": "gemini-imagen-3"}


async def _img_stability(prompt: str, neg: str, w: int, h: int) -> dict:
    url = "https://api.stability.ai/v2beta/stable-image/generate/sd3"
    headers = {
        "authorization": f"Bearer {_k('STABILITY_API_KEY')}",
        "accept": "application/json",
    }
    data = {
        "prompt": prompt,
        "negative_prompt": neg,
        "model": "sd3.5-large",
        "output_format": "png",
    }
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(url, headers=headers, data=data)
        r.raise_for_status()
        return {"b64": r.json()["image"], "mime": "image/png", "provider": "stability-sd3.5"}


async def _img_flux_replicate(prompt: str, ar: str) -> dict:
    token = _k("REPLICATE_API_TOKEN")
    headers = {"Authorization": f"Token {token}", "Content-Type": "application/json"}
    ar_map = {"1:1": "1:1", "16:9": "16:9", "9:16": "9:16", "4:3": "4:3", "3:4": "3:4"}
    payload = {
        "version": "black-forest-labs/flux-1.1-pro",
        "input": {
            "prompt": prompt,
            "aspect_ratio": ar_map.get(ar, "1:1"),
            "output_format": "jpg",
            "output_quality": 90,
            "safety_tolerance": 2,
        },
    }
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post("https://api.replicate.com/v1/predictions", headers=headers, json=payload)
        r.raise_for_status()
        pred_id = r.json()["id"]
        # Poll
        for _ in range(60):
            await asyncio.sleep(3)
            p = await c.get(f"https://api.replicate.com/v1/predictions/{pred_id}", headers=headers)
            p.raise_for_status()
            pred = p.json()
            if pred["status"] == "succeeded":
                out = pred.get("output", [])
                url = out[0] if isinstance(out, list) and out else out
                return {"url": str(url), "provider": "flux-1.1-pro"}
            if pred["status"] in ("failed", "canceled"):
                raise RuntimeError(f"Replicate FLUX failed: {pred.get('error', '')}")
    raise TimeoutError("Replicate FLUX timeout")


@app.get("/api/skills/image/providers", tags=["image"])
async def image_providers():
    """Devuelve los proveedores de imagen disponibles según las API keys configuradas."""
    return JSONResponse({
        "available": [
            {"id": "dalle3",    "name": "DALL-E 3",          "ready": bool(_k("OPENAI_API_KEY"))},
            {"id": "gemini",    "name": "Gemini Imagen 3",   "ready": bool(_k("GEMINI_API_KEY") or _k("GOOGLE_AI_API_KEY"))},
            {"id": "stability", "name": "Stability SD3.5",   "ready": bool(_k("STABILITY_API_KEY"))},
            {"id": "flux",      "name": "FLUX 1.1 Pro",      "ready": bool(_k("REPLICATE_API_TOKEN"))},
        ]
    })


@app.post("/api/skills/image/generate", tags=["image"])
async def generate_image(req: ImageRequest):
    """
    Genera una imagen con IA. Cascada automática de proveedores si provider='auto':
    DALL-E 3 → Gemini Imagen 3 → Stability SD3.5 → FLUX 1.1 Pro
    """
    sizes = _ASPECT_SIZES.get(req.aspect_ratio, _ASPECT_SIZES["1:1"])
    dalle_size = f"{sizes['w']}x{sizes['h']}"
    style_mod = _STYLE_MODIFIERS.get(req.style, "")
    enriched = f"{req.prompt}. {style_mod}".strip(". ")

    def _has(key: str) -> bool:
        return bool(os.environ.get(key))

    order: list[str] = []
    if req.provider == "auto":
        if _has("OPENAI_API_KEY"):      order.append("dalle3")
        if _has("GEMINI_API_KEY") or _has("GOOGLE_AI_API_KEY"): order.append("gemini")
        if _has("STABILITY_API_KEY"):   order.append("stability")
        if _has("REPLICATE_API_TOKEN"): order.append("flux")
    else:
        order = [req.provider]

    if not order:
        raise HTTPException(503, "Ningún proveedor de imagen configurado. Añade al menos una API key.")

    last_err = ""
    for provider in order:
        try:
            if provider == "dalle3":
                result = await _img_dalle3(enriched, dalle_size, req.quality)
            elif provider == "gemini":
                result = await _img_gemini(enriched)
            elif provider == "stability":
                result = await _img_stability(enriched, req.negative_prompt, sizes["w"], sizes["h"])
            elif provider == "flux":
                result = await _img_flux_replicate(enriched, req.aspect_ratio)
            else:
                continue

            return JSONResponse({
                **result,
                "original_prompt": req.prompt,
                "style": req.style,
                "aspect_ratio": req.aspect_ratio,
                "generated_at": _NOW(),
            })
        except Exception as e:
            last_err = f"{provider}: {e}"
            continue

    raise HTTPException(502, f"Todos los proveedores fallaron. Último error: {last_err}")


# ─────────────────────────────────────────────────────────────────────────────
# SKILL 3 — VIDEO GENERATION (multi-provider, async polling)
# ─────────────────────────────────────────────────────────────────────────────

class VideoRequest(BaseModel):
    prompt: str
    image_url: Optional[str] = None     # Si se proporciona → image-to-video
    duration: int = 5                   # segundos: 5 o 10
    aspect_ratio: str = "16:9"
    provider: str = "auto"              # auto | runway | kling | luma | minimax | seedance
    motion_strength: float = 0.5        # 0.0–1.0


_VIDEO_JOBS: Dict[str, dict] = {}       # job_id → estado (persiste en memoria)


def _save_job(job: dict):
    _VIDEO_JOBS[job["id"]] = job
    try:
        p = _DATA / "jobs" / f"{job['id']}.json"
        p.write_text(json.dumps(job, ensure_ascii=False, indent=2))
    except Exception:
        pass


def _load_jobs() -> list[dict]:
    jobs = list(_VIDEO_JOBS.values())
    # Cargar desde disco los que no están en memoria
    for p in (_DATA / "jobs").glob("*.json"):
        jid = p.stem
        if jid not in _VIDEO_JOBS:
            try:
                jobs.append(json.loads(p.read_text()))
            except Exception:
                pass
    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return jobs[:100]


# --- Runway Gen-4.5 ---
async def _video_runway(req: VideoRequest) -> dict:
    key = _k("RUNWAY_API_KEY")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-Runway-Version": "2024-11-06"}
    payload: dict[str, Any] = {
        "model": "gen4_turbo",
        "promptText": req.prompt,
        "duration": req.duration,
        "ratio": req.aspect_ratio.replace(":", ":"),
    }
    if req.image_url:
        payload["promptImage"] = req.image_url
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post("https://api.dev.runwayml.com/v1/image_to_video", headers=headers, json=payload)
        r.raise_for_status()
        task_id = r.json()["id"]
        return {"provider": "runway", "remote_id": task_id}


async def _poll_runway(remote_id: str) -> Optional[str]:
    key = _k("RUNWAY_API_KEY")
    headers = {"Authorization": f"Bearer {key}", "X-Runway-Version": "2024-11-06"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"https://api.dev.runwayml.com/v1/tasks/{remote_id}", headers=headers)
        r.raise_for_status()
        data = r.json()
        if data.get("status") == "SUCCEEDED":
            out = data.get("output", [])
            return out[0] if out else None
        if data.get("status") in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"Runway failed: {data.get('failure','')}")
    return None


# --- Kling AI directo ---
def _kling_jwt() -> str:
    ak = _k("KLING_API_KEY")
    sk = _k("KLING_API_SECRET")
    now = int(time.time())
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b"=")
    payload_b = base64.urlsafe_b64encode(json.dumps({"iss": ak, "exp": now + 1800, "nbf": now - 5}).encode()).rstrip(b"=")
    sig = hmac.new(sk.encode(), f"{header.decode()}.{payload_b.decode()}".encode(), hashlib.sha256).digest()
    sig_b = base64.urlsafe_b64encode(sig).rstrip(b"=")
    return f"{header.decode()}.{payload_b.decode()}.{sig_b.decode()}"


async def _video_kling(req: VideoRequest) -> dict:
    token = _kling_jwt()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    endpoint = "videos/image2video" if req.image_url else "videos/text2video"
    payload: dict[str, Any] = {
        "model_name": "kling-v3-pro",
        "prompt": req.prompt,
        "duration": str(req.duration),
        "aspect_ratio": req.aspect_ratio,
        "cfg_scale": 0.5,
    }
    if req.image_url:
        payload["image_url"] = req.image_url
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post(f"https://api.klingai.com/v1/{endpoint}", headers=headers, json=payload)
        r.raise_for_status()
        task_id = r.json()["data"]["task_id"]
        return {"provider": "kling", "remote_id": task_id}


async def _poll_kling(remote_id: str) -> Optional[str]:
    token = _kling_jwt()
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"https://api.klingai.com/v1/videos/text2video/{remote_id}", headers=headers)
        r.raise_for_status()
        data = r.json()["data"]
        if data.get("task_status") == "succeed":
            videos = data.get("task_result", {}).get("videos", [])
            return videos[0]["url"] if videos else None
        if data.get("task_status") == "failed":
            raise RuntimeError("Kling failed")
    return None


# --- Luma Ray3.14 ---
async def _video_luma(req: VideoRequest) -> dict:
    headers = {"Authorization": f"Bearer {_k('LUMA_API_KEY')}", "Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "prompt": req.prompt,
        "model": "ray3.14",
        "resolution": "1080p",
        "duration": f"{req.duration}s",
        "aspect_ratio": req.aspect_ratio,
    }
    if req.image_url:
        payload["keyframes"] = {"frame0": {"type": "image", "url": req.image_url}}
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post("https://api.lumalabs.ai/dream-machine/v1/generations", headers=headers, json=payload)
        r.raise_for_status()
        gen_id = r.json()["id"]
        return {"provider": "luma", "remote_id": gen_id}


async def _poll_luma(remote_id: str) -> Optional[str]:
    headers = {"Authorization": f"Bearer {_k('LUMA_API_KEY')}"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"https://api.lumalabs.ai/dream-machine/v1/generations/{remote_id}", headers=headers)
        r.raise_for_status()
        data = r.json()
        if data.get("state") == "completed":
            return data.get("assets", {}).get("video")
        if data.get("state") == "failed":
            raise RuntimeError(f"Luma failed: {data.get('failure_reason','')}")
    return None


# --- Minimax Hailuo-2.3 ---
async def _video_minimax(req: VideoRequest) -> dict:
    headers = {"Authorization": f"Bearer {_k('MINIMAX_API_KEY')}", "Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "model": "video-01",  # Hailuo-2.3
        "prompt": req.prompt,
    }
    if req.image_url:
        payload["first_frame_image"] = req.image_url
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post("https://api.minimaxi.chat/v1/video_generation", headers=headers, json=payload)
        r.raise_for_status()
        task_id = r.json()["task_id"]
        return {"provider": "minimax", "remote_id": task_id}


async def _poll_minimax(remote_id: str) -> Optional[str]:
    headers = {"Authorization": f"Bearer {_k('MINIMAX_API_KEY')}"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            f"https://api.minimaxi.chat/v1/query/video_generation?task_id={remote_id}",
            headers=headers,
        )
        r.raise_for_status()
        data = r.json()
        if data.get("status") == "Success":
            return data.get("file_id", "")
        if data.get("status") == "Fail":
            raise RuntimeError("Minimax failed")
    return None


# --- Replicate Seedance 2.0 ---
async def _video_seedance(req: VideoRequest) -> dict:
    headers = {"Authorization": f"Token {_k('REPLICATE_API_TOKEN')}", "Content-Type": "application/json"}
    payload: dict[str, Any] = {
        "version": "bytedance/seedance-2.0",
        "input": {
            "prompt": req.prompt,
            "duration": req.duration,
            "aspect_ratio": req.aspect_ratio,
        },
    }
    if req.image_url:
        payload["input"]["image"] = req.image_url
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post("https://api.replicate.com/v1/predictions", headers=headers, json=payload)
        r.raise_for_status()
        pred_id = r.json()["id"]
        return {"provider": "seedance", "remote_id": pred_id}


async def _poll_replicate(remote_id: str) -> Optional[str]:
    headers = {"Authorization": f"Token {_k('REPLICATE_API_TOKEN')}"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"https://api.replicate.com/v1/predictions/{remote_id}", headers=headers)
        r.raise_for_status()
        pred = r.json()
        if pred["status"] == "succeeded":
            out = pred.get("output", [])
            return out[0] if isinstance(out, list) and out else str(out)
        if pred["status"] in ("failed", "canceled"):
            raise RuntimeError(f"Replicate failed: {pred.get('error','')}")
    return None


_POLL_FN = {
    "runway":   _poll_runway,
    "kling":    _poll_kling,
    "luma":     _poll_luma,
    "minimax":  _poll_minimax,
    "seedance": _poll_replicate,
}

_SUBMIT_FN = {
    "runway":   _video_runway,
    "kling":    _video_kling,
    "luma":     _video_luma,
    "minimax":  _video_minimax,
    "seedance": _video_seedance,
}


async def _poll_loop(job_id: str):
    """Background task: hace polling cada 10s hasta que el vídeo esté listo."""
    job = _VIDEO_JOBS.get(job_id)
    if not job:
        return
    provider = job.get("provider", "")
    remote_id = job.get("remote_id", "")
    poll_fn = _POLL_FN.get(provider)
    if not poll_fn:
        return

    for _ in range(180):  # 180 × 10s = 30 min máx
        await asyncio.sleep(10)
        try:
            url = await poll_fn(remote_id)
            if url:
                job["status"] = "completed"
                job["video_url"] = url
                job["completed_at"] = _NOW()
                _save_job(job)
                return
        except Exception as e:
            job["status"] = "failed"
            job["error"] = str(e)
            _save_job(job)
            return

    job["status"] = "failed"
    job["error"] = "Timeout después de 30 minutos"
    _save_job(job)


def _provider_order() -> list[str]:
    order = []
    if _k("RUNWAY_API_KEY"):      order.append("runway")
    if _k("KLING_API_KEY") and _k("KLING_API_SECRET"): order.append("kling")
    if _k("LUMA_API_KEY"):        order.append("luma")
    if _k("MINIMAX_API_KEY"):     order.append("minimax")
    if _k("REPLICATE_API_TOKEN"): order.append("seedance")
    return order


@app.get("/api/skills/video/providers", tags=["video"])
async def video_providers():
    """Proveedores de vídeo disponibles según las API keys configuradas."""
    return JSONResponse({
        "available": [
            {"id": "runway",   "name": "Runway Gen-4.5",         "ready": bool(_k("RUNWAY_API_KEY"))},
            {"id": "kling",    "name": "Kling v3 Pro",           "ready": bool(_k("KLING_API_KEY") and _k("KLING_API_SECRET"))},
            {"id": "luma",     "name": "Luma Ray3.14",           "ready": bool(_k("LUMA_API_KEY"))},
            {"id": "minimax",  "name": "Minimax Hailuo-2.3",     "ready": bool(_k("MINIMAX_API_KEY"))},
            {"id": "seedance", "name": "Seedance 2.0 (Replicate)","ready": bool(_k("REPLICATE_API_TOKEN"))},
        ]
    })


@app.post("/api/skills/video/generate", tags=["video"])
async def generate_video(req: VideoRequest, bg: BackgroundTasks):
    """
    Envía trabajo de generación de vídeo al primer proveedor disponible.
    Devuelve un job_id. Sondea /api/skills/video/job/{job_id} para el resultado.
    """
    providers = [req.provider] if req.provider != "auto" else _provider_order()
    if not providers:
        raise HTTPException(503, "Ningún proveedor de vídeo configurado. Añade al menos una API key.")

    last_err = ""
    for p in providers:
        fn = _SUBMIT_FN.get(p)
        if not fn:
            continue
        try:
            info = await fn(req)
            job_id = "vj_" + uuid.uuid4().hex[:12]
            job: dict[str, Any] = {
                "id": job_id,
                "status": "processing",
                "provider": info["provider"],
                "remote_id": info["remote_id"],
                "prompt": req.prompt,
                "duration": req.duration,
                "aspect_ratio": req.aspect_ratio,
                "created_at": _NOW(),
                "video_url": None,
            }
            _save_job(job)
            _VIDEO_JOBS[job_id] = job
            bg.add_task(_poll_loop, job_id)
            return JSONResponse({
                "job_id": job_id,
                "status": "processing",
                "provider": info["provider"],
                "message": "Vídeo en generación. Sondea /api/skills/video/job/{job_id} para el resultado.",
            })
        except Exception as e:
            last_err = f"{p}: {e}"
            continue

    raise HTTPException(502, f"Todos los proveedores fallaron. Último error: {last_err}")


@app.get("/api/skills/video/job/{job_id}", tags=["video"])
async def get_video_job(job_id: str):
    """Estado de un trabajo de vídeo. status: processing | completed | failed."""
    if job_id in _VIDEO_JOBS:
        return JSONResponse(_VIDEO_JOBS[job_id])
    p = _DATA / "jobs" / f"{job_id}.json"
    if p.exists():
        return JSONResponse(json.loads(p.read_text()))
    raise HTTPException(404, f"Job {job_id} no encontrado")


@app.get("/api/skills/video/jobs", tags=["video"])
async def list_video_jobs():
    """Historial de los últimos 100 trabajos de vídeo."""
    return JSONResponse({"jobs": _load_jobs(), "total": len(_load_jobs())})


# ─────────────────────────────────────────────────────────────────────────────
# SKILL 4 — MEGA PROMPT LIBRARY (~5 800 efectos)
# Carga dinámica de todos los JSON en data/prompt_vault/templates/
# Más los prompts Python integrados como fuente "builtin"
# ─────────────────────────────────────────────────────────────────────────────

# ── Rutas de datos ────────────────────────────────────────────────────────────
_VAULT_DIR = Path(os.environ.get("VAULT_DIR", "data/prompt_vault/templates"))

# Archivos extra fuera del vault (cópialos a data/effects/ en Replit):
#   effects-catalog.json  — 213 efectos Aceternity/DotMatrix/Componentry
#   catalog.json          — 312 diseños Google Stitch
_EXTRA_PATHS: List[Path] = [
    Path(os.environ.get("EFFECTS_CATALOG", "data/effects/effects-catalog.json")),
    Path(os.environ.get("DESIGN_CATALOG",  "data/effects/catalog.json")),
]

# ── Prompts Python integrados (builtin) ───────────────────────────────────────
# Dict por categoría; se aplana a lista en _BUILTIN_PROMPTS más abajo.
_BUILTIN_DICT: Dict[str, List[dict]] = {

  # ── LANDING PAGES ─────────────────────────────────────────────────────────
  "landing_pages": [
    {"id":"lp_restaurant","name":"Restaurante Premium","tags":["food","booking","restaurant"],"prompt":"Landing para restaurante: hero full-screen con foto del plato principal y overlay oscuro, sección menú en grid 3 col (imagen, nombre, precio, alérgenos), galería en masonry 6 fotos, formulario de reserva con fecha/hora/personas, horarios y mapa embed. Colores: negro #1a1008, dorado #c9a961, crema #f5f0e8. Tipografía: Cormorant Garamond + Inter. Animaciones GSAP en scroll."},
    {"id":"lp_saas","name":"SaaS / Startup","tags":["saas","startup","tech","waitlist"],"prompt":"Landing de startup tech: hero con mockup de producto animado en CSS, headline problema/solución, contador de waitlist, features en bento grid asimétrico, tabla de precios 3 tiers con badge 'Fundador', testimonios de beta testers, logos de inversores, FAQ animado. Gradiente oscuro #0a0a1a → #1a0a2a, púrpura #7c3aed, verde #22c55e. Space Grotesk."},
    {"id":"lp_ecommerce","name":"E-Commerce Fashion","tags":["ecommerce","fashion","shop"],"prompt":"Landing de moda: hero editorial con modelo y slider de colecciones, categorías en grid fotográfico, producto estrella con foto 360° simulada, lookbook en slider full-width, programa de puntos, sección de sostenibilidad, newsletter con 10% descuento bienvenida. Blanco + negro + acento terracota #c17767. Neue Haas Grotesk."},
    {"id":"lp_beauty","name":"Salón de Belleza","tags":["beauty","salon","booking"],"prompt":"Landing salón de belleza: hero femenino con foto de cliente con look impecable, servicios por categorías (Cabello, Uñas, Estética, Cejas) con precios, galería estilo Instagram, equipo de estilistas, bono regalo digital, reserva online. Rosa champagne #f2c4c4 + dorado #c9a961 + blanco. Cormorant Garamond + Nunito. Femenino y aspiracional."},
    {"id":"lp_gym","name":"Gimnasio / Fitness","tags":["gym","fitness","membership"],"prompt":"Landing gimnasio: hero con vídeo de fondo de entrenamientos en loop, sección de clases con filtro (yoga, spinning, boxeo, HIIT) y horarios, instalaciones en foto-grid, planes de membresía en 3 tiers, entrenadores con foto, testimonios, oferta primer mes gratis. Negro #0d0d0d + rojo #e51c23 + amarillo #f5c518. Bebas Neue + Roboto."},
    {"id":"lp_realstate","name":"Inmobiliaria","tags":["real-estate","property"],"prompt":"Landing inmobiliaria: hero con buscador flotante (zona, tipo, precio min/max, habitaciones), propiedades destacadas en grid (foto, precio, m², habitaciones, baños), propiedades por categoría, equipo de agentes, guía del comprador en accordion, valoración gratuita CTA, testimonios. Azul marino + blanco + dorado. Inter. Confianza."},
    {"id":"lp_dental","name":"Clínica Dental","tags":["dental","health","clinic"],"prompt":"Landing clínica dental: hero con sonrisa perfecta y headline 'Tu sonrisa, nuestra pasión', servicios principales con iconos SVG, antes/después con slider de comparación JS, tecnología del centro (Invisalign, digital), equipo de doctores, precios transparentes, primera consulta gratis CTA. Azul marino #1e3a5f + blanco + verde menta #a8d5a2. Inter. Profesional y cálido."},
    {"id":"lp_hotel","name":"Hotel Boutique","tags":["hotel","luxury","booking"],"prompt":"Landing hotel de lujo: hero full-screen con slider de 3 habitaciones con fade, barra de reserva flotante (check-in/out, personas), sección de habitaciones en grid con precio/noche, servicios (spa, restaurante, piscina), galería inmersiva, testimonios, localización. Dark theme dorado y negro. Three.js partículas doradas sutiles."},
    {"id":"lp_coach","name":"Coach / Mentor","tags":["coaching","personal-dev"],"prompt":"Landing coach personal: hero con foto del coach en posición de autoridad y headline de transformación, framework propio en infographic 5 pasos, resultados en números animados, servicios (1:1, grupo, curso), testimonios en video (thumbnail + play), masterclass gratuita como opt-in. Dorado + oscuro + blanco. Tipografía poderosa."},
    {"id":"lp_marketing_agency","name":"Agencia de Marketing","tags":["marketing","agency","digital"],"prompt":"Landing agencia marketing: hero con métricas subiendo en animación CSS, servicios en bento grid (SEO, SEM, Social Ads, Email, Content, CRO), casos de éxito en slider con % de mejora, herramientas (logos Google Ads, Meta, HubSpot), precios por packs, diagnóstico gratis CTA. Negro + verde neón #00e676 + blanco. Space Grotesk."},
  ],

  # ── HEROES & COMPONENTES UI ───────────────────────────────────────────────
  "ui_components": [
    {"id":"ui_hero_gradient","name":"Hero Gradiente Animado","tags":["hero","gradient","animation"],"prompt":"Crea un hero section con: gradiente de fondo animado (hue-rotate 0→360deg en 10s), texto centrado con heading 5rem bold, subtítulo 1.5rem, dos botones CTA (primario sólido + secundario outline), partículas flotantes en CSS puro (20 elementos con keyframes aleatorios), scroll indicator animado. Altura: 100vh. Responsive. CSS variables para colores."},
    {"id":"ui_bento_grid","name":"Bento Grid Features","tags":["bento","grid","features"],"prompt":"Crea un bento grid de features al estilo Linear/Vercel: 12 cards de diferentes tamaños (2 grandes, 4 medianas, 6 pequeñas) en CSS Grid, cada card con gradiente de fondo sutil, icono SVG, título y descripción corta. Hover: elevación box-shadow + ligero scale. Bordes translúcidos con rgba. Dark theme. Responsive (2 cols en mobile, 4 en desktop)."},
    {"id":"ui_navbar_sticky","name":"Navbar Sticky Premium","tags":["navbar","sticky","glassmorphism"],"prompt":"Navbar sticky con glassmorphism: blur(20px) + fondo rgba semi-transparente que aumenta opacidad al hacer scroll, logo a la izquierda, links de navegación en el centro con underline animation en hover, botones CTA a la derecha, hamburger menu animado para mobile con drawer que desliza desde la derecha. Transición suave de transparente a sólido en scroll. Inter font."},
    {"id":"ui_pricing_cards","name":"Cards de Precios 3 Tiers","tags":["pricing","cards","subscription"],"prompt":"Sección de precios con 3 tiers: Free/Starter/Pro. Card central destacada con badge 'Popular' y escala ligeramente mayor (scale 1.05). Cada card: nombre del plan, precio grande con período, lista de features con checkmarks verdes y X rojas, CTA button. Toggle anual/mensual con descuento 20%. Animación de entrada en scroll con stagger. CSS moderno, sin frameworks."},
    {"id":"ui_testimonials_carousel","name":"Testimonials Carousel","tags":["testimonials","carousel","social-proof"],"prompt":"Carousel de testimoniales: 6 cards con foto circular de autor (placeholder gradient), nombre, rol/empresa, rating de estrellas SVG, y texto del testimonio. Auto-play cada 4s con fade transition, dots de navegación, pausa en hover. Versión mobile: swipe táctil con touch events JS. Dark theme elegante. Fuente: Inter."},
    {"id":"ui_animated_counter","name":"Stats con Contadores Animados","tags":["stats","counter","animation"],"prompt":"Sección de estadísticas con 4 números grandes que cuentan de 0 al valor objetivo cuando entran en viewport (IntersectionObserver + requestAnimationFrame). Formato: enteros simples, con coma para miles, con sufijo K/M o %. Iconos SVG encima de cada número. Descripción debajo en texto pequeño. Fondo oscuro, números en blanco o dorado. Easing ease-out de 2 segundos."},
    {"id":"ui_floating_cards","name":"Feature Cards Flotantes 3D","tags":["cards","3d","hover"],"prompt":"Grid de 6 feature cards con efecto 3D tilt en hover: JavaScript que calcula la posición del cursor relativa a cada card y aplica rotateX/rotateY con transform perspective(600px). Gradiente de fondo que sigue el cursor (radial-gradient que se mueve). Icono emoji grande en la parte superior, título H3 y descripción. Sombra que profundiza en hover. CSS transition smooth."},
    {"id":"ui_scroll_timeline","name":"Timeline de Proceso","tags":["timeline","process","steps"],"prompt":"Timeline vertical centrada para mostrar proceso de trabajo: 6 pasos, alternando izquierda/derecha en desktop (solo derecha en mobile), línea vertical central con punto de conexión que se colorea al hacer scroll (IntersectionObserver). Cada paso: número circular grande, título, descripción. Animación: fade + slide desde el lado correspondiente. Colores progresivos (gradiente de azul a verde según avance)."},
    {"id":"ui_glassmorphism_cards","name":"Cards Glassmorphism","tags":["glassmorphism","cards","modern"],"prompt":"6 cards con efecto glassmorphism real: background rgba(255,255,255,0.1), backdrop-filter blur(20px), border 1px rgba(255,255,255,0.2), sombra suave. Fondo del contenedor: gradiente purple/blue/pink mesh. Hover: aumenta opacity y escala suavemente. Cada card: icono, título, descripción, badge de categoría. Responsive en grid. Fuente: Space Grotesk."},
    {"id":"ui_footer_mega","name":"Footer Mega Link","tags":["footer","links","newsletter"],"prompt":"Footer completo: logo y descripción de la empresa a la izquierda (o arriba en mobile), 4 columnas de links (Producto, Empresa, Recursos, Legal), columna de newsletter a la derecha con input + botón. Redes sociales con iconos SVG y hover colorizado. Separador con degradado. Copyright con año dinámico JS. Dark background, tipografía pequeña y limpia. Border-top con gradiente de colores de marca."},
  ],

  # ── EFECTOS CSS / ANIMACIONES ─────────────────────────────────────────────
  "css_animations": [
    {"id":"anim_text_reveal","name":"Text Reveal por Palabras","tags":["text","reveal","animation"],"prompt":"Efecto de reveal de texto word-by-word: cada palabra aparece con clip-path: inset(0 100% 0 0) → inset(0 0% 0 0) con stagger de 0.05s entre palabras. Implementar con IntersectionObserver que añade clase 'visible'. Aplicado a un H1 de 10 palabras. Solo CSS + JS vanilla. Suave, profesional, sin librerías."},
    {"id":"anim_particle_bg","name":"Fondo de Partículas CSS","tags":["particles","background","animation"],"prompt":"Background animado con 50 partículas CSS puras: cada partícula es un ::before o elemento div con border-radius:50%, tamaño entre 4-20px, posición aleatoria con nth-child CSS, keyframes individuales de flotación (translateY ±50px) con duraciones entre 5-15s y delays variables. Sin canvas, sin JS. Solo CSS. Paleta monocromática con opacity baja (0.2-0.6)."},
    {"id":"anim_magnetic_button","name":"Botón Magnético","tags":["button","magnetic","hover"],"prompt":"Botón con efecto magnético en hover: JS mousemove calcula la distancia cursor-botón, aplica transform translate con intensidad proporcional a la proximidad (efecto atracción hasta 80px, repulsión suave más lejos). El texto interior se desplaza en sentido contrario para profundidad visual. Cursor personalizado circular que se expande al acercarse. Transición spring con cubic-bezier. Color flip en hover completo."},
    {"id":"anim_gradient_mesh","name":"Gradient Mesh Animado","tags":["gradient","mesh","background"],"prompt":"Background con 4 blobs de gradiente animados independientemente: cada blob es un div con border-radius 40-60%, gradiente radial de un color, posición absoluta, animate con keyframes de traslación circular (rotate + translate). Mezcla en modo de fusión 'multiply' o 'screen' para crear efecto mesh. Colores: azul #667eea, rosa #f093fb, verde #4facfe, naranja #f6d365. Suave e hipnótico."},
    {"id":"anim_3d_card_flip","name":"Card con Flip 3D","tags":["card","flip","3d"],"prompt":"Card con flip 3D en hover: contenedor con perspective:1000px, card interior con transform-style:preserve-3d, cara frontal y trasera con backface-visibility:hidden. Hover: rotateY(180deg) en 0.6s con cubic-bezier spring. Frontal: imagen de producto + precio. Trasera: descripción completa + botón CTA + detalles técnicos. Sombra que se transforma durante el flip. Grid de 4 cards demo."},
    {"id":"anim_scroll_parallax","name":"Parallax de Scroll Multicapa","tags":["parallax","scroll","depth"],"prompt":"Sección hero con parallax en 3 capas: fondo (0.2x velocidad scroll), capa media con elementos geométricos SVG (0.5x), y texto en primer plano (1x normal). JS requestAnimationFrame + scrollY para calcular translate de cada capa. Efecto depth real. Elementos decorativos: círculos, líneas, puntos en cada capa. Sin librerías externas."},
    {"id":"anim_number_morph","name":"Números Morphing SVG","tags":["number","morph","svg"],"prompt":"5 KPIs con animación morphing de SVG: los números cambian de forma con animación de path SVG entre el estado 0 y el valor final. Alternativamente, usar clip-path y CSS counters con @keyframes para el conteo animado con easing personalizado. Al entrar en viewport, los números cuentan progresivamente con aceleración ease-out. Tamaño grande, sobre fondo oscuro, colores neón."},
    {"id":"anim_line_drawing","name":"Line Drawing SVG en Scroll","tags":["svg","line","drawing"],"prompt":"Logo o ilustración SVG que se dibuja solo: stroke-dasharray igual a la longitud del path, stroke-dashoffset que va de longitud total a 0 conforme el usuario hace scroll (o con IntersectionObserver al entrar en viewport). 3 elementos SVG distintos (ícono de rocket, estrella, zig-zag). CSS transition sobre stroke-dashoffset. Color de trazo gradiente animado."},
  ],

  # ── PROMPTS DE IMAGEN IA ───────────────────────────────────────────────────
  "image_prompts": [
    {"id":"img_product_hero","name":"Foto de Producto Hero","tags":["product","commercial","photography"],"prompt":"Product hero shot: [TU PRODUCTO] floating in midair, centered composition, perfect studio lighting with soft key light from top-left, subtle fill light, dark gradient background fading to black. Ultra-sharp focus, 8K, commercial photography style, no shadows on subject, thin rim light highlight, photorealistic."},
    {"id":"img_brand_lifestyle","name":"Lifestyle de Marca","tags":["lifestyle","brand","people"],"prompt":"Lifestyle brand photography: authentic young professional using [PRODUCTO/SERVICIO] in a modern minimalist workspace, natural window light, warm tones, shallow depth of field, candid moment, editorial style. Real skin tones, no filters, magazine quality."},
    {"id":"img_saas_dashboard","name":"Dashboard SaaS UI Screenshot","tags":["saas","dashboard","ui","mockup"],"prompt":"Photorealistic mockup of a modern SaaS dashboard displayed on a MacBook Pro screen, dark UI with neon accent colors, charts showing upward trends, clean typography, floating in a soft-lit studio environment with very slight reflection on desk surface. 4K, no background, PNG format."},
    {"id":"img_logo_3d","name":"Logo 3D Render","tags":["logo","3d","brand"],"prompt":"3D render of [NOMBRE DE MARCA] logo, extruded metallic letters, brushed gold/chrome material, smooth subsurface scattering, cinematic studio lighting from 3 points, soft shadows on white/black surface, depth of field blur on back elements, Blender-quality render, 8K, no background."},
    {"id":"img_social_ads","name":"Anuncio Social Media","tags":["social","ad","marketing"],"prompt":"Social media ad creative for [PRODUCTO/OFERTA]: bold typographic headline overlay on vibrant gradient background (purple to pink), product mockup center-right, floating geometric decorative elements, clear CTA button at bottom, 1:1 format, eye-catching, modern design, suitable for Instagram/Facebook."},
    {"id":"img_hero_abstract","name":"Background Abstracto Hero","tags":["abstract","background","hero"],"prompt":"Abstract hero background: flowing organic shapes in gradient blues and purples with hints of teal and gold, volumetric light rays, depth and dimensionality, suitable as a website hero background with plenty of dark space top-left for text overlay. 16:9, ultra HD, no people."},
    {"id":"img_team_photo","name":"Foto de Equipo Profesional","tags":["team","corporate","people"],"prompt":"Professional corporate team photo: 5 diverse young professionals in smart casual attire, standing together in a modern bright office with glass walls, natural lighting, genuine smiles, slightly blurred background, editorial quality, diversity-inclusive, not overly posed. Canon 5D Mark IV aesthetic."},
    {"id":"img_food_plating","name":"Food Photography Premium","tags":["food","restaurant","plating"],"prompt":"Premium food photography: [PLATO] on matte black ceramic plate, beautiful artistic plating with microgreens and sauce streaks, dark moody restaurant background with bokeh candlelight, overhead 45-degree angle, professional food styling, Michelin-star aesthetic, 8K, commercial quality."},
    {"id":"img_fashion_editorial","name":"Foto Editorial de Moda","tags":["fashion","editorial","model"],"prompt":"High fashion editorial photograph: model wearing [PRENDA/COLECCIÓN], dramatic directional studio lighting, high contrast black and white with single color accent, Vogue magazine aesthetic, medium format camera simulation, grain texture, strong composition rule of thirds. Not AI-looking, pure photographic quality."},
    {"id":"img_architecture_render","name":"Render Arquitectónico","tags":["architecture","render","real-estate"],"prompt":"Photorealistic architectural visualization of a modern minimalist house exterior: white concrete and wood, floor-to-ceiling windows, infinity pool reflecting sunset sky, lush tropical landscaping, golden hour lighting with long shadows, photographic quality unindistinguishable from real photography, 8K HDR."},
  ],

  # ── PROMPTS DE VÍDEO IA ───────────────────────────────────────────────────
  "video_prompts": [
    {"id":"vid_product_reveal","name":"Product Reveal Cinematográfico","tags":["product","reveal","cinematic"],"prompt":"Cinematic product reveal: [PRODUCTO] materializes from particles of light in slow motion, orbiting in 3D space, camera slowly rotates 360° around it, soft studio lighting with rim light highlight, dark background transitioning to deep blue gradient, final close-up on product logo with lens flare, 10 seconds, photorealistic, 4K, no text."},
    {"id":"vid_hero_loop","name":"Hero Video Loop para Website","tags":["hero","loop","website"],"prompt":"Seamless 5-second loop video for website hero: abstract flowing gradient landscape in deep purples and blues, slow morphing organic shapes, subtle particle movement suggesting technology and innovation, no sharp cuts, perfect loop point, no audio, 16:9, suitable as background with text overlay."},
    {"id":"vid_brand_story","name":"Brand Story 15 Segundos","tags":["brand","story","social"],"prompt":"15-second brand story video: starts with close-up hands crafting something, quick cuts showing the process, faces of satisfied customers, team working together, product in use in real life scenarios, ends on logo reveal with tagline. Warm color grading, natural authentic lighting, handheld camera movement, Instagram Reels style."},
    {"id":"vid_explainer_animation","name":"Explainer Animado 2D","tags":["explainer","animation","2d"],"prompt":"2D animated explainer video style: flat design characters and icons, clean white background, showing how [PRODUCTO/SERVICIO] solves a customer problem in 3 steps. Step 1: problem visualization. Step 2: solution introduction. Step 3: happy outcome. Smooth transitions between scenes, 8 seconds per step, playful animation style."},
    {"id":"vid_testimonial_cinematic","name":"Testimonial Cinemático","tags":["testimonial","cinematic","social-proof"],"prompt":"Cinematic testimonial video shot: professional-looking person speaking to camera in a beautiful modern office setting, shallow depth of field background blur, warm natural light from window, confident authentic expression, slow zoom in during speech, lower third text area for name/title. 15 seconds, handheld feel, authentic."},
    {"id":"vid_social_reel","name":"Reel de Producto para Instagram","tags":["reel","instagram","product"],"prompt":"Instagram Reel product showcase: 9:16 vertical format, 15 seconds, quick cuts between different product angles/uses, trending visual style with zoom transitions and color flash cuts, bold text overlays appearing with bounce animation, upbeat energy, Gen-Z aesthetic, raw and authentic but polished, modern color grading with teal and orange."},
    {"id":"vid_fashion_walkthrough","name":"Fashion Lookbook Video","tags":["fashion","lookthrough","editorial"],"prompt":"Fashion lookbook video: model walking in slow motion (120fps playback) through different locations — street, café, rooftop — wearing outfit with natural movement. Golden hour lighting, film grain texture, analog color grading, handheld intimacy. 10 seconds per look, smooth jump cuts, no sound design needed."},
    {"id":"vid_data_visualization","name":"Data Viz Animada","tags":["data","animation","business"],"prompt":"Animated data visualization video: charts and graphs building themselves from zero, numbers counting up, world map with glowing dots appearing, network connections forming, all in clean dark background with neon blue and green accents. Professional corporate motion graphics style. 10 seconds, 16:9, no text needed just the visuals."},
  ],

  # ── EMAIL TEMPLATES ───────────────────────────────────────────────────────
  "email_templates": [
    {"id":"email_welcome","name":"Email de Bienvenida","tags":["email","welcome","onboarding"],"prompt":"Email HTML responsive de bienvenida: header con logo y gradiente de marca, hero con ilustración SVG inline (personaje o ícono de bienvenida), headline cálido, párrafo de bienvenida personalizado con [NOMBRE], 3 pasos de 'Qué hacer ahora' con iconos SVG y links, botón CTA principal, footer con redes sociales y unsubscribe. Max-width 600px, compatible con Gmail/Outlook, CSS inline."},
    {"id":"email_promo","name":"Email Promocional Flash Sale","tags":["email","promo","sale","urgency"],"prompt":"Email de oferta flash: diseño de impacto, banner rojo con '48H SALE' y cuenta regresiva CSS (solo visual, no funcional en email), producto destacado con imagen grande, precio tachado y precio nuevo en verde, barra de progreso de stock (50% queda), código de descuento en caja destacada, 3 productos más en grid 3 col, CTA 'Comprar Ahora' rojo. HTML email 600px, inline CSS, dark mode compatible."},
    {"id":"email_newsletter","name":"Newsletter Semanal","tags":["email","newsletter","content"],"prompt":"Newsletter HTML semanal: header con fecha y número de edición, sección de 'Top Story' con imagen grande y resumen, 3 noticias secundarias en lista con imagen pequeña izquierda, sección de recurso de la semana (ebook, tool, artículo), quote inspiracional en caja destacada, footer con perfil del autor, botón de compartir en RRSS, unsubscribe link. Tono editorial, limpio, 600px, compatible todos los clientes de correo."},
    {"id":"email_abandoned_cart","name":"Carrito Abandonado","tags":["email","cart","ecommerce","recovery"],"prompt":"Email de recuperación de carrito: asunto urgente (Los productos de tu carrito casi se agotan), header con logo, headline personalizado '[NOMBRE], ¿olvidaste algo?', grid con los productos del carrito (imagen, nombre, precio, cantidad), total del carrito, CTA principal 'Completar mi compra', sección de social proof (4.8/5 estrellas, X clientes), garantías (envío gratis, devolución 30 días). HTML 600px, inline CSS."},
  ],

  # ── MOBILE LAYOUTS ────────────────────────────────────────────────────────
  "mobile_layouts": [
    {"id":"mob_app_home","name":"App Home Screen","tags":["mobile","app","home"],"prompt":"Mobile app home screen HTML/CSS: viewport 390x844 simulado en desktop, dark theme, status bar superior, greeting 'Buenos días, [Nombre]' con avatar circular, resumen/dashboard cards con glassmorphism, acciones rápidas en grid 2x2 con iconos, lista de actividad reciente con avatares y timestamps, bottom navigation bar con 5 tabs y active indicator. Touch events simulados en JS. Fuente: SF Pro / system-ui."},
    {"id":"mob_onboarding","name":"Onboarding Flow 3 Pasos","tags":["mobile","onboarding","flow"],"prompt":"Mobile onboarding flow HTML/CSS de 3 pantallas: viewport 390px, indicador de progreso dots en la parte superior, cada pantalla con ilustración SVG grande, título H2, descripción corta, botón 'Siguiente' y skip. Transición de pantalla: slide horizontal con JS. Pantalla 1: bienvenida. Pantalla 2: feature principal. Pantalla 3: CTA crear cuenta. Última pantalla sin skip. Animación de entrada de ilustración en cada paso."},
  ],

  # ── PORTFOLIO ─────────────────────────────────────────────────────────────
  "portfolio": [
    {"id":"port_creative","name":"Portfolio Creativo / Designer","tags":["portfolio","design","creative"],"prompt":"Portfolio web de diseñador/fotógrafo: hero full-screen con nombre en tipografía editorial grande y un proyecto de fondo en parallax, menú lateral vertical sticky, galería de proyectos en grid asimétrico con hover que revela nombre + categoría + año en overlay, página de proyecto individual con scroll narrativo, sobre mí con foto artística en blanco y negro, contacto con cursor personalizado. Solo CSS + JS vanilla. Blanco puro + negro + acento de color del autor."},
    {"id":"port_dev","name":"Portfolio Developer","tags":["portfolio","developer","github"],"prompt":"Portfolio de desarrollador: diseño terminal/hacker con fondo negro, tipografía monospaced (JetBrains Mono), animación de typing en el nombre y headline, proyectos en cards con screenshots de GitHub, tech stack en badges de color, skills en barras de progreso animadas, experiencia en timeline vertical, GitHub contributions graph simulado en SVG, sección de contacto minimalista. ASCII art decorativo. Solo CSS + JS."},
  ],

  # ── AI / SAAS ─────────────────────────────────────────────────────────────
  "ai_saas": [
    {"id":"ai_chatui","name":"Chat UI de IA","tags":["ai","chat","interface"],"prompt":"Interfaz de chat de IA estilo Claude/ChatGPT: sidebar izquierdo con historial de conversaciones y botón nueva conversación, área de chat principal con mensajes de usuario (derecha, azul) y asistente (izquierda, gris) en bubbles, soporte de markdown en respuestas del asistente (bold, código inline, bloques de código con syntax highlight CSS), input inferior con textarea auto-resize y botón enviar, indicador de typing con 3 puntos animados, modo oscuro. Solo HTML/CSS/JS."},
    {"id":"ai_prompt_builder","name":"Prompt Builder UI","tags":["ai","prompt","builder","tool"],"prompt":"UI de constructor de prompts de IA: panel izquierdo con categorías de prompts (Role, Context, Task, Format, Constraints), cada categoría con input o select, panel derecho con preview del prompt ensamblado en tiempo real (actualización en JS conforme se rellena), botones copiar al portapapeles y limpiar, historial de prompts recientes en drawer inferior, badge de conteo de tokens (aprox. palabras×1.3), campo de notas del usuario. Dark mode, fuente monospaced para el preview."},
    {"id":"ai_dashboard","name":"Dashboard de IA Analytics","tags":["ai","dashboard","analytics"],"prompt":"Dashboard de analytics de IA: layout de 3 cols en desktop, 1 col en mobile. KPIs en la parte superior (peticiones totales, tokens consumidos, coste estimado, tiempo medio respuesta) con sparklines SVG, gráfico de barras de uso por modelo (Claude, GPT-4, Gemini) con CSS puro, tabla de los últimos 10 requests con status, modelo, latencia y coste, sección de rate limits con barras de progreso, alertas de cuota en rojo. Dark theme, Inter font."},
  ],

  # ── BACKGROUNDS / TEXTURAS ────────────────────────────────────────────────
  "backgrounds": [
    {"id":"bg_noise_grain","name":"Grain / Noise Texture","tags":["background","grain","texture"],"prompt":"SVG filter de grain/noise aplicado como background de una sección: SVG feTurbulence + feColorMatrix para crear textura de grano fotográfico sobre un gradiente de colores. Intensidad controlable con CSS variable --grain-opacity. Efecto: elegante textura de papel o foto analógica. Animar turbulence baseFrequency ligeramente en un loop para grano vivo. Solo CSS + SVG inline, sin imágenes externas."},
    {"id":"bg_aurora","name":"Aurora Borealis CSS","tags":["background","aurora","animation"],"prompt":"Efecto aurora borealis en CSS puro: 5 elementos con filter:blur(80px), border-radius:50%, colores verde/teal/azul/magenta/violeta, posición absoluta, animación de flotación y morphing con keyframes a 30-40s duration, opacity 0.4-0.7, mix-blend-mode:screen. Contenedor con overflow:hidden, fondo negro. Aspecto etéreo y orgánico. Solo CSS."},
    {"id":"bg_grid_dot","name":"Grid y Dot Pattern","tags":["background","grid","pattern"],"description":"Patrón de puntos o cuadrícula CSS para fondo de sección o hero.","prompt":"Background geométrico con grid de puntos o líneas en CSS: usando background-image con radial-gradient o linear-gradient para crear patrón de dots de 2px cada 30px, o grid de 1px cada 40px. Color: blanco con opacity 0.1 sobre fondo oscuro, o negro con opacity 0.05 sobre fondo claro. Fade en los bordes con mask-image radial. Opcional: dots que brillan on hover con JS mousemove."},
  ],

  # ── VIDEO ADS — ESTILOS ───────────────────────────────────────────────────
  "video_ads_ugc": [
    {"id":"ugc_testimonial","name":"Testimonial UGC Auténtico","tags":["ugc","testimonial","authentic","social"],"description":"Video testimonial UGC a cámara, persona real recomendando un producto de manera espontánea.","prompt":"Video UGC testimonial 15-30s: persona real mirando a cámara frontal (iPhone portrait, handheld), fondo doméstico real (cocina, salón, oficina casual), comenzando con hook 'Chicos, TENGO que contaros sobre [producto]…', gestos naturales de las manos mostrando el producto, cambio de tono a mitad (problema → solución), cierre con '¿Lo merece? Absolutamente sí.' Luz natural de ventana, sin ring light, ligero movimiento de cámara. Subtítulos auto-generados estilo TikTok. Color grading: skin tones naturales, no filtros. Autenticidad > Perfección."},
    {"id":"ugc_before_after","name":"Antes/Después UGC Transformación","tags":["ugc","before-after","transformation","results"],"description":"UGC mostrando transformación real antes y después usando el producto.","prompt":"Video UGC antes/después: split de pantalla o corte duro entre antes (desordenado, problema claro, tonos grises) y después (resultado impresionante con el producto, colores vivos). Narración 'Okay antes de que preguntes, esto fue hace solo [tiempo]...' Mostrar producto en manos en el segmento de después. Texto en pantalla: 'ANTES / DESPUÉS' en letra bold Impact. Transición: snap cut con flash a blanco. Duración 20-45s. 9:16. Cámara frontal natural."},
    {"id":"ugc_day_in_life","name":"Day in My Life con Producto","tags":["ugc","day-in-life","lifestyle","organic"],"description":"Formato 'día en mi vida' donde el producto aparece integrado orgánicamente.","prompt":"UGC vlog-style 30-60s: secuencia montaje de rutina diaria (mañana → tarde → noche), producto aparece naturalmente en 3-4 momentos sin forzarlo. Narración en off conversacional 'Ok les muestro cómo uso [producto] en mi día a día…'. Cortes rápidos de 2-3s cada clip. Música lo-fi de fondo baja. Texto en pantalla con timestamps: 7:00am / 12:30pm / 9:00pm. Sin libretas ni guiones visibles."},
    {"id":"ugc_unboxing_reaction","name":"Unboxing Reaction UGC","tags":["ugc","unboxing","reaction","product"],"description":"Reacción auténtica de unboxing con sorpresa y detalles del producto.","prompt":"UGC unboxing reaction 20-40s: manos de la persona abriendo packaging en tiempo real, reacciones genuinas de sorpresa ('Espera... WOW'), primeros planos del producto al sacarlo, detalles de packaging, probar el producto en el momento. Cámara sujetada con una mano mientras abre con la otra. Comentarios espontáneos sobre detalles inesperados. Sin cortes bruscos — continuo. Luz overhead natural. Sound design: crujido del packaging amplificado."},
    {"id":"ugc_problem_solution","name":"Problema-Solución UGC","tags":["ugc","problem","solution","pain-point"],"description":"UGC clásico que identifica el pain point y muestra la solución con el producto.","prompt":"UGC problema-solución 15-30s: apertura directa al dolor 'ODIO cuando [problema específico]' con cara de frustración, 1 segundo de pausa dramática, 'Hasta que encontré [producto]', demostración rápida de la solución, cara de alivio/satisfacción real. Hook obligatorio en los primeros 2 segundos. Estructura: Problema (5s) → Transición (2s) → Solución (15s) → CTA (3s). Sin edición elaborada. Autenticidad total."},
  ],
  "video_ads_cinematic": [
    {"id":"cine_brand_film","name":"Brand Film Cinemático 30s","tags":["cinematic","brand","film","premium"],"description":"Cortometraje de marca estilo Hollywood para posicionamiento premium.","prompt":"Brand film cinematográfico 30s: apertura con plano aéreo drone de paisaje evocador, corte a manos artesanales trabajando el producto, close-up extremo de detalles (textura, material, construcción), plano medio de persona usando el producto en ambiente premium, plano final del logo sobre fondo negro con tagline. Color grade: Teal & Orange LUT cinematográfico, contraste alto, shadows azules. Música orquestal/ambient crescendo. Sin voiceover — las imágenes hablan. Ratio 2.39:1 cinemascope."},
    {"id":"cine_product_reveal","name":"Product Reveal Dramático","tags":["cinematic","product","reveal","dramatic"],"description":"Reveal dramático del producto estilo Apple keynote o perfume luxury.","prompt":"Product reveal cinemático 15-20s: inicio en negro total, partículas de luz que convergen al centro, producto emerge en cámara lenta desde la oscuridad rotando 360°, iluminación 3 puntos dramatic (key light lateral, rim light posterior, fill suave), close-up de detalles clave (logo, acabado, forma), cut final al producto flotando sobre gradiente oscuro con nombre en tipografía serif elegante. 4K. Macro lens. Sound design: tono profundo crescendo."},
    {"id":"cine_golden_hour","name":"Lifestyle Golden Hour Cinemático","tags":["cinematic","golden-hour","lifestyle","warm"],"description":"Secuencia lifestyle en hora dorada con cinematografía warm y aspiracional.","prompt":"Secuencia lifestyle golden hour 20-30s: rodada durante la última hora de luz del día, 4-5 planos de persona usando el producto en exterior, shallow DOF f/1.4 con bokeh dorado, warm grade +2 stops sobreexpuesto en highlights, slow motion 60fps al 40% en momentos clave, flares de lente naturales. Colores: naranjas, dorados, terracota. Sin narración. Solo música ambient emotiva. Sin brand references en imagen — solo atmósfera."},
    {"id":"cine_urban_night","name":"Escena Urbana Nocturna","tags":["cinematic","night","urban","neon"],"description":"Cinematografía nocturna urbana con neón y bokeh para productos lifestyle/moda.","prompt":"Urban night cinematic 20s: persona con producto entre luces de ciudad, bokeh de neón y farolas en fondo, long exposure trails de coches, close-up del producto con reflejo de neón sobre su superficie, steadicam siguiendo al sujeto 5 metros, corte a overhead desde arriba mostrando escena completa. Color grade: shadows teal/magenta, highlights naranja de farola. f/1.8. ISO alto intencional para grano cinematográfico. 1.78:1."},
    {"id":"cine_epic_montage","name":"Epic Transformation Montage","tags":["cinematic","montage","epic","transformation"],"description":"Montaje épico de transformación para marca premium o lanzamiento.","prompt":"Epic montage cinematográfico 30s: secuencia de 8-10 planos de 2-3s montados al ritmo de la música, progresión visual de antes (gris, apagado) a después (colores vibrantes, energía), cada plano más dinámico que el anterior (cortes, cámara lenta, drone), clímax visual en plano 8 con el producto en el centro de la acción, fade out sobre negro con logo. Sincronización exacta imagen-música en cada golpe. Ratio 2.39:1."},
  ],
  "video_ads_cartoon": [
    {"id":"cart_problem_hero","name":"Personaje con Problema → Héroe","tags":["cartoon","character","problem","hero"],"description":"Animación 2D con personaje que tiene un problema y el producto lo convierte en héroe.","prompt":"Animación 2D flat design 15-20s: personaje simple y expresivo con problema visual obvio (cara roja de estrés, nubes de lluvia encima), pausa dramática 1s, aparece el producto con efecto 'swoosh', personaje lo usa y se transforma: colores brillantes, postura heroica, estrellas a su alrededor, música cambia de menor a mayor. Estilo: líneas limpias negras, paleta limitada (3 colores + negro + blanco), expresiones exageradas, movimientos rubber hose. Texto animado con beneficios clave."},
    {"id":"cart_product_superhero","name":"Producto Superhéroe 2D","tags":["cartoon","superhero","product","2d"],"description":"El producto animado como personaje superhéroe salvando al cliente.","prompt":"Animación 2D estilo comic book 20s: el producto cobra vida como superhéroe (capa, máscara, postura heroica), cliente en apuros con el problema, producto-héroe llega volando con trail de estelas, resuelve el problema en acción rápida (speed lines, onomatopeyas 'ZAP! BOOM! ¡RESUELTO!'), handshake entre héroe-producto y cliente feliz, zoom out al producto en pack-shot. Paleta: rojo/azul/amarillo. Panel de cómic como transición."},
    {"id":"cart_explainer_anim","name":"Explainer Animado 2D Minimalista","tags":["cartoon","explainer","2d","educational"],"description":"Explainer animado limpio para explicar un servicio o producto complejo en 3 pasos.","prompt":"Explainer 2D minimalista 30-45s: fondo blanco o crema, iconos y elementos geométricos simples que se animan al ritmo del voiceover, 3 pasos marcados con números circulares, cada paso: ícono aparece → breve animación → texto clave. Transiciones fluidas. Logo al final con CTA. Paleta: 2 colores de marca + negro + gris. Motion design: easing suave. Ideal para landing page o onboarding."},
    {"id":"cart_customer_journey","name":"Customer Journey Cartoon","tags":["cartoon","journey","storytelling","customer"],"description":"Journey del cliente en 4 actos: problema, descubrimiento, transformación, nuevo mundo.","prompt":"Storytelling animado 2D 30s: 4 actos — Mundo ordinario (gris, problema) → Llamada (ve el producto) → Transformación (usa el producto, colores explotan) → Nuevo mundo (vida con el producto, todo brillante). Estilo: flat illustration, líneas redondeadas, mundo que cambia de gris a colorido. Sin texto, solo narración visual. Música que acompaña la transformación emocional."},
  ],
  "video_ads_scifi": [
    {"id":"scifi_future_product","name":"Producto del Año 2050","tags":["scifi","future","hologram","tech"],"description":"El producto presentado como si fuera tecnología del futuro con estética sci-fi.","prompt":"Sci-fi product reveal 20s: ambientado en 2050, display holográfico 3D del producto flotando en el aire, interfaz futurista con datos y métricas alrededor del holograma, voz sintética describiendo las características, zoom in a detalles con overlay de datos en tipografía HUD, fade a logo con tagline 'El futuro ya está aquí'. Paleta: azul neón #00D4FF, negro profundo, partículas azules flotantes. Música ambient electrónico."},
    {"id":"scifi_hologram_demo","name":"Demo Holográfico del Producto","tags":["scifi","hologram","demo","interactive"],"description":"Demostración del producto como holograma interactivo futurista.","prompt":"Holographic product demo 25s: manos interactuando con un holograma del producto en el aire (VFX), el holograma responde girando y mostrando ángulos, características destacadas con puntos de luz que se expanden, datos de uso flotando alrededor, al final: 'Hazte con él en [marca].com' en tipografía HUD que se desvanece. Escenario: oscuro con neón violeta/azul. VFX: lens distortion y chromatic aberration sutiles."},
    {"id":"scifi_cyberpunk_ad","name":"Cyberpunk Neon Brand Ad","tags":["scifi","cyberpunk","neon","urban"],"description":"Anuncio estilo Blade Runner / Cyberpunk para marca tech o lifestyle.","prompt":"Cyberpunk ad 20s: escena nocturna urbana futurista, lluvia con reflejos de neón en el suelo (naranja/rosa/azul), persona con el producto vestida en estética cyber (gabardina), close-up del producto con reflejos de neón sobre su superficie, texto del producto en tipografía glitch que aparece y desaparece, corte al producto sobre fondo negro con logo en neón. Paleta: negro, neón rosa #FF0066, cian #00FFFF, naranja #FF6600. LUT Blade Runner."},
    {"id":"scifi_galaxy_reveal","name":"Galaxy Brand Reveal Épico","tags":["scifi","galaxy","space","epic"],"description":"Reveal del producto desde el espacio profundo para marcas premium y épicas.","prompt":"Galaxy brand reveal 15s: espacio profundo con nebulosas y galaxias, zoom warp hacia la Tierra, entrada dramática a través de la atmósfera en llamas, aterrizaje en el producto sobre un pedestal oscuro brillante, particles de luz dorada y azul que orbitan el producto, logo aparece sobre el producto como si fuera una luna, música orquestal épica crescendo final. 4K. Ratio 2.39:1 cinemascope."},
  ],
  "video_ads_pixelworld": [
    {"id":"pixel_product_game","name":"Producto como Power-Up 8-Bit","tags":["pixel","retro","gaming","8bit"],"description":"El producto como objeto de power-up en un videojuego 8-bit retro.","prompt":"Pixel art 8-bit animation 15-20s: mundo de videojuego retro NES/SNES, personaje pixel sprite corriendo por un nivel, encuentra el producto como power-up flotante (gif brillo, efecto coin-spin), lo recoge con efecto '1UP!', personaje se transforma y se vuelve invencible con música de power-up clásica, nivel se completa con 'STAGE CLEAR!', pack-shot del producto real en la pantalla de puntuación final. Pixel size: 16x16 chars. Paleta limitada 16 colores."},
    {"id":"pixel_arcade_score","name":"Scoreboard Arcade Retro","tags":["pixel","arcade","score","retro"],"description":"Presentación de beneficios del producto como puntuaciones en un arcade retro.","prompt":"Pixel art arcade scoreboard 20s: pantalla de start de videojuego arcade (PRESS START TO PLAY), intro al producto con sprite pixel, cada beneficio = puntuación que se suma (VELOCIDAD +9999 / CALIDAD +MAX / PRECIO +COMBO), efecto pantalla CRT con scanlines y curvatura, 'INSERT COIN' animado al final con dirección web. Sonido: chiptune 8-bit, efectos de coin insert y score. Paleta: negro + verde fosforescente."},
    {"id":"pixel_brand_story","name":"Brand Story 16-Bit","tags":["pixel","16bit","story","brand"],"description":"Historia de la marca narrada en estética SNES/Mega Drive 16-bit con cutscenes.","prompt":"Pixel art 16-bit brand story 30s: cutscene estilo JRPG (Final Fantasy / Chrono Trigger), personaje-fundador pixel art con sprite detallado, diálogos en caja de texto RPG 'Queríamos crear algo diferente...', flashback del origen de la marca, presente: el producto como arma/herramienta del héroe, pantalla final: 'MISIÓN: AYUDARTE' con logo. SNES color palette, 32 colores. Música: chiptune épica."},
  ],
  "video_ads_podcast": [
    {"id":"pod_expert_authority","name":"Clip de Autoridad Experta","tags":["podcast","expert","authority","educational"],"description":"Clip cortado de la parte más impactante de una entrevista a experto.","prompt":"Podcast clip vertical 9:16 para social 30-60s: encuadre talking head sobre tripode con micro visible (Shure SM7B o similar), fondo: librería o set minimalista oscuro, iluminación: key light suave lateral + fill, persona experta hablando con convicción, subtítulos dinámicos estilo podcast viral (texto grande, 1-2 palabras por frame, highlight en color al dictarla), wave de audio animado en la parte inferior. B-roll cutaway de 2-3 segundos en punto clave. 4K."},
    {"id":"pod_founder_story","name":"Founder Story Podcast","tags":["podcast","founder","story","authentic"],"description":"El fundador contando la historia real de por qué creó el producto/empresa.","prompt":"Founder story podcast clip 45-90s: CEO/fundador en setup podcast casual (despacho, café, espacio creativo), micro visible, cámara fija en tripode, iluminación warm tungsten, tono conversacional y vulnerable 'Os voy a contar por qué empecé esto...', historia personal del origen, punto de inflexión emocional, conexión con el cliente 'Si tú también has sentido eso...', CTA natural 'por eso creamos [producto]'. Subtítulos. Sin teleprompter visible."},
    {"id":"pod_customer_success","name":"Customer Success Podcast Style","tags":["podcast","testimonial","success","customer"],"description":"Cliente real contando su historia de éxito en formato podcast auténtico.","prompt":"Customer testimonial en formato podcast 30-45s: cliente sentado en setup podcast (puede ser su propia casa), micro USB en mesa, cámara frontal ligeramente inclinada, lighting: ventana natural lateral, historia específica y measurable 'Antes de [producto] tardaba X horas en... ahora tardo 20 minutos', detalle concreto del resultado ('Aumenté mis ventas un 40%'), recomendación genuina al final. Subtítulos. No guionado — fluidez natural prioritaria."},
  ],

  # ── EXPLODE VIEW 3D ────────────────────────────────────────────────────────
  "explode_view_3d": [
    {"id":"expl_product_mechanical","name":"Despiece Mecánico del Producto","tags":["explode","3d","product","mechanical"],"description":"Vista explosionada 3D del producto mostrando componentes internos y mecanismos.","prompt":"3D explode view animation 15-20s: producto partiéndose en sus componentes en el espacio 3D, cada pieza se separa limpiamente con líneas guía y etiquetas flotantes con nombre de cada componente, cámara orbita lentamente 360° mientras las piezas están separadas (3-4s), luego las piezas vuelven a ensamblarse en movimiento inverso sincronizado, pack-shot final del producto completo. Fondo: negro o gradiente gris oscuro. Materiales: cada componente con su material real (metal, plástico, rubber)."},
    {"id":"expl_ingredients_float","name":"Ingredientes Flotantes 3D","tags":["explode","ingredients","natural","floating"],"description":"Para cosméticos/alimentación: ingredientes flotando alrededor del envase.","prompt":"Ingredient float 3D animation 20s: envase del producto en el centro, ingredientes naturales (pétalos, frutas, plantas, minerales) orbitan a su alrededor emergiendo del envase en cámara lenta, cada ingrediente con etiqueta y beneficio principal, partículas de luz dorada y verde conectando ingredientes con el envase, todos convergen de vuelta al envase al final. Estilo: realismo 3D fotográfico. Fondo blanco o pastel. Música: calm, natural."},
    {"id":"expl_assembly_reverse","name":"Secuencia de Ensamblaje Invertida","tags":["explode","assembly","reverse","engineering"],"description":"El producto 'se fabrica' ante el espectador desde sus partes más pequeñas.","prompt":"Assembly sequence in reverse 20-25s: producto ensamblándose desde sus partes más pequeñas (tornillos, chips, cables) hasta el producto final completo, movimiento de montaje como time-lapse al revés, cámara estática con zoom out progresivo, efecto de luz que se enciende cuando cada parte encaja, audio: clics de ensamblaje satisfactorios, música industrial suave. Final: producto completo con flash de luz y logo. Transmite: calidad de fabricación, precisión, ingeniería."},
    {"id":"expl_packaging_layers","name":"Capas de Packaging Explosionado","tags":["explode","packaging","layers","unbox"],"description":"Las capas del packaging separándose para revelar el producto interior.","prompt":"Packaging explode view 15s: caja exterior se separa en sus 6 caras expandiéndose, capa de papel tissue se desdobla, protección interior se retira, el producto queda en el centro flotando en luz pura. Movimiento: suave, lento, elegante. Cada capa con material texture fotorrealista (matte black box, tissue paper, foam blanco). Vista: front/side a 30° de inclinación. Final: el producto solo, iluminado, sobre el packaging abierto como display. Lujo implícito."},
    {"id":"expl_tech_inside","name":"Tecnología Interior Revelada","tags":["explode","tech","inside","components"],"description":"Para productos tech: revelar la tecnología interior que justifica el precio premium.","prompt":"Tech inside reveal 20s: dispositivo tech abriéndose con animación X-ray, componentes internos visibles capa a capa: chip procesador, batería, sensor array, drivers, cada componente se destaca con círculo de luz y texto técnico ('Driver 40mm Beryllium', 'Procesador 5nm', '40h batería'), cámara gira 90° mostrando el corte transversal, pack-shot exterior con tagline 'Ingeniería que se nota'. Estilo: Apple/Dyson product animation. Fondo negro. Luz blanca y azul."},
  ],

  # ── E-COMMERCE COPY ────────────────────────────────────────────────────────
  "ecommerce_copy": [
    {"id":"ecom_pas_formula","name":"Descripción PAS Alta Conversión","tags":["ecommerce","copy","PAS","conversion"],"description":"Fórmula Problem-Agitate-Solution aplicada a descripción de producto e-commerce.","prompt":"Fórmula PAS para descripción de producto e-commerce de alta conversión:\n\nP-Problema: Abre con el dolor específico del cliente ('¿Cansado de [problema]?')\nA-Agitar: Intensifica el problema y sus consecuencias ('Cada día sin resolverlo...')\nS-Solución: Presenta el producto con 3-5 beneficios medibles, no características\n\nFormato: párrafo apertura gancho (2 líneas) + agitación (2-3 líneas) + solución con bullets + CTA urgente. Tono empático, no vendedor. 150-200 palabras. 2 keywords SEO integradas de forma natural."},
    {"id":"ecom_abandon_cart","name":"Secuencia Carrito Abandonado 3 Emails","tags":["ecommerce","email","abandoned-cart","urgency"],"description":"3 emails progresivos para recuperar carritos abandonados con urgencia escalonada.","prompt":"Secuencia 3 emails carrito abandonado:\n\nEmail 1 (1h): Reminder suave. 'Olvidaste algo importante.' Sin presión. Link al carrito.\nEmail 2 (24h): Social proof + objeción handler. 'X clientes compraron esto hoy'. Responde 2 objeciones comunes.\nEmail 3 (72h): Urgencia real + incentivo. 'Solo quedan X unidades'. Código descuento 10% que expira en 24h.\n\nCada email: Asunto A/B (2 versiones) + Preview text + Cuerpo 100-150 palabras + CTA + Firma. Tono: amigable, no agresivo."},
    {"id":"ecom_social_proof","name":"Copy Basado en Prueba Social","tags":["ecommerce","social-proof","reviews","testimonials"],"description":"Copy de producto construido alrededor de reviews reales y prueba social masiva.","prompt":"Copy e-commerce centrado al 100% en prueba social:\n\n1) Abre con dato impactante ('Más de X clientes', 'Rating 4.9/5 en Y reviews')\n2) Quote de review más impactante como headline secundario\n3) Bullets: 5 beneficios más mencionados en reviews\n4) Sección 'Lo que dicen': 3 micro-testimonials de 1-2 líneas\n5) CTA suave ('Únete a X clientes satisfechos')\n\nToda afirmación respaldada por datos reales o citas. Eliminar superlativas sin prueba."},
    {"id":"ecom_luxury_premium","name":"Copy Posicionamiento Luxury","tags":["ecommerce","luxury","premium","positioning"],"description":"Copy de producto para posicionamiento premium/luxury sin justificar el precio.","prompt":"Copy luxury sin mencionar precio ni justificarlo:\n\nReglas: 1) NUNCA menciones 'relación calidad-precio' 2) No comparar con competencia barata 3) Hablar al ego y aspiración ('Para quienes exigen...') 4) Detalles de craftsmanship y exclusividad 5) Escasez real sin falsedad\n\nEstructura: Headline aspiracional + Párrafo origen/artesanía + Beneficios de experiencia + Quién es el cliente ideal (exclusión implícita) + CTA de posesión ('Hazte con él')."},
    {"id":"ecom_value_budget","name":"Copy Máximo Valor Budget","tags":["ecommerce","value","budget","accessible"],"description":"Copy para productos económicos que maximiza el valor percibido sin parecer barato.","prompt":"Copy para producto budget que maximiza el valor percibido:\n\nEstrategia: 1) Nunca uses 'barato' — usa 'inteligente', 'sin intermediarios', 'directo al valor' 2) Compara con el coste del problema sin resolver 3) Explica POR QUÉ es ese precio (D2C, sin intermediarios, logística propia) 4) Urgencia de valor 'Por este precio no va a durar'\n\nEstructura: Headline de valor + Comparativa implícita del coste del problema + 5 bullets de valor + Trust signals + CTA de decisión fácil."},
    {"id":"ecom_bundle_pack","name":"Copy Bundle y Packs","tags":["ecommerce","bundle","pack","upsell"],"description":"Copy para bundles que aumenta el AOV y hace irresistible la opción completa.","prompt":"Copy de bundle/pack e-commerce que hace irresistible la opción completa:\n\nPsicología: 1) Bundle = 'la solución completa' vs individual = 'parte de la solución' 2) Calcula y destaca el ahorro real ('Valor individual: X€ / Pack: Y€ — ahorras Z€') 3) Nombra el bundle de forma aspiracional (no 'Pack 3 unidades' sino 'El Kit [nombre]') 4) Social proof específico del pack ('X% de clientes elige el pack completo')\n\nEstructura: Nombre del kit + Tagline del resultado completo + Qué incluye + Ahorro real + CTA urgente."},
    {"id":"ecom_limited_edition","name":"Copy Edición Limitada y Escasez","tags":["ecommerce","limited","scarcity","urgency"],"description":"Copy para edición limitada que crea urgencia y FOMO sin manipulación.","prompt":"Copy para edición limitada con urgencia ética:\n\nReglas: 1) La escasez debe ser REAL y verificable 2) No uses countdown fake 3) Número exacto de unidades si es posible 4) Contexto de por qué es limitado (producción artesanal, materia prima escasa)\n\nEstructura: Por qué es limitado (hace la escasez creíble) + Qué lo hace especial esta edición + Número real de unidades + Historia de ediciones anteriores agotadas + CTA con indicador de stock real + Lista de espera para la siguiente edición."},
  ],

  # ── PROMPT TIMELINES — FORMATO 0-1.5 Y 0-2 ────────────────────────────────
  "prompt_timelines": [
    {"id":"tl_015_product_reveal","name":"Timeline 0-1.5 Product Reveal (10 shots, 15s)","tags":["timeline","0-1.5","product","reveal","reels","tiktok"],"description":"10 shots de 1.5s = 15s. Para Reels/TikTok de product reveal con ritmo rápido.","prompt":"TIMELINE 0-1.5 PRODUCT REVEAL (15s / 10 shots de 1.5s cada uno)\n\n[0.0-1.5s] S01 HOOK: Extreme close-up manos sosteniendo producto cerrado, pausa dramática. Prompt: 'Extreme close-up hands holding unopened product, dark studio, single rim light, suspense, 4K cinematic'\n[1.5-3.0s] S02 TEASE: Packaging comienza a abrirse en slow-mo. Prompt: 'Slow motion packaging opening, fingers peeling, low angle, shallow DOF, dramatic lighting'\n[3.0-4.5s] S03 REVEAL: Producto emerge con god-rays. Prompt: 'Product emerging from packaging in god rays of light, glowing hero shot, white background burst'\n[4.5-6.0s] S04 DETAIL #1: Close-up feature principal. Prompt: 'Macro close-up [key feature], perfect lighting, ultra-sharp, 8K detail shot'\n[6.0-7.5s] S05 DETAIL #2: Close-up feature secundario desde ángulo diferente. Prompt: 'Detail shot [feature 2], different angle, studio product photography'\n[7.5-9.0s] S06 LIFESTYLE: En uso, manos naturales. Prompt: 'Lifestyle shot using [product], natural light, authentic candid moment'\n[9.0-10.5s] S07 RESULT: Resultado o transformación. Prompt: 'Before-after result of [product], satisfying outcome, warm lighting'\n[10.5-12.0s] S08 SOCIAL PROOF: Pantalla de reviews con producto bokeh. Prompt: 'Phone screen 5-star reviews over blurred product background'\n[12.0-13.5s] S09 OVERHEAD: Vista aérea del producto completo. Prompt: 'Top-down flatlay on premium surface, elegant composition, perfect lighting'\n[13.5-15.0s] S10 PACK-SHOT CTA: Producto con branding visible. Fade a negro. Prompt: 'Clean product hero shot branding logo visible, commercial quality, fade to black'"},
    {"id":"tl_015_brand_story","name":"Timeline 0-1.5 Brand Story (8 shots, 12s)","tags":["timeline","0-1.5","brand","story","instagram"],"description":"8 shots de 1.5s = 12s. Para contar la historia de marca en Reels.","prompt":"TIMELINE 0-1.5 BRAND STORY (12s / 8 shots de 1.5s)\n\n[0.0-1.5s] S01 PROBLEMA: Visual del pain point, tonos grises. Prompt: 'Person frustrated with [problem], grey desaturated, handheld, authentic struggle'\n[1.5-3.0s] S02 MUNDO ANTES: Vida con el problema sin resolver. Prompt: 'Daily life without solution, mundane grey world, repetitive routine'\n[3.0-4.5s] S03 DESCUBRIMIENTO: Primer destello de color. Prompt: 'Discovery moment, first ray of color breaking through grey, finding solution'\n[4.5-6.0s] S04 MARCA EN ACCIÓN: La propuesta de valor visual, colores de marca. Prompt: 'Brand in action, vibrant brand colors, product being used, energy'\n[6.0-7.5s] S05 TRANSFORMACIÓN: Cambio visible, full color. Prompt: 'Transformation complete, full color world, person transformed, bright energetic'\n[7.5-9.0s] S06 RESULTADO: Beneficio concreto visible. Prompt: 'Real tangible result, happy person with [specific result], warm authentic lighting'\n[9.0-10.5s] S07 COMUNIDAD: Otras personas con el mismo resultado. Prompt: 'Community of happy customers, diverse group, all benefiting, togetherness'\n[10.5-12.0s] S08 LOGO CTA: Logo sobre color de marca, tagline, URL. Prompt: 'Brand logo reveal on brand color background, tagline appears, clean impactful'"},
    {"id":"tl_02_cinematic_product","name":"Timeline 0-2 Cinematic Product (8 shots, 16s)","tags":["timeline","0-2","cinematic","product","youtube"],"description":"8 shots de 2s = 16s. Estilo cinematográfico para YouTube/web. Teal & Orange grade.","prompt":"TIMELINE 0-2 CINEMATIC PRODUCT (16s / 8 shots de 2s)\n\nBASE STYLE LOCK para TODOS los shots: ', cinematic, teal orange color grade, anamorphic 2.39:1, 24fps, film grain, 4K HDR'\n\n[0.0-2.0s] S01: Wide establishing shot del ambiente donde vive el producto. Drone o plano épico fijo.\n[2.0-4.0s] S02: Steadicam/dolly push hacia el producto con rack focus dramático.\n[4.0-6.0s] S03: Reveal del producto con volumetric lighting y god rays.\n[6.0-8.0s] S04: Ultra macro de textura/detalle premium del producto.\n[8.0-10.0s] S05: Persona interactuando con el producto, emoción auténtica.\n[10.0-12.0s] S06: Producto en su entorno natural/aspiracional, contexto de vida.\n[12.0-14.0s] S07: Resultado visual del uso. Impacto emocional máximo.\n[14.0-16.0s] S08: Hero pack-shot final con logo sobre fondo negro. Épico.\n\nAñadir siempre el Base Style Lock al final de CADA prompt de shot para consistencia visual total."},
    {"id":"tl_02_lifestyle_brand","name":"Timeline 0-2 Lifestyle Brand (7 shots, 14s)","tags":["timeline","0-2","lifestyle","brand","aspirational"],"description":"7 shots de 2s = 14s. Para marcas lifestyle y aspiracionales. Golden warm grade.","prompt":"TIMELINE 0-2 LIFESTYLE BRAND (14s / 7 shots de 2s)\n\nBASE STYLE: ', warm cinematic, golden hour light, lifestyle photography, 4K'\n\n[0.0-2.0s] S01 GOLDEN MORNING: Inicio del día del cliente ideal con el producto. Ritual matutino. Luz warm.\n[2.0-4.0s] S02 IN USE: Producto en uso en momento auténtico de la rutina. Completamente natural.\n[4.0-6.0s] S03 TEXTURE: Close-up de la textura/detalle del producto en contexto lifestyle. Luz hermosa.\n[6.0-8.0s] S04 EMOTION: Cara/manos disfrutando el resultado. Emoción genuina, nada actuada.\n[8.0-10.0s] S05 COMMUNITY: 2-3 personas compartiendo la experiencia. Conexión humana real.\n[10.0-12.0s] S06 LANDSCAPE: Plano general de la vida que el producto representa. Completamente aspiracional.\n[12.0-14.0s] S07 BRAND MARK: Logo limpio sobre el frame más poderoso del lifestyle.\n\nAñadir Base Style Lock a CADA prompt de shot para consistencia."},
    {"id":"tl_015_ugc_authentic","name":"Timeline 0-1.5 UGC Auténtico (10 shots, 15s)","tags":["timeline","0-1.5","ugc","tiktok","reels","authentic"],"description":"10 shots de 1.5s = 15s. 100% estilo UGC para TikTok/Reels virales.","prompt":"TIMELINE 0-1.5 UGC AUTÉNTICO (15s / 10 shots de 1.5s)\n\nBASE STYLE: ', ugc style, iPhone handheld, authentic no filter, real person, 9:16'\n\n[0.0-1.5s] S01 HOOK: Cara del creador en primer plano mirando a cámara, expresión 'TENÉIS QUE VER ESTO'.\n[1.5-3.0s] S02 PROBLEMA: Muestra el problema que tenía visualmente. Demostración real.\n[3.0-4.5s] S03 PRESENTA PRODUCTO: Muestra el producto en manos con entusiasmo.\n[4.5-6.0s] S04 EN USO: Demostración rápida de cómo funciona. Before-after flash.\n[6.0-7.5s] S05 DETALLE CLAVE: Close-up del feature más importante. Dedo señalando.\n[7.5-9.0s] S06 REACCIÓN: Cara de reacción al resultado. Emoción genuina sin actuación.\n[9.0-10.5s] S07 ANTES/DESPUÉS: Split screen antes y después lado a lado.\n[10.5-12.0s] S08 PRUEBA SOCIAL: Pantalla de reviews o stats de ventas como screen recording.\n[12.0-13.5s] S09 OBJECIÓN: Gesto 'ya sé lo que estás pensando' + respuesta a la objeción principal.\n[13.5-15.0s] S10 CTA: 'Link en la bio' o código de descuento señalando hacia arriba.\n\nAñadir Base Style Lock a CADA prompt."},
    {"id":"tl_02_explode_3d","name":"Timeline 0-2 Explode View 3D (5 shots, 10s)","tags":["timeline","0-2","explode","3d","product"],"description":"5 shots de 2s = 10s. Para animación 3D de despiece de producto con reensamblaje épico.","prompt":"TIMELINE 0-2 EXPLODE VIEW 3D (10s / 5 shots de 2s)\n\nBASE STYLE: ', 3D product render, photorealistic, dark studio, rim lighting, 4K 60fps'\n\n[0.0-2.0s] S01 PRODUCTO COMPLETO: Rotación lenta 360° del producto ensamblado. Exterior perfecto.\n[2.0-4.0s] S02 INICIO EXPLOSIÓN: Componentes comienzan a separarse suavemente hacia afuera.\n[4.0-6.0s] S03 EXPLOSIÓN COMPLETA: Todos los componentes en el espacio con líneas guía y etiquetas.\n[6.0-8.0s] S04 FEATURE DESTACADO: Cámara se acerca al componente más importante con highlight glowing.\n[8.0-10.0s] S05 REENSAMBLAJE ÉPICO: Todos los componentes vuelven en animación inversa sincronizada con flash final.\n\nAñadir Base Style Lock a CADA prompt para consistencia de render."},
  ],

  # ── BRAND STRATEGY ─────────────────────────────────────────────────────────
  "brand_strategy": [
    {"id":"bs_blueocean","name":"Blue Ocean Brand Canvas","tags":["brand","blue-ocean","strategy","differentiation"],"description":"Análisis Blue Ocean para identificar océanos sin competencia para la marca.","prompt":"Aplica el framework Blue Ocean Strategy a una marca:\n\n1. LIENZO ESTRATÉGICO ACTUAL: Identifica 8-10 factores clave de competencia del sector y evalúa cómo compite la marca hoy vs competencia.\n\n2. ESQUEMA DE LAS 4 ACCIONES:\n   ELIMINAR: ¿Qué factores del sector debe eliminar? (reducen costes)\n   REDUCIR: ¿Qué factores reducir por debajo del estándar?\n   AUMENTAR: ¿Qué factores elevar por encima del estándar?\n   CREAR: ¿Qué factores nuevos que el sector nunca ha ofrecido crear?\n\n3. NUEVA CURVA DE VALOR: Nuevo perfil estratégico resultante.\n\n4. OCÉANO AZUL IDENTIFICADO: Espacio de mercado sin competencia creado.\n\n5. PROPUESTA BLUE OCEAN: Cómo comunicarla al mercado.\n\nFormato: tabla estructurada + párrafo ejecutivo + acciones inmediatas."},
    {"id":"bs_archetype_deep","name":"Arquetipo de Marca Profundo (Jung)","tags":["brand","archetype","jungian","personality"],"description":"Análisis profundo del arquetipo Jungiano de la marca con guía de aplicación práctica.","prompt":"Análisis de arquetipo de marca Jungiano en profundidad:\n\n12 ARQUETIPOS: Inocente / Explorador / Sabio / Héroe / Forajido / Mago / Hombre Corriente / Amante / Bufón / Cuidador / Creador / Gobernante\n\nANALIZAR:\n1. Arquetipo PRIMARIO: cuál encarna la marca, por qué, marcas similares\n2. Arquetipo SECUNDARIO: matiz complementario\n3. Sombra: qué peligros o excesos debe evitar la marca\n4. VOZ del arquetipo: cómo habla, qué palabras usa, qué tono\n5. VISUAL: colores, formas, tipografía que lo representan\n6. COPY DE EJEMPLO: 5 frases reales para la marca según su arquetipo\n7. ERRORES: lo que NUNCA debe decir (rompe el arquetipo)"},
    {"id":"bs_voice_tone_guide","name":"Guía de Voz y Tono de Marca","tags":["brand","voice","tone","guidelines","copywriting"],"description":"Guía completa de voz y tono lista para el equipo de contenidos.","prompt":"Guía de voz y tono de marca completa y usable:\n\n1. CARÁCTER DE VOZ (inmutable): 4 adjetivos que definen LA VOZ. VOZ ≠ TONO. Voz = personalidad. Tono = cómo se expresa según contexto.\n\n2. ESPECTROS DE TONO con ejemplos reales:\n   Divertido ←→ Serio / Formal ←→ Casual / Respetuoso ←→ Irreverente / Entusiasta ←→ Práctico\n\n3. TONO SEGÚN CANAL: Social media / Email / Atención cliente / Web / Publicidad\n\n4. VOCABULARIO DE MARCA:\n   Palabras SÍ usamos (mín 20) / Palabras NUNCA usamos (mín 15, con alternativa)\n\n5. ANTES/DESPUÉS: 5 ejemplos de copy sin guía vs con guía\n\n6. CHECKLIST de revisión: 10 preguntas para validar cualquier texto"},
    {"id":"bs_competitor_map","name":"Mapa de Posicionamiento Competitivo","tags":["brand","competitive","positioning","map"],"description":"Mapa visual y análisis del posicionamiento competitivo con cuadrantes.","prompt":"Análisis de posicionamiento competitivo con mapa de cuadrantes:\n\n1. IDENTIFICA LOS 2 EJES del sector (Precio vs Calidad / Tradicional vs Innovador / etc.)\n\n2. MAPEA cada competidor en el cuadrante (X, Y en escala 1-10)\n\n3. CLUSTERS: ¿Dónde hay aglomeración? ¿Dónde hay espacio vacío?\n\n4. ESPACIOS LIBRES: 2-3 posiciones de mercado sin ocupar (oportunidades)\n\n5. POSICIÓN ÓPTIMA: Dónde debería posicionarse la marca y por qué\n\n6. TABLA COMPARATIVA: Para 5-7 competidores principales, 10 dimensiones clave\n\n7. MAPA EN TABLA: Representa el cuadrante visualmente en texto/markdown\n\nEntrega: tabla + párrafos ejecutivos + recomendaciones."},
    {"id":"bs_messaging_hierarchy","name":"Jerarquía de Mensajes de Marca","tags":["brand","messaging","hierarchy","copy","framework"],"description":"Pirámide de mensajería: desde la esencia hasta los mensajes por audiencia y canal.","prompt":"Pirámide de mensajería de marca en 5 niveles:\n\nN1 ESENCIA (punta): La verdad fundamental de por qué existe la marca. 1 frase. Interno.\nN2 PROMESA: Lo que la marca promete a todos los clientes. 1-2 frases. Corazón del marketing.\nN3 UVP: Por qué elegir esta marca vs competencia. 1 párrafo con prueba.\nN4 PILARES (3-4): Los grandes temas sobre los que tiene autoridad. Para cada pilar: nombre + mensaje + 3 puntos de apoyo + KPI de contenido.\nN5 MENSAJES POR AUDIENCIA: Cómo traduce cada pilar para cada persona objetivo.\n\nMATRIZ FINAL: Tabla cruzada Pilar × Audiencia × Canal con el mensaje específico en cada celda."},
  ],
}

# Aplanar _BUILTIN_DICT a lista con campo 'category' en cada entrada
_BUILTIN_PROMPTS: List[dict] = [
    {**item, "category": cat}
    for cat, items in _BUILTIN_DICT.items()
    for item in items
]

# ── Loader dinámico del vault (~6 300 efectos desde JSON) ─────────────────────

class _Library:
    """Índice en memoria de todos los prompts. Construido una sola vez al arrancar."""

    def __init__(self):
        self._all: List[dict] = []          # lista plana con todos los efectos
        self._by_source: Dict[str, List[dict]] = {}    # source_id → efectos
        self._by_category: Dict[str, List[dict]] = {}  # category → efectos
        self._sources_meta: Dict[str, dict] = {}       # source_id → meta info
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        # 1. Prompts builtin Python
        for item in _BUILTIN_PROMPTS:
            self._add(item, source="builtin", source_label="Prompts Builtin (web design)")
        # 2. JSON del vault principal
        if _VAULT_DIR.exists():
            for p in sorted(_VAULT_DIR.glob("*.json")):
                self._load_json(p)
        # 3. Archivos extra fuera del vault (effects-catalog, design_library)
        for p in _EXTRA_PATHS:
            if p.exists():
                self._load_json(p)
        self._loaded = True

    def _load_json(self, path: Path):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return
        source_id = path.stem
        meta = raw.get("meta") or raw.get("_meta") or {}
        label = (
            meta.get("title") or meta.get("name")
            or source_id.replace("_", " ").replace("-", " ").title()
        )
        self._sources_meta[source_id] = {
            "id": source_id,
            "label": label,
            "file": path.name,
            "size_kb": round(path.stat().st_size / 1024),
            "total": meta.get("total", 0),
            "categories": list(meta.get("categories", [])) if meta.get("categories") else [],
        }
        # ── 1. Array plano conocido (templates/effects/prompts/sections/
        #        components/tools/designs) ──────────────────────────────────
        for key in ("templates", "effects", "prompts", "sections",
                    "components", "tools", "designs"):
            if key in raw and isinstance(raw[key], list):
                for entry in raw[key]:
                    self._add(entry, source=source_id, source_label=label)
                return
        # ── 2. JSON raíz es ya una lista ─────────────────────────────────
        if isinstance(raw, list):
            for entry in raw:
                self._add(entry, source=source_id, source_label=label)
            return
        # ── 3. Estructura anidada {library: {subcategory: [...]}}
        #        (effects-catalog.json: aceternity_ui, dotmatrix_loaders…) ──
        for top_key, top_val in raw.items():
            if top_key.startswith("_"):
                continue
            if not isinstance(top_val, dict):
                continue
            for sub_key, sub_arr in top_val.items():
                if not isinstance(sub_arr, list):
                    continue
                for entry in sub_arr:
                    if not isinstance(entry, dict):
                        continue
                    enriched = dict(entry)
                    enriched.setdefault("category", sub_key.replace("_", " "))
                    enriched.setdefault("library", top_key)
                    self._add(enriched, source=source_id, source_label=label)

    def _add(self, entry: dict, source: str, source_label: str):
        if not isinstance(entry, dict):
            return
        item: dict = {
            # slug como fallback de id (design_library/catalog.json)
            "id":          entry.get("id") or entry.get("_id") or entry.get("slug") or str(uuid.uuid4())[:8],
            "name":        entry.get("name") or entry.get("title") or "Sin nombre",
            "icon":        entry.get("icon") or "✦",
            "category":    entry.get("category") or "general",
            "tags":        entry.get("tags") or [],
            "description": (
                entry.get("description")
                or entry.get("desc")
                or entry.get("summary")
                or ""
            ),
            # adaptive_prompt es el campo de effects-catalog.json
            "prompt": (
                entry.get("prompt")
                or entry.get("adaptive_prompt")
                or entry.get("content")
                or entry.get("code")
                or entry.get("description")
                or ""
            ),
            "source":       source,
            "source_label": source_label,
        }
        # Campos extra útiles (install, api_endpoint, skill, sector_variants…)
        for extra in ("install", "api_endpoint", "skill", "source_url", "license",
                      "entry_type", "sector_variants", "dna_vars", "slug",
                      "effect_type", "use_cases", "props", "library"):
            if extra in entry:
                item[extra] = entry[extra]
        self._all.append(item)
        self._by_source.setdefault(source, []).append(item)
        self._by_category.setdefault(item["category"], []).append(item)

    # ── Consultas ────────────────────────────────────────────────────────────

    def total(self) -> int:
        return len(self._all)

    def sources(self) -> List[dict]:
        result = []
        for sid, meta in self._sources_meta.items():
            result.append({**meta, "count": len(self._by_source.get(sid, []))})
        # Añadir builtin si no tiene meta propia
        if "builtin" not in self._sources_meta:
            result.insert(0, {
                "id": "builtin", "label": "Prompts Builtin (web design)",
                "file": "(interno)", "size_kb": 0,
                "count": len(self._by_source.get("builtin", [])),
            })
        return sorted(result, key=lambda x: x.get("count", 0), reverse=True)

    def categories(self) -> List[dict]:
        return sorted(
            [{"id": k, "count": len(v)} for k, v in self._by_category.items()],
            key=lambda x: x["count"],
            reverse=True,
        )

    def by_source(self, source_id: str, page: int = 1, limit: int = 50) -> dict:
        items = self._by_source.get(source_id, [])
        start = (page - 1) * limit
        return {
            "source": source_id,
            "total": len(items),
            "page": page,
            "limit": limit,
            "pages": max(1, -(-len(items) // limit)),
            "items": items[start:start + limit],
        }

    def by_category(self, category: str, page: int = 1, limit: int = 50) -> dict:
        items = self._by_category.get(category, [])
        start = (page - 1) * limit
        return {
            "category": category,
            "total": len(items),
            "page": page,
            "limit": limit,
            "pages": max(1, -(-len(items) // limit)),
            "items": items[start:start + limit],
        }

    def search(self, q: str, source: Optional[str] = None,
               category: Optional[str] = None, limit: int = 100) -> List[dict]:
        q_l = q.lower().strip()
        pool = (
            self._by_source.get(source, []) if source
            else self._by_category.get(category, []) if category
            else self._all
        )
        results = []
        for item in pool:
            haystack = " ".join([
                item.get("name", ""),
                item.get("description", ""),
                item.get("prompt", ""),
                " ".join(str(t) for t in item.get("tags", [])),
                item.get("category", ""),
                item.get("source_label", ""),
            ]).lower()
            if q_l in haystack:
                results.append(item)
            if len(results) >= limit:
                break
        return results

    def random_item(self, source: Optional[str] = None,
                    category: Optional[str] = None) -> Optional[dict]:
        import random
        pool = (
            self._by_source.get(source, []) if source
            else self._by_category.get(category, []) if category
            else self._all
        )
        return random.choice(pool) if pool else None

    def all_paginated(self, page: int = 1, limit: int = 50,
                      source: Optional[str] = None,
                      category: Optional[str] = None) -> dict:
        pool = (
            self._by_source.get(source, []) if source
            else self._by_category.get(category, []) if category
            else self._all
        )
        start = (page - 1) * limit
        return {
            "total": len(pool),
            "page": page,
            "limit": limit,
            "pages": max(1, -(-len(pool) // limit)),
            "items": pool[start:start + limit],
        }


# Instancia global — se puebla en el startup
_lib = _Library()


@app.on_event("startup")
async def _startup():
    _lib.load()


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@app.get("/api/skills/prompts/stats", tags=["prompts"])
async def prompt_stats():
    """Estadísticas globales de la librería: total, fuentes y categorías."""
    return JSONResponse({
        "total": _lib.total(),
        "sources_count": len(_lib.sources()),
        "categories_count": len(_lib.categories()),
        "top_categories": _lib.categories()[:10],
        "top_sources": _lib.sources()[:10],
    })


@app.get("/api/skills/prompts/sources", tags=["prompts"])
async def list_sources():
    """Lista todas las fuentes de datos (archivos JSON + builtin) con metadatos y conteos."""
    return JSONResponse({"sources": _lib.sources(), "total": len(_lib.sources())})


@app.get("/api/skills/prompts/categories", tags=["prompts"])
async def list_prompt_categories():
    """Lista todas las categorías con conteo de efectos."""
    return JSONResponse({
        "categories": _lib.categories(),
        "total": len(_lib.categories()),
        "total_prompts": _lib.total(),
    })


@app.get("/api/skills/prompts/library", tags=["prompts"])
async def get_prompt_library(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    source: Optional[str] = Query(None, description="Filtrar por fuente (ID del archivo JSON)"),
    category: Optional[str] = Query(None, description="Filtrar por categoría"),
):
    """
    Navega por toda la librería de efectos (~5 800 entradas).
    Paginable. Filtrable por fuente o categoría.
    Cada entrada incluye: id, name, icon, category, tags, description, prompt, source, source_label.
    """
    return JSONResponse(_lib.all_paginated(page=page, limit=limit, source=source, category=category))


@app.get("/api/skills/prompts/source/{source_id}", tags=["prompts"])
async def get_by_source(
    source_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Todos los efectos de una fuente específica (p.ej. '3d_mining_library', 'visme_templates')."""
    data = _lib.by_source(source_id, page=page, limit=limit)
    if not data["total"]:
        raise HTTPException(404, f"Fuente '{source_id}' no encontrada o vacía")
    return JSONResponse(data)


@app.get("/api/skills/prompts/category/{category_id}", tags=["prompts"])
async def get_by_category(
    category_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    """Todos los efectos de una categoría (p.ej. '3d_game_dev', 'css_animations', 'landing_pages')."""
    data = _lib.by_category(category_id, page=page, limit=limit)
    if not data["total"]:
        raise HTTPException(404, f"Categoría '{category_id}' no encontrada o vacía")
    return JSONResponse(data)


@app.get("/api/skills/prompts/search", tags=["prompts"])
async def search_prompts(
    q: str = Query(..., min_length=2, description="Texto a buscar"),
    source: Optional[str] = Query(None, description="Limitar búsqueda a esta fuente"),
    category: Optional[str] = Query(None, description="Limitar búsqueda a esta categoría"),
    limit: int = Query(100, ge=1, le=500),
):
    """
    Búsqueda full-text en nombre, descripción, tags, prompt y categoría.
    Busca en todos los ~5 800 efectos simultáneamente.
    """
    results = _lib.search(q, source=source, category=category, limit=limit)
    return JSONResponse({"results": results, "count": len(results), "query": q})


@app.get("/api/skills/prompts/random", tags=["prompts"])
async def random_prompt(
    source: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
):
    """Devuelve un efecto/prompt aleatorio con su descripción completa."""
    item = _lib.random_item(source=source, category=category)
    if not item:
        raise HTTPException(404, "Sin efectos en ese filtro")
    return JSONResponse(item)


# ═════════════════════════════════════════════════════════════════════════════
# HELPERS COMPARTIDOS (Claude API + JSON parser)
# ═════════════════════════════════════════════════════════════════════════════

async def _claude(prompt: str, max_tokens: int = 4096,
                  model: str = "claude-sonnet-4-6") -> str:
    api_key = _k("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada")
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            json={"model": model, "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]},
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Anthropic error {r.status_code}: {r.text[:300]}")
    return r.json()["content"][0]["text"].strip()

def _parse_json(raw: str) -> dict:
    text = raw.strip()
    if "```" in text:
        for part in text.split("```"):
            p = part.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            try:
                return json.loads(p)
            except Exception:
                continue
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])
        raise


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 5: BRAND DNA EXTRACTOR
# POST /api/skills/brand-dna/extract
# GET  /api/skills/brand-dna/template
# ═════════════════════════════════════════════════════════════════════════════

class BrandDNARequest(BaseModel):
    business_name: str
    industry: str
    description: str
    values: List[str] = []
    target_audience: str = ""
    competitors: List[str] = []
    existing_copy: str = ""
    logo_colors: List[str] = []
    language: str = "es"

@app.post("/api/skills/brand-dna/extract", tags=["brand-dna"])
async def extract_brand_dna(req: BrandDNARequest):
    """Extrae ADN de marca completo: personalidad, voz, tono, mensajería, identidad visual, audiencia, posicionamiento."""
    prompt = f"""Eres un estratega de marca senior con 20 años de experiencia. Analiza estos datos y extrae el ADN de marca completo.

EMPRESA: {req.business_name}
INDUSTRIA: {req.industry}
DESCRIPCIÓN: {req.description}
VALORES: {', '.join(req.values) or 'No especificados'}
AUDIENCIA: {req.target_audience or 'No especificada'}
COMPETIDORES: {', '.join(req.competitors) or 'No especificados'}
COLORES ACTUALES: {', '.join(req.logo_colors) or 'No especificados'}
COPY EXISTENTE:\n{req.existing_copy or '(ninguno)'}
IDIOMA: {req.language}

Genera el ADN de marca en JSON exactamente con esta estructura (sin texto adicional):
{{
  "brand_essence": "frase de 5-7 palabras",
  "brand_promise": "promesa central al cliente",
  "personality": {{
    "archetype": "arquetipo Jungiano",
    "traits": ["trait1","trait2","trait3","trait4","trait5"],
    "voice_adjectives": ["adj1","adj2","adj3"]
  }},
  "tone": {{
    "primary": "tono principal",
    "secondary": "tono secundario",
    "avoid": ["evitar1","evitar2"],
    "formality": "formal|semiformal|casual",
    "example_do": "ejemplo copy correcto",
    "example_dont": "ejemplo copy incorrecto"
  }},
  "messaging": {{
    "tagline": "tagline propuesto",
    "elevator_pitch": "pitch 30 segundos",
    "key_messages": ["msg1","msg2","msg3"],
    "value_proposition": "UVP única",
    "pain_points": ["dolor1","dolor2","dolor3"]
  }},
  "visual_identity": {{
    "primary_color": "#hex",
    "secondary_color": "#hex",
    "accent_color": "#hex",
    "neutral_color": "#hex",
    "color_rationale": "por qué estos colores",
    "typography_style": "descripción tipografía",
    "imagery_style": "descripción estilo imágenes",
    "design_principles": ["p1","p2","p3"]
  }},
  "audience": {{
    "primary": {{
      "name": "nombre del persona",
      "age_range": "rango",
      "description": "perfil completo",
      "pain_points": ["d1","d2"],
      "desires": ["d1","d2"],
      "channels": ["canal1","canal2"]
    }},
    "secondary": {{"name": "persona secundario", "description": "perfil breve"}}
  }},
  "positioning": {{
    "category": "categoría de mercado",
    "differentiation": "diferenciación vs competencia",
    "statement": "Para [audiencia], [marca] es [categoría] que [beneficio] porque [razón]",
    "advantages": ["ventaja1","ventaja2","ventaja3"]
  }},
  "content_strategy": {{
    "pillars": ["pilar1","pilar2","pilar3","pilar4"],
    "content_types": ["tipo1","tipo2","tipo3"],
    "hashtags": ["#tag1","#tag2","#tag3"],
    "story_angles": ["angle1","angle2","angle3"]
  }},
  "guidelines_summary": "resumen ejecutivo de la guía de marca"
}}"""
    raw = await _claude(prompt, max_tokens=4000)
    try:
        dna = _parse_json(raw)
    except Exception:
        dna = {"raw": raw}
    return JSONResponse({"ok": True, "business": req.business_name, "brand_dna": dna})

@app.get("/api/skills/brand-dna/template", tags=["brand-dna"])
async def get_brand_dna_template():
    return JSONResponse({
        "required": ["business_name", "industry", "description"],
        "optional": ["values", "target_audience", "competitors", "existing_copy", "logo_colors", "language"],
        "endpoint": "POST /api/skills/brand-dna/extract",
        "example": {
            "business_name": "Rasta Lo", "industry": "restauración / comida caribeña",
            "description": "Restaurante de comida jamaicana y caribeña en Ibiza, ambiente relajado y festivo",
            "values": ["autenticidad", "sabor", "comunidad", "alegría"],
            "target_audience": "Turistas y residentes 25-45 años que buscan experiencia gastronómica única",
            "competitors": ["Hard Rock Café Ibiza", "Restaurantes de la zona"],
            "logo_colors": ["#1B5E20", "#FFB300", "#D32F2F"], "language": "es",
        },
    })


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 6: BUSINESS INTELLIGENCE — COGS + REPORTS + AUDITS
# POST /api/skills/biz/cogs
# POST /api/skills/biz/report
# POST /api/skills/biz/audit
# GET  /api/skills/biz/types
# ═════════════════════════════════════════════════════════════════════════════

class COGSRequest(BaseModel):
    product_name: str
    product_type: str = "digital_service"
    materials: List[dict] = []
    labor_hours: float = 0
    labor_rate: float = 0
    overhead_monthly: float = 0
    units_per_month: int = 1
    currency: str = "EUR"
    language: str = "es"

class BizReportRequest(BaseModel):
    report_type: str = "executive"
    business_name: str
    period: str = ""
    data: dict = {}
    language: str = "es"
    format: str = "markdown"

class AuditRequest(BaseModel):
    audit_type: str = "brand"
    business_name: str
    url: str = ""
    context: str = ""
    goals: List[str] = []
    language: str = "es"

@app.post("/api/skills/biz/cogs", tags=["business-intelligence"])
async def estimate_cogs(req: COGSRequest):
    """Calcula COGS detallado: materiales, mano de obra, overhead, margen recomendado, precio sugerido."""
    materials_total = sum(float(m.get("cost", 0)) for m in req.materials)
    labor_total = req.labor_hours * req.labor_rate
    overhead_pu = req.overhead_monthly / max(req.units_per_month, 1)
    direct_cogs = materials_total + labor_total + overhead_pu
    prompt = f"""Eres un CFO experto en pricing. Analiza estos costes y genera un informe COGS completo en JSON.

PRODUCTO: {req.product_name} ({req.product_type})
MATERIALES: {json.dumps(req.materials, ensure_ascii=False)}
MANO DE OBRA: {req.labor_hours}h × {req.currency}{req.labor_rate}/h = {req.currency}{labor_total:.2f}
OVERHEAD/UNIDAD: {req.currency}{overhead_pu:.2f}
COGS DIRECTO: {req.currency}{direct_cogs:.2f}
MONEDA: {req.currency}  IDIOMA: {req.language}

Responde SOLO con JSON:
{{
  "product_name": "{req.product_name}",
  "currency": "{req.currency}",
  "breakdown": {{"materials": {materials_total:.2f}, "labor": {labor_total:.2f}, "overhead_per_unit": {overhead_pu:.2f}, "direct_cogs": {direct_cogs:.2f}}},
  "analysis": {{"cogs_total": {direct_cogs:.2f}, "recommended_margin_pct": 0, "minimum_price": 0, "recommended_price": 0, "premium_price": 0, "break_even_units": 0}},
  "margins": {{"at_minimum": 0.0, "at_recommended": 0.0, "at_premium": 0.0}},
  "insights": ["insight1","insight2","insight3"],
  "recommendations": ["rec1","rec2","rec3"],
  "pricing_tiers": [
    {{"tier": "Básico", "price": 0, "margin_pct": 0, "target": "desc"}},
    {{"tier": "Estándar", "price": 0, "margin_pct": 0, "target": "desc"}},
    {{"tier": "Premium", "price": 0, "margin_pct": 0, "target": "desc"}}
  ]
}}"""
    raw = await _claude(prompt, max_tokens=2000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"direct_cogs": direct_cogs, "raw": raw}
    return JSONResponse({"ok": True, "cogs": result})

@app.post("/api/skills/biz/report", tags=["business-intelligence"])
async def generate_biz_report(req: BizReportRequest):
    """Genera informes profesionales: ejecutivo, financiero, marketing, operaciones, SEO, auditoría, cliente."""
    type_map = {
        "executive": "informe ejecutivo de gestión para dirección",
        "financial": "informe financiero con P&L, márgenes, proyecciones",
        "marketing": "informe de marketing: KPIs, CAC, LTV, ROI de campañas",
        "operations": "informe operacional: procesos, eficiencia, cuellos de botella",
        "seo": "informe SEO: visibilidad, rankings, oportunidades, competencia",
        "audit": "informe de auditoría: hallazgos, riesgos, recomendaciones priorizado",
        "client": "informe de resultados para cliente: logros del período, próximos pasos",
    }
    context = type_map.get(req.report_type, req.report_type)
    data_str = json.dumps(req.data, ensure_ascii=False, indent=2) if req.data else "(genera estructura de ejemplo con valores [DATO])"
    prompt = f"""Eres un consultor de negocio senior. Genera un {context} profesional en {req.language}.

EMPRESA: {req.business_name}
PERÍODO: {req.period or 'Actual'}
DATOS:\n{data_str}
FORMATO: {req.format}

Genera un informe completo y estructurado. Incluye: resumen ejecutivo, análisis, hallazgos clave, métricas, recomendaciones accionables, próximos pasos."""
    content = await _claude(prompt, max_tokens=4000)
    return JSONResponse({"ok": True, "report_type": req.report_type, "business": req.business_name, "content": content})

@app.post("/api/skills/biz/audit", tags=["business-intelligence"])
async def run_audit(req: AuditRequest):
    """Auditoría completa: marca, SEO, conversión, pricing, contenido, técnica, e-commerce, social."""
    frameworks = {
        "brand": "consistencia de marca, identidad visual, voz, mensajería, diferenciación",
        "seo": "visibilidad orgánica, estructura URLs, metadatos, Core Web Vitals, backlinks",
        "conversion": "CRO, UX, copy, CTAs, flujo de usuario, fricción, trust signals",
        "pricing": "estrategia precios, anclas, tiers, psicología de precios, competencia",
        "content": "calidad editorial, SEO contenido, calendario, engagement, pilares temáticos",
        "technical": "velocidad de carga, accesibilidad, SEO técnico, seguridad, mobile-first",
        "ecommerce": "catálogo, checkout, abandono, cross-sell, upsell, retención, LTV",
        "social": "presencia, consistencia, engagement rate, contenido orgánico vs paid",
    }
    framework = frameworks.get(req.audit_type, req.audit_type)
    prompt = f"""Eres un auditor senior especializado en {req.audit_type}. Realiza una auditoría profesional completa.

EMPRESA: {req.business_name}  URL: {req.url or 'No proporcionada'}
CONTEXTO: {req.context or 'Sin contexto adicional'}
OBJETIVOS: {', '.join(req.goals) or 'No especificados'}
ÁREAS: {framework}
IDIOMA: {req.language}

Genera la auditoría en JSON:
{{
  "audit_type": "{req.audit_type}", "business": "{req.business_name}", "overall_score": 0,
  "executive_summary": "resumen ejecutivo",
  "strengths": ["f1","f2","f3"], "weaknesses": ["d1","d2","d3"],
  "opportunities": ["o1","o2","o3"], "threats": ["a1","a2"],
  "findings": [
    {{"area": "área", "score": 0, "status": "critical|warning|ok", "finding": "hallazgo", "recommendation": "acción"}}
  ],
  "action_plan": [
    {{"priority": "high|medium|low", "action": "acción", "effort": "horas", "impact": "impacto", "deadline": "plazo"}}
  ],
  "kpis_to_track": ["kpi1","kpi2","kpi3"],
  "next_steps": ["paso1","paso2","paso3"]
}}"""
    raw = await _claude(prompt, max_tokens=4000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"audit_type": req.audit_type, "raw": raw}
    return JSONResponse({"ok": True, "audit": result})

@app.get("/api/skills/biz/types", tags=["business-intelligence"])
async def biz_types():
    return JSONResponse({
        "report_types": ["executive", "financial", "marketing", "operations", "seo", "audit", "client"],
        "audit_types": ["brand", "seo", "conversion", "pricing", "content", "technical", "ecommerce", "social"],
        "product_types": ["digital_service", "physical_product", "subscription", "project"],
    })


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 7: CEO POSITIONING + ACTION PLANS
# POST /api/skills/strategy/positioning
# POST /api/skills/strategy/action-plan
# GET  /api/skills/strategy/frameworks
# ═════════════════════════════════════════════════════════════════════════════

class PositioningRequest(BaseModel):
    business_name: str
    industry: str
    current_position: str = ""
    target_market: str = ""
    competitors: List[str] = []
    budget_range: str = ""
    goals: List[str] = []
    timeframe: str = "12 meses"
    language: str = "es"

class ActionPlanRequest(BaseModel):
    goal: str
    context: str = ""
    current_state: str = ""
    target_state: str = ""
    resources: dict = {}
    timeline: str = "3 meses"
    constraints: List[str] = []
    language: str = "es"

@app.post("/api/skills/strategy/positioning", tags=["strategy"])
async def ceo_positioning(req: PositioningRequest):
    """Estrategia de posicionamiento CEO: análisis competitivo, diferenciación, roadmap."""
    prompt = f"""Eres un consultor estratégico de C-suite con expertise en brand strategy y market positioning.

EMPRESA: {req.business_name}  INDUSTRIA: {req.industry}
POSICIÓN ACTUAL: {req.current_position or 'Sin definir'}
MERCADO TARGET: {req.target_market or 'Sin definir'}
COMPETIDORES: {', '.join(req.competitors) or 'Sin identificar'}
PRESUPUESTO: {req.budget_range or 'No especificado'}
OBJETIVOS: {', '.join(req.goals) or 'Sin definir'}
PLAZO: {req.timeframe}  IDIOMA: {req.language}

Genera una estrategia de posicionamiento ejecutiva en JSON:
{{
  "executive_summary": "resumen estratégico 3 frases",
  "market_analysis": {{"size": "tamaño estimado", "growth": "tendencia", "key_trends": ["t1","t2","t3"], "barriers": ["b1","b2"]}},
  "competitive_map": {{"leaders": ["l1","l2"], "challengers": ["c1"], "niche_players": ["n1"], "our_position": "posición actual", "target_position": "posición objetivo"}},
  "differentiation": {{"unique_strengths": ["f1","f2","f3"], "blue_ocean": ["o1","o2"], "positioning_statement": "Para [audiencia], [empresa] es [categoría] que [beneficio] porque [prueba]", "moat": "ventaja competitiva sostenible"}},
  "go_to_market": {{"primary_channel": "canal principal", "secondary_channels": ["c2","c3"], "messaging_hierarchy": ["m1","m2","m3"], "content_angles": ["a1","a2","a3"]}},
  "roadmap": [
    {{"phase": "Fase 1", "timeline": "meses 1-3", "focus": "foco", "milestones": ["m1","m2"], "budget_pct": 40}},
    {{"phase": "Fase 2", "timeline": "meses 4-6", "focus": "foco", "milestones": ["m1","m2"], "budget_pct": 35}},
    {{"phase": "Fase 3", "timeline": "meses 7-12", "focus": "foco", "milestones": ["m1","m2"], "budget_pct": 25}}
  ],
  "kpis": [{{"metric": "métrica", "current": "valor actual", "target": "objetivo", "tracking": "cómo medir"}}],
  "risks": [{{"risk": "riesgo", "probability": "alta|media|baja", "mitigation": "mitigación"}}],
  "quick_wins": ["acción inmediata 1","acción inmediata 2","acción inmediata 3"],
  "investment_priorities": ["prioridad1","prioridad2","prioridad3"]
}}"""
    raw = await _claude(prompt, max_tokens=4000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"raw": raw}
    return JSONResponse({"ok": True, "business": req.business_name, "strategy": result})

@app.post("/api/skills/strategy/action-plan", tags=["strategy"])
async def generate_action_plan(req: ActionPlanRequest):
    """Plan de acción estructurado: fases, tareas, responsables, KPIs, cronograma Gantt."""
    res_str = json.dumps(req.resources, ensure_ascii=False) if req.resources else "{}"
    prompt = f"""Eres un director de operaciones y PMO experto. Crea un plan de acción ejecutable y detallado.

OBJETIVO: {req.goal}
CONTEXTO: {req.context or 'Sin contexto'}
ESTADO ACTUAL: {req.current_state or 'Sin definir'}
ESTADO OBJETIVO: {req.target_state or 'Sin definir'}
RECURSOS: {res_str}
PLAZO: {req.timeline}
RESTRICCIONES: {', '.join(req.constraints) or 'Ninguna'}
IDIOMA: {req.language}

Genera el plan en JSON:
{{
  "goal": "{req.goal}", "timeline": "{req.timeline}",
  "success_criteria": ["criterio1","criterio2","criterio3"],
  "phases": [
    {{
      "name": "Fase 1 — [nombre]", "duration": "semanas 1-X", "objective": "objetivo",
      "tasks": [{{"id": "T1.1", "task": "tarea", "responsible": "rol", "effort": "horas", "depends_on": [], "deliverable": "entregable"}}],
      "milestone": "milestone clave", "risks": ["riesgo1"]
    }}
  ],
  "resource_plan": {{"human": ["recurso1","recurso2"], "tools": ["herramienta1"], "budget": "estimación"}},
  "gantt_text": "representación textual del Gantt en markdown (tabla con semanas)",
  "kpis": [{{"metric": "métrica", "baseline": "valor base", "target": "objetivo", "frequency": "frecuencia"}}],
  "communication_plan": {{"stakeholders": ["s1","s2"], "reporting_frequency": "semanal|mensual", "channels": ["canal1"]}},
  "escalation_matrix": [{{"trigger": "condición", "action": "acción", "owner": "responsable"}}],
  "quick_start": ["Primera acción HOY","Segunda acción mañana","Tercera acción esta semana"]
}}"""
    raw = await _claude(prompt, max_tokens=4000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"goal": req.goal, "raw": raw}
    return JSONResponse({"ok": True, "action_plan": result})

@app.get("/api/skills/strategy/frameworks", tags=["strategy"])
async def list_strategy_frameworks():
    return JSONResponse({
        "positioning": ["Blue Ocean", "Porter 5 Forces", "SWOT", "BCG Matrix", "Jobs-To-Be-Done", "Value Prop Canvas"],
        "planning": ["OKR", "SMART Goals", "Agile Roadmap", "Gantt", "RACI", "MoSCoW"],
        "analysis": ["brand", "seo", "conversion", "pricing", "content", "technical", "ecommerce", "social"],
    })


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 8: OFIMÁTICA / ADMIN SUITE
# POST /api/skills/admin/folder-structure
# POST /api/skills/admin/contract
# POST /api/skills/admin/estimate
# ═════════════════════════════════════════════════════════════════════════════

class FolderRequest(BaseModel):
    project_type: str = "web_design"
    project_name: str
    client_name: str = ""
    team_size: int = 1
    tools: List[str] = []
    language: str = "es"

class ContractRequest(BaseModel):
    service_type: str = "diseño_web"
    provider_name: str
    client_name: str
    service_description: str
    amount: float
    currency: str = "EUR"
    payment_terms: str = "50% inicio, 50% entrega"
    deadline: str = ""
    revisions: int = 2
    language: str = "es"

class EstimateRequest(BaseModel):
    service_type: str
    client_name: str
    scope: str
    items: List[dict] = []
    currency: str = "EUR"
    tax_pct: float = 21.0
    valid_days: int = 30
    notes: str = ""
    language: str = "es"

@app.post("/api/skills/admin/folder-structure", tags=["admin"])
async def generate_folder_structure(req: FolderRequest):
    """Genera estructura de carpetas y convenciones de nomenclatura para proyectos de agencia."""
    prompt = f"""Eres un director de operaciones de agencia creativa. Diseña la estructura de carpetas y repositorio perfecta.

TIPO DE PROYECTO: {req.project_type}
NOMBRE: {req.project_name}
CLIENTE: {req.client_name or 'Cliente'}
EQUIPO: {req.team_size} persona(s)
HERRAMIENTAS: {', '.join(req.tools) or 'Sin especificar'}
IDIOMA: {req.language}

Genera en JSON:
{{
  "project_name": "{req.project_name}",
  "folder_tree": "árbol en texto con ├── └── │",
  "structure": {{"root_name": "nombre raíz", "folders": [{{"name": "nombre", "purpose": "para qué sirve", "subfolders": ["sub1"], "files": ["plantilla.ext"]}}]}},
  "naming_conventions": {{"files": "convención archivos", "folders": "convención carpetas", "versions": "convención versiones", "deliverables": "convención entregables"}},
  "readme_template": "plantilla README.md del proyecto",
  "gitignore_content": "contenido .gitignore si aplica",
  "setup_commands": ["comando1","comando2"],
  "workflow": ["paso1 del workflow","paso2","paso3"]
}}"""
    raw = await _claude(prompt, max_tokens=3000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"raw": raw}
    return JSONResponse({"ok": True, "structure": result})

@app.post("/api/skills/admin/contract", tags=["admin"])
async def generate_contract(req: ContractRequest):
    """Genera contrato de prestación de servicios profesional listo para firmar."""
    prompt = f"""Eres un abogado mercantil especializado en contratos de servicios digitales. Genera un contrato profesional y legalmente completo.

SERVICIO: {req.service_type}
PROVEEDOR: {req.provider_name}
CLIENTE: {req.client_name}
DESCRIPCIÓN: {req.service_description}
IMPORTE: {req.currency}{req.amount:.2f}
PAGO: {req.payment_terms}
PLAZO: {req.deadline or 'A acordar'}
REVISIONES: {req.revisions}
IDIOMA: {req.language}

Genera el contrato completo en Markdown con: cabecera partes, objeto del contrato, alcance y exclusiones, precio y pago, plazos y entregables, revisiones y cambios extra, propiedad intelectual, confidencialidad, limitación de responsabilidad, rescisión, ley aplicable y jurisdicción, firma."""
    content = await _claude(prompt, max_tokens=4000)
    return JSONResponse({"ok": True, "contract": content, "service_type": req.service_type})

@app.post("/api/skills/admin/estimate", tags=["admin"])
async def generate_estimate(req: EstimateRequest):
    """Genera presupuesto profesional con desglose de partidas, justificación de valor y condiciones."""
    subtotal = sum(float(i.get("quantity", 1)) * float(i.get("unit_price", 0)) for i in req.items)
    tax_amount = subtotal * req.tax_pct / 100
    total = subtotal + tax_amount
    prompt = f"""Eres un director de proyectos. Genera un presupuesto profesional y convincente.

SERVICIO: {req.service_type}  CLIENTE: {req.client_name}
ALCANCE: {req.scope}
PARTIDAS: {json.dumps(req.items, ensure_ascii=False)}
SUBTOTAL: {req.currency}{subtotal:.2f}  IVA ({req.tax_pct}%): {req.currency}{tax_amount:.2f}  TOTAL: {req.currency}{total:.2f}
VALIDEZ: {req.valid_days} días  NOTAS: {req.notes or 'Ninguna'}
IDIOMA: {req.language}

Genera en JSON:
{{
  "estimate_number": "PPTO-[AÑO]-[4DIGITOS]", "date": "[HOY]", "valid_until": "[HOY+{req.valid_days}d]",
  "client": "{req.client_name}", "service": "{req.service_type}",
  "executive_summary": "descripción vendedora 3-4 frases",
  "scope_included": ["incluido1","incluido2","incluido3"],
  "scope_excluded": ["excluido1","excluido2"],
  "line_items": {json.dumps(req.items, ensure_ascii=False)},
  "financials": {{"subtotal": {subtotal:.2f}, "tax_pct": {req.tax_pct}, "tax_amount": {tax_amount:.2f}, "total": {total:.2f}, "currency": "{req.currency}"}},
  "payment_schedule": [
    {{"milestone": "Contratación", "pct": 50, "amount": {total*0.5:.2f}, "due": "a la firma"}},
    {{"milestone": "Entrega final", "pct": 50, "amount": {total*0.5:.2f}, "due": "a la entrega"}}
  ],
  "timeline": "plazo estimado de ejecución",
  "why_us": ["argumento diferenciador 1","argumento 2","argumento 3"],
  "next_steps": ["paso para contratar 1","paso 2"],
  "terms": "condiciones generales resumidas"
}}"""
    raw = await _claude(prompt, max_tokens=3000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"total": total, "raw": raw}
    result["financials"] = {"subtotal": subtotal, "tax_pct": req.tax_pct, "tax_amount": tax_amount, "total": total, "currency": req.currency}
    return JSONResponse({"ok": True, "estimate": result})


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 9: E-COMMERCE SUITE
# POST /api/skills/ecommerce/product-listing
# POST /api/skills/ecommerce/ad-copy
# POST /api/skills/ecommerce/email-sequence
# POST /api/skills/ecommerce/pricing-strategy
# POST /api/skills/ecommerce/seo-metadata
# ═════════════════════════════════════════════════════════════════════════════

class ProductListingRequest(BaseModel):
    product_name: str
    product_type: str = "physical"
    category: str = ""
    key_features: List[str] = []
    target_customer: str = ""
    price: float = 0
    currency: str = "EUR"
    platform: str = "shopify"
    language: str = "es"
    tone: str = "aspiracional"

class AdCopyRequest(BaseModel):
    product_name: str
    offer: str = ""
    target_audience: str = ""
    pain_point: str = ""
    platform: str = "facebook"
    ad_type: str = "conversion"
    language: str = "es"
    variants: int = 3

class EmailSeqRequest(BaseModel):
    sequence_type: str = "welcome"
    brand_name: str
    product_service: str
    tone: str = "amigable y profesional"
    num_emails: int = 5
    language: str = "es"

class PricingStrategyRequest(BaseModel):
    product_service: str
    current_price: float = 0
    currency: str = "EUR"
    cost: float = 0
    competitors_prices: List[float] = []
    target_margin: float = 50
    market_position: str = "mid"
    language: str = "es"

class EcomSEORequest(BaseModel):
    product_name: str
    category: str = ""
    key_features: List[str] = []
    target_keywords: List[str] = []
    language: str = "es"

@app.post("/api/skills/ecommerce/product-listing", tags=["ecommerce"])
async def generate_product_listing(req: ProductListingRequest):
    """Genera listing de producto: título SEO, descripción completa, bullets, metadatos, CTAs."""
    features_str = "\n".join(f"- {f}" for f in req.key_features) if req.key_features else "No especificadas"
    prompt = f"""Eres un copywriter experto en e-commerce con experiencia en {req.platform}. Crea el listing de producto perfecto.

PRODUCTO: {req.product_name}  TIPO: {req.product_type}  CATEGORÍA: {req.category or 'General'}
CARACTERÍSTICAS:\n{features_str}
CLIENTE OBJETIVO: {req.target_customer or 'General'}
PRECIO: {req.currency}{req.price:.2f}  TONO: {req.tone}  IDIOMA: {req.language}

Genera en JSON:
{{
  "title": "título SEO optimizado (máx 80 chars)",
  "subtitle": "subtítulo o tagline",
  "short_description": "descripción corta 150 chars para preview",
  "full_description": "descripción HTML completa con párrafos, bold en palabras clave, emocional y descriptiva",
  "bullet_points": ["beneficio 1 — feature específica","bullet 2","bullet 3","bullet 4","bullet 5"],
  "seo": {{"title_tag": "55-60 chars", "meta_description": "145-155 chars", "keywords": ["kw1","kw2","kw3","kw4","kw5"], "alt_text": "alt text imagen principal"}},
  "social_proof_hooks": ["prueba social 1","hook 2"],
  "objection_handlers": ["objeción → respuesta", "objeción 2 → respuesta"],
  "cta_variations": ["CTA principal","CTA secundario","CTA urgencia"],
  "upsell_suggestion": "producto complementario sugerido",
  "tags": ["tag1","tag2","tag3","tag4","tag5"]
}}"""
    raw = await _claude(prompt, max_tokens=3000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"product": req.product_name, "raw": raw}
    return JSONResponse({"ok": True, "listing": result})

@app.post("/api/skills/ecommerce/ad-copy", tags=["ecommerce"])
async def generate_ad_copy(req: AdCopyRequest):
    """Genera copy de anuncio en múltiples variantes para A/B testing por plataforma."""
    prompt = f"""Eres un copywriter de performance marketing con récord de ROAS 5x+. Crea copy de anuncio.

PRODUCTO/OFERTA: {req.product_name}
OFERTA: {req.offer or 'Sin oferta especial'}
AUDIENCIA: {req.target_audience or 'General'}
PAIN POINT: {req.pain_point or 'Sin definir'}
PLATAFORMA: {req.platform}  TIPO: {req.ad_type}
{req.variants} VARIANTES  IDIOMA: {req.language}

Genera {req.variants} variantes en JSON:
{{
  "variants": [
    {{
      "id": "V1", "hook": "primer segundo (0-3s de atención)",
      "headline": "titular principal",
      "primary_text": "texto principal 2-4 párrafos",
      "cta": "texto del botón CTA",
      "angle": "dolor|aspiración|curiosidad|social|urgencia|autoridad",
      "format_suggestion": "video|carrusel|imagen|historia",
      "target_segment": "segmento específico"
    }}
  ],
  "platform_specs": {{"character_limits": {{"headline": 40, "primary_text": 125}}, "best_practices": ["p1","p2","p3"]}},
  "ab_test_recommendation": "cuál variante probar primero y por qué",
  "creative_brief": "brief para el diseñador/video"
}}"""
    raw = await _claude(prompt, max_tokens=3000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"product": req.product_name, "raw": raw}
    return JSONResponse({"ok": True, "ad_copy": result})

@app.post("/api/skills/ecommerce/email-sequence", tags=["ecommerce"])
async def generate_email_sequence(req: EmailSeqRequest):
    """Genera secuencia de email marketing completa y lista para implementar."""
    seq_ctx = {
        "welcome": "bienvenida a nuevos suscriptores, onboarding de marca",
        "abandoned_cart": "recuperación de carritos abandonados con urgencia y objeciones",
        "post_purchase": "fidelización post-compra, instrucciones uso, upsell",
        "winback": "reactivación de clientes inactivos 90+ días",
        "launch": "lanzamiento de nuevo producto/servicio en 5 actos",
        "nurture": "nurturing de leads fríos hacia la conversión",
    }
    context = seq_ctx.get(req.sequence_type, req.sequence_type)
    prompt = f"""Eres un email marketer experto con tasa de apertura media >35%. Diseña una secuencia de {req.num_emails} emails.

TIPO: {req.sequence_type} — {context}
MARCA: {req.brand_name}  PRODUCTO: {req.product_service}
TONO: {req.tone}  N° EMAILS: {req.num_emails}  IDIOMA: {req.language}

Genera en JSON:
{{
  "sequence_name": "nombre de la secuencia",
  "emails": [
    {{
      "email_number": 1, "send_timing": "inmediatamente|1h|1d|3d|7d",
      "subject_lines": ["asunto A","asunto B para A/B test"],
      "preview_text": "texto de preview",
      "objective": "objetivo de este email",
      "body_html": "HTML del email responsive inline CSS max 600px",
      "cta_text": "texto del botón CTA",
      "cta_url_placeholder": "[URL_CTA]"
    }}
  ],
  "automation_triggers": ["trigger entrada","trigger salida","condiciones"],
  "success_metrics": ["open_rate objetivo","click_rate objetivo","conversión objetivo"]
}}"""
    raw = await _claude(prompt, max_tokens=6000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"sequence_type": req.sequence_type, "raw": raw}
    return JSONResponse({"ok": True, "email_sequence": result})

@app.post("/api/skills/ecommerce/pricing-strategy", tags=["ecommerce"])
async def pricing_strategy(req: PricingStrategyRequest):
    """Estrategia de precios completa: tiers, anclas, psicología, competencia, bundles."""
    comp_avg = sum(req.competitors_prices) / len(req.competitors_prices) if req.competitors_prices else 0
    comp_str = ", ".join(f"{req.currency}{p:.2f}" for p in req.competitors_prices) if req.competitors_prices else "Sin datos"
    cur_margin = ((req.current_price - req.cost) / req.current_price * 100) if req.current_price > 0 else 0
    prompt = f"""Eres un consultor de pricing experto en e-commerce y psicología del consumidor.

PRODUCTO: {req.product_service}  PRECIO ACTUAL: {req.currency}{req.current_price:.2f}
COSTE: {req.currency}{req.cost:.2f}  COMPETENCIA: {comp_str}
MARGEN ACTUAL: {cur_margin:.1f}%  MARGEN OBJETIVO: {req.target_margin}%
POSICIONAMIENTO: {req.market_position}  IDIOMA: {req.language}

Genera estrategia en JSON:
{{
  "analysis": {{"current_margin_pct": {cur_margin:.1f}, "market_avg": {comp_avg:.2f}, "positioning_assessment": "evaluación", "pricing_power": "alta|media|baja"}},
  "recommended_prices": {{
    "entry": {{"price": 0.0, "rationale": "para quién"}},
    "main": {{"price": 0.0, "rationale": "precio estrella"}},
    "premium": {{"price": 0.0, "rationale": "versión premium"}}
  }},
  "psychology_tactics": ["táctica1","táctica2","táctica3"],
  "anchor_strategy": "cómo usar el precio ancla",
  "bundling_suggestions": ["bundle1","bundle2"],
  "discount_strategy": {{"when_to_discount": "criterio", "max_discount_pct": 0, "discount_triggers": ["t1","t2"]}},
  "implementation_steps": ["paso1","paso2","paso3"],
  "test_plan": "cómo testear el nuevo precio sin riesgo"
}}"""
    raw = await _claude(prompt, max_tokens=2500)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"product": req.product_service, "raw": raw}
    return JSONResponse({"ok": True, "pricing": result})

@app.post("/api/skills/ecommerce/seo-metadata", tags=["ecommerce"])
async def generate_ecom_seo(req: EcomSEORequest):
    """Genera metadatos SEO completos: title, meta, H1/H2, schema markup, FAQ, Open Graph."""
    prompt = f"""Eres un SEO specialist experto en e-commerce con top rankings en Google Shopping.

PRODUCTO: {req.product_name}  CATEGORÍA: {req.category or 'General'}
CARACTERÍSTICAS: {', '.join(req.key_features)}
KEYWORDS TARGET: {', '.join(req.target_keywords)}  IDIOMA: {req.language}

Genera en JSON:
{{
  "title_tag": "title SEO 50-60 chars, keyword principal primero",
  "meta_description": "meta description 145-155 chars con CTA implícito",
  "h1": "H1 optimizado",
  "h2_suggestions": ["H2 sección 1","H2 sección 2","H2 FAQ"],
  "schema_markup": {{"@context": "https://schema.org/", "@type": "Product", "name": "{req.product_name}", "description": "descripción para schema"}},
  "keyword_map": {{"primary": "keyword principal", "secondary": ["kw1","kw2","kw3"], "long_tail": ["lt1","lt2","lt3"], "semantic": ["sem1","sem2"]}},
  "faq_schema": [{{"question": "pregunta 1", "answer": "respuesta concisa"}}, {{"question": "pregunta 2", "answer": "respuesta"}}],
  "og_tags": {{"og:title": "OG title", "og:description": "OG desc", "og:type": "product"}},
  "internal_link_anchors": ["anchor de enlace interno 1","anchor 2"]
}}"""
    raw = await _claude(prompt, max_tokens=2500)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"product": req.product_name, "raw": raw}
    return JSONResponse({"ok": True, "seo": result})


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 10: VIDEO AD STUDIO — MULTI-STYLE + PROMPT TIMELINES
# POST /api/skills/video-ads/create
# POST /api/skills/video-ads/timeline
# GET  /api/skills/video-ads/styles
# ═════════════════════════════════════════════════════════════════════════════

_VIDEO_AD_STYLES: dict = {
    "ugc": {
        "name": "UGC (User Generated Content)",
        "description": "Auténtico, raw, persona real a cámara, handheld, sin filtros",
        "specs": "vertical 9:16, 15-60s, luz natural, poca edición, subtítulos",
        "tone": "honesto, personal, directo, como si fuera un amigo recomendando",
        "visual_cues": "cámara frontal, fondo real doméstico/urbano, gestos naturales, imperfecciones aceptadas",
    },
    "podcast": {
        "name": "Podcast Style",
        "description": "Setup de micro y auriculares, autoridad y profundidad conversacional",
        "specs": "16:9 o 1:1, 30-90s, setup estudio mínimo, 1-2 personas",
        "tone": "educativo, reflexivo, autoridad, íntimo",
        "visual_cues": "mesa de podcast, micro visible, librería de fondo, iluminación warm",
    },
    "cinematic": {
        "name": "Cinematic",
        "description": "Calidad Hollywood, cinematografía profesional, grade de color",
        "specs": "16:9 o 2.39:1, 15-30s, dolly/steadicam, color grade LUT personalizado",
        "tone": "aspiracional, épico, emocional, premium",
        "visual_cues": "shallow DOF, golden hour, wide establishing shots, closeups dramáticos, 24fps",
    },
    "pixel_world": {
        "name": "Pixel World",
        "description": "Estético 8-bit/16-bit retro gaming, píxeles visibles, nostálgico",
        "specs": "cualquier ratio, animación pixel art, estética NES/SNES/Gameboy",
        "tone": "lúdico, nostálgico, creativo, diferente",
        "visual_cues": "píxeles grandes visibles, paleta limitada, sprites, UI retro game, chiptune",
    },
    "sci_fi": {
        "name": "Sci-Fi",
        "description": "Futurista, hologramas, neón, cyberpunk, tecnología avanzada",
        "specs": "16:9 o 9:16, interfaces holográficas, neón azul/violeta, motion blur",
        "tone": "visionario, tecnológico, exclusivo, del futuro",
        "visual_cues": "hologramas, UI flotantes, neón, grid digital, glitch effects, lens distortion",
    },
    "cartoon": {
        "name": "Cartoon / Animated 2D",
        "description": "2D animado, personajes expresivos, colores vibrantes, storytelling",
        "specs": "cualquier ratio, animación 2D, líneas limpias, movimientos exagerados",
        "tone": "divertido, accesible, memorable, para todas las edades",
        "visual_cues": "contornos negros, paleta saturada, expresiones exageradas, onomatopeyas",
    },
    "explode_3d": {
        "name": "Explode View 3D",
        "description": "Vista explosionada del producto mostrando componentes internos en 3D",
        "specs": "16:9 o 1:1, render 3D fotorrealista, cámara orbital, explosión sincronizada",
        "tone": "técnico, impresionante, detallista, transmite calidad premium",
        "visual_cues": "piezas separadas en el espacio, líneas de referencia, etiquetas flotantes, dark bg",
    },
}

class VideoAdRequest(BaseModel):
    style: str
    product_name: str
    product_description: str = ""
    target_audience: str = ""
    key_message: str = ""
    duration_seconds: int = 30
    platform: str = "instagram"
    cta: str = "Comprar ahora"
    language: str = "es"
    generate_video: bool = False

class PromptTimelineRequest(BaseModel):
    version: str = "0-2"
    subject: str
    style: str = "cinematic"
    mood: str = "epic"
    duration_total: int = 10
    platform: str = "instagram"
    brand_colors: List[str] = []
    language: str = "es"

@app.post("/api/skills/video-ads/create", tags=["video-ads"])
async def create_video_ad(req: VideoAdRequest, bg: BackgroundTasks):
    """Genera script, shot list y prompts técnicos para video ad en 7 estilos diferentes."""
    if req.style not in _VIDEO_AD_STYLES:
        raise HTTPException(400, f"Estilo '{req.style}' no válido. Opciones: {list(_VIDEO_AD_STYLES)}")
    style_info = _VIDEO_AD_STYLES[req.style]
    prompt = f"""Eres un director creativo y productor de video ads con 15 años en performance marketing.

ESTILO: {style_info['name']}
DESCRIPCIÓN: {style_info['description']}
TONO: {style_info['tone']}
VISUALES CLAVE: {style_info['visual_cues']}
SPECS TÉCNICAS: {style_info['specs']}

PRODUCTO: {req.product_name}
DESCRIPCIÓN PRODUCTO: {req.product_description or 'Sin descripción adicional'}
AUDIENCIA: {req.target_audience or 'Audiencia general'}
MENSAJE CLAVE: {req.key_message or 'Beneficio principal del producto'}
DURACIÓN: {req.duration_seconds}s  PLATAFORMA: {req.platform}  CTA: {req.cta}
IDIOMA: {req.language}

Genera el video ad completo en JSON:
{{
  "concept": "concepto creativo en una frase",
  "hook": "qué ocurre en los primeros 0-3 segundos para captar la atención",
  "script": {{"voiceover": "texto de narración completo", "on_screen_text": ["texto en pantalla 1","texto 2","texto 3"], "music_mood": "upbeat|emotional|epic|chill|dramatic"}},
  "shot_list": [
    {{
      "shot_number": 1, "timecode": "0:00-0:03", "description": "descripción visual detallada",
      "type": "establishing|closeup|medium|overhead|POV|action",
      "movement": "static|pan|tilt|dolly|handheld|drone",
      "audio": "audio de este plano",
      "video_prompt": "prompt técnico EN inglés para generación IA de este plano exacto"
    }}
  ],
  "style_guide": {{"color_grade": "descripción del color grade", "transitions": "tipo de transiciones", "text_style": "estilo de textos en pantalla", "music_tempo": "BPM aproximados"}},
  "production_notes": "notas importantes para el editor",
  "performance_prediction": {{"estimated_ctr": "estimación CTR", "best_use": "cuándo y dónde usarlo", "ab_test_with": "qué variante testear"}},
  "master_video_prompt": "prompt maestro EN INGLÉS para generar el video completo en Runway/Kling"
}}"""
    raw = await _claude(prompt, max_tokens=4000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"concept": "Ver raw", "raw": raw}
    response_data = {
        "ok": True, "style": req.style, "style_info": style_info,
        "product": req.product_name, "video_ad": result, "video_jobs": [],
    }
    if req.generate_video and isinstance(result, dict) and result.get("master_video_prompt"):
        job_id = str(uuid.uuid4())[:8]
        _VIDEO_JOBS[job_id] = {
            "id": job_id, "status": "pending", "provider": "runway",
            "prompt": result["master_video_prompt"], "style": req.style,
            "created_at": time.time(),
        }
        bg.add_task(_poll_loop, job_id)
        response_data["video_jobs"].append({"job_id": job_id, "status": "submitted"})
    return JSONResponse(response_data)

@app.post("/api/skills/video-ads/timeline", tags=["video-ads"])
async def generate_prompt_timeline(req: PromptTimelineRequest):
    """Genera timeline de prompts estructurada estilo 0-1.5 o 0-2 para video IA profesional."""
    if req.version not in ("0-1.5", "0-2"):
        raise HTTPException(400, "version debe ser '0-1.5' o '0-2'")
    shot_duration = 1.5 if req.version == "0-1.5" else 2.0
    num_shots = int(req.duration_total / shot_duration)
    colors_str = ", ".join(req.brand_colors) if req.brand_colors else "no específicos"
    prompt = f"""Eres un director de fotografía y prompt engineer especializado en IA video. Crea un timeline de prompts profesional.

SISTEMA DE TIMING: {req.version} — cada shot dura {shot_duration} segundos
SUJETO: {req.subject}  ESTILO: {req.style}  MOOD: {req.mood}
DURACIÓN: {req.duration_total}s ({num_shots} shots de {shot_duration}s)
PLATAFORMA: {req.platform}  COLORES DE MARCA: {colors_str}
IDIOMA DE PROMPTS: inglés (técnico para IA video)

Genera el timeline completo en JSON:
{{
  "timeline_version": "{req.version}",
  "total_duration": {req.duration_total},
  "shot_count": {num_shots},
  "master_style": "descripción del estilo maestro unificado",
  "shots": [
    {{
      "shot_id": "S01",
      "timecode_start": 0.0,
      "timecode_end": {shot_duration},
      "prompt_en": "technical video prompt in English, cinematographic terms, camera movement, lighting, mood",
      "negative_prompt": "blurry, low quality, watermark, text",
      "camera": "static|pan left|pan right|tilt up|tilt down|zoom in|dolly forward|orbit",
      "lens": "50mm|35mm|85mm|wide 24mm|telephoto 200mm",
      "lighting": "lighting description",
      "mood": "emotional tone",
      "transition_to_next": "cut|dissolve|fade|smash cut|match cut"
    }}
  ],
  "style_lock": {{
    "base_prompt_suffix": "suffix to append to ALL prompts for visual consistency",
    "color_grade_en": "color grading style in English",
    "aspect_ratio": "16:9 or 9:16 or 1:1",
    "fps": "24fps|30fps|60fps"
  }},
  "storyboard_description": "descripción textual del storyboard completo",
  "export_ready_prompts": ["Shot S01 [0.0-{shot_duration}s]: full prompt here", "Shot S02 [{shot_duration}-{shot_duration*2:.1f}s]: full prompt here"]
}}"""
    raw = await _claude(prompt, max_tokens=5000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"version": req.version, "raw": raw}
    return JSONResponse({"ok": True, "timeline": result})

@app.get("/api/skills/video-ads/styles", tags=["video-ads"])
async def list_video_ad_styles():
    return JSONResponse({
        "styles": [{"id": k, **v} for k, v in _VIDEO_AD_STYLES.items()],
        "timeline_versions": {
            "0-1.5": "Shots de 1.5 segundos — ritmo rápido para Reels/TikTok",
            "0-2": "Shots de 2 segundos — estándar para la mayoría de plataformas",
        },
    })


# ═════════════════════════════════════════════════════════════════════════════
# SKILL 11: EFFECTS APPLICATOR
# POST /api/skills/effects/apply
# POST /api/skills/effects/code-from-description
# GET  /api/skills/effects/guide/{effect_id}
# ═════════════════════════════════════════════════════════════════════════════

class EffectApplyRequest(BaseModel):
    effect_id: str = ""
    effect_name: str = ""
    component_type: str = "div"
    context: str = ""
    framework: str = "vanilla"
    color_scheme: str = "dark"
    language: str = "es"

class EffectFromDescRequest(BaseModel):
    description: str
    component_type: str = "div"
    framework: str = "vanilla"
    color_scheme: str = "dark"
    language: str = "es"

@app.post("/api/skills/effects/apply", tags=["effects"])
async def apply_effect(req: EffectApplyRequest):
    """Aplica un efecto de la biblioteca (~6300) a un componente real con código listo para producción."""
    effect = None
    if req.effect_id:
        for item in _lib._all:
            if item.get("id") == req.effect_id:
                effect = item
                break
    if not effect and req.effect_name:
        results = _lib.search(req.effect_name, limit=1)
        if results:
            effect = results[0]
    if not effect:
        raise HTTPException(404, f"Efecto '{req.effect_id or req.effect_name}' no encontrado. Usa GET /api/skills/prompts/search?q=... para buscar.")
    effect_spec = effect.get("prompt") or effect.get("description") or ""
    prompt = f"""Eres un frontend engineer senior experto en efectos CSS/JS y animaciones. Aplica este efecto a un componente real.

EFECTO:
- Nombre: {effect.get('name')}
- Categoría: {effect.get('category')}
- Descripción: {effect.get('description', '')}
- Especificación técnica: {effect_spec[:1200]}

COMPONENTE TARGET: <{req.component_type}>
CONTEXTO: {req.context or 'Aplicación web general'}
FRAMEWORK: {req.framework}  COLOR SCHEME: {req.color_scheme}
IDIOMA: {req.language}

Genera la implementación completa en JSON:
{{
  "effect_name": "{effect.get('name')}",
  "component": "{req.component_type}",
  "framework": "{req.framework}",
  "html": "HTML completo del componente con el efecto",
  "css": "CSS completo necesario",
  "js": "JavaScript necesario si aplica",
  "component_code": "código React/Vue si aplica",
  "npm_packages": ["paquete@version"],
  "cdn_links": ["https://cdn..."],
  "css_variables": [{{"var": "--nombre", "default": "valor", "description": "qué controla"}}],
  "usage_example": "ejemplo de uso completo",
  "performance_notes": "consideraciones de rendimiento",
  "browser_support": "compatibilidad con navegadores",
  "how_it_works": "explicación técnica breve"
}}"""
    raw = await _claude(prompt, max_tokens=5000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"effect": effect.get("name"), "raw": raw}
    return JSONResponse({"ok": True, "effect_info": effect, "implementation": result})

@app.post("/api/skills/effects/code-from-description", tags=["effects"])
async def code_from_description(req: EffectFromDescRequest):
    """Genera código de efecto visual completo desde una descripción en lenguaje natural."""
    prompt = f"""Eres un frontend engineer experto en efectos visuales CSS/JS/WebGL. Crea este efecto desde cero.

DESCRIPCIÓN: {req.description}
COMPONENTE: {req.component_type}  FRAMEWORK: {req.framework}
COLOR SCHEME: {req.color_scheme}  IDIOMA: {req.language}

Genera código COMPLETO y funcional en JSON:
{{
  "effect_name": "nombre del efecto generado",
  "description": "descripción técnica",
  "html": "HTML completo",
  "css": "CSS completo sin omitir nada",
  "js": "JavaScript completo si necesario",
  "codepen_ready": "código completo para pegar en CodePen",
  "react_component": "componente React funcional completo si aplica",
  "customization": {{"variable1": "descripción", "variable2": "descripción"}},
  "how_it_works": "explicación técnica",
  "variations": ["variación 1: descripción y cambio clave","variación 2"]
}}"""
    raw = await _claude(prompt, max_tokens=6000)
    try:
        result = _parse_json(raw)
    except Exception:
        result = {"description": req.description, "raw": raw}
    return JSONResponse({"ok": True, "generated_effect": result})

@app.get("/api/skills/effects/guide/{effect_id}", tags=["effects"])
async def get_effect_guide(effect_id: str):
    """Devuelve la guía completa de un efecto con descripción, prompt y cómo aplicarlo."""
    effect = None
    for item in _lib._all:
        if item.get("id") == effect_id:
            effect = item
            break
    if not effect:
        results = _lib.search(effect_id, limit=1)
        if results:
            effect = results[0]
    if not effect:
        raise HTTPException(404, f"Efecto '{effect_id}' no encontrado")
    return JSONResponse({
        "ok": True, "effect": effect,
        "apply_endpoint": f"POST /api/skills/effects/apply  body: {{\"effect_id\": \"{effect_id}\"}}",
        "search_related": f"GET /api/skills/prompts/search?q={effect.get('category', '')}",
    })


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK & ROOT UI
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health():
    keys = {
        "anthropic":  bool(_k("ANTHROPIC_API_KEY")),
        "openai":     bool(_k("OPENAI_API_KEY")),
        "gemini":     bool(_k("GEMINI_API_KEY") or _k("GOOGLE_AI_API_KEY")),
        "stability":  bool(_k("STABILITY_API_KEY")),
        "replicate":  bool(_k("REPLICATE_API_TOKEN")),
        "runway":     bool(_k("RUNWAY_API_KEY")),
        "kling":      bool(_k("KLING_API_KEY") and _k("KLING_API_SECRET")),
        "luma":       bool(_k("LUMA_API_KEY")),
        "minimax":    bool(_k("MINIMAX_API_KEY")),
        "fal":        bool(_k("FAL_API_KEY")),
    }
    ready = sum(keys.values())
    return JSONResponse({
        "status": "ok",
        "service": "ShopyCrafter AI Skills",
        "version": "1.0.0",
        "api_keys_configured": ready,
        "api_keys_total": len(keys),
        "keys": keys,
        "prompt_library_size": _lib.total(),
        "vault_dir": str(_VAULT_DIR),
        "extra_paths_found": [str(p) for p in _EXTRA_PATHS if p.exists()],
        "vault_loaded": _lib._loaded,
    })


@app.get("/", response_class=HTMLResponse, tags=["system"])
async def root():
    total_prompts = _lib.total()
    return HTMLResponse(f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ShopyCrafter AI Skills</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Space Grotesk',system-ui,sans-serif;background:#080810;color:#e8e8f0;min-height:100vh}}
.hero{{padding:80px 40px 40px;text-align:center;background:radial-gradient(ellipse at 50% 0,rgba(99,102,241,.25) 0,transparent 60%)}}
.badge{{display:inline-block;background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.4);color:#818cf8;border-radius:20px;padding:6px 16px;font-size:.8rem;letter-spacing:.05em;margin-bottom:24px}}
h1{{font-size:3.5rem;font-weight:700;background:linear-gradient(135deg,#818cf8,#c084fc,#fb7185);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:16px}}
.subtitle{{color:#9ca3af;font-size:1.1rem;margin-bottom:40px;max-width:800px;margin-left:auto;margin-right:auto;line-height:1.7}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;max-width:1400px;margin:0 auto;padding:0 40px 80px}}
.card{{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px;transition:all .3s}}
.card:hover{{border-color:rgba(129,140,248,.5);background:rgba(99,102,241,.08);transform:translateY(-4px)}}
.card-icon{{font-size:2.2rem;margin-bottom:14px}}
.card h2{{font-size:1.15rem;font-weight:600;color:#f0f0ff;margin-bottom:8px}}
.card p{{color:#9ca3af;font-size:.88rem;line-height:1.6;margin-bottom:18px}}
.endpoints{{list-style:none}}
.endpoints li{{background:rgba(0,0,0,.3);border-radius:6px;padding:5px 10px;margin-bottom:5px;font-size:.75rem;font-family:monospace;color:#7dd3fc}}
.method{{color:#4ade80;font-weight:600;margin-right:6px}}
.method-get{{color:#34d399}}
.method-post{{color:#fb923c}}
.stats{{display:flex;gap:32px;justify-content:center;padding:32px 40px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:40px}}
.stat{{text-align:center}}
.stat-n{{font-size:2.2rem;font-weight:700;color:#818cf8}}
.stat-l{{color:#6b7280;font-size:.82rem;margin-top:4px}}
.section-label{{text-align:center;color:#6366f1;font-size:.75rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;margin:0 40px 20px;padding-bottom:10px;border-bottom:1px solid rgba(99,102,241,.2)}}
.footer{{text-align:center;padding:40px;color:#4b5563;border-top:1px solid rgba(255,255,255,.05)}}
a{{color:#818cf8;text-decoration:none}}
a:hover{{text-decoration:underline}}
.tag{{display:inline-block;background:rgba(129,140,248,.15);color:#818cf8;border-radius:4px;padding:2px 8px;font-size:.72rem;margin-right:4px;margin-bottom:4px}}
</style>
</head>
<body>
<div class="hero">
  <div class="badge">✦ SHOPYCRAFTER.COM — AI SKILLS BACKEND v2.0</div>
  <h1>AI Skills Engine</h1>
  <p class="subtitle">Landing Design · Image &amp; Video Generation · Brand DNA · Business Intelligence · CEO Strategy · Admin Suite · E-Commerce Suite · Video Ad Studio · Effects Applicator · Mega Prompt Library</p>
  <div class="stats">
    <div class="stat"><div class="stat-n">{total_prompts:,}</div><div class="stat-l">Efectos &amp; prompts</div></div>
    <div class="stat"><div class="stat-n">11</div><div class="stat-l">AI Skills</div></div>
    <div class="stat"><div class="stat-n">7</div><div class="stat-l">Estilos video ad</div></div>
    <div class="stat"><div class="stat-n">4</div><div class="stat-l">Proveedores imagen</div></div>
    <div class="stat"><div class="stat-n">5</div><div class="stat-l">Proveedores vídeo</div></div>
    <div class="stat"><div class="stat-n">60+</div><div class="stat-l">Endpoints API</div></div>
  </div>
</div>

<div class="section-label">Core Generation Skills</div>
<div class="grid">
  <div class="card">
    <div class="card-icon">🏗️</div>
    <h2>Skill 1 — Landing Design AI</h2>
    <p>Genera landing pages HTML completas desde un brief en lenguaje natural. 20+ industrias, layouts pro, código listo para producción.</p>
    <ul class="endpoints">
      <li><span class="method method-get">GET</span>/api/skills/landing/templates</li>
      <li><span class="method method-post">POST</span>/api/skills/landing/generate</li>
      <li><span class="method method-post">POST</span>/api/skills/landing/ai-brief</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-icon">🎨</div>
    <h2>Skill 2 — Image Generation</h2>
    <p>DALL-E 3 → Gemini Imagen 3 → Stability SD3.5 → FLUX 1.1 Pro. Cascada automática con fallback entre proveedores.</p>
    <ul class="endpoints">
      <li><span class="method method-get">GET</span>/api/skills/image/providers</li>
      <li><span class="method method-post">POST</span>/api/skills/image/generate</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-icon">🎬</div>
    <h2>Skill 3 — Video Generation</h2>
    <p>Runway · Kling · Luma · Minimax · Seedance. Texto→vídeo e imagen→vídeo. Polling asíncrono con sistema de jobs.</p>
    <ul class="endpoints">
      <li><span class="method method-get">GET</span>/api/skills/video/providers</li>
      <li><span class="method method-post">POST</span>/api/skills/video/generate</li>
      <li><span class="method method-get">GET</span>/api/skills/video/job/{{id}}</li>
      <li><span class="method method-get">GET</span>/api/skills/video/jobs</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-icon">⚡</div>
    <h2>Skill 4 — Mega Prompt Library</h2>
    <p><strong>{total_prompts:,} efectos</strong> — 3D, Visme, Stitch, TypeGPU, 21st.dev, UI libs, CSS, Aceternity, Google Stitch, landings. Búsqueda full-text.</p>
    <ul class="endpoints">
      <li><span class="method method-get">GET</span>/api/skills/prompts/stats</li>
      <li><span class="method method-get">GET</span>/api/skills/prompts/search?q=aurora</li>
      <li><span class="method method-get">GET</span>/api/skills/prompts/library?page=1</li>
      <li><span class="method method-get">GET</span>/api/skills/prompts/categories</li>
      <li><span class="method method-get">GET</span>/api/skills/prompts/random</li>
    </ul>
  </div>
</div>

<div class="section-label">Brand &amp; Strategy Skills</div>
<div class="grid">
  <div class="card">
    <div class="card-icon">🧬</div>
    <h2>Skill 5 — Brand DNA Extractor</h2>
    <p>Extrae el ADN completo de una marca: personalidad, voz, tono, mensajería, identidad visual, audiencia y posicionamiento. Output JSON estructurado.</p>
    <ul class="endpoints">
      <li><span class="method method-post">POST</span>/api/skills/brand-dna/extract</li>
      <li><span class="method method-get">GET</span>/api/skills/brand-dna/template</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-icon">📊</div>
    <h2>Skill 6 — Business Intelligence</h2>
    <p>COGS detallado con tiers de precio, informes ejecutivos/financieros/marketing/SEO y auditorías completas (8 tipos) con SWOT + plan de acción.</p>
    <ul class="endpoints">
      <li><span class="method method-post">POST</span>/api/skills/biz/cogs</li>
      <li><span class="method method-post">POST</span>/api/skills/biz/report</li>
      <li><span class="method method-post">POST</span>/api/skills/biz/audit</li>
      <li><span class="method method-get">GET</span>/api/skills/biz/types</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-icon">🎯</div>
    <h2>Skill 7 — CEO Strategy &amp; Positioning</h2>
    <p>Estrategia de posicionamiento competitivo con Blue Ocean, roadmap por fases y KPIs. Planes de acción con Gantt textual, fases y escalado.</p>
    <ul class="endpoints">
      <li><span class="method method-post">POST</span>/api/skills/strategy/positioning</li>
      <li><span class="method method-post">POST</span>/api/skills/strategy/action-plan</li>
      <li><span class="method method-get">GET</span>/api/skills/strategy/frameworks</li>
    </ul>
  </div>
</div>

<div class="section-label">Operations &amp; E-Commerce Skills</div>
<div class="grid">
  <div class="card">
    <div class="card-icon">🗂️</div>
    <h2>Skill 8 — Admin Suite</h2>
    <p>Estructuras de carpetas para proyectos de agencia, contratos de servicios digitales listos para firmar y presupuestos con desglose financiero completo.</p>
    <ul class="endpoints">
      <li><span class="method method-post">POST</span>/api/skills/admin/folder-structure</li>
      <li><span class="method method-post">POST</span>/api/skills/admin/contract</li>
      <li><span class="method method-post">POST</span>/api/skills/admin/estimate</li>
    </ul>
  </div>
  <div class="card">
    <div class="card-icon">🛒</div>
    <h2>Skill 9 — E-Commerce Suite</h2>
    <p>Listings SEO para Shopify/Amazon, ad copy multi-variante A/B, secuencias email automation, estrategia de precios con psicología y metadatos SEO con schema.</p>
    <ul class="endpoints">
      <li><span class="method method-post">POST</span>/api/skills/ecommerce/product-listing</li>
      <li><span class="method method-post">POST</span>/api/skills/ecommerce/ad-copy</li>
      <li><span class="method method-post">POST</span>/api/skills/ecommerce/email-sequence</li>
      <li><span class="method method-post">POST</span>/api/skills/ecommerce/pricing-strategy</li>
      <li><span class="method method-post">POST</span>/api/skills/ecommerce/seo-metadata</li>
    </ul>
  </div>
</div>

<div class="section-label">Video &amp; Effects Skills</div>
<div class="grid">
  <div class="card">
    <div class="card-icon">🎥</div>
    <h2>Skill 10 — Video Ad Studio</h2>
    <p>7 estilos de anuncio: UGC · Podcast · Cinematic · Pixel World · Sci-Fi · Cartoon · Explode 3D. Script + shot list + prompts técnicos. Timelines 0-1.5 y 0-2.</p>
    <ul class="endpoints">
      <li><span class="method method-get">GET</span>/api/skills/video-ads/styles</li>
      <li><span class="method method-post">POST</span>/api/skills/video-ads/create</li>
      <li><span class="method method-post">POST</span>/api/skills/video-ads/timeline</li>
    </ul>
    <div style="margin-top:12px">
      <span class="tag">UGC</span><span class="tag">Podcast</span><span class="tag">Cinematic</span>
      <span class="tag">Pixel World</span><span class="tag">Sci-Fi</span><span class="tag">Cartoon</span><span class="tag">Explode 3D</span>
    </div>
  </div>
  <div class="card">
    <div class="card-icon">✨</div>
    <h2>Skill 11 — Effects Applicator</h2>
    <p>Aplica cualquiera de los <strong>{total_prompts:,} efectos</strong> de la biblioteca a un componente real generando código CSS/JS/React listo para producción. También genera efectos desde descripción natural.</p>
    <ul class="endpoints">
      <li><span class="method method-post">POST</span>/api/skills/effects/apply</li>
      <li><span class="method method-post">POST</span>/api/skills/effects/code-from-description</li>
      <li><span class="method method-get">GET</span>/api/skills/effects/guide/{{effect_id}}</li>
    </ul>
  </div>
</div>

<div class="footer">
  <a href="/docs">Swagger Docs</a> · <a href="/redoc">ReDoc</a> · <a href="/health">Health Check</a> ·
  <a href="https://shopycrafter.com" target="_blank">shopycrafter.com</a>
  <br><br>
  <span style="font-size:.8rem;color:#374151">ShopyCrafter AI Skills v2.0 — 11 skills · {total_prompts:,} efectos · FastAPI + Claude Sonnet 4.6</span>
</div>
</body>
</html>""")


# ─────────────────────────────────────────────────────────────────────────────
# ENTRYPOINT — ejecutar directamente o importar desde tu main.py de Replit
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("shopycrafter_skills:app", host="0.0.0.0", port=8000, reload=True)
