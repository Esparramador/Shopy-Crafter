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

export function buildCoverPage(opts: CoverPageOptions): string {
  const { companyName, template = "prestige" } = opts;

  if (template === "classic") return buildClassicCover(companyName);
  if (template === "elegance") return buildEleganceCover(companyName);
  return buildPrestigeCover(companyName);
}

function buildClassicCover(companyName: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#08080e;page-break-after:always;">
  <tr><td style="padding:80px 40px 20px;text-align:center;">
    <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="Shopy Crafter" width="120" height="120" style="width:120px;height:120px;border-radius:24px;border:2px solid rgba(200,168,75,.25);display:block;margin:0 auto 24px;" />
    <p style="font-size:28px;font-weight:700;color:rgba(200,168,75,.85);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
  </td></tr>
  <tr><td style="padding:20px 40px 60px;text-align:right;">
    <p style="font-size:14px;color:rgba(200,168,75,.45);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:500;">${companyName}</p>
  </td></tr>
</table>`;
}

function buildEleganceCover(companyName: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1628;page-break-after:always;">
  <tr><td style="padding:80px 40px 20px;text-align:center;">
    <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="Shopy Crafter" width="120" height="120" style="width:120px;height:120px;border-radius:24px;border:2px solid rgba(192,200,216,.2);display:block;margin:0 auto 24px;" />
    <p style="font-size:28px;font-weight:700;color:rgba(192,200,216,.8);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
  </td></tr>
  <tr><td style="padding:20px 40px 60px;text-align:right;">
    <p style="font-size:14px;color:rgba(192,200,216,.4);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:500;">${companyName}</p>
  </td></tr>
</table>`;
}

function buildPrestigeCover(companyName: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(180deg,#1a1410 0%,#120e0a 60%,#0d0a07 100%);page-break-after:always;height:100vh;min-height:700px;">
  <tr><td style="padding:0 40px;text-align:center;vertical-align:middle;height:100vh;min-height:700px;">
    <div style="max-width:560px;margin:0 auto;">

      <div style="width:12px;height:12px;background:rgba(196,149,106,.6);transform:rotate(45deg);margin:0 auto 40px;"></div>

      <p style="font-size:11px;font-weight:600;color:rgba(196,149,106,.5);letter-spacing:6px;text-transform:uppercase;margin:0 0 40px;font-family:'Helvetica Neue',Arial,sans-serif;">S H O P Y &nbsp;&nbsp; C R A F T E R</p>

      <div style="width:110px;height:110px;border-radius:50%;overflow:hidden;margin:0 auto 44px;border:2px solid rgba(196,149,106,.3);box-shadow:0 8px 40px rgba(0,0,0,.4);">
        <img src="data:image/png;base64,${LOGO_PRESTIGE_B64}" alt="SC" width="110" height="110" style="width:110px;height:110px;border-radius:50%;display:block;" />
      </div>

      <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(196,149,106,.4),transparent);margin:0 auto 32px;"></div>

      <p style="font-size:13px;font-weight:600;color:rgba(196,149,106,.4);letter-spacing:4px;text-transform:uppercase;margin:0 0 20px;font-family:'Helvetica Neue',Arial,sans-serif;">Informe de Consultoría Digital</p>

      <div style="width:100px;height:1px;background:linear-gradient(90deg,transparent,rgba(196,149,106,.25),transparent);margin:0 auto 44px;"></div>

      <div style="background:rgba(196,149,106,.04);border:1px solid rgba(196,149,106,.12);border-radius:16px;padding:28px 40px;margin:0 auto;display:inline-block;">
        <p style="font-size:10px;color:rgba(196,149,106,.4);letter-spacing:3px;text-transform:uppercase;margin:0 0 10px;font-family:'Helvetica Neue',Arial,sans-serif;">Preparado para</p>
        <p style="font-family:'Cormorant Garamond','Georgia',serif;font-size:28px;font-weight:700;color:rgba(196,149,106,.85);font-style:italic;margin:0;letter-spacing:0.5px;">${companyName}</p>
      </div>

      <div style="margin-top:48px;">
        <div style="width:100px;height:1px;background:linear-gradient(90deg,transparent,rgba(196,149,106,.15),transparent);margin:0 auto 20px;"></div>
        <p style="font-size:9px;color:rgba(196,149,106,.25);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">shopycrafter.com &nbsp;&middot;&nbsp; Confidencial</p>
      </div>

    </div>
  </td></tr>
</table>`;
}

export function buildTableOfContents(body: string, template: CoverTemplate = "prestige"): string {
  const sectionRegex = /<div\s+class="section-title"[^>]*>([^<]+)<\/div>/g;
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(body)) !== null) {
    const t = match[1].trim();
    if (t && !titles.includes(t)) titles.push(t);
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

  const items = titles.map((t, i) => `
    <tr>
      <td width="48" style="padding:14px 8px 14px 0;vertical-align:middle;border-bottom:1px solid ${c.line};">
        <div style="width:36px;height:36px;border-radius:10px;background:${c.numBg};text-align:center;line-height:36px;">
          <span style="font-size:14px;font-weight:700;color:${c.numColor};font-family:${c.font};">${String(i + 1).padStart(2, "0")}</span>
        </div>
      </td>
      <td style="padding:14px 0;vertical-align:middle;font-size:15px;font-weight:500;color:${c.text};letter-spacing:.3px;font-family:${c.font};border-bottom:1px solid ${c.line};">${t}</td>
    </tr>`).join("");

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
