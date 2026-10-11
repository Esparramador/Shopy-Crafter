import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, RotateCcw } from "lucide-react";

/** Estilo de QR artístico — mismo contrato que el servidor (card-qr-art.ts). */
export type QrStyle = {
  dots: "square" | "rounded" | "dots" | "diamond" | "classy";
  eyeFrame: "square" | "rounded" | "circle";
  eyeBall: "square" | "rounded" | "circle";
  fg: string;
  fg2: string;
  gradient: "none" | "linear" | "radial";
  angle: number;
  eyeColor: string;
  bg: string;
  logo: boolean;
  logoScale: number;
  margin: number;
};

const DEFAULT: QrStyle = {
  dots: "square", eyeFrame: "square", eyeBall: "square",
  fg: "#000000", fg2: "#000000", gradient: "none", angle: 45, eyeColor: "",
  bg: "#ffffff", logo: false, logoScale: 0.2, margin: 2,
};

const DOTS: Array<[QrStyle["dots"], string]> = [
  ["square", "Cuadrado"], ["rounded", "Redondeado"], ["dots", "Puntos"], ["classy", "Elegante"], ["diamond", "Rombos"],
];
const FRAMES: Array<[QrStyle["eyeFrame"], string]> = [["square", "Cuadrado"], ["rounded", "Redondeado"], ["circle", "Círculo"]];
const BALLS: Array<[QrStyle["eyeBall"], string]> = [["square", "Cuadrado"], ["rounded", "Redondeado"], ["circle", "Círculo"]];

const PRESETS: Array<{ label: string; style: Partial<QrStyle> }> = [
  { label: "Clásico", style: { dots: "square", eyeFrame: "square", eyeBall: "square", gradient: "none", fg: "#000000", bg: "#ffffff", eyeColor: "" } },
  { label: "Suave", style: { dots: "rounded", eyeFrame: "rounded", eyeBall: "rounded", gradient: "none" } },
  { label: "Puntos", style: { dots: "dots", eyeFrame: "circle", eyeBall: "circle" } },
  { label: "Elegante", style: { dots: "classy", eyeFrame: "rounded", eyeBall: "circle" } },
  { label: "Lujo", style: { dots: "rounded", eyeFrame: "rounded", eyeBall: "circle", fg: "#111111", eyeColor: "#b8902f", bg: "#ffffff", gradient: "none" } },
  { label: "Degradado", style: { dots: "dots", eyeFrame: "rounded", eyeBall: "circle", fg: "#2a1a6e", fg2: "#b8327a", gradient: "linear", angle: 45, bg: "#ffffff" } },
];

export type QrCheck = { verified: boolean; warnings: string[]; applied: Partial<QrStyle> | null };

/** Lee las cabeceras de verificación que añade el servidor a cada PNG de QR. */
export function readQrCheck(res: Response): QrCheck {
  const parse = (h: string | null) => { try { return h ? JSON.parse(decodeURIComponent(h)) : null; } catch { return null; } };
  return {
    verified: res.headers.get("X-Qr-Verified") === "1",
    warnings: parse(res.headers.get("X-Qr-Warnings")) ?? [],
    applied: parse(res.headers.get("X-Qr-Style")),
  };
}

export default function QrStyleDesigner({
  value, base, previewUrl, hasLogo, onApply, onReset, applying,
}: {
  /** Estilo guardado (null = el de la plantilla). */
  value: Partial<QrStyle> | null | undefined;
  /** Colores por defecto (plantilla / QR extra). */
  base?: Partial<QrStyle>;
  /** URL del PNG de previsualización para un estilo concreto. */
  previewUrl: (style: QrStyle) => string;
  hasLogo: boolean;
  onApply: (style: QrStyle) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
  applying?: boolean;
}) {
  const initial = (): QrStyle => ({ ...DEFAULT, ...(base ?? {}), ...(value ?? {}) });
  const [style, setStyle] = useState<QrStyle>(initial);
  const [img, setImg] = useState<string | null>(null);
  const [check, setCheck] = useState<QrCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lastUrl = useRef<string | null>(null);

  // Si cambia el estilo guardado desde fuera (otra tarjeta, reset), resincroniza.
  const valueKey = JSON.stringify(value ?? null) + JSON.stringify(base ?? null);
  useEffect(() => { setStyle(initial()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [valueKey]);

  // Previsualización real (servidor) con verificación de lectura, con 350 ms de espera tras cada cambio.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(previewUrl(style), { credentials: "include", signal: ctrl.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Error ${res.status}`);
        }
        const c = readQrCheck(res);
        const url = URL.createObjectURL(await res.blob());
        if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
        lastUrl.current = url;
        setImg(url); setCheck(c);
      } catch (e: any) {
        if (e?.name !== "AbortError") setErr(e?.message || "No se pudo previsualizar");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(style)]);
  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  const set = (p: Partial<QrStyle>) => setStyle((s) => ({ ...s, ...p }));
  const transparent = style.bg === "transparent";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 132, height: 132, flexShrink: 0, borderRadius: 8, overflow: "hidden", position: "relative",
          background: transparent ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 14px 14px" : "#fff",
          border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {img && <img src={img} alt="Vista previa del QR" style={{ width: "100%", height: "100%", objectFit: "contain", opacity: loading ? 0.5 : 1 }} />}
          {loading && <Loader2 size={18} className="animate-spin" style={{ position: "absolute", color: "var(--gold)" }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0, fontSize: 11, display: "flex", flexDirection: "column", gap: 6 }}>
          {err ? (
            <span style={{ color: "#e84558" }}>{err}</span>
          ) : check && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 600, color: check.verified ? "#22c55e" : "#e84558" }}>
              {check.verified ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {check.verified ? "Escaneable (leído por el servidor)" : "No se ha podido leer"}
            </span>
          )}
          {check?.applied && (["fg", "fg2", "bg", "eyeColor", "dots", "eyeFrame", "eyeBall", "logo"] as const)
            .some((k) => check.applied?.[k] !== undefined && check.applied[k] !== style[k]) && (
            <button
              type="button"
              onClick={() => setStyle((s) => ({ ...s, ...(check.applied as Partial<QrStyle>) }))}
              style={{ ...chip(true), alignSelf: "flex-start", fontSize: 10 }}
              title="Adopta exactamente el QR que se imprimirá"
            >
              Usar la versión legible
            </button>
          )}
          {check?.warnings.map((w) => (
            <span key={w} style={{ color: "#ca8a04", display: "flex", gap: 5, lineHeight: 1.4 }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div style={lbl}>Estilos rápidos</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => set(p.style)} style={chip(false)}>{p.label}</button>
          ))}
        </div>
      </div>

      <Choice label="Módulos" options={DOTS} value={style.dots} onChange={(dots) => set({ dots })} />
      <Choice label="Marco de los ojos" options={FRAMES} value={style.eyeFrame} onChange={(eyeFrame) => set({ eyeFrame })} />
      <Choice label="Centro de los ojos" options={BALLS} value={style.eyeBall} onChange={(eyeBall) => set({ eyeBall })} />

      <div>
        <div style={lbl}>Color</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {([["none", "Liso"], ["linear", "Degradado"], ["radial", "Radial"]] as const).map(([g, l]) => (
            <button key={g} type="button" onClick={() => set({ gradient: g })} style={chip(style.gradient === g)}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <ColorInput label={style.gradient === "none" ? "Módulos" : "Inicio"} value={style.fg} onChange={(fg) => set({ fg })} />
          {style.gradient !== "none" && <ColorInput label="Fin" value={style.fg2} onChange={(fg2) => set({ fg2 })} />}
          <ColorInput label="Ojos" value={style.eyeColor || style.fg} onChange={(eyeColor) => set({ eyeColor })} />
          {style.eyeColor && (
            <button type="button" onClick={() => set({ eyeColor: "" })} style={{ ...chip(false), fontSize: 10 }}>Ojos = módulos</button>
          )}
        </div>
        {style.gradient === "linear" && (
          <label style={{ ...lbl, display: "flex", alignItems: "center", gap: 8, marginTop: 6, textTransform: "none" }}>
            Ángulo {style.angle}°
            <input type="range" min={0} max={360} step={15} value={style.angle} onChange={(e) => set({ angle: Number(e.target.value) })} style={{ flex: 1 }} />
          </label>
        )}
      </div>

      <div>
        <div style={lbl}>Fondo</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {!transparent && <ColorInput label="Fondo" value={style.bg} onChange={(bg) => set({ bg })} />}
          <label style={{ fontSize: 11, color: "var(--t2)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={transparent} onChange={(e) => set({ bg: e.target.checked ? "transparent" : "#ffffff" })} />
            Transparente
          </label>
          <label style={{ fontSize: 11, color: "var(--t2)", display: "flex", alignItems: "center", gap: 6 }}>
            Margen
            <input type="range" min={0} max={4} step={1} value={style.margin} onChange={(e) => set({ margin: Number(e.target.value) })} style={{ width: 70 }} />
          </label>
        </div>
      </div>

      <div>
        <div style={lbl}>Logo en el centro</div>
        {hasLogo ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--t2)", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <input type="checkbox" checked={style.logo} onChange={(e) => set({ logo: e.target.checked })} />
              Usar el logo de la tarjeta
            </label>
            {style.logo && (
              <label style={{ fontSize: 11, color: "var(--t2)", display: "flex", alignItems: "center", gap: 6 }}>
                Tamaño
                <input type="range" min={0.12} max={0.24} step={0.02} value={style.logoScale} onChange={(e) => set({ logoScale: Number(e.target.value) })} style={{ width: 80 }} />
              </label>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--t3)" }}>Sube el logo de la tarjeta (sección Diseño) para poder ponerlo en el QR.</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          disabled={applying || loading || !!err}
          onClick={() => onApply(style)}
          style={{
            flex: 1, padding: "8px 10px", borderRadius: 6, border: "none", cursor: applying ? "wait" : "pointer",
            background: "linear-gradient(135deg,#d4af37,#b8902f)", color: "#0a0a0a", fontWeight: 700, fontSize: 12,
            opacity: applying || loading || err ? 0.6 : 1,
          }}
        >
          {applying ? "Aplicando…" : "Aplicar estilo"}
        </button>
        {onReset && (
          <button type="button" onClick={() => onReset()} title="Volver al QR de la plantilla" style={{ ...chip(false), display: "flex", alignItems: "center", gap: 4 }}>
            <RotateCcw size={11} /> Plantilla
          </button>
        )}
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, options, value, onChange }: {
  label: string; options: Array<[T, string]>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)} style={chip(value === v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <label style={{ fontSize: 11, color: "var(--t2)", display: "flex", alignItems: "center", gap: 5 }}>
      <input type="color" value={safe} onChange={(e) => onChange(e.target.value)}
        style={{ width: 26, height: 22, padding: 0, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, background: "none", cursor: "pointer" }} />
      {label}
    </label>
  );
}

const lbl: React.CSSProperties = {
  fontSize: 10, color: "var(--t3)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6,
};

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "4px 9px", fontSize: 11, borderRadius: 5, cursor: "pointer",
    background: active ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.04)",
    border: active ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.1)",
    color: active ? "var(--gold)" : "var(--t2)", fontWeight: active ? 600 : 400,
  };
}
