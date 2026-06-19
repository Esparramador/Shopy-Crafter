/**
 * Visme Effects Engine
 * 30 pre-built CSS/JS snippets + 594 Visme templates + DNA variable substitution
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const _dir = dirname(fileURLToPath(import.meta.url));
const _dataDir = join(_dir, "data");

export interface DnaVars {
  name: string;
  sector: string;
  font: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  headline: string;
  tagline: string;
  cta: string;
  icon?: string;
  usp1?: string;
  usp2?: string;
  usp3?: string;
}

export const DEFAULT_DNA: DnaVars = {
  name: "Brand",
  sector: "Agency",
  font: "Inter",
  primary: "#c9a961",
  secondary: "#2a7a4b",
  accent: "#d4a843",
  bg: "#0a0a0f",
  surface: "#111118",
  text: "#f1f5f9",
  headline: "Construye algo extraordinario",
  tagline: "La agencia que convierte ideas en experiencias",
  cta: "Empezar ahora",
  icon: "🚀",
  usp1: "Resultados reales",
  usp2: "Sin compromisos",
  usp3: "Setup en 5 minutos",
};

export function applyDna(code: string, dna: DnaVars = DEFAULT_DNA): string {
  return code
    .replace(/__PRIMARY__/g, dna.primary)
    .replace(/__SECONDARY__/g, dna.secondary)
    .replace(/__ACCENT__/g, dna.accent)
    .replace(/__BG__/g, dna.bg)
    .replace(/__SURFACE__/g, dna.surface)
    .replace(/__TEXT__/g, dna.text)
    .replace(/__FONT__/g, dna.font)
    .replace(/__NAME__/g, dna.name)
    .replace(/__HEADLINE__/g, dna.headline)
    .replace(/__TAGLINE__/g, dna.tagline)
    .replace(/__CTA__/g, dna.cta)
    .replace(/__SECTOR__/g, dna.sector)
    .replace(/__ICON__/g, dna.icon ?? "🚀")
    .replace(/__USP_1__/g, dna.usp1 ?? "Resultados reales")
    .replace(/__USP_2__/g, dna.usp2 ?? "Sin compromisos")
    .replace(/__USP_3__/g, dna.usp3 ?? "Setup en 5 minutos");
}

export function buildDnaFromProject(project: any): DnaVars {
  const dna = project?.brandDna ?? project?.brand_dna ?? {};
  const fullProfile = (() => { try { return typeof dna.fullProfileJson === "string" ? JSON.parse(dna.fullProfileJson) : (dna.fullProfileJson ?? {}); } catch { return {}; } })();
  return {
    name: project?.name ?? dna.brandName ?? "Brand",
    sector: dna.sector ?? project?.sector ?? "eCommerce",
    font: dna.primaryFont ?? "Inter",
    primary: dna.primaryColor ?? "#c9a961",
    secondary: dna.secondaryColor ?? "#2a7a4b",
    accent: dna.accentColor ?? "#d4a843",
    bg: dna.bgColor ?? "#0a0a0f",
    surface: dna.surfaceColor ?? "#111118",
    text: dna.textColor ?? "#f1f5f9",
    headline: fullProfile.taglines?.[0] ?? dna.tagline ?? project?.name ?? "Brand",
    tagline: dna.tagline ?? fullProfile.unique_value_proposition ?? "Tienda optimizada con IA",
    cta: dna.ctaText ?? "Empezar ahora",
    icon: "🛍️",
    usp1: fullProfile.services?.[0] ?? "Optimización IA",
    usp2: fullProfile.services?.[1] ?? "Sin compromisos",
    usp3: fullProfile.services?.[2] ?? "Resultados reales",
  };
}

export interface EffectSnippet {
  id: string;
  name: string;
  category: string;
  description: string;
  libs: string[];
  html: string;
  css: string;
  js: string;
}

export const EFFECT_SNIPPETS: EffectSnippet[] = [
  {
    id: "particle_rain",
    name: "Lluvia de Partículas",
    category: "particle_effects",
    description: "Partículas animadas cayendo sobre fondo oscuro — Canvas 2D puro, sin deps",
    libs: [],
    html: '<canvas id="fx-particles" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;"></canvas>',
    css: "",
    js: `(function(){var c=document.getElementById('fx-particles');if(!c)return;var x=c.getContext('2d');function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}resize();window.addEventListener('resize',resize);var P=[];for(var i=0;i<160;i++)P.push({x:Math.random()*c.width,y:Math.random()*c.height,v:0.8+Math.random()*2.5,r:Math.random()*1.5+0.3,o:Math.random()*0.5+0.15});(function tick(){x.clearRect(0,0,c.width,c.height);P.forEach(function(p){p.y+=p.v;if(p.y>c.height)p.y=-5;x.beginPath();x.arc(p.x,p.y,p.r,0,Math.PI*2);x.fillStyle='__PRIMARY__';x.globalAlpha=p.o;x.fill();});x.globalAlpha=1;requestAnimationFrame(tick);})();})();`,
  },
  {
    id: "aurora_bg",
    name: "Fondo Aurora",
    category: "background_effects",
    description: "Degradado animado tipo aurora boreal — CSS puro, sin deps",
    libs: [],
    html: '<div class="fx-aurora-bg"></div>',
    css: `.fx-aurora-bg{position:fixed;inset:0;z-index:-1;background:linear-gradient(-45deg,__BG__,__PRIMARY__,__SECONDARY__,#8b5cf6,__PRIMARY__);background-size:400% 400%;animation:aurora-move 12s ease infinite;}
@keyframes aurora-move{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}`,
    js: "",
  },
  {
    id: "magnetic_btn",
    name: "Botones Magnéticos",
    category: "micro_interactions",
    description: "Botones que se mueven hacia el cursor (efecto magnético) — JS puro",
    libs: [],
    html: '<button class="fx-magnetic">__CTA__</button>',
    css: `.fx-magnetic{display:inline-flex;align-items:center;justify-content:center;padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:100px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:600;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;will-change:transform;}
.fx-magnetic:hover{box-shadow:0 8px 32px __PRIMARY__80;}`,
    js: `document.querySelectorAll('.fx-magnetic').forEach(function(el){el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();var x=(e.clientX-r.left-r.width/2)*0.35;var y=(e.clientY-r.top-r.height/2)*0.35;el.style.transform='translate('+x+'px,'+y+'px)';});el.addEventListener('mouseleave',function(){el.style.transform='';});});`,
  },
  {
    id: "text_reveal_scroll",
    name: "Texto Reveal en Scroll",
    category: "text_effects",
    description: "Palabras/líneas que aparecen al entrar en viewport — IntersectionObserver, sin deps",
    libs: [],
    html: '<h2 class="fx-reveal">__HEADLINE__</h2>',
    css: `.fx-reveal{overflow:hidden;}.fx-reveal span{display:inline-block;opacity:0;transform:translateY(40px);transition:opacity .6s cubic-bezier(.215,.61,.355,1),transform .6s cubic-bezier(.215,.61,.355,1);}
.fx-reveal span.vis{opacity:1;transform:none;}`,
    js: `document.querySelectorAll('.fx-reveal').forEach(function(el){var words=el.textContent.split(' ');el.innerHTML=words.map(function(w){return '<span>'+w+'</span>';}).join(' ');var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.querySelectorAll('span').forEach(function(s,i){setTimeout(function(){s.classList.add('vis');},i*80);});}});},{threshold:0.2});io.observe(el);});`,
  },
  {
    id: "glass_card",
    name: "Tarjeta Glassmorphism",
    category: "cards",
    description: "Tarjeta con efecto vidrio esmerilado (backdrop-filter) — CSS puro",
    libs: [],
    html: '<div class="fx-glass"><h3>__NAME__</h3><p>__TAGLINE__</p></div>',
    css: `.fx-glass{background:rgba(255,255,255,0.05);backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;box-shadow:0 8px 48px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1);transition:transform .3s ease,box-shadow .3s ease;}
.fx-glass:hover{transform:translateY(-6px);box-shadow:0 20px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.15);}`,
    js: "",
  },
  {
    id: "neon_glow",
    name: "Resplandor Neon",
    category: "text_effects",
    description: "Texto con efecto neon animado pulsante — CSS puro",
    libs: [],
    html: '<h1 class="fx-neon">__HEADLINE__</h1>',
    css: `.fx-neon{color:#fff;text-shadow:0 0 7px #fff,0 0 10px #fff,0 0 21px __PRIMARY__,0 0 42px __PRIMARY__,0 0 82px __PRIMARY__;animation:neon-flicker 3s infinite alternate;}
@keyframes neon-flicker{0%,18%,22%,25%,53%,57%,100%{text-shadow:0 0 4px #fff,0 0 11px #fff,0 0 19px #fff,0 0 40px __PRIMARY__,0 0 80px __PRIMARY__,0 0 90px __PRIMARY__;}20%,24%,55%{text-shadow:none;}}`,
    js: "",
  },
  {
    id: "tilt_3d_card",
    name: "Tarjeta Tilt 3D",
    category: "3d_effects",
    description: "Tarjeta con inclinación 3D reactiva al cursor — CSS perspective + JS",
    libs: [],
    html: '<div class="fx-tilt"><div class="fx-tilt-inner"><h3>__NAME__</h3><p>__TAGLINE__</p></div></div>',
    css: `.fx-tilt{perspective:1000px;display:inline-block;}.fx-tilt-inner{background:__SURFACE__;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px 48px;transform-style:preserve-3d;transition:transform .1s linear;will-change:transform;}
.fx-tilt-inner h3{transform:translateZ(20px);font-family:__FONT__,sans-serif;color:__TEXT__;}
.fx-tilt-inner p{transform:translateZ(10px);color:rgba(255,255,255,0.6);}`,
    js: `document.querySelectorAll('.fx-tilt').forEach(function(wrap){var el=wrap.querySelector('.fx-tilt-inner');wrap.addEventListener('mousemove',function(e){var r=wrap.getBoundingClientRect();var x=((e.clientX-r.left)/r.width-.5)*22;var y=(-(e.clientY-r.top)/r.height+.5)*22;el.style.transform='rotateY('+x+'deg) rotateX('+y+'deg)';});wrap.addEventListener('mouseleave',function(){el.style.transform='rotateY(0) rotateX(0)';});});`,
  },
  {
    id: "gradient_mesh",
    name: "Malla Degradado Animada",
    category: "background_effects",
    description: "Fondo con gradientes radiales en movimiento — CSS puro, no deps",
    libs: [],
    html: '<div class="fx-mesh-bg"></div>',
    css: `.fx-mesh-bg{position:fixed;inset:0;z-index:-1;background:__BG__;overflow:hidden;}
.fx-mesh-bg::before,.fx-mesh-bg::after{content:'';position:absolute;border-radius:50%;filter:blur(80px);opacity:.6;}
.fx-mesh-bg::before{width:60vw;height:60vw;background:radial-gradient(circle,__PRIMARY__80,transparent 70%);top:-20%;left:-10%;animation:mesh-a 10s ease-in-out infinite alternate;}
.fx-mesh-bg::after{width:50vw;height:50vw;background:radial-gradient(circle,__SECONDARY__60,transparent 70%);bottom:-15%;right:-5%;animation:mesh-b 12s ease-in-out infinite alternate;}
@keyframes mesh-a{from{transform:translate(0,0) scale(1);}to{transform:translate(10%,15%) scale(1.1);}}
@keyframes mesh-b{from{transform:translate(0,0) scale(1);}to{transform:translate(-8%,-10%) scale(1.15);}}`,
    js: "",
  },
  {
    id: "typing_text",
    name: "Efecto Máquina de Escribir",
    category: "typography_effects",
    description: "Texto que se escribe solo con cursor parpadeante — CSS + JS puro",
    libs: [],
    html: '<p class="fx-typing" data-text="__HEADLINE__"></p>',
    css: `.fx-typing::after{content:'|';animation:blink .7s infinite;color:__PRIMARY__;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}`,
    js: `document.querySelectorAll('.fx-typing').forEach(function(el){var text=el.dataset.text||el.textContent;el.textContent='';var i=0;function type(){if(i<text.length){el.textContent+=text[i++];setTimeout(type,55+Math.random()*45);}};setTimeout(type,600);});`,
  },
  {
    id: "svg_stroke_anim",
    name: "Trazo SVG Animado",
    category: "logo_animations",
    description: "Dibujo SVG con trazo animado tipo 'dibujando en vivo' — CSS puro",
    libs: [],
    html: '<svg class="fx-stroke" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><text x="0" y="50" font-size="48" font-family="__FONT__,sans-serif" fill="none" stroke="__PRIMARY__" stroke-width="1.5">__NAME__</text></svg>',
    css: `.fx-stroke text{stroke-dasharray:600;stroke-dashoffset:600;animation:draw 2.5s ease forwards;}
@keyframes draw{to{stroke-dashoffset:0;}}`,
    js: "",
  },
  {
    id: "confetti_burst",
    name: "Explosión de Confeti",
    category: "celebration_effects",
    description: "Confeti animado desde el centro al hacer clic — Canvas 2D, sin deps",
    libs: [],
    html: '<button class="fx-confetti-btn" onclick="fxConfetti(this)">__CTA__ 🎉</button><canvas id="fx-confetti" style="position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%;"></canvas>',
    css: ".fx-confetti-btn{padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:100px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:600;cursor:pointer;}",
    js: `window.fxConfetti=function(btn){var cv=document.getElementById('fx-confetti');var ctx=cv.getContext('2d');cv.width=window.innerWidth;cv.height=window.innerHeight;var colors=['__PRIMARY__','__SECONDARY__','#f59e0b','#10b981','#3b82f6','#ec4899'];var pieces=[];for(var i=0;i<200;i++)pieces.push({x:cv.width/2,y:cv.height/2,vx:(Math.random()-0.5)*14,vy:(Math.random()-1)*12,r:4+Math.random()*4,color:colors[Math.floor(Math.random()*colors.length)],alpha:1,gravity:.35});(function tick(){ctx.clearRect(0,0,cv.width,cv.height);pieces.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=p.gravity;p.alpha-=0.012;if(p.alpha>0){ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r*1.5);}});ctx.globalAlpha=1;if(pieces.some(function(p){return p.alpha>0;}))requestAnimationFrame(tick);else ctx.clearRect(0,0,cv.width,cv.height);})();};`,
  },
  {
    id: "floating_element",
    name: "Elemento Flotante",
    category: "animated_icons",
    description: "Elemento que flota suavemente arriba/abajo — CSS puro",
    libs: [],
    html: '<div class="fx-float">__ICON__</div>',
    css: ".fx-float{display:inline-block;animation:float-ud 3s ease-in-out infinite;font-size:3rem;}\n@keyframes float-ud{0%,100%{transform:translateY(0);}50%{transform:translateY(-18px);}}",
    js: "",
  },
  {
    id: "ripple_click",
    name: "Efecto Ripple al Click",
    category: "micro_interactions",
    description: "Ola de expansión al hacer clic en cualquier botón — JS + CSS, sin deps",
    libs: [],
    html: '<button class="fx-ripple-btn">__CTA__</button>',
    css: ".fx-ripple-btn{position:relative;overflow:hidden;padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:8px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:600;cursor:pointer;}\n.fx-ripple-btn .ripple{position:absolute;border-radius:50%;transform:scale(0);animation:ripple-anim .5s linear;background:rgba(255,255,255,.35);}\n@keyframes ripple-anim{to{transform:scale(4);opacity:0;}}",
    js: `document.querySelectorAll('.fx-ripple-btn').forEach(function(btn){btn.addEventListener('click',function(e){var span=document.createElement('span');span.className='ripple';var r=btn.getBoundingClientRect();var s=Math.max(r.width,r.height);span.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px;';btn.appendChild(span);setTimeout(function(){span.remove();},500);});});`,
  },
  {
    id: "skeleton_loader",
    name: "Skeleton Loader",
    category: "loaders",
    description: "Placeholder shimmer para contenido cargando — CSS puro",
    libs: [],
    html: '<div class="fx-skeleton"><div class="fx-sk-line w-60"></div><div class="fx-sk-line w-90"></div><div class="fx-sk-line w-40"></div><div class="fx-sk-block"></div></div>',
    css: ".fx-skeleton{padding:24px;}\n.fx-sk-line,.fx-sk-block{background:linear-gradient(90deg,__SURFACE__ 25%,rgba(255,255,255,.08) 50%,__SURFACE__ 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:6px;margin-bottom:12px;height:14px;}\n.fx-sk-block{height:120px;}\n.w-60{width:60%;}\n.w-90{width:90%;}\n.w-40{width:40%;}\n@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}",
    js: "",
  },
  {
    id: "scroll_progress_bar",
    name: "Barra Progreso Scroll",
    category: "scroll_indicators",
    description: "Barra superior que indica progreso de lectura de la página — JS + CSS",
    libs: [],
    html: '<div id="fx-scroll-bar"></div>',
    css: "#fx-scroll-bar{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,__PRIMARY__,__SECONDARY__);width:0%;z-index:9999;transition:width .1s linear;}",
    js: `window.addEventListener('scroll',function(){var scrolled=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100;document.getElementById('fx-scroll-bar').style.width=scrolled+'%';});`,
  },
  {
    id: "count_up",
    name: "Contador Animado",
    category: "charts",
    description: "Números que cuentan hasta su valor final al entrar en viewport — IntersectionObserver",
    libs: [],
    html: '<div class="fx-stats"><span class="fx-count" data-target="2400">0</span>+ clientes</div>',
    css: ".fx-stats{font-family:__FONT__,sans-serif;font-size:3rem;font-weight:700;color:__PRIMARY__;}\n.fx-count{display:inline-block;}",
    js: `var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){var el=entry.target;var end=parseInt(el.dataset.target);var step=end/(1800/16);var cur=0;var raf=setInterval(function(){cur+=step;if(cur>=end){el.textContent=end.toLocaleString();clearInterval(raf);}else{el.textContent=Math.floor(cur).toLocaleString();}},16);io.unobserve(el);}});},{threshold:0.5});document.querySelectorAll('.fx-count').forEach(function(el){io.observe(el);});`,
  },
  {
    id: "blob_morph",
    name: "Blob Morphing",
    category: "background_effects",
    description: "Forma orgánica que cambia de forma suavemente — CSS puro",
    libs: [],
    html: '<div class="fx-blob"></div>',
    css: ".fx-blob{width:400px;height:400px;background:radial-gradient(circle at 30% 40%,__PRIMARY__,__SECONDARY__);filter:blur(2px);animation:blob-morph 8s ease-in-out infinite;}\n@keyframes blob-morph{0%,100%{border-radius:60% 40% 30% 70% / 60% 30% 70% 40%;}25%{border-radius:30% 60% 70% 40% / 50% 60% 30% 60%;}50%{border-radius:50% 60% 30% 60% / 40% 30% 60% 50%;}75%{border-radius:40% 50% 60% 30% / 30% 60% 40% 50%;}}",
    js: "",
  },
  {
    id: "text_scramble",
    name: "Texto Scramble",
    category: "text_effects",
    description: "Texto que se 'descifra' al hacer hover — JS puro, sin deps",
    libs: [],
    html: '<h2 class="fx-scramble" data-text="__HEADLINE__">__HEADLINE__</h2>',
    css: ".fx-scramble{font-family:__FONT__,sans-serif;color:__TEXT__;cursor:pointer;display:inline-block;}",
    js: `document.querySelectorAll('.fx-scramble').forEach(function(el){var chars='!<>-_\\/[]{}—=+*^?#________';var orig=el.dataset.text||el.textContent;el.addEventListener('mouseenter',function(){var iter=0;var interval=setInterval(function(){el.textContent=orig.split('').map(function(letter,index){if(index<iter)return orig[index];return chars[Math.floor(Math.random()*chars.length)];}).join('');iter+=1/3;if(iter>=orig.length)clearInterval(interval);},30);});});`,
  },
  {
    id: "clip_path_reveal",
    name: "Reveal por Clip-Path",
    category: "transition_effects",
    description: "Elementos que se revelan con clip-path al entrar en viewport — CSS + IntersectionObserver",
    libs: [],
    html: '<div class="fx-clip-reveal"><img src="https://picsum.photos/seed/__SECTOR__/800/450" alt="__NAME__" style="width:100%;"></div>',
    css: ".fx-clip-reveal{clip-path:inset(100% 0 0 0);transition:clip-path .9s cubic-bezier(.215,.61,.355,1);}\n.fx-clip-reveal.vis{clip-path:inset(0% 0 0 0);}",
    js: `var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:0.15});document.querySelectorAll('.fx-clip-reveal').forEach(function(el){io.observe(el);});`,
  },
  {
    id: "cursor_glow_trail",
    name: "Aura de Cursor",
    category: "interactive_effects",
    description: "Efecto de luz que sigue al cursor — JS mousemove + CSS radial-gradient",
    libs: [],
    html: '<div class="fx-cursor-glow"></div>',
    css: ".fx-cursor-glow{pointer-events:none;position:fixed;inset:0;z-index:9998;background:radial-gradient(600px circle at 0px 0px,__PRIMARY__20,transparent 60%);mix-blend-mode:screen;}",
    js: `var el=document.querySelector('.fx-cursor-glow');if(el)window.addEventListener('mousemove',function(e){el.style.background='radial-gradient(600px circle at '+e.clientX+'px '+e.clientY+'px,__PRIMARY__25,transparent 60%)';});`,
  },
  {
    id: "flip_card",
    name: "Tarjeta Flip 3D",
    category: "3d_effects",
    description: "Tarjeta que se voltea en 3D al hacer hover — CSS 3D puro",
    libs: [],
    html: '<div class="fx-flip"><div class="fx-flip-front"><h3>__NAME__</h3></div><div class="fx-flip-back"><p>__TAGLINE__</p></div></div>',
    css: ".fx-flip{perspective:1000px;width:300px;height:200px;cursor:pointer;}\n.fx-flip-front,.fx-flip-back{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:24px;transition:transform .6s cubic-bezier(.215,.61,.355,1);}\n.fx-flip-front{background:__SURFACE__;border:1px solid rgba(255,255,255,.08);color:__TEXT__;}\n.fx-flip-back{background:__PRIMARY__;color:#fff;transform:rotateY(180deg);}\n.fx-flip{position:relative;}\n.fx-flip:hover .fx-flip-front{transform:rotateY(-180deg);}\n.fx-flip:hover .fx-flip-back{transform:rotateY(0);}",
    js: "",
  },
  {
    id: "marquee_infinite",
    name: "Marquee Infinito",
    category: "animated_icons",
    description: "Tira de texto o logos que se desplaza infinitamente — CSS animation",
    libs: [],
    html: '<div class="fx-marquee-wrap"><div class="fx-marquee"><span>__NAME__</span><span>✦</span><span>__SECTOR__</span><span>✦</span><span>__HEADLINE__</span><span>✦</span><span>__NAME__</span><span>✦</span><span>__SECTOR__</span><span>✦</span><span>__HEADLINE__</span><span>✦</span></div></div>',
    css: ".fx-marquee-wrap{overflow:hidden;white-space:nowrap;border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);padding:14px 0;}\n.fx-marquee{display:inline-block;animation:marquee-scroll 20s linear infinite;}\n.fx-marquee span{margin:0 24px;font-family:__FONT__,sans-serif;color:__TEXT__;opacity:.6;font-size:.9rem;letter-spacing:.15em;text-transform:uppercase;}\n@keyframes marquee-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
    js: "",
  },
  {
    id: "grid_hover_glow",
    name: "Grid Hover Resplandor",
    category: "interactive_effects",
    description: "Grid de tarjetas donde el hover ilumina desde el cursor — JS + CSS custom properties",
    libs: [],
    html: '<div class="fx-grid"><div class="fx-grid-item"><h4>__USP_1__</h4><p>__TAGLINE__</p></div><div class="fx-grid-item"><h4>__USP_2__</h4><p>__TAGLINE__</p></div><div class="fx-grid-item"><h4>__USP_3__</h4><p>__TAGLINE__</p></div></div>',
    css: ".fx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}\n.fx-grid-item{position:relative;padding:28px;border-radius:16px;border:1px solid rgba(255,255,255,.08);overflow:hidden;background:__SURFACE__;color:__TEXT__;font-family:__FONT__,sans-serif;}\n.fx-grid-item::before{content:'';position:absolute;width:300px;height:300px;background:radial-gradient(circle,__PRIMARY__30,transparent 70%);border-radius:50%;transform:translate(var(--mx,-150px),var(--my,-150px));transition:transform .05s;pointer-events:none;}\n.fx-grid-item h4{position:relative;color:__TEXT__;margin-bottom:8px;}\n.fx-grid-item p{position:relative;opacity:.6;font-size:.9rem;}",
    js: `document.querySelectorAll('.fx-grid-item').forEach(function(el){el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();el.style.setProperty('--mx',(e.clientX-r.left-150)+'px');el.style.setProperty('--my',(e.clientY-r.top-150)+'px');});});`,
  },
  {
    id: "wave_svg_bg",
    name: "Ola SVG de Fondo",
    category: "background_effects",
    description: "Ola SVG animada en la parte inferior de la sección — SVG + CSS animation",
    libs: [],
    html: '<div class="fx-wave-section"><h2>__HEADLINE__</h2><p>__TAGLINE__</p><svg class="fx-wave" xmlns="http://www.w3.org/2000/svg" viewBox="0 24 150 28" preserveAspectRatio="none"><defs><path id="wave-path" d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"/></defs><g class="parallax"><use href="#wave-path" x="48" y="0" fill="__PRIMARY__22"/><use href="#wave-path" x="48" y="3" fill="__PRIMARY__16"/><use href="#wave-path" x="48" y="5" fill="__PRIMARY__10"/></g></svg></div>',
    css: ".fx-wave-section{position:relative;padding:80px 40px 120px;text-align:center;overflow:hidden;}\n.fx-wave-section h2{font-family:__FONT__,sans-serif;font-size:2.5rem;color:__TEXT__;margin-bottom:16px;}\n.fx-wave-section p{color:rgba(255,255,255,.6);}\n.fx-wave{position:absolute;bottom:0;left:0;width:100%;height:80px;}\n.fx-wave .parallax>use{animation:wave-move 25s cubic-bezier(.55,.5,.45,.5) infinite;}\n.fx-wave .parallax>use:nth-child(1){animation-delay:-2s;animation-duration:7s;}\n.fx-wave .parallax>use:nth-child(2){animation-delay:-3s;animation-duration:10s;}\n.fx-wave .parallax>use:nth-child(3){animation-delay:-4s;animation-duration:13s;}\n@keyframes wave-move{from{transform:translate3d(-90px,0,0)}to{transform:translate3d(85px,0,0)}}",
    js: "",
  },
  {
    id: "stagger_entrance",
    name: "Aparición Escalonada",
    category: "transition_effects",
    description: "Elementos de una lista/grid que aparecen uno a uno al hacer scroll",
    libs: [],
    html: '<ul class="fx-stagger"><li>__USP_1__</li><li>__USP_2__</li><li>__USP_3__</li><li>__CTA__</li></ul>',
    css: ".fx-stagger li{opacity:0;transform:translateY(30px);transition:opacity .5s ease,transform .5s ease;font-family:__FONT__,sans-serif;color:__TEXT__;padding:10px 0;list-style:none;border-bottom:1px solid rgba(255,255,255,.08);}\n.fx-stagger li.vis{opacity:1;transform:none;}",
    js: `var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var items=e.target.querySelectorAll('li');items.forEach(function(item,i){setTimeout(function(){item.classList.add('vis');},i*100);});io.unobserve(e.target);}});},{threshold:0.15});document.querySelectorAll('.fx-stagger').forEach(function(el){io.observe(el);});`,
  },
  {
    id: "gsap_text_split",
    name: "GSAP Text Split",
    category: "typography_effects",
    description: "Texto dividido carácter a carácter con GSAP — requiere GSAP CDN",
    libs: ["https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"],
    html: '<h1 class="fx-gsap-title">__HEADLINE__</h1>',
    css: ".fx-gsap-title{font-family:__FONT__,sans-serif;color:__TEXT__;overflow:hidden;}\n.fx-gsap-title .char{display:inline-block;}",
    js: `window.addEventListener('load',function(){if(typeof gsap==='undefined')return;var el=document.querySelector('.fx-gsap-title');var text=el.textContent;el.innerHTML=text.split('').map(function(c){return c===' '?'<span class="char"> </span>':'<span class="char">'+c+'</span>';}).join('');gsap.from('.fx-gsap-title .char',{opacity:0,y:60,rotateX:-90,stagger:.03,duration:.8,ease:'back.out(1.7)',delay:.2});});`,
  },
  {
    id: "threejs_particle_sphere",
    name: "Three.js Esfera de Partículas",
    category: "3d_effects",
    description: "Esfera giratoria de partículas con Three.js r158",
    libs: ["https://unpkg.com/three@0.158.0/build/three.module.js"],
    html: '<canvas id="fx-three-canvas" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;"></canvas>',
    css: "",
    js: `(async function(){try{const THREE=await import('https://unpkg.com/three@0.158.0/build/three.module.js');const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,100);camera.position.z=3;const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('fx-three-canvas'),alpha:true,antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(devicePixelRatio);const geo=new THREE.BufferGeometry();const N=5000;const pos=new Float32Array(N*3);for(let i=0;i<N*3;){const theta=Math.random()*Math.PI*2;const phi=Math.acos(2*Math.random()-1);const r=1+Math.random()*.3;pos[i++]=r*Math.sin(phi)*Math.cos(theta);pos[i++]=r*Math.sin(phi)*Math.sin(theta);pos[i++]=r*Math.cos(phi);}geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const mat=new THREE.PointsMaterial({color:'__PRIMARY__',size:.015,transparent:true,opacity:.8});const sphere=new THREE.Points(geo,mat);scene.add(sphere);window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});(function animate(){requestAnimationFrame(animate);sphere.rotation.y+=.003;sphere.rotation.x+=.001;renderer.render(scene,camera);})();}catch(e){}})();`,
  },
  {
    id: "parallax_hero",
    name: "Hero Parallax",
    category: "parallax_effects",
    description: "Sección hero con efecto parallax al hacer scroll — JS scroll + requestAnimationFrame",
    libs: [],
    html: '<div class="fx-parallax-hero"><div class="fx-ph-bg"></div><div class="fx-ph-content"><h1>__HEADLINE__</h1><p>__TAGLINE__</p><a class="fx-ph-btn">__CTA__</a></div></div>',
    css: ".fx-parallax-hero{position:relative;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center;}\n.fx-ph-bg{position:absolute;inset:-20%;background:linear-gradient(135deg,__BG__,__PRIMARY__22);will-change:transform;}\n.fx-ph-content{position:relative;text-align:center;padding:40px;}\n.fx-ph-content h1{font-family:__FONT__,sans-serif;font-size:clamp(2rem,6vw,5rem);color:__TEXT__;margin-bottom:1rem;}\n.fx-ph-content p{color:rgba(255,255,255,.65);font-size:1.1rem;margin-bottom:2rem;}\n.fx-ph-btn{padding:14px 36px;background:__PRIMARY__;color:#fff;border-radius:100px;text-decoration:none;font-weight:600;}",
    js: `var bg=document.querySelector('.fx-ph-bg');if(bg)window.addEventListener('scroll',function(){bg.style.transform='translateY('+window.scrollY*.4+'px)';},{passive:true});`,
  },
  {
    id: "overlay_hover_reveal",
    name: "Reveal Overlay Hover",
    category: "transition_effects",
    description: "Imagen con overlay que revela contenido al hacer hover — CSS clip-path puro",
    libs: [],
    html: '<div class="fx-overlay-card"><img src="https://picsum.photos/seed/__SECTOR__/600/400" alt=""><div class="fx-ov-content"><h3>__NAME__</h3><p>__TAGLINE__</p><button>__CTA__</button></div></div>',
    css: ".fx-overlay-card{position:relative;overflow:hidden;border-radius:16px;cursor:pointer;width:600px;}\n.fx-overlay-card img{width:100%;height:400px;object-fit:cover;display:block;transition:transform .5s ease;}\n.fx-overlay-card:hover img{transform:scale(1.05);}\n.fx-ov-content{position:absolute;inset:0;background:linear-gradient(to top,__PRIMARY__cc,transparent 50%);clip-path:inset(100% 0 0 0);transition:clip-path .45s cubic-bezier(.215,.61,.355,1);display:flex;flex-direction:column;justify-content:flex-end;padding:32px;color:#fff;}\n.fx-overlay-card:hover .fx-ov-content{clip-path:inset(0% 0 0 0);}\n.fx-ov-content h3{font-size:1.5rem;font-family:__FONT__,sans-serif;margin-bottom:8px;}\n.fx-ov-content p{opacity:.8;font-size:.9rem;margin-bottom:16px;}\n.fx-ov-content button{align-self:flex-start;padding:10px 24px;background:#fff;color:__PRIMARY__;border:none;border-radius:100px;font-weight:600;cursor:pointer;}",
    js: "",
  },
  {
    id: "color_shift_bg",
    name: "Color Shift Background",
    category: "background_effects",
    description: "Fondo que cambia suavemente entre los colores de marca — CSS animation puro",
    libs: [],
    html: '<div class="fx-color-shift-bg"></div>',
    css: `.fx-color-shift-bg{position:fixed;inset:0;z-index:-1;animation:color-shift 16s ease-in-out infinite;}
@keyframes color-shift{0%{background:__BG__;}25%{background:color-mix(in srgb,__PRIMARY__ 18%,__BG__ 82%);}50%{background:color-mix(in srgb,__SECONDARY__ 15%,__BG__ 85%);}75%{background:color-mix(in srgb,__PRIMARY__ 12%,__BG__ 88%);}100%{background:__BG__;}}`,
    js: "",
  },

  // ── BATCH 1: Tipografía avanzada ─────────────────────────────────────────
  {
    id: "gradient_text",
    name: "Texto Gradiente Animado",
    category: "text_effects",
    description: "Texto con gradiente de colores de marca en movimiento — CSS puro",
    libs: [],
    html: '<h1 class="fx-grad-text">__HEADLINE__</h1>',
    css: `.fx-grad-text{font-family:__FONT__,sans-serif;font-size:clamp(2rem,5vw,4rem);font-weight:900;background:linear-gradient(90deg,__PRIMARY__,__SECONDARY__,__PRIMARY__);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:grad-flow 4s linear infinite;}
@keyframes grad-flow{from{background-position:0% center}to{background-position:200% center}}`,
    js: "",
  },
  {
    id: "glitch_text",
    name: "Efecto Glitch Cyberpunk",
    category: "text_effects",
    description: "Texto con distorsión glitch estilo cyberpunk — CSS animations avanzadas",
    libs: [],
    html: '<h1 class="fx-glitch" data-text="__HEADLINE__">__HEADLINE__</h1>',
    css: `.fx-glitch{font-family:__FONT__,sans-serif;font-size:clamp(2rem,5vw,4rem);font-weight:900;color:__TEXT__;position:relative;}
.fx-glitch::before,.fx-glitch::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;height:100%;}
.fx-glitch::before{color:__PRIMARY__;animation:glitch-a 2.5s infinite;clip-path:polygon(0 0,100% 0,100% 35%,0 35%);}
.fx-glitch::after{color:__SECONDARY__;animation:glitch-b 2.5s infinite;clip-path:polygon(0 65%,100% 65%,100% 100%,0 100%);}
@keyframes glitch-a{0%,90%,100%{transform:translate(0)}92%{transform:translate(-3px,1px)}94%{transform:translate(3px,-1px)}96%{transform:translate(-2px,2px)}}
@keyframes glitch-b{0%,90%,100%{transform:translate(0)}92%{transform:translate(3px,-1px)}94%{transform:translate(-3px,1px)}96%{transform:translate(2px,-2px)}}`,
    js: "",
  },
  {
    id: "word_by_word_reveal",
    name: "Reveal Palabra por Palabra",
    category: "text_effects",
    description: "Párrafo que se revela palabra a palabra con highlight al entrar en viewport",
    libs: [],
    html: '<p class="fx-word-reveal">__HEADLINE__ — __TAGLINE__</p>',
    css: `.fx-word-reveal .w{display:inline-block;opacity:0.15;transition:opacity .4s ease,color .4s ease;}
.fx-word-reveal .w.lit{opacity:1;color:__TEXT__;}`,
    js: `document.querySelectorAll('.fx-word-reveal').forEach(function(el){var words=el.textContent.split(' ');el.innerHTML=words.map(function(w){return '<span class="w">'+w+'</span>';}).join(' ');var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.querySelectorAll('.w').forEach(function(w,i){setTimeout(function(){w.classList.add('lit');},i*80);});}});},{threshold:0.3});io.observe(el);});`,
  },
  {
    id: "highlight_scan",
    name: "Scan de Texto Highlight",
    category: "text_effects",
    description: "Línea de escaneo que ilumina texto al pasar — CSS animation lineal",
    libs: [],
    html: '<div class="fx-scan-wrap"><h2 class="fx-scan-text">__HEADLINE__</h2></div>',
    css: `.fx-scan-wrap{position:relative;overflow:hidden;display:inline-block;}
.fx-scan-text{font-family:__FONT__,sans-serif;font-size:2.5rem;font-weight:700;color:rgba(255,255,255,.25);position:relative;}
.fx-scan-wrap::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,__PRIMARY__60,transparent);animation:scan-move 3s ease-in-out infinite;pointer-events:none;}
@keyframes scan-move{0%{left:-60%;}100%{left:150%;}}`,
    js: "",
  },
  {
    id: "text_stroke_fill",
    name: "Relleno de Texto Progresivo",
    category: "text_effects",
    description: "Texto vacío (solo stroke) que se rellena al hacer hover — CSS clip-path",
    libs: [],
    html: '<h2 class="fx-stroke-fill">__HEADLINE__</h2>',
    css: `.fx-stroke-fill{font-family:__FONT__,sans-serif;font-size:clamp(2rem,5vw,4rem);font-weight:900;-webkit-text-stroke:2px __PRIMARY__;color:transparent;cursor:default;position:relative;display:inline-block;}
.fx-stroke-fill::after{content:attr(data-text);position:absolute;inset:0;-webkit-text-stroke:0;color:__PRIMARY__;clip-path:inset(0 100% 0 0);transition:clip-path .6s cubic-bezier(.215,.61,.355,1);}
.fx-stroke-fill:hover::after{clip-path:inset(0 0% 0 0);}`,
    js: `document.querySelectorAll('.fx-stroke-fill').forEach(function(el){el.setAttribute('data-text',el.textContent);});`,
  },
  {
    id: "typewriter_multiline",
    name: "Máquina de Escribir Multi-frase",
    category: "typography_effects",
    description: "Cicla entre múltiples frases con efecto typewriter y borrado — JS puro",
    libs: [],
    html: '<p class="fx-typer">Somos <span class="fx-typer-target" data-phrases="__HEADLINE__|__TAGLINE__|__CTA__"></span></p>',
    css: `.fx-typer{font-family:__FONT__,sans-serif;font-size:1.5rem;color:__TEXT__;}
.fx-typer-target{color:__PRIMARY__;font-weight:700;border-right:2px solid __PRIMARY__;padding-right:2px;animation:blink-cur .7s step-end infinite;}
@keyframes blink-cur{50%{border-color:transparent;}}`,
    js: `(function(){var el=document.querySelector('.fx-typer-target');if(!el)return;var phrases=(el.dataset.phrases||'').split('|');var pi=0,ci=0,deleting=false;function tick(){var phrase=phrases[pi];if(deleting){el.textContent=phrase.substring(0,ci--);if(ci<0){deleting=false;pi=(pi+1)%phrases.length;ci=0;setTimeout(tick,600);return;}}else{el.textContent=phrase.substring(0,ci++);if(ci>phrase.length){deleting=true;setTimeout(tick,1800);return;}}setTimeout(tick,deleting?60:90);}tick();})();`,
  },
  {
    id: "counter_up_premium",
    name: "Contador Premium con Unidad",
    category: "charts",
    description: "Contador animado con prefijo/sufijo, easing suave, y entrada viewport",
    libs: [],
    html: '<div class="fx-kpi-grid"><div class="fx-kpi"><span class="fx-kpi-n" data-end="98" data-suffix="%">0%</span><p>Satisfacción</p></div><div class="fx-kpi"><span class="fx-kpi-n" data-end="2400" data-suffix="+">0+</span><p>Clientes</p></div><div class="fx-kpi"><span class="fx-kpi-n" data-end="4.9" data-suffix="★" data-step="0.1">0★</span><p>Rating</p></div></div>',
    css: `.fx-kpi-grid{display:flex;gap:48px;flex-wrap:wrap;}
.fx-kpi{text-align:center;}
.fx-kpi-n{font-family:__FONT__,sans-serif;font-size:3.5rem;font-weight:900;color:__PRIMARY__;display:block;}
.fx-kpi p{color:rgba(255,255,255,.5);font-size:.85rem;letter-spacing:.1em;text-transform:uppercase;margin-top:4px;}`,
    js: `var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var el=e.target;var end=parseFloat(el.dataset.end);var suf=el.dataset.suffix||'';var step=parseFloat(el.dataset.step||'1');var cur=0;var dur=1600;var start=null;function frame(ts){if(!start)start=ts;var pct=Math.min((ts-start)/dur,1);var ease=1-Math.pow(1-pct,3);cur=end*ease;el.textContent=(step<1?cur.toFixed(1):Math.floor(cur))+suf;if(pct<1)requestAnimationFrame(frame);}requestAnimationFrame(frame);io.unobserve(el);}});},{threshold:.5});document.querySelectorAll('.fx-kpi-n').forEach(function(el){io.observe(el);});`,
  },
  {
    id: "kinetic_headline",
    name: "Headline Cinético",
    category: "typography_effects",
    description: "Headline con letras que entran desde ángulos distintos — JS + CSS",
    libs: [],
    html: '<h1 class="fx-kinetic">__HEADLINE__</h1>',
    css: `.fx-kinetic{font-family:__FONT__,sans-serif;font-size:clamp(2rem,6vw,5rem);font-weight:900;line-height:1.1;}
.fx-kinetic .k{display:inline-block;opacity:0;transition:opacity .5s ease,transform .5s cubic-bezier(.175,.885,.32,1.275);}
.fx-kinetic.go .k{opacity:1;transform:none!important;}`,
    js: `document.querySelectorAll('.fx-kinetic').forEach(function(el){var text=el.textContent;var dirs=[[-80,0],[80,0],[0,-80],[0,80],[-60,-60],[60,60]];el.innerHTML=text.split('').map(function(c,i){if(c===' ')return ' ';var d=dirs[i%dirs.length];return '<span class="k" style="transform:translate('+d[0]+'px,'+d[1]+'px) rotate('+(Math.random()*20-10)+'deg)">'+c+'</span>';}).join('');var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('go');io.unobserve(e.target);}});},{threshold:.3});io.observe(el);});`,
  },

  // ── BATCH 2: Fondos avanzados ────────────────────────────────────────────
  {
    id: "dots_bg",
    name: "Fondo de Puntos Perspectiva",
    category: "background_effects",
    description: "Grid de puntos con perspectiva 3D animada — CSS puro",
    libs: [],
    html: '<div class="fx-dots-bg"></div>',
    css: `.fx-dots-bg{position:fixed;inset:0;z-index:-1;background-color:__BG__;background-image:radial-gradient(circle,__PRIMARY__40 1px,transparent 1px);background-size:32px 32px;transform-style:preserve-3d;animation:dots-pan 20s linear infinite;}
@keyframes dots-pan{from{background-position:0 0}to{background-position:32px 32px}}`,
    js: "",
  },
  {
    id: "grid_lines_bg",
    name: "Fondo Grid Terminal",
    category: "background_effects",
    description: "Fondo con líneas de cuadrícula estilo terminal — CSS puro",
    libs: [],
    html: '<div class="fx-grid-bg"></div>',
    css: `.fx-grid-bg{position:fixed;inset:0;z-index:-1;background:linear-gradient(__PRIMARY__15 1px,transparent 1px) 0 0 / 48px 48px,linear-gradient(90deg,__PRIMARY__15 1px,transparent 1px) 0 0 / 48px 48px,__BG__;}`,
    js: "",
  },
  {
    id: "starfield_canvas",
    name: "Campo de Estrellas 3D",
    category: "background_effects",
    description: "Vuelo a través de estrellas en Canvas 2D — JS puro hipnótico",
    libs: [],
    html: '<canvas id="fx-stars" style="position:fixed;inset:0;width:100%;height:100%;z-index:-1;"></canvas>',
    css: "",
    js: `(function(){var c=document.getElementById('fx-stars');if(!c)return;var ctx=c.getContext('2d');var W,H,cx,cy,stars=[];function init(){W=c.width=window.innerWidth;H=c.height=window.innerHeight;cx=W/2;cy=H/2;stars=Array.from({length:180},function(){return{x:(Math.random()-0.5)*W,y:(Math.random()-0.5)*H,z:Math.random()*W,pz:0};});}init();window.addEventListener('resize',init);(function tick(){ctx.fillStyle='__BG__CC';ctx.fillRect(0,0,W,H);stars.forEach(function(s){s.pz=s.z;s.z-=3;if(s.z<=0){s.x=(Math.random()-0.5)*W;s.y=(Math.random()-0.5)*H;s.z=W;s.pz=s.z;}var sx=cx+(s.x/s.z)*W;var sy=cy+(s.y/s.z)*H;var px=cx+(s.x/s.pz)*W;var py=cy+(s.y/s.pz)*H;var r=(1-s.z/W)*2.5;ctx.beginPath();ctx.strokeStyle='__PRIMARY__';ctx.lineWidth=r;ctx.globalAlpha=1-s.z/W;ctx.moveTo(px,py);ctx.lineTo(sx,sy);ctx.stroke();});ctx.globalAlpha=1;requestAnimationFrame(tick);})();})();`,
  },
  {
    id: "matrix_rain",
    name: "Lluvia Matrix",
    category: "background_effects",
    description: "Cascada de caracteres estilo Matrix — Canvas 2D, JS puro",
    libs: [],
    html: '<canvas id="fx-matrix" style="position:fixed;inset:0;width:100%;height:100%;z-index:-1;opacity:.35;"></canvas>',
    css: "",
    js: `(function(){var c=document.getElementById('fx-matrix');if(!c)return;var ctx=c.getContext('2d');c.width=window.innerWidth;c.height=window.innerHeight;var chars='アイウエオカキクケコ01アBCDEF'.split('');var cols=Math.floor(c.width/14);var drops=Array(cols).fill(1);(function tick(){ctx.fillStyle='rgba(0,0,0,.05)';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='__PRIMARY__';ctx.font='13px monospace';drops.forEach(function(y,i){var char=chars[Math.floor(Math.random()*chars.length)];ctx.fillText(char,i*14,y*14);if(y*14>c.height&&Math.random()>.975)drops[i]=0;drops[i]++;});requestAnimationFrame(tick);})();})();`,
  },
  {
    id: "abstract_waves_svg",
    name: "Ondas Abstractas Animadas",
    category: "background_effects",
    description: "Dos capas de ondas SVG con velocidades distintas — CSS animation + SVG",
    libs: [],
    html: '<div class="fx-waves"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" class="fx-wave-1" preserveAspectRatio="none"><path fill="__PRIMARY__" fill-opacity="0.15" d="M0,160L48,144C96,128,192,96,288,101.3C384,107,480,149,576,165.3C672,181,768,171,864,149.3C960,128,1056,96,1152,96C1248,96,1344,128,1392,144L1440,160L1440,320L0,320Z"></path></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" class="fx-wave-2" preserveAspectRatio="none"><path fill="__SECONDARY__" fill-opacity="0.10" d="M0,256L60,245.3C120,235,240,213,360,192C480,171,600,149,720,154.7C840,160,960,192,1080,186.7C1200,181,1320,139,1380,117.3L1440,96L1440,320L0,320Z"></path></svg></div>',
    css: `.fx-waves{position:fixed;bottom:0;left:0;right:0;z-index:-1;height:320px;}
.fx-wave-1{position:absolute;bottom:0;left:0;width:200%;animation:wave-drift 12s linear infinite;}
.fx-wave-2{position:absolute;bottom:0;left:0;width:200%;animation:wave-drift 18s linear infinite reverse;}
@keyframes wave-drift{from{transform:translateX(0)}to{transform:translateX(-50%)}}`,
    js: "",
  },
  {
    id: "bokeh_bg",
    name: "Fondo Bokeh Flotante",
    category: "background_effects",
    description: "Círculos borrosos flotando como bokeh fotográfico — CSS animations",
    libs: [],
    html: '<div class="fx-bokeh" id="fx-bokeh-wrap"></div>',
    css: `.fx-bokeh{position:fixed;inset:0;z-index:-1;overflow:hidden;}
.fx-bk{position:absolute;border-radius:50%;filter:blur(40px);opacity:.12;animation:bk-float linear infinite;}
@keyframes bk-float{0%{transform:translateY(110vh) scale(.8);}100%{transform:translateY(-20vh) scale(1.2);}}`,
    js: `var wrap=document.getElementById('fx-bokeh-wrap');if(wrap){var colors=['__PRIMARY__','__SECONDARY__','#8b5cf6','#06b6d4'];for(var i=0;i<12;i++){var el=document.createElement('div');el.className='fx-bk';var size=80+Math.random()*200;el.style.cssText='width:'+size+'px;height:'+size+'px;left:'+(Math.random()*100)+'%;background:'+colors[Math.floor(Math.random()*colors.length)]+';animation-duration:'+(8+Math.random()*12)+'s;animation-delay:-('+Math.random()*15+')s;';wrap.appendChild(el);}}`,
  },
  {
    id: "noise_texture_bg",
    name: "Fondo Textura Ruido Animado",
    category: "background_effects",
    description: "Textura de grano animado sobre fondo de marca — CSS + SVG filter",
    libs: [],
    html: '<div class="fx-noise-bg"></div>',
    css: `.fx-noise-bg{position:fixed;inset:0;z-index:-1;background:__BG__;}
.fx-noise-bg::after{content:'';position:absolute;inset:0;opacity:.04;animation:noise-shift .12s steps(1) infinite;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
@keyframes noise-shift{0%{transform:translate(0,0);}20%{transform:translate(-3%,-3%);}40%{transform:translate(3%,3%);}60%{transform:translate(-3%,3%);}80%{transform:translate(3%,-3%);}100%{transform:translate(0,0);}}`,
    js: "",
  },
  {
    id: "conic_gradient_bg",
    name: "Gradiente Cónico Giratorio",
    category: "background_effects",
    description: "Gradiente cónico de 360° girando lentamente — CSS animation puro",
    libs: [],
    html: '<div class="fx-conic-bg"></div>',
    css: `.fx-conic-bg{position:fixed;inset:0;z-index:-1;animation:conic-spin 20s linear infinite;background:conic-gradient(from 0deg,__BG__ 0deg,__PRIMARY__30 90deg,__BG__ 180deg,__SECONDARY__20 270deg,__BG__ 360deg);}
@keyframes conic-spin{from{--start:0deg}to{--start:360deg}}`,
    js: "",
  },

  // ── BATCH 3: Efectos 3D ──────────────────────────────────────────────────
  {
    id: "rotating_cube_css",
    name: "Cubo 3D CSS Puro",
    category: "3d_effects",
    description: "Cubo rotante con logo de marca en cada cara — CSS 3D puro",
    libs: [],
    html: '<div class="fx-cube-scene"><div class="fx-cube"><div class="fx-face fx-front"><span>__ICON__</span></div><div class="fx-face fx-back"><span>__NAME__</span></div><div class="fx-face fx-right"><span>__SECTOR__</span></div><div class="fx-face fx-left"><span>__CTA__</span></div><div class="fx-face fx-top"><span>__TAGLINE__</span></div><div class="fx-face fx-bottom"><span>✦</span></div></div></div>',
    css: `.fx-cube-scene{perspective:600px;width:160px;height:160px;}
.fx-cube{width:160px;height:160px;position:relative;transform-style:preserve-3d;animation:cube-spin 10s linear infinite;}
.fx-face{position:absolute;width:160px;height:160px;display:flex;align-items:center;justify-content:center;font-family:__FONT__,sans-serif;font-size:.9rem;font-weight:600;color:__TEXT__;background:__SURFACE__;border:1px solid __PRIMARY__40;backface-visibility:hidden;}
.fx-front{transform:translateZ(80px);}
.fx-back{transform:rotateY(180deg) translateZ(80px);}
.fx-right{transform:rotateY(90deg) translateZ(80px);}
.fx-left{transform:rotateY(-90deg) translateZ(80px);}
.fx-top{transform:rotateX(90deg) translateZ(80px);}
.fx-bottom{transform:rotateX(-90deg) translateZ(80px);}
@keyframes cube-spin{from{transform:rotateX(0) rotateY(0)}to{transform:rotateX(360deg) rotateY(360deg)}}`,
    js: "",
  },
  {
    id: "holographic_card",
    name: "Tarjeta Holográfica",
    category: "3d_effects",
    description: "Tarjeta con efecto holográfico reactivo al cursor — JS mousemove + CSS",
    libs: [],
    html: '<div class="fx-holo-card"><div class="fx-holo-inner"><h3>__NAME__</h3><p>__TAGLINE__</p><span class="fx-holo-badge">__SECTOR__</span></div></div>',
    css: `.fx-holo-card{width:320px;height:200px;perspective:1000px;cursor:pointer;}
.fx-holo-inner{width:100%;height:100%;border-radius:20px;padding:32px;background:linear-gradient(135deg,__SURFACE__,__BG__);border:1px solid rgba(255,255,255,.12);position:relative;overflow:hidden;transition:transform .1s linear;transform-style:preserve-3d;}
.fx-holo-inner::before{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg,#ff000040,#ff7f0040,#ffff0040,#00ff0040,#00ffff40,#0000ff40,#8b00ff40,#ff000040);opacity:0;transition:opacity .3s;border-radius:20px;}
.fx-holo-card:hover .fx-holo-inner::before{opacity:.25;}
.fx-holo-inner h3{font-family:__FONT__,sans-serif;color:__TEXT__;font-size:1.3rem;margin-bottom:8px;position:relative;}
.fx-holo-inner p{color:rgba(255,255,255,.5);font-size:.85rem;position:relative;}
.fx-holo-badge{position:absolute;bottom:16px;right:16px;padding:4px 12px;background:__PRIMARY__20;border:1px solid __PRIMARY__60;border-radius:100px;font-size:.7rem;color:__PRIMARY__;font-family:__FONT__,sans-serif;}`,
    js: `document.querySelectorAll('.fx-holo-card').forEach(function(card){var inner=card.querySelector('.fx-holo-inner');card.addEventListener('mousemove',function(e){var r=card.getBoundingClientRect();var x=(e.clientX-r.left-r.width/2)/(r.width/2);var y=(e.clientY-r.top-r.height/2)/(r.height/2);inner.style.transform='rotateY('+(x*20)+'deg) rotateX('+(-y*20)+'deg)';});card.addEventListener('mouseleave',function(){inner.style.transform='rotateY(0) rotateX(0)';});});`,
  },
  {
    id: "depth_parallax_layers",
    name: "Capas de Profundidad Parallax",
    category: "parallax_effects",
    description: "Múltiples capas con velocidades de parallax distintas — mousemove JS",
    libs: [],
    html: '<div class="fx-depth" id="fx-depth-scene"><div class="fx-dl fx-dl-1">◉</div><div class="fx-dl fx-dl-2">__ICON__</div><div class="fx-dl fx-dl-3"><h1>__HEADLINE__</h1><p>__TAGLINE__</p></div></div>',
    css: `.fx-depth{position:relative;width:100%;height:400px;overflow:hidden;display:flex;align-items:center;justify-content:center;}
.fx-dl{position:absolute;will-change:transform;transition:transform .05s linear;}
.fx-dl-1{font-size:6rem;opacity:.05;color:__PRIMARY__;}
.fx-dl-2{font-size:4rem;opacity:.15;}
.fx-dl-3{text-align:center;}
.fx-dl-3 h1{font-family:__FONT__,sans-serif;font-size:3rem;font-weight:900;color:__TEXT__;}
.fx-dl-3 p{color:rgba(255,255,255,.5);margin-top:8px;}`,
    js: `var scene=document.getElementById('fx-depth-scene');if(scene){var layers=scene.querySelectorAll('.fx-dl');var depths=[0.06,0.03,0.01];scene.addEventListener('mousemove',function(e){var r=scene.getBoundingClientRect();var x=e.clientX-r.left-r.width/2;var y=e.clientY-r.top-r.height/2;layers.forEach(function(l,i){l.style.transform='translate('+(x*depths[i])+'px,'+(y*depths[i])+'px)';});});}`,
  },
  {
    id: "card_stack_3d",
    name: "Stack de Tarjetas 3D",
    category: "3d_effects",
    description: "Mazo de tarjetas apiladas en 3D que se despliegan al hover — CSS 3D",
    libs: [],
    html: '<div class="fx-stack"><div class="fx-sk-card" style="--i:0"><h3>__USP_1__</h3></div><div class="fx-sk-card" style="--i:1"><h3>__USP_2__</h3></div><div class="fx-sk-card" style="--i:2"><h3>__USP_3__</h3></div></div>',
    css: `.fx-stack{perspective:800px;width:280px;height:180px;position:relative;cursor:pointer;}
.fx-sk-card{position:absolute;inset:0;background:__SURFACE__;border:1px solid rgba(255,255,255,calc(.04 + var(--i)*.04));border-radius:16px;padding:28px;display:flex;align-items:center;transform:translateZ(calc(var(--i)*-10px)) translateY(calc(var(--i)*8px));transform-style:preserve-3d;transition:transform .4s cubic-bezier(.215,.61,.355,1);}
.fx-sk-card h3{font-family:__FONT__,sans-serif;color:__TEXT__;font-size:1rem;}
.fx-stack:hover .fx-sk-card{transform:translateZ(calc(var(--i)*-10px)) translateY(calc(var(--i)*-60px));}`,
    js: "",
  },
  {
    id: "globe_dot_ring",
    name: "Anillo de Globo Giratorio",
    category: "3d_effects",
    description: "Anillo de puntos que simula un globo en CSS 3D — CSS animation",
    libs: [],
    html: '<div class="fx-globe"><div class="fx-globe-ring" style="--a:0deg"></div><div class="fx-globe-ring" style="--a:60deg"></div><div class="fx-globe-ring" style="--a:120deg"></div><div class="fx-globe-core">__ICON__</div></div>',
    css: `.fx-globe{position:relative;width:200px;height:200px;margin:0 auto;animation:globe-rot 8s linear infinite;}
.fx-globe-ring{position:absolute;inset:0;border-radius:50%;border:1px dashed __PRIMARY__50;transform:rotateX(75deg) rotateZ(var(--a));}
.fx-globe-core{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:3rem;}
@keyframes globe-rot{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}`,
    js: "",
  },
  {
    id: "magnetic_button_premium",
    name: "Botón Magnético Premium",
    category: "micro_interactions",
    description: "Botón con campo magnético extendido y partícula de luz — JS + CSS",
    libs: [],
    html: '<div class="fx-mag-wrap"><button class="fx-mag-btn"><span class="fx-mag-text">__CTA__</span><span class="fx-mag-light"></span></button></div>',
    css: `.fx-mag-wrap{display:inline-flex;padding:60px;align-items:center;justify-content:center;}
.fx-mag-btn{position:relative;padding:16px 40px;background:linear-gradient(135deg,__PRIMARY__,__SECONDARY__);border:none;border-radius:100px;color:#fff;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:700;cursor:pointer;overflow:hidden;transition:transform .2s ease,box-shadow .2s ease;}
.fx-mag-btn:hover{box-shadow:0 12px 40px __PRIMARY__50;}
.fx-mag-light{position:absolute;width:80px;height:80px;background:rgba(255,255,255,.25);border-radius:50%;filter:blur(20px);pointer-events:none;transform:translate(-50%,-50%);opacity:0;transition:opacity .3s;}
.fx-mag-btn:hover .fx-mag-light{opacity:1;}`,
    js: `document.querySelectorAll('.fx-mag-btn').forEach(function(btn){var light=btn.querySelector('.fx-mag-light');btn.addEventListener('mousemove',function(e){var r=btn.getBoundingClientRect();var x=e.clientX-r.left;var y=e.clientY-r.top;if(light){light.style.left=x+'px';light.style.top=y+'px';}var dx=(e.clientX-r.left-r.width/2)*.3;var dy=(e.clientY-r.top-r.height/2)*.3;btn.style.transform='translate('+dx+'px,'+dy+'px)';});btn.addEventListener('mouseleave',function(){btn.style.transform='';});});`,
  },

  // ── BATCH 4: E-commerce & Conversión ────────────────────────────────────
  {
    id: "add_to_cart_burst",
    name: "Agregar al Carrito (Burst)",
    category: "micro_interactions",
    description: "Animación de partículas al agregar producto al carrito — Canvas + JS",
    libs: [],
    html: '<div style="text-align:center"><button class="fx-cart-btn" onclick="fxCartBurst(this)">🛒 __CTA__</button></div><canvas id="fx-cart-cv" style="position:fixed;inset:0;pointer-events:none;z-index:9999;"></canvas>',
    css: `.fx-cart-btn{padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:12px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:700;cursor:pointer;transition:transform .15s,box-shadow .15s;}
.fx-cart-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px __PRIMARY__50;}
.fx-cart-btn:active{transform:scale(.96);}`,
    js: `window.fxCartBurst=function(btn){var r=btn.getBoundingClientRect();var cv=document.getElementById('fx-cart-cv');var ctx=cv.getContext('2d');cv.width=window.innerWidth;cv.height=window.innerHeight;var ox=r.left+r.width/2;var oy=r.top+r.height/2;var items=Array.from({length:30},function(){return{x:ox,y:oy,vx:(Math.random()-0.5)*12,vy:-Math.random()*14-4,size:6+Math.random()*6,color:['__PRIMARY__','__SECONDARY__','#f59e0b','#10b981'][Math.floor(Math.random()*4)],alpha:1,g:.5};});(function tick(){ctx.clearRect(0,0,cv.width,cv.height);items.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.alpha-=.015;if(p.alpha>0){ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}});ctx.globalAlpha=1;if(items.some(function(p){return p.alpha>0;}))requestAnimationFrame(tick);else ctx.clearRect(0,0,cv.width,cv.height);})();};`,
  },
  {
    id: "countdown_urgency",
    name: "Contador Urgencia (HH:MM:SS)",
    category: "micro_interactions",
    description: "Reloj de cuenta regresiva de oferta con pulso — CSS + JS",
    libs: [],
    html: '<div class="fx-urgency"><span class="fx-urg-label">⚡ Oferta termina en:</span><div class="fx-urg-clock"><span class="fx-urg-seg" id="fx-urg-h">00</span><span class="fx-urg-sep">:</span><span class="fx-urg-seg" id="fx-urg-m">00</span><span class="fx-urg-sep">:</span><span class="fx-urg-seg" id="fx-urg-s">00</span></div></div>',
    css: `.fx-urgency{display:inline-flex;align-items:center;gap:16px;padding:14px 24px;background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);border-radius:12px;}
.fx-urg-label{font-family:__FONT__,sans-serif;color:rgba(255,100,100,.9);font-size:.85rem;font-weight:600;}
.fx-urg-clock{display:flex;align-items:center;gap:4px;}
.fx-urg-seg{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(239,68,68,.12);border-radius:8px;font-family:var(--fh,monospace);font-size:1.3rem;font-weight:700;color:#f87171;animation:urg-pulse 1s ease-in-out infinite;}
.fx-urg-sep{color:#f87171;font-size:1.3rem;font-weight:700;margin-top:-4px;}
@keyframes urg-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.3);}50%{box-shadow:0 0 0 6px rgba(239,68,68,0);}}`,
    js: `(function(){var end=new Date(Date.now()+3*3600000+25*60000+10000);function update(){var diff=Math.max(0,Math.floor((end-Date.now())/1000));var h=document.getElementById('fx-urg-h');var m=document.getElementById('fx-urg-m');var s=document.getElementById('fx-urg-s');if(h)h.textContent=String(Math.floor(diff/3600)).padStart(2,'0');if(m)m.textContent=String(Math.floor((diff%3600)/60)).padStart(2,'0');if(s)s.textContent=String(diff%60).padStart(2,'0');}update();setInterval(update,1000);})();`,
  },
  {
    id: "stock_urgency_bar",
    name: "Barra de Stock Restante",
    category: "micro_interactions",
    description: "Barra de stock bajo con animación de alerta — CSS + JS",
    libs: [],
    html: '<div class="fx-stock"><div class="fx-stock-info"><span>Stock disponible</span><strong class="fx-stock-num">¡Solo 7 unidades!</strong></div><div class="fx-stock-bar"><div class="fx-stock-fill" style="--pct:15%"></div></div></div>',
    css: `.fx-stock{padding:16px;background:rgba(245,158,11,.04);border:1px solid rgba(245,158,11,.2);border-radius:12px;}
.fx-stock-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-family:__FONT__,sans-serif;font-size:.85rem;color:rgba(255,255,255,.5);}
.fx-stock-num{color:#fbbf24;font-weight:700;}
.fx-stock-bar{height:8px;background:rgba(255,255,255,.08);border-radius:100px;overflow:hidden;}
.fx-stock-fill{height:100%;width:var(--pct);background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:100px;animation:stock-pulse 2s ease-in-out infinite;}
@keyframes stock-pulse{0%,100%{opacity:1;}50%{opacity:.7;}}`,
    js: "",
  },
  {
    id: "product_image_zoom",
    name: "Zoom de Producto (Lupa)",
    category: "micro_interactions",
    description: "Lupa que amplía la imagen de producto al hover — JS puro, sin deps",
    libs: [],
    html: '<div class="fx-zoom-wrap"><img class="fx-zoom-img" src="https://picsum.photos/seed/__SECTOR__/480/480" alt="__NAME__"><div class="fx-zoom-lens"></div></div>',
    css: `.fx-zoom-wrap{position:relative;width:480px;height:480px;overflow:hidden;border-radius:16px;cursor:crosshair;}
.fx-zoom-img{width:100%;height:100%;object-fit:cover;display:block;}
.fx-zoom-lens{position:absolute;width:180px;height:180px;border:2px solid __PRIMARY__;border-radius:50%;pointer-events:none;display:none;background:no-repeat;background-size:960px 960px;box-shadow:0 0 0 4000px rgba(0,0,0,.4);}`,
    js: `var wrap=document.querySelector('.fx-zoom-wrap');var lens=document.querySelector('.fx-zoom-lens');var img=document.querySelector('.fx-zoom-img');if(wrap&&lens&&img){img.onload=function(){lens.style.backgroundImage='url('+img.src+')';};if(img.complete)lens.style.backgroundImage='url('+img.src+')';wrap.addEventListener('mousemove',function(e){var r=wrap.getBoundingClientRect();var x=e.clientX-r.left;var y=e.clientY-r.top;var lx=Math.max(90,Math.min(x,r.width-90));var ly=Math.max(90,Math.min(y,r.height-90));lens.style.display='block';lens.style.left=(lx-90)+'px';lens.style.top=(ly-90)+'px';var bx=(lx/r.width)*-480;var by=(ly/r.height)*-480;lens.style.backgroundPosition=bx+'px '+by+'px';});wrap.addEventListener('mouseleave',function(){lens.style.display='none';});}`,
  },
  {
    id: "trust_badge_strip",
    name: "Banda de Trust Badges",
    category: "micro_interactions",
    description: "Fila de badges de confianza con hover tooltip — CSS + JS",
    libs: [],
    html: '<div class="fx-trust"><div class="fx-tb" data-tip="Pagos cifrados SSL"><span>🔒</span> Pago Seguro</div><div class="fx-tb" data-tip="Envío en 24-48h"><span>🚀</span> Envío Rápido</div><div class="fx-tb" data-tip="30 días para devolver"><span>↩️</span> Devolución Gratis</div><div class="fx-tb" data-tip="Atención 24/7 por chat"><span>💬</span> Soporte 24h</div></div>',
    css: `.fx-trust{display:flex;flex-wrap:wrap;gap:12px;}
.fx-tb{position:relative;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:100px;font-family:__FONT__,sans-serif;font-size:.8rem;color:rgba(255,255,255,.65);cursor:default;transition:border-color .2s,color .2s;}
.fx-tb:hover{border-color:__PRIMARY__60;color:__TEXT__;}
.fx-tb::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;font-size:.7rem;padding:6px 12px;border-radius:8px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .2s;border:1px solid rgba(255,255,255,.08);}
.fx-tb:hover::after{opacity:1;}`,
    js: "",
  },
  {
    id: "price_slash_animation",
    name: "Precio Tachado con Animación",
    category: "micro_interactions",
    description: "Precio original tachado con animación y precio oferta — CSS",
    libs: [],
    html: '<div class="fx-price-block"><div class="fx-price-original"><span class="fx-slash">€89.99</span><span class="fx-discount-badge">-40%</span></div><div class="fx-price-final">€<span class="fx-big-price">53</span><span class="fx-cents">.99</span></div><p class="fx-price-note">IVA incluido · Envío gratis</p></div>',
    css: `.fx-price-block{display:inline-flex;flex-direction:column;gap:4px;}
.fx-price-original{display:flex;align-items:center;gap:10px;}
.fx-slash{color:rgba(255,255,255,.35);font-size:1rem;position:relative;font-family:__FONT__,sans-serif;}
.fx-slash::after{content:'';position:absolute;top:50%;left:-2px;right:-2px;height:1.5px;background:#ef4444;animation:slash-in .6s .3s ease forwards;transform:scaleX(0) translateY(-50%);transform-origin:left;}
@keyframes slash-in{to{transform:scaleX(1) translateY(-50%);}}
.fx-discount-badge{padding:2px 8px;background:#ef444420;border:1px solid #ef444450;border-radius:6px;color:#f87171;font-size:.7rem;font-weight:700;}
.fx-price-final{display:flex;align-items:flex-start;gap:2px;color:__PRIMARY__;}
.fx-big-price{font-family:__FONT__,sans-serif;font-size:3.5rem;font-weight:900;line-height:1;}
.fx-cents{font-size:1.2rem;font-weight:600;padding-top:6px;}
.fx-price-note{font-size:.75rem;color:rgba(255,255,255,.35);font-family:__FONT__,sans-serif;}`,
    js: "",
  },

  // ── BATCH 5: Social Proof & Reviews ─────────────────────────────────────
  {
    id: "review_card_animated",
    name: "Tarjeta de Review Animada",
    category: "cards",
    description: "Tarjeta de reseña con estrellas animadas y avatar generativo — CSS + JS",
    libs: [],
    html: '<div class="fx-review"><div class="fx-rv-stars" id="fx-rv-stars"></div><p class="fx-rv-text">"__TAGLINE__. Totalmente recomendado para cualquier negocio en __SECTOR__."</p><div class="fx-rv-author"><div class="fx-rv-avatar" id="fx-rv-av">MG</div><div><strong>María García</strong><span>CEO en __NAME__</span></div></div></div>',
    css: `.fx-review{background:__SURFACE__;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px 32px;max-width:400px;}
.fx-rv-stars{display:flex;gap:4px;margin-bottom:14px;}
.fx-rv-star{font-size:1.1rem;opacity:0;animation:star-pop .3s ease forwards;}
.fx-rv-text{font-family:__FONT__,sans-serif;color:rgba(255,255,255,.7);font-size:.9rem;line-height:1.6;margin-bottom:18px;}
.fx-rv-author{display:flex;align-items:center;gap:12px;}
.fx-rv-avatar{width:40px;height:40px;border-radius:50%;background:__PRIMARY__;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;color:#000;flex-shrink:0;}
.fx-rv-author strong{display:block;font-family:__FONT__,sans-serif;color:__TEXT__;font-size:.875rem;}
.fx-rv-author span{color:rgba(255,255,255,.4);font-size:.75rem;}
@keyframes star-pop{from{opacity:0;transform:scale(.5) rotate(-20deg);}to{opacity:1;transform:scale(1) rotate(0);}}`,
    js: `var wrap=document.getElementById('fx-rv-stars');if(wrap){['⭐','⭐','⭐','⭐','⭐'].forEach(function(s,i){var span=document.createElement('span');span.className='fx-rv-star';span.textContent=s;span.style.animationDelay=(i*.1)+'s';wrap.appendChild(span);});}`,
  },
  {
    id: "live_visitors_counter",
    name: "Contador de Visitantes en Vivo",
    category: "micro_interactions",
    description: "Badge 'X personas viendo ahora' con fluctuación realista — CSS + JS",
    libs: [],
    html: '<div class="fx-live-badge"><span class="fx-live-dot"></span><span class="fx-live-count" id="fx-live-n">27</span> personas viendo ahora</div>',
    css: `.fx-live-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:100px;font-family:__FONT__,sans-serif;font-size:.85rem;color:rgba(255,255,255,.65);}
.fx-live-dot{width:8px;height:8px;background:#10b981;border-radius:50%;animation:live-blink 1.2s ease-in-out infinite;}
.fx-live-count{color:#10b981;font-weight:700;}
@keyframes live-blink{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.8);}}`,
    js: `(function(){var el=document.getElementById('fx-live-n');if(!el)return;var n=24+Math.floor(Math.random()*12);el.textContent=n;setInterval(function(){var delta=Math.random()<.5?1:-1;n=Math.max(18,Math.min(45,n+delta));el.textContent=n;},3500+Math.random()*2000);})();`,
  },
  {
    id: "avatar_group_stack",
    name: "Grupo de Avatares Apilados",
    category: "cards",
    description: "Stack de avatares con contador y tooltip — CSS puro",
    libs: [],
    html: '<div class="fx-av-group"><div class="fx-av" style="--c:#e879f9">A</div><div class="fx-av" style="--c:#60a5fa">B</div><div class="fx-av" style="--c:#34d399">C</div><div class="fx-av" style="--c:#fbbf24">D</div><div class="fx-av fx-av-more">+48</div><span class="fx-av-label">Clientes activos este mes</span></div>',
    css: `.fx-av-group{display:flex;align-items:center;gap:0;}
.fx-av{width:40px;height:40px;border-radius:50%;background:var(--c,__PRIMARY__);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;color:#fff;border:2px solid __BG__;margin-right:-10px;transition:transform .2s;cursor:pointer;}
.fx-av:hover{transform:translateY(-4px);z-index:1;}
.fx-av-more{background:rgba(255,255,255,.08);border:2px dashed rgba(255,255,255,.2);color:rgba(255,255,255,.5);font-size:.7rem;}
.fx-av-label{margin-left:20px;font-family:__FONT__,sans-serif;color:rgba(255,255,255,.45);font-size:.8rem;}`,
    js: "",
  },
  {
    id: "notification_popup",
    name: "Notificación de Venta Reciente",
    category: "micro_interactions",
    description: "Popup de compra reciente que aparece en esquina — JS + CSS, sin deps",
    libs: [],
    html: '<div class="fx-sale-notif" id="fx-sale-popup" style="display:none"><div class="fx-sn-icon">🛒</div><div class="fx-sn-text"><strong>María de Madrid</strong><span>Compró __NAME__ · hace 3 min</span></div></div>',
    css: `.fx-sale-notif{position:fixed;bottom:24px;left:24px;z-index:9999;display:flex!important;align-items:center;gap:14px;padding:14px 20px;background:__SURFACE__;border:1px solid rgba(255,255,255,.1);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.4);transform:translateX(-120%);transition:transform .4s cubic-bezier(.215,.61,.355,1);}
.fx-sale-notif.show{transform:translateX(0);}
.fx-sn-icon{font-size:1.5rem;}
.fx-sn-text{display:flex;flex-direction:column;}
.fx-sn-text strong{font-family:__FONT__,sans-serif;color:__TEXT__;font-size:.85rem;}
.fx-sn-text span{color:rgba(255,255,255,.4);font-size:.75rem;}`,
    js: `(function(){var el=document.getElementById('fx-sale-popup');if(!el)return;function show(){el.style.display='flex';setTimeout(function(){el.classList.add('show');},50);setTimeout(function(){el.classList.remove('show');setTimeout(function(){el.style.display='none';},400);},4000);}setTimeout(show,2000);setInterval(show,12000);})();`,
  },

  // ── BATCH 6: Loading & Transiciones ─────────────────────────────────────
  {
    id: "progress_ring",
    name: "Anillo de Progreso Circular",
    category: "loaders",
    description: "Indicador circular de progreso con animación — SVG + CSS",
    libs: [],
    html: '<div class="fx-ring-wrap"><svg class="fx-ring" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><circle class="fx-ring-bg" cx="60" cy="60" r="50"/><circle class="fx-ring-fill" cx="60" cy="60" r="50" id="fx-ring-c"/></svg><div class="fx-ring-label"><span id="fx-ring-pct">0%</span><small>Completado</small></div></div>',
    css: `.fx-ring-wrap{position:relative;width:120px;height:120px;}
.fx-ring{transform:rotate(-90deg);}
.fx-ring-bg{fill:none;stroke:rgba(255,255,255,.08);stroke-width:10;}
.fx-ring-fill{fill:none;stroke:__PRIMARY__;stroke-width:10;stroke-linecap:round;stroke-dasharray:314;stroke-dashoffset:314;transition:stroke-dashoffset 1.5s cubic-bezier(.215,.61,.355,1);filter:drop-shadow(0 0 6px __PRIMARY__);}
.fx-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.fx-ring-label span{font-family:__FONT__,sans-serif;font-size:1.4rem;font-weight:700;color:__TEXT__;}
.fx-ring-label small{color:rgba(255,255,255,.35);font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;}`,
    js: `(function(){var circle=document.getElementById('fx-ring-c');var label=document.getElementById('fx-ring-pct');if(!circle||!label)return;var target=78;setTimeout(function(){var dashOffset=314-(314*(target/100));circle.style.strokeDashoffset=dashOffset;var i=0;var ival=setInterval(function(){i++;label.textContent=i+'%';if(i>=target)clearInterval(ival);},1500/target);},400);})();`,
  },
  {
    id: "steps_progress_bar",
    name: "Barra de Pasos (Checkout)",
    category: "loaders",
    description: "Progress bar de pasos numerados con estado activo/completado — CSS puro",
    libs: [],
    html: '<div class="fx-steps"><div class="fx-step done"><div class="fx-step-circle">✓</div><span>Carrito</span></div><div class="fx-step active"><div class="fx-step-circle">2</div><span>Dirección</span></div><div class="fx-step"><div class="fx-step-circle">3</div><span>Pago</span></div><div class="fx-step"><div class="fx-step-circle">4</div><span>Listo</span></div></div>',
    css: `.fx-steps{display:flex;align-items:flex-start;gap:0;width:100%;}
.fx-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative;}
.fx-step::before{content:'';position:absolute;top:18px;left:50%;right:-50%;height:2px;background:rgba(255,255,255,.08);z-index:0;}
.fx-step:last-child::before{display:none;}
.fx-step.done::before,.fx-step.active::before{background:__PRIMARY__;}
.fx-step-circle{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;border:2px solid rgba(255,255,255,.12);background:__BG__;color:rgba(255,255,255,.3);z-index:1;transition:all .3s;}
.fx-step.done .fx-step-circle{background:__PRIMARY__;border-color:__PRIMARY__;color:#000;}
.fx-step.active .fx-step-circle{background:transparent;border-color:__PRIMARY__;color:__PRIMARY__;box-shadow:0 0 0 4px __PRIMARY__20;}
.fx-step span{font-family:__FONT__,sans-serif;font-size:.75rem;color:rgba(255,255,255,.3);}
.fx-step.done span,.fx-step.active span{color:__TEXT__;}`,
    js: "",
  },
  {
    id: "loading_shimmer_card",
    name: "Card Shimmer Loading",
    category: "loaders",
    description: "Tarjeta completa de shimmer para simular carga de producto — CSS puro",
    libs: [],
    html: '<div class="fx-shimmer-card"><div class="fx-sh-img"></div><div class="fx-sh-body"><div class="fx-sh-line w-75"></div><div class="fx-sh-line w-50"></div><div class="fx-sh-price"></div><div class="fx-sh-btn"></div></div></div>',
    css: `.fx-shimmer-card{background:__SURFACE__;border:1px solid rgba(255,255,255,.06);border-radius:16px;overflow:hidden;width:260px;}
.fx-sh-img{height:200px;background:__BG__;}
.fx-sh-body{padding:20px;}
.fx-sh-line,.fx-sh-price,.fx-sh-btn,.fx-sh-img{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 75%);background-size:400% 100%;animation:sh-anim 1.4s infinite;}
.fx-sh-line{height:12px;border-radius:6px;margin-bottom:10px;}
.fx-sh-price{height:24px;width:40%;border-radius:6px;margin-bottom:16px;}
.fx-sh-btn{height:40px;border-radius:8px;}
.w-75{width:75%}.w-50{width:50%}
@keyframes sh-anim{0%{background-position:100% 0}100%{background-position:-100% 0}}`,
    js: "",
  },
  {
    id: "page_preloader",
    name: "Preloader de Página Elegante",
    category: "loaders",
    description: "Pantalla de carga con barra de progreso y logo — CSS + JS",
    libs: [],
    html: '<div class="fx-preload" id="fx-preload"><div class="fx-pl-logo">__ICON__</div><div class="fx-pl-bar-wrap"><div class="fx-pl-bar" id="fx-pl-bar"></div></div><p class="fx-pl-text">Cargando __NAME__…</p></div>',
    css: `.fx-preload{position:fixed;inset:0;z-index:99999;background:__BG__;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;transition:opacity .6s ease,visibility .6s ease;}
.fx-preload.done{opacity:0;visibility:hidden;}
.fx-pl-logo{font-size:4rem;animation:pl-bounce .8s ease-in-out infinite alternate;}
@keyframes pl-bounce{from{transform:translateY(0);}to{transform:translateY(-12px);}}
.fx-pl-bar-wrap{width:200px;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;}
.fx-pl-bar{height:100%;width:0%;background:linear-gradient(90deg,__PRIMARY__,__SECONDARY__);transition:width .4s ease;border-radius:2px;}
.fx-pl-text{font-family:__FONT__,sans-serif;font-size:.8rem;color:rgba(255,255,255,.3);letter-spacing:.1em;}`,
    js: `(function(){var bar=document.getElementById('fx-pl-bar');var pl=document.getElementById('fx-preload');if(!bar||!pl)return;var w=0;var ival=setInterval(function(){w+=Math.random()*15+5;if(w>=100){w=100;bar.style.width='100%';clearInterval(ival);setTimeout(function(){pl.classList.add('done');},500);}else{bar.style.width=w+'%';}},200);})();`,
  },

  // ── BATCH 7: Navegación & Layout ────────────────────────────────────────
  {
    id: "back_to_top_progress",
    name: "Volver Arriba con Progreso",
    category: "scroll_indicators",
    description: "Botón volver arriba con anillo de progreso de lectura — JS + CSS",
    libs: [],
    html: '<button class="fx-btt" id="fx-btt" title="Volver arriba"><svg class="fx-btt-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="2"/><circle id="fx-btt-c" cx="18" cy="18" r="15.9" fill="none" stroke="__PRIMARY__" stroke-width="2" stroke-dasharray="100 100" stroke-dashoffset="100" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg><span>↑</span></button>',
    css: `.fx-btt{position:fixed;bottom:28px;right:28px;width:52px;height:52px;border-radius:50%;background:__SURFACE__;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:__TEXT__;font-size:1.2rem;opacity:0;transform:translateY(20px);transition:opacity .3s,transform .3s,box-shadow .2s;z-index:9998;}
.fx-btt.vis{opacity:1;transform:translateY(0);}
.fx-btt:hover{box-shadow:0 4px 20px __PRIMARY__40;}
.fx-btt-ring{position:absolute;inset:0;width:100%;height:100%;}
.fx-btt span{position:relative;}`,
    js: `(function(){var btn=document.getElementById('fx-btt');var circle=document.getElementById('fx-btt-c');if(!btn)return;window.addEventListener('scroll',function(){var pct=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100;btn.classList.toggle('vis',window.scrollY>300);if(circle){var offset=100-(pct);circle.setAttribute('stroke-dashoffset',offset);}},{passive:true});btn.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'});});})();`,
  },
  {
    id: "floating_action_menu",
    name: "Menú de Acciones Flotante",
    category: "micro_interactions",
    description: "Botón FAB con menú radial que se despliega — CSS + JS",
    libs: [],
    html: '<div class="fx-fab-wrap"><button class="fx-fab-main" id="fx-fab-toggle">+</button><div class="fx-fab-menu" id="fx-fab-menu"><button class="fx-fab-item" style="--i:0" title="Compartir">📤</button><button class="fx-fab-item" style="--i:1" title="Favorito">❤️</button><button class="fx-fab-item" style="--i:2" title="Chat">💬</button><button class="fx-fab-item" style="--i:3" title="Carrito">🛒</button></div></div>',
    css: `.fx-fab-wrap{position:fixed;bottom:28px;right:28px;z-index:9999;}
.fx-fab-main{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,__PRIMARY__,__SECONDARY__);border:none;color:#fff;font-size:1.8rem;cursor:pointer;box-shadow:0 4px 20px __PRIMARY__50;transition:transform .3s,box-shadow .2s;}
.fx-fab-main.open{transform:rotate(45deg);}
.fx-fab-menu{position:absolute;bottom:0;right:0;pointer-events:none;}
.fx-fab-item{position:absolute;width:44px;height:44px;border-radius:50%;background:__SURFACE__;border:1px solid rgba(255,255,255,.12);font-size:1.1rem;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.4);bottom:4px;right:4px;transform:scale(0);transition:transform .3s cubic-bezier(.175,.885,.32,1.275);transition-delay:calc(var(--i) * .05s);}
.fx-fab-menu.open .fx-fab-item{pointer-events:auto;}
.fx-fab-menu.open .fx-fab-item:nth-child(1){transform:translateY(calc(-1 * (var(--i)+1) * 60px)) scale(1);}
.fx-fab-menu.open .fx-fab-item:nth-child(2){transform:translateY(calc(-1 * (var(--i)+1) * 60px)) scale(1);}
.fx-fab-menu.open .fx-fab-item:nth-child(3){transform:translateY(calc(-1 * (var(--i)+1) * 60px)) scale(1);}
.fx-fab-menu.open .fx-fab-item:nth-child(4){transform:translateY(calc(-1 * (var(--i)+1) * 60px)) scale(1);}`,
    js: `(function(){var btn=document.getElementById('fx-fab-toggle');var menu=document.getElementById('fx-fab-menu');if(!btn||!menu)return;btn.addEventListener('click',function(){btn.classList.toggle('open');menu.classList.toggle('open');});})();`,
  },
  {
    id: "tab_slider_animated",
    name: "Tabs con Slider Animado",
    category: "micro_interactions",
    description: "Sistema de tabs con indicador deslizante y contenido con fade — JS + CSS",
    libs: [],
    html: '<div class="fx-tabs-sys"><div class="fx-tabs-nav" id="fx-tn"><button class="fx-tn-btn active" data-tab="0">__USP_1__</button><button class="fx-tn-btn" data-tab="1">__USP_2__</button><button class="fx-tn-btn" data-tab="2">__USP_3__</button><div class="fx-tn-ink" id="fx-tn-ink"></div></div><div class="fx-tabs-content"><div class="fx-tc active">__HEADLINE__</div><div class="fx-tc">__TAGLINE__</div><div class="fx-tc">__CTA__</div></div></div>',
    css: `.fx-tabs-sys{width:100%;max-width:500px;}
.fx-tabs-nav{display:flex;position:relative;background:__SURFACE__;border-radius:10px;padding:4px;gap:0;}
.fx-tn-btn{flex:1;padding:9px 16px;border:none;background:none;color:rgba(255,255,255,.45);font-family:__FONT__,sans-serif;font-size:.85rem;cursor:pointer;position:relative;z-index:1;transition:color .2s;border-radius:8px;}
.fx-tn-btn.active{color:__TEXT__;}
.fx-tn-ink{position:absolute;top:4px;bottom:4px;border-radius:8px;background:rgba(255,255,255,.08);transition:left .3s cubic-bezier(.215,.61,.355,1),width .3s cubic-bezier(.215,.61,.355,1);}
.fx-tabs-content{padding:20px 4px;}
.fx-tc{display:none;font-family:__FONT__,sans-serif;color:__TEXT__;animation:tc-in .3s ease;}
.fx-tc.active{display:block;}
@keyframes tc-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}`,
    js: `(function(){var nav=document.getElementById('fx-tn');var ink=document.getElementById('fx-tn-ink');var btns=nav?nav.querySelectorAll('.fx-tn-btn'):[];var contents=document.querySelectorAll('.fx-tc');function setInk(btn){if(!ink)return;ink.style.left=btn.offsetLeft+'px';ink.style.width=btn.offsetWidth+'px';}btns.forEach(function(btn){btn.addEventListener('click',function(){btns.forEach(function(b){b.classList.remove('active');});contents.forEach(function(c){c.classList.remove('active');});btn.classList.add('active');setInk(btn);var idx=parseInt(btn.dataset.tab);if(contents[idx])contents[idx].classList.add('active');});});if(btns[0])setInk(btns[0]);})();`,
  },
  {
    id: "accordion_smooth_premium",
    name: "Acordeón Suave Premium",
    category: "micro_interactions",
    description: "FAQ accordion con animación height suave y chevron rotante — JS + CSS",
    libs: [],
    html: '<div class="fx-accord"><div class="fx-acc-item"><button class="fx-acc-head">¿Qué incluye el plan? <span class="fx-acc-icon">›</span></button><div class="fx-acc-body"><p>__TAGLINE__. Acceso completo a todas las funcionalidades de __NAME__ sin límites.</p></div></div><div class="fx-acc-item"><button class="fx-acc-head">¿Hay contrato de permanencia? <span class="fx-acc-icon">›</span></button><div class="fx-acc-body"><p>No. Puedes cancelar cuando quieras. Sin compromisos, sin letra pequeña.</p></div></div><div class="fx-acc-item"><button class="fx-acc-head">¿Cómo empiezo? <span class="fx-acc-icon">›</span></button><div class="fx-acc-body"><p>Haz clic en "__CTA__" y en 2 minutos tendrás acceso completo. __USP_1__.</p></div></div></div>',
    css: `.fx-accord{width:100%;max-width:560px;}
.fx-acc-item{border-bottom:1px solid rgba(255,255,255,.07);}
.fx-acc-head{width:100%;padding:18px 0;display:flex;justify-content:space-between;align-items:center;background:none;border:none;color:__TEXT__;font-family:__FONT__,sans-serif;font-size:.95rem;font-weight:600;cursor:pointer;text-align:left;gap:16px;}
.fx-acc-icon{color:__PRIMARY__;font-size:1.4rem;transition:transform .3s ease;flex-shrink:0;}
.fx-acc-item.open .fx-acc-icon{transform:rotate(90deg);}
.fx-acc-body{overflow:hidden;max-height:0;transition:max-height .35s ease,padding .35s ease;}
.fx-acc-item.open .fx-acc-body{max-height:200px;}
.fx-acc-body p{padding-bottom:16px;color:rgba(255,255,255,.55);font-family:__FONT__,sans-serif;font-size:.875rem;line-height:1.65;}`,
    js: `document.querySelectorAll('.fx-acc-head').forEach(function(btn){btn.addEventListener('click',function(){var item=btn.closest('.fx-acc-item');var wasOpen=item.classList.contains('open');document.querySelectorAll('.fx-acc-item').forEach(function(i){i.classList.remove('open');});if(!wasOpen)item.classList.add('open');});});`,
  },

  // ── BATCH 8: Neon & Premium Borders ─────────────────────────────────────
  {
    id: "neon_border_animate",
    name: "Borde Neón Animado",
    category: "micro_interactions",
    description: "Tarjeta con borde que circula en neón al hover — CSS animated gradient",
    libs: [],
    html: '<div class="fx-neon-border-wrap"><div class="fx-neon-border"><h3>__NAME__</h3><p>__TAGLINE__</p></div></div>',
    css: `.fx-neon-border-wrap{padding:2px;border-radius:18px;background:conic-gradient(from var(--a,0deg),transparent 20%,__PRIMARY__ 40%,__SECONDARY__ 60%,transparent 80%);animation:border-spin 4s linear infinite;}
@property --a{syntax:'<angle>';inherits:false;initial-value:0deg;}
@keyframes border-spin{to{--a:360deg;}}
.fx-neon-border{background:__BG__;border-radius:16px;padding:32px;color:__TEXT__;}
.fx-neon-border h3{font-family:__FONT__,sans-serif;font-size:1.4rem;font-weight:700;margin-bottom:8px;}
.fx-neon-border p{color:rgba(255,255,255,.5);font-size:.875rem;}`,
    js: "",
  },
  {
    id: "gradient_border_card",
    name: "Card Borde Gradiente",
    category: "cards",
    description: "Tarjeta con borde gradiente estático — CSS background-clip trick",
    libs: [],
    html: '<div class="fx-gb-card"><h3>__NAME__</h3><p>__TAGLINE__</p><button class="fx-gb-btn">__CTA__</button></div>',
    css: `.fx-gb-card{background:linear-gradient(__SURFACE__,__SURFACE__) padding-box,linear-gradient(135deg,__PRIMARY__,__SECONDARY__) border-box;border:1.5px solid transparent;border-radius:20px;padding:32px;transition:transform .3s,box-shadow .3s;cursor:pointer;}
.fx-gb-card:hover{transform:translateY(-4px);box-shadow:0 16px 48px rgba(0,0,0,.4);}
.fx-gb-card h3{font-family:__FONT__,sans-serif;font-size:1.3rem;font-weight:700;color:__TEXT__;margin-bottom:10px;}
.fx-gb-card p{color:rgba(255,255,255,.5);font-size:.875rem;margin-bottom:20px;}
.fx-gb-btn{padding:10px 24px;background:linear-gradient(135deg,__PRIMARY__,__SECONDARY__);border:none;border-radius:100px;color:#000;font-weight:700;font-family:__FONT__,sans-serif;cursor:pointer;font-size:.875rem;}`,
    js: "",
  },
  {
    id: "spotlight_card",
    name: "Tarjeta Spotlight",
    category: "interactive_effects",
    description: "Grid de tarjetas con spot de luz que sigue al cursor — JS + CSS vars",
    libs: [],
    html: '<div class="fx-spotlight-grid"><div class="fx-sp-card"><h4>__USP_1__</h4><p>__HEADLINE__</p></div><div class="fx-sp-card"><h4>__USP_2__</h4><p>__TAGLINE__</p></div><div class="fx-sp-card"><h4>__USP_3__</h4><p>__CTA__</p></div></div>',
    css: `.fx-spotlight-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.fx-sp-card{padding:28px;background:__SURFACE__;border:1px solid rgba(255,255,255,.06);border-radius:16px;position:relative;overflow:hidden;}
.fx-sp-card::before{content:'';position:absolute;inset:0;background:radial-gradient(350px circle at var(--mx,50%) var(--my,50%),__PRIMARY__18,transparent 70%);opacity:0;transition:opacity .3s;}
.fx-sp-card:hover::before{opacity:1;}
.fx-sp-card h4{font-family:__FONT__,sans-serif;font-size:1rem;font-weight:700;color:__TEXT__;margin-bottom:8px;position:relative;}
.fx-sp-card p{color:rgba(255,255,255,.45);font-size:.85rem;position:relative;}`,
    js: `document.querySelectorAll('.fx-sp-card').forEach(function(card){card.addEventListener('mousemove',function(e){var r=card.getBoundingClientRect();card.style.setProperty('--mx',(e.clientX-r.left)+'px');card.style.setProperty('--my',(e.clientY-r.top)+'px');});});`,
  },
  {
    id: "liquid_button",
    name: "Botón Liquid Fill",
    category: "micro_interactions",
    description: "Botón que se llena desde abajo al hacer hover — CSS clip-path animation",
    libs: [],
    html: '<button class="fx-liquid-btn">__CTA__</button>',
    css: `.fx-liquid-btn{position:relative;padding:14px 40px;background:transparent;border:2px solid __PRIMARY__;border-radius:100px;color:__PRIMARY__;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:700;cursor:pointer;overflow:hidden;transition:color .4s ease;}
.fx-liquid-btn::before{content:'';position:absolute;bottom:0;left:0;right:0;height:0%;background:__PRIMARY__;transition:height .4s cubic-bezier(.215,.61,.355,1);z-index:-1;border-radius:0 0 100px 100px;}
.fx-liquid-btn:hover{color:#000;}
.fx-liquid-btn:hover::before{height:100%;}`,
    js: "",
  },
  {
    id: "scroll_triggered_counter",
    name: "Contadores Estadísticas Empresa",
    category: "charts",
    description: "Fila de métricas que se activan al entrar en viewport — IntersectionObserver",
    libs: [],
    html: '<div class="fx-metrics-row"><div class="fx-met"><span class="fx-met-n" data-end="12" data-suf="+"">0+</span><p>Años de experiencia</p></div><div class="fx-met"><span class="fx-met-n" data-end="2847" data-suf="+">0+</span><p>Proyectos entregados</p></div><div class="fx-met"><span class="fx-met-n" data-end="98" data-suf="%">0%</span><p>Clientes satisfechos</p></div><div class="fx-met"><span class="fx-met-n" data-end="4.9" data-suf="★">0★</span><p>Valoración media</p></div></div>',
    css: `.fx-metrics-row{display:flex;flex-wrap:wrap;gap:48px;}
.fx-met{min-width:100px;}
.fx-met-n{font-family:__FONT__,sans-serif;font-size:3rem;font-weight:900;color:__PRIMARY__;display:block;}
.fx-met p{color:rgba(255,255,255,.4);font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;margin-top:4px;}`,
    js: `var io2=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var el=e.target;var end=parseFloat(el.dataset.end);var suf=el.dataset.suf||'';var isFloat=el.dataset.end.includes('.');var dur=1800;var start=null;(function frame(ts){if(!start)start=ts;var p=Math.min((ts-start)/dur,1);var v=end*(1-Math.pow(1-p,3));el.textContent=(isFloat?v.toFixed(1):Math.floor(v))+suf;if(p<1)requestAnimationFrame(frame);})();io2.unobserve(el);}});},{threshold:.5});document.querySelectorAll('.fx-met-n').forEach(function(el){io2.observe(el);});`,
  },

  // ── BATCH 9: Efectos Especiales ──────────────────────────────────────────
  {
    id: "morphing_blob_hero",
    name: "Hero con Blob Morphing",
    category: "background_effects",
    description: "Sección hero con blob orgánico de fondo en primer plano — CSS + SVG",
    libs: [],
    html: '<div class="fx-blob-hero"><svg class="fx-bh-svg" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="bh-g" cx="50%" cy="50%"><stop offset="0%" stop-color="__PRIMARY__" stop-opacity=".35"/><stop offset="100%" stop-color="__SECONDARY__" stop-opacity="0"/></radialGradient></defs><path class="fx-bh-path" fill="url(#bh-g)"/></svg><div class="fx-bh-content"><h1>__HEADLINE__</h1><p>__TAGLINE__</p><button class="fx-bh-cta">__CTA__</button></div></div>',
    css: `.fx-blob-hero{position:relative;min-height:500px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.fx-bh-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;}
.fx-bh-path{animation:bh-morph 8s ease-in-out infinite;}
@keyframes bh-morph{0%,100%{d:path('M400,150C480,150,560,200,580,280C600,360,560,440,480,460C400,480,320,440,280,380C240,320,260,240,300,200C340,160,320,150,400,150Z');}50%{d:path('M420,130C500,140,580,210,590,300C600,390,550,460,460,470C370,480,290,430,260,360C230,290,260,210,310,180C360,150,340,120,420,130Z');}}`,
    js: `(function(){var path=document.querySelector('.fx-bh-path');if(!path||!document.querySelector('.fx-blob-hero'))return;})();`,
  },
  {
    id: "particle_cursor_trail",
    name: "Rastro de Partículas en Cursor",
    category: "interactive_effects",
    description: "Partículas de colores que siguen al cursor — Canvas 2D puro",
    libs: [],
    html: '<canvas id="fx-trail-cv" style="position:fixed;inset:0;pointer-events:none;z-index:9997;"></canvas>',
    css: "",
    js: `(function(){var cv=document.getElementById('fx-trail-cv');if(!cv)return;var ctx=cv.getContext('2d');cv.width=window.innerWidth;cv.height=window.innerHeight;window.addEventListener('resize',function(){cv.width=window.innerWidth;cv.height=window.innerHeight;});var particles=[];var mx=0,my=0;window.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;for(var i=0;i<3;i++){particles.push({x:mx,y:my,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3-1,size:4+Math.random()*4,color:['__PRIMARY__','__SECONDARY__','#8b5cf6'][Math.floor(Math.random()*3)],alpha:1});}},{passive:true});(function tick(){ctx.clearRect(0,0,cv.width,cv.height);particles=particles.filter(function(p){return p.alpha>0;});particles.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.alpha-=.025;p.size*=.97;ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;requestAnimationFrame(tick);})();})();`,
  },
  {
    id: "fire_effect_css",
    name: "Efecto Fuego CSS",
    category: "background_effects",
    description: "Llamas animadas en CSS puro — gradientes + blur + animation",
    libs: [],
    html: '<div class="fx-fire-wrap"><div class="fx-fire"><div class="fx-flame" style="--d:0s"></div><div class="fx-flame" style="--d:-.3s"></div><div class="fx-flame" style="--d:-.6s"></div><div class="fx-flame" style="--d:-.9s"></div><div class="fx-flame" style="--d:-1.2s"></div></div><p class="fx-fire-label">__NAME__</p></div>',
    css: `.fx-fire-wrap{display:flex;flex-direction:column;align-items:center;gap:12px;}
.fx-fire{position:relative;width:80px;height:100px;}
.fx-flame{position:absolute;bottom:0;width:40px;height:60px;border-radius:50% 50% 20% 20%;background:radial-gradient(ellipse at bottom,#fff 0%,#fbbf24 30%,#f97316 60%,#ef4444 100%);filter:blur(8px);animation:flame-rise 1.2s ease-in-out infinite;transform-origin:bottom center;left:50%;margin-left:-20px;}
.fx-flame:nth-child(1){animation-delay:var(--d);opacity:.9;}
.fx-flame:nth-child(2){width:30px;height:50px;animation-delay:var(--d);opacity:.7;left:30%;}
.fx-flame:nth-child(3){width:32px;height:55px;animation-delay:var(--d);opacity:.7;left:40%;}
.fx-flame:nth-child(4){width:28px;height:48px;animation-delay:var(--d);opacity:.6;left:50%;}
.fx-flame:nth-child(5){width:26px;height:45px;animation-delay:var(--d);opacity:.5;left:60%;}
@keyframes flame-rise{0%,100%{transform:scaleX(1) scaleY(1) translateY(0) rotate(-3deg);}50%{transform:scaleX(.8) scaleY(1.1) translateY(-8px) rotate(3deg);}}
.fx-fire-label{font-family:__FONT__,sans-serif;color:__TEXT__;font-size:1rem;font-weight:700;}`,
    js: "",
  },
  {
    id: "drag_scroll_gallery",
    name: "Galería Drag to Scroll",
    category: "interactive_effects",
    description: "Galería horizontal arrastrable con mouse/touch — JS puro",
    libs: [],
    html: '<div class="fx-drag-gallery" id="fx-drag-gal"><div class="fx-dg-item"><img src="https://picsum.photos/seed/1/280/200" alt="1"></div><div class="fx-dg-item"><img src="https://picsum.photos/seed/2/280/200" alt="2"></div><div class="fx-dg-item"><img src="https://picsum.photos/seed/3/280/200" alt="3"></div><div class="fx-dg-item"><img src="https://picsum.photos/seed/4/280/200" alt="4"></div><div class="fx-dg-item"><img src="https://picsum.photos/seed/5/280/200" alt="5"></div></div>',
    css: `.fx-drag-gallery{display:flex;gap:16px;overflow-x:auto;cursor:grab;scrollbar-width:none;-webkit-user-select:none;user-select:none;padding-bottom:8px;}
.fx-drag-gallery:active{cursor:grabbing;}
.fx-drag-gallery::-webkit-scrollbar{display:none;}
.fx-dg-item{flex-shrink:0;border-radius:12px;overflow:hidden;}
.fx-dg-item img{width:280px;height:200px;object-fit:cover;display:block;pointer-events:none;transition:transform .3s;}
.fx-dg-item:hover img{transform:scale(1.04);}`,
    js: `(function(){var el=document.getElementById('fx-drag-gal');if(!el)return;var isDragging=false,startX,scrollLeft;el.addEventListener('mousedown',function(e){isDragging=true;startX=e.pageX-el.offsetLeft;scrollLeft=el.scrollLeft;el.style.scrollBehavior='auto';});document.addEventListener('mouseup',function(){isDragging=false;el.style.scrollBehavior='';});el.addEventListener('mousemove',function(e){if(!isDragging)return;e.preventDefault();var x=e.pageX-el.offsetLeft;el.scrollLeft=scrollLeft-(x-startX)*1.5;});})();`,
  },

  // ── BATCH 10: Data visualization ────────────────────────────────────────
  {
    id: "animated_bar_chart",
    name: "Gráfico de Barras Animado",
    category: "charts",
    description: "Gráfico de barras puro CSS con animación de entrada — CSS only",
    libs: [],
    html: '<div class="fx-bar-chart"><div class="fx-bc-row"><span class="fx-bc-label">Ene</span><div class="fx-bc-bar" style="--h:65%"><span>65%</span></div></div><div class="fx-bc-row"><span class="fx-bc-label">Feb</span><div class="fx-bc-bar" style="--h:80%"><span>80%</span></div></div><div class="fx-bc-row"><span class="fx-bc-label">Mar</span><div class="fx-bc-bar" style="--h:45%"><span>45%</span></div></div><div class="fx-bc-row"><span class="fx-bc-label">Abr</span><div class="fx-bc-bar" style="--h:92%"><span>92%</span></div></div><div class="fx-bc-row"><span class="fx-bc-label">May</span><div class="fx-bc-bar" style="--h:73%"><span>73%</span></div></div></div>',
    css: `.fx-bar-chart{display:flex;align-items:flex-end;gap:12px;height:200px;padding:16px 0;}
.fx-bc-row{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;}
.fx-bc-bar{width:100%;background:linear-gradient(to top,__PRIMARY__,__SECONDARY__);border-radius:6px 6px 0 0;position:relative;height:0;animation:bar-grow .8s cubic-bezier(.215,.61,.355,1) forwards;animation-delay:calc(var(--i,0)*.1s);}
@keyframes bar-grow{to{height:var(--h);}}
.fx-bc-bar span{position:absolute;top:-22px;left:50%;transform:translateX(-50%);font-size:.7rem;color:__PRIMARY__;font-weight:700;font-family:__FONT__,sans-serif;}
.fx-bc-label{font-family:__FONT__,sans-serif;font-size:.75rem;color:rgba(255,255,255,.4);}`,
    js: `document.querySelectorAll('.fx-bc-bar').forEach(function(b,i){b.style.setProperty('--i',i);});`,
  },
  {
    id: "donut_chart_svg",
    name: "Gráfico Donut SVG Animado",
    category: "charts",
    description: "Gráfico donut con 3 segmentos animados y leyenda — SVG + CSS",
    libs: [],
    html: '<div class="fx-donut-wrap"><svg viewBox="0 0 120 120" class="fx-donut-svg"><circle class="fx-dn-bg" cx="60" cy="60" r="45"/><circle class="fx-dn-seg" cx="60" cy="60" r="45" stroke="__PRIMARY__" stroke-dasharray="113 169"/><circle class="fx-dn-seg" cx="60" cy="60" r="45" stroke="__SECONDARY__" stroke-dasharray="70 212" stroke-dashoffset="-113"/><circle class="fx-dn-seg" cx="60" cy="60" r="45" stroke="#8b5cf6" stroke-dasharray="46 236" stroke-dashoffset="-183"/><text x="60" y="64" text-anchor="middle" class="fx-dn-label">__ICON__</text></svg><div class="fx-dn-legend"><div><span style="background:__PRIMARY__"></span>Producto A (40%)</div><div><span style="background:__SECONDARY__"></span>Producto B (25%)</div><div><span style="background:#8b5cf6"></span>Otro (16%)</div></div></div>',
    css: `.fx-donut-wrap{display:flex;align-items:center;gap:32px;}
.fx-donut-svg{width:160px;height:160px;transform:rotate(-90deg);}
.fx-dn-bg{fill:none;stroke:rgba(255,255,255,.06);stroke-width:18;}
.fx-dn-seg{fill:none;stroke-width:18;stroke-dashoffset:0;stroke-linecap:butt;opacity:0;animation:dn-in .8s ease forwards;}
.fx-dn-seg:nth-child(2){animation-delay:.1s;}
.fx-dn-seg:nth-child(3){animation-delay:.3s;}
.fx-dn-seg:nth-child(4){animation-delay:.5s;}
@keyframes dn-in{from{opacity:0}to{opacity:1}}
.fx-dn-label{font-size:18px;fill:__TEXT__;transform:rotate(90deg);transform-box:fill-box;transform-origin:center;}
.fx-dn-legend{display:flex;flex-direction:column;gap:8px;font-family:__FONT__,sans-serif;font-size:.8rem;color:rgba(255,255,255,.55);}
.fx-dn-legend div{display:flex;align-items:center;gap:8px;}
.fx-dn-legend span{width:10px;height:10px;border-radius:2px;flex-shrink:0;}`,
    js: "",
  },
  {
    id: "milestone_timeline",
    name: "Timeline de Hitos",
    category: "scroll_indicators",
    description: "Línea de tiempo vertical de hitos animados — CSS + IntersectionObserver",
    libs: [],
    html: '<div class="fx-timeline"><div class="fx-tl-item"><div class="fx-tl-dot"></div><div class="fx-tl-content"><span class="fx-tl-date">2021</span><h4>__USP_1__</h4><p>__HEADLINE__</p></div></div><div class="fx-tl-item"><div class="fx-tl-dot"></div><div class="fx-tl-content"><span class="fx-tl-date">2022</span><h4>__USP_2__</h4><p>__TAGLINE__</p></div></div><div class="fx-tl-item"><div class="fx-tl-dot"></div><div class="fx-tl-content"><span class="fx-tl-date">2024</span><h4>__USP_3__</h4><p>__CTA__</p></div></div></div>',
    css: `.fx-timeline{position:relative;padding-left:32px;}
.fx-timeline::before{content:'';position:absolute;left:8px;top:0;bottom:0;width:1px;background:rgba(255,255,255,.1);}
.fx-tl-item{position:relative;margin-bottom:32px;opacity:0;transform:translateX(-20px);transition:opacity .5s ease,transform .5s ease;}
.fx-tl-item.vis{opacity:1;transform:none;}
.fx-tl-dot{position:absolute;left:-28px;top:4px;width:14px;height:14px;border-radius:50%;background:__PRIMARY__;border:2px solid __BG__;box-shadow:0 0 0 4px __PRIMARY__30;}
.fx-tl-content{}
.fx-tl-date{font-size:.7rem;color:__PRIMARY__;letter-spacing:.15em;text-transform:uppercase;font-family:__FONT__,sans-serif;}
.fx-tl-content h4{font-family:__FONT__,sans-serif;color:__TEXT__;font-weight:700;margin:4px 0;}
.fx-tl-content p{color:rgba(255,255,255,.45);font-size:.85rem;}`,
    js: `var io3=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.classList.add('vis');io3.unobserve(e.target);}});},{threshold:.2});document.querySelectorAll('.fx-tl-item').forEach(function(el){io3.observe(el);});`,
  },
  {
    id: "skill_bars_horizontal",
    name: "Barras de Habilidades/Servicios",
    category: "charts",
    description: "Barras horizontales animadas para mostrar expertise — CSS + IntersectionObserver",
    libs: [],
    html: '<div class="fx-skills"><div class="fx-sk-row"><span>__USP_1__</span><div class="fx-sk-bar-wrap"><div class="fx-sk-bar" style="--w:92%"></div></div><span class="fx-sk-pct">92%</span></div><div class="fx-sk-row"><span>__USP_2__</span><div class="fx-sk-bar-wrap"><div class="fx-sk-bar" style="--w:85%"></div></div><span class="fx-sk-pct">85%</span></div><div class="fx-sk-row"><span>__USP_3__</span><div class="fx-sk-bar-wrap"><div class="fx-sk-bar" style="--w:78%"></div></div><span class="fx-sk-pct">78%</span></div></div>',
    css: `.fx-skills{display:flex;flex-direction:column;gap:16px;width:100%;max-width:480px;}
.fx-sk-row{display:grid;grid-template-columns:140px 1fr 48px;align-items:center;gap:12px;font-family:__FONT__,sans-serif;font-size:.85rem;color:__TEXT__;}
.fx-sk-bar-wrap{height:8px;background:rgba(255,255,255,.07);border-radius:100px;overflow:hidden;}
.fx-sk-bar{height:100%;width:0;background:linear-gradient(90deg,__PRIMARY__,__SECONDARY__);border-radius:100px;transition:width 1.2s cubic-bezier(.215,.61,.355,1);}
.fx-sk-pct{color:__PRIMARY__;font-size:.75rem;font-weight:700;text-align:right;}`,
    js: `var io4=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.querySelectorAll('.fx-sk-bar').forEach(function(b){b.style.width=b.style.getPropertyValue('--w')||'70%';});io4.unobserve(e.target);}});},{threshold:.3});document.querySelectorAll('.fx-skills').forEach(function(el){io4.observe(el);});`,
  },
];

// ── Visme templates (loaded lazily) ──────────────────────────────────────────
let _vismeCache: Array<{id: string; name: string; icon: string; category: string; tags: string[]; description: string; prompt: string}> | null = null;

export function loadVismeTemplates() {
  if (_vismeCache) return _vismeCache;
  try {
    const raw = readFileSync(join(_dataDir, "visme_templates.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const templates = Array.isArray(parsed) ? parsed : (parsed.templates ?? []);
    _vismeCache = Array.isArray(templates) ? templates : [];
  } catch {
    _vismeCache = [];
  }
  return _vismeCache;
}

// ── Effects prompts (24 FX templates, loaded lazily) ─────────────────────────
let _effectsPromptsCache: Array<{id: string; name: string; icon?: string; category: string; tags?: string[]; description?: string; prompt: string}> | null = null;

export function loadEffectsPrompts() {
  if (_effectsPromptsCache) return _effectsPromptsCache;
  try {
    const raw = readFileSync(join(_dataDir, "effects_prompts.json"), "utf-8");
    const parsed = JSON.parse(raw);
    const templates = Array.isArray(parsed) ? parsed : (parsed.templates ?? []);
    _effectsPromptsCache = Array.isArray(templates) ? templates : [];
  } catch {
    _effectsPromptsCache = [];
  }
  return _effectsPromptsCache;
}

export function buildEffectPreviewHtml(snippet: EffectSnippet, dna: DnaVars = DEFAULT_DNA): string {
  const libs = snippet.libs.map(url =>
    url.endsWith(".js") ? `<script src="${url}"></script>` : `<link rel="stylesheet" href="${url}">`
  ).join("\n");
  const htmlWithDna = applyDna(snippet.html, dna);
  const cssWithDna = applyDna(snippet.css, dna);
  const jsWithDna = applyDna(snippet.js, dna);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${snippet.name}</title>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(dna.font)}:wght@300;400;600;700&display=swap" rel="stylesheet">
${libs}
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:${dna.bg};color:${dna.text};font-family:'${dna.font}',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px;}
${cssWithDna}
</style>
</head>
<body>
${htmlWithDna}
${jsWithDna ? `<script>${jsWithDna}</script>` : ""}
</body>
</html>`;
}
