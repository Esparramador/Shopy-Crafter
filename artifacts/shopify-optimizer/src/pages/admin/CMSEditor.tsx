import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Monitor, Tablet, Smartphone, Save, Loader2, Sparkles,
  RotateCcw, Eye, X, Check, RefreshCw, ChevronDown, ChevronRight,
  PenLine, LayoutTemplate, Upload, Trash2, Image as ImageIcon, WifiOff,
  GripVertical, ArrowUp, ArrowDown, Film, Images, Atom, Plus,
  ArrowLeft, Wand2, Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDraftPersistence, useBeforeUnload, useOnlineStatus, useRetryFetch } from "@/hooks/use-draft-persistence";
import { VISME_EFFECTS, EFFECT_FAMILIES, LANDING_SECTIONS_EFFECTS } from "@/lib/effects-library";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type DeviceMode = "desktop" | "tablet" | "mobile";
type MobileTab  = "edit" | "preview";

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet:  "768px",
  mobile:  "390px",
};

type FieldType = "text" | "textarea" | "color" | "boolean" | "url" | "image";

interface FieldDef {
  label: string;
  path: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
}

interface SectionDef {
  id: string;
  icon: string;
  label: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "site", icon: "🌐", label: "Sitio",
    fields: [
      { label: "Nombre", path: "site.name", type: "text", placeholder: "Shopy Crafter" },
      { label: "Tagline", path: "site.tagline", type: "text", placeholder: "Optimización IA para tu tienda online" },
      { label: "Logo tipo", path: "site.logo.type", type: "text", placeholder: "emoji", hint: "emoji o image" },
      { label: "Emoji/Logo", path: "site.logo.value", type: "text", placeholder: "⚡" },
      { label: "Logo imagen", path: "site.logo.imageUrl", type: "image", hint: "Sube una imagen para reemplazar el emoji del logo" },
      { label: "Favicon", path: "site.favicon", type: "text", placeholder: "⚡" },
      { label: "Color primario", path: "site.primaryColor", type: "color" },
      { label: "Color acento", path: "site.accentColor", type: "color" },
      { label: "Fuente titulares", path: "site.font_heading", type: "text", placeholder: "Instrument Serif" },
      { label: "Fuente cuerpo", path: "site.font_body", type: "text", placeholder: "Geist" },
    ],
  },
  {
    id: "effects", icon: "✨", label: "Efectos Visme",
    fields: [],
  },
  {
    id: "backgrounds", icon: "🎨", label: "Fondos",
    fields: [
      { label: "Hero — Tipo fondo", path: "backgrounds.hero.type", type: "text", hint: "particles, none, video, gallery" },
      { label: "Hero — Color partículas", path: "backgrounds.hero.particleColor", type: "color" },
      { label: "Hero — Video URL", path: "backgrounds.hero.videoUrl", type: "url" },
      { label: "Features — Tipo fondo", path: "backgrounds.features.type", type: "text" },
      { label: "Features — Color partículas", path: "backgrounds.features.particleColor", type: "color" },
      { label: "Pricing — Tipo fondo", path: "backgrounds.pricing.type", type: "text" },
      { label: "Pricing — Color partículas", path: "backgrounds.pricing.particleColor", type: "color" },
    ],
  },
  {
    id: "nav", icon: "🧭", label: "Navegación",
    fields: [
      { label: "Enlace 1 — Texto", path: "nav.links.0.label", type: "text" },
      { label: "Enlace 1 — Href", path: "nav.links.0.href", type: "text" },
      { label: "Enlace 2 — Texto", path: "nav.links.1.label", type: "text" },
      { label: "Enlace 2 — Href", path: "nav.links.1.href", type: "text" },
      { label: "Enlace 3 — Texto", path: "nav.links.2.label", type: "text" },
      { label: "Enlace 3 — Href", path: "nav.links.2.href", type: "text" },
      { label: "Enlace 4 — Texto", path: "nav.links.3.label", type: "text" },
      { label: "Enlace 4 — Href", path: "nav.links.3.href", type: "text" },
      { label: "CTA primario — Texto", path: "nav.ctaPrimary.label", type: "text" },
      { label: "CTA primario — Href", path: "nav.ctaPrimary.href", type: "text" },
      { label: "CTA secundario — Texto", path: "nav.ctaSecondary.label", type: "text" },
      { label: "CTA secundario — Href", path: "nav.ctaSecondary.href", type: "text" },
    ],
  },
  {
    id: "hero", icon: "🦸", label: "Hero",
    fields: [
      { label: "Pill (texto)", path: "hero.pill.text", type: "text", placeholder: "Nuevo · 6 motores activos" },
      { label: "Pill visible", path: "hero.pill.visible", type: "boolean" },
      { label: "Titular", path: "hero.headline", type: "textarea", placeholder: "Optimizamos tu tienda\nShopify con IA\n24/7 por ti" },
      { label: "Highlight", path: "hero.headlineHighlight", type: "text", placeholder: "24/7", hint: "Texto que se muestra en dorado" },
      { label: "Subtítulo", path: "hero.subheadline", type: "textarea", placeholder: "Descripción..." },
      { label: "CTA primario", path: "hero.ctaPrimary.label", type: "text" },
      { label: "CTA primario — Href", path: "hero.ctaPrimary.href", type: "text" },
      { label: "CTA secundario", path: "hero.ctaSecondary.label", type: "text" },
      { label: "CTA secundario — Href", path: "hero.ctaSecondary.href", type: "text" },
      { label: "Imagen Hero", path: "hero.imageUrl", type: "image", hint: "Imagen principal del hero (mockup, producto, etc.)" },
      { label: "Trust badge 1", path: "hero.trustItems.0", type: "text" },
      { label: "Trust badge 2", path: "hero.trustItems.1", type: "text" },
      { label: "Trust badge 3", path: "hero.trustItems.2", type: "text" },
      { label: "Trust badge 4", path: "hero.trustItems.3", type: "text" },
      { label: "CTA APK texto", path: "hero.ctaApk.label", type: "text" },
      { label: "CTA APK href", path: "hero.ctaApk.href", type: "text" },
      { label: "Scroll hint", path: "hero.scrollHint", type: "text" },
      { label: "Demo — URL bar", path: "hero.demo.url", type: "text" },
      { label: "Demo — Status", path: "hero.demo.status", type: "text" },
      { label: "Demo — Nav items", path: "hero.demo.navItems", type: "text", hint: "Separados por coma" },
      { label: "Demo — Métrica 1 label", path: "hero.demo.metrics.0.label", type: "text" },
      { label: "Demo — Métrica 1 valor", path: "hero.demo.metrics.0.value", type: "text" },
      { label: "Demo — Métrica 1 cambio", path: "hero.demo.metrics.0.change", type: "text" },
      { label: "Demo — Métrica 2 label", path: "hero.demo.metrics.1.label", type: "text" },
      { label: "Demo — Métrica 2 valor", path: "hero.demo.metrics.1.value", type: "text" },
      { label: "Demo — Métrica 2 cambio", path: "hero.demo.metrics.1.change", type: "text" },
      { label: "Demo — Métrica 3 label", path: "hero.demo.metrics.2.label", type: "text" },
      { label: "Demo — Métrica 3 valor", path: "hero.demo.metrics.2.value", type: "text" },
      { label: "Demo — Métrica 3 cambio", path: "hero.demo.metrics.2.change", type: "text" },
      { label: "Demo — Métrica 4 label", path: "hero.demo.metrics.3.label", type: "text" },
      { label: "Demo — Métrica 4 valor", path: "hero.demo.metrics.3.value", type: "text" },
      { label: "Demo — Métrica 4 cambio", path: "hero.demo.metrics.3.change", type: "text" },
      { label: "Demo — Tienda 1", path: "hero.demo.stores.0.name", type: "text" },
      { label: "Demo — Tienda 1 score", path: "hero.demo.stores.0.score", type: "text" },
      { label: "Demo — Tienda 2", path: "hero.demo.stores.1.name", type: "text" },
      { label: "Demo — Tienda 2 score", path: "hero.demo.stores.1.score", type: "text" },
      { label: "Demo — Tienda 3", path: "hero.demo.stores.2.name", type: "text" },
      { label: "Demo — Tienda 3 score", path: "hero.demo.stores.2.score", type: "text" },
      { label: "Demo — Actividad 1", path: "hero.demo.activity.0", type: "text" },
      { label: "Demo — Actividad 2", path: "hero.demo.activity.1", type: "text" },
      { label: "Demo — Actividad 3", path: "hero.demo.activity.2", type: "text" },
    ],
  },
  {
    id: "features", icon: "⭐", label: "Motores",
    fields: [
      { label: "Pill", path: "features.pill", type: "text" },
      { label: "Titular", path: "features.headline", type: "text" },
      { label: "Subtítulo", path: "features.subheadline", type: "textarea" },
      { label: "M01 Número", path: "features.items.0.num", type: "text", placeholder: "M01" },
      { label: "M01 Icono", path: "features.items.0.icon", type: "text" },
      { label: "M01 Fondo icono", path: "features.items.0.iconBg", type: "text", hint: "rgba(...) color de fondo" },
      { label: "M01 Título", path: "features.items.0.title", type: "text" },
      { label: "M01 Descripción", path: "features.items.0.description", type: "textarea" },
      { label: "M01 Tags", path: "features.items.0.tags", type: "text", hint: "Separados por coma" },
      { label: "M01 Stat 1 label", path: "features.items.0.stats.0.label", type: "text" },
      { label: "M01 Stat 1 valor", path: "features.items.0.stats.0.value", type: "text" },
      { label: "M01 Stat 2 label", path: "features.items.0.stats.1.label", type: "text" },
      { label: "M01 Stat 2 valor", path: "features.items.0.stats.1.value", type: "text" },
      { label: "M01 Stat 3 label", path: "features.items.0.stats.2.label", type: "text" },
      { label: "M01 Stat 3 valor", path: "features.items.0.stats.2.value", type: "text" },
      { label: "M01 Imagen", path: "features.items.0.imageUrl", type: "image" },
      { label: "M02 Número", path: "features.items.1.num", type: "text", placeholder: "M02" },
      { label: "M02 Icono", path: "features.items.1.icon", type: "text" },
      { label: "M02 Fondo icono", path: "features.items.1.iconBg", type: "text" },
      { label: "M02 Título", path: "features.items.1.title", type: "text" },
      { label: "M02 Descripción", path: "features.items.1.description", type: "textarea" },
      { label: "M02 Tags", path: "features.items.1.tags", type: "text", hint: "Separados por coma" },
      { label: "M02 Stat 1 label", path: "features.items.1.stats.0.label", type: "text" },
      { label: "M02 Stat 1 valor", path: "features.items.1.stats.0.value", type: "text" },
      { label: "M02 Stat 2 label", path: "features.items.1.stats.1.label", type: "text" },
      { label: "M02 Stat 2 valor", path: "features.items.1.stats.1.value", type: "text" },
      { label: "M02 Stat 3 label", path: "features.items.1.stats.2.label", type: "text" },
      { label: "M02 Stat 3 valor", path: "features.items.1.stats.2.value", type: "text" },
      { label: "M02 Imagen", path: "features.items.1.imageUrl", type: "image" },
      { label: "M03 Número", path: "features.items.2.num", type: "text", placeholder: "M03" },
      { label: "M03 Icono", path: "features.items.2.icon", type: "text" },
      { label: "M03 Fondo icono", path: "features.items.2.iconBg", type: "text" },
      { label: "M03 Título", path: "features.items.2.title", type: "text" },
      { label: "M03 Descripción", path: "features.items.2.description", type: "textarea" },
      { label: "M03 Tags", path: "features.items.2.tags", type: "text", hint: "Separados por coma" },
      { label: "M03 Stat 1 label", path: "features.items.2.stats.0.label", type: "text" },
      { label: "M03 Stat 1 valor", path: "features.items.2.stats.0.value", type: "text" },
      { label: "M03 Stat 2 label", path: "features.items.2.stats.1.label", type: "text" },
      { label: "M03 Stat 2 valor", path: "features.items.2.stats.1.value", type: "text" },
      { label: "M03 Stat 3 label", path: "features.items.2.stats.2.label", type: "text" },
      { label: "M03 Stat 3 valor", path: "features.items.2.stats.2.value", type: "text" },
      { label: "M03 Imagen", path: "features.items.2.imageUrl", type: "image" },
      { label: "M04 Número", path: "features.items.3.num", type: "text", placeholder: "M04" },
      { label: "M04 Icono", path: "features.items.3.icon", type: "text" },
      { label: "M04 Fondo icono", path: "features.items.3.iconBg", type: "text" },
      { label: "M04 Título", path: "features.items.3.title", type: "text" },
      { label: "M04 Descripción", path: "features.items.3.description", type: "textarea" },
      { label: "M04 Tags", path: "features.items.3.tags", type: "text", hint: "Separados por coma" },
      { label: "M04 Stat 1 label", path: "features.items.3.stats.0.label", type: "text" },
      { label: "M04 Stat 1 valor", path: "features.items.3.stats.0.value", type: "text" },
      { label: "M04 Stat 2 label", path: "features.items.3.stats.1.label", type: "text" },
      { label: "M04 Stat 2 valor", path: "features.items.3.stats.1.value", type: "text" },
      { label: "M04 Stat 3 label", path: "features.items.3.stats.2.label", type: "text" },
      { label: "M04 Stat 3 valor", path: "features.items.3.stats.2.value", type: "text" },
      { label: "M04 Imagen", path: "features.items.3.imageUrl", type: "image" },
      { label: "M05 Número", path: "features.items.4.num", type: "text", placeholder: "M05" },
      { label: "M05 Icono", path: "features.items.4.icon", type: "text" },
      { label: "M05 Fondo icono", path: "features.items.4.iconBg", type: "text" },
      { label: "M05 Título", path: "features.items.4.title", type: "text" },
      { label: "M05 Descripción", path: "features.items.4.description", type: "textarea" },
      { label: "M05 Tags", path: "features.items.4.tags", type: "text", hint: "Separados por coma" },
      { label: "M05 Stat 1 label", path: "features.items.4.stats.0.label", type: "text" },
      { label: "M05 Stat 1 valor", path: "features.items.4.stats.0.value", type: "text" },
      { label: "M05 Stat 2 label", path: "features.items.4.stats.1.label", type: "text" },
      { label: "M05 Stat 2 valor", path: "features.items.4.stats.1.value", type: "text" },
      { label: "M05 Stat 3 label", path: "features.items.4.stats.2.label", type: "text" },
      { label: "M05 Stat 3 valor", path: "features.items.4.stats.2.value", type: "text" },
      { label: "M05 Imagen", path: "features.items.4.imageUrl", type: "image" },
      { label: "M06 Número", path: "features.items.5.num", type: "text", placeholder: "M06" },
      { label: "M06 Icono", path: "features.items.5.icon", type: "text" },
      { label: "M06 Fondo icono", path: "features.items.5.iconBg", type: "text" },
      { label: "M06 Título", path: "features.items.5.title", type: "text" },
      { label: "M06 Descripción", path: "features.items.5.description", type: "textarea" },
      { label: "M06 Tags", path: "features.items.5.tags", type: "text", hint: "Separados por coma" },
      { label: "M06 Stat 1 label", path: "features.items.5.stats.0.label", type: "text" },
      { label: "M06 Stat 1 valor", path: "features.items.5.stats.0.value", type: "text" },
      { label: "M06 Stat 2 label", path: "features.items.5.stats.1.label", type: "text" },
      { label: "M06 Stat 2 valor", path: "features.items.5.stats.1.value", type: "text" },
      { label: "M06 Stat 3 label", path: "features.items.5.stats.2.label", type: "text" },
      { label: "M06 Stat 3 valor", path: "features.items.5.stats.2.value", type: "text" },
      { label: "M06 Imagen", path: "features.items.5.imageUrl", type: "image" },
    ],
  },
  {
    id: "stats", icon: "📊", label: "Estadísticas",
    fields: [
      { label: "Stat 1 — Número", path: "stats.0.num", type: "text" },
      { label: "Stat 1 — Label",  path: "stats.0.label", type: "text" },
      { label: "Stat 2 — Número", path: "stats.1.num", type: "text" },
      { label: "Stat 2 — Label",  path: "stats.1.label", type: "text" },
      { label: "Stat 3 — Número", path: "stats.2.num", type: "text" },
      { label: "Stat 3 — Label",  path: "stats.2.label", type: "text" },
      { label: "Stat 4 — Número", path: "stats.3.num", type: "text" },
      { label: "Stat 4 — Label",  path: "stats.3.label", type: "text" },
    ],
  },
  {
    id: "how", icon: "❓", label: "Cómo funciona",
    fields: [
      { label: "Pill", path: "how.pill", type: "text" },
      { label: "Titular", path: "how.headline", type: "textarea" },
      { label: "Highlight", path: "how.headlineHighlight", type: "text" },
      { label: "Paso 1 — Título", path: "how.steps.0.title", type: "text" },
      { label: "Paso 1 — Desc.",  path: "how.steps.0.desc", type: "textarea" },
      { label: "Paso 2 — Título", path: "how.steps.1.title", type: "text" },
      { label: "Paso 2 — Desc.",  path: "how.steps.1.desc", type: "textarea" },
      { label: "Paso 3 — Título", path: "how.steps.2.title", type: "text" },
      { label: "Paso 3 — Desc.",  path: "how.steps.2.desc", type: "textarea" },
      { label: "Paso 4 — Título", path: "how.steps.3.title", type: "text" },
      { label: "Paso 4 — Desc.",  path: "how.steps.3.desc", type: "textarea" },
    ],
  },
  {
    id: "pricing", icon: "💰", label: "Precios",
    fields: [
      { label: "Pill", path: "pricing.pill", type: "text" },
      { label: "Titular", path: "pricing.headline", type: "text" },
      { label: "Subtítulo", path: "pricing.subheadline", type: "text" },
      { label: "Plan 1 — Nombre", path: "pricing.plans.0.name", type: "text" },
      { label: "Plan 1 — Precio", path: "pricing.plans.0.price", type: "text" },
      { label: "Plan 1 — Moneda", path: "pricing.plans.0.currency", type: "text", placeholder: "€" },
      { label: "Plan 1 — Periodo", path: "pricing.plans.0.period", type: "text" },
      { label: "Plan 1 — Destacado", path: "pricing.plans.0.featured", type: "boolean" },
      { label: "Plan 1 — Badge", path: "pricing.plans.0.badge", type: "text" },
      { label: "Plan 1 — CTA texto", path: "pricing.plans.0.cta.label", type: "text" },
      { label: "Plan 1 — CTA estilo", path: "pricing.plans.0.cta.style", type: "text", hint: "ghost o gold" },
      { label: "Plan 1 — F1 texto", path: "pricing.plans.0.features.0.text", type: "text" },
      { label: "Plan 1 — F1 incluido", path: "pricing.plans.0.features.0.included", type: "boolean" },
      { label: "Plan 1 — F2 texto", path: "pricing.plans.0.features.1.text", type: "text" },
      { label: "Plan 1 — F2 incluido", path: "pricing.plans.0.features.1.included", type: "boolean" },
      { label: "Plan 1 — F3 texto", path: "pricing.plans.0.features.2.text", type: "text" },
      { label: "Plan 1 — F3 incluido", path: "pricing.plans.0.features.2.included", type: "boolean" },
      { label: "Plan 1 — F4 texto", path: "pricing.plans.0.features.3.text", type: "text" },
      { label: "Plan 1 — F4 incluido", path: "pricing.plans.0.features.3.included", type: "boolean" },
      { label: "Plan 1 — F5 texto", path: "pricing.plans.0.features.4.text", type: "text" },
      { label: "Plan 1 — F5 incluido", path: "pricing.plans.0.features.4.included", type: "boolean" },
      { label: "Plan 1 — F6 texto", path: "pricing.plans.0.features.5.text", type: "text" },
      { label: "Plan 1 — F6 incluido", path: "pricing.plans.0.features.5.included", type: "boolean" },
      { label: "Plan 1 — F7 texto", path: "pricing.plans.0.features.6.text", type: "text" },
      { label: "Plan 1 — F7 incluido", path: "pricing.plans.0.features.6.included", type: "boolean" },
      { label: "Plan 1 — F8 texto", path: "pricing.plans.0.features.7.text", type: "text" },
      { label: "Plan 1 — F8 incluido", path: "pricing.plans.0.features.7.included", type: "boolean" },
      { label: "Plan 2 — Nombre", path: "pricing.plans.1.name", type: "text" },
      { label: "Plan 2 — Precio", path: "pricing.plans.1.price", type: "text" },
      { label: "Plan 2 — Moneda", path: "pricing.plans.1.currency", type: "text", placeholder: "€" },
      { label: "Plan 2 — Periodo", path: "pricing.plans.1.period", type: "text" },
      { label: "Plan 2 — Destacado", path: "pricing.plans.1.featured", type: "boolean" },
      { label: "Plan 2 — Badge",  path: "pricing.plans.1.badge", type: "text" },
      { label: "Plan 2 — CTA texto", path: "pricing.plans.1.cta.label", type: "text" },
      { label: "Plan 2 — CTA estilo", path: "pricing.plans.1.cta.style", type: "text", hint: "ghost o gold" },
      { label: "Plan 2 — F1 texto", path: "pricing.plans.1.features.0.text", type: "text" },
      { label: "Plan 2 — F1 incluido", path: "pricing.plans.1.features.0.included", type: "boolean" },
      { label: "Plan 2 — F2 texto", path: "pricing.plans.1.features.1.text", type: "text" },
      { label: "Plan 2 — F2 incluido", path: "pricing.plans.1.features.1.included", type: "boolean" },
      { label: "Plan 2 — F3 texto", path: "pricing.plans.1.features.2.text", type: "text" },
      { label: "Plan 2 — F3 incluido", path: "pricing.plans.1.features.2.included", type: "boolean" },
      { label: "Plan 2 — F4 texto", path: "pricing.plans.1.features.3.text", type: "text" },
      { label: "Plan 2 — F4 incluido", path: "pricing.plans.1.features.3.included", type: "boolean" },
      { label: "Plan 2 — F5 texto", path: "pricing.plans.1.features.4.text", type: "text" },
      { label: "Plan 2 — F5 incluido", path: "pricing.plans.1.features.4.included", type: "boolean" },
      { label: "Plan 2 — F6 texto", path: "pricing.plans.1.features.5.text", type: "text" },
      { label: "Plan 2 — F6 incluido", path: "pricing.plans.1.features.5.included", type: "boolean" },
      { label: "Plan 2 — F7 texto", path: "pricing.plans.1.features.6.text", type: "text" },
      { label: "Plan 2 — F7 incluido", path: "pricing.plans.1.features.6.included", type: "boolean" },
      { label: "Plan 2 — F8 texto", path: "pricing.plans.1.features.7.text", type: "text" },
      { label: "Plan 2 — F8 incluido", path: "pricing.plans.1.features.7.included", type: "boolean" },
      { label: "Plan 3 — Nombre", path: "pricing.plans.2.name", type: "text" },
      { label: "Plan 3 — Precio", path: "pricing.plans.2.price", type: "text" },
      { label: "Plan 3 — Moneda", path: "pricing.plans.2.currency", type: "text", placeholder: "€" },
      { label: "Plan 3 — Periodo", path: "pricing.plans.2.period", type: "text" },
      { label: "Plan 3 — Destacado", path: "pricing.plans.2.featured", type: "boolean" },
      { label: "Plan 3 — Badge", path: "pricing.plans.2.badge", type: "text" },
      { label: "Plan 3 — CTA texto", path: "pricing.plans.2.cta.label", type: "text" },
      { label: "Plan 3 — CTA estilo", path: "pricing.plans.2.cta.style", type: "text", hint: "ghost o gold" },
      { label: "Plan 3 — F1 texto", path: "pricing.plans.2.features.0.text", type: "text" },
      { label: "Plan 3 — F1 incluido", path: "pricing.plans.2.features.0.included", type: "boolean" },
      { label: "Plan 3 — F2 texto", path: "pricing.plans.2.features.1.text", type: "text" },
      { label: "Plan 3 — F2 incluido", path: "pricing.plans.2.features.1.included", type: "boolean" },
      { label: "Plan 3 — F3 texto", path: "pricing.plans.2.features.2.text", type: "text" },
      { label: "Plan 3 — F3 incluido", path: "pricing.plans.2.features.2.included", type: "boolean" },
      { label: "Plan 3 — F4 texto", path: "pricing.plans.2.features.3.text", type: "text" },
      { label: "Plan 3 — F4 incluido", path: "pricing.plans.2.features.3.included", type: "boolean" },
      { label: "Plan 3 — F5 texto", path: "pricing.plans.2.features.4.text", type: "text" },
      { label: "Plan 3 — F5 incluido", path: "pricing.plans.2.features.4.included", type: "boolean" },
      { label: "Plan 3 — F6 texto", path: "pricing.plans.2.features.5.text", type: "text" },
      { label: "Plan 3 — F6 incluido", path: "pricing.plans.2.features.5.included", type: "boolean" },
      { label: "Plan 3 — F7 texto", path: "pricing.plans.2.features.6.text", type: "text" },
      { label: "Plan 3 — F7 incluido", path: "pricing.plans.2.features.6.included", type: "boolean" },
      { label: "Plan 3 — F8 texto", path: "pricing.plans.2.features.7.text", type: "text" },
      { label: "Plan 3 — F8 incluido", path: "pricing.plans.2.features.7.included", type: "boolean" },
      { label: "Plan 4 — Nombre", path: "pricing.plans.3.name", type: "text" },
      { label: "Plan 4 — Precio", path: "pricing.plans.3.price", type: "text" },
      { label: "Plan 4 — Moneda", path: "pricing.plans.3.currency", type: "text", placeholder: "€" },
      { label: "Plan 4 — Periodo", path: "pricing.plans.3.period", type: "text" },
      { label: "Plan 4 — Destacado", path: "pricing.plans.3.featured", type: "boolean" },
      { label: "Plan 4 — Badge",  path: "pricing.plans.3.badge", type: "text" },
      { label: "Plan 4 — CTA texto", path: "pricing.plans.3.cta.label", type: "text" },
      { label: "Plan 4 — CTA estilo", path: "pricing.plans.3.cta.style", type: "text", hint: "ghost o gold" },
      { label: "Plan 4 — F1 texto", path: "pricing.plans.3.features.0.text", type: "text" },
      { label: "Plan 4 — F1 incluido", path: "pricing.plans.3.features.0.included", type: "boolean" },
      { label: "Plan 4 — F2 texto", path: "pricing.plans.3.features.1.text", type: "text" },
      { label: "Plan 4 — F2 incluido", path: "pricing.plans.3.features.1.included", type: "boolean" },
      { label: "Plan 4 — F3 texto", path: "pricing.plans.3.features.2.text", type: "text" },
      { label: "Plan 4 — F3 incluido", path: "pricing.plans.3.features.2.included", type: "boolean" },
      { label: "Plan 4 — F4 texto", path: "pricing.plans.3.features.3.text", type: "text" },
      { label: "Plan 4 — F4 incluido", path: "pricing.plans.3.features.3.included", type: "boolean" },
      { label: "Plan 4 — F5 texto", path: "pricing.plans.3.features.4.text", type: "text" },
      { label: "Plan 4 — F5 incluido", path: "pricing.plans.3.features.4.included", type: "boolean" },
      { label: "Plan 4 — F6 texto", path: "pricing.plans.3.features.5.text", type: "text" },
      { label: "Plan 4 — F6 incluido", path: "pricing.plans.3.features.5.included", type: "boolean" },
      { label: "Plan 4 — F7 texto", path: "pricing.plans.3.features.6.text", type: "text" },
      { label: "Plan 4 — F7 incluido", path: "pricing.plans.3.features.6.included", type: "boolean" },
      { label: "Plan 4 — F8 texto", path: "pricing.plans.3.features.7.text", type: "text" },
      { label: "Plan 4 — F8 incluido", path: "pricing.plans.3.features.7.included", type: "boolean" },
    ],
  },
  {
    id: "testimonials", icon: "💬", label: "Testimonios",
    fields: [
      { label: "Pill", path: "testimonials.pill", type: "text" },
      { label: "Titular", path: "testimonials.headline", type: "text" },
      { label: "Highlight", path: "testimonials.headlineHighlight", type: "text" },
      { label: "T1 — Estrellas", path: "testimonials.items.0.stars", type: "text", hint: "1-5" },
      { label: "T1 — Texto",   path: "testimonials.items.0.text", type: "textarea" },
      { label: "T1 — Métrica", path: "testimonials.items.0.metric", type: "text" },
      { label: "T1 — Autor",   path: "testimonials.items.0.author", type: "text" },
      { label: "T1 — Rol",     path: "testimonials.items.0.role", type: "text" },
      { label: "T1 — Iniciales", path: "testimonials.items.0.initials", type: "text", placeholder: "MR" },
      { label: "T1 — Color avatar", path: "testimonials.items.0.avatarColor", type: "text", hint: "rgba(...)" },
      { label: "T1 — Color texto avatar", path: "testimonials.items.0.avatarTextColor", type: "text" },
      { label: "T1 — Avatar foto", path: "testimonials.items.0.avatarUrl", type: "image" },
      { label: "T2 — Estrellas", path: "testimonials.items.1.stars", type: "text", hint: "1-5" },
      { label: "T2 — Texto",   path: "testimonials.items.1.text", type: "textarea" },
      { label: "T2 — Métrica", path: "testimonials.items.1.metric", type: "text" },
      { label: "T2 — Autor",   path: "testimonials.items.1.author", type: "text" },
      { label: "T2 — Rol",     path: "testimonials.items.1.role", type: "text" },
      { label: "T2 — Iniciales", path: "testimonials.items.1.initials", type: "text", placeholder: "AL" },
      { label: "T2 — Color avatar", path: "testimonials.items.1.avatarColor", type: "text", hint: "rgba(...)" },
      { label: "T2 — Color texto avatar", path: "testimonials.items.1.avatarTextColor", type: "text" },
      { label: "T2 — Avatar foto", path: "testimonials.items.1.avatarUrl", type: "image" },
      { label: "T3 — Estrellas", path: "testimonials.items.2.stars", type: "text", hint: "1-5" },
      { label: "T3 — Texto",   path: "testimonials.items.2.text", type: "textarea" },
      { label: "T3 — Métrica", path: "testimonials.items.2.metric", type: "text" },
      { label: "T3 — Autor",   path: "testimonials.items.2.author", type: "text" },
      { label: "T3 — Rol",     path: "testimonials.items.2.role", type: "text" },
      { label: "T3 — Iniciales", path: "testimonials.items.2.initials", type: "text", placeholder: "JM" },
      { label: "T3 — Color avatar", path: "testimonials.items.2.avatarColor", type: "text", hint: "rgba(...)" },
      { label: "T3 — Color texto avatar", path: "testimonials.items.2.avatarTextColor", type: "text" },
      { label: "T3 — Avatar foto", path: "testimonials.items.2.avatarUrl", type: "image" },
    ],
  },
  {
    id: "cta", icon: "📣", label: "CTA Final",
    fields: [
      { label: "Pill", path: "cta.pill", type: "text" },
      { label: "Titular",          path: "cta.headline", type: "textarea" },
      { label: "Highlight",        path: "cta.headlineHighlight", type: "text" },
      { label: "Subtítulo",        path: "cta.subheadline", type: "textarea" },
      { label: "Placeholder email",path: "cta.placeholder", type: "text" },
      { label: "Botón",            path: "cta.buttonLabel", type: "text" },
      { label: "Pie de página",    path: "cta.finePrint", type: "text" },
    ],
  },
  {
    id: "results", icon: "📈", label: "Resultados",
    fields: [
      { label: "Pill", path: "results.pill", type: "text" },
      { label: "Titular", path: "results.headline", type: "text" },
      { label: "Highlight", path: "results.headlineHighlight", type: "text" },
      { label: "Stat 1 — Prefijo", path: "results.stats.0.prefix", type: "text" },
      { label: "Stat 1 — Número", path: "results.stats.0.num", type: "text" },
      { label: "Stat 1 — Sufijo", path: "results.stats.0.suffix", type: "text" },
      { label: "Stat 1 — Label", path: "results.stats.0.label", type: "text" },
      { label: "Stat 1 — Color", path: "results.stats.0.color", type: "text" },
      { label: "Stat 2 — Prefijo", path: "results.stats.1.prefix", type: "text" },
      { label: "Stat 2 — Número", path: "results.stats.1.num", type: "text" },
      { label: "Stat 2 — Sufijo", path: "results.stats.1.suffix", type: "text" },
      { label: "Stat 2 — Label", path: "results.stats.1.label", type: "text" },
      { label: "Stat 2 — Color", path: "results.stats.1.color", type: "text" },
      { label: "Stat 3 — Prefijo", path: "results.stats.2.prefix", type: "text" },
      { label: "Stat 3 — Número", path: "results.stats.2.num", type: "text" },
      { label: "Stat 3 — Sufijo", path: "results.stats.2.suffix", type: "text" },
      { label: "Stat 3 — Label", path: "results.stats.2.label", type: "text" },
      { label: "Stat 3 — Color", path: "results.stats.2.color", type: "text" },
      { label: "Stat 4 — Prefijo", path: "results.stats.3.prefix", type: "text" },
      { label: "Stat 4 — Número", path: "results.stats.3.num", type: "text" },
      { label: "Stat 4 — Sufijo", path: "results.stats.3.suffix", type: "text" },
      { label: "Stat 4 — Label", path: "results.stats.3.label", type: "text" },
      { label: "Stat 4 — Color", path: "results.stats.3.color", type: "text" },
      { label: "Tech badge 1 icono", path: "results.techBadges.0.icon", type: "text" },
      { label: "Tech badge 1 label", path: "results.techBadges.0.label", type: "text" },
      { label: "Tech badge 2 icono", path: "results.techBadges.1.icon", type: "text" },
      { label: "Tech badge 2 label", path: "results.techBadges.1.label", type: "text" },
      { label: "Tech badge 3 icono", path: "results.techBadges.2.icon", type: "text" },
      { label: "Tech badge 3 label", path: "results.techBadges.2.label", type: "text" },
      { label: "Tech badge 4 icono", path: "results.techBadges.3.icon", type: "text" },
      { label: "Tech badge 4 label", path: "results.techBadges.3.label", type: "text" },
      { label: "Tech badge 5 icono", path: "results.techBadges.4.icon", type: "text" },
      { label: "Tech badge 5 label", path: "results.techBadges.4.label", type: "text" },
      { label: "Tech badge 6 icono", path: "results.techBadges.5.icon", type: "text" },
      { label: "Tech badge 6 label", path: "results.techBadges.5.label", type: "text" },
      { label: "Tech badge 7 icono", path: "results.techBadges.6.icon", type: "text" },
      { label: "Tech badge 7 label", path: "results.techBadges.6.label", type: "text" },
    ],
  },
  {
    id: "contact", icon: "📞", label: "Contacto",
    fields: [
      { label: "Pill", path: "contact.pill", type: "text" },
      { label: "Titular", path: "contact.headline", type: "text" },
      { label: "Highlight", path: "contact.headlineHighlight", type: "text" },
      { label: "Subtítulo", path: "contact.subheadline", type: "textarea" },
      { label: "Botón enviar", path: "contact.buttonLabel", type: "text" },
      { label: "Éxito — Título", path: "contact.successTitle", type: "text" },
      { label: "Éxito — Texto", path: "contact.successText", type: "text" },
      { label: "Éxito — Subtexto", path: "contact.successSubtext", type: "text" },
      { label: "Pie de formulario", path: "contact.finePrint", type: "text" },
      { label: "Label — Nombre", path: "contact.labels.name", type: "text" },
      { label: "Label — Email", path: "contact.labels.email", type: "text" },
      { label: "Label — Teléfono", path: "contact.labels.phone", type: "text" },
      { label: "Label — URL tienda", path: "contact.labels.storeUrl", type: "text" },
      { label: "Label — Nicho", path: "contact.labels.niche", type: "text" },
      { label: "Label — Facturación", path: "contact.labels.revenue", type: "text" },
      { label: "Label — Mensaje", path: "contact.labels.message", type: "text" },
      { label: "Placeholder — Nombre", path: "contact.placeholders.name", type: "text" },
      { label: "Placeholder — Email", path: "contact.placeholders.email", type: "text" },
      { label: "Placeholder — Teléfono", path: "contact.placeholders.phone", type: "text" },
      { label: "Placeholder — URL tienda", path: "contact.placeholders.storeUrl", type: "text" },
      { label: "Placeholder — Nicho", path: "contact.placeholders.niche", type: "text" },
      { label: "Placeholder — Facturación", path: "contact.placeholders.revenue", type: "text" },
      { label: "Placeholder — Mensaje", path: "contact.placeholders.message", type: "textarea" },
      { label: "Opciones nicho", path: "contact.nicheOptions", type: "text", hint: "Separadas por coma" },
      { label: "Opciones facturación", path: "contact.revenueOptions", type: "text", hint: "Separadas por coma" },
      { label: "Label — Redes sociales", path: "contact.socialLabel", type: "text" },
      { label: "Placeholder — Redes sociales", path: "contact.socialPlaceholder", type: "text" },
      { label: "Label — Servicios", path: "contact.servicesLabel", type: "text" },
      { label: "Opciones servicios", path: "contact.serviceOptions", type: "text", hint: "Separadas por coma" },
    ],
  },
  {
    id: "howCards", icon: "🃏", label: "Demo Cards",
    fields: [
      { label: "Card 1 icono", path: "howCards.0.icon", type: "text" },
      { label: "Card 1 título", path: "howCards.0.title", type: "text" },
      { label: "Card 1 subtítulo", path: "howCards.0.sub", type: "text" },
      { label: "Card 1 barra %", path: "howCards.0.barPercent", type: "text" },
      { label: "Card 2 icono", path: "howCards.1.icon", type: "text" },
      { label: "Card 2 título", path: "howCards.1.title", type: "text" },
      { label: "Card 2 subtítulo", path: "howCards.1.sub", type: "text" },
      { label: "Card 2 barra %", path: "howCards.1.barPercent", type: "text" },
      { label: "Card 3 icono", path: "howCards.2.icon", type: "text" },
      { label: "Card 3 título", path: "howCards.2.title", type: "text" },
      { label: "Card 3 subtítulo", path: "howCards.2.sub", type: "text" },
      { label: "Card 3 barra %", path: "howCards.2.barPercent", type: "text" },
      { label: "Impacto — icono", path: "howImpact.icon", type: "text" },
      { label: "Impacto — título", path: "howImpact.title", type: "text" },
      { label: "Impacto — subtítulo", path: "howImpact.sub", type: "text" },
    ],
  },
  {
    id: "sectionNav", icon: "🧭", label: "Navegación secciones",
    fields: [
      { label: "Nav 1 (Inicio)", path: "sectionNav.0", type: "text" },
      { label: "Nav 2 (Motores)", path: "sectionNav.1", type: "text" },
      { label: "Nav 3 (Demo)", path: "sectionNav.2", type: "text" },
      { label: "Nav 4 (Resultados)", path: "sectionNav.3", type: "text" },
      { label: "Nav 5 (Precios)", path: "sectionNav.4", type: "text" },
      { label: "Nav 6 (Clientes)", path: "sectionNav.5", type: "text" },
      { label: "Nav 7 (Contactar)", path: "sectionNav.6", type: "text" },
      { label: "Nav 8 (Empezar)", path: "sectionNav.7", type: "text" },
      { label: "Admin — Volver al panel", path: "adminBackLabel", type: "text" },
    ],
  },
  {
    id: "apkLabels", icon: "📱", label: "APK Labels",
    fields: [
      { label: "Estado idle", path: "apkLabels.idle", type: "text" },
      { label: "Estado verificando", path: "apkLabels.checking", type: "text" },
      { label: "Estado descargando", path: "apkLabels.downloading", type: "text" },
      { label: "Estado construyendo", path: "apkLabels.building", type: "text" },
      { label: "Estado no disponible", path: "apkLabels.unavailable", type: "text" },
    ],
  },
  {
    id: "errorMessages", icon: "⚠️", label: "Mensajes de error",
    fields: [
      { label: "Error al enviar", path: "errorMessages.sendFail", type: "text" },
      { label: "Error inesperado", path: "errorMessages.unexpected", type: "text" },
    ],
  },
  {
    id: "heroDemoTitles", icon: "📋", label: "Hero Demo Títulos",
    fields: [
      { label: "Salud de tiendas", path: "heroDemoTitles.storeHealth", type: "text" },
      { label: "Actividad reciente", path: "heroDemoTitles.recentActivity", type: "text" },
    ],
  },
  {
    id: "adminPanel", icon: "🖥", label: "Panel Admin UI",
    fields: [
      { label: "Label — Tus Tiendas", path: "adminPanel.sidebarLabels.yourStores", type: "text" },
      { label: "Label — Sin tiendas", path: "adminPanel.sidebarLabels.noStores", type: "text" },
      { label: "Label — Nueva tienda", path: "adminPanel.sidebarLabels.newStore", type: "text" },
      { label: "Label — Administración", path: "adminPanel.sidebarLabels.admin", type: "text" },
      { label: "Label — Configuración", path: "adminPanel.sidebarLabels.config", type: "text" },
      { label: "Label — Hecho por", path: "adminPanel.sidebarLabels.madeBy", type: "text" },
      { label: "Header — Sin conexión", path: "adminPanel.header.offline", type: "text" },
      { label: "Header — Búsqueda", path: "adminPanel.header.search", type: "text" },
      { label: "Header — Activo", path: "adminPanel.header.active", type: "text" },
      { label: "User — Ilimitados", path: "adminPanel.user.unlimited", type: "text" },
      { label: "User — Administrador", path: "adminPanel.user.adminRole", type: "text" },
      { label: "Tooltip — Modo claro", path: "adminPanel.tooltips.lightMode", type: "text" },
      { label: "Tooltip — Modo oscuro", path: "adminPanel.tooltips.darkMode", type: "text" },
      { label: "Tooltip — Cerrar sesión", path: "adminPanel.tooltips.logout", type: "text" },
      { label: "Notif — Título", path: "adminPanel.notifications.title", type: "text" },
      { label: "Notif — Vacío", path: "adminPanel.notifications.empty", type: "text" },
      { label: "Notif — Hint", path: "adminPanel.notifications.emptyHint", type: "text" },
    ],
  },
  {
    id: "clientPanel", icon: "👤", label: "Panel Cliente UI",
    fields: [
      { label: "Nav 1 label", path: "clientPanel.navItems.0.label", type: "text" },
      { label: "Nav 1 icono", path: "clientPanel.navItems.0.icon", type: "text" },
      { label: "Nav 2 label", path: "clientPanel.navItems.1.label", type: "text" },
      { label: "Nav 2 icono", path: "clientPanel.navItems.1.icon", type: "text" },
      { label: "Nav 3 label", path: "clientPanel.navItems.2.label", type: "text" },
      { label: "Nav 3 icono", path: "clientPanel.navItems.2.icon", type: "text" },
      { label: "Nav 4 label", path: "clientPanel.navItems.3.label", type: "text" },
      { label: "Nav 4 icono", path: "clientPanel.navItems.3.icon", type: "text" },
      { label: "Nav 5 label", path: "clientPanel.navItems.4.label", type: "text" },
      { label: "Nav 5 icono", path: "clientPanel.navItems.4.icon", type: "text" },
      { label: "Label — Tu Tienda", path: "clientPanel.sidebar.yourStore", type: "text" },
      { label: "Label — Nombre fallback", path: "clientPanel.sidebar.defaultName", type: "text" },
      { label: "Label — Panel de tienda", path: "clientPanel.sidebar.storePanel", type: "text" },
      { label: "Label — Gestionado por", path: "clientPanel.sidebar.managedBy", type: "text" },
      { label: "Label — Tu agencia", path: "clientPanel.sidebar.agency", type: "text" },
      { label: "Label — Motores activos", path: "clientPanel.sidebar.enginesActive", type: "text" },
      { label: "Label — Navegación", path: "clientPanel.sidebar.navigation", type: "text" },
      { label: "Label — Optimizaciones", path: "clientPanel.sidebar.aiOptimizations", type: "text" },
      { label: "Saludo — nombre personalizado (override)", path: "clientPanel.greetingName", type: "text" },
      { label: "Topbar texto", path: "clientPanel.topbar", type: "text" },
      { label: "Badge logo", path: "clientPanel.logoBadge", type: "text" },
      { label: "Status online", path: "clientPanel.statusOnline", type: "text" },
    ],
  },
  {
    id: "adminNav", icon: "🛠", label: "Nav Admin Panel",
    fields: [],
  },
  {
    id: "footer", icon: "🔗", label: "Footer",
    fields: [
      { label: "Tagline",   path: "footer.tagline", type: "textarea" },
      { label: "Copyright", path: "footer.copyright", type: "text" },
      { label: "Col 1 — Título", path: "footer.columns.0.title", type: "text" },
      { label: "Col 1 — Link 1 texto", path: "footer.columns.0.links.0.label", type: "text" },
      { label: "Col 1 — Link 1 href", path: "footer.columns.0.links.0.href", type: "text" },
      { label: "Col 1 — Link 2 texto", path: "footer.columns.0.links.1.label", type: "text" },
      { label: "Col 1 — Link 2 href", path: "footer.columns.0.links.1.href", type: "text" },
      { label: "Col 1 — Link 3 texto", path: "footer.columns.0.links.2.label", type: "text" },
      { label: "Col 1 — Link 3 href", path: "footer.columns.0.links.2.href", type: "text" },
      { label: "Col 1 — Link 4 texto", path: "footer.columns.0.links.3.label", type: "text" },
      { label: "Col 1 — Link 4 href", path: "footer.columns.0.links.3.href", type: "text" },
      { label: "Col 1 — Link 5 texto", path: "footer.columns.0.links.4.label", type: "text" },
      { label: "Col 1 — Link 5 href", path: "footer.columns.0.links.4.href", type: "text" },
      { label: "Col 2 — Título", path: "footer.columns.1.title", type: "text" },
      { label: "Col 2 — Link 1 texto", path: "footer.columns.1.links.0.label", type: "text" },
      { label: "Col 2 — Link 1 href", path: "footer.columns.1.links.0.href", type: "text" },
      { label: "Col 2 — Link 2 texto", path: "footer.columns.1.links.1.label", type: "text" },
      { label: "Col 2 — Link 2 href", path: "footer.columns.1.links.1.href", type: "text" },
      { label: "Col 2 — Link 3 texto", path: "footer.columns.1.links.2.label", type: "text" },
      { label: "Col 2 — Link 3 href", path: "footer.columns.1.links.2.href", type: "text" },
      { label: "Col 2 — Link 4 texto", path: "footer.columns.1.links.3.label", type: "text" },
      { label: "Col 2 — Link 4 href", path: "footer.columns.1.links.3.href", type: "text" },
      { label: "Col 2 — Link 5 texto", path: "footer.columns.1.links.4.label", type: "text" },
      { label: "Col 2 — Link 5 href", path: "footer.columns.1.links.4.href", type: "text" },
      { label: "Col 3 — Título", path: "footer.columns.2.title", type: "text" },
      { label: "Col 3 — Link 1 texto", path: "footer.columns.2.links.0.label", type: "text" },
      { label: "Col 3 — Link 1 href", path: "footer.columns.2.links.0.href", type: "text" },
      { label: "Col 3 — Link 2 texto", path: "footer.columns.2.links.1.label", type: "text" },
      { label: "Col 3 — Link 2 href", path: "footer.columns.2.links.1.href", type: "text" },
      { label: "Col 3 — Link 3 texto", path: "footer.columns.2.links.2.label", type: "text" },
      { label: "Col 3 — Link 3 href", path: "footer.columns.2.links.2.href", type: "text" },
      { label: "Col 3 — Link 4 texto", path: "footer.columns.2.links.3.label", type: "text" },
      { label: "Col 3 — Link 4 href", path: "footer.columns.2.links.3.href", type: "text" },
      { label: "Col 3 — Link 5 texto", path: "footer.columns.2.links.4.label", type: "text" },
      { label: "Col 3 — Link 5 href", path: "footer.columns.2.links.4.href", type: "text" },
      { label: "Badge 1", path: "footer.badges.0", type: "text" },
      { label: "Badge 2", path: "footer.badges.1", type: "text" },
      { label: "Badge 3", path: "footer.badges.2", type: "text" },
    ],
  },
  {
    id: "calculator", icon: "🧮", label: "Calculadora",
    fields: [
      { label: "Pill", path: "calculator.pill", type: "text" },
      { label: "Titular", path: "calculator.headline", type: "text" },
      { label: "Highlight", path: "calculator.headlineHighlight", type: "text" },
      { label: "Subtítulo", path: "calculator.subheadline", type: "textarea" },
      { label: "Disclaimer", path: "calculator.disclaimer", type: "textarea" },
      { label: "Label resultado", path: "calculator.resultLabel", type: "text" },
      { label: "Label pago único", path: "calculator.oneTimeLabel", type: "text" },
      { label: "Label suscripción", path: "calculator.recurringLabel", type: "text" },
      { label: "CTA botón", path: "calculator.ctaLabel", type: "text" },
      { label: "Label vacío", path: "calculator.emptyLabel", type: "text" },
      { label: "Servicio 1 — Nombre", path: "calculator.oneTimeServices.0.name", type: "text" },
      { label: "Servicio 1 — Desc.", path: "calculator.oneTimeServices.0.description", type: "text" },
      { label: "Servicio 1 — Precio", path: "calculator.oneTimeServices.0.price", type: "text" },
      { label: "Servicio 1 — Icono", path: "calculator.oneTimeServices.0.icon", type: "text" },
      { label: "Servicio 2 — Nombre", path: "calculator.oneTimeServices.1.name", type: "text" },
      { label: "Servicio 2 — Desc.", path: "calculator.oneTimeServices.1.description", type: "text" },
      { label: "Servicio 2 — Precio", path: "calculator.oneTimeServices.1.price", type: "text" },
      { label: "Servicio 2 — Icono", path: "calculator.oneTimeServices.1.icon", type: "text" },
      { label: "Servicio 3 — Nombre", path: "calculator.oneTimeServices.2.name", type: "text" },
      { label: "Servicio 3 — Desc.", path: "calculator.oneTimeServices.2.description", type: "text" },
      { label: "Servicio 3 — Precio", path: "calculator.oneTimeServices.2.price", type: "text" },
      { label: "Servicio 3 — Icono", path: "calculator.oneTimeServices.2.icon", type: "text" },
      { label: "Servicio 4 — Nombre", path: "calculator.oneTimeServices.3.name", type: "text" },
      { label: "Servicio 4 — Desc.", path: "calculator.oneTimeServices.3.description", type: "text" },
      { label: "Servicio 4 — Precio", path: "calculator.oneTimeServices.3.price", type: "text" },
      { label: "Servicio 4 — Icono", path: "calculator.oneTimeServices.3.icon", type: "text" },
      { label: "Servicio 5 — Nombre", path: "calculator.oneTimeServices.4.name", type: "text" },
      { label: "Servicio 5 — Desc.", path: "calculator.oneTimeServices.4.description", type: "text" },
      { label: "Servicio 5 — Precio", path: "calculator.oneTimeServices.4.price", type: "text" },
      { label: "Servicio 5 — Icono", path: "calculator.oneTimeServices.4.icon", type: "text" },
      { label: "Servicio 6 — Nombre", path: "calculator.oneTimeServices.5.name", type: "text" },
      { label: "Servicio 6 — Desc.", path: "calculator.oneTimeServices.5.description", type: "text" },
      { label: "Servicio 6 — Precio", path: "calculator.oneTimeServices.5.price", type: "text" },
      { label: "Servicio 6 — Icono", path: "calculator.oneTimeServices.5.icon", type: "text" },
      { label: "Servicio 7 — Nombre", path: "calculator.oneTimeServices.6.name", type: "text" },
      { label: "Servicio 7 — Desc.", path: "calculator.oneTimeServices.6.description", type: "text" },
      { label: "Servicio 7 — Precio", path: "calculator.oneTimeServices.6.price", type: "text" },
      { label: "Servicio 7 — Icono", path: "calculator.oneTimeServices.6.icon", type: "text" },
      { label: "Servicio 8 — Nombre", path: "calculator.oneTimeServices.7.name", type: "text" },
      { label: "Servicio 8 — Desc.", path: "calculator.oneTimeServices.7.description", type: "text" },
      { label: "Servicio 8 — Precio", path: "calculator.oneTimeServices.7.price", type: "text" },
      { label: "Servicio 8 — Icono", path: "calculator.oneTimeServices.7.icon", type: "text" },
      { label: "Servicio 9 — Nombre", path: "calculator.oneTimeServices.8.name", type: "text" },
      { label: "Servicio 9 — Desc.", path: "calculator.oneTimeServices.8.description", type: "text" },
      { label: "Servicio 9 — Precio", path: "calculator.oneTimeServices.8.price", type: "text" },
      { label: "Servicio 9 — Icono", path: "calculator.oneTimeServices.8.icon", type: "text" },
      { label: "Suscripción 1 — Nombre", path: "calculator.recurringServices.0.name", type: "text" },
      { label: "Suscripción 1 — Desc.", path: "calculator.recurringServices.0.description", type: "text" },
      { label: "Suscripción 1 — Precio", path: "calculator.recurringServices.0.price", type: "text" },
      { label: "Suscripción 1 — Periodo", path: "calculator.recurringServices.0.period", type: "text" },
      { label: "Suscripción 1 — Icono", path: "calculator.recurringServices.0.icon", type: "text" },
      { label: "Suscripción 2 — Nombre", path: "calculator.recurringServices.1.name", type: "text" },
      { label: "Suscripción 2 — Desc.", path: "calculator.recurringServices.1.description", type: "text" },
      { label: "Suscripción 2 — Precio", path: "calculator.recurringServices.1.price", type: "text" },
      { label: "Suscripción 2 — Periodo", path: "calculator.recurringServices.1.period", type: "text" },
      { label: "Suscripción 2 — Icono", path: "calculator.recurringServices.1.icon", type: "text" },
      { label: "Suscripción 3 — Nombre", path: "calculator.recurringServices.2.name", type: "text" },
      { label: "Suscripción 3 — Desc.", path: "calculator.recurringServices.2.description", type: "text" },
      { label: "Suscripción 3 — Precio", path: "calculator.recurringServices.2.price", type: "text" },
      { label: "Suscripción 3 — Periodo", path: "calculator.recurringServices.2.period", type: "text" },
      { label: "Suscripción 3 — Icono", path: "calculator.recurringServices.2.icon", type: "text" },
    ],
  },
];

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (BLOCKED_KEYS.has(k)) return "";
    if (cur === null || cur === undefined) return "";
    if (Array.isArray(cur)) cur = (cur as unknown[])[parseInt(k)]; // nosemgrep: prototype-pollution-loop
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[k]; // nosemgrep: prototype-pollution-loop
    else return "";
  }
  return cur;
}

/* ── NAV SECTION EDITOR (dynamic, no hardcoded indices) ─────────────────── */
function NavArrayEditor({
  title, items, basePath, fieldDefs, onChange,
}: {
  title: string;
  items: any[];
  basePath: string;
  fieldDefs: { key: string; label: string; placeholder?: string }[];
  onChange: (path: string, value: unknown) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);

  const updateField = (idx: number, key: string, val: string) => {
    const updated = items.map((it: any, i: number) => i === idx ? { ...it, [key]: val } : it);
    onChange(basePath, updated);
  };

  const addItem = () => {
    const newItem: Record<string, string> = {};
    for (const f of fieldDefs) newItem[f.key] = "";
    onChange(basePath, [...items, newItem]);
  };

  const removeItem = (idx: number) => {
    const item = items[idx];
    const name = item?.label || item?.id || `Item ${idx + 1}`;
    if (!confirm(`¿Eliminar "${name}" de ${title}?`)) return;
    onChange(basePath, items.filter((_: any, i: number) => i !== idx));
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const arr = [...items];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    onChange(basePath, arr);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 12px", background: "var(--ink2)", border: "1px solid var(--bdr)",
          borderRadius: collapsed ? 10 : "10px 10px 0 0", cursor: "pointer", transition: "all .15s",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t)" }}>{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "var(--t3)", background: "var(--ink3)", padding: "2px 8px", borderRadius: 8 }}>
            {items.length}
          </span>
          {collapsed ? <ChevronRight size={13} style={{ color: "var(--t4)" }} /> : <ChevronDown size={13} style={{ color: "var(--gold)" }} />}
        </span>
      </button>
      {!collapsed && (
        <div style={{ border: "1px solid var(--bdr)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          {items.map((item: any, idx: number) => (
            <div key={idx} style={{
              padding: "10px 12px", background: idx % 2 === 0 ? "var(--ink)" : "var(--ink2)",
              borderBottom: idx < items.length - 1 ? "1px solid var(--bdr)" : "none",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
                <button onClick={() => moveItem(idx, idx - 1)} disabled={idx === 0}
                  style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? "var(--ink3)" : "var(--t3)", padding: 1, lineHeight: 1 }}>
                  <ArrowUp size={11} />
                </button>
                <span style={{ fontSize: 9, color: "var(--t4)", textAlign: "center", fontWeight: 700 }}>{idx + 1}</span>
                <button onClick={() => moveItem(idx, idx + 1)} disabled={idx === items.length - 1}
                  style={{ background: "none", border: "none", cursor: idx === items.length - 1 ? "default" : "pointer", color: idx === items.length - 1 ? "var(--ink3)" : "var(--t3)", padding: 1, lineHeight: 1 }}>
                  <ArrowDown size={11} />
                </button>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                {fieldDefs.map(fd => (
                  <div key={fd.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ fontSize: 10, color: "var(--t3)", minWidth: 40, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      {fd.label}
                    </label>
                    <input
                      value={item[fd.key] ?? ""}
                      placeholder={fd.placeholder}
                      onChange={e => updateField(idx, fd.key, e.target.value)}
                      style={{
                        flex: 1, padding: "5px 8px", fontSize: 12, background: "var(--ink3)",
                        border: "1px solid var(--bdr)", borderRadius: 6, color: "var(--t)",
                        outline: "none", boxSizing: "border-box",
                      }}
                      onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
                      onBlur={e => (e.currentTarget.style.borderColor = "var(--bdr)")}
                    />
                  </div>
                ))}
              </div>
              <button onClick={() => removeItem(idx)} title="Eliminar"
                style={{
                  padding: 4, background: "none", border: "none", cursor: "pointer",
                  color: "var(--t4)", transition: "color .15s", marginTop: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "#e84558")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--t4)")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={addItem}
            style={{
              width: "100%", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              background: "rgba(200,168,75,0.06)", border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, color: "var(--gold)", transition: "background .15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(200,168,75,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(200,168,75,0.06)")}
          >
            <Plus size={13} /> Añadir item
          </button>
        </div>
      )}
    </div>
  );
}

function NavSectionEditor({ content, onChange }: {
  content: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
}) {
  const adminNav = (content as any)?.adminNav ?? {};
  const modules = Array.isArray(adminNav.modules) ? adminNav.modules : [];
  const shopybrain = Array.isArray(adminNav.shopybrain) ? adminNav.shopybrain : [];
  const admin = Array.isArray(adminNav.admin) ? adminNav.admin : [];

  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 12, lineHeight: 1.5 }}>
        Editor dinámico de navegación. Añade, elimina, reordena y edita items libremente. Los cambios se aplican al guardar.
      </p>
      <NavArrayEditor
        title="Módulos (sidebar principal)"
        items={modules}
        basePath="adminNav.modules"
        fieldDefs={[
          { key: "id", label: "ID", placeholder: "audit" },
          { key: "label", label: "Label", placeholder: "Auditoría" },
          { key: "icon", label: "Icono", placeholder: "📊" },
        ]}
        onChange={onChange}
      />
      <NavArrayEditor
        title="Shopy Brain (IA & herramientas)"
        items={shopybrain}
        basePath="adminNav.shopybrain"
        fieldDefs={[
          { key: "label", label: "Label", placeholder: "Centro Shopy Crafter" },
          { key: "icon", label: "Icono", placeholder: "🧠" },
          { key: "href", label: "Ruta", placeholder: "/admin/shopybrain" },
        ]}
        onChange={onChange}
      />
      <NavArrayEditor
        title="Admin (gestión & herramientas)"
        items={admin}
        basePath="adminNav.admin"
        fieldDefs={[
          { key: "label", label: "Label", placeholder: "CRM Clientes" },
          { key: "icon", label: "Icono", placeholder: "👥" },
          { key: "href", label: "Ruta", placeholder: "/admin/clients" },
        ]}
        onChange={onChange}
      />
    </div>
  );
}

/* ── AI POPOVER ─────────────────────────────────────────────────────────── */
function AIImprovePopover({ text, onApply, onClose }: { text: string; onApply: (v: string) => void; onClose: () => void }) {
  const [instruction, setInstruction] = useState("");
  const [result, setResult]           = useState("");
  const [loading, setLoading]         = useState(false);
  const { toast } = useToast();

  const presets = [
    "Más persuasivo y urgente",
    "Más corto y directo",
    "Optimizado para SEO",
    "Tono más profesional",
    "Genera 3 alternativas",
  ];

  const run = async (inst: string) => {
    setLoading(true);
    setInstruction(inst);
    try {
      const res  = await fetch(`${BASE_URL}/api/cms/ai/improve`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, instruction: inst }),
      });
      const data = await res.json() as { improved?: string; error?: string };
      if (data.improved) setResult(data.improved);
      else toast({ title: "Error IA", description: data.error, variant: "destructive" });
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.65)" }} onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-6 shadow-2xl mx-4" style={{ border: "1px solid var(--gold)", borderRadius: 20 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--gold)" }}>
            <Sparkles className="w-4 h-4" />Mejorar con IA
          </div>
          <button onClick={onClose} className="nav-item" style={{ padding: "4px 6px", borderRadius: 8, minWidth: "auto" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-4 p-3 text-xs font-mono" style={{ background: "var(--ink2)", borderRadius: 12, color: "var(--t2)", maxHeight: 80, overflowY: "auto" }}>
          "{text}"
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map(p => (
            <button key={p} onClick={() => run(p)}
              className="text-xs px-3 py-1.5 transition-all"
              style={{ background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8, color: "var(--t2)" }}
            >{p}</button>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <input
            className="flex-1 px-3 py-2 text-sm outline-none"
            style={{ background: "var(--ink2)", border: "1px solid var(--bdr2)", borderRadius: 10, color: "var(--t)" }}
            placeholder="Instrucción personalizada..."
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run(instruction)}
          />
          <button onClick={() => run(instruction)} disabled={loading || !instruction} className="btn-primary px-4 py-2 text-sm" style={{ opacity: loading || !instruction ? 0.45 : 1 }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "→"}
          </button>
        </div>

        {result && (
          <div className="mt-3">
            <p className="text-xs mb-1.5" style={{ color: "var(--t3)" }}>Resultado:</p>
            <div className="p-3 text-sm mb-3" style={{ background: "var(--ink2)", border: "1px solid rgba(45,212,159,.25)", borderRadius: 12, color: "var(--t)" }}>{result}</div>
            <div className="flex gap-2">
              <button onClick={() => onApply(result)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all"
                style={{ background: "rgba(45,212,159,.12)", border: "1px solid rgba(45,212,159,.3)", color: "#2dd49f", borderRadius: 10 }}
              ><Check className="w-3.5 h-3.5" />Aplicar</button>
              <button onClick={() => setResult("")}
                className="px-4 py-2 text-sm transition-all"
                style={{ background: "var(--ink3)", border: "1px solid var(--bdr)", color: "var(--t2)", borderRadius: 10 }}
              >Descartar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── IMAGE UPLOADER ─────────────────────────────────────────────────────── */
function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast({ title: "Solo se permiten imágenes", variant: "destructive" }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Máximo 5MB", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE_URL}/api/cms/media/upload`, { method: "POST", body: form, credentials: "include" });
      if (!res.ok) { toast({ title: "Error al subir imagen", variant: "destructive" }); setUploading(false); return; }
      const data = await res.json() as { url: string };
      if (data.url) onChange(data.url);
    } catch { toast({ title: "Error de conexión", variant: "destructive" }); }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const remove = async () => {
    if (value) {
      const filename = value.split("/").pop();
      if (filename) await fetch(`${BASE_URL}/api/cms/media/${filename}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    }
    onChange("");
  };

  return (
    <div>
      {value ? (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--bdr)" }}>
          <img src={`${BASE_URL}${value}`} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
            <button onClick={() => inputRef.current?.click()}
              style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(0,0,0,0.7)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Upload size={12} style={{ color: "#fff" }} />
            </button>
            <button onClick={remove}
              style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(200,50,50,0.8)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={12} style={{ color: "#fff" }} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? "var(--gold)" : "var(--bdr)"}`,
            borderRadius: 12, padding: "20px 12px", textAlign: "center", cursor: "pointer",
            background: dragOver ? "rgba(200,168,75,0.05)" : "var(--ink2)",
            transition: "all .2s",
          }}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--gold)" }} />
          ) : (
            <>
              <ImageIcon size={20} style={{ color: "var(--t4)", margin: "0 auto 6px" }} />
              <p style={{ fontSize: 11, color: "var(--t3)" }}>Arrastra una imagen o haz clic</p>
              <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 2 }}>WebP · max 5MB</p>
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
    </div>
  );
}

/* ── VISME EFFECT SECTION PICKER ──────────────────────────────────────────── */
function EffectSectionPicker({ content, onChange }: { content: Record<string, unknown>; onChange: (path: string, value: unknown) => void }) {
  const effects = (content as any)?.effects ?? {};
  const [activeSec, setActiveSec] = useState<string>(LANDING_SECTIONS_EFFECTS[0].id);
  const [hoveredFx, setHoveredFx] = useState<string | null>(null);
  const currentEffect = effects[activeSec] ?? "fadeUp";

  const familyColors: Record<string, string> = {
    "básico":   "rgba(100,100,120,0.35)",
    "fade":     "rgba(200,168,75,0.20)",
    "3D":       "rgba(139,92,246,0.25)",
    "reveal":   "rgba(45,212,159,0.22)",
    "escala":   "rgba(59,130,246,0.22)",
    "especial": "rgba(244,114,182,0.22)",
  };
  const familyBorder: Record<string, string> = {
    "básico":   "rgba(100,100,120,0.4)",
    "fade":     "rgba(200,168,75,0.35)",
    "3D":       "rgba(139,92,246,0.4)",
    "reveal":   "rgba(45,212,159,0.35)",
    "escala":   "rgba(59,130,246,0.35)",
    "especial": "rgba(244,114,182,0.4)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Section tabs */}
      <div>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>
          Sección
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {LANDING_SECTIONS_EFFECTS.map(sec => {
            const fx = effects[sec.id] ?? "fadeUp";
            const fxDef = VISME_EFFECTS.find(e => e.id === fx);
            const isActive = activeSec === sec.id;
            return (
              <button key={sec.id} onClick={() => setActiveSec(sec.id)}
                title={`${sec.label} — ${fxDef?.label ?? fx}`}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: isActive ? "rgba(200,168,75,0.15)" : "var(--ink3)",
                  border: `1px solid ${isActive ? "var(--gold)" : "var(--bdr)"}`,
                  color: isActive ? "var(--gold)" : "var(--t2)",
                  transition: "all 0.12s",
                }}>
                <span style={{ fontSize: 13 }}>{sec.icon}</span>
                <span>{sec.label}</span>
                {fx !== "none" && <span style={{ fontSize: 10, opacity: 0.7 }}>{fxDef?.icon}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Effect grid */}
      <div>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>
          Efecto de entrada — <span style={{ color: "var(--gold)", textTransform: "none", fontWeight: 400 }}>
            {VISME_EFFECTS.find(e => e.id === currentEffect)?.label ?? currentEffect}
          </span>
        </div>
        {EFFECT_FAMILIES.map(family => {
          const familyEffects = VISME_EFFECTS.filter(e => e.family === family);
          return (
            <div key={family} style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                color: "var(--t4)", marginBottom: 5, paddingLeft: 2,
              }}>{family}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {familyEffects.map(fx => {
                  const isSelected = currentEffect === fx.id;
                  const isHover = hoveredFx === `${activeSec}:${fx.id}`;
                  return (
                    <button
                      key={fx.id}
                      onClick={() => onChange(`effects.${activeSec}`, fx.id)}
                      onMouseEnter={() => setHoveredFx(`${activeSec}:${fx.id}`)}
                      onMouseLeave={() => setHoveredFx(null)}
                      title={fx.description}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                        padding: "7px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600,
                        cursor: "pointer", minWidth: 56, transition: "all 0.12s",
                        background: isSelected
                          ? `linear-gradient(135deg, rgba(200,168,75,0.18), rgba(200,168,75,0.08))`
                          : isHover ? familyColors[family] : "var(--ink3)",
                        border: `1px solid ${isSelected ? "var(--gold)" : isHover ? familyBorder[family] : "var(--bdr)"}`,
                        color: isSelected ? "var(--gold)" : "var(--t2)",
                        boxShadow: isSelected ? "0 0 0 1px rgba(200,168,75,0.2)" : "none",
                        transform: isSelected ? "scale(1.03)" : "scale(1)",
                      }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>{fx.icon}</span>
                      <span style={{ fontSize: 9, lineHeight: 1.2, textAlign: "center", maxWidth: 52 }}>{fx.label}</span>
                      {isSelected && (
                        <span style={{ fontSize: 8, color: "var(--gold)", opacity: 0.8 }}>✓ activo</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Current effect description */}
      {(() => {
        const fxDef = VISME_EFFECTS.find(e => e.id === currentEffect);
        if (!fxDef) return null;
        return (
          <div style={{
            padding: "8px 12px", borderRadius: 8, fontSize: 11,
            background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)",
            color: "var(--t2)", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>{fxDef.icon}</span>
            <div>
              <strong style={{ color: "var(--gold)" }}>{fxDef.label}</strong>
              <span style={{ color: "var(--t3)", marginLeft: 6 }}>—</span>
              <span style={{ marginLeft: 6 }}>{fxDef.description}</span>
            </div>
          </div>
        );
      })()}

      <div style={{ fontSize: 10, color: "var(--t4)", paddingTop: 2 }}>
        💡 Los efectos se aplican al hacer scroll en la landing page. Guarda y recarga la vista previa para verlos.
      </div>
    </div>
  );
}

/* ── BACKGROUND TYPE SELECTOR ─────────────────────────────────────────────── */
function BackgroundTypeSelector({ sectionId, content, onChange }: { sectionId: string; content: Record<string, unknown>; onChange: (path: string, value: string) => void }) {
  const bgKey = `backgrounds.${sectionId}`;
  const backgrounds = (content as any)?.backgrounds ?? {};
  const sectionBg = backgrounds[sectionId] ?? { type: "none", videoUrl: "", galleryImages: [], particleColor: "#c8a84b" };
  const bgType = sectionBg.type ?? "none";
  const [galUploading, setGalUploading] = useState(false);

  const types = [
    { value: "none", label: "Ninguno", icon: <X size={12} /> },
    { value: "video", label: "Video", icon: <Film size={12} /> },
    { value: "gallery", label: "Galería", icon: <Images size={12} /> },
    { value: "particles", label: "Partículas", icon: <Atom size={12} /> },
  ];

  return (
    <div style={{ marginBottom: 16, padding: 12, background: "var(--ink2)", borderRadius: 10, border: "1px solid var(--bdr)" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "var(--t3)", marginBottom: 8 }}>
        Fondo de sección
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {types.map(t => (
          <button key={t.value} onClick={() => onChange(`${bgKey}.type`, t.value)}
            style={{
              flex: 1, padding: "6px 4px", fontSize: 10, fontWeight: 600,
              background: bgType === t.value ? "rgba(200,168,75,0.15)" : "var(--ink3)",
              border: `1px solid ${bgType === t.value ? "var(--gold)" : "var(--bdr)"}`,
              borderRadius: 6, cursor: "pointer", color: bgType === t.value ? "var(--gold)" : "var(--t3)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
              transition: "all 0.15s",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {bgType === "video" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={sectionBg.videoUrl ?? ""}
              placeholder="URL de video o sube uno"
              onChange={e => onChange(`${bgKey}.videoUrl`, e.target.value)}
              style={{ flex: 1, padding: "6px 10px", fontSize: 12, background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8, color: "var(--t)", outline: "none", boxSizing: "border-box" }}
            />
            <label style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: "rgba(200,168,75,0.15)", border: "1px solid var(--gold)", borderRadius: 8,
              color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            }}>
              <Upload size={12} /> Subir
              <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100 * 1024 * 1024) { alert("El video no puede superar 100MB"); return; }
                  const form = new FormData();
                  form.append("file", file);
                  try {
                    const resp = await fetch(`${BASE_URL}/api/cms/media/upload-video`, { method: "POST", body: form, credentials: "include" });
                    const data = await resp.json();
                    if (data.url) onChange(`${bgKey}.videoUrl`, data.url);
                  } catch { alert("Error al subir el video"); }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {sectionBg.videoUrl && (
            <div style={{ fontSize: 10, color: "var(--jade)", display: "flex", alignItems: "center", gap: 4 }}>
              <Film size={10} /> Video configurado: {sectionBg.videoUrl.split("/").pop()}
            </div>
          )}
        </div>
      )}
      {bgType === "particles" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>Color:</span>
          <input type="color" value={sectionBg.particleColor ?? "#c8a84b"} onChange={e => onChange(`${bgKey}.particleColor`, e.target.value)}
            style={{ width: 28, height: 28, borderRadius: 6, cursor: "pointer", border: "none" }} />
        </div>
      )}
      {bgType === "gallery" && (
        <div>
          <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 4 }}>Imágenes del carrusel (URLs separadas por coma)</p>
          <textarea
            value={Array.isArray(sectionBg.galleryImages) ? sectionBg.galleryImages.join(", ") : (typeof sectionBg.galleryImages === "string" ? sectionBg.galleryImages : "")}
            onChange={e => onChange(`${bgKey}.galleryImages`, e.target.value)}
            placeholder="/media/img1.webp, /media/img2.webp"
            rows={2}
            style={{ width: "100%", padding: "6px 10px", fontSize: 12, background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8, color: "var(--t)", outline: "none", resize: "none", boxSizing: "border-box" }}
          />
          <label style={{
            marginTop: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: galUploading ? "wait" : "pointer",
            background: "rgba(200,168,75,0.15)", border: "1px solid var(--gold)", borderRadius: 8,
            color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
            opacity: galUploading ? 0.6 : 1,
          }}>
            {galUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {galUploading ? "Subiendo..." : "Subir varias imágenes"}
            <input type="file" accept="image/*" multiple disabled={galUploading} style={{ display: "none" }}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length === 0) return;
                setGalUploading(true);
                const existing: string[] = Array.isArray(sectionBg.galleryImages)
                  ? (sectionBg.galleryImages as string[])
                  : (typeof sectionBg.galleryImages === "string" ? sectionBg.galleryImages.split(",").map((s: string) => s.trim()).filter(Boolean) : []);
                const uploaded: string[] = [];
                const skipped: string[] = [];
                for (const file of files) {
                  if (!file.type.startsWith("image/")) { skipped.push(file.name); continue; }
                  if (file.size > 5 * 1024 * 1024) { skipped.push(`${file.name} (>5MB)`); continue; }
                  try {
                    const form = new FormData();
                    form.append("file", file);
                    const resp = await fetch(`${BASE_URL}/api/cms/media/upload`, { method: "POST", body: form, credentials: "include" });
                    if (!resp.ok) { skipped.push(file.name); continue; }
                    const data = await resp.json() as { url?: string };
                    if (data.url) uploaded.push(data.url); else skipped.push(file.name);
                  } catch { skipped.push(file.name); }
                }
                if (uploaded.length > 0) onChange(`${bgKey}.galleryImages`, [...existing, ...uploaded].join(", "));
                if (skipped.length > 0) alert(`${uploaded.length} imágenes subidas. No se pudieron subir: ${skipped.join(", ")}`);
                setGalUploading(false);
                e.target.value = "";
              }} />
          </label>
        </div>
      )}
    </div>
  );
}

/* ── FIELD EDITOR ────────────────────────────────────────────────────────── */
function FieldEditor({ field, value, onChange }: { field: FieldDef; value: string; onChange: (path: string, value: string) => void }) {
  const [aiTarget, setAiTarget] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, color: "var(--t3)" }}>
          {field.label}
        </label>
        {(field.type === "text" || field.type === "textarea") && (
          <button onClick={() => setAiTarget(value)}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: "var(--gold)", opacity: 0.7 }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
          >
            <Sparkles className="w-3 h-3" />IA
          </button>
        )}
      </div>

      {field.hint && <p style={{ fontSize: 11, color: "var(--t4)", marginBottom: 6 }}>{field.hint}</p>}

      {field.type === "image" ? (
        <ImageUploader value={value} onChange={v => onChange(field.path, v)} />
      ) : field.type === "textarea" ? (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(field.path, e.target.value)}
          style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none", resize: "none", lineHeight: 1.55, boxSizing: "border-box" }}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
          onBlur={e  => (e.currentTarget.style.borderColor = "var(--bdr)")}
        />
      ) : field.type === "color" ? (
        <div className="flex items-center gap-2">
          <input type="color" value={value || "#c8a84b"} onChange={e => onChange(field.path, e.target.value)}
            style={{ width: 40, height: 40, borderRadius: 10, cursor: "pointer", border: "none", background: "transparent" }} />
          <input
            value={value}
            onChange={e => onChange(field.path, e.target.value)}
            style={{ flex: 1, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none", fontFamily: "monospace" }}
            onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
            onBlur={e  => (e.currentTarget.style.borderColor = "var(--bdr)")}
          />
        </div>
      ) : field.type === "boolean" ? (
        <button
          onClick={() => onChange(field.path, value === "true" ? "false" : "true")}
          style={{ width: 44, height: 26, borderRadius: 13, background: value === "true" ? "#2dd49f" : "var(--ink3)", transition: "background .2s", position: "relative", border: "none", cursor: "pointer" }}
        >
          <div style={{ width: 18, height: 18, background: "white", borderRadius: "50%", position: "absolute", top: 4, left: value === "true" ? 22 : 4, transition: "left .2s" }} />
        </button>
      ) : (
        <input
          value={value}
          placeholder={field.placeholder}
          onChange={e => onChange(field.path, e.target.value)}
          style={{ width: "100%", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none", boxSizing: "border-box" }}
          onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
          onBlur={e  => (e.currentTarget.style.borderColor = "var(--bdr)")}
        />
      )}

      {aiTarget !== null && (
        <AIImprovePopover
          text={aiTarget}
          onApply={v => { onChange(field.path, v); setAiTarget(null); }}
          onClose={() => setAiTarget(null)}
        />
      )}
    </div>
  );
}

/* ── SECTION TEMPLATES ───────────────────────────────────────────────────── */
const SECTION_TEMPLATES: Array<{ type: string; icon: string; label: string; desc: string; fields: FieldDef[] }> = [
  {
    type: "hero_alt", icon: "🦸", label: "Hero alternativo",
    desc: "Titular impactante, subtítulo, botón CTA e imagen lateral",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "textarea", placeholder: "Transforma tu negocio con IA" },
      { label: "Highlight", path: "SECTIONID.headlineHighlight", type: "text", placeholder: "con IA" },
      { label: "Subtítulo", path: "SECTIONID.subheadline", type: "textarea", placeholder: "Descripción..." },
      { label: "CTA — Texto", path: "SECTIONID.ctaLabel", type: "text", placeholder: "Comenzar gratis" },
      { label: "CTA — URL", path: "SECTIONID.ctaHref", type: "url", placeholder: "/login" },
      { label: "Imagen", path: "SECTIONID.imageUrl", type: "image" },
      { label: "Badge/Pill", path: "SECTIONID.pill", type: "text", placeholder: "Nuevo · IA avanzada" },
    ],
  },
  {
    type: "features_grid", icon: "⭐", label: "Características",
    desc: "Grid de características con iconos, título y descripción",
    fields: [
      { label: "Titular sección", path: "SECTIONID.headline", type: "text", placeholder: "¿Por qué elegirnos?" },
      { label: "Subtítulo", path: "SECTIONID.subheadline", type: "textarea", placeholder: "Descripción..." },
      { label: "Item 1 — Icono", path: "SECTIONID.items.0.icon", type: "text", placeholder: "🚀" },
      { label: "Item 1 — Título", path: "SECTIONID.items.0.title", type: "text" },
      { label: "Item 1 — Descripción", path: "SECTIONID.items.0.desc", type: "textarea" },
      { label: "Item 2 — Icono", path: "SECTIONID.items.1.icon", type: "text", placeholder: "⚡" },
      { label: "Item 2 — Título", path: "SECTIONID.items.1.title", type: "text" },
      { label: "Item 2 — Descripción", path: "SECTIONID.items.1.desc", type: "textarea" },
      { label: "Item 3 — Icono", path: "SECTIONID.items.2.icon", type: "text", placeholder: "🎯" },
      { label: "Item 3 — Título", path: "SECTIONID.items.2.title", type: "text" },
      { label: "Item 3 — Descripción", path: "SECTIONID.items.2.desc", type: "textarea" },
    ],
  },
  {
    type: "testimonials_extra", icon: "💬", label: "Testimonios extra",
    desc: "Reseñas y testimonios adicionales de clientes",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "text", placeholder: "Lo que dicen nuestros clientes" },
      { label: "T1 — Texto", path: "SECTIONID.items.0.text", type: "textarea" },
      { label: "T1 — Autor", path: "SECTIONID.items.0.author", type: "text" },
      { label: "T1 — Rol", path: "SECTIONID.items.0.role", type: "text" },
      { label: "T1 — Avatar foto", path: "SECTIONID.items.0.avatarUrl", type: "image" },
      { label: "T2 — Texto", path: "SECTIONID.items.1.text", type: "textarea" },
      { label: "T2 — Autor", path: "SECTIONID.items.1.author", type: "text" },
      { label: "T2 — Rol", path: "SECTIONID.items.1.role", type: "text" },
      { label: "T2 — Avatar foto", path: "SECTIONID.items.1.avatarUrl", type: "image" },
    ],
  },
  {
    type: "cta_banner", icon: "📣", label: "Banner CTA",
    desc: "Banner de llamada a la acción con titular y botón destacado",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "textarea", placeholder: "¿Listo para empezar?" },
      { label: "Highlight", path: "SECTIONID.headlineHighlight", type: "text", placeholder: "empezar" },
      { label: "Subtítulo", path: "SECTIONID.subheadline", type: "textarea" },
      { label: "Botón — Texto", path: "SECTIONID.buttonLabel", type: "text", placeholder: "Solicitar demo" },
      { label: "Botón — URL", path: "SECTIONID.buttonHref", type: "url" },
      { label: "Color fondo", path: "SECTIONID.bgColor", type: "color" },
      { label: "Nota pie", path: "SECTIONID.finePrint", type: "text", placeholder: "Sin tarjeta de crédito" },
    ],
  },
  {
    type: "stats_counter", icon: "📊", label: "Estadísticas",
    desc: "Contadores animados con métricas de impacto",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "text", placeholder: "Nuestros resultados" },
      { label: "Stat 1 — Número", path: "SECTIONID.stats.0.num", type: "text", placeholder: "+500" },
      { label: "Stat 1 — Label", path: "SECTIONID.stats.0.label", type: "text", placeholder: "Tiendas optimizadas" },
      { label: "Stat 2 — Número", path: "SECTIONID.stats.1.num", type: "text", placeholder: "3.2×" },
      { label: "Stat 2 — Label", path: "SECTIONID.stats.1.label", type: "text", placeholder: "Incremento conversión" },
      { label: "Stat 3 — Número", path: "SECTIONID.stats.2.num", type: "text", placeholder: "98%" },
      { label: "Stat 3 — Label", path: "SECTIONID.stats.2.label", type: "text", placeholder: "Satisfacción cliente" },
      { label: "Stat 4 — Número", path: "SECTIONID.stats.3.num", type: "text", placeholder: "24/7" },
      { label: "Stat 4 — Label", path: "SECTIONID.stats.3.label", type: "text", placeholder: "Monitorización activa" },
    ],
  },
  {
    type: "faq_extra", icon: "❓", label: "FAQ extra",
    desc: "Preguntas frecuentes adicionales con acordeón",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "text", placeholder: "Preguntas frecuentes" },
      { label: "P1 — Pregunta", path: "SECTIONID.items.0.question", type: "text" },
      { label: "P1 — Respuesta", path: "SECTIONID.items.0.answer", type: "textarea" },
      { label: "P2 — Pregunta", path: "SECTIONID.items.1.question", type: "text" },
      { label: "P2 — Respuesta", path: "SECTIONID.items.1.answer", type: "textarea" },
      { label: "P3 — Pregunta", path: "SECTIONID.items.2.question", type: "text" },
      { label: "P3 — Respuesta", path: "SECTIONID.items.2.answer", type: "textarea" },
      { label: "P4 — Pregunta", path: "SECTIONID.items.3.question", type: "text" },
      { label: "P4 — Respuesta", path: "SECTIONID.items.3.answer", type: "textarea" },
    ],
  },
  {
    type: "gallery_media", icon: "🖼️", label: "Galería / Media",
    desc: "Grid de imágenes o logos de partners/clientes",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "text", placeholder: "Galería" },
      { label: "Subtítulo", path: "SECTIONID.subheadline", type: "text" },
      { label: "Imagen 1", path: "SECTIONID.images.0", type: "image" },
      { label: "Imagen 2", path: "SECTIONID.images.1", type: "image" },
      { label: "Imagen 3", path: "SECTIONID.images.2", type: "image" },
      { label: "Imagen 4", path: "SECTIONID.images.3", type: "image" },
      { label: "Imagen 5", path: "SECTIONID.images.4", type: "image" },
      { label: "Imagen 6", path: "SECTIONID.images.5", type: "image" },
    ],
  },
  {
    type: "team_section", icon: "👥", label: "Equipo",
    desc: "Miembros del equipo con foto, nombre y rol",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "text", placeholder: "Conoce al equipo" },
      { label: "Subtítulo", path: "SECTIONID.subheadline", type: "textarea" },
      { label: "M1 — Nombre", path: "SECTIONID.members.0.name", type: "text" },
      { label: "M1 — Rol", path: "SECTIONID.members.0.role", type: "text" },
      { label: "M1 — Foto", path: "SECTIONID.members.0.photo", type: "image" },
      { label: "M2 — Nombre", path: "SECTIONID.members.1.name", type: "text" },
      { label: "M2 — Rol", path: "SECTIONID.members.1.role", type: "text" },
      { label: "M2 — Foto", path: "SECTIONID.members.1.photo", type: "image" },
      { label: "M3 — Nombre", path: "SECTIONID.members.2.name", type: "text" },
      { label: "M3 — Rol", path: "SECTIONID.members.2.role", type: "text" },
      { label: "M3 — Foto", path: "SECTIONID.members.2.photo", type: "image" },
    ],
  },
  {
    type: "logos_partners", icon: "🤝", label: "Logos / Partners",
    desc: "Carrusel de logos de clientes o partners",
    fields: [
      { label: "Titular", path: "SECTIONID.headline", type: "text", placeholder: "Confían en nosotros" },
      { label: "Logo 1", path: "SECTIONID.logos.0.imageUrl", type: "image" },
      { label: "Logo 1 — Nombre", path: "SECTIONID.logos.0.name", type: "text" },
      { label: "Logo 2", path: "SECTIONID.logos.1.imageUrl", type: "image" },
      { label: "Logo 2 — Nombre", path: "SECTIONID.logos.1.name", type: "text" },
      { label: "Logo 3", path: "SECTIONID.logos.2.imageUrl", type: "image" },
      { label: "Logo 3 — Nombre", path: "SECTIONID.logos.2.name", type: "text" },
      { label: "Logo 4", path: "SECTIONID.logos.3.imageUrl", type: "image" },
      { label: "Logo 4 — Nombre", path: "SECTIONID.logos.3.name", type: "text" },
    ],
  },
];

/* ── ADD SECTION MODAL ───────────────────────────────────────────────────── */
function AddSectionModal({
  onAdd, onClose,
}: {
  onAdd: (section: SectionDef, defaultContent: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [mode, setMode]                   = useState<"templates" | "ai">("templates");
  const [selectedTemplate, setSelected]   = useState<string | null>(null);
  const [aiPrompt, setAiPrompt]           = useState("");
  const [aiName, setAiName]               = useState("");
  const [generating, setGenerating]       = useState(false);
  const [aiResult, setAiResult]           = useState<{ section: SectionDef; defaultContent: Record<string, unknown> } | null>(null);
  const { toast } = useToast();

  const selectedTpl = SECTION_TEMPLATES.find(t => t.type === selectedTemplate);

  const buildSectionFromTemplate = (tpl: typeof SECTION_TEMPLATES[0]): { section: SectionDef; defaultContent: Record<string, unknown> } => {
    const id = `custom_${tpl.type}_${Date.now()}`;
    const fields = tpl.fields.map(f => ({ ...f, path: f.path.replace("SECTIONID", id) }));
    return { section: { id, icon: tpl.icon, label: tpl.label, fields }, defaultContent: {} };
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${BASE_URL}/api/cms/ai/generate-section`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt, name: aiName || undefined }),
      });
      const data = await res.json() as { section?: Record<string, unknown>; error?: string };
      if (!res.ok || data.error) { toast({ title: "Error IA", description: data.error, variant: "destructive" }); return; }
      const raw = data.section!;
      const id  = String(raw.id);
      const fields: FieldDef[] = Array.isArray(raw.fields)
        ? (raw.fields as Record<string, string>[]).map(f => ({ label: f.label, path: f.path, type: (f.type as FieldType) || "text", placeholder: f.placeholder }))
        : [];
      const defaultContent = raw.defaultContent && typeof raw.defaultContent === "object"
        ? Object.fromEntries(Object.entries(raw.defaultContent as Record<string, unknown>).map(([k, v]) => [`${id}.${k}`, v]))
        : {};
      setAiResult({ section: { id, icon: String(raw.icon || "✨"), label: String(raw.label || "Sección IA"), fields }, defaultContent });
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleAdd = () => {
    if (mode === "ai" && aiResult) { onAdd(aiResult.section, aiResult.defaultContent); return; }
    if (selectedTpl) { const r = buildSectionFromTemplate(selectedTpl); onAdd(r.section, r.defaultContent); }
  };

  const canAdd = mode === "ai" ? !!aiResult : !!selectedTemplate;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(760px, 95vw)", maxHeight: "90vh", background: "var(--ink)",
          borderRadius: 20, border: "1px solid var(--bdr2)", display: "flex", flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,.6)", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,var(--gold),#e6c668)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              <Layers size={16} style={{ color: "#000" }} />
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 15, color: "var(--t)" }}>Agregar sección</p>
              <p style={{ fontSize: 11, color: "var(--t3)" }}>Elige una plantilla o genera con IA</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", padding: 6, borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid var(--bdr)", flexShrink: 0 }}>
          {([["templates", "🗂️ Plantillas"], ["ai", "✨ Generar con IA"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setAiResult(null); }}
              style={{
                padding: "10px 16px", fontSize: 13, fontWeight: 600, background: "none", border: "none",
                cursor: "pointer", color: mode === m ? "var(--gold)" : "var(--t3)",
                borderBottom: mode === m ? "2px solid var(--gold)" : "2px solid transparent",
                transition: "all .15s",
              }}
            >{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {mode === "templates" && (
            <>
              <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
                Selecciona el tipo de sección que quieres añadir a tu landing. Podrás editar todo el contenido después.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {SECTION_TEMPLATES.map(tpl => (
                  <button key={tpl.type} onClick={() => setSelected(tpl.type)}
                    style={{
                      padding: "14px 14px", textAlign: "left", cursor: "pointer", borderRadius: 14, transition: "all .15s",
                      background: selectedTemplate === tpl.type ? "rgba(200,168,75,0.12)" : "var(--ink2)",
                      border: `1.5px solid ${selectedTemplate === tpl.type ? "var(--gold)" : "var(--bdr)"}`,
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{tpl.icon}</div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t)", marginBottom: 4 }}>{tpl.label}</p>
                    <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.45 }}>{tpl.desc}</p>
                    <p style={{ fontSize: 10, color: "var(--t4)", marginTop: 6 }}>{tpl.fields.length} campos</p>
                  </button>
                ))}
              </div>
              {selectedTpl && (
                <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(200,168,75,0.07)", borderRadius: 12, border: "1px solid rgba(200,168,75,0.2)" }}>
                  <p style={{ fontSize: 12, color: "var(--gold)", fontWeight: 700, marginBottom: 6 }}>
                    {selectedTpl.icon} {selectedTpl.label} — campos incluidos:
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selectedTpl.fields.map(f => (
                      <span key={f.path} style={{ fontSize: 11, background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 6, padding: "2px 8px", color: "var(--t2)" }}>
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {mode === "ai" && (
            <div>
              <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14 }}>
                Describe la sección que necesitas y la IA generará todos los campos de configuración de forma automática.
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "var(--t3)", display: "block", marginBottom: 6 }}>
                  Nombre de la sección (opcional)
                </label>
                <input
                  value={aiName} onChange={e => setAiName(e.target.value)}
                  placeholder="Ej: Nuestros Valores"
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, color: "var(--t)", outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--bdr)")}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "var(--t3)", display: "block", marginBottom: 6 }}>
                  Descripción de la sección *
                </label>
                <textarea
                  value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Ej: Una sección de valores de empresa con 4 pilares: Innovación, Transparencia, Resultados y Confianza. Cada valor tiene un icono emoji, título y descripción corta."
                  rows={4}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10, color: "var(--t)", outline: "none", resize: "none", lineHeight: 1.5, boxSizing: "border-box" }}
                  onFocus={e => (e.currentTarget.style.borderColor = "var(--gold)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "var(--bdr)")}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {["Sección de valores de empresa con 4 pilares", "Comparativa antes/después de usar el servicio", "Línea de tiempo de historia de la empresa", "Proceso de trabajo en 5 pasos", "Beneficios para partners y afiliados"].map(ex => (
                    <button key={ex} onClick={() => setAiPrompt(ex)}
                      style={{ fontSize: 11, padding: "4px 10px", background: "var(--ink3)", border: "1px solid var(--bdr)", borderRadius: 8, cursor: "pointer", color: "var(--t3)", transition: "all .15s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.color = "var(--t3)"; }}
                    >{ex}</button>
                  ))}
                </div>
              </div>
              <button onClick={generateWithAI} disabled={generating || !aiPrompt.trim()}
                style={{
                  width: "100%", padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: generating || !aiPrompt.trim() ? "not-allowed" : "pointer",
                  background: "linear-gradient(135deg,var(--gold),#e6c668)", color: "#000", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: generating || !aiPrompt.trim() ? 0.5 : 1, transition: "opacity .2s",
                }}
              >
                {generating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                {generating ? "Generando sección..." : "Generar con IA"}
              </button>

              {aiResult && (
                <div style={{ marginTop: 16, padding: 14, background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.25)", borderRadius: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>{aiResult.section.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>{aiResult.section.label}</p>
                      <p style={{ fontSize: 11, color: "var(--jade)" }}>{aiResult.section.fields.length} campos generados</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {aiResult.section.fields.map(f => (
                      <span key={f.path} style={{ fontSize: 11, background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 6, padding: "2px 8px", color: "var(--t2)" }}>
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--bdr)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "var(--ink2)", border: "1px solid var(--bdr)", color: "var(--t2)", cursor: "pointer" }}
          >Cancelar</button>
          <button onClick={handleAdd} disabled={!canAdd}
            style={{ padding: "9px 24px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: canAdd ? "var(--gold)" : "var(--ink3)", border: "none", color: canAdd ? "#000" : "var(--t4)", cursor: canAdd ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}
          >
            <Plus size={14} />Agregar sección
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── VERSION ENTRY ───────────────────────────────────────────────────────── */
interface VersionEntry {
  id: number;
  version: number;
  savedAt: string;
  savedBy: string | null;
  label: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function CMSEditor() {
  const [, navigate]                    = useLocation();
  const [content, setContent]           = useState<Record<string, unknown> | null>(null);
  const [pending, setPending]           = useState<Map<string, unknown>>(new Map());
  const [saving, setSaving]             = useState(false);
  const [device, setDevice]             = useState<DeviceMode>("desktop");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["hero"]));
  const [versions, setVersions]         = useState<VersionEntry[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [iframeKey, setIframeKey]       = useState(0);
  const [mobileTab, setMobileTab]       = useState<MobileTab>("edit");
  const CONTENT_FIRST_ORDER = [
    "nav", "hero", "features", "stats", "how", "pricing", "testimonials", "cta",
    "results", "contact", "howCards", "footer", "sectionNav",
    "adminPanel", "clientPanel", "adminNav", "apkLabels", "errorMessages", "heroDemoTitles",
    "site", "backgrounds",
    ...SECTIONS.filter(s => !["nav","hero","features","stats","how","pricing","testimonials","cta","results","contact","howCards","footer","sectionNav","adminPanel","clientPanel","adminNav","apkLabels","errorMessages","heroDemoTitles","site","backgrounds"].includes(s.id)).map(s => s.id),
  ];
  const [sectionOrder, setSectionOrder] = useState<string[]>(CONTENT_FIRST_ORDER);
  const [dragIdx, setDragIdx]           = useState<number | null>(null);
  const [customSections, setCustomSections] = useState<SectionDef[]>([]);
  const [showAddSection, setShowAddSection] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { toast } = useToast();
  const retryFetch = useRetryFetch();

  const changeCount = pending.size;

  const pendingObj = useMemo(() => Object.fromEntries(pending), [pending]);
  const { clear: clearDraft } = useDraftPersistence(
    "cms-editor-draft",
    pendingObj,
    (restored: Record<string, unknown>) => {
      const m = new Map(Object.entries(restored));
      if (m.size > 0) {
        setPending(m);
        toast({ title: "Borrador recuperado", description: `${m.size} cambios pendientes restaurados` });
      }
    },
    { enabled: true }
  );

  useBeforeUnload(changeCount > 0);

  const loadContent = useCallback(async () => {
    try {
      const res = await retryFetch(`${BASE_URL}/api/cms/content`);
      const data = await res.json() as Record<string, unknown>;
      setContent(data);
      if (Array.isArray(data.sectionOrder) && data.sectionOrder.length > 0) {
        setSectionOrder(data.sectionOrder as string[]);
      }
      if (Array.isArray(data.customSections)) {
        setCustomSections(data.customSections as SectionDef[]);
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo cargar el contenido. Reintentando...", variant: "destructive" });
    }
  }, [retryFetch, toast]);

  const addCustomSection = useCallback((section: SectionDef, defaultContent: Record<string, unknown>) => {
    setCustomSections(prev => {
      const updated = [...prev, section];
      setPending(p => {
        const n = new Map(p);
        n.set("customSections", updated);
        const newOrder = [...sectionOrder, section.id];
        n.set("sectionOrder", newOrder);
        setSectionOrder(newOrder);
        return n;
      });
      return updated;
    });
    if (Object.keys(defaultContent).length > 0) {
      setContent(prev => {
        if (!prev) return prev;
        const updated = { ...prev };
        for (const [path, value] of Object.entries(defaultContent)) {
          const keys = path.split(".");
          let cur: Record<string, unknown> = updated;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in cur) || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
            cur = cur[keys[i]] as Record<string, unknown>;
          }
          cur[keys[keys.length - 1]] = value;
        }
        return updated;
      });
    }
    setOpenSections(prev => new Set([...prev, section.id]));
    setShowAddSection(false);
    toast({ title: "✅ Sección añadida", description: `"${section.label}" lista para editar. Guarda para publicar.` });
  }, [sectionOrder, toast]);

  const removeCustomSection = useCallback((sectionId: string) => {
    if (!confirm("¿Eliminar esta sección personalizada?")) return;
    setCustomSections(prev => {
      const updated = prev.filter(s => s.id !== sectionId);
      setPending(p => {
        const n = new Map(p);
        n.set("customSections", updated);
        const newOrder = sectionOrder.filter(id => id !== sectionId);
        n.set("sectionOrder", newOrder);
        setSectionOrder(newOrder);
        return n;
      });
      return updated;
    });
    toast({ title: "Sección eliminada" });
  }, [sectionOrder, toast]);

  const moveSection = useCallback((fromIdx: number, toIdx: number) => {
    setSectionOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      setPending(p => { const n = new Map(p); n.set("sectionOrder", next); return n; });
      return next;
    });
  }, []);

  const loadVersions = useCallback(async () => {
    try {
      const res = await retryFetch(`${BASE_URL}/api/cms/versions`, { credentials: "include" });
      const data = await res.json() as VersionEntry[];
      setVersions(data);
    } catch {}
  }, [retryFetch]);

  const { isOnline } = useOnlineStatus(useCallback(() => {
    loadContent();
    loadVersions();
    setIframeKey(k => k + 1);
    toast({ title: "Conexión restaurada", description: "Datos actualizados" });
  }, [loadContent, loadVersions, toast]));

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return;
      if (e.data?.type === "cms-click-to-edit" && typeof e.data.path === "string") {
        const path = e.data.path as string;
        if (!/^[a-zA-Z0-9._]+$/.test(path)) return;
        const sectionId = path.split(".")[0];
        setOpenSections(prev => new Set([...prev, sectionId]));
        setTimeout(() => {
          const el = fieldRefs.current[path] ?? fieldRefs.current[`section-${sectionId}`];
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.style.outline = "2px solid var(--gold)";
            el.style.outlineOffset = "2px";
            el.style.borderRadius = "8px";
            setTimeout(() => { el.style.outline = "none"; }, 2000);
            const input = el.querySelector("input, textarea") as HTMLElement | null;
            if (input) input.focus();
          }
        }, 150);
      }
      if (e.data?.type === "cms-inline-edit" && typeof e.data.path === "string" && e.data.value !== undefined) {
        const path = e.data.path as string;
        if (!/^[a-zA-Z0-9._]+$/.test(path)) return;
        setPending(prev => { const n = new Map(prev); n.set(path, e.data.value as string); return n; });
        setContent(prev => {
          if (!prev) return prev;
          const keys = path.split(".");
          const updated = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
          let cur: Record<string, unknown> | unknown[] = updated;
          for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            const nxt: unknown = Array.isArray(cur) ? (cur as unknown[])[parseInt(k)] : (cur as Record<string, unknown>)[k];
            if (typeof nxt === "object" && nxt !== null) cur = nxt as Record<string, unknown>;
          }
          const last = keys[keys.length - 1];
          if (Array.isArray(cur)) (cur as unknown[])[parseInt(last)] = e.data.value;
          else (cur as Record<string, unknown>)[last] = e.data.value;
          return updated;
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    loadContent();
    loadVersions();

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    function connectSSE() {
      es = new EventSource(`${BASE_URL}/api/cms/events`);
      es.addEventListener("connected", () => { retries = 0; });
      es.addEventListener("content_updated", () => { loadContent(); setIframeKey(k => k + 1); });
      es.onerror = () => {
        es?.close();
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        retries++;
        retryTimer = setTimeout(connectSSE, delay);
      };
    }
    connectSSE();

    return () => {
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [loadContent]);

  const handleFieldChange = useCallback((path: string, value: unknown) => {
    setPending(prev => { const n = new Map(prev); n.set(path, value); return n; });
    setContent(prev => {
      if (!prev) return prev;
      const keys    = path.split(".");
      const updated = JSON.parse(JSON.stringify(prev)) as Record<string, unknown>;
      let cur: Record<string, unknown> | unknown[] = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        const nxt: unknown = Array.isArray(cur) ? (cur as unknown[])[parseInt(k)] : (cur as Record<string, unknown>)[k];
        if (typeof nxt === "object" && nxt !== null) cur = nxt as Record<string, unknown>;
      }
      const last = keys[keys.length - 1];
      if (Array.isArray(cur)) (cur as unknown[])[parseInt(last)] = value;
      else (cur as Record<string, unknown>)[last] = value;
      return updated;
    });
    try {
      iframeRef.current?.contentWindow?.postMessage({
        type: "cms-update-field",
        path,
        value,
      }, window.location.origin);
    } catch {}
  }, []);

  const save = async () => {
    if (changeCount === 0) return;
    setSaving(true);
    try {
      const changes = Array.from(pending.entries()).map(([path, value]) => ({ path, value }));
      const res = await retryFetch(`${BASE_URL}/api/cms/content/batch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      if (res.ok) {
        setPending(new Map());
        clearDraft();
        setIframeKey(k => k + 1);
        await loadVersions();
        toast({ title: "✅ Guardado", description: `${changes.length} cambios aplicados a la landing` });
      }
    } catch {
      toast({ title: "Error al guardar", description: "Los cambios están guardados localmente. Reintenta cuando tengas conexión.", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const restoreVersion = async (id: number) => {
    try {
      await fetch(`${BASE_URL}/api/cms/versions/${id}/restore`, { method: "POST", credentials: "include" });
      await loadContent();
      await loadVersions();
      setIframeKey(k => k + 1);
      setShowVersions(false);
      toast({ title: "Versión restaurada" });
    } catch {
      toast({ title: "Error al restaurar versión", variant: "destructive" });
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("¿Restaurar todo el contenido a los valores por defecto?")) return;
    try {
      await fetch(`${BASE_URL}/api/cms/content/reset`, { method: "POST", credentials: "include" });
      await loadContent();
      setPending(new Map());
      setIframeKey(k => k + 1);
      toast({ title: "Contenido restaurado" });
    } catch {
      toast({ title: "Error al restaurar contenido", variant: "destructive" });
    }
  };

  const toggleSection = (id: string) => setOpenSections(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const previewUrl = `${window.location.origin}${BASE_URL === "" ? "" : BASE_URL}/landing?preview=true`;

  const scrollPreviewToSection = (sectionId: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "cms-go-to-section", sectionId }, window.location.origin);
  };

  if (!content) {
    return (
      <div className="main-content flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "var(--gold)" }} />
          <p style={{ color: "var(--t3)", fontSize: 14 }}>Cargando editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* ── TOPBAR ──────────────────────────────────────────────────────── */}
      <div className="topbar-cms" style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 56, gap: 12,
        borderBottom: "1px solid var(--bdr)", background: "var(--ink)",
      }}>
        {/* Left: back + title + badge */}
        <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
          <button
            onClick={() => navigate("/home")}
            title="Volver al panel"
            style={{
              width: 32, height: 32, borderRadius: 9, background: "var(--ink2)", border: "1px solid var(--bdr)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, color: "var(--t3)", transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.color = "var(--t3)"; }}
          >
            <ArrowLeft size={15} />
          </button>
          <div className="flex items-center gap-2">
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "linear-gradient(135deg,var(--gold),#e6c668)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>✏️</div>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--t)" }}>CMS Editor</span>
          </div>
          {!isOnline && (
            <span style={{
              fontSize: 11, background: "rgba(232,69,88,.15)", color: "#e84558",
              padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(232,69,88,.3)", whiteSpace: "nowrap",
              display: "flex", alignItems: "center", gap: 4,
            }}><WifiOff size={11} />Sin conexión</span>
          )}
          {changeCount > 0 ? (
            <span style={{
              fontSize: 11, background: "rgba(200,168,75,.15)", color: "var(--gold)",
              padding: "3px 10px", borderRadius: 20, border: "1px solid rgba(200,168,75,.3)", whiteSpace: "nowrap",
            }}>{changeCount} sin guardar</span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--t4)", whiteSpace: "nowrap" }}>Sin cambios</span>
          )}
        </div>

        {/* Center: device switcher — hidden on mobile */}
        <div className="cms-device-switcher" style={{
          display: "flex", alignItems: "center", gap: 2,
          background: "var(--ink2)", borderRadius: 12, padding: "3px",
        }}>
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map(d => (
            <button key={d} onClick={() => setDevice(d)} title={d}
              style={{
                padding: "6px 10px", borderRadius: 9, border: "none", cursor: "pointer", transition: "all .15s",
                background: device === d ? "var(--ink3)" : "transparent",
                color: device === d ? "var(--gold)" : "var(--t3)",
              }}
            >
              {d === "desktop" ? <Monitor size={15} /> : d === "tablet" ? <Tablet size={15} /> : <Smartphone size={15} />}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVersions(v => !v)}
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10,
              fontSize: 12, color: "var(--t2)", cursor: "pointer", whiteSpace: "nowrap",
            }}
          ><RefreshCw size={12} /><span className="cms-btn-label">Historial</span></button>

          <button onClick={resetToDefaults}
            className="flex items-center gap-1.5"
            style={{
              padding: "6px 12px", background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10,
              fontSize: 12, color: "var(--t2)", cursor: "pointer",
            }}
          ><RotateCcw size={12} /><span className="cms-btn-label">Reset</span></button>

          <button onClick={save} disabled={saving || changeCount === 0}
            className="btn-primary flex items-center gap-1.5"
            style={{ padding: "6px 14px", fontSize: 12, opacity: saving || changeCount === 0 ? 0.45 : 1 }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* ── MOBILE TAB BAR ──────────────────────────────────────────────── */}
      <div className="cms-mobile-tabs" style={{
        display: "none", flexShrink: 0,
        borderBottom: "1px solid var(--bdr)", background: "var(--ink)",
      }}>
        {(["edit", "preview"] as MobileTab[]).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)}
            style={{
              flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, border: "none",
              cursor: "pointer", background: "transparent",
              color: mobileTab === tab ? "var(--gold)" : "var(--t3)",
              borderBottom: mobileTab === tab ? "2px solid var(--gold)" : "2px solid transparent",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "all .15s",
            }}
          >
            {tab === "edit" ? <PenLine size={14} /> : <LayoutTemplate size={14} />}
            {tab === "edit" ? "Editar" : "Vista previa"}
          </button>
        ))}
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT PANEL — content tree */}
        <div className="cms-left-panel" style={{
          width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
          borderRight: "1px solid var(--bdr)", background: "var(--ink)", overflow: "hidden",
        }}>
          {/* panel header */}
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--bdr)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, color: "var(--t3)", margin: 0 }}>
                Secciones de la Landing
              </p>
              <a href={previewUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: "var(--jade)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(45,212,159,0.3)", background: "rgba(45,212,159,0.06)" }}>
                🔗 Ver landing
              </a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {[
                { id: "fp-hero", icon: "🦸", label: "Hero" },
                { id: "fp-engines", icon: "⚡", label: "Motores" },
                { id: "fp-demo", icon: "🎬", label: "Demo" },
                { id: "fp-results", icon: "📊", label: "Stats" },
                { id: "fp-pricing", icon: "💰", label: "Precios" },
                { id: "fp-calculator", icon: "🧮", label: "Calc." },
                { id: "fp-contact", icon: "📞", label: "Contacto" },
              ].map(s => (
                <button key={s.id} onClick={() => scrollPreviewToSection(s.id)}
                  style={{ fontSize: 9, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--bdr)", background: "var(--ink3)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--bdr)"; e.currentTarget.style.color = "var(--t3)"; }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* sections list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {sectionOrder.map((sectionId, orderIdx) => {
              const section = [...SECTIONS, ...customSections].find(s => s.id === sectionId);
              if (!section) return null;
              const isOpen = openSections.has(section.id);
              const canMoveUp = orderIdx > 0;
              const canMoveDown = orderIdx < sectionOrder.length - 1;
              const isDragging = dragIdx === orderIdx;
              const isCustom = customSections.some(s => s.id === sectionId);
              return (
                <div key={section.id}
                  ref={el => { fieldRefs.current[`section-${section.id}`] = el; }}
                  draggable
                  onDragStart={() => setDragIdx(orderIdx)}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={() => { if (dragIdx !== null && dragIdx !== orderIdx) moveSection(dragIdx, orderIdx); setDragIdx(null); }}
                  onDragEnd={() => setDragIdx(null)}
                  style={{
                    borderBottom: "1px solid var(--bdr)",
                    opacity: isDragging ? 0.5 : 1,
                    transition: "opacity 0.15s",
                  }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", padding: "0 2px 0 6px", cursor: "grab" }} title="Arrastrar para reordenar">
                      <button onClick={() => canMoveUp && moveSection(orderIdx, orderIdx - 1)} disabled={!canMoveUp}
                        style={{ background: "none", border: "none", cursor: canMoveUp ? "pointer" : "default", color: canMoveUp ? "var(--t3)" : "var(--ink3)", padding: 1, lineHeight: 1 }}>
                        <ArrowUp size={10} />
                      </button>
                      <GripVertical size={11} style={{ color: "var(--t4)", margin: "1px 0" }} />
                      <button onClick={() => canMoveDown && moveSection(orderIdx, orderIdx + 1)} disabled={!canMoveDown}
                        style={{ background: "none", border: "none", cursor: canMoveDown ? "pointer" : "default", color: canMoveDown ? "var(--t3)" : "var(--ink3)", padding: 1, lineHeight: 1 }}>
                        <ArrowDown size={10} />
                      </button>
                    </div>
                    <button onClick={() => toggleSection(section.id)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 10px 11px 6px", cursor: "pointer", border: "none",
                        background: isOpen ? "var(--ink2)" : "transparent",
                        transition: "background .15s",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{section.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{section.label}</span>
                        {isCustom && (
                          <span style={{ fontSize: 9, background: "rgba(200,168,75,0.15)", color: "var(--gold)", padding: "1px 6px", borderRadius: 6, border: "1px solid rgba(200,168,75,0.3)", letterSpacing: "0.05em", fontWeight: 700, textTransform: "uppercase" }}>custom</span>
                        )}
                      </span>
                      {isOpen
                        ? <ChevronDown size={13} style={{ color: "var(--gold)" }} />
                        : <ChevronRight size={13} style={{ color: "var(--t4)" }} />}
                    </button>
                    {!isCustom && (
                      <button
                        onClick={() => {
                          const map: Record<string, string> = { site: "fp-hero", hero: "fp-hero", features: "fp-engines", stats: "fp-results", how: "fp-demo", pricing: "fp-pricing", calculator: "fp-calculator", contact: "fp-contact", footer: "fp-contact" };
                          scrollPreviewToSection(map[section.id] || "fp-hero");
                        }}
                        title="Ver en preview"
                        style={{ padding: "8px 10px", background: "none", border: "none", cursor: "pointer", color: "var(--t4)", transition: "color .15s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--gold)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--t4)")}
                      >
                        <Eye size={13} />
                      </button>
                    )}
                    {isCustom && (
                      <button
                        onClick={() => removeCustomSection(section.id)}
                        title="Eliminar sección personalizada"
                        style={{ padding: "8px 10px", background: "none", border: "none", cursor: "pointer", color: "var(--t4)", transition: "color .15s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#e84558")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--t4)")}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div style={{ padding: "12px 16px 16px", background: "var(--ink3)" }}>
                      {section.id === "effects" ? (
                        <EffectSectionPicker content={content} onChange={handleFieldChange} />
                      ) : section.id === "adminNav" ? (
                        <NavSectionEditor content={content} onChange={handleFieldChange} />
                      ) : (
                        <>
                          {["hero", "features", "pricing", "how", "results", "calculator", "contact"].includes(section.id) && (
                            <BackgroundTypeSelector sectionId={section.id} content={content} onChange={handleFieldChange} />
                          )}
                          {section.fields.map(field => {
                            const raw   = getNestedValue(content, field.path);
                            const value = typeof raw === "string" ? raw
                              : typeof raw === "number" ? String(raw)
                              : typeof raw === "boolean" ? String(raw)
                              : Array.isArray(raw) ? raw.join(", ") : "";
                            return (
                              <div key={field.path} ref={el => { fieldRefs.current[field.path] = el; }}>
                                <FieldEditor field={field} value={value} onChange={handleFieldChange} />
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add section button */}
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--bdr)" }}>
              <button
                onClick={() => setShowAddSection(true)}
                style={{
                  width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: "rgba(200,168,75,0.08)", border: "1.5px dashed rgba(200,168,75,0.4)",
                  color: "var(--gold)", cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, transition: "all .2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(200,168,75,0.14)"; e.currentTarget.style.borderColor = "var(--gold)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(200,168,75,0.08)"; e.currentTarget.style.borderColor = "rgba(200,168,75,0.4)"; }}
              >
                <Plus size={14} />Agregar sección
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — live preview */}
        <div className="cms-right-panel" style={{
          flex: 1, display: "flex", flexDirection: "column",
          background: "var(--ink3)", overflow: "hidden",
        }}>
          {/* preview topbar */}
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 16px", height: 40, borderBottom: "1px solid var(--bdr)",
          }}>
            <div className="flex items-center gap-2" style={{ color: "var(--t3)", fontSize: 12 }}>
              <Eye size={13} />
              <span>Vista previa en vivo</span>
              <span style={{ color: "var(--bdr2)" }}>·</span>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--t4)" }}>
                {device} · {DEVICE_WIDTHS[device]}
              </span>
            </div>
            <button onClick={() => setIframeKey(k => k + 1)}
              className="flex items-center gap-1"
              style={{ fontSize: 11, color: "var(--t3)", cursor: "pointer", background: "none", border: "none" }}
            ><RefreshCw size={12} />Recargar</button>
          </div>

          {/* iframe container */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16 }}>
            <div style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%", height: "100%", minHeight: 500, transition: "width .3s" }}>
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={previewUrl}
                title="Landing page preview"
                style={{
                  width: "100%", height: "100%", minHeight: 500,
                  border: "1px solid var(--bdr2)", borderRadius: 16,
                  background: "var(--ink)", boxShadow: "var(--sh)",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── VERSION HISTORY DRAWER ──────────────────────────────────────── */}
      {showVersions && (
        <div style={{
          position: "fixed", right: 0, top: 0, bottom: 0, width: 280, zIndex: 50,
          background: "var(--ink)", borderLeft: "1px solid var(--bdr2)",
          display: "flex", flexDirection: "column", boxShadow: "var(--sh)",
        }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t)" }}>Historial de versiones</span>
            <button onClick={() => setShowVersions(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {versions.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--t4)", textAlign: "center", padding: "16px 0" }}>Sin versiones guardadas</p>
            )}
            {versions.map(v => (
              <div key={v.id} className="glass-card" style={{ padding: 12 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--gold)", fontWeight: 700 }}>v{v.version}</span>
                  <span style={{ fontSize: 11, color: "var(--t4)" }}>
                    {new Date(v.savedAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {v.savedBy && <p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 8 }}>por {v.savedBy}</p>}
                <button onClick={() => restoreVersion(v.id)} style={{
                  width: "100%", padding: "7px 0", fontSize: 12, borderRadius: 8, cursor: "pointer",
                  background: "var(--ink3)", border: "1px solid var(--bdr)", color: "var(--t2)",
                  transition: "all .15s",
                }}>Restaurar esta versión</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddSection && (
        <AddSectionModal
          onAdd={addCustomSection}
          onClose={() => setShowAddSection(false)}
        />
      )}

      <style>{`
        /* ── CMS responsive ──────────────────────────────────────── */
        @media (max-width: 768px) {
          .cms-device-switcher { display: none !important; }
          .cms-btn-label { display: none; }
          .cms-mobile-tabs { display: flex !important; }
          .cms-left-panel {
            width: 100% !important;
            border-right: none !important;
            display: ${mobileTab === "edit" ? "flex" : "none"} !important;
          }
          .cms-right-panel {
            display: ${mobileTab === "preview" ? "flex" : "none"} !important;
            width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          .topbar-cms { padding: 0 10px; gap: 8px; }
        }
      `}</style>
    </div>
  );
}
