/**
 * Menú lateral del panel de administración, agrupado por áreas de trabajo.
 *
 * Antes eran dos listas planas (≈85 enlaces) donde se mezclaban el cerebro, los
 * estudios, la facturación y el sistema. Ahora cada enlace aparece una sola vez,
 * en su área, y las pantallas que trabajan sobre lo mismo (p. ej. las dos de
 * Stripe o las de email) quedan juntas.
 *
 * El CMS (adminNav.shopybrain / adminNav.admin) puede renombrar o cambiar el icono
 * de cualquier enlace por su href, ocultarlo con `hidden: true` o añadir enlaces
 * propios (van a «Más»). El orden y las áreas los marca este archivo.
 */
export interface AdminNavItem { label: string; icon: string; href: string }
export interface AdminNavSection { id: string; title: string; icon: string; items: AdminNavItem[] }

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "inicio", title: "Inicio", icon: "🏠", items: [
      { label: "Home / Inicio", icon: "🏠", href: "/home" },
      { label: "Centro de Comando", icon: "⚡", href: "/admin/command-center" },
      { label: "Buscador Universal", icon: "🔎", href: "/admin/search" },
    ],
  },
  {
    id: "cerebro", title: "Cerebro IA", icon: "🧠", items: [
      { label: "Centro Shopy Crafter", icon: "🧠", href: "/admin/shopybrain" },
      { label: "Memorias", icon: "💾", href: "/admin/shopybrain/memories" },
      { label: "Knowledge Domains", icon: "🔬", href: "/admin/shopybrain/insights" },
      { label: "Sesiones Estudio", icon: "📚", href: "/admin/shopybrain/study" },
      { label: "Brain Sync", icon: "🔄", href: "/admin/brain-sync" },
      { label: "Librería de Prompts", icon: "🏛", href: "/admin/prompt-library" },
      { label: "Librería de Skills", icon: "📚", href: "/admin/skills-library" },
      { label: "Catálogo IA AMIS", icon: "🧠", href: "/admin/ai-catalog" },
      { label: "Costes IA por sesión", icon: "💸", href: "/admin/api-usage" },
    ],
  },
  {
    id: "tienda", title: "Tienda y catálogo", icon: "🛍️", items: [
      { label: "Auditoría Web", icon: "📊", href: "/audit" },
      { label: "Rediseño IA", icon: "✏️", href: "/redesign" },
      { label: "Imágenes IA", icon: "🖼", href: "/images" },
      { label: "Consistencia", icon: "🎨", href: "/consistency" },
      { label: "SEO Engine", icon: "🔍", href: "/seo" },
      { label: "Pricing Engine", icon: "💰", href: "/pricing" },
      { label: "A/B Testing", icon: "📈", href: "/ab-testing" },
      { label: "A/B Tests Global", icon: "📈", href: "/admin/abtests" },
      { label: "Productos Global", icon: "📦", href: "/admin/products" },
      { label: "M7 Inventario", icon: "🗄", href: "/admin/inventory" },
      { label: "Proveedores", icon: "🏭", href: "/suppliers" },
      { label: "Generador IA", icon: "✨", href: "/generator" },
      { label: "Repositorio", icon: "🗄️", href: "/vault" },
      { label: "Exportar", icon: "📥", href: "/exports" },
    ],
  },
  {
    id: "web", title: "Web y diseño", icon: "🎨", items: [
      { label: "Lab Web IA", icon: "🔬", href: "/web-lab" },
      { label: "AI Web Designer", icon: "🎨", href: "/web-designer" },
      { label: "Effects Studio", icon: "✦", href: "/effects-studio" },
      { label: "Template Studio", icon: "🎨", href: "/admin/template-studio" },
      { label: "Design Systems", icon: "🎨", href: "/admin/design-systems" },
      { label: "HyperFrames Studio", icon: "🖼", href: "/admin/hyperframes" },
      { label: "Deck Builder", icon: "📊", href: "/admin/deck-builder" },
      { label: "CMS Editor", icon: "✏️", href: "/admin/cms" },
      { label: "Portfolio (landing)", icon: "🖼️", href: "/admin/portfolio" },
    ],
  },
  {
    id: "estudios", title: "Estudios creativos", icon: "🎬", items: [
      { label: "Studio Fotografía IA", icon: "🧬", href: "/fusion-studio" },
      { label: "Studio Multimedia Pro", icon: "⚡", href: "/fusion-studio-pro" },
      { label: "Studio de Anuncios", icon: "📺", href: "/ad-studio" },
      { label: "Kit de Campañas", icon: "🎬", href: "/campaign-kit" },
      { label: "Vista Explosionada", icon: "💥", href: "/exploded-view" },
      { label: "Studio de Cards", icon: "💳", href: "/cards" },
      { label: "Avatar Studio", icon: "🎬", href: "/admin/avatar-studio" },
      { label: "YouTube Studio", icon: "▶️", href: "/admin/youtube-studio" },
      { label: "AMR Studio", icon: "🤖", href: "/admin/amr-studio" },
      { label: "Meshy Character Lab", icon: "🧊", href: "/admin/meshy-studio" },
      { label: "Tripo3D Studio", icon: "🧊✨", href: "/tripo3d" },
    ],
  },
  {
    id: "clientes", title: "Clientes y marketing", icon: "👥", items: [
      { label: "CRM Clientes", icon: "👥", href: "/admin/clients" },
      { label: "Mensajes Clientes", icon: "💬", href: "/admin/messages" },
      { label: "Chat Grupal", icon: "👥", href: "/admin/group-chat" },
      { label: "Calendario CRM", icon: "📅", href: "/admin/calendar" },
      { label: "Email Marketing", icon: "📧", href: "/admin/emails" },
      { label: "Flujos de Email", icon: "🔁", href: "/admin/email-flows" },
      { label: "Automaciones", icon: "⚡", href: "/admin/automations" },
      { label: "Panel Cliente", icon: "👤", href: "/client" },
    ],
  },
  {
    id: "ventas", title: "Ventas y facturación", icon: "💳", items: [
      { label: "Revenue & CRM", icon: "💰", href: "/admin/revenue" },
      { label: "Revenue Intel", icon: "📊", href: "/admin/intelligence" },
      { label: "Mi Pricing CFO", icon: "💰", href: "/admin/my-pricing" },
      { label: "Planes & Servicios", icon: "📦", href: "/admin/tienda" },
      { label: "Facturación & Plan", icon: "💳", href: "/admin/billing" },
      { label: "Facturación de Agencia", icon: "📄", href: "/admin/agency-billing" },
      { label: "Stripe Manager", icon: "💳", href: "/admin/stripe" },
      { label: "Stripe Master Hub", icon: "👑", href: "/admin/stripe-master" },
      { label: "Tienda: pedidos y productos", icon: "🛍️", href: "/admin/shop" },
      { label: "Tienda / Store", icon: "🛒", href: "/tienda" },
    ],
  },
  {
    id: "inteligencia", title: "Inteligencia de negocio", icon: "🔮", items: [
      { label: "Gemini Research", icon: "🔬", href: "/admin/gemini-intel" },
      { label: "Competitor Intel", icon: "🎯", href: "/admin/competitors" },
      { label: "Predicciones ML", icon: "🔮", href: "/admin/forecast" },
      { label: "Plan 30-60-90", icon: "🗺", href: "/admin/roadmap" },
      { label: "Logros", icon: "🏆", href: "/admin/achievements" },
    ],
  },
  {
    id: "sistema", title: "Sistema", icon: "🖥", items: [
      { label: "API Keys Manager", icon: "🔑", href: "/admin/api-keys" },
      { label: "Conexiones / Integraciones", icon: "🔗", href: "/help/connections" },
      { label: "MCP Manager", icon: "🔌", href: "/admin/mcp-manager" },
      { label: "Catálogo de Plugins", icon: "🔌", href: "/admin/plugins-catalog" },
      { label: "Security Lab", icon: "🔐", href: "/admin/security-lab" },
      { label: "Bóveda Global", icon: "🏦", href: "/admin/vault" },
      { label: "System Health", icon: "🖥", href: "/admin/system" },
      { label: "APK Android", icon: "📱", href: "/admin/apk" },
    ],
  },
];

interface CmsNavItem { label?: string; icon?: string; href?: string; hidden?: boolean; divider?: boolean }

/**
 * Aplica lo que el CMS cambie (nombre, icono, ocultar) y añade sus enlaces propios
 * en «Más». Los separadores antiguos del CMS («── X ──») se ignoran.
 */
export function buildAdminNav(cmsLists: Array<CmsNavItem[] | null | undefined>): AdminNavSection[] {
  const overrides = new Map<string, CmsNavItem>();
  for (const list of cmsLists) {
    if (!Array.isArray(list)) continue;
    for (const it of list) if (it && typeof it.href === "string" && it.href !== "#" && !it.divider) overrides.set(it.href, it);
  }
  const known = new Set<string>();
  const sections = ADMIN_NAV_SECTIONS.map(sec => ({
    ...sec,
    items: sec.items.flatMap(item => {
      known.add(item.href);
      const o = overrides.get(item.href);
      if (o?.hidden) return [];
      return [{ href: item.href, label: o?.label?.trim() || item.label, icon: o?.icon ?? item.icon }];
    }),
  }));
  const extra = [...overrides.values()]
    .filter(o => !known.has(o.href!) && !o.hidden && o.label)
    .map(o => ({ href: o.href!, label: o.label!, icon: o.icon ?? "•" }));
  if (extra.length) sections.push({ id: "mas", title: "Más", icon: "➕", items: extra });
  return sections.filter(s => s.items.length > 0);
}

/** Sección que contiene la ruta (coincidencia más larga), para abrirla sola. */
export function sectionForPath(sections: AdminNavSection[], path: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const s of sections) for (const it of s.items) {
    if (path === it.href || path.startsWith(it.href + "/")) {
      if (!best || it.href.length > best.len) best = { id: s.id, len: it.href.length };
    }
  }
  return best?.id ?? null;
}
