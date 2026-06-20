import{a as i,j as e}from"./vendor-react-D81lGkAY.js";const j="/".replace(/\/$/,"")??"",W=`${j}/assets/videos/alec_landing.mp4`,U=`${j}/assets/videos/alec_poster.jpg`,L=4.5;function A({text:f,delay:l=0,speed:p=62}){const[n,S]=i.useState(0),[h,b]=i.useState(l===0);return i.useEffect(()=>{if(l===0){b(!0);return}const c=setTimeout(()=>b(!0),l);return()=>clearTimeout(c)},[l]),i.useEffect(()=>{if(!h||n>=f.length)return;const c=setTimeout(()=>S(g=>g+1),p);return()=>clearTimeout(c)},[h,n,f.length,p]),e.jsxs(e.Fragment,{children:[f.slice(0,n),n<f.length&&e.jsx("span",{className:"vfh-cursor"})]})}const V={name:"",email:"",phone:"",storeUrl:"",niche:"",customNiche:"",revenue:"",socialMedia:"",extraInfo:"",message:"",suppliers:"",productImageUrl:""},Y=["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"],$=["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"],H=["SEO y contenido","Rediseño de producto","Imágenes IA","Pricing y márgenes","Email marketing","A/B Testing","Auditoría completa"],o={display:"block",fontSize:11,fontWeight:700,color:"rgba(200,168,75,0.72)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:7},N={width:"100%",padding:"13px 20px",borderRadius:11,fontSize:14,fontWeight:800,background:"linear-gradient(135deg,#d4a843,#e6c668)",color:"#0a0800",border:"none",cursor:"pointer",letterSpacing:"0.03em",transition:"opacity 0.2s"},B={padding:"13px 18px",borderRadius:11,fontSize:13,fontWeight:600,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.58)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer"};function G({isActive:f=!1}){const[l,p]=i.useState(0),[n,S]=i.useState(V),[h,b]=i.useState([]),[c,g]=i.useState("idle"),[M,E]=i.useState(""),[u,R]=i.useState(null),[z,I]=i.useState(null),[d,F]=i.useState(!1),[v,m]=i.useState(0),y=i.useRef(null),w=i.useRef(null);i.useEffect(()=>{const t=new IntersectionObserver(([r])=>{const a=y.current;a&&(r.isIntersecting?a.play().catch(()=>{}):a.pause())},{threshold:.15});return w.current&&t.observe(w.current),()=>t.disconnect()},[]),i.useEffect(()=>{const t=y.current;if(!t)return;const r=()=>{t.currentTime>=L&&!d&&F(!0)};return t.addEventListener("timeupdate",r),()=>t.removeEventListener("timeupdate",r)},[d]),i.useEffect(()=>{const t=y.current;if(!t)return;const r=()=>{try{t.currentTime=Math.max(0,t.duration-.05)}catch{}};return t.addEventListener("ended",r),()=>t.removeEventListener("ended",r)},[]),i.useEffect(()=>{if(!d)return;m(1);const t=setTimeout(()=>m(2),1450),r=setTimeout(()=>m(3),2150),a=setTimeout(()=>m(4),2800),C=setTimeout(()=>m(5),3300);return()=>{clearTimeout(t),clearTimeout(r),clearTimeout(a),clearTimeout(C)}},[d]);const s=t=>r=>S(a=>({...a,[t]:r.target.value})),O=t=>b(r=>r.includes(t)?r.filter(a=>a!==t):[...r,t]),k=n.name.trim()!==""&&n.email.trim()!=="",x=c==="sent",D=async()=>{if(c!=="sending"){g("sending"),E("");try{let t;if(u){const a=new FormData;Object.entries(n).forEach(([C,P])=>a.append(C,P)),a.append("services",JSON.stringify(h)),a.append("referenceImage",u),t=await fetch(`${j}/api/contact`,{method:"POST",credentials:"include",body:a})}else t=await fetch(`${j}/api/contact`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({...n,services:h})});const r=await t.json();if(!t.ok)throw new Error(r.error??"Error al enviar");g("sent")}catch(t){g("error"),E(t instanceof Error?t.message:"Error inesperado. Inténtalo de nuevo.")}}},T=({s:t})=>e.jsx("div",{style:{display:"flex",justifyContent:"center",gap:7,marginTop:16},children:[0,1,2].map(r=>e.jsx("div",{style:{height:7,borderRadius:4,width:r===t?22:7,background:r===t?"#d4a843":r<t?"rgba(212,168,67,0.45)":"rgba(255,255,255,0.12)",transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)"}},r))});return e.jsxs(e.Fragment,{children:[e.jsx("style",{children:`
        /* ────── Typewriter cursor ────── */
        .vfh-cursor {
          display: inline-block;
          width: 2px; height: 0.85em;
          background: #d4a843;
          vertical-align: text-bottom;
          margin-left: 3px;
          animation: vfhBlink 0.7s step-end infinite;
        }
        @keyframes vfhBlink {
          0%,49%  { opacity: 1; }
          50%,100%{ opacity: 0; }
        }
        @keyframes vfhPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.5; transform:scale(.7); }
        }

        /* ────── Construction keyframes ────── */
        @keyframes vfhSlideIn {
          from { opacity: 0; transform: translateX(38px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes vfhRiseIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vfhSpringIn {
          0%  { opacity: 0; transform: translateY(12px) scale(.96); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.02); }
          100%{ opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes vfhInputGlow {
          0%  { box-shadow: 0 0 0 0 rgba(212,168,67,.0); border-color:rgba(255,255,255,.12); }
          30% { box-shadow: 0 0 0 5px rgba(212,168,67,.18); border-color:rgba(212,168,67,.75); }
          100%{ box-shadow: 0 0 0 2px rgba(212,168,67,.06); border-color:rgba(212,168,67,.35); }
        }
        @keyframes vfhBob {
          0%,100%{ transform:translateY(0); opacity:.4; }
          50%    { transform:translateY(-6px); opacity:.8; }
        }

        /* ────── CSS classes ────── */
        .vfh-slide-in { animation: vfhSlideIn .65s cubic-bezier(.22,1,.36,1) forwards; }
        .vfh-rise-in  { animation: vfhRiseIn  .52s cubic-bezier(.22,1,.36,1) forwards; }
        .vfh-spring-in{ animation: vfhSpringIn .65s cubic-bezier(.34,1.56,.64,1) forwards; }
        .vfh-input-glow { animation: vfhInputGlow .9s cubic-bezier(.22,1,.36,1) forwards; }

        /* ────── Force fp-contact-visme full-section width ────── */
        /* fp-content has margin:auto + max-width from CSS — override for contact */
        #fp-contact .fp-contact-visme {
          position: absolute !important;
          inset: 0 !important;
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden auto !important;
        }

        /* ────── Root: fills fp-section on desktop ────── */
        .vfh-root {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 1;
        }

        /* Mobile: fp-section height fills viewport below nav */
        @media (max-width: 780px) {
          #fp-contact {
            min-height: calc(100dvh - 56px) !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
        }

        /* ────── Video: full-section background ────── */
        .vfh-video {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: left center;
        }
        @media (max-width: 780px) {
          .vfh-video {
            object-position: 15% center;
          }
        }

        /* ────── Gradient overlay ────── */
        /* Keeps character visible on left, creates dark readable area on right */
        .vfh-gradient {
          position: absolute; inset: 0;
          pointer-events: none;
          background:
            linear-gradient(90deg,
              rgba(5,3,12,.08) 0%,
              rgba(5,3,12,.08) 38%,
              rgba(5,3,12,.68) 56%,
              rgba(5,3,12,.97) 73%,
              rgba(5,3,12,.99) 100%
            ),
            linear-gradient(180deg,
              rgba(5,3,12,.4) 0%,
              transparent 18%,
              transparent 75%,
              rgba(5,3,12,.5) 100%
            );
        }
        /* Mobile: vertical gradient — character visible at top, panel fades in below */
        @media (max-width: 780px) {
          .vfh-gradient {
            background:
              linear-gradient(180deg,
                rgba(5,3,12,.15) 0%,
                rgba(5,3,12,.1) 20%,
                rgba(5,3,12,.55) 40%,
                rgba(5,3,12,.92) 56%,
                rgba(5,3,12,.99) 70%
              );
          }
        }

        /* ────── Right panel ────── */
        .vfh-panel {
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 44%;
          padding: 40px 40px 40px 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,168,67,.2) transparent;
          z-index: 2;
        }
        .vfh-panel::-webkit-scrollbar { width: 3px; }
        .vfh-panel::-webkit-scrollbar-thumb { background: rgba(212,168,67,.22); border-radius: 3px; }

        @media (max-width: 780px) {
          .vfh-panel {
            position: absolute;
            width: 100%;
            top: 36%;
            bottom: 0;
            padding: 22px 20px 28px;
            background: none;
            justify-content: flex-start;
          }
          .vfh-panel h2 {
            font-size: clamp(15px, 4vw, 18px) !important;
            margin-bottom: 6px !important;
          }
          .vfh-panel p {
            font-size: 11.5px !important;
          }
          .vfh-2col {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 430px) {
          .vfh-panel {
            top: 32%;
            padding: 18px 16px 24px;
          }
          .vfh-2col {
            grid-template-columns: 1fr !important;
          }
          .vfh-input {
            padding: 9px 12px !important;
            font-size: 13px !important;
          }
        }

        /* ────── Inputs ────── */
        .vfh-input {
          display: block; width: 100%; box-sizing: border-box;
          padding: 11px 14px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 10px;
          color: rgba(255,255,255,.93);
          font-size: 14px; outline: none; font-family: inherit;
          transition: border-color .2s, box-shadow .2s;
        }
        .vfh-input:focus {
          border-color: rgba(212,168,67,.5);
          box-shadow: 0 0 0 3px rgba(212,168,67,.08);
        }
        .vfh-input option { background: #111; color: #eee; }

        /* ────── Step-2 inner scroll ────── */
        .vfh-s2 {
          max-height: 380px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(212,168,67,.2) transparent;
          padding-right: 4px;
        }
        .vfh-s2::-webkit-scrollbar { width: 3px; }
        .vfh-s2::-webkit-scrollbar-thumb { background: rgba(212,168,67,.22); border-radius: 3px; }
      `}),e.jsxs("div",{ref:w,className:"vfh-root",children:[e.jsx("video",{ref:y,className:"vfh-video",src:W,poster:U,muted:!0,playsInline:!0,preload:"auto"}),e.jsx("div",{className:"vfh-gradient"}),e.jsxs("div",{className:"vfh-panel",children:[e.jsxs("div",{style:{marginBottom:22},children:[e.jsxs("div",{style:{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 13px",borderRadius:20,background:"rgba(200,168,75,.12)",border:"1px solid rgba(200,168,75,.2)",color:"#e6c668",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14},children:[e.jsx("span",{style:{width:5,height:5,borderRadius:"50%",background:"#2dd49f",animation:"vfhPulse 1.8s ease-in-out infinite"}}),"Trabaja con nosotros"]}),e.jsxs("h2",{style:{margin:"0 0 9px",fontFamily:"'Instrument Serif', serif",fontSize:"clamp(19px, 2.1vw, 26px)",fontWeight:700,lineHeight:1.22,color:"rgba(255,255,255,.95)"},children:["Cuéntanos sobre",e.jsx("br",{}),e.jsx("em",{style:{color:"#d4a843"},children:"tu negocio."})]}),e.jsx("p",{style:{margin:0,fontSize:12.5,color:"rgba(255,255,255,.42)",lineHeight:1.55},children:"Análisis de tu tienda, mercado y competencia — 100% gratis."})]}),!d&&!x&&e.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"20px 0",textAlign:"center",color:"rgba(200,168,75,.4)"},children:[e.jsx("span",{style:{fontSize:28,animation:"vfhBob 2.2s ease-in-out infinite"},children:"🎩"}),e.jsxs("p",{style:{margin:0,fontSize:12.5,fontStyle:"italic",lineHeight:1.55},children:["Observa cómo Alec",e.jsx("br",{}),"sale del cuadro…"]})]}),x&&e.jsxs("div",{className:"vfh-slide-in",style:{background:"rgba(45,212,159,.07)",border:"1px solid rgba(45,212,159,.22)",borderRadius:16,padding:"38px 22px",textAlign:"center"},children:[e.jsx("div",{style:{fontSize:50,marginBottom:14},children:"🎉"}),e.jsx("h3",{style:{fontSize:21,fontWeight:800,color:"#2dd49f",marginBottom:10},children:"¡Solicitud recibida!"}),e.jsx("p",{style:{color:"rgba(255,255,255,.62)",fontSize:14,lineHeight:1.6,margin:"0 0 8px"},children:"Nuestra IA ya está analizando tu tienda, mercado, competencia y SEO."}),e.jsx("p",{style:{color:"rgba(255,255,255,.35)",fontSize:12},children:"Te contactamos en <24h. Revisa también tu carpeta de spam."})]}),d&&!x&&l===0&&e.jsxs("div",{className:"vfh-slide-in",style:{display:"flex",flexDirection:"column",gap:14},children:[e.jsxs("div",{children:[e.jsx("h3",{style:{margin:"0 0 3px",fontSize:17,fontWeight:800,color:"rgba(255,255,255,.95)"},children:e.jsx(A,{text:"Datos de contacto",speed:65})}),e.jsx("p",{style:{margin:0,fontSize:11.5,color:"rgba(200,168,75,.52)",fontStyle:"italic"},children:e.jsx(A,{text:"Solo 2 min · análisis gratis",speed:42,delay:900})})]}),v>=2&&e.jsxs("div",{className:"vfh-rise-in vfh-2col",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11},children:[e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Nombre *"}),e.jsx("input",{className:"vfh-input vfh-input-glow",type:"text",value:n.name,onChange:s("name"),placeholder:"Tu nombre",autoComplete:"name"})]}),e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Email *"}),e.jsx("input",{className:"vfh-input vfh-input-glow",style:{animationDelay:"180ms"},type:"email",value:n.email,onChange:s("email"),placeholder:"tu@email.com",autoComplete:"email"})]})]}),v>=3&&e.jsxs("div",{className:"vfh-rise-in",children:[e.jsx("label",{style:o,children:"Teléfono"}),e.jsx("input",{className:"vfh-input vfh-input-glow",type:"tel",value:n.phone,onChange:s("phone"),placeholder:"+34 600 000 000",autoComplete:"tel"})]}),v>=4&&e.jsx("div",{className:"vfh-spring-in",children:e.jsx("button",{onClick:()=>{k&&p(1)},disabled:!k,style:{...N,opacity:k?1:.38},children:"Siguiente →"})}),v>=5&&e.jsx("div",{className:"vfh-rise-in",children:e.jsx(T,{s:l})})]}),d&&!x&&l===1&&e.jsxs("div",{className:"vfh-slide-in",style:{display:"flex",flexDirection:"column",gap:13},children:[e.jsx("h3",{style:{margin:"0 0 2px",fontSize:17,fontWeight:800,color:"rgba(255,255,255,.95)"},children:"Tu negocio"}),e.jsxs("div",{children:[e.jsx("label",{style:o,children:"URL de tu tienda"}),e.jsx("input",{className:"vfh-input",type:"text",value:n.storeUrl,onChange:s("storeUrl"),placeholder:"mitienda.com"})]}),e.jsxs("div",{className:"vfh-2col",style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11},children:[e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Nicho"}),e.jsxs("select",{className:"vfh-input",value:n.niche,onChange:s("niche"),children:[e.jsx("option",{value:"",children:"Selecciona…"}),Y.map(t=>e.jsx("option",{children:t},t))]}),n.niche==="Otro"&&e.jsx("input",{className:"vfh-input",type:"text",value:n.customNiche,onChange:s("customNiche"),placeholder:"Describe tu nicho…",style:{marginTop:8},autoFocus:!0})]}),e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Facturación"}),e.jsxs("select",{className:"vfh-input",value:n.revenue,onChange:s("revenue"),children:[e.jsx("option",{value:"",children:"Selecciona…"}),$.map(t=>e.jsx("option",{children:t},t))]})]})]}),e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Redes sociales"}),e.jsx("input",{className:"vfh-input",type:"text",value:n.socialMedia,onChange:s("socialMedia"),placeholder:"@tutienda"})]}),e.jsxs("div",{style:{display:"flex",gap:10},children:[e.jsx("button",{onClick:()=>p(0),style:B,children:"← Volver"}),e.jsx("button",{onClick:()=>p(2),style:{...N,flex:1},children:"Siguiente →"})]}),e.jsx(T,{s:l})]}),d&&!x&&l===2&&e.jsxs("div",{className:"vfh-slide-in",children:[e.jsx("h3",{style:{margin:"0 0 12px",fontSize:17,fontWeight:800,color:"rgba(255,255,255,.95)"},children:"Objetivos y detalles"}),e.jsx("div",{className:"vfh-s2",children:e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:13},children:[e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Servicios que necesitas"}),e.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:7,marginTop:6},children:H.map(t=>{const r=h.includes(t);return e.jsx("button",{type:"button",onClick:()=>O(t),style:{padding:"6px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:`1px solid ${r?"rgba(200,168,75,.5)":"rgba(255,255,255,.1)"}`,background:r?"rgba(200,168,75,.12)":"transparent",color:r?"#e6c668":"rgba(200,168,75,.62)",transition:"all .15s"},children:t},t)})})]}),e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Información extra"}),e.jsx("textarea",{className:"vfh-input",rows:3,value:n.extraInfo,onChange:s("extraInfo"),placeholder:"Número de productos, plataformas, retos actuales…"})]}),e.jsxs("div",{children:[e.jsxs("label",{style:o,children:["Proveedores",e.jsx("span",{style:{fontWeight:400,color:"rgba(255,255,255,.28)",marginLeft:5,textTransform:"none"},children:"(opcional)"})]}),e.jsx("textarea",{className:"vfh-input",rows:2,value:n.suppliers,onChange:s("suppliers"),placeholder:"Alibaba, BigBuy, Printful…"})]}),e.jsxs("div",{children:[e.jsx("label",{style:o,children:"Mensaje adicional"}),e.jsx("textarea",{className:"vfh-input",rows:2,value:n.message,onChange:s("message"),placeholder:"Cuéntanos más sobre tus retos…"})]}),e.jsxs("div",{children:[e.jsxs("label",{style:o,children:["Imagen de producto",e.jsx("span",{style:{fontWeight:400,color:"rgba(255,255,255,.28)",marginLeft:5,textTransform:"none"},children:"(optimización IA gratis)"})]}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr auto",gap:10},children:[e.jsx("input",{className:"vfh-input",type:"url",value:n.productImageUrl,onChange:s("productImageUrl"),placeholder:"https://tu-tienda.com/producto.jpg"}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,padding:"11px 13px",background:"rgba(255,255,255,.04)",border:`1px solid ${u?"rgba(200,168,75,.5)":"rgba(255,255,255,.1)"}`,borderRadius:10,color:u?"#e6c668":"rgba(200,168,75,.62)",fontSize:13,cursor:"pointer",whiteSpace:"nowrap"},children:[u?`📎 ${u.name.slice(0,12)}…`:"📷 Subir",e.jsx("input",{type:"file",accept:"image/*",style:{display:"none"},onChange:t=>{const r=t.target.files?.[0];if(!r)return;R(r);const a=new FileReader;a.onload=()=>I(a.result),a.readAsDataURL(r)}})]})]}),z&&e.jsxs("div",{style:{marginTop:8,display:"flex",alignItems:"center",gap:10},children:[e.jsx("img",{src:z,alt:"Ref",style:{width:44,height:44,objectFit:"cover",borderRadius:8,border:"1px solid rgba(255,255,255,.1)"}}),e.jsx("button",{type:"button",onClick:()=>{R(null),I(null)},style:{background:"transparent",border:"none",color:"rgba(255,255,255,.3)",cursor:"pointer",fontSize:11,textDecoration:"underline"},children:"Quitar"})]})]}),c==="error"&&e.jsx("div",{style:{padding:"10px 14px",background:"rgba(232,69,88,.08)",border:"1px solid rgba(232,69,88,.3)",borderRadius:8,color:"#e84558",fontSize:13},children:M}),e.jsx("p",{style:{fontSize:11,color:"rgba(255,255,255,.28)",margin:0},children:"Al enviar aceptas nuestra política de privacidad. Tus datos son 100% seguros."}),e.jsxs("div",{style:{display:"flex",gap:10},children:[e.jsx("button",{onClick:()=>p(1),style:B,children:"← Volver"}),e.jsx("button",{onClick:D,disabled:c==="sending",style:{...N,flex:1,opacity:c==="sending"?.7:1},children:c==="sending"?"⏳ Enviando…":"🚀 Enviar y analizar gratis"})]}),e.jsx(T,{s:l})]})})]})]})]})]})}export{G as V};
