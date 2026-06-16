/**
 * Card Studio · sistema de elementos posicionados (px en 1080×720).
 *
 * Cada lado de la tarjeta es una composición de "elementos" con coordenadas
 * absolutas. El renderer recibe esta lista y produce HTML con position:absolute.
 *
 * Elementos estándar (id reservados):
 *   FRONT: "logo", "company", "name", "title", "line", "tagline"
 *   BACK : "qr", "qrLabel", "brand", "email", "phone", "web", "social", "address"
 *
 * `extras` permite componentes libres añadidos por el editor visual.
 *
 * Constantes físicas (300 DPI):
 *   Tarjeta con sangrado: 91×61 mm = 1075×720 px (usamos 1080×720 redondeado)
 *   Trim físico (corte): 85×55 mm = 1004×650 px → inset = 38px desde sangrado
 *   Safe zone (textos): inset 84px (≈7mm) desde el sangrado
 */

export const CARD_W = 1080;
export const CARD_H = 720;
export const BLEED = 36;          // 3mm
export const SAFE = 84;           // 7mm — margen interior para textos
export const TRIM_INSET = 38;     // 3.2mm — desde sangrado al corte físico

export type ElementType = "text" | "qr" | "logo" | "line" | "spacer";
export type Side = "front" | "back";
export type TextAlign = "left" | "center" | "right";

export type ElementOverride = {
  hidden?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number;
  lineHeight?: number;
  align?: TextAlign;
  textTransform?: "none" | "uppercase";
  text?: string;        // override del texto mostrado
  rotate?: number;
  /** Plate de contraste detrás del texto (auto-aplicado en ai-texture si no se define) */
  plate?: { color: string; opacity: number; padding: number; radius: number } | null;
};

export type ExtraElement = {
  id: string;
  side: Side;
  type: "text" | "line";
  x: number;
  y: number;
  width: number;
  height?: number;
  // text props
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: TextAlign;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase";
  rotate?: number;
  plate?: { color: string; opacity: number; padding: number; radius: number } | null;
};

export type LayoutOverrides = {
  front?: Record<string, ElementOverride>;
  back?: Record<string, ElementOverride>;
  extras?: ExtraElement[];
};

/** Elemento renderizable internamente (defaults + override aplicado). */
export type RenderElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: TextAlign;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: "none" | "uppercase";
  rotate?: number;
  plate?: { color: string; opacity: number; padding: number; radius: number } | null;
  /** Para qr: data URI base64 PNG */
  qrSrc?: string;
  /** Para logo: data URI */
  logoSrc?: string;
  hidden?: boolean;
};

export type CardData = {
  fullName: string;
  jobTitle?: string | null;
  companyName?: string | null;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  socialHandle?: string | null;
  address?: string | null;
};

export type DefaultsContext = {
  side: Side;
  layout: "centered" | "left" | "grid";
  data: CardData;
  palette: { bg: string; primary: string; secondary: string; accent: string; text: string };
  fonts: { heading: string; body: string; weights?: { heading?: number; body?: number } };
  isAiBg: boolean;
  qrPngBase64?: string;
  logoDataUri?: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Luminance perceptual (0..1) — para decidir scrim claro vs oscuro. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Devuelve un color de plate semitransparente apropiado al fondo (oscuro o claro). */
export function autoPlate(palette: { bg: string }) {
  const lum = luminance(palette.bg || "#000");
  // Si fondo oscuro → plate oscura semi-translúcida; claro → plate clara
  return lum < 0.5
    ? { color: "#000000", opacity: 0.55, padding: 14, radius: 8 }
    : { color: "#ffffff", opacity: 0.7,  padding: 14, radius: 8 };
}

// ── Defaults por layout ────────────────────────────────────────────────────

/**
 * Construye los elementos por defecto del FRENTE según el layout.
 * Coordenadas en px (1080×720). Pensadas para entrar en safe-zone.
 */
export function defaultFrontElements(ctx: DefaultsContext): RenderElement[] {
  const { layout, data, palette, fonts, isAiBg, logoDataUri } = ctx;
  const headingW = fonts.weights?.heading ?? 700;
  const bodyW = fonts.weights?.body ?? 400;
  // No plates automáticos — el text-shadow del renderer garantiza legibilidad
  // sin añadir cajas de fondo detrás del texto sobre fondos IA.
  const plate = null;

  const company = (data.companyName || "").trim();
  const name = (data.fullName || "").trim();
  const role = (data.jobTitle || "").trim();
  const tagline = (data.tagline || "").trim();

  const els: RenderElement[] = [];

  if (layout === "centered") {
    // Bloque vertical centrado dentro de safe zone
    let cy = 200;
    if (logoDataUri) {
      els.push({ id: "logo", type: "logo", logoSrc: logoDataUri, x: (CARD_W - 140) / 2, y: 110, width: 140, height: 80 });
      cy = 220;
    }
    if (company) {
      els.push({
        id: "company", type: "text", text: company,
        x: SAFE, y: cy, width: CARD_W - SAFE * 2, height: 40,
        fontFamily: fonts.heading, fontSize: 28, fontWeight: 600,
        color: palette.secondary, letterSpacing: 4, textTransform: "uppercase",
        align: "center", plate,
      });
      cy += 56;
    }
    els.push({
      id: "name", type: "text", text: name,
      x: SAFE, y: cy, width: CARD_W - SAFE * 2, height: 110,
      fontFamily: fonts.heading, fontSize: 82, fontWeight: headingW,
      color: palette.primary, letterSpacing: 1, lineHeight: 1.05,
      align: "center", plate,
    });
    cy += 130;
    if (role) {
      els.push({
        id: "title", type: "text", text: role,
        x: SAFE, y: cy, width: CARD_W - SAFE * 2, height: 32,
        fontFamily: fonts.body, fontSize: 22, fontWeight: 500,
        color: palette.secondary, letterSpacing: 5, textTransform: "uppercase",
        align: "center", plate,
      });
      cy += 50;
    }
    els.push({
      id: "line", type: "line",
      x: (CARD_W - 140) / 2, y: cy + 4, width: 140, height: 3,
      color: palette.accent,
    });
    cy += 30;
    if (tagline) {
      els.push({
        id: "tagline", type: "text", text: tagline,
        x: 180, y: cy, width: CARD_W - 360, height: 80,
        fontFamily: fonts.body, fontSize: 24, fontWeight: bodyW,
        color: palette.text, lineHeight: 1.4, align: "center", plate,
      });
    }
    return els;
  }

  if (layout === "left") {
    let cy = 130;
    if (logoDataUri) {
      els.push({ id: "logo", type: "logo", logoSrc: logoDataUri, x: SAFE, y: cy, width: 130, height: 70 });
      cy += 90;
    }
    if (company) {
      els.push({
        id: "company", type: "text", text: company,
        x: SAFE, y: cy, width: CARD_W - SAFE * 2, height: 36,
        fontFamily: fonts.heading, fontSize: 26, fontWeight: 600,
        color: palette.secondary, letterSpacing: 3, textTransform: "uppercase",
        align: "left", plate,
      });
      cy += 50;
    }
    els.push({
      id: "name", type: "text", text: name,
      x: SAFE, y: cy, width: CARD_W - SAFE * 2, height: 100,
      fontFamily: fonts.heading, fontSize: 74, fontWeight: headingW,
      color: palette.primary, letterSpacing: 0.5, lineHeight: 1.05,
      align: "left", plate,
    });
    cy += 110;
    if (role) {
      els.push({
        id: "title", type: "text", text: role,
        x: SAFE, y: cy, width: CARD_W - SAFE * 2, height: 30,
        fontFamily: fonts.body, fontSize: 20, fontWeight: 500,
        color: palette.secondary, letterSpacing: 4, textTransform: "uppercase",
        align: "left", plate,
      });
      cy += 44;
    }
    els.push({
      id: "line", type: "line",
      x: SAFE, y: cy + 4, width: 110, height: 3, color: palette.accent,
    });
    cy += 28;
    if (tagline) {
      els.push({
        id: "tagline", type: "text", text: tagline,
        x: SAFE, y: cy, width: CARD_W - SAFE * 2 - 80, height: 80,
        fontFamily: fonts.body, fontSize: 22, fontWeight: bodyW,
        color: palette.text, lineHeight: 1.4, align: "left", plate,
      });
    }
    return els;
  }

  // grid (2 col): texto izq · logo o accent derecha
  let cy = 150;
  if (company) {
    els.push({
      id: "company", type: "text", text: company,
      x: SAFE, y: cy, width: 600, height: 36,
      fontFamily: fonts.heading, fontSize: 26, fontWeight: 600,
      color: palette.secondary, letterSpacing: 3, textTransform: "uppercase",
      align: "left", plate,
    });
    cy += 48;
  }
  els.push({
    id: "name", type: "text", text: name,
    x: SAFE, y: cy, width: 640, height: 90,
    fontFamily: fonts.heading, fontSize: 64, fontWeight: headingW,
    color: palette.primary, lineHeight: 1.05, align: "left", plate,
  });
  cy += 100;
  if (role) {
    els.push({
      id: "title", type: "text", text: role,
      x: SAFE, y: cy, width: 640, height: 28,
      fontFamily: fonts.body, fontSize: 18, fontWeight: 500,
      color: palette.secondary, letterSpacing: 4, textTransform: "uppercase",
      align: "left", plate,
    });
    cy += 40;
  }
  els.push({
    id: "line", type: "line",
    x: SAFE, y: cy + 6, width: 90, height: 3, color: palette.accent,
  });
  cy += 26;
  if (tagline) {
    els.push({
      id: "tagline", type: "text", text: tagline,
      x: SAFE, y: cy, width: 640, height: 70,
      fontFamily: fonts.body, fontSize: 20, fontWeight: bodyW,
      color: palette.text, lineHeight: 1.4, align: "left", plate,
    });
  }
  if (logoDataUri) {
    els.push({ id: "logo", type: "logo", logoSrc: logoDataUri, x: CARD_W - SAFE - 160, y: 220, width: 160, height: 160 });
  } else {
    // Acento decorativo derecha
    els.push({ id: "lineRight", type: "line", x: CARD_W - SAFE - 4, y: 180, width: 4, height: 360, color: palette.accent });
  }
  return els;
}

/**
 * Construye los elementos por defecto del REVERSO según el layout.
 */
export function defaultBackElements(ctx: DefaultsContext): RenderElement[] {
  const { data, palette, fonts, isAiBg, qrPngBase64 } = ctx;
  // No plates automáticos — text-shadow del renderer garantiza legibilidad.
  const plate = null;
  const els: RenderElement[] = [];

  const hasContact = !!(data.email || data.phone || data.website || data.socialHandle || data.address);
  const company = (data.companyName || "").trim();

  // QR (si existe) — colocado a la izquierda cuando hay contacto, o centrado si no
  const QR_SIZE = 360;
  if (qrPngBase64) {
    if (hasContact) {
      els.push({
        id: "qr", type: "qr", qrSrc: `data:image/png;base64,${qrPngBase64}`,
        x: SAFE, y: (CARD_H - QR_SIZE) / 2, width: QR_SIZE, height: QR_SIZE,
      });
      els.push({
        id: "qrLabel", type: "text", text: "ESCANEAR · vCard",
        x: SAFE, y: (CARD_H - QR_SIZE) / 2 + QR_SIZE + 14, width: QR_SIZE, height: 24,
        fontFamily: fonts.body, fontSize: 14, fontWeight: 500,
        color: palette.secondary, letterSpacing: 4, textTransform: "uppercase",
        align: "center", plate,
      });
    } else {
      els.push({
        id: "qr", type: "qr", qrSrc: `data:image/png;base64,${qrPngBase64}`,
        x: (CARD_W - QR_SIZE) / 2, y: (CARD_H - QR_SIZE) / 2 - 20,
        width: QR_SIZE, height: QR_SIZE,
      });
      els.push({
        id: "qrLabel", type: "text", text: "ESCANEAR · vCard",
        x: (CARD_W - QR_SIZE) / 2, y: (CARD_H - QR_SIZE) / 2 + QR_SIZE - 6, width: QR_SIZE, height: 24,
        fontFamily: fonts.body, fontSize: 14, fontWeight: 500,
        color: palette.secondary, letterSpacing: 4, textTransform: "uppercase",
        align: "center", plate,
      });
    }
  }

  if (hasContact) {
    const colX = qrPngBase64 ? SAFE + QR_SIZE + 60 : SAFE;
    const colW = CARD_W - colX - SAFE;
    let cy = 130;
    if (company) {
      els.push({
        id: "brand", type: "text", text: company,
        x: colX, y: cy, width: colW, height: 44,
        fontFamily: fonts.heading, fontSize: 32, fontWeight: fonts.weights?.heading ?? 700,
        color: palette.primary, letterSpacing: 1, align: "left", plate,
      });
      cy += 56;
    }
    const rows: Array<{ id: string; icon: string; val: string }> = [
      { id: "email",   icon: "mail",  val: data.email || "" },
      { id: "phone",   icon: "phone", val: data.phone || "" },
      { id: "web",     icon: "globe", val: data.website || "" },
      { id: "social",  icon: "at",    val: data.socialHandle || "" },
      { id: "address", icon: "home",  val: data.address || "" },
    ].filter((r) => r.val);

    for (const r of rows) {
      els.push({
        id: r.id, type: "text", text: `${iconGlyph(r.icon)}  ${r.val}`,
        x: colX, y: cy, width: colW, height: 38,
        fontFamily: fonts.body, fontSize: 22, fontWeight: 400,
        color: palette.text, align: "left", plate,
      });
      cy += 44;
    }
  }

  return els;
}

/** Glifo unicode "seguro" (con fallback) — el renderer lo reemplaza por SVG inline. */
function iconGlyph(kind: string): string {
  // Marcadores que el renderer puede reemplazar por SVG si quiere; por simplicidad
  // dejamos el texto plano con un símbolo ASCII + nombre que el renderer no usa.
  switch (kind) {
    case "mail":  return "✉";
    case "phone": return "☎";
    case "globe": return "◉";
    case "at":    return "@";
    case "home":  return "⌂";
    default:      return "•";
  }
}

/** Aplica overrides (si existen) a la lista de elementos default. */
export function applyOverrides(
  defaults: RenderElement[],
  overrides?: Record<string, ElementOverride>,
): RenderElement[] {
  if (!overrides) return defaults;
  return defaults.map((el) => {
    const ov = overrides[el.id];
    if (!ov) return el;
    return {
      ...el,
      ...(ov.x !== undefined ? { x: ov.x } : {}),
      ...(ov.y !== undefined ? { y: ov.y } : {}),
      ...(ov.width !== undefined ? { width: ov.width } : {}),
      ...(ov.height !== undefined ? { height: ov.height } : {}),
      ...(ov.fontSize !== undefined ? { fontSize: ov.fontSize } : {}),
      ...(ov.color !== undefined ? { color: ov.color } : {}),
      ...(ov.fontFamily !== undefined ? { fontFamily: ov.fontFamily } : {}),
      ...(ov.fontWeight !== undefined ? { fontWeight: ov.fontWeight } : {}),
      ...(ov.letterSpacing !== undefined ? { letterSpacing: ov.letterSpacing } : {}),
      ...(ov.lineHeight !== undefined ? { lineHeight: ov.lineHeight } : {}),
      ...(ov.align !== undefined ? { align: ov.align } : {}),
      ...(ov.textTransform !== undefined ? { textTransform: ov.textTransform } : {}),
      ...(ov.text !== undefined && el.type === "text" ? { text: ov.text } : {}),
      ...(ov.rotate !== undefined ? { rotate: ov.rotate } : {}),
      ...(ov.plate !== undefined ? { plate: ov.plate } : {}),
      hidden: !!ov.hidden,
    };
  });
}

/** Convierte ExtraElement a RenderElement. */
export function extrasToRender(extras: ExtraElement[] | undefined, side: Side): RenderElement[] {
  if (!extras || extras.length === 0) return [];
  return extras
    .filter((e) => e.side === side)
    .map((e): RenderElement => ({
      id: `extra-${e.id}`,
      type: e.type === "line" ? "line" : "text",
      x: e.x, y: e.y, width: e.width, height: e.height ?? 40,
      text: e.text,
      fontFamily: e.fontFamily,
      fontSize: e.fontSize,
      fontWeight: e.fontWeight,
      color: e.color,
      align: e.align,
      letterSpacing: e.letterSpacing,
      textTransform: e.textTransform,
      rotate: e.rotate,
      plate: e.plate ?? null,
    }));
}
