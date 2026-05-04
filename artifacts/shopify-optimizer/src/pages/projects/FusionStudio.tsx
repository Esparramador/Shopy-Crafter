import { useState, useCallback, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import FusionStudioPro from "./FusionStudioPro";
import { LiveOperation } from "@/components/LiveOperation";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const PHOTO_MODES = [
  { id: "tryon-front", label: "Try-On Frontal", icon: "👕", desc: "Modelo IA vistiendo tu prenda — vista frontal exacta", cat: "tryon" },
  { id: "tryon-back", label: "Try-On Trasera", icon: "👔", desc: "Modelo IA vistiendo tu prenda — vista trasera exacta", cat: "tryon" },
  { id: "tryon-lifestyle", label: "Try-On Lifestyle", icon: "🧑", desc: "Modelo IA vistiendo tu prenda en contexto real", cat: "tryon" },
  { id: "hero", label: "Hero Shot", icon: "✦", desc: "Producto protagonista, fondo limpio, iluminación perfecta", cat: "product" },
  { id: "lifestyle", label: "Lifestyle", icon: "◉", desc: "En contexto real de uso, ambiente natural", cat: "product" },
  { id: "detail", label: "Macro Detail", icon: "◎", desc: "Zoom extremo en texturas, materiales, acabados", cat: "product" },
  { id: "flat-lay", label: "Flat Lay", icon: "▣", desc: "Vista cenital, composición editorial", cat: "product" },
  { id: "model-fashion", label: "Modelo Fashion", icon: "◈", desc: "Modelo vistiendo el producto — editorial (IA creativa)", cat: "model" },
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

type Phase = "brand" | "product" | "generate" | "gallery";

interface GeneratedPhoto {
  id: string;
  mode: string;
  label: string;
  prompt: string;
  imageUrl: string | null;
  model: string;
  cost: number;
  error?: string;
}

export default function FusionStudio() {
  const [, params] = useRoute("/projects/:id/fusion-studio");
  const [, paramsPro] = useRoute("/projects/:id/fusion-studio-pro");
  const projectId = params?.id ? parseInt(params.id) : (paramsPro?.id ? parseInt(paramsPro.id) : 0);

  // Modo de trabajo: workflow guiado (galería + vídeo) o estudio pro (8 herramientas libres).
  // Si la URL es /fusion-studio-pro arrancamos directamente en modo Pro (retro-compat).
  const [viewMode, setViewMode] = useState<"workflow" | "pro">(paramsPro ? "pro" : "workflow");

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [brandUrl, setBrandUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [niche, setNiche] = useState("");
  const [brandStyle, setBrandStyle] = useState("");
  const [brandColors, setBrandColors] = useState(["#000000", "#ffffff", "#c8a84b"]);
  const [brandDna, setBrandDna] = useState<any>(null);
  const [isFetchingBrand, setIsFetchingBrand] = useState(false);
  const [brandError, setBrandError] = useState("");

  const [productImages, setProductImages] = useState<string[]>([]);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [productAnalysis, setProductAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [selectedModes, setSelectedModes] = useState(["hero", "lifestyle"]);
  const [lighting, setLighting] = useState("studio-3pt");
  const [background, setBackground] = useState("white-pure");
  const [perspective, setPerspective] = useState("3/4 (45°)");
  const [customScene, setCustomScene] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [outputFormat, setOutputFormat] = useState("1024x1024");

  const [phase, setPhase] = useState<Phase>("brand");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPhotos, setGeneratedPhotos] = useState<GeneratedPhoto[]>([]);
  const [autoSuggestReasoning, setAutoSuggestReasoning] = useState("");
  const [generationWarning, setGenerationWarning] = useState("");
  const [totalCost, setTotalCost] = useState(0);

  const fileRefs = { product: useRef<HTMLInputElement>(null), model: useRef<HTMLInputElement>(null), ref: useRef<HTMLInputElement>(null) };

  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({});
  const toggleAccordion = (key: string) => setAccordionOpen(p => ({ ...p, [key]: !p[key] }));

  // ─── Create product in Shopify (uses /api/fusion-studio/create-product) ──
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [createdProductResult, setCreatedProductResult] = useState<{ id?: string; title?: string; url?: string; error?: string; refCount?: number; genCount?: number } | null>(null);

  const createProductInShopify = useCallback(async () => {
    if (!projectId || productFiles.length === 0) {
      setCreatedProductResult({ error: "Necesitas haber subido al menos 1 imagen de producto." });
      return;
    }
    setCreatingProduct(true);
    setCreatedProductResult(null);
    try {
      const fd = new FormData();
      fd.append("projectId", String(projectId));
      // Reference images (uploaded by user)
      productFiles.slice(0, 5).forEach(f => fd.append("images", f));
      // FIX: also send AI-generated photos from the gallery phase
      const generatedUrls = generatedPhotos
        .filter(p => p.imageUrl && p.imageUrl.startsWith("http"))
        .map(p => p.imageUrl!)
        .slice(0, 20);
      if (generatedUrls.length > 0) {
        fd.append("generatedPhotoUrls", JSON.stringify(generatedUrls));
      }
      const res = await fetch(`${API_BASE}/api/fusion-studio/create-product`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setCreatedProductResult({ error: data.error || `Error ${res.status}` });
        return;
      }
      setCreatedProductResult({
        id: data.product?.platformId || data.product?.id,
        title: data.product?.title || data.analysis?.productGeneration?.suggestedTitle,
        url: data.product?.url || undefined,
        refCount: data.uploadedReferenceCount,
        genCount: data.uploadedGeneratedCount,
      });
    } catch (e: any) {
      setCreatedProductResult({ error: e?.message || "Error de red" });
    } finally {
      setCreatingProduct(false);
    }
  }, [projectId, productFiles, generatedPhotos]);

  // ─── Generate advertising video (uses /api/fusion-studio/generate-video) ─
  const [videoModels, setVideoModels] = useState<Array<{ key: string; label: string; description: string; costPerSec: number; badge?: string; provider?: string; integrated?: boolean; externalUrl?: string; strengths?: string[]; promptTips?: string[]; maxDuration?: number; maxResolution?: string }>>([]);
  const [videoRatios, setVideoRatios] = useState<Array<{ key: string; label: string; runway: string; resolution?: string }>>([
    { key: "9:16", label: "9:16 vertical (Reels/TikTok)", runway: "768:1280" },
    { key: "16:9", label: "16:9 horizontal (YouTube)", runway: "1280:768" },
    { key: "1:1", label: "1:1 cuadrado (feed)", runway: "960:960" },
  ]);
  const [videoDurations, setVideoDurations] = useState<number[]>([5, 10]);
  const [videoModel, setVideoModel] = useState<string>("gen3a_turbo");
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>("9:16");
  const [videoPrompt, setVideoPrompt] = useState<string>("");
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoResult, setVideoResult] = useState<{ url?: string; error?: string; model?: string; duration?: number } | null>(null);
  const [videoSourceUrl, setVideoSourceUrl] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/api/fusion-studio/video-models`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.models) setVideoModels(d.models);
        if (d?.ratios) setVideoRatios(d.ratios);
        if (d?.durations) setVideoDurations(d.durations);
      })
      .catch(() => {});
  }, []);

  const generateVideo = useCallback(async () => {
    if (!projectId) { setVideoResult({ error: "projectId requerido" }); return; }
    const selectedModel = videoModels.find(m => m.key === videoModel);
    if (selectedModel && !selectedModel.integrated) {
      const promptText = (videoPrompt && videoPrompt.trim().length >= 3)
        ? videoPrompt.trim()
        : `Cinematic product video, ${productAnalysis?.product?.category || "premium product"}, soft studio lighting, slow camera movement, professional advertising style`;
      navigator.clipboard.writeText(promptText).then(() => {
        setVideoResult({ error: `Prompt copiado al portapapeles. Genera el video en ${selectedModel.label} → ${selectedModel.externalUrl || selectedModel.provider}` });
      });
      return;
    }
    if (!videoSourceUrl) {
      setVideoResult({ error: "Selecciona una imagen origen de la galería generada." });
      return;
    }
    setVideoGenerating(true);
    setVideoResult(null);
    try {
      const ratioMap = new Map(videoRatios.map(r => [r.key, r.runway]));
      const runwayRatio = ratioMap.get(videoAspectRatio) || "768:1280";
      const promptText = (videoPrompt && videoPrompt.trim().length >= 3)
        ? videoPrompt.trim()
        : `Cinematic product video, ${productAnalysis?.product?.category || "premium product"}, soft studio lighting, slow camera movement, professional advertising style`;

      const res = await fetch(`${API_BASE}/api/fusion-studio/generate-video`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          imageUrl: videoSourceUrl,
          promptText,
          model: videoModel,
          duration: videoDuration,
          ratio: runwayRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoResult({ error: data.error || `Error ${res.status}` });
        return;
      }
      setVideoResult({ url: data.videoUrl, model: data.model, duration: data.durationSec ?? data.duration });
    } catch (e: any) {
      setVideoResult({ error: e?.message || "Error de red al generar video" });
    } finally {
      setVideoGenerating(false);
    }
  }, [projectId, videoModel, videoDuration, videoAspectRatio, videoPrompt, videoSourceUrl, productAnalysis, videoRatios, videoModels]);

  const fetchBrandDNA = useCallback(async () => {
    if (!brandUrl && !instagram && !companyName) return;
    setIsFetchingBrand(true);
    setBrandError("");
    try {
      const res = await fetch(`${API_BASE}/api/fusion-studio/brand-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: brandUrl, instagram, companyName, niche, brandStyle, colors: brandColors }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error de red" }));
        throw new Error(errData.error || "Error investigando marca");
      }
      const data = await res.json();
      const dna = data.brandDna;
      const merged = {
        name: dna.brandInfo?.name || companyName || "Marca",
        sector: dna.brandInfo?.sector || niche || "",
        audience: dna.brandInfo?.audience || "",
        style: dna.brandInfo?.style || brandStyle || "",
        colors: dna.brandInfo?.colors || brandColors,
        values: dna.brandInfo?.values || [],
        photographyStyle: dna.brandInfo?.photographyStyle || "",
        instagramAesthetic: dna.instagramInfo?.aesthetic || null,
        designAdjectives: dna.brandInfo?.designAdjectives || [],
        raw: dna,
      };
      setBrandDna(merged);
      setPhase("product");
    } catch (err: any) {
      setBrandError(err.message || "Error investigando marca");
    } finally {
      setIsFetchingBrand(false);
    }
  }, [brandUrl, instagram, companyName, niche, brandStyle, brandColors]);

  const handleProductUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      setProductFiles(prev => [...prev.slice(0, 4), file]);
      const reader = new FileReader();
      reader.onload = () => setProductImages(prev => [...prev.slice(0, 4), reader.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleModelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModelFile(file);
    const reader = new FileReader();
    reader.onload = () => setModelImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleRefUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setReferenceImages(prev => [...prev.slice(0, 7), reader.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);

  const analyzeProduct = useCallback(async () => {
    if (productFiles.length === 0) return;
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      productFiles.forEach(f => formData.append("images", f));
      formData.append("projectId", String(projectId));
      if (niche) formData.append("niche", niche);
      if (brandStyle) formData.append("brandTone", brandStyle);

      const res = await fetch(`${API_BASE}/api/fusion-studio/analyze`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("Error analizando producto");
      const data = await res.json();
      setProductAnalysis(data.analysis);

      try {
        const suggestRes = await fetch(`${API_BASE}/api/fusion-studio/auto-suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ productAnalysis: data.analysis, brandDna: brandDna?.raw || null }),
        });
        if (suggestRes.ok) {
          const suggestData = await suggestRes.json();
          const s = suggestData.suggestions;
          if (s) {
            setLighting(s.lighting || "studio-3pt");
            setBackground(s.background || "white-pure");
            setPerspective(s.perspective || "3/4 (45°)");
            setAutoSuggestReasoning(s.reasoning || "");
          }
        }
      } catch {}

      setPhase("generate");
    } catch (err: any) {
      alert(err.message || "Error analizando producto");
    } finally {
      setIsAnalyzing(false);
    }
  }, [productFiles, projectId, niche, brandStyle, brandDna]);

  useEffect(() => {
    if (productFiles.length > 0 && !productAnalysis && !isAnalyzing && phase === "product") {
      analyzeProduct();
    }
  }, [productFiles, productAnalysis, isAnalyzing, analyzeProduct, phase]);

  const generatePhotos = useCallback(async () => {
    if (productFiles.length === 0 || selectedModes.length === 0) return;
    setIsGenerating(true);
    setPhase("gallery");
    setGenerationWarning("");
    setTotalCost(0);
    try {
      const formData = new FormData();
      productFiles.forEach(f => formData.append("images", f));
      if (modelFile) formData.append("images", modelFile);
      formData.append("projectId", String(projectId));
      formData.append("modes", JSON.stringify(selectedModes));
      formData.append("lighting", lighting);
      formData.append("background", background);
      formData.append("perspective", perspective);
      formData.append("quantity", String(quantity));
      formData.append("brandDna", JSON.stringify(brandDna?.raw || null));
      formData.append("extraPrompt", extraPrompt);
      formData.append("outputFormat", outputFormat);
      if (customScene) formData.append("customScene", customScene);
      formData.append("hasModel", String(!!modelFile));
      if (referenceImages.length > 0) formData.append("referenceStyles", JSON.stringify(referenceImages));

      const res = await fetch(`${API_BASE}/api/fusion-studio/generate-photos`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error de red" }));
        throw new Error(errData.error || "Error generando fotos");
      }
      const data = await res.json();

      if (data.warning) setGenerationWarning(data.warning);
      if (data.totalCost) setTotalCost(data.totalCost);

      if (data.generatedImages && data.generatedImages.length > 0) {
        setGeneratedPhotos(data.generatedImages.map((img: any) => ({
          id: `${img.mode}-${img.index}`,
          mode: img.mode,
          label: PHOTO_MODES.find(m => m.id === img.mode)?.label || img.mode,
          prompt: img.prompt || "",
          imageUrl: img.imageUrl || null,
          model: img.model || "",
          cost: img.cost || 0,
          error: img.error || undefined,
        })));
      } else if (data.generationPlan) {
        setGeneratedPhotos(data.generationPlan.map((p: any) => ({
          id: `${p.mode}-${p.index}`,
          mode: p.mode,
          label: PHOTO_MODES.find(m => m.id === p.mode)?.label || p.mode,
          prompt: p.prompt || p.contextPrompt || "",
          imageUrl: null,
          model: "",
          cost: 0,
        })));
      }
    } catch (err: any) {
      alert(err.message || "Error generando fotos");
      setPhase("generate");
    } finally {
      setIsGenerating(false);
    }
  }, [productFiles, modelFile, projectId, selectedModes, lighting, background, perspective, quantity, brandDna, extraPrompt, outputFormat, customScene]);

  const toggleMode = (id: string) => setSelectedModes(p => p.includes(id) ? p.filter(m => m !== id) : [...p, id]);
  const hasModel = !!modelImage;
  const isApparel = !!(productAnalysis?.sceneClassification?.isFashion ||
    (productAnalysis?.product?.category || "").toLowerCase().match(/apparel|fashion|clothing|ropa|moda|camiset|t-shirt|shirt|hoodie|jacket|sweater|polo/));

  useEffect(() => {
    if (!productAnalysis) return;
    if (isApparel) {
      setSelectedModes(["tryon-front", "tryon-back"]);
    } else {
      setSelectedModes(prev => prev.filter(m => !m.startsWith("tryon-")).length > 0
        ? prev.filter(m => !m.startsWith("tryon-"))
        : ["hero", "lifestyle"]);
    }
  }, [productAnalysis, isApparel]);

  const tryonModes = PHOTO_MODES.filter(m => m.cat === "tryon");
  const productModes = PHOTO_MODES.filter(m => m.cat === "product");
  const modelModes = PHOTO_MODES.filter(m => m.cat === "model");
  const sceneModes = PHOTO_MODES.filter(m => m.cat === "scene");
  const socialModes = PHOTO_MODES.filter(m => m.cat === "social");
  const totalPhotos = selectedModes.length * quantity;

  const V = {
    root: { minHeight: "100vh", background: "#08080c", color: "#e2e2e8", fontFamily: "'Satoshi', 'DM Sans', sans-serif" } as React.CSSProperties,
    header: { padding: "14px 24px", borderBottom: "1px solid #1a1a22", display: "flex", alignItems: "center", gap: 16, background: "#0c0c12", flexWrap: "wrap" as const } as React.CSSProperties,
    brand: { display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" } as React.CSSProperties,
    brandIcon: { width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#c8a84b,#8a6d2b)", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 900, color: "#08080c" } as React.CSSProperties,
    brandText: { fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" } as React.CSSProperties,
    brandSub: { fontSize: 9, color: "#c8a84b88", letterSpacing: "0.18em", textTransform: "uppercase" as const } as React.CSSProperties,
    phases: { display: "flex", gap: 2, margin: isMobile ? "8px 0" : "0 auto", background: "#12121a", borderRadius: 8, padding: 2, flexWrap: "wrap" as const } as React.CSSProperties,
    phaseBtn: (a: boolean): React.CSSProperties => ({ padding: "7px 20px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: a ? "#c8a84b18" : "transparent", color: a ? "#f0d68a" : "#666", transition: "all .2s" }),
    body: (isMobile ? { display: "flex", flexDirection: "column" as const, minHeight: "calc(100vh - 55px)" } : { display: "flex", minHeight: "calc(100vh - 55px)" }) as React.CSSProperties,
    sidebar: (isMobile ? { width: "100%", padding: 18, borderBottom: "1px solid #1a1a22" } : { width: 320, borderRight: "1px solid #1a1a22", padding: 18, overflowY: "auto" as const, maxHeight: "calc(100vh - 55px)", flexShrink: 0 }) as React.CSSProperties,
    main: (isMobile ? { flex: 1, padding: 16, overflowY: "auto" as const } : { flex: 1, padding: 24, overflowY: "auto" as const, maxHeight: "calc(100vh - 55px)" }) as React.CSSProperties,
    right: (isMobile ? { width: "100%", padding: 18, borderTop: "1px solid #1a1a22" } : { width: 280, borderLeft: "1px solid #1a1a22", padding: 18, overflowY: "auto" as const, maxHeight: "calc(100vh - 55px)", flexShrink: 0 }) as React.CSSProperties,
    sec: { marginBottom: 22 } as React.CSSProperties,
    secTitle: { fontSize: 10, fontWeight: 700, color: "#c8a84b99", letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 } as React.CSSProperties,
    input: { width: "100%", background: "#12121a", border: "1px solid #22222e", borderRadius: 8, padding: "9px 12px", color: "#e2e2e8", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
    select: { width: "100%", background: "#12121a", border: "1px solid #22222e", borderRadius: 8, padding: "9px 12px", color: "#e2e2e8", fontSize: 12, fontFamily: "inherit", outline: "none", appearance: "none" as const, boxSizing: "border-box" as const } as React.CSSProperties,
    textarea: { width: "100%", background: "#12121a", border: "1px solid #22222e", borderRadius: 8, padding: "10px 12px", color: "#e2e2e8", fontSize: 12, fontFamily: "inherit", resize: "vertical" as const, minHeight: 56, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
    uploadZone: (has: boolean): React.CSSProperties => ({ width: "100%", aspectRatio: "5/3", borderRadius: 12, border: has ? "2px solid #c8a84b44" : "2px dashed #22222e", background: has ? "transparent" : "#0c0c12", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative", transition: "all .25s" }),
    uploadMini: (has: boolean): React.CSSProperties => ({ width: 56, height: 56, borderRadius: 8, border: has ? "1.5px solid #c8a84b44" : "1.5px dashed #22222e", display: "grid", placeItems: "center", cursor: "pointer", overflow: "hidden", fontSize: has ? 0 : 18, color: "#333", flexShrink: 0 }),
    chip: (a: boolean, gold?: boolean): React.CSSProperties => ({ padding: "7px 11px", borderRadius: 7, border: a ? `1.5px solid ${gold ? "#c8a84b66" : "#4466ff66"}` : "1px solid #1a1a22", background: a ? (gold ? "#c8a84b0d" : "#4466ff0d") : "#0c0c12", cursor: "pointer", fontSize: 11, color: a ? (gold ? "#f0d68a" : "#88aaff") : "#666", fontWeight: a ? 600 : 400, transition: "all .2s", textAlign: "left" }),
    modeCard: (a: boolean, sug?: boolean): React.CSSProperties => ({ padding: "10px 12px", borderRadius: 9, border: a ? "1.5px solid #c8a84b55" : sug ? "1px solid #c8a84b22" : "1px solid #16161e", background: a ? "#c8a84b08" : "#0e0e14", cursor: "pointer", transition: "all .2s" }),
    goldBtn: (dis: boolean): React.CSSProperties => ({ width: "100%", padding: 14, borderRadius: 10, border: "none", background: dis ? "#333" : "linear-gradient(135deg,#c8a84b,#9a7a30)", color: dis ? "#666" : "#08080c", fontSize: 13, fontWeight: 700, cursor: dis ? "default" : "pointer", letterSpacing: "-0.01em" }),
    badge: (c: string): React.CSSProperties => ({ display: "inline-flex", padding: "2px 8px", borderRadius: 12, fontSize: 9, fontWeight: 600, background: `${c}14`, color: c, border: `1px solid ${c}28` }),
    colorDot: (h: string): React.CSSProperties => ({ width: 18, height: 18, borderRadius: "50%", background: h, border: "1.5px solid #22222e", cursor: "pointer", flexShrink: 0 }),
    dnaCard: { background: "#c8a84b06", border: "1px solid #c8a84b18", borderRadius: 10, padding: 14 } as React.CSSProperties,
    guardCard: { background: "#4466ff06", border: "1px solid #4466ff18", borderRadius: 10, padding: 14 } as React.CSSProperties,
    statNum: { fontSize: 28, fontWeight: 800, color: "#f0d68a", lineHeight: 1 } as React.CSSProperties,
    statLabel: { fontSize: 9, color: "#666", marginTop: 2 } as React.CSSProperties,
    galleryGrid: { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(220px,1fr))", gap: 14 } as React.CSSProperties,
    galleryCard: { borderRadius: 10, overflow: "hidden", border: "1px solid #1a1a22", background: "#0e0e14", cursor: "pointer", transition: "all .2s" } as React.CSSProperties,
    accordionHeader: { cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" } as React.CSSProperties,
  };

  const img100: React.CSSProperties = { width: "100%", height: "100%", objectFit: "contain" };
  const img100cover: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

  const renderAccordionOrDirect = (key: string, title: string, content: React.ReactNode) => {
    if (!isMobile) return content;
    return (
      <div style={{ marginBottom: 12, borderBottom: "1px solid #1a1a22" }}>
        <div style={V.accordionHeader} onClick={() => toggleAccordion(key)}>
          <div style={V.secTitle}>{title}</div>
          <span style={{ color: "#666", fontSize: 14 }}>{accordionOpen[key] ? "▾" : "▸"}</span>
        </div>
        {accordionOpen[key] && content}
      </div>
    );
  };

  return (
    <div style={V.root}>
      <div style={V.header}>
        <div style={V.brand}>
          <div style={V.brandIcon}>F</div>
          <div>
            <div style={V.brandText}>Fusion Studio</div>
            <div style={V.brandSub}>{viewMode === "workflow" ? "Product Intelligence" : "Estudio Pro · 8 herramientas"}</div>
          </div>
        </div>
        {/* MODE TOGGLE: Workflow Guiado vs Estudio Pro */}
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: "#0a0a14", border: "1px solid #22222e" }}>
          <button
            data-testid="button-mode-workflow"
            onClick={() => setViewMode("workflow")}
            style={{
              padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
              background: viewMode === "workflow" ? "linear-gradient(135deg, rgba(200,168,75,0.18), rgba(200,168,75,0.05))" : "transparent",
              color: viewMode === "workflow" ? "#c8a84b" : "#888",
            }}>
            🧬 Workflow Guiado
          </button>
          <button
            data-testid="button-mode-pro"
            onClick={() => setViewMode("pro")}
            style={{
              padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none",
              background: viewMode === "pro" ? "linear-gradient(135deg, rgba(200,168,75,0.18), rgba(200,168,75,0.05))" : "transparent",
              color: viewMode === "pro" ? "#c8a84b" : "#888",
            }}>
            ✨ Estudio Pro
          </button>
        </div>
        {viewMode === "workflow" ? (
          <div style={V.phases}>
            {([["brand", "① Marca"], ["product", "② Producto"], ["generate", "③ Generar"], ["gallery", "④ Galería"]] as const).map(([id, label]) => (
              <button key={id} style={V.phaseBtn(phase === id)} onClick={() => setPhase(id as Phase)}>{label}</button>
            ))}
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {brandDna && <span style={V.badge("#c8a84b")}>{brandDna.name}</span>}
          {productAnalysis && <span style={V.badge("#44cc88")}>{(productAnalysis.product?.category || "").split("/")[0].trim()}</span>}
          {totalPhotos > 0 && phase === "generate" && viewMode === "workflow" && <span style={V.badge("#6688ff")}>{totalPhotos} fotos</span>}
        </div>
      </div>

      {viewMode === "pro" && (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
          <FusionStudioPro projectId={projectId} />
        </div>
      )}

      {viewMode === "workflow" && (
      <div style={V.body}>
        {phase === "brand" && (
          <div style={{ ...V.main, maxWidth: 720, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 6 }}>Inteligencia de Marca</div>
              <div style={{ fontSize: 13, color: "#666", maxWidth: 500, margin: "0 auto" }}>
                Cuanta más información proporciones, más precisas serán las fotos. La IA investigará la marca en Google e Instagram para entender su estética real.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
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

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 20 }}>
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
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {brandColors.map((c, i) => (
                  <label key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <input type="color" value={c} onChange={e => setBrandColors(p => p.map((x, j) => j === i ? e.target.value : x))} style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", padding: 0 }} />
                    <span style={{ fontSize: 9, color: "#555", fontFamily: "monospace" }}>{c}</span>
                  </label>
                ))}
                <button onClick={() => setBrandColors(p => [...p, "#888888"])} style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px dashed #22222e", background: "none", color: "#444", fontSize: 18, cursor: "pointer" }}>+</button>
              </div>
            </div>

            <button
              style={V.goldBtn(isFetchingBrand || (!brandUrl && !instagram && !companyName))}
              onClick={fetchBrandDNA}
              disabled={isFetchingBrand || (!brandUrl && !instagram && !companyName)}
            >
              {isFetchingBrand ? "⟳ Investigando marca en Google + Instagram..." : "🔍 Investigar Marca y Extraer DNA"}
            </button>

            {brandError && <div style={{ color: "#ff6666", fontSize: 12, marginTop: 8, textAlign: "center" }}>{brandError}</div>}

            {!brandUrl && !instagram && !companyName && (
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <button onClick={() => setPhase("product")} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}>
                  Saltar → ir directo al producto
                </button>
              </div>
            )}

            {brandDna && (
              <div style={{ ...V.dnaCard, marginTop: 20 }}>
                <div style={{ ...V.secTitle, color: "#c8a84b" }}>Brand DNA Extraído</div>
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
        )}

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
                      <div style={{ fontSize: 11, fontWeight: 600 }}>Modelo de referencia (opcional)</div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>Si no subes modelo, la IA generará uno automáticamente para Try-On</div>
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

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>CATEGORÍA</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{productAnalysis.product?.category}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{productAnalysis.product?.subcategory}</div>
                    </div>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>MATERIALES</div>
                      {productAnalysis.product?.estimatedMaterials?.map((m: string, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>• {m}</div>
                      ))}
                    </div>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>COMPOSICIÓN</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{productAnalysis.composition?.layout}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{productAnalysis.composition?.perspective}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{productAnalysis.composition?.lighting}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>TEXTURAS</div>
                      {productAnalysis.textures?.map((t: any, i: number) => (
                        <div key={i} style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>• {t.material} ({t.finish})</div>
                      ))}
                    </div>
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#c8a84b", marginBottom: 6 }}>COLORES DETECTADOS</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {productAnalysis.colors?.dominant?.map((c: string, i: number) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={V.colorDot(c)} />
                            <span style={{ fontSize: 10, color: "#888", fontFamily: "monospace" }}>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {autoSuggestReasoning && (
                    <div style={V.dnaCard}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#44cc88", marginBottom: 6 }}>💡 AUTO-INTELIGENCIA — La IA ha elegido la configuración óptima</div>
                      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                        <strong>Iluminación:</strong> {LIGHTING.find(l => l.id === lighting)?.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                        <strong>Fondo:</strong> {BACKGROUNDS.find(b => b.id === background)?.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa", marginBottom: 4 }}>
                        <strong>Perspectiva:</strong> {perspective}
                      </div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 8, fontStyle: "italic" }}>{autoSuggestReasoning}</div>
                    </div>
                  )}

                  <button onClick={() => setPhase("generate")} style={{ ...V.goldBtn(false), marginTop: 16 }}>
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
                      {brandDna.colors?.map((c: string, i: number) => <div key={i} style={V.colorDot(c)} />)}
                    </div>
                  </div>
                </div>
                <div style={V.guardCard}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#6688ff", letterSpacing: "0.1em", marginBottom: 6 }}>IA GUARD</div>
                  <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                    {isApparel
                      ? `Prenda detectada. Try-On disponible: la IA ${hasModel ? "usará tu modelo" : "generará modelos IA"} vistiendo tu producto EXACTO.`
                      : hasModel
                        ? "Producto + Modelo detectados. La IA posicionará la persona USANDO/SOSTENIENDO el producto."
                        : "Solo producto. La IA respetará forma, materiales y proporciones exactas."}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {phase === "generate" && (
          <>
            <div style={V.sidebar}>
              {renderAccordionOrDirect("lighting", "💡 Iluminación", (
                <div style={V.sec}>
                  {!isMobile && <div style={V.secTitle}>💡 Iluminación</div>}
                  {LIGHTING.map(l => (
                    <div key={l.id} style={{ ...V.chip(lighting === l.id, true), marginBottom: 3, display: "block" }} onClick={() => setLighting(l.id)}>
                      {l.icon} {l.label}
                    </div>
                  ))}
                </div>
              ))}
              {renderAccordionOrDirect("background", "🖼️ Fondo", (
                <div style={V.sec}>
                  {!isMobile && <div style={V.secTitle}>🖼️ Fondo</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {BACKGROUNDS.map(bg => (
                      <div key={bg.id} style={{ ...V.chip(background === bg.id, true), display: "flex", alignItems: "center", gap: 5 }} onClick={() => setBackground(bg.id)}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: bg.preview, border: "1px solid #333", flexShrink: 0 }} />
                        <span style={{ fontSize: 10 }}>{bg.label}</span>
                      </div>
                    ))}
                  </div>
                  {background === "scene-custom" && (
                    <textarea style={{ ...V.textarea, marginTop: 6 }} placeholder="Describe la escena..." value={customScene} onChange={e => setCustomScene(e.target.value)} />
                  )}
                </div>
              ))}
              {renderAccordionOrDirect("perspective", "📐 Perspectiva", (
                <div style={V.sec}>
                  {!isMobile && <div style={V.secTitle}>📐 Perspectiva</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {PERSPECTIVES.map(p => (
                      <div key={p} style={V.chip(perspective === p, true)} onClick={() => setPerspective(p)}>{p}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={V.main}>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.02em" }}>Sesión de Fotos</div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Selecciona los tipos de foto. Los marcados con ★ son sugeridos por la IA según tu producto.</div>

              {[
                ...(isApparel ? [{ label: "👕 Virtual Try-On — Tu prenda EXACTA en modelo IA", modes: tryonModes, highlight: true }] : []),
                { label: "Producto Solo", modes: productModes, highlight: false },
                ...(hasModel ? [{ label: "Con Modelo (IA creativa)", modes: modelModes, highlight: false }] : []),
                { label: "Escenas", modes: sceneModes, highlight: false },
                { label: "Social Media", modes: socialModes, highlight: false },
              ].map(group => (
                <div key={group.label} style={{ marginBottom: 16, ...(group.highlight ? { background: "#c8a84b08", border: "1px solid #c8a84b22", borderRadius: 12, padding: 14 } : {}) }}>
                  <div style={{ ...V.secTitle, color: group.highlight ? "#c8a84b" : "#888" }}>{group.label}</div>
                  {group.highlight && <div style={{ fontSize: 10, color: "#888", marginBottom: 8, marginTop: -4 }}>La IA detecta frente/espalda de tu prenda y genera modelos IA vistiéndola. Si subes foto de modelo, usará esa persona.</div>}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 6 }}>
                    {group.modes.map(mode => {
                      const a = selectedModes.includes(mode.id);
                      const sug = productAnalysis?.productGeneration?.photoBriefs?.some((b: any) => b.type?.toLowerCase().includes(mode.id));
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

              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
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
                <div style={{ marginLeft: "auto", textAlign: "center" }}>
                  <div style={V.statNum}>{totalPhotos}</div>
                  <div style={V.statLabel}>fotos totales</div>
                </div>
              </div>

              <button
                style={V.goldBtn(productFiles.length === 0 || selectedModes.length === 0 || isGenerating)}
                onClick={generatePhotos}
                disabled={productFiles.length === 0 || selectedModes.length === 0 || isGenerating}
              >
                {isGenerating ? "⟳ Generando sesión de fotos..." : `✦ Generar ${totalPhotos} Fotos Profesionales`}
              </button>

              <div style={{ marginTop: 14 }}>
                <LiveOperation
                  active={isGenerating}
                  title={`Generando ${totalPhotos} fotos profesionales`}
                  estimatedSec={Math.max(60, totalPhotos * 12)}
                  messages={[
                    "Subiendo y analizando tus imágenes de producto…",
                    "Aplicando los modos seleccionados con Flux/SDXL…",
                    "Cada foto puede tardar 8-15 segundos por modelo IA.",
                    "El servidor sigue trabajando aunque cierres esta pestaña.",
                    "Revisaremos cada salida antes de mostrártela.",
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div style={V.right}>
              {productAnalysis && (
                <div style={V.sec}>
                  <div style={V.secTitle}>📦 Producto</div>
                  {productImages[0] && (
                    <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                      <img src={productImages[0]} style={img100} alt="" />
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{productAnalysis.product?.category}</div>
                  <div style={{ fontSize: 10, color: "#666" }}>{productAnalysis.product?.estimatedMaterials?.join(" · ")}</div>
                </div>
              )}
              {brandDna && (
                <div style={{ ...V.dnaCard, marginBottom: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#c8a84b", marginBottom: 4 }}>BRAND DNA</div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{brandDna.name}</div>
                  <div style={{ fontSize: 10, color: "#888" }}>{brandDna.style}</div>
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {brandDna.colors?.map((c: string, i: number) => <div key={i} style={V.colorDot(c)} />)}
                  </div>
                </div>
              )}
              <div style={V.guardCard}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#6688ff", marginBottom: 4 }}>IA GUARD</div>
                <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                  {isApparel && selectedModes.some(m => m.startsWith("tryon-"))
                    ? `Try-On activo: ${hasModel ? "tu modelo" : "modelo IA auto-generado"} vestirá tu prenda EXACTA.`
                    : hasModel ? "Modelo detectado. La persona USARÁ el producto, nunca se fusionarán." : "Solo producto. Forma y materiales se respetarán al 100%."}
                  {referenceImages.length > 0 && <><br />🎯 {referenceImages.length} ref. — estilo y composición se imitarán.</>}
                  {brandDna && <><br />🧬 Brand DNA activo — colores, estilo y audiencia inyectados.</>}
                </div>
              </div>
            </div>
          </>
        )}

        {phase === "gallery" && (
          <div style={{ ...V.main, maxWidth: "100%" }}>
            {isGenerating ? (
              <div style={{ textAlign: "center", padding: 80 }}>
                <div style={{ fontSize: 40, marginBottom: 16, animation: "spin 2s linear infinite" }}>✦</div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Generando fotos con IA...</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{totalPhotos} fotos profesionales · {selectedModes.length} modos · {quantity} por modo</div>
                <div style={{ fontSize: 11, color: "#555", maxWidth: 420, margin: "0 auto" }}>
                  Analizando producto, generando prompts especializados y renderizando con Replicate. Esto puede tardar varios minutos...
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#f0d68a" }}>
                      {generatedPhotos.some(p => p.imageUrl) ? "Fotos Generadas" : "Sesión Configurada"}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {generatedPhotos.filter(p => p.imageUrl).length > 0
                        ? `${generatedPhotos.filter(p => p.imageUrl).length}/${generatedPhotos.length} fotos generadas${totalCost > 0 ? ` · $${totalCost.toFixed(3)} USD` : ""}`
                        : `${generatedPhotos.length} prompts generados — configura tu token de Replicate para generar imágenes`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setPhase("generate")} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #22222e", background: "transparent", color: "#aaa", fontSize: 11, cursor: "pointer" }}>← Editar sesión</button>
                    <button
                      onClick={createProductInShopify}
                      disabled={creatingProduct || productFiles.length === 0}
                      title={productFiles.length === 0 ? "Sube al menos 1 imagen del producto" : "Crear producto en la tienda del cliente con las imágenes subidas"}
                      style={{
                        padding: "8px 16px", borderRadius: 8,
                        border: "1px solid #c8a84b44",
                        background: creatingProduct ? "#c8a84b22" : "linear-gradient(135deg, #c8a84b, #a88b3a)",
                        color: creatingProduct ? "#c8a84b" : "#000",
                        fontSize: 11, fontWeight: 700, cursor: creatingProduct || productFiles.length === 0 ? "not-allowed" : "pointer",
                        opacity: productFiles.length === 0 ? 0.45 : 1,
                      }}
                    >
                      {creatingProduct ? "Creando…" : "🛍️ Crear producto en Shopify"}
                    </button>
                  </div>
                </div>

                {createdProductResult && !createdProductResult.error && (
                  <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.3)", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 20 }}>✅</div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#2dd49f", marginBottom: 2 }}>Producto creado en Shopify</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>
                        {createdProductResult.title}{createdProductResult.id ? ` · ID: ${createdProductResult.id}` : ""}
                      </div>
                      {(createdProductResult.refCount !== undefined || createdProductResult.genCount !== undefined) && (
                        <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
                          📸 {createdProductResult.refCount ?? 0} de referencia · ✨ {createdProductResult.genCount ?? 0} generadas IA
                        </div>
                      )}
                    </div>
                    {createdProductResult.url && (
                      <a href={createdProductResult.url} target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(45,212,159,0.3)", color: "#2dd49f", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                        Abrir en Shopify →
                      </a>
                    )}
                  </div>
                )}
                {createdProductResult?.error && (
                  <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.3)", marginBottom: 16, fontSize: 12, color: "#ff8a95" }}>
                    ⚠ {createdProductResult.error}
                  </div>
                )}

                {generationWarning && (
                  <div style={{ padding: "12px 16px", borderRadius: 8, background: "#c8a84b12", border: "1px solid #c8a84b33", marginBottom: 16, fontSize: 12, color: "#f0d68a" }}>
                    {generationWarning}
                  </div>
                )}

                <div style={V.galleryGrid}>
                  {generatedPhotos.map(photo => (
                    <div key={photo.id} style={V.galleryCard}>
                      <div style={{ aspectRatio: "1/1", background: "#0a0a0f", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {photo.imageUrl ? (
                          <img src={photo.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={photo.label} loading="lazy" />
                        ) : photo.error ? (
                          <div style={{ textAlign: "center", padding: 16 }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>⚠</div>
                            <div style={{ fontSize: 10, color: "#ff6b6b" }}>Error</div>
                            <div style={{ fontSize: 9, color: "#553333", marginTop: 4, maxWidth: 160 }}>{photo.error.slice(0, 80)}</div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: 16 }}>
                            <div style={{ fontSize: 24, marginBottom: 8, color: "#333" }}>✦</div>
                            <div style={{ fontSize: 10, color: "#444" }}>Solo prompt</div>
                          </div>
                        )}
                        {photo.imageUrl && (
                          <div style={{ position: "absolute", top: 6, right: 6, padding: "2px 6px", borderRadius: 4, background: "#000a", fontSize: 8, color: "#0f0", fontWeight: 600 }}>IA</div>
                        )}
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: photo.imageUrl ? "#f0d68a" : "#666" }}>{photo.label}</div>
                        {photo.model && <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>{photo.model.split("/").pop()}</div>}
                        {photo.cost > 0 && <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>${photo.cost.toFixed(3)}</div>}
                        <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                          {photo.imageUrl && (
                            <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #c8a84b44", background: "none", color: "#c8a84b", fontSize: 9, fontWeight: 600, cursor: "pointer", textAlign: "center", textDecoration: "none" }}>
                              Descargar
                            </a>
                          )}
                          <button
                            onClick={() => {
                              const el = document.createElement("textarea");
                              el.value = photo.prompt;
                              document.body.appendChild(el);
                              el.select();
                              document.execCommand("copy");
                              document.body.removeChild(el);
                            }}
                            style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid #22222e", background: "none", color: "#666", fontSize: 9, cursor: "pointer" }}
                          >
                            Copiar Prompt
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ─── VIDEO ADVERTISING PANEL ─── (siempre visible; el botón se deshabilita si no hay fotos) */}
                <div style={{ marginTop: 32, padding: 20, borderRadius: 12, background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(168,85,247,0.04))", border: "1px solid rgba(99,102,241,0.25)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#a5b4fc", display: "flex", alignItems: "center", gap: 8 }}>
                          🎬 Generar video publicitario IA
                        </h3>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>
                          Multi-plataforma: Runway (integrado), Seedance, Kling, Pollo.ai, Veo. Para Reels, TikTok, anuncios.
                        </p>
                      </div>
                    </div>

                    {/* MODEL PICKER */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Modelo IA</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6 }}>
                        {videoModels.map(m => {
                          const isIntegrated = m.integrated !== false;
                          const badgeColor = isIntegrated
                            ? (m.badge === "PREMIUM" ? "rgba(168,85,247,0.2)" : "rgba(45,212,159,0.15)")
                            : "rgba(251,191,36,0.15)";
                          const badgeTextColor = isIntegrated
                            ? (m.badge === "PREMIUM" ? "#c084fc" : "#2dd49f")
                            : "#fbbf24";
                          return (
                          <button key={m.key} onClick={() => setVideoModel(m.key)}
                            style={{
                              padding: "10px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer", textAlign: "left", lineHeight: 1.3,
                              background: videoModel === m.key ? "rgba(99,102,241,0.15)" : "#0a0a14",
                              border: `1px solid ${videoModel === m.key ? "#6366f1" : "#22222e"}`,
                              color: videoModel === m.key ? "#a5b4fc" : "#aaa",
                            }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <strong style={{ fontSize: 12 }}>{m.label}</strong>
                              {m.badge && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 8, background: badgeColor, color: badgeTextColor, fontWeight: 700 }}>{m.badge}</span>}
                            </div>
                            <div style={{ fontSize: 10, color: "#666" }}>{m.description}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
                              <span style={{ fontSize: 9, color: "#555" }}>${m.costPerSec}/seg · {m.maxResolution || "1080p"}</span>
                              {!isIntegrated && <span style={{ fontSize: 8, color: "#fbbf24" }}>externo</span>}
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* DURATION + RATIO */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Duración</label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {videoDurations.map(d => (
                            <button key={d} onClick={() => setVideoDuration(d)}
                              style={{ flex: 1, padding: "8px 4px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", background: videoDuration === d ? "#6366f1" : "#0a0a14", color: videoDuration === d ? "#fff" : "#888", border: `1px solid ${videoDuration === d ? "#6366f1" : "#22222e"}` }}>
                              {d}s
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Aspecto</label>
                        <div style={{ display: "flex", gap: 4 }}>
                          {videoRatios.map(r => (
                            <button key={r.key} onClick={() => setVideoAspectRatio(r.key)} title={r.label}
                              style={{ flex: 1, padding: "8px 4px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", background: videoAspectRatio === r.key ? "#6366f1" : "#0a0a14", color: videoAspectRatio === r.key ? "#fff" : "#888", border: `1px solid ${videoAspectRatio === r.key ? "#6366f1" : "#22222e"}` }}>
                              {r.key}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* PROMPT */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>Prompt creativo (opcional)</label>
                      <textarea value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)}
                        placeholder="Slow camera dolly-in, soft cinematic lighting, premium product reveal..."
                        style={{ width: "100%", minHeight: 50, padding: 10, borderRadius: 8, background: "#0a0a14", border: "1px solid #22222e", color: "#fff", fontSize: 12, fontFamily: "inherit", resize: "vertical" }} />
                    </div>

                    {/* IMAGE SOURCE PICKER from gallery */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, display: "block" }}>
                        Imagen origen {videoSourceUrl ? "(elegida de la galería)" : "(usará la primera del producto)"}
                      </label>
                      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                        <div onClick={() => setVideoSourceUrl("")} style={{ flex: "0 0 60px", height: 60, borderRadius: 6, border: !videoSourceUrl ? "2px solid #6366f1" : "1px solid #22222e", background: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 9, color: "#666", textAlign: "center", padding: 4 }}>
                          Producto<br/>original
                        </div>
                        {generatedPhotos.filter(p => p.imageUrl).map(photo => (
                          <div key={photo.id} onClick={() => setVideoSourceUrl(photo.imageUrl!)}
                            style={{ flex: "0 0 60px", height: 60, borderRadius: 6, border: videoSourceUrl === photo.imageUrl ? "2px solid #6366f1" : "1px solid #22222e", overflow: "hidden", cursor: "pointer", position: "relative" }}>
                            <img src={photo.imageUrl ?? undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={photo.label} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PROMPT TIPS for external models */}
                    {(() => {
                      const sel = videoModels.find(m => m.key === videoModel);
                      if (!sel || sel.integrated !== false || !sel.promptTips?.length) return null;
                      return (
                        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>Tips para {sel.label}:</div>
                          {sel.promptTips.map((tip: string, i: number) => (
                            <div key={i} style={{ fontSize: 10, color: "#aaa", marginBottom: 3 }}>• {tip}</div>
                          ))}
                          {sel.externalUrl && (
                            <a href={sel.externalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#818cf8", marginTop: 4, display: "inline-block" }}>
                              Abrir {sel.label} →
                            </a>
                          )}
                        </div>
                      );
                    })()}

                    {/* GENERATE BUTTON */}
                    {(() => {
                      const sel = videoModels.find(m => m.key === videoModel);
                      const isExternal = sel && sel.integrated === false;
                      const btnDisabled = videoGenerating || (!isExternal && !videoSourceUrl);
                      return (
                        <button onClick={generateVideo} disabled={btnDisabled} data-testid="button-generate-video"
                          style={{
                            width: "100%", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: btnDisabled ? "not-allowed" : "pointer",
                            background: videoGenerating ? "#1f1f3a" : isExternal ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #6366f1, #a855f7)",
                            color: "#fff", border: "none",
                            opacity: btnDisabled ? 0.5 : 1,
                          }}>
                          {videoGenerating
                            ? "🎥 Generando video... esto tarda 1-3 minutos"
                            : isExternal
                              ? `📋 Copiar prompt para ${sel?.label || videoModel}`
                              : `🎬 Generar video con ${sel?.label || videoModel}`}
                        </button>
                      );
                    })()}

                    <div style={{ marginTop: 12 }}>
                      <LiveOperation
                        active={videoGenerating}
                        title={`Generando video con ${videoModels.find(m => m.key === videoModel)?.label || videoModel}`}
                        estimatedSec={120}
                        messages={[
                          "Enviando frame de origen al modelo de video…",
                          "El motor está animando 24-30 fps por segundo de salida…",
                          "Renderizado MP4 con codec optimizado…",
                          "Esto tarda 1-3 minutos según duración y modelo.",
                          "El job continúa aunque cierres esta pestaña.",
                        ]}
                        className="w-full"
                      />
                    </div>

                    {/* RESULT */}
                    {videoResult?.url && (
                      <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.3)" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#2dd49f", marginBottom: 8 }}>
                          ✅ Video generado · {videoResult.model} · {videoResult.duration}s
                        </div>
                        <video src={videoResult.url} controls style={{ width: "100%", maxHeight: 400, borderRadius: 8, background: "#000" }} />
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <a href={videoResult.url} download target="_blank" rel="noopener noreferrer" style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(45,212,159,0.3)", color: "#2dd49f", fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
                            ⬇ Descargar MP4
                          </a>
                          <button onClick={() => setVideoResult(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #22222e", color: "#888", fontSize: 11, background: "transparent", cursor: "pointer" }}>
                            Generar otro
                          </button>
                        </div>
                      </div>
                    )}
                    {videoResult?.error && (
                      <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.3)", fontSize: 12, color: "#ff8a95" }}>
                        ⚠ {videoResult.error}
                      </div>
                    )}
                  </div>
              </>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
