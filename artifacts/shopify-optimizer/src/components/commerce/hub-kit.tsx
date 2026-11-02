// Piezas comunes de los hubs de WooCommerce y PrestaShop (antes copiadas en los dos).
import type { ReactNode } from "react";

// Respuestas no-OK → error con el mensaje del API (antes se pintaban como datos: "NaN €", "undefined").
export async function okJson(r: Response) {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
  return d;
}

export const fmt = (n: number, currency = "EUR") =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency, minimumFractionDigits: 2 }).format(n);

export const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateShort = (d: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—";

export type StatusStyle = { bg: string; c: string; label: string };

/** Etiqueta de estado; cada hub pasa su propio mapa (WooCommerce y PrestaShop usan estados distintos). */
export function StatusBadge({ status, map }: { status: string; map: Record<string, StatusStyle> }) {
  const s = map[status] ?? { bg: "rgba(255,255,255,0.06)", c: "rgba(255,255,255,0.5)", label: status };
  return (
    <span style={{ display:"inline-block", padding:"2px 10px", borderRadius:100, fontSize:11, fontWeight:700, background:s.bg, color:s.c, whiteSpace:"nowrap" }}>
      {s.label}
    </span>
  );
}

export function KpiCard({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: string; color: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:22 }}>{icon}</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</span>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color, marginTop:4 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{sub}</div>}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"8px 14px", color:"#fff", fontSize:13, outline:"none", width:260 }}
    />
  );
}

export function Table({ cols, rows, emptyMsg }: { cols: string[]; rows: ReactNode[][]; emptyMsg: string }) {
  if (!rows.length) return (
    <div style={{ textAlign:"center", padding:"48px 0", color:"rgba(255,255,255,0.3)", fontSize:13 }}>
      {emptyMsg}
    </div>
  );
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c} style={{ padding:"10px 14px", textAlign:"left", color:"rgba(255,255,255,0.4)", fontWeight:600, fontSize:11, textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid rgba(255,255,255,0.08)", whiteSpace:"nowrap" }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding:"12px 14px", color:"rgba(255,255,255,0.85)", verticalAlign:"middle" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, onPage, hasMore }: { page: number; onPage: (p: number) => void; hasMore: boolean }) {
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"center", padding:"16px 0" }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"6px 14px", color: page <= 1 ? "rgba(255,255,255,0.2)" : "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", fontSize:13 }}>
        ← Anterior
      </button>
      <span style={{ color:"rgba(255,255,255,0.4)", fontSize:13 }}>Página {page}</span>
      <button onClick={() => onPage(page + 1)} disabled={!hasMore}
        style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"6px 14px", color: !hasMore ? "rgba(255,255,255,0.2)" : "#fff", cursor: !hasMore ? "not-allowed" : "pointer", fontSize:13 }}>
        Siguiente →
      </button>
    </div>
  );
}
