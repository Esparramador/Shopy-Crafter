import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { projectFilesTable } from "./project_files";

/**
 * Business Cards — Card Studio.
 *
 * Cada fila es una tarjeta editable con:
 *  - Datos del titular (front + back tienen propósitos distintos pero comparten config)
 *  - Plantilla base (luxury, minimalist…) que define layout y CSS
 *  - Paleta y tipografías (override del template)
 *  - Referencias en el Vault a las generaciones reales (PNG front, PNG back, PDF)
 *
 * Pipeline de generación (5 capas):
 *  1. Fondo (IA o sólido/degradado)
 *  2. Logo opcional
 *  3. Capa de texto vectorial (HTML+Puppeteer→PNG transparente)
 *  4. QR funcional (back) generado con npm `qrcode`
 *  5. Composición final con Sharp a 300 DPI con sangrado 3mm
 */
export const businessCardsTable = pgTable("business_cards", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),

  // Identificación / metadatos
  name: text("name").notNull(),
  templateId: text("template_id").notNull().default("elite-executive"),

  // ── Contenido del titular ────────────────────────────────────────────────
  fullName: text("full_name").notNull(),
  jobTitle: text("job_title"),
  companyName: text("company_name"),
  tagline: text("tagline"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  socialHandle: text("social_handle"),
  address: text("address"),
  qrUrl: text("qr_url"),

  // ── Diseño (overrides del template) ──────────────────────────────────────
  palette: text("palette").notNull().default("{}"), // JSON {bg, primary, secondary, accent, text}
  fonts: text("fonts").notNull().default("{}"),     // JSON {heading, body}
  layout: text("layout").notNull().default("centered"), // centered | left | grid
  backgroundConfig: text("background_config").notNull().default("{}"), // JSON {kind, prompt?, hex?}

  // ── Assets ──────────────────────────────────────────────────────────────
  logoVaultFileId: integer("logo_vault_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),
  frontImageVaultFileId: integer("front_image_vault_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),
  backImageVaultFileId: integer("back_image_vault_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),
  pdfVaultFileId: integer("pdf_vault_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),
  svgVaultFileId: integer("svg_vault_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),

  // ── Estado ──────────────────────────────────────────────────────────────
  status: text("status").notNull().default("draft"), // draft | generating | ready | failed
  lastError: text("last_error"),
  generationCost: text("generation_cost"), // string para precisión (USD)
  metadata: text("metadata"), // JSON libre

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => ({
  byProject: index("business_cards_project_idx").on(t.projectId),
  byStatus: index("business_cards_status_idx").on(t.status),
}));

export const insertBusinessCardSchema = createInsertSchema(businessCardsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBusinessCard = z.infer<typeof insertBusinessCardSchema>;
export type BusinessCard = typeof businessCardsTable.$inferSelect;
