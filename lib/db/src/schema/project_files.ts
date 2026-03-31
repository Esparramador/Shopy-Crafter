import { pgTable, text, integer, real, timestamp, serial } from "drizzle-orm/pg-core";

export const projectFilesTable = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  fileType: text("file_type").notNull(),
  category: text("category"),
  title: text("title").notNull(),
  description: text("description"),
  objectPath: text("object_path"),
  originalUrl: text("original_url"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
  productId: text("product_id"),
  productTitle: text("product_title"),
  generatedBy: text("generated_by"),
  metadata: text("metadata"),
  content: text("content"),
  isPublic: integer("is_public").default(0),
  entityName: text("entity_name"),
  entityUrl: text("entity_url"),
  createdAt: timestamp("created_at").defaultNow(),
});
