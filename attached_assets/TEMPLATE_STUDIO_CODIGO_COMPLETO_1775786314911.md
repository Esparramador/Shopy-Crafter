# 🎨 TEMPLATE STUDIO — CÓDIGO COMPLETO PARA REPLIT
## 4 archivos a crear + 3 archivos a modificar (1 línea cada uno)
## 100% adaptado a patrones existentes — no rompe nada

---

# ARCHIVO 1 — DB SCHEMA
## Crear: `lib/db/src/schema/report_templates.ts`

```typescript
import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

export const reportTemplatesTable = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),

  // Branding
  logoBase64: text("logo_base64"),
  companyName: varchar("company_name", { length: 200 }),
  tagline: varchar("tagline", { length: 300 }),

  // Colors (7 tokens — full design system)
  primaryColor: varchar("primary_color", { length: 9 }).default("#c8a84b"),
  secondaryColor: varchar("secondary_color", { length: 9 }).default("#08080e"),
  accentColor: varchar("accent_color", { length: 9 }).default("#44cc88"),
  textColor: varchar("text_color", { length: 9 }).default("#f0f0f5"),
  bgColor: varchar("bg_color", { length: 9 }).default("#08080e"),
  cardBg: varchar("card_bg", { length: 9 }).default("#12121a"),
  borderColor: varchar("border_color", { length: 9 }).default("#1a1a22"),

  // Typography
  headingFont: varchar("heading_font", { length: 100 }).default("Helvetica Neue"),
  bodyFont: varchar("body_font", { length: 100 }).default("Helvetica Neue"),
  headingWeight: varchar("heading_weight", { length: 10 }).default("700"),

  // Layout
  coverStyle: varchar("cover_style", { length: 20 }).default("centered"),
  sectionStyle: varchar("section_style", { length: 20 }).default("card"),

  // Footer
  footerText: varchar("footer_text", { length: 300 }),
  showPageNumbers: boolean("show_page_numbers").default(true),

  // Sharing
  isPublic: boolean("is_public").default(false),
  shareToken: varchar("share_token", { length: 64 }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```

## Modificar: `lib/db/src/schema/index.ts` — AÑADIR 1 línea al final:
```typescript
export * from "./report_templates";
```

---

# ARCHIVO 2 — BACKEND ROUTE
## Crear: `api-server/src/routes/report-templates.ts`

```typescript
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { reportTemplatesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "../lib/logger.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── LIST all user templates ──────────────────────────────────────────────────
router.get("/report-templates", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) { res.json([]); return; }
    const templates = await db.select().from(reportTemplatesTable)
      .where(eq(reportTemplatesTable.userId, userId))
      .orderBy(desc(reportTemplatesTable.updatedAt));
    res.json(templates);
  } catch (err) {
    logger.error({ err }, "Error listing report templates");
    res.status(500).json({ error: "Error cargando plantillas" });
  }
});

// ─── GET single template ──────────────────────────────────────────────────────
router.get("/report-templates/:idOrToken", async (req: Request, res: Response): Promise<void> => {
  try {
    const param = req.params.idOrToken;
    const id = parseInt(param);
    let template;
    if (!isNaN(id)) {
      [template] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.id, id));
    } else {
      [template] = await db.select().from(reportTemplatesTable).where(eq(reportTemplatesTable.shareToken, param));
    }
    if (!template) { res.status(404).json({ error: "Plantilla no encontrada" }); return; }
    res.json(template);
  } catch (err) {
    logger.error({ err }, "Error loading report template");
    res.status(500).json({ error: "Error cargando plantilla" });
  }
});

// ─── CREATE template ──────────────────────────────────────────────────────────
router.post("/report-templates", upload.single("logo"), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const b = req.body;
    if (!b.name) { res.status(400).json({ error: "Nombre requerido" }); return; }

    const slug = b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) + "-" + Date.now().toString(36);
    const shareToken = randomBytes(32).toString("hex");
    let logoBase64 = b.logoBase64 || null;
    if (req.file) {
      logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }

    const [template] = await db.insert(reportTemplatesTable).values({
      userId, name: b.name, slug, shareToken, logoBase64,
      companyName: b.companyName || null,
      tagline: b.tagline || null,
      primaryColor: b.primaryColor || "#c8a84b",
      secondaryColor: b.secondaryColor || "#08080e",
      accentColor: b.accentColor || "#44cc88",
      textColor: b.textColor || "#f0f0f5",
      bgColor: b.bgColor || "#08080e",
      cardBg: b.cardBg || "#12121a",
      borderColor: b.borderColor || "#1a1a22",
      headingFont: b.headingFont || "Helvetica Neue",
      bodyFont: b.bodyFont || "Helvetica Neue",
      headingWeight: b.headingWeight || "700",
      coverStyle: b.coverStyle || "centered",
      sectionStyle: b.sectionStyle || "card",
      footerText: b.footerText || null,
      showPageNumbers: b.showPageNumbers !== "false",
      isPublic: b.isPublic === "true",
    }).returning();

    res.json({ success: true, template });
  } catch (err) {
    logger.error({ err }, "Error creating report template");
    res.status(500).json({ error: "Error creando plantilla" });
  }
});

// ─── UPDATE template ──────────────────────────────────────────────────────────
router.put("/report-templates/:id", upload.single("logo"), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const b = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };

    // Only update fields that were sent
    const fields = ["name", "companyName", "tagline", "primaryColor", "secondaryColor",
      "accentColor", "textColor", "bgColor", "cardBg", "borderColor", "headingFont",
      "bodyFont", "headingWeight", "coverStyle", "sectionStyle", "footerText"];
    for (const f of fields) {
      if (b[f] !== undefined) updates[f] = b[f] || null;
    }
    if (b.showPageNumbers !== undefined) updates.showPageNumbers = b.showPageNumbers !== "false";
    if (b.isPublic !== undefined) updates.isPublic = b.isPublic === "true";
    if (b.logoBase64) updates.logoBase64 = b.logoBase64;
    if (req.file) updates.logoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const [template] = await db.update(reportTemplatesTable).set(updates)
      .where(eq(reportTemplatesTable.id, id)).returning();

    res.json({ success: true, template });
  } catch (err) {
    logger.error({ err }, "Error updating report template");
    res.status(500).json({ error: "Error actualizando plantilla" });
  }
});

// ─── DELETE template ──────────────────────────────────────────────────────────
router.delete("/report-templates/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    await db.delete(reportTemplatesTable).where(eq(reportTemplatesTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting report template");
    res.status(500).json({ error: "Error eliminando plantilla" });
  }
});

// ─── AI SUGGEST design from brand ─────────────────────────────────────────────
router.post("/report-templates/ai-suggest", async (req: Request, res: Response): Promise<void> => {
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    const { url, instagram, companyName } = req.body;
    if (!url && !instagram && !companyName) {
      res.status(400).json({ error: "Proporciona URL, Instagram o nombre" });
      return;
    }

    const { askGeminiWithSearch } = await import("../lib/gemini.js");
    const searchName = companyName || url || instagram;

    const result = await askGeminiWithSearch(
      `Research "${searchName}" ${url ? `(${url})` : ""} ${instagram ? `@${instagram}` : ""}. 
       Analyze their brand identity and suggest a report template design.
       Return ONLY JSON: {
         "companyName": "detected name",
         "primaryColor": "#hex (brand main color)",
         "secondaryColor": "#hex (dark background)",
         "accentColor": "#hex (success/positive color)",
         "textColor": "#hex (readable on bg)",
         "bgColor": "#hex (page background)",
         "cardBg": "#hex (card background)",
         "borderColor": "#hex (subtle border)",
         "headingFont": "Google Font name for headings",
         "bodyFont": "Google Font name for body",
         "coverStyle": "centered or left-aligned",
         "sectionStyle": "card or accent-bar",
         "tagline": "suggested tagline for reports",
         "reasoning": "why these design choices match the brand"
       }`,
      "Brand design analyst. Return ONLY valid JSON. Use real hex colors from the brand."
    );

    let suggestion: Record<string, unknown> = {};
    try {
      const match = result.text.match(/\{[\s\S]*\}/);
      if (match) suggestion = JSON.parse(match[0]);
    } catch {}

    res.json({ success: true, suggestion });
  } catch (err) {
    logger.error({ err }, "Error in AI template suggestion");
    res.status(500).json({ error: "Error generando sugerencia IA" });
  }
});

export default router;
```

## Modificar: `api-server/src/routes/index.ts` — AÑADIR 2 líneas:
```typescript
// Al inicio con los imports:
import reportTemplatesRouter from "./report-templates.js";

// Después de requireAdmin, junto a los otros routers:
router.use(reportTemplatesRouter);
```

---

# ARCHIVO 3 — FRONTEND PAGE
## Crear: `shopify-optimizer/src/pages/admin/TemplateStudio.tsx`

```tsx
import { useState, useEffect, useRef } from "react";
import { Palette, Type, Layout, Image, Save, Trash2, Copy, Share2, Sparkles, Plus, Eye, ChevronDown, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const GOOGLE_FONTS = [
  "Helvetica Neue", "Georgia", "Playfair Display", "Cormorant Garamond",
  "Montserrat", "Lora", "Raleway", "Merriweather", "Poppins", "Oswald",
  "Roboto Slab", "Source Serif 4", "DM Serif Display", "Crimson Text",
  "Libre Baskerville", "Work Sans", "Nunito", "Josefin Sans",
];

const COVER_STYLES = [
  { id: "centered", label: "Centrado" },
  { id: "left-aligned", label: "Alineado izquierda" },
  { id: "minimal", label: "Minimalista" },
];

const SECTION_STYLES = [
  { id: "card", label: "Cards" },
  { id: "accent-bar", label: "Barra lateral" },
  { id: "minimal", label: "Minimalista" },
];

interface Template {
  id?: number;
  name: string;
  companyName: string;
  tagline: string;
  logoBase64: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  bgColor: string;
  cardBg: string;
  borderColor: string;
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  coverStyle: string;
  sectionStyle: string;
  footerText: string;
  showPageNumbers: boolean;
  isPublic: boolean;
  shareToken?: string;
}

const DEFAULT_TEMPLATE: Template = {
  name: "", companyName: "", tagline: "", logoBase64: null,
  primaryColor: "#c8a84b", secondaryColor: "#08080e", accentColor: "#44cc88",
  textColor: "#f0f0f5", bgColor: "#08080e", cardBg: "#12121a", borderColor: "#1a1a22",
  headingFont: "Helvetica Neue", bodyFont: "Helvetica Neue", headingWeight: "700",
  coverStyle: "centered", sectionStyle: "card", footerText: "", showPageNumbers: true, isPublic: false,
};

export default function TemplateStudio() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [current, setCurrent] = useState<Template>({ ...DEFAULT_TEMPLATE });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUrl, setAiUrl] = useState("");
  const [aiInstagram, setAiInstagram] = useState("");
  const [aiCompany, setAiCompany] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"colors" | "fonts" | "layout" | "brand">("brand");
  const logoRef = useRef<HTMLInputElement>(null);

  // Load templates
  useEffect(() => {
    fetch(`${API_BASE}/api/report-templates`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTemplates(data); })
      .catch(() => {});
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCurrent(p => ({ ...p, logoBase64: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleAiSuggest = async () => {
    if (!aiUrl && !aiInstagram && !aiCompany) return;
    setAiLoading(true);
    setMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/report-templates/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: aiUrl, instagram: aiInstagram, companyName: aiCompany }),
      });
      const data = await res.json();
      if (data.suggestion) {
        const s = data.suggestion as Record<string, string>;
        setCurrent(p => ({
          ...p,
          companyName: s.companyName || p.companyName || aiCompany,
          tagline: s.tagline || p.tagline,
          primaryColor: s.primaryColor || p.primaryColor,
          secondaryColor: s.secondaryColor || p.secondaryColor,
          accentColor: s.accentColor || p.accentColor,
          textColor: s.textColor || p.textColor,
          bgColor: s.bgColor || p.bgColor,
          cardBg: s.cardBg || p.cardBg,
          borderColor: s.borderColor || p.borderColor,
          headingFont: s.headingFont || p.headingFont,
          bodyFont: s.bodyFont || p.bodyFont,
          coverStyle: s.coverStyle || p.coverStyle,
          sectionStyle: s.sectionStyle || p.sectionStyle,
        }));
        setMsg(`✅ IA sugirió diseño${s.reasoning ? `: ${(s.reasoning as string).slice(0, 100)}` : ""}`);
      }
    } catch { setMsg("Error en sugerencia IA"); }
    setAiLoading(false);
  };

  const handleSave = async () => {
    if (!current.name) { setMsg("Nombre requerido"); return; }
    setSaving(true);
    setMsg("");
    try {
      const method = current.id ? "PUT" : "POST";
      const url = current.id ? `${API_BASE}/api/report-templates/${current.id}` : `${API_BASE}/api/report-templates`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(current),
      });
      const data = await res.json();
      if (data.success) {
        setMsg("✅ Plantilla guardada");
        if (!current.id && data.template?.id) setCurrent(p => ({ ...p, id: data.template.id, shareToken: data.template.shareToken }));
        // Refresh list
        const list = await fetch(`${API_BASE}/api/report-templates`, { credentials: "include" }).then(r => r.json());
        if (Array.isArray(list)) setTemplates(list);
      } else {
        setMsg(data.error || "Error guardando");
      }
    } catch { setMsg("Error de conexión"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;
    await fetch(`${API_BASE}/api/report-templates/${id}`, { method: "DELETE", credentials: "include" });
    setTemplates(p => p.filter(t => t.id !== id));
    if (current.id === id) setCurrent({ ...DEFAULT_TEMPLATE });
  };

  const loadTemplate = (t: Template) => { setCurrent({ ...t }); setEditing(true); };
  const newTemplate = () => { setCurrent({ ...DEFAULT_TEMPLATE }); setEditing(true); };

  const C = current; // shorthand

  // Color input helper
  const ColorField = ({ label, field }: { label: string; field: keyof Template }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <input type="color" value={(C[field] as string) || "#000000"}
        onChange={e => setCurrent(p => ({ ...p, [field]: e.target.value }))}
        style={{ width: 32, height: 32, borderRadius: 6, border: "1px solid var(--ink3)", cursor: "pointer", padding: 0 }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--t)" }}>{label}</div>
        <div style={{ fontSize: 10, color: "var(--t4)", fontFamily: "monospace" }}>{C[field] as string}</div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--t)", margin: 0 }}>🎨 Template Studio</h1>
          <p style={{ fontSize: 13, color: "var(--t3)", margin: "4px 0 0" }}>Diseña plantillas de informe con branding personalizado</p>
        </div>
        <button onClick={newTemplate} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--gold, #c8a84b)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={16} /> Nueva Plantilla
        </button>
      </div>

      {/* Templates list */}
      {!editing && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {templates.map(t => (
            <div key={t.id} className="glass-card" style={{ padding: 16, cursor: "pointer" }} onClick={() => loadTemplate(t)}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                {t.logoBase64 ? <img src={t.logoBase64} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: t.primaryColor || "#c8a84b", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 800, color: "#000" }}>{(t.name || "T")[0]}</div>}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--t4)" }}>{t.companyName || "Sin marca"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[t.primaryColor, t.secondaryColor, t.accentColor, t.textColor, t.bgColor].filter(Boolean).map((c, i) => (
                  <div key={i} style={{ width: 20, height: 20, borderRadius: 4, background: c || "#333", border: "1px solid var(--ink3)" }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={e => { e.stopPropagation(); handleDelete(t.id!); }} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--ink3)", background: "none", color: "var(--t4)", fontSize: 10, cursor: "pointer" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="glass-card" style={{ padding: 40, textAlign: "center", gridColumn: "1 / -1" }}>
              <Palette size={32} style={{ color: "var(--t4)", marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t3)" }}>Sin plantillas aún</div>
              <div style={{ fontSize: 12, color: "var(--t4)", marginTop: 4 }}>Crea tu primera plantilla personalizada</div>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
          {/* LEFT: Editor controls */}
          <div>
            <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
              <input value={C.name} onChange={e => setCurrent(p => ({ ...p, name: e.target.value }))} placeholder="Nombre de la plantilla *" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 14, fontWeight: 600, fontFamily: "inherit", marginBottom: 8 }} />
              <input value={C.companyName} onChange={e => setCurrent(p => ({ ...p, companyName: e.target.value }))} placeholder="Nombre empresa / marca" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 12, fontFamily: "inherit", marginBottom: 6 }} />
              <input value={C.tagline} onChange={e => setCurrent(p => ({ ...p, tagline: e.target.value }))} placeholder="Tagline / eslogan" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 12, fontFamily: "inherit" }} />
            </div>

            {/* AI Suggest */}
            <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold, #c8a84b)", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>🤖 IA — Auto-diseño desde marca</div>
              <input value={aiUrl} onChange={e => setAiUrl(e.target.value)} placeholder="https://web-de-la-marca.com" style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 11, fontFamily: "inherit", marginBottom: 4 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                <input value={aiInstagram} onChange={e => setAiInstagram(e.target.value)} placeholder="@instagram" style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 11, fontFamily: "inherit" }} />
                <input value={aiCompany} onChange={e => setAiCompany(e.target.value)} placeholder="Nombre marca" style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 11, fontFamily: "inherit" }} />
              </div>
              <button onClick={handleAiSuggest} disabled={aiLoading || (!aiUrl && !aiInstagram && !aiCompany)} style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: aiLoading ? "var(--ink3)" : "var(--gold, #c8a84b)", color: "#000", fontSize: 12, fontWeight: 700, cursor: aiLoading ? "wait" : "pointer" }}>
                {aiLoading ? "⟳ Investigando marca..." : "✨ Auto-diseñar desde marca"}
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, marginBottom: 12, background: "var(--ink2)", borderRadius: 8, padding: 2 }}>
              {([["brand", "🖼"], ["colors", "🎨"], ["fonts", "Aa"], ["layout", "▤"]] as [string, string][]).map(([id, icon]) => (
                <button key={id} onClick={() => setTab(id as any)} style={{ flex: 1, padding: "7px 0", borderRadius: 6, border: "none", background: tab === id ? "var(--ink3)" : "transparent", color: tab === id ? "var(--t)" : "var(--t4)", fontSize: 13, cursor: "pointer", fontWeight: tab === id ? 600 : 400 }}>{icon}</button>
              ))}
            </div>

            <div className="glass-card" style={{ padding: 16 }}>
              {tab === "brand" && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 10 }}>LOGO</div>
                  <div onClick={() => logoRef.current?.click()} style={{ width: "100%", height: 80, borderRadius: 10, border: C.logoBase64 ? "2px solid var(--gold, #c8a84b)" : "2px dashed var(--ink3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", marginBottom: 12, background: "var(--ink1)" }}>
                    {C.logoBase64 ? <img src={C.logoBase64} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 12, color: "var(--t4)" }}>Click para subir logo</span>}
                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>FOOTER</div>
                  <input value={C.footerText} onChange={e => setCurrent(p => ({ ...p, footerText: e.target.value }))} placeholder="Texto del pie de página" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 11, fontFamily: "inherit" }} />
                </>
              )}
              {tab === "colors" && (
                <>
                  <ColorField label="Principal (títulos, acentos)" field="primaryColor" />
                  <ColorField label="Secundario (fondo cover)" field="secondaryColor" />
                  <ColorField label="Acento (positivo, badges)" field="accentColor" />
                  <ColorField label="Texto" field="textColor" />
                  <ColorField label="Fondo página" field="bgColor" />
                  <ColorField label="Fondo cards" field="cardBg" />
                  <ColorField label="Bordes" field="borderColor" />
                </>
              )}
              {tab === "fonts" && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>FUENTE TÍTULOS</div>
                  <select value={C.headingFont} onChange={e => setCurrent(p => ({ ...p, headingFont: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 12, marginBottom: 12 }}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>FUENTE CUERPO</div>
                  <select value={C.bodyFont} onChange={e => setCurrent(p => ({ ...p, bodyFont: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--ink3)", background: "var(--ink1)", color: "var(--t)", fontSize: 12 }}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </>
              )}
              {tab === "layout" && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>ESTILO COVER</div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                    {COVER_STYLES.map(s => (
                      <button key={s.id} onClick={() => setCurrent(p => ({ ...p, coverStyle: s.id }))} style={{ flex: 1, padding: "8px 4px", borderRadius: 6, border: C.coverStyle === s.id ? `1.5px solid ${C.primaryColor}` : "1px solid var(--ink3)", background: C.coverStyle === s.id ? `${C.primaryColor}15` : "transparent", color: C.coverStyle === s.id ? C.primaryColor : "var(--t4)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>ESTILO SECCIONES</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {SECTION_STYLES.map(s => (
                      <button key={s.id} onClick={() => setCurrent(p => ({ ...p, sectionStyle: s.id }))} style={{ flex: 1, padding: "8px 4px", borderRadius: 6, border: C.sectionStyle === s.id ? `1.5px solid ${C.primaryColor}` : "1px solid var(--ink3)", background: C.sectionStyle === s.id ? `${C.primaryColor}15` : "transparent", color: C.sectionStyle === s.id ? C.primaryColor : "var(--t4)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{s.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: "none", background: "var(--gold, #c8a84b)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
              </button>
              <button onClick={() => setEditing(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--ink3)", background: "none", color: "var(--t4)", fontSize: 12, cursor: "pointer" }}>Cerrar</button>
            </div>
            {msg && <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith("✅") ? "var(--accent, #44cc88)" : "#ff6666", textAlign: "center" }}>{msg}</div>}
          </div>

          {/* RIGHT: Live preview */}
          <div className="glass-card" style={{ padding: 0, overflow: "hidden", maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}>
            <div style={{ padding: 8, borderBottom: "1px solid var(--ink3)", display: "flex", alignItems: "center", gap: 8 }}>
              <Eye size={14} style={{ color: "var(--t4)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t3)" }}>Preview en tiempo real</span>
            </div>
            <iframe
              srcDoc={buildPreviewHtml(C)}
              style={{ width: "100%", height: "calc(100vh - 200px)", border: "none" }}
              title="Template Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview HTML builder ─────────────────────────────────────────────────────
function buildPreviewHtml(t: Template): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(t.headingFont)}:wght@400;600;700&family=${encodeURIComponent(t.bodyFont)}:wght@300;400;500;600&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'${t.bodyFont}',sans-serif;background:${t.bgColor};color:${t.textColor};font-size:13px}
.cover{background:${t.secondaryColor};padding:60px 40px;text-align:${t.coverStyle === "left-aligned" ? "left" : "center"};min-height:45vh;display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid ${t.borderColor}}
.cover-logo{max-width:80px;max-height:80px;border-radius:12px;margin-bottom:16px;${t.coverStyle === "centered" ? "margin-left:auto;margin-right:auto;" : ""}}
.cover h1{font-family:'${t.headingFont}',serif;font-size:24px;font-weight:${t.headingWeight};color:${t.primaryColor};letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.cover p{font-size:13px;color:${t.textColor}80}
.cover .company{font-size:12px;color:${t.primaryColor}60;letter-spacing:2px;text-transform:uppercase;margin-top:12px}
.body{padding:32px}
.section{margin-bottom:24px}
.section-title{font-family:'${t.headingFont}',serif;font-size:16px;font-weight:${t.headingWeight};color:${t.primaryColor};margin-bottom:12px;${t.sectionStyle === "accent-bar" ? `border-left:3px solid ${t.primaryColor};padding-left:12px` : ""}}
.card{background:${t.cardBg};border:1px solid ${t.borderColor};border-radius:10px;padding:16px;margin-bottom:10px}
.metrics{display:flex;gap:12px;margin-bottom:20px}
.metric{flex:1;text-align:center;background:${t.cardBg};border:1px solid ${t.borderColor};border-radius:10px;padding:16px}
.metric .val{font-size:28px;font-weight:800;color:${t.primaryColor}}
.metric .lbl{font-size:10px;color:${t.textColor}60;margin-top:2px}
.rec{background:${t.cardBg};border-left:3px solid ${t.accentColor};padding:12px;margin-bottom:6px;border-radius:0 8px 8px 0;font-size:12px}
.grade{display:inline-block;padding:3px 10px;border-radius:5px;font-weight:700;font-size:12px;background:${t.accentColor}20;color:${t.accentColor}}
.footer{text-align:center;padding:20px;border-top:1px solid ${t.borderColor};font-size:11px;color:${t.textColor}40}
</style></head><body>
<div class="cover">
${t.logoBase64 ? `<img class="cover-logo" src="${t.logoBase64}" alt="Logo">` : ""}
<h1>Informe de Auditoría SEO</h1>
<p>Análisis completo de posicionamiento orgánico</p>
<div class="company">${t.companyName || "Nombre de Empresa"}</div>
${t.tagline ? `<p style="font-size:11px;color:${t.textColor}40;margin-top:6px">${t.tagline}</p>` : ""}
<p style="font-size:10px;color:${t.textColor}30;margin-top:12px">${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</p>
</div>
<div class="body">
<div class="metrics">
<div class="metric"><div class="val">47</div><div class="lbl">Productos</div></div>
<div class="metric"><div class="val">73</div><div class="lbl">Score SEO</div></div>
<div class="metric"><div class="val">12</div><div class="lbl">Con Schema</div></div>
<div class="metric"><div class="val">89%</div><div class="lbl">Alt Texts</div></div>
</div>
<div class="section">
<div class="section-title">Distribución de Grados</div>
<div class="card">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="grade">A</span><div style="flex:1;height:6px;background:${t.borderColor};border-radius:3px;overflow:hidden"><div style="width:35%;height:100%;background:${t.accentColor};border-radius:3px"></div></div><span style="font-size:11px">16 (35%)</span></div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="grade" style="background:${t.primaryColor}20;color:${t.primaryColor}">B</span><div style="flex:1;height:6px;background:${t.borderColor};border-radius:3px;overflow:hidden"><div style="width:45%;height:100%;background:${t.primaryColor};border-radius:3px"></div></div><span style="font-size:11px">21 (45%)</span></div>
<div style="display:flex;align-items:center;gap:8px"><span class="grade" style="background:#ffa50020;color:#ffa500">C</span><div style="flex:1;height:6px;background:${t.borderColor};border-radius:3px;overflow:hidden"><div style="width:20%;height:100%;background:#ffa500;border-radius:3px"></div></div><span style="font-size:11px">10 (20%)</span></div>
</div></div>
<div class="section">
<div class="section-title">Recomendaciones Prioritarias</div>
<div class="rec">✅ Implementar Schema JSON-LD en los 35 productos que faltan — mejora CTR +30%</div>
<div class="rec">🔍 Optimizar meta descriptions en 12 productos con descripciones cortas</div>
<div class="rec">🖼 Añadir alt texts a 47 imágenes para mejorar tráfico de Google Images</div>
</div></div>
<div class="footer">${t.footerText || t.companyName || "Informe generado con IA"}${t.showPageNumbers ? " · Página 1" : ""}</div>
</body></html>`;
}
```

---

# ARCHIVO 4 — INTEGRACIÓN

## Modificar `App.tsx` — AÑADIR ruta:
```tsx
// Import al inicio:
import TemplateStudio from "./pages/admin/TemplateStudio";

// Ruta (junto a las otras rutas /admin):
<Route path="/admin/template-studio">
  {() => <AppLayout><TemplateStudio /></AppLayout>}
</Route>
```

## Modificar `AppLayout.tsx` — AÑADIR en menú lateral:
En el array de items del sidebar (donde están "Bóveda Global", "Buscador Universal", etc.), añadir:
```typescript
{ label: "Template Studio", icon: "🎨", href: "/admin/template-studio" },
```

---

# RESUMEN PARA REPLIT

```
PASO 1: Crear lib/db/src/schema/report_templates.ts (copiar código arriba)
PASO 2: Añadir export en lib/db/src/schema/index.ts
PASO 3: Ejecutar migración: npx drizzle-kit generate + npx drizzle-kit push
PASO 4: Crear api-server/src/routes/report-templates.ts (copiar código arriba)
PASO 5: Registrar en api-server/src/routes/index.ts (2 líneas)
PASO 6: Crear shopify-optimizer/src/pages/admin/TemplateStudio.tsx (copiar código arriba)
PASO 7: Añadir ruta en App.tsx + tab en AppLayout.tsx
PASO 8: npm run build → verificar compilación
```

**No rompe NADA existente** — es código 100% nuevo que se añade en paralelo.
**Usa los mismos patrones exactos** que el resto de la app (drizzle, Express Router, fetch con API_BASE, glass-card, CSS variables).
