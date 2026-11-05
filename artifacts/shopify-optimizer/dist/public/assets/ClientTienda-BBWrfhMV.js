import{r as n,j as e}from"./vendor-react-7UxssXty.js";const v="/".replace(/\/$/,"")??"";function P(t){if(!t)return[];const s=typeof t=="string"?JSON.parse(t):t;return Array.isArray(s)?s.map(r=>typeof r=="string"?{text:r,included:!0}:r):[]}function C(t){return/emprendedor/i.test(t)?"🌱":/starter/i.test(t)?"🚀":/growth/i.test(t)?"⚡":/enterprise/i.test(t)?"🏆":"✦"}async function y(t,s){const r=await fetch(`${v}${t}`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(s)}),i=await r.json().catch(()=>({}));return{ok:r.ok,status:r.status,data:i}}async function $(t,s,r){try{const i=await y("/api/billing/checkout",{planId:t,interval:s?"year":"month",returnPath:"/client/tienda"});if(i.ok&&i.data?.url)return window.location.href=i.data.url,null;if(i.status!==503)return i.data?.error??"No se pudo iniciar el pago"}catch{}return s?"El pago anual solo está disponible con tarjeta. Escríbenos y te enviamos el enlace.":(await _(t,r),null)}async function _(t,s){try{const r=await fetch(`${v}/api/tienda/create-checkout`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({planId:t})});if(r.ok){const{checkoutUrl:i}=await r.json();if(i){window.open(i,"_blank","noopener,noreferrer");return}}}catch{}s.startsWith("http")?window.open(s,"_blank","noopener,noreferrer"):window.location.href=s}function A({plan:t,annual:s,onError:r}){const i=n.useRef(null),[p,x]=n.useState(!1),b=n.useCallback(o=>{const c=i.current;if(!c)return;const g=c.getBoundingClientRect(),a=(o.clientX-g.left)/g.width-.5,N=(o.clientY-g.top)/g.height-.5;c.style.transform=`perspective(1100px) rotateX(${-N*14}deg) rotateY(${a*14}deg) translateZ(12px)`;const z=c.querySelector(".ts-shine");z&&(z.style.background=`radial-gradient(circle at ${(a+.5)*100}% ${(N+.5)*100}%, rgba(200,168,75,0.22) 0%, rgba(255,255,255,0.04) 35%, transparent 70%)`)},[]),h=n.useCallback(()=>{const o=i.current;if(!o)return;o.style.transform="perspective(1100px) rotateX(0) rotateY(0) translateZ(0)";const c=o.querySelector(".ts-shine");c&&(c.style.background="transparent")},[]),u=s?t.price_annual??Math.round(t.price*10):t.price,l=s?"/año":"/mes",w=s&&t.price?Math.round((t.price*12-(t.price_annual??t.price*10))/(t.price*12)*100):0,j=P(t.features),d=!!t.featured,f=!(Number(t.price)>0),m=t.shopify_checkout_url||"/client/messages";async function k(o){if(o.preventDefault(),p)return;if(f){window.location.href="/client/messages";return}x(!0);const c=await $(t.id,s,m);c&&r(c),x(!1)}return e.jsx("div",{ref:i,className:`ts-card-tilt${d?" ts-feat-card":""}`,onMouseMove:b,onMouseLeave:h,children:e.jsxs("div",{className:"ts-card-wrap",children:[e.jsx("div",{className:"ts-border-spin"}),e.jsxs("div",{className:"ts-card-body",children:[e.jsx("div",{className:"ts-shine"}),t.badge&&e.jsx("div",{className:"ts-badge-top",children:t.badge}),e.jsx("div",{className:"ts-card-icon",children:C(t.name)}),e.jsx("h3",{className:"ts-card-name",children:t.name}),f?e.jsx("div",{className:"ts-price-row",children:e.jsx("span",{className:"ts-price-amt ts-price-quote",children:"A medida"})}):e.jsxs("div",{className:"ts-price-row",children:[e.jsx("span",{className:"ts-price-cur",children:t.currency??"€"}),e.jsx("span",{className:"ts-price-amt",children:u}),e.jsxs("span",{className:"ts-price-per",children:[l," + IVA"]})]}),s&&w>0&&e.jsxs("div",{className:"ts-save-badge",children:["✓ Ahorras ",w,"% vs mensual"]}),e.jsx("div",{className:"ts-divider"}),e.jsx("ul",{className:"ts-features",children:j.map((o,c)=>e.jsxs("li",{className:o.included!==!1?"ts-fi":"ts-fo",children:[e.jsx("span",{children:o.included!==!1?"✓":"✕"}),o.text]},c))}),e.jsx("button",{onClick:k,disabled:p,className:`ts-card-cta${d?" ts-cta-gold":" ts-cta-ghost"}${p?" ts-cta-loading":""}`,children:p?"Redirigiendo…":f?"Pedir presupuesto":t.cta_label??"Contratar"}),!f&&e.jsx("p",{className:"ts-secure-note",children:s?"Cobro anual · renovación automática · cancela cuando quieras":"Cobro mensual · sin permanencia"})]})]})})}function E(t){const s=Number(t.price_eur);if(!(s>0)||t.billing_interval==="quote"||!t.billing_interval)return t.price_display??"Presupuesto a medida";const r=s.toLocaleString("es-ES");return t.billing_interval==="month"?`${r} €/mes + IVA`:`${r} € + IVA`}function L({svc:t,onError:s}){const r=P(t.features),i=t.color_accent==="jade",[p,x]=n.useState(!1),b=Number(t.price_eur)>0&&(t.billing_interval==="month"||t.billing_interval==="one_time");async function h(u){if(b&&(u.preventDefault(),!p)){x(!0);try{const l=await y(`/api/tienda/services/${t.id}/checkout`,{});if(l.ok&&l.data?.url){window.location.href=l.data.url;return}s(l.data?.error??"No se pudo iniciar el pago")}catch{s("No se pudo iniciar el pago")}x(!1)}}return e.jsxs("div",{className:`ts-svc${i?" ts-svc-jade":""}`,children:[e.jsx("div",{className:"ts-svc-icon",children:t.icon}),t.badge&&e.jsx("div",{className:"ts-svc-badge",children:t.badge}),e.jsx("h3",{className:"ts-svc-name",children:t.name}),e.jsx("p",{className:"ts-svc-short",children:t.short_desc||t.description}),e.jsx("div",{className:"ts-svc-price",children:E(t)}),e.jsxs("ul",{className:"ts-svc-feats",children:[r.slice(0,5).map((u,l)=>e.jsxs("li",{children:[e.jsx("span",{children:"✓"}),u.text]},l)),r.length>5&&e.jsxs("li",{className:"ts-svc-more",children:["+",r.length-5," más incluido"]})]}),e.jsx("a",{href:b?"#":t.cta_url||"/client/messages",onClick:h,className:"ts-svc-cta",children:p?"Redirigiendo…":t.cta_label}),b&&e.jsx("p",{className:"ts-secure-note",children:t.billing_interval==="month"?"Cobro mensual · sin permanencia":"Pago único"})]})}function S({h:t=420}){return e.jsx("div",{className:"ts-skeleton",style:{height:t}})}function T(){const[t,s]=n.useState("planes"),[r,i]=n.useState(!1),[p,x]=n.useState([]),[b,h]=n.useState([]),[u,l]=n.useState(!0),[w,j]=n.useState(!0),[d,f]=n.useState(null),[m,k]=n.useState(()=>{const a=new URLSearchParams(window.location.search).get("stripe");return a==="success"?{type:"ok",text:"Pago recibido. Tu contratación se activa en cuanto Stripe la confirma (normalmente al momento)."}:a==="cancelled"?{type:"err",text:"Pago cancelado. No se ha realizado ningún cargo."}:null}),[o,c]=n.useState(!1),g=n.useCallback(a=>k({type:"err",text:a}),[]);return n.useEffect(()=>{fetch(`${v}/api/billing/subscription`,{credentials:"include"}).then(a=>a.ok?a.json():null).then(a=>{a?.subscription&&f(a.subscription)}).catch(()=>{}),fetch(`${v}/api/tienda/plans`,{credentials:"include"}).then(a=>a.ok?a.json():[]).then(a=>{x(Array.isArray(a)?a:[]),l(!1)}).catch(()=>l(!1)),fetch(`${v}/api/tienda/services`,{credentials:"include"}).then(a=>a.ok?a.json():[]).then(a=>{h(Array.isArray(a)?a:[]),j(!1)}).catch(()=>j(!1))},[]),e.jsxs("div",{className:"ts-root ct-client-tienda",children:[e.jsx("style",{children:I}),e.jsxs("div",{className:"ts-bg","aria-hidden":!0,children:[e.jsx("div",{className:"ts-orb ts-orb-gold"}),e.jsx("div",{className:"ts-orb ts-orb-jade"}),e.jsx("div",{className:"ts-bg-grid"})]}),e.jsxs("div",{className:"ts-content",children:[e.jsxs("header",{className:"ts-hero ct-hero",children:[e.jsx("a",{href:"/client",className:"ct-back-btn",children:"← Volver al panel"}),e.jsxs("div",{className:"ts-pill",children:[e.jsx("span",{className:"ts-pill-dot"}),"PLANES Y SERVICIOS"]}),e.jsxs("h1",{children:["Tu plan de",e.jsx("br",{}),e.jsx("span",{className:"ts-gradient-text",children:"crecimiento."})]}),e.jsx("p",{className:"ts-hero-sub",children:"Planes para tu tienda Shopify, WooCommerce o PrestaShop y servicios que hacemos por ti. Sin permanencia."}),d?.stripeCustomerId&&e.jsxs("div",{className:"ct-sub-box",children:[e.jsxs("span",{children:["Suscripción ",d.status==="active"?"activa":d.status==="past_due"?"con pago pendiente":d.status==="canceled"?"cancelada":d.status,d.currentPeriodEnd?` · ${d.cancelAtPeriodEnd?"termina":"se renueva"} el ${new Date(d.currentPeriodEnd).toLocaleDateString("es-ES")}`:""]}),e.jsx("button",{className:"ct-sub-btn",disabled:o,onClick:async()=>{c(!0);try{const a=await y("/api/billing/portal",{returnPath:"/client/tienda"});if(a.ok&&a.data?.url){window.location.href=a.data.url;return}g(a.data?.error??"No se pudo abrir la gestión de la suscripción")}catch{g("No se pudo abrir la gestión de la suscripción")}c(!1)},children:o?"Abriendo…":"Facturas, tarjeta y cancelación →"})]}),m&&e.jsx("div",{className:`ct-notice ct-notice-${m.type}`,role:"status",children:m.text})]}),e.jsxs("nav",{className:"ts-tabs","aria-label":"Secciones",children:[e.jsx("button",{className:`ts-tab${t==="planes"?" ts-tab-on":""}`,onClick:()=>s("planes"),children:"📦 Planes"}),e.jsx("button",{className:`ts-tab${t==="servicios"?" ts-tab-on":""}`,onClick:()=>s("servicios"),children:"⚡ Servicios"})]}),t==="planes"&&e.jsxs("section",{className:"ts-section",children:[e.jsxs("div",{className:"ts-toggle-wrap",children:[e.jsx("span",{className:`ts-tog-label${r?"":" ts-tog-on"}`,children:"Mensual"}),e.jsx("button",{className:`ts-switch${r?" ts-switch-on":""}`,onClick:()=>i(a=>!a),"aria-pressed":r,"aria-label":"Cambiar a pago anual",children:e.jsx("span",{className:"ts-thumb"})}),e.jsx("span",{className:`ts-tog-label${r?" ts-tog-on":""}`,children:"Anual"}),r&&e.jsx("span",{className:"ts-save-pill",children:"2 meses gratis"})]}),e.jsx("div",{className:"ts-plans-grid",children:u?[1,2,3,4].map(a=>e.jsx(S,{},a)):p.map(a=>e.jsx(A,{plan:a,annual:r,onError:g},a.id))}),e.jsx("div",{className:"ts-trust-strip",children:["🔒 Pago con tarjeta vía Stripe","🔄 Sin permanencia","🧾 Factura en cada cobro","Precios sin IVA"].map(a=>e.jsx("span",{className:"ts-trust-item",children:a},a))})]}),t==="servicios"&&e.jsxs("section",{className:"ts-section",children:[e.jsxs("div",{className:"ts-svc-header",children:[e.jsx("h2",{className:"ts-svc-title",children:"Servicios especializados"}),e.jsx("p",{className:"ts-svc-sub",children:"Servicios que hace nuestro equipo: de pago único o mensuales, sin permanencia."})]}),e.jsx("div",{className:"ts-svcs-grid",children:w?[1,2,3,4,5,6].map(a=>e.jsx(S,{h:380},a)):b.map(a=>e.jsx(L,{svc:a,onError:g},a.id))})]}),e.jsx("div",{className:"ts-bottom-cta",children:e.jsxs("div",{className:"ts-bottom-inner",children:[e.jsx("span",{className:"ts-bottom-icon",children:"💬"}),e.jsxs("div",{children:[e.jsx("h3",{className:"ts-bottom-title",children:"¿Necesitas algo personalizado?"}),e.jsx("p",{className:"ts-bottom-sub",children:"Tu agencia diseña soluciones a medida. Escríbeles directamente desde aquí."})]}),e.jsx("a",{href:"/client/messages",className:"ts-bottom-btn",children:"Hablar con tu agencia →"})]})})]})]})}const I=`
.ct-client-tienda { min-height: calc(100vh - 60px); }
.ct-client-tienda .ts-content { padding-top: 0; }
.ct-hero { padding: 32px 0 36px; }
.ct-hero h1 { font-size: clamp(32px, 4.5vw, 58px); }
.ct-back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: 20px; padding: 7px 16px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.5); font-size: 12.5px; font-weight: 600;
  text-decoration: none; transition: all .2s; font-family: var(--fb,'Geist',sans-serif);
}
.ct-sub-box { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; margin-top: 22px; padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(45,212,159,0.22); background: rgba(45,212,159,0.06); font-size: 13px; color: rgba(255,255,255,0.75); }
.ct-sub-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(200,168,75,0.35); background: rgba(200,168,75,0.08); color: #d4a843; font-size: 12.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
.ct-sub-btn:disabled { opacity: .6; cursor: wait; }
.ct-notice { max-width: 620px; margin: 16px auto 0; padding: 11px 16px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
.ct-notice-ok { background: rgba(45,212,159,0.08); border: 1px solid rgba(45,212,159,0.3); color: #7ee8c4; }
.ct-notice-err { background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.3); color: #fda4af; }
.ts-price-quote { font-size: 34px !important; }
.ct-back-btn:hover { border-color: rgba(200,168,75,0.3); color: rgba(200,168,75,0.9); background: rgba(200,168,75,0.06); }

.ts-root { background: var(--ink,#0a0a0c); position: relative; overflow-x: hidden; }
.ts-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.ts-orb { position: absolute; border-radius: 50%; filter: blur(80px); animation: tsOrb 12s ease-in-out infinite; }
.ts-orb-gold { top: -15%; right: -10%; width: 600px; height: 600px; background: radial-gradient(circle, rgba(200,168,75,0.14), transparent 65%); animation-duration: 9s; }
.ts-orb-jade { bottom: -10%; left: -12%; width: 700px; height: 700px; background: radial-gradient(circle, rgba(45,212,159,0.08), transparent 65%); animation-duration: 13s; animation-direction: reverse; }
@keyframes tsOrb { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(24px,-24px) scale(1.12)} }
.ts-bg-grid { position: absolute; inset: 0; background-image: radial-gradient(circle, rgba(200,168,75,0.055) 1px, transparent 1px); background-size: 52px 52px; mask-image: radial-gradient(ellipse 80% 80% at 50% 40%, rgba(0,0,0,.35) 0%, transparent 100%); }

.ts-content { position: relative; z-index: 5; max-width: 1280px; margin: 0 auto; padding: 0 24px 96px; }
.ts-hero { text-align: center; padding: 72px 0 52px; }
.ts-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 20px; border-radius: 99px; border: 1px solid rgba(200,168,75,0.28); background: rgba(200,168,75,0.07); font-size: 10.5px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: rgba(200,168,75,0.9); margin-bottom: 28px; }
.ts-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: #d4a843; animation: tsPulse 1.8s ease-in-out infinite; }
@keyframes tsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
.ts-hero h1 { font-family: var(--fh,'Instrument Serif',serif); font-size: clamp(44px,6.5vw,80px); font-weight: 400; line-height: 1.05; color: #eee; margin: 0 0 20px; letter-spacing: -1px; }
.ts-gradient-text { background: linear-gradient(130deg,#d4a843 0%,#f0d070 40%,#c8a84b 80%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.ts-hero-sub { font-size: 16px; color: rgba(255,255,255,0.48); max-width: 520px; margin: 0 auto; line-height: 1.72; }

.ts-tabs { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 44px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 4px; width: fit-content; margin-left: auto; margin-right: auto; }
.ts-tab { padding: 11px 32px; border-radius: 11px; font-size: 12.5px; font-weight: 700; letter-spacing: 1px; cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.4); transition: all .22s; font-family: inherit; white-space: nowrap; }
.ts-tab.ts-tab-on { background: linear-gradient(135deg,rgba(200,168,75,0.2),rgba(200,168,75,0.08)); border: 1px solid rgba(200,168,75,0.32); color: rgba(200,168,75,1); box-shadow: 0 2px 16px rgba(200,168,75,0.1); }

.ts-toggle-wrap { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 44px; }
.ts-tog-label { font-size: 13px; color: rgba(255,255,255,0.35); transition: color .2s; }
.ts-tog-label.ts-tog-on { color: rgba(200,168,75,0.9); font-weight: 600; }
.ts-switch { width: 48px; height: 26px; border-radius: 13px; background: rgba(255,255,255,0.08); border: 1px solid rgba(200,168,75,0.25); cursor: pointer; position: relative; transition: all .2s; padding: 0; }
.ts-switch.ts-switch-on { background: rgba(200,168,75,0.22); border-color: rgba(200,168,75,0.5); }
.ts-thumb { position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: linear-gradient(135deg,#d4a843,#b8860b); transition: transform .22s cubic-bezier(.34,1.56,.64,1); box-shadow: 0 2px 8px rgba(200,168,75,0.4); }
.ts-switch.ts-switch-on .ts-thumb { transform: translateX(22px); }
.ts-save-pill { padding: 4px 12px; border-radius: 99px; background: rgba(45,212,159,0.1); border: 1px solid rgba(45,212,159,0.25); font-size: 11px; font-weight: 700; color: #2dd49f; letter-spacing: .5px; }

.ts-plans-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(270px,100%),1fr)); gap: 20px; align-items: stretch; }
.ts-card-tilt { will-change: transform; transition: transform .18s ease; position: relative; cursor: default; }
.ts-card-wrap { position: relative; border-radius: 22px; padding: 1px; overflow: hidden; height: 100%; }
.ts-border-spin { position: absolute; top: -100%; left: -100%; width: 300%; height: 300%; background: conic-gradient(from 0deg,transparent 0%,transparent 58%,rgba(200,168,75,.4) 63%,rgba(200,168,75,.85) 68%,rgba(200,168,75,.4) 73%,transparent 78%); animation: tsBorderSpin 6s linear infinite; }
.ts-feat-card .ts-border-spin { background: conic-gradient(from 0deg,transparent 0%,transparent 40%,rgba(200,168,75,.35) 47%,rgba(200,168,75,1) 52%,rgba(200,168,75,1) 60%,rgba(200,168,75,.35) 67%,transparent 73%); animation-duration: 3.8s; }
@keyframes tsBorderSpin { to{transform:rotate(360deg)} }
.ts-card-body { position: relative; border-radius: 21px; background: rgba(7,7,13,0.94); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); padding: 28px 22px 22px; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.ts-feat-card .ts-card-body { background: rgba(10,8,18,0.96); }
.ts-shine { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; transition: background .12s; z-index: 1; }
.ts-badge-top { position: absolute; top: 0; right: 22px; padding: 5px 14px; border-radius: 0 0 12px 12px; background: linear-gradient(135deg,#d4a843,#b8860b); font-size: 9px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #000; z-index: 3; }
.ts-card-icon { font-size: 30px; margin-bottom: 14px; position: relative; z-index: 2; }
.ts-card-name { font-family: var(--fh,'Instrument Serif',serif); font-size: 26px; font-weight: 400; color: #eee; margin: 0 0 18px; position: relative; z-index: 2; }
.ts-feat-card .ts-card-name { color: #d4a843; }
.ts-price-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 6px; position: relative; z-index: 2; }
.ts-price-cur { font-size: 20px; color: rgba(255,255,255,0.6); font-weight: 700; }
.ts-price-amt { font-size: 56px; font-weight: 900; color: #eee; line-height: 1; font-family: var(--fb,'Geist',sans-serif); }
.ts-feat-card .ts-price-amt { color: #d4a843; }
.ts-price-per { font-size: 13px; color: rgba(255,255,255,0.35); align-self: flex-end; margin-bottom: 5px; padding-left: 2px; }
.ts-save-badge { font-size: 11px; color: #2dd49f; font-weight: 700; margin-bottom: 12px; letter-spacing: .3px; position: relative; z-index: 2; }
.ts-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 14px 0; }
.ts-features { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 9px; flex: 1; position: relative; z-index: 2; }
.ts-fi,.ts-fo { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; line-height: 1.45; }
.ts-fi { color: rgba(255,255,255,0.82); }
.ts-fo { color: rgba(255,255,255,0.22); text-decoration: line-through; }
.ts-fi>span { color: #2dd49f; font-weight: 700; flex-shrink: 0; }
.ts-fo>span { color: rgba(255,255,255,0.2); flex-shrink: 0; }
.ts-card-cta { display: block; width: 100%; padding: 13px 20px; text-align: center; border-radius: 11px; font-size: 13.5px; font-weight: 700; text-decoration: none; cursor: pointer; transition: all .2s; position: relative; z-index: 2; font-family: var(--fb,'Geist',sans-serif); letter-spacing: .3px; border: none; }
.ts-cta-gold { background: linear-gradient(135deg,#d4a843,#b8860b); color: #000; box-shadow: 0 4px 24px rgba(200,168,75,0.35); }
.ts-cta-gold:hover:not(:disabled) { box-shadow: 0 8px 32px rgba(200,168,75,0.5); transform: translateY(-1px); }
.ts-cta-ghost { background: rgba(200,168,75,0.07); border: 1px solid rgba(200,168,75,0.28); color: rgba(200,168,75,0.92); }
.ts-cta-ghost:hover:not(:disabled) { background: rgba(200,168,75,0.14); border-color: rgba(200,168,75,0.5); }
.ts-cta-loading { opacity: 0.6; cursor: wait; }
.ts-secure-note { text-align: center; font-size: 10.5px; color: rgba(255,255,255,0.25); margin: 8px 0 0; position: relative; z-index: 2; }
.ts-feat-card { filter: drop-shadow(0 0 32px rgba(200,168,75,0.14)); }

.ts-trust-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 28px; margin-top: 40px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.05); }
.ts-trust-item { font-size: 12px; color: rgba(255,255,255,0.35); font-weight: 500; }

.ts-section { width: 100%; }
.ts-svc-header { text-align: center; margin-bottom: 40px; }
.ts-svc-title { font-family: var(--fh,'Instrument Serif',serif); font-size: clamp(30px,4vw,48px); font-weight: 400; color: #eee; margin: 0 0 10px; }
.ts-svc-sub { font-size: 15px; color: rgba(255,255,255,0.4); margin: 0; }
.ts-svcs-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(300px,100%),1fr)); gap: 20px; }
.ts-svc { border-radius: 20px; background: rgba(255,255,255,0.025); border: 1px solid rgba(200,168,75,0.12); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); padding: 26px 22px 22px; transition: all .28s cubic-bezier(.22,1,.36,1); cursor: default; position: relative; overflow: hidden; display: flex; flex-direction: column; }
.ts-svc::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg,transparent 0%,rgba(200,168,75,0.5) 50%,transparent 100%); opacity: 0; transition: opacity .3s; }
.ts-svc:hover { border-color: rgba(200,168,75,0.3); transform: translateY(-5px); box-shadow: 0 24px 64px rgba(0,0,0,0.55); }
.ts-svc:hover::before { opacity: 1; }
.ts-svc.ts-svc-jade { border-color: rgba(45,212,159,0.12); }
.ts-svc-jade::before { background: linear-gradient(90deg,transparent 0%,rgba(45,212,159,0.5) 50%,transparent 100%); }
.ts-svc-jade:hover { border-color: rgba(45,212,159,0.3); }
.ts-svc-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 14px; background: rgba(200,168,75,0.08); border: 1px solid rgba(200,168,75,0.18); font-size: 22px; margin-bottom: 16px; }
.ts-svc.ts-svc-jade .ts-svc-icon { background: rgba(45,212,159,0.07); border-color: rgba(45,212,159,0.18); }
.ts-svc-badge { position: absolute; top: 14px; right: 14px; padding: 3px 10px; border-radius: 99px; background: rgba(45,212,159,0.1); border: 1px solid rgba(45,212,159,0.25); font-size: 10px; font-weight: 700; color: #2dd49f; letter-spacing: .5px; }
.ts-svc-name { font-family: var(--fh,'Instrument Serif',serif); font-size: 22px; font-weight: 400; color: #eee; margin: 0 0 10px; }
.ts-svc-short { font-size: 13px; color: rgba(255,255,255,0.42); line-height: 1.65; margin: 0 0 16px; flex: 1; }
.ts-svc-price { font-size: 18px; font-weight: 800; color: rgba(200,168,75,0.9); margin-bottom: 14px; }
.ts-svc-feats { list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.ts-svc-feats li { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: rgba(255,255,255,0.65); line-height: 1.4; }
.ts-svc-feats li>span { color: #2dd49f; font-weight: 700; flex-shrink: 0; font-size: 11px; }
.ts-svc-more { font-size: 11.5px; color: rgba(200,168,75,0.6) !important; font-style: italic; }
.ts-svc-cta { display: block; width: 100%; padding: 11px 18px; text-align: center; border-radius: 10px; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: .3px; background: rgba(200,168,75,0.07); border: 1px solid rgba(200,168,75,0.28); color: rgba(200,168,75,0.92); transition: all .2s; font-family: inherit; }
.ts-svc-cta:hover { background: rgba(200,168,75,0.14); border-color: rgba(200,168,75,0.5); }

.ts-bottom-cta { margin-top: 72px; padding: 32px 28px; border-radius: 20px; background: rgba(200,168,75,0.04); border: 1px solid rgba(200,168,75,0.12); }
.ts-bottom-inner { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; max-width: 900px; margin: 0 auto; }
.ts-bottom-icon { font-size: 32px; flex-shrink: 0; }
.ts-bottom-inner>div { flex: 1; min-width: 200px; }
.ts-bottom-title { font-family: var(--fh,'Instrument Serif',serif); font-size: 22px; font-weight: 400; color: #eee; margin: 0 0 6px; }
.ts-bottom-sub { font-size: 13px; color: rgba(255,255,255,0.38); margin: 0; line-height: 1.6; }
.ts-bottom-btn { padding: 13px 28px; border-radius: 11px; text-decoration: none; background: linear-gradient(135deg,#d4a843,#b8860b); color: #000; font-size: 13.5px; font-weight: 800; white-space: nowrap; transition: all .2s; box-shadow: 0 4px 20px rgba(200,168,75,0.3); }
.ts-bottom-btn:hover { box-shadow: 0 8px 32px rgba(200,168,75,0.45); transform: translateY(-1px); }

.ts-skeleton { border-radius: 22px; background: linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.04) 75%); background-size: 200% 100%; animation: tsSkel 1.4s ease-in-out infinite; }
@keyframes tsSkel { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

@media(max-width:600px){
  .ts-hero{padding:48px 0 36px}
  .ts-bottom-inner{flex-direction:column;text-align:center}
  .ts-bottom-btn{width:100%;text-align:center}
}
`;export{T as default};
