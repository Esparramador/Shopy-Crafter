/**
 * Tema del sitio editado en el CMS (colores y tipografías). Antes se escribía en
 * los archivos del frontend en tiempo de ejecución: en producción la web es el
 * build ya compilado, así que el cambio no llegaba nunca (y en desarrollo
 * ensuciaba el repositorio). Ahora se sirve como CSS desde GET /api/cms/theme.css,
 * que el panel carga después de sus estilos: las variables del CMS ganan.
 */
export interface SiteTheme {
  primaryColor?: string;
  accentColor?: string;
  font_heading?: string;
  font_body?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9 ]{2,40}$/;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighten(hex: string, amount: number): string {
  return "#" + hexToRgb(hex).map(v => Math.min(255, Math.round(v + (255 - v) * amount)).toString(16).padStart(2, "0")).join("");
}

export function extractSiteTheme(content: Record<string, unknown>): SiteTheme {
  const site = (content.site || {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);
  return {
    primaryColor: str(site.primaryColor),
    accentColor: str(site.accentColor),
    font_heading: str(site.font_heading),
    font_body: str(site.font_body),
  };
}

/** CSS con las variables del tema. Valores no válidos se ignoran (nunca se inyecta texto libre). */
export function buildSiteThemeCss(theme: SiteTheme): string {
  const vars: string[] = [];
  const primary = theme.primaryColor && HEX.test(theme.primaryColor) ? theme.primaryColor : null;
  const accent = theme.accentColor && HEX.test(theme.accentColor) ? theme.accentColor : null;
  const fh = theme.font_heading && FONT.test(theme.font_heading) ? theme.font_heading : null;
  const fb = theme.font_body && FONT.test(theme.font_body) ? theme.font_body : null;

  if (primary) {
    const rgb = hexToRgb(primary).join(",");
    for (const p of ["--", "--l-"]) {
      vars.push(`${p}gold: ${primary};`, `${p}gold2: ${lighten(primary, 0.18)};`, `${p}gold3: ${lighten(primary, 0.5)};`);
    }
    vars.push("--platform-accent: " + primary + ";", `--l-bdr: rgba(${rgb},0.10);`, `--l-bdr2: rgba(${rgb},0.25);`, `--l-bdr3: rgba(${rgb},0.50);`);
  }
  if (accent) {
    for (const p of ["--", "--l-"]) vars.push(`${p}jade: ${accent};`, `${p}jade2: ${lighten(accent, 0.22)};`);
  }
  if (fh) vars.push(`--fh: '${fh}', serif;`, `--l-fh: '${fh}', serif;`);
  if (fb) vars.push(`--fb: '${fb}', sans-serif;`, `--l-fb: '${fb}', sans-serif;`);
  if (vars.length === 0) return "/* Tema por defecto: sin cambios desde el CMS */\n";

  // Las fuentes por defecto ya las carga index.html. Para el resto se pide la familia
  // sin pesos concretos: Google devuelve 400 si se piden pesos que la fuente no tiene.
  const DEFAULT_FONTS = new Set(["instrument serif", "geist"]);
  const families = [...new Set([fh, fb].filter((f): f is string => !!f && !DEFAULT_FONTS.has(f.toLowerCase())))]
    .map(f => `family=${f.replace(/ /g, "+")}`)
    .join("&");
  const fontImport = families ? `@import url('https://fonts.googleapis.com/css2?${families}&display=swap');\n` : "";
  return `${fontImport}:root {\n  ${vars.join("\n  ")}\n}\n`;
}
