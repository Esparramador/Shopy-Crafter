import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CmsContextType {
  content: Record<string, any>;
  ready: boolean;
  t: (path: string, fallback: string) => string;
  reload: () => void;
}

const CmsContext = createContext<CmsContextType>({
  content: {},
  ready: false,
  t: (_p, fb) => fb,
  reload: () => {},
});

function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function getNestedString(obj: any, path: string): string | undefined {
  const val = getNestedValue(obj, path);
  return typeof val === "string" ? val : undefined;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace(/^#/, "");
  if (cleaned.length === 3) {
    return [
      parseInt(cleaned[0] + cleaned[0], 16),
      parseInt(cleaned[1] + cleaned[1], 16),
      parseInt(cleaned[2] + cleaned[2], 16),
    ];
  }
  if (cleaned.length === 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16),
      parseInt(cleaned.slice(2, 4), 16),
      parseInt(cleaned.slice(4, 6), 16),
    ];
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function lightenHex(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return (
    "#" +
    rgb
      .map(v => Math.min(255, Math.round(v + (255 - v) * amount))
        .toString(16)
        .padStart(2, "0"))
      .join("")
  );
}

function loadGoogleFont(fontName: string) {
  const id = `cms-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);
}

/** Inyecta el CSS libre del CMS como <style id="cms-custom-css"> en el <head>.
 *  Cada vez que el CMS se actualiza (SSE) este bloque se reescribe al instante.
 *  El CSS vive en la BD — no en archivos compilados. */
function injectCmsCustomCss(content: Record<string, any>) {
  const css: string = content?.customCss ?? "";
  let el = document.getElementById("cms-custom-css") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "cms-custom-css";
    // Se añade DESPUÉS de todos los demás estilos para que gane en cascada
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function injectCmsTheme(content: Record<string, any>) {
  const site = content?.site ?? {};
  const root = document.documentElement;

  // ── Variables CSS nombradas (mapa libre de --var: value) ──────────────────
  // Permite sobreescribir CUALQUIER variable de design-system.css desde la BD
  const cssVars: Record<string, string> = site.cssVars ?? {};
  Object.entries(cssVars).forEach(([key, value]) => {
    if (key.startsWith("--") && typeof value === "string" && value.trim()) {
      root.style.setProperty(key, value.trim());
    }
  });

  // ── Color primario (--gold y familia) ─────────────────────────────────────
  const primaryColor: string | undefined = site.primaryColor;
  if (primaryColor && /^#[0-9a-fA-F]{3,8}$/.test(primaryColor)) {
    const rgb = hexToRgb(primaryColor);
    if (rgb) {
      const [h, s, l] = rgbToHsl(...rgb);
      const light1 = lightenHex(primaryColor, 0.15);
      const light2 = lightenHex(primaryColor, 0.45);
      root.style.setProperty("--gold", primaryColor);
      root.style.setProperty("--gold2", light1);
      root.style.setProperty("--gold3", light2);
      root.style.setProperty("--l-gold", primaryColor);
      root.style.setProperty("--l-gold2", light1);
      root.style.setProperty("--l-gold3", light2);
      root.style.setProperty("--sc-ai-gold", primaryColor);
      root.style.setProperty("--sc-ai-gold-light", `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.12)`);
      root.style.setProperty("--bdr", `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.10)`);
      root.style.setProperty("--bdr2", `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.25)`);
      root.style.setProperty("--bdr3", `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.50)`);
      root.style.setProperty("--primary", `${h} ${s}% ${l}%`);
      root.style.setProperty("--ring", `${h} ${s}% ${l}%`);
      root.style.setProperty("--sidebar-primary", `${h} ${s}% ${l}%`);
    }
  }

  // ── Color acento (--jade y familia) ───────────────────────────────────────
  const accentColor: string | undefined = site.accentColor;
  if (accentColor && /^#[0-9a-fA-F]{3,8}$/.test(accentColor)) {
    const rgb = hexToRgb(accentColor);
    if (rgb) {
      root.style.setProperty("--jade", accentColor);
      root.style.setProperty("--jade2", lightenHex(accentColor, 0.20));
      root.style.setProperty("--l-jade", accentColor);
      root.style.setProperty("--l-jade2", lightenHex(accentColor, 0.20));
    }
  }

  // ── Tipografías ───────────────────────────────────────────────────────────
  const fontHeading: string | undefined = site.font_heading;
  if (fontHeading && fontHeading.trim()) {
    loadGoogleFont(fontHeading.trim());
    root.style.setProperty("--fh", `'${fontHeading.trim()}', serif`);
    root.style.setProperty("--l-fh", `'${fontHeading.trim()}', serif`);
    root.style.setProperty("--font-display", `'${fontHeading.trim()}', sans-serif`);
  }

  const fontBody: string | undefined = site.font_body;
  if (fontBody && fontBody.trim()) {
    loadGoogleFont(fontBody.trim());
    root.style.setProperty("--fb", `'${fontBody.trim()}', sans-serif`);
    root.style.setProperty("--l-fb", `'${fontBody.trim()}', sans-serif`);
    root.style.setProperty("--font-sans", `'${fontBody.trim()}', sans-serif`);
  }

  // ── CSS libre del CMS ─────────────────────────────────────────────────────
  injectCmsCustomCss(content);
}

export function CmsProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Record<string, any>>({});
  const [ready, setReady] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);

  const load = useCallback(() => {
    fetch(`${API_BASE}/api/cms/content`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setContent(d);
          setReady(true);
          injectCmsTheme(d);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ready) return;
    function connectSSE() {
      esRef.current = new EventSource(`${API_BASE}/api/cms/events`);
      esRef.current.addEventListener("connected", () => { retriesRef.current = 0; });
      esRef.current.addEventListener("content_updated", () => { load(); });
      esRef.current.onerror = () => {
        esRef.current?.close();
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
        retriesRef.current++;
        retryRef.current = setTimeout(connectSSE, delay);
      };
    }
    connectSSE();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [load, ready]);

  const t = useCallback(
    (path: string, fallback: string): string => getNestedString(content, path) ?? fallback,
    [content]
  );

  return (
    <CmsContext.Provider value={{ content, ready, t, reload: load }}>
      {children}
    </CmsContext.Provider>
  );
}

export function useCms() {
  return useContext(CmsContext);
}

export function useCmsSection(section: string) {
  const { content, t } = useCms();
  const sectionT = useCallback(
    (key: string, fallback: string) => t(`${section}.${key}`, fallback),
    [section, t]
  );
  const data = getNestedValue(content, section) as Record<string, any> | undefined;
  return { data: data ?? {}, t: sectionT };
}
