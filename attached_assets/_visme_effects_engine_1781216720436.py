# -*- coding: utf-8 -*-
"""
_visme_effects_engine.py
========================
Motor completo de efectos visuales: 594 Visme templates + 30 snippets pre-built +
230 Aceternity + 175 Stitch + TypeGPU. Genera HTML/CSS/JS real ejecutable.

Rutas: /api/visme/*
Serve UI: /effects-studio
"""
import json
import os
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, FastAPI, HTTPException, Query as QParam

log = logging.getLogger("crafter.visme_effects")

_HERE = Path(__file__).parent
_DATA  = _HERE / "data" / "prompt_vault" / "templates"
_ADATA = _HERE.parent / "admin" / "templates" / "visual-effects"

# ─── DNA defaults ─────────────────────────────────────────────────────────────
_DEFAULT_DNA = {
    "name":            "Brand",
    "sector":          "Agency",
    "font":            "Inter",
    "primary_color":   "#6366f1",
    "secondary_color": "#ec4899",
    "accent_color":    "#c9a961",
    "bg_color":        "#0d0d1a",
    "text_color":      "#f1f5f9",
    "surface_color":   "#1a1a2e",
    "headline":        "Construye algo extraordinario",
    "tagline":         "La agencia que convierte ideas en experiencias",
    "cta":             "Empezar ahora",
}

# ─── 30 Pre-built effect snippets (real CSS/JS, no backend call needed) ───────
EFFECT_LIBRARY: Dict[str, Dict] = {

    "particle_rain": {
        "name": "Lluvia de Partículas",
        "category": "particle_effects",
        "description": "Partículas animadas cayendo sobre fondo oscuro — Canvas 2D puro, sin deps",
        "libs": [],
        "html": '<canvas id="fx-particles" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;"></canvas>',
        "css": "",
        "js": r"""(function(){var c=document.getElementById('fx-particles');if(!c)return;var x=c.getContext('2d');function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}resize();window.addEventListener('resize',resize);var P=[];for(var i=0;i<160;i++)P.push({x:Math.random()*c.width,y:Math.random()*c.height,v:0.8+Math.random()*2.5,r:Math.random()*1.5+0.3,o:Math.random()*0.5+0.15});(function tick(){x.clearRect(0,0,c.width,c.height);P.forEach(function(p){p.y+=p.v;if(p.y>c.height)p.y=-5;x.beginPath();x.arc(p.x,p.y,p.r,0,Math.PI*2);x.fillStyle='__PRIMARY__';x.globalAlpha=p.o;x.fill();});x.globalAlpha=1;requestAnimationFrame(tick);})();})();""",
    },

    "aurora_bg": {
        "name": "Fondo Aurora",
        "category": "background_effects",
        "description": "Degradado animado tipo aurora boreal — CSS puro, sin deps",
        "libs": [],
        "html": '<div class="fx-aurora-bg"></div>',
        "css": """.fx-aurora-bg{position:fixed;inset:0;z-index:-1;background:linear-gradient(-45deg,__BG__,__PRIMARY__,__SECONDARY__,#8b5cf6,__PRIMARY__);background-size:400% 400%;animation:aurora-move 12s ease infinite;}
@keyframes aurora-move{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}""",
        "js": "",
    },

    "magnetic_btn": {
        "name": "Botones Magnéticos",
        "category": "micro_interactions",
        "description": "Botones que se mueven hacia el cursor (efecto magnético) — JS puro",
        "libs": [],
        "html": '<button class="fx-magnetic">__CTA__</button>',
        "css": """.fx-magnetic{display:inline-flex;align-items:center;justify-content:center;padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:100px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:600;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;will-change:transform;}
.fx-magnetic:hover{box-shadow:0 8px 32px __PRIMARY__80;}""",
        "js": r"""document.querySelectorAll('.fx-magnetic').forEach(function(el){el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();var x=(e.clientX-r.left-r.width/2)*0.35;var y=(e.clientY-r.top-r.height/2)*0.35;el.style.transform='translate('+x+'px,'+y+'px)';});el.addEventListener('mouseleave',function(){el.style.transform='';});});""",
    },

    "text_reveal_scroll": {
        "name": "Texto Reveal en Scroll",
        "category": "text_effects",
        "description": "Palabras/líneas que aparecen al entrar en viewport — IntersectionObserver, sin deps",
        "libs": [],
        "html": '<h2 class="fx-reveal">__HEADLINE__</h2>',
        "css": """.fx-reveal{overflow:hidden;}.fx-reveal span{display:inline-block;opacity:0;transform:translateY(40px);transition:opacity .6s cubic-bezier(.215,.61,.355,1),transform .6s cubic-bezier(.215,.61,.355,1);}
.fx-reveal span.vis{opacity:1;transform:none;}""",
        "js": r"""document.querySelectorAll('.fx-reveal').forEach(function(el){var words=el.textContent.split(' ');el.innerHTML=words.map(function(w){return '<span>'+w+'</span>';}).join(' ');var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.querySelectorAll('span').forEach(function(s,i){setTimeout(function(){s.classList.add('vis');},i*80);});}});},{threshold:0.2});io.observe(el);});""",
    },

    "glass_card": {
        "name": "Tarjeta Glassmorphism",
        "category": "cards",
        "description": "Tarjeta con efecto vidrio esmerilado (backdrop-filter) — CSS puro",
        "libs": [],
        "html": '<div class="fx-glass"><h3>__NAME__</h3><p>__TAGLINE__</p></div>',
        "css": """.fx-glass{background:rgba(255,255,255,0.05);backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px;box-shadow:0 8px 48px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1);transition:transform .3s ease,box-shadow .3s ease;}
.fx-glass:hover{transform:translateY(-6px);box-shadow:0 20px 60px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.15);}""",
        "js": "",
    },

    "neon_glow": {
        "name": "Resplandor Neon",
        "category": "text_effects",
        "description": "Texto con efecto neon animado pulsante — CSS puro",
        "libs": [],
        "html": '<h1 class="fx-neon">__HEADLINE__</h1>',
        "css": """.fx-neon{color:#fff;text-shadow:0 0 7px #fff,0 0 10px #fff,0 0 21px __PRIMARY__,0 0 42px __PRIMARY__,0 0 82px __PRIMARY__;animation:neon-flicker 3s infinite alternate;}
@keyframes neon-flicker{0%,18%,22%,25%,53%,57%,100%{text-shadow:0 0 4px #fff,0 0 11px #fff,0 0 19px #fff,0 0 40px __PRIMARY__,0 0 80px __PRIMARY__,0 0 90px __PRIMARY__;}20%,24%,55%{text-shadow:none;}}""",
        "js": "",
    },

    "tilt_3d_card": {
        "name": "Tarjeta Tilt 3D",
        "category": "3d_effects",
        "description": "Tarjeta con inclinación 3D reactiva al cursor — CSS perspective + JS",
        "libs": [],
        "html": '<div class="fx-tilt"><div class="fx-tilt-inner"><h3>__NAME__</h3><p>__TAGLINE__</p></div></div>',
        "css": """.fx-tilt{perspective:1000px;display:inline-block;}.fx-tilt-inner{background:var(--surface,__SURFACE__);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px 48px;transform-style:preserve-3d;transition:transform .1s linear;will-change:transform;}
.fx-tilt-inner h3{transform:translateZ(20px);font-family:__FONT__,sans-serif;color:__TEXT__;}
.fx-tilt-inner p{transform:translateZ(10px);color:rgba(255,255,255,0.6);}""",
        "js": r"""document.querySelectorAll('.fx-tilt').forEach(function(wrap){var el=wrap.querySelector('.fx-tilt-inner');wrap.addEventListener('mousemove',function(e){var r=wrap.getBoundingClientRect();var x=((e.clientX-r.left)/r.width-.5)*22;var y=(-(e.clientY-r.top)/r.height+.5)*22;el.style.transform='rotateY('+x+'deg) rotateX('+y+'deg)';});wrap.addEventListener('mouseleave',function(){el.style.transform='rotateY(0) rotateX(0)';});});""",
    },

    "gradient_mesh": {
        "name": "Malla Degradado Animada",
        "category": "background_effects",
        "description": "Fondo con gradientes radiales en movimiento — CSS puro, no deps",
        "libs": [],
        "html": '<div class="fx-mesh-bg"></div>',
        "css": """.fx-mesh-bg{position:fixed;inset:0;z-index:-1;background:__BG__;overflow:hidden;}
.fx-mesh-bg::before,.fx-mesh-bg::after{content:'';position:absolute;border-radius:50%;filter:blur(80px);opacity:.6;}
.fx-mesh-bg::before{width:60vw;height:60vw;background:radial-gradient(circle,__PRIMARY__80,transparent 70%);top:-20%;left:-10%;animation:mesh-a 10s ease-in-out infinite alternate;}
.fx-mesh-bg::after{width:50vw;height:50vw;background:radial-gradient(circle,__SECONDARY__60,transparent 70%);bottom:-15%;right:-5%;animation:mesh-b 12s ease-in-out infinite alternate;}
@keyframes mesh-a{from{transform:translate(0,0) scale(1);}to{transform:translate(10%,15%) scale(1.1);}}
@keyframes mesh-b{from{transform:translate(0,0) scale(1);}to{transform:translate(-8%,-10%) scale(1.15);}}""",
        "js": "",
    },

    "typing_text": {
        "name": "Efecto Máquina de Escribir",
        "category": "typography_effects",
        "description": "Texto que se escribe solo con cursor parpadeante — CSS + JS puro",
        "libs": [],
        "html": '<p class="fx-typing" data-text="__HEADLINE__"></p>',
        "css": """.fx-typing::after{content:'|';animation:blink .7s infinite;color:__PRIMARY__;}
@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}""",
        "js": r"""document.querySelectorAll('.fx-typing').forEach(function(el){var text=el.dataset.text||el.textContent;el.textContent='';var i=0;function type(){if(i<text.length){el.textContent+=text[i++];setTimeout(type,55+Math.random()*45);}};setTimeout(type,600);});""",
    },

    "svg_stroke_anim": {
        "name": "Trazo SVG Animado",
        "category": "logo_animations",
        "description": "Dibujo SVG con trazo animado tipo 'dibujando en vivo' — CSS puro",
        "libs": [],
        "html": '<svg class="fx-stroke" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg"><text x="0" y="50" font-size="48" font-family="__FONT__,sans-serif" fill="none" stroke="__PRIMARY__" stroke-width="1.5">__NAME__</text></svg>',
        "css": """.fx-stroke text{stroke-dasharray:600;stroke-dashoffset:600;animation:draw 2.5s ease forwards;}
@keyframes draw{to{stroke-dashoffset:0;}}""",
        "js": "",
    },

    "confetti_burst": {
        "name": "Explosión de Confeti",
        "category": "celebration_effects",
        "description": "Confeti animado desde el centro al hacer clic — Canvas 2D, sin deps",
        "libs": [],
        "html": '<button class="fx-confetti-btn" onclick="fxConfetti(this)">__CTA__ 🎉</button><canvas id="fx-confetti" style="position:fixed;inset:0;pointer-events:none;z-index:9999;width:100%;height:100%;"></canvas>',
        "css": ".fx-confetti-btn{padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:100px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:600;cursor:pointer;}",
        "js": r"""window.fxConfetti=function(btn){var cv=document.getElementById('fx-confetti');var ctx=cv.getContext('2d');cv.width=window.innerWidth;cv.height=window.innerHeight;var colors=['__PRIMARY__','__SECONDARY__','#f59e0b','#10b981','#3b82f6','#ec4899'];var pieces=[];for(var i=0;i<200;i++)pieces.push({x:cv.width/2,y:cv.height/2,vx:(Math.random()-0.5)*14,vy:(Math.random()-1)*12,r:4+Math.random()*4,color:colors[Math.floor(Math.random()*colors.length)],alpha:1,gravity:.35});var raf;(function tick(){ctx.clearRect(0,0,cv.width,cv.height);pieces.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.vy+=p.gravity;p.alpha-=0.012;if(p.alpha>0){ctx.globalAlpha=p.alpha;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r*1.5);}});ctx.globalAlpha=1;if(pieces.some(function(p){return p.alpha>0;}))raf=requestAnimationFrame(tick);else{ctx.clearRect(0,0,cv.width,cv.height);}})();};""",
    },

    "floating_element": {
        "name": "Elemento Flotante",
        "category": "animated_icons",
        "description": "Elemento que flota suavemente arriba/abajo — CSS puro",
        "libs": [],
        "html": '<div class="fx-float">__ICON__</div>',
        "css": ".fx-float{display:inline-block;animation:float-ud 3s ease-in-out infinite;font-size:3rem;}\n@keyframes float-ud{0%,100%{transform:translateY(0);}50%{transform:translateY(-18px);}}",
        "js": "",
    },

    "ripple_click": {
        "name": "Efecto Ripple al Click",
        "category": "micro_interactions",
        "description": "Ola de expansión al hacer clic en cualquier botón — JS + CSS, sin deps",
        "libs": [],
        "html": '<button class="fx-ripple-btn">__CTA__</button>',
        "css": ".fx-ripple-btn{position:relative;overflow:hidden;padding:14px 36px;background:__PRIMARY__;color:#fff;border:none;border-radius:8px;font-family:__FONT__,sans-serif;font-size:1rem;font-weight:600;cursor:pointer;}\n.fx-ripple-btn .ripple{position:absolute;border-radius:50%;transform:scale(0);animation:ripple-anim .5s linear;background:rgba(255,255,255,.35);}\n@keyframes ripple-anim{to{transform:scale(4);opacity:0;}}",
        "js": r"""document.querySelectorAll('.fx-ripple-btn').forEach(function(btn){btn.addEventListener('click',function(e){var span=document.createElement('span');span.className='ripple';var r=btn.getBoundingClientRect();var s=Math.max(r.width,r.height);span.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px;';btn.appendChild(span);setTimeout(function(){span.remove();},500);});});""",
    },

    "skeleton_loader": {
        "name": "Skeleton Loader",
        "category": "loaders",
        "description": "Placeholder shimmer para contenido cargando — CSS puro",
        "libs": [],
        "html": '<div class="fx-skeleton"><div class="fx-sk-line w-60"></div><div class="fx-sk-line w-90"></div><div class="fx-sk-line w-40"></div><div class="fx-sk-block"></div></div>',
        "css": ".fx-skeleton{padding:24px;}\n.fx-sk-line,.fx-sk-block{background:linear-gradient(90deg,__SURFACE__ 25%,rgba(255,255,255,.08) 50%,__SURFACE__ 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:6px;margin-bottom:12px;height:14px;}\n.fx-sk-block{height:120px;}\n.w-60{width:60%;}\n.w-90{width:90%;}\n.w-40{width:40%;}\n@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}",
        "js": "",
    },

    "scroll_progress_bar": {
        "name": "Barra Progreso Scroll",
        "category": "scroll_indicators",
        "description": "Barra superior que indica progreso de lectura de la página — JS + CSS, sin deps",
        "libs": [],
        "html": '<div id="fx-scroll-bar"></div>',
        "css": "#fx-scroll-bar{position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,__PRIMARY__,__SECONDARY__);width:0%;z-index:9999;transition:width .1s linear;}",
        "js": r"""window.addEventListener('scroll',function(){var scrolled=(window.scrollY/(document.documentElement.scrollHeight-window.innerHeight))*100;document.getElementById('fx-scroll-bar').style.width=scrolled+'%';});""",
    },

    "count_up": {
        "name": "Contador Animado (Count-up)",
        "category": "charts",
        "description": "Números que cuentan hasta su valor final al entrar en viewport — JS + IntersectionObserver",
        "libs": [],
        "html": '<div class="fx-stats"><span class="fx-count" data-target="2400">0</span>+ clientes</div>',
        "css": ".fx-stats{font-family:__FONT__,sans-serif;font-size:3rem;font-weight:700;color:__PRIMARY__;}\n.fx-count{display:inline-block;}",
        "js": r"""var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){var el=entry.target;var end=parseInt(el.dataset.target);var duration=1800;var step=end/(duration/16);var cur=0;var raf=setInterval(function(){cur+=step;if(cur>=end){el.textContent=end.toLocaleString();clearInterval(raf);}else{el.textContent=Math.floor(cur).toLocaleString();}},16);io.unobserve(el);}});},{threshold:0.5});document.querySelectorAll('.fx-count').forEach(function(el){io.observe(el);});""",
    },

    "blob_morph": {
        "name": "Blob Morphing",
        "category": "background_effects",
        "description": "Forma orgánica que cambia de forma suavemente — CSS puro",
        "libs": [],
        "html": '<div class="fx-blob"></div>',
        "css": ".fx-blob{width:400px;height:400px;background:radial-gradient(circle at 30% 40%,__PRIMARY__,__SECONDARY__);filter:blur(2px);animation:blob-morph 8s ease-in-out infinite;}\n@keyframes blob-morph{0%,100%{border-radius:60% 40% 30% 70% / 60% 30% 70% 40%;}25%{border-radius:30% 60% 70% 40% / 50% 60% 30% 60%;}50%{border-radius:50% 60% 30% 60% / 40% 30% 60% 50%;}75%{border-radius:40% 50% 60% 30% / 30% 60% 40% 50%;}}",
        "js": "",
    },

    "text_scramble": {
        "name": "Texto Scramble (Descifrado)",
        "category": "text_effects",
        "description": "Texto que se 'descifra' al hacer hover — JS puro, sin deps",
        "libs": [],
        "html": '<h2 class="fx-scramble" data-text="__HEADLINE__">__HEADLINE__</h2>',
        "css": ".fx-scramble{font-family:__FONT__,sans-serif;color:__TEXT__;cursor:pointer;display:inline-block;}",
        "js": r"""document.querySelectorAll('.fx-scramble').forEach(function(el){var chars='!<>-_\\/[]{}—=+*^?#________';var originalText=el.dataset.text||el.textContent;el.addEventListener('mouseenter',function(){var iter=0;var interval=setInterval(function(){el.textContent=originalText.split('').map(function(letter,index){if(index<iter)return originalText[index];return chars[Math.floor(Math.random()*chars.length)];}).join('');iter+=1/3;if(iter>=originalText.length)clearInterval(interval);},30);});});""",
    },

    "clip_path_reveal": {
        "name": "Reveal por Clip-Path",
        "category": "transition_effects",
        "description": "Elementos que se revelan con clip-path al entrar en viewport — CSS + IntersectionObserver",
        "libs": [],
        "html": '<div class="fx-clip-reveal"><img src="https://picsum.photos/seed/__SECTOR__/800/450" alt="__NAME__" style="width:100%;"></div>',
        "css": ".fx-clip-reveal{clip-path:inset(100% 0 0 0);transition:clip-path .9s cubic-bezier(.215,.61,.355,1);}\n.fx-clip-reveal.vis{clip-path:inset(0% 0 0 0);}",
        "js": r"""var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:0.15});document.querySelectorAll('.fx-clip-reveal').forEach(function(el){io.observe(el);});""",
    },

    "cursor_glow_trail": {
        "name": "Aura de Cursor",
        "category": "interactive_effects",
        "description": "Efecto de luz que sigue al cursor — JS mousemove + CSS radial-gradient, sin deps",
        "libs": [],
        "html": '<div class="fx-cursor-glow"></div>',
        "css": ".fx-cursor-glow{pointer-events:none;position:fixed;inset:0;z-index:9998;background:radial-gradient(600px circle at 0px 0px,__PRIMARY__20,transparent 60%);transition:background .05s;mix-blend-mode:screen;}",
        "js": r"""var el=document.querySelector('.fx-cursor-glow');if(el)window.addEventListener('mousemove',function(e){el.style.background='radial-gradient(600px circle at '+e.clientX+'px '+e.clientY+'px,__PRIMARY__25,transparent 60%)';});""",
    },

    "flip_card": {
        "name": "Tarjeta Flip 3D",
        "category": "3d_effects",
        "description": "Tarjeta que se voltea en 3D al hacer hover — CSS 3D puro",
        "libs": [],
        "html": '<div class="fx-flip"><div class="fx-flip-front"><h3>__NAME__</h3></div><div class="fx-flip-back"><p>__TAGLINE__</p></div></div>',
        "css": ".fx-flip{perspective:1000px;width:300px;height:200px;cursor:pointer;}\n.fx-flip-front,.fx-flip-back{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:24px;transition:transform .6s cubic-bezier(.215,.61,.355,1);}\n.fx-flip-front{background:__SURFACE__;border:1px solid rgba(255,255,255,.08);color:__TEXT__;}\n.fx-flip-back{background:__PRIMARY__;color:#fff;transform:rotateY(180deg);}\n.fx-flip{position:relative;}\n.fx-flip:hover .fx-flip-front{transform:rotateY(-180deg);}\n.fx-flip:hover .fx-flip-back{transform:rotateY(0);}",
        "js": "",
    },

    "marquee_infinite": {
        "name": "Marquee Infinito",
        "category": "animated_icons",
        "description": "Tira de texto o logos que se desplaza infinitamente — CSS animation",
        "libs": [],
        "html": '<div class="fx-marquee-wrap"><div class="fx-marquee"><span>__NAME__</span><span>✦</span><span>__SECTOR__</span><span>✦</span><span>__HEADLINE__</span><span>✦</span><span>__NAME__</span><span>✦</span><span>__SECTOR__</span><span>✦</span><span>__HEADLINE__</span><span>✦</span></div></div>',
        "css": ".fx-marquee-wrap{overflow:hidden;white-space:nowrap;border-top:1px solid rgba(255,255,255,.1);border-bottom:1px solid rgba(255,255,255,.1);padding:14px 0;}\n.fx-marquee{display:inline-block;animation:marquee-scroll 20s linear infinite;}\n.fx-marquee span{margin:0 24px;font-family:__FONT__,sans-serif;color:__TEXT__;opacity:.6;font-size:.9rem;letter-spacing:.15em;text-transform:uppercase;}\n@keyframes marquee-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
        "js": "",
    },

    "color_shift_bg": {
        "name": "Fondo Cambio de Color",
        "category": "background_effects",
        "description": "Fondo que cicla suavemente entre colores — CSS animation filter, sin deps",
        "libs": [],
        "html": '<div class="fx-color-shift"></div>',
        "css": ".fx-color-shift{position:fixed;inset:0;z-index:-1;background:__PRIMARY__;animation:hue-cycle 8s linear infinite;}\n@keyframes hue-cycle{0%{filter:hue-rotate(0deg);}100%{filter:hue-rotate(360deg);}}",
        "js": "",
    },

    "grid_hover_glow": {
        "name": "Grid con Hover Resplandor",
        "category": "interactive_effects",
        "description": "Grid de tarjetas donde el hover ilumina desde el cursor — JS + CSS custom properties",
        "libs": [],
        "html": '<div class="fx-grid"><div class="fx-grid-item"><h4>Feature 1</h4><p>__TAGLINE__</p></div><div class="fx-grid-item"><h4>Feature 2</h4><p>__TAGLINE__</p></div><div class="fx-grid-item"><h4>Feature 3</h4><p>__TAGLINE__</p></div></div>',
        "css": ".fx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}\n.fx-grid-item{position:relative;padding:28px;border-radius:16px;border:1px solid rgba(255,255,255,.08);overflow:hidden;background:__SURFACE__;color:__TEXT__;font-family:__FONT__,sans-serif;}\n.fx-grid-item::before{content:'';position:absolute;width:300px;height:300px;background:radial-gradient(circle,__PRIMARY__30,transparent 70%);border-radius:50%;transform:translate(var(--mx,-150px),var(--my,-150px));transition:transform .05s;pointer-events:none;}\n.fx-grid-item h4{position:relative;color:__TEXT__;margin-bottom:8px;}\n.fx-grid-item p{position:relative;opacity:.6;font-size:.9rem;}",
        "js": r"""document.querySelectorAll('.fx-grid-item').forEach(function(el){el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();el.style.setProperty('--mx',(e.clientX-r.left-150)+'px');el.style.setProperty('--my',(e.clientY-r.top-150)+'px');});});""",
    },

    "wave_svg_bg": {
        "name": "Ola SVG de Fondo",
        "category": "background_effects",
        "description": "Ola SVG animada en la parte inferior de la sección — SVG + CSS animation",
        "libs": [],
        "html": '<div class="fx-wave-section"><h2>__HEADLINE__</h2><p>__TAGLINE__</p><svg class="fx-wave" xmlns="http://www.w3.org/2000/svg" viewBox="0 24 150 28" preserveAspectRatio="none"><defs><path id="wave-path" d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"/></defs><g class="parallax"><use href="#wave-path" x="48" y="0" fill="__PRIMARY__22"/><use href="#wave-path" x="48" y="3" fill="__PRIMARY__16"/><use href="#wave-path" x="48" y="5" fill="__PRIMARY__10"/></g></svg></div>',
        "css": ".fx-wave-section{position:relative;padding:80px 40px 120px;text-align:center;overflow:hidden;}\n.fx-wave-section h2{font-family:__FONT__,sans-serif;font-size:2.5rem;color:__TEXT__;margin-bottom:16px;}\n.fx-wave-section p{color:rgba(255,255,255,.6);}\n.fx-wave{position:absolute;bottom:0;left:0;width:100%;height:80px;}\n.fx-wave .parallax>use{animation:wave-move 25s cubic-bezier(.55,.5,.45,.5) infinite;}\n.fx-wave .parallax>use:nth-child(1){animation-delay:-2s;animation-duration:7s;}\n.fx-wave .parallax>use:nth-child(2){animation-delay:-3s;animation-duration:10s;}\n.fx-wave .parallax>use:nth-child(3){animation-delay:-4s;animation-duration:13s;}\n@keyframes wave-move{from{transform:translate3d(-90px,0,0)}to{transform:translate3d(85px,0,0)}}",
        "js": "",
    },

    "stagger_entrance": {
        "name": "Aparición Escalonada",
        "category": "transition_effects",
        "description": "Elementos de una lista/grid que aparecen uno a uno al hacer scroll — JS + CSS",
        "libs": [],
        "html": '<ul class="fx-stagger"><li>__USP_1__</li><li>__USP_2__</li><li>__USP_3__</li><li>__CTA__</li></ul>',
        "css": ".fx-stagger li{opacity:0;transform:translateY(30px);transition:opacity .5s ease,transform .5s ease;font-family:__FONT__,sans-serif;color:__TEXT__;padding:10px 0;list-style:none;border-bottom:1px solid rgba(255,255,255,.08);}\n.fx-stagger li.vis{opacity:1;transform:none;}",
        "js": r"""var io=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.querySelectorAll('li').forEach(function(li,i){setTimeout(function(){li.classList.add('vis');},i*120);});}});},{threshold:0.2});document.querySelectorAll('.fx-stagger').forEach(function(el){io.observe(el);});""",
    },

    "gsap_text_split": {
        "name": "Split Text con GSAP",
        "category": "motion_graphics",
        "description": "Texto que entra carácter por carácter con GSAP — requiere GSAP CDN",
        "libs": ["https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"],
        "html": '<h1 class="fx-gsap-split">__HEADLINE__</h1>',
        "css": ".fx-gsap-split{font-family:__FONT__,sans-serif;font-size:clamp(2rem,6vw,5rem);font-weight:700;color:__TEXT__;overflow:hidden;}\n.fx-gsap-split .char{display:inline-block;}",
        "js": r"""(function waitGSAP(){if(!window.gsap){return setTimeout(waitGSAP,50);}var el=document.querySelector('.fx-gsap-split');if(!el)return;var text=el.textContent;el.innerHTML=text.split('').map(function(c){return c===' '?'<span class="char"> </span>':'<span class="char">'+c+'</span>';}).join('');gsap.from('.fx-gsap-split .char',{opacity:0,y:60,rotateX:-90,stagger:.03,duration:.8,ease:'back.out(1.7)',delay:.3});})();""",
    },

    "threejs_particle_sphere": {
        "name": "Esfera de Partículas Three.js",
        "category": "3d_effects",
        "description": "Esfera de partículas interactiva — Three.js r158 vía CDN",
        "libs": [],
        "html": '<canvas id="fx-threejs" style="display:block;"></canvas>',
        "css": "#fx-threejs{width:100%;height:100vh;background:__BG__;}",
        "js": r"""(function(){var script=document.createElement('script');script.type='importmap';script.textContent=JSON.stringify({"imports":{"three":"https://unpkg.com/three@0.158.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.158.0/examples/jsm/"}});document.head.appendChild(script);var m=document.createElement('script');m.type='module';m.textContent=`import * as THREE from 'three';const cv=document.getElementById('fx-threejs');const W=cv.clientWidth,H=cv.clientHeight;const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});renderer.setSize(W,H);renderer.setPixelRatio(Math.min(devicePixelRatio,2));const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(70,W/H,.1,100);camera.position.z=3;const geo=new THREE.BufferGeometry();const N=3000;const pos=new Float32Array(N*3);for(let i=0;i<N;i++){const phi=Math.acos(2*Math.random()-1);const theta=2*Math.PI*Math.random();pos[i*3]=Math.sin(phi)*Math.cos(theta);pos[i*3+1]=Math.sin(phi)*Math.sin(theta);pos[i*3+2]=Math.cos(phi);}geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const mat=new THREE.PointsMaterial({size:.012,color:'__PRIMARY__',transparent:true,opacity:.8});const pts=new THREE.Points(geo,mat);scene.add(pts);(function loop(){pts.rotation.y+=.003;pts.rotation.x+=.001;renderer.render(scene,camera);requestAnimationFrame(loop);})();`;document.head.appendChild(m);})();""",
    },

    "parallax_hero": {
        "name": "Hero Parallax",
        "category": "parallax_effects",
        "description": "Sección hero con parallax en el fondo al hacer scroll — JS puro, sin deps",
        "libs": [],
        "html": '<section class="fx-parallax-hero"><div class="fx-parallax-bg"></div><div class="fx-parallax-content"><h1>__HEADLINE__</h1><p>__TAGLINE__</p><a class="fx-cta" href="#">__CTA__</a></div></section>',
        "css": ".fx-parallax-hero{position:relative;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center;text-align:center;}\n.fx-parallax-bg{position:absolute;inset:-20%;background:linear-gradient(135deg,__BG__,__SURFACE__);will-change:transform;}\n.fx-parallax-content{position:relative;z-index:1;}\n.fx-parallax-content h1{font-family:__FONT__,sans-serif;font-size:clamp(2.5rem,7vw,5.5rem);font-weight:700;color:__TEXT__;margin-bottom:20px;}\n.fx-parallax-content p{color:rgba(255,255,255,.6);font-size:1.2rem;margin-bottom:36px;}\n.fx-cta{padding:16px 44px;background:__PRIMARY__;color:#fff;border-radius:100px;text-decoration:none;font-family:__FONT__,sans-serif;font-weight:600;font-size:1rem;}",
        "js": r"""window.addEventListener('scroll',function(){var bg=document.querySelector('.fx-parallax-bg');if(bg)bg.style.transform='translateY('+window.scrollY*.4+'px)';});""",
    },

    "overlay_hover_reveal": {
        "name": "Reveal de Imagen en Hover",
        "category": "overlay_effects",
        "description": "Imagen con overlay oscuro que se levanta al hacer hover — CSS puro",
        "libs": [],
        "html": '<div class="fx-img-reveal"><img src="https://picsum.photos/seed/__SECTOR__/600/400" alt="__NAME__"><div class="fx-img-overlay"><h3>__NAME__</h3><p>__TAGLINE__</p></div></div>',
        "css": ".fx-img-reveal{position:relative;overflow:hidden;border-radius:16px;cursor:pointer;}\n.fx-img-reveal img{width:100%;display:block;transition:transform .5s ease;}\n.fx-img-reveal:hover img{transform:scale(1.08);}\n.fx-img-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.9) 0%,transparent 60%);display:flex;flex-direction:column;justify-content:flex-end;padding:28px;transform:translateY(40px);opacity:0;transition:all .4s ease;}\n.fx-img-reveal:hover .fx-img-overlay{transform:translateY(0);opacity:1;}\n.fx-img-overlay h3{font-family:__FONT__,sans-serif;color:#fff;font-size:1.4rem;margin-bottom:8px;}\n.fx-img-overlay p{color:rgba(255,255,255,.7);font-size:.9rem;}",
        "js": "",
    },

    "progress_rings": {
        "name": "Anillos de Progreso SVG",
        "category": "charts",
        "description": "Anillos circulares de progreso animados — SVG + CSS, sin deps",
        "libs": [],
        "html": '<div class="fx-rings"><svg viewBox="0 0 120 120" class="fx-ring"><circle class="fx-ring-track" cx="60" cy="60" r="50"/><circle class="fx-ring-fill" cx="60" cy="60" r="50" data-pct="75"/></svg><div class="fx-ring-label">75%</div></div>',
        "css": ".fx-rings{display:inline-flex;flex-direction:column;align-items:center;}\n.fx-ring{width:140px;height:140px;transform:rotate(-90deg);}\n.fx-ring-track{fill:none;stroke:rgba(255,255,255,.08);stroke-width:8;}\n.fx-ring-fill{fill:none;stroke:__PRIMARY__;stroke-width:8;stroke-linecap:round;stroke-dasharray:314;stroke-dashoffset:314;transition:stroke-dashoffset 1.5s cubic-bezier(.215,.61,.355,1);}\n.fx-ring-fill.vis{stroke-dashoffset:calc(314 - (314 * var(--pct) / 100));}\n.fx-ring-label{font-family:__FONT__,sans-serif;font-size:1.5rem;font-weight:700;color:__TEXT__;margin-top:12px;}",
        "js": r"""var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){e.target.querySelectorAll('.fx-ring-fill').forEach(function(ring){var pct=ring.dataset.pct||50;ring.style.setProperty('--pct',pct);ring.classList.add('vis');});}});},{threshold:.4});document.querySelectorAll('.fx-rings').forEach(function(el){io.observe(el);});""",
    },
}

# ─── Visme category descriptions ──────────────────────────────────────────────
VISME_CATEGORIES: Dict[str, str] = {
    "3d_effects": "Efectos tridimensionales CSS y Three.js",
    "animated_characters": "Personajes y avatares animados",
    "animated_icons": "Iconos SVG/Lottie animados",
    "audio_visualization": "Visualizadores de audio y frecuencias",
    "background_effects": "Fondos animados: aurora, partículas, gradientes",
    "banners": "Banners publicitarios y de redes sociales",
    "brochures": "Folletos y dípticos digitales",
    "case_studies": "Estudios de caso y portfolios",
    "celebration_effects": "Confeti, fuegos artificiales, festividades",
    "certificates": "Certificados y diplomas",
    "charts": "Gráficos interactivos y visualización de datos",
    "checklists": "Listas de tareas y comprobación",
    "collages": "Collages y composición de imágenes",
    "cover_pages": "Portadas de documentos y libros",
    "data_viz": "Visualización de datos avanzada",
    "diagrams": "Diagramas y esquemas técnicos",
    "documents": "Documentos profesionales formateados",
    "ebooks": "Ebooks y publicaciones digitales",
    "fact_sheets": "Fichas informativas y one-pagers",
    "flowcharts": "Diagramas de flujo y procesos",
    "flyers": "Flyers y carteles digitales",
    "forms_surveys": "Formularios, encuestas y quizzes",
    "infographics": "Infografías y visuales estadísticos",
    "interactive_effects": "Efectos interactivos con mouse/touch",
    "invoices": "Facturas y documentos comerciales",
    "itineraries": "Itinerarios y planes de viaje",
    "labels": "Etiquetas y packaging",
    "landing_pages": "Landing pages completas",
    "letterheads": "Membrete y papelería corporativa",
    "logo_animations": "Animaciones de logotipo SVG",
    "logos": "Logotipos e identidad visual",
    "menus": "Menús digitales y cartas",
    "micro_interactions": "Micro-interacciones y feedback visual",
    "mind_maps": "Mapas mentales y esquemas",
    "mockups": "Mockups de dispositivos y productos",
    "mood_boards": "Tableros de inspiración y moodboards",
    "motion_graphics": "Motion graphics y animaciones complejas",
    "newsletters": "Newsletters y emails de marketing",
    "one_pagers": "One-pagers y resúmenes ejecutivos",
    "org_charts": "Organigramas y estructuras",
    "overlay_effects": "Overlays y capas sobre imágenes",
    "parallax_effects": "Efectos parallax en scroll",
    "particle_effects": "Sistemas de partículas animadas",
    "pitch_decks": "Presentaciones para inversores",
    "plans": "Planes de proyecto y roadmaps",
    "posters": "Posters y arte digital",
    "presentations": "Presentaciones completas",
    "press_kits": "Kits de prensa y media kits",
    "price_lists": "Listas de precios y tarifarios",
    "printables": "Materiales imprimibles",
    "proposals": "Propuestas comerciales",
    "quiz_interactive": "Quizzes interactivos con scoring",
    "receipts": "Recibos y comprobantes",
    "recipe_cards": "Tarjetas de recetas",
    "reports": "Informes y reportes ejecutivos",
    "resumes": "CVs y portfolios personales",
    "schedules": "Calendarios y cronogramas",
    "social_ads": "Anuncios para redes sociales",
    "social_media": "Contenido para redes sociales",
    "storyboards": "Guiones gráficos y storyboards",
    "text_effects": "Efectos de texto y tipografía",
    "tier_lists": "Listas de niveles y rankings",
    "timelines": "Líneas de tiempo y cronologías",
    "training_manuals": "Manuales de formación",
    "transition_effects": "Transiciones entre secciones y páginas",
    "typography_effects": "Efectos tipográficos avanzados",
    "ui_components": "Componentes de interfaz de usuario",
    "video_effects": "Efectos para vídeo y multimedia",
    "videos": "Plantillas de vídeo y animación",
    "visme_animation_combos": "Combinaciones de animaciones múltiples",
    "web_graphics": "Gráficos web y SVG interactivos",
    "whiteboards": "Pizarras digitales colaborativas",
    "whitepapers": "Documentos técnicos y white papers",
    "worksheets": "Hojas de trabajo y plantillas educativas",
}

# ─── Catalog lazy-load ────────────────────────────────────────────────────────
_catalogs: Dict[str, Any] = {}

def _load_catalog(name: str, path: Path) -> Any:
    global _catalogs
    if name in _catalogs:
        return _catalogs[name]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        _catalogs[name] = data
        return data
    except Exception as e:
        log.warning("Could not load catalog %s: %s", name, e)
        return {}

def _get_visme() -> List[Dict]:
    d = _load_catalog("visme", _DATA / "visme_templates.json")
    return d.get("templates", []) if isinstance(d, dict) else []

def _get_effects_prompts() -> List[Dict]:
    d = _load_catalog("effects_prompts", _DATA / "effects_prompts.json")
    return d.get("templates", []) if isinstance(d, dict) else []

def _get_stitch() -> List[Dict]:
    d = _load_catalog("stitch", _DATA / "stitch_effects_library.json")
    return d.get("effects", []) if isinstance(d, dict) else []

def _get_typegpu() -> List[Dict]:
    d = _load_catalog("typegpu", _DATA / "typegpu_effects_library.json")
    return d.get("effects", []) if isinstance(d, dict) else []

def _get_aceternity() -> Dict:
    p1 = _ADATA / "effects-catalog.json"
    p2 = _HERE / "effects-catalog.json"
    p = p1 if p1.exists() else p2
    return _load_catalog("aceternity", p) if p.exists() else {}

# ─── DNA helpers ──────────────────────────────────────────────────────────────
def _apply_dna(code: str, dna: dict) -> str:
    d = {**_DEFAULT_DNA, **dna}
    replacements = {
        "__PRIMARY__":   d.get("primary_color", "#6366f1"),
        "__SECONDARY__": d.get("secondary_color", "#ec4899"),
        "__ACCENT__":    d.get("accent_color", "#c9a961"),
        "__BG__":        d.get("bg_color", "#0d0d1a"),
        "__TEXT__":      d.get("text_color", "#f1f5f9"),
        "__SURFACE__":   d.get("surface_color", "#1a1a2e"),
        "__FONT__":      d.get("font", "Inter"),
        "__NAME__":      d.get("name", "Brand"),
        "__SECTOR__":    d.get("sector", "Agency"),
        "__HEADLINE__":  d.get("headline", "Construye algo extraordinario"),
        "__TAGLINE__":   d.get("tagline", "La agencia que convierte ideas en experiencias"),
        "__CTA__":       d.get("cta", "Empezar ahora"),
        "__ICON__":      d.get("icon", "✦"),
        "__USP_1__":     d.get("usp_1", "Calidad premium"),
        "__USP_2__":     d.get("usp_2", "Entrega rápida"),
        "__USP_3__":     d.get("usp_3", "Soporte 24/7"),
    }
    for k, v in replacements.items():
        code = code.replace(k, str(v))
    return code

def _font_link(font: str) -> str:
    safe = font.replace(" ", "+")
    return f'<link href="https://fonts.googleapis.com/css2?family={safe}:wght@300;400;500;600;700&display=swap" rel="stylesheet">'

def _build_snippet_html(snippet_id: str, dna: dict) -> str:
    d = {**_DEFAULT_DNA, **dna}
    snip = EFFECT_LIBRARY.get(snippet_id)
    if not snip:
        raise ValueError(f"Snippet '{snippet_id}' not found in EFFECT_LIBRARY")
    lib_tags = "\n".join(f'<script src="{l}"></script>' for l in snip.get("libs", []))
    raw_css = _apply_dna(snip.get("css", ""), d)
    raw_js  = _apply_dna(snip.get("js", ""), d)
    raw_html = _apply_dna(snip.get("html", ""), d)
    page = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{d['name']} — {snip['name']}</title>
{_font_link(d['font'])}
{lib_tags}
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:'{d['font']}',sans-serif;background:{d['bg_color']};color:{d['text_color']};min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:40px;padding:60px 40px;}}
{raw_css}
</style>
</head>
<body>
{raw_html}
<script>
{raw_js}
</script>
</body>
</html>"""
    return page

# ─── Unified search ───────────────────────────────────────────────────────────
def search_all(query: str = "", category: str = "", source: str = "", limit: int = 30) -> List[Dict]:
    q = query.lower().strip()
    cat = category.lower().strip()
    results: List[Dict] = []

    # Pre-built snippets
    if not source or source in ("builtin", "all"):
        for sid, snip in EFFECT_LIBRARY.items():
            if cat and cat not in snip.get("category", ""):
                continue
            searchable = (snip.get("name", "") + " " + snip.get("description", "") + " " + snip.get("category", "")).lower()
            if not q or q in searchable:
                results.append({"id": sid, "source": "builtin", "name": snip["name"],
                                 "category": snip.get("category"), "description": snip.get("description"),
                                 "libs": snip.get("libs", []), "type": "snippet"})

    # Visme
    if not source or source in ("visme", "all"):
        for t in _get_visme():
            if cat and cat not in t.get("category", ""):
                continue
            searchable = (t.get("name", "") + " " + t.get("description", "") + " " + t.get("category", "") + " " + " ".join(t.get("tags", []))).lower()
            if not q or q in searchable:
                results.append({"id": t.get("id"), "source": "visme", "name": t.get("name"),
                                 "category": t.get("category"), "description": t.get("description"),
                                 "icon": t.get("icon", "🎨"), "tags": t.get("tags", []),
                                 "prompt": t.get("prompt", ""), "type": "template"})

    # Effects prompts
    if not source or source in ("effects_prompts", "all"):
        for t in _get_effects_prompts():
            if cat and cat not in t.get("category", ""):
                continue
            searchable = (t.get("name", "") + " " + t.get("description", "") + " " + " ".join(t.get("tags", []))).lower()
            if not q or q in searchable:
                results.append({"id": t.get("id"), "source": "effects_prompts", "name": t.get("name"),
                                 "category": t.get("category"), "description": t.get("description"),
                                 "tags": t.get("tags", []), "type": "template"})

    # Stitch
    if not source or source in ("stitch", "all"):
        for t in _get_stitch():
            if cat and cat not in str(t.get("category", "")):
                continue
            searchable = (str(t.get("name", "")) + " " + str(t.get("description", "")) + " " + str(t.get("category", ""))).lower()
            if not q or q in searchable:
                results.append({"id": t.get("id"), "source": "stitch", "name": t.get("name"),
                                 "category": t.get("category"), "description": t.get("description"), "type": "template"})

    return results[:limit]

def get_catalog_totals() -> Dict:
    return {
        "builtin_snippets": len(EFFECT_LIBRARY),
        "visme_templates": len(_get_visme()),
        "effects_prompts": len(_get_effects_prompts()),
        "stitch_effects": len(_get_stitch()),
        "typegpu_effects": len(_get_typegpu()),
        "visme_categories": len(VISME_CATEGORIES),
    }

# ─── Claude generation ────────────────────────────────────────────────────────
def _build_generation_system_prompt() -> str:
    snippet_ref = "\n".join(
        f"- {sid}: {s['name']} ({s['category']}) — {s['description'][:80]}"
        for sid, s in EFFECT_LIBRARY.items()
    )
    category_ref = "\n".join(
        f"- {cat}: {desc}" for cat, desc in list(VISME_CATEGORIES.items())[:20]
    )
    return f"""Eres Crafter Effects Engine — generador experto de efectos visuales web REALES y EJECUTABLES.

BIBLIOTECA PRE-CONSTRUIDA (30 snippets reales):
{snippet_ref}

CATEGORÍAS VISME DISPONIBLES (65 total):
{category_ref}
... (y 45 categorías más: background_effects, transition_effects, particle_effects, motion_graphics, etc.)

REGLAS OBLIGATORIAS:
1. Genera SOLO HTML completo y autocontenido — todo inline (CSS en <style>, JS en <script>)
2. TODO el código debe ejecutarse en <iframe sandbox="allow-scripts allow-same-origin">
3. Usa CDN cuando sea necesario: Three.js (https://unpkg.com/three@0.158.0/build/three.module.js), GSAP (https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js), Lottie, etc.
4. Aplica SIEMPRE el DNA del cliente: colores, fuente, nombre, sector, CTA
5. NUNCA uses placeholder como [INSERT X] o TODO — todo debe ser contenido real
6. NUNCA truncues la respuesta — el HTML debe estar completo
7. Usa requestAnimationFrame para animaciones (no setInterval para animaciones)
8. Usa will-change: transform para elementos animados
9. Todos los efectos deben ser visualmente impactantes y listos para producción
10. Responde ÚNICAMENTE con el HTML completo — sin explicaciones ni markdown"""


async def _claude_generate(prompt: str, system: str, dna: dict) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada")
    import httpx
    d = {**_DEFAULT_DNA, **dna}
    user_msg = (
        f"CLIENTE DNA:\n"
        f"- Nombre: {d['name']}\n"
        f"- Sector: {d['sector']}\n"
        f"- Color primario: {d['primary_color']}\n"
        f"- Color secundario: {d['secondary_color']}\n"
        f"- Fuente: {d['font']}\n"
        f"- Fondo: {d['bg_color']}\n"
        f"- Headline: {d['headline']}\n"
        f"- Tagline: {d['tagline']}\n"
        f"- CTA: {d['cta']}\n\n"
        f"EFECTO A GENERAR:\n{prompt}"
    )
    async with httpx.AsyncClient(timeout=120) as c:
        rsp = await c.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": api_key, "anthropic-version": "2023-06-01",
                     "Content-Type": "application/json"},
            json={"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
                  "max_tokens": 8192, "system": system,
                  "messages": [{"role": "user", "content": user_msg}]},
        )
    if rsp.status_code != 200:
        raise HTTPException(502, f"Claude API error: {rsp.text[:300]}")
    data = rsp.json()
    text = data["content"][0]["text"].strip()
    # Extract HTML if Claude wraps it in markdown
    m = re.search(r"```html\s*([\s\S]*?)```", text, re.IGNORECASE)
    if m:
        text = m.group(1).strip()
    return text

# ─── FastAPI router ───────────────────────────────────────────────────────────
def register_visme_engine(app: FastAPI) -> dict:
    r = APIRouter(prefix="/api/visme", tags=["visme-effects"])

    @r.get("/categories")
    async def list_categories():
        counts: Dict[str, int] = {}
        for t in _get_visme():
            c = t.get("category", "other")
            counts[c] = counts.get(c, 0) + 1
        return {
            "categories": [
                {"id": cid, "name": cid.replace("_", " ").title(),
                 "description": VISME_CATEGORIES.get(cid, ""),
                 "count": counts.get(cid, 0)}
                for cid in VISME_CATEGORIES
            ],
            "builtin_categories": list({s["category"] for s in EFFECT_LIBRARY.values()}),
            "totals": get_catalog_totals(),
        }

    @r.get("/snippets")
    async def list_snippets():
        return {
            "snippets": [
                {"id": sid, "name": s["name"], "category": s["category"],
                 "description": s["description"], "libs": s.get("libs", [])}
                for sid, s in EFFECT_LIBRARY.items()
            ],
            "count": len(EFFECT_LIBRARY),
        }

    @r.get("/templates")
    async def browse_templates(
        q: str = QParam(""),
        category: str = QParam(""),
        source: str = QParam("all"),
        limit: int = QParam(40),
        offset: int = QParam(0),
    ):
        results = search_all(q, category, source, limit=1000)
        return {
            "results": results[offset:offset + limit],
            "count": len(results),
            "total": limit,
            "offset": offset,
            "sources_available": ["builtin", "visme", "effects_prompts", "stitch", "all"],
        }

    @r.get("/template/{tid}")
    async def get_template(tid: str):
        # Check pre-built snippets first
        if tid in EFFECT_LIBRARY:
            s = EFFECT_LIBRARY[tid]
            return {"id": tid, "source": "builtin", **s}
        # Search Visme
        for t in _get_visme():
            if t.get("id") == tid:
                return {"source": "visme", **t}
        # Search effects prompts
        for t in _get_effects_prompts():
            if t.get("id") == tid:
                return {"source": "effects_prompts", **t}
        raise HTTPException(404, f"Template '{tid}' not found")

    @r.post("/preview-snippet")
    async def preview_snippet(body: dict):
        sid = body.get("snippet_id", "")
        dna = body.get("dna", {})
        if sid not in EFFECT_LIBRARY:
            raise HTTPException(404, f"Snippet '{sid}' not found")
        html = _build_snippet_html(sid, dna)
        return {"ok": True, "html": html, "snippet": sid}

    @r.post("/generate")
    async def generate_effect(body: dict):
        """
        Generate a full HTML page for any template or snippet.
        - template_id: pre-built snippet → instant (no API call)
        - template_id: visme/effects_prompt → Claude generation
        - custom_prompt: freeform effect request → Claude generation
        """
        tid = body.get("template_id", "")
        dna = body.get("dna", {})
        custom_prompt = body.get("custom_prompt", "")

        # Pre-built snippet — instant, no API call
        if tid in EFFECT_LIBRARY:
            html = _build_snippet_html(tid, dna)
            return {"ok": True, "html": html, "source": "builtin", "template_id": tid,
                    "api_call": False}

        # Find template prompt
        prompt = custom_prompt
        source = "custom"
        if not prompt and tid:
            for t in _get_visme() + _get_effects_prompts():
                if t.get("id") == tid:
                    prompt = t.get("prompt", "")
                    source = "visme" if t.get("id", "").startswith("visme_") else "effects_prompts"
                    break

        if not prompt:
            raise HTTPException(400, "template_id o custom_prompt requerido")

        system = _build_generation_system_prompt()
        html = await _claude_generate(prompt, system, dna)
        return {"ok": True, "html": html, "source": source, "template_id": tid, "api_call": True}

    @r.post("/compose")
    async def compose_page(body: dict):
        """
        Compose a complete page combining multiple effects/templates.
        effect_ids: list of snippet IDs and/or template IDs
        """
        effect_ids: List[str] = body.get("effect_ids", [])
        dna = body.get("dna", {})
        page_type = body.get("page_type", "landing")
        additional_instructions = body.get("instructions", "")

        if not effect_ids:
            raise HTTPException(400, "effect_ids requerido (mínimo 1)")

        # Collect descriptions for Claude
        effects_desc = []
        for eid in effect_ids[:10]:
            if eid in EFFECT_LIBRARY:
                s = EFFECT_LIBRARY[eid]
                effects_desc.append(f"- {s['name']}: {s['description']}")
            else:
                for t in _get_visme() + _get_effects_prompts():
                    if t.get("id") == eid:
                        effects_desc.append(f"- {t.get('name','')}: {t.get('description','')}")
                        break

        compose_prompt = (
            f"Crea una página web completa tipo '{page_type}' que combine TODOS estos efectos en una sola experiencia cohesionada:\n"
            + "\n".join(effects_desc)
            + "\n\nLos efectos deben integrarse naturalmente en el flujo de la página, no como secciones aisladas."
        )
        if additional_instructions:
            compose_prompt += f"\n\nInstrucciones adicionales: {additional_instructions}"

        system = _build_generation_system_prompt()
        html = await _claude_generate(compose_prompt, system, dna)
        return {"ok": True, "html": html, "effects_composed": effect_ids, "page_type": page_type}

    @r.post("/inject")
    async def inject_effects(body: dict):
        """
        Inject selected effects into an existing HTML page.
        existing_html: the base HTML
        effect_ids: effects to inject
        """
        existing_html: str = body.get("existing_html", "")
        effect_ids: List[str] = body.get("effect_ids", [])
        dna = body.get("dna", {})

        if not existing_html:
            raise HTTPException(400, "existing_html requerido")

        effects_desc = []
        for eid in effect_ids[:5]:
            if eid in EFFECT_LIBRARY:
                s = EFFECT_LIBRARY[eid]
                effects_desc.append(f"- {s['name']}: {s['description']}\n  CSS: {s.get('css','')[:200]}\n  JS: {s.get('js','')[:300]}")

        inject_prompt = (
            f"Toma el siguiente HTML existente e INYECTA estos efectos visuales de forma integrada:\n"
            + "\n".join(effects_desc)
            + f"\n\nHTML EXISTENTE:\n```html\n{existing_html[:6000]}\n```\n\n"
            f"Devuelve el HTML completo con los efectos incorporados."
        )
        system = _build_generation_system_prompt()
        html = await _claude_generate(inject_prompt, system, dna)
        return {"ok": True, "html": html}

    @r.get("/stats")
    async def stats():
        return {"ok": True, **get_catalog_totals()}

    app.include_router(r)

    @app.get("/effects-studio")
    async def serve_effects_studio():
        from fastapi.responses import FileResponse, HTMLResponse
        import pathlib
        p = pathlib.Path(__file__).parent.parent / "admin" / "effects-studio.html"
        if p.exists():
            return FileResponse(str(p), media_type="text/html")
        return HTMLResponse("<h1>effects-studio.html not found</h1>", 404)

    totals = get_catalog_totals()
    log.info("Visme Effects Engine: %d snippets + %d Visme + %d effects_prompts ready",
             totals["builtin_snippets"], totals["visme_templates"], totals["effects_prompts"])
    return totals
