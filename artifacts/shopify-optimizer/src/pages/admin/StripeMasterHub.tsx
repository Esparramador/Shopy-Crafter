/**
 * StripeMasterHub.tsx — God Mode: Panel de Control Maestro de Stripe
 * ─────────────────────────────────────────────────────────────────────────────
 * Vista exclusiva para el Super-Admin / Agencia.
 * Muestra todos los clientes, su modo Stripe y permite:
 *   · Crear cuenta Connect Custom (Account Factory)
 *   · Asignar clave API directa (The Vault)
 *   · Ver balance en tiempo real
 *   · Rotar claves
 *   · Desvincular cuentas
 */

import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function api(path: string, opts?: RequestInit) {
  return fetch(`${API}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
}

// ── Types ────────────────────────────────────────────────────────────────────
type StripeMode = "direct" | "connect_custom" | "connect_oauth" | "none";

interface ProjectRow {
  id: number;
  name: string;
  platform_type: string;
  shop_domain: string | null;
  plan: string | null;
  account_id: string | null;
  account_type: string | null;
  stripe_display_name: string | null;
  stripe_email: string | null;
  stripe_country: string | null;
  stripe_currency: string | null;
  onboarding_complete: boolean | null;
  connected_at: string | null;
  stripe_mode: StripeMode;
  key_preview: string | null;
}

interface BalanceData {
  available: number;
  pending: number;
  currency: string;
  mode: StripeMode;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(cents: number, currency = "eur") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2,
  }).format(cents / 100);
}

function ModeBadge({ mode }: { mode: StripeMode }) {
  const conf: Record<StripeMode, { label: string; color: string; bg: string }> = {
    direct:         { label: "🔑 Clave directa",    color: "#c8a84b", bg: "rgba(200,168,75,.12)" },
    connect_custom: { label: "🏭 Connect Custom",   color: "#2dd49f", bg: "rgba(45,212,159,.12)" },
    connect_oauth:  { label: "🔗 Connect OAuth",    color: "#60a5fa", bg: "rgba(96,165,250,.12)" },
    none:           { label: "⚠ Sin configurar",    color: "#f87171", bg: "rgba(248,113,113,.10)" },
  };
  const c = conf[mode];
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: ".3px",
      color: c.color, background: c.bg, border: `1px solid ${c.color}33`,
      whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

function PlatformBadge({ type }: { type: string }) {
  const icons: Record<string, string> = {
    shopify: "🛍", woocommerce: "🟣", prestashop: "🔵", magento: "🟠", other: "🌐",
  };
  return <span style={{ fontSize: 13 }}>{icons[type?.toLowerCase()] ?? "🌐"} {type ?? "—"}</span>;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
.smh-root { padding: 28px 32px; max-width: 1320px; margin: 0 auto; color: #f0ede6; font-family: Inter, sans-serif; }
.smh-hdr { display: flex; align-items: center; gap: 14px; margin-bottom: 6px; }
.smh-title { font-size: 22px; font-weight: 800; margin: 0; }
.smh-sub { font-size: 12.5px; color: rgba(240,237,230,.45); margin: 0 0 24px; }
.smh-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
.smh-stat { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 16px 20px; }
.smh-stat-val { font-size: 26px; font-weight: 800; color: #c8a84b; line-height: 1; }
.smh-stat-lbl { font-size: 11px; color: rgba(240,237,230,.45); margin-top: 4px; text-transform: uppercase; letter-spacing: .6px; }
.smh-table-wrap { overflow-x: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,.08); }
table.smh-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.smh-table th { text-align: left; padding: 11px 14px; background: rgba(255,255,255,.04); color: rgba(240,237,230,.5); font-size: 10px; text-transform: uppercase; letter-spacing: .7px; border-bottom: 1px solid rgba(255,255,255,.07); white-space: nowrap; }
.smh-table td { padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,.05); vertical-align: middle; }
.smh-table tr:last-child td { border-bottom: none; }
.smh-table tr:hover td { background: rgba(255,255,255,.025); }
.smh-btn { padding: 6px 13px; border-radius: 7px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit; transition: opacity .15s; line-height: 1; }
.smh-btn-gold { background: linear-gradient(135deg,#c8a84b,#e8c96a); color: #0f0f0f; }
.smh-btn-ghost { background: rgba(255,255,255,.06); color: #f0ede6; border: 1px solid rgba(255,255,255,.12); }
.smh-btn-green { background: rgba(45,212,159,.12); color: #2dd49f; border: 1px solid rgba(45,212,159,.22); }
.smh-btn-red { background: rgba(248,113,113,.10); color: #f87171; border: 1px solid rgba(248,113,113,.2); }
.smh-btn-sm { padding: 4px 10px; font-size: 11px; }
.smh-btn:disabled { opacity: .4; cursor: default; }
.smh-actions-row { display: flex; gap: 6px; flex-wrap: wrap; }
.smh-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.smh-modal { background: #0f0f1a; border: 1px solid rgba(200,168,75,.22); border-radius: 16px; padding: 28px; width: 100%; max-width: 480px; }
.smh-modal-title { font-size: 17px; font-weight: 800; margin: 0 0 4px; }
.smh-modal-sub { font-size: 12px; color: rgba(240,237,230,.45); margin: 0 0 22px; }
.smh-field { margin-bottom: 16px; }
.smh-label { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: rgba(200,168,75,.8); margin-bottom: 6px; }
.smh-input { width: 100%; padding: 10px 13px; background: rgba(255,255,255,.04); border: 1px solid rgba(200,168,75,.18); border-radius: 9px; color: #eee; font-size: 13px; outline: none; box-sizing: border-box; font-family: monospace; }
.smh-input:focus { border-color: rgba(200,168,75,.45); box-shadow: 0 0 0 3px rgba(200,168,75,.07); }
.smh-note { padding: 10px 13px; background: rgba(200,168,75,.05); border: 1px solid rgba(200,168,75,.15); border-radius: 8px; font-size: 11.5px; color: rgba(240,237,230,.55); line-height: 1.6; }
.smh-modal-footer { display: flex; gap: 10px; margin-top: 22px; justify-content: flex-end; }
.smh-balance-row { display: flex; gap: 10px; align-items: center; white-space: nowrap; }
.smh-empty { text-align: center; padding: 60px 20px; color: rgba(240,237,230,.3); font-size: 14px; }
@media (max-width: 768px) {
  .smh-root { padding: 16px; }
  .smh-stats { grid-template-columns: repeat(2, 1fr); }
}
`;

// ── Modal: Asignar clave directa (The Vault) ──────────────────────────────────
function VaultModal({ project, onClose, onDone }: {
  project: ProjectRow; onClose: () => void; onDone: () => void;
}) {
  const [sk, setSk] = useState("");
  const [pk, setPk] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!sk.startsWith("sk_")) { setMsg("❌ La clave debe empezar por sk_test_ o sk_live_"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await api("/admin/stripe/assign-key", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, secretKey: sk, publishableKey: pk || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg(`✅ Clave guardada en el Vault — ${d.displayName}`);
      setTimeout(() => { onDone(); onClose(); }, 1400);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="smh-modal-bg" onClick={onClose}>
      <div className="smh-modal" onClick={e => e.stopPropagation()}>
        <div className="smh-modal-title">🔑 The Vault — Asignar clave API</div>
        <div className="smh-modal-sub">Proyecto: <strong>{project.name}</strong></div>

        <div className="smh-field">
          <label className="smh-label">Secret Key (sk_live_ o sk_test_) *</label>
          <input className="smh-input" type="password" placeholder="sk_live_••••••••" value={sk} onChange={e => setSk(e.target.value)} />
        </div>
        <div className="smh-field">
          <label className="smh-label">Publishable Key (opcional)</label>
          <input className="smh-input" type="text" placeholder="pk_live_••••••••" value={pk} onChange={e => setPk(e.target.value)} />
        </div>
        <div className="smh-note">
          🔒 La clave se encripta con AES-256-GCM antes de guardarse. Nunca se almacena en texto plano. Solo el servidor con el ENCRYPTION_KEY puede desencriptarla.
        </div>
        {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.startsWith("✅") ? "#2dd49f" : "#f87171" }}>{msg}</div>}
        <div className="smh-modal-footer">
          <button className="smh-btn smh-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="smh-btn smh-btn-gold" onClick={submit} disabled={busy || !sk}>
            {busy ? "Guardando…" : "Guardar en el Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Account Factory ────────────────────────────────────────────────────
function FactoryModal({ project, onClose, onDone }: {
  project: ProjectRow; onClose: () => void; onDone: () => void;
}) {
  const [form, setForm] = useState({ email: "", country: "ES", businessType: "individual", displayName: project.name });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [accountId, setAccountId] = useState("");

  const F = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api("/admin/stripe/create-account", {
        method: "POST",
        body: JSON.stringify({ projectId: project.id, ...form }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAccountId(d.accountId);
      setMsg(`✅ Cuenta creada: ${d.accountId}`);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const getOnboardingLink = async () => {
    if (!accountId) return;
    setBusy(true);
    try {
      const r = await api("/admin/stripe/onboarding-link", {
        method: "POST",
        body: JSON.stringify({ accountId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      window.open(d.url, "_blank");
      onDone(); onClose();
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="smh-modal-bg" onClick={onClose}>
      <div className="smh-modal" onClick={e => e.stopPropagation()}>
        <div className="smh-modal-title">🏭 Account Factory — Connect Custom</div>
        <div className="smh-modal-sub">Crear sub-cuenta desde cero para: <strong>{project.name}</strong></div>

        {!accountId ? (<>
          <div className="smh-field">
            <label className="smh-label">Nombre para mostrar</label>
            <input className="smh-input" style={{ fontFamily: "inherit" }} value={form.displayName} onChange={F("displayName")} />
          </div>
          <div className="smh-field">
            <label className="smh-label">Email (opcional)</label>
            <input className="smh-input" style={{ fontFamily: "inherit" }} type="email" placeholder="cliente@empresa.com" value={form.email} onChange={F("email")} />
          </div>
          <div className="smh-field">
            <label className="smh-label">País</label>
            <select className="smh-input" style={{ fontFamily: "inherit", cursor: "pointer" }} value={form.country} onChange={F("country")}>
              {["ES","FR","DE","IT","PT","NL","BE","GB","US","MX","AR","CO"].map(c =>
                <option key={c} value={c}>{c}</option>
              )}
            </select>
          </div>
          <div className="smh-field">
            <label className="smh-label">Tipo de negocio</label>
            <select className="smh-input" style={{ fontFamily: "inherit", cursor: "pointer" }} value={form.businessType} onChange={F("businessType")}>
              <option value="individual">Individual / Autónomo</option>
              <option value="company">Empresa (SL / SA)</option>
            </select>
          </div>
          <div className="smh-note">
            🔐 La cuenta se crea como <strong>Custom</strong> — tú tienes control total, el cliente no sabe que usa Stripe. Capabilities: card_payments + transfers.
          </div>
          {msg && <div style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>{msg}</div>}
          <div className="smh-modal-footer">
            <button className="smh-btn smh-btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="smh-btn smh-btn-gold" onClick={create} disabled={busy}>
              {busy ? "Creando…" : "Crear en Stripe"}
            </button>
          </div>
        </>) : (<>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, color: "#2dd49f", marginBottom: 6 }}>Cuenta creada</div>
            <code style={{ fontSize: 12, color: "#c8a84b", background: "rgba(200,168,75,.08)", padding: "4px 10px", borderRadius: 6 }}>{accountId}</code>
            <p style={{ fontSize: 12, color: "rgba(240,237,230,.5)", marginTop: 12 }}>
              Ahora necesitas enviar al cliente el link de onboarding para completar la verificación KYC.
            </p>
          </div>
          <div className="smh-modal-footer">
            <button className="smh-btn smh-btn-ghost" onClick={onClose}>Cerrar</button>
            <button className="smh-btn smh-btn-green" onClick={getOnboardingLink} disabled={busy}>
              {busy ? "Generando…" : "📋 Abrir link onboarding"}
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Modal: Balance ────────────────────────────────────────────────────────────
function BalanceModal({ project, onClose }: { project: ProjectRow; onClose: () => void }) {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/admin/stripe/balance/${project.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setBalance(d);
      })
      .catch(() => setError("Error de red"));
  }, [project.id]);

  return (
    <div className="smh-modal-bg" onClick={onClose}>
      <div className="smh-modal" onClick={e => e.stopPropagation()}>
        <div className="smh-modal-title">💰 Balance — {project.name}</div>
        <ModeBadge mode={project.stripe_mode} />
        <div style={{ marginTop: 20 }}>
          {!balance && !error && <div style={{ color: "rgba(240,237,230,.4)", textAlign: "center", padding: 30 }}>Consultando Stripe…</div>}
          {error && <div style={{ color: "#f87171", fontSize: 13 }}>❌ {error}</div>}
          {balance && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="smh-stat">
                <div className="smh-stat-val">{fmtMoney(balance.available, balance.currency)}</div>
                <div className="smh-stat-lbl">Disponible</div>
              </div>
              <div className="smh-stat">
                <div className="smh-stat-val" style={{ color: "#60a5fa" }}>{fmtMoney(balance.pending, balance.currency)}</div>
                <div className="smh-stat-lbl">En tránsito</div>
              </div>
            </div>
          )}
        </div>
        <div className="smh-modal-footer">
          <button className="smh-btn smh-btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StripeMasterHub() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: "vault" | "factory" | "balance"; project: ProjectRow } | null>(null);
  const [filter, setFilter] = useState<StripeMode | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api("/admin/stripe/master-overview");
      const d = await r.json();
      setProjects(d.projects ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const detach = async (p: ProjectRow) => {
    if (!confirm(`¿Desvincular cuenta Stripe de "${p.name}"?`)) return;
    await api(`/admin/stripe/accounts/${p.id}`, { method: "DELETE" });
    load();
  };

  const filtered = filter === "all" ? projects : projects.filter(p => p.stripe_mode === filter);

  const stats = {
    total: projects.length,
    direct: projects.filter(p => p.stripe_mode === "direct").length,
    custom: projects.filter(p => p.stripe_mode === "connect_custom").length,
    oauth: projects.filter(p => p.stripe_mode === "connect_oauth").length,
    none: projects.filter(p => p.stripe_mode === "none").length,
  };

  return (
    <div className="smh-root">
      <style>{CSS}</style>

      <div className="smh-hdr">
        <span style={{ fontSize: 28 }}>⚡</span>
        <div>
          <h1 className="smh-title">Stripe Master Hub — God Mode</h1>
        </div>
      </div>
      <p className="smh-sub">Control absoluto de la infraestructura de pagos de todos tus clientes · Vault + Account Factory</p>

      {/* Stats */}
      <div className="smh-stats">
        {[
          { val: stats.total,  lbl: "Total proyectos", color: "#c8a84b" },
          { val: stats.direct, lbl: "🔑 Clave directa",  color: "#c8a84b" },
          { val: stats.custom, lbl: "🏭 Connect Custom", color: "#2dd49f" },
          { val: stats.oauth,  lbl: "🔗 Connect OAuth",  color: "#60a5fa" },
          { val: stats.none,   lbl: "⚠ Sin Stripe",     color: "#f87171" },
        ].map(s => (
          <div key={s.lbl} className="smh-stat" style={{ cursor: "pointer" }}
            onClick={() => setFilter(
              s.lbl === "Total proyectos" ? "all" :
              s.lbl.includes("directa") ? "direct" :
              s.lbl.includes("Custom") ? "connect_custom" :
              s.lbl.includes("OAuth")  ? "connect_oauth"  : "none"
            )}
          >
            <div className="smh-stat-val" style={{ color: s.color }}>{s.val}</div>
            <div className="smh-stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all","direct","connect_custom","connect_oauth","none"] as const).map(f => (
          <button key={f} className={`smh-btn ${filter === f ? "smh-btn-gold" : "smh-btn-ghost"} smh-btn-sm`}
            onClick={() => setFilter(f)}>
            {f === "all" ? "Todos" : f === "direct" ? "🔑 Directa" : f === "connect_custom" ? "🏭 Custom" : f === "connect_oauth" ? "🔗 OAuth" : "⚠ Sin Stripe"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="smh-empty">Cargando proyectos…</div>
      ) : filtered.length === 0 ? (
        <div className="smh-empty">No hay proyectos con este filtro.</div>
      ) : (
        <div className="smh-table-wrap">
          <table className="smh-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>CMS</th>
                <th>Plan</th>
                <th>Modo Stripe</th>
                <th>Cuenta / Info</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</div>
                    {p.shop_domain && <div style={{ fontSize: 11, color: "rgba(240,237,230,.4)", marginTop: 2 }}>{p.shop_domain}</div>}
                  </td>
                  <td><PlatformBadge type={p.platform_type} /></td>
                  <td>
                    <span style={{ fontSize: 11, background: "rgba(200,168,75,.08)", color: "#c8a84b", padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(200,168,75,.2)" }}>
                      {p.plan ?? "—"}
                    </span>
                  </td>
                  <td><ModeBadge mode={p.stripe_mode} /></td>
                  <td style={{ maxWidth: 200 }}>
                    {p.stripe_display_name && <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.stripe_display_name}</div>}
                    {p.stripe_email && <div style={{ fontSize: 11, color: "rgba(240,237,230,.45)" }}>{p.stripe_email}</div>}
                    {p.account_id && <div style={{ fontSize: 10, color: "rgba(240,237,230,.3)", fontFamily: "monospace", marginTop: 2 }}>{p.account_id.slice(0, 26)}…</div>}
                    {p.key_preview && <div style={{ fontSize: 10, color: "#c8a84b", fontFamily: "monospace", marginTop: 2 }}>{p.key_preview}</div>}
                  </td>
                  <td>
                    <div className="smh-actions-row">
                      <button className="smh-btn smh-btn-gold smh-btn-sm"
                        onClick={() => setModal({ type: "vault", project: p })}
                        title="Asignar clave API directa">🔑 Vault</button>
                      <button className="smh-btn smh-btn-green smh-btn-sm"
                        onClick={() => setModal({ type: "factory", project: p })}
                        title="Crear cuenta Connect Custom">🏭 Factory</button>
                      {p.stripe_mode !== "none" && (
                        <button className="smh-btn smh-btn-ghost smh-btn-sm"
                          onClick={() => setModal({ type: "balance", project: p })}
                          title="Ver balance">💰</button>
                      )}
                      {p.stripe_mode !== "none" && (
                        <button className="smh-btn smh-btn-red smh-btn-sm"
                          onClick={() => detach(p)}
                          title="Desvincular">✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "vault" && (
        <VaultModal project={modal.project} onClose={() => setModal(null)} onDone={load} />
      )}
      {modal?.type === "factory" && (
        <FactoryModal project={modal.project} onClose={() => setModal(null)} onDone={load} />
      )}
      {modal?.type === "balance" && (
        <BalanceModal project={modal.project} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
