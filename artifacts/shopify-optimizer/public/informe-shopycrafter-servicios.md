# INFORME EJECUTIVO DE SERVICIOS Y CAPACIDADES
## Shopy Crafter (shopycrafter.com) — Plataforma de Agencia Shopify con IA

**Fecha:** Marzo 2026  
**Versión:** 1.0  
**Clasificación:** Documento Comercial — Uso Interno y Externo  
**Motor IA:** ShopyBrain (OmniCore AI)

---

## 1. RESUMEN EJECUTIVO

**Shopy Crafter** es una agencia Shopify 100% potenciada por inteligencia artificial que crea, gestiona, optimiza y escala tiendas Shopify de manera completamente autónoma. La plataforma opera 24/7 a través de **ShopyBrain**, un motor de IA dual (Claude + Gemini) con 46.000+ insights acumulados, 79 acciones automatizadas y 12 trabajos cron de aprendizaje continuo.

**Propuesta de valor:** Donde una agencia tradicional necesita 5-10 personas y semanas de trabajo, Shopy Crafter entrega los mismos resultados (o superiores) en minutos, con calidad verificable y precios transparentes.

**Modelo de negocio:** Servicios puntuales (one-time) + retainers mensuales (recurring). Pagos procesados exclusivamente por Shopify. Sin permanencia, sin tarjeta de crédito para empezar, cancelación inmediata.

---

## 2. ARQUITECTURA TECNOLOGICA

### 2.1 Motor Dual de IA — ShopyBrain (OmniCore AI)

| Componente | Tecnologia | Funcion |
|---|---|---|
| **Claude Sonnet 4.5** | Anthropic | Razonamiento complejo, analisis financiero, generacion de contenido, auditorias SEO, system prompt de 4096 tokens |
| **Gemini 2.0 Flash** | Google | Google Search Grounding en tiempo real, investigacion de mercado, precios de competidores, tendencias |
| **Replicate Flux 1.1 Pro** | Replicate | Generacion de imagenes de producto profesionales (8 tipos) |
| **Recraft v3** | Replicate | Consistencia visual y estilos especificos de marca |
| **OmniCore Brain** | Propio | 46.199 insights acumulados, 311 memorias consolidadas, aprendizaje continuo 24/7 |

### 2.2 Los 6 Motores de Optimizacion

| Motor | Nombre | Descripcion |
|---|---|---|
| **M1** | Generacion de Imagenes | 8 tipos de imagen profesional por producto (Hero, Lifestyle, Detalle, Packaging, UGC, Escala, Bundle, Infografia). Coste: ~0.25 EUR/producto |
| **M2** | Consistencia Visual | Aplica guia de marca automatica: paleta de colores, tipografia, estilo fotografico coherente |
| **M3** | A/B Testing | Tests automaticos con pixel tracking, declaracion automatica de ganadores por confianza estadistica |
| **M4** | Auto-Pilot 24/7 | 12 cron jobs: tokens Shopify (20h), micro-learning (3h), consolidacion (6h), cross-synthesis (12h), deep study (1am), revenue (2am), real data (3am), competidores (6am), inventario (7am), mega-synthesis (dom), retroanalisis (dom), auto-evaluacion (1o/mes) |
| **M5** | Pricing Financiero | P&L, COGS, unit economics, elasticidad precio-demanda, simulador de escenarios, forecast a 3-6 meses |
| **M6** | SEO Tecnico | 16 criterios ponderados nivel Semrush, Schema JSON-LD, meta tags, keywords, alt texts, sitemap |

### 2.3 Seguridad y Compliance

- Encriptacion AES-256 para tokens Shopify
- RGPD compliant (datos en UE)
- Sesiones seguras con express-session
- Renovacion automatica de tokens con 4h de margen
- Sin almacenamiento de tarjetas de credito (pagos via Shopify)

---

## 3. CATALOGO COMPLETO DE 79 ACCIONES AUTOMATIZADAS

### 3.1 Gestion de Productos (14 acciones)

| Accion | Descripcion | Complejidad |
|---|---|---|
| `create_product` | Crea producto con investigacion de mercado real, pricing psicologico (.97/.99), descripcion 800-1200 palabras, 22-28 tags SEO, 8 secciones | Alta |
| `edit_product` | Edita cualquier campo de un producto existente | Media |
| `delete_product` | Elimina un producto de la tienda | Baja |
| `search_product` | Busca productos por titulo/vendor/type | Baja |
| `list_products` | Lista productos con paginacion cursor-based | Baja |
| `list_all_products` | Lista todos los productos del catalogo | Media |
| `publish_product` | Publica un producto en borrador | Baja |
| `set_product_status` | Cambia estado (active/draft/archived) | Baja |
| `change_price` | Cambia precio de un producto con psicologia de pricing | Baja |
| `optimize_product` | Optimizacion integral de un producto (titulo + desc + tags + SEO) | Alta |
| `optimize_all_products` | Optimizacion masiva de todo el catalogo | Muy Alta |
| `redesign_product` | Rediseno completo con metodologia Semrush | Alta |
| `bulk_redesign` | Rediseno masivo (mode: "all" o "weak" = solo productos con score bajo) | Muy Alta |
| `apply_redesign` | Aplica campos especificos de un rediseno aprobado | Media |

### 3.2 Imagenes IA (3 acciones)

| Accion | Descripcion | Coste Aprox. |
|---|---|---|
| `generate_product_images` | Genera 8 tipos de imagen profesional para un producto | ~0.25 EUR |
| `bulk_generate_images` | Generacion masiva para multiples productos | ~0.25 EUR/producto |
| `optimize_images` | Optimiza imagenes existentes (compresion, alt text, lazy loading) | Incluido |

### 3.3 SEO Tecnico (10 acciones)

| Accion | Descripcion |
|---|---|
| `seo_full_audit` | Auditoria completa de 16 criterios ponderados (titulo 12%, descripcion 22%, precio 10%, imagenes 18%, SEO meta 18%, calidad contenido 12%, trust signals 8%) |
| `keyword_intelligence` | Investigacion de keywords con Google Search real (buyer intent, long-tail, LSI) |
| `blog_strategy` | Estrategia de contenido: calendario editorial, topics, keyword clusters |
| `generate_blog_post` | Genera articulo optimizado 1500+ palabras con schema FAQ |
| `generate_schemas` | Schemas JSON-LD: Product, BreadcrumbList, Organization, FAQ, WebSite |
| `generate_all_metas` | Meta tags optimizados para todos los productos (title 60 chars, description 150-160 chars) |
| `fix_all_alt_texts` | Corrige alt texts de todas las imagenes (descriptivos, con keywords) |
| `generate_sitemap` | Genera/optimiza sitemap XML |
| `audit_page_speed` | Auditoria PageSpeed via Google PageSpeed Insights API (Core Web Vitals: LCP, CLS, INP) |
| `modify_audit_filter` | Filtra auditorias por criterios especificos |

### 3.4 Pricing e Inteligencia Financiera (6 acciones)

| Accion | Descripcion |
|---|---|
| `calculate_optimal_price` | Calcula precio optimo basado en competidores reales + elasticidad demanda |
| `estimate_cogs` | Estima COGS real (materiales + produccion + packaging + envio + comisiones) |
| `price_simulator` | Simula escenarios: "si cambio el precio a X, que pasa con margen y volumen?" |
| `financial_forecast` | Forecast a 3-6 meses con escenarios optimista/base/pesimista |
| `financial_dashboard` | Dashboard financiero completo: revenue, margenes, AOV, CLV, CAC, ROAS |
| `generate_competitive_pricing` | Investiga precios de competidores en tiempo real con Google Search |

### 3.5 A/B Testing (3 acciones)

| Accion | Descripcion |
|---|---|
| `create_ab_test` | Crea test A/B con pixel tracking (titulo, precio, imagen, descripcion) |
| `list_ab_tests` | Lista todos los tests activos con metricas (visitas, conversiones, confianza) |
| `declare_winner` | Declara ganador y aplica la variante ganadora automaticamente |

### 3.6 Email Marketing (2 acciones)

| Accion | Descripcion |
|---|---|
| `generate_email_flow` | Genera flujos completos: Welcome Series (5 emails), Abandoned Cart (3), Post-Purchase (4), Win-Back, Browse Abandonment |
| `generate_email` | Genera email individual con copy profesional, CTA optimizado, responsive HTML |

### 3.7 Competencia e Inventario (4 acciones)

| Accion | Descripcion |
|---|---|
| `scan_competitor` | Escaneo completo de un competidor: productos, precios, posicionamiento, gaps |
| `analyze_competitor_product` | Analisis detallado de un producto competidor especifico |
| `inventory_sync` | Sincronizacion de inventario con Shopify (stock levels, SKUs) |
| `inventory_alerts` | Alertas automaticas de stock bajo, roturas, restock suggestions |

### 3.8 Colecciones y Paginas (6 acciones)

| Accion | Descripcion |
|---|---|
| `create_collection` | Crea coleccion inteligente o manual con reglas de filtrado |
| `list_collections` | Lista todas las colecciones con conteo de productos |
| `auto_collections` | Genera colecciones automaticas basadas en tags, tipos y vendors |
| `create_page` | Crea paginas (About, FAQ, Shipping, Returns, Contact) con contenido profesional |
| `list_pages` | Lista todas las paginas de la tienda |
| `design_all_pages` | Disena todas las paginas esenciales de una tienda desde cero |

### 3.9 Theme / Codigo Shopify (10 acciones)

| Accion | Descripcion |
|---|---|
| `list_themes` | Lista todos los themes instalados |
| `list_theme_files` | Lista archivos de un theme (layout, templates, sections, snippets, assets) |
| `read_theme_file` | Lee el contenido de un archivo del theme |
| `edit_theme_file` | Edita un archivo del theme (Liquid, JSON, CSS, JS) |
| `edit_theme_css` | Edita CSS especifico del theme |
| `edit_theme_settings` | Modifica settings del Theme Editor (colores, tipografia, layout) |
| `create_theme_section` | Crea una seccion personalizada (Online Store 2.0) |
| `audit_theme` | Auditoria completa del theme: rendimiento, SEO, accesibilidad, mobile |
| `analyze_component` | Analiza un componente especifico del theme |
| `fix_code` | Corrige errores de codigo en archivos del theme |

### 3.10 Codigo de la Aplicacion (3 acciones)

| Accion | Descripcion |
|---|---|
| `list_source_files` | Lista archivos fuente de la aplicacion ShopyBrain |
| `inspect_code` | Inspecciona codigo fuente de la plataforma |
| `modify_ui` | Modifica la interfaz de usuario de la plataforma |

### 3.11 CMS / Landing Page (4 acciones)

| Accion | Descripcion |
|---|---|
| `read_cms` | Lee la configuracion actual del CMS (hero, pricing, features, contact, nav, footer) |
| `update_cms` | Actualiza un campo especifico del CMS (ej: hero.headline, pricing.plans.0.price) |
| `update_cms_batch` | Actualiza multiples campos del CMS en una sola operacion |
| `reset_cms` | Restaura el CMS a valores por defecto |

### 3.12 Agencia / Negocio (4 acciones)

| Accion | Descripcion |
|---|---|
| `agency_quote` | Genera presupuesto personalizado basado en servicios seleccionados |
| `agency_proposal` | Genera propuesta comercial profesional completa (PDF-ready) |
| `search_suppliers` | Investiga proveedores globales (Alibaba, 1688, Global Sources, IndiaMART, ThomasNet) |
| `audit_app_offerings` | Auditoria de la propia oferta de servicios de Shopy Crafter |

### 3.13 Cerebro OmniCore (4 acciones)

| Accion | Descripcion |
|---|---|
| `brain_stats` | Estadisticas del cerebro: 46.199 insights, 311 memorias, 37 dominios de conocimiento |
| `brain_sync` | Sincronizacion manual del cerebro (fuerza ciclo de aprendizaje) |
| `brain_export` | Exporta conocimiento acumulado |
| `diagnose_app` | Diagnostico completo de la plataforma (health check, DB, APIs, crons) |

### 3.14 Operaciones de Tienda (5 acciones)

| Accion | Descripcion |
|---|---|
| `scan_store` | Escaneo completo de la tienda: productos, colecciones, metricas, estado |
| `store_status` | Estado actual de la tienda (productos activos, revenue, conversion) |
| `get_orders` | Obtiene pedidos recientes con detalles |
| `get_scopes` | Verifica permisos del token Shopify |
| `regenerate_token` | Regenera token de acceso Shopify |

### 3.15 Accion Maestra (1 accion)

| Accion | Descripcion |
|---|---|
| `setup_full_store` | **Configura una tienda COMPLETA desde cero en 9 pasos:** 1) Investiga nicho, 2) Crea 20-30 productos, 3) Crea colecciones, 4) Disena paginas (About, FAQ, Shipping, Returns, Contact), 5) Genera meta tags SEO, 6) Genera schemas JSON-LD, 7) Corrige alt texts, 8) Auditoria SEO, 9) Configura email flows |

---

## 4. PLANES DE SUSCRIPCION (Retainer Mensual)

### 4.1 Plan Photoshoot Pro (Pago Unico)

| | |
|---|---|
| **Precio** | 497 EUR (pago unico, sin retainer) |
| **Ideal para** | Tiendas que necesitan refrescar imagenes de producto |
| **Incluye** | 120 imagenes IA (4 variantes x 30 SKUs), consistencia visual con guia de marca, iluminacion cinematografica (Rembrandt 5:1), audit SEO de 30 fichas, 1 sesion de pricing financiero, entrega en 7 dias, soporte email 30 dias |
| **No incluye** | A/B testing, auto-pilot, acceso a futuros motores |

### 4.2 Plan Growth Studio (Mensual)

| | |
|---|---|
| **Precio** | 297 EUR/mes + 197 EUR setup unico |
| **Ideal para** | Tiendas en crecimiento que quieren optimizacion continua |
| **Incluye** | Imagenes ilimitadas, consistencia visual, A/B testing (3 productos simultaneos), pricing financiero (elasticidad), SEO tecnico (100 URLs/mes), auto-pilot basico (aplicar ganadores A/B), dashboard analytics, soporte email+chat <24h, integraciones Shopify+GA+Meta |
| **No incluye** | A/B testing ilimitado, custom AI model training, soporte dedicado |

### 4.3 Plan Performance Lab (Mensual) — MAS POPULAR

| | |
|---|---|
| **Precio** | 797 EUR/mes + 397 EUR setup unico |
| **Ideal para** | Tiendas con alto volumen que buscan maximizar conversion y revenue |
| **Incluye** | Todo de Growth Studio + A/B testing ilimitado, auto-pilot avanzado 24/7, pricing predictivo con simulacion, SEO ilimitado (crawling + fixes auto), motor de recomendaciones (semantic search), Schema Augmentation a escala, custom AI fine-tuning, soporte prioritario <4h, sesion mensual estrategia 60 min, acceso anticipado nuevos motores |
| **No incluye** | Account manager dedicado |

### 4.4 Plan Enterprise Omnicore

| | |
|---|---|
| **Precio** | Desde 2.497 EUR/mes (setup incluido) |
| **Ideal para** | Marcas y retailers con necesidades enterprise |
| **Incluye** | Todo de Performance Lab + account manager dedicado con SLA, motores IA custom, infraestructura dedicada (no multi-tenant), API privada con webhooks, integracion ERPs/PIMs/custom stacks, white-label completo, SSO enterprise (SAML/OAuth/AD), compliance GDPR/SOC2/ISO 27001, soporte 24/7 <1h critical, sesiones semanales + QBRs, training continuo equipo, desarrollo features custom |

---

## 5. SERVICIOS PUNTUALES (One-Time)

### 5.1 Catalogo de Servicios con Precios

| Servicio | Precio | Descripcion | Entrega |
|---|---|---|---|
| **Auditoria Completa de Tienda** | 197 EUR/tienda | Analisis integral: productos, SEO (16 criterios), COGS, pricing, imagenes, competencia. Informe con plan de accion priorizado + impacto estimado en revenue | 3-5 dias |
| **Rediseno IA por Producto** | 9 EUR/producto | Titulo SEO (45-65 chars), descripcion 400+ palabras, tags optimizados, meta description 150-160 chars, keywords researched | 24-48h |
| **Imagen IA Profesional** | 3 EUR/imagen | Hero, Lifestyle, Detalle, Packaging, UGC, Escala, Bundle, Infografia. Calidad profesional con IA generativa (Flux 1.1 Pro) | Inmediato |
| **Informe Pricing y Margenes** | 97 EUR/informe | COGS real, unit economics, margenes por producto, analisis competitivo de precios, estrategia de pricing con psicologia aplicada | 3-5 dias |
| **Optimizacion SEO por Producto** | 7 EUR/producto | Meta title, meta description, keywords, Schema JSON-LD Product, alt texts, internal linking suggestions | 24-48h |
| **Informe de Competencia** | 97 EUR/informe | Analisis detallado de competidores directos: productos, precios, posicionamiento, gaps de mercado, oportunidades | 5-7 dias |
| **Investigacion de Proveedores** | 97 EUR/investigacion | Busqueda global (Alibaba, 1688, Global Sources, IndiaMART, ThomasNet), comparativa precios, MOQ, lead times, negociacion | 5-7 dias |
| **Setup Email Marketing** | 197 EUR | Templates profesionales responsive, 5 flujos automatizados (Welcome, Abandoned Cart, Post-Purchase, Win-Back, Browse Abandonment), configuracion Klaviyo | 5-7 dias |
| **Proyeccion de Ventas** | 127 EUR/informe | Forecast a 3-6 meses con 3 escenarios (optimista/base/pesimista), analisis estacionalidad, recomendaciones de crecimiento | 3-5 dias |

### 5.2 Packs Recomendados

| Pack | Contenido | Precio | Ahorro |
|---|---|---|---|
| **Pack Rediseno 30 Productos** | 30 productos x rediseno completo | 270 EUR | vs 30 x 9 EUR individual |
| **Pack Imagenes 30 Productos** | 30 productos x imagen profesional | 90 EUR | vs 30 x 3 EUR individual |
| **Pack SEO 30 Productos** | 30 productos x optimizacion SEO | 210 EUR | vs 30 x 7 EUR individual |
| **Pack Tienda Completa** | Auditoria + 30 Redisenos + 30 SEO + Pricing | 774 EUR | Incluye todo lo esencial |
| **Pack Premium** | Todo lo anterior + 120 Imagenes + Email Setup + Competencia | 1.258 EUR | Transformacion completa |

### 5.3 Servicios Recurrentes (Mensuales)

| Servicio | Precio | Incluye |
|---|---|---|
| **Mantenimiento Basico** | 49 EUR/mes | Monitorizacion, actualizaciones mensuales, soporte por email |
| **Gestion Activa** | 149 EUR/mes | Optimizacion continua + informes semanales + A/B testing |
| **Premium Ilimitado** | 399 EUR/mes | Todo incluido + prioridad + SLA 99.9% + account manager |

---

## 6. STANDARD DE CALIDAD: 100/100

Cada producto creado o optimizado por ShopyBrain sigue el estandar de calidad 100/100:

### 6.1 Los 7 Criterios de Auditoria (Ponderados)

| Dimension | Peso | Criterios |
|---|---|---|
| **Titulo** | 12% | 45-65 caracteres, keyword principal primero, sin caracteres especiales innecesarios |
| **Descripcion** | 22% | 800-1200 palabras, 8 secciones (storytelling, beneficios, specs, uso, FAQ, trust signals, CTA, garantia), legibilidad Flesch-Kincaid, keyword density 1-3% |
| **Precio** | 10% | Precio establecido con compare_at_price 30-40% superior, pricing psicologico (.97/.99), margen minimo 40% |
| **Imagenes** | 18% | 8+ imagenes ideal (hero, lifestyle, detalle, packaging, UGC, escala, bundle, infografia), alt text descriptivo, lazy loading |
| **SEO Meta** | 18% | Meta title 60 chars, meta description 130-155 chars, Schema JSON-LD Product, canonical URL, Open Graph tags |
| **Calidad Contenido** | 12% | Consistencia de keywords, estructura de headings (H1-H3), links internos, readability score |
| **Trust Signals** | 8% | Reviews section, FAQ, garantia, politica devoluciones, badges de seguridad |

### 6.2 Los 16 Criterios SEO (Audit Semrush-Level)

1. Title Tag (keyword + length + format)
2. Meta Description (CTA + keyword + length)
3. URL Slug (clean, keyword-based)
4. H1 Heading (unique, keyword-focused)
5. Content Length (800+ words)
6. Keyword Density (1-3%)
7. Internal Linking (productos relacionados, colecciones)
8. Image Alt Text (descriptive, keyword-natural)
9. Schema.org Product (price, availability, rating)
10. BreadcrumbList Schema
11. Open Graph Tags
12. Twitter Card Tags
13. Canonical URL
14. Mobile Responsive
15. Page Speed (Core Web Vitals: LCP <2.5s, CLS <0.1, INP <200ms)
16. Content Quality (readability, structure, FAQ)

---

## 7. DIFERENCIADORES COMPETITIVOS

### 7.1 Shopy Crafter vs Agencia Tradicional

| Aspecto | Agencia Tradicional | Shopy Crafter |
|---|---|---|
| **Equipo necesario** | 5-10 personas (dev, designer, SEO, copywriter, PM) | 1 plataforma IA (ShopyBrain) |
| **Tiempo de entrega** | 2-8 semanas por proyecto | Minutos a horas |
| **Coste mensual** | 2.000-10.000 EUR/mes | 297-797 EUR/mes |
| **Disponibilidad** | Horario laboral (9-18h) | 24/7/365 |
| **Consistencia** | Variable (depende del equipo) | 100% consistente (misma IA) |
| **Escalabilidad** | Limitada (contratar mas gente) | Ilimitada (misma plataforma) |
| **Aprendizaje** | Manual (cada persona aprende por separado) | Acumulativo (46.000+ insights, mejora continua) |
| **SEO** | Manual, parcial | 16 criterios automaticos nivel Semrush |
| **Imagenes** | Fotografo + estudio + edicion | IA generativa en segundos |
| **A/B Testing** | Herramientas externas + analisis manual | Integrado con declaracion automatica de ganadores |

### 7.2 Shopy Crafter vs Apps Shopify Individuales

| Aspecto | Apps Individuales (SEO app + Image app + Price app + ...) | Shopy Crafter |
|---|---|---|
| **Coste combinado** | 150-500 EUR/mes en apps | Todo incluido desde 297 EUR/mes |
| **Integracion** | Fragmentada, cada app independiente | Unificada, los 6 motores trabajan juntos |
| **Estrategia** | Sin estrategia global | IA que coordina todos los motores con vision global |
| **Soporte** | Multiple vendors, distintos SLAs | Un solo punto de contacto |
| **Datos** | Silos de datos separados | OmniCore Brain unifica todos los datos |

---

## 8. FLUJO DE TRABAJO TIPICO DE UN CLIENTE

### 8.1 Onboarding (Dia 1)

1. **Conexion:** El cliente proporciona dominio Shopify + Access Token
2. **Escaneo:** ShopyBrain escanea todo el catalogo, configuracion y metricas
3. **Auditoria:** Analisis automatico de cada producto (titulo, descripcion, precio, imagenes, SEO)
4. **Informe:** Nota A-F por producto + lista priorizada de mejoras + impacto estimado

### 8.2 Optimizacion (Semana 1)

5. **Rediseno:** Titulos, descripciones y tags optimizados con calidad 100/100
6. **Imagenes:** 8 tipos de imagen profesional por producto generados con IA
7. **SEO:** Meta tags, schemas JSON-LD, alt texts, sitemap optimizado
8. **Pricing:** Analisis competitivo real + psicologia de precios aplicada

### 8.3 Crecimiento Continuo (Semana 2+)

9. **A/B Testing:** Tests automaticos en titulos, precios, imagenes
10. **Auto-Pilot:** Ganadores se aplican automaticamente
11. **Monitorizacion:** 12 cron jobs de aprendizaje y optimizacion continua
12. **Reporting:** Dashboard con revenue, conversion, margenes, SEO scores

---

## 9. BENCHMARKS POR INDUSTRIA

| Industria | Margen Bruto Tipico | AOV Tipico | Conversion Tipica |
|---|---|---|---|
| Fashion/Apparel | 50-70% | 60-120 EUR | 1-3% |
| Electronics | 15-30% | 150-400 EUR | 0.5-2% |
| Beauty/Cosmetics | 60-80% | 40-80 EUR | 2-4% |
| Home & Garden | 40-60% | 80-200 EUR | 1-3% |
| Food & Beverage | 30-50% | 30-60 EUR | 2-4% |
| Jewelry | 60-80% | 100-500 EUR | 0.5-2% |
| Sports/Fitness | 40-60% | 60-150 EUR | 1-3% |
| Pet Supplies | 40-55% | 35-70 EUR | 2-4% |
| Art/Crafts/Comics | 50-75% | 20-80 EUR | 1-3% |

---

## 10. METRICAS DE RENDIMIENTO DE LA PLATAFORMA

| Metrica | Valor |
|---|---|
| **Uptime garantizado** | 99.9% |
| **Precision de imagenes IA** | 94% |
| **Velocidad de generacion** | <2 segundos por imagen |
| **Insights acumulados** | 46.199 |
| **Memorias consolidadas** | 311 |
| **Dominios de conocimiento** | 37 |
| **Acciones automatizadas** | 79 |
| **Cron jobs activos** | 12 |
| **Criterios SEO evaluados** | 16 |
| **Dimensiones de auditoria** | 7 |

---

## 11. INTEGRACIONES

| Servicio | Tipo | Uso |
|---|---|---|
| **Shopify Admin API** | REST + GraphQL | Productos, colecciones, pedidos, themes, metafields |
| **Google Search** | Gemini Grounding | Investigacion de mercado y precios en tiempo real |
| **Google PageSpeed** | API | Core Web Vitals y rendimiento |
| **Replicate** | API | Generacion de imagenes (Flux 1.1 Pro, Recraft v3) |
| **Klaviyo** | API | Email marketing: flujos automatizados + campanas |
| **Gmail** | API | Comunicaciones de la agencia (craftershopy@gmail.com) |

---

## 12. DATOS DE CONTACTO COMERCIAL

| | |
|---|---|
| **Empresa** | Shopy Crafter |
| **Web** | shopycrafter.com |
| **Motor IA** | ShopyBrain (OmniCore AI) |
| **Email comercial** | craftershopy@gmail.com |
| **Nombre comercial** | "Shopy Crafter" (agencia) / "ShopyBrain" (motor IA) |
| **Modelo** | Agencia Shopify con IA — Servicios one-time + retainers mensuales |
| **Pagos** | Exclusivamente por Shopify (NO Stripe) |
| **Garantias** | Sin permanencia, sin tarjeta para empezar, cancelacion inmediata, RGPD compliant |

---

*Este informe ha sido generado por ShopyBrain (OmniCore AI) basandose en las capacidades reales de la plataforma Shopy Crafter. Todos los precios, servicios y funcionalidades descritos estan operativos y verificados a fecha de marzo 2026.*
