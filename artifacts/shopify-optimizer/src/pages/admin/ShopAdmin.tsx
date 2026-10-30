import { useEffect, useRef, useState } from "react";

/**
 * Admin → Tienda: productos (precios por tramo, extras, personalización, fotos y vídeos)
 * y pedidos (estado, seguimiento y archivos del cliente).
 */
const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_ROOT}${path}`, { credentials: "include", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `HTTP ${r.status}`);
  return d as T;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const euros = (c: number) => (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

interface Product {
  id: number; slug: string; kind: string; category: string; name: string; tagline: string; description: string;
  features: string[]; media: Array<{ type: string; url: string; alt: string; poster?: string }>;
  variants: unknown[]; addons: unknown[]; fields: unknown[]; qtyOptions: number[];
  minQty: number; maxQty: number; leadDays: number; demoUrl: string | null; featured: boolean; visible: boolean; sortOrder: number;
}
interface Order {
  id: number; token: string; status: string; email: string | null; name: string | null; phone: string | null;
  shipping: { name?: string; address?: Record<string, string> } | null;
  lines: Array<{ productName: string; variantName: string; qty: number; totalCents: number; addons: Array<{ name: string }>; fields: Record<string, string | string[]> }>;
  total_cents: number; shipping_cents: number; created_at: string; paid_at: string | null; tracking: string | null; admin_notes: string | null;
}

const STATUS: Record<string, string> = {
  pending: "Sin pagar", paid: "Pagado", in_production: "En producción", shipped: "Enviado",
  delivered: "Entregado", cancelled: "Cancelado", expired: "Caducado",
};

const s = {
  card: { background: "var(--ink2,#13131f)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 } as React.CSSProperties,
  input: { width: "100%", background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 11, color: "#9896ba", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, display: "block" } as React.CSSProperties,
  btn: { background: "#c9a961", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" } as React.CSSProperties,
  ghost: { background: "transparent", color: "#e8e0d0", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" } as React.CSSProperties,
};

type Form = Record<string, string | boolean>;
const toForm = (p: Product | null): Form => ({
  slug: p?.slug ?? "", kind: p?.kind ?? "physical", category: p?.category ?? "tarjetas", name: p?.name ?? "", tagline: p?.tagline ?? "",
  description: p?.description ?? "", features: (p?.features ?? []).join("\n"),
  media: JSON.stringify(p?.media ?? [], null, 2), variants: JSON.stringify(p?.variants ?? [{ key: "unica", name: "Única", tiers: [{ min: 1, unitCents: 1000 }] }], null, 2),
  addons: JSON.stringify(p?.addons ?? [], null, 2), fields: JSON.stringify(p?.fields ?? [], null, 2),
  qtyOptions: (p?.qtyOptions ?? []).join(", "), minQty: String(p?.minQty ?? 1), maxQty: String(p?.maxQty ?? 20),
  leadDays: String(p?.leadDays ?? 5), demoUrl: p?.demoUrl ?? "", featured: p?.featured ?? false, visible: p?.visible ?? true, sortOrder: String(p?.sortOrder ?? 0),
});

function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<Form>(toForm(null));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { const d = await api<{ products: Product[]; categories: Record<string, string> }>("/admin/shop/products"); setProducts(d.products); setCategories(d.categories); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
  };
  useEffect(() => { void load(); }, []);
  const current = typeof sel === "number" ? products.find(p => p.id === sel) ?? null : null;
  useEffect(() => { setForm(toForm(current)); setMsg(null); }, [sel, current?.id]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const parse = (k: string) => { try { return JSON.parse(String(form[k]) || "[]"); } catch { throw new Error(`«${k}» no es JSON válido`); } };
      const body = {
        slug: form.slug, kind: form.kind, category: form.category, name: form.name, tagline: form.tagline, description: form.description,
        features: String(form.features).split("\n").map(t => t.trim()).filter(Boolean),
        media: parse("media"), variants: parse("variants"), addons: parse("addons"), fields: parse("fields"),
        qtyOptions: String(form.qtyOptions).split(",").map(t => Number(t.trim())).filter(n => Number.isFinite(n) && n > 0),
        minQty: Number(form.minQty), maxQty: Number(form.maxQty), leadDays: Number(form.leadDays),
        demoUrl: String(form.demoUrl).trim() || null, featured: !!form.featured, visible: !!form.visible, sortOrder: Number(form.sortOrder),
      };
      const saved = sel === "new"
        ? await api<Product>("/admin/shop/products", json("POST", body))
        : await api<Product>(`/admin/shop/products/${sel}`, json("PUT", body));
      await load(); setSel(saved.id); setMsg({ ok: true, text: "Guardado" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" });
    } finally { setBusy(false); }
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); [...list].forEach(f => fd.append("files", f));
      const d = await api<{ media: unknown[] }>("/admin/shop/media", { method: "POST", body: fd });
      const cur = JSON.parse(String(form.media) || "[]");
      setForm(f => ({ ...f, media: JSON.stringify([...cur, ...d.media], null, 2) }));
      setMsg({ ok: true, text: "Subido: pulsa Guardar para publicarlo" });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const media: Product["media"] = (() => { try { return JSON.parse(String(form.media) || "[]"); } catch { return []; } })();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
      <div style={{ ...s.card, display: "flex", flexDirection: "column", gap: 6, maxHeight: "75vh", overflow: "auto" }}>
        <button style={s.btn} onClick={() => setSel("new")}>+ Nuevo producto</button>
        {products.map(p => (
          <button key={p.id} onClick={() => setSel(p.id)} style={{ ...s.ghost, textAlign: "left", borderColor: sel === p.id ? "#c9a961" : undefined, opacity: p.visible ? 1 : 0.5 }}>
            <strong>{p.name}</strong><br /><span style={{ fontSize: 11, color: "#9896ba" }}>{categories[p.category] ?? p.category}{p.visible ? "" : " · oculto"}</span>
          </button>
        ))}
      </div>
      {sel === null ? <div style={s.card}>Elige un producto o crea uno nuevo.</div> : (
        <div style={{ ...s.card, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={s.label}>Nombre</label><input style={s.input} value={String(form.name)} onChange={set("name")} /></div>
          <div><label style={s.label}>Slug (URL)</label><input style={s.input} value={String(form.slug)} onChange={set("slug")} /></div>
          <div><label style={s.label}>Tipo</label>
            <select style={s.input} value={String(form.kind)} onChange={set("kind")}>
              <option value="physical">Físico (con envío)</option><option value="digital">Digital</option><option value="quote">Presupuesto (no se vende online)</option>
            </select></div>
          <div><label style={s.label}>Categoría</label>
            <select style={s.input} value={String(form.category)} onChange={set("category")}>
              {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={s.label}>Frase corta</label><input style={s.input} value={String(form.tagline)} onChange={set("tagline")} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={s.label}>Descripción (párrafos separados por línea en blanco)</label><textarea style={{ ...s.input, minHeight: 110 }} value={String(form.description)} onChange={set("description")} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={s.label}>Incluye (una línea por punto)</label><textarea style={{ ...s.input, minHeight: 90 }} value={String(form.features)} onChange={set("features")} /></div>
          <div><label style={s.label}>Opciones y precios por tramo (céntimos, IVA incl.)</label><textarea style={{ ...s.input, minHeight: 160, fontFamily: "monospace" }} value={String(form.variants)} onChange={set("variants")} /></div>
          <div><label style={s.label}>Extras</label><textarea style={{ ...s.input, minHeight: 160, fontFamily: "monospace" }} value={String(form.addons)} onChange={set("addons")} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={s.label}>Campos de personalización</label><textarea style={{ ...s.input, minHeight: 140, fontFamily: "monospace" }} value={String(form.fields)} onChange={set("fields")} /></div>
          <div><label style={s.label}>Packs fijos (p. ej. 25, 50, 100)</label><input style={s.input} value={String(form.qtyOptions)} onChange={set("qtyOptions")} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div><label style={s.label}>Mín.</label><input style={s.input} value={String(form.minQty)} onChange={set("minQty")} /></div>
            <div><label style={s.label}>Máx.</label><input style={s.input} value={String(form.maxQty)} onChange={set("maxQty")} /></div>
            <div><label style={s.label}>Días</label><input style={s.input} value={String(form.leadDays)} onChange={set("leadDays")} /></div>
          </div>
          <div><label style={s.label}>Enlace de ejemplo (ruta del sitio)</label><input style={s.input} value={String(form.demoUrl)} onChange={set("demoUrl")} /></div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <label><input type="checkbox" checked={!!form.visible} onChange={set("visible")} /> Visible</label>
            <label><input type="checkbox" checked={!!form.featured} onChange={set("featured")} /> Destacado</label>
            <label>Orden <input style={{ ...s.input, width: 70 }} value={String(form.sortOrder)} onChange={set("sortOrder")} /></label>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={s.label}>Fotos y vídeos</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {media.map((m, i) => (
                <div key={i} style={{ position: "relative" }}>
                  {m.type === "video"
                    ? <video src={`${base}${m.url}`} muted style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />
                    : <img src={`${base}${m.url}`} alt={m.alt} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />}
                  <button style={{ ...s.ghost, position: "absolute", top: 2, right: 2, padding: "0 6px" }}
                    onClick={() => setForm(f => ({ ...f, media: JSON.stringify(media.filter((_, k) => k !== i), null, 2) }))}>×</button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,video/mp4,video/webm" onChange={e => void upload(e.target.files)} />
            <textarea style={{ ...s.input, minHeight: 80, fontFamily: "monospace", marginTop: 8 }} value={String(form.media)} onChange={set("media")} />
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
            <button style={s.btn} disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar"}</button>
            {typeof sel === "number" && <a style={{ ...s.ghost, textDecoration: "none" }} href={`${base}/tienda/${form.slug}`} target="_blank" rel="noopener">Ver en la tienda</a>}
            {msg && <span style={{ color: msg.ok ? "#45b37a" : "#f08a8a", fontSize: 13 }}>{msg.text}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    try { setOrders((await api<{ orders: Order[] }>(`/admin/shop/orders${filter ? `?status=${filter}` : ""}`)).orders); setErr(null); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
  };
  useEffect(() => { void load(); }, [filter]);
  const patch = async (id: number, body: Record<string, unknown>) => {
    try { await api(`/admin/shop/orders/${id}`, json("PATCH", body)); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Error"); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={{ ...s.ghost, borderColor: !filter ? "#c9a961" : undefined }} onClick={() => setFilter("")}>Activos</button>
        {Object.entries(STATUS).map(([k, v]) => <button key={k} style={{ ...s.ghost, borderColor: filter === k ? "#c9a961" : undefined }} onClick={() => setFilter(k)}>{v}</button>)}
      </div>
      {err && <div style={{ color: "#f08a8a" }}>{err}</div>}
      {orders.length === 0 && <div style={s.card}>No hay pedidos en esta vista.</div>}
      {orders.map(o => (
        <div key={o.id} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong>#{o.id} · {o.token.slice(0, 8).toUpperCase()}</strong> · {euros(o.total_cents)} · {new Date(o.created_at).toLocaleString("es-ES")}
              <div style={{ fontSize: 13, color: "#9896ba" }}>{o.name ?? "—"} · {o.email ?? "—"} · {o.phone ?? "—"}</div>
              {o.shipping?.address && <div style={{ fontSize: 13, color: "#9896ba" }}>Envío: {o.shipping.name} · {[o.shipping.address.line1, o.shipping.address.line2, o.shipping.address.postal_code, o.shipping.address.city, o.shipping.address.state].filter(Boolean).join(", ")}</div>}
            </div>
            <select style={{ ...s.input, width: 180 }} value={o.status} onChange={e => void patch(o.id, { status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {o.lines.map((l, i) => (
            <div key={i} style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#0d0d1a" }}>
              <strong>{l.productName}</strong> · {l.variantName} × {l.qty} · {euros(l.totalCents)}{l.addons.length ? ` · ${l.addons.map(a => a.name).join(", ")}` : ""}
              <div style={{ fontSize: 13, marginTop: 6, display: "grid", gap: 4 }}>
                {Object.entries(l.fields).map(([k, v]) => (
                  <div key={k}><span style={{ color: "#9896ba" }}>{k}:</span>{" "}
                    {Array.isArray(v)
                      ? v.map((id, n) => <a key={id} style={{ color: "#c9a961", marginRight: 8 }} href={`${API_ROOT}/admin/shop/uploads/${id}?download=1`}>archivo {n + 1}</a>)
                      : <span style={{ whiteSpace: "pre-wrap" }}>{v}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8, marginTop: 10 }}>
            <input style={s.input} placeholder="Seguimiento del envío" defaultValue={o.tracking ?? ""} onBlur={e => { if (e.target.value !== (o.tracking ?? "")) void patch(o.id, { tracking: e.target.value || null }); }} />
            <input style={s.input} placeholder="Notas internas" defaultValue={o.admin_notes ?? ""} onBlur={e => { if (e.target.value !== (o.admin_notes ?? "")) void patch(o.id, { adminNotes: e.target.value || null }); }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const [ship, setShip] = useState(""); const [free, setFree] = useState(""); const [msg, setMsg] = useState("");
  useEffect(() => {
    api<{ shippingCents: number; freeFromCents: number; payments: boolean }>("/shop/settings")
      .then(d => { setShip(String(d.shippingCents / 100)); setFree(String(d.freeFromCents / 100)); setMsg(d.payments ? "" : "Stripe no está configurado: la tienda no puede cobrar."); })
      .catch(() => {});
  }, []);
  const save = async () => {
    try {
      await api("/admin/shop/settings", json("PUT", { shippingCents: Math.round(Number(ship.replace(",", ".")) * 100), freeFromCents: Math.round(Number(free.replace(",", ".")) * 100) }));
      setMsg("Guardado");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Error"); }
  };
  return (
    <div style={{ ...s.card, maxWidth: 420, display: "grid", gap: 10 }}>
      <div><label style={s.label}>Envío a España (€, IVA incl.)</label><input style={s.input} value={ship} onChange={e => setShip(e.target.value)} /></div>
      <div><label style={s.label}>Envío gratis desde (€ de producto físico)</label><input style={s.input} value={free} onChange={e => setFree(e.target.value)} /></div>
      <button style={s.btn} onClick={() => void save()}>Guardar</button>
      {msg && <span style={{ fontSize: 13, color: "#c9a961" }}>{msg}</span>}
    </div>
  );
}

export default function ShopAdmin() {
  const [tab, setTab] = useState<"orders" | "products" | "settings">("orders");
  return (
    <div style={{ padding: 24, color: "#e8e0d0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Tienda</h1>
        {(["orders", "products", "settings"] as const).map(t => (
          <button key={t} style={{ ...s.ghost, borderColor: tab === t ? "#c9a961" : undefined }} onClick={() => setTab(t)}>
            {t === "orders" ? "Pedidos" : t === "products" ? "Productos" : "Envío"}
          </button>
        ))}
        <a href={`${base}/tienda`} target="_blank" rel="noopener" style={{ ...s.ghost, textDecoration: "none", marginLeft: "auto" }}>Abrir la tienda</a>
      </div>
      {tab === "orders" ? <OrdersTab /> : tab === "products" ? <ProductsTab /> : <SettingsTab />}
    </div>
  );
}
