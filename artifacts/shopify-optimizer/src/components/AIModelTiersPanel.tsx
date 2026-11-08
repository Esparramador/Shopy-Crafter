import { useCallback, useEffect, useState } from "react";
import { RefreshCw, RotateCcw, Save, CheckCircle, AlertCircle } from "lucide-react";

/**
 * Modelo por tier (fast/smart/genius/vision) y proveedor (Claude, Gemini, xAI),
 * editable en vivo. GET/POST /api/admin/ai-models → setAIModelOverride()
 * (platform_settings); el backend lo aplica en menos de 60 s.
 */

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AITier = "fast" | "smart" | "genius" | "vision";
export type AIProvider = "claude" | "gemini" | "xai";
type Source = "override" | "db" | "env" | "default";
export interface TierInfo { current: string; default: string; envKey: string; settingsKey: string; source: Source }
export type AIModelMatrix = Record<AIProvider, Record<AITier, TierInfo>>;
export interface CatalogEntry { id: string; label: string; tierHint: AITier; notes?: string }
export type AIModelCatalog = Record<AIProvider, CatalogEntry[]>;

const PROVIDERS: Array<{ key: AIProvider; label: string; color: string }> = [
  { key: "claude", label: "Claude", color: "var(--gold, #c8a84b)" },
  { key: "gemini", label: "Gemini", color: "var(--jade, #2dd49f)" },
  { key: "xai", label: "xAI · Grok", color: "#9aa4ff" },
];
const TIERS: Array<{ key: AITier; label: string; hint: string }> = [
  { key: "fast", label: "Fast", hint: "rápido y barato" },
  { key: "smart", label: "Smart", hint: "equilibrado" },
  { key: "genius", label: "Genius", hint: "máximo razonamiento" },
  { key: "vision", label: "Vision", hint: "imagen de entrada" },
];
const SOURCE_LABEL: Record<Source, string> = { override: "llamada", db: "panel", env: "entorno", default: "por defecto" };

/** Opciones del desplegable: el catálogo + el modelo activo si no está en él. */
export function tierOptions(catalog: CatalogEntry[], current: string, def: string): CatalogEntry[] {
  const out = [...catalog];
  for (const id of [current, def]) {
    if (id && !out.some(m => m.id === id)) out.unshift({ id, label: id, tierHint: "smart", notes: "Fuera del catálogo" });
  }
  return out;
}

export default function AIModelTiersPanel() {
  const [matrix, setMatrix] = useState<AIModelMatrix | null>(null);
  const [catalog, setCatalog] = useState<AIModelCatalog | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/ai-models`, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMatrix(d.matrix);
      setCatalog(d.catalog);
      setDraft({});
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (provider: AIProvider, tier: AITier, model: string | null) => {
    const k = `${provider}.${tier}`;
    setSaving(k);
    setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/api/admin/ai-models`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, tier, model }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setMatrix(d.matrix);
      setDraft(prev => { const n = { ...prev }; delete n[k]; return n; });
      setMsg({ ok: true, text: model ? `${provider} · ${tier} → ${model} (se aplica en menos de 60 s)` : `${provider} · ${tier} vuelve a su valor por defecto` });
    } catch (e) {
      setMsg({ ok: false, text: `No se pudo guardar: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setSaving(null);
    }
  };

  const box: React.CSSProperties = {
    background: "var(--ink2,#1a1a2e)", border: "1px solid var(--border,rgba(255,255,255,0.08))",
    borderRadius: 12, padding: "18px 20px", marginBottom: 24,
  };

  return (
    <section style={box} aria-labelledby="ai-tiers-title" data-testid="ai-model-tiers">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h2 id="ai-tiers-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--t,#fff)" }}>Modelo activo por tier</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--t3,#888)" }}>
            Cambia el modelo que usa cada nivel sin tocar código. Se guarda en la base de datos y se aplica en menos de 60 s.
          </p>
        </div>
        <button onClick={() => void load()} aria-label="Recargar modelos" title="Recargar"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 8, color: "var(--t2,#ccc)", cursor: "pointer", display: "flex" }}>
          <RefreshCw size={16} />
        </button>
      </div>

      {msg && (
        <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12, padding: "8px 12px", borderRadius: 8,
          color: msg.ok ? "var(--jade,#2dd49f)" : "#ef4444", background: msg.ok ? "rgba(45,212,159,0.08)" : "rgba(239,68,68,0.08)" }}>
          {msg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{msg.text}
        </div>
      )}
      {loadError && <div role="alert" style={{ color: "#ef4444", fontSize: 12 }}>No se pudo leer la configuración: {loadError}</div>}
      {!matrix && !loadError && <div style={{ color: "var(--t3,#888)", fontSize: 12 }}>Cargando…</div>}

      {matrix && catalog && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 14 }}>
          {PROVIDERS.map(p => (
            <div key={p.key} style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 12, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{p.label}</div>
              {TIERS.map(t => {
                const info = matrix[p.key][t.key];
                const k = `${p.key}.${t.key}`;
                const value = draft[k] ?? info.current;
                const dirty = value !== info.current;
                const opts = tierOptions(catalog[p.key] ?? [], info.current, info.default);
                const selectId = `ai-tier-${p.key}-${t.key}`;
                return (
                  <div key={t.key} style={{ marginBottom: 10 }}>
                    <label htmlFor={selectId} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--t3,#888)", marginBottom: 4 }}>
                      <span><strong style={{ color: "var(--t2,#ccc)" }}>{t.label}</strong> · {t.hint}</span>
                      <span title={info.source === "env" ? `Variable ${info.envKey}` : undefined}>{SOURCE_LABEL[info.source]}</span>
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select id={selectId} value={value} disabled={saving === k}
                        onChange={e => setDraft(prev => ({ ...prev, [k]: e.target.value }))}
                        style={{ flex: 1, minWidth: 0, background: "rgba(0,0,0,0.25)", border: `1px solid ${dirty ? p.color : "rgba(255,255,255,0.1)"}`, borderRadius: 6, padding: "6px 8px", color: "var(--t,#fff)", fontSize: 12 }}>
                        {opts.map(m => (
                          <option key={m.id} value={m.id} title={m.notes}>{m.label}{m.id === info.default ? " (defecto)" : ""}</option>
                        ))}
                      </select>
                      <button onClick={() => void save(p.key, t.key, value)} disabled={!dirty || saving === k}
                        aria-label={`Guardar ${p.label} ${t.label}`} title="Guardar"
                        style={{ background: dirty ? p.color : "transparent", color: dirty ? "#000" : "var(--t4,#555)", border: `1px solid ${dirty ? p.color : "rgba(255,255,255,0.1)"}`, borderRadius: 6, padding: "0 8px", cursor: dirty ? "pointer" : "default", display: "flex", alignItems: "center" }}>
                        <Save size={13} />
                      </button>
                      {info.source === "db" && (
                        <button onClick={() => void save(p.key, t.key, null)} disabled={saving === k}
                          aria-label={`Restablecer ${p.label} ${t.label}`} title={`Volver a ${info.default}`}
                          style={{ background: "transparent", color: "var(--t3,#888)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "0 8px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t4,#666)", fontFamily: "monospace", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.current}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
