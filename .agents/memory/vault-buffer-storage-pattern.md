---
name: Vault binary file storage pattern (saveToVault)
description: How to persist a real generated file (docx/xlsx/pptx/image/video) to the project Vault
---

`saveToVault()` in `artifacts/api-server/src/lib/vault.ts` accepts `content` as a **base64 string** for binaries under the size limit (10MB image / 50MB video, `MAX_CONTENT_BYTES`/`MAX_VIDEO_CONTENT_BYTES`). For a freshly-generated in-memory `Buffer` (e.g. from docx/exceljs/pptxgenjs), pass `content: buffer.toString("base64")` + `mimeType` + `fileSizeBytes: buffer.length` directly — do NOT invent a `buffer` param, the `VaultFileParams` interface doesn't declare one (some older call sites in `fs-pro.ts` pass `buffer` anyway; that's a pre-existing/undetected TS error, not a supported field — don't copy that pattern).

If the base64 content exceeds the size limit, `saveToVault` automatically decodes and uploads to Object Storage itself (falls back to disk if that fails too) — callers generating small-to-medium office documents (reports, invoices, single presentations) never need to touch `ObjectStorageService` or `uploadBufferToObjectStorage` directly.

**Why:** avoids duplicating the auto-persist/size-limit/object-storage-fallback logic that already lives in `vault.ts`, and matches the existing pattern used for HTML brand books and other generated documents.

**How to apply:** for any new "generate a real file and save it" action, generate the `Buffer` in a dedicated lib file, then call `saveToVault({ projectId, fileType, category, title, mimeType, fileSizeBytes: buf.length, content: buf.toString("base64"), generatedBy })`.
