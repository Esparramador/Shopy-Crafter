import { useState, useEffect, useRef } from "react";
import { FileText, Plus, Trash2, Download, Send, Calculator, Loader2, CheckCircle, User, Calendar, Zap, DollarSign, TrendingUp, Clock, ChevronDown, X, Printer } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface LineItem {
  id: string;
  description: string;
  category: "estrategia" | "diseño" | "desarrollo" | "ia" | "gestion" | "publicidad" | "seo" | "otro";
  hours: number;
  rate: number;
  quantity: number;
  unit: "horas" | "unidades" | "fijo";
  subtotal: number;
}

interface Invoice {
  id: string;
  client: string;
  project: string;
  number: string;
  date: string;
  dueDate: string;
  items: LineItem[];
  notes: string;
  taxPct: number;
  status: "borrador" | "enviada" | "pagada";
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: string; defaultRate: number }> = {
  estrategia:  { label: "Estrategia IA",       color: "#8b5cf6", icon: "🧠", defaultRate: 90 },
  diseño:      { label: "Diseño & Branding",    color: "#f59e0b", icon: "🎨", defaultRate: 68 },
  desarrollo:  { label: "Desarrollo Web",       color: "#60a5fa", icon: "💻", defaultRate: 75 },
  ia:          { label: "Generación con IA",    color: "#4ade80", icon: "⚡", defaultRate: 110 },
  gestion:     { label: "Gestión Shopify",      color: "#fb923c", icon: "🛒", defaultRate: 55 },
  publicidad:  { label: "Publicidad & Ads",     color: "#ec4899", icon: "📣", defaultRate: 65 },
  seo:         { label: "SEO & Contenido",      color: "#22d3ee", icon: "🔍", defaultRate: 60 },
  otro:        { label: "Otros servicios",      color: "#94a3b8", icon: "📦", defaultRate: 48 },
};

function newItem(): LineItem {
  const id = Math.random().toString(36).slice(2);
  return { id, description: "", category: "gestion", hours: 1, rate: 55, quantity: 1, unit: "horas", subtotal: 55 };
}

function calcSubtotal(item: LineItem) {
  if (item.unit === "horas") return item.hours * item.rate;
  if (item.unit === "unidades") return item.quantity * item.rate;
  return item.rate;
}

const QUICK_SERVICES = [
  { description: "Estrategia de contenido IA mensual", category: "estrategia" as const, hours: 8, rate: 90, unit: "horas" as const },
  { description: "Diseño de identidad de marca con IA (DNA Brand)", category: "diseño" as const, hours: 6, rate: 75, unit: "horas" as const },
  { description: "Configuración y optimización tienda Shopify", category: "gestion" as const, hours: 10, rate: 55, unit: "horas" as const },
  { description: "Auditoría SEO completa + plan de keywords", category: "seo" as const, hours: 5, rate: 65, unit: "horas" as const },
  { description: "Generación de imágenes de producto con IA (20 piezas)", category: "ia" as const, quantity: 20, rate: 6, unit: "unidades" as const, hours: 0 },
  { description: "Vídeos de producto con IA (pack 5 vídeos)", category: "ia" as const, quantity: 5, rate: 25, unit: "unidades" as const, hours: 0 },
  { description: "Gestión mensual redes sociales + contenido IA", category: "publicidad" as const, rate: 350, unit: "fijo" as const, hours: 0, quantity: 1 },
  { description: "Campaña publicitaria Meta Ads (setup + gestión)", category: "publicidad" as const, hours: 12, rate: 65, unit: "horas" as const },
  { description: "Informe de rendimiento mensual con IA", category: "estrategia" as const, rate: 120, unit: "fijo" as const, hours: 0, quantity: 1 },
  { description: "Desarrollo de landing page optimizada", category: "desarrollo" as const, hours: 16, rate: 75, unit: "horas" as const },
  { description: "Integración Shopify + automatizaciones", category: "desarrollo" as const, hours: 8, rate: 75, unit: "horas" as const },
  { description: "Formación en herramientas IA (sesión 2h)", category: "estrategia" as const, rate: 200, unit: "fijo" as const, hours: 0, quantity: 1 },
];

export default function AgencyBilling() {
  const [projects, setProjects] = useState<{ id: number; storeName: string }[]>([]);
  const [invoice, setInvoice] = useState<Invoice>({
    id: Date.now().toString(),
    client: "", project: "",
    number: `SC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    date: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    items: [newItem()], notes: "", taxPct: 21, status: "borrador",
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview" | "history">("editor");
  const [savedInvoices, setSavedInvoices] = useState<Invoice[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API}/api/projects`, { credentials: "include" }).then(r => r.ok ? r.json() : [])
      .then((list: any[]) => setProjects(list.map(p => ({ id: p.id, storeName: p.storeName || p.store_name || `Proyecto ${p.id}` }))));
    const saved = localStorage.getItem("sc_invoices");
    if (saved) setSavedInvoices(JSON.parse(saved));
  }, []);

  function updateItem(id: string, patch: Partial<LineItem>) {
    setInvoice(inv => ({
      ...inv,
      items: inv.items.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, ...patch };
        updated.subtotal = calcSubtotal(updated);
        return updated;
      }),
    }));
  }

  function addItem() { setInvoice(inv => ({ ...inv, items: [...inv.items, newItem()] })); }
  function removeItem(id: string) { setInvoice(inv => ({ ...inv, items: inv.items.filter(it => it.id !== id) })); }

  function addQuick(svc: typeof QUICK_SERVICES[0]) {
    const item: LineItem = {
      id: Math.random().toString(36).slice(2),
      description: svc.description, category: svc.category,
      hours: "hours" in svc ? Number((svc as any).hours ?? 0) : 0,
      rate: svc.rate, quantity: "quantity" in svc ? Number((svc as any).quantity ?? 1) : 1,
      unit: svc.unit, subtotal: 0,
    };
    item.subtotal = calcSubtotal(item);
    setInvoice(inv => ({ ...inv, items: [...inv.items.filter(it => it.description), item] }));
    setShowQuick(false);
  }

  const subtotal = invoice.items.reduce((s, it) => s + (it.subtotal || 0), 0);
  const tax = subtotal * (invoice.taxPct / 100);
  const total = subtotal + tax;
  const totalHours = invoice.items.filter(it => it.unit === "horas").reduce((s, it) => s + it.hours, 0);

  async function aiEstimate() {
    if (!invoice.project) return;
    setAiLoading(true);
    try {
      const context = `Proyecto: ${invoice.project}\nCliente: ${invoice.client || "Sin especificar"}\nÍtems actuales: ${invoice.items.map(it => it.description).filter(Boolean).join(", ")}`;
      const r = await fetch(`${API}/api/shopybrain`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Eres un consultor de agencias digital. Analiza este proyecto y sugiere items de facturación realistas con precios de mercado en España 2024 para una agencia IA premium:\n\n${context}\n\nDevuelve exactamente este JSON (sin markdown):\n{"items":[{"description":"...","category":"estrategia|diseño|desarrollo|ia|gestion|publicidad|seo|otro","rate":NUMBER,"unit":"horas|unidades|fijo","hours":NUMBER_or_0,"quantity":NUMBER_or_1,"reasoning":"..."}]}`,
          engine: "claude",
        }),
      });
      const d = await r.json();
      const text = d.response || d.content || "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const newItems: LineItem[] = (parsed.items || []).map((it: any) => {
          const item: LineItem = { id: Math.random().toString(36).slice(2), description: it.description, category: it.category || "otro", hours: it.hours || 0, rate: it.rate || 50, quantity: it.quantity || 1, unit: it.unit || "horas", subtotal: 0 };
          item.subtotal = calcSubtotal(item);
          return item;
        });
        setInvoice(inv => ({ ...inv, items: [...inv.items.filter(it => it.description), ...newItems] }));
      }
    } catch {}
    setAiLoading(false);
  }

  function saveInvoice() {
    const updated = [...savedInvoices.filter(i => i.id !== invoice.id), { ...invoice, status: "borrador" as const }];
    setSavedInvoices(updated);
    localStorage.setItem("sc_invoices", JSON.stringify(updated));
  }

  function printInvoice() {
    window.print();
  }

  function loadInvoice(inv: Invoice) {
    setInvoice(inv);
    setTab("editor");
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#10b981,#059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(16,185,129,0.35)" }}>
          <FileText size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--t)" }}>Facturación de Agencia</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>Crea presupuestos y facturas profesionales con estimación de costes por IA</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setInvoice({ id: Date.now().toString(), client: "", project: "", number: `SC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*900)+100)}`, date: new Date().toISOString().split("T")[0], dueDate: new Date(Date.now() + 30*86400000).toISOString().split("T")[0], items: [newItem()], notes: "", taxPct: 21, status: "borrador" }); setTab("editor"); }}
            style={{ padding: "8px 14px", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, color: "var(--t3)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nueva factura
          </button>
          <button onClick={() => { saveInvoice(); setTab("preview"); }} style={{ padding: "8px 16px", background: "#10b981", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> Vista previa
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--ink2)", borderRadius: 10, padding: 4 }}>
        {([["editor","✏️ Editor"], ["preview","📄 Vista Previa"], ["history","📁 Historial"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: tab === id ? 700 : 400, background: tab === id ? "var(--ink4)" : "transparent", color: tab === id ? "var(--t)" : "var(--t3)", cursor: "pointer" }}>
            {label}
          </button>
        ))}
      </div>

      {/* EDITOR TAB */}
      {tab === "editor" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
          <div>
            {/* Client & Project */}
            <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "var(--t)" }}>📋 Datos del Proyecto</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Número de factura</label>
                  <input value={invoice.number} onChange={e => setInvoice(i => ({ ...i, number: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Proyecto</label>
                  <select value={invoice.project} onChange={e => setInvoice(i => ({ ...i, project: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13 }}>
                    <option value="">Seleccionar proyecto…</option>
                    {projects.map(p => <option key={p.id} value={p.storeName}>{p.storeName}</option>)}
                    <option value="__custom">Proyecto personalizado</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Cliente / Empresa</label>
                  <input value={invoice.client} onChange={e => setInvoice(i => ({ ...i, client: e.target.value }))} placeholder="Nombre del cliente..." style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Fecha de emisión</label>
                  <input type="date" value={invoice.date} onChange={e => setInvoice(i => ({ ...i, date: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Vencimiento</label>
                  <input type="date" value={invoice.dueDate} onChange={e => setInvoice(i => ({ ...i, dueDate: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>IVA (%)</label>
                  <input type="number" value={invoice.taxPct} onChange={e => setInvoice(i => ({ ...i, taxPct: parseFloat(e.target.value) || 0 }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--t)" }}>💼 Servicios prestados</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowQuick(s => !s)} style={{ padding: "6px 12px", background: "rgba(200,168,75,0.1)", border: "1px solid rgba(200,168,75,0.3)", borderRadius: 8, color: "var(--gold)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Zap size={12} /> Servicios rápidos
                  </button>
                  <button onClick={aiEstimate} disabled={aiLoading || !invoice.project} style={{ padding: "6px 12px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 8, color: "#8b5cf6", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, opacity: !invoice.project ? 0.5 : 1 }}>
                    {aiLoading ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <Calculator size={12} />} Estimar con IA
                  </button>
                  <button onClick={addItem} style={{ padding: "6px 12px", background: "#10b981", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                    <Plus size={12} /> Añadir línea
                  </button>
                </div>
              </div>

              {/* Quick services dropdown */}
              {showQuick && (
                <div style={{ background: "var(--ink3)", borderRadius: 10, padding: 12, marginBottom: 14, border: "1px solid var(--ink4)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t)" }}>⚡ Servicios de agencia frecuentes</span>
                    <button onClick={() => setShowQuick(false)} style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer" }}><X size={14} /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 6 }}>
                    {QUICK_SERVICES.map((svc, i) => (
                      <button key={i} onClick={() => addQuick(svc)} style={{ padding: "8px 12px", background: `${CATEGORY_META[svc.category].color}15`, border: `1px solid ${CATEGORY_META[svc.category].color}30`, borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: CATEGORY_META[svc.category].color, marginBottom: 2 }}>{CATEGORY_META[svc.category].icon} {CATEGORY_META[svc.category].label}</div>
                        <div style={{ color: "var(--t3)", fontSize: 11 }}>{svc.description}</div>
                        <div style={{ color: "var(--gold)", fontSize: 11, marginTop: 3 }}>
                          {svc.unit === "fijo" ? `€${svc.rate} fijo` : svc.unit === "horas" ? `${svc.hours}h × €${svc.rate}/h = €${svc.hours * svc.rate}` : `${svc.quantity} × €${svc.rate} = €${svc.quantity * svc.rate}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ink4)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, fontSize: 11 }}>DESCRIPCIÓN</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, fontSize: 11, width: 130 }}>CATEGORÍA</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, fontSize: 11, width: 70 }}>CANT/H</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, fontSize: 11, width: 80 }}>€/UNIDAD</th>
                      <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--t3)", fontWeight: 600, fontSize: 11, width: 90 }}>SUBTOTAL</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: "1px solid var(--ink3)" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <input value={item.description} onChange={e => updateItem(item.id, { description: e.target.value })} placeholder="Descripción del servicio..." style={{ width: "100%", background: "transparent", border: "none", color: "var(--t)", fontSize: 13, outline: "none" }} />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <select value={item.category} onChange={e => updateItem(item.id, { category: e.target.value as LineItem["category"], rate: CATEGORY_META[e.target.value].defaultRate })} style={{ background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 6, color: "var(--t)", fontSize: 11, padding: "4px 6px", width: "100%" }}>
                            {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <select value={item.unit} onChange={e => updateItem(item.id, { unit: e.target.value as LineItem["unit"] })} style={{ background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 5, color: "var(--t)", fontSize: 10, padding: "2px 4px" }}>
                              <option value="horas">Horas</option>
                              <option value="unidades">Unidades</option>
                              <option value="fijo">Precio fijo</option>
                            </select>
                            {item.unit !== "fijo" && (
                              <input type="number" value={item.unit === "horas" ? item.hours : item.quantity} onChange={e => updateItem(item.id, item.unit === "horas" ? { hours: parseFloat(e.target.value) || 0 } : { quantity: parseFloat(e.target.value) || 0 })} style={{ width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 5, color: "var(--t)", fontSize: 12, padding: "3px 6px", textAlign: "right" }} />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input type="number" value={item.rate} onChange={e => updateItem(item.id, { rate: parseFloat(e.target.value) || 0 })} style={{ width: "100%", background: "transparent", border: "none", color: "var(--gold)", fontSize: 13, textAlign: "right", outline: "none" }} />
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "var(--t)" }}>
                          €{(item.subtotal || 0).toFixed(2)}
                        </td>
                        <td>
                          <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 4 }}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 11, color: "var(--t3)", display: "block", marginBottom: 4 }}>Notas / Condiciones de pago</label>
                <textarea value={invoice.notes} onChange={e => setInvoice(i => ({ ...i, notes: e.target.value }))} rows={3} placeholder="Pago a 30 días. Formas de pago aceptadas: transferencia bancaria, PayPal, Stripe..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--ink3)", border: "1px solid var(--ink4)", color: "var(--t)", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          </div>

          {/* RIGHT: Summary */}
          <div>
            {/* Totals */}
            <div style={{ background: "var(--ink2)", borderRadius: 12, padding: 20, marginBottom: 16, position: "sticky", top: 20 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "var(--t)" }}>💰 Resumen económico</h3>
              {[
                { label: "Subtotal", value: subtotal, size: 16 },
                { label: `IVA ${invoice.taxPct}%`, value: tax, size: 14 },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--t3)" }}>{r.label}</span>
                  <span style={{ fontSize: r.size, fontWeight: 700, color: "var(--t)" }}>€{r.value.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: "2px solid var(--jade)", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "var(--t)" }}>TOTAL</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: "var(--jade)" }}>€{total.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(96,165,250,0.08)", borderRadius: 8, border: "1px solid rgba(96,165,250,0.2)" }}>
                <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6, fontWeight: 700 }}>📊 ANÁLISIS RÁPIDO</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--t3)" }}>Horas totales</span>
                    <span style={{ color: "var(--t)", fontWeight: 700 }}>{totalHours.toFixed(1)}h</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--t3)" }}>Tarifa media</span>
                    <span style={{ color: "var(--gold)", fontWeight: 700 }}>€{totalHours > 0 ? (subtotal / totalHours).toFixed(0) : "-"}/h</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--t3)" }}>Neto estimado (30%)</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>€{(subtotal * 0.7).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <button onClick={() => { saveInvoice(); setTab("preview"); }} style={{ padding: "10px", background: "#10b981", border: "none", borderRadius: 9, color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <FileText size={14} /> Vista Previa & Guardar
                </button>
                <button onClick={saveInvoice} style={{ padding: "10px", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 9, color: "var(--t3)", cursor: "pointer", fontSize: 13 }}>
                  💾 Guardar borrador
                </button>
              </div>

              {/* Category breakdown */}
              {invoice.items.filter(it => it.description).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--t3)", fontWeight: 700, marginBottom: 8 }}>DESGLOSE POR CATEGORÍA</div>
                  {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                    const catSubtotal = invoice.items.filter(it => it.category === cat).reduce((s, it) => s + (it.subtotal || 0), 0);
                    if (!catSubtotal) return null;
                    const pct = subtotal > 0 ? (catSubtotal / subtotal) * 100 : 0;
                    return (
                      <div key={cat} style={{ marginBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: meta.color }}>{meta.icon} {meta.label}</span>
                          <span style={{ color: "var(--t)", fontWeight: 700 }}>€{catSubtotal.toFixed(0)}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: "var(--ink4)" }}>
                          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: meta.color, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW TAB */}
      {tab === "preview" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={printInvoice} style={{ padding: "8px 16px", background: "var(--ink2)", border: "1px solid var(--ink4)", borderRadius: 9, color: "var(--t3)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Printer size={14} /> Imprimir / PDF
            </button>
          </div>
          <div ref={printRef} style={{ background: "#fff", color: "#111", borderRadius: 12, padding: "40px 48px", maxWidth: 800, margin: "0 auto", boxShadow: "0 4px 40px rgba(0,0,0,0.3)" }}>
            {/* Invoice header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#111", letterSpacing: -1 }}>FACTURA</div>
                <div style={{ fontSize: 15, color: "#666", marginTop: 4 }}>{invoice.number}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#111" }}>Shopy Crafter Agency</div>
                <div style={{ fontSize: 13, color: "#666" }}>Agencia Digital IA Premium</div>
                <div style={{ marginTop: 8, padding: "4px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, display: "inline-block", fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
                  {invoice.status === "pagada" ? "✓ PAGADA" : invoice.status === "enviada" ? "ENVIADA" : "BORRADOR"}
                </div>
              </div>
            </div>

            {/* Bill to */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Facturar a</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>{invoice.client || "—"}</div>
                <div style={{ fontSize: 14, color: "#555", marginTop: 2 }}>{invoice.project}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Detalles</div>
                <table style={{ fontSize: 13, borderCollapse: "collapse" }}>
                  <tbody>
                    <tr><td style={{ paddingRight: 16, color: "#888" }}>Fecha de emisión</td><td style={{ fontWeight: 600 }}>{invoice.date}</td></tr>
                    <tr><td style={{ paddingRight: 16, color: "#888" }}>Vencimiento</td><td style={{ fontWeight: 600 }}>{invoice.dueDate}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Items table */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>DESCRIPCIÓN</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", width: 80 }}>CANT.</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", width: 90 }}>PRECIO</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", width: 100 }}>SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.filter(it => it.description).map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "#fafafa" : "#fff" }}>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#111" }}>{item.description}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{CATEGORY_META[item.category].icon} {CATEGORY_META[item.category].label}</div>
                    </td>
                    <td style={{ textAlign: "right", padding: "12px 12px", fontSize: 14, color: "#374151" }}>
                      {item.unit === "fijo" ? "—" : item.unit === "horas" ? `${item.hours}h` : `${item.quantity} uds`}
                    </td>
                    <td style={{ textAlign: "right", padding: "12px 12px", fontSize: 14, color: "#374151" }}>€{item.rate.toFixed(2)}{item.unit === "horas" ? "/h" : item.unit === "unidades" ? "/ud" : ""}</td>
                    <td style={{ textAlign: "right", padding: "12px 12px", fontSize: 14, fontWeight: 700, color: "#111" }}>€{(item.subtotal || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ width: 280 }}>
                {[{ label: "Subtotal", value: `€${subtotal.toFixed(2)}` }, { label: `IVA ${invoice.taxPct}%`, value: `€${tax.toFixed(2)}` }].map(r => (
                  <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14, color: "#64748b" }}>
                    <span>{r.label}</span><span style={{ fontWeight: 600, color: "#111" }}>{r.value}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 4, background: "#f8fafc", borderRadius: 8, paddingLeft: 12, paddingRight: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>TOTAL</span>
                  <span style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>€{total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div style={{ marginTop: 32, padding: "16px 20px", background: "#f8fafc", borderRadius: 10, borderLeft: "3px solid #10b981" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>NOTAS</div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{invoice.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div>
          {savedInvoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
              <FileText size={40} style={{ opacity: 0.2, marginBottom: 12 }} /><br />
              No hay facturas guardadas todavía
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[...savedInvoices].reverse().map(inv => (
                <div key={inv.id} style={{ background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--t)", fontSize: 14 }}>{inv.number} — {inv.client || "Sin cliente"}</div>
                    <div style={{ fontSize: 12, color: "var(--t3)" }}>{inv.project} · {inv.date} · {inv.items.filter(it => it.description).length} servicios</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#4ade80" }}>€{(inv.items.reduce((s, it) => s + (it.subtotal || 0), 0) * (1 + inv.taxPct / 100)).toFixed(2)}</div>
                  <button onClick={() => loadInvoice(inv)} style={{ padding: "7px 14px", background: "var(--jade)", border: "none", borderRadius: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Cargar</button>
                  <button onClick={() => { setSavedInvoices(prev => { const upd = prev.filter(i => i.id !== inv.id); localStorage.setItem("sc_invoices", JSON.stringify(upd)); return upd; }); }} style={{ padding: "7px 12px", background: "rgba(248,113,113,0.1)", border: "none", borderRadius: 8, color: "#f87171", fontSize: 12, cursor: "pointer" }}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
