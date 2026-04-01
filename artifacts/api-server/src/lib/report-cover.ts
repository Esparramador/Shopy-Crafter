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
<div class="sc-cover-page" style="min-height:100vh;page-break-after:always;background:linear-gradient(170deg,#08080e 0%,#0c0c14 40%,#08080e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0;margin:0;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 40%,rgba(200,168,75,.05) 0%,transparent 60%);pointer-events:none;"></div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;">
    <div style="width:160px;height:160px;border-radius:32px;overflow:hidden;border:2px solid rgba(200,168,75,.25);box-shadow:0 30px 80px rgba(0,0,0,.5);margin-bottom:28px;">
      <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="Shopy Crafter" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    <p style="font-size:32px;font-weight:700;color:rgba(200,168,75,.85);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
  </div>
  <div style="position:absolute;bottom:40px;right:48px;z-index:1;">
    <p style="font-size:14px;color:rgba(200,168,75,.45);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:500;">${companyName}</p>
  </div>
</div>`;
}

function buildEleganceCover(companyName: string): string {
  return `
<div class="sc-cover-page" style="min-height:100vh;page-break-after:always;background:linear-gradient(160deg,#0b1628 0%,#0f1d35 35%,#111e36 65%,#0b1628 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0;margin:0;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 40%,rgba(192,200,216,.06) 0%,transparent 70%);pointer-events:none;"></div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;">
    <div style="width:160px;height:160px;border-radius:32px;overflow:hidden;border:2px solid rgba(192,200,216,.2);box-shadow:0 30px 80px rgba(0,0,0,.5);margin-bottom:28px;">
      <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="Shopy Crafter" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    <p style="font-size:32px;font-weight:700;color:rgba(192,200,216,.8);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
  </div>
  <div style="position:absolute;bottom:40px;right:48px;z-index:1;">
    <p style="font-size:14px;color:rgba(192,200,216,.4);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:500;">${companyName}</p>
  </div>
</div>`;
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

  const colors: Record<CoverTemplate, { bg: string; accent: string; accentRgba: string; text: string; subtext: string; dot: string; line: string; font: string; numBg: string; numColor: string }> = {
    classic: {
      bg: "linear-gradient(170deg,#08080e 0%,#0c0c14 40%,#08080e 100%)",
      accent: "#c8a84b", accentRgba: "rgba(200,168,75,", text: "#f0f0f5", subtext: "rgba(240,240,245,.5)",
      dot: "rgba(200,168,75,.6)", line: "rgba(200,168,75,.12)", font: "'Helvetica Neue',Arial,sans-serif",
      numBg: "rgba(200,168,75,.1)", numColor: "rgba(200,168,75,.8)",
    },
    elegance: {
      bg: "linear-gradient(160deg,#0b1628 0%,#0f1d35 35%,#111e36 65%,#0b1628 100%)",
      accent: "#c0c8d8", accentRgba: "rgba(192,200,216,", text: "#e8ecf2", subtext: "rgba(232,236,242,.5)",
      dot: "rgba(192,200,216,.6)", line: "rgba(192,200,216,.12)", font: "'Playfair Display','Georgia',serif",
      numBg: "rgba(192,200,216,.08)", numColor: "rgba(192,200,216,.7)",
    },
    prestige: {
      bg: "linear-gradient(160deg,#1a1410 0%,#211a14 30%,#1e1812 60%,#1a1410 100%)",
      accent: "#c4956a", accentRgba: "rgba(196,149,106,", text: "#f0ebe4", subtext: "rgba(240,235,228,.5)",
      dot: "rgba(196,149,106,.6)", line: "rgba(196,149,106,.12)", font: "'Cormorant Garamond','Georgia',serif",
      numBg: "rgba(196,149,106,.08)", numColor: "rgba(196,149,106,.7)",
    },
  };
  const c = colors[template];

  const items = titles.map((t, i) => `
    <div style="display:flex;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid ${c.line};">
      <div style="width:36px;height:36px;border-radius:10px;background:${c.numBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span style="font-size:14px;font-weight:700;color:${c.numColor};font-family:${c.font};">${String(i + 1).padStart(2, "0")}</span>
      </div>
      <div style="flex:1;font-size:15px;font-weight:500;color:${c.text};letter-spacing:.3px;font-family:${c.font};">${t}</div>
      <div style="width:8px;height:8px;border-radius:50%;background:${c.dot};flex-shrink:0;opacity:.5;"></div>
    </div>`).join("");

  return `
<div class="sc-toc-page" style="min-height:100vh;page-break-after:always;background:${c.bg};position:relative;overflow:hidden;padding:60px 72px;box-sizing:border-box;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 30%,${c.accentRgba}.04) 0%,transparent 60%);pointer-events:none;"></div>
  <div style="position:relative;z-index:1;">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
      <div style="font-size:28px;font-weight:700;color:${c.accent};letter-spacing:2px;text-transform:uppercase;font-family:${c.font};">Índice</div>
      <div style="flex:1;height:1px;background:${c.line};"></div>
    </div>
    <div style="font-size:13px;color:${c.subtext};letter-spacing:1px;text-transform:uppercase;margin-bottom:36px;font-family:'Helvetica Neue',Arial,sans-serif;">Contenidos del informe &middot; ${titles.length} secciones</div>
    <div style="display:flex;flex-direction:column;">
      ${items}
    </div>
  </div>
  <div style="position:absolute;bottom:40px;right:48px;z-index:1;">
    <p style="font-size:12px;color:${c.subtext};letter-spacing:1px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</p>
  </div>
</div>`;
}

function buildPrestigeCover(companyName: string): string {
  return `
<div class="sc-cover-page" style="min-height:100vh;page-break-after:always;background:linear-gradient(160deg,#1a1410 0%,#211a14 30%,#1e1812 60%,#1a1410 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0;margin:0;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 40%,rgba(196,149,106,.06) 0%,transparent 70%);pointer-events:none;"></div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;">
    <div style="width:160px;height:160px;border-radius:50%;overflow:hidden;border:2px solid rgba(196,149,106,.3);box-shadow:0 30px 80px rgba(0,0,0,.5);margin-bottom:28px;">
      <img src="data:image/png;base64,${LOGO_PRESTIGE_B64}" alt="Shopy Crafter" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    <p style="font-size:32px;font-weight:700;color:rgba(196,149,106,.8);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Cormorant Garamond','Georgia',serif;">Shopy Crafter</p>
  </div>
  <div style="position:absolute;bottom:40px;right:48px;z-index:1;">
    <p style="font-size:14px;color:rgba(196,149,106,.45);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:500;">${companyName}</p>
  </div>
</div>`;
}
