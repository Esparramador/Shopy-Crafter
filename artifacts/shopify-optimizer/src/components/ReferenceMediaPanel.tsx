import { useState, useRef, useCallback } from "react";
import {
  Upload, X, Brain, Loader2, ImageIcon, Video,
  ChevronDown, ChevronUp, Sparkles, AlertCircle,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ImageRef {
  id: string;
  name: string;
  base64: string;
  mediaType: string;
  preview: string;
  size: number;
}

interface ReferenceMediaPanelProps {
  projectId?: number;
  onIntelligenceReady?: (intelligence: string) => void;
  context?: string;
  style?: React.CSSProperties;
  collapsed?: boolean;
}

const MAX_SIZE_MB = 4;
const MAX_IMAGES = 5;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReferenceMediaPanel({
  projectId,
  onIntelligenceReady,
  context,
  style,
  collapsed: initialCollapsed = true,
}: ReferenceMediaPanelProps) {
  const [open, setOpen] = useState(!initialCollapsed);
  const [images, setImages] = useState<ImageRef[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [userContext, setUserContext] = useState(context ?? "");
  const [analyzing, setAnalyzing] = useState(false);
  const [intelligence, setIntelligence] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<"image" | "video">("image");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsBase64 = (file: File): Promise<{ base64: string; preview: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve({ base64: result.split(",")[1], preview: result });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      setError("Solo se aceptan imágenes (JPEG, PNG, WebP, GIF)");
      return;
    }
    const toAdd: ImageRef[] = [];
    for (const file of arr) {
      if (images.length + toAdd.length >= MAX_IMAGES) break;
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`"${file.name}" supera el límite de ${MAX_SIZE_MB}MB`);
        continue;
      }
      try {
        const { base64, preview } = await readFileAsBase64(file);
        toAdd.push({
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          base64,
          mediaType: file.type as ImageRef["mediaType"],
          preview,
          size: file.size,
        });
      } catch {
        setError(`Error al leer "${file.name}"`);
      }
    }
    if (toAdd.length > 0) {
      setImages((prev) => [...prev, ...toAdd].slice(0, MAX_IMAGES));
      setIntelligence(null);
    }
  }, [images]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }, [addFiles]);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setIntelligence(null);
  };

  const analyzeImages = async () => {
    if (images.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setIntelligence(null);
    try {
      const res = await fetch(`${API_BASE}/api/reference/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: projectId ?? null,
          context: userContext || undefined,
          images: images.map((img) => ({
            base64: img.base64,
            mediaType: img.mediaType,
            name: img.name,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setIntelligence(data.intelligence);
      onIntelligenceReady?.(data.intelligence);
    } catch (e: any) {
      setError(e.message ?? "Error al analizar. Inténtalo de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const analyzeVideo = async () => {
    if (!videoUrl && !videoDescription) return;
    setAnalyzing(true);
    setError(null);
    setIntelligence(null);
    try {
      const res = await fetch(`${API_BASE}/api/reference/analyze-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: videoUrl || undefined,
          description: videoDescription || undefined,
          context: userContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setIntelligence(data.intelligence);
      onIntelligenceReady?.(data.intelligence);
    } catch (e: any) {
      setError(e.message ?? "Error al analizar. Inténtalo de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const canAnalyzeImage = images.length > 0 && !analyzing;
  const canAnalyzeVideo = (!!videoUrl || !!videoDescription) && !analyzing;

  return (
    <div
      style={{
        border: "1px solid var(--ink3)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 16,
        ...style,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px",
          background: open ? "var(--ink2)" : "var(--ink1)",
          border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid var(--ink3)" : "none",
        }}
      >
        <Sparkles size={15} style={{ color: "var(--gold)", flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--t)" }}>
          Medios de referencia para IA
        </span>
        <span style={{ fontSize: 11, color: "var(--t4)", marginRight: 4 }}>
          {images.length > 0
            ? `${images.length} imagen${images.length > 1 ? "es" : ""}`
            : videoUrl
            ? "1 vídeo"
            : "opcional"}
        </span>
        {open ? <ChevronUp size={14} style={{ color: "var(--t4)" }} /> : <ChevronDown size={14} style={{ color: "var(--t4)" }} />}
      </button>

      {open && (
        <div style={{ padding: 16, background: "var(--ink2)" }}>
          <p style={{ fontSize: 12, color: "var(--t3)", marginBottom: 14, lineHeight: 1.6 }}>
            Sube imágenes o indica un vídeo de referencia. ShopyBrain extraerá estilo, colores, texturas, narrativa y todo el contexto visual para que la IA lo use al generar tu contenido.
          </p>

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {(["image", "video"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600,
                  background: activeTab === tab ? "var(--gold)" : "var(--ink3)",
                  color: activeTab === tab ? "#000" : "var(--t3)",
                  transition: "all 0.2s",
                }}
              >
                {tab === "image" ? <ImageIcon size={12} /> : <Video size={12} />}
                {tab === "image" ? "Imágenes" : "Vídeo"}
              </button>
            ))}
          </div>

          {activeTab === "image" && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "var(--gold)" : "var(--ink3)"}`,
                  borderRadius: 10, padding: "20px 16px",
                  textAlign: "center", cursor: "pointer",
                  background: dragOver ? "rgba(200,168,75,0.05)" : "var(--ink1)",
                  transition: "all 0.2s",
                  marginBottom: 12,
                }}
              >
                <Upload size={22} style={{ color: "var(--t4)", marginBottom: 8 }} />
                <div style={{ fontSize: 13, color: "var(--t2)", fontWeight: 600, marginBottom: 4 }}>
                  Arrastra imágenes aquí o haz clic para subir
                </div>
                <div style={{ fontSize: 11, color: "var(--t4)" }}>
                  JPEG, PNG, WebP · Máx. {MAX_SIZE_MB}MB por imagen · Hasta {MAX_IMAGES} imágenes
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                style={{ display: "none" }}
                onChange={handleFileInput}
              />

              {images.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  {images.map((img) => (
                    <div
                      key={img.id}
                      style={{
                        position: "relative", width: 80, height: 80,
                        borderRadius: 8, overflow: "hidden",
                        border: "1px solid var(--ink3)",
                      }}
                    >
                      <img
                        src={img.preview}
                        alt={img.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        style={{
                          position: "absolute", top: 3, right: 3,
                          width: 18, height: 18, borderRadius: "50%",
                          background: "rgba(0,0,0,0.75)", border: "none",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <X size={10} style={{ color: "#fff" }} />
                      </button>
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        background: "rgba(0,0,0,0.6)", fontSize: 9, color: "#fff",
                        padding: "2px 4px", textAlign: "center",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {formatBytes(img.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="Contexto adicional (ej: quiero un estilo más premium, colores oscuros...)"
                className="input-field"
                style={{ width: "100%", marginBottom: 12, fontSize: 12 }}
              />

              <button
                onClick={analyzeImages}
                disabled={!canAnalyzeImage}
                className="btn-primary"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 7,
                  opacity: !canAnalyzeImage ? 0.45 : 1,
                  padding: "10px 0",
                }}
              >
                {analyzing ? (
                  <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Analizando imágenes...</>
                ) : (
                  <><Brain size={14} /> Analizar con ShopyBrain</>
                )}
              </button>
            </>
          )}

          {activeTab === "video" && (
            <>
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => { setVideoUrl(e.target.value); setIntelligence(null); }}
                placeholder="URL del vídeo (YouTube, Vimeo, TikTok, etc.)"
                className="input-field"
                style={{ width: "100%", marginBottom: 10, fontSize: 12 }}
              />
              <textarea
                value={videoDescription}
                onChange={(e) => { setVideoDescription(e.target.value); setIntelligence(null); }}
                placeholder="Describe el vídeo: qué se ve, qué se dice, qué estilo tiene, qué duración tiene, qué muestra el producto, qué explica, cómo está editado..."
                className="input-field"
                rows={4}
                style={{ width: "100%", marginBottom: 10, fontSize: 12, resize: "vertical" }}
              />
              <input
                type="text"
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="Contexto (ej: quiero algo similar para mi tienda de cosméticos)"
                className="input-field"
                style={{ width: "100%", marginBottom: 12, fontSize: 12 }}
              />
              <button
                onClick={analyzeVideo}
                disabled={!canAnalyzeVideo}
                className="btn-primary"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 7,
                  opacity: !canAnalyzeVideo ? 0.45 : 1,
                  padding: "10px 0",
                }}
              >
                {analyzing ? (
                  <><Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Extrayendo contexto del vídeo...</>
                ) : (
                  <><Brain size={14} /> Extraer conocimiento del vídeo</>
                )}
              </button>
            </>
          )}

          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              marginTop: 12, padding: "10px 12px",
              background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.3)",
              borderRadius: 8,
            }}>
              <AlertCircle size={14} style={{ color: "var(--crim)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: "var(--crim)" }}>{error}</span>
            </div>
          )}

          {intelligence && (
            <div style={{
              marginTop: 14,
              padding: "14px 16px",
              background: "rgba(45,212,159,0.06)",
              border: "1px solid rgba(45,212,159,0.25)",
              borderRadius: 10,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 10, fontSize: 12, fontWeight: 700, color: "var(--jade)",
              }}>
                <Sparkles size={13} />
                Contexto extraído — ShopyBrain lo usará en la generación
              </div>
              <div style={{
                fontSize: 11, color: "var(--t3)", lineHeight: 1.7,
                maxHeight: 200, overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}>
                {intelligence}
              </div>
              <button
                onClick={() => onIntelligenceReady?.(intelligence)}
                style={{
                  marginTop: 10, fontSize: 11, color: "var(--gold)",
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  padding: 0, textDecoration: "underline",
                }}
              >
                <Brain size={11} /> Usar este contexto en la generación
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
