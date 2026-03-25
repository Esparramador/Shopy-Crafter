 }
});

// ── POST /media/upload — Subir imagen (convierte a WebP) ──
router.post("/media/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(MEDIA_DIR, filename);
    // Sharp: redimensiona (max 2400px ancho) y convierte a WebP 85%
    await sharp(req.file.buffer)
      .resize({ width: 2400, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(filepath);
    const meta = await sharp(filepath).metadata();
    broadcast("media_uploaded", { filename });
    res.json({ url: `/media/${filename}`, width: meta.width, height: meta.height });
  } catch (e) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// ── DELETE /media/:filename — Eliminar imagen ──
router.delete("/media/:filename", async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename));
    const filepath = path.join(MEDIA_DIR, filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ── GET /versions — Listar historial de versiones ──
router.get("/versions", async (req, res) => {
  try {
    const versions = await db.select({
      id: cmsVersions.id,
      version: cmsVersions.version,
      savedAt: cmsVersions.savedAt,
      savedBy: cmsVersions.savedBy,
      label: cmsVersions.label,
    }).from(cmsVersions)
      .orderBy(desc(cmsVersions.savedAt))
      .limit(30);
    res.json(versions);
  } catch (e) {
    res.status(500).json({ error: "Failed to load versions" });
  }
});

// ── POST /versions/:id/restore — Restaurar versión anterior ──
router.post("/versions/:id/restore", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id));
    const [ver] = await db.select().from(cmsVersions).where(eq(cmsVersions.id, id));
    if (!ver) { res.status(404).json({ error: "Version not found" }); return; }
    const row = await getOrInitContent();
    await saveVersion(row.content, row.version, "admin");
    await db.update(cmsContent)
      .set({
        content: ver.content as Record<string, unknown>,
        version: row.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(cmsContent.id, row.id));
    broadcast("version_restored", { id, version: ver.version });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Restore failed" });
  }
});

// ── POST /ai/improve — IA mejora un texto con Claude ──
// Body: { "text": "texto original", "instruction": "más persuasivo" }
router.post("/ai/improve", async (req, res) => {
  try {
    const { text, instruction, context } = req.body;
    const systemPrompt = `Eres un copywriter experto en español.
Recibes un texto y una instrucción, y devuelves el texto mejorado.
IMPORTANTE: devuelve SOLO el texto mejorado, sin explicaciones, sin comillas extra.`;

    const userPrompt = `Texto original: "${text}"
Instrucción: ${instruction}
${context ? `Contexto: ${context}` : ""}
Devuelve solo el texto mejorado:`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });
    const improved = message.content[0].type === "text"
      ? message.content[0].text.trim()
      : text;
    res.json({ improved });
  } catch (e) {
    res.status(500).json({ error: "AI improvement failed" });
  }
});

// ── GET /events — SSE para sincronización en tiempo real ──
router.get("/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write("event: connected\ndata: {}\n\n");
  sseClients.add(res);
  req.on("close", () => sseClients.delete(res));
});

export default router;
```

### Registro de rutas (en tu index o app principal):
```typescript
import cmsRouter from "./routes/cms.js";
app.use("/api/cms", cmsRouter);
```

---

## 4. FRONTEND — Editor Visual

### Concepto clave: Secciones declarativas

El editor se basa en un array de secciones, cada una con sus campos. Esto hace que sea muy fácil añadir nuevas secciones sin tocar la lógica:

```typescript
interface FieldDef {
  label: string;      // "Titular"
  path: string;       // "hero.headline" (dot-path que coincide con el JSON)
  type: FieldType;    // "text" | "textarea" | "color" | "boolean" | "url" | "image"
  placeholder?: string;
  hint?: string;
}

interface SectionDef {
  id: string;         // "hero"
  icon: string;       // "🦸"
  label: string;      // "Hero"
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: "site", icon: "🌐", label: "Sitio",
    fields: [
      { label: "Nombre", path: "site.name", type: "text" },
      { label: "Tagline", path: "site.tagline", type: "text" },
      { label: "Color primario", path: "site.primaryColor", type: "color" },
      { label: "Logo imagen", path: "site.logo.imageUrl", type: "image" },
    ],
  },
  {
    id: "hero", icon: "🦸", label: "Hero",
    fields: [
      { label: "Titular", path: "hero.headline", type: "textarea" },
      { label: "Subtítulo", path: "hero.subheadline", type: "textarea" },
      { label: "CTA primario", path: "hero.ctaPrimary.label", type: "text" },
      { label: "Imagen Hero", path: "hero.imageUrl", type: "image" },
    ],
  },
  // ... añadir tantas secciones como necesites
];
```

### Flujo del editor:

```
1. useEffect → GET /api/cms/content → carga el JSON completo
2. El usuario modifica campos → se acumulan en un Map<path, value>
3. Click "Guardar" → POST /api/cms/content/batch con todos los cambios
4. El backend guarda versión + actualiza + emite SSE
5. El iframe (preview) escucha SSE → se recarga automáticamente
```

### Helper para leer valores del JSON con dot-path:

```typescript
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur === null || cur === undefined) return "";
    if (Array.isArray(cur)) cur = cur[parseInt(k)];
    else if (typeof cur === "object") cur = (cur as Record<string, unknown>)[k];
    else return "";
  }
  return cur;
}
```

### Componentes clave del editor:

1. **FieldEditor** — Renderiza el campo correcto según su tipo:
   - `text` → `<input>`
   - `textarea` → `<textarea>`
   - `color` → `<input type="color">` + input hex
   - `boolean` → toggle switch
   - `image` → ImageUploader (drag & drop + preview + delete)
   - Cada campo text/textarea tiene botón "IA" para mejorar con Claude

2. **ImageUploader** — Componente de subida:
   - Drag & drop
   - Preview con botones de reemplazar/eliminar
   - Convierte a WebP automáticamente en el backend

3. **AIImprovePopover** — Modal de mejora con IA:
   - Presets rápidos: "Más persuasivo", "Más corto", "SEO", "Profesional"
   - Input para instrucción personalizada
   - Muestra resultado y botones Aplicar/Descartar

4. **Preview iframe** — Vista previa en tiempo real:
   - Switcher Desktop (100%) / Tablet (768px) / Mobile (390px)
   - Se recarga automáticamente via SSE

---

## 5. FRONTEND — Consumo en la Landing

La landing page simplemente hace `fetch("/api/cms/content")` al montarse y usa los datos para renderizar:

```typescript
const [content, setContent] = useState(null);

useEffect(() => {
  fetch("/api/cms/content")
    .then(r => r.json())
    .then(setContent);
}, []);

// Uso en JSX:
<h1>{content?.hero?.headline}</h1>
<p>{content?.hero?.subheadline}</p>
<a href={content?.hero?.ctaPrimary?.href}>
  {content?.hero?.ctaPrimary?.label}
</a>
```

---

## 6. DEPENDENCIAS NECESARIAS

### Backend:
```json
{
  "express": "^5.x",
  "multer": "^1.4.5",
  "sharp": "^0.33.x",
  "uuid": "^9.x",
  "drizzle-orm": "^0.45.x",
  "@anthropic-ai/sdk": "^0.x"
}
```

### Frontend:
```json
{
  "react": "^19.x",
  "lucide-react": "^0.x"
}
```

---

## 7. CHECKLIST PARA IMPLEMENTAR EN COMIC CRAFTER

- [ ] Crear tablas `cms_content` + `cms_versions` (SQL o Drizzle push)
- [ ] Crear archivo `cms-defaults.ts` con la estructura JSON de Comic Crafter
- [ ] Crear `routes/cms.ts` con los 10 endpoints
- [ ] Registrar rutas: `app.use("/api/cms", cmsRouter)`
- [ ] Crear directorio `public/media/` para imágenes
- [ ] Instalar `multer` + `sharp` + `uuid`
- [ ] Crear componente `CMSEditor.tsx` con el sistema de secciones declarativas
- [ ] Crear componentes auxiliares: `FieldEditor`, `ImageUploader`, `AIImprovePopover`
- [ ] Modificar la Landing para que consuma `GET /api/cms/content`
- [ ] Añadir ruta `/admin/cms` al router
- [ ] Añadir enlace al sidebar del admin
- [ ] (Opcional) Configurar Claude API key para mejora de textos con IA

---

## 8. NOTAS IMPORTANTES

1. **Un solo JSON** = No necesitas una tabla por sección. Todo el contenido está en `cms_content.content` como JSONB. Esto simplifica queries, backups y versionado.

2. **Dot-path** = La clave de todo el sistema. `"pricing.plans.1.price"` accede a `content.pricing.plans[1].price`. Funciona tanto para leer (`getNestedValue`) como para escribir (`setNestedValue`).

3. **Versionado automático** = Cada vez que guardas, se hace snapshot de la versión actual ANTES de aplicar cambios. Máximo 30 versiones. El admin puede restaurar cualquiera con un clic.

4. **SSE** = Server-Sent Events mantiene la preview sincronizada. El editor envía cambios → el backend emite evento → la preview se recarga. No necesitas WebSocket.

5. **Imágenes** = Se suben en memoria (multer), se procesan con sharp (resize + WebP), se guardan en disco con nombre UUID. El CMS guarda la URL relativa (`/media/abc.webp`) en el JSON.

6. **IA** = Claude mejora textos individualmente. El endpoint recibe el texto + instrucción y devuelve solo el texto mejorado. Se puede usar con presets o instrucciones libres.
