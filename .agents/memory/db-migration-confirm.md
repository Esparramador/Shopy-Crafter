---
name: DB Migration Confirmation Rule
description: Always ask user for confirmation before applying any database migration, schema change, column addition, or seed data operation.
---

# DB Migration Confirmation Rule

**Rule:** Before executing ANY database migration, schema change, or destructive DB operation, ALWAYS ask the user for confirmation using `user_query` with a boolean prompt. Only proceed if the user explicitly approves.

**Why:** The user explicitly requested this workflow. They want to review what will change in the DB before it's applied, particularly for production data. They said: "cuando hace migration si hay datos nuevos o cambios o lo que sea siempre pregunta y le doy a aceptar — ahora no me lo pregunta directamente pass al siguiente paso."

**How to apply:** This applies to:
- Adding new columns (ALTER TABLE ... ADD COLUMN)
- Creating new tables (CREATE TABLE)
- Modifying column types
- Running seed data inserts
- Running `ensureMigration()` or similar idempotent migration helpers
- Any raw SQL that mutates schema

**Pattern to use:**
```typescript
// Before running migration, always ask:
// user_query({ question: "Voy a añadir la columna X a la tabla Y. ¿Procedo?", confirm_text: "Sí, aplicar", reject_text: "No, cancelar" })
// Only proceed if user confirms.
```

**Exception:** Migrations that run automatically at server startup (idempotent `IF NOT EXISTS`) are acceptable without confirmation only if they are non-destructive (ADD COLUMN IF NOT EXISTS). Any destructive or data-altering migration must still confirm.
