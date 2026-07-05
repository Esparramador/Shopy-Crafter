/**
 * ROLEX COSMOGRAPH DAYTONA — Production Story Sheet
 * Renoise AI-style format: hero + 16-panel grid + waveform + do's/don'ts
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, Play, Mic, Zap, Copy, Check,
  Download, Camera, Clock, ChevronRight, Eye,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─────────────────────────────────────────────────────────────
   CAMPAIGN DATA
───────────────────────────────────────────────────────────── */
const CAMPAIGN = {
  brand: "ROLEX",
  product: "COSMOGRAPH DAYTONA",
  edition: "PLATINUM 950 EDITION",
  tagline: "ENGINEERED FOR CHAMPIONS · WORN BY LEGENDS",
  format: "16:9 · 30s",
  resolution: "4K UHD 3840×2160",
  fps: "24fps / 120fps slow-mo",
  model: "Seedance 1 Pro",
  ref: "116506",
  date: "Julio 2026",
};

const VO_SCRIPT = [
  { shot: 1,  line: "There are watches. And then there is Daytona.", timing: "0–3s" },
  { shot: 2,  line: "Platinum 950. The rarest material. Reserved for the rarest drivers.", timing: "3–8s" },
  { shot: 3,  line: "Two hundred and ninety masterpiece components. Each one, a world unto itself.", timing: "8–13s" },
  { shot: 4,  line: "Calibre 4130. Forty-four jewels. Seventy-two hours of uninterrupted precision.", timing: "13–18s" },
  { shot: 5,  line: "Assembled by hand. Certified by time.", timing: "18–23s" },
  { shot: 6,  line: "The Cosmograph Daytona. For those who set the pace.", timing: "23–28s" },
  { shot: 7,  line: "", timing: "28–30s" },
];

interface Shot {
  num: number;
  name: string;
  type: string;
  duration: number;
  camera: string;
  motion: string;
  description: string;
  image: string | null;
  objectPosition: string;
  aiPrompt: string;
  fusionModel: string;
  fusionImageModel: string;
  styleTag: string;
  segment: string;
}

const SHOTS: Shot[] = [
  {
    num: 1, name: "TITLE CARD — The Crown", type: "TITLE CARD", duration: 3,
    camera: "—", motion: "Fade up from black",
    description: "Dark platinum screen. Rolex crown appears in golden light. 'COSMOGRAPH DAYTONA' clip-path reveal left to right.",
    image: null, objectPosition: "center",
    aiPrompt: "Pure black background, Rolex crown logo rendered in liquid platinum, high-key specular highlights, cinematic lens flare. Text 'COSMOGRAPH DAYTONA' in Cormorant Garamond italic, ultra-wide tracking. Luxury watchmaking aesthetic. 4K, ARRI ALEXA look.",
    fusionModel: "seedance-pro", fusionImageModel: "aurora", styleTag: "luxury", segment: "Apertura",
  },
  {
    num: 2, name: "HERO PRODUCT — Ice Blue", type: "ECU", duration: 5,
    camera: "ECU + Orbital dolly 3/4", motion: "Slow push-in, 3° orbital left → right",
    description: "Daytona on specular platinum surface. Ice blue dial catches light with micro-flashes on Chromalight indices. Chestnut Cerachrom bezel contrasts perfectly.",
    image: `${import.meta.env.BASE_URL}rolex-4-front-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Extreme close-up of Rolex Cosmograph Daytona 116506 platinum, ice blue meteorite dial, chestnut Cerachrom ceramic bezel, 950 platinum case and bracelet. Placed on platinum specular surface. Ultra-shallow depth of field, 85mm tilt-shift. 4K HDR.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "luxury", segment: "Seg. 1",
  },
  {
    num: 3, name: "EXPLODE VIEW — 290 pcs", type: "EXPLODE VIEW", duration: 5,
    camera: "Wide → Push-in", motion: "Zero gravity · components float outward",
    description: "Watch elegantly disintegrates in zero gravity. 8 component groups separate: Crystal, Bezel, Dial, Calibre 4130, Case, Bracelet, Crown, Pushers.",
    image: `${import.meta.env.BASE_URL}rolex-1-angle-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Cinematic exploded view of Rolex Cosmograph Daytona 116506. Watch components separate in zero gravity on pure white background. Technical labels in white Helvetica Neue Light appear next to each piece. Slow motion 120fps.",
    fusionModel: "kling-3.0-omni", fusionImageModel: "flux-kontext-max", styleTag: "cinematic", segment: "Seg. 2",
  },
  {
    num: 4, name: "CALIBRE 4130 — The Heart", type: "MACRO", duration: 5,
    camera: "MACRO · Depth-of-field shift", motion: "Ultra shallow DOF · balance wheel visible",
    description: "Calibre 4130 movement exposed. Balance wheel oscillates at 4Hz visible in slow motion. 44 rubies catch directional light. Blue Parachrom hairspring glows.",
    image: `${import.meta.env.BASE_URL}rolex-2-dial-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Extreme macro close-up of Rolex Calibre 4130 movement. Balance wheel oscillating at 28,800 vph. Blue Parachrom hairspring glowing. 44 ruby jewels catching light. Canon MP-E 65mm macro, 5x magnification. Slow motion 240fps.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "technical", segment: "Seg. 2",
  },
  {
    num: 5, name: "BEZEL — Cerachrom Ceramic", type: "MACRO", duration: 2,
    camera: "Extreme macro / 200mm", motion: "Slow rotation, raking sidelight",
    description: "18k gold fluted bezel extreme close-up — 72 ridges, alternating light/shadow, each facet visible. Chestnut Cerachrom tachymeter scale in relief.",
    image: null, objectPosition: "center",
    aiPrompt: "Extreme macro close-up of Rolex Cosmograph Daytona Cerachrom ceramic bezel in chestnut brown. Tachymeter scale in raised platinum numerals. 200mm macro, raking directional light reveals texture. Black velvet background. 4K.",
    fusionModel: "seedance-pro", fusionImageModel: "recraft-v4", styleTag: "technical", segment: "Seg. 1",
  },
  {
    num: 6, name: "BRACELET — Oyster Links", type: "MACRO", duration: 2,
    camera: "45° iso macro", motion: "Slow slide left, specular sweep",
    description: "950 platinum Oyster bracelet. Each link polished to a mirror finish. Light sweeps along the bracelet creating a wave of reflections. Oysterclasp detail.",
    image: null, objectPosition: "center",
    aiPrompt: "Close-up of Rolex Oyster bracelet in 950 platinum, Ref. 78596. Mirror-polished links catch a single directional light source creating specular highlights. Macro lens, black satin background. Ultra-detailed surface texture.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "luxury", segment: "Seg. 1",
  },
  {
    num: 7, name: "CROWN — Triplock Seal", type: "MACRO", duration: 2,
    camera: "Tight 100mm", motion: "Micro push-in, critical focus",
    description: "Triplock crown at 3 o'clock position. Three gaskets visible in cross-section. 'ROLEX' engraved on crown face. Screw-down engagement sequence.",
    image: `${import.meta.env.BASE_URL}rolex-3-crown-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Extreme close-up of Rolex Triplock screw-down crown in 950 platinum. 'ROLEX' engraved on crown face. Three-seal waterproofing system visible. 100mm macro, single directional light. Platinum case at 3 o'clock. 4K.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "technical", segment: "Seg. 1",
  },
  {
    num: 8, name: "CHRONOGRAPH — Subdials", type: "ECU", duration: 2,
    camera: "90° overhead macro", motion: "Slow push-in on central axis",
    description: "Ice blue dial overhead. Three subdials visible: small seconds at 9H, 30-min counter at 3H, 12-hour counter at 6H. Baton-shaped hands in platinum.",
    image: `${import.meta.env.BASE_URL}rolex-2-dial-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Top-down aerial close-up of Rolex Daytona ice blue meteorite dial. Three white lacquer subdials with Chromalight-filled markers. Central chronograph seconds hand in platinum. Applied baton hour indices. Overhead 90° shot, perfect plane. 4K.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "luxury", segment: "Seg. 1",
  },
  {
    num: 9, name: "CRYSTAL — Sapphire Dome", type: "MACRO", duration: 2,
    camera: "Side profile macro", motion: "Tilt reveal, light refraction",
    description: "Scratch-resistant sapphire crystal in profile. Light refracts through the domed surface creating prismatic effects. Anti-reflective coating on inner surface.",
    image: null, objectPosition: "center",
    aiPrompt: "Side profile extreme macro of Rolex sapphire crystal dome over the Daytona dial. Light refracts through the curved sapphire creating rainbow prismatic effects. Anti-reflective coating visible as slight blue tint on inner surface. Dark background.",
    fusionModel: "kling-3.0-omni", fusionImageModel: "recraft-v4", styleTag: "technical", segment: "Seg. 2",
  },
  {
    num: 10, name: "CALIBRE — Escapement", type: "MACRO", duration: 2,
    camera: "Ultra macro / 8x", motion: "Critical focus on escape wheel",
    description: "Chronergy escapement. Escape wheel teeth engage pallet fork in slow motion. 15% energy gain over traditional Swiss lever. Blue Parachrom visible.",
    image: null, objectPosition: "center",
    aiPrompt: "Ultra macro 8x magnification of Rolex Chronergy escapement mechanism. Escape wheel teeth engaging pallet fork in extreme slow motion (1000fps equivalent). Blue Parachrom hairspring oscillating. Gold-plated components on rhodium-plated bridges.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "technical", segment: "Seg. 2",
  },
  {
    num: 11, name: "ASSEMBLY — Magnetic Pull", type: "ASSEMBLY", duration: 5,
    camera: "Wide → push-in", motion: "Components fly magnetically to center",
    description: "Reverse Explode View. Components fly magnetically from off-screen and assemble with golden flashes. Ends with watch rotating 360° on vertical axis.",
    image: `${import.meta.env.BASE_URL}rolex-3-crown-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Cinematic magnetic assembly sequence of Rolex Cosmograph Daytona 116506. Components fly inward. Each arrival punctuated by a platinum specular flash. Ends with complete watch rotating 360° on vertical axis on platinum surface. 4K, 60fps.",
    fusionModel: "kling-3.0-omni", fusionImageModel: "recraft-v4", styleTag: "cinematic", segment: "Seg. 3",
  },
  {
    num: 12, name: "LUME — Chromalight Glow", type: "MACRO", duration: 2,
    camera: "100mm / Dark studio", motion: "Lights out reveal — UV activate",
    description: "Dial goes dark. Chromalight blue lume charges and glows intensely. Hours, minutes, seconds all radiate blue luminescence. Duration: 8 hours.",
    image: null, objectPosition: "center",
    aiPrompt: "Rolex Daytona dial in complete darkness. Chromalight luminescent material on hour markers and hands glowing intense blue. Pure black background. Long exposure effect. Applied indices radiate blue light halo. Atmospheric, almost magical quality.",
    fusionModel: "seedance-pro", fusionImageModel: "aurora", styleTag: "cinematic", segment: "Seg. 3",
  },
  {
    num: 13, name: "CASEBACK — Exhibition", type: "MACRO", duration: 2,
    camera: "90° rear macro", motion: "Slow rotation on vertical axis",
    description: "Tungsten microstella rotor visible through exhibition caseback. Rotor spins freely revealing Calibre 4130 in full. 'OFFICIALLY CERTIFIED CHRONOMETER' engraved.",
    image: null, objectPosition: "center",
    aiPrompt: "Rolex Daytona caseback view. Tungsten Microstella variable-inertia balance. Rotor decorated with Côtes de Genève. 'SWISS MADE' and 'OFFICIALLY CERTIFIED SWISS CHRONOMETER' text visible. Platinum case back. Exhibition style shot.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "technical", segment: "Seg. 3",
  },
  {
    num: 14, name: "HERO WRIST — The Driver", type: "WRIST SHOT", duration: 5,
    camera: "Low angle · Dutch tilt 8°", motion: "Wrist reveal from below frame",
    description: "Daytona on male wrist. Blurred racing circuit background at golden hour. Ice blue dial catches warm light. Platinum bracelet gleams. Champion driver spirit.",
    image: `${import.meta.env.BASE_URL}rolex-5-flatlay-crop.png?v=4`, objectPosition: "center center",
    aiPrompt: "Cinematic wrist shot of Rolex Cosmograph Daytona 116506 platinum. Low angle. Background: blurred racing circuit in golden hour. Ice blue dial prominent. Lens flare at 4 o'clock. 85mm f/1.4 shallow DOF. ARRI ALEXA.",
    fusionModel: "seedance-pro", fusionImageModel: "flux-kontext-max", styleTag: "lifestyle", segment: "Seg. 4",
  },
  {
    num: 15, name: "RACING — Circuit de Monaco", type: "LIFESTYLE", duration: 3,
    camera: "Tracking shot / handheld", motion: "Motion blur background / watch sharp",
    description: "Watch on wrist in moving race car. Circuit de Monaco walls blur past. Tachymeter scale visible as car hits 200km/h. The purpose of the chronograph revealed.",
    image: null, objectPosition: "center",
    aiPrompt: "Rolex Daytona on wrist inside moving Formula 1 car at Monaco circuit. Tachymeter visible on Cerachrom bezel. Background is motion-blurred circuit walls in golden afternoon light. Watch pin-sharp. Cinematic motion blur. 24fps, shallow DOF.",
    fusionModel: "kling-3.0-omni", fusionImageModel: "flux-kontext-max", styleTag: "lifestyle", segment: "Seg. 4",
  },
  {
    num: 16, name: "BRAND CARD — Final", type: "BRAND CARD", duration: 2,
    camera: "—", motion: "Fade · crown reveal · wordmark · fade to black",
    description: "Pure black screen. Rolex crown in specular platinum. 'ROLEX' maximum tracking in Cormorant Garamond. 'COSMOGRAPH DAYTONA · Reference 116506'. Fade to black.",
    image: null, objectPosition: "center",
    aiPrompt: "Rolex logo crown in polished 950 platinum on pure black background. 'ROLEX' wordmark in Cormorant Garamond italic, ultra-wide letter-spacing. Below: 'COSMOGRAPH DAYTONA' in light weight. Minimal luxury.",
    fusionModel: "seedance-pro", fusionImageModel: "aurora", styleTag: "luxury", segment: "Cierre",
  },
];

const TYPE_COLORS: Record<string, string> = {
  "TITLE CARD": "#94a3b8",
  "ECU":        "#60a5fa",
  "EXPLODE VIEW":"#f59e0b",
  "MACRO":      "#a78bfa",
  "ASSEMBLY":   "#34d399",
  "WRIST SHOT": "#fb923c",
  "LIFESTYLE":  "#f43f5e",
  "BRAND CARD": "#94a3b8",
};

const SEGMENT_COLORS: Record<string, string> = {
  "Apertura": "#C9A96E",
  "Seg. 1":   "#60a5fa",
  "Seg. 2":   "#a78bfa",
  "Seg. 3":   "#34d399",
  "Seg. 4":   "#fb923c",
  "Cierre":   "#C9A96E",
};

/* ─────────────────────────────────────────────────────────────
   MAIN
───────────────────────────────────────────────────────────── */
export default function RolexStorySheet() {
  const [activeTab, setActiveTab]       = useState<"sheet" | "preview">("sheet");
  const [expandedShot, setExpandedShot] = useState<number | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [generatingVO, setGeneratingVO] = useState(false);
  const [voAudioUrl, setVoAudioUrl]     = useState<string | null>(null);
  const [voError, setVoError]           = useState<string | null>(null);

  function copyPrompt(prompt: string, id: string) {
    navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openFusion(shot: Shot) {
    const url = `${API_BASE}/admin/fusion-studio-pro?model=${shot.fusionModel}&prompt=${encodeURIComponent(shot.aiPrompt.slice(0, 400))}`;
    window.open(url, "_blank");
  }

  async function handleGenerateVO() {
    setGeneratingVO(true); setVoError(null);
    const fullScript = VO_SCRIPT.filter(v => v.line).map(v => v.line).join(" ");
    try {
      const r = await fetch(`${API_BASE}/api/voice/tts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ text: fullScript, voiceId: "pNInz6obpgDQGcFmaJgB", model: "eleven_v3", stability: 0.45, similarity_boost: 0.85, style: 0.3 }),
      });
      if (!r.ok) throw new Error(await r.text());
      setVoAudioUrl(URL.createObjectURL(await r.blob()));
    } catch (e) { setVoError(e instanceof Error ? e.message : "Error"); }
    finally     { setGeneratingVO(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080A0E", color: "#F0EDE8", fontFamily: "'Montserrat', system-ui" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@200;300;400;500;600;700&display=swap" rel="stylesheet" />

      {/* ══ HERO BANNER ══ */}
      <div style={{ position: "relative", width: "100%", height: 340, overflow: "hidden", background: "#0B1525" }}>
        <img
          src={`${import.meta.env.BASE_URL}rolex-4-front-crop.png?v=4`}
          alt="Rolex Daytona hero"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", opacity: 0.65 }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(8,10,14,0.2) 0%, rgba(8,10,14,0.75) 70%, #080A0E 100%)" }} />

        {/* Watermark brand */}
        <div style={{ position: "absolute", top: 22, left: 28, display: "flex", alignItems: "center", gap: 10 }}>
          <Crown />
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, letterSpacing: "0.25em", color: "#C9A96E" }}>
            ShopyCrafter
          </span>
        </div>

        {/* Tab switcher top-right */}
        <div style={{ position: "absolute", top: 22, right: 24, display: "flex", gap: 4 }}>
          {(["sheet", "preview"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "7px 16px", borderRadius: 20, border: "1px solid rgba(201,169,110,0.3)",
              background: activeTab === t ? "#C9A96E" : "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
              color: activeTab === t ? "#080A0E" : "#C9A96E", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.08em",
            }}>
              {t === "sheet" ? "📋 STORY SHEET" : "▶ PREVIEW"}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TITLE BAR ══ */}
      <div style={{
        background: "#0D1117", borderBottom: "1px solid rgba(201,169,110,0.25)",
        padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.25em", color: "#F0EDE8" }}>
            {CAMPAIGN.brand}
          </span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 20, color: "#F0EDE8" }}>
            {CAMPAIGN.product}
          </span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: "#C9A96E" }}>
            — {CAMPAIGN.edition}
          </span>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {[
            ["FORMAT", CAMPAIGN.format],
            ["RESOLUTION", CAMPAIGN.resolution],
            ["FPS", CAMPAIGN.fps],
            ["MODEL", CAMPAIGN.model],
          ].map(([label, value]) => (
            <div key={label} style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, color: "rgba(240,237,232,0.35)", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 500 }}>{value}</div>
            </div>
          ))}
          <div style={{ marginLeft: 8 }}><Crown size={32} /></div>
        </div>
      </div>

      {/* ══ CONTENT ══ */}
      <AnimatePresence mode="wait">
        {activeTab === "sheet" ? (
          <motion.div key="sheet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StorySheetView
              shots={SHOTS} expandedShot={expandedShot} setExpandedShot={setExpandedShot}
              copiedId={copiedId} copyPrompt={copyPrompt} openFusion={openFusion}
              voScript={VO_SCRIPT} generatingVO={generatingVO} voAudioUrl={voAudioUrl}
              voError={voError} onGenerateVO={handleGenerateVO}
            />
          </motion.div>
        ) : (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AnimatedPreview shots={SHOTS} voScript={VO_SCRIPT} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STORY SHEET VIEW — Renoise-style layout
───────────────────────────────────────────────────────────── */
function StorySheetView({
  shots, expandedShot, setExpandedShot, copiedId, copyPrompt, openFusion,
  voScript, generatingVO, voAudioUrl, voError, onGenerateVO,
}: {
  shots: Shot[]; expandedShot: number | null; setExpandedShot: (n: number | null) => void;
  copiedId: string | null; copyPrompt: (p: string, id: string) => void; openFusion: (s: Shot) => void;
  voScript: typeof VO_SCRIPT; generatingVO: boolean; voAudioUrl: string | null;
  voError: string | null; onGenerateVO: () => void;
}) {
  return (
    <div style={{ padding: "24px 20px 40px", maxWidth: 1400, margin: "0 auto" }}>

      {/* ── Row: tagline + meta ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(201,169,110,0.15)", paddingBottom: 14, marginBottom: 22, flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "rgba(201,169,110,0.6)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 4 }}>
            Art in Motion
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 14, color: "rgba(240,237,232,0.7)" }}>
            {CAMPAIGN.tagline}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["FULL PRODUCTION SHOOT", "MULTI-SHOT PIPELINE", "AI GENERATED"].map(tag => (
            <span key={tag} style={{
              fontSize: 9, letterSpacing: "0.15em", padding: "3px 8px", border: "1px solid rgba(201,169,110,0.3)",
              borderRadius: 3, color: "#C9A96E", fontWeight: 600,
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* ══ 16-PANEL GRID ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 28 }}>
        {shots.map(shot => (
          <CompactPanel
            key={shot.num} shot={shot}
            expanded={expandedShot === shot.num}
            onToggle={() => setExpandedShot(expandedShot === shot.num ? null : shot.num)}
            copiedId={copiedId} copyPrompt={copyPrompt} openFusion={openFusion}
            voLine={voScript.find(v => v.shot === shot.num)?.line ?? ""}
          />
        ))}
      </div>

      {/* ══ AUDIO + WAVEFORM SECTION ══ */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20,
      }}>
        {/* Waveform */}
        <div style={{
          background: "#0D1117", border: "1px solid rgba(201,169,110,0.2)", borderRadius: 10, padding: "18px 20px",
        }}>
          <div style={{ fontSize: 9, color: "rgba(201,169,110,0.6)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>
            Audio Build-Up · Voice-Over Script
          </div>
          <Waveform />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            {["INTRO", "TITLE", "DECOMPOSE", "HEART", "ASSEMBLY", "HERO", "BRAND"].map((s, i) => (
              <div key={s} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 7, color: "rgba(240,237,232,0.35)", letterSpacing: "0.1em" }}>{s}</div>
                <div style={{ fontSize: 7, color: "#C9A96E", marginTop: 2 }}>{["0s","3s","8s","13s","18s","23s","28s"][i]}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={onGenerateVO} disabled={generatingVO} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
              background: generatingVO ? "rgba(201,169,110,0.1)" : "rgba(201,169,110,0.15)",
              border: "1px solid rgba(201,169,110,0.4)", borderRadius: 6, cursor: generatingVO ? "not-allowed" : "pointer",
              fontSize: 11, fontWeight: 600, color: "#C9A96E", letterSpacing: "0.1em",
            }}>
              <Mic size={12} /> {generatingVO ? "GENERANDO VO..." : "GENERAR VO · ELEVENLABS"}
            </button>
            {voAudioUrl && <audio controls src={voAudioUrl} style={{ height: 28, flex: 1, minWidth: 0 }} />}
            {voError && <span style={{ fontSize: 11, color: "#f87171" }}>{voError}</span>}
          </div>
        </div>

        {/* Do's & Don'ts */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* DO */}
          <div style={{
            background: "#0D1117", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 10, padding: "16px 16px",
          }}>
            <div style={{ fontSize: 9, color: "#34d399", letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              ✓ DO'S
            </div>
            {[
              "Use real gold/platinum color grading",
              "Highlight genuine product materials",
              "Use smooth cameras with slow-mo",
              "Keep compositions ultra-clean",
              "Maintain luxury studio lighting setups",
              "Film watch with critical focus on dial",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7, alignItems: "flex-start" }}>
                <span style={{ color: "#34d399", fontSize: 10, flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{ fontSize: 10, color: "rgba(240,237,232,0.65)", lineHeight: 1.35 }}>{item}</span>
              </div>
            ))}
          </div>
          {/* DON'T */}
          <div style={{
            background: "#0D1117", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 10, padding: "16px 16px",
          }}>
            <div style={{ fontSize: 9, color: "#f87171", letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              ✗ DON'TS
            </div>
            {[
              "Do NOT use oversaturated color grading",
              "Do NOT show artificial proportions",
              "Do NOT use handheld shaky camera",
              "Avoid competing background elements",
              "No royalty composition errors",
              "Do NOT use non-luxury lighting rigs",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7, alignItems: "flex-start" }}>
                <span style={{ color: "#f87171", fontSize: 10, flexShrink: 0, marginTop: 1 }}>·</span>
                <span style={{ fontSize: 10, color: "rgba(240,237,232,0.65)", lineHeight: 1.35 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ STYLE GUIDE ICONS ══ */}
      <div style={{
        background: "#0D1117", border: "1px solid rgba(201,169,110,0.15)", borderRadius: 10,
        padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 9, color: "rgba(201,169,110,0.6)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>
            Quality Review · Style Ratings
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { icon: "💎", label: "PREMIUM",    rating: 5 },
              { icon: "🎬", label: "CINEMATIC",  rating: 5 },
              { icon: "⚡", label: "DYNAMIC",    rating: 4 },
              { icon: "🎯", label: "PRECISION",  rating: 5 },
              { icon: "🌟", label: "LUXURY",     rating: 5 },
              { icon: "🔥", label: "IMPACT",     rating: 4 },
            ].map(({ icon, label, rating }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 8, color: "rgba(240,237,232,0.45)", letterSpacing: "0.15em", marginBottom: 4 }}>{label}</div>
                <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                  {[1,2,3,4,5].map(n => (
                    <div key={n} style={{ width: 6, height: 6, borderRadius: 1, background: n <= rating ? "#C9A96E" : "rgba(201,169,110,0.2)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: "rgba(201,169,110,0.6)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>
            Action Categories
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { icon: "🎯", label: "TRACKING" },
              { icon: "✂️", label: "CUT FINE" },
              { icon: "⏱️", label: "SLOW-MO" },
              { icon: "🔧", label: "ASSEMBLE" },
              { icon: "🌊", label: "FLUID" },
              { icon: "👁️", label: "REVEAL" },
            ].map(({ icon, label }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 8, color: "rgba(240,237,232,0.4)", letterSpacing: "0.12em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Specs compact */}
        <div>
          <div style={{ fontSize: 9, color: "rgba(201,169,110,0.6)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: 12 }}>
            Technical Reference
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
            {[
              ["CASE", "950 Platinum · 40mm"],
              ["MOVEMENT", "Calibre 4130 · COSC"],
              ["POWER", "72h · 28,800 vph"],
              ["DIAL", "Ice Blue Meteorite"],
              ["COMPONENTS", "290 pcs · 44 jewels"],
              ["REF", "116506 · Platinum"],
            ].map(([k, v]) => (
              <div key={k}>
                <span style={{ fontSize: 8, color: "rgba(240,237,232,0.35)", letterSpacing: "0.15em" }}>{k} </span>
                <span style={{ fontSize: 9, color: "#F0EDE8" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   COMPACT PANEL — 1 of the 16 cells
───────────────────────────────────────────────────────────── */
function CompactPanel({
  shot, expanded, onToggle, copiedId, copyPrompt, openFusion, voLine,
}: {
  shot: Shot; expanded: boolean; onToggle: () => void;
  copiedId: string | null; copyPrompt: (p: string, id: string) => void;
  openFusion: (s: Shot) => void; voLine: string;
}) {
  const typeColor = TYPE_COLORS[shot.type] ?? "#94a3b8";
  const segColor  = SEGMENT_COLORS[shot.segment] ?? "#C9A96E";

  return (
    <div style={{ background: "#0D1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, overflow: "hidden", cursor: "pointer" }} onClick={onToggle}>
      {/* Thumbnail */}
      <div style={{ position: "relative", height: 110, background: "#060810", overflow: "hidden" }}>
        {shot.image ? (
          <img src={shot.image} alt={shot.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: shot.objectPosition }} />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            background: shot.num === 1 || shot.num === 16
              ? "linear-gradient(135deg, #0B1525 0%, #1A2A40 100%)"
              : "linear-gradient(135deg, #0D0D18 0%, #151520 100%)",
          }}>
            {(shot.num === 1 || shot.num === 16) && (
              <div style={{ textAlign: "center" }}>
                <Crown size={20} />
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 10, color: "#C9A96E", letterSpacing: "0.25em", marginTop: 4 }}>ROLEX</div>
              </div>
            )}
            {shot.num !== 1 && shot.num !== 16 && (
              <span style={{ fontSize: 28 }}>{
                { 5:"⌚", 6:"🔗", 7:"⚙️", 9:"💎", 10:"⚙️", 12:"🌙", 13:"🔍", 15:"🏎️" }[shot.num] ?? "📷"
              }</span>
            )}
          </div>
        )}

        {/* Overlays */}
        <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "2px 6px", display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>{String(shot.num).padStart(2,"0")}</span>
          <span style={{ width: 1, height: 8, background: "rgba(255,255,255,0.3)" }} />
          <span style={{ fontSize: 8, color: typeColor, fontWeight: 600, letterSpacing: "0.05em" }}>{shot.type}</span>
        </div>
        <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.75)", borderRadius: 3, padding: "2px 6px", display: "flex", alignItems: "center", gap: 3 }}>
          <Clock size={7} color="#C9A96E" />
          <span style={{ fontSize: 8, color: "#C9A96E", fontWeight: 600 }}>{shot.duration}s</span>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 28, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }} />
        <div style={{ position: "absolute", bottom: 4, left: 6 }}>
          <span style={{ fontSize: 7, color: segColor, letterSpacing: "0.1em", fontWeight: 600 }}>{shot.segment.toUpperCase()}</span>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: "8px 10px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#F0EDE8", marginBottom: 3, lineHeight: 1.3 }}>{shot.name}</div>
        <div style={{ fontSize: 9, color: "rgba(240,237,232,0.45)", marginBottom: 5, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {shot.description}
        </div>
        {shot.camera !== "—" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Camera size={8} color="rgba(201,169,110,0.6)" />
            <span style={{ fontSize: 8, color: "rgba(201,169,110,0.6)" }}>{shot.camera}</span>
          </div>
        )}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "0 10px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {voLine && (
                <div style={{ margin: "8px 0 8px", padding: "6px 8px", background: "rgba(201,169,110,0.06)", borderLeft: "2px solid #C9A96E", borderRadius: "0 4px 4px 0" }}>
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 10, color: "#F0EDE8" }}>"{voLine}"</span>
                </div>
              )}
              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: "8px 10px", marginBottom: 8 }}>
                <div style={{ fontSize: 8, color: "rgba(201,169,110,0.5)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
                  AI Prompt · {shot.fusionImageModel} / {shot.fusionModel}
                </div>
                <p style={{ margin: 0, fontSize: 9, color: "rgba(240,237,232,0.6)", lineHeight: 1.5, fontFamily: "monospace" }}>
                  {shot.aiPrompt.slice(0, 180)}…
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => copyPrompt(shot.aiPrompt, `s-${shot.num}`)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  padding: "6px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 5, cursor: "pointer", fontSize: 9, color: "rgba(240,237,232,0.6)",
                }}>
                  {copiedId === `s-${shot.num}` ? <><Check size={9} color="#4ade80" /> Copiado</> : <><Copy size={9} /> Copiar</>}
                </button>
                <button onClick={() => openFusion(shot)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                  padding: "6px 8px", background: "rgba(201,169,110,0.15)", border: "1px solid rgba(201,169,110,0.3)",
                  borderRadius: 5, cursor: "pointer", fontSize: 9, color: "#C9A96E", fontWeight: 600,
                }}>
                  <Zap size={9} /> Fusion Studio
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   WAVEFORM VISUAL
───────────────────────────────────────────────────────────── */
function Waveform() {
  const bars = [
    3,5,8,12,18,22,28,35,30,25,22,18,28,40,55,65,70,68,72,75,65,60,55,50,
    48,55,60,70,80,90,88,85,75,65,55,45,40,38,42,50,60,70,80,85,82,78,72,65,
    55,45,35,28,22,18,15,12,10,8,6,5,
  ];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: 48, gap: 1.5 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1, height: `${h}%`, borderRadius: 1,
          background: i < 8 ? "rgba(201,169,110,0.4)" : i < 20 ? "#C9A96E" : i < 40 ? "#e6c88a" : "rgba(201,169,110,0.6)",
        }} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ANIMATED PREVIEW (tab 2)
───────────────────────────────────────────────────────────── */
function AnimatedPreview({ shots, voScript }: { shots: Shot[]; voScript: typeof VO_SCRIPT }) {
  const DURATIONS = shots.map(s => s.duration * 1000);
  const [currentShot, setCurrentShot] = useState(0);
  const [playing, setPlaying] = useState(false);
  const ease = [0.22, 1, 0.36, 1] as const;
  const shot = shots[currentShot];
  const vo = voScript.find(v => v.shot === shot.num);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#000", overflow: "hidden", maxHeight: "calc(100vh - 200px)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "7%", background: "#000", zIndex: 40 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "7%", background: "#000", zIndex: 40 }} />

      {!playing ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0B1525" }}>
          <Crown size={60} />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1rem, 2vw, 1.6rem)", color: "#F0EDE8", marginTop: 20, letterSpacing: "0.2em" }}>
            COSMOGRAPH DAYTONA
          </p>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", color: "rgba(240,237,232,0.4)", letterSpacing: "0.3em", marginBottom: 32, textTransform: "uppercase" }}>
            {shots.length} shots · 30 seconds · Platinum 950
          </p>
          <button onClick={() => { setCurrentShot(0); setPlaying(true); }} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "14px 32px",
            background: "rgba(201,169,110,0.15)", color: "#C9A96E",
            border: "1px solid rgba(201,169,110,0.4)", borderRadius: 12, cursor: "pointer",
            fontSize: 13, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em",
          }}>
            <Play size={16} fill="#C9A96E" /> PLAY PREVIEW
          </button>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={`shot-${currentShot}`} style={{ position: "absolute", inset: 0 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease }}
            onAnimationComplete={() => {
              const dur = DURATIONS[currentShot];
              const t = setTimeout(() => {
                if (currentShot < shots.length - 1) setCurrentShot(c => c + 1);
                else setPlaying(false);
              }, dur - 600);
              return () => clearTimeout(t);
            }}
          >
            {shot.image ? (
              <motion.img src={shot.image} alt={shot.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: shot.objectPosition }}
                initial={{ scale: 1.04 }} animate={{ scale: 1.0 }} transition={{ duration: DURATIONS[currentShot] / 1000, ease: "linear" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0B1525 0%, #1A2A40 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <Crown size={60} />
                  <motion.p style={{ margin: "16px 0 4px", fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(1rem, 4vw, 3rem)", fontWeight: 700, color: "#F0EDE8", letterSpacing: "0.35em" }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }}>
                    ROLEX
                  </motion.p>
                  <motion.p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "clamp(0.5rem, 1.5vw, 1rem)", color: "#C9A96E", letterSpacing: "0.25em" }}
                    initial={{ clipPath: "inset(0 100% 0 0)" }} animate={{ clipPath: "inset(0 0% 0 0)" }} transition={{ delay: 1.2, duration: 1, ease }}>
                    COSMOGRAPH DAYTONA
                  </motion.p>
                </div>
              </div>
            )}
            {shot.image && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />}
            {vo?.line && (
              <motion.div style={{ position: "absolute", bottom: "12%", left: 0, right: 0, textAlign: "center", padding: "0 10%" }}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }}>
                <p style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "clamp(0.7rem, 1.8vw, 1.1rem)", color: "rgba(240,237,232,0.9)", textShadow: "0 2px 12px rgba(0,0,0,0.8)", lineHeight: 1.3 }}>
                  {vo.line}
                </p>
              </motion.div>
            )}
            <div style={{ position: "absolute", top: "10%", left: "3%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", borderRadius: 4, padding: "3px 8px" }}>
              <span style={{ fontSize: "clamp(0.45rem, 1vw, 0.6rem)", color: "rgba(240,237,232,0.6)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em" }}>
                {String(shot.num).padStart(2,"0")}/{shots.length} · {shot.type} · {shot.duration}s
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {playing && (
        <div style={{ position: "absolute", bottom: "7%", left: 0, right: 0, display: "flex", gap: 2, padding: "0 3%", zIndex: 50 }}>
          {shots.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2, background: "rgba(240,237,232,0.15)", borderRadius: 1, overflow: "hidden" }}>
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
   CROWN SVG (minimal inline)
───────────────────────────────────────────────────────────── */
function Crown({ size = 40 }: { size?: number }) {
  const s = size;
  return (
    <svg viewBox="0 0 80 60" style={{ width: s * 1.33, height: s, fill: "#C9A96E" }}>
      <path d="M40 4 L28 22 L10 14 L18 32 H62 L70 14 L52 22 Z" />
      <rect x="16" y="34" width="48" height="8" rx="2" />
      <rect x="18" y="44" width="44" height="6" rx="2" />
    </svg>
  );
}
