import type { CSSProperties } from "react";

export const SP = "#635bff";
export const SL = "#897eff";
export const SA = "#a78bfa";

export const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
const THREE_DECIMAL = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function currencyExponent(currency: string): number {
  const c = (currency || "eur").toLowerCase();
  return ZERO_DECIMAL.has(c) ? 0 : THREE_DECIMAL.has(c) ? 3 : 2;
}

/** Importe en unidades mínimas de Stripe → texto con la moneda. */
export function fmt(amount: number | null | undefined, currency = "eur"): string {
  const cur = (currency || "eur").toUpperCase();
  const exp = currencyExponent(currency);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: cur, minimumFractionDigits: exp, maximumFractionDigits: exp })
    .format((amount ?? 0) / 10 ** exp);
}

export const fmtDate = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const INTERVAL_ES: Record<string, [string, string]> = {
  day: ["día", "días"], week: ["semana", "semanas"], month: ["mes", "meses"], year: ["año", "años"],
};

export function intervalLabel(interval: string | null | undefined, count?: number | null): string {
  if (!interval) return "pago único";
  const [one, many] = INTERVAL_ES[interval] ?? [interval, interval];
  return count && count > 1 ? `cada ${count} ${many}` : `/ ${one}`;
}

export function priceText(p: { unitAmount: number | null; currency: string; interval?: string | null; intervalCount?: number | null }): string {
  const money = fmt(p.unitAmount ?? 0, p.currency);
  return p.interval ? `${money} ${intervalLabel(p.interval, p.intervalCount)}` : `${money} · pago único`;
}

export const CURRENCIES = ["eur", "usd", "gbp", "mxn", "cop", "ars", "clp", "chf", "jpy"];

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
  return d as T;
}

export const S: Record<string, CSSProperties> = {
  card:  { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px" },
  sub:   { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 18px" },
  th:    { padding: "10px 14px", textAlign: "left", fontSize: 11, color: "rgba(240,237,230,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid rgba(255,255,255,0.06)", fontWeight: 700 },
  td:    { padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "#f0ede6", fontSize: 13, verticalAlign: "top" },
  inp:   { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, color: "#f0ede6", padding: "9px 13px", fontSize: 13, width: "100%", boxSizing: "border-box" },
  sel:   { background: "#1a1a26", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, color: "#f0ede6", padding: "9px 13px", fontSize: 13, cursor: "pointer", width: "100%" },
  lbl:   { fontSize: 11, color: "rgba(240,237,230,0.55)", marginBottom: 5, display: "block", textTransform: "uppercase", letterSpacing: "0.06em" },
  hint:  { fontSize: 11, color: "rgba(240,237,230,0.45)", marginTop: 4, lineHeight: 1.45 },
  btn:   { padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 },
  btnP:  { background: `linear-gradient(135deg,${SP},${SL})`, color: "#fff", boxShadow: `0 4px 18px ${SP}45` },
  btnG:  { background: "rgba(255,255,255,0.07)", color: "#f0ede6", border: "1px solid rgba(255,255,255,0.12)" },
  btnD:  { background: "rgba(244,63,94,0.1)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.2)" },
  btnSm: { padding: "5px 12px", fontSize: 12 },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 },
  empty: { textAlign: "center", padding: "48px 20px", color: "rgba(240,237,230,0.35)", fontSize: 13 },
  title: { fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#fff" },
  sectionTitle: { fontWeight: 700, fontSize: 14, marginBottom: 14, color: SL },
  tag:   { display: "inline-block", fontSize: 11, padding: "2px 9px", borderRadius: 100, background: "rgba(99,91,255,0.12)", color: SL, fontWeight: 700, whiteSpace: "nowrap" },
  code:  { fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" },
};

export const ASSOCIATION_TYPES = [
  { value: "", label: "Sin asociar" },
  { value: "cliente", label: "Cliente" },
  { value: "pedido", label: "Pedido" },
  { value: "servicio", label: "Servicio" },
  { value: "proyecto", label: "Proyecto" },
  { value: "campaña", label: "Campaña" },
  { value: "evento", label: "Evento" },
  { value: "otro", label: "Otro" },
];

export type Association = { type: string; ref: string };

/** Asociar un producto, enlace, factura o pago con un cliente/pedido/servicio… (se guarda en metadata de Stripe). */
export function AssociationFields({ value, onChange, help }: { value: Association; onChange: (v: Association) => void; help?: string }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 2fr", gap: 10 }}>
        <div>
          <label style={S.lbl}>Asociar a</label>
          <select style={S.sel} value={value.type} onChange={e => onChange({ ...value, type: e.target.value })}>
            {ASSOCIATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>Referencia</label>
          <input style={S.inp} value={value.ref} maxLength={500} disabled={!value.type}
            placeholder={value.type ? "Ej.: Pedido 1042, Ana Pérez, Boda 12/06…" : "Elige primero a qué se asocia"}
            onChange={e => onChange({ ...value, ref: e.target.value })} />
        </div>
      </div>
      <div style={S.hint}>{help ?? "Se guarda en Stripe (metadata) y viaja a cada pago: así sabes a qué corresponde cada cobro."}</div>
    </div>
  );
}

export function assocPayload(a: Association) {
  return a.type ? { type: a.type, ref: a.ref.trim() } : null;
}

export function AssocBadge({ metadata }: { metadata?: Record<string, string> | null }) {
  if (!metadata?.sc_ref_type && !metadata?.sc_ref) return null;
  const label = ASSOCIATION_TYPES.find(t => t.value === metadata.sc_ref_type)?.label ?? metadata.sc_ref_type ?? "Ref";
  return (
    <span style={{ ...S.tag, background: "rgba(201,169,97,0.12)", color: "#c9a961" }} title="Asociación guardada en Stripe">
      🔗 {label}{metadata.sc_ref ? `: ${metadata.sc_ref}` : ""}
    </span>
  );
}

export function Notice({ kind, children, onClose }: { kind: "err" | "ok"; children: React.ReactNode; onClose?: () => void }) {
  const style: CSSProperties = kind === "err"
    ? { background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171" }
    : { background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" };
  return (
    <div style={{ ...style, borderRadius: 10, padding: "11px 16px", fontSize: 13, marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>{children}</div>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 14 }} aria-label="Cerrar">✕</button>}
    </div>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  return (
    <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => { void navigator.clipboard?.writeText(text); }} title={text}>
      📋 {label}
    </button>
  );
}

export interface CatalogPrice {
  id: string; productId: string | null; unitAmount: number | null; currency: string; type: string;
  interval: string | null; intervalCount: number | null; nickname: string | null; active: boolean; taxBehavior: string | null;
}
export interface CatalogProduct {
  id: string; name: string; description: string | null; active: boolean; images: string[];
  metadata: Record<string, string>; defaultPriceId: string | null; created: number; prices: CatalogPrice[];
}
export interface CustomerLite { id: string; email: string | null; name: string | null }
