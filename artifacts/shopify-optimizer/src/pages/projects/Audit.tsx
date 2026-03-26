import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  useGetProjectProducts,
  useSyncProducts,
  useGetCatalogOpportunities,
  getGetProjectProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Search,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Package,
  ShoppingBag,
  Tag,
  DollarSign,
  CheckCircle2,
  Plus,
  X,
  Sparkles,
  Loader2,
  ExternalLink,
  Key,
} from "lucide-react";
import { formatCurrency, getGradeColor } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import SaveReportButton from "@/components/SaveReportButton";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CreateProductForm {
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string;
  price: string;
  compareAtPrice: string;
  status: "draft" | "active";
  aiGenerate: boolean;
  trackInventory: boolean;
  quantity: string;
  requiresShipping: boolean;
  sku: string;
  weight: string;
  options: Array<{ name: string; values: string }>;
}

const INITIAL_FORM: CreateProductForm = {
  title: "", bodyHtml: "", vendor: "", productType: "", tags: "",
  price: "0.00", compareAtPrice: "", status: "draft", aiGenerate: true,
  trackInventory: false, quantity: "", requiresShipping: true, sku: "",
  weight: "", options: [],
};

function CreateProductModal({ projectId, onClose, onCreated }: {
  projectId: number; onClose: () => void;
  onCreated: (product: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<CreateProductForm>(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  const set = (k: keyof CreateProductForm, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const addOption = () => {
    if (form.options.length >= 3) return;
    setForm(p => ({ ...p, options: [...p.options, { name: "", values: "" }] }));
  };
  const removeOption = (i: number) => {
    setForm(p => ({ ...p, options: p.options.filter((_, idx) => idx !== i) }));
  };
  const updateOption = (i: number, field: "name" | "values", val: string) => {
    setForm(p => ({
      ...p,
      options: p.options.map((o, idx) => idx === i ? { ...o, [field]: val } : o),
    }));
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { setError("El título es obligatorio"); return; }
    setCreating(true); setError("");
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        bodyHtml: form.bodyHtml || undefined,
        vendor: form.vendor || undefined,
        productType: form.productType || undefined,
        tags: form.tags || undefined,
        price: form.price || "0.00",
        compareAtPrice: form.compareAtPrice || undefined,
        status: form.status,
        aiGenerate: form.aiGenerate,
        trackInventory: form.trackInventory,
        quantity: form.quantity ? parseInt(form.quantity) : undefined,
        requiresShipping: form.requiresShipping,
      };

      if (form.options.length > 0) {
        const validOpts = form.options.filter(o => o.name && o.values);
        if (validOpts.length > 0) {
          body.options = validOpts.map(o => ({
            name: o.name,
            values: o.values.split(",").map(v => v.trim()).filter(Boolean),
          }));
          const variantCombos: Record<string, unknown>[] = [];
          const allValues = validOpts.map(o => o.values.split(",").map(v => v.trim()).filter(Boolean));
          const totalCombos = allValues.reduce((acc, v) => acc * v.length, 1);
          if (totalCombos > 100) {
            setError(`Demasiadas combinaciones de variantes (${totalCombos}). Shopify permite máximo 100.`);
            setCreating(false);
            return;
          }
          const generate = (current: string[], depth: number) => {
            if (depth === allValues.length) {
              const variant: Record<string, unknown> = {
                price: form.price || "0.00",
                compareAtPrice: form.compareAtPrice || null,
                sku: form.sku || null,
                trackInventory: form.trackInventory,
                quantity: form.quantity ? parseInt(form.quantity) : null,
                requiresShipping: form.requiresShipping,
                weight: form.weight ? parseFloat(form.weight) : null,
              };
              current.forEach((v, i) => { variant[`option${i + 1}`] = v; });
              variantCombos.push(variant);
              return;
            }
            for (const val of allValues[depth]) {
              generate([...current, val], depth + 1);
            }
          };
          generate([], 0);
          body.variants = variantCombos;
        }
      }

      const res = await fetch(`${API}/api/projects/${projectId}/products/create`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando producto");
      setResult(data.product);
      onCreated(data.product);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    }
    setCreating(false);
  };

  const inputStyle = "w-full bg-[var(--ink2)] border border-[var(--bdr)] rounded-lg px-3 py-2.5 text-sm text-[var(--t1)] placeholder:text-[var(--t4)] focus:outline-none focus:border-[var(--gold)] transition-colors";
  const labelStyle = "block text-xs font-semibold text-[var(--t3)] mb-1.5 uppercase tracking-wider";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    }} onClick={onClose}>
      <div style={{
        background: "var(--ink)", border: "1px solid rgba(200,168,75,0.25)", borderRadius: 16,
        width: "min(640px, 94vw)", maxHeight: "88vh", overflow: "auto",
        boxShadow: "0 16px 64px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>

        <div style={{
          padding: "18px 24px", borderBottom: "1px solid var(--bdr)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "linear-gradient(135deg, rgba(200,168,75,0.06), transparent)",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>Crear Producto en Shopify</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3)" }}>
              Se crea directamente en la tienda del cliente
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {result ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
              background: "rgba(45,212,159,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CheckCircle2 size={28} style={{ color: "#2dd49f" }} />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>Producto Creado</h3>
            <p style={{ fontSize: 14, color: "var(--t2)", margin: "0 0 16px" }}>
              <strong>{result.title as string}</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginBottom: 20 }}>
              {[
                ["Estado", result.status as string],
                ["Variantes", String(result.variants)],
                ["Score", `${result.auditScore}/100 (${result.auditGrade})`],
                ["IA", result.aiGenerated ? "Contenido generado por ShopyBrain" : "Contenido manual"],
              ].map(([l, v]) => (
                <div key={l} style={{ fontSize: 13, color: "var(--t2)" }}>
                  <span style={{ color: "var(--t3)" }}>{l}: </span><strong>{v}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <a href={result.url as string} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px",
                  background: "linear-gradient(135deg, #c8a84b, #e8c87b)", color: "#000",
                  borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none",
                }}>
                <ExternalLink size={14} /> Ver en Shopify
              </a>
              <button onClick={() => { setResult(null); setForm(INITIAL_FORM); }}
                style={{
                  padding: "10px 20px", background: "var(--ink2)", border: "1px solid var(--bdr)",
                  borderRadius: 10, fontWeight: 600, fontSize: 13, color: "var(--t2)", cursor: "pointer",
                }}>
                Crear otro
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: form.aiGenerate ? "rgba(200,168,75,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${form.aiGenerate ? "rgba(200,168,75,0.3)" : "var(--bdr)"}`,
              borderRadius: 10, cursor: "pointer",
            }} onClick={() => set("aiGenerate", !form.aiGenerate)}>
              <Sparkles size={18} style={{ color: form.aiGenerate ? "var(--gold)" : "var(--t4)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: form.aiGenerate ? "var(--gold)" : "var(--t2)" }}>
                  ShopyBrain genera el contenido
                </div>
                <div style={{ fontSize: 11, color: "var(--t3)" }}>
                  Título, descripción, tags y SEO optimizados por IA
                </div>
              </div>
              <div style={{
                width: 36, height: 20, borderRadius: 10, position: "relative",
                background: form.aiGenerate ? "var(--gold)" : "rgba(255,255,255,0.1)",
                transition: "background 0.2s",
              }}>
                <div style={{
                  position: "absolute", top: 2, width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                  left: form.aiGenerate ? 18 : 2,
                }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className={labelStyle}>Título del producto *</label>
                <input className={inputStyle} value={form.title} onChange={e => set("title", e.target.value)}
                  placeholder="Ej: Camiseta Premium Algodón Orgánico" />
              </div>

              {!form.aiGenerate && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className={labelStyle}>Descripción (HTML)</label>
                  <textarea className={inputStyle} value={form.bodyHtml} onChange={e => set("bodyHtml", e.target.value)}
                    placeholder="Descripción del producto..." rows={4} style={{ resize: "vertical" }} />
                </div>
              )}

              <div>
                <label className={labelStyle}>Precio</label>
                <input className={inputStyle} type="number" step="0.01" value={form.price}
                  onChange={e => set("price", e.target.value)} placeholder="29.99" />
              </div>
              <div>
                <label className={labelStyle}>Precio anterior (tachado)</label>
                <input className={inputStyle} type="number" step="0.01" value={form.compareAtPrice}
                  onChange={e => set("compareAtPrice", e.target.value)} placeholder="39.99" />
              </div>

              <div>
                <label className={labelStyle}>Vendor / Marca</label>
                <input className={inputStyle} value={form.vendor} onChange={e => set("vendor", e.target.value)}
                  placeholder="Nombre de la marca" />
              </div>
              <div>
                <label className={labelStyle}>Tipo de producto</label>
                <input className={inputStyle} value={form.productType} onChange={e => set("productType", e.target.value)}
                  placeholder="Ej: Camisetas, Electrónica..." />
              </div>

              {!form.aiGenerate && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className={labelStyle}>Tags (separados por coma)</label>
                  <input className={inputStyle} value={form.tags} onChange={e => set("tags", e.target.value)}
                    placeholder="moda, premium, algodón, verano" />
                </div>
              )}

              <div>
                <label className={labelStyle}>SKU</label>
                <input className={inputStyle} value={form.sku} onChange={e => set("sku", e.target.value)}
                  placeholder="SKU-001" />
              </div>
              <div>
                <label className={labelStyle}>Peso (kg)</label>
                <input className={inputStyle} type="number" step="0.01" value={form.weight}
                  onChange={e => set("weight", e.target.value)} placeholder="0.5" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.trackInventory}
                  onChange={e => set("trackInventory", e.target.checked)} id="inv" />
                <label htmlFor="inv" style={{ fontSize: 13, color: "var(--t2)", cursor: "pointer" }}>
                  Control de inventario
                </label>
              </div>
              {form.trackInventory && (
                <div>
                  <label className={labelStyle}>Cantidad inicial</label>
                  <input className={inputStyle} type="number" value={form.quantity}
                    onChange={e => set("quantity", e.target.value)} placeholder="100" />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={form.requiresShipping}
                  onChange={e => set("requiresShipping", e.target.checked)} id="ship" />
                <label htmlFor="ship" style={{ fontSize: 13, color: "var(--t2)", cursor: "pointer" }}>
                  Requiere envío
                </label>
              </div>
              <div>
                <label className={labelStyle}>Estado</label>
                <select className={inputStyle} value={form.status} onChange={e => set("status", e.target.value)}>
                  <option value="draft">Borrador</option>
                  <option value="active">Activo (publicado)</option>
                </select>
              </div>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label className={labelStyle} style={{ margin: 0 }}>Opciones / Variantes</label>
                {form.options.length < 3 && (
                  <button onClick={addOption} style={{
                    background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 8,
                    padding: "4px 10px", fontSize: 11, color: "var(--t2)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Plus size={11} /> Añadir opción
                  </button>
                )}
              </div>
              {form.options.length === 0 && (
                <p style={{ fontSize: 11, color: "var(--t4)", margin: 0 }}>
                  Sin opciones = producto simple. Añade opciones para crear variantes (ej: Talla, Color).
                </p>
              )}
              {form.options.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input className={inputStyle} style={{ width: 120 }} value={opt.name}
                    onChange={e => updateOption(i, "name", e.target.value)} placeholder="Ej: Talla" />
                  <input className={inputStyle} style={{ flex: 1 }} value={opt.values}
                    onChange={e => updateOption(i, "values", e.target.value)} placeholder="S, M, L, XL" />
                  <button onClick={() => removeOption(i)} style={{
                    background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 4,
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                padding: "10px 14px", background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8,
                fontSize: 13, color: "#ef4444",
              }}>
                {error}
              </div>
            )}

            <button onClick={handleCreate} disabled={creating || !form.title.trim()}
              style={{
                width: "100%", padding: "13px", borderRadius: 11, border: "none",
                background: !form.title.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #c8a84b, #e8c87b)",
                color: !form.title.trim() ? "var(--t3)" : "#000",
                fontWeight: 700, fontSize: 14, cursor: creating || !form.title.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                opacity: creating ? 0.75 : 1, transition: "all 0.2s",
              }}>
              {creating ? (
                <><Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} />
                  {form.aiGenerate ? "ShopyBrain generando contenido..." : "Creando en Shopify..."}</>
              ) : (
                <><Plus size={15} /> Crear producto en Shopify</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type OppDifficulty = "Fácil" | "Media" | "Difícil";

const DIFFICULTY_COLOR: Record<OppDifficulty, string> = {
  Fácil: "text-green-400 bg-green-500/10 border-green-500/20",
  Media: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Difícil: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function AuditPage() {
  const [, params] = useRoute("/projects/:id/audit");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();

  const [filterGrade, setFilterGrade] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"products" | "opportunities">("products");
  const [scanStatus, setScanStatus] = useState<"idle" | "syncing" | "auditing">("idle");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scanError, setScanError] = useState<string>("");
  const [scanResult, setScanResult] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenMsg, setTokenMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const { data, isLoading, refetch } = useGetProjectProducts(projectId, { grade: filterGrade || undefined });
  const syncProducts = useSyncProducts();
  const getCatalogOpps = useGetCatalogOpportunities();
  const oppsData = getCatalogOpps.data ?? [];
  const isLoadingOpps = getCatalogOpps.isPending;
  const refetchOpps = () => getCatalogOpps.mutate({ projectId });

  const handleScan = async () => {
    setScanStatus("syncing");
    setScanError("");
    setScanResult("");
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/products/sync`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusFilter: "any" }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || `Error ${res.status}`);
      }
      setScanStatus("auditing");
      setScanResult(`${result.synced} productos sincronizados${result.removed > 0 ? `, ${result.removed} eliminados` : ""}. Score medio: ${result.avgScore ? Math.round(result.avgScore) : "—"}/100`);
      await new Promise((r) => setTimeout(r, 400));
      await queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
      await refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setScanError(msg.includes("401") || msg.includes("403") ? "Token expirado o inválido. Regenera el token primero." : msg);
    } finally {
      setScanStatus("idle");
    }
  };

  const handleRegenerateToken = async () => {
    setTokenLoading(true);
    setTokenMsg(null);
    try {
      const res = await fetch(`${API}/api/shopybrain/execute-action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate_token", params: { projectId } }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Error regenerando token");
      }
      setTokenMsg({ text: data.message || "Token regenerado correctamente", ok: true });
    } catch (e: unknown) {
      setTokenMsg({ text: e instanceof Error ? e.message : "Error regenerando token", ok: false });
    } finally {
      setTokenLoading(false);
    }
  };

  const isScanning = scanStatus !== "idle";
  const products = data?.products || [];

  const needImprovement =
    (data?.gradeCounts?.C || 0) + (data?.gradeCounts?.D || 0) + (data?.gradeCounts?.F || 0);
  const pctNeedImprovement = data?.total ? Math.round((needImprovement / data.total) * 100) : 0;
  const revImpact = data?.avgScore ? Math.round((100 - data.avgScore) * 12.5) : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Auditoría del Catálogo</h1>
          <p className="text-muted-foreground mt-1">
            {data?.total ? (
              <>
                {data.total} productos
                {(data as any).statusCounts && (
                  <span className="ml-2 text-xs">
                    ({(data as any).statusCounts.active > 0 ? `${(data as any).statusCounts.active} activos` : ""}
                    {(data as any).statusCounts.draft > 0 ? `, ${(data as any).statusCounts.draft} borradores` : ""}
                    {(data as any).statusCounts.archived > 0 ? `, ${(data as any).statusCounts.archived} archivados` : ""}
                    {" · "}
                    {(data as any).publishedCount ?? 0} publicados, {(data as any).unpublishedCount ?? 0} sin publicar)
                  </span>
                )}
              </>
            ) : "Escanea tu tienda para comenzar"}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center">
          <SaveReportButton
            projectId={projectId}
            title="Auditoría del Catálogo"
            fileType="audit"
            category="catalog_audit"
            compact
            buildContent={() => {
              const products = data?.products || [];
              const grades: Record<string, number> = {};
              products.forEach((p: any) => { grades[p.grade || "?"] = (grades[p.grade || "?"] || 0) + 1; });
              const avgScore = products.length > 0 ? (products.reduce((s: number, p: any) => s + (p.auditScore || 0), 0) / products.length).toFixed(1) : "0";
              return `
<h2>Resumen de la Auditoría</h2>
<div class="metric-grid">
  <div class="metric-card"><div class="label">Total Productos</div><div class="value">${products.length}</div></div>
  <div class="metric-card"><div class="label">Score Medio</div><div class="value">${avgScore}</div><div class="sub">de 100</div></div>
  <div class="metric-card"><div class="label">Grado A</div><div class="value status-ok">${grades["A"] || 0}</div></div>
  <div class="metric-card"><div class="label">Grado B</div><div class="value">${grades["B"] || 0}</div></div>
  <div class="metric-card"><div class="label">Grado C</div><div class="value status-warn">${grades["C"] || 0}</div></div>
  <div class="metric-card"><div class="label">Grado D-F</div><div class="value status-bad">${(grades["D"] || 0) + (grades["F"] || 0)}</div></div>
</div>
<h2>Distribución por Grado</h2>
<table><tr><th>Grado</th><th>Cantidad</th><th>% del Total</th></tr>
${["A", "B", "C", "D", "F"].map(g => `<tr><td><strong>${g}</strong></td><td>${grades[g] || 0}</td><td>${products.length ? ((grades[g] || 0) / products.length * 100).toFixed(1) : 0}%</td></tr>`).join("")}
</table>
<h2>Detalle por Producto</h2>
<table><tr><th>Producto</th><th>Grado</th><th>Score</th><th>Precio</th><th>Estado</th></tr>
${products.slice(0, 100).map((p: any) => `<tr><td>${p.title}</td><td><strong>${p.grade || "?"}</strong></td><td>${Math.round(p.auditScore || 0)}/100</td><td>${p.price ? p.price + "€" : "—"}</td><td>${p.status === "active" ? '<span class="status-ok">Activo</span>' : '<span class="status-warn">Borrador</span>'}</td></tr>`).join("")}
</table>
${oppsData.length > 0 ? `<h2>Oportunidades Detectadas</h2><ul>${oppsData.slice(0, 20).map((o: any) => `<li><strong>${o.type}:</strong> ${o.title} — ${o.description || ""}</li>`).join("")}</ul>` : ""}`;
            }}
          />
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[var(--gold)] text-black px-5 py-3 rounded-xl font-semibold flex items-center gap-2 hover:brightness-110 transition-all shadow-[0_0_15px_rgba(200,168,75,0.3)]"
          >
            <Plus className="w-5 h-5" />
            Crear Producto
          </button>
          <button
            onClick={handleRegenerateToken}
            disabled={tokenLoading}
            className="border border-[var(--gold)]/40 text-[var(--gold)] px-4 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-[var(--gold)]/10 transition-all disabled:opacity-60"
          >
            {tokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Regenerar Token
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="bg-primary text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-70"
          >
            <RefreshCw className={`w-5 h-5 ${isScanning ? "animate-spin" : ""}`} />
            {scanStatus === "syncing"
              ? "Sincronizando Shopify..."
              : scanStatus === "auditing"
              ? "Calculando scores..."
              : "Escanear Tienda"}
          </button>
        </div>
      </div>

      {scanError && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{scanError}</span>
        </div>
      )}
      {scanResult && !scanError && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{scanResult}</span>
        </div>
      )}
      {tokenMsg && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${tokenMsg.ok ? "border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold)]" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {tokenMsg.ok ? <Key className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{tokenMsg.text}</span>
        </div>
      )}

      {showCreateModal && (
        <CreateProductModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
          }}
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard delay={0.1} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Productos</p>
              <h3 className="text-2xl font-bold text-foreground">{data?.total || 0}</h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.2} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Score Promedio</p>
              <h3 className="text-2xl font-bold text-foreground">
                {data?.avgScore ? Math.round(data.avgScore) : 0}
                <span className="text-sm text-muted-foreground">/100</span>
              </h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.3} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Necesitan Mejora</p>
              <h3 className="text-2xl font-bold text-foreground">
                {needImprovement}
                <span className="text-sm text-muted-foreground ml-1">({pctNeedImprovement}%)</span>
              </h3>
            </div>
          </div>
        </GlassCard>
        <GlassCard delay={0.4} className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Revenue Potencial</p>
              <h3 className="text-2xl font-bold text-[#00d68f]">+{formatCurrency(revImpact)}</h3>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Grade Distribution */}
      {data?.gradeCounts && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Distribución de Grados</h3>
            <div className="flex gap-2">
              {(["A", "B", "C", "D", "F"] as const).map((g) => (
                <div key={g} className="flex items-center gap-1">
                  <span
                    className="text-xs font-bold w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${getGradeColor(g)}20`, color: getGradeColor(g) }}
                  >
                    {g}
                  </span>
                  <span className="text-xs text-muted-foreground">{data.gradeCounts?.[g] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {(["A", "B", "C", "D", "F"] as const).map((g) => {
              const count = data.gradeCounts?.[g] || 0;
              const pct = data.total ? (count / data.total) * 100 : 0;
              return pct > 0 ? (
                <div
                  key={g}
                  style={{ width: `${pct}%`, backgroundColor: getGradeColor(g) }}
                  className="h-full"
                  title={`Grado ${g}: ${count}`}
                />
              ) : null;
            })}
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5 pb-0">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all ${
            activeTab === "products"
              ? "text-primary bg-primary/10 border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          Catálogo ({data?.total || 0})
        </button>
        <button
          onClick={() => {
            setActiveTab("opportunities");
            if (!oppsData) refetchOpps();
          }}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all ${
            activeTab === "opportunities"
              ? "text-primary bg-primary/10 border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          Oportunidades de Catálogo
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">Resultados</h2>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="bg-card border border-white/10 rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Todos los grados</option>
              {(["A", "B", "C", "D", "F"] as const).map((g) => (
                <option key={g} value={g}>
                  Grado {g} ({data?.gradeCounts?.[g] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {products.map((product, idx) => (
              <GlassCard
                key={product.id}
                delay={0.05 * (idx % 10)}
                hoverEffect
                className="p-0 flex flex-col md:flex-row border-white/5 overflow-hidden"
              >
                <div className="w-full md:w-36 h-44 md:h-auto bg-black/40 relative flex-shrink-0">
                  {product.images?.[0]?.src ? (
                    <img
                      src={product.images[0].src}
                      alt={product.title}
                      className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      Sin Imagen
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    <GradeBadge grade={product.auditGrade} />
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="text-base font-bold text-foreground line-clamp-2">{product.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                        product.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        product.status === "draft" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      }`}>
                        {product.status === "active" ? "Activo" : product.status === "draft" ? "Borrador" : "Archivado"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                        product.publishedAt ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      }`}>
                        {product.publishedAt ? "Publicado" : "No publicado"}
                      </span>
                    </div>
                    <p className="text-primary font-medium text-sm">
                      {product.price ? formatCurrency(product.price) : "Sin precio"}
                    </p>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { label: "SEO", score: product.seoScore },
                        { label: "Img", score: product.imageScore },
                        { label: "Txt", score: product.descriptionScore },
                        { label: "Tít", score: product.titleScore },
                        { label: "Prc", score: product.priceScore },
                      ].map((axis, i) => (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${axis.score || 0}%`,
                                backgroundColor:
                                  (axis.score || 0) > 70
                                    ? "#00d68f"
                                    : (axis.score || 0) > 40
                                    ? "#ffd32a"
                                    : "#ff4757",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{axis.label}</span>
                        </div>
                      ))}
                    </div>

                    {product.auditProblems && product.auditProblems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {product.auditProblems.slice(0, 3).map((prob, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20"
                          >
                            {prob}
                          </span>
                        ))}
                        {product.auditProblems.length > 3 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-muted-foreground border border-white/10">
                            +{product.auditProblems.length - 3} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay productos. Haz clic en <strong>"Escanear Tienda"</strong> para sincronizar tu catálogo.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Opportunities Tab */}
      {activeTab === "opportunities" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">Oportunidades de Catálogo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Productos que tu nicho demanda y que aún no tienes en tu tienda.
              </p>
            </div>
            <button
              onClick={() => refetchOpps()}
              className="flex items-center gap-2 text-sm bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              Analizar con IA
            </button>
          </div>

          {isLoadingOpps && (
            <div className="flex items-center justify-center py-20 gap-3">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
              <p className="text-muted-foreground">Claude analizando tu nicho...</p>
            </div>
          )}

          {oppsData && oppsData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {oppsData.map((opp, i) => {
                const difficulty = opp.sourcingDifficulty as OppDifficulty;
                const diffClass = DIFFICULTY_COLOR[difficulty] ?? "text-muted-foreground bg-white/5 border-white/10";
                return (
                  <GlassCard key={i} delay={0.05 * i} className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-foreground">{opp.productName}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-md border flex-shrink-0 ${diffClass}`}>
                        {opp.sourcingDifficulty}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">{opp.whyItFits}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-semibold text-green-400">{opp.estimatedPriceMin}–{opp.estimatedPriceMax}€</span>
                      </div>
                      <button className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Crear Ficha
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {!isLoadingOpps && !oppsData?.length && (
            <div className="py-20 text-center">
              <Lightbulb className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Haz clic en <strong>"Analizar con IA"</strong> para que Claude detecte oportunidades de producto.
              </p>
              <p className="text-xs text-muted-foreground">
                (Requiere haber escaneado la tienda y configurado el nicho del proyecto)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
