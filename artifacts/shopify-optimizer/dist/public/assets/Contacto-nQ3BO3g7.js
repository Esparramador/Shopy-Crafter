import{r as i,j as e}from"./vendor-react-7UxssXty.js";import{P as ee,m as te}from"./SiteLinks-Cj3fexfN.js";import{P as ae}from"./PublicLayout-DW_I9I_O.js";import{s as ce}from"./contact-request-BEDu4WoI.js";import"./vendor-router-hNuEoVCG.js";import"./vendor-misc-CGJCdZM4.js";const D="/".replace(/\/$/,"")??"",ie=`${D}/assets/videos/alec_landing.mp4`,re=`${D}/assets/videos/alec_poster.jpg`,N="rgba(200,168,75,1)",R="rgba(200,168,75,0.10)",b="rgba(200,168,75,0.22)",ne=[{icon:"✉️",label:"Email directo",value:"craftershopy@gmail.com",href:"mailto:craftershopy@gmail.com",accent:N,bg:"linear-gradient(135deg,rgba(200,168,75,.14),rgba(200,168,75,.04))",border:b},{icon:"⚡",label:"Tiempo de respuesta",value:"Te respondemos con una propuesta por escrito",href:null,accent:"#2dd49f",bg:"linear-gradient(135deg,rgba(45,212,159,.14),rgba(45,212,159,.04))",border:"rgba(45,212,159,.22)"},{icon:"🌍",label:"Ubicación",value:"España · Remoto",href:null,accent:"#60a5fa",bg:"linear-gradient(135deg,rgba(96,165,250,.14),rgba(96,165,250,.04))",border:"rgba(96,165,250,.22)"}],oe=[{icon:"🔍",text:"Escaneando tu perfil…"},{icon:"🧠",text:"Activando motores IA…"},{icon:"✨",text:"Preparando formulario…"}],se=["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"],le=["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"],de=["Auditoría completa","Generación de imágenes IA","SEO y schemas","A/B Testing","Pricing y COGS","Rediseño web","Programa de afiliados","Plan personalizado","Asistente virtual para WhatsApp y teléfono","Chatbot para landing o web","Agente de IA a medida con skills","App personalizada para el agente","Perfil de Empresa de Google","Campañas de Google Ads"],A={name:"",email:"",phone:"",storeUrl:"",niche:"",customNiche:"",revenue:"",socialMedia:"",message:""},f=[{field:"name",value:"María García Sánchez",speed:45},{field:"email",value:"maria@modabarcelona.com",speed:38},{field:"storeUrl",value:"modabarcelona.myshopify.com",speed:38},{field:"__niche",value:"Moda y ropa",speed:0},{field:"__revenue",value:"€5.000 – €15.000",speed:0},{field:"socialMedia",value:"@modabarcelona_shop",speed:42},{field:"message",value:"Quiero optimizar mis fichas de producto con IA y duplicar la conversión este trimestre. Tenemos 180 referencias activas.",speed:28}],pe=`
/* ─── ROOT ─── */
.ctc-root {
  position: relative;
  width: 100%;
  background: #05030c;
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ─── VIDEO / OVERLAY — FIXED ─── */
.ctc-video {
  position: fixed;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; object-position: left center;
  z-index: 0;
  pointer-events: none;
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  will-change: transform;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}
.ctc-overlay {
  position: fixed; inset: 0; z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(90deg,
      rgba(5,3,12,.06) 0%,
      rgba(5,3,12,.06) 36%,
      rgba(5,3,12,.65) 54%,
      rgba(5,3,12,.97) 70%,
      rgba(5,3,12,.99) 100%
    ),
    linear-gradient(180deg,
      rgba(5,3,12,.52) 0%,
      transparent 14%,
      transparent 76%,
      rgba(5,3,12,.6) 100%
    );
}

/* ─── MAIN LAYOUT ─── */
.ctc-layout {
  position: relative;
  z-index: 5;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
}

/* ─── LEFT AREA ─── */
.ctc-left {
  flex: 1;
  display: flex;
  align-items: flex-end;
  padding: 0 16px 48px;
}

/* ─── INFO CARDS ─── */
.ctc-cards-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: stretch;
}
.ctc-card {
  flex: 1 1 130px; max-width: 190px;
  padding: 20px 14px 18px;
  border-radius: 18px; border: 1px solid;
  text-align: center; backdrop-filter: blur(16px);
  opacity: 0; transform: translateY(32px) scale(.95);
  transition: opacity 0.6s cubic-bezier(.22,1,.36,1), transform 0.6s cubic-bezier(.22,1,.36,1);
}
.ctc-card:first-child { flex-basis: 220px; max-width: 220px; }
.ctc-card-in { opacity: 1; transform: translateY(0) scale(1); }
.ctc-card:nth-child(1) { transition-delay: 0ms; }
.ctc-card:nth-child(2) { transition-delay: 90ms; }
.ctc-card:nth-child(3) { transition-delay: 180ms; }
.ctc-card-icon { display: block; font-size: 24px; margin-bottom: 10px; }
.ctc-card-label {
  display: block; font-size: 9px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 7px;
}
.ctc-card-value {
  display: block; font-size: 12px; font-weight: 700; color: #ccc;
  text-decoration: none; overflow-wrap: anywhere; word-break: normal; line-height: 1.45;
}
.ctc-card-value:hover { text-decoration: underline; }

/* ─── RIGHT FORM PANEL ─── */
/* Sin overflow-y:auto — la página scroll entera (el vídeo es position:fixed,
   no afecta al layout). Así el footer es alcanzable sin bounce ni trampa. */
.ctc-panel {
  width: min(44%, 520px);
  min-height: 0;
  padding: 56px 36px 56px 24px;
  display: flex; flex-direction: column; justify-content: center;
}

/* ─── BUILD ANIMATION ─── */
.ctc-building {
  display: flex; flex-direction: column; align-items: center;
  padding: 52px 24px; gap: 4px;
}
.ctc-build-orb {
  width: 72px; height: 72px; border-radius: 50%;
  background: radial-gradient(circle, rgba(200,168,75,.28) 0%, transparent 70%);
  border: 2px solid rgba(200,168,75,.45);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; margin-bottom: 28px;
  animation: ctcOrb 2.2s ease-in-out infinite;
}
@keyframes ctcOrb {
  0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(200,168,75,0); }
  50% { transform: scale(1.07); box-shadow: 0 0 0 12px rgba(200,168,75,.06), 0 0 40px rgba(200,168,75,.18); }
}
.ctc-build-rail {
  width: 100%; height: 3px; background: rgba(200,168,75,.08);
  border-radius: 99px; overflow: hidden; position: relative; margin-bottom: 28px;
}
.ctc-build-beam {
  position: absolute; top: 0; left: -55%; width: 55%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(200,168,75,.9), rgba(45,212,159,.5), transparent);
  animation: ctcBeam 1.3s ease-in-out infinite;
}
@keyframes ctcBeam { to { left: 105%; } }
.ctc-build-step {
  width: 100%; display: flex; align-items: center; gap: 14px;
  padding: 13px 6px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  opacity: 0; transform: translateX(-18px);
  transition: opacity .55s cubic-bezier(.22,1,.36,1), transform .55s cubic-bezier(.22,1,.36,1);
}
.ctc-build-step.ctc-step-on { opacity: 1; transform: translateX(0); }
.ctc-step-dot {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: rgba(200,168,75,.08); border: 1.5px solid rgba(200,168,75,.22);
  display: flex; align-items: center; justify-content: center; font-size: 14px;
  transition: all .4s cubic-bezier(.34,1.56,.64,1) .25s;
}
.ctc-build-step.ctc-step-on .ctc-step-dot {
  background: rgba(45,212,159,.12); border-color: rgba(45,212,159,.4);
}
.ctc-step-text {
  flex: 1; font-size: 13.5px; color: rgba(255,255,255,.55); font-weight: 500;
  transition: color .4s .15s;
}
.ctc-build-step.ctc-step-on .ctc-step-text { color: rgba(255,255,255,.82); }
.ctc-step-check {
  font-size: 16px; opacity: 0; transform: scale(0);
  transition: all .4s cubic-bezier(.34,1.56,.64,1) .35s;
}
.ctc-build-step.ctc-step-on .ctc-step-check { opacity: 1; transform: scale(1); }
.ctc-build-ready {
  margin-top: 20px; font-size: 11px; font-weight: 800; letter-spacing: 2px;
  color: rgba(200,168,75,.5); text-transform: uppercase;
  opacity: 0; transform: scale(.9);
  transition: all .5s cubic-bezier(.22,1,.36,1);
}
.ctc-build-ready.ctc-ready-on { opacity: 1; transform: scale(1); color: rgba(200,168,75,.9); }

/* ─── FORM FIELDS ─── */
.ctc-form-wrap { display: flex; flex-direction: column; gap: 18px; }
.ctc-field { opacity: 0; transform: translateY(16px); }
.ctc-form-ready .ctc-field { animation: ctcFieldIn 0.52s cubic-bezier(.22,1,.36,1) forwards; }
.ctc-form-ready .ctc-field:nth-child(1) { animation-delay: 0ms; }
.ctc-form-ready .ctc-field:nth-child(2) { animation-delay: 60ms; }
.ctc-form-ready .ctc-field:nth-child(3) { animation-delay: 120ms; }
.ctc-form-ready .ctc-field:nth-child(4) { animation-delay: 180ms; }
.ctc-form-ready .ctc-field:nth-child(5) { animation-delay: 240ms; }
.ctc-form-ready .ctc-field:nth-child(6) { animation-delay: 300ms; }
.ctc-form-ready .ctc-field:nth-child(7) { animation-delay: 360ms; }
.ctc-form-ready .ctc-field:nth-child(8) { animation-delay: 420ms; }
.ctc-form-ready .ctc-field:nth-child(n+9) { animation-delay: 480ms; }
@keyframes ctcFieldIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ctc-input {
  width: 100%; padding: 12px 15px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(200,168,75,0.17);
  border-radius: 10px; color: #eee; font-size: 13.5px;
  outline: none; box-sizing: border-box;
  transition: border-color .2s, box-shadow .2s;
  font-family: inherit;
}
.ctc-input:focus {
  border-color: rgba(200,168,75,.45);
  box-shadow: 0 0 0 3px rgba(200,168,75,.07);
}
/* Demo typing highlight */
.ctc-input.ctc-typing {
  border-color: rgba(45,212,159,.5);
  box-shadow: 0 0 0 3px rgba(45,212,159,.07);
  color: #adf7e0;
}
.ctc-label {
  display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .7px;
  color: rgba(200,168,75,.82); text-transform: uppercase; margin-bottom: 7px;
}
.ctc-row { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(190px,100%),1fr)); gap: 14px; }
.ctc-service-btn {
  padding: 8px 14px; border-radius: 99px; font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all .15s; font-family: inherit;
}

/* ─── DEMO BADGE ─── */
.ctc-demo-badge {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 5px 12px; border-radius: 99px;
  background: rgba(45,212,159,.10); border: 1px solid rgba(45,212,159,.25);
  color: #2dd49f; font-size: 10px; font-weight: 800; letter-spacing: .8px;
  text-transform: uppercase; margin-bottom: 14px;
}
.ctc-demo-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #2dd49f;
  animation: ctcPulse 1s ease-in-out infinite;
}
@keyframes ctcPulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: .4; transform: scale(.75); }
}
.ctc-demo-cta {
  margin-top: 6px; text-align: center; font-size: 12px; color: rgba(200,168,75,.7);
  animation: ctcFieldIn .4s ease forwards;
  cursor: pointer; text-decoration: underline dotted;
}
.ctc-demo-cta:hover { color: rgba(200,168,75,1); }

/* ─── TABLET / MOBILE ─── */
@media (max-width: 900px) {
  .ctc-layout { flex-direction: column; }
  /* En vertical: primero el formulario, luego las info cards debajo */
  .ctc-panel {
    order: -1;
    width: 100%; min-height: auto;
    padding: 72px 20px 32px; justify-content: flex-start; overflow-y: visible;
  }
  .ctc-left { order: 1; align-items: center; justify-content: center; padding: 8px 16px 48px; }
  .ctc-card { flex: 1 1 120px; max-width: 160px; padding: 16px 10px 14px; }
  .ctc-card:first-child { flex-basis: 220px; max-width: 240px; }
  .ctc-card-icon { font-size: 20px; margin-bottom: 6px; }
  .ctc-card-label { font-size: 8px; }
  .ctc-card-value { font-size: 11px; }
  .ctc-build-orb { width: 60px; height: 60px; font-size: 22px; margin-bottom: 22px; }
  .ctc-overlay {
    background:
      linear-gradient(180deg,
        rgba(5,3,12,.65) 0%, rgba(5,3,12,.82) 35%,
        rgba(5,3,12,.97) 55%, rgba(5,3,12,.99) 100%
      );
  }
}
@media (max-height: 560px) and (orientation: landscape) {
  .ctc-layout { flex-direction: row; }
  .ctc-panel { width: 55%; padding: 12px 20px 12px 16px; justify-content: flex-start; overflow-y: auto; }
  .ctc-left { width: 45%; padding: 0 12px 24px; align-items: flex-end; }
  .ctc-building { padding: 16px 16px; }
  .ctc-build-orb { width: 48px; height: 48px; font-size: 18px; margin-bottom: 14px; }
  .ctc-card { padding: 12px 8px 10px; }
  .ctc-card-icon { font-size: 16px; margin-bottom: 4px; }
  /* ── Landscape: vídeo y overlay empiezan BAJO el nav (≈56px)
       para que la cabeza de Alec no quede tapada por la barra de nav ── */
  .ctc-video {
    top: 56px;
    height: calc(100dvh - 56px);
    object-position: left top;
  }
  .ctc-overlay {
    top: 56px;
    height: calc(100dvh - 56px);
    background:
      linear-gradient(90deg,
        transparent 0%,
        transparent 32%,
        rgba(5,3,12,.50) 50%,
        rgba(5,3,12,.94) 67%,
        rgba(5,3,12,.99) 100%
      ),
      linear-gradient(180deg,
        transparent 0%,
        transparent 68%,
        rgba(5,3,12,.55) 100%
      );
  }
}
@media (max-width: 480px) {
  .ctc-panel { padding: 56px 14px 24px; }
  .ctc-card { flex: 1 1 100%; max-width: none; }
  .ctc-card:first-child { flex-basis: 100%; max-width: none; }
  .ctc-cards-row { flex-direction: column; gap: 8px; }
  .ctc-card { padding: 14px 16px; text-align: left; flex-direction: row; align-items: center; gap: 12px; }
  .ctc-card-icon { font-size: 22px; flex-shrink: 0; margin-bottom: 0; }
}
`;function he(){const[s,C]=i.useState({...A}),[h,H]=i.useState([]),[m,S]=i.useState("idle"),[Y,I]=i.useState("");i.useEffect(()=>{const t=new URLSearchParams(window.location.search).get("asunto")?.trim().slice(0,120);t&&C(c=>c.message?c:{...c,message:`Me interesa: ${t}. `})},[]);const[z,x]=i.useState(0),[y,M]=i.useState(!1),E=i.useRef(null),d=i.useRef(null),_=.5,F=1.5,L=2.5,P=4,[a,T]=i.useState(!1),[p,k]=i.useState(0),[v,j]=i.useState(0),[u,$]=i.useState({...A}),[q,B]=i.useState(""),[J,U]=i.useState(""),[w,G]=i.useState(!1),W=i.useRef(null);i.useEffect(()=>{const t=setTimeout(()=>x(g=>Math.max(g,1)),_*1e3),c=setTimeout(()=>x(g=>Math.max(g,2)),F*1e3),o=setTimeout(()=>x(g=>Math.max(g,3)),L*1e3),r=setTimeout(()=>M(!0),P*1e3);return()=>[t,c,o,r].forEach(clearTimeout)},[]),i.useEffect(()=>{const t=E.current;if(!t)return;const c=()=>{const o=t.currentTime;o>=_&&x(r=>Math.max(r,1)),o>=F&&x(r=>Math.max(r,2)),o>=L&&x(r=>Math.max(r,3)),o>=P&&M(!0)};return t.addEventListener("timeupdate",c),()=>t.removeEventListener("timeupdate",c)},[]),i.useEffect(()=>{const t=E.current;if(!t)return;const c=()=>{try{t.currentTime=Math.max(0,t.duration-.05)}catch{}};return t.addEventListener("ended",c),()=>t.removeEventListener("ended",c)},[]),i.useEffect(()=>{if(!y||a||w)return;const t=setTimeout(()=>T(!0),500);return()=>clearTimeout(t)},[y,a,w]);const V=i.useCallback(()=>{if(!a||p>=f.length)return;const t=f[p];if(t.field==="__niche"){B(t.value),d.current=setTimeout(()=>{k(r=>r+1),j(0)},500);return}if(t.field==="__revenue"){U(t.value),d.current=setTimeout(()=>{k(r=>r+1),j(0)},500);return}const c=t.value,o=t.speed??45;v<c.length?($(r=>({...r,[t.field]:c.slice(0,v+1)})),d.current=setTimeout(()=>j(r=>r+1),o)):d.current=setTimeout(()=>{k(r=>r+1),j(0)},360)},[a,p,v]);i.useEffect(()=>{if(a){if(p>=f.length){T(!1),G(!0);return}return V(),()=>{d.current&&clearTimeout(d.current)}}},[a,p,v,V]);const O=()=>{d.current&&clearTimeout(d.current),W.current&&clearTimeout(W.current),T(!1),G(!0),$({...A}),B(""),U("")},Q=a&&p<f.length?f[p].field:null,l=t=>c=>C(o=>({...o,[t]:c.target.value})),X=t=>H(c=>c.includes(t)?c.filter(o=>o!==t):[...c,t]),Z=async t=>{if(t.preventDefault(),m!=="sending"){S("sending"),I("");try{await ce(`${D}/api/contact`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...s,services:h})},"public-contact"),S("sent")}catch(c){S("error"),I(c instanceof Error?c.message:"Error inesperado")}}},K=ne.map((t,c)=>e.jsxs("div",{className:`ctc-card${z>c?" ctc-card-in":""}`,style:{background:t.bg,borderColor:t.border},children:[e.jsx("span",{className:"ctc-card-icon",children:t.icon}),e.jsx("span",{className:"ctc-card-label",style:{color:t.accent},children:t.label}),t.href?e.jsx("a",{href:t.href,className:"ctc-card-value",style:{color:t.accent},children:t.value}):e.jsx("span",{className:"ctc-card-value",children:t.value})]},t.label)),n=t=>Q===t;return e.jsxs(e.Fragment,{children:[e.jsx(ee,{...te("/contacto")}),e.jsx(ae,{children:e.jsxs("div",{className:"ctc-root",children:[e.jsx("style",{children:pe}),e.jsx("video",{ref:E,className:"ctc-video",src:ie,poster:re,autoPlay:!0,muted:!0,playsInline:!0,preload:"metadata"}),e.jsx("div",{className:"ctc-overlay"}),e.jsxs("div",{className:"ctc-layout",children:[e.jsx("div",{className:"ctc-left",children:e.jsx("div",{className:"ctc-cards-row",children:K})}),e.jsx("div",{className:"ctc-panel",children:y?m==="sent"?e.jsxs("div",{style:{textAlign:"center",padding:"40px 20px"},children:[e.jsx("div",{style:{fontSize:52,marginBottom:18},children:"✅"}),e.jsx("h3",{style:{fontSize:24,fontWeight:800,color:"#2dd49f",marginBottom:12},children:"¡Solicitud recibida!"}),e.jsx("p",{style:{color:"#888",fontSize:14,lineHeight:1.7,marginBottom:8},children:"Hemos recibido tu solicitud."}),e.jsx("p",{style:{color:"#555",fontSize:12},children:"Te contactaremos con una propuesta por escrito antes de empezar."})]}):e.jsxs("div",{className:`ctc-form-wrap${y?" ctc-form-ready":""}`,children:[e.jsxs("div",{className:"ctc-field",style:{marginBottom:6},children:[a&&e.jsxs("div",{className:"ctc-demo-badge",children:[e.jsx("div",{className:"ctc-demo-dot"}),"IA rellenando ejemplo en vivo"]}),w&&!a&&e.jsx("span",{style:{display:"inline-block",padding:"5px 14px",borderRadius:999,background:R,color:N,border:`1px solid ${b}`,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14},children:"Trabaja con nosotros"}),!a&&!w&&e.jsx("span",{style:{display:"inline-block",padding:"5px 14px",borderRadius:999,background:R,color:N,border:`1px solid ${b}`,fontSize:10,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:14},children:"Trabaja con nosotros"}),e.jsx("h1",{style:{fontSize:"clamp(22px,3.2vw,34px)",fontWeight:800,color:"#eee",lineHeight:1.15,margin:"0 0 10px"},children:a?e.jsx(e.Fragment,{children:"Viendo cómo funciona…"}):e.jsxs(e.Fragment,{children:["Cuéntanos sobre",e.jsx("br",{}),"tu negocio."]})}),e.jsx("p",{style:{fontSize:13.5,color:"#777",lineHeight:1.65},children:a?"La IA rellena un ejemplo real. El formulario es tuyo cuando acabe.":e.jsxs(e.Fragment,{children:["Te respondemos con una propuesta por escrito,",e.jsx("br",{}),"sin compromiso."]})})]}),e.jsxs("form",{onSubmit:Z,onFocusCapture:O,onPointerDownCapture:O,style:{display:"flex",flexDirection:"column",gap:16},children:[e.jsx("div",{className:"ctc-field",children:e.jsxs("div",{className:"ctc-row",children:[e.jsxs("div",{children:[e.jsx("label",{className:"ctc-label",children:"Nombre completo *"}),e.jsx("input",{type:"text",required:!0,className:`ctc-input${n("name")?" ctc-typing":""}`,value:a?u.name+(n("name")?"|":""):s.name,onChange:a?void 0:l("name"),readOnly:a,placeholder:a?"":"Tu nombre y apellidos"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"ctc-label",children:"Email de contacto *"}),e.jsx("input",{type:"email",required:!0,className:`ctc-input${n("email")?" ctc-typing":""}`,value:a?u.email+(n("email")?"|":""):s.email,onChange:a?void 0:l("email"),readOnly:a,placeholder:a?"":"tu@email.com"})]})]})}),e.jsx("div",{className:"ctc-field",children:e.jsxs("div",{className:"ctc-row",children:[e.jsxs("div",{children:[e.jsx("label",{className:"ctc-label",children:"Teléfono"}),e.jsx("input",{type:"tel",className:"ctc-input",value:s.phone,onChange:l("phone"),placeholder:"+34 600 000 000"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"ctc-label",children:"URL de tu tienda"}),e.jsx("input",{type:"text",className:`ctc-input${n("storeUrl")?" ctc-typing":""}`,value:a?u.storeUrl+(n("storeUrl")?"|":""):s.storeUrl,onChange:a?void 0:l("storeUrl"),readOnly:a,placeholder:a?"":"mitienda.com"})]})]})}),e.jsx("div",{className:"ctc-field",children:e.jsxs("div",{className:"ctc-row",children:[e.jsxs("div",{children:[e.jsx("label",{className:"ctc-label",children:"Nicho / tipo de productos"}),e.jsxs("select",{className:`ctc-input${n("__niche")?" ctc-typing":""}`,value:a?q:s.niche,onChange:a?void 0:l("niche"),style:{cursor:"pointer"},children:[e.jsx("option",{value:"",children:"Selecciona tu nicho"}),se.map(t=>e.jsx("option",{children:t},t))]}),s.niche==="Otro"&&!a&&e.jsx("input",{type:"text",value:s.customNiche,onChange:l("customNiche"),placeholder:"Describe tu nicho...",className:"ctc-input",style:{marginTop:8}})]}),e.jsxs("div",{children:[e.jsx("label",{className:"ctc-label",children:"Facturación mensual aprox."}),e.jsxs("select",{className:`ctc-input${n("__revenue")?" ctc-typing":""}`,value:a?J:s.revenue,onChange:a?void 0:l("revenue"),style:{cursor:"pointer"},children:[e.jsx("option",{value:"",children:"Selecciona rango"}),le.map(t=>e.jsx("option",{children:t},t))]})]})]})}),e.jsxs("div",{className:"ctc-field",children:[e.jsx("label",{className:"ctc-label",children:"Redes sociales / Instagram"}),e.jsx("input",{type:"text",className:`ctc-input${n("socialMedia")?" ctc-typing":""}`,value:a?u.socialMedia+(n("socialMedia")?"|":""):s.socialMedia,onChange:a?void 0:l("socialMedia"),readOnly:a,placeholder:a?"":"@tu_cuenta o URL"})]}),e.jsxs("div",{className:"ctc-field",children:[e.jsx("label",{className:"ctc-label",children:"¿Qué servicios te interesan?"}),e.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:7,marginTop:4},children:de.map(t=>e.jsx("button",{type:"button",onClick:()=>!a&&X(t),className:"ctc-service-btn",style:{border:`1px solid ${h.includes(t)?b:"rgba(255,255,255,0.09)"}`,background:h.includes(t)?R:"transparent",color:h.includes(t)?N:"#777",opacity:a?.55:1},children:t},t))})]}),e.jsxs("div",{className:"ctc-field",children:[e.jsx("label",{className:"ctc-label",children:"Mensaje"}),e.jsx("textarea",{rows:4,className:`ctc-input${n("message")?" ctc-typing":""}`,value:a?u.message+(n("message")?"|":""):s.message,onChange:a?void 0:l("message"),readOnly:a,placeholder:a?"":"Cuéntanos sobre tu tienda, tus retos actuales o lo que quieres conseguir…",style:{resize:"vertical",minHeight:100}})]}),m==="error"&&!a&&e.jsx("div",{className:"ctc-field",style:{padding:"11px 15px",background:"rgba(232,69,88,.08)",border:"1px solid rgba(232,69,88,.25)",borderRadius:10,color:"#e84558",fontSize:13},children:Y}),e.jsxs("div",{className:"ctc-field",style:{padding:"11px 15px",background:"rgba(200,168,75,.04)",border:`1px solid ${b}`,borderRadius:10,display:"flex",gap:9,alignItems:"flex-start"},children:[e.jsx("span",{style:{fontSize:15,flexShrink:0,marginTop:1},children:"🔒"}),e.jsx("p",{style:{margin:0,fontSize:11.5,color:"#585858",lineHeight:1.6},children:"Tus datos se usan exclusivamente para contactarte sobre tu proyecto. Sin spam, nunca."})]}),e.jsx("div",{className:"ctc-field",style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"},children:a?e.jsx("button",{type:"button",onClick:O,style:{padding:"13px 28px",fontSize:13.5,borderRadius:12,border:"1px solid rgba(45,212,159,.3)",background:"rgba(45,212,159,.08)",color:"#2dd49f",cursor:"pointer",fontWeight:700,width:"100%",transition:"all .2s"},children:"↩ Saltar demo y rellenar yo mismo"}):e.jsxs(e.Fragment,{children:[e.jsx("p",{style:{fontSize:11.5,color:"#4a4a4a",flex:1,margin:0},children:"Propuesta por escrito y sin compromiso."}),e.jsx("button",{type:"submit",disabled:m==="sending",style:{opacity:m==="sending"?.68:1,minWidth:200,padding:"13px 28px",fontSize:13.5,borderRadius:12,border:"none",cursor:"pointer",fontWeight:800,background:"linear-gradient(135deg,#d4a843,#b8860b)",color:"#000",letterSpacing:".5px",boxShadow:"0 4px 20px rgba(200,168,75,.22)",transition:"opacity .2s"},children:m==="sending"?"Enviando…":"ENVIAR SOLICITUD →"})]})})]})]}):e.jsxs("div",{className:"ctc-building",children:[e.jsx("div",{className:"ctc-build-orb",children:"🤖"}),e.jsx("div",{className:"ctc-build-rail",children:e.jsx("div",{className:"ctc-build-beam"})}),oe.map((t,c)=>e.jsxs("div",{className:`ctc-build-step${z>c?" ctc-step-on":""}`,children:[e.jsx("div",{className:"ctc-step-dot",children:t.icon}),e.jsx("span",{className:"ctc-step-text",children:t.text}),e.jsx("span",{className:"ctc-step-check",children:"✓"})]},c)),e.jsx("div",{className:`ctc-build-ready${z>=3?" ctc-ready-on":""}`,children:"✦ Formulario listo ✦"})]})})]})]})})]})}export{he as default};
