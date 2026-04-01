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
