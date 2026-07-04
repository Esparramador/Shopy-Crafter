/**
 * ROLEX COSMOGRAPH DAYTONA — Production Story Sheet
 * Agency-grade creative brief with shot-by-shot breakdown,
 * AI prompts per scene, VO script, and Fusion Studio integration.
 *
 * Based on: cinematic_ad_anatomy template (seed:cinematic_ad_anatomy)
 * from Master Prompt Library v4.0.0
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, Play, Mic, Send, Clock, Camera, Eye,
  ChevronRight, Download, Zap, Copy, Check
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─────────────────────────────────────────────────────────────
   PRODUCTION DATA
───────────────────────────────────────────────────────────── */

const CAMPAIGN = {
  client: "ROLEX SA",
  product: "Cosmograph Daytona 116506",
  format: "Luxury Brand Film · 16:9 · 30s",
  style: "Cinematic Masterpiece — Anatomy / Deconstruction / Assembly",
  deliverables: ["Story Sheet PDF", "AI Video (Seedance 1 Pro)", "VO Audio (ElevenLabs eleven_v3)"],
  template: "seed:cinematic_ad_anatomy",
  recommendedModel: "seedance-pro",
  date: "Julio 2026",
};

const VO_SCRIPT = [
  { shot: 1, line: "There are watches. And then there is Daytona.", timing: "0–3s" },
  { shot: 2, line: "Platinum 950. The rarest material. Reserved for the rarest drivers.", timing: "3–8s" },
  { shot: 3, line: "Two hundred and ninety masterpiece components. Each one, a world unto itself.", timing: "8–13s" },
  { shot: 4, line: "Calibre 4130. Forty-four jewels. Seventy-two hours of uninterrupted precision.", timing: "13–18s" },
  { shot: 5, line: "Assembled by hand. Certified by time.", timing: "18–23s" },
  { shot: 6, line: "The Cosmograph Daytona. For those who set the pace.", timing: "23–28s" },
  { shot: 7, line: "", timing: "28–30s" },
];

interface Shot {
  num: number;
  name: string;
  type: "TITLE CARD" | "ECU" | "EXPLODE VIEW" | "MACRO" | "ASSEMBLY" | "WRIST SHOT" | "BRAND CARD";
  duration: number;
  camera: string;
  motion: string;
  description: string;
  image: string | null;
  objectPosition: string;
  aiPrompt: string;
  fusionModel: "seedance-pro" | "kling-3.0-omni" | "runway-gen4-turbo";
  fusionImageModel: "flux-kontext-max" | "aurora" | "recraft-v4";
  styleTag: string;
  segment: string;
}

const SHOTS: Shot[] = [
  {
    num: 1,
    name: "TITLE CARD — The Crown",
    type: "TITLE CARD",
    duration: 3,
    camera: "—",
    motion: "Fade up from black",
    description: "Pantalla platino oscuro. La corona Rolex aparece en destellos dorados, seguida de 'ROLEX' con tracking máximo. Subtítulo 'COSMOGRAPH DAYTONA' en clip-path reveal de izquierda a derecha.",
    image: null,
    objectPosition: "center",
    aiPrompt: "Pure black background, Rolex crown logo rendered in liquid platinum, high-key specular highlights, cinematic lens flare. Text 'COSMOGRAPH DAYTONA' in Cormorant Garamond italic, ultra-wide tracking. Luxury watchmaking aesthetic. 4K, ARRI ALEXA look.",
    fusionModel: "seedance-pro",
    fusionImageModel: "aurora",
    styleTag: "luxury",
    segment: "Apertura",
  },
  {
    num: 2,
    name: "HERO PRODUCT — Ice Blue",
    type: "ECU",
    duration: 5,
    camera: "ECU + Orbital dolly 3/4",
    motion: "Slow push-in, 3° orbital left → right, rack focus dial→bezel",
    description: "El Daytona sobre superficie platino especular. La esfera azul hielo capta la luz con micro-destellos en los índices Chromalight. El bisel Cerachrom marrón contrasta perfectamente. La corona Triplock se ve nítida a las 3 horas.",
    image: `${import.meta.env.BASE_URL}rolex-4-front-crop.png?v=4`,
    objectPosition: "center center",
    aiPrompt: `Extreme close-up of Rolex Cosmograph Daytona 116506 platinum, ice blue meteorite dial, chestnut Cerachrom ceramic bezel, 950 platinum case and bracelet. Placed on platinum specular surface. Ultra-shallow depth of field, 85mm tilt-shift. Light rays catch Chromalight indices. Orbital dolly motion, slow push-in. Shot on ARRI ALEXA 65, Zeiss Supreme Prime anamorphic. No people. Luxury product photography lighting — single key light at 45°, subtle fill. 4K HDR.`,
    fusionModel: "seedance-pro",
    fusionImageModel: "flux-kontext-max",
    styleTag: "luxury",
    segment: "Seg. 1 — Deconstrucción",
  },
  {
    num: 3,
    name: "EXPLODE VIEW — 290 Componentes",
    type: "EXPLODE VIEW",
    duration: 5,
    camera: "Wide → Push-in durante explosión",
    motion: "Zero gravity · components float outward · freeze frame at maximum separation",
    description: "El reloj se desintegra elegantemente en zero gravity. Los 8 grupos de componentes se separan: Cristal de Zafiro, Bisel Cerachrom, Esfera Ice Blue, Calibre 4130, Caja Platino 950, Brazalete Oyster, Corona Triplock, Pulsadores. Cada pieza lleva una etiqueta técnica luminosa en tipografía Helvetica Neue Light.",
    image: `${import.meta.env.BASE_URL}rolex-1-angle-crop.png?v=4`,
    objectPosition: "center center",
    aiPrompt: `Cinematic exploded view of Rolex Cosmograph Daytona 116506. Watch components separate in zero gravity on pure white background: sapphire crystal drifts upward, Cerachrom bezel rotates as it separates, ice blue dial floats left, Calibre 4130 movement revealed in center with visible balance wheel, platinum Oyster bracelet unfolds below, Triplock crown and two screw-down pushers float right. Each component perfectly rendered in 950 platinum finish. Technical labels in white Helvetica Neue Light appear next to each piece. Slow motion, 120fps, photorealistic rendering. Inspired by Apple keynote technical reveals and Porsche engineering films. Studio white background, soft omnidirectional lighting.`,
    fusionModel: "kling-3.0-omni",
    fusionImageModel: "flux-kontext-max",
    styleTag: "cinematic",
    segment: "Seg. 2 — Corazón Mecánico",
  },
  {
    num: 4,
    name: "CALIBRE 4130 — El Corazón",
    type: "MACRO",
    duration: 5,
    camera: "MACRO · Depth-of-field shift",
    motion: "Ultra shallow DOF · balance wheel visible oscillating 4Hz · bridges and jewels in raking light",
    description: "El movimiento Calibre 4130 desnudo. La rueda de balance oscila a 4Hz visible a cámara lenta. Los 44 rubíes captan destellos de luz direccional. El muelle espiral Parachrom azul (Niobio-Zirconio) refleja en tonos celestes. Las decoraciones Côtes de Genève se ven en luz rasante.",
    image: `${import.meta.env.BASE_URL}rolex-2-dial-crop.png?v=4`,
    objectPosition: "center center",
    aiPrompt: `Extreme macro close-up of Rolex Calibre 4130 movement. Balance wheel oscillating at 28,800 vph (4 Hz) — capture motion blur on balance. Blue Parachrom hairspring (niobium-zirconium alloy) glowing with natural blue iridescence. 44 ruby jewels catching single directional light ray creating prismatic reflections. Côtes de Genève finishing visible in raking sidelight. Column wheel of chronograph mechanism in focus. Shallow depth of field — only balance and surrounding bridges in focus. Shot on Canon MP-E 65mm macro, 5x magnification equivalent. Black velvet background. Slow motion 240fps.`,
    fusionModel: "seedance-pro",
    fusionImageModel: "flux-kontext-max",
    styleTag: "technical",
    segment: "Seg. 3 — Re-construcción",
  },
  {
    num: 5,
    name: "ASSEMBLY — Magnetic Re-construcción",
    type: "ASSEMBLY",
    duration: 5,
    camera: "Wide → push-in durante ensamblaje",
    motion: "Components fly magnetically to center · assemble in reverse · final flash of completion",
    description: "Inverso del Explode View. Los componentes vuelan magnéticamente desde fuera de cámara y se ensamblan con destellos dorados. La secuencia termina con el reloj perfectamente formado, girando 360° sobre su eje vertical para revelar el brazalete completo.",
    image: `${import.meta.env.BASE_URL}rolex-3-crown-crop.png?v=4`,
    objectPosition: "center center",
    aiPrompt: `Cinematic magnetic assembly sequence of Rolex Cosmograph Daytona 116506. Components fly inward from off-screen — sapphire crystal descends from top, Cerachrom bezel closes around case, ice blue dial settles into position, Calibre 4130 movement slides in from below, platinum bracelet assembles link by link from both sides, Triplock crown and pushers click into place. Each component arrival punctuated by a subtle platinum specular flash. Ends with complete watch rotating 360° on vertical axis on platinum surface. Reverse of exploded view. White background, cinematic lighting. Inspired by Apple "The Making of" and Porsche engine assembly films. 4K, 60fps during assembly, 24fps at completion.`,
    fusionModel: "kling-3.0-omni",
    fusionImageModel: "recraft-v4",
    styleTag: "cinematic",
    segment: "Seg. 4 — Hero Shot",
  },
  {
    num: 6,
    name: "HERO WRIST — The Driver",
    type: "WRIST SHOT",
    duration: 5,
    camera: "Low angle · Dutch tilt 8° · bokeh background",
    motion: "Wrist reveal from below frame · watch catches golden hour light · slow drift right",
    description: "El Daytona en muñeca masculina. Fondo desenfocado de pista de carreras o landscape alpino. La esfera ice blue capta la luz dorada de la hora mágica. El brazalete Oyster platino reluce. La escena evoca el espíritu del piloto campeón, la razón de ser del Daytona.",
    image: `${import.meta.env.BASE_URL}rolex-5-flatlay-crop.png?v=4`,
    objectPosition: "center center",
    aiPrompt: `Cinematic wrist shot of Rolex Cosmograph Daytona 116506 platinum on a male wrist, athletic build. Low angle looking up at watch face. Background: blurred racing circuit or alpine landscape in golden hour light. Ice blue dial prominent, Chromalight indices glowing faintly. Platinum bracelet catches warm golden light. Lens flare at 4 o'clock position. 85mm f/1.4 shallow depth of field. The watch dominates 60% of frame. Mood: luxury, achievement, speed, time mastery. Shot on ARRI ALEXA. No text, no logos except the Rolex crown on dial.`,
    fusionModel: "seedance-pro",
    fusionImageModel: "flux-kontext-max",
    styleTag: "lifestyle",
    segment: "Seg. 4 — Hero Shot",
  },
  {
    num: 7,
    name: "BRAND CARD — Rolex",
    type: "BRAND CARD",
    duration: 2,
    camera: "—",
    motion: "Fade from black · crown reveal · wordmark · fade to black",
    description: "Pantalla negra pura. La corona Rolex aparece en platino especular. 'ROLEX' con tracking máximo en Cormorant Garamond. Subtítulo: 'COSMOGRAPH DAYTONA · Reference 116506'. Fade a negro.",
    image: null,
    objectPosition: "center",
    aiPrompt: "Rolex logo crown in polished 950 platinum on pure black background. 'ROLEX' wordmark in Cormorant Garamond italic, ultra-wide letter-spacing. Below: 'COSMOGRAPH DAYTONA' in light weight. Minimal luxury. No additional elements.",
    fusionModel: "seedance-pro",
    fusionImageModel: "aurora",
    styleTag: "luxury",
    segment: "Cierre",
  },
];

const MODEL_LABELS: Record<string, string> = {
  "seedance-pro": "Seedance 1 Pro",
  "kling-3.0-omni": "Kling 3.0 Omni",
  "runway-gen4-turbo": "Runway Gen4.5",
  "flux-kontext-max": "FLUX Kontext Max",
  "aurora": "xAI Aurora",
  "recraft-v4": "Recraft v4",
};

const TYPE_COLORS: Record<string, string> = {
  "TITLE CARD": "#94a3b8",
  "ECU": "#60a5fa",
  "EXPLODE VIEW": "#f59e0b",
  "MACRO": "#a78bfa",
  "ASSEMBLY": "#34d399",
  "WRIST SHOT": "#fb923c",
  "BRAND CARD": "#94a3b8",
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */

export default function RolexStorySheet() {
  const [activeTab, setActiveTab] = useState<"sheet" | "preview">("sheet");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingVO, setGeneratingVO] = useState(false);
  const [voAudioUrl, setVoAudioUrl] = useState<string | null>(null);
  const [voError, setVoError] = useState<string | null>(null);
  const [expandedShot, setExpandedShot] = useState<number | null>(null);

  async function handleGenerateVO() {
    setGeneratingVO(true);
    setVoError(null);
    const fullScript = VO_SCRIPT.filter(v => v.line).map(v => v.line).join(" ");
    try {
      const r = await fetch(`${API_BASE}/api/voice/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: fullScript,
          voiceId: "pNInz6obpgDQGcFmaJgB", // Adam — deep, authoritative
          model: "eleven_v3",
          stability: 0.45,
          similarity_boost: 0.85,
          style: 0.3,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      setVoAudioUrl(URL.createObjectURL(blob));
    } catch (e) {
      setVoError(e instanceof Error ? e.message : "Error generando VO");
    } finally {
      setGeneratingVO(false);
    }
  }

  function copyPrompt(prompt: string, id: string) {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openFusionStudio(shot: Shot) {
    const url = `${API_BASE}/admin/fusion-studio-pro?model=${shot.fusionModel}&prompt=${encodeURIComponent(shot.aiPrompt.slice(0, 400))}`;
    window.open(url, "_blank");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--t1)", fontFamily: "var(--font-sans, system-ui)" }}>
      {/* ── Google Fonts ── */}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@200;300;400;500;600&display=swap" rel="stylesheet" />

      {/* ══════════ HEADER ══════════ */}
      <div style={{
        background: "linear-gradient(135deg, #0B1E2D 0%, #1A3A5C 100%)",
        borderBottom: "1px solid rgba(201,169,110,0.3)",
        padding: "28px 40px",
      }}>
        <div style={{ maxWidth: 1300, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Film size={18} color="#C9A96E" />
                </div>
                <span style={{ fontSize: 11, color: "#C9A96E", letterSpacing: "0.3em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                  Production Story Sheet
                </span>
              </div>
              <h1 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1.6rem, 3vw, 2.6rem)", fontWeight: 600, color: "#F5F5F0", letterSpacing: "-0.01em" }}>
                Rolex Cosmograph Daytona
              </h1>
              <p style={{ margin: "4px 0 0", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "1rem", color: "#C9A96E", fontWeight: 300 }}>
                Platinum 950 · Ice Blue · Reference 116506
              </p>
            </div>

            {/* Campaign specs */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { label: "Format", value: "16:9 · 30s" },
                { label: "Template", value: "Anatomy Masterpiece" },
                { label: "Video Model", value: "Seedance 1 Pro" },
                { label: "Shots", value: `${SHOTS.length}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "rgba(245,245,240,0.4)", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginBottom: 4 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, color: "#F5F5F0", fontWeight: 500 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 24 }}>
            {[
              { id: "sheet", label: "📋 Story Sheet", icon: null },
              { id: "preview", label: "▶  Vista Previa Animada", icon: null },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px 8px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "'Montserrat', sans-serif",
                  background: activeTab === tab.id ? "#F5F5F0" : "rgba(245,245,240,0.08)",
                  color: activeTab === tab.id ? "#0B1E2D" : "rgba(245,245,240,0.6)",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ CONTENT ══════════ */}
      <AnimatePresence mode="wait">
        {activeTab === "sheet" ? (
          <motion.div key="sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <StorySheetView
              shots={SHOTS}
              expandedShot={expandedShot}
              setExpandedShot={setExpandedShot}
              copiedId={copiedId}
              copyPrompt={copyPrompt}
              openFusionStudio={openFusionStudio}
              voScript={VO_SCRIPT}
              generatingVO={generatingVO}
              voAudioUrl={voAudioUrl}
              voError={voError}
              onGenerateVO={handleGenerateVO}
            />
          </motion.div>
        ) : (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <AnimatedPreview shots={SHOTS} voScript={VO_SCRIPT} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STORY SHEET VIEW
───────────────────────────────────────────────────────────── */
function StorySheetView({
  shots, expandedShot, setExpandedShot, copiedId, copyPrompt, openFusionStudio, voScript, generatingVO, voAudioUrl, voError, onGenerateVO
}: {
  shots: Shot[];
  expandedShot: number | null;
  setExpandedShot: (n: number | null) => void;
  copiedId: string | null;
  copyPrompt: (p: string, id: string) => void;
  openFusionStudio: (s: Shot) => void;
  voScript: typeof VO_SCRIPT;
  generatingVO: boolean;
  voAudioUrl: string | null;
  voError: string | null;
  onGenerateVO: () => void;
}) {
  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 24px" }}>

      {/* Shot Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 20, marginBottom: 40 }}>
        {shots.map((shot) => (
          <ShotCard
            key={shot.num}
            shot={shot}
            expanded={expandedShot === shot.num}
            onToggle={() => setExpandedShot(expandedShot === shot.num ? null : shot.num)}
            copiedId={copiedId}
            copyPrompt={copyPrompt}
            openFusionStudio={openFusionStudio}
            voLine={voScript.find(v => v.shot === shot.num)?.line ?? ""}
          />
        ))}
      </div>

      {/* VO Script Section */}
      <div style={{
        background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(201,169,110,0.12)", border: "1px solid rgba(201,169,110,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mic size={16} color="#C9A96E" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)" }}>Voice-Over Script</div>
              <div style={{ fontSize: 12, color: "var(--t3)", fontFamily: "'Montserrat', sans-serif" }}>ElevenLabs eleven_v3 · Adam voice · 30s</div>
            </div>
          </div>
          <button
            onClick={onGenerateVO}
            disabled={generatingVO}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
              background: generatingVO ? "var(--s2)" : "linear-gradient(135deg, #1A3A5C, #2C6088)",
              color: "#F5F5F0", border: "none", borderRadius: 10, cursor: generatingVO ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {generatingVO ? <><Zap size={14} style={{ animation: "spin 0.6s linear infinite" }} /> Generando...</> : <><Mic size={14} /> Generar VO con ElevenLabs</>}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {voScript.filter(v => v.line).map((v) => (
            <div key={v.shot} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{
                flex: "0 0 56px", fontSize: 11, color: "var(--t4)", fontFamily: "'Montserrat', sans-serif",
                paddingTop: 2, textAlign: "right",
              }}>
                {v.timing}
              </div>
              <div style={{ flex: "0 0 1px", background: "var(--border)", alignSelf: "stretch" }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: "#C9A96E", letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}>
                  SHOT {v.shot}
                </span>
                <p style={{
                  margin: "4px 0 0",
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: "1.05rem",
                  color: "var(--t1)",
                  lineHeight: 1.4,
                }}>
                  "{v.line}"
                </p>
              </div>
            </div>
          ))}
        </div>

        {voError && (
          <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
            {voError}
          </div>
        )}

        {voAudioUrl && (
          <div style={{ marginTop: 16 }}>
            <audio controls src={voAudioUrl} style={{ width: "100%", borderRadius: 8 }} />
          </div>
        )}
      </div>

      {/* Technical Brief */}
      <div style={{
        background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 16, padding: 28,
      }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--t2)", fontFamily: "'Montserrat', sans-serif" }}>
          Technical Brief · Reference 116506
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { label: "CASE", value: "950 Platinum · 40mm · Monobloc" },
            { label: "MOVEMENT", value: "Calibre 4130 · COSC ±2s/day" },
            { label: "POWER RESERVE", value: "72 hours · 28,800 vph" },
            { label: "DIAL", value: "Ice Blue · exclusive to Platinum" },
            { label: "BEZEL", value: "Cerachrom ceramic · Tachymeter scale" },
            { label: "CRYSTAL", value: "Scratch-resistant Sapphire" },
            { label: "CROWN", value: "Triplock · 3-seal · Screw-down" },
            { label: "BRACELET", value: "Oyster Platinum · Ref. 78596" },
            { label: "WATER RESISTANCE", value: "100m / 330ft" },
            { label: "COMPONENTS", value: "290 pieces · 44 jewels" },
            { label: "HAIRSPRING", value: "Parachrom · Nb-Zr alloy · paramagnetic" },
            { label: "YEARS", value: "2013–2023 · \"Platona\"" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: "var(--t4)", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SHOT CARD
───────────────────────────────────────────────────────────── */
function ShotCard({
  shot, expanded, onToggle, copiedId, copyPrompt, openFusionStudio, voLine
}: {
  shot: Shot;
  expanded: boolean;
  onToggle: () => void;
  copiedId: string | null;
  copyPrompt: (p: string, id: string) => void;
  openFusionStudio: (s: Shot) => void;
  voLine: string;
}) {
  const typeColor = TYPE_COLORS[shot.type] ?? "#94a3b8";

  return (
    <motion.div
      layout
      style={{
        background: "var(--s1)", border: "1px solid var(--border)",
        borderRadius: 16, overflow: "hidden",
        boxShadow: expanded ? "0 8px 32px rgba(0,0,0,0.2)" : "none",
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Reference frame */}
      <div style={{ position: "relative", height: 200, background: "#0B1E2D", overflow: "hidden" }}>
        {shot.image ? (
          <img
            src={shot.image}
            alt={shot.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: shot.objectPosition }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            background: shot.num === 1 ? "linear-gradient(135deg, #0B1E2D 0%, #1A3A5C 100%)" : "#0A0A0A",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: shot.num === 1 ? "2.5rem" : "1.8rem", fontWeight: 600, color: "#F5F5F0", letterSpacing: "0.3em", marginBottom: 8 }}>
                {shot.num === 1 ? "ROLEX" : ""}
              </div>
              {shot.num === 1 && (
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "0.9rem", color: "#C9A96E", letterSpacing: "0.2em" }}>
                  COSMOGRAPH DAYTONA
                </div>
              )}
              {shot.num === 7 && (
                <Crown />
              )}
            </div>
          </div>
        )}

        {/* Shot number badge */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          borderRadius: 6, padding: "4px 10px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 11, color: "#fff", fontWeight: 700, fontFamily: "'Montserrat', sans-serif" }}>
            SHOT {shot.num}
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,0.3)" }} />
          <span style={{ fontSize: 10, color: typeColor, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.1em" }}>
            {shot.type}
          </span>
        </div>

        {/* Duration */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          borderRadius: 6, padding: "4px 10px",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <Clock size={10} color="#C9A96E" />
          <span style={{ fontSize: 11, color: "#C9A96E", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>
            {shot.duration}s
          </span>
        </div>

        {/* Segment label */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          padding: "20px 12px 8px",
        }}>
          <div style={{ fontSize: 10, color: "#C9A96E", letterSpacing: "0.2em", fontFamily: "'Montserrat', sans-serif" }}>
            {shot.segment}
          </div>
        </div>
      </div>

      {/* Shot info */}
      <div style={{ padding: "16px 18px" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "var(--t1)", letterSpacing: "0.02em" }}>
          {shot.name}
        </h3>

        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--t3)", display: "flex", alignItems: "center", gap: 4, fontFamily: "'Montserrat', sans-serif" }}>
            <Camera size={10} /> {shot.camera}
          </span>
        </div>

        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>
          {shot.description}
        </p>

        {voLine && (
          <div style={{
            background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.2)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "#C9A96E", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginBottom: 4 }}>
              Voice-Over
            </div>
            <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "0.95rem", color: "var(--t1)" }}>
              "{voLine}"
            </p>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px",
            cursor: "pointer", color: "var(--t3)", fontSize: 12, fontFamily: "'Montserrat', sans-serif",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Eye size={12} /> {expanded ? "Ocultar prompt AI" : "Ver prompt Fusion Studio"}
          </span>
          <ChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ paddingTop: 12 }}>
                {/* AI Prompt */}
                <div style={{
                  background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: 12, marginBottom: 10, position: "relative",
                }}>
                  <div style={{ fontSize: 10, color: "var(--t4)", letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Montserrat', sans-serif", marginBottom: 8 }}>
                    AI Generation Prompt ({MODEL_LABELS[shot.fusionImageModel]} / {MODEL_LABELS[shot.fusionModel]})
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--t2)", lineHeight: 1.6, fontFamily: "monospace" }}>
                    {shot.aiPrompt}
                  </p>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => copyPrompt(shot.aiPrompt, `shot-${shot.num}`)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 12px", background: "var(--s2)", border: "1px solid var(--border)",
                      borderRadius: 8, cursor: "pointer", fontSize: 12, color: "var(--t2)",
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                  >
                    {copiedId === `shot-${shot.num}` ? <><Check size={12} color="#4ade80" /> Copiado</> : <><Copy size={12} /> Copiar prompt</>}
                  </button>
                  <button
                    onClick={() => openFusionStudio(shot)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "9px 12px", background: "linear-gradient(135deg, #1A3A5C, #2C6088)",
                      border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#F5F5F0",
                      fontFamily: "'Montserrat', sans-serif", fontWeight: 600,
                    }}
                  >
                    <Zap size={12} /> Generar en Fusion Studio
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ANIMATED PREVIEW (tab 2)
───────────────────────────────────────────────────────────── */
function AnimatedPreview({ shots, voScript }: { shots: Shot[]; voScript: typeof VO_SCRIPT }) {
  const DURATIONS = shots.map(s => s.duration * 1000);
  const [currentShot, setCurrentShot] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);

  function start() {
    setCurrentShot(0);
    setProgress(0);
    setPlaying(true);
  }

  const ease = [0.22, 1, 0.36, 1] as const;
  const shot = shots[currentShot];
  const vo = voScript.find(v => v.shot === shot.num);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", overflow: "hidden", maxHeight: "calc(100vh - 120px)" }}>
      {/* Letterbox */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "7%", background: "#000", zIndex: 40 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "7%", background: "#000", zIndex: 40 }} />

      {!playing ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0B1E2D" }}>
          <Crown />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1rem, 2vw, 1.6rem)", color: "#F5F5F0", marginTop: 20, letterSpacing: "0.2em" }}>
            COSMOGRAPH DAYTONA
          </p>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", color: "rgba(245,245,240,0.4)", letterSpacing: "0.3em", marginBottom: 32, textTransform: "uppercase" }}>
            Production Story Sheet Preview
          </p>
          <button
            onClick={start}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "14px 32px",
              background: "linear-gradient(135deg, #1A3A5C, #2C6088)",
              color: "#F5F5F0", border: "1px solid rgba(201,169,110,0.4)",
              borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            <Play size={16} fill="#F5F5F0" /> Reproducir Vista Previa (30s)
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`shot-${currentShot}`}
            style={{ position: "absolute", inset: 0 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease }}
            onAnimationComplete={() => {
              const dur = DURATIONS[currentShot];
              const timeout = setTimeout(() => {
                if (currentShot < shots.length - 1) {
                  setCurrentShot(c => c + 1);
                } else {
                  setPlaying(false);
                }
              }, dur - 800);
              return () => clearTimeout(timeout);
            }}
          >
            {/* Background */}
            {shot.image ? (
              <motion.img
                src={shot.image}
                alt={shot.name}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: shot.objectPosition }}
                initial={{ scale: 1.04 }}
                animate={{ scale: 1.0 }}
                transition={{ duration: DURATIONS[currentShot] / 1000, ease: "linear" }}
              />
            ) : (
              <div style={{
                position: "absolute", inset: 0,
                background: shot.num === 1 ? "linear-gradient(135deg, #0B1E2D 0%, #1A3A5C 100%)" : "#050505",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {shot.num === 1 && (
                  <div style={{ textAlign: "center" }}>
                    <motion.p style={{ margin: "0 0 12px", fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1rem, 6vw, 4rem)", fontWeight: 700, color: "#F5F5F0", letterSpacing: "0.35em" }}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 1, ease }}>
                      ROLEX
                    </motion.p>
                    <motion.p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "clamp(0.6rem, 2vw, 1.3rem)", color: "#C9A96E", letterSpacing: "0.25em" }}
                      initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0% 0 0)" }} transition={{ delay: 1.5, duration: 1.2, ease }}>
                      COSMOGRAPH DAYTONA
                    </motion.p>
                  </div>
                )}
                {shot.num === 7 && (
                  <div style={{ textAlign: "center" }}>
                    <Crown />
                    <motion.p style={{ margin: "16px 0 4px", fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(0.9rem, 3vw, 2rem)", fontWeight: 700, color: "#F5F5F0", letterSpacing: "0.35em" }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }}>
                      ROLEX
                    </motion.p>
                    <motion.p style={{ margin: 0, fontFamily: "'Montserrat', sans-serif", fontSize: "clamp(0.45rem, 1.2vw, 0.7rem)", color: "rgba(245,245,240,0.5)", letterSpacing: "0.25em" }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.6 }}>
                      COSMOGRAPH DAYTONA · REFERENCE 116506
                    </motion.p>
                  </div>
                )}
              </div>
            )}

            {/* Gradient overlay */}
            {shot.image && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 50%)" }} />}

            {/* VO subtitle */}
            {vo?.line && (
              <motion.div
                style={{
                  position: "absolute", bottom: "12%", left: 0, right: 0, textAlign: "center", padding: "0 10%",
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.7, ease }}
              >
                <p style={{
                  margin: 0,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontSize: "clamp(0.75rem, 1.8vw, 1.1rem)",
                  color: "rgba(245,245,240,0.9)",
                  textShadow: "0 2px 12px rgba(0,0,0,0.8)",
                  lineHeight: 1.3,
                }}>
                  {vo.line}
                </p>
              </motion.div>
            )}

            {/* Shot info overlay (top-left) */}
            <div style={{
              position: "absolute", top: "10%", left: "3%",
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
              borderRadius: 6, padding: "4px 10px",
            }}>
              <span style={{ fontSize: "clamp(0.45rem, 1.1vw, 0.65rem)", color: "rgba(245,245,240,0.7)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em" }}>
                {shot.num}/{shots.length} · {shot.type} · {shot.duration}s
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Progress bar */}
      {playing && (
        <div style={{ position: "absolute", bottom: "7%", left: 0, right: 0, display: "flex", gap: 2, padding: "0 3%", zIndex: 50 }}>
          {shots.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2, background: "rgba(245,245,240,0.2)", borderRadius: 1, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "#C9A96E", borderRadius: 1,
                width: i < currentShot ? "100%" : i === currentShot ? "50%" : "0%",
                transition: i === currentShot ? `width ${DURATIONS[i]}ms linear` : "none",
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROLEX CROWN SVG
───────────────────────────────────────────────────────────── */
function Crown() {
  return (
    <svg viewBox="0 0 80 60" style={{ width: 60, height: 45, fill: "#C9A96E" }}>
      <path d="M40 4 L28 22 L10 14 L18 32 H62 L70 14 L52 22 Z" />
      <rect x="16" y="34" width="48" height="8" rx="2" />
      <rect x="18" y="44" width="44" height="6" rx="2" />
    </svg>
  );
}
