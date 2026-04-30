import { LOGO_CORPORATE_B64, LOGO_PRESTIGE_B64 } from "./report-logos.js";

export type CoverTemplate = "classic" | "elegance" | "prestige";

export interface CoverPageOptions {
  reportTitle?: string;
  reportSubtitle?: string;
  companyName: string;
  date?: string;
  badgeLabel?: string;
  template?: CoverTemplate;
}

// FIX: HTML escape to prevent XSS in PDF cover pages
function escHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCoverPage(opts: CoverPageOptions): string {
  const { template = "prestige" } = opts;
  const companyName = escHtml(opts.companyName);

  if (template === "classic") return buildClassicCover(companyName);
  if (template === "elegance") return buildEleganceCover(companyName);
  return buildPrestigeCover(companyName);
}

// Universal cover (style "foto 1"): SC golden medal logo 160px centered + client name bottom-right.
// Same layout for all 3 templates, only background tone changes (kept for legacy compat).
function buildUniversalCover(
  companyName: string,
  background: string,
  logoB64: string,
  accent: string,
): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${background};page-break-after:always;height:100vh;min-height:700px;">
  <tr><td style="padding:0 40px;text-align:center;vertical-align:middle;height:100vh;min-height:700px;">
    <div style="max-width:560px;margin:0 auto;">

      <div style="position:relative;width:200px;height:200px;margin:0 auto 36px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,${accent}33 0%,transparent 70%);"></div>
        <div style="position:absolute;inset:20px;border-radius:50%;overflow:hidden;border:3px solid ${accent}66;box-shadow:0 12px 48px rgba(0,0,0,.55),inset 0 0 24px rgba(0,0,0,.3);">
          <img src="data:image/png;base64,${logoB64}" alt="SC" width="160" height="160" style="width:160px;height:160px;border-radius:50%;display:block;" />
        </div>
      </div>

      <p style="font-size:13px;font-weight:700;color:${accent};letter-spacing:6px;text-transform:uppercase;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
      <div style="width:60px;height:1px;background:${accent}55;margin:0 auto;"></div>

    </div>
  </td></tr>
  <tr><td style="padding:20px 56px 56px;text-align:right;vertical-align:bottom;">
    <p style="font-size:10px;color:${accent}aa;letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Preparado para</p>
    <p style="font-family:'Cormorant Garamond','Georgia',serif;font-size:24px;font-weight:700;color:${accent};font-style:italic;margin:0;letter-spacing:0.5px;">${companyName}</p>
  </td></tr>
</table>`;
}

function buildClassicCover(companyName: string): string {
  return buildUniversalCover(companyName, "#08080e", LOGO_CORPORATE_B64, "rgba(200,168,75,.85)");
}

function buildEleganceCover(companyName: string): string {
  return buildUniversalCover(companyName, "#0b1628", LOGO_CORPORATE_B64, "rgba(192,200,216,.85)");
}

function buildPrestigeCover(companyName: string): string {
  return buildUniversalCover(
    companyName,
    "linear-gradient(180deg,#1a1410 0%,#120e0a 60%,#0d0a07 100%)",
    LOGO_PRESTIGE_B64,
    "rgba(196,149,106,.85)",
  );
}

// ── Contraportada universal ─────────────────────────────────────────────────
// Cierre de informe brandeado SC: medalla dorada + tagline + datos de contacto.
// Se inserta al final del body antes de </body> en cada plantilla.
function buildUniversalBackCover(
  background: string,
  logoB64: string,
  accent: string,
  textColor: string,
): string {
  const date = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${background};page-break-before:always;height:100vh;min-height:700px;">
  <tr><td style="padding:60px 56px 24px;text-align:center;vertical-align:middle;">
    <div style="max-width:520px;margin:0 auto;">

      <div style="position:relative;width:140px;height:140px;margin:0 auto 32px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,${accent}33 0%,transparent 70%);"></div>
        <div style="position:absolute;inset:14px;border-radius:50%;overflow:hidden;border:2px solid ${accent}66;box-shadow:0 8px 32px rgba(0,0,0,.45),inset 0 0 16px rgba(0,0,0,.3);">
          <img src="data:image/png;base64,${logoB64}" alt="SC" width="112" height="112" style="width:112px;height:112px;border-radius:50%;display:block;" />
        </div>
      </div>

      <p style="font-family:'Cormorant Garamond','Georgia',serif;font-size:22px;font-style:italic;color:${textColor};margin:0 0 12px;letter-spacing:0.4px;line-height:1.4;">
        Estrategia, datos e inteligencia artificial<br/>al servicio de tu tienda.
      </p>
      <div style="width:60px;height:1px;background:${accent}55;margin:18px auto 24px;"></div>
      <p style="font-size:11px;font-weight:700;color:${accent};letter-spacing:5px;text-transform:uppercase;margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
      <p style="font-size:12px;color:${textColor}aa;letter-spacing:0.4px;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">
        Plataforma profesional de optimización Shopify
      </p>

    </div>
  </td></tr>
  <tr><td style="padding:24px 56px 56px;vertical-align:bottom;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:bottom;">
          <p style="font-size:9px;color:${textColor}66;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Confidencial</p>
          <p style="font-size:11px;color:${textColor}88;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Documento de uso interno · ${date}</p>
        </td>
        <td style="vertical-align:bottom;text-align:right;">
          <p style="font-size:9px;color:${accent}aa;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Contacto</p>
          <p style="font-size:11px;color:${textColor};margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">shopycrafter.com</p>
          <p style="font-size:10px;color:${textColor}88;margin:2px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;">© ${new Date().getFullYear()} Shopy Crafter</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

export function buildBackCover(template: CoverTemplate = "prestige"): string {
  if (template === "classic") {
    return buildUniversalBackCover("#08080e", LOGO_CORPORATE_B64, "rgba(200,168,75,.85)", "#f0f0f5");
  }
  if (template === "elegance") {
    return buildUniversalBackCover("#0b1628", LOGO_CORPORATE_B64, "rgba(192,200,216,.85)", "#e8ecf2");
  }
  return buildUniversalBackCover(
    "linear-gradient(180deg,#1a1410 0%,#120e0a 60%,#0d0a07 100%)",
    LOGO_PRESTIGE_B64,
    "rgba(196,149,106,.85)",
    "#f0ebe4",
  );
}

export function buildTableOfContents(body: string, template: CoverTemplate = "prestige"): string {
  // FIX: regex más permisiva (acepta div o h1-h6 con class section-title)
  const sectionRegex = /<(?:div|h[1-6])\s+[^>]*class=['"][^'"]*section-title[^'"]*['"][^>]*>([\s\S]*?)<\/(?:div|h[1-6])>/g;
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(body)) !== null) {
    const t = match[1].replace(/<[^>]+>/g, "").trim();
    if (t && !titles.includes(t) && t.length < 200) titles.push(t);
  }
  // FIX: fallback a <h2> si no se encontraron section-title
  if (titles.length === 0) {
    const h2Regex = /<h2[^>]*>([^<]+)<\/h2>/g;
    let m: RegExpExecArray | null;
    while ((m = h2Regex.exec(body)) !== null) {
      const cleaned = m[1].trim().replace(/^[🔴🟠🟡🟢✅❌→·•\s]+/, "");
      if (cleaned && !titles.includes(cleaned) && cleaned.length < 120) {
        titles.push(cleaned);
      }
    }
  }
  if (titles.length === 0) return "";

  const colors: Record<CoverTemplate, { bg: string; accent: string; text: string; subtext: string; line: string; font: string; numBg: string; numColor: string }> = {
    classic: {
      bg: "#08080e",
      accent: "#c8a84b", text: "#f0f0f5", subtext: "rgba(240,240,245,.5)",
      line: "rgba(200,168,75,.12)", font: "'Helvetica Neue',Arial,sans-serif",
      numBg: "rgba(200,168,75,.1)", numColor: "rgba(200,168,75,.8)",
    },
    elegance: {
      bg: "#0b1628",
      accent: "#c0c8d8", text: "#e8ecf2", subtext: "rgba(232,236,242,.5)",
      line: "rgba(192,200,216,.12)", font: "'Playfair Display','Georgia',serif",
      numBg: "rgba(192,200,216,.08)", numColor: "rgba(192,200,216,.7)",
    },
    prestige: {
      bg: "#1a1410",
      accent: "#c4956a", text: "#f0ebe4", subtext: "rgba(240,235,228,.5)",
      line: "rgba(196,149,106,.12)", font: "'Cormorant Garamond','Georgia',serif",
      numBg: "rgba(196,149,106,.08)", numColor: "rgba(196,149,106,.7)",
    },
  };
  const c = colors[template];

  const items = titles.map((t, i) => {
    // FIX: escapar título para evitar XSS via section title
    const safeTitle = escHtml(t);
    return `
    <tr>
      <td width="48" style="padding:14px 8px 14px 0;vertical-align:middle;border-bottom:1px solid ${c.line};">
        <div style="width:36px;height:36px;border-radius:10px;background:${c.numBg};text-align:center;line-height:36px;">
          <span style="font-size:14px;font-weight:700;color:${c.numColor};font-family:${c.font};">${String(i + 1).padStart(2, "0")}</span>
        </div>
      </td>
      <td style="padding:14px 0;vertical-align:middle;font-size:15px;font-weight:500;color:${c.text};letter-spacing:.3px;font-family:${c.font};border-bottom:1px solid ${c.line};">${safeTitle}</td>
    </tr>`;
  }).join("");

  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.bg};page-break-after:always;">
  <tr><td style="padding:60px 48px;">
    <p style="font-size:28px;font-weight:700;color:${c.accent};letter-spacing:2px;text-transform:uppercase;font-family:${c.font};margin:0 0 8px;">Índice</p>
    <div style="height:1px;background:${c.line};margin-bottom:8px;"></div>
    <p style="font-size:13px;color:${c.subtext};letter-spacing:1px;text-transform:uppercase;margin:0 0 32px;font-family:'Helvetica Neue',Arial,sans-serif;">Contenidos del informe &middot; ${titles.length} secciones</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${items}
    </table>
  </td></tr>
  <tr><td style="padding:16px 48px 40px;text-align:right;">
    <p style="font-size:12px;color:${c.subtext};letter-spacing:1px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
  </td></tr>
</table>`;
}
