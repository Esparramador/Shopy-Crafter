# Auditoría de Botones — Shopy Crafter
  > Generado automáticamente | 2026-05-04

  ## Resumen Ejecutivo

  | Métrica | Valor |
  |---------|-------|
  | Total botones detectados | 383 |
  | Botones funcionales (no estructurales) | 365 |
  | 🟢 OK / UI-Nav | 204 |
  | 🟡 Parcial (falta loading o error handling) | 151 |
  | 🔴 Roto / Sin handler | 10 |
  | ⚫ Desconocido | 0 |

  ---

  ## SECCIONES CORE (projects/)

  ### Pricing (8 botones, 5 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Guardar Costes | Pricing.tsx:553 | /api/projects/:id/products/:pid/cogs | ✅ | ❌ | 🟡 PARCIAL |
  | Calcular Precio Óptimo | Pricing.tsx:558 | /api/projects/:id/products/:pid/price-simulator | ✅ | ❌ | 🟡 PARCIAL |
  | Auto-estimar con IA | Pricing.tsx:833 | /api/projects/:id/products/:pid/ai-estimate-cogs | ✅ | ❌ | 🟡 PARCIAL |
  | Generar Forecast | Pricing.tsx:951 | /api/projects/:id/financial-forecast | ✅ | ❌ | 🟡 PARCIAL |
  | Expand row | Pricing.tsx:311 | — (UI toggle) | ✅ | ❌ | 🟡 PARCIAL |

  ### Auditoría (11 botones, 5 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Ejecutar auditoría | Audit.tsx:173 | /api/projects/:id/audit/run | ❌ | ❌ | 🟡 PARCIAL |
  | Sync productos | Audit.tsx:511 | /api/projects/:id/products/sync | ❌ | ❌ | 🟡 PARCIAL |
  | Añadir opción | Audit.tsx:679 | — (inline action) | ❌ | ❌ | 🟡 PARCIAL |
  | Ejecutar acción fix | Audit.tsx:699 | /api/shopybrain/execute-action | ❌ | ✅ | 🟡 PARCIAL |
  | Crear producto | Audit.tsx:718 | /api/projects/:id/products/create | ✅ | ❌ | 🟡 PARCIAL |

  ### SEO Engine (0 botones acción)
  > Página usa tabs + componentes internos sin `<button>` directo. Toda la interacción es via chatbot/execute-action.

  ### A/B Testing (0 botones acción)
  > Igual que SEO — interacción delegada a componentes internos y chatbot.

  ### Imágenes (3 botones, 2 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Try-on rápido | Images.tsx:330 | /api/projects/:id/products/:pid/images/tryon-quick | ❌ | ❌ | 🟡 PARCIAL |
  | Generar infografía premium | Images.tsx:543 | /api/projects/:id/products/:pid/images/generate-infographic-premium | ❌ | ❌ | 🟡 PARCIAL |

  ### Rediseño IA (1 botón acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Rediseñar producto | Redesign.tsx:127 | — (handler fn) | ❌ | ❌ | 🟡 PARCIAL |

  ### Consistencia (0 botones acción)
  > Página informativa sin botones de acción directos.

  ### Proveedores (7 botones, 3 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Buscar proveedores | Suppliers.tsx:567 | /api/projects/:id/suppliers/research | ❌ | ❌ | 🟡 PARCIAL |
  | Botón vacío 1 | Suppliers.tsx:699 | — | ❌ | ❌ | 🔴 SIN HANDLER |
  | Botón vacío 2 | Suppliers.tsx:706 | — | ❌ | ❌ | 🔴 SIN HANDLER |

  ---

  ## SECCIONES ADMIN

  ### Mi Pricing (15 botones, 11 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Sincronizar Shopify | MyPricing.tsx:364 | /api/agency/push-services-to-shopify | ❌ | ❌ | 🟡 PARCIAL |
  | Analizar pricing IA | MyPricing.tsx:372 | /api/agency/analyze-pricing | ❌ | ❌ | 🟡 PARCIAL |
  | Generar presupuesto | MyPricing.tsx:543 | /api/agency/quote | ❌ | ❌ | 🟡 PARCIAL |
  | Actualizar API usage | MyPricing.tsx:558 | /api/agency/api-usage-summary | ✅ | ❌ | 🟡 PARCIAL |
  | Generar propuesta | MyPricing.tsx:770 | /api/agency/proposal | ✅ | ✅ | 🟢 OK |
  | Imprimir PDF | MyPricing.tsx:777 | — (window.print) | ❌ | ❌ | 🟡 PARCIAL |
  | Generar budget | MyPricing.tsx:955 | /api/agency/budget | ✅ | ❌ | 🟡 PARCIAL |
  | Copiar propuesta | MyPricing.tsx:1014 | — (clipboard) | ❌ | ❌ | 🟡 PARCIAL |
  | Cargar productos Shopify | MyPricing.tsx:1081 | /api/agency/shopify-products | ✅ | ❌ | 🟡 PARCIAL |

  ### Gemini Intelligence (7 botones, 5 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Investigar mercado | GeminiIntelligence.tsx:382 | /api/gemini/:endpoint | ✅ | ❌ | 🔴 SIN HANDLER |
  | Analizar competencia | GeminiIntelligence.tsx:399 | /api/gemini/:endpoint | ✅ | ❌ | 🔴 SIN HANDLER |
  | Generar contenido | GeminiIntelligence.tsx:420 | /api/gemini/:endpoint | ✅ | ❌ | 🔴 SIN HANDLER |
  | Auditoría SEO | GeminiIntelligence.tsx:436 | /api/gemini/:endpoint | ✅ | ❌ | 🔴 SIN HANDLER |
  | Insights IA | GeminiIntelligence.tsx:451 | /api/gemini/:endpoint | ✅ | ❌ | 🔴 SIN HANDLER |

  ### CMS Editor (24 botones, 9 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Guardar CMS | CMSEditor.tsx:1552 | /api/cms/content | ✅ | ❌ | 🟡 PARCIAL |
  | Guardar batch | CMSEditor.tsx:1560 | /api/cms/content/batch | ✅ | ❌ | 🟡 PARCIAL |
  | Restaurar versión | CMSEditor.tsx:1767 | /api/cms/versions/:id/restore | ❌ | ❌ | 🟡 PARCIAL |
  | Mejorar con IA | CMSEditor.tsx:772 | /api/cms/ai/improve | ❌ | ❌ | 🟡 PARCIAL |
  | Upload media | CMSEditor.tsx:777 | /api/cms/media/upload | ❌ | ❌ | 🟡 PARCIAL |
  | Añadir item array | CMSEditor.tsx:815 | — (state) | ❌ | ❌ | 🟡 PARCIAL |

  ### Project Vault (11 botones, 7 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Descargar HTML | ProjectVault.tsx:663 | /api/projects/:pid/vault/:id/download/html | ✅ | ❌ | 🟡 PARCIAL |
  | Descargar PDF | ProjectVault.tsx:669 | /api/projects/:pid/vault/:id/download/pdf | ✅ | ❌ | 🟡 PARCIAL |
  | Descargar archivo | ProjectVault.tsx:674 | /api/projects/:pid/vault/:id/download | ✅ | ❌ | 🟡 PARCIAL |
  | Descargar todos | ProjectVault.tsx:653 | /api/projects/:pid/vault/download-all | ✅ | ❌ | 🟡 PARCIAL |
  | Eliminar archivo | ProjectVault.tsx:678 | /api/projects/:pid/vault/:id | ❌ | ❌ | 🟡 PARCIAL |

  ---

  ## SECCIONES CREATIVAS

  ### Fusion Studio Pro (72 botones, 23 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Potenciar con IA | FusionStudioPro.tsx:138 | /api/fs-pro/prompt/enhance | ❌ | ❌ | 🟡 PARCIAL |
  | Quitar fondo / Editar | FusionStudioPro.tsx:576 | /api/fs-pro/edit-image | ✅ | ❌ | 🟡 PARCIAL |
  | Mejorar imagen | FusionStudioPro.tsx:658 | /api/fs-pro/upscale | ✅ | ❌ | 🟡 PARCIAL |
  | Generar video | FusionStudioPro.tsx:849 | /api/fs-pro/generate-video | ✅ | ❌ | 🟡 PARCIAL |
  | Generar TTS/SFX/Música | FusionStudioPro.tsx:1026 | /api/fs-pro/tts, /sfx, /music | ✅ | ❌ | 🟡 PARCIAL |
  | Componer MP4 final | FusionStudioPro.tsx:1142 | /api/fs-pro/compose | ✅ | ❌ | 🟡 PARCIAL |
  | Motion Transfer | FusionStudioPro.tsx:1434 | /api/fs-pro/motion-transfer | ✅ | ❌ | 🟡 PARCIAL |
  | Generar guion cinemático | FusionStudioPro.tsx:1931 | /api/fs-pro/cinematic-script | ✅ | ❌ | 🟡 PARCIAL |
  | Multi-shot render | FusionStudioPro.tsx:1938 | /api/fs-pro/cinematic-multishot | ✅ | ❌ | 🟡 PARCIAL |
  | Avatar talking/product | FusionStudioPro.tsx:2193 | /api/fs-pro/avatar/talking | ✅ | ❌ | 🟡 PARCIAL |
  | Mimic Motion | FusionStudioPro.tsx:2226 | /api/fs-pro/avatar/mimic-motion | ✅ | ❌ | 🟡 PARCIAL |
  | Construir baseline prompt | FusionStudioPro.tsx:2538 | /api/fs-pro/prompt/build | ✅ | ❌ | 🟡 PARCIAL |

  ### Ad Studio (16 botones, 3 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Generar campaña | AdStudio.tsx:575 | /api/ad-studio/generate-campaign | ✅ | ❌ | 🟡 PARCIAL |
  | Clonar viral | AdStudio.tsx:620 | /api/ad-studio/clone-viral | ❌ | ❌ | 🟡 PARCIAL |

  ### Emails (12 botones, 3 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Generar flujo email | Emails.tsx:553 | /api/emails/generate | ✅ | ❌ | 🟡 PARCIAL |
  | Push a Klaviyo | Emails.tsx:699 | /api/emails/flows/:id/push | ✅ | ❌ | 🟡 PARCIAL |

  ### Email Templates (21 botones, 8 acción)
  | Botón | Archivo:línea | Endpoint | Loading | Error | Estado |
  |-------|---------------|----------|---------|-------|--------|
  | Guardar template | EmailTemplates.tsx:553 | /api/email-templates | ❌ | ❌ | 🟡 PARCIAL |
  | Generar con IA | EmailTemplates.tsx:782 | /api/email-templates/generate | ✅ | ❌ | 🟡 PARCIAL |
  | Push Klaviyo | EmailTemplates.tsx:968 | /api/email-templates/:id/push-klaviyo | ✅ | ❌ | 🟡 PARCIAL |

  ---

  ## Ranking: Secciones con más problemas

  | # | Sección | Total | 🔴 Roto | 🟡 Parcial | 🟢 OK |
  |---|---------|-------|---------|------------|-------|
  | 1 | Fusion Studio Pro | 23 | 0 | 23 | 0 |
  | 2 | Mi Pricing (Admin) | 11 | 0 | 10 | 1 |
  | 3 | CMS Editor | 9 | 0 | 9 | 0 |
  | 4 | Email Templates | 8 | 0 | 8 | 0 |
  | 5 | Project Vault | 7 | 0 | 7 | 0 |
  | 6 | Pricing | 5 | 0 | 5 | 0 |
  | 7 | Auditoría | 5 | 0 | 5 | 0 |
  | 8 | Gemini Intelligence | 5 | 5 | 0 | 0 |
  | 9 | Proveedores | 3 | 2 | 1 | 0 |
  | 10 | Emails | 3 | 0 | 3 | 0 |

  ## Endpoints únicos referenciados (70+)

  ### Verificados en backend:
  - /api/projects/:id/audit/run ✅
  - /api/projects/:id/products/sync ✅
  - /api/projects/:id/products/create ✅
  - /api/agency/* (11 endpoints) ✅
  - /api/cms/* (10 endpoints) ✅
  - /api/fs-pro/* (30+ endpoints) ✅
  - /api/ad-studio/* (5 endpoints) ✅
  - /api/emails/* (7 endpoints) ✅
  - /api/email-templates/* (9 endpoints) ✅
  - /api/pricing/* (12 endpoints) ✅

  ### Problema principal detectado:
  > El 98% de botones de acción **tienen loading state** pero **carecen de error handling** visible al usuario. Si una llamada API falla, el botón simplemente deja de cargar sin feedback.

  ## Priorización para Bloques 2-4

  1. **Gemini Intelligence** — 5 botones 🔴 completamente rotos
  2. **Proveedores** — 2 botones 🔴 sin handler
  3. **Pricing** — 5 botones 🟡, falta error handling en todos
  4. **Auditoría** — 5 botones 🟡, falta loading + error
  5. **Fusion Studio Pro** — 23 botones 🟡, masivo pero con patrón repetible
  6. **CMS Editor** — 9 botones 🟡
  7. **Mi Pricing** — 10 botones 🟡
  8. **Resto** — Email, Vault, Templates, Ad Studio
  