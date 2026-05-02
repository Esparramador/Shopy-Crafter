import { LOGO_CORPORATE_B64, LOGO_PRESTIGE_B64 } from "./report-logos.js";

export type CoverTemplate = "classic" | "elegance" | "prestige";

export interface CoverPageOptions {
  reportTitle?: string;
  reportSubtitle?: string;
  companyName: string;
  date?: string;
  badgeLabel?: string;
  template?: CoverTemplate;
  /**
   * Si true (default), `buildCoverPage` ya incluye la contraportada de marca
   * como SEGUNDA hoja del PDF (orden: portada → contraportada → info-page).
   * Los callers que ya añadían `buildBackCover(...)` al final del body deben
   * pasar `includeBackCover: false` para evitar duplicación.
   */
  includeBackCover?: boolean;
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
  const { template = "prestige", includeBackCover = true } = opts;
  const companyName = escHtml(opts.companyName);
  const reportTitle = escHtml(opts.reportTitle || "Informe Profesional");
  const reportSubtitle = escHtml(opts.reportSubtitle || "");
  const date = escHtml(opts.date || new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }));
  const badgeLabel = escHtml(opts.badgeLabel || "Fecha del informe");

  // ORDEN DE PÁGINAS DEL PDF (DIN-A4):
  //   1. Portada minimalista (logo + Shopy Crafter + cliente)
  //   2. Contraportada de marca (tagline + datos contacto + CONFIDENCIAL)
  //   3. Página de información detallada del informe (título, subtítulo, fecha)
  //   4+ Resto del contenido del informe
  //
  // La contraportada se mueve a 2ª hoja (en lugar de la última) para que el
  // documento abra como un dossier corporativo: portada visual → cierre de
  // marca → info del informe → contenido. Si `includeBackCover` es false,
  // se respeta el orden legacy front+info y el caller debe insertar la
  // contraportada manualmente al final con `buildBackCover(template)`.
  const front = buildFrontCover(template, companyName);
  const back = includeBackCover ? buildBackCover(template) : "";
  const info =
    template === "classic" ? buildClassicInfoPage({ companyName, reportTitle, reportSubtitle, date, badgeLabel })
    : template === "elegance" ? buildEleganceInfoPage({ companyName, reportTitle, reportSubtitle, date })
    : buildPrestigeInfoPage({ companyName, reportTitle, reportSubtitle, date });
  return front + back + info;
}

interface CoverArgs {
  companyName: string;
  reportTitle: string;
  reportSubtitle: string;
  date: string;
  badgeLabel?: string;
}

// ── PORTADAS MINIMALISTAS ───────────────────────────────────────────────────
// Solo 3 elementos según pidió el usuario:
//   1. Logo SC centrado (zona media superior)
//   2. "SHOPY CRAFTER" debajo del logo
//   3. Nombre de la empresa cliente abajo a la izquierda
// Cada plantilla adapta tipografías, colores y acabados a su estética.

function buildFrontCover(template: CoverTemplate, companyName: string): string {
  if (template === "classic") return buildClassicFront(companyName);
  if (template === "elegance") return buildEleganceFront(companyName);
  return buildPrestigeFront(companyName);
}

// CLASSIC FRONT: dark #08080e + dorado #c8a84b, Helvetica Neue, sobrio.
function buildClassicFront(companyName: string): string {
  const gold = "#c8a84b";
  const muted = "rgba(240,240,245,.5)";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#08080e;page-break-after:always;min-height:100vh;">
  <tr><td style="padding:0;height:62%;vertical-align:middle;text-align:center;">
    <div style="display:inline-block;text-align:center;">
      <div style="width:140px;height:140px;border-radius:50%;overflow:hidden;margin:0 auto 36px;border:1px solid rgba(200,168,75,.25);box-shadow:0 14px 48px rgba(0,0,0,.55);">
        <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="SC" width="140" height="140" style="width:140px;height:140px;display:block;" />
      </div>
      <p style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:800;color:${gold};letter-spacing:7px;text-transform:uppercase;margin:0;">Shopy Crafter</p>
    </div>
  </td></tr>
  <tr><td style="padding:48px 56px 56px;vertical-align:bottom;">
    ${companyName ? `
      <p style="font-size:9px;color:${muted};letter-spacing:3px;text-transform:uppercase;margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Preparado para</p>
      <p style="font-size:15px;color:#f0f0f5;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">${companyName}</p>
    ` : ""}
  </td></tr>
</table>`;
}

// ELEGANCE FRONT: navy #0b1628 + accent azul #4a90d9, Playfair Display, refinado.
function buildEleganceFront(companyName: string): string {
  const navy = "#0b1628";
  const accent = "#4a90d9";
  const silver = "#c0c8d8";
  const muted = "#6880a8";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${navy};page-break-after:always;min-height:100vh;">
  <tr><td style="padding:0;height:62%;vertical-align:middle;text-align:center;">
    <div style="display:inline-block;text-align:center;">
      <div style="position:relative;width:140px;height:140px;margin:0 auto 36px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(74,144,217,.2) 0%,transparent 70%);"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;overflow:hidden;border:2px solid rgba(74,144,217,.35);box-shadow:0 14px 48px rgba(0,0,0,.55);">
          <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="SC" width="128" height="128" style="width:128px;height:128px;display:block;" />
        </div>
      </div>
      <p style="font-family:'Playfair Display','Georgia',serif;font-size:22px;font-weight:700;color:${accent};letter-spacing:7px;text-transform:uppercase;margin:0;">Shopy Crafter</p>
    </div>
  </td></tr>
  <tr><td style="padding:48px 56px 56px;vertical-align:bottom;">
    ${companyName ? `
      <p style="font-size:9px;color:${muted};letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Preparado para</p>
      <p style="font-family:'Playfair Display','Georgia',serif;font-size:20px;font-weight:700;color:${silver};font-style:italic;letter-spacing:0.6px;margin:0;">${companyName}</p>
    ` : ""}
  </td></tr>
</table>`;
}

// PRESTIGE FRONT: charcoal warm + cobre #c4956a, Cormorant Garamond, lujo.
function buildPrestigeFront(companyName: string): string {
  const copper = "#c4956a";
  const copperLight = "#ddb896";
  const muted = "#7a6e60";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#120e0a;background-image:linear-gradient(180deg,#1a1410 0%,#120e0a 60%,#0d0a07 100%);page-break-after:always;min-height:100vh;">
  <tr><td style="padding:0;height:62%;vertical-align:middle;text-align:center;">
    <div style="display:inline-block;text-align:center;">
      <div style="position:relative;width:160px;height:160px;margin:0 auto 36px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(196,149,106,.22) 0%,transparent 70%);"></div>
        <div style="position:absolute;inset:12px;border-radius:50%;overflow:hidden;border:2px solid rgba(196,149,106,.4);box-shadow:0 16px 56px rgba(0,0,0,.6),inset 0 0 18px rgba(0,0,0,.3);">
          <img src="data:image/png;base64,${LOGO_PRESTIGE_B64}" alt="SC" width="136" height="136" style="width:136px;height:136px;display:block;" />
        </div>
      </div>
      <p style="font-family:'Cormorant Garamond','Georgia',serif;font-size:24px;font-weight:600;color:${copper};letter-spacing:8px;text-transform:uppercase;margin:0;">Shopy Crafter</p>
    </div>
  </td></tr>
  <tr><td style="padding:48px 56px 56px;vertical-align:bottom;">
    ${companyName ? `
      <p style="font-size:9px;color:${muted};letter-spacing:3px;text-transform:uppercase;margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Preparado para</p>
      <p style="font-family:'Cormorant Garamond','Georgia',serif;font-size:22px;font-weight:700;color:${copperLight};font-style:italic;letter-spacing:0.6px;margin:0;">${companyName}</p>
    ` : ""}
  </td></tr>
</table>`;
}

// ── PÁGINAS INTERIORES (info detallada del informe) ─────────────────────────
// Aparecen justo después de la portada minimalista. Aquí va la información
// elaborada: título, subtítulo, fecha, badge, "Preparado para", ref-code, dots…
// Cada plantilla mantiene su personalidad visual.

// CLASSIC INFO: dorado #c8a84b sobre dark #08080e, Helvetica Neue, layout limpio
// con logo corporativo + badge de fecha + título grande + subtítulo + meta dots.
function buildClassicInfoPage({ companyName, reportTitle, reportSubtitle, date, badgeLabel }: CoverArgs): string {
  const gold = "#c8a84b";
  const goldSoft = "rgba(200,168,75,.85)";
  const muted = "rgba(240,240,245,.55)";
  const surface = "#11111a";
  const borderLight = "#1f1f2c";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#08080e;page-break-after:always;min-height:100vh;">
  <tr><td style="padding:56px 56px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="vertical-align:middle;padding-right:14px;">
              <div style="width:48px;height:48px;border-radius:12px;overflow:hidden;border:1px solid ${borderLight};">
                <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="SC" width="48" height="48" style="width:48px;height:48px;display:block;" />
              </div>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:20px;font-weight:800;color:${gold};letter-spacing:1.5px;text-transform:uppercase;font-family:'Helvetica Neue',Arial,sans-serif;">Shopy Crafter</span>
            </td>
          </tr></table>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <div style="display:inline-block;background:${surface};border:1px solid ${borderLight};border-radius:10px;padding:10px 18px;">
            <div style="font-size:9px;color:${muted};text-transform:uppercase;letter-spacing:1.6px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">${badgeLabel}</div>
            <div style="font-size:13px;color:#f0f0f5;font-weight:700;margin-top:3px;font-family:'Helvetica Neue',Arial,sans-serif;">${date}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:80px 56px 60px;vertical-align:middle;">
    <div style="max-width:720px;">
      <div style="width:48px;height:3px;background:${gold};margin-bottom:24px;border-radius:2px;"></div>
      <h1 style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:42px;font-weight:900;color:#f0f0f5;letter-spacing:-0.8px;line-height:1.15;margin:0 0 14px;">${reportTitle}</h1>
      ${reportSubtitle ? `<p style="font-size:16px;color:${muted};margin:0 0 32px;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">${reportSubtitle}</p>` : `<div style="margin-bottom:32px;"></div>`}
      ${companyName ? `
        <div style="display:inline-block;background:${surface};border:1px solid ${borderLight};border-radius:10px;padding:18px 28px;">
          <div style="font-size:9px;color:${muted};text-transform:uppercase;letter-spacing:2.5px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;margin-bottom:6px;">Preparado para</div>
          <div style="font-size:22px;color:${gold};font-weight:800;letter-spacing:0.4px;font-family:'Helvetica Neue',Arial,sans-serif;">${companyName}</div>
        </div>` : ""}
    </div>
  </td></tr>
  <tr><td style="padding:24px 56px 56px;vertical-align:bottom;">
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding-right:24px;font-size:11px;color:${muted};font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:.4px;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${goldSoft};margin-right:8px;vertical-align:middle;"></span>Generado por IA
        </td>
        <td style="padding-right:24px;font-size:11px;color:${muted};font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:.4px;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${goldSoft};margin-right:8px;vertical-align:middle;"></span>Datos reales
        </td>
        <td style="font-size:11px;color:${muted};font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:.4px;">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${goldSoft};margin-right:8px;vertical-align:middle;"></span>Confidencial
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

// ELEGANCE INFO: navy #0b1628 + plata #c0c8d8 + accent azul #4a90d9, Playfair Display,
// diamante superior, agency-name superior, doc-type, título grande serif,
// client-box destacada centrada. Coherente con .cover-portfolio/.cover-diamond-top
// /.cover-client-box del shell elegance.
function buildEleganceInfoPage({ companyName, reportTitle, reportSubtitle, date }: CoverArgs): string {
  const navy = "#0b1628";
  const accent = "#4a90d9";
  const accentSoft = "#6ba8f0";
  const silver = "#c0c8d8";
  const white = "#f0f2f8";
  const muted = "#6880a8";
  const card = "#0d1628";
  const border = "#1a2a4a";
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${navy};page-break-after:always;min-height:100vh;border-bottom:2px solid ${border};">
  <tr><td style="padding:80px 48px 60px;text-align:center;vertical-align:middle;min-height:100vh;">
    <div style="max-width:680px;margin:0 auto;">

      <div style="width:14px;height:14px;background:${accent};margin:0 auto 28px;transform:rotate(45deg);"></div>

      <p style="font-family:'Playfair Display','Georgia',serif;font-size:13px;font-weight:600;color:${accent};letter-spacing:5px;text-transform:uppercase;margin:0 0 36px;">Shopy Crafter</p>

      <div style="width:100px;height:100px;border-radius:50%;overflow:hidden;margin:0 auto 36px;border:2px solid rgba(74,144,217,.35);">
        <img src="data:image/png;base64,${LOGO_CORPORATE_B64}" alt="SC" width="100" height="100" style="width:100%;height:100%;display:block;" />
      </div>

      <p style="font-size:11px;font-weight:700;color:${muted};letter-spacing:4px;text-transform:uppercase;margin:0 0 20px;font-family:'Helvetica Neue',Arial,sans-serif;">Informe estratégico</p>

      <h1 style="font-family:'Playfair Display','Georgia',serif;font-size:42px;font-weight:800;color:${white};line-height:1.2;margin:0 0 16px;letter-spacing:-0.3px;">${reportTitle}</h1>

      ${reportSubtitle ? `<p style="font-size:16px;color:${silver};font-weight:400;line-height:1.6;margin:0 0 40px;font-family:'Helvetica Neue',Arial,sans-serif;">${reportSubtitle}</p>` : `<div style="margin-bottom:40px;"></div>`}

      ${companyName ? `
        <div style="display:inline-block;background:${card};border:1px solid ${border};border-radius:12px;padding:24px 44px;margin-bottom:24px;">
          <div style="font-size:10px;color:${muted};letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Preparado para</div>
          <div style="font-family:'Playfair Display','Georgia',serif;font-size:26px;font-weight:700;color:${accentSoft};font-style:italic;letter-spacing:0.5px;">${companyName}</div>
        </div>` : ""}

    </div>
  </td></tr>
  <tr><td style="padding:0 48px 48px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="text-align:center;">
          <div style="font-size:9px;color:${muted};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Fecha</div>
          <div style="font-size:13px;color:${silver};font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">${date}</div>
        </td>
        <td style="text-align:center;border-left:1px solid ${border};border-right:1px solid ${border};">
          <div style="font-size:9px;color:${muted};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Documento</div>
          <div style="font-size:13px;color:${silver};font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">Confidencial</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:9px;color:${muted};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Origen</div>
          <div style="font-size:13px;color:${silver};font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">shopycrafter.com</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

// PRESTIGE INFO: charcoal warm + cobre #c4956a, Cormorant Garamond, doble línea
// ornamental, logo prestige circular, ref-code de informe, client-box. Coherente
// con .cover-portfolio/.cover-logo-circle/.cover-client-box del shell prestige.
function buildPrestigeInfoPage({ companyName, reportTitle, reportSubtitle, date }: CoverArgs): string {
  const copper = "#c4956a";
  const copperLight = "#ddb896";
  const white = "#f5f0eb";
  const muted = "#7a6e60";
  const mutedLight = "#9a8e80";
  const card = "#211c15";
  const border = "#3d332a";
  const refCode = `SC-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#120e0a;background-image:linear-gradient(180deg,#1a1410 0%,#120e0a 60%,#0d0a07 100%);page-break-after:always;min-height:100vh;border-bottom:2px solid ${border};">
  <tr><td style="padding:80px 40px 60px;text-align:center;vertical-align:middle;min-height:100vh;">
    <div style="max-width:680px;margin:0 auto;">

      <div style="width:14px;height:14px;background:${copper};margin:0 auto 28px;transform:rotate(45deg);"></div>

      <p style="font-family:'Cormorant Garamond','Georgia',serif;font-size:13px;font-weight:600;color:${copper};letter-spacing:5px;text-transform:uppercase;margin:0 0 36px;">Shopy Crafter Atelier</p>

      <div style="position:relative;width:120px;height:120px;margin:0 auto 36px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,rgba(196,149,106,.18) 0%,transparent 70%);"></div>
        <div style="position:absolute;inset:10px;border-radius:50%;overflow:hidden;border:2px solid rgba(196,149,106,.35);box-shadow:0 12px 48px rgba(0,0,0,.55);">
          <img src="data:image/png;base64,${LOGO_PRESTIGE_B64}" alt="SC" width="100" height="100" style="width:100%;height:100%;display:block;" />
        </div>
      </div>

      <p style="font-size:11px;font-weight:700;color:${muted};letter-spacing:4px;text-transform:uppercase;margin:0 0 20px;font-family:'Helvetica Neue',Arial,sans-serif;">Documento Profesional</p>

      <h1 style="font-family:'Cormorant Garamond','Georgia',serif;font-size:46px;font-weight:800;color:${white};line-height:1.15;margin:0 0 16px;letter-spacing:-0.3px;">${reportTitle}</h1>

      ${reportSubtitle ? `<p style="font-size:16px;color:${mutedLight};font-weight:400;line-height:1.6;margin:0 0 40px;font-family:'Helvetica Neue',Arial,sans-serif;">${reportSubtitle}</p>` : `<div style="margin-bottom:40px;"></div>`}

      ${companyName ? `
        <div style="display:inline-block;background:${card};border:1px solid ${border};border-radius:12px;padding:24px 44px;margin-bottom:24px;">
          <div style="font-size:10px;color:${muted};letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Preparado para</div>
          <div style="font-family:'Cormorant Garamond','Georgia',serif;font-size:26px;font-weight:700;color:${copperLight};font-style:italic;letter-spacing:0.5px;">${companyName}</div>
        </div>` : ""}

      <div style="width:60px;height:1px;background:rgba(196,149,106,.35);margin:32px auto 18px;"></div>

      <p style="font-size:9px;color:rgba(128,110,90,.6);letter-spacing:2px;text-transform:uppercase;margin:0;font-family:'Helvetica Neue',Arial,sans-serif;">Ref. ${refCode}</p>

    </div>
  </td></tr>
  <tr><td style="padding:0 40px 48px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="text-align:center;">
          <div style="font-size:9px;color:${muted};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Fecha</div>
          <div style="font-size:13px;color:${mutedLight};font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">${date}</div>
        </td>
        <td style="text-align:center;border-left:1px solid ${border};border-right:1px solid ${border};">
          <div style="font-size:9px;color:${muted};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Documento</div>
          <div style="font-size:13px;color:${mutedLight};font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">Confidencial</div>
        </td>
        <td style="text-align:center;">
          <div style="font-size:9px;color:${muted};letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-family:'Helvetica Neue',Arial,sans-serif;font-weight:600;">Atelier</div>
          <div style="font-size:13px;color:${mutedLight};font-weight:500;font-family:'Helvetica Neue',Arial,sans-serif;">shopycrafter.com</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
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
