import fs from "fs";
import path from "path";

const FRONT = path.resolve(process.cwd(), "../shopify-optimizer");
const DESIGN_CSS = path.join(FRONT, "public/css/design-system.css");
const LANDING_CSS = path.join(FRONT, "src/pages/landing.css");
const INDEX_HTML = path.join(FRONT, "index.html");

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function lighten(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return "#" + rgb.map(v => Math.min(255, Math.round(v + (255 - v) * amount)).toString(16).padStart(2, "0")).join("");
}

function patchCssVar(css: string, varName: string, value: string): string {
  const escaped = varName.replace(/-/g, "\\-");
  const regex = new RegExp(`([ \\t]*${escaped}:[ \\t]*)([^;\\n]+)(;)`, "m");
  return css.replace(regex, `$1${value}$3`);
}

function buildGoogleFontsUrl(headingFont: string, bodyFont: string): string {
  const fmt = (name: string) => name.trim().replace(/ /g, "+");
  const mono = "Geist+Mono:wght@400;500";
  const heading = `${fmt(headingFont)}:ital,wght@0,400;0,600;0,700;1,400;1,700`;
  const body = `${fmt(bodyFont)}:wght@300;400;500;600;700;800`;
  const families = headingFont.toLowerCase() !== bodyFont.toLowerCase()
    ? `family=${heading}&family=${body}&family=${mono}`
    : `family=${heading}&family=${mono}`;
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

function readCurrentFonts(cssContent: string, prefix: string): { fh: string; fb: string } {
  const fhMatch = cssContent.match(new RegExp(`${prefix}fh:\\s*'([^']+)'`));
  const fbMatch = cssContent.match(new RegExp(`${prefix}fb:\\s*'([^']+)'`));
  return {
    fh: fhMatch ? fhMatch[1] : "Instrument Serif",
    fb: fbMatch ? fbMatch[1] : "Geist",
  };
}

export interface SiteTheme {
  primaryColor?: string;
  accentColor?: string;
  font_heading?: string;
  font_body?: string;
}

export function writeSiteThemeToCss(site: SiteTheme): void {
  const { primaryColor, accentColor, font_heading, font_body } = site;

  try {
    if (fs.existsSync(DESIGN_CSS)) {
      let css = fs.readFileSync(DESIGN_CSS, "utf-8");

      if (primaryColor) {
        const rgb = hexToRgb(primaryColor);
        css = patchCssVar(css, "--gold", primaryColor);
        css = patchCssVar(css, "--gold2", lighten(primaryColor, 0.18));
        css = patchCssVar(css, "--gold3", lighten(primaryColor, 0.50));
        if (rgb) {
          css = patchCssVar(css, "--bdr", `rgba(${rgb.join(",")},0.10)`);
          css = patchCssVar(css, "--bdr2", `rgba(${rgb.join(",")},0.25)`);
          css = patchCssVar(css, "--bdr3", `rgba(${rgb.join(",")},0.50)`);
        }
      }
      if (accentColor) {
        css = patchCssVar(css, "--jade", accentColor);
        css = patchCssVar(css, "--jade2", lighten(accentColor, 0.22));
      }
      if (font_heading) css = patchCssVar(css, "--fh", `'${font_heading}', serif`);
      if (font_body) css = patchCssVar(css, "--fb", `'${font_body}', sans-serif`);

      fs.writeFileSync(DESIGN_CSS, css, "utf-8");
      console.log("[theme-css-writer] design-system.css updated");
    }
  } catch (err) {
    console.error("[theme-css-writer] design-system.css failed:", err);
  }

  try {
    if (fs.existsSync(LANDING_CSS)) {
      let css = fs.readFileSync(LANDING_CSS, "utf-8");

      if (primaryColor) {
        const rgb = hexToRgb(primaryColor);
        css = patchCssVar(css, "--l-gold", primaryColor);
        css = patchCssVar(css, "--l-gold2", lighten(primaryColor, 0.18));
        css = patchCssVar(css, "--l-gold3", lighten(primaryColor, 0.50));
        if (rgb) {
          css = patchCssVar(css, "--l-bdr", `rgba(${rgb.join(",")},0.10)`);
          css = patchCssVar(css, "--l-bdr2", `rgba(${rgb.join(",")},0.25)`);
          css = patchCssVar(css, "--l-bdr3", `rgba(${rgb.join(",")},0.50)`);
        }
      }
      if (accentColor) {
        css = patchCssVar(css, "--l-jade", accentColor);
        css = patchCssVar(css, "--l-jade2", lighten(accentColor, 0.22));
      }
      if (font_heading) css = patchCssVar(css, "--l-fh", `'${font_heading}', serif`);
      if (font_body) css = patchCssVar(css, "--l-fb", `'${font_body}', sans-serif`);

      if (font_heading || font_body) {
        const current = readCurrentFonts(css, "--l-");
        const fh = font_heading || current.fh;
        const fb = font_body || current.fb;
        const newUrl = buildGoogleFontsUrl(fh, fb);
        css = css.replace(
          /@import url\(['"]https:\/\/fonts\.googleapis\.com[^'"]*['"]\);/,
          `@import url('${newUrl}');`
        );
      }

      fs.writeFileSync(LANDING_CSS, css, "utf-8");
      console.log("[theme-css-writer] landing.css updated");
    }
  } catch (err) {
    console.error("[theme-css-writer] landing.css failed:", err);
  }

  try {
    if ((font_heading || font_body) && fs.existsSync(INDEX_HTML)) {
      let html = fs.readFileSync(INDEX_HTML, "utf-8");
      const curMatch = html.match(/href="https:\/\/fonts\.googleapis\.com([^"]*)"/);
      let fh = font_heading || "Instrument Serif";
      let fb = font_body || "Geist";
      if (curMatch) {
        const decoded = curMatch[0];
        const fhM = decoded.match(/family=([^:&"]+)/);
        const allFamilies = [...decoded.matchAll(/family=([^:&"]+)/g)];
        if (!font_heading && fhM) fh = decodeURIComponent(fhM[1].replace(/\+/g, " "));
        if (!font_body && allFamilies.length > 1) fb = decodeURIComponent(allFamilies[1][1].replace(/\+/g, " "));
      }
      const newUrl = buildGoogleFontsUrl(fh, fb);
      html = html.replace(
        /href="https:\/\/fonts\.googleapis\.com[^"]*"/,
        `href="${newUrl}"`
      );
      fs.writeFileSync(INDEX_HTML, html, "utf-8");
      console.log("[theme-css-writer] index.html fonts updated");
    }
  } catch (err) {
    console.error("[theme-css-writer] index.html failed:", err);
  }
}
