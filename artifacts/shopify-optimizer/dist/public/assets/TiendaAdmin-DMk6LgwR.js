import{r as p,j as a}from"./vendor-react-DqW1pDqK.js";const v="/".replace(/\/$/,"")??"",j={id:"",name:"",price:0,priceAnnual:0,currency:"€",period:"/mes",featured:!1,badge:"",featuresText:"",ctaLabel:"Contactar →",ctaStyle:"ghost",ctaHref:"#fp-contact",storesLimit:1,imagesIncluded:10,shopify_checkout_url:""},y={name:"",description:"",short_desc:"",icon:"⚡",price_display:"",features:[],cta_label:"Solicitar →",cta_url:"",badge:"",color_accent:"gold",sort_order:0,visible:!0};function b(o,c){return fetch(`${v}/api${o}`,{credentials:"include",headers:{"Content-Type":"application/json",...c?.headers??{}},...c})}function N(){const[o,c]=p.useState(null),u=p.useCallback((n,d=!0)=>{c({msg:n,ok:d}),setTimeout(()=>c(null),3200)},[]);return{toast:o,show:u}}function k({show:o}){const[c,u]=p.useState({}),[n,d]=p.useState(!1),[s,m]=p.useState({});p.useEffect(()=>{b("/tienda/settings").then(t=>t.ok?t.json():{}).then(t=>u(t)).catch(()=>{})},[]);const h=async()=>{d(!0);try{(await b("/tienda/settings",{method:"PUT",body:JSON.stringify(c)})).ok?o("✅ Configuración guardada"):o("❌ Error al guardar",!1)}catch{o("❌ Error de red",!1)}d(!1)},x=(t,r)=>u(i=>({...i,[t]:r})),l=t=>m(r=>({...r,[t]:!r[t]}));return a.jsxs("div",{className:"ta-section",children:[a.jsxs("div",{className:"ta-section-header",children:[a.jsx("h2",{children:"🛍️ Configuración de tu Tienda Shopify"}),a.jsx("p",{children:"Conecta tu tienda Shopify para procesar pagos y vincular los planes con productos reales."})]}),a.jsxs("div",{className:"ta-card",children:[a.jsxs("div",{className:"ta-info-banner",children:[a.jsx("span",{children:"ℹ️"}),a.jsxs("div",{children:[a.jsx("strong",{children:"¿Cómo funciona?"})," Configura las credenciales de tu tienda Shopify. Las URLs de checkout de cada plan se configuran en la pestaña ",a.jsx("strong",{children:"Planes"}),". Los clientes serán redirigidos a tu Shopify para pagar de forma segura."]})]}),a.jsxs("div",{className:"ta-form-grid",children:[a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Nombre de la tienda"}),a.jsx("input",{value:c.store_name??"",onChange:t=>x("store_name",t.target.value),placeholder:"Shopy Crafter",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Dominio Shopify"}),a.jsx("input",{value:c.shopify_domain??"",onChange:t=>x("shopify_domain",t.target.value),placeholder:"tutienda.myshopify.com",className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"Solo el dominio, sin https://"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Checkout URL Base (opcional)"}),a.jsx("input",{value:c.checkout_url_prefix??"",onChange:t=>x("checkout_url_prefix",t.target.value),placeholder:"https://tutienda.myshopify.com/cart/",className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"URL base para redirigir clientes al checkout"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Moneda"}),a.jsxs("select",{value:c.currency??"EUR",onChange:t=>x("currency",t.target.value),className:"ta-input",children:[a.jsx("option",{value:"EUR",children:"EUR — Euro"}),a.jsx("option",{value:"USD",children:"USD — Dólar"}),a.jsx("option",{value:"GBP",children:"GBP — Libra"}),a.jsx("option",{value:"MXN",children:"MXN — Peso Mexicano"})]})]}),a.jsx("div",{className:"ta-divider ta-full"}),["storefront_access_token","admin_api_key","admin_api_secret"].map(t=>{const r={storefront_access_token:"Storefront Access Token",admin_api_key:"Admin API Key",admin_api_secret:"Admin API Secret"},i={storefront_access_token:"Para el Storefront API (lectura pública de productos)",admin_api_key:"Para el Admin API (gestión avanzada)",admin_api_secret:"Secret compartido para webhooks de Shopify"};return a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:r[t]}),a.jsxs("div",{className:"ta-secret-wrap",children:[a.jsx("input",{type:s[t]?"text":"password",value:c[t]??"",onChange:e=>x(t,e.target.value),placeholder:"••••••••••••••••",className:"ta-input ta-secret-input"}),a.jsx("button",{className:"ta-reveal-btn",onClick:()=>l(t),children:s[t]?"🙈":"👁️"})]}),a.jsx("span",{className:"ta-hint",children:i[t]})]},t)})]}),a.jsx("div",{className:"ta-actions",children:a.jsx("button",{className:"ta-btn-primary",onClick:h,disabled:n,children:n?"Guardando…":"💾 Guardar configuración"})})]})]})}function S({plan:o,onClose:c,onSave:u,show:n}){const d=!o?.id||o.id==="__new__",[s,m]=p.useState(o??j),[h,x]=p.useState(!1),l=(i,e)=>m(g=>({...g,[i]:e})),t=()=>s.featuresText.split(`
`).map(i=>i.trim()).filter(Boolean).map(i=>{const e=i.startsWith("-");return{text:e?i.slice(1).trim():i,included:!e}}),r=async()=>{if(s.name.trim()&&!(d&&!s.id.trim())){x(!0);try{const i={id:s.id.trim(),name:s.name.trim(),price:Number(s.price),priceAnnual:Number(s.priceAnnual),currency:s.currency||"€",period:s.period||"/mes",featured:!!s.featured,badge:s.badge.trim()||null,features:t(),ctaLabel:s.ctaLabel||"Contactar →",ctaStyle:s.ctaStyle||"ghost",ctaHref:s.ctaHref||"#fp-contact",storesLimit:Number(s.storesLimit),imagesIncluded:Number(s.imagesIncluded)};let e=!1;d?e=(await b("/billing/plans",{method:"POST",body:JSON.stringify(i)})).ok:e=(await b(`/billing/plans/${s.id}`,{method:"PUT",body:JSON.stringify(i)})).ok,e&&s.shopify_checkout_url!==void 0&&await b(`/tienda/plans/${s.id}/checkout-url`,{method:"PUT",body:JSON.stringify({shopify_checkout_url:s.shopify_checkout_url||null})}),e?(u(),c()):n("❌ Error al guardar el plan",!1)}catch{n("❌ Error de red",!1)}x(!1)}};return a.jsx("div",{className:"ta-modal-overlay",onClick:i=>{i.target===i.currentTarget&&c()},children:a.jsxs("div",{className:"ta-modal",style:{maxWidth:680},children:[a.jsxs("div",{className:"ta-modal-header",children:[a.jsx("h3",{children:d?"➕ Nuevo plan":`✏️ Editar plan — ${o?.name}`}),a.jsx("button",{className:"ta-close",onClick:c,children:"✕"})]}),a.jsx("div",{className:"ta-modal-body",children:a.jsxs("div",{className:"ta-form-grid",children:[a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"ID único *"}),a.jsx("input",{value:s.id,onChange:i=>l("id",i.target.value.toLowerCase().replace(/\s+/g,"_")),placeholder:"emprendedor",className:"ta-input",disabled:!d}),a.jsx("span",{className:"ta-hint",children:"Solo letras, números y guiones bajos. No editable después."})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Nombre visible *"}),a.jsx("input",{value:s.name,onChange:i=>l("name",i.target.value),placeholder:"Emprendedor",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Precio mensual (€)"}),a.jsx("input",{type:"number",min:0,value:s.price,onChange:i=>l("price",i.target.value),className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Precio anual (€)"}),a.jsx("input",{type:"number",min:0,value:s.priceAnnual,onChange:i=>l("priceAnnual",i.target.value),className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Moneda"}),a.jsxs("select",{value:s.currency,onChange:i=>l("currency",i.target.value),className:"ta-input",children:[a.jsx("option",{value:"€",children:"€ Euro"}),a.jsx("option",{value:"$",children:"$ Dólar"}),a.jsx("option",{value:"£",children:"£ Libra"})]})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Badge (opcional)"}),a.jsx("input",{value:s.badge,onChange:i=>l("badge",i.target.value),placeholder:"Más popular",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"CTA texto"}),a.jsx("input",{value:s.ctaLabel,onChange:i=>l("ctaLabel",i.target.value),placeholder:"Contactar →",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"CTA estilo"}),a.jsxs("select",{value:s.ctaStyle,onChange:i=>l("ctaStyle",i.target.value),className:"ta-input",children:[a.jsx("option",{value:"ghost",children:"Ghost (borde dorado)"}),a.jsx("option",{value:"gold",children:"Gold (fondo dorado)"})]})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"CTA enlace"}),a.jsx("input",{value:s.ctaHref,onChange:i=>l("ctaHref",i.target.value),placeholder:"#fp-contact o /client/messages",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Límite de tiendas"}),a.jsx("input",{type:"number",min:-1,value:s.storesLimit,onChange:i=>l("storesLimit",i.target.value),className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"-1 = ilimitado"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Imágenes IA incluidas"}),a.jsx("input",{type:"number",min:-1,value:s.imagesIncluded,onChange:i=>l("imagesIncluded",i.target.value),className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"-1 = ilimitado"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"URL Checkout Shopify"}),a.jsx("input",{value:s.shopify_checkout_url,onChange:i=>l("shopify_checkout_url",i.target.value),placeholder:"https://tutienda.myshopify.com/cart/12345:1",className:"ta-input"}),a.jsx("span",{className:"ta-hint",children:"Redirige al cliente a Shopify para pagar"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Características (una por línea · prefija con - para excluida)"}),a.jsx("textarea",{value:s.featuresText,onChange:i=>l("featuresText",i.target.value),placeholder:`5 productos/mes
10 imágenes IA/mes
SEO básico
- A/B Testing`,className:"ta-input ta-textarea",rows:7}),a.jsx("span",{className:"ta-hint",children:"Líneas sin guión = incluidas ✓ · Con guión = excluidas ✕"})]}),a.jsx("div",{className:"ta-field ta-full ta-visible-row",children:a.jsxs("label",{className:"ta-check-label",children:[a.jsx("input",{type:"checkbox",checked:s.featured,onChange:i=>l("featured",i.target.checked)}),'Plan destacado (aparece como "Más popular" con borde dorado)']})})]})}),a.jsxs("div",{className:"ta-modal-footer",children:[a.jsx("button",{className:"ta-btn-ghost",onClick:c,children:"Cancelar"}),a.jsx("button",{className:"ta-btn-primary",onClick:r,disabled:h||!s.name.trim()||d&&!s.id.trim(),children:h?"Guardando…":d?"➕ Crear plan":"💾 Guardar cambios"})]})]})})}function C({show:o}){const[c,u]=p.useState([]),[n,d]=p.useState(null),[s,m]=p.useState(null),[h,x]=p.useState(!0),l=e=>{if(!e)return"";const g=typeof e=="string"?JSON.parse(e):e;return Array.isArray(g)?g.map(f=>f.included!==!1?f.text:`- ${f.text}`).join(`
`):""},t=p.useCallback(()=>{x(!0),b("/billing/plans").then(e=>e.ok?e.json():[]).then(e=>{u(e),x(!1)}).catch(()=>x(!1))},[]);p.useEffect(()=>{t()},[t]);const r=e=>{const g={id:String(e.id),name:e.name,price:e.price,priceAnnual:Number(e.priceAnnual??e.price_annual??e.price*10),currency:e.currency??"€",period:e.period??"/mes",featured:!!e.featured,badge:e.badge??"",featuresText:l(e.features),ctaLabel:e.ctaLabel??e.cta_label??"Contactar →",ctaStyle:e.ctaStyle??e.cta_style??"ghost",ctaHref:e.ctaHref??e.cta_href??"#fp-contact",storesLimit:Number(e.storesLimit??e.stores_limit??1),imagesIncluded:Number(e.imagesIncluded??e.images_included??10),shopify_checkout_url:e.shopify_checkout_url??""};d(g)},i=async(e,g)=>{if(confirm(`¿Ocultar el plan "${g}"? Dejará de aparecer en la tienda pero no se elimina de la base de datos.`)){m(e);try{(await b(`/billing/plans/${e}`,{method:"DELETE"})).ok?(o(`🗑️ Plan "${g}" ocultado`),t()):o("❌ Error al ocultar el plan",!1)}catch{o("❌ Error de red",!1)}m(null)}};return a.jsxs("div",{className:"ta-section",children:[a.jsxs("div",{className:"ta-section-header",children:[a.jsx("h2",{children:"📦 Planes de suscripción"}),a.jsxs("p",{children:["Crea, edita u oculta los planes que aparecen en la ",a.jsx("strong",{children:"landing"})," (sección Precios) y en la ",a.jsx("strong",{children:"tienda del cliente"}),"."]}),a.jsx("button",{className:"ta-btn-primary ta-btn-sm",onClick:()=>d("new"),children:"➕ Crear plan"})]}),a.jsxs("div",{className:"ta-info-banner",children:[a.jsx("span",{children:"💡"}),a.jsxs("div",{children:["Los planes activos se publican automáticamente en la landing y en el panel del cliente. Asigna una ",a.jsx("strong",{children:"URL de checkout Shopify"})," para activar el botón de pago directo."]})]}),h?a.jsx("div",{className:"ta-empty",children:"Cargando planes…"}):a.jsxs("div",{className:"ta-plans-list",children:[c.map(e=>a.jsxs("div",{className:`ta-plan-row${e.featured?" ta-plan-featured":""}`,children:[a.jsxs("div",{className:"ta-plan-info",children:[a.jsxs("div",{className:"ta-plan-name",children:[e.featured&&a.jsx("span",{className:"ta-feat-badge",children:"★ DESTACADO"}),e.name,a.jsxs("span",{className:"ta-plan-id",children:["#",e.id]})]}),a.jsxs("div",{className:"ta-plan-price",children:[e.currency??"€",e.price,"/mes · ",e.currency??"€",e.priceAnnual??e.price_annual??e.price*10,"/año",e.shopify_checkout_url&&a.jsx("span",{className:"ta-shopify-pill",children:"🛍️ Shopify"})]})]}),a.jsxs("div",{className:"ta-svc-actions",children:[a.jsx("button",{className:"ta-btn-edit",onClick:()=>r(e),children:"✏️ Editar"}),a.jsx("button",{className:"ta-btn-del",onClick:()=>i(String(e.id),e.name),disabled:s===String(e.id),title:"Ocultar plan (soft delete)",children:s===String(e.id)?"…":"🗑️"})]})]},e.id)),c.length===0&&a.jsx("div",{className:"ta-empty",children:'No hay planes visibles. Crea el primero con "➕ Crear plan".'})]}),n!==null&&a.jsx(S,{plan:n==="new"?null:n,onClose:()=>d(null),onSave:()=>{t(),o("✅ Plan guardado correctamente")},show:o})]})}function w({svc:o,onClose:c,onSave:u}){const[n,d]=p.useState(o??y),[s,m]=p.useState(!1),[h,x]=p.useState((o?.features??[]).join(`
`)),l=(r,i)=>d(e=>({...e,[r]:i})),t=async()=>{if(!n.name.trim())return;m(!0);const r={...n,features:h.split(`
`).map(i=>i.trim()).filter(Boolean)};try{const i=n.id?`/tienda/services/${n.id}`:"/tienda/services",e=n.id?"PUT":"POST";await b(i,{method:e,body:JSON.stringify(r)}),u(),c()}catch{}m(!1)};return a.jsx("div",{className:"ta-modal-overlay",onClick:r=>{r.target===r.currentTarget&&c()},children:a.jsxs("div",{className:"ta-modal",children:[a.jsxs("div",{className:"ta-modal-header",children:[a.jsx("h3",{children:n.id?"✏️ Editar servicio":"➕ Nuevo servicio"}),a.jsx("button",{className:"ta-close",onClick:c,children:"✕"})]}),a.jsx("div",{className:"ta-modal-body",children:a.jsxs("div",{className:"ta-form-grid",children:[a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Nombre *"}),a.jsx("input",{value:n.name,onChange:r=>l("name",r.target.value),placeholder:"Ej: Auditoría Completa",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Icono (emoji)"}),a.jsx("input",{value:n.icon,onChange:r=>l("icon",r.target.value),placeholder:"⚡",className:"ta-input",style:{maxWidth:100}})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Descripción corta"}),a.jsx("input",{value:n.short_desc,onChange:r=>l("short_desc",r.target.value),placeholder:"Subtítulo breve",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Descripción completa"}),a.jsx("textarea",{value:n.description,onChange:r=>l("description",r.target.value),placeholder:"Describe el servicio en detalle…",className:"ta-input ta-textarea",rows:3})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Precio (texto)"}),a.jsx("input",{value:n.price_display,onChange:r=>l("price_display",r.target.value),placeholder:"Desde €149",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Color acento"}),a.jsxs("select",{value:n.color_accent,onChange:r=>l("color_accent",r.target.value),className:"ta-input",children:[a.jsx("option",{value:"gold",children:"🟡 Gold"}),a.jsx("option",{value:"jade",children:"🟢 Jade"})]})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"CTA Texto"}),a.jsx("input",{value:n.cta_label,onChange:r=>l("cta_label",r.target.value),placeholder:"Solicitar →",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"CTA URL"}),a.jsx("input",{value:n.cta_url,onChange:r=>l("cta_url",r.target.value),placeholder:"/contacto o https://…",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Badge (opcional)"}),a.jsx("input",{value:n.badge??"",onChange:r=>l("badge",r.target.value),placeholder:"POPULAR",className:"ta-input"})]}),a.jsxs("div",{className:"ta-field ta-half",children:[a.jsx("label",{children:"Orden"}),a.jsx("input",{type:"number",value:n.sort_order??0,onChange:r=>l("sort_order",Number(r.target.value)),className:"ta-input",style:{maxWidth:100}})]}),a.jsxs("div",{className:"ta-field ta-full",children:[a.jsx("label",{children:"Características (una por línea)"}),a.jsx("textarea",{value:h,onChange:r=>x(r.target.value),placeholder:`Análisis SEO técnico
Auditoría de conversión
Informe ejecutivo IA`,className:"ta-input ta-textarea",rows:6}),a.jsx("span",{className:"ta-hint",children:"Cada línea = una característica en la lista"})]}),a.jsx("div",{className:"ta-field ta-full ta-visible-row",children:a.jsxs("label",{className:"ta-check-label",children:[a.jsx("input",{type:"checkbox",checked:n.visible!==!1,onChange:r=>l("visible",r.target.checked)}),"Visible en la tienda pública"]})})]})}),a.jsxs("div",{className:"ta-modal-footer",children:[a.jsx("button",{className:"ta-btn-ghost",onClick:c,children:"Cancelar"}),a.jsx("button",{className:"ta-btn-primary",onClick:t,disabled:s||!n.name.trim(),children:s?"Guardando…":n.id?"💾 Guardar cambios":"➕ Crear servicio"})]})]})})}function _({show:o}){const[c,u]=p.useState([]),[n,d]=p.useState(null),[s,m]=p.useState(null),h=p.useCallback(()=>{b("/tienda/admin/services").then(t=>t.ok?t.json():[]).then(t=>u(t)).catch(()=>{})},[]);p.useEffect(()=>{h()},[h]);const x=async(t,r)=>{if(confirm(`¿Eliminar el servicio "${r}"? Esta acción no se puede deshacer.`)){m(t);try{await b(`/tienda/services/${t}`,{method:"DELETE"}),o("🗑️ Servicio eliminado"),h()}catch{o("❌ Error",!1)}m(null)}},l=async t=>{await b(`/tienda/services/${t.id}`,{method:"PUT",body:JSON.stringify({visible:!t.visible})}),h()};return a.jsxs("div",{className:"ta-section",children:[a.jsxs("div",{className:"ta-section-header",children:[a.jsx("h2",{children:"⚡ Servicios"}),a.jsx("p",{children:'Gestiona los servicios que aparecen en la pestaña "Servicios" de tu tienda pública.'}),a.jsx("button",{className:"ta-btn-primary ta-btn-sm",onClick:()=>d("new"),children:"➕ Añadir servicio"})]}),a.jsxs("div",{className:"ta-svcs-list",children:[c.map(t=>a.jsxs("div",{className:`ta-svc-row${t.visible?"":" ta-svc-hidden"}`,children:[a.jsx("div",{className:"ta-svc-icon-sm",children:t.icon}),a.jsxs("div",{className:"ta-svc-meta",children:[a.jsxs("div",{className:"ta-svc-row-name",children:[t.name,t.badge&&a.jsx("span",{className:"ta-svc-badge-sm",children:t.badge}),a.jsx("span",{className:`ta-accent-dot ${t.color_accent}`})]}),a.jsxs("div",{className:"ta-svc-row-price",children:[t.price_display," · ",Array.isArray(t.features)?t.features.length:0," características"]})]}),a.jsxs("div",{className:"ta-svc-actions",children:[a.jsx("button",{className:`ta-vis-btn${t.visible?" ta-vis-on":""}`,onClick:()=>l(t),title:t.visible?"Ocultar":"Mostrar",children:t.visible?"👁️ Visible":"🙈 Oculto"}),a.jsx("button",{className:"ta-btn-edit",onClick:()=>d(t),children:"✏️ Editar"}),a.jsx("button",{className:"ta-btn-del",onClick:()=>x(t.id,t.name),disabled:s===t.id,children:s===t.id?"…":"🗑️"})]})]},t.id)),c.length===0&&a.jsx("div",{className:"ta-empty",children:'No hay servicios. Haz clic en "Añadir servicio" para crear el primero.'})]}),n!==null&&a.jsx(w,{svc:n==="new"?null:n,onClose:()=>d(null),onSave:()=>{h(),o("✅ Servicio guardado")}})]})}function z(){const[o,c]=p.useState("shopify"),{toast:u,show:n}=N();return a.jsxs(a.Fragment,{children:[a.jsx("style",{children:A}),a.jsxs("div",{className:"ta-root",children:[a.jsxs("div",{className:"ta-top",children:[a.jsxs("div",{className:"ta-top-left",children:[a.jsx("h1",{className:"ta-title",children:"🛍️ Gestión de Tienda"}),a.jsx("p",{className:"ta-subtitle",children:"Configura Shopify, gestiona planes y servicios de tu tienda pública"})]}),a.jsx("a",{href:"/tienda",target:"_blank",className:"ta-preview-btn",children:"👁️ Ver tienda pública ↗"})]}),a.jsx("div",{className:"ta-nav",children:[{id:"shopify",label:"🛍️ Shopify Config"},{id:"planes",label:"📦 Planes"},{id:"servicios",label:"⚡ Servicios"}].map(d=>a.jsx("button",{className:`ta-nav-tab${o===d.id?" ta-nav-on":""}`,onClick:()=>c(d.id),children:d.label},d.id))}),a.jsxs("div",{className:"ta-body",children:[o==="shopify"&&a.jsx(k,{show:n}),o==="planes"&&a.jsx(C,{show:n}),o==="servicios"&&a.jsx(_,{show:n})]}),u&&a.jsx("div",{className:`ta-toast${u.ok?"":" ta-toast-err"}`,children:u.msg})]})]})}const A=`
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
.ta-plan-info { min-width: 180px; flex: 1; }
.ta-plan-name {
  font-size: 15px; font-weight: 700; color: #eee; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ta-plan-id {
  font-size: 10px; color: rgba(255,255,255,0.25); font-family: var(--fm, monospace);
  background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;
}
.ta-feat-badge {
  padding: 2px 8px; border-radius: 5px;
  background: rgba(200,168,75,0.15); border: 1px solid rgba(200,168,75,0.3);
  font-size: 9px; font-weight: 800; color: rgba(200,168,75,0.9);
  letter-spacing: .5px; text-transform: uppercase;
}
.ta-plan-price {
  font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.ta-shopify-pill {
  font-size: 10px; padding: 2px 8px; border-radius: 99px;
  background: rgba(120,190,120,0.1); border: 1px solid rgba(120,190,120,0.25);
  color: #78be78;
}
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
`;export{z as default};
