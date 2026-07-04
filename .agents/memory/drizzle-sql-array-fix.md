---
name: Drizzle sql template — TEXT[] array parameter bug
description: How to pass JS arrays as PostgreSQL TEXT[] in drizzle-orm sql tagged templates when sql.array() does not exist
---

## Rule
When inserting JS string arrays into a `TEXT[]` column via drizzle-orm's `sql` tagged template, do NOT pass the array directly (it expands as a tuple `($1,$2,$3)`) and do NOT use `sql.array()` (not available in the installed version).

**Working fix:** Convert to PostgreSQL array literal string before passing:
```typescript
${`{${(myArray ?? []).join(",")}}`}
```
PostgreSQL accepts `{elem1,elem2}` strings as TEXT[] parameter values.

**Why:** drizzle-orm's `sql` tag spreads JS arrays as separate SQL parameters, producing malformed queries like `($13,$14,$15)` for a column that expects a single `TEXT[]` value. `sql.array()` was added in a later drizzle version not installed here.

**How to apply:** Any time you write a raw `sql` query that inserts into a `TEXT[]` column from a JS array, use the `{...join(",")}` pattern instead of passing the array directly.
