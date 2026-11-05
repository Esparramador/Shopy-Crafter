import { useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { StatusBadge, type StatusStyle } from "@/components/commerce/hub-kit";
import type { HttpError, ListResponse, SchemaField, WriteState } from "./api";

export const WP = "#96588a";
export const WL = "#b97ab5";
export const WD = "#5b2d5f";
export const RED = "#f43f5e";
export const AMBER = "#fb923c";
export const GREEN = "#34d399";
export const MUTED = "rgba(255,255,255,0.45)";

export const inputStyle: CSSProperties = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "8px 11px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
export const panelStyle: CSSProperties = { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
export const mono: CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

export const STATUS: Record<string, StatusStyle> = {
  processing: { bg: "rgba(251,191,36,0.12)", c: "#fbbf24", label: "Procesando" },
  pending: { bg: "rgba(251,191,36,0.12)", c: "#fbbf24", label: "Pendiente de pago" },
  "on-hold": { bg: "rgba(251,146,60,0.12)", c: AMBER, label: "En espera" },
  completed: { bg: "rgba(52,211,153,0.12)", c: GREEN, label: "Completado" },
  cancelled: { bg: "rgba(244,63,94,0.12)", c: RED, label: "Cancelado" },
  refunded: { bg: "rgba(156,163,175,0.12)", c: "#9ca3af", label: "Reembolsado" },
  failed: { bg: "rgba(244,63,94,0.12)", c: RED, label: "Fallido" },
  trash: { bg: "rgba(244,63,94,0.12)", c: RED, label: "Papelera" },
  publish: { bg: "rgba(52,211,153,0.12)", c: GREEN, label: "Publicado" },
  draft: { bg: "rgba(251,191,36,0.12)", c: "#fbbf24", label: "Borrador" },
  pending_review: { bg: "rgba(251,191,36,0.12)", c: "#fbbf24", label: "Pendiente" },
  private: { bg: "rgba(99,91,255,0.15)", c: "#897eff", label: "Privado" },
  instock: { bg: "rgba(52,211,153,0.12)", c: GREEN, label: "En stock" },
  outofstock: { bg: "rgba(244,63,94,0.12)", c: RED, label: "Sin stock" },
  onbackorder: { bg: "rgba(251,146,60,0.12)", c: AMBER, label: "Bajo pedido" },
  percent: { bg: "rgba(150,88,138,0.15)", c: WL, label: "Porcentaje" },
  fixed_cart: { bg: "rgba(150,88,138,0.15)", c: WL, label: "Fijo carrito" },
  fixed_product: { bg: "rgba(150,88,138,0.15)", c: WL, label: "Fijo producto" },
  simple: { bg: "rgba(255,255,255,0.06)", c: "rgba(255,255,255,0.7)", label: "Simple" },
  variable: { bg: "rgba(150,88,138,0.15)", c: WL, label: "Variable" },
};
export const Badge = ({ status }: { status: string }) => <StatusBadge status={status ?? ""} map={STATUS} />;

export function Btn({ children, onClick, variant = "ghost", disabled, type = "button", testId, title }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "soft" | "danger"; disabled?: boolean; type?: "button" | "submit"; testId?: string; title?: string }) {
  const v: Record<string, CSSProperties> = {
    primary: { background: WP, border: `1px solid ${WP}`, color: "#fff", fontWeight: 700 },
    ghost: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" },
    soft: { background: "rgba(150,88,138,0.15)", border: `1px solid ${WP}55`, color: WL, fontWeight: 600 },
    danger: { background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.35)", color: RED, fontWeight: 600 },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} title={title}
      style={{ ...v[variant], borderRadius: 8, padding: "7px 14px", fontSize: 12.5, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", fontFamily: "inherit" }}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, span }: { label: string; hint?: ReactNode; children: ReactNode; span?: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)" }}>{hint}</span>}
    </label>
  );
}

export const Grid = ({ children, cols = 3 }: { children: ReactNode; cols?: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${cols >= 3 ? 180 : 240}px, 1fr))`, gap: 12 }}>{children}</div>
);

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ ...panelStyle, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: WL }}>{title}</h4>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>{right}</div>
      </div>
      {children}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: HttpError | string; onRetry?: () => void }) {
  const msg = typeof error === "string" ? error : error.message;
  const perm = typeof error !== "string" && (error.status === 401 || error.status === 403);
  return (
    <div data-testid="status-error" style={{ padding: "14px 16px", color: RED, background: "rgba(244,63,94,0.08)", borderRadius: 10, border: "1px solid rgba(244,63,94,0.25)", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
      {perm ? <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{perm ? "Sin permiso en WooCommerce" : "No se pudo leer de WooCommerce"}</div>
        <div style={{ color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{msg}</div>
        <div style={{ color: "rgba(255,255,255,0.4)", marginTop: 4, fontSize: 11.5 }}>No se muestran datos ni totales hasta tener una lectura válida.</div>
      </div>
      {onRetry && <Btn onClick={onRetry} testId="button-retry"><RefreshCw size={13} /> Reintentar</Btn>}
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 34, borderRadius: 8, background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))", backgroundSize: "200% 100%", animation: "wooShimmer 1.4s ease-in-out infinite", opacity: 1 - i * 0.1 }} />
      ))}
      <style>{`@keyframes wooShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

export function Provenance({ source, fetchedAt, extra }: { source?: string; fetchedAt?: string; extra?: ReactNode }) {
  return (
    <div data-testid="text-provenance" style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,0.38)", ...mono }}>
      <span>fuente: {source ?? "desconocida"}</span>
      <span>leído: {fetchedAt ? new Date(fetchedAt).toLocaleString("es-ES") : "—"}</span>
      {extra}
    </div>
  );
}

export function ListMeta({ meta, perPage, onPage }: { meta: ListResponse<unknown>; perPage: number; onPage: (p: number) => void }) {
  const from = meta.total === 0 ? 0 : (meta.page - 1) * perPage + 1;
  const to = Math.min(meta.page * perPage, meta.total);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
      <span data-testid="text-list-total" style={{ fontSize: 12, color: MUTED }}>{from}–{to} de {meta.total} · página {meta.page} de {Math.max(meta.totalPages, 1)}</span>
      <Provenance source={meta.source} fetchedAt={meta.fetchedAt} />
      <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
        <Btn onClick={() => onPage(meta.page - 1)} disabled={meta.page <= 1} testId="button-page-prev">Anterior</Btn>
        <Btn onClick={() => onPage(meta.page + 1)} disabled={!meta.hasMore} testId="button-page-next">Siguiente</Btn>
      </div>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{children}</div>;
}

export function Select({ value, onChange, options, testId, style }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; testId?: string; style?: CSSProperties }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} data-testid={testId} style={{ ...inputStyle, width: "auto", ...style }}>
      {options.map(o => <option key={o.value} value={o.value} style={{ background: "#1a1020" }}>{o.label}</option>)}
    </select>
  );
}

/** Modal de confirmación explícita antes de escribir en WooCommerce. */
export function ConfirmDialog({ open, title, children, confirmLabel = "Confirmar y escribir", onConfirm, onCancel, requireCheck }: { open: boolean; title: string; children: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; requireCheck?: string }) {
  const [checked, setChecked] = useState(false);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,4,12,0.72)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} role="dialog" data-testid="dialog-confirm" style={{ width: "min(520px, 100%)", background: "#1d1222", border: `1px solid ${WP}66`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={18} color={AMBER} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.55 }}>{children}</div>
        {requireCheck && (
          <label style={{ display: "flex", gap: 8, fontSize: 12.5, color: AMBER, alignItems: "flex-start" }}>
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} data-testid="checkbox-confirm" style={{ marginTop: 2 }} />
            {requireCheck}
          </label>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Btn onClick={() => { setChecked(false); onCancel(); }} testId="button-confirm-cancel">Cancelar</Btn>
          <Btn variant="primary" disabled={!!requireCheck && !checked} onClick={() => { setChecked(false); onConfirm(); }} testId="button-confirm-ok">{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

export function WriteStatus({ state, message, operationId, onReload, onRetry }: { state: WriteState; message: string; operationId: string | null; onReload: () => void; onRetry: () => void }) {
  if (state === "idle") return null;
  const map = {
    saving: { c: WL, bg: "rgba(150,88,138,0.1)", icon: <Loader2 size={14} className="animate-spin" />, t: "Escribiendo y verificando en WooCommerce" },
    verified: { c: GREEN, bg: "rgba(52,211,153,0.08)", icon: <CheckCircle2 size={14} />, t: "Cambio verificado" },
    failed: { c: RED, bg: "rgba(244,63,94,0.08)", icon: <X size={14} />, t: "WooCommerce rechazó el cambio" },
    uncertain: { c: AMBER, bg: "rgba(251,146,60,0.1)", icon: <AlertTriangle size={14} />, t: "Resultado incierto: escritura bloqueada" },
  }[state];
  return (
    <div data-testid={`status-write-${state}`} style={{ padding: "10px 14px", borderRadius: 10, background: map.bg, border: `1px solid ${map.c}44`, color: map.c, fontSize: 12.5, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>{map.icon}{map.t}</div>
      {message && <div style={{ color: "rgba(255,255,255,0.7)" }}>{message}</div>}
      {operationId && state !== "verified" && <div style={{ ...mono, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>operationId {operationId} (se reutiliza en el reintento)</div>}
      {state === "uncertain" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: "rgba(255,255,255,0.6)", flexBasis: "100%" }}>No repitas con otra operación. Revisa el estado real en WooCommerce.</span>
          <Btn onClick={onReload} variant="soft" testId="button-reload-from-woo"><RefreshCw size={13} /> Recargar desde WooCommerce</Btn>
          <Btn onClick={onRetry} testId="button-retry-same-op">Reintentar con el mismo operationId</Btn>
        </div>
      )}
      {state === "failed" && <div><Btn onClick={onRetry} testId="button-retry-write">Reintentar (mismo operationId)</Btn></div>}
    </div>
  );
}

/** Campos extra expuestos por OPTIONS. Complementan, nunca sustituyen, los controles principales. */
export function SchemaExtras({ fields, exclude, values, onChange, error }: { fields: Record<string, SchemaField> | null; exclude: string[]; values: Record<string, unknown>; onChange: (k: string, v: unknown) => void; error?: HttpError | null }) {
  const [open, setOpen] = useState(false);
  if (error) return <div style={{ fontSize: 11.5, color: AMBER }}>No se pudo leer el esquema OPTIONS: {error.message}</div>;
  if (!fields) return null;
  const entries = Object.entries(fields).filter(([k, f]) => !exclude.includes(k) && !f.readonly && isPrimitive(f));
  if (!entries.length) return null;
  return (
    <Section title={`Campos adicionales de esta instalación (${entries.length})`} right={<Btn onClick={() => setOpen(!open)} testId="button-toggle-schema">{open ? "Ocultar" : "Mostrar"}</Btn>}>
      <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.4)" }}>Declarados por OPTIONS. Que aparezcan no prueba permiso de escritura: un 401/403 real se mostrará al guardar. Sólo se envían los que modifiques.</div>
      {open && (
        <Grid>
          {entries.map(([k, f]) => {
            const t = Array.isArray(f.type) ? f.type[0] : f.type;
            const v = values[k];
            return (
              <Field key={k} label={k} hint={f.description}>
                {f.enum ? (
                  <select value={v == null ? "" : String(v)} onChange={e => onChange(k, e.target.value || undefined)} style={inputStyle} data-testid={`select-schema-${k}`}>
                    <option value="" style={{ background: "#1a1020" }}>(sin cambio)</option>
                    {f.enum.map(o => <option key={o} value={o} style={{ background: "#1a1020" }}>{o}</option>)}
                  </select>
                ) : t === "boolean" ? (
                  <select value={v == null ? "" : String(v)} onChange={e => onChange(k, e.target.value === "" ? undefined : e.target.value === "true")} style={inputStyle} data-testid={`select-schema-${k}`}>
                    <option value="" style={{ background: "#1a1020" }}>(sin cambio)</option>
                    <option value="true" style={{ background: "#1a1020" }}>true</option>
                    <option value="false" style={{ background: "#1a1020" }}>false</option>
                  </select>
                ) : (
                  <input value={v == null ? "" : String(v)} type={t === "integer" || t === "number" ? "number" : "text"} style={inputStyle} data-testid={`input-schema-${k}`}
                    onChange={e => onChange(k, e.target.value === "" ? undefined : t === "integer" || t === "number" ? Number(e.target.value) : e.target.value)} />
                )}
              </Field>
            );
          })}
        </Grid>
      )}
    </Section>
  );
}
function isPrimitive(f: SchemaField) {
  const t = Array.isArray(f.type) ? f.type[0] : f.type;
  return t === "string" || t === "integer" || t === "number" || t === "boolean";
}

export function Drawer({ open, title, onClose, children, subtitle }: { open: boolean; title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,4,12,0.6)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} data-testid="drawer-editor" style={{ width: "min(920px, 100%)", height: "100%", overflowY: "auto", background: "#150c19", borderLeft: `1px solid ${WP}44`, padding: "20px 22px 80px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, position: "sticky", top: -20, background: "#150c19", padding: "8px 0", zIndex: 2 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <Btn onClick={onClose} testId="button-close-drawer"><X size={14} /> Cerrar</Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <div style={{ textAlign: "center", padding: "44px 16px", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{children}</div>
);
