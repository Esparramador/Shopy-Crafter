import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { GradeBadge } from "@/components/ui/GradeBadge";
import {
  useGetProjectProducts,
  useListProjects,
  useSyncProducts,
  useGetCatalogOpportunities,
  getGetProjectProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import{ RefreshCw, Search, AlertCircle, Lightbulb, Package, ShoppingBag, DollarSign, CheckCircle2, Plus, X, Sparkles, Loader2, ExternalLink, Key, Edit3, Save, Eye, EyeOff, Film, Box, ImageOff }from "lucide-react";
import CreateAdModal from "@/components/CreateAdModal";
import { formatCurrency, getGradeColor } from "@/lib/utils";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import SaveReportButton from "@/components/SaveReportButton";
import { LiveOperation } from "@/components/LiveOperation";
import { ModalOverlay } from "@/components/ModalOverlay";
import { getPlatform } from "@/lib/platform-capabilities";
import { Link } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");

interface EditableProduct{ id: string;
  title: string;
  handle: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  status: string;
  publishedAt: string | null;
  tags: string;
  price: string;
  compareAtPrice: string;
  images: Array<{ id: number; src: string; alt: string | null }>;
  [key: string]: unknown;
}

function ProductEditModal({ projectId, product, platformKey, onClose, onUpdated }: {
  projectId: number;
  product: EditableProduct;
  platformKey: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const norm = (v: unknown) => (v == null ? "" : String(v));
  const initTitle = norm(product.title);
  const initVendor = norm(product.vendor);
  const initProductType = norm(product.productType);
  const initTags = norm(product.tags);
  const initStatus = norm(product.status) || "active";
  const initPublished = !!product.publishedAt;
  const initPrice = norm(product.price) || "0.00";
  const initCompare = norm(product.compareAtPrice);
  const initHandle = norm(product.handle);
  const initBodyHtml = norm(product.bodyHtml);

  const [title, setTitle] = useState(initTitle);
  const [bodyHtml, setBodyHtml] = useState(initBodyHtml);
  const [vendor, setVendor] = useState(initVendor);
  const [productType, setProductType] = useState(initProductType);
  const [tags, setTags] = useState(initTags);
  const [status, setStatus] = useState(initStatus);
  const [published, setPublished] = useState(initPublished);
  const [price, setPrice] = useState(initPrice);
  const [compareAtPrice, setCompareAtPrice] = useState(initCompare);
  const [handle, setHandle] = useState(initHandle);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const hasChanges = useCallback(() => {
    return title !== initTitle ||
      bodyHtml !== initBodyHtml ||
      vendor !== initVendor ||
      productType !== initProductType ||
      tags !== initTags ||
      status !== initStatus ||
      published !== initPublished ||
      price !== initPrice ||
      compareAtPrice !== initCompare ||
      handle !== initHandle;
  }, [title, bodyHtml, vendor, productType, tags, status, published, price, compareAtPrice, handle,
      initTitle, initBodyHtml, initVendor, initProductType, initTags, initStatus, initPublished, initPrice, initCompare, initHandle]);

  const isValidPrice = (v: string) => v === "" || /^\d+(\.\d{0,2})?$/.test(v);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("El título no puede estar vacío");
      return;
    }
    if (price && !isValidPrice(price)) {
      setError("El precio debe ser un número válido (ej: 12.99)");
      return;
    }
    if (compareAtPrice && !isValidPrice(compareAtPrice)) {
      setError("El precio de comparación debe ser un número válido");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    const updates: Record<string, unknown> = {};
    if (title !== initTitle) updates.title = title;
    if (bodyHtml !== initBodyHtml) updates.bodyHtml = bodyHtml;
    if (vendor !== initVendor) updates.vendor = vendor;
    if (productType !== initProductType) updates.productType = productType;
    if (tags !== initTags) updates.tags = tags;
    if (status !== initStatus) updates.status = status;
    if (published !== initPublished) updates.published = published;
    if (handle !== initHandle) updates.handle = handle;

    const priceChanged = price !== initPrice;
    const compareChanged = compareAtPrice !== initCompare;
    if (priceChanged || compareChanged) {
      const variantUpdate: Record<string, unknown> = {};
      if (priceChanged) variantUpdate.price = price;
      if (compareChanged) variantUpdate.compareAtPrice = compareAtPrice || null;
      updates.variants = [variantUpdate];
    }

    if (Object.keys(updates).length === 0) {
      setError("No hay cambios para guardar");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API}/api/projects/${projectId}/products/${product.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setSuccessMsg("Producto actualizado y re-auditado");
      setTimeout(() => {
        onUpdated();
        onClose();
      }, 1000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: "active", label: "Activo", desc: "Visible en la tienda", color: "text-green-400" },
    { value: "draft", label: "Borrador", desc: "No visible, en edición", color: "text-yellow-400" },
    { value: "archived", label: "Archivado", desc: "Oculto, almacenado", color: "text-gray-400" },
  ];

  return (
    <ModalOverlay className="backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-white/10 p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Editar Producto</h2>
              <p className="text-xs text-muted-foreground">Los cambios se aplican directamente en tu tienda</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {product.images?.[0]?.src && (
            <div className="flex items-center gap-4">
              <img src={product.images[0].src} alt={product.title} className="w-16 h-16 rounded-lg object-cover border border-white/10" />
              <div>
                <p className="text-sm font-semibold text-foreground">{product.title}</p>
                <p className="text-xs text-muted-foreground">ID: {product.id}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Título</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descripción (HTML)</label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={5}
                placeholder="Descripción del producto en HTML..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors resize-y min-h-[80px]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Precio (€)</label>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Precio comparación (€)</label>
              <input
                type="text"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="Precio tachado"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Proveedor / Marca</label>
              <input
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo de Producto</label>
              <input
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="Ej: Camiseta, Poster, Figura..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {platformKey === "prestashop" ? "URL amigable" : platformKey === "woocommerce" ? "Slug del producto" : "URL Handle"}
              </label>
              <div className="flex items-center gap-2">
                {platformKey !== "prestashop" && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{platformKey === "woocommerce" ? "/product/" : "/products/"}</span>
                )}
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Etiquetas (separadas por coma)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comic, manga, coleccionable, ..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Estado del Producto</label>
            <div className="grid grid-cols-3 gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    status === opt.value
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-white/10 bg-black/20 hover:border-white/20"
                  }`}
                >
                  <span className={`text-sm font-semibold ${opt.color}`}>{opt.label}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Visibilidad</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPublished(true)}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  published
                    ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <Eye className={`w-5 h-5 ${published ? "text-blue-400" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <span className="text-sm font-semibold text-blue-400">Publicado</span>
                  <p className="text-[10px] text-muted-foreground">Visible en canales de venta</p>
                </div>
              </button>
              <button
                onClick={() => setPublished(false)}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                  !published
                    ? "border-orange-500/50 bg-orange-500/10 ring-1 ring-orange-500/30"
                    : "border-white/10 bg-black/20 hover:border-white/20"
                }`}
              >
                <EyeOff className={`w-5 h-5 ${!published ? "text-orange-400" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <span className="text-sm font-semibold text-orange-400">No publicado</span>
                  <p className="text-[10px] text-muted-foreground">Oculto en todos los canales</p>
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{successMsg}</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card/95 backdrop-blur-md border-t border-white/10 p-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </motion.div>
    </ModalOverlay>
  );
}

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
            setError(`Demasiadas combinaciones de variantes (${totalCombos}). El máximo permitido es 100.`);
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
    <ModalOverlay style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={onClose}>
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
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>Crear Producto</h2>
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
                ["IA", result.aiGenerated ? "Contenido generado por Shopy Crafter" : "Contenido manual"],
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
                <ExternalLink size={14} /> Ver en tienda
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
                  Shopy Crafter genera el contenido
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 14 }}>
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
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <input className={inputStyle} style={{ width: 120, minWidth: 80, flex: "0 1 120px" }} value={opt.name}
                    onChange={e => updateOption(i, "name", e.target.value)} placeholder="Ej: Talla" />
                  <input className={inputStyle} style={{ flex: 1, minWidth: 120 }} value={opt.values}
                    onChange={e => updateOption(i, "values", e.target.value)} placeholder="S, M, L, XL" />
                  <button onClick={() => removeOption(i)} aria-label="Eliminar opción" style={{
                    background: "none", border: "none", cursor: "pointer", color: "var(--t4)", padding: 8, minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <X size={16} />
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
                  {form.aiGenerate ? "Shopy Crafter generando contenido..." : "Creando producto..."}</>
              ) : (
                <><Plus size={15} /> Crear producto</>
              )}
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

type OppDifficulty = "Fácil" | "Media" | "Difícil";

const DIFFICULTY_COLOR: Record<OppDifficulty, string> = {
  Fácil: "text-green-400 bg-green-500/10 border-green-500/20",
  Media: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Difícil: "text-red-400 bg-red-500/10 border-red-500/20",
};

// ─── Tripo3D Auto-Generate Modal ─────────────────────────────────────────────
type Model3dProduct = {
  id: string;
  title: string;
  productType?: string;
  bodyHtml?: string;
  imageUrl?: string;
};

function Tripo3DAutoModal({
  projectId,
  product,
  onClose,
}: {
  projectId: number;
  product: Model3dProduct;
  onClose: () => void;
}) {
  const API = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [phase, setPhase] = useState<"generating" | "done" | "error">("generating");
  const [messages, setMessages] = useState<string[]>(["Iniciando generación 3D..."]);
  const [prompt, setPrompt] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ modelUrl?: string; previewUrl?: string; vaultId?: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const start = useCallback(async () => {
    setPhase("generating");
    setMessages(["Iniciando generación 3D..."]);
    setProgress(0);
    setResult(null);
    setErrorMsg("");
    setPrompt("");
    try {
      const res = await fetch(`${API}/api/tripo3d/auto-generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          productId: product.id,
          productTitle: product.title,
          productType: product.productType || "",
          bodyHtml: product.bodyHtml || "",
          imageUrl: product.imageUrl || null,
        }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.message) setMessages(prev => [...prev.slice(-5), ev.message]);
            if (ev.prompt) setPrompt(ev.prompt);
            if (typeof ev.progress === "number") setProgress(ev.progress);
            if (ev.event === "done") {
              setResult({ modelUrl: ev.model_url, previewUrl: ev.preview_url, vaultId: ev.vault_id });
              setProgress(100);
              setPhase("done");
            }
            if (ev.event === "error") {
              setErrorMsg(ev.error || "Error desconocido");
              setPhase("error");
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Error de conexión");
      setPhase("error");
    }
  }, [API, projectId, product]);

  useEffect(() => { start(); }, [start]);

  const hasImage = !!product.imageUrl;

  return (
    <ModalOverlay
      className="backdrop-blur-sm"
      onClick={phase !== "generating" ? onClose : undefined}
    >
      <div
        className="bg-[#0d0d1a] border border-cyan-500/25 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ boxShadow: "0 0 60px rgba(6,182,212,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-xl">🧊</div>
            <div>
              <h3 className="text-base font-bold text-white">Modelo 3D Automático</h3>
              <p className="text-xs text-cyan-400/60 truncate max-w-[200px]">{product.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode badge */}
        <div className="mb-4 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400">
          {hasImage ? (
            <>
              <img src={product.imageUrl} className="w-8 h-8 rounded object-cover flex-shrink-0" />
              <span>Usando imagen del producto → <span className="text-cyan-400">image-to-model</span></span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <span>Sin imagen → IA genera prompt profesional → <span className="text-cyan-400">text-to-model</span></span>
            </>
          )}
        </div>

        {/* Generating */}
        {phase === "generating" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
              <p className="text-sm text-cyan-300 font-medium truncate flex-1">
                {messages[messages.length - 1] || "Procesando..."}
              </p>
            </div>
            {progress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Progreso de renderizado</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {prompt && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-[10px] text-gray-500 mb-1.5 uppercase tracking-wider font-medium">Prompt 3D generado por IA</p>
                <p className="text-xs text-gray-300 leading-relaxed line-clamp-4">{prompt}</p>
              </div>
            )}
            <p className="text-center text-xs text-gray-600">Proceso: 2-5 min · Puedes cerrar y volver al panel</p>
          </div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden border border-cyan-500/20 aspect-square bg-black/40">
              {result.previewUrl ? (
                <img src={result.previewUrl} alt="Preview modelo 3D" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <span className="text-5xl">🧊</span>
                  <span className="text-xs text-gray-500">Modelo generado</span>
                </div>
              )}
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-300 font-semibold">Modelo 3D listo y guardado ✓</p>
                {result.vaultId && (
                  <p className="text-xs text-green-400/60 mt-0.5">Vault ID #{result.vaultId} · disponible en 🗂 Vault</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {result.modelUrl && (
                <a
                  href={result.modelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium text-center hover:bg-cyan-500/25 transition-colors flex items-center justify-center gap-2"
                >
                  <Box className="w-4 h-4" /> Descargar Modelo
                </a>
              )}
              <button onClick={onClose} className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">Error en la generación</p>
                <p className="text-xs text-red-400/60 mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={start} className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-colors">
                Reintentar
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm hover:bg-white/10 transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

export default function AuditPage() {
  const [, params] = useRoute("/projects/:id/audit");
  const projectId = parseInt(params?.id || "0");
  const queryClient = useQueryClient();
  // Cada plataforma se audita a su manera: Shopify/Woo/PrestaShop sincronizan catálogo;
  // Stripe y las webs sin tienda solo tienen auditoría web (sus productos viven en otro sitio).
  const { data: projectList } = useListProjects();
  const projectRow = (projectList as Array<{ id: number; platformType?: string; shopDomain?: string }> | undefined)?.find(p => p.id === projectId);
  const platform = getPlatform(projectRow?.platformType);
  const catalogSync = ["shopify", "woocommerce", "prestashop", "tiendanube"].includes(platform.key);

  const [filterGrade, setFilterGrade] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 50;
  const [activeTab, setActiveTab] = useState<"products" | "opportunities">("products");
  const [scanStatus, setScanStatus] = useState<"idle" | "syncing" | "auditing">("idle");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scanError, setScanError] = useState<string>("");
  const [scanResult, setScanResult] = useState<string>("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [editProduct, setEditProduct] = useState<EditableProduct | null>(null);
  const [adProduct, setAdProduct] = useState<{ id: string; title: string; images?: Array<{ src: string; alt?: string | null }>; price?: string | null; bodyHtml?: string | null } | null>(null);
  const [model3dProduct, setModel3dProduct] = useState<Model3dProduct | null>(null);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [bulkOptimizing, setBulkOptimizing] = useState(false);
  const [optimizeMsg, setOptimizeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [tokenMsg, setTokenMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [deepLinkHandle] = useState(() => new URLSearchParams(window.location.search).get("product") ?? "");
  const [highlightedHandle, setHighlightedHandle] = useState(deepLinkHandle);
  const productCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!deepLinkHandle || !projectId) return;
    fetch(`${API}/api/projects/${projectId}/products?search=${encodeURIComponent(deepLinkHandle)}&limit=1`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const match = d.products?.[0];
        if (!match) return;
        setEditProduct(match as EditableProduct);
        setHighlightedHandle(match.handle ?? deepLinkHandle);
        setTimeout(() => {
          const el = productCardRefs.current[match.handle ?? ""];
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 500);
      })
      .catch(() => {});
  }, [deepLinkHandle, projectId]);

  const { data, isLoading, refetch } = useGetProjectProducts(projectId, {
    page: currentPage,
    limit: PAGE_SIZE,
    grade: filterGrade || undefined,
  });

  // Reset page to 1 when filters change so user always sees first results.
  useEffect(() => { setCurrentPage(1); }, [filterGrade, filterStatus]);

  const totalProducts = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const _syncProducts = useSyncProducts();
  const getCatalogOpps = useGetCatalogOpportunities();
  const oppsData = getCatalogOpps.data ?? [];
  const isLoadingOpps = getCatalogOpps.isPending;
  const refetchOpps = () => getCatalogOpps.mutate({ projectId });

  // ─── STORE AUDIT (universal, multi-platform via /audit/run) ────────────────
  // FIX A15: connect orphan endpoints /audit/{run,results,history}
  const [storeAuditStatus, setStoreAuditStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [storeAuditMsg, setStoreAuditMsg] = useState<string>("");
  const [storeAuditResults, setStoreAuditResults] = useState<any>(null);
  const auditPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (auditPollRef.current) clearInterval(auditPollRef.current); }, []);
  const [storeAuditHistory, setStoreAuditHistory] = useState<any[]>([]);
  const [showAuditModal, setShowAuditModal] = useState(false);

  const fetchStoreAuditResults = async () => {
    try {
      const r = await fetch(`${API}/api/projects/${projectId}/audit/results`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setStoreAuditResults(d?.hasResults && d.result ? mapAuditResult(d.result) : null);
      }
    } catch {}
  };

  const fetchStoreAuditHistory = async () => {
    try {
      const r = await fetch(`${API}/api/projects/${projectId}/audit/history`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setStoreAuditHistory(Array.isArray(d) ? d : (d.history || []));
      }
    } catch {}
  };

  // /audit/results devuelve { hasResults, result: fila de audit_results }; el panel
  // pinta { scores, summary, recommendations, issues } (antes se buscaban esos
  // campos en la raíz y nunca aparecían resultados).
  const mapAuditResult = (row: any) => {
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
    const scores: Record<string, { score: number }> = {};
    const add = (k: string, v: unknown) => { const x = n(v); if (x !== null) scores[k] = { score: x }; };
    add("global", row.overallScore);
    add("rendimiento", row.performanceScore);
    add("seo", row.seoScore);
    add("accesibilidad", row.accessibilityScore);
    add("buenas prácticas", row.bestPracticesScore);
    add("contenido", row.contentQualityScore);
    add("móvil", row.mobileFriendlinessScore);
    add("seo técnico", row.technicalSeoScore);
    const ai = row.aiAnalysis;
    const summary = typeof ai === "string" ? ai : (ai?.summary ?? ai?.executiveSummary ?? null);
    return {
      scores,
      summary: typeof summary === "string" ? summary : null,
      recommendations: Array.isArray(row.recommendations) ? row.recommendations : [],
      issues: Array.isArray(row.issues) ? row.issues : [],
    };
  };

  const runStoreAudit = async () => {
    const startedAt = Date.now();
    setStoreAuditStatus("running");
    setStoreAuditMsg("Auditoría en curso. Análisis de PageSpeed + scraping + Claude... esto tarda 1-3 minutos");
    setShowAuditModal(true);
    try {
      const res = await fetch(`${API}/api/projects/${projectId}/audit/run`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setStoreAuditMsg(data.message || "Auditoría iniciada. Refresca en 1-2 minutos para ver resultados.");
      // FIX: avoid stale closure — read fetch response directly inside interval, not state
      let attempts = 0;
      if (auditPollRef.current) clearInterval(auditPollRef.current);
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch(`${API}/api/projects/${projectId}/audit/results`, { credentials: "include" });
          if (r.ok) {
            const d = await r.json();
            // Solo el resultado de ESTA ejecución (no el de una auditoría anterior).
            const row = d?.hasResults ? d.result : null;
            if (row && new Date(row.auditedAt).getTime() >= startedAt - 5000) {
              setStoreAuditResults(mapAuditResult(row));
              clearInterval(poll);
              setStoreAuditStatus("done");
              await fetchStoreAuditHistory();
              return;
            }
          }
        } catch {}
        if (attempts >= 16) {
          clearInterval(poll);
          setStoreAuditStatus("done");
          await fetchStoreAuditHistory();
        }
      }, 15000);
      auditPollRef.current = poll;
    } catch (e: any) {
      setStoreAuditStatus("error");
      setStoreAuditMsg(e?.message || "Error en auditoría");
    }
  };

  const handleScan = async () => {
    setScanStatus("syncing");
    setScanError("");
    setScanResult("");
    // Si veníamos de un "Token expirado" y ahora el usuario regenera+escanea,
    // limpiamos también el banner de token para no apilar mensajes contradictorios.
    setTokenMsg(null);
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
      const breakdown = result.statusBreakdown;
      const breakdownStr = breakdown
        ? ` (${Object.entries(breakdown as Record<string, number>).filter(([, c]) => c > 0).map(([s, c]) => `${c} ${s === "active" ? "activos" : s === "unlisted" ? "no listados" : s === "draft" ? "borradores" : s === "archived" ? "archivados" : s}`).join(", ")})`
        : "";
      setScanResult(`${result.synced} productos sincronizados${breakdownStr}${result.removed > 0 ? `, ${result.removed} eliminados` : ""}. Score medio: ${result.avgScore ? Math.round(result.avgScore) : "—"}/100`);
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
    // Si el regenerate tiene éxito, los anteriores "Token expirado" ya no aplican —
    // limpiamos para que no coexistan banners contradictorios (bug visible).
    setScanError("");
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
      // Auto-dismiss del banner de éxito a los 6s para no acumular notificaciones.
      setTimeout(() => setTokenMsg((m) => (m && m.ok ? null : m)), 6000);
    } catch (e: unknown) {
      setTokenMsg({ text: e instanceof Error ? e.message : "Error regenerando token", ok: false });
    } finally {
      setTokenLoading(false);
    }
  };

  const optimizeProduct = async (shopifyProductId: string) => {
    setOptimizingId(shopifyProductId);
    // El feedback en vivo lo muestra <LiveOperation> (timer + mensajes rotativos).
    setOptimizeMsg(null);
    try {
      const res = await fetch(`${API}/api/shopybrain/execute-action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize_product", params: { projectId: String(projectId), productId: shopifyProductId } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error optimizando");
      setOptimizeMsg({ text: data.message || `"${data.title}" optimizado con IA`, ok: true });
      refetch();
    } catch (e: unknown) {
      setOptimizeMsg({ text: e instanceof Error ? e.message : "Error optimizando producto", ok: false });
    } finally {
      setOptimizingId(null);
    }
  };

  const optimizeAll = async () => {
    setBulkOptimizing(true);
    setOptimizeMsg(null); // el feedback lo lleva <LiveOperation>
    try {
      const res = await fetch(`${API}/api/shopybrain/execute-action`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "optimize_all_products", params: { projectId: String(projectId), limit: 25 } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error en optimización masiva");
      setOptimizeMsg({ text: `${data.optimized}/${data.total} productos optimizados con IA`, ok: true });
      refetch();
    } catch (e: unknown) {
      setOptimizeMsg({ text: e instanceof Error ? e.message : "Error", ok: false });
    } finally {
      setBulkOptimizing(false);
    }
  };

  const isScanning = scanStatus !== "idle";
  const allProducts = data?.products || [];
  const products = filterStatus
    ? allProducts.filter((p: any) => p.status === filterStatus)
    : allProducts;

  const needImprovement =
    (data?.gradeCounts?.C || 0) + (data?.gradeCounts?.D || 0) + (data?.gradeCounts?.F || 0);
  const pctNeedImprovement = data?.total ? Math.round((needImprovement / data.total) * 100) : 0;
  const lowImageCount: number = (data as { lowImageCount?: number } | undefined)?.lowImageCount ?? 0;

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
      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="shrink-0">
          <h1 className="text-3xl font-display font-bold text-foreground whitespace-nowrap">{catalogSync ? "Auditoría del Catálogo" : "Auditoría Web"}</h1>
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
            ) : catalogSync
              ? `Sincroniza el catálogo de ${platform.label} para empezar`
              : platform.key === "stripe"
                ? "Auditoría de la web asociada a tu cuenta Stripe"
                : "Rendimiento, SEO y accesibilidad de tu web"}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap items-center md:justify-end">
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
          {catalogSync && <button
            onClick={() => setShowCreateModal(true)}
            className="bg-[var(--gold)] text-black px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:brightness-110 transition-all shadow-[0_0_15px_rgba(200,168,75,0.3)]"
          >
            <Plus className="w-4 h-4" />
            Crear producto
          </button>}
          <button
            onClick={runStoreAudit}
            disabled={storeAuditStatus === "running"}
            title="Auditoría completa de la tienda: PageSpeed + SEO + accesibilidad + recomendaciones"
            className="border border-purple-500/40 text-purple-300 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-purple-500/10 transition-all disabled:opacity-60"
          >
            {storeAuditStatus === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {storeAuditStatus === "running" ? "Auditando web..." : "Auditoría web"}
          </button>
          {platform.usesStoreToken && <button
            onClick={handleRegenerateToken}
            disabled={tokenLoading}
            title={`Renueva el token de acceso de ${platform.label}`}
            className="border border-[var(--gold)]/40 text-[var(--gold)] px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[var(--gold)]/10 transition-all disabled:opacity-60"
          >
            {tokenLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Renovar token
          </button>}
          {catalogSync && <button
            onClick={handleScan}
            disabled={isScanning}
            title={`Descarga los productos de ${platform.label} y calcula su puntuación`}
            className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(91,78,255,0.3)] disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
            {scanStatus === "syncing"
              ? "Sincronizando..."
              : scanStatus === "auditing"
              ? "Calculando scores..."
              : `Sincronizar ${platform.label}`}
          </button>}
        </div>
      </div>

      {/* Progreso vivo del escaneo (sustituye al texto estático "Sincronizando...") */}
      <LiveOperation
        active={isScanning}
        title={scanStatus === "syncing" ? `Sincronizando catálogo desde ${platform.label}` : "Calculando scores de auditoría"}
        messages={
          scanStatus === "syncing"
            ? [
                `Conectando con la API de ${platform.label}...`,
                "Descargando productos del catálogo...",
                "Procesando variantes e inventario...",
                "Sincronizando imágenes y metadatos...",
              ]
            : [
                "Analizando títulos y descripciones...",
                "Calculando score SEO de cada producto...",
                "Detectando productos sin imágenes o sin variantes...",
                "Asignando grados (A/B/C/D/F)...",
              ]
        }
        estimatedSec={scanStatus === "syncing" ? 60 : 45}
      />
      {/* Mutual exclusion: si está activo, ocultamos el resultado/error anterior para no confundir */}
      {scanError && !isScanning && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{scanError}</span>
          <button onClick={() => setScanError("")} className="hover:opacity-70" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
      )}
      {scanResult && !scanError && !isScanning && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1">{scanResult}</span>
          <button onClick={() => setScanResult("")} className="hover:opacity-70" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
      )}
      {/* Token: si el regenerate fue OK, NO mostramos a la vez el viejo "Token expirado".
          handleRegenerateToken ya limpia scanError; aquí también ocultamos si scanError todavía existe pero el token está OK. */}
      <LiveOperation
        active={tokenLoading}
        title={`Renovando token de ${platform.label}`}
        messages={["Solicitando nuevo token de acceso...", "Verificando permisos de la app..."]}
        estimatedSec={10}
      />
      {tokenMsg && !tokenLoading && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${tokenMsg.ok ? "border-[var(--gold)]/30 bg-[var(--gold)]/10 text-[var(--gold)]" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
          {tokenMsg.ok ? <Key className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="flex-1">{tokenMsg.text}</span>
          <button onClick={() => setTokenMsg(null)} className="hover:opacity-70" aria-label="Cerrar"><X className="w-4 h-4" /></button>
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

      {editProduct && (
        <ProductEditModal
          projectId={projectId}
          product={editProduct}
          platformKey={platform.key}
          onClose={() => setEditProduct(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: getGetProjectProductsQueryKey(projectId) });
            refetch();
          }}
        />
      )}

      {adProduct && (
        <CreateAdModal
          projectId={projectId}
          productId={adProduct.id}
          productTitle={adProduct.title}
          product={{ images: adProduct.images, price: adProduct.price, bodyHtml: adProduct.bodyHtml, platformLabel: platform.label }}
          onClose={() => setAdProduct(null)}
        />
      )}

      {model3dProduct && (
        <Tripo3DAutoModal
          projectId={projectId}
          product={model3dProduct}
          onClose={() => setModel3dProduct(null)}
        />
      )}

      {!catalogSync && (
        <GlassCard className="p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {platform.key === "stripe" ? "Tus productos y precios están en Stripe" : "Esta web no tiene catálogo de tienda conectado"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                {platform.key === "stripe"
                  ? "Productos, precios, suscripciones y facturas se gestionan en Stripe Hub. Aquí auditas la web donde vendes: velocidad, SEO y accesibilidad."
                  : "La auditoría web analiza velocidad (PageSpeed), SEO técnico y accesibilidad de tu sitio y te da recomendaciones priorizadas."}
                {!projectRow?.shopDomain && " Añade la URL de tu web en Ajustes para poder auditarla."}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {platform.key === "stripe" && (
                <Link href={`/projects/${projectId}/stripe-hub`} className="bg-[#635bff] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">Abrir Stripe Hub</Link>
              )}
              {!projectRow?.shopDomain && (
                <Link href={`/projects/${projectId}/settings`} className="border border-border px-4 py-2.5 rounded-xl text-sm font-semibold text-foreground">Ir a Ajustes</Link>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {catalogSync && (<>
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
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
              <ImageOff className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Con menos de 3 fotos</p>
              <h3 className="text-2xl font-bold text-foreground">
                {lowImageCount}
                {data?.total ? <span className="text-sm text-muted-foreground font-normal ml-1">de {data.total}</span> : null}
              </h3>
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
      <div className="flex gap-2 border-b border-white/5 pb-0 overflow-x-auto -mx-1 px-1">
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
          {/* Progreso vivo de optimización (individual o masiva) */}
          <LiveOperation
            active={!!optimizingId && !bulkOptimizing}
            title="Optimizando producto con IA"
            messages={[
              "Cargando datos del producto y contexto de marca...",
              "Reescribiendo título y descripción con Claude...",
              "Generando metadatos SEO y palabras clave...",
              `Aplicando cambios en ${platform.label}...`,
            ]}
            estimatedSec={45}
          />
          <LiveOperation
            active={bulkOptimizing}
            title="Optimización masiva con IA (hasta 25 productos)"
            messages={[
              "Cargando catálogo y memoria de marca...",
              "Procesando productos en batch...",
              "Reescribiendo títulos, descripciones y SEO...",
              `Aplicando cambios en ${platform.label} uno a uno...`,
              "Esto puede tardar varios minutos: no cierres la pestaña.",
            ]}
            estimatedSec={300}
          />
          {optimizeMsg && !optimizingId && !bulkOptimizing && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${optimizeMsg.ok ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {optimizeMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="flex-1">{optimizeMsg.text}</span>
              <button onClick={() => setOptimizeMsg(null)} className="ml-2 hover:opacity-70"><X className="w-3 h-3" /></button>
            </div>
          )}

          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">Resultados</h2>
              <button
                onClick={optimizeAll}
                disabled={bulkOptimizing || isScanning || !!optimizingId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-600/20 to-amber-600/20 border border-yellow-500/30 text-yellow-400 rounded-lg text-xs font-medium hover:from-yellow-600/30 hover:to-amber-600/30 transition-all disabled:opacity-50"
              >
                {bulkOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {bulkOptimizing ? "Optimizando..." : "Optimizar Todo con IA"}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-card border border-white/10 rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos ({(data as unknown as Record<string, any>)?.statusCounts?.active || 0})</option>
                <option value="unlisted">No listados ({(data as unknown as Record<string, any>)?.statusCounts?.unlisted || 0})</option>
                <option value="draft">Borradores ({(data as unknown as Record<string, any>)?.statusCounts?.draft || 0})</option>
                <option value="archived">Archivados ({(data as unknown as Record<string, any>)?.statusCounts?.archived || 0})</option>
              </select>
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {products.map((product, idx) => (
              <div key={product.id} ref={(el) => { productCardRefs.current[(product as any).handle ?? ""] = el; }}>
              <GlassCard
                delay={0.05 * (idx % 10)}
                hoverEffect
                className={`p-0 flex flex-col md:flex-row overflow-hidden transition-all ${highlightedHandle && highlightedHandle === (product as any).handle ? "border-amber-400/70 ring-2 ring-amber-400/40 shadow-lg shadow-amber-400/10" : "border-white/5"}`}
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
                    <h3 className="text-base font-bold text-foreground line-clamp-2 mb-1">{product.title}</h3>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                        product.status === "active" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        product.status === "unlisted" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                        product.status === "draft" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                        "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      }`}>
                        {product.status === "active" ? "Activo" : product.status === "unlisted" ? "No listado" : product.status === "draft" ? "Borrador" : "Archivado"}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                        (product as any).publishedAt ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      }`}>
                        {(product as any).publishedAt ? "Publicado" : "No publicado"}
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
                        { label: "Imágenes", score: product.imageScore },
                        { label: "Texto", score: product.descriptionScore },
                        { label: "Título", score: product.titleScore },
                        { label: "Precio", score: product.priceScore },
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

                  {(() => {
                    const pid = String((product as any).shopifyProductId || product.id);
                    const busy = optimizingId === pid;
                    const btn = "min-w-0 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50";
                    return (
                      <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => optimizeProduct(pid)}
                          disabled={busy || bulkOptimizing}
                          className={`${btn} border-yellow-500/25 text-yellow-300 hover:bg-yellow-500/10`}
                          title="Reescribe título, descripción y SEO con IA y lo guarda en la tienda"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          <span className="truncate">Optimizar</span>
                        </button>
                        <button
                          onClick={() => setAdProduct({ id: pid, title: product.title, images: product.images ?? [], price: product.price ?? null, bodyHtml: (product as any).bodyHtml ?? null })}
                          className={`${btn} border-purple-500/30 text-purple-300 hover:bg-purple-500/10`}
                          title="Anuncio en vídeo a partir de las fotos, descripción y precio del producto"
                          data-testid={`btn-create-ad-${product.id}`}
                        >
                          <Film className="w-4 h-4" />
                          <span className="truncate">Vídeo anuncio</span>
                        </button>
                        <button
                          onClick={() => setModel3dProduct({
                            id: pid,
                            title: product.title,
                            productType: (product as any).productType || "",
                            bodyHtml: (product as any).bodyHtml || "",
                            imageUrl: (product as any).images?.[0]?.src || undefined,
                          })}
                          className={`${btn} border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/10`}
                          title="Modelo 3D del producto con Tripo3D a partir de su foto"
                          data-testid={`btn-model3d-${product.id}`}
                        >
                          <Box className="w-4 h-4" />
                          <span className="truncate">3D</span>
                        </button>
                        <button
                          onClick={() => setEditProduct(product as unknown as EditableProduct)}
                          className={`${btn} border-white/10 text-foreground hover:bg-white/5`}
                          title="Editar título, descripción, precio e imágenes"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span className="truncate">Editar</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </GlassCard>
              </div>
            ))}
            {products.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No hay productos. Pulsa <strong>"Sincronizar {platform.label}"</strong> para traer tu catálogo.
                </p>
              </div>
            )}
          </div>

          {/* Pagination bar — 50 products per page with prev/next arrows */}
          {totalProducts > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-2 py-4 border-t border-white/5">
              <div className="text-sm text-muted-foreground">
                Mostrando <strong className="text-foreground">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, totalProducts)}</strong> de <strong className="text-foreground">{totalProducts}</strong> productos
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-card border border-white/10 rounded-lg text-sm text-foreground hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página anterior"
                >
                  <span aria-hidden="true">←</span>
                  <span className="hidden sm:inline">Anterior</span>
                </button>
                <span className="text-sm text-muted-foreground px-2">
                  Página <strong className="text-foreground">{currentPage}</strong> de <strong className="text-foreground">{totalPages}</strong>
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  className="flex items-center gap-1 px-3 py-2 bg-primary/15 border border-primary/30 rounded-lg text-sm text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  aria-label="Página siguiente"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
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
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("shopycrafter:chatbot", {
                            detail: {
                              message: `Crea un producto nuevo basado en esta oportunidad: "${opp.productName}" - ${opp.whyItFits}. Rango de precio: ${opp.estimatedPriceMin}-${opp.estimatedPriceMax}€`,
                              autoSend: false,
                            },
                          }));
                        }}
                        className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
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

      </>)}

      {/* ─── Store Audit Modal ─── */}
      {showAuditModal && (
        <ModalOverlay onClick={() => setShowAuditModal(false)} style={{ background: "rgba(0,0,0,0.75)", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--ink, #0a0a0f)", border: "1px solid var(--bdr, #22222e)", borderRadius: 16, maxWidth: 900, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--bdr)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "var(--ink, #0a0a0f)", zIndex: 1 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#c084fc", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                  🔍 Auditoría completa de tienda
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--t3, #888)" }}>PageSpeed · SEO · Accesibilidad · Mobile · Recomendaciones IA</p>
              </div>
              <button onClick={() => setShowAuditModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 6 }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              {storeAuditStatus === "running" && (
                <LiveOperation
                  active
                  title="Auditando tu tienda completa"
                  messages={[
                    "Conectando con Google PageSpeed Insights...",
                    "Midiendo Core Web Vitals (LCP, FID, CLS)...",
                    "Analizando SEO on-page (meta, headings, schema)...",
                    "Comprobando accesibilidad (WCAG)...",
                    "Auditando experiencia móvil...",
                    "Pidiendo recomendaciones a Claude con contexto de la tienda...",
                    "Esto tarda 1-3 minutos. El resultado se guarda en el historial.",
                  ]}
                  estimatedSec={150}
                />
              )}
              {storeAuditStatus === "error" && (
                <div style={{ padding: 20, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13 }}>
                  ⚠ {storeAuditMsg}
                </div>
              )}
              {storeAuditStatus === "done" && storeAuditResults && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                    {storeAuditResults.scores && Object.entries(storeAuditResults.scores).map(([k, v]: [string, any]) => {
                      const score = v?.score ?? 0;
                      const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
                      return (
                        <div key={k} style={{ padding: 14, borderRadius: 10, border: `1px solid ${color}33`, background: `${color}0a`, textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
                          <div style={{ fontSize: 10, color: "var(--t2)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 6 }}>{k}</div>
                        </div>
                      );
                    })}
                  </div>
                  {storeAuditResults.summary && (
                    <div style={{ padding: 16, borderRadius: 10, background: "var(--ink2, #14141d)", border: "1px solid var(--bdr)", marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: "var(--t3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Resumen</div>
                      <p style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.6, margin: 0 }}>{storeAuditResults.summary}</p>
                    </div>
                  )}
                  {Array.isArray(storeAuditResults.recommendations) && storeAuditResults.recommendations.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>💡 Recomendaciones</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {storeAuditResults.recommendations.slice(0, 10).map((r: any, i: number) => (
                          <div key={i} style={{ padding: "10px 14px", borderRadius: 8, background: "var(--ink2)", border: "1px solid var(--bdr)" }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: r.impact === "high" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)", color: r.impact === "high" ? "#ef4444" : "#f59e0b" }}>
                                {r.impact?.toUpperCase() || "MEDIUM"}
                              </span>
                              <strong style={{ fontSize: 13, color: "var(--t1)" }}>{r.title}</strong>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: "var(--t2)", lineHeight: 1.5 }}>{r.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(storeAuditResults.issues) && storeAuditResults.issues.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>⚠ Problemas detectados</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {storeAuditResults.issues.slice(0, 15).map((issue: any, i: number) => (
                          <div key={i} style={{ padding: "8px 12px", borderRadius: 6, background: issue.severity === "critical" ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)", borderLeft: `3px solid ${issue.severity === "critical" ? "#ef4444" : "#f59e0b"}`, fontSize: 12, color: "var(--t2)" }}>
                            <strong style={{ color: "var(--t1)" }}>{issue.title}</strong> — {issue.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {storeAuditHistory.length > 0 && (
                    <details style={{ marginTop: 20 }}>
                      <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--t2)", padding: "8px 0" }}>
                        📜 Historial de auditorías ({storeAuditHistory.length})
                      </summary>
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {storeAuditHistory.slice(0, 10).map((h: any, i: number) => (
                          <div key={i} style={{ padding: "8px 12px", fontSize: 12, color: "var(--t3)", background: "var(--ink2)", borderRadius: 6 }}>
                            {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"} · Score: <strong style={{ color: "var(--t1)" }}>{h.overallScore ?? "—"}/100</strong>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
              {storeAuditStatus === "done" && !storeAuditResults && (
                <p style={{ fontSize: 13, color: "var(--t2)", textAlign: "center", padding: 30 }}>
                  No hay resultados disponibles aún. La auditoría puede tardar 1-3 minutos. Refresca el modal con el botón de arriba.
                </p>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
