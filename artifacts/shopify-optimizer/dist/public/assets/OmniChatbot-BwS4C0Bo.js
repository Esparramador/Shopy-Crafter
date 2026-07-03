import{r as x,j as a}from"./vendor-react-CiHIQUdJ.js";import{u as $o}from"./index--UY1P80h.js";import{a as qa}from"./vendor-router-KkoYwRXb.js";import{u as jo}from"./useSafeTimeout-CQVM6XO0.js";import{u as So}from"./use-draggable-DDTH-Hp1.js";import{g as Ra}from"./model-aliases-Bs0HuOXz.js";import{B as Ye,aS as ko,c0 as Co,bd as _o,bC as Io,X as ma,as as Oa,aE as Va,aK as Ha,aq as wo,c as Da,V as Ao,p as To,c1 as Eo,aO as Po,O as zo,aU as Ro,c2 as Oo,c3 as Do,b3 as Mo,G as Ka,E as No,ax as Lo,ao as Ma,ak as Na,Z as La,m as Go}from"./vendor-icons-CXMfDF-R.js";import"./vendor-drei-Cs5N-oGV.js";import"./vendor-misc-B0iHhAMp.js";import"./vendor-three-core-CfYXsIW8.js";import"./vendor-three-fiber-yQ1sJu-R.js";import"./vendor-query-BGnHanJw.js";import"./vendor-radix-BGVlstJy.js";const pa=768;function Ya(){const[d,g]=x.useState(void 0);return x.useEffect(()=>{const p=window.matchMedia(`(max-width: ${pa-1}px)`),l=()=>{g(window.innerWidth<pa)};return p.addEventListener("change",l),g(window.innerWidth<pa),()=>p.removeEventListener("change",l)},[]),!!d}const G="/".replace(/\/$/,"");function Ne(d){return d>=1e3?`${(d/1e3).toFixed(1)}k`:String(d)}function Ga(d){return d<1e-4?"$0.00":d<.01?`$${d.toFixed(4)}`:`$${d.toFixed(3)}`}function ie(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}function Ja(d){const g=d.toLowerCase();return g.includes("instagram.com")?{type:"social_instagram",icon:a.jsx(Ro,{size:12}),label:"Instagram"}:g.includes("facebook.com")||g.includes("fb.com")?{type:"social_facebook",icon:a.jsx(Oo,{size:12}),label:"Facebook"}:g.includes("twitter.com")||g.includes("x.com")?{type:"social_x",icon:a.jsx(Do,{size:12}),label:"X / Twitter"}:g.includes("youtube.com")||g.includes("youtu.be")?{type:"youtube",icon:a.jsx(Mo,{size:12}),label:"YouTube"}:{type:"url",icon:a.jsx(Ka,{size:12}),label:"Web URL"}}const Fa=/https?:\/\/[^\s\])"'>]+/g;function Fo({src:d,alt:g}){const p=()=>{const j=document.createElement("a");j.href=d,j.download="gemini-imagen.png",document.body.appendChild(j),j.click(),document.body.removeChild(j)},l=()=>{const j=window.open("","_blank","noopener,noreferrer");if(j){j.opener=null;const _=j.document;_.title="Gemini Image";const f=_.createElement("style");f.textContent="body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;}img{max-width:100vw;max-height:100vh;object-fit:contain;}",_.head.appendChild(f);const S=_.createElement("img");S.src=d,S.alt=g,_.body.appendChild(S)}};return a.jsxs("div",{style:{margin:"10px 0",display:"inline-block",maxWidth:"100%"},children:[a.jsx("img",{src:d,alt:g,style:{maxWidth:"100%",maxHeight:400,borderRadius:8,display:"block",border:"1px solid var(--ink3)",cursor:"pointer"},onClick:l,title:"Haz clic para ver en pantalla completa"}),a.jsxs("div",{style:{display:"flex",gap:6,marginTop:6},children:[a.jsx("button",{onClick:p,style:{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--ink3)",background:"var(--ink2)",color:"var(--t)",cursor:"pointer",display:"flex",alignItems:"center",gap:4},children:"⬇ Descargar"}),a.jsx("button",{onClick:l,style:{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--ink3)",background:"var(--ink2)",color:"var(--t)",cursor:"pointer",display:"flex",alignItems:"center",gap:4},children:"⛶ Pantalla completa"})]})]})}function ua(d,g){return d.split(/(\*\*[^*]+\*\*|`[^`]+`|_[^_\n]+_|\n|https?:\/\/[^\s\])"'>]+)/g).map((l,j)=>{const _=`s${g}-${j}`;return l.startsWith("**")&&l.endsWith("**")?a.jsx("strong",{style:{color:"var(--gold)",fontWeight:700},children:l.slice(2,-2)},_):l.startsWith("`")&&l.endsWith("`")?a.jsx("code",{style:{background:"var(--ink3)",padding:"1px 5px",borderRadius:4,fontSize:11,fontFamily:"monospace",color:"var(--jade)"},children:l.slice(1,-1)},_):l.startsWith("_")&&l.endsWith("_")?a.jsx("em",{style:{opacity:.75,fontStyle:"italic"},children:l.slice(1,-1)},_):l===`
`?a.jsx("br",{},_):Fa.test(l)?(Fa.lastIndex=0,a.jsx("a",{href:l,target:"_blank",rel:"noreferrer",style:{color:"var(--gold)",textDecoration:"underline",wordBreak:"break-all"},onClick:f=>f.stopPropagation(),children:l},_)):l})}const Ua=/\[VIDEO:([^\]]*)\]\(((?:https?:\/\/|\/api\/)[^)]{4,})\)/g;function Uo({src:d,label:g}){return a.jsxs("div",{style:{margin:"10px 0"},children:[a.jsx("video",{controls:!0,src:d,style:{maxWidth:"100%",maxHeight:360,borderRadius:8,border:"1px solid var(--ink3)",display:"block",background:"#000"}}),a.jsxs("div",{style:{display:"flex",gap:6,marginTop:6},children:[a.jsx("a",{href:d,download:!0,target:"_blank",rel:"noreferrer",style:{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--ink3)",background:"var(--ink2)",color:"var(--t)",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4,textDecoration:"none"},children:"⬇ Descargar vídeo"}),a.jsx("a",{href:d,target:"_blank",rel:"noreferrer",style:{fontSize:11,padding:"3px 10px",borderRadius:5,border:"1px solid var(--ink3)",background:"var(--ink2)",color:"var(--t)",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4,textDecoration:"none"},children:"⛶ Pantalla completa"})]})]})}const Ba=/!\[([^\]]*)\]\(((?:data:|https?:\/\/)[^)]{4,})\)/g;function Bo(d){const g=[];Ua.lastIndex=0;let p;for(;(p=Ua.exec(d))!==null;)g.push({index:p.index,length:p[0].length,node:a.jsx(Uo,{src:p[2],label:p[1]||"Vídeo IA"},`vid-${p.index}`)});for(Ba.lastIndex=0;(p=Ba.exec(d))!==null;)g.push({index:p.index,length:p[0].length,node:a.jsx(Fo,{src:p[2],alt:p[1]||"Imagen generada"},`img-${p.index}`)});if(g.length===0)return ua(d,0);g.sort((f,S)=>f.index-S.index);const l=[];let j=0,_=0;for(const f of g)f.index>j&&l.push(...ua(d.slice(j,f.index),_++)),l.push(f.node),j=f.index+f.length;return j<d.length&&l.push(...ua(d.slice(j),_)),l}function Wa(){const d=window.SpeechRecognition||window.webkitSpeechRecognition;if(!d)return null;const g=new d;return g.lang="es-ES",g.continuous=!1,g.interimResults=!0,g.maxAlternatives=1,g}const Wo=new Set(["audit_store","full_audit","scan_store","complete_audit","bulk_optimize","setup_store","analyze_external_store"]),qo=new Set(["list_products","list_all_products","search_product","audit_store","scan_store","full_audit","complete_audit","optimize_product","redesign_product","bulk_optimize","analyze_external_store"]);function Vo(d){const g=[],p=d.imageCount??0,l=d.descriptionLength??d.descLength??0,j=d.tagsCount??0,_=d.hasComparePrice??d.hasCompare??!1;return p===0?g.push({dim:"Imagenes",icon:"📷",status:"bad",what:"0 imagenes",why:"Sin imagenes el producto no genera confianza",impact:"+80% conversion con galeria"}):p<4?g.push({dim:"Imagenes",icon:"📷",status:"warn",what:`${p} imagen${p>1?"es":""}`,why:`Añadir ${4-p} mas (Hero, Lifestyle, Detalle)`,impact:"+30-50% conversion"}):p<8?g.push({dim:"Imagenes",icon:"📷",status:"warn",what:`${p} imagenes`,why:"Ampliar a 8+ con variantes y close-ups",impact:"+15-25% conversion"}):g.push({dim:"Imagenes",icon:"📷",status:"ok",what:`${p} imagenes`,why:"Galeria completa y profesional",impact:"Confianza maximizada"}),l<200?g.push({dim:"Descripcion",icon:"📝",status:"bad",what:`${l}ch — muy corta`,why:"Añadir beneficios, FAQ, trust signals",impact:"+40% SEO + conversion"}):l<500?g.push({dim:"Descripcion",icon:"📝",status:"warn",what:`${l}ch`,why:"Ampliar con secciones de uso y FAQ",impact:"+20-30% conversion"}):l<1e3?g.push({dim:"Descripcion",icon:"📝",status:"warn",what:`${l}ch`,why:"Añadir storytelling y garantias",impact:"+10-15% conversion"}):g.push({dim:"Descripcion",icon:"📝",status:"ok",what:`${l}ch`,why:"Descripcion completa y detallada",impact:"SEO optimizado"}),j<5?g.push({dim:"Tags",icon:"🏷",status:"bad",what:`${j} tags`,why:"Añadir 10+ tags para busqueda interna",impact:"+25% descubrimiento"}):j<10?g.push({dim:"Tags",icon:"🏷",status:"warn",what:`${j} tags`,why:"Añadir tags de material, uso, estilo",impact:"+15% descubrimiento"}):g.push({dim:"Tags",icon:"🏷",status:"ok",what:`${j} tags`,why:"Taxonomia completa",impact:"Busqueda optimizada"}),_?g.push({dim:"Precio",icon:"💰",status:"ok",what:"Precio tachado activo",why:"Estrategia de anclaje de precio",impact:"Urgencia activada"}):g.push({dim:"Precio",icon:"💰",status:"warn",what:"Sin compare_at_price",why:"Precio tachado aumenta urgencia de compra",impact:"+15-25% conversion"}),d.hasMetaTitle===!1&&g.push({dim:"SEO Title",icon:"🔍",status:"warn",what:"Meta title debil",why:"Keyword-first con <60ch para CTR",impact:"+20% clicks organicos"}),d.hasMetaDesc===!1&&g.push({dim:"SEO Desc",icon:"🔍",status:"warn",what:"Meta descripcion corta",why:"Añadir 155ch con CTA y beneficio",impact:"+15% CTR"}),d.hasAltTexts===!1&&g.push({dim:"Alt Texts",icon:"🖼",status:"warn",what:"Imagenes sin alt text",why:"Esencial para SEO de imagenes",impact:"+10% trafico organico"}),d.cleanHandle===!1&&g.push({dim:"Handle",icon:"🔗",status:"warn",what:"URL no optimizada",why:"Usar guiones, keywords, sin underscores",impact:"+5% SEO"}),g}function Ho({products:d}){const[g,p]=x.useState(!1),[l,j]=x.useState(null),_=g?d:d.slice(0,4),f=y=>y==="A"?"#34d399":y==="B"?"#c8a84b":y==="C"?"#f59e0b":"#f43f5e",S=y=>y==="A"?"rgba(52,211,153,.1)":y==="B"?"rgba(200,168,75,.1)":y==="C"?"rgba(245,158,11,.1)":"rgba(244,63,94,.1)",P=y=>y?a.jsx("span",{style:{color:"#34d399",fontSize:10},children:"✓"}):a.jsx("span",{style:{color:"#f59e0b",fontSize:10},children:"⚠"}),B=y=>y>=8?a.jsx("span",{style:{color:"#fbbf24",fontSize:10},children:"★"}):y>=4?a.jsx("span",{style:{color:"#34d399",fontSize:10},children:"✓"}):a.jsx("span",{style:{color:"#f43f5e",fontSize:10},children:"⚠"}),ee=y=>y==="ok"?"#34d399":y==="warn"?"#f59e0b":"#f43f5e";return a.jsxs("div",{style:{marginTop:10},children:[a.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(140px, 100%), 1fr))",gap:8},children:_.map((y,V)=>{const U=y.auditGrade||y.grade||"D",L=y.auditScore??y.score??0,K=y.imageCount??0,ve=y.descriptionLength??y.descLength??0,xe=y.tagsCount??0,ue=y.variantCount??1,fe=y.hasComparePrice??y.hasCompare??!1,Y=parseFloat(y.price||"0"),$e=Vo(y),R=l===V;return a.jsxs("div",{style:{background:"var(--ink2)",border:"1px solid var(--ink3)",borderRadius:10,overflow:"hidden",position:"relative",cursor:"pointer",gridColumn:R?"1 / -1":void 0},onClick:()=>j(R?null:V),children:[a.jsx("div",{style:{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg, transparent, ${f(U)}66, transparent)`}}),a.jsxs("div",{style:{display:"flex",gap:8,padding:8},children:[y.imageUrl?a.jsx("div",{style:{width:48,height:48,borderRadius:6,overflow:"hidden",flexShrink:0,background:"var(--ink3)",border:"1px solid var(--ink3)"},children:a.jsx("img",{src:y.imageUrl,alt:y.title,style:{width:"100%",height:"100%",objectFit:"cover"},onError:J=>{J.target.style.display="none"}})}):a.jsx("div",{style:{width:48,height:48,borderRadius:6,flexShrink:0,background:"var(--ink3)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t4)",fontSize:18},children:"📷"}),a.jsxs("div",{style:{flex:1,minWidth:0},children:[a.jsx("div",{style:{fontSize:10,fontWeight:700,color:"var(--t1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},children:y.title}),a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:4,marginTop:2},children:[a.jsx("span",{style:{display:"inline-block",padding:"1px 5px",borderRadius:4,fontSize:9,fontWeight:800,color:f(U),background:S(U),border:`1px solid ${f(U)}33`},children:U}),a.jsxs("span",{style:{fontSize:9,color:"var(--t4)"},children:[L,"/100"]}),Y>0&&a.jsxs("span",{style:{fontSize:9,fontWeight:700,color:"var(--t2)"},children:[Y.toFixed(2),"€"]}),y.compareAtPrice&&a.jsxs("span",{style:{fontSize:8,color:"var(--t4)",textDecoration:"line-through"},children:[parseFloat(y.compareAtPrice).toFixed(2),"€"]})]})]})]}),a.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:4,padding:"0 8px 4px",fontSize:9,color:"var(--t3)"},children:[a.jsxs("span",{children:[B(K)," ",K,"img"]}),a.jsxs("span",{children:[P(ve>=500)," ",ve,"ch"]}),a.jsxs("span",{children:[P(xe>=10)," ",xe,"tags"]}),a.jsxs("span",{children:[P(fe)," cmp"]}),a.jsxs("span",{children:[ue,"var"]}),y.published===!1&&a.jsx("span",{style:{color:"#f43f5e",fontWeight:700},children:"NO PUB"})]}),a.jsxs("div",{style:{display:"flex",flexWrap:"wrap",gap:3,padding:"0 8px 4px",fontSize:8,color:"var(--t4)"},children:[a.jsx("span",{style:{opacity:.7},children:"SEO:"}),a.jsxs("span",{children:[P(y.hasMetaTitle!==!1)," title"]}),a.jsxs("span",{children:[P(y.hasMetaDesc!==!1)," desc"]}),a.jsxs("span",{children:[P(y.hasSchema!==!1)," schema"]}),a.jsxs("span",{children:[P(y.hasAltTexts!==!1)," alts"]}),a.jsxs("span",{children:[P(y.cleanHandle!==!1)," handle"]}),a.jsxs("span",{children:[B(K)," imgs"]})]}),y.issues&&y.issues.length>0&&a.jsxs("div",{style:{padding:"0 8px 4px",fontSize:8,color:"#f59e0b"},children:["⚠ ",y.issues.slice(0,2).join(" · ")]}),R&&a.jsxs("div",{style:{padding:"4px 8px 8px",borderTop:"1px solid var(--ink3)"},children:[a.jsx("div",{style:{fontSize:8,fontWeight:700,color:"var(--t2)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.5px"},children:"Recomendaciones por dimension"}),$e.map((J,Q)=>a.jsxs("div",{style:{display:"flex",gap:4,padding:"3px 0",borderBottom:Q<$e.length-1?"1px solid var(--ink3)":"none"},children:[a.jsx("span",{style:{fontSize:10,flexShrink:0},children:J.icon}),a.jsxs("div",{style:{flex:1,minWidth:0},children:[a.jsxs("div",{style:{fontSize:8,fontWeight:700,color:ee(J.status)},children:[J.dim,": ",J.what]}),a.jsx("div",{style:{fontSize:7,color:"var(--t3)"},children:J.why})]}),a.jsx("span",{style:{fontSize:7,color:ee(J.status),fontWeight:700,flexShrink:0,whiteSpace:"nowrap"},children:J.impact})]},Q))]}),a.jsx("div",{style:{padding:"2px 8px 4px",textAlign:"center",fontSize:7,color:"var(--t4)",opacity:.6},children:R?"▲ Cerrar":"▼ Ver recomendaciones"})]},V)})}),d.length>4&&a.jsx("button",{onClick:()=>p(!g),style:{display:"block",width:"100%",marginTop:6,padding:"4px 0",background:"var(--ink3)",border:"1px solid var(--ink3)",borderRadius:6,color:"var(--t3)",fontSize:9,cursor:"pointer",textAlign:"center"},children:g?"Mostrar menos":`Ver ${d.length-4} productos más`})]})}function Ko(d,g){if(!qo.has(d)||!g||typeof g!="object")return null;const p=g,l=p.products;return l&&Array.isArray(l)&&l.length>0?l:p.title&&typeof p.title=="string"&&(p.auditScore!==void 0||p.score!==void 0||p.auditGrade!==void 0||p.grade!==void 0)?[p]:null}function Yo({actionName:d,content:g,rawData:p,isMobile:l}){const[j,_]=x.useState("idle"),[f,S]=x.useState("idle"),[P,B]=x.useState("idle"),ee=jo(),[y]=qa(),V=parseInt(y.match(/\/projects\/(\d+)/)?.[1]??"1",10),U=d.replace(/_/g," ").replace(/\b\w/g,Y=>Y.toUpperCase()),L=Wo.has(d),K=async()=>{_("loading");try{(await fetch(`${G}/api/projects/${V}/actions/send`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({actionName:d,title:U,content:g,rawData:p})})).ok?_("done"):_("error")}catch{_("error")}ee(()=>_("idle"),3e3)},ve=async()=>{S("loading");try{(await fetch(`${G}/api/projects/${V}/actions/save`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({actionName:d,title:U,content:g,rawData:p})})).ok?S("done"):S("error")}catch{S("error")}ee(()=>S("idle"),3e3)},xe=async()=>{B("loading");try{const Y=L?"zip":void 0,$e=await fetch(`${G}/api/projects/${V}/actions/download`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({actionName:d,title:U,content:g,rawData:p,downloadType:Y})});if($e.ok){const R=await $e.blob(),J=URL.createObjectURL(R),Q=document.createElement("a");Q.href=J;const Je=L?"zip":"html";Q.download=`${d}_${new Date().toISOString().split("T")[0]}.${Je}`,Q.click(),URL.revokeObjectURL(J),B("done")}else B("error")}catch{B("error")}ee(()=>B("idle"),3e3)},ue={flex:1,padding:l?"7px 8px":"6px 10px",borderRadius:7,fontSize:l?11:10,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4,transition:"all .15s",border:"1px solid",minWidth:0},fe=Y=>Y==="loading"?"⏳":Y==="done"?"✅":Y==="error"?"❌":null;return a.jsxs("div",{style:{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"},children:[a.jsxs("button",{onClick:K,disabled:j==="loading",style:{...ue,background:"rgba(59,130,246,0.08)",borderColor:"rgba(59,130,246,0.25)",color:"#60a5fa"},children:[fe(j)||"📧"," ",j==="loading"?"Enviando...":j==="done"?"Enviado":"Enviar"]}),a.jsxs("button",{onClick:ve,disabled:f==="loading",style:{...ue,background:"rgba(52,211,153,0.08)",borderColor:"rgba(52,211,153,0.25)",color:"#34d399"},children:[fe(f)||"💾"," ",f==="loading"?"Guardando...":f==="done"?"Guardado":"Guardar"]}),a.jsxs("button",{onClick:xe,disabled:P==="loading",style:{...ue,background:"rgba(200,168,75,0.08)",borderColor:"rgba(200,168,75,0.25)",color:"#c8a84b"},children:[fe(P)||"📥"," ",P==="loading"?"Preparando...":P==="done"?"Descargado":L?"Descargar ZIP":"Descargar"]})]})}function Jo({data:d}){const[g,p]=x.useState(!1),l=d.analysis,j=[{key:"visual_composition",label:"Composición Visual",icon:a.jsx(No,{size:10})},{key:"colors_palette",label:"Paleta de Colores",icon:a.jsx(Lo,{size:10})},{key:"textures_surfaces",label:"Texturas & Superficies",icon:a.jsx(Ma,{size:10})},{key:"topology_geometry",label:"Topología & Geometría",icon:a.jsx(Ma,{size:10})},{key:"rendering_production",label:"Rendering & Producción",icon:a.jsx(Na,{size:10})},{key:"technical_chemical_composition",label:"Composición Técnica/Química",icon:a.jsx(Na,{size:10})},{key:"brand_marketing_intelligence",label:"Inteligencia de Marca",icon:a.jsx(La,{size:10})},{key:"ecommerce_conversion_signals",label:"Señales eCommerce",icon:a.jsx(La,{size:10})},{key:"actionable_insights_for_shopify",label:"Insights eCommerce",icon:a.jsx(Ye,{size:10})}].filter(_=>l[_.key]);return a.jsxs("div",{style:{marginTop:10,border:"1px solid rgba(45,212,159,0.25)",borderRadius:10,overflow:"hidden"},children:[a.jsxs("div",{style:{background:"rgba(45,212,159,0.06)",padding:"10px 13px",borderBottom:"1px solid rgba(45,212,159,0.15)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[a.jsxs("div",{children:[a.jsx("p",{style:{margin:0,fontSize:11,fontWeight:700,color:"var(--jade)"},children:"🧠 Absorbido a Shopy Crafter"}),a.jsxs("p",{style:{margin:"2px 0 0",fontSize:9,color:"var(--t3)"},children:[d.title," · ",d.sourceType]})]}),a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6},children:[a.jsx(Go,{size:14,style:{color:"var(--jade)"}}),a.jsx("button",{onClick:()=>p(!g),style:{background:"var(--ink3)",border:"none",color:"var(--t3)",cursor:"pointer",fontSize:9,padding:"2px 6px",borderRadius:4},children:g?"Ocultar":`Ver análisis (${j.length} dimensiones)`})]})]}),g&&a.jsxs("div",{style:{padding:10},children:[j.map(_=>{const f=l[_.key],S=typeof f=="string"?f:JSON.stringify(f,null,2);return a.jsxs("div",{style:{marginBottom:8,padding:"7px 10px",background:"var(--ink2)",borderRadius:6,border:"1px solid var(--ink3)"},children:[a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:4,marginBottom:4,color:"var(--gold)"},children:[_.icon,a.jsx("span",{style:{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"},children:_.label})]}),a.jsx("pre",{style:{margin:0,fontSize:9,color:"var(--t3)",whiteSpace:"pre-wrap",lineHeight:1.5,fontFamily:"monospace",maxHeight:120,overflowY:"auto"},children:S.slice(0,600)})]},_.key)}),!!d.highlights?.marketingAngles&&a.jsxs("div",{style:{padding:"7px 10px",background:"rgba(200,168,75,0.06)",borderRadius:6,border:"1px solid rgba(200,168,75,0.2)"},children:[a.jsx("p",{style:{margin:"0 0 4px",fontSize:9,fontWeight:700,color:"var(--gold)",textTransform:"uppercase"},children:"💡 Marketing Angles"}),(Array.isArray(d.highlights.marketingAngles)?d.highlights.marketingAngles:[d.highlights.marketingAngles]).map((_,f)=>a.jsxs("p",{style:{margin:"2px 0",fontSize:10,color:"var(--t2)"},children:["· ",String(_)]},f))]})]})]})}function Qo({data:d}){const[g,p]=x.useState("overview"),l=d.profile,j=[{id:"overview",label:"📊 Overview"},{id:"social",label:"📱 Social"},{id:"products",label:"🛍️ Productos"},{id:"competitors",label:"⚔️ Competencia"},{id:"pricing",label:"💰 Pricing & Ads"},{id:"opportunities",label:"🚀 Oportunidades"},{id:"sources",label:`🔗 Fuentes (${d.sourcesFound})`}],_=l.sentiment?.overall==="positive"?"var(--jade)":l.sentiment?.overall==="negative"?"#ff6b6b":"var(--gold)";return a.jsxs("div",{style:{marginTop:10,border:"1px solid rgba(200,168,75,0.35)",borderRadius:12,overflow:"hidden",fontSize:10},children:[a.jsxs("div",{style:{background:"linear-gradient(135deg, rgba(200,168,75,0.12), rgba(200,168,75,0.04))",padding:"10px 12px",borderBottom:"1px solid rgba(200,168,75,0.2)"},children:[a.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"},children:[a.jsxs("div",{children:[a.jsxs("p",{style:{margin:0,fontSize:12,fontWeight:800,color:"var(--gold)"},children:["🔬 ",d.entity]}),a.jsxs("p",{style:{margin:"2px 0 0",fontSize:9,color:"var(--t3)"},children:[l.entityType," · ",l.ecommerceStack?.platform??"Plataforma desconocida"," · ",l.ecommerceStack?.emailTool??""]})]}),a.jsxs("div",{style:{textAlign:"right"},children:[a.jsxs("p",{style:{margin:0,fontSize:9,color:"var(--jade)",fontWeight:700},children:[d.queriesExecuted??12," búsquedas · ",d.dimensionsResearched??12," dimensiones"]}),a.jsxs("p",{style:{margin:"1px 0 0",fontSize:9,color:"var(--t4)"},children:[d.sourcesFound," fuentes · ",d.elapsed]})]})]}),l.description&&a.jsx("p",{style:{margin:"6px 0 0",fontSize:10,color:"var(--t2)",lineHeight:1.4},children:l.description}),a.jsxs("div",{style:{display:"flex",gap:8,marginTop:7,flexWrap:"wrap"},children:[l.pricing?.strategy&&a.jsxs("span",{style:{padding:"2px 7px",background:"rgba(200,168,75,0.1)",border:"1px solid rgba(200,168,75,0.25)",borderRadius:20,color:"var(--gold)",fontSize:9,fontWeight:700},children:[l.pricing.strategy," · ",l.pricing.avgTicket]}),l.sentiment?.overall&&a.jsxs("span",{style:{padding:"2px 7px",background:"rgba(0,0,0,0.2)",border:`1px solid ${_}`,borderRadius:20,color:_,fontSize:9,fontWeight:700},children:[l.sentiment.overall==="positive"?"😊":l.sentiment.overall==="negative"?"😠":"😐"," sentimiento ",l.sentiment.overall]}),l.confidenceLevel&&a.jsxs("span",{style:{padding:"2px 7px",background:"rgba(45,212,159,0.06)",border:"1px solid rgba(45,212,159,0.2)",borderRadius:20,color:"var(--jade)",fontSize:9},children:["confianza: ",l.confidenceLevel]})]})]}),a.jsx("div",{style:{display:"flex",overflowX:"auto",borderBottom:"1px solid var(--ink3)",background:"var(--ink2)"},children:j.map(f=>a.jsx("button",{onClick:()=>p(f.id),style:{flexShrink:0,padding:"6px 10px",background:"none",border:"none",cursor:"pointer",fontSize:9,fontWeight:g===f.id?700:400,color:g===f.id?"var(--gold)":"var(--t3)",borderBottom:g===f.id?"2px solid var(--gold)":"2px solid transparent",transition:"0.15s"},children:f.label},f.id))}),a.jsxs("div",{style:{padding:10,maxHeight:260,overflowY:"auto"},children:[g==="overview"&&a.jsxs("div",{children:[l.differentiators&&l.differentiators.length>0&&a.jsxs("div",{style:{marginBottom:8},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--gold)",fontSize:9,textTransform:"uppercase"},children:"Diferenciadores clave"}),l.differentiators.slice(0,5).map((f,S)=>a.jsxs("p",{style:{margin:"2px 0",color:"var(--t2)"},children:["· ",f]},S))]}),l.marketingChannels&&l.marketingChannels.length>0&&a.jsxs("div",{style:{marginBottom:8},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--gold)",fontSize:9,textTransform:"uppercase"},children:"Canales de marketing"}),a.jsx("div",{style:{display:"flex",flexWrap:"wrap",gap:4},children:l.marketingChannels.map((f,S)=>a.jsx("span",{style:{padding:"1px 6px",background:"var(--ink3)",borderRadius:3,color:"var(--t3)"},children:f},S))})]}),l.visualIdentity&&a.jsxs("div",{children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--gold)",fontSize:9,textTransform:"uppercase"},children:"Identidad visual"}),a.jsx("p",{style:{margin:0,color:"var(--t2)"},children:l.visualIdentity.style}),l.visualIdentity.primaryColors?.length>0&&a.jsx("div",{style:{display:"flex",gap:4,marginTop:4},children:l.visualIdentity.primaryColors.slice(0,6).map((f,S)=>a.jsx("span",{style:{padding:"2px 6px",background:"var(--ink3)",borderRadius:3,fontSize:9,color:"var(--t2)"},children:f},S))})]})]}),g==="social"&&a.jsxs("div",{children:[l.socialProfiles&&Object.entries(l.socialProfiles).filter(([,f])=>f&&f!=="N/A"&&f!=="Unknown").map(([f,S])=>a.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid var(--ink3)"},children:[a.jsxs("span",{style:{color:"var(--gold)",fontWeight:700,textTransform:"capitalize"},children:["📲 ",f]}),a.jsx("a",{href:S.startsWith("http")?S:`https://${S}`,target:"_blank",rel:"noreferrer",style:{color:"var(--jade)",fontSize:9,textDecoration:"none",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:S})]},f)),l.socialMetrics&&a.jsx("div",{style:{marginTop:8},children:Object.entries(l.socialMetrics).filter(([,f])=>f&&f!=="Unknown").map(([f,S])=>a.jsxs("div",{style:{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid var(--ink3)"},children:[a.jsx("span",{style:{color:"var(--t3)",textTransform:"capitalize"},children:f.replace(/([A-Z])/g," $1").toLowerCase()}),a.jsx("span",{style:{color:"var(--t2)",fontWeight:600},children:typeof S=="object"?JSON.stringify(S).slice(0,60):String(S)})]},f))})]}),g==="products"&&a.jsx("div",{children:l.products&&l.products.length>0?l.products.map((f,S)=>a.jsxs("div",{style:{padding:"6px 8px",background:"var(--ink2)",borderRadius:6,marginBottom:5,border:"1px solid var(--ink3)"},children:[a.jsxs("div",{style:{display:"flex",justifyContent:"space-between"},children:[a.jsx("span",{style:{fontWeight:700,color:"var(--t)"},children:f.name}),a.jsx("span",{style:{color:"var(--gold)",fontSize:9},children:f.priceRange})]}),a.jsxs("p",{style:{margin:"2px 0 0",color:"var(--t3)",fontSize:9},children:[f.category," · ",f.keyFeature]})]},S)):a.jsx("p",{style:{color:"var(--t4)"},children:"No se encontraron productos específicos."})}),g==="competitors"&&a.jsxs("div",{children:[l.competitors&&l.competitors.length>0?l.competitors.map((f,S)=>a.jsxs("div",{style:{padding:"6px 8px",background:"var(--ink2)",borderRadius:6,marginBottom:5,border:"1px solid var(--ink3)"},children:[a.jsxs("div",{style:{display:"flex",justifyContent:"space-between"},children:[a.jsxs("span",{style:{fontWeight:700,color:"var(--t)"},children:["⚔️ ",f.name]}),f.url&&a.jsx("a",{href:f.url,target:"_blank",rel:"noreferrer",style:{fontSize:9,color:"var(--jade)",textDecoration:"none"},children:"ver →"})]}),f.advantage&&a.jsxs("p",{style:{margin:"2px 0 0",color:"var(--t3)",fontSize:9},children:["ventaja: ",f.advantage]})]},S)):a.jsx("p",{style:{color:"var(--t4)"},children:"No se identificaron competidores."}),l.sentiment&&a.jsxs("div",{style:{marginTop:8,padding:"7px 10px",background:"rgba(45,212,159,0.05)",borderRadius:6,border:"1px solid rgba(45,212,159,0.15)"},children:[a.jsx("p",{style:{margin:"0 0 5px",fontWeight:700,color:"var(--jade)",textTransform:"uppercase",fontSize:9},children:"💬 Sentimiento clientes"}),l.sentiment.topCompliments?.slice(0,3).map((f,S)=>a.jsxs("p",{style:{margin:"2px 0",color:"var(--t2)",fontSize:9},children:["✅ ",f]},S)),l.sentiment.topComplaints?.slice(0,3).map((f,S)=>a.jsxs("p",{style:{margin:"2px 0",color:"#ff6b6b",fontSize:9},children:["⚠️ ",f]},S))]})]}),g==="pricing"&&a.jsxs("div",{children:[l.pricing&&a.jsxs("div",{style:{marginBottom:8,padding:"7px 10px",background:"rgba(200,168,75,0.06)",borderRadius:6,border:"1px solid rgba(200,168,75,0.2)"},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--gold)",fontSize:9,textTransform:"uppercase"},children:"💰 Estrategia de precios"}),a.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:[l.pricing.strategy&&a.jsxs("span",{style:{fontSize:9,color:"var(--t2)"},children:["Estrategia: ",a.jsx("b",{children:l.pricing.strategy})]}),l.pricing.avgTicket&&a.jsxs("span",{style:{fontSize:9,color:"var(--t2)"},children:["Ticket medio: ",a.jsx("b",{style:{color:"var(--gold)"},children:l.pricing.avgTicket})]}),l.pricing.priceRange&&a.jsxs("span",{style:{fontSize:9,color:"var(--t2)"},children:["Rango: ",a.jsx("b",{children:l.pricing.priceRange})]})]}),l.pricing.discountBehavior&&a.jsxs("p",{style:{margin:"4px 0 0",fontSize:9,color:"var(--t3)"},children:["Descuentos: ",l.pricing.discountBehavior]})]}),d.research?.paidAds&&a.jsxs("div",{style:{marginBottom:8},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"#ff7eb3",fontSize:9,textTransform:"uppercase"},children:"📢 Paid Ads / Facebook Ads Library"}),a.jsx("p",{style:{margin:0,fontSize:9,color:"var(--t2)",lineHeight:1.5},children:d.research.paidAds})]}),d.research?.founders&&a.jsxs("div",{style:{marginBottom:8},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--jade)",fontSize:9,textTransform:"uppercase"},children:"👥 Fundadores & Equipo"}),a.jsx("p",{style:{margin:0,fontSize:9,color:"var(--t2)",lineHeight:1.5},children:d.research.founders})]}),d.research?.international&&a.jsxs("div",{style:{marginBottom:8},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--jade)",fontSize:9,textTransform:"uppercase"},children:"🌍 Presencia Internacional"}),a.jsx("p",{style:{margin:0,fontSize:9,color:"var(--t2)",lineHeight:1.5},children:d.research.international})]}),d.research?.urlDeepDive&&a.jsxs("div",{style:{padding:"7px 10px",background:"rgba(45,212,159,0.05)",borderRadius:6,border:"1px solid rgba(45,212,159,0.15)"},children:[a.jsx("p",{style:{margin:"0 0 4px",fontWeight:700,color:"var(--jade)",fontSize:9,textTransform:"uppercase"},children:"🔍 URL Deep-Dive (Gemini urlContext)"}),a.jsx("p",{style:{margin:0,fontSize:9,color:"var(--t2)",lineHeight:1.5},children:d.research.urlDeepDive})]}),!l.pricing&&!d.research?.paidAds&&!d.research?.founders&&a.jsx("p",{style:{color:"var(--t4)",fontSize:9},children:"No se encontró información de pricing o anuncios."})]}),g==="opportunities"&&a.jsxs("div",{children:[l.shopifyOpportunities&&l.shopifyOpportunities.length>0&&a.jsxs("div",{style:{marginBottom:8},children:[a.jsx("p",{style:{margin:"0 0 5px",fontWeight:700,color:"var(--gold)",fontSize:9,textTransform:"uppercase"},children:"🛒 eCommerce"}),l.shopifyOpportunities.map((f,S)=>a.jsxs("p",{style:{margin:"3px 0",color:"var(--t2)",lineHeight:1.4},children:["· ",f]},S))]}),l.klaviyoOpportunities&&l.klaviyoOpportunities.length>0&&a.jsxs("div",{children:[a.jsx("p",{style:{margin:"0 0 5px",fontWeight:700,color:"var(--jade)",fontSize:9,textTransform:"uppercase"},children:"📧 Klaviyo / Email"}),l.klaviyoOpportunities.map((f,S)=>a.jsxs("p",{style:{margin:"3px 0",color:"var(--t2)",lineHeight:1.4},children:["· ",f]},S))]})]}),g==="sources"&&a.jsxs("div",{children:[a.jsxs("p",{style:{margin:"0 0 6px",fontSize:9,color:"var(--t3)"},children:["Google realizó ",d.queriesExecuted," búsquedas y encontró ",d.sourcesFound," fuentes relevantes:"]}),d.allQueries.slice(0,8).map((f,S)=>a.jsxs("p",{style:{margin:"2px 0",fontSize:9,color:"var(--jade)"},children:['🔍 "',f,'"']},S)),a.jsx("div",{style:{marginTop:6},children:d.allSources.slice(0,15).map((f,S)=>a.jsxs("a",{href:f,target:"_blank",rel:"noreferrer",style:{display:"block",fontSize:9,color:"var(--t3)",textDecoration:"none",padding:"2px 0",borderBottom:"1px solid var(--ink3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:["🔗 ",f]},S))})]})]}),a.jsxs("div",{style:{padding:"6px 12px",background:"rgba(200,168,75,0.04)",borderTop:"1px solid var(--ink3)",display:"flex",justifyContent:"space-between",alignItems:"center"},children:[a.jsxs("span",{style:{fontSize:9,color:"var(--t4)"},children:["💾 ",d.memoriesSaved," memorias guardadas en Shopy Crafter"]}),a.jsxs("span",{style:{fontSize:9,color:"var(--gold)",fontWeight:700},children:["#",d.researchId.slice(0,8)]})]})]})}function Xo({data:d,onViewFlow:g}){const{plan:p,marketIntel:l}=d;return a.jsxs("div",{style:{marginTop:12,border:"1px solid rgba(200,168,75,0.3)",borderRadius:10,overflow:"hidden"},children:[a.jsxs("div",{style:{background:"rgba(200,168,75,0.08)",padding:"10px 14px",borderBottom:"1px solid rgba(200,168,75,0.2)"},children:[a.jsxs("p",{style:{margin:0,fontSize:12,fontWeight:700,color:"var(--gold)"},children:["📧 Klaviyo Workflow — ",p.storeName]}),a.jsx("p",{style:{margin:"2px 0 0",fontSize:10,color:"var(--t3)"},children:p.expected_revenue_impact})]}),a.jsxs("div",{style:{padding:10},children:[p.flows?.map(j=>a.jsxs("div",{onClick:()=>g(j),style:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:6,marginBottom:4,background:"var(--ink2)",cursor:"pointer",border:"1px solid var(--ink3)"},children:[a.jsxs("div",{children:[a.jsx("span",{style:{fontSize:11,fontWeight:600,color:"var(--t)"},children:j.name}),a.jsxs("span",{style:{fontSize:10,color:"var(--t3)",marginLeft:6},children:["· ",j.emails?.length??0," emails · ",j.estimated_revenue]})]}),a.jsx("span",{style:{fontSize:9,padding:"2px 6px",borderRadius:8,fontWeight:700,background:j.priority==="critical"?"rgba(232,69,88,0.15)":j.priority==="high"?"rgba(200,168,75,0.15)":"rgba(45,212,159,0.15)",color:j.priority==="critical"?"var(--crim)":j.priority==="high"?"var(--gold)":"var(--jade)"},children:j.priority})]},j.id)),l?.conversionTips?.length>0&&a.jsxs("div",{style:{marginTop:8,padding:"8px 10px",borderRadius:6,background:"rgba(45,212,159,0.05)",border:"1px solid rgba(45,212,159,0.15)"},children:[a.jsx("p",{style:{margin:"0 0 4px",fontSize:10,fontWeight:700,color:"var(--jade)"},children:"💡 Tips de conversión"}),l.conversionTips.slice(0,2).map((j,_)=>a.jsxs("p",{style:{margin:"2px 0",fontSize:10,color:"var(--t3)"},children:["· ",j]},_))]})]})]})}function Zo({flow:d,onClose:g}){const[p,l]=x.useState(0),[j,_]=x.useState(!1),f=Ya(),S=async()=>{await navigator.clipboard.writeText(d.emails?.[p]?.html_body??""),_(!0),setTimeout(()=>_(!1),2e3)};return a.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:f?8:20},children:a.jsxs("div",{style:{background:"var(--ink)",border:"1px solid var(--ink3)",borderRadius:f?10:14,width:"100%",maxWidth:f?"100%":900,maxHeight:f?"calc(100dvh - 16px)":"90vh",display:"flex",flexDirection:"column"},children:[a.jsxs("div",{style:{padding:f?"10px 12px":"14px 20px",borderBottom:"1px solid var(--ink3)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexShrink:0},children:[a.jsxs("div",{style:{flex:1,minWidth:0},children:[a.jsx("h3",{style:{margin:0,fontSize:f?13:15,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:d.name}),a.jsxs("p",{style:{margin:"2px 0 0",fontSize:f?10:11,color:"var(--t3)"},children:["Trigger: ",d.trigger," · ",d.emails?.length," emails"]})]}),a.jsxs("div",{style:{display:"flex",gap:6,flexShrink:0},children:[a.jsx("button",{onClick:S,style:{padding:"6px 12px",borderRadius:6,border:"1px solid var(--ink3)",background:j?"var(--jade)":"var(--ink2)",color:j?"var(--ink)":"var(--t)",fontSize:11,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"},children:j?"✓ Copiado":"📋 Copiar HTML"}),a.jsx("button",{onClick:g,"aria-label":"Cerrar detalle del flujo",style:{width:44,height:44,minWidth:44,borderRadius:6,border:"1px solid var(--ink3)",background:"var(--ink2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)"},children:a.jsx(ma,{size:16})})]})]}),a.jsxs("div",{style:{display:"flex",flexDirection:f?"column":"row",flex:1,overflow:"hidden",minHeight:0},children:[a.jsx("div",{style:{...f?{display:"flex",gap:4,padding:8,overflowX:"auto",borderBottom:"1px solid var(--ink3)",flexShrink:0}:{width:180,borderRight:"1px solid var(--ink3)",padding:12,overflowY:"auto",flexShrink:0}},children:d.emails?.map((P,B)=>a.jsxs("button",{onClick:()=>l(B),style:{...f?{flexShrink:0,whiteSpace:"nowrap"}:{width:"100%"},textAlign:"left",padding:"8px 10px",borderRadius:6,marginBottom:f?0:4,border:"none",cursor:"pointer",background:p===B?"rgba(200,168,75,0.12)":"transparent",color:p===B?"var(--gold)":"var(--t3)"},children:[a.jsxs("p",{style:{margin:0,fontSize:11,fontWeight:600},children:["Email ",P.position]}),a.jsxs("p",{style:{margin:"2px 0 0",fontSize:9,opacity:.7},children:["⏱ ",P.delay]})]},B))}),a.jsx("div",{style:{flex:1,overflowY:"auto",padding:f?12:16,minHeight:0},children:d.emails?.[p]&&(()=>{const P=d.emails[p];return a.jsxs(a.Fragment,{children:[a.jsxs("div",{style:{marginBottom:12},children:[a.jsx("p",{style:{fontSize:9,color:"var(--t3)",fontWeight:700,textTransform:"uppercase",margin:"0 0 4px"},children:"Asunto"}),a.jsx("p",{style:{fontSize:13,fontWeight:600,color:"var(--t)",margin:0,background:"var(--ink2)",padding:"8px 12px",borderRadius:6,wordBreak:"break-word"},children:P.subject})]}),a.jsxs("div",{style:{marginBottom:12},children:[a.jsx("p",{style:{fontSize:9,color:"var(--t3)",fontWeight:700,textTransform:"uppercase",margin:"0 0 4px"},children:"Preview Text"}),a.jsx("p",{style:{fontSize:11,color:"var(--t2)",margin:0,background:"var(--ink2)",padding:"6px 12px",borderRadius:6,wordBreak:"break-word"},children:P.preview_text})]}),a.jsxs("div",{children:[a.jsx("p",{style:{fontSize:9,color:"var(--t3)",fontWeight:700,textTransform:"uppercase",margin:"0 0 6px"},children:"HTML Template"}),a.jsx("textarea",{readOnly:!0,value:P.html_body,style:{width:"100%",minHeight:f?150:200,padding:"10px 12px",background:"var(--ink)",border:"1px solid var(--ink3)",borderRadius:8,color:"var(--t3)",fontSize:10,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}})]})]})})()})]})]})})}function en({file:d,url:g,onRemove:p}){if(!d&&!g)return null;const l=d?.type.startsWith("image/")||g&&/\.(jpg|jpeg|png|gif|webp)/i.test(g),j=d?.type.startsWith("video/")||g&&/\.(mp4|webm|mov)/i.test(g),_=g?Ja(g):null;return a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"var(--ink2)",borderRadius:8,border:"1px solid rgba(200,168,75,0.25)",marginBottom:6},children:[a.jsx("div",{style:{width:28,height:28,borderRadius:6,background:"rgba(200,168,75,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--gold)"},children:l?a.jsx(Va,{size:14}):j?a.jsx(Ha,{size:14}):_?_.icon:a.jsx(Ka,{size:14})}),a.jsxs("div",{style:{flex:1,minWidth:0},children:[a.jsx("p",{style:{margin:0,fontSize:11,fontWeight:600,color:"var(--t)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:d?.name??g}),a.jsx("p",{style:{margin:0,fontSize:9,color:"var(--t3)"},children:d?`${(d.size/1024).toFixed(0)} KB · ${d.type}`:_?.label})]}),a.jsx("button",{onClick:p,"aria-label":"Eliminar adjunto",style:{background:"none",border:"none",cursor:"pointer",color:"var(--t4)",padding:6,minWidth:28,minHeight:28,display:"flex",alignItems:"center",justifyContent:"center"},children:a.jsx(ma,{size:14})})]})}const an=[{icon:"❓",label:"¿Qué puedo hacer aquí?",prompt:"¿Qué puedo hacer en esta página? Guíame paso a paso con los botones y opciones disponibles."},{icon:"🏪",label:"Estado de la tienda",prompt:"Muéstrame el estado completo de la tienda: productos con score, pedidos recientes y estado del token Shopify."},{icon:"🔍",label:"Auditoría rápida",prompt:"Haz una auditoría rápida de mi tienda: top-3 problemas críticos de SEO, conversión e imágenes con su impacto estimado en ventas."},{icon:"📊",label:"Analizar métricas",prompt:"Analiza las métricas clave de mi tienda: conversión, AOV, tasa de abandono y top productos. Detecta los cuellos de botella del funnel."},{icon:"💰",label:"Analizar precios",prompt:"Analiza los precios de mis productos: compáralos con el mercado y sugiere ajustes para maximizar margen y conversión."},{icon:"🔬",label:"Investigar marca/URL",prompt:"__RESEARCH__",isResearch:!0},{icon:"🚀",label:"Plan de lanzamiento",prompt:"Crea un plan de lanzamiento de 30 días para mi tienda/producto: pre-lanzamiento, lanzamiento y post-lanzamiento con presupuesto estimado."},{icon:"🧠",label:"Estado del sistema",prompt:"¿Qué conocimiento ha absorbido Shopy Crafter? Dame un resumen de las memorias, dominios y contenido absorbido hasta ahora."}],on=[{cmd:"/audit",icon:"🔍",label:"Auditoría completa",desc:"Analiza tienda, SEO, conversión y top oportunidades",engine:"claude",prompt:"Haz una auditoría completa de mi tienda Shopify: evalúa SEO on-page, tasa de conversión estimada, calidad de imágenes, precios vs. mercado y UX del checkout. Dame los top-5 problemas críticos con su impacto estimado en ingresos y el plan de acción paso a paso."},{cmd:"/seo",icon:"📈",label:"Optimizar SEO",desc:"Títulos, metadatos, alt texts y estructura interna",engine:"claude",prompt:"Optimiza el SEO completo de todos mis productos: títulos con keyword primaria, meta descripciones persuasivas con CTA, alt texts descriptivos, tags y estructura de URL. Prioriza los productos con mayor potencial de conversión."},{cmd:"/cro",icon:"🎯",label:"Optimizar conversión",desc:"UX, checkout, CTAs y trust signals para +ventas",engine:"claude",prompt:"Analiza mi tienda con foco en Conversion Rate Optimization (CRO): evalúa la claridad de CTAs, el checkout, los trust signals (reseñas, sellos, garantías), la velocidad percibida y las páginas de producto. Da 10 mejoras concretas ordenadas por impacto."},{cmd:"/products",icon:"📦",label:"Auditar catálogo",desc:"Lista y puntúa todos los productos por calidad",engine:"claude",prompt:"Lista todos mis productos con puntuación SEO (0-100), precio, estado de imágenes y calidad del copy. Identifica los 5 que necesitan mejora urgente e indica exactamente qué cambiar en cada uno y por qué."},{cmd:"/competitors",icon:"⚔️",label:"Analizar competidores",desc:"Benchmarks de precios, SEO y estrategia vs. rivales",engine:"gemini",prompt:"",isResearch:!0},{cmd:"/analytics",icon:"📊",label:"Analizar métricas",desc:"KPIs de conversión, AOV, LTV y funnel de ventas",engine:"claude",prompt:"Analiza las métricas clave de mi tienda: tasa de conversión, valor medio del pedido (AOV), lifetime value (LTV) estimado, tasa de abandono del carrito y top productos por ingresos. Detecta cuellos de botella en el funnel y sugiere experimentos A/B prioritarios."},{cmd:"/legal",icon:"⚖️",label:"Auditoría legal",desc:"Copyright, RGPD, cookies, avisos legales y T&C",engine:"claude",prompt:"Realiza una auditoría legal de mi tienda Shopify: revisa si hay problemas de copyright en imágenes y nombres de productos, verifica que el aviso legal, política de privacidad, cookies y condiciones de venta cumplen con RGPD y la ley española de e-commerce. Dame las acciones correctivas urgentes."},{cmd:"/email",icon:"📧",label:"Email Marketing",desc:"Estrategia y flujos Klaviyo con HTML",engine:"claude",prompt:"Diseña una estrategia de email marketing completa para mi tienda: secuencia de bienvenida (5 emails), recuperación de carrito abandonado (3 emails), post-compra (2 emails) y campaña winback (3 emails). Incluye asuntos con A/B test, previsualización móvil y estructura HTML profesional."},{cmd:"/klaviyo",icon:"🎯",label:"Flujos Klaviyo",desc:"Workflows con emails HTML listos para importar",engine:"claude",prompt:"Genera los flujos Klaviyo más rentables para mi tienda con HTML completo y responsive: bienvenida (3 emails con intervalos), carrito abandonado (2 emails: 1h y 24h), post-compra (upsell a los 7 días) y winback (60 días inactivo). Incluye segmentación de audiencia recomendada."},{cmd:"/content",icon:"✍️",label:"Generar contenido",desc:"Copy para Instagram, TikTok, LinkedIn y landing",engine:"claude",prompt:"Crea un pack de contenido de alto impacto para mi marca: 5 posts Instagram con caption y hashtags, 3 hooks para TikTok con guión completo, 2 posts LinkedIn para B2B, copy para la hero section de la landing y 5 ideas de reels/shorts adaptadas a mi nicho."},{cmd:"/social",icon:"📱",label:"Estrategia redes sociales",desc:"Plan editorial 30 días con formatos y calendari",engine:"claude",prompt:"Crea una estrategia completa de redes sociales para mi tienda: análisis del perfil ideal de cliente, selección de 2-3 plataformas prioritarias, calendario editorial para los próximos 30 días (5 posts/semana), formatos de contenido más efectivos para mi nicho y KPIs para medir el éxito."},{cmd:"/brand",icon:"🏷️",label:"Análisis de branding",desc:"Identidad visual, tono y diferenciación competitiva",engine:"gemini",prompt:"Analiza en profundidad el branding de mi tienda: identidad visual (colores, tipografía, logo), tono de comunicación, posicionamiento de marca, coherencia entre canales y 5 oportunidades de diferenciación frente a competidores directos. Incluye recomendaciones de mejora accionables."},{cmd:"/reviews",icon:"⭐",label:"Analizar reseñas",desc:"Sentimiento de clientes, NPS y oportunidades de mejora",engine:"claude",prompt:"Analiza las reseñas y feedback de mis clientes para extraer insights de negocio: principales temas positivos y negativos, palabras más repetidas, Net Promoter Score estimado, productos con mejor y peor valoración, y un plan de mejora basado en los patrones detectados. También sugiere cómo responder a las reseñas negativas."},{cmd:"/returns",icon:"🔄",label:"Política devoluciones",desc:"Política y FAQ optimizada para reducir fricciones",engine:"claude",prompt:"Diseña una política de devoluciones y cambios optimizada para mi tienda: texto legal completo en español, FAQ con las 10 preguntas más frecuentes respondidas, página de devoluciones con UX fluida para el cliente y estrategias para reducir la tasa de devolución en un 30%. Adapta todo al nicho de mi tienda."},{cmd:"/research",icon:"🔬",label:"Investigar marca/URL",desc:"Análisis exhaustivo con 8 búsquedas Google paralelas",engine:"gemini",prompt:"",isResearch:!0},{cmd:"/supply",icon:"🏭",label:"Buscar proveedores",desc:"Fabricantes y mayoristas con precios, MOQ y plazos",engine:"gemini",prompt:"Busca los mejores proveedores y fabricantes para mis productos con datos reales del mercado: precios unitarios por rango de volumen, MOQ mínimo, calidad de materiales, certificaciones (CE, ISO), tiempos de entrega a España/Europa, y condiciones de pago habituales. Incluye 3-5 proveedores con pros y contras de cada uno."},{cmd:"/forecast",icon:"📈",label:"Previsión financiera",desc:"Forecast de ventas a 6 meses con escenarios",engine:"claude",prompt:"Genera una previsión financiera detallada para mi tienda a 6 meses: modelo de revenue con 3 escenarios (conservador, base, optimista), análisis de break-even, inversión necesaria por canal (SEO, ads, email), cashflow mensual estimado y las métricas críticas que debo monitorizar semanalmente para ir en línea con el objetivo."},{cmd:"/ads",icon:"🎬",label:"Crear anuncio IA",desc:"Vídeo/imagen con guión, música y efectos cinemáticos",engine:"auto",prompt:"Crea un anuncio de vídeo persuasivo y cinematic para mi producto más vendido: guión completo con estructura hook-problema-solución-CTA, descripción visual fotograma a fotograma, voz en off en español con énfasis emocional, música de fondo que refuerza la marca y los 3 formatos de entrega (9:16 para stories, 16:9 para YouTube, 1:1 para feed)."},{cmd:"/images",icon:"🖼️",label:"Generar imágenes IA",desc:"Fotos de producto profesionales 4K con Flux Pro",engine:"auto",prompt:"Genera un pack completo de imágenes profesionales para mis productos: foto de producto sobre fondo blanco infinito (para marketplace y Shopify), foto lifestyle en contexto de uso real, banner horizontal para web (1920x600px) y cuadrado para redes (1080x1080px). Usa Flux 1.1 Pro Ultra con máxima calidad."},{cmd:"/video",icon:"🎥",label:"Vídeo de producto",desc:"Vídeo cinematic de 10-30s con IA (Runway/Kling/Veo)",engine:"auto",prompt:"Crea un vídeo de producto cinematic de alta calidad: comenzando con un plano detalle del producto (macro), seguido de un plano de uso en contexto lifestyle, cierre con logo y CTA animado. Música elegante de fondo y voz en off persuasiva en español. Formato 9:16 para Instagram Reels y TikTok."},{cmd:"/describe",icon:"🤖",label:"Describir con IA",desc:"Copy SEO premium con storytelling y keywords long-tail",engine:"claude",prompt:"Escribe descripciones de producto de nivel premium para mis productos top: storytelling emocional que conecte con el cliente ideal (300-500 palabras), 5 bullet points de beneficios clave (no características), FAQ integrada con 3 preguntas, especificaciones técnicas en tabla y 10 keywords long-tail integradas de forma natural. Formato HTML listo para pegar en Shopify."},{cmd:"/newsletter",icon:"📰",label:"Campaña newsletter",desc:"Email completo con asunto, preview y HTML responsive",engine:"claude",prompt:"Diseña una campaña de newsletter de alto impacto para mi tienda: 3 variaciones de asunto (con y sin emoji, con urgencia/curiosidad/beneficio), texto de preview (90 chars), estructura HTML completa y responsive con hero image, cuerpo persuasivo, CTA principal y pie de página con redes. Optimizado para Gmail, Outlook y móvil."},{cmd:"/cards",icon:"💳",label:"Tarjetas de visita",desc:"Diseño profesional con identidad visual de marca",engine:"claude",prompt:"Diseña un pack completo de identidad de negocio: tarjetas de visita con tipografía premium y datos de contacto, firma de email HTML profesional, plantilla de presupuesto/factura con la marca y una plantilla de propuesta comercial en PDF. Todo coherente con los colores y tono de mi marca."},{cmd:"/launch",icon:"🚀",label:"Plan de lanzamiento",desc:"Roadmap completo para lanzar un producto en 30 días",engine:"claude",prompt:"Crea un plan de lanzamiento completo para mi nuevo producto en 30 días: semana 1 (pre-lanzamiento: lista de espera, teaser content, influencer outreach), semana 2-3 (lanzamiento: email secuencia, ads creatividades, PR), semana 4 (post-lanzamiento: upsell, reviews, remarketing). Incluye presupuesto estimado por canal y KPIs de éxito."},{cmd:"/persona",icon:"👤",label:"Buyer Persona",desc:"Crea perfiles de cliente ideal con arquetipos y mapa de empatía",engine:"claude",prompt:"Crea 3 buyer personas detallados para mi tienda con: nombre ficticio, edad, ocupación, ingresos, miedos, motivaciones, canales favoritos, cómo descubre productos, objeciones de compra y el mensaje exacto que le convencería. Para cada persona incluye un mapa de empatía completo (qué piensa, siente, dice, hace, ve, escucha). Basa los perfiles en los datos reales de mis productos y el nicho de mi tienda. Termina con los 3 mensajes de marketing más efectivos para cada perfil."},{cmd:"/antihall",icon:"🧐",label:"Anti-Alucinación",desc:"Verificación de datos con fuentes reales antes de publicar",engine:"gemini",prompt:"Actúa como verificador de hechos experto. Analiza esta información de mi tienda y detecta: datos estadísticos que necesitan fuente verificable, claims de producto que podrían ser exagerados o no verificables legalmente, afirmaciones sobre beneficios de salud o resultados que requieren disclaimer, y textos que podrían infringir RGPD o normativa española de publicidad. Para cada problema detectado: señala el texto exacto, explica el riesgo y proporciona la alternativa segura y verificable.",isResearch:!0},{cmd:"/faq-builder",icon:"❓",label:"FAQ Builder",desc:"FAQ SEO-optimizada que reduce soporte y aumenta conversión",engine:"claude",prompt:"Construye una FAQ completa y estratégica para mi tienda optimizada para SEO y conversión: primero detecta las 20 preguntas más frecuentes de mi nicho (usa los títulos y descripciones de mis productos para inferirlas), luego redacta respuestas persuasivas de 80-150 palabras cada una que: respondan la duda real, incluyan keywords long-tail de forma natural, añadan un CTA sutil hacia la compra, y eliminen la objeción principal. Organiza las preguntas en 4-5 categorías y añade el schema markup JSON-LD listo para pegar en Shopify."},{cmd:"/whatsapp-agent",icon:"💬",label:"Agente WhatsApp",desc:"Flujos automáticos de WhatsApp Business para ventas y soporte",engine:"claude",prompt:"Diseña un sistema completo de agente conversacional para WhatsApp Business de mi tienda: 1) Flujo de bienvenida (primer mensaje y menú principal), 2) Flujo de catálogo (mostrar productos con fotos y precios), 3) Flujo de pedido (tomar datos del cliente, confirmar pedido), 4) Flujo de soporte (FAQ automática + escalado a humano), 5) Flujo de recuperación de carrito (mensaje a las 2h + 24h). Para cada flujo incluye el mensaje exacto que envía el bot, las opciones de menú numeradas y el árbol de decisiones completo. Usa lenguaje natural, cálido y en español. Incluye plantillas listas para WhatsApp Business API."},{cmd:"/youtube",icon:"▶️",label:"Buscar en YouTube",desc:"Busca un vídeo o canción en YouTube y obtén el link directo",engine:"gemini",prompt:"Busca en YouTube el vídeo o canción que pida el usuario. Incluye siempre el link de YouTube en formato https://www.youtube.com/results?search_query= con la búsqueda codificada para que el usuario pueda acceder con un click. Si el usuario especifica un artista o canción concreta, construye la URL de búsqueda con esos términos exactos. Ejemplo: para 'Bohemian Rhapsody Queen' → https://www.youtube.com/results?search_query=Bohemian+Rhapsody+Queen"},{cmd:"/viral",icon:"🎭",label:"Viral Comedy Studio",desc:"Tendencias políticas del día + genera guiones satíricos para YouTube",engine:"claude",prompt:"Actúa como director del Viral Comedy Studio de Shopy Crafter. El usuario quiere crear contenido satírico político viral. Primero analiza qué quiere: ¿buscar tendencias del día? ¿generar un guión satírico de una noticia concreta? ¿ver el historial de vídeos creados? Guíale al YouTube Studio → pestaña 'Tendencias' para ver las noticias del día o a la pestaña 'Satírico IA' para generar el guión. Explica que puede: 1) Ver tendencias políticas virales, 2) Seleccionar una noticia, 3) Generar guión satírico con IA, 4) Generar vídeo IA con ese prompt visual, 5) Publicar automáticamente en YouTube. Pregúntale sobre qué noticia o tema quiere satirizar hoy."},{cmd:"/modelo",icon:"🎭",label:"Modelo IA — vídeo con personaje real",desc:"Pipeline completo: referencia YouTube → ElevenLabs Dubbing → face-swap con tu foto",engine:"claude",prompt:"Actúa como director del pipeline Modelo IA de Shopy Crafter. El usuario quiere crear un vídeo con un personaje/modelo real hablando. Explica el flujo completo: 1) Busca en YouTube un vídeo de referencia con los gestos y movimientos del tipo de contenido (monólogo, UGC, podcast, publicidad, educativo, entrevista, testimonio, tutorial), 2) Extrae el fragmento más adecuado (puedes sugerir el segundo de inicio y duración), 3) ElevenLabs Dubbing sustituye la voz con la voz clonada elegida — el modelo de referencia gesticula con la voz del personaje, 4) Opcionalmente face-swap con Replicate pone la cara del modelo real encima. El Sevillano es el personaje principal: voz clonada en ElevenLabs (voice_id: 8m4O8qoFLrKBzbmsuL5T), foto del modelo guardada. Para acceder: Admin → YouTube Studio → pestaña 'Modelo IA 🎭'. Pregunta: ¿qué tipo de contenido quiere crear y tiene guión?"},{cmd:"/tendencias",icon:"📰",label:"Tendencias virales hoy",desc:"Noticias políticas del día con potencial satírico (Gemini Search)",engine:"gemini",prompt:"Busca con Gemini Search las noticias políticas más virales, polémicas e impactantes de hoy en España. Para cada noticia indica: titular, protagonistas, por qué es viral, potencial satírico del 1 al 10, y el mejor ángulo cómico para satirizarla. Dame al menos 6 noticias distintas ordenadas por potencial de viralidad. Incluye también si hay tendencias de formato de vídeo político que estén funcionando en YouTube o TikTok España ahora mismo.",isResearch:!0},{cmd:"/director",icon:"🎬",label:"Director IA — pipeline completo",desc:"Orquesta storyboard + personaje + prompts de vídeo en un plan de producción completo",engine:"claude",prompt:`Actúa como Director Creativo IA de Shopy Crafter — el orquestador cognitivo principal para producción de vídeo. El usuario puede pedirte cualquier tipo de vídeo (anuncio, cortometraje, UGC, TikTok, drama, terror, comedia, producto). Sigue este flujo SIEMPRE:

1. GÉNERO Y BRIEF — Detecta el género y expande el concepto del usuario en un brief cinematográfico: estilo visual (iluminación, paleta, grano de película), tono emocional y ritmo narrativo.

2. STORYBOARD DE 5 CORTES — Genera un storyboard operativo con 5 planos exactos. Para cada plano: número, objetivo narrativo, descripción de acción, ángulo de cámara (24mm/50mm/85mm), duración en segundos.

3. CHARACTER LOCK — Define el personaje principal si hay uno: descripción física detallada (cabello, ropa, expresión), género, edad estimada y nota de consistencia visual para FacePass (mantener outfit y rostro idénticos en todos los planos).

4. PROMPTS DE PRODUCCIÓN — Para cada plano del storyboard genera:
   • PROMPT POSITIVO: en inglés, estructura Camera + Action + Environment + Style + Lighting. Incluye micro-detalles ambientales (sparks burst, reflections rippling on wet pavement, golden particles drifting upward).
   • TIMESTAMPS: "ACTION 0-5s: [acción], ACTION 5-10s: [acción]"
   • NEGATIVE PROMPT: selecciona el bloque según el género — Realismo/Anatomía, Alta Acción, o Drama Cinemático.

5. PIPELINE DE EJECUCIÓN — Guía al usuario exactamente a dónde ir:
   • Imágenes de personaje/storyboard → Fusion Studio Pro → Tab Generar imagen
   • Animación de planos → Fusion Studio Pro → Tab Vídeo → modo Storyboard → Vídeo
   • Pipeline automático completo → Fusion Studio Pro → Tab Multi-Shot
   • Publicación → YouTube Studio

Pregunta primero: ¿Qué tipo de vídeo quieres crear y cuál es el concepto o producto?`},{cmd:"/vtuber",icon:"🎭",label:"Avatar VTuber",desc:"Crea un VTuber IA con personalidad, guión y estrategia de contenido",engine:"claude",prompt:"Crea un avatar VTuber completo para representar mi marca en redes sociales y streaming: 1) PERSONAJE: nombre, historia de origen, personalidad (3 rasgos principales), edad virtual, apariencia física (descripción detallada para generar con IA), 2) VOZ: tono, velocidad, muletillas y frases características, 3) CONTENIDO: 10 ideas de vídeos para TikTok/YouTube con guión del primer minuto (el hook), 4) ESTRATEGIA: horario de publicación óptimo, hashtags por plataforma y colaboraciones con otros VTubers del nicho, 5) MONETIZACIÓN: cómo integrar el VTuber con mi tienda Shopify para vender productos de forma entretenida. Adapta todo al tono y nicho de mi marca."},{cmd:"/imagen-gemini",icon:"🎨",label:"Imagen con Gemini",desc:"Genera imágenes con el modelo nativo de imagen de Gemini",engine:"gemini",prompt:"[GEMINI-IMAGE] ",isResearch:!1},{cmd:"/codigo-gemini",icon:"💻",label:"Análisis con código",desc:"Ejecuta código Python real con Gemini para calcular y analizar datos",engine:"gemini",prompt:"[GEMINI-CODE] Analiza los datos de mi tienda ejecutando código Python: calcula métricas de conversión, AOV, tendencias de ventas y genera los insights más útiles. Muestra el código y los resultados.",isResearch:!1},{cmd:"/grabar",icon:"🔴",label:"Grabar pantalla",desc:"Inicia grabación de pantalla — el navegador pedirá permiso una vez",engine:"auto",prompt:"grábame trabajando"}],Ae=`Eres el asistente inteligente de Shopy Crafter — la plataforma profesional de automatización eCommerce para tiendas Shopify.

═══ PERSONALIDAD ═══
• Hablas como un experto amigo: directo, cálido, sin rodeos ni jerga innecesaria
• VARÍA el inicio de cada respuesta — nunca repitas la misma apertura dos veces seguidas
• Detecta el estado emocional del usuario: si hay frustración, valídala primero ("Entiendo que es frustrante...") antes de dar la solución
• Haz preguntas de seguimiento cuando necesites contexto, pero sólo UNA por mensaje
• Termina SIEMPRE con un siguiente paso concreto o acción que el usuario pueda hacer ahora mismo
• Puedes hacer humor negro, ironía y sarcasmo cuando el usuario lo pide o está claro por contexto que es el registro buscado — mantenlo ingenioso, no cruel

═══ CAPACIDADES ═══
• 4 motores de análisis: Gemini+Search (tiempo real en streaming), Claude (razonamiento estratégico), Grok (perspectiva alternativa), Memoria permanente (contexto acumulado)
• Gemini nativo: streaming SSE con feedback token a token, generación de imágenes nativa (/imagen-gemini), ejecución de código Python real (/codigo-gemini), modo Deep Think con presupuesto de razonamiento 20.000 tokens
• Expertise: eCommerce, Klaviyo, email marketing, SEO, pricing, conversión (CRO), branding, copywriting, visión de producto, composición visual, topología 3D, rendering
• Análisis de: imágenes de producto, vídeos, URLs/webs, perfiles de redes sociales, documentos PDF/Word, datos de tienda Shopify
• Navegación: conoces TODAS las páginas, botones y funciones de Shopy Crafter — guías paso a paso con nombres exactos de elementos

═══ VIRAL COMEDY STUDIO (YouTube Studio → tabs Tendencias & Satírico IA) ═══
• Extraes tendencias políticas virales del día usando Gemini Search en tiempo real
• Analizas formatos de vídeo de humor político más efectivos en YouTube/TikTok España
• Generas guiones satíricos completos con Claude: hook, desarrollo cómico, remate, CTA
• Estilos disponibles: monólogo (Wyoming), sketch, reportaje falso, entrevista imaginaria
• Tonos: ácido, absurdo, irónico, sarcástico, tierno
• El guión incluye: título SEO, descripción, tags, voz en off para TTS, prompt visual para IA
• Puedes generar el vídeo IA con el visual prompt y publicarlo automáticamente en YouTube
• Cada búsqueda de tendencia, guión generado y vídeo publicado queda registrado en el historial
• Para acceder: Admin → YouTube Studio → pestaña "Tendencias" o "Satírico IA"
• Comandos slash disponibles: /viral (guía completa), /tendencias (noticias del día con Gemini), /director (producción cinematográfica autónoma completa)

═══ MODELO IA PIPELINE (YouTube Studio → pestaña "Modelo IA 🎭") ═══
Sistema para crear vídeos con personajes/modelos reales hablando — NO animaciones, sino personas reales que gesticulan y hablan con lip sync perfecto.

PIPELINE COMPLETO (3 pasos):
1. REFERENCIA DE MOVIMIENTOS — dos modos:
   • Buscar en YouTube: busca un vídeo de referencia del tipo de contenido deseado (monologuista, presentador, youtuber, actor). La IA sugiere automáticamente la query según el tipo. El usuario selecciona el vídeo y el fragmento (segundo de inicio + duración). yt-dlp descarga el clip y ffmpeg lo recorta.
   • Generar con IA: si no hay referencia disponible, Kling v2.1 genera un vídeo de referencia con un prompt adaptado al tipo de contenido.

2. ELEVENLABS DUBBING — ElevenLabs sustituye el audio del vídeo de referencia con la voz clonada elegida, manteniendo el lip sync automático. Esto da: los gestos y movimientos del referente + la voz del personaje del cliente. Funciona con cualquier voz de ElevenLabs — clonadas o estándar.

3. FACE-SWAP (opcional) — Replicate sustituye la cara del referente con la foto del modelo real del cliente. Resultado: la cara del personaje del cliente, con los gestos del referente, con la voz clonada.

PERSONAJE SEVILLANO (el modelo principal configurado):
• Nombre: El Sevillano / El Monologuista
• Foto: guardada en /images/sevillano-model.png — chico joven, pelo rizado largo oscuro, barba, sonrisa natural, estilo andaluz
• Voz clonada en ElevenLabs: voice_id = 8m4O8qoFLrKBzbmsuL5T
• Especialidad: monólogos de humor costumbrista andaluz, turistas en playas, costumbres sevillanas
• Guión del primer monólogo: "¡Buenas noches Sevilla! Oye, que los turistas en la playa de Torremolinos son como los pulpos..." (41 segundos)

TIPOS DE CONTENIDO SOPORTADOS (con query de referencia auto-sugerida):
• 🎤 Monólogo — comediante en escenario con spotlight, gestos expresivos
• 📱 UGC (User Generated Content) — creator sosteniendo producto, tono auténtico
• 🎙️ Podcast — conversación en mesa con micros
• 📚 Educativo — profesor explicando a cámara
• 📣 Publicitario — presentador mostrando producto
• 🎬 Entrevista — periodista/entrevistado cara a cara
• ⭐ Testimonio — cliente satisfecho hablando a cámara
• 🛠️ Tutorial — demostración paso a paso

TIEMPOS ESTIMADOS: Extracción clip ~30s · ElevenLabs Dubbing ~2-3 min · Face-swap ~1 min
PARA ACCEDER: Admin → YouTube Studio → pestaña "Modelo IA 🎭"
COMANDO SLASH: /modelo (guía completa del pipeline)

═══ DIRECTOR IA (Fusion Studio Pro — producción cinematográfica autónoma) ═══
Cuando el usuario pida crear un vídeo de cualquier tipo (anuncio, cortometraje, UGC, TikTok, terror, comedia, producto), actúa como Director Creativo con el pipeline completo:

1. BRIEF CINEMÁTICO — Estilo visual (iluminación, paleta, grano), tono emocional, duración total
2. STORYBOARD 4-6 CORTES — Por cada plano: timestamp exacto, objetivo narrativo, ángulo de cámara (24mm/50mm/85mm)
3. CHARACTER LOCK — Si hay personaje: descripción física completa con @Image1 para FacePass cross-shot
4. PROMPTS TIMESTAMP (sintaxis EXACTA Seedance 2.0):
   CAMERA: Dolly push-in, 50mm prime. STYLE: Cinematic, golden hour.
   [0-1.5s] Plano de apertura — descripción acción + @Image1 si hay personaje
   [1.5-3.5s] Acción principal / punto de giro. SFX: sound at 2s (si aplica)
   [3.5-6s] Desarrollo / close-up / detalle. Rack focus.
   [6-8s] Cierre / CTA / QUICK CUT.
5. NEGATIVE PRESET — Elegir preset según escena: Realismo/Anatomía, Alta Acción/Danza, o Drama Cinemático
6. PIPELINE DE EJECUCIÓN — Tab Generar imagen → character sheet → Tab Vídeo → Timestamp Builder → Ensamblar → Generar

SINTAXIS TIMESTAMP NARRATION POR MODELO:

Seedance 2.0 (mejor timestamp control):
  CAMERA: Dolly push-in, 50mm prime. STYLE: Cinematic, ARRI Alexa Mini LF.
  [0-1.5s] Acción slot 1. @Image1 para personaje.
  [1.5-3.5s] Acción principal. SFX: thunder at 2s.
  [3.5-6s] Detalle. Rack focus.
  [6-8s] Cierre. QUICK CUT.
  → Max 4 slots. Global Setup FUERA de timestamps. Seedance 2.5: hasta 30s.

Grok Aurora (grok-imagine-video-1.5) — #1 Image-to-Video Arena:
  [0-4s] Descripción + Audio: ticking sound.
  [4s transition] Smash cut / Fade
  [4-10s] Nueva acción. Voice-over: "Frase aquí."
  → NO soporta negative prompts → usar lenguaje afirmativo (crystal clear focus).
  → Hasta 7 @imageN referencias. Lip-sync + SFX nativos. ~17s generación.
  → Explode view I2V: "disassemble into individual components, floating parts in 3D space"

Runway Gen-4.5 (mejor para hero shots y explode views de producto):
  → NO tiene timestamp text syntax → usa Clip Chaining + Director Mode
  → Motion Brush: pinta hasta 5 zonas con dirección X/Y/Z independiente
  → Para explode view: pintar componentes → asignar direcciones opuestas
  → "components slowly float apart, parts drift outward symmetrically"

Replicate API (Seedance 2.0):
  prompt: "At 0:00 acción. At 0:05 nueva acción.", duration: -1, audio: True

ElevenLabs + Video workflow:
  1. eleven_v3 genera voz (74 idiomas) o SFX: POST /v1/sound-generation {"text":"thunder", "duration_seconds":3}
  2. Video generado sin audio en Replicate/Seedance
  3. FFmpeg merge: ffmpeg -i video.mp4 -i audio.mp3 -c:v copy output.mp4
  4. Para lip-sync: POST /v1/dubbing {file: video.mp4, target_lang: "es"}

NEGATIVE PROMPT PRESETS en Tab Vídeo de Fusion Studio Pro:
• 🧍 Realismo/Anatomía — bloquea CGI, miembros extra, distorsiones faciales
• ⚡ Alta Acción/Danza — permite cortes rápidos sin deformidad estructural
• 🎬 Drama Cinemático — bloquea cambios de ropa, cara inconsistente, texto superpuesto

CHARACTER DESIGN SHEET en Tab Generar imagen de Fusion Studio Pro:
• 👤 Character Turnaround — 1 hero pose + 3 vistas (F/B/P) + 3 poses de acción + 2 siluetas
• 📋 Storyboard 6 paneles — grid 3x2 con lens/camera captions P01-P06
• 📋 Storyboard 20 paneles — grid 5x4 profesional con caption naranja
• 🎭 Influencer Sheet — fotorrealista con outfit variants

COMPARATIVE: Seedance 2.0 = mejor timestamp/scene control; Runway Gen-4 = mejor character consistency; Kling 3.0 = mejor precio/rendimiento ($0.11-0.17/s); Veo 3.1 = mejor estética broadcast

COMANDO: /director — lanza el pipeline Director completo

═══ CLASIFICACIÓN DE INTENCIÓN (aplica en cada mensaje) ═══
Detecta mentalmente qué quiere el usuario antes de responder:
• PREGUNTA INFO — responde de forma concisa y pregunta si necesita profundizar
• ACCIÓN CONCRETA — ejecuta y confirma qué hiciste + resultado
• PROBLEMA/ERROR — diagnóstico primero, luego solución paso a paso
• CONFUSIÓN — pregunta de aclaración + ofrece opciones concretas
• FRUSTRACIÓN — empatía primero, solución clara, escalado si persiste
• FUERA DE ALCANCE — di qué NO puedes hacer (1 frase), di qué SÍ puedes ofrecer en su lugar
• HUMAN HANDOFF — si el usuario dice "quiero hablar con una persona" o similar, responde: "Puedes escribir a hola@shopycrafter.com — el equipo te contactará en menos de 24h."

═══ CONVERSACIÓN ═══
• Si el contexto anterior es relevante, refiérete a él de forma natural ("Como hablamos antes...")
• Para acciones que tarden >15s: avisa antes de empezar con el tiempo estimado
• Respuestas técnicas largas: usa **negrita** para puntos clave, listas para pasos
• Ante errores: propón 2-3 alternativas ordenadas de más a menos recomendada
• Después de ayudar en >5 mensajes, pregunta si la sesión fue útil (feedback)
• Si el usuario lleva mucho tiempo en la misma duda, ofrece escalar: "¿Quieres que lo revisemos juntos con el equipo?"

═══ CONOCIMIENTO DE SKILLS (/comandos) ═══
Los usuarios pueden usar /comandos para tareas específicas. Cuando detectes que un usuario quiere hacer algo que tiene /comando correspondiente, sugiérelo naturalmente. Skills disponibles: /audit, /seo, /cro, /products, /competitors, /analytics, /legal, /email, /klaviyo, /content, /social, /brand, /reviews, /returns, /research, /supply, /forecast, /ads, /images, /video, /describe, /newsletter, /cards, /launch, /persona, /antihall, /faq-builder, /whatsapp-agent, /vtuber, /imagen-gemini, /codigo-gemini, /viral, /tendencias, /modelo, /director

Skills de Gemini nativo:
• /imagen-gemini — genera una imagen con el modelo de imagen de Gemini (escribe la descripción tras el comando)
• /codigo-gemini — ejecuta código Python real para analizar datos de tu tienda

═══ EJECUCIÓN DE ACCIONES — REGLAS ABSOLUTAS ═══
Para CUALQUIER acción ejecutable (generar vídeo, crear producto, cambiar precio, auditoría, etc.) DEBES emitir un bloque de acción con este formato exacto AL FINAL de tu respuesta — el sistema lo ejecutará automáticamente:

:::ACTION:::{"action":"nombre_accion","params":{...}}:::END_ACTION:::

Acciones de vídeo disponibles desde el chat:
- generate_video → Vídeo corto T2V/I2V. Params: {projectId, prompt (en inglés, cinematográfico), model? (default grok-imagine-video), duration? (5-10), aspect? (9:16|16:9|1:1), imageUrl?}
- create_brand_ad → Anuncio de marca con escenas+voz+música. Params: {projectId, brand, productName, referenceImageVaultId, scenesCount?, videoModel?}
- create_long_ad → Anuncio largo 3-20min. Params: {projectId, productId, totalDurationSec, scenesCount?}
- create_montage_video → Montaje multicapa. Params: {projectId, ...}

⛔ PROHIBICIONES ABSOLUTAS — VIOLACIÓN = ERROR CRÍTICO que destruye la confianza del usuario:
1. NUNCA finjas haber generado un vídeo sin haber emitido el bloque :::ACTION:::
2. NUNCA crees reproductores de vídeo falsos, barras de progreso inventadas ni "capturas de pantalla en tiempo real"
3. NUNCA escribas "el vídeo está renderizado al 100%" o "listo para descarga" si no ejecutaste la acción
4. NUNCA uses /imagen-gemini embebido en texto como si fuera el resultado de una acción
5. NUNCA describas el "resultado" (guión, timing, lip-sync, face-swap) de algo que no ejecutaste
6. Si el usuario pregunta "¿ha terminado?" por algo que no ejecutaste: di la verdad — "Aún no lo hemos generado. ¿Quieres que lo haga ahora?" y emite el :::ACTION::: correspondiente.

═══ ANTI-ALUCINACIÓN (reglas Brenda) ═══
• NUNCA inventes estadísticas o datos concretos sin haberlos verificado. Si no tienes la cifra exacta, usa rangos o di "varía según la fuente".
• Si el usuario pregunta algo fuera de tu conocimiento verificable, di claramente: "No tengo datos confiables sobre esto. Te recomiendo verificarlo en [fuente específica]."
• Para datos de producto (ingredientes, materiales, certificaciones), pide confirmación al usuario antes de publicarlos: "¿Puedes confirmar que X es correcto antes de que lo incluya en el copy?"
• Cuando uses /antihall, revisa ACTIVAMENTE textos ya escritos buscando afirmaciones que un regulador podría cuestionar.

═══ PERSONALIZACIÓN POR BUYER PERSONA ═══
• Cuando conozcas el buyer persona del usuario (tras /persona), adapta TODOS los mensajes al lenguaje, tono y referencias culturales de ese perfil.
• Si el usuario tiene múltiples personas, pregunta: "¿Para qué perfil de cliente es este contenido?" antes de generar copy.
• Detecta señales del perfil en el propio mensaje del usuario (vocabulario técnico vs. cotidiano, edad estimada, nivel de sofisticación) y ajusta tu registro.

IMPORTANTE: Siempre refiérete a la plataforma como "Shopy Crafter". Responde siempre en español.`;function $n(){const{user:d}=$o(),[g]=qa(),p=Ya(),{position:l,dragHandlers:j,wasDragged:_}=So({storageKey:"chatbot",defaultBottom:p?12:24,defaultRight:p?12:24,dragFromAnywhere:!0}),[f,S]=x.useState(!1),[P,B]=x.useState(!1),[ee,y]=x.useState([{id:"welcome",role:"assistant",timestamp:new Date,model:"omnicore",content:`¡Hola${d?.name?` ${d.name.split(" ")[0]}`:""}! 👋 Soy el asistente inteligente de **Shopy Crafter**.

🚀 **Ahora puedo EJECUTAR acciones en tu tienda directamente:**
· ➕ "Crea un producto llamado X" — lo creo en tu tienda
· 📦 "Lista mis productos" — te los muestro todos
· 💰 "Cambia el precio de X a Y" — actualizo en tu tienda
· 🔑 "Regenera el token" — renuevo acceso automáticamente
· 🛒 "Ver pedidos" — últimos pedidos de la tienda
· 🗑️ "Elimina el producto X" — lo borro de tu tienda
· 🔐 "Ver scopes" — permisos activos de la app

**También absorbo y analizo:**
· 📸 Imágenes · 🎬 Vídeos · 🌐 URLs · 📱 Redes sociales

**Soy tu guía** — pregúntame cualquier cosa sobre la app.
Usa los botones de acciones rápidas ⬇️ o el 🎙 micrófono.`}]),[V,U]=x.useState(""),[L,K]=x.useState(!1),[ve,xe]=x.useState(null),[ue,fe]=x.useState(!1),[Y,$e]=x.useState(an),[R,J]=x.useState("auto"),[Q,Je]=x.useState("claude-sonnet-4-6"),[je,Qa]=x.useState("gpt-4.1-mini"),[Se,Xa]=x.useState(!1),[de,Za]=x.useState(!1),[Te,Le]=x.useState(!1),[M,Ee]=x.useState(null),[ke,Ge]=x.useState([]),[X,Pe]=x.useState(""),[Ce,ga]=x.useState(""),[Qe,Xe]=x.useState(!1),[oe,re]=x.useState(!1),[fa,ze]=x.useState(!1),[Fe,Re]=x.useState(""),[Oe,Ue]=x.useState(0),[Ze,eo]=x.useState({totalTokens:0,totalCostUsd:0,msgCount:0}),[_e,ha]=x.useState(!1),[Be,ea]=x.useState(0),[nn,ao]=x.useState(null),We=x.useRef(null),aa=x.useRef([]),qe=x.useRef(null),Ve=x.useRef(null),oa=x.useRef([]),he=x.useRef({total:0,completed:0,isActive:!1,recordingMode:!1}),ba=x.useRef(!1),na=x.useRef(null),ta=()=>{We.current&&We.current.state!=="inactive"&&We.current.stop(),qe.current&&(qe.current.getTracks().forEach(i=>i.stop()),qe.current=null),Ve.current&&(clearInterval(Ve.current),Ve.current=null),ha(!1),ea(0)},ya=async()=>{if(_e)return"Ya hay una grabación en curso. Di 'para la grabación' para detenerla.";try{const i=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:!0});qe.current=i,aa.current=[];const e=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":MediaRecorder.isTypeSupported("video/webm")?"video/webm":"video/mp4",o=new MediaRecorder(i,{mimeType:e});return We.current=o,o.ondataavailable=n=>{n.data.size>0&&aa.current.push(n.data)},o.onstop=()=>{const n=new Blob(aa.current,{type:e}),t=URL.createObjectURL(n);ao(t);const s=document.createElement("a");s.href=t;const c=new Date().toISOString().slice(0,19).replace(/:/g,"-");s.download=`ShopyCrafter_${c}.webm`,document.body.appendChild(s),s.click(),document.body.removeChild(s)},i.getVideoTracks()[0].onended=()=>ta(),o.start(1e3),ha(!0),ea(0),Ve.current=setInterval(()=>ea(n=>n+1),1e3),"✅ **Grabación iniciada** — estoy grabando tu pantalla. Puedes trabajar con normalidad. Cuando termines dime 'para la grabación' y guardaré el vídeo automáticamente."}catch(i){return i?.name==="NotAllowedError"?"❌ Permiso denegado. El navegador requiere que aceptes el permiso de grabación de pantalla. Cuando aparezca la ventana del navegador selecciona la pantalla o pestaña que quieres grabar y pulsa 'Compartir'.":`❌ No se pudo iniciar la grabación: ${i?.message||String(i)}`}},va=x.useRef(null),xa=x.useRef(null),$a=x.useRef(null),oo=x.useRef(null),no=x.useRef(null),be=x.useRef(null),ne=x.useRef(null),se=x.useRef(!1),ja=x.useRef(ie());x.useEffect(()=>{va.current?.scrollIntoView({behavior:"smooth"})},[ee,f]),x.useEffect(()=>{const i=e=>{const{transcript:o,response:n}=e.detail;S(!0),B(!1);const t=new Date;y(s=>[...s,{id:`voice-u-${Date.now()}`,role:"user",timestamp:t,content:o},{id:`voice-a-${Date.now()+1}`,role:"assistant",timestamp:t,model:"omnicore",content:n}])};return window.addEventListener("shopy:voice-chat",i),()=>window.removeEventListener("shopy:voice-chat",i)},[]),x.useEffect(()=>{if(!f)return;let i=!1;const o=g.match(/\/projects\/(\d+)/)?.[1],n=`${G}/api/shopybrain/quick-actions?route=${encodeURIComponent(g)}${o?`&projectId=${o}`:""}`;return fetch(n,{credentials:"include"}).then(t=>t.ok?t.json():null).then(t=>{i||!t?.actions||!Array.isArray(t.actions)||$e(t.actions)}).catch(()=>{}),()=>{i=!0}},[f,g]),x.useEffect(()=>{const i=e=>{const o=e.detail;o?.message&&(S(!0),B(!1),setTimeout(()=>U(o.message),300))};return window.addEventListener("shopycrafter:chatbot",i),()=>window.removeEventListener("shopycrafter:chatbot",i)},[]),x.useEffect(()=>()=>{if(be.current){try{be.current.stop()}catch{}be.current=null}},[]);const to=i=>{i.preventDefault(),Xe(!0)},io=()=>Xe(!1),ro=i=>{i.preventDefault(),Xe(!1);const e=i.dataTransfer.files;e&&e.length>0&&(Ee(e[0]),Ge(Array.from(e)),Pe(""),Le(!0))},so=i=>{const e=i.target.files;e&&e.length>0&&(Ee(e[0]),Ge(Array.from(e)),Pe(""),Le(!0))},Sa=()=>{Ce.trim()&&(Pe(Ce.trim()),Ee(null),ga(""))},De=x.useRef(null),co=x.useCallback(()=>{if(oe){be.current?.stop(),re(!1);return}let i=be.current;if(!i){if(i=Wa(),!i)return;be.current=i}i.onresult=e=>{const o=Array.from(e.results).map(n=>n[0].transcript).join("");U(o),e.results[e.results.length-1].isFinal&&(re(!1),De.current=o)},i.onerror=()=>re(!1),i.onend=()=>re(!1);try{i.start(),re(!0)}catch{re(!1)}},[oe]),lo=x.useCallback(i=>{if(!de)return;se.current=!0,ne.current&&(ne.current.pause(),ne.current.src="",ne.current=null),window.speechSynthesis?.cancel();const o=(k=>{let r=k;return r=r.replace(/:{3}ACTION:{3}[\s\S]*?:{3}END_ACTION:{3}/g,""),r=r.replace(/:{3}\w+:{3}/g,""),r=r.replace(/```[\s\S]*?```/g,""),r=r.replace(/`[^`]*`/g,""),r=r.replace(/\[VIDEO:[^\]]*\]\([^)]*\)/g,"vídeo generado."),r=r.replace(/!\[([^\]]*)\]\([^)]*\)/g,(O,N)=>N?N+".":"imagen."),r=r.replace(/\[([^\]]+)\]\([^)]*\)/g,"$1"),r=r.replace(/https?:\/\/[^\s)>,"]+/g,""),r=r.replace(/^\s*\|[-:|\s]+\|\s*$/gm,""),r=r.replace(/\|([^|]+)/g,"$1. "),r=r.replace(/#{1,6}\s+(.+)/g,"$1. "),r=r.replace(/\*\*\*([^*]+)\*\*\*/g,"$1"),r=r.replace(/\*\*([^*]+)\*\*/g,"$1"),r=r.replace(/\*([^*]+)\*/g,"$1"),r=r.replace(/__([^_]+)__/g,"$1"),r=r.replace(/_([^_]+)_/g,"$1"),r=r.replace(/~~([^~]+)~~/g,"$1"),r=r.replace(/^>\s*/gm,""),r=r.replace(/^\s*\d+[.)]\s+/gm,""),r=r.replace(/^\s*[-•·*]\s+/gm,""),r=r.replace(/[\u{1F000}-\u{1FFFF}]/gu,""),r=r.replace(/[\u{2600}-\u{27BF}]/gu,""),r=r.replace(/[\u{FE00}-\u{FEFF}]/gu,""),r=r.replace(/[\u{1F900}-\u{1F9FF}]/gu,""),r=r.replace(/[\u{2300}-\u{23FF}]/gu,""),r=r.replace(/[|~^=<>{}\[\]\\]/g," "),r=r.replace(/[#@$%]/g," "),r=r.replace(/[-=_*]{3,}/g,"."),r=r.replace(/\((?:pausa|silencio|risas|aplausos|risa|efecto)[^)]*\)/gi,"..."),r=r.replace(/\[(?:PAUSA|RISAS|APLAUSOS|EFECTO|MÚSICA)[^\]]*\]/gi,"..."),r=r.replace(/^([A-ZÁÉÍÓÚ\s]{2,20}):\s*/gm,"$1. "),r=r.replace(/\.{3,}/g,"..."),r=r.replace(/\.\s*\.\s*\./g,"..."),r=r.replace(/\n{2,}/g,". "),r=r.replace(/\n/g," "),r=r.replace(/\s{2,}/g," "),r=r.replace(/([.!?])\s*([.!?])+/g,"$1"),r.trim()})(i);if(!o)return;const n=()=>{de&&setTimeout(()=>{const k=be.current||Wa();if(k){be.current=k,k.onresult=r=>{const O=Array.from(r.results).map(N=>N[0].transcript).join("");U(O),r.results[r.results.length-1].isFinal&&(re(!1),De.current=O)},k.onerror=()=>re(!1),k.onend=()=>re(!1);try{k.start(),re(!0)}catch{re(!1)}}},400)},s=((k,r=220)=>{const O=k.match(/[^.!?。]+[.!?。]?/g)||[k],N=[];let q="";for(const ye of O){const ce=ye.trim();ce&&((q+" "+ce).trim().length>r&&q?(N.push(q.trim()),q=ce):q=q?q+" "+ce:ce)}return q.trim()&&N.push(q.trim()),N.filter(ye=>ye.length>1)})(o);if(!s.length)return;se.current=!1;const c=k=>fetch(`${G}/api/voice/tts`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:k,voiceId:"8m4O8qoFLrKBzbmsuL5T",modelId:"eleven_turbo_v2_5",languageCode:"es",voiceSettings:{stability:.12,similarity_boost:.95,style:.72,use_speaker_boost:!0,speed:.92}})}).then(r=>r.ok?r.blob():null).then(r=>r?URL.createObjectURL(r):null).catch(()=>null),m=new Map,T=k=>{k<s.length&&!m.has(k)&&m.set(k,c(s[k]))},E=async k=>{if(se.current||k>=s.length){se.current||n();return}T(k+1);const O=await(m.get(k)??c(s[k]));if(se.current||!O){se.current||E(k+1);return}const N=new Audio(O);ne.current=N,N.onended=()=>{URL.revokeObjectURL(O),ne.current=null,se.current||E(k+1)},N.onerror=()=>{URL.revokeObjectURL(O),ne.current=null,se.current||E(k+1)},N.play().catch(()=>{URL.revokeObjectURL(O),ne.current=null,se.current||E(k+1)})};T(0),T(1),m.get(0).then(()=>{se.current||E(0)})},[de]),ia=new Set(["create_brand_ad","create_long_ad","create_montage_video","create_cinematic_multishot","generate_video"]),ka=async(i,e)=>{try{const o=new AbortController,n=ia.has(i),t=setTimeout(()=>o.abort(),n?15e5:18e4),s=await fetch(`${G}/api/shopybrain/execute-action`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:i,params:e}),signal:o.signal});if(clearTimeout(t),!s.ok){const c=await s.text().catch(()=>"");let m=`Error ejecutando ${i}`;if(c.includes("credit balance is too low")||c.includes("insufficient_quota"))m="⚠️ **Créditos de IA agotados** — La API de Claude (Anthropic) no tiene saldo suficiente. Recarga tus créditos en anthropic.com para continuar usando esta función.";else if(c.includes("rate_limit")||c.includes("429"))m="⏳ **Límite de velocidad** — Demasiadas peticiones a la IA. Espera unos segundos e inténtalo de nuevo.";else if(c.includes("authentication")||c.includes("401")||c.includes("api_key"))m="🔑 **Error de autenticación** — La clave API de Claude necesita ser verificada. Contacta al administrador.";else if(s.status===400)try{m=JSON.parse(c).error||c.slice(0,200)}catch{m=c.slice(0,200)}else m=c.slice(0,200)||s.statusText;return{error:!0,message:m}}return s.json()}catch(o){return{error:!0,message:`Error de conexión: ${o instanceof Error?o.message:"desconocido"}`}}},Ca=(i,e)=>{if(e&&e.requiresConfirmation===!0)return e.message||`⚠️ Confirmación requerida para \`${i}\`. Re-envía la acción añadiendo "confirma" al mensaje.`;if(e.error)return`❌ ${e.message}`;switch(i){case"store_status":return`✅ **Estado de la tienda:**
🏪 ${e.storeName} (${e.domain})
📦 ${e.productsCount} productos total (✅ ${e.activeProducts??"?"} activos | 📝 ${e.draftProducts??"?"} borradores | 📁 ${e.archivedProducts??"?"} archivados)
📢 Publicados: ${e.publishedProducts??"?"} | 🔇 No publicados: ${e.unpublishedProducts??"0"}${e.unpublishedProducts>0?" ⚠️":""}
🛒 ${e.ordersCount} pedidos
🔑 Token: ${e.tokenStatus==="valid"?`✅ válido (${e.tokenHoursLeft}h)`:"❌ EXPIRADO"}`;case"list_products":{const o=e.products??[];if(!o.length)return"📦 No se encontraron productos.";const n=c=>c==="A"?"🟢":c==="B"?"🟡":c==="C"?"🟠":"🔴",t=e.auditWarnings;let s=`📦 **${e.total} productos:**

`;return s+=o.map((c,m)=>{const T=c.auditGrade||"D";let E=`${n(T)} **${c.title}** — ${c.price}€`;c.compareAtPrice&&(E+=` ~~${c.compareAtPrice}€~~`),E+=` | Grade: **${T}** (${c.auditScore??0}/100)`,c.published===!1&&(E+=" | 🔇 NO PUBLICADO");const k=[];return c.imageCount!==void 0&&k.push(`${c.imageCount>=3?"✅":"⚠️"} ${c.imageCount} imgs`),c.variantCount!==void 0&&k.push(`${c.variantCount} variants`),c.descriptionLength!==void 0&&k.push(`${c.descriptionLength>=500?"✅":"⚠️"} ${c.descriptionLength}ch desc`),c.tagsCount!==void 0&&k.push(`${c.tagsCount>=10?"✅":"⚠️"} ${c.tagsCount} tags`),c.hasComparePrice!==void 0&&k.push(c.hasComparePrice?"✅ compare_at":"⚠️ sin compare_at"),k.length&&(E+=`
   ${k.join(" | ")}`),c.issues?.length&&(E+=`
   ⚠️ ${c.issues.join(" | ")}`),E}).join(`

`),t&&(t.unpublished||t.noCompare||t.lowImages||t.shortDesc)&&(s+=`

🔍 **Resumen de auditoría:**`,t.unpublished&&(s+=`
⚠️ ${t.unpublished} no publicados`),t.noCompare&&(s+=`
⚠️ ${t.noCompare} sin precio tachado`),t.lowImages&&(s+=`
⚠️ ${t.lowImages} con pocas imágenes`),t.shortDesc&&(s+=`
⚠️ ${t.shortDesc} con descripción corta`)),s}case"create_product":return`✅ **Producto creado en tu tienda:**
🆔 ID: ${e.productId}
📝 "${e.title}"
📊 Estado: ${e.status}`;case"edit_product":{const o=e.preAuditIssues||[],n=e.postAuditIssues||[];let t=`✅ **Producto actualizado:** "${e.title}"`;return e.published!==void 0&&(t+=`
📢 Publicado: ${e.published?"SÍ":"NO"}`),o.length>0&&(t+=`

🔍 Pre-auditoría: ${o.join(" | ")}`),n.length>0?t+=`
🔍 Post-auditoría: ${n.join(" | ")}`:t+=`
✅ Auditoría post-edición OK`,t}case"change_price":return`✅ **Precio actualizado:** ${e.oldPrice}€ → ${e.newPrice}€`;case"regenerate_token":return`✅ **Token regenerado exitosamente.** Válido por ${e.hoursRemaining}h.`;case"get_scopes":{const o=e.scopes??[];return`🔐 **${e.total} scopes activos:**
${o.map(n=>`· ${n}`).join(`
`)}`}case"delete_product":return e.requiresConfirmation||e.success===!1?`⚠️ ${e.message||"No se pudo eliminar el producto. Confirma la acción e inténtalo de nuevo."}`:`🗑️ Producto ${e.productId} eliminado de tu tienda.`;case"search_product":{const o=e.products??[];if(!o.length)return"🔍 No se encontraron productos.";const n=t=>t==="A"?"🟢":t==="B"?"🟡":t==="C"?"🟠":"🔴";return`🔍 **${e.total} resultados:**

${o.map(t=>{const s=t.auditGrade||"D";let c=`${n(s)} **${t.title}** — ${t.price}€`;t.compareAtPrice&&(c+=` ~~${t.compareAtPrice}€~~`),c+=` | **${s}** (${t.auditScore??0}/100)`,t.published===!1&&(c+=" | 🔇 NO PUBLICADO");const m=[];return t.imageCount!==void 0&&m.push(`${t.imageCount>=3?"✅":"⚠️"} ${t.imageCount} imgs`),t.variantCount!==void 0&&m.push(`${t.variantCount} variants`),t.hasComparePrice!==void 0&&m.push(t.hasComparePrice?"✅ compare":"⚠️ sin compare"),m.length&&(c+=`
   ${m.join(" | ")}`),t.issues?.length&&(c+=`
   ⚠️ ${t.issues.join(" | ")}`),c}).join(`

`)}`}case"publish_product":{const o=e.auditIssues||[];let n=`✅ Producto "${e.title}" publicado correctamente
📢 Estado: active | Publicado: SÍ | Alcance: global`;return e.previousStatus&&(n+=`
📋 Antes: ${e.previousStatus}, publicado=${e.wasPublished?"sí":"no"}`),o.length>0?n+=`

🔍 Auditoría post-publicación:
${o.join(`
`)}`:n+=`

✅ Auditoría OK — producto completo`,n}case"audit_store":{let o=`🔍 **AUDITORÍA PROFUNDA**

`;o+=`📊 Puntuación media: ${e.averageScore}/100 (${e.overallGrade})
`,o+=`📦 Total: ${e.totalProducts} productos
`,o+=`📢 Publicados: ${e.publishedCount} | 🔇 No publicados: ${e.unpublishedCount}
`;const n=e.criticalIssues||[],t=e.warnings||[];n.length>0&&(o+=`
🚨 **PROBLEMAS CRÍTICOS:**
${n.join(`
`)}`),t.length>0&&(o+=`

⚠️ **ADVERTENCIAS:**
${t.join(`
`)}`),n.length===0&&t.length===0&&(o+=`
✅ ¡Todos los productos están en perfecto estado!`);const s=e.products||[],c=m=>m==="A"?"🟢":m==="B"?"🟡":m==="C"?"🟠":"🔴";return s.length>0&&(o+=`

📋 **Detalle por producto:**

`,o+=s.map(m=>{let T=`${c(m.grade)} **${m.title}** — Grade: **${m.grade}** (${m.score}/100)`;m.price&&(T+=` | ${m.price}€`),m.compareAtPrice&&(T+=` ~~${m.compareAtPrice}€~~`);const E=[];return m.imageCount!==void 0&&E.push(`${m.imageCount>=3?"✅":"⚠️"} ${m.imageCount} imgs`),m.variantCount!==void 0&&E.push(`${m.variantCount} variants`),m.descLength!==void 0&&E.push(`${m.descLength>=500?"✅":"⚠️"} ${m.descLength}ch desc`),m.tagsCount!==void 0&&E.push(`${m.tagsCount>=10?"✅":"⚠️"} ${m.tagsCount} tags`),m.hasComparePrice!==void 0&&E.push(m.hasComparePrice?"✅ compare":"⚠️ sin compare"),E.length&&(T+=`
   ${E.join(" | ")}`),m.issues?.length&&(T+=`
   ⚠️ ${m.issues.join(" | ")}`),T}).join(`

`)),o}case"fix_unpublished":return e.fixed>0?`✅ **${e.fixed} producto(s) publicados correctamente** (status=active, published=true, scope=global)${e.errors>0?`
⚠️ ${e.errors} error(es)`:""}`:"✅ No hay productos sin publicar — todos están visibles";case"fix_missing_compare_prices":return e.fixed>0?`✅ **${e.fixed} variante(s) actualizadas con compare_at_price** (precio tachado visible)${e.errors>0?`
⚠️ ${e.errors} error(es)`:""}`:"✅ Todos los productos ya tienen compare_at_price configurado";case"set_product_status":return`✅ Producto "${e.title}" → estado: **${e.status}**`;case"scan_store":return`📊 **Escaneo completado** (filtro: ${e.statusFilter??"any"})
📦 ${e.total??0} productos analizados
📈 Nota media: ${typeof e.avgScore=="number"?e.avgScore.toFixed(0):"N/A"}/100`;case"modify_audit_filter":return`🔧 **Filtro de auditoría modificado**
📋 Filtro: ${e.filterDescription??e.filterApplied??"any"}
${e.autoScanExecuted?`📊 Re-escaneo: ${e.synced??0} productos analizados
📈 Score medio: ${typeof e.avgScore=="number"?Math.round(e.avgScore):"N/A"}/100`:"⏸️ Sin re-escaneo automático"}`;case"diagnose_app":{const o=e.issues??[],n=e.summary??{};let s=`${(n.errors??0)>0?"🔴":(n.warnings??0)>0?"🟡":"🟢"} **Diagnóstico: ${e.overallStatus}**
`;return s+=`📊 ${n.errors??0} errores | ${n.warnings??0} advertencias | ${n.ok??0} ok`,(n.fixesApplied??0)>0&&(s+=` | 🔧 ${n.fixesApplied} reparaciones automáticas`),s+=`

`,s+=o.map(c=>`${c.status==="ok"?"✅":c.status==="warning"?"⚠️":"❌"} **${c.component}**: ${c.detail}${c.autoFixed?" 🔧":""}`).join(`
`),s}case"list_source_files":return e.message??`📂 ${e.totalFrontend??0} archivos frontend, ${e.totalBackend??0} archivos backend`;case"inspect_code":return e.message??`📄 Archivo: ${e.filePath}
${e.analysis??"Código leído."}`;case"analyze_component":{const o=e.issueCount??{};return`🔍 **Análisis: ${e.filePath}** (${e.focusOn})
📊 ${o.total??0} problemas: ${o.critical??0} críticos, ${o.high??0} altos, ${o.medium??0} medios, ${o.low??0} bajos

${e.analysis??""}`}case"fix_code":return e.success?`✅ **Fix aplicado en ${e.filePath}**
📝 ${e.description}
📊 ${e.linesChanged??0} líneas modificadas
💾 Backup creado
⚠️ Reinicia el servidor para aplicar los cambios.`:`❌ ${e.message??"No se pudo aplicar el fix."}`;case"list_all_products":{const o=e.products??[],n=e.byStatus??{};if(!o.length)return"📦 No se encontraron productos.";const t=c=>c==="A"?"🟢":c==="B"?"🟡":c==="C"?"🟠":"🔴";let s=`📦 **${e.total} productos** (filtro: ${e.statusFilter??"any"})`;return Object.keys(n).length&&(s+=`
📊 ${Object.entries(n).map(([c,m])=>`${c}: ${m}`).join(" | ")}`),s+=`
📢 Publicados: ${e.published??"?"} | 🔇 No publicados: ${e.unpublished??"?"}

`,s+=o.map(c=>{const m=c.auditGrade||"D";let T=`${t(m)} **${c.title}** — ${c.price}€`;c.compareAtPrice&&(T+=` ~~${c.compareAtPrice}€~~`),T+=` | **${m}** (${c.auditScore??0}/100)`;const E=[];return c.imageCount!==void 0&&E.push(`${c.imageCount>=3?"✅":"⚠️"} ${c.imageCount} imgs`),c.variantCount!==void 0&&E.push(`${c.variantCount} variants`),c.descriptionLength!==void 0&&E.push(`${c.descriptionLength>=500?"✅":"⚠️"} ${c.descriptionLength}ch`),c.hasComparePrice!==void 0&&E.push(c.hasComparePrice?"✅ compare":"⚠️ sin compare"),E.length&&(T+=`
   ${E.join(" | ")}`),T}).join(`

`),s}case"get_orders":{const o=e.orders??[];return o.length?`🛒 **${e.total} pedidos:**
${o.map((n,t)=>`${t+1}. ${n.name} — ${n.total}€ (${n.financial}) — ${n.customer}`).join(`
`)}`:"🛒 No hay pedidos."}case"search_suppliers":{const o=e.topSuppliers??[];let n=`🔍 **Investigación de proveedores: ${e.productName}**

`;n+=`📊 **${e.suppliersFound} proveedores encontrados** (${e.sourcesAnalyzed} fuentes analizadas)

`,e.topRecommendation&&(n+=`🏆 **Recomendación:** ${e.topRecommendation}

`),o.length>0&&(n+=`**Top proveedores:**
${o.map((m,T)=>`${T+1}. ${m}`).join(`
`)}

`);const t=e.costBreakdown;t?.total&&(n+=`💰 **Costes:** Producción €${t.production||"?"} + Embalaje €${t.packaging||"?"} + Envío €${t.shipping||"?"} = **Total €${t.total}**
`,t.recommendedRetailPrice&&(n+=`🏷️ PVP recomendado: **€${t.recommendedRetailPrice}** (margen ${t.estimatedMargin||"N/A"})
`)),e.strategy&&(n+=`
🧠 **Estrategia:** ${e.strategy}
`);const s=e.risks;s?.length&&(n+=`
⚠️ **Riesgos:** ${s.join(" · ")}
`);const c=e.nextSteps;return c?.length&&(n+=`
📋 **Próximos pasos:**
${c.map((m,T)=>`${T+1}. ${m}`).join(`
`)}
`),n+=`
💾 Guardado en Shopy Crafter (ID: ${e.memoryId?.slice(0,8)||"N/A"})`,n+=`

📥 _Puedes descargar el informe completo con el botón de abajo._`,n}case"optimize_product":return`🧠 **Producto optimizado con IA:**
📝 "${e.title}"${e.previousTitle!==e.title?` (antes: "${e.previousTitle}")`:""}
🏷 ${e.tagsCount} tags SEO
📄 Descripción: ${e.descriptionLength} caracteres
🔍 SEO: ${e.seoTitle}
🖼 ${e.altTextsGenerated} alt texts generados`;case"optimize_all_products":{const o=e.products??[];let n=`🧠 **Optimización masiva IA:** ${e.optimized}/${e.total} productos
`;return o.length>0&&(n+=o.map((t,s)=>`${s+1}. ✅ ${t.title}`).join(`
`)),e.failed&&(n+=`
⚠️ ${e.failed} errores`),n}case"create_collection":return`📂 **Colección "${e.title}" creada**
🆔 ID: ${e.collectionId}
📋 Tipo: ${e.type}${e.productsAdded?`
📦 ${e.productsAdded} productos añadidos`:""}`;case"list_collections":{const o=e.collections??[];return o.length?`📂 **${e.total} colecciones:**
${o.map((n,t)=>`${t+1}. **${n.title}** (${n.type}) — ${n.productsCount} productos`).join(`
`)}`:"📂 No hay colecciones."}case"auto_collections":{const o=e.collections??[];return`📂 **${e.collectionsCreated} colecciones creadas automáticamente:**
${o.map((n,t)=>`${t+1}. **${n.title}** (${n.type})`).join(`
`)}`}case"create_page":return`📄 **Página "${e.title}" creada**
🆔 ID: ${e.pageId}
📝 ${e.contentLength} caracteres de contenido IA
🔗 /pages/${e.handle}`;case"list_pages":{const o=e.pages??[];return o.length?`📄 **${e.total} páginas:**
${o.map((n,t)=>`${t+1}. **${n.title}** — /pages/${n.handle} ${n.published?"✅":"⏸️"}`).join(`
`)}`:"📄 No hay páginas."}case"design_all_pages":{const o=e.pages??[];return`📄 **${e.pagesCreated} páginas diseñadas por IA:**
${o.map((n,t)=>`${t+1}. **${n.title}** → /pages/${n.handle}`).join(`
`)}`}case"optimize_images":return`🖼 **Optimización de imágenes completada:**
📊 ${e.productsProcessed} productos procesados
🖼 ${e.optimizedImages}/${e.totalImages} imágenes con alt text SEO`;case"read_cms":if(e.sections)return`📋 **CMS tiene ${e.totalSections} secciones:**
${e.sections.map(o=>`· ${o}`).join(`
`)}`;{const o=typeof e.value=="string"?e.value:JSON.stringify(e.value,null,2);return`📋 **CMS — ${e.section}:**
${o.length>2e3?o.slice(0,2e3)+`

... *(contenido completo disponible en la respuesta)*`:o}`}case"update_cms":return`✅ **CMS actualizado:**
📝 Campo: \`${e.path}\`
💾 Nuevo valor: ${typeof e.value=="string"?`"${e.value}"`:JSON.stringify(e.value)}`;case"update_cms_batch":return`✅ **CMS batch actualizado:**
📝 ${e.changesApplied} campos modificados:
${e.paths.map(o=>`· \`${o}\``).join(`
`)}`;case"reset_cms":return"🔄 **CMS reseteado a valores por defecto.** Todos los textos de la landing, panel admin y panel cliente han vuelto a su estado original.";case"generate_competitive_pricing":{const o=e.plans??[];let n=`🎯 **${e.plansGenerated} planes de precio generados**

`;return n+=o.map((t,s)=>`${s+1}. **${t.name}** — ${t.price}${t.featured?" ⭐":""}${t.badge?` [${t.badge}]`:""}`).join(`
`),e.cmsUpdated&&(n+=`

✅ CMS actualizado con los nuevos planes`),e.shopifyProductsCreated&&(n+=`
🛍️ ${e.shopifyProductsCreated} productos creados en tu tienda`),e.strategy&&(n+=`

🧠 ${e.strategy}`),e.competitorsAnalyzed&&(n+=`
📊 ${e.competitorsAnalyzed} competidores analizados`),n}case"audit_app_offerings":return e.audit?`🔍 **Auditoría de la oferta:**

${e.audit}`:e.message??"Auditoría completada.";case"modify_ui":return e.success?`✅ **Cambio UI aplicado:**
${e.summary}
📁 Archivos: ${e.files?.join(", ")}
🔧 ${e.changesApplied} cambios
⚠️ Recarga la página para ver los cambios.`:`⚠️ ${e.message??"No se pudieron aplicar los cambios automáticamente."}`;case"redesign_product":return`🎨 **Rediseño IA completado:**
📝 "${e.newTitle||e.title}"
📄 Descripción: ${e.descriptionLength||"?"} chars con ${e.sectionsGenerated||8} secciones
🏷 ${e.tagsCount||"?"} tags SEO
📸 ${e.photoBriefs||0} briefs de fotografía

${e.message||"Listo para aplicar con apply_redesign."}`;case"apply_redesign":return`✅ **Rediseño aplicado en tu tienda:**
📝 "${e.title}"
📊 Título + Descripción + Tags + SEO actualizados
${e.message||""}`;case"bulk_redesign":return`🎨 **Rediseño masivo completado:**
📦 ${e.total||"?"} productos procesados
✅ ${e.redesigned||"?"} rediseñados
${e.failed?`❌ ${e.failed} errores`:""}
${e.message||""}`;case"seo_full_audit":return`📊 **Auditoría SEO completada (16 criterios):**
🏆 Score: **${e.averageScore||e.score||"?"}**/100
📦 ${e.productsAudited||e.total||"?"} productos analizados
${e.topIssues?`
⚠️ **Problemas principales:**
${e.topIssues.map(o=>`· ${o}`).join(`
`)}`:""}
${e.message||""}`;case"keyword_intelligence":{const o=e.message||JSON.stringify(e.keywords||e.data||e,null,2);return`🔍 **Keyword Intelligence:**
${o.length>3e3?o.slice(0,3e3)+`

... *(datos completos disponibles)*`:o}`}case"generate_schemas":return`📋 **Schemas JSON-LD generados e inyectados:**
${e.message||`${e.totalItems||"?"} productos con schema Product + FAQ + Breadcrumb. Organization + WebSite inyectados en theme.liquid.`}`;case"generate_all_metas":return`🏷️ **Meta tags generados:**
${e.message||`Meta titles (40-60 chars) + descriptions (130-155 chars) para ${e.totalItems||"?"} productos.`}`;case"fix_all_alt_texts":return`🖼️ **Alt texts corregidos:**
${e.message||"Todas las imágenes ahora tienen alt text SEO optimizado."}`;case"generate_sitemap":return`🗺️ **Sitemap generado:**
${e.message||"XML sitemap actualizado y ping a Google enviado."}`;case"audit_page_speed":return`⚡ **PageSpeed auditado:**
${e.message||`Mobile: ${e.mobileScore||"?"}/100 | Desktop: ${e.desktopScore||"?"}/100`}`;case"blog_strategy":return`📝 **Estrategia blog SEO generada:**
${e.message||`${e.topics||"?"} temas pillar + cluster`}`;case"generate_blog_post":return`📄 **Artículo blog SEO generado:**
${e.message||`${e.wordCount||1500} palabras optimizadas para posicionamiento.`}`;case"generate_email_flow":return`📧 **Flujo email marketing generado:**
${e.message||`${e.flowsGenerated||6} flujos: Welcome, Abandoned Cart, Post-Purchase, Browse, Win-back, VIP.
Cada uno con ${e.emailsPerFlow||"2-4"} emails HTML listos.`}`;case"generate_email":return`📧 **Email generado:**
${e.message||"Template HTML responsive con CSS inline listo para enviar."}`;case"list_themes":{const o=e.themes??[];return`🎨 **${e.total||o.length} themes:**
${o.map((n,t)=>`${t+1}. **${n.name}** (${n.role}) ID: ${n.id}`).join(`
`)}`}case"list_theme_files":{const o=e.message||JSON.stringify(e.files||e,null,2);return`📂 **Archivos del theme:**
${o.length>3e3?o.slice(0,3e3)+`

... *(lista completa disponible)*`:o}`}case"read_theme_file":{const o=(e.content||e.value||"").toString();return`📄 **${e.assetKey||"Archivo"}:**
\`\`\`
${o.length>5e3?o.slice(0,5e3)+`

... *(archivo completo: `+o.length+" chars)*":o}
\`\`\``}case"edit_theme_file":return`✅ **Theme file editado:**
📁 ${e.assetKey}
${e.message||"Cambios aplicados al theme."}`;case"edit_theme_css":return`🎨 **CSS del theme actualizado:**
📁 ${e.assetKey||"assets/custom.css"}
${e.message||"Estilos añadidos sin perder código existente."}`;case"edit_theme_settings":return`⚙️ **Settings del theme actualizados:**
${e.message||"settings_data.json actualizado con deep merge."}`;case"create_theme_section":return`📐 **Sección Liquid creada:**
📁 ${e.assetKey}
${e.message||"Sección con schema completo lista para el Theme Editor."}`;case"audit_theme":return`🎨 **Auditoría de theme completada:**
${e.message||e.audit||`Score: ${e.score||"?"}/100`}`;case"calculate_optimal_price":return`💰 **Precio óptimo calculado:**
${e.message||`Precio recomendado: €${e.optimalPrice||"?"}`}`;case"estimate_cogs":return`📊 **COGS estimado:**
${e.message||`Coste estimado: €${e.estimatedCogs||e.cogs||"?"}`}`;case"price_simulator":return`📈 **Simulación de precio:**
${e.message||`Escenarios analizados para precio €${e.newPrice||"?"}`}`;case"financial_forecast":return`📊 **Proyección financiera:**
${e.message||`Forecast a ${e.months||6} meses generado.`}`;case"financial_dashboard":return`💰 **Dashboard financiero:**
${e.message||`Revenue: €${e.totalRevenue||"?"} | Margen: ${e.avgMargin||"?"}%`}`;case"scan_competitor":return`🔍 **Competidor escaneado:**
${e.message||"Precios, productos y estrategia analizados."}`;case"analyze_competitor_product":return`📊 **Análisis competitivo:**
${e.message||"Producto comparado contra competidores del mercado."}`;case"create_ab_test":return`🔬 **A/B Test creado:**
${e.message||`Test ${e.testId||""} iniciado: ${e.testType||"price"}.`}`;case"list_ab_tests":{const o=e.tests??[];return o.length?`🔬 **${e.total||o.length} tests:**
${o.map((n,t)=>`${t+1}. ID: ${n.id} — ${n.type} (${n.status})`).join(`
`)}`:"🔬 No hay tests A/B activos."}case"declare_winner":return`🏆 **Winner declarado:**
${e.message||"Variante ganadora aplicada al producto."}`;case"bulk_generate_images":return`🖼️ **Generación masiva de imágenes:**
${e.message||`Job ${e.jobId||""} iniciado para ${e.totalImages||"?"} imágenes.`}`;case"generate_product_images":return`🖼️ **Imágenes generadas:**
${e.message||`${e.imagesGenerated||"?"} imágenes IA para el producto.`}`;case"generate_images_from_reference":return`📸 **Imágenes desde referencia:**
${e.message||`${e.imagesGenerated||"?"} fotos profesionales generadas desde imagen de referencia.`}`;case"setup_full_store":return`🏪 **Setup completo de tienda:**
${e.message||"Configuración completa aplicada."}`;case"copyright_audit":return e.message||`⚖️ **Auditoría de copyright:**
${e.totalProducts||"?"} productos analizados · ${e.riskProducts?.length||0} con riesgos`;case"brain_stats":return`🧠 **Shopy Crafter stats:**
${e.message||`${e.totalMemories||"?"} memorias · ${e.totalInsights||"?"} insights`}`;case"brain_sync":return`🧠 **Brain sincronizado:**
${e.message||"Conocimiento actualizado."}`;case"inventory_sync":return`📦 **Inventario sincronizado:**
${e.message||"Stock actualizado desde tu tienda."}`;case"inventory_alerts":return`⚠️ **Alertas de inventario:**
${e.message||"Verificación de stock completada."}`;case"inventory_deep_report":return`📦 **Informe profundo de inventario:**
${e.message||"Análisis completo de stock generado."}`;case"inventory_sync_orders":return`📋 **Pedidos sincronizados:**
${e.message||"Datos de ventas importados de tu tienda."}`;case"inventory_sales_analytics":return`📈 **Analytics de ventas:**
${e.message||"Análisis de ventas por producto, variante y cliente."}`;case"inventory_customer_history":return`👤 **Historial de cliente:**
${e.message||"Historial de compras del cliente."}`;case"agency_quote":return`💼 **Presupuesto generado:**
${e.message||"Propuesta de precio personalizada lista."}`;case"agency_proposal":return`📋 **Propuesta de agencia:**
${e.message||"Documento de propuesta generado."}`;case"learn_from_url":return`🧠 **URL absorbida:**
${e.message||"Contenido aprendido con éxito."}`;case"learn_from_content":return`🧠 **Contenido absorbido:**
${e.message||"Conocimiento memorizado."}`;case"recall_knowledge":return`🔍 **Búsqueda en memoria:**
${e.message||`${e.memories||0} memorias encontradas.`}`;case"brain_status":return`🧠 **Estado del cerebro:**
${e.message||`${e.totalMemories||"?"} memorias totales.`}`;case"analyze_external_store":case"external_pre_report":return`🔍 **Análisis de tienda externa:**
${e.message||"Análisis completado."}${e.savedToVault?`

💾 Informe guardado en el vault.`:""}`;case"browser_action":{const o=e;if(!o.success)return`❌ **Error de navegación**: ${o.message}`;let n=`🌐 **Navegación completada** — "${o.goal}"
`;return n+=`✅ ${o.stepsOk}/${o.stepsExecuted} pasos ejecutados
`,o.finalUrl&&(n+=`🔗 URL: ${o.finalUrl}
`),o.screenshots?.length&&(n+=`📸 ${o.screenshots.length} captura(s) tomadas
`),o.youtubeEmbed&&(n+=`
▶️ **Vídeo encontrado** — reproduciendo abajo.`),o.extractedText&&(n+=`

📄 **Texto extraído:**
${o.extractedText.slice(0,400)}...`),n}case"upload_file":{const o=e;if(o.error)return`❌ ${o.error}`;if(!o.hasContent)return o.message||o.analysis||"📎 Indica qué archivo quieres subir.";let n=`📄 **Archivo procesado:** ${o.fileName||"archivo"}
`;return o.fileType&&o.fileType!=="desconocido"&&(n+=`🗂️ Tipo: ${o.fileType}
`),o.contentLength&&(n+=`📏 Tamaño: ${o.contentLength.toLocaleString()} caracteres
`),n+=`
${o.analysis||o.message||""}`,n}case"browser_research":{const o=e;if(o.error)return`❌ ${o.message}`;let n=`🔬 **Investigación completada**: "${o.topic}"
`;return n+=`📚 ${o.sourcesCount||0} fuentes web consultadas
`,o.vaultId&&(n+=`
💾 **Informe guardado en el Vault** (ID: ${o.vaultId})
`,n+=`🌐 Ver informe: ${o.vaultUrl}
`,n+=`📥 Descargar PDF: ${o.vaultUrl}?format=pdf`),n}case"generate_brand_book":{const o=e;if(o.error)return`❌ ${o.message}`;let n=`📖 **Brand Book generado**: "${o.brandName}"
`;return o.tagline&&(n+=`💬 Tagline: "${o.tagline}"
`),o.archetype&&(n+=`🎭 Arquetipo: ${o.archetype}
`),o.colorsCount&&(n+=`🎨 ${o.colorsCount} colores | 💡 ${o.valuesCount||0} valores
`),o.vaultId&&(n+=`
💾 **Brand Book guardado en el Vault** (ID: ${o.vaultId})
`,n+=`🌐 Ver: ${o.vaultUrl}
`,n+=`📥 Descargar PDF: ${o.vaultUrl}?format=pdf`),n}case"create_brand_ad":{const o=e;if(o.error)return`❌ ${o.message||o.error}`;const n=o.videoUrl||(o.vaultId&&o.projectId?`/api/projects/${o.projectId}/vault/${o.vaultId}/download`:"");let t=`🎬✅ **Anuncio de marca generado**
`;return o.durationSec&&(t+=`⏱️ ${o.durationSec}s`),o.scenesCount&&(t+=` · ${o.scenesCount} escenas`),t+=`
`,n&&(t+=`[VIDEO:Anuncio de marca](${n})
`,t+=`📥 [Descargar vídeo](${n})
`),o.vaultId&&(t+=`💾 Vault #${o.vaultId}`),o.scriptVaultId&&(t+=` · 📜 Script reutilizable Vault #${o.scriptVaultId}`),t.trim()}case"create_long_ad":{const o=e;if(o.error)return`❌ ${o.message||o.error}`;const n=o.videoUrl||(o.vaultId&&o.projectId?`/api/projects/${o.projectId}/vault/${o.vaultId}/download`:"");let t=`🎬✅ **Anuncio largo generado**
`;return o.durationSec&&(t+=`⏱️ ${o.durationSec}s`),o.scenesCount&&(t+=` · ${o.scenesCount} escenas`),o.compositionMode&&(t+=` · modo ${o.compositionMode}`),t+=`
`,n&&(t+=`[VIDEO:Anuncio largo](${n})
`,t+=`📥 [Descargar vídeo](${n})
`),o.vaultId&&(t+=`💾 Vault #${o.vaultId}`),t.trim()}case"create_montage_video":{const o=e;if(o.error)return`❌ ${o.message||o.error}`;const n=o.videoUrl||(o.vaultId&&o.projectId?`/api/projects/${o.projectId}/vault/${o.vaultId}/download`:"");let t=`🎞️✅ **Vídeo montaje creado**
`;return o.clipsCount&&(t+=`🎞️ ${o.clipsCount} clips`),o.sizeBytes&&(t+=` · ${(o.sizeBytes/1024/1024).toFixed(1)} MB`),t+=`
`,n&&(t+=`[VIDEO:Montaje](${n})
`,t+=`📥 [Descargar vídeo](${n})
`),o.vaultId&&(t+=`💾 Vault #${o.vaultId}`),t.trim()}case"generate_video":{const o=e;if(o.error)return`❌ ${o.message||o.error}`;const n=o.videoUrl||o.url||"";let t=`🎬 **Vídeo generado** con ${o.model||"IA"}
`;return o.durationSec&&(t+=`⏱️ ${o.durationSec}s`),o.aspect&&(t+=` · ${o.aspect}`),t+=`
`,n&&(t+=`[VIDEO:Vídeo IA](${n})
`,t+=`📥 [Descargar vídeo](${n})
`),o.vaultId&&(t+=`💾 Guardado en Vault #${o.vaultId}`),t.trim()}case"platform_store_status":case"platform_list_products":case"platform_get_product":case"platform_create_product":case"platform_edit_product":case"platform_delete_product":case"platform_get_orders":case"platform_update_stock":case"platform_update_seo":return e.message?`✅ ${e.message}`:"✅ Acción completada.";case"stripe_list_accounts":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.accounts||[];if(!n.length)return"💳 No hay cuentas Stripe conectadas. Ve a **Admin → Stripe Manager** para conectar una.";let t=`💳 **${n.length} cuenta(s) Stripe conectada(s):**
`;for(const s of n)t+=`• ${s.displayName||s.display_name||s.businessName||s.accountId||s.account_id} — ${s.email||"sin email"} (${s.accountId||s.account_id})
`;return t.trim()}case"stripe_account_overview":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.balance||{},t=o.metrics||{},s=m=>m!=null?`€${(m/100).toFixed(2)}`:"—";let c=`💳 **Cuenta Stripe — Overview**
`;if(c+=`💰 Saldo disponible: **${s(n.available)}** · Pendiente: ${s(n.pending)}
`,c+=`📊 Volumen 30d: **${s(t.grossVolume)}** bruto · ${s(t.netVolume)} neto
`,c+=`✅ ${t.successCount??"?"} pagos exitosos · ❌ ${t.failedCount??"?"} fallidos
`,o.recentCharges?.length){c+=`
🧾 **Últimos cobros:**
`;for(const m of(o.recentCharges||[]).slice(0,5))c+=`• ${s(m.amount)} — ${m.status} — ${m.description||m.id}
`}return c.trim()}case"stripe_list_transactions":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.transactions||o.data||[];let t=`💰 **${n.length} transacción(es) Stripe:**
`;for(const s of n.slice(0,15))t+=`• ${s.amount!=null?`€${(s.amount/100).toFixed(2)}`:"—"} — ${s.status} — ${s.description||s.id}${s.customerEmail?` (${s.customerEmail})`:""}
`;return t.trim()||"Sin transacciones"}case"stripe_list_customers":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.customers||o.data||[];let t=`👥 **${n.length} cliente(s) en Stripe:**
`;for(const s of n.slice(0,15))t+=`• ${s.name||"Sin nombre"} — ${s.email||"sin email"} (${s.id})
`;return t.trim()||"Sin clientes"}case"stripe_list_subscriptions":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.subscriptions||o.data||[];let t=`🔄 **${n.length} suscripción(es) Stripe:**
`;for(const s of n.slice(0,15)){const c=s.items?.[0];t+=`• ${s.id} — ${s.status}${c?` — €${((c.amount||0)/100).toFixed(2)}/${c.interval}`:""}${s.cancelAtPeriodEnd?" · 🔴 cancela al renovar":""}
`}return t.trim()||"Sin suscripciones"}case"stripe_list_products":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.products||[];if(!n.length)return"📦 No hay productos en el catálogo Stripe. Puedes crear uno con `stripe_create_product`.";let t=`📦 **${n.length} producto(s) en catálogo Stripe:**
`;for(const s of n.slice(0,15)){const c=(s.prices||[]).map(m=>m.amount?`€${(m.amount/100).toFixed(2)}${m.interval?`/${m.interval}`:""}`:"sin precio").join(", ");t+=`• **${s.name}** — ${c||"sin precio"} — ${s.active?"✅ activo":"⛔ archivado"}
`}return t.trim()}case"stripe_list_invoices":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.invoices||[];let t=`🧾 **${n.length} factura(s) Stripe:**
`;for(const s of n.slice(0,15)){const c=s.status==="paid"?"✅":s.status==="open"?"📬":s.status==="void"?"🚫":"📋";t+=`• ${c} ${s.number||s.id} — ${s.customerEmail||s.customer} — €${((s.amountDue||0)/100).toFixed(2)} — ${s.status}`,s.hostedUrl&&(t+=` — [Ver factura](${s.hostedUrl})`),t+=`
`}return t.trim()||"Sin facturas"}case"stripe_list_payouts":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.payouts||[];let t=`🏦 **${n.length} payout(s) Stripe:**
`;for(const s of n.slice(0,15)){const c=s.status==="paid"?"✅":s.status==="pending"?"⏳":s.status==="failed"?"❌":"📋",m=s.arrivalDate?new Date(s.arrivalDate*1e3).toLocaleDateString("es-ES"):"—";t+=`• ${c} €${((s.amount||0)/100).toFixed(2)} — llegada: ${m} — ${s.type}
`}return t.trim()||"Sin payouts"}case"stripe_create_product":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.product||{},t=o.price;let s=`📦 **Producto creado en Stripe:**
`;return s+=`• **${n.name}** (${n.id})
`,t&&(s+=`• Precio: €${((t.unit_amount||0)/100).toFixed(2)} ${t.currency?.toUpperCase()}${t.recurring?.interval?`/${t.recurring.interval}`:""}
`),s+=`• Estado: ${n.active?"✅ activo":"archivado"}`,s}case"stripe_create_charge":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.paymentIntent||{};let t=`💳 **PaymentIntent creado:**
`;return t+=`• ID: \`${n.id}\`
`,t+=`• Importe: €${((n.amount||0)/100).toFixed(2)} ${(n.currency||"").toUpperCase()}
`,t+=`• Estado: ${n.status}
`,n.clientSecret&&(t+="• ClientSecret disponible para completar el pago en el frontend"),t}case"stripe_create_customer":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.customer||{};return`👤 **Cliente creado en Stripe:**
• **${n.name||"Sin nombre"}** — ${n.email}
• ID: \`${n.id}\``}case"stripe_create_invoice":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.invoice||{};let t=`🧾 **Factura creada:**
`;return t+=`• Número: ${n.number||n.id}
`,t+=`• Estado: ${n.status}
`,t+=`• Total: €${((n.amountDue||0)/100).toFixed(2)}
`,n.hostedUrl&&(t+=`• [🔗 Ver factura online](${n.hostedUrl})
`),t+=`
Usa \`stripe_send_invoice\` con invoiceId: \`${n.id}\` para enviarla al cliente.`,t}case"stripe_send_invoice":{const o=e;if(o.error)return`❌ ${o.error}`;let n=`📬 **Factura enviada al cliente**
• Estado: ${o.status}
`;return o.hostedUrl&&(n+=`• [🔗 Ver factura online](${o.hostedUrl})`),n}case"stripe_create_refund":{const o=e;if(o.error)return`❌ ${o.error}`;const n=o.refund||{};return`↩️ **Reembolso creado:**
• ID: \`${n.id}\`
• Importe: €${((n.amount||0)/100).toFixed(2)}
• Estado: ${n.status}`}case"stripe_cancel_subscription":{const o=e;return o.error?`❌ ${o.error}`:`🔴 **Suscripción cancelada**
• Estado: ${o.status}
• ${o.message||"Cancelación procesada correctamente"}`}default:return e.message?`✅ ${e.message}`:"✅ Acción completada."}},_a=async(i,e,o)=>{try{const t=i.type.startsWith("image/")?"absorb-image":"absorb-document",s=new FormData;s.append("file",i),s.append("label",i.name);const c=await fetch(`${G}/api/shopybrain/${t}`,{method:"POST",credentials:"include",body:s,signal:o});if(!c.ok)throw new Error(await c.text());return c.json()}catch(n){throw new Error(n instanceof Error?n.message:"Error absorbing file")}},po=async(i,e,o)=>{try{const n=await fetch(`${G}/api/shopybrain/absorb-url`,{method:"POST",credentials:"include",signal:o,headers:{"Content-Type":"application/json"},body:JSON.stringify({url:i,niche:e})});if(!n.ok)throw new Error(await n.text());return n.json()}catch(n){throw new Error(n instanceof Error?n.message:"Error absorbing URL")}},Ia=i=>{const e=i.toLowerCase();return e.match(/\b(investiga|researcha|busca todo|búscalo todo|investigaci[oó]n exhaustiva|investigar (en profundidad|completamente|todo sobre|a fondo)|deep research|d[ée]jame saber todo|qu[eé]ro saber todo|todo sobre|analiza (la )?marca|perfil (de )?marca)\b/)?i.match(/(?:investiga|researcha|busca todo sobre|investigaci[oó]n de|todo sobre|analiza(?:\s+la\s+marca)?)\s+(.+?)(?:\s+(?:en profundidad|completamente|a fondo|exhaustiv))?$/i)?.[1]?.trim()??i:i.match(/^@[a-zA-Z0-9_.]{2,}$/)||i.match(/^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/.*)?$/)&&!e.includes("absorb")?i.trim():null},uo=async(i,e,o)=>{try{const n=await fetch(`${G}/api/shopybrain/research-entity-sync`,{method:"POST",credentials:"include",signal:o,headers:{"Content-Type":"application/json"},body:JSON.stringify({input:i,niche:e,market:"es"})});if(!n.ok)throw new Error(await n.text());return n.json()}catch(n){throw new Error(n instanceof Error?n.message:"Error researching entity")}},wa=i=>{const e=i.toLowerCase(),o=e.includes("klaviyo"),n=(e.includes("workflow")||e.includes("flujo"))&&(e.includes("email")||e.includes("correo")||e.includes("newsletter")||e.includes("klaviyo")),t=e.includes("email marketing")&&(e.includes("genera")||e.includes("crea")||e.includes("diseña")||e.includes("workflow")||e.includes("flujo"));if(!o&&!n&&!t)return null;const c=i.match(/([a-zA-Z0-9-]+\.myshopify\.com)/)?.[1]??"mitienda.myshopify.com",m=c.split(".")[0].replace(/-/g," ").replace(/\b\w/g,T=>T.toUpperCase());return{shopDomain:c,storeName:m,niche:"eCommerce"}},He=x.useRef(null),Aa=x.useRef(null),pe=x.useCallback(async i=>{const e=(i??V).trim();if(L||!e&&!M&&!X)return;He.current&&He.current.abort();const o=new AbortController;He.current=o;const n=!!(M||X),t=M?M.type.startsWith("image/")?"image":M.type.startsWith("video/")?"video":"document":"url",s=M?.name??X,c={id:ie(),role:"user",content:e||`📎 ${s}`,timestamp:new Date,attachmentType:n?t:void 0,attachmentName:n?s:void 0},m=ie(),T={auto:"gemini+claude+brain",claude:Q,gemini:"gemini+search",brain_only:"brain",grok:"grok-3",gpt:je};y(r=>[...r,c,{id:m,role:"assistant",content:"🧠 Analizando tu solicitud...",timestamp:new Date,model:T[R]||"gemini+claude+brain"}]),U(""),Ee(null),Ge([]),Pe(""),Le(!1),K(!0),Aa.current=null;let E;const k=(r,O,N=12e4)=>{const q=setTimeout(()=>o.abort(),N);return fetch(r,{...O,signal:o.signal}).finally(()=>clearTimeout(q))};try{let r="",O,N,q,ye=!1;const ce=e.toLowerCase(),ra=/\b(gr[aá]b[ae]me|graba|grabar|inicia\s+(la\s+)?grabaci[oó]n|empieza\s+(a\s+)?grabar|start\s+recording|graba\s+la\s+pantalla|graba\s+esto|necesito\s+que\s+grab|quiero\s+(que\s+)?grab)\b/.test(ce);if(/\b(para\s+(la\s+)?grabaci[oó]n|detener?\s+(la\s+)?grabaci[oó]n|stop\s+grabaci[oó]n|stop\s+recording|termina\s+(la\s+)?grabaci[oó]n|deja\s+de\s+grabar|fin\s+(de\s+la\s+)?grabaci[oó]n|acaba\s+(la\s+)?grabaci[oó]n)\b/.test(ce)){K(!1);let v="";if(_e){ta();const A=Math.floor(Be/60),h=Be%60;v=`⏹️ **Grabación detenida** — Duración: ${A>0?`${A}m `:""}${h}s

📥 El vídeo se está descargando automáticamente como **ShopyCrafter_FECHA.webm**.`}else v="ℹ️ No hay ninguna grabación activa en este momento.";y(A=>A.map(h=>h.id===m?{...h,content:v}:h));return}if(ra){const v=mo(e);if(v&&v.length>1){y(b=>b.map($=>$.id===m?{...$,content:`🔴 **Modo grabación secuencial — ${v.length} tareas detectadas**

${v.map((I,z)=>`**${z+1}.** ${I}`).join(`
`)}

_Iniciando grabación…_`}:$));const h=await ya();if(!h.startsWith("✅")){y(b=>b.map($=>$.id===m?{...$,content:h}:$)),K(!1);return}oa.current=v.slice(1),he.current={total:v.length,completed:1,isActive:!0,recordingMode:!0},y(b=>[...b.map($=>$.id===m?{...$,content:`${h}

▶️ **[1/${v.length}]** Iniciando: ${v[0]}`}:$)]),K(!1),setTimeout(()=>na.current?.(v[0]),400);return}K(!1);const A=await ya();y(h=>h.map(u=>u.id===m?{...u,content:A}:u));return}if(/\b(try.?on|probador\s*virtual|prueba\s+virtual|virtual\s+try.?on|gen[ea]r[ae].*try.?on|genera.*probador|ponme\s+(con|este)|muéstrame\s+(con|usando))\b/i.test(ce)){const v=g.match(/\/projects\/(\d+)/)?.[1],A=e.replace(/\b(gr[aá]b[ae]me\s+)?genera[r]?\s+(un|una\s+)?try.?on\s+(con\s+)?/i,"").trim()||"professional virtual try-on, person wearing the product, realistic studio lighting, white background, fashion editorial";if(!v)r="⚠️ **Necesito un proyecto activo** para generar el try-on. Ve a tus proyectos y abre uno, luego vuelve a pedírmelo.";else if(!n)r="📎 **Adjunta la imagen** del producto (o de la persona) para generar el virtual try-on. Puedes arrastrarla al chat o usar el clip.";else if(M&&t==="image"){y(h=>h.map(u=>u.id===m?{...u,content:`🎭 **Generando Virtual Try-On…**

_Procesando imagen con IA (Flux Kontext)…_`,model:"flux-kontext"}:u));try{const h=new FormData;h.append("image",M),h.append("projectId",v),h.append("model","flux-kontext-pro"),h.append("prompt",`${A}, high quality fashion photography, clean background, professional lighting, 4K`),h.append("aspectRatio","1:1");const u=await k(`${G}/api/fs-pro/edit-image`,{method:"POST",credentials:"include",body:h},9e4);if(u.ok){const b=await u.json();b.dataUrl?r=`🎭 **Virtual Try-On generado**

![Try-On](${b.dataUrl})

_Modelo: ${b.model??"flux-kontext-pro"} · Guardado en Bóveda${b.vaultId?` #${b.vaultId}`:""}_`:r="❌ El servidor no devolvió imagen. Prueba con una imagen más clara del producto."}else{const b=await u.text().catch(()=>"");r=`❌ Error generando try-on (${u.status}): ${b.slice(0,200)}`}}catch(h){r=`❌ Error try-on: ${h?.message??String(h)}`}}else r="📎 Necesito una **imagen** (no vídeo ni PDF) para el try-on. Adjunta la foto del producto.";y(h=>h.map(u=>u.id===m?{...u,content:r,model:"flux-kontext-pro"}:u)),K(!1);return}if(/\b(list[ae]me?\s+(los\s+)?prompt|mu[eé]strame\s+(los\s+)?prompt|dame\s+(los\s+)?prompt|qu[eé]\s+prompt[s]?\s+(hay|tienes|existen)|cat[aá]logo\s+de\s+prompt)\b/i.test(ce)){y(v=>v.map(A=>A.id===m?{...A,content:"📚 Cargando biblioteca de prompts…"}:A));try{const v=await k(`${G}/api/shopybrain/prompt-library`,{credentials:"include"},15e3);if(v.ok){const h=(await v.json()).prompts??[];if(h.length===0)r="📚 La biblioteca de prompts está vacía. Puedes añadir prompts desde la sección Prompt Library.";else{const u={};h.forEach(b=>{const $=b.category??"General";(u[$]=u[$]??[]).push(b)}),r=`📚 **Biblioteca de Prompts** — ${h.length} prompts disponibles

`,Object.entries(u).slice(0,10).forEach(([b,$])=>{r+=`### ${b}
`,$.slice(0,5).forEach(I=>{r+=`- **${I.name??"Sin nombre"}**${I.tags?.length?` · \`${I.tags.slice(0,3).join(", ")}\``:""}
`}),$.length>5&&(r+=`  _… y ${$.length-5} más en esta categoría_
`),r+=`
`}),Object.keys(u).length>10&&(r+=`_…y ${Object.keys(u).length-10} categorías más. Visita la sección Prompt Library para explorar todos._`)}}else r="❌ No pude cargar la biblioteca de prompts. Prueba visitando la sección Prompt Library directamente."}catch{r="❌ Error cargando prompts. Verifica tu conexión e inténtalo de nuevo."}y(v=>v.map(A=>A.id===m?{...A,content:r}:A)),K(!1);return}const fo=v=>{const A=v.toLowerCase(),h=["crea","crear","créame","creame","publica","sube","subir","añade","añadir","pon","poner","haz","hacer","genera","generar","create","make","add","upload"],u=["producto","product","artículo","articulo","item","listing"],b=["shopify","tienda","store","shop"],$=h.some(z=>A.includes(z)),I=u.some(z=>A.includes(z))||b.some(z=>A.includes(z));return $&&I};if(n){const v=g.match(/\/projects\/(\d+)/)?.[1];if(e&&t==="image"&&fo(e)&&v&&M){y(b=>[...b,{id:ie(),role:"assistant",content:`🚀 **Creando producto desde imagen** — ${s}

**Paso 1** — Claude Vision analiza el producto en profundidad
**Paso 2** — Gemini investiga precios REALES del mercado (búsquedas Google)
**Paso 3** — Claude genera copywriting profesional optimizado
**Paso 4** — Se crea el producto en tu tienda con la imagen

_⏱️ Esto puede tardar 30-60 segundos. Investigando precios reales..._`,timestamp:new Date,model:"gemini+claude+brain"}]);const h=new FormData;h.append("file",M),h.append("projectId",v),e&&h.append("userInstruction",e);const u=await k(`${G}/api/shopybrain/create-product-from-image`,{method:"POST",credentials:"include",body:h},18e4);if(u.ok){const b=await u.json(),$=b.product,I=b.pricing,z=b.analysis;r=`✅ **Producto creado en tu tienda**

`,r+=`📦 **${$.title}**
`,r+=`🏷️ ID: \`${$.id}\` | Estado: \`${$.status}\`

`,r+=`💰 **Precio: €${I.recommendedPrice}**`,I.compareAtPrice&&(r+=` ~~€${I.compareAtPrice}~~`),r+=`
`,I.sourcesResearched>0&&(r+=`📊 **Investigación de precios** (${I.sourcesResearched} fuentes analizadas):
`,(I.sources||[]).slice(0,4).forEach(w=>{r+=`  · ${w.source}: €${w.price} — ${w.product}
`}),I.marketAverage&&(r+=`  📈 Media del mercado: €${I.marketAverage}
`),r+=`
`),I.justification&&(r+=`💡 **Por qué este precio:** ${I.justification}

`),z?.materials?.length&&(r+=`🔬 **Materiales:** ${z.materials.join(", ")}
`),z?.qualityTier&&(r+=`⭐ **Calidad:** ${z.qualityTier}
`),z?.keyFeatures?.length&&(r+=`✨ **Features:** ${z.keyFeatures.slice(0,4).join(" · ")}
`),r+=`
_El producto está en borrador. Revísalo y publícalo cuando estés listo._`,O={type:"shopify-action",label:"Ver producto creado",data:b}}else r=`❌ Error creando el producto: ${await u.text()}`}else{const h=t==="document"?`📄 Absorbiendo documento **${s}**...

Analizando contenido: estructura, datos, productos, precios, instrucciones...
Extrayendo toda la información relevante para tu eCommerce.

_Procesando con IA..._`:t==="image"?`🔬 Absorbiendo imagen **${s}**...

Analizando: composición visual, paleta de colores, texturas y superficies, topología y geometría, técnica de rendering, composición química/técnica, inteligencia de marca, señales eCommerce, impacto psicológico...

_Esto puede tardar 20-40 segundos._`:t==="video"?`🎬 Absorbiendo vídeo **${s}**...

Extrayendo: técnica de producción, estilo visual, señales de conversión, estrategia de marketing...

_Procesando..._`:(()=>{const w=Ja(X);return`${w.icon} Absorbiendo **${w.label}**: ${X}

Extrayendo: contenido, marca, productos, audiencia, estrategia, señales eCommerce...

_Analizando con Gemini + Claude..._`})();y(w=>[...w,{id:ie(),role:"assistant",content:h,timestamp:new Date,model:"gemini+claude+brain"}]);let u;const b=ke.length>0?ke:M?[M]:[];if(b.length>1){const w=[];for(const C of b)try{const ae=await _a(C,void 0,o.signal);w.push({file:C,result:ae})}catch(ae){w.push({file:C,error:ae instanceof Error?ae.message:String(ae)})}const D=w.filter(C=>C.result&&C.result.success!==!1),F=w.filter(C=>C.error||C.result&&C.result.success===!1);u=D[0]?.result||{success:!1,sourceType:"",title:"",analysis:{}},D.length===0?r=`❌ **0/${b.length} archivos procesados** — todos fallaron.

`:F.length>0?r=`⚠️ **${D.length}/${b.length} archivos absorbidos** (${F.length} con error)

`:r=`✅ **${D.length}/${b.length} archivos absorbidos a Shopy Crafter**

`;for(const C of w)C.result&&C.result.success!==!1?r+=`✅ **${C.file.name}** ${C.result.memoryId?`(memoria #${C.result.memoryId.slice(0,8)})`:""}
`:C.result&&C.result.success===!1?r+=`⚠️ **${C.file.name}** — ${C.result.message??"sin contenido textual extraíble"}
`:r+=`❌ **${C.file.name}** — ${C.error}
`;r+=`
`}else M?(u=await _a(M,void 0,o.signal),r=u.success===!1?`${u.message??`⚠️ No se pudo extraer contenido de "${s}".`}

`:`✅ **Absorbido a Shopy Crafter**${u.memoryId?` (memoria #${u.memoryId.slice(0,8)})`:""}

`):(u=await po(X,void 0,o.signal),r=`✅ **Absorbido a Shopy Crafter**${u.memoryId?` (memoria #${u.memoryId.slice(0,8)})`:""}

`);const $=t==="document"||t==="video",I=t==="image",z=u.success!==!1;if(z&&$){const w=typeof u.analysis=="string"?u.analysis:JSON.stringify(u.analysis,null,2);r+=`📄 **Documento analizado:** ${s}
`,r+=`📊 **Tamaño:** ${u.contentLength??"?"} caracteres

`,r+=`**Análisis:**
${w}

`}else if(z){const w=u.analysis,D=u.analysis?._source_note,F=u.analysis?._confidence;D&&(r+=`🔎 **Fuente:** ${D}${typeof F=="number"?` _(fiabilidad ${Math.round(F*100)}%)_`:""}

`);const C=w?.ecommerce_conversion_signals?.recommended_marketing_angles??w?.actionable_insights_for_shopify?.recommended_marketing_angles??[];I&&w?.visual_composition&&(r+=`**Composición:** ${typeof w.visual_composition=="string"?w.visual_composition:JSON.stringify(w.visual_composition).slice(0,200)}

`),w?.technical_chemical_composition&&(r+=`**Material/Técnica:** ${typeof w.technical_chemical_composition=="object"?w.technical_chemical_composition.manufacturing_process_indicators??JSON.stringify(w.technical_chemical_composition).slice(0,150):w.technical_chemical_composition}

`),C?.length>0&&(r+=`**Top Marketing Angles:**
${(Array.isArray(C)?C:[]).slice(0,3).map(ae=>`· ${ae}`).join(`
`)}

`)}if(e){r+=`
**Tu pregunta:** ${e}

`;const w=await k(`${G}/api/shopybrain/search`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,returnRaw:!0,systemPrompt:Ae,currentRoute:g,engineMode:R})});if(w.ok){const D=await w.json();r+=D.answer??""}}z&&!$&&(r+=`
_Haz clic en "Ver análisis completo" para explorar las ${Object.keys(u.analysis||{}).length} dimensiones analizadas._`),z&&(O={type:"absorb-result",label:$?"Ver documento completo":"Ver análisis completo",data:u})}}else if(wa(e)){const v=wa(e);y(h=>[...h,{id:ie(),role:"assistant",timestamp:new Date,model:"gemini+claude+brain",content:`🔄 Generando workflow Klaviyo para **${v.storeName}**...

**Paso 1** — Investigación del nicho ${v.niche} en España
**Paso 2** — Diseño de 6 flujos con emails HTML completos
**Paso 3** — Guardado permanente del conocimiento

_30-60 segundos..._`}]);const A=await k(`${G}/api/klaviyo-ai/generate-workflow`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({shopDomain:v.shopDomain,storeName:v.storeName,niche:v.niche,market:"es"})},18e4);if(A.ok){const h=await A.json();if(h.plan){const u=h.plan.flows?.map(b=>`· **${b.name}** — ${b.emails?.length??0} emails`).join(`
`)??"";r=`✅ **Workflow completo para ${v.storeName}**

${h.plan.flows?.length??0} flujos creados:
${u}

**Impacto esperado:** ${h.plan.expected_revenue_impact}

Haz clic en cada flow para ver y copiar los templates HTML.`,O={type:"klaviyo-workflow",label:"Ver flows",data:h}}else r="❌ Error generando workflow. Verifica KLAVIYO_API_KEY y GEMINI_API_KEY."}else{const h=await A.text().catch(()=>"");r=`❌ Error generando flujo de email${h?`: ${h.slice(0,200)}`:". Verifica la configuración de Klaviyo."}`}}else if(e.match(/https?:\/\/[^\s]+/)||Ia(e)){const v=e.match(/https?:\/\/[^\s]+/)?.[0]??Ia(e)??e,A=v.length>50?v.slice(0,50)+"...":v;y(b=>[...b,{id:ie(),role:"assistant",timestamp:new Date,model:"gemini+claude+brain",content:`🔬 **Investigación exhaustiva paralela iniciada**

**Objetivo:** ${A}

**Ejecutando en paralelo:**
· 🌐 8 búsquedas Google (brand overview, productos, redes sociales, noticias, reviews, competidores, eCommerce, identidad visual)
· 🔗 Descubrimiento y análisis de fuentes relacionadas
· 🧠 Síntesis inteligente de todo el conocimiento
· 💾 Guardado permanente en Shopy Crafter

_⏱️ Esto toma 30-90 segundos. Ejecutando todas las búsquedas simultáneamente..._`}]);const h=await uo(v,void 0,o.signal);r=`✅ **Investigación completada: ${h.entity}**

`,r+=`📊 **${h.queriesExecuted} búsquedas Google** ejecutadas en paralelo
`,r+=`🔗 **${h.sourcesFound} fuentes** descubiertas y analizadas
`,r+=`💾 **${h.memoriesSaved} memorias** guardadas en Shopy Crafter
`,r+=`⏱️ Completado en **${h.elapsed}**

`;const u=h.profile;if(u.description&&(r+=`**Descripción:** ${u.description}

`),u.ecommerceStack?.platform&&(r+=`**Plataforma:** ${u.ecommerceStack.platform} · Email: ${u.ecommerceStack.emailTool}
`),u.shopifyOpportunities?.[0]&&(r+=`
**Top oportunidad Shopify:** ${u.shopifyOpportunities[0]}
`),e!==v&&!e.startsWith("http")){r+=`
**Tu pregunta:** `;const b=await k(`${G}/api/shopybrain/search`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,returnRaw:!0,systemPrompt:Ae,currentRoute:g,engineMode:R})});if(b.ok){const $=await b.json();r+=$.answer??""}}r+=`
_Explora las pestañas del panel para ver social, productos, competidores y más._`,O={type:"entity-research",label:"Ver perfil completo",data:h}}else if(R==="gemini"){let v=e;/^\/imagen-gemini\s+/i.test(v)?v="[GEMINI-IMAGE] "+v.replace(/^\/imagen-gemini\s+/i,""):/^\/codigo-gemini\s+/i.test(v)&&(v="[GEMINI-CODE] "+v.replace(/^\/codigo-gemini\s+/i,""));const A=!v.startsWith("[GEMINI-IMAGE] ")&&!v.startsWith("[GEMINI-CODE] ")&&(()=>{const h=v.toLowerCase(),u=["calcula","calcular","cálculo","python","ejecuta código","analiza datos","analizar datos","procesa datos","compute","calculate","grafica los datos","graficamente","estadísticas de mi tienda"],b=["datos de mi tienda","data de ventas","métricas de conversión","kpis de","revenue de mi","ventas de mi tienda","aov de mi"];return u.some($=>h.includes($))&&b.some($=>h.includes($))})();if(v.startsWith("[GEMINI-IMAGE] ")){const h=v.replace("[GEMINI-IMAGE] ","").trim();if(!h)r="✍️ Escribe una descripción de la imagen que quieres generar. Ejemplo: `/imagen-gemini un producto de lujo sobre fondo negro con iluminación dramática`";else{y(u=>u.map(b=>b.id===m?{...b,content:`🎨 Generando imagen con Gemini...

_"${h}"_

_Puede tardar 15-30s..._`,model:"gemini-image"}:b));try{const u=Date.now(),b=await k(`${G}/api/shopybrain/gemini-image`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:h})},9e4);if(b.ok){const $=await b.json();if($.dataUrl){const I=(($.generationTimeMs??Date.now()-u)/1e3).toFixed(1),z=$.model??"gemini-image";r=`🎨 **Imagen generada con Gemini**

_Prompt: "${h}"_
_Modelo: ${z} · ${I}s_

![Imagen generada por Gemini](${$.dataUrl})`}else r="❌ Gemini no devolvió imagen. Prueba con una descripción más detallada."}else{const $=await b.text().catch(()=>"");r=`❌ Error generando imagen (${b.status}): ${$.slice(0,200)}`}}catch(u){r=`❌ Error imagen: ${u instanceof Error?u.message:String(u)}`}}}else if(v.startsWith("[GEMINI-CODE] ")||A){const h=v.startsWith("[GEMINI-CODE] ")?v.replace("[GEMINI-CODE] ","").trim():v;y(u=>u.map(b=>b.id===m?{...b,content:`💻 Ejecutando análisis con código Python...

_Gemini ejecutará código real y mostrará los resultados._

_⏱️ 15-30 segundos..._`,model:"gemini-code"}:b));try{const u=await k(`${G}/api/shopybrain/gemini-code`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:h})},12e4);if(u.ok){const b=await u.json();let $=`💻 **Análisis con código Python (Gemini)**

`;b.text&&($+=`${b.text}

`),b.code&&($+=`\`\`\`python
${b.code}
\`\`\`

`),b.output&&($+=`**Output:**
\`\`\`
${b.output}
\`\`\``),r=$||"Gemini no generó código en esta respuesta."}else{const b=await u.text().catch(()=>"");r=`❌ Error ejecutando código (${u.status}): ${b.slice(0,200)}`}}catch(u){r=`❌ Error código: ${u instanceof Error?u.message:String(u)}`}}else{const h=ee.slice(-8).map(I=>({role:I.role,content:I.content}));h.push({role:"user",content:e});const u=g.match(/\/projects\/(\d+)/)?.[1],b=u?`${Ae}

═══ CONTEXTO ACTIVO ═══
Proyecto activo: projectId=${u} (número entero).
Cuando emitas bloques :::ACTION::: usa SIEMPRE "projectId":${u} en los params.`:`${Ae}

═══ CONTEXTO ACTIVO ═══
No hay proyecto Shopify activo en esta sesión. Si el usuario pide generar vídeos, imágenes, auditorías, informes o cualquier acción que requiera projectId, usa projectId=0 en los params — el sistema creará automáticamente una carpeta "Shopy Crafter" donde se guardará todo lo generado.`;let $=!1;try{const I=await k(`${G}/api/shopybrain/gemini-stream`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:h,systemPrompt:b,thinkingBudget:Se?2e4:0,useSearch:!0})},18e4);if(!I.ok||!I.body)$=!0;else{const z=I.body.getReader(),w=new TextDecoder;let D="",F=!0,C="";for(;;){const{done:ae,value:me}=await z.read();if(ae)break;C+=w.decode(me,{stream:!0});const Z=C.split(`
`);C=Z.pop()??"";for(const ge of Z)if(ge.startsWith("data: "))try{const W=JSON.parse(ge.slice(6));if(W.error)$=!0;else if(W.done)W.usage&&(N=W.usage),W.sources?.length&&(q=W.sources);else if(W.text){D+=W.text;const te=D;F?(F=!1,y(le=>le.map(H=>H.id===m?{...H,content:te+" ▋",model:Se?"gemini+think":"gemini+search"}:H))):y(le=>le.map(H=>H.id===m?{...H,content:te+" ▋"}:H))}}catch{}}if(D&&!$){ye=!0,r=D;const ae=/:::ACTION:::([\s\S]*?):::END_ACTION:::/g;let me;const Z=[];for(;(me=ae.exec(r))!==null;)try{Z.push(JSON.parse(me[1]))}catch{}if(Z.length>0){r=r.replace(/:::ACTION:::[\s\S]*?:::END_ACTION:::/g,"").trim();const ge={generate_video:"🎬 Generando vídeo con IA",create_brand_ad:"📢 Produciendo anuncio de marca",create_long_ad:"🎥 Produciendo anuncio largo",create_montage_video:"🎞️ Montando vídeo",create_cinematic_multishot:"🎬 Renderizando escenas"},W=["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];for(const te of Z){const le=ia.has(te.action);let H=null;if(le){const sa=ge[te.action]||"🎬 Generando vídeo";let Me=0;const ca=Date.now(),la=r;H=setInterval(()=>{const we=Math.floor((Date.now()-ca)/1e3),Pa=Math.floor(we/60),za=we%60,bo=Pa>0?`${Pa}m ${za}s`:`${za}s`,yo=W[Me%W.length];Me++;const vo=".".repeat(Me%3+1);y(xo=>xo.map(da=>da.id===m?{...da,content:`${la}

${yo} **${sa}${vo}**
⏱️ **${bo}** transcurrido · Estimado: 1-4 min
📊 Procesando frames · Aplicando IA generativa · Guardando en Vault`}:da))},1e3)}const Ie=await ka(te.action,te.params);H&&(clearInterval(H),H=null),Ie&&(r+=`

`+Ca(te.action,Ie),O={type:"shopify-action",label:"Ver resultado",data:Ie})}}}else $=!0}}catch{$=!0}if($){const I=ee.slice(-8).map(D=>`${D.role==="user"?"Usuario":"Shopy Crafter"}: ${D.content}`).join(`

`),z=g.match(/\/projects\/(\d+)/)?.[1],w=await k(`${G}/api/shopybrain/search`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,returnRaw:!0,systemPrompt:Ae,conversationHistory:I,currentRoute:g,activeProjectId:z,engineMode:R,chatSessionId:ja.current,claudeModel:R==="claude"?Q:void 0,gptModel:R==="gpt"?je:void 0})});if(w.ok){const D=await w.json();if(r=D.answer??D.result??"No pude procesar la respuesta.",D.usage){const F=D.usage;N={inputTokens:F.inputTokens??0,outputTokens:F.outputTokens??0,thinkingTokens:0,totalTokens:(F.inputTokens??0)+(F.outputTokens??0),costUsd:F.costUsd??0,model:F.model??"claude"}}}else r="❌ Gemini no disponible temporalmente. Prueba con **Auto** o **Claude**."}}}else{const v=ee.slice(-8).map(u=>`${u.role==="user"?"Usuario":"Shopy Crafter"}: ${u.content}`).join(`

`),A=g.match(/\/projects\/(\d+)/)?.[1],h=await k(`${G}/api/shopybrain/search`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:e,returnRaw:!0,systemPrompt:Ae,conversationHistory:v,currentRoute:g,activeProjectId:A,engineMode:R,chatSessionId:ja.current,claudeModel:R==="claude"?Q:void 0,gptModel:R==="gpt"?je:void 0})});if(h.ok){const u=await h.json();if(r=u.answer??u.result??"No pude procesar la respuesta.",u.usage){const I=u.usage;N={inputTokens:I.inputTokens??0,outputTokens:I.outputTokens??0,thinkingTokens:0,totalTokens:(I.inputTokens??0)+(I.outputTokens??0),costUsd:I.costUsd??0,model:I.model??T[R]??"claude"}}const b={generate_competitive_pricing:`🔍 **Investigación de mercado en curso...**

**Paso 1** — Buscando precios reales de competidores con Google Search
**Paso 2** — Analizando posicionamiento del mercado
**Paso 3** — Generando catálogo de precios competitivo
**Paso 4** — Actualizando CMS y creando productos en tu tienda

_⏱️ Esto toma 30-90 segundos. Investigando datos reales del mercado..._`,copyright_audit:`⚖️ **Auditoría de Copyright en curso...**

**Paso 1** — Cargando catálogo completo de la tienda
**Paso 2** — Analizando cada producto buscando marcas registradas y derechos de autor
**Paso 3** — Generando sugerencias de nombres alternativos

_⏱️ 15-30 segundos..._`,audit_app_offerings:`🔍 **Auditando la oferta de Shopy Crafter...**

**Paso 1** — Leyendo planes y features actuales del CMS
**Paso 2** — Comparando con capacidades reales de la plataforma
**Paso 3** — Analizando pricing vs. valor entregado
**Paso 4** — Generando recomendaciones estratégicas

_⏱️ Analizando... 15-30 segundos._`,scan_store:`📊 **Escaneando tienda...**

**Paso 1** — Conectando con la API de tu tienda
**Paso 2** — Descargando catálogo completo
**Paso 3** — Analizando calidad de cada producto

_⏱️ Dependiendo del catálogo, 10-60 segundos..._`,optimize_all_products:`🧠 **Optimización masiva con IA...**

**Paso 1** — Cargando productos de tu tienda
**Paso 2** — Claude genera SEO + copywriting para cada producto
**Paso 3** — Actualizando títulos, descripciones, tags y meta

_⏱️ ~5 segundos por producto..._`,design_all_pages:`📄 **Diseñando páginas de la tienda...**

**Paso 1** — Analizando nicho y marca
**Paso 2** — Claude genera contenido profesional para cada página
**Paso 3** — Creando páginas en tu tienda

_⏱️ ~10 segundos por página..._`,search_suppliers:`🔍 **Investigando proveedores...**

**Paso 1** — 6 búsquedas Google paralelas (proveedores, fábricas, mayoristas...)
**Paso 2** — Analizando costes, MOQs y tiempos de entrega
**Paso 3** — Claude genera informe estratégico

_⏱️ 30-60 segundos..._`,diagnose_app:`🔬 **Diagnóstico de la app en curso...**

**Paso 1** — Verificando tokens y conectividad
**Paso 2** — Comprobando sincronización de datos
**Paso 3** — Reparando automáticamente lo que sea posible

_⏱️ 10-20 segundos..._`,create_product:`🛍️ **Creando producto profesional 100/100...**

**Paso 1** — Investigando precios del mercado real
**Paso 2** — Claude genera título SEO + descripción 800-1200 palabras
**Paso 3** — Generando tags, meta tags y schema
**Paso 4** — Generando imágenes IA profesionales

_⏱️ ~15-30 segundos por producto..._`,redesign_product:`✨ **Rediseñando producto con calidad 100/100...**

**Paso 1** — Analizando producto actual
**Paso 2** — Generando nuevo contenido Semrush-level
**Paso 3** — Optimizando SEO + pricing

_⏱️ ~15 segundos..._`,bulk_redesign:`🚀 **Rediseño masivo en curso...**

**Paso 1** — Cargando catálogo completo
**Paso 2** — Claude rediseña cada producto con calidad 100/100

_⏱️ ~10 segundos por producto..._`,seo_full_audit:`🔍 **Auditoría SEO Semrush-level en curso...**

**Paso 1** — Evaluando 16 criterios ponderados por producto
**Paso 2** — Keyword consistency + readability analysis
**Paso 3** — Generando plan de mejoras priorizado

_⏱️ 15-30 segundos..._`,keyword_intelligence:`🔑 **Investigando keywords...**

**Paso 1** — Buscando volumen y dificultad con Google Search
**Paso 2** — Analizando autocomplete y People Also Ask
**Paso 3** — Generando estrategia de keywords

_⏱️ 15-30 segundos..._`,blog_strategy:`📝 **Generando estrategia de blog...**

**Paso 1** — Analizando productos y nicho
**Paso 2** — Creando pillar content + cluster topics
**Paso 3** — Generando calendario editorial

_⏱️ 20-40 segundos..._`,generate_blog_post:`📄 **Escribiendo artículo SEO...**

**Paso 1** — Investigando keyword objetivo
**Paso 2** — Claude escribe artículo optimizado

_⏱️ 15-30 segundos..._`,setup_full_store:`🏗️ **Configuración completa de tienda...**

**Paso 1** — Sincronizando productos
**Paso 2** — Generando meta tags SEO
**Paso 3** — Optimizando alt texts
**Paso 4** — Generando schemas JSON-LD

_⏱️ 30-60 segundos..._`,learn_from_url:`🧠 **Absorbiendo URL...**

**Paso 1** — Descargando contenido
**Paso 2** — Extrayendo conocimiento con IA
**Paso 3** — Almacenando en memoria permanente

_⏱️ 10-20 segundos..._`,learn_from_content:`🧠 **Procesando contenido...**

**Paso 1** — Analizando texto
**Paso 2** — Extrayendo insights
**Paso 3** — Memorizando conocimiento

_⏱️ 5-15 segundos..._`,recall_knowledge:`🔍 **Buscando en la memoria...**

_⏱️ 2-5 segundos..._`,brain_status:`🧠 **Consultando estado del cerebro...**

_⏱️ 2-5 segundos..._`,generate_email_flow:`📧 **Creando flujo de email marketing...**

**Paso 1** — Analizando tienda y nicho
**Paso 2** — Generando secuencia de emails con IA
**Paso 3** — Optimizando asuntos y contenido

_⏱️ 20-40 segundos..._`,financial_forecast:`📊 **Generando forecast financiero...**

**Paso 1** — Analizando datos históricos
**Paso 2** — Calculando escenarios
**Paso 3** — Proyectando revenue a 6 meses

_⏱️ 15-30 segundos..._`,agency_proposal:`📋 **Generando propuesta comercial...**

**Paso 1** — Analizando tienda del cliente
**Paso 2** — Calculando servicios necesarios
**Paso 3** — Creando propuesta profesional

_⏱️ 20-40 segundos..._`,bulk_generate_images:`🎨 **Generando imágenes IA en lote...**

**Paso 1** — Preparando prompts por producto
**Paso 2** — Flux genera imágenes profesionales

_⏱️ ~3 segundos por imagen..._`,generate_video:`🎬 **Iniciando generación de vídeo con IA...**

**Paso 1** — Construyendo prompt cinematográfico
**Paso 2** — Enviando a modelo de vídeo IA
**Paso 3** — Renderizando frames (GPU cloud)
**Paso 4** — Guardando en tu Vault automáticamente

_⏱️ Estimado: 1-4 minutos dependiendo del modelo y duración_`,create_brand_ad:`📢 **Produciendo anuncio de marca completo...**

**Paso 1** — Generando guión cinematográfico
**Paso 2** — Generando escenas de vídeo en paralelo
**Paso 3** — TTS + sincronización de voz
**Paso 4** — Música + mezcla de audio
**Paso 5** — Concat final con crossfade · Guardando en Vault

_⏱️ Estimado: 5-20 minutos (normal para producción de vídeo IA)_`,create_long_ad:`🎥 **Produciendo anuncio largo (60-1800s)...**

**Paso 1** — Director IA genera guión completo
**Paso 2** — Generando escenas en paralelo
**Paso 3** — Montaje + voz + música

_⏱️ Estimado: 10-30 minutos para anuncios largos_`,create_montage_video:`🎞️ **Montando vídeo con múltiples escenas...**

**Paso 1** — Preparando clips de referencia
**Paso 2** — Face-swap + TTS + sincronización
**Paso 3** — Concat final · Guardando en Vault

_⏱️ Estimado: 3-10 minutos_`},$=u.detectedActions??(u.detectedAction?[u.detectedAction]:[]);if($.length>0){const I=$[0].action,z=ie();b[I]?y(C=>[...C,{id:z,role:"assistant",timestamp:new Date,model:"gemini+claude+brain",content:$.length>1?`⚡ **Ejecutando ${$.length} acciones en secuencia...**

${b[I]}`:b[I]}]):$.length>1&&y(C=>[...C,{id:z,role:"assistant",timestamp:new Date,model:"gemini+claude+brain",content:`⚡ **Ejecutando ${$.length} acciones en secuencia...**`}]);const w=["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"],D={generate_video:"🎬 Generando vídeo",create_brand_ad:"📢 Produciendo anuncio",create_long_ad:"🎥 Produciendo anuncio largo",create_montage_video:"🎞️ Montando vídeo",create_cinematic_multishot:"🎬 Renderizando escenas"},F=[];for(const C of $){const ae=ia.has(C.action);let me=null;if(ae){const ge=D[C.action]||"🎬 Generando vídeo";let W=0;const te=Date.now();me=setInterval(()=>{const le=Math.floor((Date.now()-te)/1e3),H=Math.floor(le/60),Ie=le%60,sa=H>0?`${H}m ${Ie}s`:`${Ie}s`,Me=w[W%w.length];W++;const ca=".".repeat(W%3+1);y(la=>la.map(we=>we.id===z?{...we,content:`${Me} **${ge}${ca}**
⏱️ **${sa}** transcurrido · Estimado: 1-4 min
📊 Procesando frames · Aplicando IA generativa · Guardando en Vault automáticamente`}:we))},1e3)}const Z=await ka(C.action,C.params);if(me&&(clearInterval(me),me=null),Z){const ge=Ca(C.action,Z);F.push(ge);const W=C.action==="search_suppliers"?"supplier-research":C.action==="browser_action"||C.action==="browser_research"||C.action==="generate_brand_book"?"browser-action":"shopify-action",te=C.action==="search_suppliers"?"Descargar informe":C.action==="browser_action"?"Ver navegación":C.action==="browser_research"?"Ver informe":C.action==="generate_brand_book"?"Ver Brand Book":"Ver resultado";if(O={type:W,label:te,data:Z,actionName:C.action,formattedContent:ge},!E&&typeof Z.openUrl=="string"&&Z.openUrl)try{const le=new URL(Z.openUrl).protocol;(le==="http:"||le==="https:")&&(E=Z.openUrl)}catch{}}}F.length>0&&(r+=`

`+F.join(`

---

`))}}else{let u="";try{const b=await h.json();u=b.error||b.message||""}catch{}r=`❌ **Error ${h.status}** en el servidor.${u?`

_${u}_`:""}

Puedes intentarlo de nuevo o usar un mensaje más corto. Si persiste, recarga la página.`}}if(!ye&&r.length>60){const v=r.split(/(\s+)/),A=Math.max(6,Math.min(28,3500/Math.max(v.length,1)));if(A>=8){let h="";for(let u=0;u<v.length;u++)if(h+=v[u],u%2===0){const b=h;y($=>$.map(I=>I.id===m?{...I,content:b+" ▋"}:I)),await new Promise($=>setTimeout($,A))}}}const Ke=N,ho=q;y(v=>{const A=["Absorbiendo","Generando workflow","detectada. Absorbiendo","Investigación exhaustiva paralela iniciada","Investigación de mercado en curso","Auditando la oferta","Escaneando tienda","Optimización masiva con IA","Diseñando páginas de la tienda","Investigando proveedores...","Diagnóstico de la app en curso","Ejecutando","acciones en secuencia","Creando producto profesional","Rediseñando producto","Rediseño masivo","Auditoría SEO Semrush","Investigando keywords","Generando estrategia de blog","Escribiendo artículo SEO","Configuración completa de tienda","Creando flujo de email","Generando forecast financiero","Generando propuesta comercial","Generando imágenes IA","Analizando tu solicitud"];return[...v.filter(u=>u.id!==m&&!(u.role==="assistant"&&A.some(b=>u.content.includes(b)))),{id:ie(),role:"assistant",content:r,timestamp:new Date,model:T[R]||"gemini+claude+brain",action:O,usage:Ke,sources:ho}]}),Ke&&eo(v=>({totalTokens:v.totalTokens+Ke.totalTokens,totalCostUsd:v.totalCostUsd+Ke.costUsd,msgCount:v.msgCount+1})),de&&r&&setTimeout(()=>lo(r),200)}catch(r){const O=r instanceof Error?r.message:"Fallo de conexión",q=O==="timeout"||O.includes("aborted")?"⏳ La solicitud tardó demasiado. Por favor, intenta con un mensaje más corto o inténtalo de nuevo.":`❌ Error: ${O}`;y(ye=>[...ye.filter(ra=>ra.id!==m),{id:ie(),role:"assistant",content:q,timestamp:new Date}])}finally{if(E)try{window.open(E,"_blank","noreferrer")}catch{}Aa.current=null,K(!1),He.current=null,setTimeout(()=>xa.current?.focus(),100)}},[V,L,ee,M,ke,X,R,Q,je,g]);x.useEffect(()=>{if(!oe&&De.current){const i=De.current;De.current=null,pe(i)}},[oe,pe]),x.useEffect(()=>{na.current=i=>pe(i)},[pe]),x.useEffect(()=>{const i=ba.current;if(ba.current=L,!(!i||L)&&he.current.isActive)if(oa.current.length>0){const e=oa.current.shift();he.current.completed++;const{completed:o,total:n}=he.current;setTimeout(()=>{y(t=>[...t,{id:ie(),role:"assistant",content:`▶️ **[${o}/${n}]** Iniciando tarea ${o}…`,timestamp:new Date,model:"task-runner"}]),setTimeout(()=>na.current?.(e),200)},600)}else{he.current.isActive=!1;const e=he.current.total,o=he.current.recordingMode;he.current={total:0,completed:0,isActive:!1,recordingMode:!1},y(n=>[...n,{id:ie(),role:"assistant",content:`✅ **¡${e} tareas completadas!**${o&&_e?`

🔴 La grabación continúa. Di **'para la grabación'** cuando quieras.`:""}`,timestamp:new Date,model:"task-runner"}])}},[L,_e]);const mo=i=>{const e=i.replace(/^.*?gr[aá]b[ae]me\s+(haciendo|generando|ejecutando|mientras\s+hago?|las\s+acciones:?\s*|esto:?\s*)/i,"").replace(/^gr[aá]b[ae]\s+(las\s+)?acciones:?\s*/i,"").trim();if(!e||e===i.trim())return null;const o=e.match(/\d+[\.\)]\s*.+?(?=(?:\d+[\.\)]|$))/gs);if(o&&o.length>1)return o.map(t=>t.replace(/^\d+[\.\)]\s*/,"").trim()).filter(t=>t.length>3);const n=e.split(/\s*[,;]\s*|\s+(?:y\s+)?luego\s+|\s+después\s+(?:de\s+eso\s+)?|\s+también\s+|\s+además\s+/i).map(t=>t.trim()).filter(t=>t.length>3);return n.length>1?n:null},Ta=()=>on.filter(i=>!Fe||i.cmd.slice(1).startsWith(Fe)||i.label.toLowerCase().includes(Fe)||i.desc.toLowerCase().includes(Fe)),Ea=i=>{if(ze(!1),Re(""),U(""),i.isResearch){const e=prompt(`¿Qué marca, empresa o persona quieres investigar?

Puedes escribir: URL, nombre, @instagram, dominio...`);e?.trim()&&pe(e.trim())}else pe(i.prompt)},go=i=>{if(fa){const e=Ta();if(i.key==="ArrowDown"){i.preventDefault(),Ue(o=>Math.min(o+1,e.length-1));return}if(i.key==="ArrowUp"){i.preventDefault(),Ue(o=>Math.max(o-1,0));return}if(i.key==="Escape"){i.preventDefault(),ze(!1),Re(""),U("");return}if(i.key==="Enter"&&!i.shiftKey){i.preventDefault();const o=e[Oe];o&&Ea(o);return}if(i.key==="Tab"){i.preventDefault();const o=e[Oe];o&&(U(o.cmd+" "),ze(!1),Re(""));return}}i.key==="Enter"&&!i.shiftKey&&(i.preventDefault(),pe())};return d?a.jsxs(a.Fragment,{children:[ve&&a.jsx(Zo,{flow:ve,onClose:()=>xe(null)}),!f&&a.jsx("div",{...j,style:{position:"fixed",bottom:l.bottom,right:l.right,zIndex:9990,touchAction:"none",userSelect:"none"},children:a.jsx("button",{onClick:()=>{_||S(!0)},"aria-label":"Abrir asistente Shopy Crafter",style:{width:p?52:58,height:p?52:58,borderRadius:"50%",background:"linear-gradient(135deg, #c8a84b, #e6c668)",border:"none",cursor:"pointer",zIndex:9990,boxShadow:"0 4px 24px rgba(200,168,75,0.45), 0 0 0 0 rgba(200,168,75,0.3)",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulseGold 3s ease-in-out infinite"},children:a.jsx(Ye,{size:p?22:26,style:{color:"#0a0a0f"}})})}),f&&a.jsxs("div",{ref:oo,onDragOver:to,onDragLeave:io,onDrop:ro,style:{position:"fixed",bottom:p?0:24,right:p?0:24,width:p?"min(96vw, 440px)":P?290:"min(440px, calc(100vw - 48px))",height:p?P?52:"min(82dvh, 600px)":P?52:"min(640px, calc(100dvh - 48px))",background:"var(--ink)",border:`1px solid ${Qe?"var(--jade)":"rgba(200,168,75,0.28)"}`,borderRadius:16,zIndex:9990,display:"flex",flexDirection:"column",boxShadow:Qe?"0 0 0 2px var(--jade), 0 8px 40px rgba(0,0,0,0.6)":"0 8px 40px rgba(0,0,0,0.6)",transition:"all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",overflow:"hidden"},children:[a.jsxs("div",{style:{padding:p?"10px max(12px, env(safe-area-inset-right, 0px)) 10px max(12px, env(safe-area-inset-left, 0px))":"12px 14px",borderBottom:P?"none":"1px solid var(--ink3)",background:"linear-gradient(135deg, rgba(200,168,75,0.07), rgba(200,168,75,0.03))",display:"flex",alignItems:"center",gap:10,flexShrink:0},children:[a.jsx("div",{style:{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg, var(--gold), #a07830)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},children:a.jsx(Ye,{size:16,style:{color:"#fff"}})}),a.jsxs("div",{style:{flex:1,minWidth:0},children:[a.jsx("p",{style:{margin:0,fontSize:13,fontWeight:700,color:"var(--t)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:"Shopy Crafter · Asistente"}),!P&&a.jsx("p",{style:{margin:0,fontSize:9,color:_e?"#ff4444":"var(--jade)"},children:_e?a.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:4},children:[a.jsx("span",{style:{width:6,height:6,borderRadius:"50%",background:"#ff4444",display:"inline-block",animation:"pulseGold 1s ease-in-out infinite"}}),"GRABANDO — ",String(Math.floor(Be/60)).padStart(2,"0"),":",String(Be%60).padStart(2,"0"),a.jsx("span",{style:{color:"var(--t4)",fontSize:8},children:' · Di "para la grabación" para detener'})]}):a.jsxs(a.Fragment,{children:["🔬 Gemini · 🧠 Claude · 💾 Brain — Listo",Ze.msgCount>0&&a.jsxs("span",{style:{color:"var(--t4)",marginLeft:5},children:["· ",Ne(Ze.totalTokens)," tok · ",Ga(Ze.totalCostUsd)]})]})})]}),a.jsxs("div",{style:{display:"flex",gap:6,flexShrink:0},children:[_e&&a.jsx("button",{onClick:()=>{ta()},title:"Detener grabación",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:"none",background:"rgba(255,68,68,0.18)",color:"#ff4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",animation:"pulseGold 1.5s ease-in-out infinite"},children:"⏹"}),a.jsx("button",{onClick:()=>B(!P),"aria-label":P?"Expandir chat":"Minimizar chat",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:"none",background:"var(--ink2)",color:"var(--t3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},children:P?a.jsx(ko,{size:p?18:14}):a.jsx(Co,{size:p?18:14})}),a.jsx("button",{onClick:()=>{Za(i=>!i),de&&(se.current=!0,window.speechSynthesis?.cancel(),ne.current&&(ne.current.pause(),ne.current.src="",ne.current=null))},title:de?"Desactivar voz — conversación fluída activa":"Activar conversación por voz","aria-label":de?"Desactivar voz":"Activar voz",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:"none",background:de?"rgba(45,212,159,0.18)":"var(--ink2)",color:de?"var(--jade)":"var(--t3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.2s, color 0.2s"},children:de?a.jsx(_o,{size:p?18:14}):a.jsx(Io,{size:p?18:14})}),a.jsx("button",{onClick:()=>S(!1),"aria-label":"Cerrar chat",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:"none",background:"var(--ink2)",color:"var(--t3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},children:a.jsx(ma,{size:p?18:14})})]})]}),!P&&a.jsxs(a.Fragment,{children:[Qe&&a.jsx("div",{style:{position:"absolute",inset:52,background:"rgba(45,212,159,0.08)",border:"2px dashed var(--jade)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",zIndex:10,pointerEvents:"none"},children:a.jsxs("div",{style:{textAlign:"center"},children:[a.jsx(Oa,{size:28,style:{color:"var(--jade)",marginBottom:8}}),a.jsx("p",{style:{margin:0,fontSize:13,fontWeight:700,color:"var(--jade)"},children:"Suelta para absorber a Shopy Crafter"})]})}),a.jsxs("div",{style:{flex:1,overflowY:"auto",padding:p?"14px max(12px, env(safe-area-inset-left, 0px)) 14px max(12px, env(safe-area-inset-right, 0px))":"14px 12px",display:"flex",flexDirection:"column",gap:10,minHeight:0},children:[ee.map(i=>a.jsxs("div",{style:{display:"flex",flexDirection:"column",alignItems:i.role==="user"?"flex-end":"flex-start"},children:[a.jsxs("div",{style:{maxWidth:"90%",padding:"10px 12px",borderRadius:i.role==="user"?"12px 12px 3px 12px":"12px 12px 12px 3px",background:i.role==="user"?"rgba(200,168,75,0.12)":"var(--ink2)",border:`1px solid ${i.role==="user"?"rgba(200,168,75,0.25)":"var(--ink3)"}`,fontSize:p?14:12,lineHeight:1.6,color:"var(--t)"},children:[i.role==="assistant"&&a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:5,marginBottom:5,flexWrap:"wrap"},children:[a.jsx(Ye,{size:10,style:{color:"var(--gold)",flexShrink:0}}),a.jsx("span",{style:{fontSize:9,color:"var(--gold)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"},children:"Shopy Crafter"}),i.model&&(()=>{const e=i.model.toLowerCase(),o=e.includes("gemini"),n=e.includes("claude")||e.includes("anthropic"),t=o?"var(--jade)":n?"var(--gold)":"var(--t4)",s=o?"rgba(45,212,159,0.10)":n?"rgba(200,168,75,0.10)":"rgba(255,255,255,0.05)",c=o?"🔬":n?"🧠":"💡",m=Ra(i.model);return a.jsxs("span",{title:i.model,style:{fontSize:8,color:t,background:s,border:`1px solid ${t}`,borderRadius:4,padding:"1px 5px",fontWeight:600,letterSpacing:"0.3px",whiteSpace:"nowrap",cursor:"help"},children:[c," ",m]})})()]}),i.attachmentType&&a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",background:"rgba(200,168,75,0.08)",borderRadius:5,marginBottom:6,width:"fit-content"},children:[i.attachmentType==="image"?a.jsx(Va,{size:10,style:{color:"var(--gold)"}}):i.attachmentType==="video"?a.jsx(Ha,{size:10,style:{color:"var(--gold)"}}):a.jsx(wo,{size:10,style:{color:"var(--gold)"}}),a.jsx("span",{style:{fontSize:9,color:"var(--gold)"},children:i.attachmentName?.slice(0,40)})]}),a.jsx("div",{children:Bo(i.content)}),i.usage&&(()=>{const e=i.model?.toLowerCase().includes("gemini")??!1,o=e?"var(--jade)":"var(--t3)",n=e?"rgba(45,212,159,0.7)":"var(--t4)",t=i.usage.model,s=e&&t&&t!==i.model;return a.jsxs("div",{style:{marginTop:5,paddingTop:5,borderTop:"1px solid var(--ink3)",display:"flex",flexDirection:"column",gap:4},children:[a.jsxs("div",{style:{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"},children:[a.jsxs("span",{style:{fontSize:9,color:n,display:"flex",alignItems:"center",gap:3},children:["🔢 ",a.jsx("strong",{style:{color:o},children:Ne(i.usage.totalTokens)})," tokens"]}),a.jsx("span",{style:{fontSize:9,color:"var(--t4)"},children:"·"}),a.jsxs("span",{style:{fontSize:9,color:"var(--t4)"},children:["in ",a.jsx("strong",{style:{color:o},children:Ne(i.usage.inputTokens)})," · out ",a.jsx("strong",{style:{color:o},children:Ne(i.usage.outputTokens)})]}),i.usage.thinkingTokens>0&&a.jsxs(a.Fragment,{children:[a.jsx("span",{style:{fontSize:9,color:"var(--t4)"},children:"·"}),a.jsxs("span",{style:{fontSize:9,color:"var(--jade)",display:"flex",alignItems:"center",gap:2},children:["🧩 ",a.jsx("strong",{children:Ne(i.usage.thinkingTokens)})," think"]})]}),a.jsx("span",{style:{fontSize:9,color:"var(--t4)"},children:"·"}),a.jsx("span",{style:{fontSize:9,color:"var(--gold)",fontWeight:600},children:Ga(i.usage.costUsd)}),s&&a.jsxs(a.Fragment,{children:[a.jsx("span",{style:{fontSize:9,color:"var(--t4)"},children:"·"}),a.jsx("span",{style:{fontSize:8,color:"var(--jade)",background:"rgba(45,212,159,0.08)",border:"1px solid rgba(45,212,159,0.2)",borderRadius:3,padding:"1px 4px",fontWeight:600},children:Ra(t)})]})]}),e&&i.sources&&i.sources.length>0&&a.jsxs("div",{style:{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"},children:[a.jsx("span",{style:{fontSize:8,color:"var(--t4)"},children:"🔗"}),i.sources.slice(0,4).map((c,m)=>{let T=c;try{T=new URL(c).hostname.replace(/^www\./,"")}catch{}return a.jsx("a",{href:c,target:"_blank",rel:"noopener noreferrer",style:{fontSize:8,color:"rgba(45,212,159,0.65)",textDecoration:"none",background:"rgba(45,212,159,0.06)",border:"1px solid rgba(45,212,159,0.15)",borderRadius:3,padding:"1px 4px",whiteSpace:"nowrap",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",display:"inline-block"},children:T},m)}),i.sources.length>4&&a.jsxs("span",{style:{fontSize:8,color:"var(--t4)"},children:["+",i.sources.length-4]})]})]})})(),i.action?.type==="absorb-result"&&a.jsx(Jo,{data:i.action.data}),i.action?.type==="klaviyo-workflow"&&a.jsx(Xo,{data:i.action.data,onViewFlow:xe}),i.action?.type==="entity-research"&&a.jsx(Qo,{data:i.action.data}),i.action?.type==="browser-action"&&(()=>{const e=i.action.actionName,o=i.action.data;if(!o)return null;if(e==="browser_research"||e==="generate_brand_book"){const c=e==="generate_brand_book"?"📖":"📊",m=e==="generate_brand_book"?"Brand Book":"Informe de investigación",T=o.vaultUrl,E=o.topic||o.brandName||"";return a.jsxs("div",{style:{marginTop:10,display:"flex",flexDirection:"column",gap:8},children:[T?a.jsxs("div",{style:{background:"rgba(196,165,90,0.07)",border:"1px solid rgba(196,165,90,0.25)",borderRadius:10,padding:"14px 16px"},children:[a.jsxs("div",{style:{fontSize:11,color:"var(--gold)",fontWeight:700,marginBottom:10},children:[c," ",m,E?` — "${E}"`:""]}),a.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:[a.jsx("a",{href:T,target:"_blank",rel:"noreferrer",style:{display:"inline-flex",alignItems:"center",gap:5,padding:"7px 14px",background:"rgba(196,165,90,0.15)",border:"1px solid rgba(196,165,90,0.4)",borderRadius:7,fontSize:11,color:"var(--gold)",textDecoration:"none",fontWeight:600},children:"🌐 Ver informe"}),a.jsx("a",{href:`${T}?format=pdf`,target:"_blank",rel:"noreferrer",style:{display:"inline-flex",alignItems:"center",gap:5,padding:"7px 14px",background:"rgba(100,100,100,0.15)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:7,fontSize:11,color:"#d0c8bc",textDecoration:"none"},children:"📥 Descargar PDF"})]})]}):a.jsx("div",{style:{fontSize:11,color:"var(--t3)",fontStyle:"italic"},children:"⚠️ Sin projectId — el informe no se guardó en el Vault."}),o.screenshots?.length>0&&a.jsx("div",{style:{display:"flex",flexDirection:"column",gap:6},children:o.screenshots.map((k,r)=>a.jsxs("div",{style:{borderRadius:8,overflow:"hidden",border:"1px solid var(--ink3)"},children:[a.jsxs("div",{style:{padding:"4px 10px",background:"var(--ink2)",fontSize:10,color:"var(--t3)",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[a.jsxs("span",{children:["📸 ",k.label]}),a.jsx("a",{href:k.dataUrl,download:`${k.label}.jpg`,style:{color:"var(--gold)",textDecoration:"none",fontSize:10},children:"⬇"})]}),a.jsx("img",{src:k.dataUrl,alt:k.label,style:{width:"100%",display:"block",maxHeight:260,objectFit:"cover"}})]},r))})]})}const n=o,t=c=>{if(c)try{const m=new URL(c).protocol;return m==="http:"||m==="https:"?c:void 0}catch{return}},s=t(n.openUrl)||t(n.finalUrl);return a.jsxs("div",{style:{marginTop:10,display:"flex",flexDirection:"column",gap:10},children:[s&&a.jsxs("a",{href:s,target:"_blank",rel:"noreferrer",style:{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",background:"linear-gradient(135deg, rgba(196,165,90,0.9), rgba(160,130,60,0.9))",border:"1px solid var(--gold)",borderRadius:10,fontSize:13,color:"#1a1408",textDecoration:"none",width:"fit-content",fontWeight:800,boxShadow:"0 2px 10px rgba(196,165,90,0.25)"},children:["▶️ Abrir ahora",n.title?` — ${n.title.length>50?n.title.slice(0,50)+"…":n.title}`:""]}),n.youtubeEmbed&&a.jsxs("div",{style:{borderRadius:10,overflow:"hidden",border:"1px solid var(--ink3)"},children:[a.jsxs("div",{style:{padding:"6px 10px",background:"rgba(255,0,0,0.12)",display:"flex",alignItems:"center",gap:6},children:[a.jsx("span",{style:{fontSize:14},children:"▶️"}),a.jsx("span",{style:{fontSize:11,color:"#ff4040",fontWeight:600},children:"YouTube"}),n.finalUrl&&a.jsx("a",{href:n.finalUrl,target:"_blank",rel:"noreferrer",style:{fontSize:10,color:"var(--gold)",marginLeft:"auto",textDecoration:"none",padding:"3px 8px",background:"rgba(196,165,90,0.12)",borderRadius:5,border:"1px solid rgba(196,165,90,0.3)"},children:"Abrir en nueva pestaña ↗"})]}),a.jsx("iframe",{src:n.youtubeEmbed,width:"100%",height:"220",allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",allowFullScreen:!0,style:{border:"none",display:"block"}})]}),!n.youtubeEmbed&&n.finalUrl&&a.jsxs("a",{href:n.finalUrl,target:"_blank",rel:"noreferrer",style:{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",background:"rgba(200,168,75,0.1)",border:"1px solid rgba(200,168,75,0.35)",borderRadius:8,fontSize:11,color:"var(--gold)",textDecoration:"none",width:"fit-content",fontWeight:600},children:["🔗 Abrir en nueva pestaña ↗ ",n.finalUrl.length>45?n.finalUrl.slice(0,45)+"...":n.finalUrl]}),n.screenshots&&n.screenshots.length>0&&a.jsx("div",{style:{display:"flex",flexDirection:"column",gap:8},children:n.screenshots.map((c,m)=>a.jsxs("div",{style:{borderRadius:8,overflow:"hidden",border:"1px solid var(--ink3)"},children:[a.jsxs("div",{style:{padding:"4px 10px",background:"var(--ink2)",fontSize:10,color:"var(--t3)",display:"flex",alignItems:"center",justifyContent:"space-between"},children:[a.jsxs("span",{children:["📸 ",c.label]}),a.jsx("a",{href:c.dataUrl,download:`${c.label}.jpg`,style:{color:"var(--gold)",textDecoration:"none",fontSize:10},children:"⬇ Descargar"})]}),a.jsx("img",{src:c.dataUrl,alt:c.label,style:{width:"100%",display:"block",maxHeight:300,objectFit:"cover"}})]},m))})]})})(),i.action?.actionName&&(()=>{const e=Ko(i.action.actionName,i.action.data);return e?a.jsx(Ho,{products:e}):null})(),i.action?.actionName&&a.jsx(Yo,{actionName:i.action.actionName,content:i.action.formattedContent||i.content,rawData:i.action.data,isMobile:p})]}),a.jsx("span",{style:{fontSize:9,color:"var(--t4)",marginTop:3,paddingLeft:4,paddingRight:4},children:i.timestamp.toLocaleTimeString("es",{hour:"2-digit",minute:"2-digit"})})]},i.id)),L&&a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"var(--ink2)",borderRadius:"12px 12px 12px 3px",border:"1px solid var(--ink3)",maxWidth:"60%",alignSelf:"flex-start"},children:[a.jsx(Da,{size:12,style:{color:"var(--gold)",animation:"spin 1s linear infinite"}}),a.jsx("span",{style:{fontSize:11,color:"var(--t3)"},children:"Shopy Crafter procesando..."})]}),a.jsx("div",{ref:va})]}),a.jsxs("div",{style:{padding:p?"8px max(12px, env(safe-area-inset-left, 0px)) max(10px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-right, 0px))":"8px 12px 10px",borderTop:"1px solid var(--ink3)",flexShrink:0},children:[a.jsxs("button",{onClick:()=>fe(!ue),style:{display:"flex",alignItems:"center",gap:5,background:"none",border:"none",color:"var(--t3)",fontSize:10,cursor:"pointer",marginBottom:5,padding:"2px 0"},children:[a.jsx(Ao,{size:10}),"Acciones rápidas",a.jsx(To,{size:9,style:{transform:ue?"rotate(180deg)":"rotate(0)",transition:"0.2s"}})]}),ue&&a.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(120px, 100%), 1fr))",gap:4,marginBottom:6},children:Y.map((i,e)=>a.jsxs("button",{onClick:()=>{if(fe(!1),"isResearch"in i&&i.isResearch){const o=prompt(`¿Qué marca, empresa o persona quieres investigar?

Puedes escribir: URL, nombre, @instagram, dominio...`);o?.trim()&&pe(o.trim())}else pe(i.prompt)},style:{textAlign:"left",padding:"6px 8px",background:"isResearch"in i&&i.isResearch?"rgba(200,168,75,0.1)":"var(--ink2)",border:`1px solid ${"isResearch"in i&&i.isResearch?"rgba(200,168,75,0.4)":"var(--ink3)"}`,borderRadius:6,cursor:"pointer",fontSize:10,color:"isResearch"in i&&i.isResearch?"var(--gold)":"var(--t2)",display:"flex",alignItems:"center",gap:5},children:[a.jsx("span",{children:i.icon}),a.jsx("span",{style:{lineHeight:1.2},children:i.label})]},e))}),Te&&a.jsxs("div",{style:{marginBottom:8,padding:10,background:"var(--ink2)",borderRadius:8,border:"1px solid var(--ink3)"},children:[a.jsx("div",{style:{display:"flex",gap:6,marginBottom:8},children:a.jsxs("button",{onClick:()=>$a.current?.click(),style:{flex:1,padding:"7px 10px",background:"rgba(200,168,75,0.07)",border:"1px dashed rgba(200,168,75,0.3)",borderRadius:6,cursor:"pointer",fontSize:10,color:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",gap:5},children:[a.jsx(Oa,{size:12})," Subir imagen/vídeo"]})}),a.jsxs("div",{style:{display:"flex",gap:6},children:[a.jsx("input",{value:Ce,onChange:i=>ga(i.target.value),onKeyDown:i=>{i.key==="Enter"&&(i.preventDefault(),Sa())},placeholder:"Pega URL: Instagram, Facebook, X, YouTube, web...",style:{flex:1,padding:"6px 10px",background:"var(--ink)",border:"1px solid var(--ink3)",borderRadius:6,color:"var(--t)",fontSize:11,outline:"none"}}),a.jsx("button",{onClick:Sa,disabled:!Ce.trim(),style:{padding:"6px 10px",background:Ce.trim()?"var(--jade)":"var(--ink3)",border:"none",borderRadius:6,cursor:Ce.trim()?"pointer":"not-allowed",color:Ce.trim()?"var(--ink)":"var(--t4)",fontSize:11,fontWeight:600},children:"Añadir"})]}),a.jsxs("p",{style:{margin:"6px 0 0",fontSize:9,color:"var(--t4)"},children:["También puedes ",a.jsx("strong",{style:{color:"var(--t3)"},children:"arrastrar y soltar"})," archivos directamente en el chat"]})]}),(M||X)&&a.jsx(en,{file:M,url:X,onRemove:()=>{Ee(null),Ge([]),Pe("")}}),ke.length>1&&a.jsxs("div",{style:{fontSize:9,color:"var(--t3)",marginBottom:4,textAlign:"center"},children:["+",ke.length-1," archivo",ke.length>2?"s":""," más seleccionado",ke.length>2?"s":""]}),fa&&(()=>{const i=Ta();return i.length===0?null:a.jsxs("div",{ref:no,style:{marginBottom:6,background:"var(--ink)",border:"1px solid rgba(200,168,75,0.5)",borderRadius:10,overflow:"hidden",maxHeight:280,overflowY:"auto",boxShadow:"0 -8px 32px rgba(0,0,0,0.5)"},children:[a.jsxs("div",{style:{padding:"6px 12px",borderBottom:"1px solid var(--ink3)",display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(200,168,75,0.06)"},children:[a.jsxs("span",{style:{fontSize:10,color:"var(--gold)",fontWeight:700,letterSpacing:1.2},children:["⚡ SKILLS — ",i.length," disponibles"]}),a.jsx("span",{style:{fontSize:9,color:"var(--t4)"},children:"↑↓ navegar · Enter ejecutar · Tab completar · Esc cerrar"})]}),i.map((e,o)=>a.jsxs("button",{onClick:()=>Ea(e),onMouseEnter:()=>Ue(o),style:{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"none",cursor:"pointer",textAlign:"left",background:o===Oe?"rgba(200,168,75,0.1)":"transparent",borderLeft:`2px solid ${o===Oe?"var(--gold)":"transparent"}`,transition:"all 0.1s"},children:[a.jsx("span",{style:{fontSize:20,flexShrink:0,width:28,textAlign:"center",lineHeight:1},children:e.icon}),a.jsxs("div",{style:{flex:1,minWidth:0},children:[a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"},children:[a.jsx("span",{style:{fontSize:12,fontWeight:700,fontFamily:"monospace",color:o===Oe?"var(--gold)":"var(--t2)"},children:e.cmd}),a.jsx("span",{style:{fontSize:11,color:"var(--t)"},children:e.label}),a.jsx("span",{style:{fontSize:9,padding:"1px 5px",borderRadius:4,background:e.engine==="claude"?"rgba(200,168,75,0.12)":e.engine==="gemini"?"rgba(45,212,159,0.12)":"rgba(120,120,180,0.12)",color:e.engine==="claude"?"var(--gold)":e.engine==="gemini"?"var(--jade)":"var(--t3)",marginLeft:"auto",flexShrink:0},children:e.engine})]}),a.jsx("div",{style:{fontSize:10,color:"var(--t3)",marginTop:1},children:e.desc})]})]},e.cmd))]})})(),a.jsxs("div",{style:{display:"flex",gap:6,alignItems:"flex-end"},children:[a.jsx("button",{onClick:()=>Le(!Te),"aria-label":"Adjuntar archivo",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:`1px solid ${Te?"var(--gold)":"var(--ink3)"}`,background:Te?"rgba(200,168,75,0.1)":"var(--ink2)",color:Te?"var(--gold)":"var(--t3)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:p?18:15},children:"📎"}),a.jsx("textarea",{ref:xa,value:V,onChange:i=>{const e=i.target.value;U(e),e.startsWith("/")&&!e.includes(" ")&&!e.startsWith("//")?(ze(!0),Re(e.slice(1).toLowerCase()),Ue(0)):(ze(!1),Re(""))},onKeyDown:go,disabled:L,placeholder:oe?"🎙 Escuchando...":M||X?"Opcional: añade contexto...":"Escribe un mensaje, pega una URL… o pulsa / para ver skills disponibles",rows:1,style:{flex:1,padding:p?"10px 12px":"8px 10px",background:oe?"rgba(232,69,88,0.08)":"var(--ink2)",border:`1px solid ${oe?"var(--crim)":"var(--ink3)"}`,borderRadius:8,color:"var(--t)",fontSize:p?16:13,resize:"none",outline:"none",fontFamily:"inherit",lineHeight:1.4,maxHeight:p?100:80,overflowY:"auto",transition:"border-color 0.2s, background 0.2s",minHeight:p?44:36},onInput:i=>{const e=i.target;e.style.height="auto",e.style.height=`${Math.min(e.scrollHeight,p?100:80)}px`}}),a.jsx("button",{onClick:co,disabled:L,"aria-label":oe?"Detener micrófono":"Activar micrófono",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:"none",flexShrink:0,background:oe?"var(--crim)":"var(--ink2)",color:oe?"#fff":"var(--t3)",cursor:L?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",animation:oe?"pulseGold 1.5s ease-in-out infinite":"none"},children:oe?a.jsx(Eo,{size:p?18:15}):a.jsx(Po,{size:p?18:15})}),a.jsx("button",{onClick:()=>pe(),disabled:L||!V.trim()&&!M&&!X,"aria-label":"Enviar mensaje",style:{width:p?44:36,height:p?44:36,minWidth:p?44:36,borderRadius:8,border:"none",flexShrink:0,background:L||!V.trim()&&!M&&!X?"var(--ink3)":"var(--gold)",color:L||!V.trim()&&!M&&!X?"var(--t4)":"var(--ink)",cursor:L||!V.trim()&&!M&&!X?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"},children:L?a.jsx(Da,{size:p?18:15,style:{animation:"spin 1s linear infinite"}}):a.jsx(zo,{size:p?18:15})})]}),a.jsxs("div",{style:{display:"flex",alignItems:"center",gap:4,marginTop:5,justifyContent:"center",flexWrap:"wrap"},children:[[{key:"auto",icon:"⚡",label:"Auto",title:"Selección automática — elige el mejor motor según tu pregunta"},{key:"claude",icon:"🧠",label:"Claude",title:"Claude (Anthropic) — escritura profunda, código, análisis estratégico, informes largos"},{key:"gemini",icon:"🔬",label:"Gemini",title:"Gemini (Google) — streaming en tiempo real + búsqueda web, /imagen-gemini y /codigo-gemini"},{key:"grok",icon:"🤖",label:"Grok",title:"Grok (xAI) — razonamiento rápido, perspectiva alternativa, análisis directo"},{key:"gpt",icon:"🟢",label:"GPT",title:"GPT (OpenAI) — gran rendimiento en código, análisis y escritura; elige modelo en el sub-selector"},{key:"brain_only",icon:"💾",label:"Brain",title:"Solo memoria ShopyBrain — responde desde el conocimiento acumulado de tu tienda"}].map(({key:i,icon:e,label:o,title:n})=>a.jsxs("button",{onClick:()=>J(i),title:n,style:{fontSize:9,padding:"4px 8px",borderRadius:4,cursor:"pointer",border:R===i?"1px solid var(--gold)":"1px solid transparent",background:R===i?"rgba(200,168,75,0.15)":"transparent",color:R===i?"var(--gold)":"var(--t4)",display:"flex",alignItems:"center",gap:3,transition:"all 0.2s",minHeight:28},children:[e," ",o]},i)),R==="gemini"&&a.jsxs("button",{onClick:()=>Xa(i=>!i),title:Se?"Deep Think activado — Gemini usa 20.000 tokens de razonamiento. Haz clic para desactivar.":"Activar Deep Think — Gemini razona en profundidad antes de responder (más lento, más preciso)",style:{fontSize:9,padding:"4px 8px",borderRadius:4,cursor:"pointer",border:Se?"1px solid var(--jade)":"1px solid rgba(45,212,159,0.3)",background:Se?"rgba(45,212,159,0.15)":"transparent",color:Se?"var(--jade)":"var(--t4)",display:"flex",alignItems:"center",gap:3,transition:"all 0.2s",minHeight:28},children:["🧩 ",Se?"Think ON":"Deep Think"]}),R==="claude"&&a.jsx("div",{style:{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"},children:[{key:"claude-haiku-3-5",label:"Haiku",title:"Claude Haiku 3.5 — rapidísimo y económico • $0.25/M in, $1.25/M out"},{key:"claude-sonnet-4-6",label:"Sonnet",title:"Claude Sonnet 4.6 — equilibrado, inteligente • $3/M in, $15/M out"},{key:"claude-opus-4-8",label:"Opus",title:"Claude Opus 4.8 — máxima inteligencia, más lento • $15/M in, $75/M out"}].map(({key:i,label:e,title:o})=>a.jsxs("button",{onClick:()=>Je(i),title:o,style:{fontSize:9,padding:"3px 7px",borderRadius:3,cursor:"pointer",border:Q===i?"1px solid #c878ff":"1px solid rgba(200,120,255,0.25)",background:Q===i?"rgba(200,120,255,0.12)":"transparent",color:Q===i?"#c878ff":"var(--t4)",display:"flex",alignItems:"center",gap:2,transition:"all 0.2s"},children:["🧠 ",e]},i))}),R==="gpt"&&a.jsx("div",{style:{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"},children:[{key:"gpt-4.1-nano",label:"Nano",title:"GPT-4.1 Nano — ultrarápido y baratísimo • $0.10/M in, $0.40/M out"},{key:"gpt-4.1-mini",label:"Mini",title:"GPT-4.1 Mini — rápido y económico • $0.40/M in, $1.60/M out"},{key:"gpt-4.1",label:"4.1",title:"GPT-4.1 — alto rendimiento • $2/M in, $8/M out"},{key:"gpt-4o",label:"4o",title:"GPT-4o — multimodal, visión + texto • $2.50/M in, $10/M out"}].map(({key:i,label:e,title:o})=>a.jsxs("button",{onClick:()=>Qa(i),title:o,style:{fontSize:9,padding:"3px 7px",borderRadius:3,cursor:"pointer",border:je===i?"1px solid #10a37f":"1px solid rgba(16,163,127,0.25)",background:je===i?"rgba(16,163,127,0.12)":"transparent",color:je===i?"#10a37f":"var(--t4)",display:"flex",alignItems:"center",gap:2,transition:"all 0.2s"},children:["🟢 ",e]},i))})]})]})]})]}),a.jsx("input",{ref:$a,type:"file",multiple:!0,accept:"image/*,video/*,audio/*,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.ndjson,.xml,.html,.htm,.css,.scss,.sass,.less,.js,.mjs,.cjs,.ts,.tsx,.jsx,.vue,.svelte,.py,.rb,.php,.java,.kt,.c,.cpp,.h,.cs,.go,.rs,.swift,.dart,.yaml,.yml,.toml,.ini,.sql,.graphql,.sh,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.log",style:{display:"none"},onChange:so}),a.jsx("style",{children:`
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 4px 24px rgba(200,168,75,0.4), 0 0 0 0 rgba(200,168,75,0.3); }
          50% { box-shadow: 0 4px 32px rgba(200,168,75,0.7), 0 0 0 10px rgba(200,168,75,0.05); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `})]}):null}export{$n as default};
