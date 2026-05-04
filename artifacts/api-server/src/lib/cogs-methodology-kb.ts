// ═══════════════════════════════════════════════════════════════════════════
// COGS METHODOLOGY KNOWLEDGE BASE (May 2026)
// ═══════════════════════════════════════════════════════════════════════════
// Crystallized from: "Guía Completa para Replit — Cómo Crear Estimaciones
// COGS, Comparativas de Proveedores, PDFs, Excels y PowerPoints
// Profesionales" + Hotel/Wine/AI Platform COGS Excel references.
//
// This module provides the METHODOLOGY and RULES that the XLSX/PPTX/dead-cost
// generators follow. It is deterministic (no AI calls) and serves as:
//   1) Quality checklist for generated reports
//   2) Structural template for Excel/PowerPoint creation
//   3) Hidden cost taxonomy for dead cost analysis
//   4) TCO (Total Cost of Ownership) framework for supplier comparison
//   5) Design rules for professional output
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// 1. COGS METHODOLOGY — 7 Pillars of Logic
// ───────────────────────────────────────────────────────────────────────────

export interface MethodologyPillar {
  pillar: number;
  id: string;
  name: string;
  spanishName: string;
  description: string;
  spanishDescription: string;
  implementation: string;
}

export const COGS_METHODOLOGY_PILLARS: MethodologyPillar[] = [
  { pillar: 1, id: "mp:transparency", name: "Transparency", spanishName: "Transparencia",
    description: "All formulas and assumptions must be visible and editable",
    spanishDescription: "Todas las fórmulas y suposiciones deben estar visibles y ser editables",
    implementation: "ASSUMPTIONS sheet with yellow-highlighted input cells, all calculations reference these cells" },
  { pillar: 2, id: "mp:realism", name: "Realism", spanishName: "Realismo",
    description: "Use real market data (2026 prices, known suppliers)",
    spanishDescription: "Usar datos de mercado reales (precios 2026, proveedores conocidos)",
    implementation: "Source prices from Gemini web search, validate against category benchmarks, timestamp data" },
  { pillar: 3, id: "mp:variability", name: "Variability", spanishName: "Variabilidad",
    description: "Always show ranges (Low / Average / High)",
    spanishDescription: "Siempre mostrar rangos (Bajo / Promedio / Alto)",
    implementation: "Three-column layout for every cost item: optimistic, realistic, pessimistic scenarios" },
  { pillar: 4, id: "mp:practical_utility", name: "Practical Utility", spanishName: "Utilidad práctica",
    description: "Include actionable recommendations + estimated savings",
    spanishDescription: "Incluir recomendaciones accionables + ahorro estimado",
    implementation: "Every report ends with Top-5 recommendations, each with €XX potential savings and timeline" },
  { pillar: 5, id: "mp:scalability", name: "Scalability", spanishName: "Escalabilidad",
    description: "Design for easy modification",
    spanishDescription: "Diseñar para que se pueda modificar fácilmente",
    implementation: "Parametric models where changing one input recalculates everything downstream" },
  { pillar: 6, id: "mp:professionalism", name: "Professionalism", spanishName: "Profesionalismo",
    description: "Clean format, corporate colors, no errors",
    spanishDescription: "Formato limpio, colores corporativos, sin errores",
    implementation: "Consistent color scheme, proper number formatting, spell-checked, version-stamped" },
  { pillar: 7, id: "mp:completeness", name: "Completeness", spanishName: "Completitud",
    description: "Include hidden costs (breakage, cold storage, labor, space, etc.)",
    spanishDescription: "Incluir costes ocultos (rotura, frío, personal, espacio, etc.)",
    implementation: "Minimum 8-10 hidden cost categories analyzed per product/category" },
];

// ───────────────────────────────────────────────────────────────────────────
// 2. HIDDEN COST CATEGORIES — Comprehensive taxonomy
// ───────────────────────────────────────────────────────────────────────────

export interface HiddenCostCategory {
  id: string;
  name: string;
  spanishName: string;
  description: string;
  typicalPctOfCogs: [number, number];
  applicableSectors: string[];
  calculationFormula: string;
}

export const HIDDEN_COST_CATEGORIES: HiddenCostCategory[] = [
  { id: "hc:breakage_shrinkage", name: "Breakage / Shrinkage", spanishName: "Rotura / Merma",
    description: "Product loss from damage, theft, or natural deterioration",
    typicalPctOfCogs: [3, 8], applicableSectors: ["food", "beverages", "fragile_goods", "fashion"],
    calculationFormula: "totalInventoryValue × breakageRate (3-8%)" },
  { id: "hc:cold_storage", name: "Cold Storage", spanishName: "Almacenamiento en frío",
    description: "Refrigeration and climate-controlled storage costs",
    typicalPctOfCogs: [2, 6], applicableSectors: ["food", "beverages", "pharma", "cosmetics"],
    calculationFormula: "unitsStored × coldStorageCostPerUnit/month × months" },
  { id: "hc:proportional_labor", name: "Proportional Labor", spanishName: "Personal proporcional",
    description: "Staff cost allocated per product/category handling",
    typicalPctOfCogs: [5, 15], applicableSectors: ["all"],
    calculationFormula: "totalLaborCost × (categoryHandlingTime / totalHandlingTime)" },
  { id: "hc:space_occupancy", name: "Space Occupancy", spanishName: "Ocupación de espacio",
    description: "Warehouse/shelf space cost proportional to product footprint",
    typicalPctOfCogs: [2, 8], applicableSectors: ["all"],
    calculationFormula: "totalRentCost × (productM2 / totalM2)" },
  { id: "hc:opportunity_cost", name: "Opportunity Cost", spanishName: "Coste de oportunidad",
    description: "Capital tied up in slow-moving inventory that could be invested elsewhere",
    typicalPctOfCogs: [3, 12], applicableSectors: ["all"],
    calculationFormula: "inventoryValue × annualReturnRate × (daysInStock / 365)" },
  { id: "hc:special_taxes", name: "Special Taxes", spanishName: "Impuestos especiales",
    description: "Sector-specific taxes (alcohol, tobacco, sugar, carbon)",
    typicalPctOfCogs: [5, 30], applicableSectors: ["alcohol", "tobacco", "beverages", "fuel"],
    calculationFormula: "unitsPerYear × taxPerUnit (sector-specific)" },
  { id: "hc:returns_logistics", name: "Returns & Reverse Logistics", spanishName: "Devoluciones y logística inversa",
    description: "Cost of processing returns, restocking, and write-offs",
    typicalPctOfCogs: [5, 25], applicableSectors: ["fashion", "electronics", "ecommerce"],
    calculationFormula: "totalSales × returnRate × (shippingCost + restockingLabor + writeOffPct × unitCost)" },
  { id: "hc:marketing_training", name: "Marketing & Training", spanishName: "Marketing y formación",
    description: "Product-specific marketing spend and staff training costs",
    typicalPctOfCogs: [2, 10], applicableSectors: ["all"],
    calculationFormula: "totalMarketingBudget × (productRevenue / totalRevenue) + trainingCostAllocated" },
  { id: "hc:quality_control", name: "Quality Control", spanishName: "Control de calidad",
    description: "Inspection, testing, and certification costs",
    typicalPctOfCogs: [1, 5], applicableSectors: ["food", "pharma", "electronics", "luxury"],
    calculationFormula: "inspectionCostPerBatch × batchesPerYear + certificationFees" },
  { id: "hc:insurance", name: "Insurance", spanishName: "Seguros",
    description: "Product liability, transit, and storage insurance",
    typicalPctOfCogs: [0.5, 3], applicableSectors: ["all"],
    calculationFormula: "inventoryValue × insuranceRate + transitInsurance" },
  { id: "hc:currency_fluctuation", name: "Currency Fluctuation", spanishName: "Fluctuación de divisa",
    description: "Exchange rate risk on imported goods",
    typicalPctOfCogs: [1, 8], applicableSectors: ["import_heavy", "fashion", "electronics"],
    calculationFormula: "importValue × historicalVolatilityPct" },
  { id: "hc:obsolescence_depreciation", name: "Obsolescence / Depreciation", spanishName: "Obsolescencia / Depreciación",
    description: "Value loss over time for perishable, seasonal, or tech products",
    typicalPctOfCogs: [2, 20], applicableSectors: ["tech", "fashion", "food", "seasonal"],
    calculationFormula: "inventoryValue × monthlyDepreciationRate × avgMonthsInStock" },
];

// ───────────────────────────────────────────────────────────────────────────
// 3. TCO METHODOLOGY — Total Cost of Ownership for supplier comparison
// ───────────────────────────────────────────────────────────────────────────

export interface TcoComponent {
  id: string;
  name: string;
  spanishName: string;
  weight: number;
  description: string;
}

export const TCO_COMPONENTS: TcoComponent[] = [
  { id: "tco:unit_price", name: "Unit Price", spanishName: "Precio unitario", weight: 0.30,
    description: "Base purchase price per unit" },
  { id: "tco:transport", name: "Transport & Logistics", spanishName: "Transporte y logística", weight: 0.15,
    description: "Shipping cost, customs, import duties" },
  { id: "tco:quality", name: "Quality Score", spanishName: "Puntuación de calidad", weight: 0.15,
    description: "Product quality rating (1-10), defect rate, consistency" },
  { id: "tco:reliability", name: "Reliability", spanishName: "Fiabilidad", weight: 0.10,
    description: "On-time delivery rate, order accuracy, communication quality" },
  { id: "tco:volume_discount", name: "Volume Discount", spanishName: "Descuento por volumen", weight: 0.10,
    description: "Discount tiers based on order quantity" },
  { id: "tco:min_order", name: "Minimum Order", spanishName: "Pedido mínimo", weight: 0.05,
    description: "Minimum order quantity impact on cash flow" },
  { id: "tco:lead_time", name: "Lead Time", spanishName: "Tiempo de entrega", weight: 0.05,
    description: "Days from order to delivery" },
  { id: "tco:payment_terms", name: "Payment Terms", spanishName: "Condiciones de pago", weight: 0.05,
    description: "Net 30/60/90, early payment discounts" },
  { id: "tco:service_support", name: "Service & Support", spanishName: "Servicio y soporte", weight: 0.05,
    description: "After-sales support, returns handling, responsiveness" },
];

export interface SupplierScenario {
  id: string;
  name: string;
  spanishName: string;
  volumeMultiplier: number;
  description: string;
}

export const SUPPLIER_SCENARIOS: SupplierScenario[] = [
  { id: "scen:low", name: "Low Volume", spanishName: "Volumen bajo", volumeMultiplier: 0.5,
    description: "Starting or niche operation with minimal order quantities" },
  { id: "scen:medium", name: "Medium Volume", spanishName: "Volumen medio", volumeMultiplier: 1.0,
    description: "Standard operation at current projected volumes" },
  { id: "scen:high", name: "High Volume", spanishName: "Volumen alto", volumeMultiplier: 2.0,
    description: "Scaled operation with volume discount activation" },
];

// ───────────────────────────────────────────────────────────────────────────
// 4. EXCEL DESIGN RULES — Color coding and structure standards
// ───────────────────────────────────────────────────────────────────────────

export interface ExcelColorRule {
  color: string;
  hex: string;
  meaning: string;
  spanishMeaning: string;
}

export const EXCEL_COLOR_RULES: ExcelColorRule[] = [
  { color: "Yellow", hex: "#FFFF00", meaning: "Editable input cell", spanishMeaning: "Celda de entrada editable" },
  { color: "Blue", hex: "#4472C4", meaning: "Formula / calculated value", spanishMeaning: "Fórmula / valor calculado" },
  { color: "Green", hex: "#70AD47", meaning: "Best option / positive result", spanishMeaning: "Mejor opción / resultado positivo" },
  { color: "Red", hex: "#FF0000", meaning: "Alert / negative result / warning", spanishMeaning: "Alerta / resultado negativo / advertencia" },
  { color: "Gray", hex: "#D9D9D9", meaning: "Reference / informational", spanishMeaning: "Referencia / informativo" },
  { color: "Orange", hex: "#ED7D31", meaning: "Caution / review needed", spanishMeaning: "Precaución / requiere revisión" },
];

export interface ExcelSheetStructure {
  order: number;
  name: string;
  spanishName: string;
  purpose: string;
  isRequired: boolean;
}

export const EXCEL_STANDARD_STRUCTURE: ExcelSheetStructure[] = [
  { order: 1, name: "Assumptions", spanishName: "Supuestos", purpose: "All editable inputs in yellow cells — the most important sheet", isRequired: true },
  { order: 2, name: "COGS by Category", spanishName: "COGS por Categoría", purpose: "Detailed cost breakdown with Low/Average/High ranges", isRequired: true },
  { order: 3, name: "Revenue & Margins", spanishName: "Ingresos y Márgenes", purpose: "Revenue projections, margin calculations, break-even", isRequired: true },
  { order: 4, name: "Scenarios", spanishName: "Escenarios", purpose: "Conservative / Realistic / Optimistic projections", isRequired: false },
  { order: 5, name: "Dashboard", spanishName: "Dashboard", purpose: "Visual KPIs with 2-3 charts (bar, pie, line)", isRequired: false },
  { order: 6, name: "Executive Summary", spanishName: "Resumen Ejecutivo", purpose: "1-page summary with recommendations + estimated savings", isRequired: true },
];

// ───────────────────────────────────────────────────────────────────────────
// 5. PPTX STRUCTURE GUIDE — Ideal slide deck architecture
// ───────────────────────────────────────────────────────────────────────────

export interface PptxSlideTemplate {
  slideNumber: number;
  name: string;
  spanishName: string;
  content: string;
  isRequired: boolean;
}

export const PPTX_IDEAL_STRUCTURE: PptxSlideTemplate[] = [
  { slideNumber: 1, name: "Cover", spanishName: "Portada", content: "Title + subtitle + date + brand", isRequired: true },
  { slideNumber: 2, name: "Executive Summary", spanishName: "Resumen Ejecutivo", content: "3-5 key findings in bullet points", isRequired: true },
  { slideNumber: 3, name: "Current vs Target", spanishName: "Situación actual vs Objetivo", content: "Two-column comparison", isRequired: true },
  { slideNumber: 4, name: "Methodology", spanishName: "Metodología", content: "Brief explanation of approach (1 slide max)", isRequired: false },
  { slideNumber: 5, name: "Supplier Analysis 1", spanishName: "Análisis Proveedores 1", content: "Category comparison with TCO", isRequired: true },
  { slideNumber: 6, name: "Supplier Analysis 2", spanishName: "Análisis Proveedores 2", content: "Ranking table + visual comparison", isRequired: false },
  { slideNumber: 7, name: "Hidden Costs", spanishName: "Costes Ocultos", content: "Identified hidden costs with values", isRequired: true },
  { slideNumber: 8, name: "Optimization Strategies", spanishName: "Estrategias de Optimización", content: "Top 5-7 strategies with expected impact", isRequired: true },
  { slideNumber: 9, name: "90-Day Action Plan", spanishName: "Plan de Acción 90 Días", content: "Visual timeline with milestones", isRequired: true },
  { slideNumber: 10, name: "Savings & ROI", spanishName: "Ahorro y ROI", content: "Projected savings and return on optimization", isRequired: true },
  { slideNumber: 11, name: "Recommendation", spanishName: "Recomendación Final", content: "Clear recommendation + next steps", isRequired: true },
  { slideNumber: 12, name: "Appendix", spanishName: "Anexos", content: "Supporting data tables (if needed)", isRequired: false },
];

// ───────────────────────────────────────────────────────────────────────────
// 6. QUALITY CHECKLIST — 9-point validation
// ───────────────────────────────────────────────────────────────────────────

export interface QualityCheckItem {
  id: string;
  check: string;
  spanishCheck: string;
  category: "data" | "formatting" | "content" | "validation";
  severity: "critical" | "important" | "recommended";
}

export const QUALITY_CHECKLIST: QualityCheckItem[] = [
  { id: "qc:yellow_inputs", category: "formatting", severity: "critical",
    check: "All input cells are highlighted in YELLOW",
    spanishCheck: "Todas las celdas de input están en AMARILLO" },
  { id: "qc:cell_references", category: "data", severity: "critical",
    check: "All formulas use cell references (no hardcoded numbers)",
    spanishCheck: "Todas las fórmulas usan referencias a celdas (no números fijos)" },
  { id: "qc:ranges", category: "content", severity: "critical",
    check: "All comparisons show ranges (Low / Average / High)",
    spanishCheck: "Todas las comparativas muestran rangos (Bajo / Promedio / Alto)" },
  { id: "qc:hidden_costs", category: "content", severity: "critical",
    check: "Hidden costs included (minimum 8-10 categories)",
    spanishCheck: "Se incluyen costes ocultos (mínimo 8-10 categorías)" },
  { id: "qc:charts", category: "formatting", severity: "important",
    check: "Relevant charts included (minimum 2-3: bar, pie, line)",
    spanishCheck: "Se incluyen gráficos relevantes (mínimo 2-3)" },
  { id: "qc:executive_summary", category: "content", severity: "critical",
    check: "Executive Summary has clear recommendation + estimated savings",
    spanishCheck: "El Resumen Ejecutivo tiene recomendación clara + ahorro estimado" },
  { id: "qc:timestamps", category: "formatting", severity: "important",
    check: "Document has creation date and version number",
    spanishCheck: "El documento tiene fecha de creación y número de versión" },
  { id: "qc:no_errors", category: "validation", severity: "critical",
    check: "No #REF!, #DIV/0!, #VALUE! or NaN errors in any cell",
    spanishCheck: "No hay errores #REF!, #DIV/0!, #VALUE! ni NaN en ninguna celda" },
  { id: "qc:spelling", category: "formatting", severity: "recommended",
    check: "Spelling and formatting reviewed",
    spanishCheck: "Se ha revisado ortografía y formato" },
];

// ───────────────────────────────────────────────────────────────────────────
// 7. COGS CALCULATION STEPS — Structured methodology
// ───────────────────────────────────────────────────────────────────────────

export interface CogsCalculationStep {
  step: number;
  name: string;
  spanishName: string;
  description: string;
  inputs: string[];
  outputs: string[];
}

export const COGS_CALCULATION_STEPS: CogsCalculationStep[] = [
  { step: 1, name: "Define Scope", spanishName: "Definir alcance",
    description: "Identify products/services, analysis period, and expected sales volume",
    inputs: ["Product catalog", "Sales period", "Volume projections"],
    outputs: ["Scope document", "Product list with SKUs"] },
  { step: 2, name: "Create Assumptions Sheet", spanishName: "Crear hoja de supuestos",
    description: "The most important sheet — all editable inputs in yellow cells",
    inputs: ["Unit purchase prices (Low/Avg/High)", "Transport costs", "Special taxes", "Breakage rate (3-8%)", "Cold storage costs", "Labor costs", "Marketing allocation"],
    outputs: ["ASSUMPTIONS sheet with yellow input cells"] },
  { step: 3, name: "Calculate Unit COGS", spanishName: "Calcular COGS unitario",
    description: "COGS = Purchase + Transport + Taxes + Breakage per unit",
    inputs: ["Assumptions sheet values"],
    outputs: ["COGS per unit", "COGS per category"] },
  { step: 4, name: "Calculate Margins", spanishName: "Calcular márgenes",
    description: "Margin = Selling Price - COGS. Margin% = Margin / Selling Price",
    inputs: ["COGS per unit", "Selling prices"],
    outputs: ["Unit margin", "Margin %", "Contribution margin"] },
  { step: 5, name: "Allocate Fixed Costs", spanishName: "Asignar costes fijos",
    description: "Distribute storage, labor, space costs proportionally to each product",
    inputs: ["Total fixed costs", "Product handling proportions"],
    outputs: ["Allocated fixed cost per product", "Net profit per unit"] },
  { step: 6, name: "Executive Summary", spanishName: "Resumen ejecutivo",
    description: "Savings potential, ROI, supplier recommendation, action plan with deadlines",
    inputs: ["All calculations", "Market benchmarks"],
    outputs: ["Savings potential €", "ROI %", "Top-5 recommendations", "90-day plan"] },
];

// ───────────────────────────────────────────────────────────────────────────
// GOLDEN RULE
// ───────────────────────────────────────────────────────────────────────────

export const GOLDEN_RULE = {
  en: "If the document cannot be understood in 30 seconds by someone who is not an expert, it is not well done. Intelligence is in making the complex simple, not the other way around.",
  es: "Si el documento no se puede entender en 30 segundos por alguien que no es experto, no está bien hecho. La inteligencia está en hacer lo complejo simple, no al revés.",
};

// ───────────────────────────────────────────────────────────────────────────
// PUBLIC ACCESS API
// ───────────────────────────────────────────────────────────────────────────

export function getCogsMethodologySummary() {
  return {
    pillarCount: COGS_METHODOLOGY_PILLARS.length,
    hiddenCostCategoryCount: HIDDEN_COST_CATEGORIES.length,
    tcoComponentCount: TCO_COMPONENTS.length,
    supplierScenarioCount: SUPPLIER_SCENARIOS.length,
    excelColorRuleCount: EXCEL_COLOR_RULES.length,
    excelSheetCount: EXCEL_STANDARD_STRUCTURE.length,
    pptxSlideCount: PPTX_IDEAL_STRUCTURE.length,
    qualityCheckCount: QUALITY_CHECKLIST.length,
    calculationStepCount: COGS_CALCULATION_STEPS.length,
    goldenRule: GOLDEN_RULE.es,
  };
}

export function getFullCogsMethodology() {
  return {
    pillars: COGS_METHODOLOGY_PILLARS,
    hiddenCostCategories: HIDDEN_COST_CATEGORIES,
    tcoComponents: TCO_COMPONENTS,
    supplierScenarios: SUPPLIER_SCENARIOS,
    excelColorRules: EXCEL_COLOR_RULES,
    excelStandardStructure: EXCEL_STANDARD_STRUCTURE,
    pptxIdealStructure: PPTX_IDEAL_STRUCTURE,
    qualityChecklist: QUALITY_CHECKLIST,
    cogsCalculationSteps: COGS_CALCULATION_STEPS,
    goldenRule: GOLDEN_RULE,
  };
}
