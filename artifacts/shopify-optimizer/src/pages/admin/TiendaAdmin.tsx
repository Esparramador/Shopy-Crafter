import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Tab = "shopify" | "planes" | "servicios";

interface ShopifySettings {
  shopify_domain?: string;
  storefront_access_token?: string;
  admin_api_key?: string;
  admin_api_secret?: string;
  checkout_url_prefix?: string;
  store_name?: string;
  currency?: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  priceAnnual?: number;
  price_annual?: number;
  currency?: string;
  period?: string;
  featured?: boolean;
  badge?: string;
  features?: { text: string; included: boolean }[] | string;
  ctaLabel?: string;
  cta_label?: string;
  ctaStyle?: string;
  cta_style?: string;
  ctaHref?: string;
  cta_href?: string;
  storesLimit?: number;
  stores_limit?: number;
  imagesIncluded?: number;
  images_included?: number;
  shopify_checkout_url?: string;
}

interface PlanForm {
  id: string;
  name: string;
  price: number;
  priceAnnual: number;
  currency: string;
  period: string;
  featured: boolean;
  badge: string;
  featuresText: string;
  ctaLabel: string;
  ctaStyle: string;
  ctaHref: string;
  storesLimit: number;
  imagesIncluded: number;
  shopify_checkout_url: string;
}

const BLANK_PLAN: PlanForm = {
  id: "", name: "", price: 0, priceAnnual: 0, currency: "€", period: "/mes",
  featured: false, badge: "", featuresText: "", ctaLabel: "Contactar →",
  ctaStyle: "ghost", ctaHref: "#fp-contact", storesLimit: 1,
  imagesIncluded: 10, shopify_checkout_url: "",
};

interface TiendaService {
  id?: number;
  name: string;
  description?: string;
  short_desc?: string;
  icon?: string;
  price_display?: string;
  features?: string[];
  cta_label?: string;
  cta_url?: string;
  badge?: string;
  color_accent?: string;
  sort_order?: number;
  visible?: boolean;
}

const BLANK_SVC: TiendaService = {
  name: "", description: "", short_desc: "", icon: "⚡",
  price_display: "", features: [], cta_label: "Solicitar →",
  cta_url: "", badge: "", color_accent: "gold", sort_order: 0, visible: true,
};

function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const show = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  }, []);
  return { toast, show };
}

// ── Shopify Config Tab ────────────────────────────────────────────────────────
function ShopifyTab({ show }: { show: (msg: string, ok?: boolean) => void }) {
  const [cfg, setCfg] = useState<ShopifySettings>({});
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  useEffect(() => {
    apiFetch("/tienda/settings")
      .then(r => r.ok ? r.json() : {})
      .then(d => setCfg(d))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await apiFetch("/tienda/settings", { method: "PUT", body: JSON.stringify(cfg) });
      if (r.ok) show("✅ Configuración guardada");
      else show("❌ Error al guardar", false);
    } catch { show("❌ Error de red", false); }
    setSaving(false);
  };

  const set = (k: keyof ShopifySettings, v: string) => setCfg(c => ({ ...c, [k]: v }));
  const toggleReveal = (k: string) => setReveal(r => ({ ...r, [k]: !r[k] }));

  return (
    <div className="ta-section">
      <div className="ta-section-header">
        <h2>🛍️ Configuración de tu Tienda Shopify</h2>
        <p>Conecta tu tienda Shopify para procesar pagos y vincular los planes con productos reales.</p>
      </div>

      <div className="ta-card">
        <div className="ta-info-banner">
          <span>ℹ️</span>
          <div>
            <strong>¿Cómo funciona?</strong> Configura las credenciales de tu tienda Shopify.
            Las URLs de checkout de cada plan se configuran en la pestaña <strong>Planes</strong>.
            Los clientes serán redirigidos a tu Shopify para pagar de forma segura.
          </div>
        </div>

        <div className="ta-form-grid">
          <div className="ta-field ta-full">
            <label>Nombre de la tienda</label>
            <input value={cfg.store_name ?? ""} onChange={e => set("store_name", e.target.value)}
              placeholder="Shopy Crafter" className="ta-input" />
          </div>
          <div className="ta-field ta-full">
            <label>Dominio Shopify</label>
            <input value={cfg.shopify_domain ?? ""} onChange={e => set("shopify_domain", e.target.value)}
              placeholder="tutienda.myshopify.com" className="ta-input" />
            <span className="ta-hint">Solo el dominio, sin https://</span>
          </div>
          <div className="ta-field ta-full">
            <label>Checkout URL Base (opcional)</label>
            <input value={cfg.checkout_url_prefix ?? ""}
              onChange={e => set("checkout_url_prefix", e.target.value)}
              placeholder="https://tutienda.myshopify.com/cart/" className="ta-input" />
            <span className="ta-hint">URL base para redirigir clientes al checkout</span>
          </div>
          <div className="ta-field ta-full">
            <label>Moneda</label>
            <select value={cfg.currency ?? "EUR"} onChange={e => set("currency", e.target.value)}
              className="ta-input">
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dólar</option>
              <option value="GBP">GBP — Libra</option>
              <option value="MXN">MXN — Peso Mexicano</option>
            </select>
          </div>

          <div className="ta-divider ta-full" />

          {(["storefront_access_token", "admin_api_key", "admin_api_secret"] as const).map(k => {
            const labels: Record<string, string> = {
              storefront_access_token: "Storefront Access Token",
              admin_api_key: "Admin API Key",
              admin_api_secret: "Admin API Secret",
            };
            const hints: Record<string, string> = {
              storefront_access_token: "Para el Storefront API (lectura pública de productos)",
              admin_api_key: "Para el Admin API (gestión avanzada)",
              admin_api_secret: "Secret compartido para webhooks de Shopify",
            };
            return (
              <div className="ta-field ta-full" key={k}>
                <label>{labels[k]}</label>
                <div className="ta-secret-wrap">
                  <input
                    type={reveal[k] ? "text" : "password"}
                    value={(cfg as any)[k] ?? ""}
                    onChange={e => set(k, e.target.value)}
                    placeholder={`••••••••••••••••`}
                    className="ta-input ta-secret-input"
                  />
                  <button className="ta-reveal-btn" onClick={() => toggleReveal(k)}>
                    {reveal[k] ? "🙈" : "👁️"}
                  </button>
                </div>
                <span className="ta-hint">{hints[k]}</span>
              </div>
            );
          })}
        </div>

        <div className="ta-actions">
          <button className="ta-btn-primary" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "💾 Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan Modal ────────────────────────────────────────────────────────────────
function PlanModal({
  plan, onClose, onSave, show,
}: { plan: PlanForm | null; onClose: () => void; onSave: () => void; show: (msg: string, ok?: boolean) => void }) {
  const isNew = !plan?.id || plan.id === "__new__";
  const [form, setForm] = useState<PlanForm>(plan ?? BLANK_PLAN);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof PlanForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  const featuresToPayload = () =>
    form.featuresText.split("\n").map(s => s.trim()).filter(Boolean)
      .map(s => {
        const excluded = s.startsWith("-");
        return { text: excluded ? s.slice(1).trim() : s, included: !excluded };
      });

  const save = async () => {
    if (!form.name.trim()) return;
    if (isNew && !form.id.trim()) return;
    setSaving(true);
    try {
      const payload = {
        id: form.id.trim(),
        name: form.name.trim(),
        price: Number(form.price),
        priceAnnual: Number(form.priceAnnual),
        currency: form.currency || "€",
        period: form.period || "/mes",
        featured: !!form.featured,
        badge: form.badge.trim() || null,
        features: featuresToPayload(),
        ctaLabel: form.ctaLabel || "Contactar →",
        ctaStyle: form.ctaStyle || "ghost",
        ctaHref: form.ctaHref || "#fp-contact",
        storesLimit: Number(form.storesLimit),
        imagesIncluded: Number(form.imagesIncluded),
      };
      let ok = false;
      if (isNew) {
        const r = await apiFetch("/billing/plans", { method: "POST", body: JSON.stringify(payload) });
        ok = r.ok;
      } else {
        const r = await apiFetch(`/billing/plans/${form.id}`, { method: "PUT", body: JSON.stringify(payload) });
        ok = r.ok;
      }
      if (ok && form.shopify_checkout_url !== undefined) {
        await apiFetch(`/tienda/plans/${form.id}/checkout-url`, {
          method: "PUT",
          body: JSON.stringify({ shopify_checkout_url: form.shopify_checkout_url || null }),
        });
      }
      if (ok) { onSave(); onClose(); }
      else show("❌ Error al guardar el plan", false);
    } catch { show("❌ Error de red", false); }
    setSaving(false);
  };

  return (
    <div className="ta-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ta-modal" style={{ maxWidth: 680 }}>
        <div className="ta-modal-header">
          <h3>{isNew ? "➕ Nuevo plan" : `✏️ Editar plan — ${plan?.name}`}</h3>
          <button className="ta-close" onClick={onClose}>✕</button>
        </div>
        <div className="ta-modal-body">
          <div className="ta-form-grid">

            <div className="ta-field ta-half">
              <label>ID único *</label>
              <input value={form.id} onChange={e => set("id", e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                placeholder="emprendedor" className="ta-input" disabled={!isNew} />
              <span className="ta-hint">Solo letras, números y guiones bajos. No editable después.</span>
            </div>
            <div className="ta-field ta-half">
              <label>Nombre visible *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="Emprendedor" className="ta-input" />
            </div>

            <div className="ta-field ta-half">
              <label>Precio mensual (€)</label>
              <input type="number" min={0} value={form.price} onChange={e => set("price", e.target.value)}
                className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>Precio anual (€)</label>
              <input type="number" min={0} value={form.priceAnnual} onChange={e => set("priceAnnual", e.target.value)}
                className="ta-input" />
            </div>

            <div className="ta-field ta-half">
              <label>Moneda</label>
              <select value={form.currency} onChange={e => set("currency", e.target.value)} className="ta-input">
                <option value="€">€ Euro</option>
                <option value="$">$ Dólar</option>
                <option value="£">£ Libra</option>
              </select>
            </div>
            <div className="ta-field ta-half">
              <label>Badge (opcional)</label>
              <input value={form.badge} onChange={e => set("badge", e.target.value)}
                placeholder="Más popular" className="ta-input" />
            </div>

            <div className="ta-field ta-half">
              <label>CTA texto</label>
              <input value={form.ctaLabel} onChange={e => set("ctaLabel", e.target.value)}
                placeholder="Contactar →" className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>CTA estilo</label>
              <select value={form.ctaStyle} onChange={e => set("ctaStyle", e.target.value)} className="ta-input">
                <option value="ghost">Ghost (borde dorado)</option>
                <option value="gold">Gold (fondo dorado)</option>
              </select>
            </div>
            <div className="ta-field ta-full">
              <label>CTA enlace</label>
              <input value={form.ctaHref} onChange={e => set("ctaHref", e.target.value)}
                placeholder="#fp-contact o /client/messages" className="ta-input" />
            </div>

            <div className="ta-field ta-half">
              <label>Límite de tiendas</label>
              <input type="number" min={-1} value={form.storesLimit} onChange={e => set("storesLimit", e.target.value)}
                className="ta-input" />
              <span className="ta-hint">-1 = ilimitado</span>
            </div>
            <div className="ta-field ta-half">
              <label>Imágenes IA incluidas</label>
              <input type="number" min={-1} value={form.imagesIncluded} onChange={e => set("imagesIncluded", e.target.value)}
                className="ta-input" />
              <span className="ta-hint">-1 = ilimitado</span>
            </div>

            <div className="ta-field ta-full">
              <label>URL Checkout Shopify</label>
              <input value={form.shopify_checkout_url} onChange={e => set("shopify_checkout_url", e.target.value)}
                placeholder="https://tutienda.myshopify.com/cart/12345:1" className="ta-input" />
              <span className="ta-hint">Redirige al cliente a Shopify para pagar</span>
            </div>

            <div className="ta-field ta-full">
              <label>Características (una por línea · prefija con - para excluida)</label>
              <textarea value={form.featuresText} onChange={e => set("featuresText", e.target.value)}
                placeholder={"5 productos/mes\n10 imágenes IA/mes\nSEO básico\n- A/B Testing"}
                className="ta-input ta-textarea" rows={7} />
              <span className="ta-hint">Líneas sin guión = incluidas ✓ · Con guión = excluidas ✕</span>
            </div>

            <div className="ta-field ta-full ta-visible-row">
              <label className="ta-check-label">
                <input type="checkbox" checked={form.featured} onChange={e => set("featured", e.target.checked)} />
                Plan destacado (aparece como "Más popular" con borde dorado)
              </label>
            </div>
          </div>
        </div>
        <div className="ta-modal-footer">
          <button className="ta-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="ta-btn-primary" onClick={save}
            disabled={saving || !form.name.trim() || (isNew && !form.id.trim())}>
            {saving ? "Guardando…" : (isNew ? "➕ Crear plan" : "💾 Guardar cambios")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Planes Tab ────────────────────────────────────────────────────────────────
function PlanesTab({ show }: { show: (msg: string, ok?: boolean) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modal, setModal] = useState<PlanForm | null | "new">(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const normFeats = (raw: any): string => {
    if (!raw) return "";
    const arr: { text: string; included: boolean }[] = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return "";
    return arr.map(f => (f.included !== false ? f.text : `- ${f.text}`)).join("\n");
  };

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/billing/plans")
      .then(r => r.ok ? r.json() : [])
      .then((d: Plan[]) => { setPlans(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (p: Plan) => {
    const pf: PlanForm = {
      id: String(p.id),
      name: p.name,
      price: p.price,
      priceAnnual: Number(p.priceAnnual ?? p.price_annual ?? p.price * 10),
      currency: p.currency ?? "€",
      period: p.period ?? "/mes",
      featured: !!p.featured,
      badge: p.badge ?? "",
      featuresText: normFeats(p.features),
      ctaLabel: p.ctaLabel ?? p.cta_label ?? "Contactar →",
      ctaStyle: p.ctaStyle ?? p.cta_style ?? "ghost",
      ctaHref: p.ctaHref ?? p.cta_href ?? "#fp-contact",
      storesLimit: Number(p.storesLimit ?? p.stores_limit ?? 1),
      imagesIncluded: Number(p.imagesIncluded ?? p.images_included ?? 10),
      shopify_checkout_url: p.shopify_checkout_url ?? "",
    };
    setModal(pf);
  };

  const del = async (planId: string, name: string) => {
    if (!confirm(`¿Ocultar el plan "${name}"? Dejará de aparecer en la tienda pero no se elimina de la base de datos.`)) return;
    setDeleting(planId);
    try {
      const r = await apiFetch(`/billing/plans/${planId}`, { method: "DELETE" });
      if (r.ok) { show(`🗑️ Plan "${name}" ocultado`); load(); }
      else show("❌ Error al ocultar el plan", false);
    } catch { show("❌ Error de red", false); }
    setDeleting(null);
  };

  return (
    <div className="ta-section">
      <div className="ta-section-header">
        <h2>📦 Planes de suscripción</h2>
        <p>Crea, edita u oculta los planes que aparecen en la <strong>landing</strong> (sección Precios) y en la <strong>tienda del cliente</strong>.</p>
        <button className="ta-btn-primary ta-btn-sm" onClick={() => setModal("new")}>
          ➕ Crear plan
        </button>
      </div>

      <div className="ta-info-banner">
        <span>💡</span>
        <div>
          Los planes activos se publican automáticamente en la landing y en el panel del cliente.
          Asigna una <strong>URL de checkout Shopify</strong> para activar el botón de pago directo.
        </div>
      </div>

      {loading ? (
        <div className="ta-empty">Cargando planes…</div>
      ) : (
        <div className="ta-plans-list">
          {plans.map(plan => (
            <div key={plan.id} className={`ta-plan-row${plan.featured ? " ta-plan-featured" : ""}`}>
              <div className="ta-plan-info">
                <div className="ta-plan-name">
                  {plan.featured && <span className="ta-feat-badge">★ DESTACADO</span>}
                  {plan.name}
                  <span className="ta-plan-id">#{plan.id}</span>
                </div>
                <div className="ta-plan-price">
                  {plan.currency ?? "€"}{plan.price}/mes · {plan.currency ?? "€"}{plan.priceAnnual ?? plan.price_annual ?? plan.price * 10}/año
                  {plan.shopify_checkout_url && <span className="ta-shopify-pill">🛍️ Shopify</span>}
                </div>
              </div>
              <div className="ta-svc-actions">
                <button className="ta-btn-edit" onClick={() => openEdit(plan)}>✏️ Editar</button>
                <button
                  className="ta-btn-del"
                  onClick={() => del(String(plan.id), plan.name)}
                  disabled={deleting === String(plan.id)}
                  title="Ocultar plan (soft delete)"
                >
                  {deleting === String(plan.id) ? "…" : "🗑️"}
                </button>
              </div>
            </div>
          ))}
          {plans.length === 0 && (
            <div className="ta-empty">No hay planes visibles. Crea el primero con "➕ Crear plan".</div>
          )}
        </div>
      )}

      {modal !== null && (
        <PlanModal
          plan={modal === "new" ? null : (modal as PlanForm)}
          onClose={() => setModal(null)}
          onSave={() => { load(); show("✅ Plan guardado correctamente"); }}
          show={show}
        />
      )}
    </div>
  );
}

// ── Service Form Modal ────────────────────────────────────────────────────────
function ServiceModal({
  svc, onClose, onSave,
}: { svc: TiendaService | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState<TiendaService>(svc ?? BLANK_SVC);
  const [saving, setSaving] = useState(false);
  const [featText, setFeatText] = useState((svc?.features ?? []).join("\n"));

  const set = (k: keyof TiendaService, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, features: featText.split("\n").map(s => s.trim()).filter(Boolean) };
    try {
      const url = form.id ? `/tienda/services/${form.id}` : "/tienda/services";
      const method = form.id ? "PUT" : "POST";
      await apiFetch(url, { method, body: JSON.stringify(payload) });
      onSave();
      onClose();
    } catch { }
    setSaving(false);
  };

  return (
    <div className="ta-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ta-modal">
        <div className="ta-modal-header">
          <h3>{form.id ? "✏️ Editar servicio" : "➕ Nuevo servicio"}</h3>
          <button className="ta-close" onClick={onClose}>✕</button>
        </div>
        <div className="ta-modal-body">
          <div className="ta-form-grid">
            <div className="ta-field ta-half">
              <label>Nombre *</label>
              <input value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="Ej: Auditoría Completa" className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>Icono (emoji)</label>
              <input value={form.icon} onChange={e => set("icon", e.target.value)}
                placeholder="⚡" className="ta-input" style={{ maxWidth: 100 }} />
            </div>
            <div className="ta-field ta-full">
              <label>Descripción corta</label>
              <input value={form.short_desc} onChange={e => set("short_desc", e.target.value)}
                placeholder="Subtítulo breve" className="ta-input" />
            </div>
            <div className="ta-field ta-full">
              <label>Descripción completa</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Describe el servicio en detalle…" className="ta-input ta-textarea" rows={3} />
            </div>
            <div className="ta-field ta-half">
              <label>Precio (texto)</label>
              <input value={form.price_display} onChange={e => set("price_display", e.target.value)}
                placeholder="Desde €149" className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>Color acento</label>
              <select value={form.color_accent} onChange={e => set("color_accent", e.target.value)}
                className="ta-input">
                <option value="gold">🟡 Gold</option>
                <option value="jade">🟢 Jade</option>
              </select>
            </div>
            <div className="ta-field ta-half">
              <label>CTA Texto</label>
              <input value={form.cta_label} onChange={e => set("cta_label", e.target.value)}
                placeholder="Solicitar →" className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>CTA URL</label>
              <input value={form.cta_url} onChange={e => set("cta_url", e.target.value)}
                placeholder="/contacto o https://…" className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>Badge (opcional)</label>
              <input value={form.badge ?? ""} onChange={e => set("badge", e.target.value)}
                placeholder="POPULAR" className="ta-input" />
            </div>
            <div className="ta-field ta-half">
              <label>Orden</label>
              <input type="number" value={form.sort_order ?? 0}
                onChange={e => set("sort_order", Number(e.target.value))}
                className="ta-input" style={{ maxWidth: 100 }} />
            </div>
            <div className="ta-field ta-full">
              <label>Características (una por línea)</label>
              <textarea value={featText} onChange={e => setFeatText(e.target.value)}
                placeholder={"Análisis SEO técnico\nAuditoría de conversión\nInforme ejecutivo IA"}
                className="ta-input ta-textarea" rows={6} />
              <span className="ta-hint">Cada línea = una característica en la lista</span>
            </div>
            <div className="ta-field ta-full ta-visible-row">
              <label className="ta-check-label">
                <input type="checkbox" checked={form.visible !== false}
                  onChange={e => set("visible", e.target.checked)} />
                Visible en la tienda pública
              </label>
            </div>
          </div>
        </div>
        <div className="ta-modal-footer">
          <button className="ta-btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="ta-btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? "Guardando…" : (form.id ? "💾 Guardar cambios" : "➕ Crear servicio")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Servicios Tab ─────────────────────────────────────────────────────────────
function ServiciosTab({ show }: { show: (msg: string, ok?: boolean) => void }) {
  const [services, setServices] = useState<TiendaService[]>([]);
  const [modal, setModal] = useState<TiendaService | null | "new">(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(() => {
    apiFetch("/tienda/admin/services")
      .then(r => r.ok ? r.json() : [])
      .then(d => setServices(d))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = async (id: number, name: string) => {
    if (!confirm(`¿Eliminar el servicio "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/tienda/services/${id}`, { method: "DELETE" });
      show(`🗑️ Servicio eliminado`);
      load();
    } catch { show("❌ Error", false); }
    setDeleting(null);
  };

  const toggleVisible = async (svc: TiendaService) => {
    await apiFetch(`/tienda/services/${svc.id}`, {
      method: "PUT",
      body: JSON.stringify({ visible: !svc.visible }),
    });
    load();
  };

  return (
    <div className="ta-section">
      <div className="ta-section-header">
        <h2>⚡ Servicios</h2>
        <p>Gestiona los servicios que aparecen en la pestaña "Servicios" de tu tienda pública.</p>
        <button className="ta-btn-primary ta-btn-sm" onClick={() => setModal("new")}>
          ➕ Añadir servicio
        </button>
      </div>

      <div className="ta-svcs-list">
        {services.map(s => (
          <div key={s.id} className={`ta-svc-row${!s.visible ? " ta-svc-hidden" : ""}`}>
            <div className="ta-svc-icon-sm">{s.icon}</div>
            <div className="ta-svc-meta">
              <div className="ta-svc-row-name">
                {s.name}
                {s.badge && <span className="ta-svc-badge-sm">{s.badge}</span>}
                <span className={`ta-accent-dot ${s.color_accent}`} />
              </div>
              <div className="ta-svc-row-price">{s.price_display} · {Array.isArray(s.features) ? s.features.length : 0} características</div>
            </div>
            <div className="ta-svc-actions">
              <button
                className={`ta-vis-btn${s.visible ? " ta-vis-on" : ""}`}
                onClick={() => toggleVisible(s)}
                title={s.visible ? "Ocultar" : "Mostrar"}
              >
                {s.visible ? "👁️ Visible" : "🙈 Oculto"}
              </button>
              <button className="ta-btn-edit" onClick={() => setModal(s)}>✏️ Editar</button>
              <button
                className="ta-btn-del"
                onClick={() => del(s.id!, s.name)}
                disabled={deleting === s.id}
              >
                {deleting === s.id ? "…" : "🗑️"}
              </button>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div className="ta-empty">No hay servicios. Haz clic en "Añadir servicio" para crear el primero.</div>
        )}
      </div>

      {modal !== null && (
        <ServiceModal
          svc={modal === "new" ? null : (modal as TiendaService)}
          onClose={() => setModal(null)}
          onSave={() => { load(); show("✅ Servicio guardado"); }}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TiendaAdmin() {
  const [tab, setTab] = useState<Tab>("shopify");
  const { toast, show } = useToast();

  return (
    <>
      <style>{CSS}</style>

      <div className="ta-root">
        {/* Header */}
        <div className="ta-top">
          <div className="ta-top-left">
            <h1 className="ta-title">🛍️ Gestión de Tienda</h1>
            <p className="ta-subtitle">Configura Shopify, gestiona planes y servicios de tu tienda pública</p>
          </div>
          <a href="/tienda" target="_blank" className="ta-preview-btn">
            👁️ Ver tienda pública ↗
          </a>
        </div>

        {/* Nav Tabs */}
        <div className="ta-nav">
          {([
            { id: "shopify", label: "🛍️ Shopify Config" },
            { id: "planes", label: "📦 Planes" },
            { id: "servicios", label: "⚡ Servicios" },
          ] as const).map(t => (
            <button
              key={t.id}
              className={`ta-nav-tab${tab === t.id ? " ta-nav-on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="ta-body">
          {tab === "shopify" && <ShopifyTab show={show} />}
          {tab === "planes" && <PlanesTab show={show} />}
          {tab === "servicios" && <ServiciosTab show={show} />}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`ta-toast${toast.ok ? "" : " ta-toast-err"}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const CSS = `
.ta-root {
  padding: 28px 32px 60px; min-height: 100vh;
  background: var(--ink, #0a0a0c);
}
.ta-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 28px; flex-wrap: wrap;
}
.ta-top-left { flex: 1; }
.ta-title {
  font-family: var(--fh, 'Instrument Serif', serif);
  font-size: 28px; font-weight: 400; color: #eee; margin: 0 0 6px;
}
.ta-subtitle { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0; }
.ta-preview-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: 9px;
  border: 1px solid rgba(200,168,75,0.28); background: rgba(200,168,75,0.07);
  color: rgba(200,168,75,0.9); font-size: 13px; font-weight: 600;
  text-decoration: none; white-space: nowrap; transition: all .2s;
  font-family: var(--fb, 'Geist', sans-serif);
}
.ta-preview-btn:hover { background: rgba(200,168,75,0.14); border-color: rgba(200,168,75,0.45); }

/* NAV */
.ta-nav {
  display: flex; gap: 4px; margin-bottom: 28px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 4px; width: fit-content;
}
.ta-nav-tab {
  padding: 10px 24px; border-radius: 9px; border: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
  background: transparent; color: rgba(255,255,255,0.4); transition: all .2s;
  font-family: inherit; white-space: nowrap;
}
.ta-nav-tab.ta-nav-on {
  background: rgba(200,168,75,0.14); border: 1px solid rgba(200,168,75,0.3);
  color: rgba(200,168,75,0.95);
}

/* SECTION */
.ta-section { display: flex; flex-direction: column; gap: 20px; }
.ta-section-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
.ta-section-header h2 {
  font-size: 18px; font-weight: 700; color: #eee; margin: 0;
}
.ta-section-header p { font-size: 13px; color: rgba(255,255,255,0.42); margin: 0; }

/* CARD */
.ta-card {
  border-radius: 16px; background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  padding: 24px;
}
.ta-info-banner {
  display: flex; gap: 12px; padding: 14px 16px; border-radius: 10px;
  background: rgba(200,168,75,0.06); border: 1px solid rgba(200,168,75,0.18);
  font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.6;
  margin-bottom: 20px;
}
.ta-info-banner span { font-size: 18px; flex-shrink: 0; }
.ta-info-banner strong { color: rgba(200,168,75,0.9); }
.ta-info-banner code {
  background: rgba(200,168,75,0.1); padding: 1px 6px; border-radius: 4px;
  font-size: 11.5px; color: rgba(200,168,75,0.85); font-family: var(--fm, monospace);
}

/* FORMS */
.ta-form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.ta-field { display: flex; flex-direction: column; gap: 6px; }
.ta-full { grid-column: 1 / -1; }
.ta-half { grid-column: span 1; }
.ta-field label {
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5);
  text-transform: uppercase; letter-spacing: .8px;
}
.ta-input {
  width: 100%; padding: 10px 14px; border-radius: 9px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: #eee; font-size: 13.5px; font-family: inherit; outline: none;
  transition: border-color .2s; box-sizing: border-box;
}
.ta-input:focus { border-color: rgba(200,168,75,0.45); }
.ta-textarea { resize: vertical; min-height: 80px; }
.ta-hint { font-size: 11.5px; color: rgba(255,255,255,0.3); }
.ta-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 4px 0; }
.ta-secret-wrap { position: relative; display: flex; align-items: center; }
.ta-secret-input { padding-right: 44px; }
.ta-reveal-btn {
  position: absolute; right: 10px; background: none; border: none;
  cursor: pointer; font-size: 16px; opacity: 0.6; transition: opacity .2s; padding: 4px;
}
.ta-reveal-btn:hover { opacity: 1; }
.ta-visible-row { flex-direction: row; align-items: center; }
.ta-check-label {
  display: flex; align-items: center; gap: 10px;
  font-size: 13.5px !important; color: rgba(255,255,255,0.7) !important;
  text-transform: none !important; letter-spacing: 0 !important;
  cursor: pointer;
}
.ta-check-label input { width: 16px; height: 16px; cursor: pointer; accent-color: #d4a843; }
.ta-actions { display: flex; justify-content: flex-end; margin-top: 20px; }

/* PLANS LIST */
.ta-plans-list { display: flex; flex-direction: column; gap: 12px; }
.ta-plan-row {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 16px 20px; border-radius: 12px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07);
}
.ta-plan-row.ta-plan-featured { border-color: rgba(200,168,75,0.25); background: rgba(200,168,75,0.05); }
.ta-plan-info { min-width: 180px; flex: 1; }
.ta-plan-name {
  font-size: 15px; font-weight: 700; color: #eee; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ta-plan-id {
  font-size: 10px; color: rgba(255,255,255,0.25); font-family: var(--fm, monospace);
  background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;
}
.ta-feat-badge {
  padding: 2px 8px; border-radius: 5px;
  background: rgba(200,168,75,0.15); border: 1px solid rgba(200,168,75,0.3);
  font-size: 9px; font-weight: 800; color: rgba(200,168,75,0.9);
  letter-spacing: .5px; text-transform: uppercase;
}
.ta-plan-price {
  font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ta-shopify-pill {
  font-size: 10px; padding: 2px 8px; border-radius: 99px;
  background: rgba(120,190,120,0.1); border: 1px solid rgba(120,190,120,0.25);
  color: #78be78;
}
.ta-plan-url-wrap { display: flex; gap: 8px; flex: 1; min-width: 240px; }
.ta-url-input { flex: 1; }
.ta-btn-save {
  padding: 10px 16px; border-radius: 9px;
  background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.28);
  color: rgba(200,168,75,0.9); cursor: pointer; font-size: 16px;
  transition: all .2s; flex-shrink: 0;
}
.ta-btn-save:hover { background: rgba(200,168,75,0.22); }
.ta-btn-save:disabled { opacity: 0.5; cursor: default; }

/* SERVICES LIST */
.ta-svcs-list { display: flex; flex-direction: column; gap: 10px; }
.ta-svc-row {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 14px 18px; border-radius: 12px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07);
  transition: opacity .2s;
}
.ta-svc-row.ta-svc-hidden { opacity: 0.45; }
.ta-svc-icon-sm { font-size: 22px; flex-shrink: 0; width: 36px; text-align: center; }
.ta-svc-meta { flex: 1; min-width: 160px; }
.ta-svc-row-name {
  font-size: 14px; font-weight: 700; color: #eee;
  display: flex; align-items: center; gap: 8px;
}
.ta-svc-badge-sm {
  padding: 2px 7px; border-radius: 5px; font-size: 9px; font-weight: 800;
  background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.25);
  color: rgba(200,168,75,0.85); text-transform: uppercase; letter-spacing: .5px;
}
.ta-accent-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.ta-accent-dot.gold { background: #d4a843; }
.ta-accent-dot.jade { background: #2dd49f; }
.ta-svc-row-price { font-size: 12px; color: rgba(255,255,255,0.38); margin-top: 3px; }
.ta-svc-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; flex-wrap: wrap; }
.ta-vis-btn {
  padding: 6px 12px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4);
  font-size: 12px; cursor: pointer; transition: all .2s; font-family: inherit;
}
.ta-vis-btn.ta-vis-on {
  border-color: rgba(45,212,159,0.3); background: rgba(45,212,159,0.06); color: #2dd49f;
}
.ta-btn-edit {
  padding: 6px 14px; border-radius: 7px;
  border: 1px solid rgba(200,168,75,0.25); background: rgba(200,168,75,0.07);
  color: rgba(200,168,75,0.85); font-size: 12.5px; cursor: pointer;
  transition: all .2s; font-family: inherit;
}
.ta-btn-edit:hover { background: rgba(200,168,75,0.15); }
.ta-btn-del {
  padding: 6px 12px; border-radius: 7px;
  border: 1px solid rgba(232,69,88,0.2); background: rgba(232,69,88,0.04);
  color: rgba(232,69,88,0.7); font-size: 14px; cursor: pointer;
  transition: all .2s; font-family: inherit;
}
.ta-btn-del:hover { background: rgba(232,69,88,0.12); }
.ta-btn-del:disabled { opacity: 0.5; cursor: default; }

/* MODAL */
.ta-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.ta-modal {
  background: #0d0d14; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px; width: 100%; max-width: 620px;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 32px 80px rgba(0,0,0,0.8);
}
.ta-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 0; flex-shrink: 0;
}
.ta-modal-header h3 {
  font-size: 17px; font-weight: 700; color: #eee; margin: 0;
}
.ta-close {
  width: 30px; height: 30px; border-radius: 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.ta-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.ta-modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
}

/* BUTTONS */
.ta-btn-primary {
  padding: 10px 22px; border-radius: 10px;
  background: linear-gradient(135deg, #d4a843, #b8860b);
  color: #000; font-size: 13.5px; font-weight: 700;
  border: none; cursor: pointer; transition: all .2s;
  font-family: inherit;
}
.ta-btn-primary:hover { box-shadow: 0 4px 16px rgba(200,168,75,0.4); }
.ta-btn-primary:disabled { opacity: 0.5; cursor: default; }
.ta-btn-primary.ta-btn-sm { padding: 8px 16px; font-size: 13px; margin-top: 8px; align-self: flex-start; }
.ta-btn-ghost {
  padding: 10px 22px; border-radius: 10px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 13.5px; font-weight: 600;
  cursor: pointer; transition: all .2s; font-family: inherit;
}
.ta-btn-ghost:hover { background: rgba(255,255,255,0.09); }

/* EMPTY */
.ta-empty {
  padding: 36px; text-align: center;
  font-size: 14px; color: rgba(255,255,255,0.3);
  border-radius: 12px; border: 1px dashed rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.015);
}

/* TOAST */
.ta-toast {
  position: fixed; bottom: 28px; right: 28px;
  padding: 14px 22px; border-radius: 12px;
  background: rgba(30,30,40,0.96); border: 1px solid rgba(200,168,75,0.3);
  color: #eee; font-size: 14px; font-weight: 600;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6); z-index: 2000;
  animation: tsToastIn .3s ease;
}
.ta-toast.ta-toast-err { border-color: rgba(232,69,88,0.4); }
@keyframes tsToastIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .ta-root { padding: 16px; }
  .ta-form-grid { grid-template-columns: 1fr; }
  .ta-half { grid-column: 1 / -1; }
  .ta-plan-row { flex-direction: column; align-items: flex-start; }
  .ta-plan-url-wrap { width: 100%; }
  .ta-svc-actions { margin-left: 0; }
  .ta-nav { flex-direction: column; width: 100%; }
}
`;
