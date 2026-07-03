import { useState, useEffect } from "react";
import { Key, Plus, Trash2, TestTube, CheckCircle, XCircle, Eye, EyeOff, ExternalLink, Loader2, RefreshCw, Shield, AlertTriangle, ChevronDown, ChevronRight, Save } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ApiKeyEntry {
  id: number | null;
  provider: string;
  key_name: string;
  label: string;
  icon: string;
  category: string;
  description: string;
  docs: string;
  source: "db" | "env" | "missing";
  is_active: boolean;
  masked_value: string | null;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_error: string | null;
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: string }> = {
  ai:       { label: "IA & Modelos",    color: "#8b5cf6", icon: "🧠" },
  media:    { label: "Media & Vídeo",   color: "#3b82f6", icon: "🎬" },
  audio:    { label: "Audio & Voz",     color: "#ec4899", icon: "🎙️" },
  design:   { label: "Diseño",          color: "#f59e0b", icon: "🎨" },
  social:   { label: "Redes Sociales",  color: "#ef4444", icon: "📱" },
  payments: { label: "Pagos",           color: "#10b981", icon: "💳" },
  other:    { label: "Otros",           color: "#64748b", icon: "🔑" },
};

function StatusDot({ ok, loading }: { ok: boolean | null; loading?: boolean }) {
  if (loading) return <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite", color: "#f59e0b" }} />;
  if (ok === null) return <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#64748b" }} />;
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "#4ade80" : "#f87171" }} />;
}

function SourceBadge({ source }: { source: string }) {
  const cfg = source === "env" ? { color: "#4ade80", bg: "rgba(74,222,128,0.1)", label: "ENV" }
    : source === "db"  ? { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", label: "DB" }
    : { color: "#f87171", bg: "rgba(248,113,113,0.1)", label: "MISSING" };
  return (
    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 20, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}44` }}>
      {cfg.label}
    </span>
  );
}

export default function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [testing, setTesting] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ provider: "", key_name: "", key_value: "", description: "", category: "ai" });
  const [saving, setSaving] = useState(false);
  const [showValue, setShowValue] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({ ai: true, media: true, audio: true, design: true, social: true, payments: true, other: true });
  const [billingProvider, setBillingProvider] = useState<"shopify" | "stripe">("shopify");
  const [savingBilling, setSavingBilling] = useState(false);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    load();
    fetch(`${API}/api/admin/billing-config`, { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.provider) setBillingProvider(d.provider); }).catch(() => {});
  }, []);

  async function saveBillingProvider(p: "shopify" | "stripe") {
    setSavingBilling(true);
    setBillingProvider(p);
    try {
      const r = await fetch(`${API}/api/admin/billing-config`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: p }),
      });
      if (r.ok) showToast(`✅ Método de cobro actualizado: ${p === "shopify" ? "Shopify Billing" : "Stripe"}`, true);
      else showToast("Error guardando configuración de cobro", false);
    } catch { showToast("Error de red", false); }
    setSavingBilling(false);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/api-keys`, { credentials: "include" });
      const d = await r.json();
      setKeys(d.keys || []);
      setCategories(d.categories || []);
    } catch { showToast("Error cargando keys", false); }
    setLoading(false);
  }

  async function testKey(id: number) {
    setTesting(id);
    try {
      const r = await fetch(`${API}/api/admin/api-keys/${id}/test`, { method: "POST", credentials: "include" });
      const d = await r.json();
      setKeys(prev => prev.map(k => k.id === id ? { ...k, last_test_ok: d.ok, last_test_error: d.detail, last_tested_at: new Date().toISOString() } : k));
      showToast(d.ok ? `✓ ${d.detail}` : `✗ ${d.detail}`, d.ok);
    } catch { showToast("Error probando key", false); }
    setTesting(null);
  }

  async function deleteKey(id: number) {
    if (!confirm("¿Eliminar esta API key de la base de datos?")) return;
    setDeleting(id);
    try {
      await fetch(`${API}/api/admin/api-keys/${id}`, { method: "DELETE", credentials: "include" });
      setKeys(prev => prev.map(k => k.id === id ? { ...k, id: null, source: "env" as const, masked_value: null } : k));
      showToast("Key eliminada de DB (sigue activa en ENV)", true);
    } catch { showToast("Error eliminando key", false); }
    setDeleting(null);
  }

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.key_value.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/admin/api-keys`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      showToast(d.message || "Key guardada", true);
      setShowAdd(false);
      setAddForm({ provider: "", key_name: "", key_value: "", description: "", category: "ai" });
      await load();
    } catch (e: any) { showToast(e.message, false); }
    setSaving(false);
  }

  async function saveEdit(key: ApiKeyEntry) {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/admin/api-keys`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: key.provider, key_name: key.key_name, key_value: editValue, description: key.description, category: key.category }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      showToast("Key actualizada y activa", true);
      setEditId(null); setEditValue("");
      await load();
    } catch (e: any) { showToast(e.message, false); }
    setSaving(false);
  }

  const filtered = keys.filter(k => filterCat === "all" || k.category === filterCat);
  const byCategory = categories.reduce<Record<string, ApiKeyEntry[]>>((acc, cat) => {
    acc[cat] = filtered.filter(k => k.category === cat);
    return acc;
  }, {});

  const totalConfigured = keys.filter(k => k.source !== "missing").length;
  const totalOk = keys.filter(k => k.last_test_ok === true).length;
  const totalMissing = keys.filter(k => k.source === "missing").length;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.ok ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
          border: `1px solid ${toast.ok ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"}`,
          color: toast.ok ? "#4ade80" : "#f87171" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(245,158,11,0.35)" }}>
          <Key size={24} color="#000" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t)" }}>API Keys Manager</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>Gestión centralizada de claves de API. Los cambios se aplican en tiempo real.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ padding: "8px 14px", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => setShowAdd(s => !s)} style={{ padding: "8px 16px", background: "var(--jade)", border: "none", borderRadius: 9, color: "#000", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}>
            <Plus size={15} /> Nueva API Key
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total providers", value: keys.length, color: "var(--t)" },
          { label: "Configuradas", value: totalConfigured, color: "#4ade80" },
          { label: "Testeadas OK", value: totalOk, color: "#60a5fa" },
          { label: "Sin configurar", value: totalMissing, color: "#f87171" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Security notice */}
      <div style={{ padding: "10px 16px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 9, marginBottom: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#f59e0b" }}>
        <Shield size={14} /> Las keys se guardan cifradas en la base de datos y se inyectan en el entorno de forma inmediata. Nunca se envían al cliente.
      </div>

      {/* Add key form */}
      {showAdd && (
        <div style={{ background: "var(--ink2)", border: "1px solid var(--jade)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "var(--t)" }}>➕ Añadir nueva API Key</h3>
          <form onSubmit={saveKey} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Proveedor *</label>
              <input value={addForm.provider} onChange={e => setAddForm(f => ({ ...f, provider: e.target.value }))} placeholder="xai, anthropic, gemini..." required
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Nombre variable de entorno *</label>
              <input value={addForm.key_name} onChange={e => setAddForm(f => ({ ...f, key_name: e.target.value }))} placeholder="XAI_API_KEY, REPLICATE_API_TOKEN..." required
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Valor de la API Key *</label>
              <input value={addForm.key_value} onChange={e => setAddForm(f => ({ ...f, key_value: e.target.value }))} type="password" placeholder="sk-... / Bearer token / etc." required
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Categoría</label>
              <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13 }}>
                {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Descripción (opcional)</label>
              <input value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="Para qué se usa esta key..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowAdd(false)} style={{ padding: "9px 18px", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, color: "var(--t3)", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ padding: "9px 20px", background: "var(--jade)", border: "none", borderRadius: 8, color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />} Guardar y activar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={() => setFilterCat("all")} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid var(--ink4)", background: filterCat === "all" ? "var(--gold)" : "var(--ink2)", color: filterCat === "all" ? "#000" : "var(--t3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          Todas ({keys.length})
        </button>
        {categories.map(cat => {
          const meta = CATEGORY_META[cat] || { label: cat, color: "#888", icon: "🔑" };
          const count = keys.filter(k => k.category === cat).length;
          return (
            <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${filterCat === cat ? meta.color : "var(--ink4)"}`, background: filterCat === cat ? `${meta.color}20` : "var(--ink2)", color: filterCat === cat ? meta.color : "var(--t3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {meta.icon} {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Keys by category */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}><Loader2 size={28} style={{ animation: "spin 0.8s linear infinite" }} /></div>
      ) : (
        Object.entries(byCategory).filter(([, v]) => v.length > 0).map(([cat, catKeys]) => {
          const meta = CATEGORY_META[cat] || { label: cat, color: "#888", icon: "🔑" };
          const expanded = expandedCats[cat] !== false;
          return (
            <div key={cat} style={{ marginBottom: 20 }}>
              <button onClick={() => setExpandedCats(p => ({ ...p, [cat]: !p[cat] }))} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "8px 0", width: "100%" }}>
                {expanded ? <ChevronDown size={14} style={{ color: "var(--t3)" }} /> : <ChevronRight size={14} style={{ color: "var(--t3)" }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: 1 }}>{meta.icon} {meta.label}</span>
                <span style={{ fontSize: 11, color: "var(--t3)" }}>({catKeys.length})</span>
                <div style={{ flex: 1, height: 1, background: "var(--ink3)", marginLeft: 8 }} />
              </button>
              {expanded && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {catKeys.map(key => (
                    <div key={`${key.provider}:${key.key_name}`} style={{
                      background: "var(--ink2)", border: `1px solid ${key.source === "missing" ? "rgba(248,113,113,0.25)" : key.last_test_ok ? "rgba(74,222,128,0.2)" : "var(--ink3)"}`,
                      borderRadius: 10, padding: "14px 16px",
                      borderLeft: `3px solid ${key.source === "missing" ? "#f87171" : meta.color}`,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 20 }}>{key.icon}</span>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, color: "var(--t)", fontSize: 14 }}>{key.label}</span>
                            <SourceBadge source={key.source} />
                            <StatusDot ok={key.last_test_ok} loading={testing === key.id} />
                            {key.last_test_ok === false && <span style={{ fontSize: 10, color: "#f87171" }}>{key.last_test_error?.slice(0, 60)}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>
                            <code style={{ color: "#4ade80", background: "rgba(0,201,183,0.08)", padding: "1px 5px", borderRadius: 4 }}>{key.key_name}</code>
                            {" · "}{key.description}
                          </div>
                          {/* Masked value or edit */}
                          {editId === key.id ? (
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <input type="password" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Nueva API key..."
                                style={{ flex: 1, padding: "7px 10px", borderRadius: 7, background: "var(--ink3)", border: "1px solid var(--jade)", color: "var(--t)", fontSize: 12 }} />
                              <button onClick={() => saveEdit(key)} disabled={saving} style={{ padding: "7px 14px", background: "var(--jade)", border: "none", borderRadius: 7, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                              <button onClick={() => { setEditId(null); setEditValue(""); }} style={{ padding: "7px 12px", background: "var(--ink3)", border: "none", borderRadius: 7, color: "var(--t3)", fontSize: 12, cursor: "pointer" }}>✕</button>
                            </div>
                          ) : key.masked_value ? (
                            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, fontFamily: "monospace" }}>
                              {showValue[key.key_name] ? "••••••••" : key.masked_value}
                            </div>
                          ) : (
                            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#f87171" }}>
                              <AlertTriangle size={12} /> Sin configurar — haz clic en Editar para añadirla
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                          {key.docs && (
                            <a href={key.docs} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 10px", borderRadius: 7, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t3)", fontSize: 11, textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                              <ExternalLink size={11} /> Docs
                            </a>
                          )}
                          <button onClick={() => { setEditId(key.id); setEditValue(""); }} style={{ padding: "6px 12px", borderRadius: 7, background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.3)", color: "var(--gold)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                            <Key size={11} /> {key.source === "missing" ? "Añadir" : "Editar"}
                          </button>
                          {key.id && (
                            <>
                              <button onClick={() => testKey(key.id!)} disabled={testing === key.id} style={{ padding: "6px 12px", borderRadius: 7, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                {testing === key.id ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} /> : <TestTube size={11} />} Test
                              </button>
                              <button onClick={() => deleteKey(key.id!)} disabled={deleting === key.id} style={{ padding: "6px 10px", borderRadius: 7, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171", fontSize: 11, cursor: "pointer" }}>
                                {deleting === key.id ? <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite" }} /> : <Trash2 size={11} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Last test time */}
                      {key.last_tested_at && (
                        <div style={{ marginTop: 8, fontSize: 10, color: "var(--t3)", borderTop: "1px solid var(--ink3)", paddingTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                          {key.last_test_ok ? <CheckCircle size={11} color="#4ade80" /> : <XCircle size={11} color="#f87171" />}
                          Último test: {new Date(key.last_tested_at).toLocaleString("es-ES")}
                          {key.last_test_error && !key.last_test_ok && <span style={{ color: "#f87171" }}>— {key.last_test_error}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Billing Provider Config ─────────────────────────────────────────── */}
      <div style={{ marginTop: 32, background: "var(--ink2)", borderRadius: 14, border: "1px solid var(--ink3)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ink3)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>💳</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t)" }}>Configuración de Cobro a Clientes</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>Elige cómo cobrar las suscripciones y servicios a tus clientes</div>
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {([
              {
                id: "shopify" as const,
                icon: "🛍️",
                title: "Shopify Billing",
                desc: "Usa la API de facturación nativa de Shopify. Cargos recurrentes, planes de aplicación, períodos de prueba integrados. Ideal si tus clientes ya tienen tienda Shopify.",
                pros: ["✅ Integración nativa con Shopify", "✅ Gestión automática de planes", "✅ Facturación en dashboards de Shopify"],
                color: "#96bf48",
              },
              {
                id: "stripe" as const,
                icon: "💳",
                title: "Stripe",
                desc: "Pagos directos via Stripe. Soporta tarjetas, SEPA, transferencias. Funciona con clientes Shopify y no-Shopify. Máxima flexibilidad.",
                pros: ["✅ Funciona con cualquier cliente", "✅ Múltiples métodos de pago", "✅ Panel Stripe completo"],
                color: "#635bff",
              },
            ] as const).map(opt => {
              const active = billingProvider === opt.id;
              return (
                <div key={opt.id}
                  onClick={() => !savingBilling && saveBillingProvider(opt.id)}
                  style={{
                    padding: 16, borderRadius: 12, cursor: savingBilling ? "wait" : "pointer",
                    border: active ? `2px solid ${opt.color}` : "2px solid var(--ink3)",
                    background: active ? `color-mix(in srgb, ${opt.color} 8%, transparent)` : "var(--ink3)",
                    transition: "all .2s", position: "relative",
                  }}
                >
                  {active && (
                    <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, fontWeight: 800, color: opt.color, padding: "2px 8px", borderRadius: 20, background: `color-mix(in srgb, ${opt.color} 15%, transparent)` }}>
                      ACTIVO
                    </div>
                  )}
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{opt.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? opt.color : "var(--t)", marginBottom: 6 }}>{opt.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10, lineHeight: 1.5 }}>{opt.desc}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {opt.pros.map((p, i) => (
                      <div key={i} style={{ fontSize: 10, color: active ? opt.color : "var(--t3)" }}>{p}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", padding: "10px 14px", borderRadius: 8, background: "var(--ink3)", display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={14} />
            El método elegido se aplica a los nuevos clientes. Los clientes existentes mantienen su método de facturación actual hasta que renuevan.
            {savingBilling && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite", marginLeft: "auto" }} />}
          </div>
        </div>
      </div>
    </div>
  );
}
