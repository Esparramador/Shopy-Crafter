import { pgTable, text, integer, real, timestamp, serial } from "drizzle-orm/pg-core";

export const projectFilesTable = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  fileType: text("file_type").notNull(), // "image", "seo_report", "redesign", "ab_test", "email", "pricing_report"
  category: text("category"),           // "hero", "lifestyle", "detail", "bundle", "ugc" para imágenes
  title: text("title").notNull(),
  description: text("description"),
  objectPath: text("object_path"),      // ruta en GCS: /objects/projects/123/images/xxx
  originalUrl: text("original_url"),    // URL origen (Replicate, etc.) — backup
  mimeType: text("mime_type"),          // "image/webp", "application/json", "text/html"
  fileSizeBytes: integer("file_size_bytes"),
  productId: text("product_id"),        // Shopify product ID asociado
  productTitle: text("product_title"),
  generatedBy: text("generated_by"),   // "images_motor", "seo_motor", "redesign_motor", etc.
  metadata: text("metadata"),           // JSON con datos adicionales (prompt, score, etc.)
  isPublic: integer("is_public").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
