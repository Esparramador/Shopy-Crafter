import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SCENE_DURATIONS = [5000, 9000, 6000, 6000, 6000, 6000, 2000];

export default function RolexAd() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const duration = SCENE_DURATIONS[currentScene];
    const timer = setTimeout(() => {
      setCurrentScene((prev) => (prev + 1) % SCENE_DURATIONS.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [currentScene]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0A0A0A] text-[#F8F8F8] font-serif" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
      
      {/* Letterbox bars */}
      <div className="fixed top-0 left-0 right-0 h-[8vh] bg-[#0A0A0A] z-50 pointer-events-none" />
      <div className="fixed bottom-0 left-0 right-0 h-[8vh] bg-[#0A0A0A] z-50 pointer-events-none" />

      <AnimatePresence mode="sync">
        {currentScene === 0 && <Scene1 key="scene1" />}
        {currentScene === 1 && <Scene2 key="scene2" />}
        {currentScene === 2 && <Scene3 key="scene3" />}
        {currentScene === 3 && <Scene4 key="scene4" />}
        {currentScene === 4 && <Scene5 key="scene5" />}
        {currentScene === 5 && <Scene6 key="scene6" />}
        {currentScene === 6 && <Scene7 key="scene7" />}
      </AnimatePresence>
    </div>
  );
}

const easeCurve = [0.25, 1, 0.5, 1];

function Scene1() {
  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: easeCurve }}
    >
      <motion.h1 
        className="text-8xl tracking-[0.5em] text-[#F8F8F8] italic font-black"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 2, delay: 0.5, ease: easeCurve }}
      >
        ROLEX
      </motion.h1>
      <motion.div
        style={{ overflow: "hidden", whiteSpace: "nowrap" }}
        initial={{ clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 2, delay: 2.5, ease: easeCurve }}
      >
        <p className="text-xl tracking-[0.45em] text-[#F8F8F8] mt-8 uppercase font-light">
          COSMOGRAPH DAYTONA
        </p>
      </motion.div>
    </motion.div>
  );
}

function Scene2() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setPhase(1), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: easeCurve }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}rolex-1-angle.png`} 
        className="w-full h-full object-cover"
        initial={{ scale: 1.0, x: 0 }}
        animate={{ scale: 1.05, x: 20 }}
        transition={{ duration: 10, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-black/10" />
      
      {/* Platinum rule line sweeps in at bottom-right corner */}
      <motion.div 
        className="absolute bottom-[15vh] right-[5vw] h-[1px] bg-[#F8F8F8]"
        initial={{ width: 0, opacity: 0 }}
        animate={phase === 0 ? { width: "20vw", opacity: 0.5 } : { width: 0, opacity: 0, right: "25vw" }}
        transition={{ duration: 1.5, ease: easeCurve }}
      />
    </motion.div>
  );
}

function Scene3() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: easeCurve }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}rolex-2-dial.png`} 
        className="w-full h-full object-cover"
        initial={{ scale: 1.0 }}
        animate={{ scale: 1.12 }}
        transition={{ duration: 8, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      
      <div className="absolute bottom-[15vh] left-[8vw] z-20">
        <motion.div 
          className="h-[1px] bg-[#F8F8F8] mb-4"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "60px", opacity: 0.6 }}
          transition={{ duration: 1.5, delay: 1, ease: easeCurve }}
        />
        <motion.h2 
          className="text-[#C9A96E] text-2xl tracking-[0.3em] font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 1.5, ease: easeCurve }}
        >
          <span style={{ fontVariant: "small-caps" }}>ICE BLUE DIAL</span>
        </motion.h2>
        <motion.p 
          className="text-[#F8F8F8]/80 text-lg tracking-widest mt-3 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 2.5, ease: easeCurve }}
        >
          Meteorite — Platinum 950
        </motion.p>
      </div>
    </motion.div>
  );
}

function Scene4() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: easeCurve }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}rolex-3-crown.png`} 
        className="w-full h-full object-cover origin-right"
        initial={{ scale: 1.0 }}
        animate={{ scale: 1.1 }}
        transition={{ duration: 8, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 to-transparent" />
      
      <div className="absolute top-[40vh] right-[8vw] z-20 text-right">
        <motion.div 
          className="h-[1px] bg-[#F8F8F8] mb-4 ml-auto"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "60px", opacity: 0.6 }}
          transition={{ duration: 1.5, delay: 1, ease: easeCurve }}
        />
        <motion.h2 
          className="text-[#C9A96E] text-2xl tracking-[0.3em] font-medium uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, delay: 1.5, ease: easeCurve }}
        >
          OYSTER CROWN
        </motion.h2>
        <motion.p 
          className="text-[#F8F8F8]/80 text-lg tracking-widest mt-3 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 2.5, ease: easeCurve }}
        >
          Triple Waterproofness System
        </motion.p>
      </div>
    </motion.div>
  );
}

function Scene5() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: easeCurve }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}rolex-5-flatlay.png`} 
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.15 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 8, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="relative z-20 text-center flex flex-col items-center">
        <motion.div 
          className="h-[1px] bg-[#F8F8F8] mb-8"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: "100px", opacity: 0.5 }}
          transition={{ duration: 1.5, delay: 0.5, ease: easeCurve }}
        />
        <motion.h2 
          className="text-[#F8F8F8] text-4xl tracking-[0.4em] uppercase font-light"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 2, delay: 1, ease: easeCurve }}
        >
          COSMOGRAPH DAYTONA
        </motion.h2>
        <motion.p 
          className="text-[#C9A96E] text-xl tracking-[0.2em] mt-6 font-light"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 2.5, ease: easeCurve }}
        >
          Reference 116506 — Platinum
        </motion.p>
      </div>
    </motion.div>
  );
}

function Scene6() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0A0A0A]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: easeCurve }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}rolex-4-front.png`} 
        className="absolute inset-0 w-full h-full object-cover origin-center"
        initial={{ scale: 1.0 }}
        animate={{ scale: 1.05 }}
        transition={{ duration: 8, ease: "linear" }}
      />
      <div className="absolute inset-0 bg-black/20" />
      
      <motion.div 
        className="relative z-20 w-full h-full flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.5, delay: 1, ease: easeCurve }}
      >
        <h2 className="text-[#F8F8F8] text-6xl italic font-light tracking-[0.1em]">
          The Enduring Icon.
        </h2>
      </motion.div>
    </motion.div>
  );
}

function Scene7() {
  return (
    <motion.div 
      className="absolute inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 2, ease: easeCurve }}
    >
      <motion.svg
        viewBox="0 0 100 100"
        className="w-24 h-24 mb-6 fill-[#F8F8F8]"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, delay: 0.5, ease: easeCurve }}
      >
        <path d="M49.9 8.5L41.3 35l-18.7-3L36 51 18.2 60l25.8 4.2L49.9 92l6-27.8 25.8-4.2-17.8-9L80 32 61.3 35z" />
        <ellipse cx="49.9" cy="70" rx="15" ry="10" stroke="#F8F8F8" strokeWidth="3" fill="none" />
        <ellipse cx="49.9" cy="75" rx="12" ry="5" fill="#F8F8F8" />
      </motion.svg>
      
      <motion.h1 
        className="text-4xl tracking-[0.5em] text-[#F8F8F8] font-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 1, ease: easeCurve }}
        style={{ fontFamily: '"Playfair Display", serif' }}
      >
        ROLEX
      </motion.h1>
    </motion.div>
  );
}
