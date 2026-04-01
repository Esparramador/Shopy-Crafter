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
  const { companyName, template = "prestige", reportTitle, reportSubtitle, date, badgeLabel } = opts;

  if (template === "classic") return buildClassicCover(companyName, reportTitle, reportSubtitle, date, badgeLabel);
  if (template === "elegance") return buildEleganceCover(companyName, reportTitle, reportSubtitle, date, badgeLabel);
  return buildPrestigeCover(companyName, reportTitle, reportSubtitle, date, badgeLabel);
}

function buildClassicCover(companyName: string, reportTitle?: string, reportSubtitle?: string, date?: string, badgeLabel?: string): string {
  const titleBlock = reportTitle
    ? `<h1 style="font-size:38px;font-weight:800;color:#f0f0f5;letter-spacing:-1px;line-height:1.2;margin:0 0 12px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;max-width:700px;">${reportTitle}</h1>`
    : "";
  const subtitleBlock = reportSubtitle
    ? `<p style="font-size:16px;font-weight:300;color:rgba(240,240,245,.55);letter-spacing:1px;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;max-width:600px;">${reportSubtitle}</p>`
    : "";
  const dateBlock = date
    ? `<p style="font-size:12px;color:rgba(200,168,75,.45);letter-spacing:2px;text-transform:uppercase;margin:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;">${date}</p>`
    : "";
  const badgeBlock = badgeLabel
    ? `<div style="position:absolute;top:40px;right:48px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.2);border-radius:8px;padding:6px 16px;z-index:1;"><span style="font-size:10px;color:rgba(200,168,75,.7);letter-spacing:2px;text-transform:uppercase;font-weight:600;">${badgeLabel}</span></div>`
    : "";

  return `
<div class="sc-cover-page" style="min-height:100vh;page-break-after:always;background:linear-gradient(170deg,#08080e 0%,#0c0c14 40%,#08080e 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0;margin:0;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 40%,rgba(200,168,75,.05) 0%,transparent 60%);pointer-events:none;"></div>
  ${badgeBlock}
  <div style="position:absolute;top:40px;left:48px;z-index:1;">
    <p style="font-size:11px;color:rgba(200,168,75,.35);letter-spacing:3px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;">Shopy Crafter eCommerce</p>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;padding:60px 40px;">
    <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,rgba(200,168,75,.4),transparent);margin-bottom:40px;"></div>
    ${titleBlock}
    ${subtitleBlock}
    ${dateBlock}
    <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,rgba(200,168,75,.4),transparent);margin-top:40px;"></div>
  </div>
  <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;z-index:1;">
    <p style="font-size:15px;color:rgba(200,168,75,.5);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;">${companyName}</p>
  </div>
</div>`;
}

function buildEleganceCover(companyName: string, reportTitle?: string, reportSubtitle?: string, date?: string, badgeLabel?: string): string {
  const titleBlock = reportTitle
    ? `<h1 style="font-size:36px;font-weight:700;color:#e8ecf4;letter-spacing:-0.5px;line-height:1.25;margin:0 0 12px;font-family:'Playfair Display','Georgia',serif;text-align:center;max-width:700px;">${reportTitle}</h1>`
    : "";
  const subtitleBlock = reportSubtitle
    ? `<p style="font-size:15px;font-weight:300;color:rgba(192,200,216,.5);letter-spacing:1px;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;max-width:600px;">${reportSubtitle}</p>`
    : "";
  const dateBlock = date
    ? `<p style="font-size:12px;color:rgba(74,144,217,.4);letter-spacing:2px;text-transform:uppercase;margin:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;">${date}</p>`
    : "";
  const badgeBlock = badgeLabel
    ? `<div style="position:absolute;top:40px;right:48px;background:rgba(74,144,217,.06);border:1px solid rgba(74,144,217,.2);border-radius:8px;padding:6px 16px;z-index:1;"><span style="font-size:10px;color:rgba(74,144,217,.6);letter-spacing:2px;text-transform:uppercase;font-weight:600;">${badgeLabel}</span></div>`
    : "";

  return `
<div class="sc-cover-page" style="min-height:100vh;page-break-after:always;background:linear-gradient(160deg,#0b1628 0%,#0f1d35 35%,#111e36 65%,#0b1628 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0;margin:0;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 40%,rgba(74,144,217,.06) 0%,transparent 70%);pointer-events:none;"></div>
  ${badgeBlock}
  <div style="position:absolute;top:40px;left:48px;z-index:1;">
    <p style="font-size:11px;color:rgba(192,200,216,.3);letter-spacing:3px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;">Shopy Crafter eCommerce</p>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;padding:60px 40px;">
    <div style="width:60px;height:60px;border-radius:14px;overflow:hidden;border:1px solid rgba(74,144,217,.25);box-shadow:0 16px 40px rgba(0,0,0,.3);margin-bottom:36px;">
      <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="SC" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    ${titleBlock}
    ${subtitleBlock}
    ${dateBlock}
    <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,rgba(74,144,217,.3),transparent);margin-top:36px;"></div>
  </div>
  <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;z-index:1;">
    <p style="font-size:15px;color:rgba(192,200,216,.4);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;">${companyName}</p>
  </div>
</div>`;
}

function buildPrestigeCover(companyName: string, reportTitle?: string, reportSubtitle?: string, date?: string, badgeLabel?: string): string {
  const titleBlock = reportTitle
    ? `<h1 style="font-size:38px;font-weight:700;color:#faf5ef;letter-spacing:-0.5px;line-height:1.2;margin:0 0 12px;font-family:'Cormorant Garamond','Georgia',serif;text-align:center;max-width:700px;">${reportTitle}</h1>`
    : "";
  const subtitleBlock = reportSubtitle
    ? `<p style="font-size:15px;font-weight:300;color:rgba(196,149,106,.5);letter-spacing:1px;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;text-align:center;max-width:600px;">${reportSubtitle}</p>`
    : "";
  const dateBlock = date
    ? `<p style="font-size:12px;color:rgba(196,149,106,.4);letter-spacing:2px;text-transform:uppercase;margin:16px 0 0;font-family:'Helvetica Neue',Arial,sans-serif;">${date}</p>`
    : "";
  const badgeBlock = badgeLabel
    ? `<div style="position:absolute;top:40px;right:48px;background:rgba(196,149,106,.06);border:1px solid rgba(196,149,106,.2);border-radius:8px;padding:6px 16px;z-index:1;"><span style="font-size:10px;color:rgba(196,149,106,.6);letter-spacing:2px;text-transform:uppercase;font-weight:600;">${badgeLabel}</span></div>`
    : "";

  return `
<div class="sc-cover-page" style="min-height:100vh;page-break-after:always;background:linear-gradient(160deg,#1a1410 0%,#211a14 30%,#1e1812 60%,#1a1410 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:0;margin:0;">
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at 50% 40%,rgba(196,149,106,.06) 0%,transparent 70%);pointer-events:none;"></div>
  ${badgeBlock}
  <div style="position:absolute;top:40px;left:48px;z-index:1;">
    <p style="font-size:11px;color:rgba(196,149,106,.3);letter-spacing:3px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;">Shopy Crafter eCommerce</p>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1;padding:60px 40px;">
    <div style="width:60px;height:60px;border-radius:50%;overflow:hidden;border:1px solid rgba(196,149,106,.3);box-shadow:0 16px 40px rgba(0,0,0,.3);margin-bottom:36px;">
      <img src="data:image/png;base64,${LOGO_PRESTIGE_B64}" alt="SC" style="width:100%;height:100%;object-fit:cover;" />
    </div>
    ${titleBlock}
    ${subtitleBlock}
    ${dateBlock}
    <div style="width:80px;height:2px;background:linear-gradient(90deg,transparent,rgba(196,149,106,.3),transparent);margin-top:36px;"></div>
  </div>
  <div style="position:absolute;bottom:48px;left:0;right:0;text-align:center;z-index:1;">
    <p style="font-size:15px;color:rgba(196,149,106,.45);letter-spacing:4px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400;">${companyName}</p>
  </div>
</div>`;
}
