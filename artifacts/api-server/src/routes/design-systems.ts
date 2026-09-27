import { Router } from "express";
import {
  DESIGN_SYSTEMS, DESIGN_CATEGORIES,
  getDesignSystemById, getDesignSystemsByCategory,
  searchDesignSystems, generateDesignMd,
} from "../lib/design-systems.js";
import { askAMR } from "../lib/amr.js";
import { parseAiJson } from "../lib/ai-json.js";
import { lenientArray, looseString } from "../lib/ai-schema.js";
import { z } from "zod";

// Los colores y fuentes acaban en CSS (apply) y en el DESIGN.md: solo hex y nombres seguros.
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/);
const font = z.string().trim().regex(/^[\p{L}\p{N} \-]{1,60}$/u);
const generatedSystemSchema = z.object({
  primaryColor: hex, secondaryColor: hex, accentColor: hex, bgColor: hex,
  surfaceColor: hex, textColor: hex, textMuted: hex,
  fontHeading: font, fontBody: font,
  borderRadius: z.enum(["none", "sm", "md", "lg", "full"]).catch("md"),
  toneWords: lenientArray(looseString),
  principles: lenientArray(looseString),
  motionStyle: z.string().catch("functional"),
  logoStyle: z.string().catch(""),
  spacingScale: z.string().catch("normal"),
  designLanguage: z.string().catch(""),
  buttonStyle: z.string().catch(""),
  shadowStyle: z.string().catch("soft"),
});

const router = Router();

// GET /api/design-systems — list all design systems
router.get("/design-systems", (req, res) => {
  const { q, category } = req.query as Record<string, string>;

  let systems = q ? searchDesignSystems(q) : [...DESIGN_SYSTEMS];
  if (category) systems = systems.filter(ds => ds.category === category);

  res.json({
    designSystems: systems,
    total: systems.length,
    categories: DESIGN_CATEGORIES,
  });
});

// GET /api/design-systems/categories — list categories
router.get("/design-systems/categories", (_req, res) => {
  res.json({
    categories: DESIGN_CATEGORIES.map(cat => ({
      name: cat,
      count: getDesignSystemsByCategory(cat).length,
    })),
  });
});

// GET /api/design-systems/:id — get a single design system
router.get("/design-systems/:id", (req, res) => {
  const ds = getDesignSystemById(req.params.id);
  if (!ds) { res.status(404).json({ error: "Design system no encontrado" }); return; }
  res.json(ds);
});

// GET /api/design-systems/:id/design-md — get DESIGN.md for a brand
router.get("/design-systems/:id/design-md", (req, res) => {
  const ds = getDesignSystemById(req.params.id);
  if (!ds) { res.status(404).json({ error: "Design system no encontrado" }); return; }
  const md = generateDesignMd(ds);
  if (req.query.format === "text") {
    res.setHeader("Content-Type", "text/plain");
    res.send(md);
  } else {
    res.json({ markdown: md, brand: ds.name });
  }
});

// POST /api/design-systems/:id/apply — apply a design system's tokens to generate CSS variables
router.post("/design-systems/:id/apply", (req, res) => {
  const ds = getDesignSystemById(req.params.id);
  if (!ds) { res.status(404).json({ error: "Design system no encontrado" }); return; }

  const css = `:root {
  /* ${ds.name} Design System Tokens */
  --color-primary: ${ds.primaryColor};
  --color-secondary: ${ds.secondaryColor};
  --color-accent: ${ds.accentColor};
  --color-bg: ${ds.bgColor};
  --color-surface: ${ds.surfaceColor};
  --color-text: ${ds.textColor};
  --color-muted: ${ds.textMuted};
  --font-heading: '${ds.fontHeading}', sans-serif;
  --font-body: '${ds.fontBody}', sans-serif;
  --radius: ${ds.borderRadius === "none" ? "0" : ds.borderRadius === "sm" ? "4px" : ds.borderRadius === "md" ? "8px" : ds.borderRadius === "lg" ? "16px" : "9999px"};
  ${Object.entries(ds.cssVariables ?? {}).map(([k, v]) => `${k}: ${v};`).join("\n  ")}
}`;

  res.json({
    css,
    designSystem: ds,
    googleFontsUrl: ds.fontBody !== ds.fontHeading
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(ds.fontHeading)}:wght@400;700&family=${encodeURIComponent(ds.fontBody)}:wght@400;500&display=swap`
      : `https://fonts.googleapis.com/css2?family=${encodeURIComponent(ds.fontHeading)}:wght@400;500;700&display=swap`,
  });
});

// POST /api/design-systems/generate — AI-generate a custom design system from description
router.post("/design-systems/generate", async (req, res) => {
  const { brandName, sector, description, toneWords, primaryColor } = req.body as {
    brandName: string;
    sector: string;
    description?: string;
    toneWords?: string[];
    primaryColor?: string;
  };

  if (!brandName || !sector) {
    res.status(400).json({ error: "brandName y sector requeridos" }); return;
  }

  try {
    const systemPrompt = `Eres un experto en diseño de sistemas visuales y branding. Genera sistemas de diseño completos en JSON.`;
    const userPrompt = `Genera un sistema de diseño completo para la marca "${brandName}" del sector "${sector}".
${description ? `Descripción: ${description}` : ""}
${toneWords?.length ? `Tono de voz: ${toneWords.join(", ")}` : ""}
${primaryColor ? `Color primario sugerido: ${primaryColor}` : ""}

Responde SÓLO con un JSON válido con esta estructura exacta (sin markdown, sin explicaciones):
{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "accentColor": "#hex",
  "bgColor": "#hex",
  "surfaceColor": "#hex",
  "textColor": "#hex",
  "textMuted": "#hex",
  "fontHeading": "Nombre de fuente Google Fonts",
  "fontBody": "Nombre de fuente Google Fonts",
  "borderRadius": "none|sm|md|lg|full",
  "toneWords": ["palabra1","palabra2","palabra3","palabra4","palabra5"],
  "principles": ["principio1","principio2","principio3","principio4"],
  "motionStyle": "minimal|expressive|functional|dramatic",
  "logoStyle": "descripción del estilo de logo",
  "spacingScale": "tight|normal|spacious",
  "designLanguage": "descripción en 1 frase del lenguaje visual",
  "buttonStyle": "descripción del estilo del botón primario",
  "shadowStyle": "none|soft|medium|hard"
}`;

    const output = await askAMR(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      "claude-sonnet",
      { maxTokens: 2000 }
    );

    // Antes: JSON.parse tras quitar ``` (cualquier texto alrededor lo rompía) y sin
    // validar: un color inválido acababa en las variables CSS de "apply".
    const parsed = parseAiJson(output, { schema: generatedSystemSchema, expect: "object" });
    if (!parsed.ok) {
      res.status(502).json({ error: "La IA no devolvió un sistema de diseño válido. Inténtalo de nuevo." }); return;
    }
    const json = parsed.data;

    const customSystem = {
      id: `custom-${Date.now()}`,
      name: brandName,
      category: sector,
      description: description ?? `Sistema de diseño generado para ${brandName}`,
      ...json,
    };

    res.json({ designSystem: customSystem, designMd: generateDesignMd(customSystem as never) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
