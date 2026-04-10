import { useState, useCallback, useRef, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════
   FUSION STUDIO — Product Intelligence Engine + Brand DNA
   Full brand context: URL · Instagram · Niche · Company
   ═══════════════════════════════════════════════════════════ */

const PHOTO_MODES = [
  { id: "hero", label: "Hero Shot", icon: "✦", desc: "Producto protagonista, fondo limpio, iluminación perfecta", cat: "product" },
  { id: "lifestyle", label: "Lifestyle", icon: "◉", desc: "En contexto real de uso, ambiente natural", cat: "product" },
  { id: "detail", label: "Macro Detail", icon: "◎", desc: "Zoom extremo en texturas, materiales, acabados", cat: "product" },
  { id: "flat-lay", label: "Flat Lay", icon: "▣", desc: "Vista cenital, composición editorial", cat: "product" },
  { id: "model-fashion", label: "Modelo Fashion", icon: "◈", desc: "Modelo vistiendo el producto — editorial", cat: "model" },
  { id: "model-holding", label: "Modelo Holding", icon: "✿", desc: "Modelo sosteniendo/mostrando el producto", cat: "model" },
  { id: "model-using", label: "Modelo Usando", icon: "◇", desc: "Modelo interactuando con el producto en acción", cat: "model" },
  { id: "scale", label: "Escala / Tamaño", icon: "⊞", desc: "Mostrando tamaño real en mano o contexto", cat: "product" },
  { id: "packaging", label: "Packaging", icon: "▥", desc: "Presentación del empaque y unboxing", cat: "product" },
  { id: "multi-angle", label: "Multi-Ángulo (4)", icon: "↻", desc: "Frontal + lateral + trasera + 3/4", cat: "product" },
  { id: "ambient", label: "Ambient / Cinematic", icon: "◐", desc: "Escena cinematográfica, producto como focal point", cat: "scene" },
  { id: "ugc", label: "UGC / Authentic", icon: "◪", desc: "Estilo contenido de usuario, natural e imperfecto", cat: "scene" },
  { id: "social-ig", label: "Instagram Ready", icon: "▪", desc: "1:1, optimizado para feed de Instagram", cat: "social" },
  { id: "social-story", label: "Story / Reel", icon: "▫", desc: "9:16 vertical, optimizado para stories", cat: "social" },
  { id: "banner", label: "Banner / Header", icon: "▬", desc: "16:9 horizontal para web o marketplace", cat: "social" },
  { id: "comparison", label: "Before / After", icon: "⇔", desc: "Split comparativo del producto", cat: "product" },
];

const LIGHTING = [
  { id: "studio-3pt", label: "Estudio 3-Point", icon: "💡" },
  { id: "natural-window", label: "Ventana Natural", icon: "🪟" },
  { id: "dramatic-rembrandt", label: "Rembrandt", icon: "🎭" },
  { id: "soft-diffused", label: "Suave Difuso", icon: "☁️" },
  { id: "golden-hour", label: "Golden Hour", icon: "🌅" },
  { id: "neon-accent", label: "Neón / Color", icon: "💜" },
  { id: "rim-silhouette", label: "Rim / Silueta", icon: "🌗" },
  { id: "low-key-moody", label: "Low Key Moody", icon: "🌑" },
  { id: "high-key-bright", label: "High Key Bright", icon: "⬜" },
  { id: "backlit", label: "Contraluz", icon: "🔆" },
];

const BACKGROUNDS = [
  { id: "white-pure", label: "Blanco puro", preview: "#ffffff" },
  { id: "grey-soft", label: "Gris suave", preview: "#d4d4d4" },
  { id: "dark-black", label: "Negro", preview: "#111111" },
  { id: "gradient-brand", label: "Gradiente marca", preview: "linear-gradient(135deg,#1a1a2e,#2d1b4e)" },
  { id: "marble-luxury", label: "Mármol", preview: "#e8e0d4" },
  { id: "wood-natural", label: "Madera", preview: "#8B6914" },
  { id: "concrete", label: "Hormigón", preview: "#888" },
  { id: "nature-outdoor", label: "Naturaleza", preview: "#2d5a27" },
  { id: "fabric-textile", label: "Tela / Textil", preview: "#c2b5a0" },
  { id: "scene-custom", label: "Escena custom", preview: "#555" },
];

const PERSPECTIVES = [
  "Frontal 0°", "3/4 (45°)", "Lateral 90°", "Cenital (top-down)", 
  "Contrapicado", "Isométrica", "Dutch Angle", "Nivel de ojo",
  "Worm's eye", "Over-the-shoulder"
];

const NICHES = [
  "Moda / Ropa", "Cosmética / Belleza", "Joyería / Accesorios", "Alimentación / Bebidas",
  "Tecnología / Electrónica", "Hogar / Decoración", "Deportes / Fitness", "Infantil / Juguetes",
  "Mascotas", "Arte / Artesanía", "Salud / Bienestar", "Automoción", "Herramientas / Industrial",
  "Papelería / Oficina", "Jardinería", "Música / Instrumentos", "Otro"
];

const BRAND_STYLES = [
  "Luxury / Premium", "Minimalista / Clean", "Streetwear / Urban", "Artesanal / Handmade",
  "Tech / Futurista", "Orgánico / Natural", "Bold / Impactante", "Elegante / Clásico",
  "Retro / Vintage", "Playful / Colorido", "Corporate / Profesional", "Bohemio / Free"
];

export default function FusionStudioFull() {
  // ─── Brand Intelligence State ───
  const [brandUrl, setBrandUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [niche, setNiche] = useState("");
  const [brandStyle, setBrandStyle] = useState("");
  const [brandColors, setBrandColors] = useState(["#000000", "#ffffff", "#c8a84b"]);
  const [brandDna, setBrandDna] = useState(null);
  const [isFetchingBrand, setIsFetchingBrand] = useState(false);

  // ─── Image State ───
  const [productImages, setProductImages] = useState([]);
  const [modelImage, setModelImage] = useState(null);
  const [referenceImages, setReferenceImages] = useState([]);
  const [productAnalysis, setProductAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ─── Generation Controls ───
  const [selectedModes, setSelectedModes] = useState(["hero", "lifestyle"]);
  const [lighting, setLighting] = useState("studio-3pt");
  const [background, setBackground] = useState("white-pure");
  const [perspective, setPerspective] = useState("3/4 (45°)");
  const [customScene, setCustomScene] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [outputFormat, setOutputFormat] = useState("1024x1024");
  
  // ─── UI State ───
  const [phase, setPhase] = useState("brand"); // brand | product | generate | gallery
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPhotos, setGeneratedPhotos] = useState([]);
  const [expandedPhoto, setExpandedPhoto] = useState(null);

  const fileRefs = { product: useRef(null), model: useRef(null), ref: useRef(null) };

  // ─── Brand DNA Fetch ───
  const fetchBrandDNA = useCallback(async () => {
    if (!brandUrl && !instagram && !companyName) return;
    setIsFetchingBrand(true);
    // Simulated — in production this calls /fusion-studio/brand-dna
    setTimeout(() => {
      setBrandDna({
        name: companyName || "Marca detectada",
        sector: niche || "Premium Lifestyle",
        audience: "25-45, poder adquisitivo medio-alto",
        style: brandStyle || "Luxury / Premium",
        colors: brandColors,
        values: ["Calidad artesanal", "Sostenibilidad", "Diseño exclusivo"],
        competitors: ["Competitor A", "Competitor B"],
        photographyStyle: "Editorial, fondos neutros, iluminación natural",
        instagramAesthetic: instagram ? "Feed coherente, tonos cálidos, lifestyle aspiracional" : null,
        designAdjectives: ["elegante", "premium", "minimalista", "sofisticado"],
      });
      setIsFetchingBrand(false);
      setPhase("product");
    }, 2000);
  }, [brandUrl, instagram, companyName, niche, brandStyle, brandColors]);

  // ─── Product Image Upload ───
  const handleProductUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setProductImages(prev => [...prev.slice(0, 4), reader.result]);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleModelUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setModelImage(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const handleRefUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setReferenceImages(prev => [...prev.slice(0, 7), reader.result]);
      reader.readAsDataURL(file);
    });
  }, []);

  const analyzeProduct = useCallback(() => {
    if (productImages.length === 0) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setProductAnalysis({
        category: "Botella de Vidrio / Bebida Premium",
        subcategory: "Gin artesanal",
        materials: ["Vidrio soplado", "Corcho natural", "Papel texturizado (etiqueta)", "Tinta metalizada"],
        textures: ["Superficie lisa transparente", "Relieve en etiqueta", "Acabado mate en tapa"],
        colors: ["#1a3a2a", "#c8a84b", "#f5f0e8", "#2d1b0e"],
        composition: { shape: "Cilíndrica con hombros angulares", proportions: "Alto y estilizado 1:3", weight: "~700g", dimensions: "~28cm alto × 9cm diámetro" },
        brandStyle: "Premium artesanal",
        suggestedModes: ["hero", "lifestyle", "detail", "ambient", "packaging"],
        suggestedLighting: "natural-window",
        suggestedBackground: "dark-black",
        suggestedProps: ["Hierbas aromáticas", "Cítricos", "Hielo", "Copa de balón", "Tabla de madera"],
      });
      setIsAnalyzing(false);
      setPhase("generate");
    }, 2500);
  }, [productImages]);

  useEffect(() => {
    if (productImages.length > 0 && !productAnalysis && !isAnalyzing) {
      analyzeProduct();
    }
  }, [productImages, productAnalysis, isAnalyzing, analyzeProduct]);

  const toggleMode = (id) => setSelectedModes(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
  const hasModel = !!modelImage;
  const modelModes = PHOTO_MODES.filter(m => m.cat === "model");
  const productModes = PHOTO_MODES.filter(m => m.cat === "product");
  const sceneModes = PHOTO_MODES.filter(m => m.cat === "scene");
  const socialModes = PHOTO_MODES.filter(m => m.cat === "social");
  const totalPhotos = selectedModes.length * quantity;

  // ─── Styles ───
  const V = {
    root: { minHeight: "100vh", background: "#08080c", color: "#e2e2e8", fontFamily: "'Satoshi', 'DM Sans', sans-serif" },
    header: { padding: "14px 24px", borderBottom: "1px solid #1a1a22", display: "flex", alignItems: "center", gap: 16, background: "#0c0c12" },
    brand: { display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" },
    brandIcon: { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#c8a84b,#8a6d2b)", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 900, color: "#08080c" },
    brandText: { fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" },
    brandSub: { fontSize: 9, color: "#c8a84b88", letterSpacing: "0.18em", textTransform: "uppercase" },
    phases: { display: "flex", gap: 2, margin: "0 auto", background: "#12121a", borderRadius: 8, padding: 2 },
    phaseBtn: (a) => ({ padding: "7px 20px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: a ? "#c8a84b18" : "transparent", color: a ? "#f0d68a" : "#666", transition: "all .2s" }),
    body: { display: "flex", minHeight: "calc(100vh - 55px)" },
    sidebar: { width: 320, borderRight: "1px solid #1a1a22", padding: 18, overflowY: "auto", maxHeight: "calc(100vh - 55px)", flexShrink: 0 },
    main: { flex: 1, padding: 24, overflowY: "auto", maxHeight: "calc(100vh - 55px)" },
    right: { width: 280, borderLeft: "1px solid #1a1a22", padding: 18, overflowY: "auto", maxHeight: "calc(100vh - 55px)", flexShrink: 0 },
    sec: { marginBottom: 22 },
    secTitle: { fontSize: 10, fontWeight: 700, color: "#c8a84b99", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 },
    input: { width: "100%", background: "#12121a", border: "1px solid #22222e", borderRadius: 8, padding: "9px 12px", color: "#e2e2e8", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
    select: { width: "100%", background: "#12121a", border: "1px solid #22222e", borderRadius: 8, padding: "9px 12px", color: "#e2e2e8", fontSize: 12, fontFamily: "inherit", outline: "none", appearance: "none", boxSizing: "border-box" },
    textarea: { width: "100%", background: "#12121a", border: "1px solid #22222e", borderRadius: 8, padding: "10px 12px", color: "#e2e2e8", fontSize: 12, fontFamily: "inherit", resize: "vertical", minHeight: 56, outline: "none", boxSizing: "border-box" },
    uploadZone: (has) => ({ width: "100%", aspectRatio: "5/3", borderRadius: 12, border: has ? "2px solid #c8a84b44" : "2px dashed #22222e", background: has ? "#0000" : "#0c0c12", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative", transition: "all .25s" }),
    uploadMini: (has) => ({ width: 56, height: 56, borderRadius: 8, border: has ? "1.5px solid #c8a84b44" : "1.5px dashed #22222e", display: "grid", placeItems: "center", cursor: "pointer", overflow: "hidden", fontSize: has ? 0 : 18, color: "#333", flexShrink: 0 }),
    chip: (a, gold) => ({ padding: "7px 11px", borderRadius: 7, border: a ? `1.5px solid ${gold ? "#c8a84b66" : "#4466ff66"}` : "1px solid #1a1a22", background: a ? (gold ? "#c8a84b0d" : "#4466ff0d") : "#0c0c12", cursor: "pointer", fontSize: 11, color: a ? (gold ? "#f0d68a" : "#88aaff") : "#666", fontWeight: a ? 600 : 400, transition: "all .2s", textAlign: "left" }),
    modeCard: (a, sug) => ({ padding: "10px 12px", borderRadius: 9, border: a ? "1.5px solid #c8a84b55" : sug ? "1px solid #c8a84b22" : "1px solid #16161e", background: a ? "#c8a84b08" : "#0e0e14", cursor: "pointer", transition: "all .2s" }),
    goldBtn: (dis) => ({ width: "100%", padding: 14, borderRadius: 10, border: "none", background: dis ? "#333" : "linear-gradient(135deg,#c8a84b,#9a7a30)", color: dis ? "#666" : "#08080c", fontSize: 13, fontWeight: 700, cursor: dis ? "default" : "pointer", letterSpacing: "-0.01em" }),
    badge: (c) => ({ display: "inline-flex", padding: "2px 8px", borderRadius: 12, fontSize: 9, fontWeight: 600, background: `${c}14`, color: c, border: `1px solid ${c}28` }),
    colorDot: (h) => ({ width: 18, height: 18, borderRadius: "50%", background: h, border: "1.5px solid #22222e", cursor: "pointer", flexShrink: 0 }),
    dnaCard: { background: "#c8a84b06", border: "1px solid #c8a84b18", borderRadius: 10, padding: 14 },
    guardCard: { background: "#4466ff06", border: "1px solid #4466ff18", borderRadius: 10, padding: 14 },
    stat: { textAlign: "center" },
    statNum: { fontSize: 28, fontWeight: 800, color: "#f0d68a", lineHeight: 1 },
    statLabel: { fontSize: 9, color: "#666", marginTop: 2 },
    galleryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 },
    galleryCard: { borderRadius: 10, overflow: "hidden", border: "1px solid #1a1a22", background: "#0e0e14", cursor: "pointer", transition: "all .2s" },
  };

  const img100 = { width: "100%", height: "100%", objectFit: "contain" };
  const img100cover = { width: "100%", height: "100%", objectFit: "cover" };

  return (
    <div style={V.root}>
      {/* ═══ HEADER ═══ */}
      <div style={V.header}>
        <div style={V.brand}>
          <div style={V.brandIcon}>F</div>
          <div>
            <div style={V.brandText}>Fusion Studio</div>
            <div style={V.brandSub}>Product Intelligence</div>
          </div>
        </div>

        <div style={V.phases}>
          {[
            ["brand", "① Marca"],
            ["product", "② Producto"],
            ["generate", "③ Generar"],
            ["gallery", "④ Galería"],
          ].map(([id, label]) => (
            <button key={id} style={V.phaseBtn(phase === id)} onClick={() => setPhase(id)}>{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {brandDna && <span style={V.badge("#c8a84b")}>{brandDna.name}</span>}
          {productAnalysis && <span style={V.badge("#44cc88")}>{productAnalysis.category.split("/")[0].trim()}</span>}
          {totalPhotos > 0 && phase === "generate" && <span style={V.badge("#6688ff")}>{totalPhotos} fotos</span>}
        </div>
      </div>

      <div style={V.body}>
        {/* ═══════════════════════════════════════════
            PHASE 1: BRAND INTELLIGENCE
            ═══════════════════════════════════════════ */}
        {phase === "brand" && (
          <>
            <div style={{ ...V.main, maxWidth: 720, margin: "0 auto" }}>
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>Inteligencia de Marca</div>
                <div style={{ fontSize: 13, color: "#666", maxWidth: 500, margin: "0 auto" }}>
                  Cuanta más información proporciones, más precisas serán las fotos. La IA investigará la marca en Google e Instagram para entender su estética real.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={V.sec}>
                  <div style={V.secTitle}>🏢 Nombre de la empresa/marca</div>
                  <input style={V.input} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: Hendrick's Gin" />
                </div>
                <div style={V.sec}>
                  <div style={V.secTitle}>📸 Instagram</div>
                  <input style={V.input} value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@hendricksgin" />
                </div>
              </div>

              <div style={V.sec}>
                <div style={V.secTitle}>🌐 URL de la web</div>
                <input style={V.input} value={brandUrl} onChange={e => setBrandUrl(e.target.value)} placeholder="https://www.hendricksgin.com" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div style={V.sec}>
                  <div style={V.secTitle}>🏷️ Nicho / Sector</div>
                  <select style={V.select} value={niche} onChange={e => setNiche(e.target.value)}>
                    <option value="">Seleccionar nicho...</option>
                    {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={V.sec}>
                  <div style={V.secTitle}>🎨 Estilo de marca</div>
                  <select style={V.select} value={brandStyle} onChange={e => setBrandStyle(e.target.value)}>
                    <option value="">Seleccionar estilo...</option>
                    {BRAND_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={V.sec}>
                <div style={V.secTitle}>🎨 Colores de marca (click para cambiar)</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {brandColors.map((c, i) => (
                    <label key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <input type="color" value={c} onChange={e => setBrandColors(p => p.map((x, j) => j === i ? e.target.value : x))} style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", padding: 0 }} />
                      <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>{c}</span>
                    </label>
                  ))}
                  <button onClick={() => setBrandColors(p => [...p, "#888888"])} style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px dashed #22222e", background: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>+</button>
                </div>
              </div>

              <div style={V.sec}>
                <div style={V.secTitle}>📝 Contexto adicional (opcional)</div>
                <textarea style={V.textarea} placeholder="Describe la marca, su historia, su público, lo que transmite..." />
              </div>

              <button style={V.goldBtn(isFetchingBrand || (!brandUrl && !instagram && !companyName))} onClick={fetchBrandDNA} disabled={isFetchingBrand || (!brandUrl && !instagram && !companyName)}>
                {isFetchingBrand ? "⟳ Investigando marca en Google + Instagram..." : "🔍 Investigar Marca y Extraer DNA"}
              </button>

              {!brandUrl && !instagram && !companyName && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button onClick={() => setPhase("product")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                    Saltar → ir directo al producto
                  </button>
                </div>
              )}

              {brandDna && (
                <div style={{ ...V.dnaCard, marginTop: 20 }}>
                  <div style={{ ...V.secTitle, color: "#c8a84b" }}>✅ Brand DNA Extraído</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{brandDna.name}</div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Sector: {brandDna.sector} · Audiencia: {brandDna.audience}</div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Estilo: {brandDna.style}</div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Fotografía: {brandDna.photographyStyle}</div>
                  {brandDna.instagramAesthetic && <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Instagram: {brandDna.instagramAesthetic}</div>}
                  <div style={{ fontSize: 10, color: "#c8a84b88", marginTop: 8 }}>Adjetivos: {brandDna.designAdjectives?.join(" · ")}</div>
                  <button onClick={() => setPhase("product")} style={{ ...V.goldBtn(false), marginTop: 12 }}>Siguiente → Subir Producto</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════
            PHASE 2: PRODUCT UPLOAD + ANALYSIS
            ═══════════════════════════════════════════ */}
        {phase === "product" && (
          <>
            <div style={V.sidebar}>
              <div style={V.sec}>
                <div style={V.secTitle}>📦 Imágenes del producto ({productImages.length}/5)</div>
                <div style={V.uploadZone(productImages.length > 0)} onClick={() => fileRefs.product.current?.click()}>
                  {productImages.length > 0 ? (
                    <img src={productImages[0]} style={img100} alt="product" />
                  ) : (
                    <div style={{ textAlign: "center", color: "#444", padding: 20 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>Sube tu producto</div>
                      <div style={{ fontSize: 10, marginTop: 4, color: "#555" }}>Hasta 5 ángulos. La IA extraerá materiales, texturas, colores y forma.</div>
                    </div>
                  )}
                  <input ref={fileRefs.product} type="file" accept="image/*" multiple hidden onChange={handleProductUpload} />
                </div>
                {productImages.length > 1 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                    {productImages.slice(1).map((img, i) => (
                      <div key={i} style={V.uploadMini(true)}><img src={img} style={img100cover} alt="" /></div>
                    ))}
                  </div>
                )}
              </div>

              <div style={V.sec}>
                <div style={V.secTitle}>👤 Modelo / Persona (opcional)</div>
                <div style={{ ...V.uploadZone(!!modelImage), aspectRatio: "4/3" }} onClick={() => fileRefs.model.current?.click()}>
                  {modelImage ? (
                    <img src={modelImage} style={img100} alt="model" />
                  ) : (
                    <div style={{ textAlign: "center", color: "#444" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>👤</div>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>Modelo de referencia</div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>La IA NUNCA fusionará cuerpos</div>
                    </div>
                  )}
                  <input ref={fileRefs.model} type="file" accept="image/*" hidden onChange={handleModelUpload} />
                </div>
              </div>

              <div style={V.sec}>
                <div style={V.secTitle}>🖼️ Referencias de estilo ({referenceImages.length}/8)</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {referenceImages.map((img, i) => (
                    <div key={i} style={V.uploadMini(true)}><img src={img} style={img100cover} alt="" /></div>
                  ))}
                  {referenceImages.length < 8 && (
                    <div style={V.uploadMini(false)} onClick={() => fileRefs.ref.current?.click()}>+</div>
                  )}
                  <input ref={fileRefs.ref} type="file" accept="image/*" multiple hidden onChange={handleRefUpload} />
                </div>
              </div>
            </div>

            <div style={V.main}>
              {isAnalyzing && (
                <div style={{ textAlign: "center", padding: 60 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔬</div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Analizando producto...</div>
                  <div style={{ fontSize: 12, color: "#666" }}>Extrayendo capas · texturas · materiales · colores · composición · forma</div>
                </div>
              )}

              {productAnalysis && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, letterSpacing: "-0.03em" }}>Análisis del Producto</div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>CATEGORÍA</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{productAnalysis.category}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{productAnalysis.subcategory}</div>
                    </div>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>MATERIALES</div>
                      {productAnalysis.materials.map((m, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>• {m}</div>
                      ))}
                    </div>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>DIMENSIONES</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{productAnalysis.composition.shape}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{productAnalysis.composition.dimensions}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{productAnalysis.composition.weight}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>TEXTURAS</div>
                      {productAnalysis.textures.map((t, i) => (
                        <div key={i} style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>• {t}</div>
                      ))}
                    </div>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>COLORES DETECTADOS</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {productAnalysis.colors.map((c, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={V.colorDot(c)} />
                            <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={V.dnaCard}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#44cc88", marginBottom: 6 }}>💡 SUGERENCIAS INTELIGENTES</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                      <strong>Modos recomendados:</strong> {productAnalysis.suggestedModes.map(m => PHOTO_MODES.find(p => p.id === m)?.label).join(", ")}
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                      <strong>Iluminación ideal:</strong> {LIGHTING.find(l => l.id === productAnalysis.suggestedLighting)?.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                      <strong>Props sugeridos:</strong> {productAnalysis.suggestedProps?.join(", ")}
                    </div>
                  </div>

                  <button onClick={() => { setSelectedModes(productAnalysis.suggestedModes); setLighting(productAnalysis.suggestedLighting); setBackground(productAnalysis.suggestedBackground); setPhase("generate"); }} style={{ ...V.goldBtn(false), marginTop: 16 }}>
                    Siguiente → Configurar sesión de fotos
                  </button>
                </div>
              )}

              {!productAnalysis && !isAnalyzing && (
                <div style={{ textAlign: "center", padding: 80, color: "#444" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Sube una imagen del producto</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>La IA lo descompondrá en capas, texturas, materiales y colores</div>
                </div>
              )}
            </div>

            {brandDna && (
              <div style={V.right}>
                <div style={V.sec}>
                  <div style={V.secTitle}>🧬 Brand DNA Activo</div>
                  <div style={V.dnaCard}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{brandDna.name}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>{brandDna.sector}</div>
                    <div style={{ fontSize: 10, color: "#888" }}>{brandDna.style}</div>
                    <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
                      {brandDna.colors.map((c, i) => <div key={i} style={V.colorDot(c)} />)}
                    </div>
                  </div>
                </div>
                <div style={V.guardCard}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#6688ff", letterSpacing: "0.1em", marginBottom: 6 }}>IA GUARD</div>
                  <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                    {hasModel ? "✅ Producto + Modelo detectados. La IA posicionará la persona USANDO/SOSTENIENDO el producto. Nunca fusionará cuerpos." : "✅ Solo producto. La IA respetará forma, materiales y proporciones exactas."}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════
            PHASE 3: GENERATION CONFIG
            ═══════════════════════════════════════════ */}
        {phase === "generate" && (
          <>
            <div style={V.sidebar}>
              <div style={V.sec}>
                <div style={V.secTitle}>💡 Iluminación</div>
                {LIGHTING.map(l => (
                  <div key={l.id} style={{ ...V.chip(lighting === l.id, true), marginBottom: 3, display: "block" }} onClick={() => setLighting(l.id)}>
                    {l.icon} {l.label}
                  </div>
                ))}
              </div>
              <div style={V.sec}>
                <div style={V.secTitle}>🖼️ Fondo</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {BACKGROUNDS.map(bg => (
                    <div key={bg.id} style={{ ...V.chip(background === bg.id, true), display: "flex", alignItems: "center", gap: 5 }} onClick={() => setBackground(bg.id)}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: bg.preview, border: "1px solid #333", flexShrink: 0 }} />
                      <span style={{ fontSize: 10 }}>{bg.label}</span>
                    </div>
                  ))}
                </div>
                {background === "scene-custom" && (
                  <textarea style={{ ...V.textarea, marginTop: 6 }} placeholder="Describe la escena: bar premium con luz tenue, mesa de madera oscura..." value={customScene} onChange={e => setCustomScene(e.target.value)} />
                )}
              </div>
              <div style={V.sec}>
                <div style={V.secTitle}>📐 Perspectiva</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {PERSPECTIVES.map(p => (
                    <div key={p} style={V.chip(perspective === p, true)} onClick={() => setPerspective(p)}>{p}</div>
                  ))}
                </div>
              </div>
            </div>

            <div style={V.main}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em" }}>Sesión de Fotos</div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Selecciona los tipos de foto. Los marcados con ★ son sugeridos por la IA según tu producto.</div>

              {[{ label: "Producto Solo", modes: productModes }, ...(hasModel ? [{ label: "Con Modelo", modes: modelModes }] : []), { label: "Escenas", modes: sceneModes }, { label: "Social Media", modes: socialModes }].map(group => (
                <div key={group.label} style={{ marginBottom: 16 }}>
                  <div style={{ ...V.secTitle, color: "#888" }}>{group.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                    {group.modes.map(mode => {
                      const a = selectedModes.includes(mode.id);
                      const sug = productAnalysis?.suggestedModes?.includes(mode.id);
                      return (
                        <div key={mode.id} style={V.modeCard(a, sug)} onClick={() => toggleMode(mode.id)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: a ? 700 : 400, color: a ? "#f0d68a" : "#aaa" }}>
                            <span style={{ fontSize: 14 }}>{mode.icon}</span>{mode.label}
                            {sug && !a && <span style={{ marginLeft: "auto", fontSize: 8, color: "#c8a84b" }}>★</span>}
                          </div>
                          <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{mode.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={V.sec}>
                <div style={V.secTitle}>📝 Instrucciones adicionales</div>
                <textarea style={V.textarea} value={extraPrompt} onChange={e => setExtraPrompt(e.target.value)} placeholder="Ej: Que la botella tenga gotas de condensación, fondo de bar premium con luces cálidas difusas..." />
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Fotos por modo</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setQuantity(n)} style={{ width: 34, height: 34, borderRadius: 7, border: quantity === n ? "1.5px solid #c8a84b" : "1px solid #1a1a22", background: quantity === n ? "#c8a84b0d" : "transparent", color: quantity === n ? "#f0d68a" : "#555", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>Resolución</div>
                  <select style={{ ...V.select, width: 160 }} value={outputFormat} onChange={e => setOutputFormat(e.target.value)}>
                    <option value="1024x1024">1024×1024 (1:1)</option>
                    <option value="1024x1536">1024×1536 (2:3)</option>
                    <option value="1536x1024">1536×1024 (3:2)</option>
                    <option value="1080x1920">1080×1920 (9:16)</option>
                    <option value="1920x1080">1920×1080 (16:9)</option>
                  </select>
                </div>
                <div style={{ marginLeft: "auto", ...V.stat }}>
                  <div style={V.statNum}>{totalPhotos}</div>
                  <div style={V.statLabel}>fotos totales</div>
                </div>
              </div>

              <button style={V.goldBtn(productImages.length === 0 || selectedModes.length === 0 || isGenerating)} onClick={() => { setIsGenerating(true); setPhase("gallery"); setTimeout(() => { setGeneratedPhotos(selectedModes.flatMap(m => Array.from({ length: quantity }, (_, i) => ({ id: `${m}-${i}`, mode: m, label: PHOTO_MODES.find(p => p.id === m)?.label, url: productImages[0] })))); setIsGenerating(false); }, 2000); }} disabled={productImages.length === 0 || selectedModes.length === 0}>
                {isGenerating ? "⟳ Generando sesión de fotos..." : `✦ Generar ${totalPhotos} Fotos Profesionales`}
              </button>
            </div>

            <div style={V.right}>
              {productAnalysis && (
                <div style={V.sec}>
                  <div style={V.secTitle}>📦 Producto</div>
                  <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                    <img src={productImages[0]} style={img100} alt="" />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{productAnalysis.category}</div>
                  <div style={{ fontSize: 10, color: "#666" }}>{productAnalysis.materials.join(" · ")}</div>
                </div>
              )}
              {brandDna && (
                <div style={{ ...V.dnaCard, marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#c8a84b", marginBottom: 4 }}>BRAND DNA</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{brandDna.name}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{brandDna.style}</div>
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {brandDna.colors.map((c, i) => <div key={i} style={V.colorDot(c)} />)}
                  </div>
                </div>
              )}
              <div style={V.guardCard}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#6688ff", marginBottom: 4 }}>IA GUARD</div>
                <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                  {hasModel ? "✅ Modelo detectado. La persona USARÁ el producto, nunca se fusionarán." : "✅ Solo producto. Forma y materiales se respetarán al 100%."}
                  {referenceImages.length > 0 && <><br />🎯 {referenceImages.length} ref. — estilo y composición se imitarán.</>}
                  {brandDna && <><br />🧬 Brand DNA activo — colores, estilo y audiencia inyectados.</>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════
            PHASE 4: GALLERY
            ═══════════════════════════════════════════ */}
        {phase === "gallery" && (
          <div style={{ ...V.main, maxWidth: "100%" }}>
            {isGenerating ? (
              <div style={{ textAlign: "center", padding: 80 }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✦</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Generando sesión de fotos...</div>
                <div style={{ fontSize: 12, color: "#666" }}>{totalPhotos} fotos profesionales · {selectedModes.length} modos · {quantity} por modo</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#f0d68a" }}>Sesión Completa</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{generatedPhotos.length} fotos generadas</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setPhase("generate")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #22222e", background: "transparent", color: "#aaa", fontSize: 11, cursor: "pointer" }}>← Editar sesión</button>
                    <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#c8a84b", color: "#08080c", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↓ Descargar todo (ZIP)</button>
                  </div>
                </div>
                <div style={V.galleryGrid}>
                  {generatedPhotos.map(photo => (
                    <div key={photo.id} style={V.galleryCard}>
                      <div style={{ aspectRatio: "4/3", background: "#111", overflow: "hidden" }}>
                        <img src={photo.url} style={{ ...img100, filter: "brightness(0.95) contrast(1.05)" }} alt="" />
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f0d68a" }}>{photo.label}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                          <button style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #c8a84b44", background: "none", color: "#c8a84b", fontSize: 9, fontWeight: 600, cursor: "pointer" }}>↓ Download</button>
                          <button style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #22222e", background: "none", color: "#666", fontSize: 9, cursor: "pointer" }}>↻ Regen</button>
                          <button style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #22222e", background: "none", color: "#666", fontSize: 9, cursor: "pointer" }}>✎ Edit</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
