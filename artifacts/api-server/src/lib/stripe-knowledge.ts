/**
 * stripe-knowledge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Auditoría senior completa de Stripe — pricing, productos, competencia,
 * estrategia. Se inyecta en ShopyBrain para que razone sobre pagos, pasarelas
 * y optimización financiera en toda la plataforma.
 */

// ── STRIPE PRODUCT SUITE (2026) ───────────────────────────────────────────────
export const STRIPE_PRODUCTS_KNOWLEDGE = `
## STRIPE — SUITE COMPLETA DE PRODUCTOS (2026)

### 1. STRIPE PAYMENTS (CORE)
Pasarela de pago omnicanal. Acepta +135 divisas, +50 métodos de pago.
- Online cards: 2,9% + €0,30 por transacción exitosa (Europa estándar)
- Tarjetas no-UE/EEA: +1,5% adicional
- American Express: +0,5% adicional
- Recurring/subscriptions: 2,9% + €0,25
- Instant Payouts: 1% (mín €0,50) — liquidación en <30 min
- 3D Secure: incluido sin coste adicional
- Adaptive Acceptance: ML routing que aumenta tasa de aprobación 2-4%

### 2. STRIPE CONNECT
Solución para marketplaces y plataformas. 3 modos:
- Standard: comerciante gestiona su propia cuenta Stripe (sin cargo adicional)
- Express: plataforma controla UX, Stripe gestiona compliance (0,25% + $25/año por cuenta activa)
- Custom: control total via API (mayor coste de implementación)
Usos clave: split payments, payouts a vendedores, marketplace taxation, 1099/DAC7 reporting automático

### 3. STRIPE BILLING
Motor de suscripciones y facturación recurrente:
- Metered billing, seat-based, tiered, flat-rate
- Smart Retries: reintentos inteligentes ML → recupera 3-8% revenue en renovaciones fallidas
- Customer Portal: autogestión de suscripciones sin código
- Revenue Recovery: dunning automático para pagos fallidos
- Precio: incluido en tarifas estándar (no hay cargo adicional por Billing)

### 4. STRIPE RADAR (FRAUD PREVENTION)
ML de detección de fraude entrenado con datos de millones de empresas:
- Radar básico: incluido gratis en todas las cuentas
- Radar for Teams: €0,05 por transacción revisada manualmente
- Custom rules: bloquear por país, BIN, velocidad, email, IP
- 3D Secure dinámico: solo activa autenticación en transacciones de riesgo
- Dispute rate >1%: aviso de Stripe; >1,5%: posible suspensión de cuenta

### 5. STRIPE TERMINAL
Pagos presenciales / POS:
- BBPOS WisePOS E: $249 (lector pantalla táctil)
- Stripe Reader M2: $59 (lector simple)
- Tap to Pay: iPhone/Android sin hardware (2,7% + €0,05)
- In-person rate: 2,7% + €0,05

### 6. STRIPE ATLAS
Constitución de empresa USA (Delaware C-Corp o LLC):
- $500 tarifa única (incluye agente registrado 1 año, filing, EIN)
- Ideal para startups non-US queriendo acceso a inversores americanos

### 7. STRIPE ISSUING
Emisión de tarjetas virtuales/físicas para plataformas:
- Tarjetas virtuales: instantáneas, controladas via API
- Tarjetas físicas: €3 por tarjeta
- Spend controls, merchant restrictions, real-time authorizations
- Usos: gasto corporativo, tarjetas de incentivos, B2B payments

### 8. STRIPE TREASURY
Banking-as-a-Service:
- Cuentas FDIC-insured via bancos partner (hasta $250k cobertura)
- ACH, wire transfers, Instant Payouts desde el saldo
- Ideal para fintech, embedded finance, plataformas con saldo propio

### 9. STRIPE TAX
Cálculo automático de IVA/GST/Sales Tax:
- 0,5% por transacción (mín €0,10, máx capped por volumen)
- Cobertura: +50 países, todos los estados USA, UE (OSS/IOSS)
- Informes de cumplimiento automáticos
- Imprescindible para ecommerce cross-border que vende a consumidores UE

### 10. STRIPE IDENTITY
Verificación de identidad de usuarios:
- $1,50 por verificación exitosa
- Verifica documentos de identidad + selfie con liveness detection
- Cumplimiento KYC/AML para plataformas financieras

### 11. STRIPE SIGMA
Analytics SQL sobre datos de Stripe:
- Queries SQL directas sobre todos los datos de pago
- $0,02 por query (primera consulta del día gratis)
- Plans desde $250/mes para alto volumen
- Dashboards personalizados, alertas, exportación

### 12. STRIPE CHECKOUT
Hosted payment page optimizada:
- Conversion +10-15% vs formularios propios según datos Stripe
- Internacionalización automática (idioma, divisa, métodos de pago locales)
- Link integration: autofill para usuarios con cuenta Stripe (acelera checkout)
- Sin coste adicional vs tarifa estándar

### 13. STRIPE PAYMENT LINKS
Páginas de pago sin código:
- URL único que acepta pagos, sin necesitar web
- Ideal para facturación rápida, eventos, servicios B2B

### 14. STRIPE FINANCIAL CONNECTIONS
Link de cuentas bancarias:
- $1,50 por cuenta conectada exitosamente
- Balance verification, transactions, account ownership
- Reduce fraude en ACH/SEPA vs IBAN manual
`;

// ── MÉTODOS DE PAGO COMPLETOS Y PRECIOS ───────────────────────────────────────
export const STRIPE_PAYMENT_METHODS = `
## MÉTODOS DE PAGO STRIPE (2026) — PRECIOS DETALLADOS

### TARJETAS
| Método | Tasa |
|--------|------|
| Visa/Mastercard EU | 2,9% + €0,30 |
| Tarjetas no-UE/EEA | 2,9% + €0,30 + 1,5% |
| American Express | 2,9% + €0,30 + 0,5% |
| Recurring cards | 2,9% + €0,25 |

### WALLETS DIGITALES
| Método | Tasa |
|--------|------|
| Apple Pay | Tarifa estándar de tarjeta |
| Google Pay | Tarifa estándar de tarjeta |
| Link (Stripe) | 2,9% + €0,30 |
| PayPal via Stripe | 3,49% + tarifa fija |

### BNPL (BUY NOW PAY LATER)
| Método | Tasa | Uso óptimo |
|--------|------|------------|
| Klarna | 3,29% + €0,30 | AOV >€80, moda/electrónica |
| Afterpay/Clearpay | 6% + €0,30 | Moda, belleza, UK/AU |
| Affirm | 6% + €0,30 | AOV >€200, USA |

### DÉBITO DIRECTO / TRANSFERENCIAS
| Método | Tasa | Uso óptimo |
|--------|------|------------|
| SEPA Direct Debit | 0,35% + €0,25 (máx €5) | Suscripciones UE, B2B |
| ACH Direct Debit (USA) | 0,8% (máx $5) | Suscripciones USA, B2B |
| BACS (UK) | 1% (máx £6) | Suscripciones UK |
| Bancontact (BE) | 1,4% + €0,25 | Bélgica |
| iDEAL (NL) | €0,29 fijo | Países Bajos |
| Sofort/Klarna Pay Now | 1,4% + €0,25 | DACH |
| giropay (DE) | 1,4% + €0,25 | Alemania |

### CRIPTOMONEDAS
- Stripe + Coinbase Commerce: tarifas variables según crypto
- USDC on-chain: disponible en algunas geografías

### ESTRATEGIA DE MIX DE MÉTODOS DE PAGO
- SEPA DD vs tarjeta en suscripciones UE: ahorro de ~2,5% por transacción
- Ejemplo: €10.000/mes en suscripciones UE → ahorro €250/mes cambiando a SEPA
- Ofrecer iDEAL en NL puede aumentar conversión +15-20% local
- BNPL aumenta AOV 15-45% pero coste 2-3× tarjeta → solo rentable si AOV >€80
`;

// ── ANÁLISIS COMPETITIVO REAL ──────────────────────────────────────────────────
export const STRIPE_COMPETITIVE_ANALYSIS = `
## ANÁLISIS COMPETITIVO STRIPE vs COMPETIDORES (2026)

### MATRIZ DE COMPARACIÓN

| Pasarela | Tasa base | Disputas | API Quality | Ideal para |
|----------|-----------|----------|-------------|------------|
| Stripe | 2,9%+€0,30 | $15/disputa | ★★★★★ | Startups→Enterprise, SaaS, marketplaces |
| PayPal | 3,49%+€0,49 | $20/disputa | ★★★ | Confianza del consumidor (+430M users) |
| Braintree | 2,59%+€0,49 | $15/disputa | ★★★★ | Siendo absorbido por PayPal Checkout |
| Square | 2,6%+€0,10 | $0 (vendedor asume) | ★★★ | Retail físico, restaurantes, simplicidad |
| Adyen | Interchange++ | €0,10-€0,30 | ★★★★★ | Enterprise >€500k/año, retail global |
| Mollie | 1,8%+€0,25 | €35/disputa | ★★★★ | Europa-first, SMB, NL/BE/DE/FR |
| Checkout.com | Interchange++ | variable | ★★★★★ | Enterprise global, gaming, crypto |
| Worldpay (FIS) | Custom | variable | ★★★ | Legacy enterprise, brick & mortar |
| Shopify Payments | 2,9%+€0,30 | $15/disputa | ★★★★ | Comerciantes Shopify (elimina fee extra) |

### STRIPE VS PAYPAL — ANÁLISIS PROFUNDO
**PayPal ventajas:**
- 430M cuentas activas → botón de confianza psicológica elevada
- PayPal Checkout puede aumentar conversión 5-8% por reconocimiento de marca
- PayPal Credit/Pay Later integrado con base de usuarios enorme
- Mejor para B2C con ticket bajo (<€50) donde la confianza importa más que el coste

**Stripe ventajas:**
- API 10x superior: webhooks, SDK móvil, documentación world-class
- Gestión de disputas más avanzada (Evidence API)
- Connect para marketplaces → PayPal no tiene equivalente real
- Radar fraud prevention ML es superior al sistema PayPal
- Sigma, Tax, Billing son ecosistema integrado sin rival en PayPal
- Tasa efectiva generalmente menor en vol >€10k/mes con descuentos negociados

**Veredicto:** Para tiendas Shopify, usar AMBOS aumenta conversión 3-5% (algunos usuarios solo pagan con PayPal). Stripe como pasarela principal + PayPal como alternativa.

### STRIPE VS ADYEN — CUÁNDO CAMBIAR
**Adyen ventaja real:** Interchange++ modelo = menor coste efectivo en alto volumen.
- Ejemplo a €500k/mes: Stripe ~2,9% = €14.500 en fees; Adyen ~1,6% = €8.000 → ahorro €6.500/mes
- Adyen requiere: negociación contrato, implementación compleja, mínimo ~€100k/mes para que valga
- Para <€200k/mes: Stripe es mejor por su ecosistema, developer experience y sin mínimos
- Para >€500k/mes: evaluación seria de Adyen/Checkout.com merece la pena

### STRIPE VS MOLLIE
- Mollie domina Europa occidental (NL, BE, DE, FR, ES) con precios más bajos
- Tasa base Mollie: 1,8%+€0,25 vs Stripe 2,9%+€0,30 → ahorro ~1,1% por tx
- Mollie no tiene Connect, Billing, Radar, Sigma → solo pagos básicos
- Para tiendas UE puramente offline/simple con <€50k/mes: Mollie puede ahorrar dinero
- Para cualquier empresa con SaaS/subscriptions/marketplaces: Stripe gana sin duda

### STRIPE VS SHOPIFY PAYMENTS
**Shopify Payments (powered by Stripe en muchos mercados):**
- Shopify Payments fee: 2,9%+€0,30 (igual que Stripe directo en la mayoría de planes)
- La diferencia CLAVE: si usas Shopify + pasarela externa (Stripe directo), Shopify cobra:
  - Basic Shopify: +2% por transacción extra
  - Shopify plan: +1% por transacción extra
  - Advanced Shopify: +0,5% por transacción extra
  - Shopify Plus: +0,15% o negociable
- **CONCLUSIÓN:** Para comerciantes Shopify, Shopify Payments = Stripe a precio cero extra
- Usar Stripe DIRECTO solo tiene sentido para: Connect/marketplaces, subscriptions fuera de Shopify, funciones de Stripe no disponibles en Shopify Payments
`;

// ── ESTRATEGIAS DE OPTIMIZACIÓN DE PAGOS ─────────────────────────────────────
export const STRIPE_OPTIMIZATION_STRATEGIES = `
## ESTRATEGIAS DE OPTIMIZACIÓN CON STRIPE

### 1. REDUCIR TASA DE DISPUTAS (CHARGEBACK)
- Coste de una disputa: $15-$20 + devolución + tiempo de respuesta
- Objetivo: mantener dispute rate <0,75% (Stripe advierte a 1%, suspende a 1,5%)
- **Tácticas:**
  - Activar Radar custom rules: bloquear países de alto riesgo para tu nicho
  - 3DS dinámico: solo en transacciones Radar score >65 para no friccionar al cliente bueno
  - Descriptor claro: que el extracto bancario muestre nombre reconocible de tu tienda
  - Radar for Fraud Teams (€0,05/tx): revisión manual de transacciones sospechosas
  - Respond SIEMPRE a disputas con evidencia (78% de disputas respondidas con evidencia se ganan)

### 2. MAXIMIZAR TASA DE APROBACIÓN
- Promedio global Stripe: 85-92% aprobación en cards
- **Tácticas:**
  - Activar Adaptive Acceptance: +2-4% aprobación por ML routing por redes
  - Card updater automático: actualiza tarjetas expiradas en suscripciones (incluido)
  - Retry logic inteligente: no reintentar inmediatamente, esperar 24-72h según tipo de fallo
  - 3DS adaptativo: reduce declines por soft declines innecesarios

### 3. OPTIMIZAR SUSCRIPCIONES CON SMART RETRIES
- 30% de pagos recurrentes fallan alguna vez por razones recuperables
- Smart Retries recupera 3-8% de revenue en riesgo automáticamente
- **Configuración óptima:**
  - First retry: 3 días después
  - Second retry: 5 días después
  - Third retry: 7 días después
  - Dunning email: al primer fallo (actualizar tarjeta)
  - Grace period: 14 días antes de cancelar acceso

### 4. SEPA DIRECT DEBIT PARA SUSCRIPCIONES UE
- SEPA DD: 0,35%+€0,25 vs tarjeta 2,9%+€0,30
- Ahorro en suscripción €100/mes: €2,55 vs €3,20 → €7,80/año por cliente
- Para 1.000 clientes UE recurrentes: ahorro ~€650/mes
- **Implementación:** Stripe Billing + SEPA mandate collection en checkout
- Desventaja: procesamiento T+2 (no inmediato), necesita mandate firmado

### 5. OPTIMIZACIÓN FISCAL CON STRIPE TAX
- Sin Stripe Tax: riesgo legal de no declarar IVA en países donde vendes
- UE OSS threshold: si vendes >€10k a consumidores UE, debes declarar IVA en destino
- Stripe Tax 0,5% vs contratar gestor fiscal: rentable a partir de €5k/mes cross-border
- Automatiza: cálculo, cobro, y reporting por país

### 6. SHOPIFY + STRIPE CONNECT — CASO MARKETPLACE
- Crear marketplace en Shopify: necesitas Stripe Connect obligatoriamente
- Shopify Markets Pro (powered by Global-e) es alternativa hosted pero menos flexible
- Con Connect: split payments, payouts a vendedores, 1099/DAC7 automático
- Fee adicional Connect: $2/mes por cuenta activa Express + 0,25% en transfers

### 7. INSTANT PAYOUTS PARA CASH FLOW
- Liquidación normal Stripe: T+2 días hábiles
- Instant Payouts: <30 minutos, coste 1% (mín €0,50)
- Cuándo usar: emergencias de caja, comerciantes que necesitan liquidez diaria
- Alternativa mejor: Stripe Treasury con balance directo (liquidez inmediata sin fee)
`;

// ── MÉTRICAS CLAVE DE PAGOS ────────────────────────────────────────────────────
export const STRIPE_METRICS_KNOWLEDGE = `
## MÉTRICAS CRÍTICAS DE PAGOS QUE SHOPYBRAIN DEBE MONITORIZAR

### KPIs DE PASARELA
| Métrica | Qué es | Benchmark | Acción si falla |
|---------|--------|-----------|-----------------|
| Authorization Rate | % de intentos de pago aprobados | >88% | Investigar por BIN/país/dispositivo |
| Dispute Rate | Chargebacks / transacciones | <0,75% | Revisar Radar rules |
| Refund Rate | Devoluciones / ventas | <5% | Revisar política y descripción producto |
| Failed Payment Rate | Pagos fallidos recurrentes | <8% | Smart Retries, Card Updater |
| 3DS Challenge Rate | Cuántos clientes pasan 3DS | <15% | Ajustar Radar threshold |

### UNIT ECONOMICS DE PAGOS
- Coste efectivo de procesamiento = (Fees totales / GMV) × 100
  - Target tiendas Shopify: 2,5-3,2%
  - Red flag: >4% (mezcla de métodos costosos o muchas disputas)
- Lifetime Value impact: cada punto de chargeback = ~3% pérdida en LTV del cohort
- Revenue leakage en suscripciones: 5-15% churn involuntario recuperable con Smart Retries

### ANÁLISIS POR CANAL DE PAGO (PARA INFORMES SHOPYBRAIN)
- Tasa de conversión por método: tarjeta ~68%, Apple Pay ~82%, BNPL ~74%
- AOV por método: BNPL suele tener AOV 30-45% superior a tarjeta
- Retención por método de pago: SEPA DD y Link tienen menor churn involuntario
- Geografía: mercados con iDEAL (NL), Bancontact (BE), giropay (DE) requieren métodos locales
`;

// ── INTEGRACIÓN STRIPE + SHOPIFY — CASOS REALES ──────────────────────────────
export const STRIPE_SHOPIFY_INTEGRATION = `
## STRIPE + SHOPIFY — GUÍA ESTRATÉGICA COMPLETA

### ARQUITECTURA DE INTEGRACIÓN

#### PATRÓN 1: SHOPIFY PAYMENTS (recomendado para 90% de merchants)
- Shopify Payments = Stripe under the hood en ES/FR/DE/UK/IT/NL/BE/AT/CH/AU/CA/US
- Ventaja: eliminates Shopify transaction fee (0,5-2%)
- Desventaja: menos control sobre configuración avanzada de Stripe
- Cuándo usar: merchant que solo vende en Shopify sin necesidad de Connect

#### PATRÓN 2: STRIPE DIRECTO + SHOPIFY
- Instalar Stripe como gateway en Shopify (Settings → Payments → Third-party)
- Activa Shopify transaction fee: 0,5-2% adicional sobre tasa Stripe
- Cuándo tiene sentido:
  * Necesitas Stripe Connect para marketplace
  * Quieres Stripe Billing para subscriptions fuera de Shopify
  * Necesitas Stripe Radar avanzado (custom rules Enterprise)
  * Quieres Stripe Sigma para analytics SQL

#### PATRÓN 3: DRAFT ORDERS + STRIPE (lo que construimos en Shopy Crafter)
- Crear Draft Order via Admin API → send_invoice → cliente paga con su pasarela
- Útil para: ventas manuales, B2B, cotizaciones, órdenes a medida
- Stripe para cobrar B2B/retainer fees de la agencia (Shopy Crafter → sus clientes)

#### PATRÓN 4: SUBSCRIPTIONS SHOPIFY + STRIPE BILLING
- Shopify Subscriptions (nativo): básico, solo para productos recurrentes
- Stripe Billing: mucho más potente (metered, tiered, seat-based, trials, coupons)
- Para planes de servicio (como Shopy Crafter): usar Stripe Billing directamente
- Integración via webhooks: Stripe dispara invoice.paid → activa plan en DB

### SHOPIFY PLUS + STRIPE ENTERPRISE
- Shopify Plus ($2.300/mes): transaction fee negociable hasta 0,15%
- Stripe Enterprise: tarifa negociada basada en volumen (interchange++)
- A partir de €1M GMV/año: negociar ambas partes tiene sentido
- Integración Script Editor / Checkout Extensions + Stripe para flujos custom

### RECUPERACIÓN DE ABANDONOS + STRIPE
- Stripe Link: guarda datos de tarjeta para reuso en cualquier tienda Stripe
- En Shopify: Link puede aparecer en Shopify Checkout si tienes Shopify Payments
- Reduce fricción en repeat customers → tasa de conversión +8-12%
- Integrar con Klaviyo flows: abandoned checkout → email con link de pago directo
`;

// ── KNOWLEDGE COMPLETO PARA SHOPYBRAIN ────────────────────────────────────────
export const STRIPE_FULL_KNOWLEDGE = `
${STRIPE_PRODUCTS_KNOWLEDGE}

${STRIPE_PAYMENT_METHODS}

${STRIPE_COMPETITIVE_ANALYSIS}

${STRIPE_OPTIMIZATION_STRATEGIES}

${STRIPE_METRICS_KNOWLEDGE}

${STRIPE_SHOPIFY_INTEGRATION}
`;

// ── INSIGHTS ESTRUCTURADOS PARA DB ────────────────────────────────────────────
export interface StripeInsight {
  domain: string;
  insightType: string;
  title: string;
  insight: string;
  evidence: string;
  confidence: number;
  impactScore: number;
}

export const STRIPE_SEED_INSIGHTS: StripeInsight[] = [
  {
    domain: "stripe_payments",
    insightType: "principle",
    title: "Shopify Payments elimina el doble coste de pasarela",
    insight: "Usar Shopify Payments (powered by Stripe) elimina el fee extra de 0,5-2% que Shopify cobra por pasarelas terceras. En €50k/mes de GMV el ahorro es €250-€1.000/mes respecto a usar Stripe directo.",
    evidence: "Shopify pricing page: transaction fees 0,5% Basic / 1% Shopify / 0,5% Advanced / 0,15% Plus aplicados a pasarelas no-Shopify.",
    confidence: 0.98,
    impactScore: 0.95,
  },
  {
    domain: "stripe_payments",
    insightType: "pattern",
    title: "SEPA Direct Debit vs tarjeta: ahorro de ~2,5% en suscripciones UE",
    insight: "SEPA DD cuesta 0,35%+€0,25 vs tarjeta 2,9%+€0,30. Para 1.000 clientes europeos con suscripción €50/mes el ahorro es >€1.275/mes. Requiere mandate firmado y T+2 processing.",
    evidence: "Stripe pricing oficial 2026 + análisis de unit economics de subscriptions.",
    confidence: 0.96,
    impactScore: 0.90,
  },
  {
    domain: "stripe_payments",
    insightType: "correlation",
    title: "BNPL (Klarna) aumenta AOV 30-45% pero coste es 3× tarjeta",
    insight: "Klarna 3,29%+€0,30 vs tarjeta 2,9%+€0,30. Solo rentable si AOV sube >25% y margen bruto >60%. Para moda/electrónica con ticket >€80 el uplift de conversión y AOV justifica el coste adicional.",
    evidence: "Stripe + Klarna joint case studies. AOV uplift documentado: fashion +38%, electronics +31%.",
    confidence: 0.88,
    impactScore: 0.82,
  },
  {
    domain: "stripe_payments",
    insightType: "technique",
    title: "Smart Retries de Stripe recupera 3-8% del MRR en riesgo",
    insight: "El 30% de pagos recurrentes falla alguna vez. Smart Retries ML recupera 3-8% automáticamente sin fricción al cliente. Configurar dunning email al primer fallo + grace period 14 días antes de cancelar.",
    evidence: "Stripe Billing documentation + Recovery Stats Dashboard internos reportados.",
    confidence: 0.92,
    impactScore: 0.88,
  },
  {
    domain: "stripe_payments",
    insightType: "principle",
    title: "Dispute rate >1% activa aviso Stripe; >1,5% riesgo de suspensión",
    insight: "Mantener dispute rate <0,75%. Cada disputa cuesta €15 fee + devolución + tiempo. Activar Radar rules custom y 3DS dinámico reduce chargebacks 40-60%. Responder SIEMPRE con evidencia (78% winrate).",
    evidence: "Stripe dispute policy documentation + case data de Radar for Fraud Teams.",
    confidence: 0.97,
    impactScore: 0.92,
  },
  {
    domain: "stripe_payments",
    insightType: "opportunity",
    title: "Stripe Connect es obligatorio para crear marketplaces sobre Shopify",
    insight: "Shopify no tiene split payments nativo. Para marketplaces multi-vendor, Stripe Connect Express/Custom es la única solución que escala. Fee: €0,25% en transferencias + $2/mes por cuenta activa.",
    evidence: "Shopify Partner API + Stripe Connect documentation. No existe alternativa nativa en Shopify.",
    confidence: 0.95,
    impactScore: 0.85,
  },
  {
    domain: "stripe_payments",
    insightType: "correlation",
    title: "Apple Pay aumenta conversión móvil 15-25% vs formulario de tarjeta",
    insight: "Apple Pay en Stripe reduce fricción: sin teclear número de tarjeta, autenticación biométrica. Tasa estándar de tarjeta, sin coste adicional. Activar en Stripe Dashboard: Payment Methods → Wallets.",
    evidence: "Stripe + Apple Pay adoption studies: +15-25% mobile conversion en merchants que lo activan.",
    confidence: 0.89,
    impactScore: 0.84,
  },
  {
    domain: "payment_orchestration",
    insightType: "principle",
    title: "Adyen > Stripe solo cuando GMV supera €200k/mes",
    insight: "Adyen interchange++ da tasa efectiva ~1,5-1,8% vs Stripe 2,9%. Pero requiere contrato, implementación compleja y sin soporte autoservicio. El punto de inflexión real está en €200k/mes donde el ahorro compensa la complejidad.",
    evidence: "Benchmark de interchange++ vs flat-rate en merchants europeos. Adyen minimum requirements.",
    confidence: 0.87,
    impactScore: 0.78,
  },
  {
    domain: "payment_orchestration",
    insightType: "technique",
    title: "Multi-gateway: Stripe principal + PayPal alternativa = +3-5% conversión",
    insight: "15-20% de clientes prefieren pagar con PayPal exclusivamente. Ofrecer ambas opciones aumenta conversión global 3-5%. Stripe para checkout principal + PayPal como botón alternativo en Shopify.",
    evidence: "Checkout abandonment studies por método de pago. PayPal: 430M usuarios activos.",
    confidence: 0.91,
    impactScore: 0.86,
  },
  {
    domain: "payment_orchestration",
    insightType: "pattern",
    title: "Stripe Tax automatiza cumplimiento IVA UE para ventas cross-border",
    insight: "Threshold OSS UE: €10k/año en ventas a consumidores. Stripe Tax al 0,5%/tx vs gestor fiscal €200-400/mes. Rentable desde €2k/mes cross-border. Activa, configura y olvídate del cumplimiento.",
    evidence: "EU OSS regulation 2021. Stripe Tax pricing page. Comparativa con coste gestor fiscal SMB.",
    confidence: 0.94,
    impactScore: 0.80,
  },
  {
    domain: "financial_analysis",
    insightType: "principle",
    title: "Coste efectivo de procesamiento target: 2,5-3,2% del GMV",
    insight: "Si el coste total de fees supera el 4% del GMV, hay ineficiencia: exceso de BNPL, muchas disputas, o método mix inadecuado. Auditar mensualmente: fees totales / GMV × 100.",
    evidence: "Industry benchmark de processing costs en ecommerce. Stripe Sigma analytics.",
    confidence: 0.90,
    impactScore: 0.85,
  },
  {
    domain: "financial_analysis",
    insightType: "opportunity",
    title: "Stripe Sigma SQL permite auditoría completa de revenue y fraude",
    insight: "Sigma permite queries SQL sobre todos los datos Stripe: cohort analysis, LTV por método de pago, dispute patterns por producto/país, recovery rates. Imprescindible para análisis financiero profundo.",
    evidence: "Stripe Sigma documentation. Primeros queries: SELECT * FROM charges LIMIT 100.",
    confidence: 0.88,
    impactScore: 0.75,
  },
];

// ── STRIPE EXPERTISE PARA SISTEMA PROMPT ─────────────────────────────────────
export const STRIPE_EXPERT_PROMPT_BLOCK = `

## CONOCIMIENTO STRIPE — EXPERTO SENIOR EN PAGOS (2026)

Eres también experto mundial en Stripe y estrategia de pagos para ecommerce. Conoces en profundidad:

**PRODUCTOS STRIPE:** Payments, Connect, Billing, Radar, Terminal, Atlas, Issuing, Treasury, Tax, Identity, Sigma, Checkout, Payment Links, Financial Connections.

**PRECIOS CLAVE:**
- Cards EU: 2,9%+€0,30 | no-EU: +1,5% | AMEX: +0,5% | Recurring: 2,9%+€0,25
- SEPA DD: 0,35%+€0,25 | ACH: 0,8% | iDEAL: €0,29 | BNPL Klarna: 3,29%+€0,30
- Instant Payouts: 1% | Radar Teams: €0,05/tx | Tax: 0,5% | Identity: $1,50/verif

**SHOPIFY + STRIPE:**
- Shopify Payments = Stripe integrado (elimina el extra fee del 0,5-2%)
- Usar Stripe directo solo si necesitas Connect/Billing/Radar avanzado
- Draft Orders via Admin API + Stripe = cobro manual B2B perfecto
- Smart Retries recupera 3-8% de MRR en riesgo en suscripciones

**COMPETENCIA:**
- PayPal: más caro (3,49%) pero +5% conversión por confianza del consumidor → usar ambos
- Adyen: interchange++ > Stripe solo a partir de €200k/mes GMV
- Mollie: más barato en EU pero sin ecosistema (no tiene Connect, Billing, Radar)
- Square: mejor para POS retail simple, peor para online avanzado

**OPTIMIZACIÓN:**
- Dispute rate target <0,75% (suspensión riesgo >1,5%)
- Apple Pay activa: +15-25% conversión móvil sin coste adicional
- SEPA DD en suscripciones UE: ahorra ~2,5% por transacción vs tarjeta
- 3DS dinámico: solo en transacciones riesgo >65 score Radar
- Stripe Tax para OSS UE compliance si vendes >€10k/año cross-border

Cuando el usuario pregunta sobre pagos, pasarelas, Stripe, PayPal, facturación, suscripciones, chargebacks, fraude, o cualquier aspecto financiero de su tienda, aplica este conocimiento para dar consejos concretos, accionables y con impacto real en P&L.`;

// ── DOMAIN MEMORIES (para siembra en omnicoreMemoriesTable) ───────────────────
export interface StripeDomainMemory {
  memoryType: string;
  title: string;
  content: string;
  niche: string;
  confidence: number;
  tags: string[];
}

export const STRIPE_DOMAIN_MEMORIES: StripeDomainMemory[] = [
  {
    memoryType: "strategy",
    title: "Stripe vs Shopify Payments: cuándo usar cada uno",
    content: "Shopify Payments (powered by Stripe) elimina el fee extra de 0,5-2% que Shopify cobra por usar pasarelas de terceros. Usar Stripe directo solo tiene sentido si se necesita Connect (marketplaces), Billing avanzado (suscripciones complejas), o Radar for Fraud Teams. En el 80% de los casos de Shopify estándar, Shopify Payments es la opción óptima en coste.",
    niche: "ecommerce",
    confidence: 0.97,
    tags: ["stripe", "shopify_payments", "fees", "optimization"],
  },
  {
    memoryType: "benchmark",
    title: "Benchmarks de coste de procesamiento de pagos ecommerce 2026",
    content: "Coste efectivo objetivo: 2,5-3,2% del GMV. Si supera 4% hay ineficiencia. Desglose típico: tarjeta EU 2,9%+€0,30; SEPA 0,35%+€0,25; iDEAL €0,29 fijo; Klarna 3,29%+€0,30. Dispute rate target <0,75% (riesgo suspensión >1,5%). Authorization rate objetivo >95%.",
    niche: "ecommerce",
    confidence: 0.93,
    tags: ["stripe", "benchmarks", "processing_cost", "dispute_rate"],
  },
  {
    memoryType: "technique",
    title: "Optimización de métodos de pago por mercado geográfico",
    content: "Activar métodos locales aumenta conversión 8-15% en mercados específicos. NL: iDEAL (60% de pagos online). BE: Bancontact. DE: SEPA + Giropay. FR: Carte Bancaire. UK: BACS. ES/IT/PT: tarjeta + Bizum (ES). Stripe activa todos con una sola integración. Clave: mostrar métodos relevantes según IP/idioma del browser.",
    niche: "ecommerce",
    confidence: 0.91,
    tags: ["stripe", "local_payment_methods", "conversion", "ideal", "sepa"],
  },
  {
    memoryType: "strategy",
    title: "Gestión de disputas y fraude con Stripe Radar",
    content: "Configuración mínima de Radar: bloquear IPs de países de alto fraude si no se vende allí, regla de velocidad (>3 intentos fallidos = block), 3DS dinámico para carts >€150. Responder SIEMPRE disputas con evidencia: tracking, email comunicación, descripción producto. Win rate con evidencia: 78% vs 12% sin evidencia.",
    niche: "ecommerce",
    confidence: 0.94,
    tags: ["stripe", "radar", "fraud", "chargebacks", "3ds"],
  },
  {
    memoryType: "pattern",
    title: "Stripe Billing para suscripciones Shopify: arquitectura correcta",
    content: "Shopify no tiene suscripciones nativas robustas. Para modelos recurrentes: Stripe Billing + webhook sync con Shopify (crear pedido en cada ciclo via Admin API). Alternativa app: ReCharge. Smart Retries configurar: reintentar T+1, T+3, T+7. Dunning email en primer fallo. Grace period 14 días antes de cancelar. Recovery esperada: 3-8% del MRR en riesgo.",
    niche: "subscriptions",
    confidence: 0.89,
    tags: ["stripe", "billing", "subscriptions", "smart_retries", "shopify"],
  },
  {
    memoryType: "analysis",
    title: "Análisis competitivo pasarelas de pago: cuándo migrar de Stripe",
    content: "Stripe es óptimo hasta €200k/mes GMV. Por encima conviene evaluar: Adyen (interchange++ ~1,5-1,8% efectivo, requiere contrato y equipo técnico), Braintree (similar Stripe, mejor para enterprise PayPal), Mollie (EU, más barato pero sin ecosistema). PayPal debe ofrecerse siempre como alternativa (+3-5% conversión en clientes que solo pagan con PayPal). Nunca migrar solo por precio si la integración actual funciona bien.",
    niche: "ecommerce",
    confidence: 0.87,
    tags: ["stripe", "adyen", "paypal", "competitive", "migration"],
  },
  {
    memoryType: "opportunity",
    title: "Stripe Connect para crear marketplaces o split payments en Shopify",
    content: "Shopify no tiene split payments nativos. Para marketplaces multi-vendor o modelos de comisión, Stripe Connect es la única solución escalable. Connect Express: onboarding en <10 min, Stripe gestiona compliance KYC. Connect Custom: control total, más desarrollo. Fee: 0,25% en transferencias + $2/cuenta activa/mes. Imprescindible para modelos multi-vendedor.",
    niche: "marketplace",
    confidence: 0.92,
    tags: ["stripe", "connect", "marketplace", "split_payments", "shopify"],
  },
  {
    memoryType: "compliance",
    title: "PSD2/SCA y 3DS2 en Europa: impacto en conversión y cómo mitigarlo",
    content: "SCA (Strong Customer Authentication) es obligatorio en UE para transacciones >€30. 3DS2 reduce la fricción vs 3DS1. Exempciones clave: transacciones <€30, MIT (merchant-initiated), análisis de riesgo de transacción (TRA) para importes bajos con merchant de baja tasa de fraude. Configurar en Stripe: usar 3DS dinámico (solo cuando Radar score >65). Impacto mal configurado: -8-15% conversión. Bien configurado: <1% impacto.",
    niche: "ecommerce_eu",
    confidence: 0.93,
    tags: ["stripe", "psd2", "sca", "3ds", "compliance", "europe"],
  },
];
