import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";

/* ─── Timeline: 5 + 5 + 6 + 6 + 8 + 4 = 34 seconds total ─── */
const SCENE_DURATIONS = [5000, 5000, 6000, 6000, 8000, 4000];

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Rolex crown SVG path ─── */
const CROWN_PATH = "M12 2 L9 9 L2 7 L6.5 13 L2 16 L9 14.5 L12 22 L15 14.5 L22 16 L17.5 13 L22 7 L15 9 Z";

export default function RolexAd() {
  const [scene, setScene] = useState(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setScene((s) => (s + 1) % SCENE_DURATIONS.length);
      setKey((k) => k + 1);
    }, SCENE_DURATIONS[scene]);
    return () => clearTimeout(t);
  }, [scene]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ fontFamily: '"Cormorant Garamond", "Didot", "Times New Roman", serif' }}
    >
      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&family=Montserrat:wght@200;300;400;500&display=swap" rel="stylesheet" />

      <AnimatePresence mode="wait">
        {scene === 0 && <SceneHero key={`s0-${key}`} />}
        {scene === 1 && <SceneSpecs key={`s1-${key}`} />}
        {scene === 2 && <SceneDialAnatomy key={`s2-${key}`} />}
        {scene === 3 && <SceneCaseAnatomy key={`s3-${key}`} />}
        {scene === 4 && <SceneExplode key={`s4-${key}`} />}
        {scene === 5 && <SceneOutro key={`s5-${key}`} />}
      </AnimatePresence>

      {/* Scene dots indicator */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-50">
        {SCENE_DURATIONS.map((_, i) => (
          <div
            key={i}
            className={`h-[3px] rounded-full transition-all duration-500 ${
              i === scene ? "w-6 bg-[#1A3A5C]" : "w-2 bg-[#1A3A5C]/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SCENE 1 — HERO: Ice-blue bg · watch LEFT · text RIGHT
══════════════════════════════════════════════════ */
function SceneHero() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center"
      style={{ background: "linear-gradient(135deg, #EBF4FA 0%, #F5FAFE 50%, #FFFFFF 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      {/* Subtle grid lines — editorial */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1A3A5C" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* LEFT — Watch image */}
      <motion.div
        className="relative w-1/2 h-full flex items-center justify-center pl-[5vw]"
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease }}
      >
        <img
          src={`${import.meta.env.BASE_URL}rolex-1-angle-crop.png?v=3`}
          alt="Rolex Cosmograph Daytona Platinum"
          className="w-[85%] max-h-[80vh] object-contain drop-shadow-2xl"
          style={{ filter: "drop-shadow(0 30px 60px rgba(26,58,92,0.15))" }}
        />
        {/* Ice blue accent circle behind watch */}
        <div
          className="absolute w-[70%] aspect-square rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10"
          style={{ background: "radial-gradient(circle, #C8E4F5 0%, transparent 70%)" }}
        />
      </motion.div>

      {/* RIGHT — Typography */}
      <div className="w-1/2 h-full flex flex-col justify-center pr-[8vw] pl-[2vw]">
        {/* Brand */}
        <motion.p
          className="text-[#1A3A5C] text-sm tracking-[0.6em] uppercase mb-3"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease }}
        >
          ROLEX
        </motion.p>

        {/* Model */}
        <motion.h1
          className="text-[#0B1E2D] leading-none mb-2"
          style={{ fontSize: "clamp(3rem, 6vw, 5.5rem)", fontWeight: 700, letterSpacing: "-0.01em" }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.8, ease }}
        >
          DAYTONA
        </motion.h1>

        {/* Sub-model */}
        <motion.h2
          className="text-[#2C6088] italic mb-6"
          style={{ fontSize: "clamp(1.4rem, 2.5vw, 2.5rem)", fontWeight: 300, letterSpacing: "0.08em" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.0, ease }}
        >
          Cosmograph
        </motion.h2>

        {/* Divider */}
        <motion.div
          className="h-[1px] bg-[#1A3A5C]/20 mb-6"
          initial={{ width: 0 }}
          animate={{ width: "80px" }}
          transition={{ duration: 0.8, delay: 1.2, ease }}
        />

        {/* Descriptor pills */}
        <motion.div
          className="flex flex-col gap-2 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.4, ease }}
        >
          {[
            { label: "MATERIAL", value: "950 Platinum" },
            { label: "DIAL", value: "Ice Blue — exclusive to Platinum" },
            { label: "REFERENCE", value: "116506" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline gap-3">
              <span
                className="text-[#2C6088] text-[0.6rem] tracking-[0.25em] uppercase"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
              >
                {label}
              </span>
              <span className="text-[#0B1E2D] text-sm" style={{ fontWeight: 400 }}>
                {value}
              </span>
            </div>
          ))}
        </motion.div>

        {/* CTA line */}
        <motion.p
          className="text-[#1A3A5C]/60 text-xs tracking-[0.3em] uppercase"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.8, ease }}
        >
          The Chronograph of Champions
        </motion.p>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   SCENE 2 — SPECIFICATIONS
══════════════════════════════════════════════════ */
const SPECS = [
  { label: "MOVEMENT", value: "Calibre 4130", sub: "Self-winding · COSC ±2 sec/day" },
  { label: "CASE", value: "40 mm", sub: "950 Platinum · Monobloc" },
  { label: "POWER RESERVE", value: "72 Hours", sub: "28,800 vph · 44 jewels" },
  { label: "WATER RESISTANCE", value: "100m / 330ft", sub: "Oyster case · Triplock crown" },
  { label: "BRACELET", value: "Oyster Platinum", sub: "Ref. 78596 · Oysterlock clasp" },
];

function SceneSpecs() {
  return (
    <motion.div
      className="absolute inset-0 flex"
      style={{ background: "linear-gradient(160deg, #F7FBFF 0%, #ECF5FC 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      {/* LEFT — Watch front view */}
      <motion.div
        className="w-2/5 h-full flex items-center justify-center pl-[4vw]"
        initial={{ x: -30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 1, delay: 0.2, ease }}
      >
        <img
          src={`${import.meta.env.BASE_URL}rolex-4-front-crop.png?v=3`}
          alt="Rolex Daytona Front"
          className="w-[90%] max-h-[75vh] object-contain"
          style={{ filter: "drop-shadow(0 20px 50px rgba(26,58,92,0.18))" }}
        />
      </motion.div>

      {/* RIGHT — Specs */}
      <div className="w-3/5 h-full flex flex-col justify-center pr-[7vw] pl-[3vw]">
        <motion.p
          className="text-[#2C6088] text-xs tracking-[0.5em] uppercase mb-2"
          style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Technical Specifications
        </motion.p>
        <motion.h2
          className="text-[#0B1E2D] mb-8"
          style={{ fontSize: "clamp(1.8rem, 3.5vw, 3rem)", fontWeight: 600, letterSpacing: "-0.01em" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease }}
        >
          Calibre 4130
        </motion.h2>

        <div className="flex flex-col gap-0">
          {SPECS.map(({ label, value, sub }, i) => (
            <motion.div
              key={label}
              className="flex items-start py-3 border-b border-[#1A3A5C]/10"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.7 + i * 0.15, ease }}
            >
              <span
                className="w-[38%] text-[#2C6088] text-[0.6rem] tracking-[0.2em] uppercase pt-[2px] flex-shrink-0"
                style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 500 }}
              >
                {label}
              </span>
              <div className="flex flex-col">
                <span className="text-[#0B1E2D] text-base font-semibold leading-tight">{value}</span>
                <span className="text-[#5A7A8F] text-xs mt-0.5" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>
                  {sub}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   SCENE 3 — DIAL ANATOMY (callout lines)
══════════════════════════════════════════════════ */
const DIAL_CALLOUTS = [
  { id: "tach", label: "TACHYMETER SCALE", sub: "Cerachrom ceramic · Platinum PVD fill", cx: "50%", cy: "8%", lx1: "50%", ly1: "10%", lx2: "50%", ly2: "26%", anchor: "center" },
  { id: "subdial3", label: "30-MIN COUNTER", sub: "Sub-dial @ 3 o'clock", cx: "78%", cy: "52%", lx1: "70%", ly1: "52%", lx2: "60%", ly2: "50%", anchor: "left" },
  { id: "crown", label: "ROLEX CROWN", sub: "Chromalight luminescence", cx: "50%", cy: "36%", lx1: "50%", ly1: "38%", lx2: "50%", ly2: "44%", anchor: "center" },
  { id: "subdial6", label: "SMALL SECONDS", sub: "Sub-dial @ 6 o'clock", cx: "15%", cy: "72%", lx1: "28%", ly1: "68%", lx2: "40%", ly2: "62%", anchor: "right" },
  { id: "dial", label: "ICE BLUE DIAL", sub: "Exclusive to 950 Platinum", cx: "15%", cy: "30%", lx1: "28%", ly1: "36%", lx2: "40%", ly2: "44%", anchor: "right" },
];

function SceneDialAnatomy() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(180deg, #EBF4FA 0%, #FFFFFF 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      <motion.p
        className="absolute top-[10vh] text-[#2C6088] text-xs tracking-[0.5em] uppercase"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Dial Anatomy
      </motion.p>

      {/* Watch image + SVG overlay callouts */}
      <div className="relative w-[55vmin] h-[55vmin]">
        <motion.img
          src={`${import.meta.env.BASE_URL}rolex-2-dial-crop.png?v=3`}
          alt="Dial"
          className="absolute inset-0 w-full h-full object-contain rounded-full"
          style={{ filter: "drop-shadow(0 15px 40px rgba(26,58,92,0.2))" }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease }}
        />

        {/* SVG Callout lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
          {DIAL_CALLOUTS.map(({ id, cx, cy, lx1, ly1, lx2, ly2 }, i) => (
            <motion.line
              key={id}
              x1={lx1} y1={ly1} x2={lx2} y2={ly2}
              stroke="#1A3A5C"
              strokeWidth="0.8"
              strokeOpacity="0.5"
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 + i * 0.4, ease: "easeOut" }}
            />
          ))}
        </svg>

        {/* Callout labels */}
        {DIAL_CALLOUTS.map(({ id, label, sub, cx, cy, anchor }, i) => (
          <motion.div
            key={id}
            className="absolute flex flex-col"
            style={{
              left: cx,
              top: cy,
              transform: `translate(${anchor === "center" ? "-50%, -100%" : anchor === "left" ? "8px, -50%" : "calc(-100% - 8px), -50%"})`,
              alignItems: anchor === "center" ? "center" : anchor === "left" ? "flex-start" : "flex-end",
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.5 + i * 0.4, ease }}
          >
            <span
              className="text-[#0B1E2D] font-semibold leading-none"
              style={{ fontSize: "clamp(0.45rem, 1.1vw, 0.6rem)", fontFamily: "'Montserrat', sans-serif", letterSpacing: "0.1em" }}
            >
              {label}
            </span>
            <span
              className="text-[#5A7A8F] leading-none mt-[2px]"
              style={{ fontSize: "clamp(0.38rem, 0.9vw, 0.5rem)", fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}
            >
              {sub}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   SCENE 4 — CASE ANATOMY
══════════════════════════════════════════════════ */
function SceneCaseAnatomy() {
  const callouts = [
    { id: "crown", label: "TRIPLOCK CROWN", sub: "3-seal waterproof system · Platinum", side: "right", pct: 50 },
    { id: "crystal", label: "SAPPHIRE CRYSTAL", sub: "Scratch-resistant · Anti-reflective", side: "top", pct: 50 },
    { id: "pusher", label: "SCREW-DOWN PUSHERS", sub: "Chronograph start/stop · reset", side: "left", pct: 35 },
    { id: "case", label: "OYSTER CASE", sub: "950 Platinum · Monobloc construction", side: "bottom", pct: 50 },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #F0F4F8 0%, #F8FBFF 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      <motion.p
        className="absolute top-[10vh] text-[#2C6088] text-xs tracking-[0.5em] uppercase"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Case Architecture
      </motion.p>

      <div className="relative flex items-center justify-center" style={{ width: "60vmin", height: "60vmin" }}>
        <motion.img
          src={`${import.meta.env.BASE_URL}rolex-3-crown-crop.png?v=3`}
          alt="Rolex Crown"
          className="w-full h-full object-contain"
          style={{ filter: "drop-shadow(0 20px 50px rgba(26,58,92,0.22))" }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease }}
        />

        {/* Right callout */}
        <motion.div
          className="absolute right-0 translate-x-full top-1/2 -translate-y-1/2 pl-4 border-l border-[#1A3A5C]/30 ml-3"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 1.2, ease }}
        >
          <p className="text-[#0B1E2D] font-semibold text-xs tracking-[0.15em]" style={{ fontFamily: "'Montserrat', sans-serif" }}>TRIPLOCK CROWN</p>
          <p className="text-[#5A7A8F] text-[0.6rem] mt-1" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>3-seal system · 950 Platinum</p>
        </motion.div>

        {/* Top callout */}
        <motion.div
          className="absolute top-0 -translate-y-full left-1/2 -translate-x-1/2 pb-4 border-b border-[#1A3A5C]/30 mb-3 text-center"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.5, ease }}
        >
          <p className="text-[#0B1E2D] font-semibold text-xs tracking-[0.15em]" style={{ fontFamily: "'Montserrat', sans-serif" }}>SAPPHIRE CRYSTAL</p>
          <p className="text-[#5A7A8F] text-[0.6rem] mt-1" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>Scratch-resistant · AR coating</p>
        </motion.div>

        {/* Left callout */}
        <motion.div
          className="absolute left-0 -translate-x-full top-[35%] pr-4 border-r border-[#1A3A5C]/30 mr-3 text-right"
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 1.8, ease }}
        >
          <p className="text-[#0B1E2D] font-semibold text-xs tracking-[0.15em]" style={{ fontFamily: "'Montserrat', sans-serif" }}>SCREW-DOWN PUSHERS</p>
          <p className="text-[#5A7A8F] text-[0.6rem] mt-1" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>Chronograph · Water-sealed</p>
        </motion.div>

        {/* Bottom callout */}
        <motion.div
          className="absolute bottom-0 translate-y-full left-1/2 -translate-x-1/2 pt-4 border-t border-[#1A3A5C]/30 mt-3 text-center"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 2.1, ease }}
        >
          <p className="text-[#0B1E2D] font-semibold text-xs tracking-[0.15em]" style={{ fontFamily: "'Montserrat', sans-serif" }}>OYSTER CASE</p>
          <p className="text-[#5A7A8F] text-[0.6rem] mt-1" style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}>950 Platinum · Monobloc</p>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   SCENE 5 — EXPLODE / DISASSEMBLE VIEW
   Each component label flies OUT from watch center,
   then at 4s they all fly BACK IN (assembly).
══════════════════════════════════════════════════ */
const COMPONENTS = [
  {
    id: "crystal",
    label: "SAPPHIRE CRYSTAL",
    sub: "Scratch-resistant",
    explodedX: 0, explodedY: -180,
    restX: 0, restY: -65,
  },
  {
    id: "bezel",
    label: "TACHYMETER BEZEL",
    sub: "Cerachrom ceramic",
    explodedX: -170, explodedY: -130,
    restX: -70, restY: -50,
  },
  {
    id: "dial",
    label: "ICE BLUE DIAL",
    sub: "Exclusive to Platinum",
    explodedX: -200, explodedY: 0,
    restX: -80, restY: 0,
  },
  {
    id: "movement",
    label: "CALIBRE 4130",
    sub: "290 parts · 72h power",
    explodedX: -160, explodedY: 150,
    restX: -65, restY: 60,
  },
  {
    id: "caseback",
    label: "PLATINUM CASE",
    sub: "950 Platinum · Monobloc",
    explodedX: 0, explodedY: 200,
    restX: 0, restY: 80,
  },
  {
    id: "bracelet",
    label: "OYSTER BRACELET",
    sub: "Ref. 78596 · Oysterlock",
    explodedX: 170, explodedY: 150,
    restX: 70, restY: 60,
  },
  {
    id: "crown",
    label: "TRIPLOCK CROWN",
    sub: "3-seal system",
    explodedX: 200, explodedY: 0,
    restX: 85, restY: 0,
  },
  {
    id: "pushers",
    label: "SCREW-DOWN PUSHERS",
    sub: "Start/Stop · Reset",
    explodedX: 170, explodedY: -130,
    restX: 70, restY: -50,
  },
];

function SceneExplode() {
  const [phase, setPhase] = useState<"explode" | "assemble">("explode");

  useEffect(() => {
    const t = setTimeout(() => setPhase("assemble"), 4500);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(180deg, #F5FAFE 0%, #FFFFFF 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease }}
    >
      <motion.p
        className="absolute top-[9vh] text-[#2C6088] text-xs tracking-[0.5em] uppercase"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 400 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {phase === "explode" ? "Disassembly View" : "Assembly · 290 Components"}
      </motion.p>

      {/* Title */}
      <motion.h2
        className="absolute bottom-[12vh] text-[#0B1E2D] text-center"
        style={{ fontSize: "clamp(1rem, 2vw, 1.6rem)", fontWeight: 600, letterSpacing: "0.05em" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {phase === "assemble" && (
          <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Precision Engineering · Calibre 4130
          </motion.span>
        )}
      </motion.h2>

      {/* Central watch image */}
      <div className="relative flex items-center justify-center" style={{ width: "35vmin", height: "35vmin" }}>
        <motion.img
          src={`${import.meta.env.BASE_URL}rolex-1-angle-crop.png?v=3`}
          alt="Rolex Daytona"
          className="w-full h-full object-contain"
          style={{ filter: "drop-shadow(0 10px 30px rgba(26,58,92,0.2))" }}
          animate={{ scale: phase === "explode" ? 0.85 : 1, opacity: phase === "explode" ? 0.7 : 1 }}
          transition={{ duration: 1, ease }}
        />

        {/* Component labels flying out/in */}
        {COMPONENTS.map(({ id, label, sub, explodedX, explodedY, restX, restY }, i) => {
          const isExploded = phase === "explode";
          return (
            <motion.div
              key={id}
              className="absolute flex flex-col items-center pointer-events-none"
              style={{ left: "50%", top: "50%", originX: "50%", originY: "50%" }}
              animate={{
                x: isExploded ? explodedX : restX,
                y: isExploded ? explodedY : restY,
                opacity: 1,
              }}
              initial={{ x: 0, y: 0, opacity: 0 }}
              transition={{
                delay: isExploded ? 0.5 + i * 0.1 : i * 0.07,
                duration: isExploded ? 0.8 : 0.6,
                ease: isExploded ? [0.34, 1.56, 0.64, 1] : [0.4, 0, 0.2, 1],
                opacity: { delay: 0.4, duration: 0.4 },
              }}
            >
              {/* Connector dot */}
              <div className="w-1 h-1 rounded-full bg-[#1A3A5C] mb-1 opacity-50" />
              {/* Label box */}
              <div
                className="px-2 py-1 rounded text-center"
                style={{
                  background: "rgba(235, 244, 250, 0.9)",
                  border: "0.5px solid rgba(26,58,92,0.2)",
                  backdropFilter: "blur(4px)",
                  minWidth: "80px",
                }}
              >
                <p
                  className="text-[#0B1E2D] leading-tight"
                  style={{ fontSize: "clamp(0.38rem, 0.85vw, 0.5rem)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, letterSpacing: "0.08em" }}
                >
                  {label}
                </p>
                <p
                  className="text-[#5A7A8F] leading-tight"
                  style={{ fontSize: "clamp(0.3rem, 0.65vw, 0.42rem)", fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}
                >
                  {sub}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════
   SCENE 6 — OUTRO
══════════════════════════════════════════════════ */
function SceneOutro() {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(160deg, #D6EAF8 0%, #EBF4FA 40%, #F5FAFE 100%)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease }}
    >
      {/* Watch image — centered, large */}
      <motion.img
        src={`${import.meta.env.BASE_URL}rolex-4-front-crop.png?v=3`}
        alt="Rolex Daytona"
        className="w-[28vmin] h-[28vmin] object-contain mb-8"
        style={{ filter: "drop-shadow(0 20px 50px rgba(26,58,92,0.25))" }}
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.3, ease }}
      />

      <motion.p
        className="text-[#1A3A5C] text-xs tracking-[0.6em] uppercase mb-2"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.8 }}
      >
        ROLEX
      </motion.p>

      <motion.h1
        className="text-[#0B1E2D] tracking-[0.1em] mb-1"
        style={{ fontSize: "clamp(2rem, 5vw, 4rem)", fontWeight: 700 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.0, ease }}
      >
        COSMOGRAPH DAYTONA
      </motion.h1>

      <motion.p
        className="text-[#2C6088] italic text-xl"
        style={{ fontWeight: 300 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1.4 }}
      >
        The Enduring Icon.
      </motion.p>

      <motion.div
        className="h-[1px] bg-[#1A3A5C]/20 mt-8 mb-4"
        initial={{ width: 0 }}
        animate={{ width: "120px" }}
        transition={{ duration: 0.8, delay: 1.8, ease }}
      />

      <motion.p
        className="text-[#5A7A8F] text-[0.6rem] tracking-[0.4em] uppercase"
        style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 300 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 2.2 }}
      >
        Reference 116506 · 950 Platinum · Calibre 4130
      </motion.p>
    </motion.div>
  );
}
