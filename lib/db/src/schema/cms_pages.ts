import { pgTable, serial, text, jsonb, timestamp, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Páginas externas administrables desde el CMS.
 * Cada página vive en /p/:slug y se compone de bloques (jsonb)
 * tipo hero, text, image, video, cards, cta, html.
 *
 * Idea: descongestionar la landing creando páginas independientes
 * (Sobre Nosotros, Casos de Éxito, Afiliados, Política de Cookies, ...)
 * que se enlazan desde el footer / header / cualquier sitio.
 */
export const cmsPages = pgTable("cms_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ogImage: text("og_image"),
  status: text("status").notNull().default("draft"), // 'draft' | 'published'
  // Bloques de contenido renderizados en orden. Estructura:
  //   { id: string, type: 'hero'|'text'|'image'|'video'|'cards'|'cta'|'html', data: {...} }
  blocks: jsonb("blocks").notNull().default([]),
  // Cabecera y pie heredados de la landing (true) o sin chrome (false).
  showHeader: boolean("show_header").notNull().default(true),
  showFooter: boolean("show_footer").notNull().default(true),
  // Estilo opcional (background, accent...)
  themeOverrides: jsonb("theme_overrides"),
  // Orden por defecto en menús generados (no obligatorio).
  navOrder: integer("nav_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => ({
  slugIdx: uniqueIndex("cms_pages_slug_idx").on(table.slug),
}));
