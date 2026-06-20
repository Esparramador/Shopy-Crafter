import{a as g,j as e}from"./vendor-react-D81lGkAY.js";import{g as V,P as q,ad as J,a_ as I,au as Y,c as O,V as X,a1 as K,E as Z}from"./vendor-icons-BK27OsPo.js";import"./vendor-misc-BpvVA5vv.js";import"./vendor-d3-J90V5DKO.js";import"./vendor-three-core-CfYXsIW8.js";const S="/".replace(/\/$/,""),W=["Helvetica Neue","Georgia","Playfair Display","Cormorant Garamond","Montserrat","Lora","Raleway","Merriweather","Poppins","Oswald","Roboto Slab","Source Serif 4","DM Serif Display","Crimson Text","Libre Baskerville","Work Sans","Nunito","Josefin Sans"],Q=[{id:"centered",label:"Centrado"},{id:"left-aligned",label:"Alineado izquierda"},{id:"minimal",label:"Minimalista"}],ee=[{id:"card",label:"Cards"},{id:"accent-bar",label:"Barra lateral"},{id:"minimal",label:"Minimalista"}],E={name:"",companyName:"",tagline:"",logoBase64:null,primaryColor:"#c8a84b",secondaryColor:"#08080e",accentColor:"#44cc88",textColor:"#f0f0f5",bgColor:"#08080e",cardBg:"#12121a",borderColor:"#1a1a22",headingFont:"Helvetica Neue",bodyFont:"Helvetica Neue",headingWeight:"700",coverStyle:"centered",sectionStyle:"card",footerText:"",showPageNumbers:!0,isPublic:!1};function le(){const[o,s]=g.useState([]),[c,l]=g.useState({...E}),[d,u]=g.useState(!1),[k,p]=g.useState(!1),[x,C]=g.useState(!1),[h,z]=g.useState(""),[v,w]=g.useState(""),[f,P]=g.useState(""),[$,m]=g.useState(""),[b,T]=g.useState("brand"),N=g.useRef(null);g.useEffect(()=>{fetch(`${S}/api/report-templates`,{credentials:"include"}).then(a=>a.json()).then(a=>{Array.isArray(a)&&s(a)}).catch(()=>{})},[]);const D=a=>{const i=a.target.files?.[0];if(!i)return;if(i.size>2*1024*1024){m("Logo máximo 2MB");return}if(!i.type.startsWith("image/")){m("Solo imágenes");return}const r=new FileReader;r.onload=()=>l(n=>({...n,logoBase64:r.result})),r.readAsDataURL(i)},M=async()=>{if(!(!h&&!v&&!f)){C(!0),m("");try{const i=await(await fetch(`${S}/api/report-templates/ai-suggest`,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify({url:h,instagram:v,companyName:f})})).json();if(i.suggestion){const r=i.suggestion;l(n=>({...n,companyName:r.companyName||n.companyName||f,tagline:r.tagline||n.tagline,primaryColor:r.primaryColor||n.primaryColor,secondaryColor:r.secondaryColor||n.secondaryColor,accentColor:r.accentColor||n.accentColor,textColor:r.textColor||n.textColor,bgColor:r.bgColor||n.bgColor,cardBg:r.cardBg||n.cardBg,borderColor:r.borderColor||n.borderColor,headingFont:r.headingFont||n.headingFont,bodyFont:r.bodyFont||n.bodyFont,coverStyle:r.coverStyle||n.coverStyle,sectionStyle:r.sectionStyle||n.sectionStyle})),m(`Diseño sugerido${r.reasoning?`: ${r.reasoning.slice(0,100)}`:""}`)}}catch{m("Error en sugerencia IA")}C(!1)}},U=async()=>{if(!c.name){m("Nombre requerido");return}p(!0),m("");try{const a=c.id?"PUT":"POST",i=c.id?`${S}/api/report-templates/${c.id}`:`${S}/api/report-templates`,n=await(await fetch(i,{method:a,headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(c)})).json();if(n.success){m("Plantilla guardada"),!c.id&&n.template?.id&&l(R=>({...R,id:n.template.id,shareToken:n.template.shareToken}));const A=await fetch(`${S}/api/report-templates`,{credentials:"include"}).then(R=>R.json());Array.isArray(A)&&s(A)}else m(n.error||"Error guardando")}catch{m("Error de conexión")}p(!1)},H=async a=>{confirm("¿Eliminar esta plantilla?")&&(await fetch(`${S}/api/report-templates/${a}`,{method:"DELETE",credentials:"include"}),s(i=>i.filter(r=>r.id!==a)),c.id===a&&l({...E}))},F=a=>{const i=`${window.location.origin}${S}/api/report-templates/${a}`;navigator.clipboard.writeText(i),m("Link copiado al portapapeles")},G=a=>{l({...a}),u(!0),T("brand")},_=()=>{l({...E}),u(!0),T("brand")},t=c,y=({label:a,field:i})=>e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8},children:[e.jsx("input",{type:"color",value:t[i]||"#000000",onChange:r=>l(n=>({...n,[i]:r.target.value})),style:{width:32,height:32,borderRadius:6,border:"1px solid var(--ink3)",cursor:"pointer",padding:0}}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:11,fontWeight:600,color:"var(--t)"},children:a}),e.jsx("div",{style:{fontSize:10,color:"var(--t4)",fontFamily:"monospace"},children:t[i]})]})]});return e.jsxs("div",{style:{padding:24},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:12},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12},children:[d&&e.jsx("button",{onClick:()=>u(!1),style:{width:32,height:32,borderRadius:8,border:"1px solid var(--ink3)",background:"none",color:"var(--t3)",cursor:"pointer",display:"grid",placeItems:"center"},children:e.jsx(V,{size:16})}),e.jsxs("div",{children:[e.jsx("h1",{style:{fontSize:22,fontWeight:800,color:"var(--t)",margin:0},children:"Template Studio"}),e.jsx("p",{style:{fontSize:13,color:"var(--t3)",margin:"4px 0 0"},children:"Diseña plantillas de informe con branding personalizado"})]})]}),!d&&e.jsxs("button",{onClick:_,style:{display:"flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",background:"var(--gold, #c8a84b)",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"},children:[e.jsx(q,{size:16})," Nueva Plantilla"]})]}),!d&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(min(280px, 100%), 1fr))",gap:16},children:[o.map(a=>e.jsxs("div",{className:"glass-card",style:{padding:16,cursor:"pointer"},onClick:()=>G(a),children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12},children:[a.logoBase64?e.jsx("img",{src:a.logoBase64,alt:"",style:{width:36,height:36,borderRadius:8,objectFit:"contain"}}):e.jsx("div",{style:{width:36,height:36,borderRadius:8,background:a.primaryColor||"#c8a84b",display:"grid",placeItems:"center",fontSize:16,fontWeight:800,color:"#000",flexShrink:0},children:(a.name||"T")[0]}),e.jsxs("div",{style:{minWidth:0},children:[e.jsx("div",{style:{fontSize:14,fontWeight:700,color:"var(--t)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:a.name}),e.jsx("div",{style:{fontSize:11,color:"var(--t4)"},children:a.companyName||"Sin marca"})]})]}),e.jsx("div",{style:{display:"flex",gap:4},children:[a.primaryColor,a.secondaryColor,a.accentColor,a.textColor,a.bgColor].filter(Boolean).map((i,r)=>e.jsx("div",{style:{width:20,height:20,borderRadius:4,background:i||"#333",border:"1px solid var(--ink3)"}},r))}),e.jsxs("div",{style:{display:"flex",gap:6,marginTop:12},children:[e.jsxs("button",{onClick:i=>{i.stopPropagation(),H(a.id)},style:{padding:"4px 8px",borderRadius:6,border:"1px solid var(--ink3)",background:"none",color:"var(--t4)",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:4},children:[e.jsx(J,{size:12})," Eliminar"]}),a.shareToken&&e.jsxs("button",{onClick:i=>{i.stopPropagation(),F(a.shareToken)},style:{padding:"4px 8px",borderRadius:6,border:"1px solid var(--ink3)",background:"none",color:"var(--t4)",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:4},children:[e.jsx(I,{size:12})," Compartir"]})]})]},a.id)),o.length===0&&e.jsxs("div",{className:"glass-card",style:{padding:40,textAlign:"center",gridColumn:"1 / -1"},children:[e.jsx(Y,{size:32,style:{color:"var(--t4)",marginBottom:8}}),e.jsx("div",{style:{fontSize:14,fontWeight:600,color:"var(--t3)"},children:"Sin plantillas aún"}),e.jsx("div",{style:{fontSize:12,color:"var(--t4)",marginTop:4},children:"Crea tu primera plantilla personalizada"})]})]}),d&&e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"min(360px, 100%) 1fr",gap:20},children:[e.jsxs("div",{children:[e.jsxs("div",{className:"glass-card",style:{padding:16,marginBottom:12},children:[e.jsx("input",{value:t.name,onChange:a=>l(i=>({...i,name:a.target.value})),placeholder:"Nombre de la plantilla *",style:{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:14,fontWeight:600,fontFamily:"inherit",marginBottom:8}}),e.jsx("input",{value:t.companyName,onChange:a=>l(i=>({...i,companyName:a.target.value})),placeholder:"Nombre empresa / marca",style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:12,fontFamily:"inherit",marginBottom:6}}),e.jsx("input",{value:t.tagline,onChange:a=>l(i=>({...i,tagline:a.target.value})),placeholder:"Tagline / eslogan",style:{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:12,fontFamily:"inherit"}})]}),e.jsxs("div",{className:"glass-card",style:{padding:16,marginBottom:12},children:[e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--gold, #c8a84b)",marginBottom:8,letterSpacing:"0.1em",textTransform:"uppercase"},children:"IA — Auto-diseño desde marca"}),e.jsx("input",{value:h,onChange:a=>z(a.target.value),placeholder:"https://web-de-la-marca.com",style:{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:11,fontFamily:"inherit",marginBottom:4}}),e.jsxs("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,marginBottom:8},children:[e.jsx("input",{value:v,onChange:a=>w(a.target.value),placeholder:"@instagram",style:{padding:"7px 10px",borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:11,fontFamily:"inherit"}}),e.jsx("input",{value:f,onChange:a=>P(a.target.value),placeholder:"Nombre marca",style:{padding:"7px 10px",borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:11,fontFamily:"inherit"}})]}),e.jsx("button",{onClick:M,disabled:x||!h&&!v&&!f,style:{width:"100%",padding:"8px",borderRadius:8,border:"none",background:x?"var(--ink3)":"var(--gold, #c8a84b)",color:"#000",fontSize:12,fontWeight:700,cursor:x?"wait":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6},children:x?e.jsxs(e.Fragment,{children:[e.jsx(O,{size:14,className:"animate-spin"})," Investigando marca..."]}):e.jsxs(e.Fragment,{children:[e.jsx(X,{size:14})," Auto-diseñar desde marca"]})})]}),e.jsx("div",{style:{display:"flex",gap:2,marginBottom:12,background:"var(--ink2)",borderRadius:8,padding:2},children:[["brand","Marca"],["colors","Colores"],["fonts","Fuentes"],["layout","Layout"]].map(([a,i])=>e.jsx("button",{onClick:()=>T(a),style:{flex:1,padding:"7px 0",borderRadius:6,border:"none",background:b===a?"var(--ink3)":"transparent",color:b===a?"var(--t)":"var(--t4)",fontSize:12,cursor:"pointer",fontWeight:b===a?600:400},children:i},a))}),e.jsxs("div",{className:"glass-card",style:{padding:16},children:[b==="brand"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:10},children:"LOGO"}),e.jsxs("div",{onClick:()=>N.current?.click(),style:{width:"100%",height:80,borderRadius:10,border:t.logoBase64?"2px solid var(--gold, #c8a84b)":"2px dashed var(--ink3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",marginBottom:12,background:"var(--ink1, #08080e)"},children:[t.logoBase64?e.jsx("img",{src:t.logoBase64,alt:"",style:{maxWidth:"100%",maxHeight:"100%",objectFit:"contain"}}):e.jsx("span",{style:{fontSize:12,color:"var(--t4)"},children:"Click para subir logo"}),e.jsx("input",{ref:N,type:"file",accept:"image/*",hidden:!0,onChange:D})]}),e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:8},children:"FOOTER"}),e.jsx("input",{value:t.footerText,onChange:a=>l(i=>({...i,footerText:a.target.value})),placeholder:"Texto del pie de página",style:{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:11,fontFamily:"inherit",marginBottom:8}}),e.jsxs("label",{style:{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"var(--t3)",cursor:"pointer"},children:[e.jsx("input",{type:"checkbox",checked:t.isPublic,onChange:a=>l(i=>({...i,isPublic:a.target.checked}))}),"Plantilla pública (compartible por link)"]})]}),b==="colors"&&e.jsxs(e.Fragment,{children:[e.jsx(y,{label:"Principal (títulos, acentos)",field:"primaryColor"}),e.jsx(y,{label:"Secundario (fondo cover)",field:"secondaryColor"}),e.jsx(y,{label:"Acento (positivo, badges)",field:"accentColor"}),e.jsx(y,{label:"Texto",field:"textColor"}),e.jsx(y,{label:"Fondo página",field:"bgColor"}),e.jsx(y,{label:"Fondo cards",field:"cardBg"}),e.jsx(y,{label:"Bordes",field:"borderColor"})]}),b==="fonts"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:8},children:"FUENTE TÍTULOS"}),e.jsx("select",{value:t.headingFont,onChange:a=>l(i=>({...i,headingFont:a.target.value})),style:{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:12,marginBottom:12},children:W.map(a=>e.jsx("option",{value:a,children:a},a))}),e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:8},children:"FUENTE CUERPO"}),e.jsx("select",{value:t.bodyFont,onChange:a=>l(i=>({...i,bodyFont:a.target.value})),style:{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink1, #08080e)",color:"var(--t)",fontSize:12,marginBottom:12},children:W.map(a=>e.jsx("option",{value:a,children:a},a))}),e.jsxs("div",{style:{padding:12,borderRadius:8,background:"var(--ink1, #08080e)",border:"1px solid var(--ink3)"},children:[e.jsx("div",{style:{fontFamily:t.headingFont,fontSize:16,fontWeight:Number(t.headingWeight),color:"var(--t)",marginBottom:4},children:"Vista previa de título"}),e.jsx("div",{style:{fontFamily:t.bodyFont,fontSize:12,color:"var(--t3)"},children:"Este es un ejemplo de texto de cuerpo con la fuente seleccionada."})]})]}),b==="layout"&&e.jsxs(e.Fragment,{children:[e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:8},children:"ESTILO COVER"}),e.jsx("div",{style:{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"},children:Q.map(a=>e.jsx("button",{onClick:()=>l(i=>({...i,coverStyle:a.id})),style:{flex:1,minWidth:80,padding:"8px 4px",borderRadius:6,border:t.coverStyle===a.id?`1.5px solid ${t.primaryColor}`:"1px solid var(--ink3)",background:t.coverStyle===a.id?`${t.primaryColor}15`:"transparent",color:t.coverStyle===a.id?t.primaryColor:"var(--t4)",fontSize:10,fontWeight:600,cursor:"pointer"},children:a.label},a.id))}),e.jsx("div",{style:{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:8},children:"ESTILO SECCIONES"}),e.jsx("div",{style:{display:"flex",gap:4,flexWrap:"wrap"},children:ee.map(a=>e.jsx("button",{onClick:()=>l(i=>({...i,sectionStyle:a.id})),style:{flex:1,minWidth:80,padding:"8px 4px",borderRadius:6,border:t.sectionStyle===a.id?`1.5px solid ${t.primaryColor}`:"1px solid var(--ink3)",background:t.sectionStyle===a.id?`${t.primaryColor}15`:"transparent",color:t.sectionStyle===a.id?t.primaryColor:"var(--t4)",fontSize:10,fontWeight:600,cursor:"pointer"},children:a.label},a.id))})]})]}),e.jsxs("div",{style:{display:"flex",gap:8,marginTop:12},children:[e.jsxs("button",{onClick:U,disabled:k,style:{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px",borderRadius:10,border:"none",background:"var(--gold, #c8a84b)",color:"#000",fontSize:13,fontWeight:700,cursor:"pointer"},children:[k?e.jsx(O,{size:14,className:"animate-spin"}):e.jsx(K,{size:14})," Guardar"]}),e.jsx("button",{onClick:()=>u(!1),style:{padding:"10px 16px",borderRadius:10,border:"1px solid var(--ink3)",background:"none",color:"var(--t4)",fontSize:12,cursor:"pointer"},children:"Cerrar"})]}),c.shareToken&&c.isPublic&&e.jsxs("div",{style:{marginTop:8,padding:8,borderRadius:8,background:"var(--ink2)",display:"flex",alignItems:"center",gap:8},children:[e.jsx(I,{size:12,style:{color:"var(--t4)",flexShrink:0}}),e.jsx("span",{style:{fontSize:10,color:"var(--t4)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:"Link público disponible"}),e.jsx("button",{onClick:()=>F(c.shareToken),style:{padding:"3px 8px",borderRadius:4,border:"1px solid var(--ink3)",background:"none",color:"var(--gold, #c8a84b)",fontSize:10,cursor:"pointer",whiteSpace:"nowrap"},children:"Copiar"})]}),$&&e.jsx("div",{style:{marginTop:8,fontSize:12,color:$.includes("guardada")||$.includes("copiado")||$.includes("sugerido")?"var(--accent, #44cc88)":"#ff6666",textAlign:"center"},children:$})]}),e.jsxs("div",{className:"glass-card",style:{padding:0,overflow:"hidden",maxHeight:"calc(100vh - 140px)",display:"flex",flexDirection:"column"},children:[e.jsxs("div",{style:{padding:8,borderBottom:"1px solid var(--ink3)",display:"flex",alignItems:"center",gap:8,flexShrink:0},children:[e.jsx(Z,{size:14,style:{color:"var(--t4)"}}),e.jsx("span",{style:{fontSize:11,fontWeight:600,color:"var(--t3)"},children:"Preview en tiempo real"})]}),e.jsx("iframe",{srcDoc:ie(t),sandbox:"allow-same-origin",style:{width:"100%",flex:1,border:"none",minHeight:400},title:"Template Preview"})]})]})]})}function B(o){return o.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const ae=/^#[0-9a-fA-F]{3,8}$/;function j(o,s){return ae.test(o)?o:s}function L(o){return o.replace(/[^a-zA-Z0-9 ]/g,"")}function ie(o){const s=j(o.primaryColor,"#c8a84b"),c=j(o.secondaryColor,"#08080e"),l=j(o.accentColor,"#44cc88"),d=j(o.textColor,"#f0f0f5"),u=j(o.bgColor,"#08080e"),k=j(o.cardBg,"#12121a"),p=j(o.borderColor,"#1a1a22"),x=L(o.headingFont),C=L(o.bodyFont),h=/^[0-9]{3}$/.test(o.headingWeight)?o.headingWeight:"700",z=B(o.companyName||"Nombre de Empresa"),v=o.tagline?B(o.tagline):"",w=B(o.footerText||o.companyName||"Generado con ShopyCrafter"),f=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"});return`<!DOCTYPE html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(x)}:wght@400;600;700&family=${encodeURIComponent(C)}:wght@300;400;500;600&display=swap">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'${C}',sans-serif;background:${u};color:${d};font-size:13px}
.page{min-height:45vh;position:relative}
.cover{background:${c};padding:60px 40px;text-align:${o.coverStyle==="left-aligned"?"left":"center"};min-height:50vh;display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid ${p}}
.cover-logo{max-width:80px;max-height:80px;border-radius:12px;margin-bottom:16px;${o.coverStyle==="centered"?"margin-left:auto;margin-right:auto;":""}}
.cover h1{font-family:'${x}',serif;font-size:24px;font-weight:${h};color:${s};letter-spacing:2px;text-transform:uppercase;margin-bottom:6px}
.cover p{font-size:13px;color:${d}80}
.cover .company{font-size:12px;color:${s}60;letter-spacing:2px;text-transform:uppercase;margin-top:12px}
.body{padding:32px}
.section{margin-bottom:24px}
.section-title{font-family:'${x}',serif;font-size:16px;font-weight:${h};color:${s};margin-bottom:12px;${o.sectionStyle==="accent-bar"?`border-left:3px solid ${s};padding-left:12px`:""}}
.card{background:${k};border:1px solid ${p};border-radius:10px;padding:16px;margin-bottom:10px}
.metrics{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.metric{flex:1;min-width:60px;text-align:center;background:${k};border:1px solid ${p};border-radius:10px;padding:16px}
.metric .val{font-size:28px;font-weight:800;color:${s}}
.metric .lbl{font-size:10px;color:${d}60;margin-top:2px}
.rec{background:${k};border-left:3px solid ${l};padding:12px;margin-bottom:6px;border-radius:0 8px 8px 0;font-size:12px}
.grade{display:inline-block;padding:3px 10px;border-radius:5px;font-weight:700;font-size:12px;background:${l}20;color:${l}}
.footer{text-align:center;padding:20px;border-top:1px solid ${p};font-size:11px;color:${d}40}
.backcover{background:${c};padding:60px 40px;text-align:center;min-height:40vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border-top:3px solid ${s}}
.backcover .logo-back{max-width:60px;max-height:60px;border-radius:10px;margin-bottom:16px;opacity:0.9}
.backcover .company-name{font-family:'${x}',serif;font-size:18px;font-weight:${h};color:${s};letter-spacing:3px;text-transform:uppercase;margin-bottom:6px}
.backcover .tagline-back{font-size:12px;color:${d}60;margin-bottom:20px}
.backcover .contact-line{font-size:11px;color:${d}40;margin-bottom:4px}
.placeholder{border:1.5px dashed ${s}40;border-radius:8px;padding:10px 14px;color:${d}40;font-size:11px;font-style:italic;text-align:center;margin-bottom:8px}
.page-divider{border:none;border-top:1px dashed ${p};margin:32px 0;position:relative}
.page-divider::after{content:'nueva pagina';position:absolute;top:-8px;left:50%;transform:translateX(-50%);background:${u};padding:0 12px;font-size:9px;color:${d}25;text-transform:uppercase;letter-spacing:2px}
.toc-item{display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px dotted ${p};font-size:12px}
.toc-item .toc-title{color:${d}}
.toc-item .toc-page{color:${s};font-weight:600}
</style></head><body>

<!-- PORTADA -->
<div class="cover page">
${o.logoBase64&&o.logoBase64.startsWith("data:image/")?`<img class="cover-logo" src="${o.logoBase64}" alt="Logo">`:""}
<h1 style="color:${s}">Titulo del Informe</h1>
<p>Subtitulo o descripcion del informe</p>
<div class="company">${z}</div>
${v?`<p style="font-size:11px;color:${d}40;margin-top:6px">${v}</p>`:""}
<p style="font-size:10px;color:${d}30;margin-top:12px">${f}</p>
</div>

<hr class="page-divider">

<!-- INDICE -->
<div class="body page">
<div class="section">
<div class="section-title">Indice</div>
<div class="card">
<div class="toc-item"><span class="toc-title">1. Resumen Ejecutivo</span><span class="toc-page">3</span></div>
<div class="toc-item"><span class="toc-title">2. Metricas Principales</span><span class="toc-page">4</span></div>
<div class="toc-item"><span class="toc-title">3. Analisis Detallado</span><span class="toc-page">5</span></div>
<div class="toc-item"><span class="toc-title">4. Distribucion y Resultados</span><span class="toc-page">6</span></div>
<div class="toc-item"><span class="toc-title">5. Recomendaciones</span><span class="toc-page">7</span></div>
<div class="toc-item"><span class="toc-title">6. Conclusiones</span><span class="toc-page">8</span></div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- RESUMEN EJECUTIVO -->
<div class="body page">
<div class="section">
<div class="section-title">1. Resumen Ejecutivo</div>
<div class="card">
<p style="color:${d}80;line-height:1.6;margin-bottom:8px">Este espacio contendra un resumen general del informe adaptado al tipo de analisis realizado. Se rellenara automaticamente con los datos reales del proyecto.</p>
<div class="placeholder">Contenido dinamico del resumen</div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- METRICAS -->
<div class="body page">
<div class="section">
<div class="section-title">2. Metricas Principales</div>
<div class="metrics">
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 1</div></div>
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 2</div></div>
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 3</div></div>
<div class="metric"><div class="val">--</div><div class="lbl">Metrica 4</div></div>
</div>
<div class="placeholder">Las metricas se adaptan al tipo de informe: SEO, ventas, inventario, competencia, etc.</div>
</div>
</div>

<hr class="page-divider">

<!-- ANALISIS DETALLADO -->
<div class="body page">
<div class="section">
<div class="section-title">3. Analisis Detallado</div>
<div class="card">
<p style="font-weight:600;color:${s};margin-bottom:4px">Seccion de datos</p>
<p style="color:${d}60;font-size:12px;line-height:1.5;margin-bottom:8px">Aqui se mostraran tablas, graficos o listas con el desglose detallado de los datos analizados.</p>
<div class="placeholder">Tablas / graficos / listas dinamicas</div>
</div>
<div class="card">
<p style="font-weight:600;color:${s};margin-bottom:4px">Observaciones</p>
<p style="color:${d}60;font-size:12px;line-height:1.5">Notas y observaciones generadas a partir del analisis de los datos.</p>
</div>
</div>
</div>

<hr class="page-divider">

<!-- DISTRIBUCION -->
<div class="body page">
<div class="section">
<div class="section-title">4. Distribucion y Resultados</div>
<div class="card">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="grade">A</span><div style="flex:1;height:6px;background:${p};border-radius:3px;overflow:hidden"><div style="width:35%;height:100%;background:${l};border-radius:3px"></div></div><span style="font-size:11px">Excelente</span></div>
<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="grade" style="background:${s}20;color:${s}">B</span><div style="flex:1;height:6px;background:${p};border-radius:3px;overflow:hidden"><div style="width:45%;height:100%;background:${s};border-radius:3px"></div></div><span style="font-size:11px">Bueno</span></div>
<div style="display:flex;align-items:center;gap:8px"><span class="grade" style="background:#ffa50020;color:#ffa500">C</span><div style="flex:1;height:6px;background:${p};border-radius:3px;overflow:hidden"><div style="width:20%;height:100%;background:#ffa500;border-radius:3px"></div></div><span style="font-size:11px">Mejorable</span></div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- RECOMENDACIONES -->
<div class="body page">
<div class="section">
<div class="section-title">5. Recomendaciones</div>
<div class="rec">Recomendacion prioritaria 1 — se generara automaticamente</div>
<div class="rec">Recomendacion prioritaria 2 — basada en los datos analizados</div>
<div class="rec">Recomendacion prioritaria 3 — con impacto estimado</div>
<div class="placeholder">Las recomendaciones se generan con IA segun el tipo de informe</div>
</div>
</div>

<hr class="page-divider">

<!-- CONCLUSIONES -->
<div class="body page">
<div class="section">
<div class="section-title">6. Conclusiones</div>
<div class="card">
<p style="color:${d}80;line-height:1.6">Seccion de conclusiones finales con un resumen de los hallazgos principales y proximos pasos recomendados para el cliente.</p>
<div class="placeholder">Conclusiones generadas automaticamente</div>
</div>
</div>
</div>

<hr class="page-divider">

<!-- CONTRAPORTADA -->
<div class="backcover page">
${o.logoBase64&&o.logoBase64.startsWith("data:image/")?`<img class="logo-back" src="${o.logoBase64}" alt="Logo">`:`<div style="width:50px;height:50px;border-radius:10px;background:${s};margin-bottom:16px;display:grid;place-items:center;font-size:20px;font-weight:800;color:${c}">${(o.companyName||"E")[0].toUpperCase()}</div>`}
<div class="company-name">${z}</div>
${v?`<div class="tagline-back">${v}</div>`:""}
<div style="width:40px;height:2px;background:${s};margin:16px auto"></div>
<div class="contact-line">www.ejemplo.com</div>
<div class="contact-line">contacto@ejemplo.com</div>
<div class="contact-line" style="margin-top:12px;font-size:10px;color:${d}25">Documento confidencial · ${f}</div>
</div>

<div class="footer">${w}${o.showPageNumbers?" · Pagina 1 de 8":""}</div>
</body></html>`}export{le as default};
