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
