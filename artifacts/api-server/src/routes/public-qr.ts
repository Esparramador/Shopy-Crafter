/**
 * Public QR Landing Page — sin autenticación.
 *
 * GET /public/qr/:cardId
 *
 * Sirve una página HTML responsiva que muestra el contenido del QR:
 *   - url        → redirect inmediato
 *   - vcard      → tarjeta de contacto descargable
 *   - video      → player fullscreen (YouTube embed o video directo)
 *   - image      → imagen fullscreen con descarga
 *   - animation  → animación CSS con el nombre del titular
 */
import { Router, type Request, type Response } from "express";
import { db, businessCardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router = Router();

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function buildHtml(opts: {
  title: string;
  subtitle: string;
  qrType: string;
  contentUrl: string;
  cardName: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  fullName: string;
  palette: { bg: string; primary: string; accent: string; text: string };
}): string {
  const { title, subtitle, qrType, contentUrl, palette } = opts;
  const bg = palette.bg || "#0a0a0a";
  const accent = palette.accent || "#d4af37";
  const textColor = palette.text || "#f0f0f0";

  if (qrType === "url") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=${escHtml(contentUrl)}"/>
<title>Redirigiendo...</title></head>
<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<p>Redirigiendo a <a href="${escHtml(contentUrl)}" style="color:#d4af37">${escHtml(contentUrl)}</a>…</p>
</body></html>`;
  }

  let mediaHtml = "";

  if (qrType === "video") {
    const ytId = getYoutubeId(contentUrl);
    if (ytId) {
      mediaHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin:24px 0;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
  <iframe src="https://www.youtube.com/embed/${escHtml(ytId)}?autoplay=1&rel=0&modestbranding=1"
    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allowfullscreen allow="autoplay"></iframe>
</div>`;
    } else if (isDirectVideo(contentUrl)) {
      mediaHtml = `<video src="${escHtml(contentUrl)}" controls autoplay style="width:100%;border-radius:12px;margin:24px 0;box-shadow:0 20px 60px rgba(0,0,0,0.5);max-height:60vh;object-fit:contain" preload="metadata">
  Tu navegador no soporta video HTML5. <a href="${escHtml(contentUrl)}" style="color:${escHtml(accent)}">Descargar video</a>
</video>`;
    } else {
      mediaHtml = `<div style="margin:24px 0;padding:20px;background:rgba(255,255,255,0.05);border-radius:12px;text-align:center">
  <p style="margin:0 0 12px;color:rgba(255,255,255,0.7)">Ver video:</p>
  <a href="${escHtml(contentUrl)}" target="_blank" rel="noopener"
    style="display:inline-block;padding:12px 28px;background:${escHtml(accent)};color:#000;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px">
    ▶ Abrir video
  </a>
</div>`;
    }
  } else if (qrType === "image") {
    mediaHtml = `<div style="margin:24px 0;text-align:center">
  <img src="${escHtml(contentUrl)}" alt="Contenido" style="max-width:100%;max-height:70vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);object-fit:contain" onerror="this.style.display='none'"/>
  <div style="margin-top:16px">
    <a href="${escHtml(contentUrl)}" download target="_blank" rel="noopener"
      style="display:inline-block;padding:10px 22px;background:rgba(255,255,255,0.1);color:${escHtml(textColor)};border:1px solid rgba(255,255,255,0.2);border-radius:8px;text-decoration:none;font-size:13px">
      ↓ Descargar imagen
    </a>
  </div>
</div>`;
  } else if (qrType === "animation") {
    const name = escHtml(opts.fullName || title);
    const company = escHtml(opts.companyName || "");
    const job = escHtml(opts.jobTitle || "");
    mediaHtml = `<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;600&display=swap');
@keyframes fadeUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
@keyframes glowPulse { 0%,100% { box-shadow:0 0 30px ${accent}44; } 50% { box-shadow:0 0 60px ${accent}88, 0 0 100px ${accent}22; } }
@keyframes scanLine { from { top:-5%; } to { top:105%; } }
.card-anim { animation: fadeUp 0.8s ease-out forwards, glowPulse 3s ease-in-out infinite; }
.name-anim { animation: fadeUp 1.2s ease-out 0.3s both; }
.info-anim { animation: fadeUp 1s ease-out 0.6s both; }
.contact-anim { animation: fadeUp 1s ease-out 0.9s both; }
</style>
<div style="margin:24px 0">
  <div class="card-anim" style="position:relative;background:linear-gradient(135deg,${escHtml(bg)},${escHtml(palette.primary||bg)});border:1px solid ${escHtml(accent)}44;border-radius:16px;padding:48px 36px;overflow:hidden;max-width:440px;margin:0 auto">
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,transparent 60%,${escHtml(accent)}08);pointer-events:none"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${escHtml(accent)},transparent)"></div>
    ${company ? `<div class="info-anim" style="font-family:'Inter',sans-serif;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${escHtml(accent)};margin-bottom:20px;opacity:0">${company}</div>` : ""}
    <div class="name-anim" style="font-family:'Cinzel',serif;font-size:clamp(22px,5vw,32px);font-weight:700;color:${escHtml(textColor)};line-height:1.2;margin-bottom:8px;opacity:0">${name}</div>
    ${job ? `<div class="info-anim" style="font-family:'Inter',sans-serif;font-size:14px;color:${escHtml(accent)};margin-bottom:24px;font-weight:300;letter-spacing:0.5px;opacity:0">${job}</div>` : ""}
    <div class="contact-anim" style="opacity:0;display:flex;flex-direction:column;gap:8px;font-family:'Inter',sans-serif;font-size:13px;color:rgba(255,255,255,0.6)">
      ${opts.email ? `<span>✉ ${escHtml(opts.email)}</span>` : ""}
      ${opts.phone ? `<span>✆ ${escHtml(opts.phone)}</span>` : ""}
      ${opts.website ? `<span>🌐 ${escHtml(opts.website)}</span>` : ""}
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${escHtml(accent)}44,transparent)"></div>
  </div>
</div>`;
  } else {
    // vCard — contact card
    mediaHtml = `<div style="margin:24px 0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;max-width:400px;margin:24px auto">
  <div style="display:flex;flex-direction:column;gap:10px">
    ${opts.email ? `<div style="display:flex;align-items:center;gap:10px;font-size:14px"><span style="font-size:18px">✉</span><a href="mailto:${escHtml(opts.email)}" style="color:${escHtml(accent)};text-decoration:none">${escHtml(opts.email)}</a></div>` : ""}
    ${opts.phone ? `<div style="display:flex;align-items:center;gap:10px;font-size:14px"><span style="font-size:18px">✆</span><a href="tel:${escHtml(opts.phone)}" style="color:${escHtml(accent)};text-decoration:none">${escHtml(opts.phone)}</a></div>` : ""}
    ${opts.website ? `<div style="display:flex;align-items:center;gap:10px;font-size:14px"><span style="font-size:18px">🌐</span><a href="${escHtml(opts.website.startsWith("http") ? opts.website : "https://" + opts.website)}" target="_blank" rel="noopener" style="color:${escHtml(accent)};text-decoration:none">${escHtml(opts.website)}</a></div>` : ""}
  </div>
  ${contentUrl ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">
    <a href="${escHtml(contentUrl)}" download style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:${escHtml(accent)};color:#000;border-radius:8px;font-weight:700;text-decoration:none;font-size:13px">
      ↓ Guardar contacto (.vcf)
    </a>
  </div>` : ""}
</div>`;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${escHtml(title)}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${escHtml(bg)};color:${escHtml(textColor)};font-family:-apple-system,'Inter',system-ui,sans-serif;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:0}
  .hero{width:100%;padding:48px 24px 0;max-width:600px;margin:0 auto}
  .brand-badge{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${escHtml(accent)};margin-bottom:20px;opacity:0.8}
  .card-name{font-size:clamp(22px,6vw,36px);font-weight:700;line-height:1.2;margin-bottom:6px;color:${escHtml(textColor)}}
  .card-sub{font-size:15px;color:rgba(255,255,255,0.5);margin-bottom:4px}
  .divider{width:48px;height:2px;background:linear-gradient(90deg,${escHtml(accent)},transparent);margin:24px 0;border-radius:99px}
  .media-wrap{width:100%;max-width:600px;padding:0 24px 48px;margin:0 auto}
  .footer{margin-top:auto;padding:24px;text-align:center;font-size:11px;color:rgba(255,255,255,0.2);letter-spacing:1px}
</style>
</head>
<body>
<div class="hero">
  <div class="brand-badge">Tarjeta Digital · Card Studio</div>
  <div class="card-name">${escHtml(title)}</div>
  <div class="card-sub">${escHtml(subtitle)}</div>
  <div class="divider"></div>
</div>
<div class="media-wrap">
  ${mediaHtml}
</div>
<div class="footer">CARD STUDIO · SHOPY CRAFTER</div>
</body>
</html>`;
}

router.get("/public/qr/:cardId", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.cardId), 10);
    if (isNaN(id) || id <= 0) {
      res.status(404).send("<html><body>QR no encontrado</body></html>");
      return;
    }

    const [row] = await db.select().from(businessCardsTable).where(eq(businessCardsTable.id, id));
    if (!row) {
      res.status(404).send("<html><body>Tarjeta no encontrada</body></html>");
      return;
    }

    const qrType: string = (row as any).qrType || "vcard";
    const contentUrl: string = (row as any).qrContentUrl || row.qrUrl || "";

    let palette = { bg: "#0a0a0a", primary: "#1a1a1a", accent: "#d4af37", text: "#f0f0f0" };
    try {
      const p = JSON.parse(row.palette || "{}");
      if (p.bg) palette = { ...palette, ...p };
    } catch {}

    if (qrType === "url" && contentUrl) {
      res.redirect(302, contentUrl);
      return;
    }

    const html = buildHtml({
      title: row.fullName || "Tarjeta de visita",
      subtitle: [row.jobTitle, row.companyName].filter(Boolean).join(" · "),
      qrType,
      contentUrl,
      cardName: row.name || "",
      email: row.email,
      phone: row.phone,
      website: row.website,
      jobTitle: row.jobTitle,
      companyName: row.companyName,
      fullName: row.fullName,
      palette,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.status(200).send(html);
  } catch (err: any) {
    logger.error({ err: err?.message }, "public-qr: failed");
    res.status(500).send("<html><body>Error cargando contenido QR</body></html>");
  }
});

export default router;
