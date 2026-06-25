import{r as l,j as a}from"./vendor-react-DqW1pDqK.js";const f="/".replace(/\/$/,"")??"",m={name:"",description:"",short_desc:"",icon:"⚡",price_display:"",features:[],cta_label:"Solicitar →",cta_url:"",badge:"",color_accent:"gold",sort_order:0,visible:!0};function h(o,s){return fetch(`${f}/api${o}`,{credentials:"include",headers:{"Content-Type":"application/json",...s?.headers??{}},...s})}function v(){const[o,s]=l.useState(null),d=l.useCallback((r,c=!0)=>{s({msg:r,ok:c}),setTimeout(()=>s(null),3200)},[]);return{toast:o,show:d}}function j({show:o}){const[s,d]=l.useState({}),[r,c]=l.useState(!1),[x,u]=l.useState({});l.useEffect(()=>{h("/tienda/settings").then(e=>e.ok?e.json():{}).then(e=>d(e)).catch(()=>{})},[]);const p=async()=>{c(!0);try{(await h("/tienda/settings",{method:"PUT",body:JSON.stringify(s)})).ok?o("✅ Configuración guardada"):o("❌ Error al guardar",!1)}catch{o("❌ Error de red",!1)}c(!1)},i=(e,t)=>d(g=>({...g,[e]:t})),n=e=>u(t=>({...t,[e]:!t[e]}));return a.jsxs("div",{className:"ta-section",children:[a.jsxs("div",{className:"ta-section-header",children:[a.jsx("h2",{children:"🛍️ Configuración de tu Tienda Shopify"}),a.jsx("p",{children:"Conecta tu tienda Shopify para procesar pagos y vincular los planes con productos reales."})]}),a.jsxs("div",{className:"ta-card",children:[a.jsxs("div",{className:"ta-info-banner",children:[a.jsx("span",{children:"ℹ️"}),a.jsxs("div",{children:[a.jsx("strong",{children:"¿Cómo funciona?"})," Configura las credenciales de tu tienda Shopify. Las URLs de checkout de cada plan se configuran en la pestaña ",a.jsx("strong",{children:"Planes"}),". Los clientes serán redirigidos a tu Shopify para pagar de forma segura."]})]}),a.jsxs("div",{className:"ta-form-grid",children:[a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Nombre de la tienda"}),a.jsx("input",{value:s.store_name??"",onChange:e=>i("store_name",e.target.value),placeholder:"Shopy Crafter",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Dominio Shopify"}),a.jsx("input",{value:s.shopify_domain??"",onChange:e=>i("shopify_domain",e.target.value),placeholder:"tutienda.myshopify.com",className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"Solo el dominio, sin https://"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Checkout URL Base (opcional)"}),a.jsx("input",{value:s.checkout_url_prefix??"",onChange:e=>i("checkout_url_prefix",e.target.value),placeholder:"https://tutienda.myshopify.com/cart/",className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"URL base para redirigir clientes al checkout"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Moneda"}),a.jsxs("select",{value:s.currency??"EUR",onChange:e=>i("currency",e.target.value),className:"ta-input",children:[a.jsx("option",{value:"EUR",children:"EUR — Euro"}),a.jsx("option",{value:"USD",children:"USD — Dólar"}),a.jsx("option",{value:"GBP",children:"GBP — Libra"}),a.jsx("option",{value:"MXN",children:"MXN — Peso Mexicano"})]})]}),a.jsx("div",{className:"ta-divider ta-full"}),["storefront_access_token","admin_api_key","admin_api_secret"].map(e=>{const t={storefront_access_token:"Storefront Access Token",admin_api_key:"Admin API Key",admin_api_secret:"Admin API Secret"},g={storefront_access_token:"Para el Storefront API (lectura pública de productos)",admin_api_key:"Para el Admin API (gestión avanzada)",admin_api_secret:"Secret compartido para webhooks de Shopify"};return a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:t[e]}),a.jsxs("div",{className:"ta-secret-wrap",children:[a.jsx("input",{type:x[e]?"text":"password",value:s[e]??"",onChange:b=>i(e,b.target.value),placeholder:"••••••••••••••••",className:"ta-input ta-secret-input"}),a.jsx("button",{className:"ta-reveal-btn",onClick:()=>n(e),children:x[e]?"🙈":"👁️"})]}),a.jsx("span",{className:"ta-hint",children:g[e]})]},e)})]}),a.jsx("div",{className:"ta-actions",children:a.jsx("button",{className:"ta-btn-primary",onClick:p,disabled:r,children:r?"Guardando…":"💾 Guardar configuración"})})]})]})}function y({show:o}){const[s,d]=l.useState([]),[r,c]=l.useState({}),[x,u]=l.useState({});l.useEffect(()=>{h("/billing/plans").then(i=>i.ok?i.json():[]).then(i=>{d(i);const n={};i.forEach(e=>{n[e.id]=e.shopify_checkout_url??""}),c(n)}).catch(()=>{})},[]);const p=async i=>{u(n=>({...n,[i]:!0}));try{(await h(`/tienda/plans/${i}/checkout-url`,{method:"PUT",body:JSON.stringify({shopify_checkout_url:r[i]||null})})).ok?o(`✅ URL guardada para ${s.find(e=>e.id===i)?.name}`):o("❌ Error al guardar",!1)}catch{o("❌ Error de red",!1)}u(n=>({...n,[i]:!1}))};return a.jsxs("div",{className:"ta-section",children:[a.jsxs("div",{className:"ta-section-header",children:[a.jsx("h2",{children:"📦 Planes — URLs de Checkout Shopify"}),a.jsx("p",{children:'Asigna una URL de checkout de Shopify a cada plan. Cuando un cliente haga clic en "Comprar", será redirigido a tu Shopify para completar el pago.'})]}),a.jsxs("div",{className:"ta-info-banner",children:[a.jsx("span",{children:"💡"}),a.jsxs("div",{children:["Crea un producto en Shopify por cada plan, copia su URL de checkout y pégala aquí. Ejemplo: ",a.jsx("code",{children:"https://tutienda.myshopify.com/cart/12345678:1"})]})]}),a.jsxs("div",{className:"ta-plans-list",children:[s.map(i=>a.jsxs("div",{className:`ta-plan-row${i.featured?" ta-plan-featured":""}`,children:[a.jsxs("div",{className:"ta-plan-info",children:[a.jsxs("div",{className:"ta-plan-name",children:[i.featured&&a.jsx("span",{className:"ta-feat-badge",children:"★ DESTACADO"}),i.name]}),a.jsxs("div",{className:"ta-plan-price",children:[i.currency??"€",i.price,"/mes · ",i.currency??"€",i.price_annual??i.price*10,"/año"]})]}),a.jsxs("div",{className:"ta-plan-url-wrap",children:[a.jsx("input",{value:r[i.id]??"",onChange:n=>c(e=>({...e,[i.id]:n.target.value})),placeholder:"https://tutienda.myshopify.com/cart/...",className:"ta-input ta-url-input"}),a.jsx("button",{className:"ta-btn-save",onClick:()=>p(i.id),disabled:x[i.id],children:x[i.id]?"…":"💾"})]})]},i.id)),s.length===0&&a.jsx("div",{className:"ta-empty",children:"Cargando planes…"})]})]})}function N({svc:o,onClose:s,onSave:d}){const[r,c]=l.useState(o??m),[x,u]=l.useState(!1),[p,i]=l.useState((o?.features??[]).join(`
`)),n=(t,g)=>c(b=>({...b,[t]:g})),e=async()=>{if(!r.name.trim())return;u(!0);const t={...r,features:p.split(`
`).map(g=>g.trim()).filter(Boolean)};try{const g=r.id?`/tienda/services/${r.id}`:"/tienda/services",b=r.id?"PUT":"POST";await h(g,{method:b,body:JSON.stringify(t)}),d(),s()}catch{}u(!1)};return a.jsx("div",{className:"ta-modal-overlay",onClick:t=>{t.target===t.currentTarget&&s()},children:a.jsxs("div",{className:"ta-modal",children:[a.jsxs("div",{className:"ta-modal-header",children:[a.jsx("h3",{children:r.id?"✏️ Editar servicio":"➕ Nuevo servicio"}),a.jsx("button",{className:"ta-close",onClick:s,children:"✕"})]}),a.jsx("div",{className:"ta-modal-body",children:a.jsxs("div",{className:"ta-form-grid",children:[a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Nombre *"}),a.jsx("input",{value:r.name,onChange:t=>n("name",t.target.value),placeholder:"Ej: Auditoría Completa",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Icono (emoji)"}),a.jsx("input",{value:r.icon,onChange:t=>n("icon",t.target.value),placeholder:"⚡",className:"ta-input",style:{maxWidth:100}})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Descripción corta"}),a.jsx("input",{value:r.short_desc,onChange:t=>n("short_desc",t.target.value),placeholder:"Subtítulo breve",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Descripción completa"}),a.jsx("textarea",{value:r.description,onChange:t=>n("description",t.target.value),placeholder:"Describe el servicio en detalle…",className:"ta-input ta-textarea",rows:3})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Precio (texto)"}),a.jsx("input",{value:r.price_display,onChange:t=>n("price_display",t.target.value),placeholder:"Desde €149",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Color acento"}),a.jsxs("select",{value:r.color_accent,onChange:t=>n("color_accent",t.target.value),className:"ta-input",children:[a.jsx("option",{value:"gold",children:"🟡 Gold"}),a.jsx("option",{value:"jade",children:"🟢 Jade"})]})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"CTA Texto"}),a.jsx("input",{value:r.cta_label,onChange:t=>n("cta_label",t.target.value),placeholder:"Solicitar →",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"CTA URL"}),a.jsx("input",{value:r.cta_url,onChange:t=>n("cta_url",t.target.value),placeholder:"/contacto o https://…",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Badge (opcional)"}),a.jsx("input",{value:r.badge??"",onChange:t=>n("badge",t.target.value),placeholder:"POPULAR",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Orden"}),a.jsx("input",{type:"number",value:r.sort_order??0,onChange:t=>n("sort_order",Number(t.target.value)),className:"ta-input",style:{maxWidth:100}})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Características (una por línea)"}),a.jsx("textarea",{value:p,onChange:t=>i(t.target.value),placeholder:`Análisis SEO técnico
Auditoría de conversión
Informe ejecutivo IA`,className:"ta-input ta-textarea",rows:6}),a.jsx("span",{className:"ta-hint",children:"Cada línea = una característica en la lista"})]}),a.jsx("div",{className:"ta-field ta-full ta-visible-row",children:a.jsxs("label",{className:"ta-check-label",children:[a.jsx("input",{type:"checkbox",checked:r.visible!==!1,onChange:t=>n("visible",t.target.checked)}),"Visible en la tienda pública"]})})]})}),a.jsxs("div",{className:"ta-modal-footer",children:[a.jsx("button",{className:"ta-btn-ghost",onClick:s,children:"Cancelar"}),a.jsx("button",{className:"ta-btn-primary",onClick:e,disabled:x||!r.name.trim(),children:x?"Guardando…":r.id?"💾 Guardar cambios":"➕ Crear servicio"})]})]})})}function k({show:o}){const[s,d]=l.useState([]),[r,c]=l.useState(null),[x,u]=l.useState(null),p=l.useCallback(()=>{h("/tienda/admin/services").then(e=>e.ok?e.json():[]).then(e=>d(e)).catch(()=>{})},[]);l.useEffect(()=>{p()},[p]);const i=async(e,t)=>{if(confirm(`¿Eliminar el servicio "${t}"? Esta acción no se puede deshacer.`)){u(e);try{await h(`/tienda/services/${e}`,{method:"DELETE"}),o("🗑️ Servicio eliminado"),p()}catch{o("❌ Error",!1)}u(null)}},n=async e=>{await h(`/tienda/services/${e.id}`,{method:"PUT",body:JSON.stringify({visible:!e.visible})}),p()};return a.jsxs("div",{className:"ta-section",children:[a.jsxs("div",{className:"ta-section-header",children:[a.jsx("h2",{children:"⚡ Servicios"}),a.jsx("p",{children:'Gestiona los servicios que aparecen en la pestaña "Servicios" de tu tienda pública.'}),a.jsx("button",{className:"ta-btn-primary ta-btn-sm",onClick:()=>c("new"),children:"➕ Añadir servicio"})]}),a.jsxs("div",{className:"ta-svcs-list",children:[s.map(e=>a.jsxs("div",{className:`ta-svc-row${e.visible?"":" ta-svc-hidden"}`,children:[a.jsx("div",{className:"ta-svc-icon-sm",children:e.icon}),a.jsxs("div",{className:"ta-svc-meta",children:[a.jsxs("div",{className:"ta-svc-row-name",children:[e.name,e.badge&&a.jsx("span",{className:"ta-svc-badge-sm",children:e.badge}),a.jsx("span",{className:`ta-accent-dot ${e.color_accent}`})]}),a.jsxs("div",{className:"ta-svc-row-price",children:[e.price_display," · ",Array.isArray(e.features)?e.features.length:0," características"]})]}),a.jsxs("div",{className:"ta-svc-actions",children:[a.jsx("button",{className:`ta-vis-btn${e.visible?" ta-vis-on":""}`,onClick:()=>n(e),title:e.visible?"Ocultar":"Mostrar",children:e.visible?"👁️ Visible":"🙈 Oculto"}),a.jsx("button",{className:"ta-btn-edit",onClick:()=>c(e),children:"✏️ Editar"}),a.jsx("button",{className:"ta-btn-del",onClick:()=>i(e.id,e.name),disabled:x===e.id,children:x===e.id?"…":"🗑️"})]})]},e.id)),s.length===0&&a.jsx("div",{className:"ta-empty",children:'No hay servicios. Haz clic en "Añadir servicio" para crear el primero.'})]}),r!==null&&a.jsx(N,{svc:r==="new"?null:r,onClose:()=>c(null),onSave:()=>{p(),o("✅ Servicio guardado")}})]})}function C(){const[o,s]=l.useState("shopify"),{toast:d,show:r}=v();return a.jsxs(a.Fragment,{children:[a.jsx("style",{children:w}),a.jsxs("div",{className:"ta-root",children:[a.jsxs("div",{className:"ta-top",children:[a.jsxs("div",{className:"ta-top-left",children:[a.jsx("h1",{className:"ta-title",children:"🛍️ Gestión de Tienda"}),a.jsx("p",{className:"ta-subtitle",children:"Configura Shopify, gestiona planes y servicios de tu tienda pública"})]}),a.jsx("a",{href:"/tienda",target:"_blank",className:"ta-preview-btn",children:"👁️ Ver tienda pública ↗"})]}),a.jsx("div",{className:"ta-nav",children:[{id:"shopify",label:"🛍️ Shopify Config"},{id:"planes",label:"📦 Planes"},{id:"servicios",label:"⚡ Servicios"}].map(c=>a.jsx("button",{className:`ta-nav-tab${o===c.id?" ta-nav-on":""}`,onClick:()=>s(c.id),children:c.label},c.id))}),a.jsxs("div",{className:"ta-body",children:[o==="shopify"&&a.jsx(j,{show:r}),o==="planes"&&a.jsx(y,{show:r}),o==="servicios"&&a.jsx(k,{show:r})]}),d&&a.jsx("div",{className:`ta-toast${d.ok?"":" ta-toast-err"}`,children:d.msg})]})]})}const w=`
.ta-root {
  padding: 28px 32px 60px; min-height: 100vh;
  background: var(--ink, #0a0a0c);
}
.ta-top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 28px; flex-wrap: wrap;
}
.ta-top-left { flex: 1; }
.ta-title {
  font-family: var(--fh, 'Instrument Serif', serif);
  font-size: 28px; font-weight: 400; color: #eee; margin: 0 0 6px;
}
.ta-subtitle { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0; }
.ta-preview-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: 9px;
  border: 1px solid rgba(200,168,75,0.28); background: rgba(200,168,75,0.07);
  color: rgba(200,168,75,0.9); font-size: 13px; font-weight: 600;
  text-decoration: none; white-space: nowrap; transition: all .2s;
  font-family: var(--fb, 'Geist', sans-serif);
}
.ta-preview-btn:hover { background: rgba(200,168,75,0.14); border-color: rgba(200,168,75,0.45); }

/* NAV */
.ta-nav {
  display: flex; gap: 4px; margin-bottom: 28px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 4px; width: fit-content;
}
.ta-nav-tab {
  padding: 10px 24px; border-radius: 9px; border: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
  background: transparent; color: rgba(255,255,255,0.4); transition: all .2s;
  font-family: inherit; white-space: nowrap;
}
.ta-nav-tab.ta-nav-on {
  background: rgba(200,168,75,0.14); border: 1px solid rgba(200,168,75,0.3);
  color: rgba(200,168,75,0.95);
}

/* SECTION */
.ta-section { display: flex; flex-direction: column; gap: 20px; }
.ta-section-header { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
.ta-section-header h2 {
  font-size: 18px; font-weight: 700; color: #eee; margin: 0;
}
.ta-section-header p { font-size: 13px; color: rgba(255,255,255,0.42); margin: 0; }

/* CARD */
.ta-card {
  border-radius: 16px; background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.07);
  padding: 24px;
}
.ta-info-banner {
  display: flex; gap: 12px; padding: 14px 16px; border-radius: 10px;
  background: rgba(200,168,75,0.06); border: 1px solid rgba(200,168,75,0.18);
  font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.6;
  margin-bottom: 20px;
}
.ta-info-banner span { font-size: 18px; flex-shrink: 0; }
.ta-info-banner strong { color: rgba(200,168,75,0.9); }
.ta-info-banner code {
  background: rgba(200,168,75,0.1); padding: 1px 6px; border-radius: 4px;
  font-size: 11.5px; color: rgba(200,168,75,0.85); font-family: var(--fm, monospace);
}

/* FORMS */
.ta-form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
}
.ta-field { display: flex; flex-direction: column; gap: 6px; }
.ta-full { grid-column: 1 / -1; }
.ta-half { grid-column: span 1; }
.ta-field label {
  font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5);
  text-transform: uppercase; letter-spacing: .8px;
}
.ta-input {
  width: 100%; padding: 10px 14px; border-radius: 9px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: #eee; font-size: 13.5px; font-family: inherit; outline: none;
  transition: border-color .2s; box-sizing: border-box;
}
.ta-input:focus { border-color: rgba(200,168,75,0.45); }
.ta-textarea { resize: vertical; min-height: 80px; }
.ta-hint { font-size: 11.5px; color: rgba(255,255,255,0.3); }
.ta-divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 4px 0; }
.ta-secret-wrap { position: relative; display: flex; align-items: center; }
.ta-secret-input { padding-right: 44px; }
.ta-reveal-btn {
  position: absolute; right: 10px; background: none; border: none;
  cursor: pointer; font-size: 16px; opacity: 0.6; transition: opacity .2s; padding: 4px;
}
.ta-reveal-btn:hover { opacity: 1; }
.ta-visible-row { flex-direction: row; align-items: center; }
.ta-check-label {
  display: flex; align-items: center; gap: 10px;
  font-size: 13.5px !important; color: rgba(255,255,255,0.7) !important;
  text-transform: none !important; letter-spacing: 0 !important;
  cursor: pointer;
}
.ta-check-label input { width: 16px; height: 16px; cursor: pointer; accent-color: #d4a843; }
.ta-actions { display: flex; justify-content: flex-end; margin-top: 20px; }

/* PLANS LIST */
.ta-plans-list { display: flex; flex-direction: column; gap: 12px; }
.ta-plan-row {
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 16px 20px; border-radius: 12px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07);
}
.ta-plan-row.ta-plan-featured { border-color: rgba(200,168,75,0.25); background: rgba(200,168,75,0.05); }
.ta-plan-info { min-width: 160px; }
.ta-plan-name {
  font-size: 15px; font-weight: 700; color: #eee; display: flex; align-items: center; gap: 8px;
}
.ta-feat-badge {
  padding: 2px 8px; border-radius: 5px;
  background: rgba(200,168,75,0.15); border: 1px solid rgba(200,168,75,0.3);
  font-size: 9px; font-weight: 800; color: rgba(200,168,75,0.9);
  letter-spacing: .5px; text-transform: uppercase;
}
.ta-plan-price { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
.ta-plan-url-wrap { display: flex; gap: 8px; flex: 1; min-width: 240px; }
.ta-url-input { flex: 1; }
.ta-btn-save {
  padding: 10px 16px; border-radius: 9px;
  background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.28);
  color: rgba(200,168,75,0.9); cursor: pointer; font-size: 16px;
  transition: all .2s; flex-shrink: 0;
}
.ta-btn-save:hover { background: rgba(200,168,75,0.22); }
.ta-btn-save:disabled { opacity: 0.5; cursor: default; }

/* SERVICES LIST */
.ta-svcs-list { display: flex; flex-direction: column; gap: 10px; }
.ta-svc-row {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 14px 18px; border-radius: 12px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.07);
  transition: opacity .2s;
}
.ta-svc-row.ta-svc-hidden { opacity: 0.45; }
.ta-svc-icon-sm { font-size: 22px; flex-shrink: 0; width: 36px; text-align: center; }
.ta-svc-meta { flex: 1; min-width: 160px; }
.ta-svc-row-name {
  font-size: 14px; font-weight: 700; color: #eee;
  display: flex; align-items: center; gap: 8px;
}
.ta-svc-badge-sm {
  padding: 2px 7px; border-radius: 5px; font-size: 9px; font-weight: 800;
  background: rgba(200,168,75,0.12); border: 1px solid rgba(200,168,75,0.25);
  color: rgba(200,168,75,0.85); text-transform: uppercase; letter-spacing: .5px;
}
.ta-accent-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.ta-accent-dot.gold { background: #d4a843; }
.ta-accent-dot.jade { background: #2dd49f; }
.ta-svc-row-price { font-size: 12px; color: rgba(255,255,255,0.38); margin-top: 3px; }
.ta-svc-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; flex-wrap: wrap; }
.ta-vis-btn {
  padding: 6px 12px; border-radius: 7px; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.4);
  font-size: 12px; cursor: pointer; transition: all .2s; font-family: inherit;
}
.ta-vis-btn.ta-vis-on {
  border-color: rgba(45,212,159,0.3); background: rgba(45,212,159,0.06); color: #2dd49f;
}
.ta-btn-edit {
  padding: 6px 14px; border-radius: 7px;
  border: 1px solid rgba(200,168,75,0.25); background: rgba(200,168,75,0.07);
  color: rgba(200,168,75,0.85); font-size: 12.5px; cursor: pointer;
  transition: all .2s; font-family: inherit;
}
.ta-btn-edit:hover { background: rgba(200,168,75,0.15); }
.ta-btn-del {
  padding: 6px 12px; border-radius: 7px;
  border: 1px solid rgba(232,69,88,0.2); background: rgba(232,69,88,0.04);
  color: rgba(232,69,88,0.7); font-size: 14px; cursor: pointer;
  transition: all .2s; font-family: inherit;
}
.ta-btn-del:hover { background: rgba(232,69,88,0.12); }
.ta-btn-del:disabled { opacity: 0.5; cursor: default; }

/* MODAL */
.ta-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.75); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.ta-modal {
  background: #0d0d14; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 18px; width: 100%; max-width: 620px;
  max-height: 90vh; display: flex; flex-direction: column;
  box-shadow: 0 32px 80px rgba(0,0,0,0.8);
}
.ta-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 0; flex-shrink: 0;
}
.ta-modal-header h3 {
  font-size: 17px; font-weight: 700; color: #eee; margin: 0;
}
.ta-close {
  width: 30px; height: 30px; border-radius: 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
}
.ta-modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.ta-modal-footer {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
}

/* BUTTONS */
.ta-btn-primary {
  padding: 10px 22px; border-radius: 10px;
  background: linear-gradient(135deg, #d4a843, #b8860b);
  color: #000; font-size: 13.5px; font-weight: 700;
  border: none; cursor: pointer; transition: all .2s;
  font-family: inherit;
}
.ta-btn-primary:hover { box-shadow: 0 4px 16px rgba(200,168,75,0.4); }
.ta-btn-primary:disabled { opacity: 0.5; cursor: default; }
.ta-btn-primary.ta-btn-sm { padding: 8px 16px; font-size: 13px; margin-top: 8px; align-self: flex-start; }
.ta-btn-ghost {
  padding: 10px 22px; border-radius: 10px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 13.5px; font-weight: 600;
  cursor: pointer; transition: all .2s; font-family: inherit;
}
.ta-btn-ghost:hover { background: rgba(255,255,255,0.09); }

/* EMPTY */
.ta-empty {
  padding: 36px; text-align: center;
  font-size: 14px; color: rgba(255,255,255,0.3);
  border-radius: 12px; border: 1px dashed rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.015);
}

/* TOAST */
.ta-toast {
  position: fixed; bottom: 28px; right: 28px;
  padding: 14px 22px; border-radius: 12px;
  background: rgba(30,30,40,0.96); border: 1px solid rgba(200,168,75,0.3);
  color: #eee; font-size: 14px; font-weight: 600;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6); z-index: 2000;
  animation: tsToastIn .3s ease;
}
.ta-toast.ta-toast-err { border-color: rgba(232,69,88,0.4); }
@keyframes tsToastIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .ta-root { padding: 16px; }
  .ta-form-grid { grid-template-columns: 1fr; }
  .ta-half { grid-column: 1 / -1; }
  .ta-plan-row { flex-direction: column; align-items: flex-start; }
  .ta-plan-url-wrap { width: 100%; }
  .ta-svc-actions { margin-left: 0; }
  .ta-nav { flex-direction: column; width: 100%; }
}
`;export{C as default};
