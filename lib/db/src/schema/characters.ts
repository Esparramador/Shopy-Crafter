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

export const charactersTable = pgTable("characters", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  gender: text("gender"),
  ageRange: text("age_range"),
  identityDescription: text("identity_description").notNull(),
  voiceId: text("voice_id"),
  voiceGender: text("voice_gender"),
  voiceLanguage: text("voice_language"),
  refVaultFileId: integer("ref_vault_file_id").references(() => projectFilesTable.id, { onDelete: "set null" }),
  refMimeType: text("ref_mime_type"),
  styleNotes: text("style_notes"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  byProject: index("characters_project_idx").on(t.projectId),
}));

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
