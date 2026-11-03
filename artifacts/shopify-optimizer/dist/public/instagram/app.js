/* intro_caida.js — LA CAÍDA: el logo de Instagram cae del cielo y se clava en el suelo.
*
* Script clásico. Mismo contrato que intro3d.js (kurosawa-cine, 03/11/2026):
*
*   IntroLogo3D.montar(elemento, {
*     destino,            // adónde se va al final (obligatorio)
*     marca,              // nombre accesible; texto del botón si el destino no es Instagram
*     usuario,            // opcional: «@cuenta». Si falta, se saca de la ruta del destino
*     boton,              // opcional: texto del botón. Por defecto, «Ir a Instagram»
*     segundos: 4.5,      // segundos + espera_s = momento de irse. Por defecto 6,0 s
*     espera_s: 1.5,
*     redirigir: true,    // false: solo el botón
*     alTerminar,         // al aparecer el botón
*     congelar_t          // arnés: t fija, sin bucle y sin irse
*   }) → { saltar(), destruir(), irA(t), listo, info() }
*
* codigo_url y logo_url se aceptan y NO se usan: el logo es geometría propia.
*
* NUNCA bloquea: sin WebGL, sin three, si tarda más de 3,5 s o si algo lanza, se va
* al destino en el acto. Red de seguridad a segundos + espera + 6.
* Toda la escena es función de t: `pintar(t)` da siempre el mismo cuadro.
*
* Biblia del mundo: un meteoro al anochecer sobre una llanura de basalto. Cielo de
* tinta a brasa; el degradado cálido→magenta→violeta del logo sangra en las grietas;
* el oro de la marca es la luz de borde. Nada de bitmaps: todo se pinta por código.
* three 0.170.0, solo jsDelivr, sin eval (`window.__introImportar` o import()).
*/
(function () {
 "use strict";
 if (window.IntroLogo3D) return;
 var THREE_URL="https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
 var FUENTE="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap";
 // ── guion (segundos)
 var T_IMPACTO=2.2,T_BOTON=3.8,ALTURA=760;
 var RC=42;           // radio del campo de grietas
 var LADO=4;          // lado del logo
 var POSE_Y=0.62;     // altura del centro del logo clavado
 var clamp=function (x,a,b) { return x<a ? a : x>b ? b : x; };
 var sat=function (x) { return clamp(x,0,1); };
 var mezcla=function (a,b,t) { return a+(b-a)*t; };
 var tramo=function (t,a,b) { return sat((t-a)/(b-a)); };
 var suave=function (t) { t=sat(t); return t*t*(3-2*t); };
 var salida3=function (t) { t=1-sat(t); return 1-t*t*t; };
 var campana=function (t,a,b,c) { return t<b ? suave(tramo(t,a,b)) : 1-suave(tramo(t,b,c)); };
 function azar(semilla) {        // mulberry32:la misma semilla,los mismos escombros
  var a=semilla >>> 0;
  return function () {
   a=(a+0x6d2b79f5) >>> 0;
   var t=a;
   t=Math.imul(t ^ (t >>> 15),t | 1);
   t ^= t+Math.imul(t ^ (t >>> 7),t | 61);
   return ((t ^ (t >>> 14)) >>> 0)/4294967296;
  };
 }
 // Curva de Hermite por claves [t, v, v, …]: tangentes por diferencias finitas, sin paradas.
 function curva(claves) {
  var n=claves.length,m=claves[0].length-1,tg=[];
  for (var i=0; i<n; i++) {
   var A=claves[Math.max(0,i-1)],B=claves[Math.min(n-1,i+1)],f=[];
   for (var k=1; k <= m; k++) f.push((B[k]-A[k])/Math.max(1e-4,B[0]-A[0]));
   tg.push(f);
  }
  return function (t,sal) {
   if (t <= claves[0][0]) { for (var k0=0; k0<m; k0++) sal[k0]=claves[0][k0+1]; return sal; }
   if (t >= claves[n-1][0]) { for (var k1=0; k1<m; k1++) sal[k1]=claves[n-1][k1+1]; return sal; }
   var i=0; while (claves[i+1][0]<t) i++;
   var a=claves[i],b=claves[i+1],h=b[0]-a[0],u=(t-a[0])/h,u2=u*u,u3=u2*u;
   for (var k=0; k<m; k++) {
    sal[k]=(2*u3-3*u2+1)*a[k+1]+(u3-2*u2+u)*h*tg[i][k] +
        (-2*u3+3*u2)*b[k+1]+(u3-u2)*h*tg[i+1][k];
   }
   return sal;
  };
 }
 // ── GLSL común
 var G_RUIDO=[
  `float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm2(vec2 p){return vn(p)*.62+vn(p*2.13+7.1)*.38;}
float fbm3(vec2 p){return vn(p)*.52+vn(p*2.13+7.1)*.3+vn(p*4.31+3.7)*.18;}`,
 ].join("\n");
 // El sol, a ras de horizonte y detrás del encuadre final: de ahí sale el borde dorado.
 var SOL="const vec3 SOL=normalize(vec3(-.93,.07,-.36));";
 var G_CIELO=[
  SOL,
  `vec3 lin(vec3 c){return pow(c,vec3(2.2));}
vec3 horizonte(vec3 d){float s=max(dot(normalize(vec3(d.x,0.,d.z)),normalize(vec3(SOL.x,0.,SOL.z))),0.);
 return mix(lin(vec3(.30,.13,.36)),lin(vec3(1.,.47,.20)),pow(s,2.4));}
vec3 cielo(vec3 d){float y=d.y,a=max(y,0.);vec3 h=horizonte(d);
 vec3 c=mix(h,lin(vec3(.62,.15,.47)),smoothstep(.0,.13,a));
 c=mix(c,lin(vec3(.25,.11,.47)),smoothstep(.09,.34,a));
 c=mix(c,lin(vec3(.05,.05,.13)),smoothstep(.28,.72,a));
 c=mix(c,lin(vec3(.031,.031,.063)),smoothstep(.65,1.,a));
 float s=max(dot(d,SOL),0.);
 c+=lin(vec3(1.,.62,.32))*(pow(s,6.)*.55+pow(s,48.)*1.1)+vec3(1.,.72,.4)*smoothstep(.9992,.9997,s)*16.;
 return y<0.?h*mix(.28,1.,smoothstep(-.14,0.,y)):c;}`,
 ].join("\n");
 var G_PANTALLA="varying vec2 vU;void main(){vU=uv;gl_Position=vec4(position.xy,0.,1.);}";
 // ── grietas: dos lienzos con la misma topología
 // Radiales + anillos = losas. Una lámina guarda la grieta (casi un campo de distancia:
 // varias pasadas de anchura decreciente, para poder abrirla bajando un umbral) y la
 // otra la altura de cada losa, con su inclinación: de ahí salen las fallas.
 function lienzo(n) { var c=document.createElement("canvas"); c.width=c.height=n; return c; }
 function pintarGrietas(nG,nP) {
  var az=azar(77031),cG=lienzo(nG),cP=lienzo(nP);
  var a=cG.getContext("2d"),b=cP.getContext("2d");
  a.fillStyle="#000"; a.fillRect(0,0,nG,nG);
  b.fillStyle="rgb(128,128,128)"; b.fillRect(0,0,nP,nP);
  a.lineCap=a.lineJoin="round"; a.globalCompositeOperation="lighten";
  var aG=function (v) { return (v/(2*RC)+0.5)*nG; };
  var aP=function (v) { return (v/(2*RC)+0.5)*nP; };
  var ANILLOS=[2.2,4.6,7.6,11.2,15.5,21,28,36,44];
  var NR=15,RAD=[];
  for (var i=0; i<NR; i++) {
   var ang=(i+(az()-0.5)*0.62)/NR*Math.PI*2,fila=[];
   for (var j=0; j<ANILLOS.length; j++) {
    ang += (az()-0.5)*0.3*(j ? 2.6/Math.sqrt(ANILLOS[j]) : 1);
    var r=ANILLOS[j]*(1+(az()-0.5)*0.2);
    fila.push([Math.cos(ang)*r,Math.sin(ang)*r]);
   }
   RAD.push(fila);
  }
  var quebrar=function (p,q,n,am) {       // tramo roto entre dos puntos
   var out=[p],dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy);
   for (var k=1; k<n; k++) {
    var u=k/n,o=(az()-0.5)*am*L;
    out.push([p[0]+dx*u-dy/L*o,p[1]+dy*u+dx/L*o]);
   }
   out.push(q);
   return out;
  };
  var trazo=function (pts,w,fuerza) {
   var pasadas=[[8,0.1],[4.6,0.22],[2.4,0.42],[1.25,0.66],[0.55,1]];
   for (var p=0; p<pasadas.length; p++) {
    a.lineWidth=Math.max(0.7,w*pasadas[p][0])*nG/1024;
    var v=Math.round(255*pasadas[p][1]*fuerza);
    a.strokeStyle="rgb(" + v+"," + v+"," + v+")";
    a.beginPath();
    a.moveTo(aG(pts[0][0]),aG(pts[0][1]));
    for (var k=1; k<pts.length; k++) a.lineTo(aG(pts[k][0]),aG(pts[k][1]));
    a.stroke();
   }
  };
  for (var i2=0; i2<NR; i2++) {
   var A=RAD[i2],B=RAD[(i2+1) % NR];
   for (var j2=0; j2<ANILLOS.length-1; j2++) {
    var cerca=1-j2/(ANILLOS.length-1);
    if (az()>0.35+cerca*0.6) continue;     // lejos,muchas losas no se mueven
    var am=(0.05+0.27*cerca*cerca),base=0.5+(az()-0.42)*am*0.8;
    var cx=(A[j2][0]+B[j2+1][0])/2,cy=(A[j2][1]+B[j2+1][1])/2;
    var ta=az()*6.283,s=4+ANILLOS[j2]*0.3;
    var g=b.createLinearGradient(aP(cx-Math.cos(ta)*s),aP(cy-Math.sin(ta)*s),
                   aP(cx+Math.cos(ta)*s),aP(cy+Math.sin(ta)*s));
    var c0=Math.round(255*sat(base-am*0.5)),c1=Math.round(255*sat(base+am*0.5));
    g.addColorStop(0, "rgb(" + c0+"," + c0+"," + c0+")");
    g.addColorStop(1, "rgb(" + c1+"," + c1+"," + c1+")");
    b.fillStyle=g;
    b.beginPath();
    b.moveTo(aP(A[j2][0]),aP(A[j2][1])); b.lineTo(aP(A[j2+1][0]),aP(A[j2+1][1]));
    b.lineTo(aP(B[j2+1][0]),aP(B[j2+1][1])); b.lineTo(aP(B[j2][0]),aP(B[j2][1]));
    b.closePath(); b.fill();
   }
  }
  for (var i3=0; i3<NR; i3++) {
   var F=RAD[i3],hasta=3+Math.floor(az()*3+(i3 % 3 ? 3 : 2));
   for (var j3=i3 % 2 ? 0 : 1+(i3 % 4 ? 1 : 0); j3<Math.min(hasta+2,ANILLOS.length-1); j3++) {
    var w=5.5*Math.pow(1-j3/ANILLOS.length,1.5)+1.1;
    trazo(quebrar(F[j3],F[j3+1],2+(j3 >> 1),0.13),w,1);
    if (az()<0.72) {                                    // rama
     var e=F[j3+1],ra=Math.atan2(e[1],e[0])+(az()<0.5 ? -1 : 1)*(0.4+az()*0.7);
     var L=2+ANILLOS[j3]*(0.25+az()*0.35),q=[e[0]+Math.cos(ra)*L,e[1]+Math.sin(ra)*L];
     var pr=quebrar(e,q,4,0.28);
     trazo(pr,w*0.42,0.85);
     if (az()<0.55) {
      var sa=ra+(az()-0.5)*1.8;
      trazo(quebrar(pr[2],[pr[2][0]+Math.cos(sa)*L*0.55,pr[2][1]+Math.sin(sa)*L*0.55],3,0.3),w*0.24,0.7);
     }
    }
   }
  }
  for (var j4=0; j4<ANILLOS.length-2; j4++) {
   for (var i4=0; i4<NR; i4++) {
    if (az()>0.86-j4*0.07) continue;
    trazo(quebrar(RAD[i4][j4],RAD[(i4+1) % NR][j4],4,0.16),3.2*(1-j4/9)+0.8,0.9);
   }
  }
  return { grietas:cG,placas:cP };
 }
 function pintarSoplo() {       // el «humo» de nubes y polvo:radial con mordidas
  var n=128,c=lienzo(n),x=c.getContext("2d"),az=azar(4242);
  x.clearRect(0,0,n,n);
  for (var i=0; i<26; i++) {
   var a=az()*6.283,r=Math.sqrt(az())*n*0.27,R=n*(0.09+az()*0.16);
   var px=n/2+Math.cos(a)*r,py=n/2+Math.sin(a)*r;
   var g=x.createRadialGradient(px,py,0,px,py,R);
   g.addColorStop(0, "rgba(255,255,255," + (0.14+az()*0.16)+")");
   g.addColorStop(1, "rgba(255,255,255,0)");
   x.fillStyle=g; x.fillRect(0,0,n,n);
  }
  return c;
 }
 // ── la escena
 function crearEscena(T,lienzoGL,op) {
  var renderer=new T.WebGLRenderer({ canvas:lienzoGL,antialias:false,alpha:false,stencil:false,
   powerPreference:"high-performance", preserveDrawingBuffer:!!op.preservar });
  renderer.toneMapping=T.NoToneMapping;
  renderer.setClearColor(0x08080f,1);
 renderer.info.autoReset=false;
  var hdr=renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float");
  var TIPO=hdr ? T.HalfFloatType : T.UnsignedByteType;
  var nucleos=navigator.hardwareConcurrency || 4,memoria=navigator.deviceMemory || 4;
  // Nivel: 0 pleno · 1 medio · 2 flojo · 3 mínimo. Un móvil de gama baja empieza ya en 1.
  var NIVELES=[
   { dpr:2,muestras:4,part:1,bloom2:true,radial:7 },
   { dpr:1.6,muestras:0,part:0.7,bloom2:true,radial:5 },
   { dpr:1.2,muestras:0,part:0.42,bloom2:false,radial:3 },
   { dpr:0.85,muestras:0,part:0.22,bloom2:false,radial:0 },
  ];
  var nivel=op.nivel != null ? clamp(op.nivel,0,3) : (nucleos <= 4 || memoria <= 3) ? 1 : 0;
  var scene=new T.Scene();
  var camera=new T.PerspectiveCamera(30,1,0.5,40000);
  var uT={ value:0 };
  var az=azar(90210);
  var desechables=[];
  var guardar=function (x) { desechables.push(x); return x; };
  // ── cielo
  var uNubes={ value:1 };
  var cieloMat=guardar(new T.ShaderMaterial({
   side:T.BackSide,depthWrite:false,depthTest:false,uniforms:{ uT:uT,uNubes:uNubes },
   vertexShader:"varying vec3 vD;void main(){vD=position;vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.);gl_Position=p.xyww;}",
   fragmentShader:[
    "uniform float uT,uNubes;varying vec3 vD;", G_RUIDO,G_CIELO,
    `void main(){vec3 d=normalize(vD);vec3 c=cielo(d);
 if(d.y>0.05){vec2 u=d.xz/(d.y+.28);
  vec2 ce=floor(u*150.);float e=h21(ce);c+=vec3(.9,.92,1.)*step(.975,e)*smoothstep(.22,.6,d.y)*(1.-smoothstep(.0,.2,length(fract(u*150.)-.5)))*2.;
  float n=fbm3(u*vec2(1.5,3.4)+7.);n=smoothstep(.47,.82,n)*uNubes*smoothstep(.05,.2,d.y)*(1.-smoothstep(.45,.85,d.y));
  c=mix(c,mix(lin(vec3(.13,.07,.21)),lin(vec3(1.,.5,.36)),pow(max(dot(d,SOL),0.)*.5+.5,3.)),n*.82);}
 gl_FragColor=vec4(c,1.);}`,
   ].join("\n"),
  }));
  var geoCielo=guardar(new T.IcosahedronGeometry(10,3));
  var cieloM=new T.Mesh(geoCielo,cieloMat);
  cieloM.frustumCulled=false; cieloM.renderOrder=-10;
  scene.add(cieloM);
  var pmrem=new T.PMREMGenerator(renderer);
  var soloCielo=new T.Scene();
  soloCielo.add(new T.Mesh(geoCielo,cieloMat));
  var rtEnv=pmrem.fromScene(soloCielo,0.03);
  pmrem.dispose();
  scene.environment=rtEnv.texture;
  scene.environmentIntensity=0.85;
  guardar(rtEnv);
  // ── luces
  var hemi=new T.HemisphereLight(0x9a80c8,0x1c1016,0.75); scene.add(hemi);
  var clave=new T.DirectionalLight(0xffc28a,2.4);
  clave.position.set(-0.93,0.3,-0.36).multiplyScalar(100); scene.add(clave);
  var relleno=new T.DirectionalLight(0xffeedd,0); scene.add(relleno);
  var brasa=new T.PointLight(0xff6a28,0,90,1.7); brasa.position.set(0,1.4,0); scene.add(brasa);
  // ── suelo: rejilla polar de 128×128, densa en el cráter y hasta el horizonte
  var geoSuelo=(function () {
   var RINGS=128,SEC=128,pos=[],idx=[];
   var radio=function (i) {
    if (i <= 92) return 46*Math.pow(i/92,1.35);
    return 46*Math.pow(16000/46,(i-92)/(RINGS-92));
   };
   for (var i=0; i <= RINGS; i++) {
    var r=radio(i);
    for (var s=0; s<SEC; s++) {
     var a=(s+(i % 2)*0.5)/SEC*Math.PI*2;
     pos.push(Math.cos(a)*r,0,Math.sin(a)*r);
    }
   }
   for (var i2=0; i2<RINGS; i2++) {
    for (var s2=0; s2<SEC; s2++) {
     var a0=i2*SEC+s2,a1=i2*SEC+(s2+1) % SEC;
     var b0=(i2+1)*SEC+s2,b1=(i2+1)*SEC+(s2+1) % SEC;
     idx.push(a0,a1,b0,a1,b1,b0);
    }
   }
   var g=new T.BufferGeometry();
   g.setAttribute("position", new T.Float32BufferAttribute(pos,3));
   var n=new Float32Array(pos.length); for (var k=1; k<n.length; k += 3) n[k]=1;
   g.setAttribute("normal", new T.BufferAttribute(n,3));
   g.setIndex(idx);
   return guardar(g);
  })();
  var tex=pintarGrietas(1024,512);
  var tGr=guardar(new T.CanvasTexture(tex.grietas));
  tGr.minFilter=T.LinearMipmapLinearFilter; tGr.magFilter=T.LinearFilter;
  tGr.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()); tGr.wrapS=tGr.wrapT=T.ClampToEdgeWrapping;
  var tPl=guardar(new T.CanvasTexture(tex.placas));
  tPl.generateMipmaps=false; tPl.minFilter=tPl.magFilter=T.LinearFilter;
  var soplo=guardar(new T.CanvasTexture(pintarSoplo()));
  var uS={
   tGrietas:{ value:tGr }, tPlacas:{ value:tPl }, uRompe:{ value:0 }, uRevela:{ value:0 }, uAbre:{ value:0 },
   uBrasa:{ value:0 }, uOnda:{ value:-100 }, uOndaF:{ value:0 }, uT:uT,uFugaX:{ value:0 },
  };
  var G_ALTURA=[
   `uniform sampler2D tPlacas;uniform float uRompe;
const float RC=${RC.toFixed(1)};
float crater(float r){return uRompe*(-1.5*exp(-r*r/20.)+1.05*exp(-pow((r-8.2)/3.3,2.))+.25*exp(-pow((r-17.)/5.,2.)));}
float placas(vec2 xz,float r){if(r>=RC)return 0.;float f=1.-smoothstep(RC*.72,RC,r);
 return (texture2D(tPlacas,xz/(2.*RC)+.5).r-.5)*7.*f*uRompe*smoothstep(.4,3.,r);}`,
  ].join("\n");
  var sueloMat=guardar(new T.MeshStandardMaterial({ color:0xffffff,roughness:0.9,metalness:0.0,envMapIntensity:0.12 }));
  sueloMat.onBeforeCompile=function (s) {
   for (var k in uS) s.uniforms[k]=uS[k];
   s.vertexShader=s.vertexShader
    .replace("#include <common>", "#include <common>\n" + G_RUIDO+"\n" + G_ALTURA+"\nvarying vec3 vM;")
    .replace("#include <begin_vertex>", [
     `vec3 transformed=vec3(position);float r0=length(position.xz);
transformed.y+=crater(r0)+placas(position.xz,r0);
float cres=smoothstep(500.,1800.,r0);
transformed.y+=(fbm2(position.xz/1300.)-.5)*420.*cres+max(fbm2(position.xz/430.)-.55,0.)*520.*cres;`,
     "transformed.y-=r0*r0/120000.;",   // la curvatura:el horizonte se dobla a gran altura
     `vM=vec3(position.x,transformed.y,position.z);`,
    ].join("\n"));
   s.fragmentShader=s.fragmentShader
    .replace("#include <common>", ["#include <common>", G_RUIDO,G_ALTURA,G_CIELO,
     `uniform sampler2D tGrietas;uniform float uRevela,uAbre,uBrasa,uOnda,uOndaF,uT;varying vec3 vM;
float gc,gnucleo,gr;vec3 gcolor;
float altDet(vec2 p,float r){return crater(r)+placas(p,r)+(fbm2(p*1.7)-.5)*.22+(vn(p*7.3)-.5)*.05;}
float fisura(vec2 p,float w){p+=(vec2(vn(p*2.7),vn(p*2.7+9.))-.5)*.3;vec2 i=floor(p),f=fract(p);float a=8.,b=8.;
for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y),c=i+g;vec2 r=g+vec2(h21(c),h21(c+17.3))-f;float d=dot(r,r);if(d<a){b=a;a=d;}else if(d<b)b=d;}
float e=sqrt(b)-sqrt(a);float aa=max(w,fwidth(e)*1.3);return 1.-smoothstep(0.,aa,e);}`,
    ].join("\n"))
    .replace("#include <color_fragment>", [
     `#include <color_fragment>
vec2 xz=vM.xz;gr=length(xz);
float dcam=length(vM-cameraPosition);float mac=fbm3(xz/220.),med=mix(fbm3(xz/9.),.5,smoothstep(120.,500.,dcam)),fin=mix(fbm2(xz*2.1),.5,smoothstep(14.,60.,dcam));
vec3 piedra=mix(vec3(.032,.032,.052),vec3(.115,.095,.1),med*.55+mac*.45);
piedra*=.5+fin*1.;
gc=0.;gnucleo=0.;
if(gr<RC){vec2 u=xz/(2.*RC)+.5+(vec2(vn(xz*2.6),vn(xz*2.6+5.))-.5)*.0052;float c=texture2D(tGrietas,u).r*(1.-smoothstep(RC*.8,RC,gr));
 c*=1.-smoothstep(uRevela-7.,uRevela,gr+(fin-.5)*5.);
 float th=mix(.98,.68,uAbre);gc=c;gnucleo=smoothstep(th,th+.1,c);
 float boca=smoothstep(.03,.3,c);piedra*=mix(1.,.3,boca);piedra*=1.-gnucleo*.9;}
float nh=uRompe*exp(-gr*gr/110.);piedra*=1.-.72*nh;
vec2 sd=normalize(vec2(.93,.36));float sa=clamp(dot(xz,sd),0.,16.);float sb=length(xz-sd*sa);
piedra*=1.-.62*uRompe*(1.-smoothstep(1.2,3.8,sb))*(1.-sa/16.);
diffuseColor.rgb=piedra;`,
    ].join("\n"))
    .replace("#include <normal_fragment_maps>", [
     `#include <normal_fragment_maps>
if(gr<60.){float e=.09;vec2 p=vM.xz;
 float h0=altDet(p,gr),hx=altDet(p+vec2(e,0.),length(p+vec2(e,0.))),hz=altDet(p+vec2(0.,e),length(p+vec2(0.,e)));
 vec3 nw=normalize(vec3(h0-hx,e,h0-hz));
 if(gr<RC){float g0=gc,gx=texture2D(tGrietas,(p+vec2(.16,0.))/(2.*RC)+.5).r,gz=texture2D(tGrietas,(p+vec2(0.,.16))/(2.*RC)+.5).r;
  nw=normalize(nw+vec3(gx-g0,0.,gz-g0)*2.2*smoothstep(.0,.3,g0));}
 normal=normalize(mix(normal,(viewMatrix*vec4(nw,0.)).xyz,1.-smoothstep(45.,60.,gr)));}`,
    ].join("\n"))
    .replace("#include <emissivemap_fragment>", [
     `#include <emissivemap_fragment>
{vec3 e=vec3(0.);
 float lejos=max(smoothstep(40.,120.,gr),1.-smoothstep(0.,.05,uRompe));
 float f1=0.,f2=0.;if(gr>30.||uRompe<.05){f1=fisura(xz/300.+3.1,.018);f2=fisura(xz/46.+9.7,.03)*(1.-smoothstep(300.,1100.,dcam));}
 float pulso=.55+.45*vn(xz/500.+uT*.1);
 e+=vec3(1.,.27,.07)*f1*1.5*pulso*lejos+vec3(.9,.14,.2)*f2*.55*pulso*lejos;
 if(gnucleo>0.||gc>0.){float k=gr/RC;
  vec3 ram=mix(vec3(1.,.72,.26),vec3(1.,.27,.05),smoothstep(.04,.26,k));
  ram=mix(ram,vec3(.92,.05,.34),smoothstep(.24,.56,k));ram=mix(ram,vec3(.36,.07,.75),smoothstep(.54,.95,k));
  e+=ram*gnucleo*uBrasa*(.5+.5*exp(-gr/9.));
  e+=ram*gc*gc*uBrasa*.16;}
 e+=vec3(1.,.36,.1)*uRompe*exp(-gr*gr/9.)*uBrasa*.34;
 float o=gr-uOnda;e+=mix(vec3(1.,.78,.42),vec3(1.,.2,.45),smoothstep(0.,70.,uOnda))*exp(-o*o/(o>0.?2.:26.))*uOndaF;
 totalEmissiveRadiance+=e;}`,
    ].join("\n"))
    .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.directSpecular*=.1;reflectedLight.indirectSpecular*=.2;")
    .replace("#include <fog_fragment>", [
     `{vec3 dv=vM-cameraPosition;float dist=length(dv);vec3 dd=dv/dist;
 float nb=1.-exp(-dist*dist*2.6e-8);
 vec3 h=horizonte(vec3(dd.x,.0,dd.z));
 gl_FragColor.rgb=mix(gl_FragColor.rgb,h*.9,nb);}`,
    ].join("\n"));
  };
  var suelo=new T.Mesh(geoSuelo,sueloMat);
  suelo.frustumCulled=false;
  scene.add(suelo);
  // ── el logo: geometría propia
  var cuadrado=function (lado,radio,S) {
   var h=lado/2,r=radio,x=S || new T.Shape();
   x.moveTo(-h+r,-h); x.lineTo(h-r,-h); x.absarc(h-r,-h+r,r,-Math.PI/2,0,false);
   x.lineTo(h,h-r); x.absarc(h-r,h-r,r,0,Math.PI/2,false);
   x.lineTo(-h+r,h); x.absarc(-h+r,h-r,r,Math.PI/2,Math.PI,false);
   x.lineTo(-h,-h+r); x.absarc(-h+r,-h+r,r,Math.PI,Math.PI*1.5,false);
   return x;
  };
  var GRUESO=0.62,RELIEVE=0.075;
  var geoPlaca=guardar(new T.ExtrudeGeometry(cuadrado(LADO,LADO*0.232),
   { depth:GRUESO,bevelEnabled:true,bevelThickness:0.11,bevelSize:0.11,bevelSegments:4,curveSegments:18 }));
  geoPlaca.translate(0,0,-GRUESO/2);
  var geoGlifo=(function () {
   var marco=cuadrado(LADO*0.74,LADO*0.205);
   var hueco=new T.Path(); cuadrado(LADO*0.74-LADO*0.145,LADO*0.135,hueco); marco.holes.push(hueco);
   var aro=new T.Shape(); aro.absarc(0,0,LADO*0.19,0,Math.PI*2,false);
   var ha=new T.Path(); ha.absarc(0,0,LADO*0.118,0,Math.PI*2,true); aro.holes.push(ha);
   var punto=new T.Shape(); punto.absarc(LADO*0.2,LADO*0.2,LADO*0.05,0,Math.PI*2,false);
   var g=new T.ExtrudeGeometry([marco,aro,punto],
    { depth:RELIEVE,bevelEnabled:true,bevelThickness:0.035,bevelSize:0.03,bevelSegments:2,curveSegments:18 });
   var fuera=GRUESO/2+0.1;
   var p=g.getAttribute("position").array,n=g.getAttribute("normal").array,c=p.length;
   var P=new Float32Array(c*2),N=new Float32Array(c*2);
   for (var i=0; i<c; i += 3) {
    P[i]=p[i]; P[i+1]=p[i+1]; P[i+2]=p[i+2]+fuera;
    N[i]=n[i]; N[i+1]=n[i+1]; N[i+2]=n[i+2];
    P[c+i]=-p[i]; P[c+i+1]=p[i+1]; P[c+i+2]=-(p[i+2]+fuera);
    N[c+i]=-n[i]; N[c+i+1]=n[i+1]; N[c+i+2]=-n[i+2];
   }
   g.dispose();
   var out=new T.BufferGeometry();
   out.setAttribute("position", new T.BufferAttribute(P,3));
   out.setAttribute("normal", new T.BufferAttribute(N,3));
   return guardar(out);
  })();
  var uCalor={ value:0 }, uLuzLogo={ value:0.42 }, uBorde={ value:0 };
  var G_DEG=[
   `vec3 lin3(vec3 c){return pow(c,vec3(2.2));}
vec3 degradado(vec2 p){float t=clamp(length(p-vec2(-.42,-.54))/1.36,0.,1.);
 vec3 c=mix(lin3(vec3(1.,.83,.33)),lin3(vec3(.98,.42,.12)),smoothstep(.0,.28,t));
 c=mix(c,lin3(vec3(.87,.1,.42)),smoothstep(.24,.56,t));
 c=mix(c,lin3(vec3(.56,.14,.78)),smoothstep(.52,.8,t));
 return mix(c,lin3(vec3(.29,.26,.86)),smoothstep(.78,1.,t));}`,
  ].join("\n");
  var placaMat=guardar(new T.MeshPhysicalMaterial({ color:0xffffff,roughness:0.3,metalness:0.18,clearcoat:1,clearcoatRoughness:0.12,envMapIntensity:1.25 }));
  placaMat.onBeforeCompile=function (s) {
   s.uniforms.uCalor=uCalor; s.uniforms.uLuz=uLuzLogo; s.uniforms.uBorde=uBorde; s.uniforms.uLado={ value:LADO };
   s.vertexShader=s.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vL;")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvL=position;");
   s.fragmentShader=s.fragmentShader
    .replace("#include <common>", "#include <common>\nuniform float uCalor,uLuz,uLado,uBorde;varying vec3 vL;\n" + G_DEG)
    .replace("#include <color_fragment>", "#include <color_fragment>\nvec3 gLogo=degradado(vL.xy/uLado*vec2(sign(vL.z+1e-3),1.));diffuseColor.rgb=gLogo;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=gLogo*(uLuz+uCalor*2.6)+vec3(1.,.74,.3)*uBorde*2.6*pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.5);");
  };
  var glifoMat=guardar(new T.MeshStandardMaterial({ color:0xfff6ec,roughness:0.3,metalness:0.25,emissive:0xfff2e4,emissiveIntensity:0.52,envMapIntensity:0.9 }));
  var logo=new T.Group();
  var mPlaca=new T.Mesh(geoPlaca,placaMat),mGlifo=new T.Mesh(geoGlifo,glifoMat);
  mPlaca.frustumCulled=mGlifo.frustumCulled=false;
  logo.add(mPlaca,mGlifo);
  scene.add(logo);
    var heroDir=new T.Vector3(0.62,0,0.78);   // en planta,la cámara mira contra el sol
  var qYaw=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.atan2(heroDir.x,heroDir.z)+0.36);
  var qHero=new T.Quaternion().copy(qYaw)
   .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-0.34))
   .multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-0.46));
  // ── estela y halo
  var geoEstela=guardar(new T.CylinderGeometry(0.16,1,1,20,8,true));
  geoEstela.translate(0,0.5,0);
  var uEst={ uT:uT,uK:{ value:0 } };
  var estelaMat=guardar(new T.ShaderMaterial({
   transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:uEst,
   vertexShader:"varying vec2 vU;varying vec3 vN,vV;void main(){vU=uv;vec4 m=modelViewMatrix*vec4(position,1.);vV=-m.xyz;vN=normalMatrix*normal;gl_Position=projectionMatrix*m;}",
   fragmentShader:[
    "uniform float uT,uK;varying vec2 vU;varying vec3 vN,vV;", G_RUIDO,
    "void main(){float y=vU.y;",   // y=0 pegado al logo,y=1 la cola
    ` float fr=abs(dot(normalize(vN),normalize(vV)));fr=pow(fr,1.5);
 float n=fbm2(vec2(vU.x*22.,y*3.4-uT*7.));
 float a=(1.-y)*(1.-y)*fr*(.42+n*1.1);
 a*=smoothstep(2.,26.,length(vV));vec3 c=mix(vec3(1.,.6,.25),vec3(1.,.22,.06),smoothstep(.0,.16,y));c=mix(c,vec3(.95,.06,.42),smoothstep(.18,.5,y));c=mix(c,vec3(.34,.1,.9),smoothstep(.45,.95,y));
 gl_FragColor=vec4(c*a*uK*1.5,1.);}`,
   ].join("\n"),
  }));
  var estela=new T.Mesh(geoEstela,estelaMat);
  estela.frustumCulled=false;
  scene.add(estela);
  var halo=(function () {
   var c=lienzo(128),x=c.getContext("2d");
   var g=x.createRadialGradient(64,64,0,64,64,64);
   g.addColorStop(0, "rgba(255,240,215,1)"); g.addColorStop(0.1, "rgba(255,160,90,.75)");
   g.addColorStop(0.32, "rgba(230,50,130,.24)"); g.addColorStop(0.62, "rgba(120,50,220,.07)"); g.addColorStop(1, "rgba(0,0,0,0)");
   x.fillStyle=g; x.fillRect(0,0,128,128);
   var t=guardar(new T.CanvasTexture(c)); t.colorSpace=T.SRGBColorSpace;
   var s=new T.Sprite(guardar(new T.SpriteMaterial({ map:t,blending:T.AdditiveBlending,depthWrite:false,depthTest:true,transparent:true })));
   s.frustumCulled=false; scene.add(s); return s;
  })();
  // ── partículas: un único sistema instanciado de cuadritos
  var quad=guardar(new T.PlaneGeometry(1,1));
  function sistema(n,rellenar,opciones) {
   var g=new T.InstancedBufferGeometry();
   g.index=quad.index; g.setAttribute("position", quad.getAttribute("position")); g.setAttribute("uv", quad.getAttribute("uv"));
   var A=new Float32Array(n*3),B=new Float32Array(n*3),C=new Float32Array(n*4);
   for (var i=0; i<n; i++) rellenar(i,A,B,C);
   g.setAttribute("aA", new T.InstancedBufferAttribute(A,3));
   g.setAttribute("aB", new T.InstancedBufferAttribute(B,3));
   g.setAttribute("aC", new T.InstancedBufferAttribute(C,4));
   g.instanceCount=n; guardar(g);
   var uni={ uT:uT,uS:{ value:soplo }, uCam:{ value:new T.Vector3() }, uK:{ value:1 }, uVel:{ value:0 } };
   var mat=guardar(new T.ShaderMaterial({
    transparent:true,depthWrite:false,blending:opciones.aditivo ? T.AdditiveBlending : T.NormalBlending,
    premultipliedAlpha:!opciones.aditivo,uniforms:uni,
    vertexShader:[
     `attribute vec3 aA,aB;attribute vec4 aC;uniform float uT,uK,uVel;uniform vec3 uCam;varying vec2 vU;varying float vF;varying vec3 vCol;`,
     opciones.vs,
    ].join("\n"),
    fragmentShader:"uniform sampler2D uS;varying vec2 vU;varying float vF;varying vec3 vCol;" + opciones.fs,
   }));
   var m=new T.Mesh(g,mat); m.frustumCulled=false; m.renderOrder=opciones.orden || 1;
   m.userData.n=n; m.userData.uni=uni;
   scene.add(m);
   return m;
  }
  var FS_SOPLO="void main(){float a=texture2D(uS,vU).a;if(a<.004)discard;a*=vF;gl_FragColor=vec4(vCol*a,a);}";
  var FS_PUNTO="void main(){vec2 p=vU*2.-1.;float a=1.-dot(p,p);if(a<=0.)discard;gl_FragColor=vec4(vCol*a*a*vF,1.);}";
  var nubes=sistema(190,function (i,A,B,C) {
   var a=az()*6.283,r=18+Math.pow(az(),0.7)*620;
   var u=az(),capa=u<0.5 ? 280+az()*70 : u<0.82 ? 480+az()*90 : 650+az()*120;
   A[i*3]=Math.cos(a)*r; A[i*3+1]=capa; A[i*3+2]=Math.sin(a)*r;
   C[i*4]=70+az()*130; C[i*4+1]=az(); C[i*4+2]=az()*6.283; C[i*4+3]=az();
  }, { orden:2,fs:FS_SOPLO,vs:[
   SOL,
   `void main(){vU=uv;vec4 mv=viewMatrix*vec4(aA,1.);
 float dc=length(aA-uCam);float co=cos(aC.z),si=sin(aC.z);vec2 q=mat2(co,si,-si,co)*position.xy*vec2(1.,.62);
 mv.xy+=q*aC.x;
 vF=uK*(.5+aC.y*.3)*smoothstep(10.,120.,dc)*(1.-smoothstep(1100.,1900.,dc));
 vec3 d=normalize(aA-uCam);float s=pow(max(dot(d,SOL),0.)*.5+.5,2.5);
 vCol=mix(vec3(.13,.07,.2),vec3(1.05,.42,.3),s)*(.68+aC.w*.5);
 gl_Position=projectionMatrix*mv;}`,
  ].join("\n") });
  var polvo=sistema(760,function (i,A,B,C) {
   var a=az()*6.283,an=az(),r=0.6+an*5;
   A[i*3]=Math.cos(a)*r; A[i*3+1]=0.2+az()*0.8; A[i*3+2]=Math.sin(a)*r;
   var V=34+az()*az()*130,U=2+Math.pow(az(),2.6)*46;
   B[i*3]=Math.cos(a)*V; B[i*3+1]=U; B[i*3+2]=Math.sin(a)*V;
   C[i*4]=T_IMPACTO+az()*0.1; C[i*4+1]=1.1+az()*1.7; C[i*4+2]=5+az()*9; C[i*4+3]=az();
  }, { orden:3,fs:FS_SOPLO,vs:[
   `void main(){vU=uv;float t=uT-aC.x;if(t<0.){gl_Position=vec4(2.,2.,2.,1.);return;}
 float fr=(1.-exp(-t*2.5))/2.5;vec3 p=aA+aB*fr;p.y+=-.55*t*t*.16;p.y=max(p.y,.15);
 vec4 mv=viewMatrix*vec4(p,1.);float s=aC.z*(.5+1.7*(1.-exp(-t*1.1)));
 float co=cos(aC.w*6.283+t*.3),si=sin(aC.w*6.283+t*.3);mv.xy+=mat2(co,si,-si,co)*position.xy*s;
 float d=-mv.z;float v=t/aC.y;
 vF=uK*(.1+.17*aC.w)*smoothstep(0.,.08,t)*(1.-smoothstep(.3,1.,v))*smoothstep(4.,18.,d);
 float cal=exp(-t*3.2)*exp(-length(p.xz)/20.);
 vCol=mix(vec3(.1,.07,.075),vec3(.26,.14,.2),aC.w*.5)+vec3(2.2,.7,.16)*cal;
 gl_Position=projectionMatrix*mv;}`,
  ].join("\n") });
  var chispas=sistema(520,function (i,A,B,C) {
   var a=az()*6.283,sube=0.15+az()*0.95,V=14+az()*az()*105;
   A[i*3]=Math.cos(a)*az()*2.4; A[i*3+1]=0.4+az(); A[i*3+2]=Math.sin(a)*az()*2.4;
   B[i*3]=Math.cos(a)*V*(1.15-sube*0.6); B[i*3+1]=V*sube*0.85; B[i*3+2]=Math.sin(a)*V*(1.15-sube*0.6);
   C[i*4]=T_IMPACTO+az()*0.1; C[i*4+1]=0.5+az()*az()*1.5; C[i*4+2]=0.05+az()*0.09; C[i*4+3]=az();
  }, { aditivo:true,orden:4,fs:FS_PUNTO,vs:[
   `void main(){vU=uv;float t=uT-aC.x;float v=t/aC.y;if(t<0.||v>1.){gl_Position=vec4(2.,2.,2.,1.);return;}
 vec3 g=vec3(0.,-46.,0.);float fr=(1.-exp(-t*1.1))/1.1;vec3 p=aA+aB*fr+.5*g*t*t;vec3 vel=aB*exp(-t*1.1)+g*t;
 if(p.y<.12){p.y=.12;vel.y=abs(vel.y)*.2;}
 vec4 a=viewMatrix*vec4(p,1.);vec4 b=viewMatrix*vec4(p+vel*.016,1.);vec2 dir=b.xy-a.xy;float L=max(length(dir),aC.z);dir/=max(L,1e-4);
 float ww=aC.z*max(-a.z,6.)*.055;
 a.xy+=dir*position.y*L*1.8+vec2(-dir.y,dir.x)*position.x*ww;
 vF=uK*(1.-v*v);vCol=mix(vec3(9.,5.2,1.8),vec3(7.,1.3,.5),smoothstep(.1,.7,v));
 gl_Position=projectionMatrix*a;}`,
  ].join("\n") });
  var pavesas=sistema(240,function (i,A,B,C) {
   var a=az()*6.283,r=0.8+Math.pow(az(),1.3)*22;
   A[i*3]=Math.cos(a)*r; A[i*3+1]=az(); A[i*3+2]=Math.sin(a)*r;
   B[i*3]=az()*6.283; B[i*3+1]=0.5+az()*1.3; B[i*3+2]=0.3+az()*0.7;
   C[i*4]=2.4+az()*0.9; C[i*4+1]=0; C[i*4+2]=0.03+az()*0.05; C[i*4+3]=az();
  }, { aditivo:true,orden:5,fs:FS_PUNTO,vs:[
   `void main(){vU=uv;float t=uT-aC.x;if(t<0.){gl_Position=vec4(2.,2.,2.,1.);return;}
 float H=9.+aA.y*7.;float y=mod(aC.w*H+t*aB.y,H);vec3 p=vec3(aA.x+sin(t*aB.z+aB.x)*.7,y+.2,aA.z+cos(t*aB.z*.8+aB.x)*.7);
 vec4 mv=viewMatrix*vec4(p,1.);mv.xy+=position.xy*aC.z*max(-mv.z,4.)*.1;
 float b=sin(y/H*3.1416);vF=uK*b*smoothstep(0.,.5,t)*(.6+.4*sin(t*7.+aC.w*40.));
 vCol=mix(vec3(5.,2.5,.7),vec3(4.,.6,1.3),aC.w);gl_Position=projectionMatrix*mv;}`,
  ].join("\n") });
  var lineas=sistema(110,function (i,A,B,C) {
   var a=az()*6.283,r=7+az()*50;
   A[i*3]=Math.cos(a)*r; A[i*3+1]=az()*900; A[i*3+2]=Math.sin(a)*r;
   C[i*4]=8+az()*26; C[i*4+1]=0.02+az()*0.05; C[i*4+2]=az(); C[i*4+3]=az();
  }, { aditivo:true,orden:6,fs:"void main(){vec2 p=vU*2.-1.;float a=(1.-p.x*p.x)*(1.-abs(p.y));gl_FragColor=vec4(vCol*a*vF,1.);}", vs:[
   `void main(){vU=uv;vec3 p=vec3(uCam.x+aA.x,0.,uCam.z+aA.z);
 float H=900.;p.y=uCam.y+mod(aA.y+aC.w*H-uCam.y*1.35,H)-H*.5;
 vec4 a=viewMatrix*vec4(p,1.);vec4 b=viewMatrix*vec4(p+vec3(0.,1.,0.),1.);vec2 d=normalize(b.xy-a.xy+1e-4);
 float L=aC.x*(.3+uVel*2.6);a.xy+=d*position.y*L+vec2(-d.y,d.x)*position.x*aC.y*max(-a.z,3.)*.06;
 vF=uK*(.3+.7*aC.z);vCol=mix(vec3(1.,.85,.7),vec3(.9,.4,.8),aC.w)*1.6;gl_Position=projectionMatrix*a;}`,
  ].join("\n") });
  // ── escombros y losas levantadas
  var piedraMat=guardar(new T.MeshStandardMaterial({ color:0xffffff,roughness:0.84,metalness:0.02,flatShading:true,envMapIntensity:0.2 }));
  piedraMat.onBeforeCompile=function (s) {
   s.uniforms.uBrasa=uS.uBrasa;
   s.vertexShader=s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vYw;varying float vR;")
    .replace("#include <project_vertex>", "#include <project_vertex>\n{vec4 w=modelMatrix*instanceMatrix*vec4(transformed,1.);vYw=w.y;vR=length(w.xz);}");
   s.fragmentShader=s.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uBrasa;varying float vYw;varying float vR;")
    .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.3,.08)*uBrasa*.5*(1.-smoothstep(-.4,1.1,vYw))*exp(-vR/12.);");
  };
  var dColor=new T.Color();
  var NCH=200,NLO=34;
  var geoCh=guardar(new T.IcosahedronGeometry(1,0));
  var trozos=new T.InstancedMesh(geoCh,piedraMat,NCH);
  trozos.frustumCulled=false; scene.add(trozos);
  var geoLo=(function () {     // una laja irregular:caja con las esquinas vencidas
   var g=new T.BoxGeometry(1,0.34,1,2,1,2).toNonIndexed();
   var p=g.getAttribute("position"),azl=azar(611),mapa={};
   for (var i=0; i<p.count; i++) {
    var k=[p.getX(i).toFixed(2),p.getY(i).toFixed(2),p.getZ(i).toFixed(2)].join("|");
    if (!mapa[k]) mapa[k]=[(azl()-0.5)*0.3,(azl()-0.5)*0.14,(azl()-0.5)*0.3];
    p.setXYZ(i,p.getX(i)+mapa[k][0],p.getY(i)+mapa[k][1],p.getZ(i)+mapa[k][2]);
   }
   g.computeVertexNormals();
   return guardar(g);
  })();
  var losas=new T.InstancedMesh(geoLo,piedraMat,NLO);
  losas.frustumCulled=false; scene.add(losas);
  var datosCh=[],datosLo=[];
  for (var ci=0; ci<NCH; ci++) {
   var ca=az()*6.283,cs=0.3+az()*0.95,cV=7+az()*az()*44;
   if (Math.cos(ca)*heroDir.x+Math.sin(ca)*heroDir.z>0.55) ca += 2.4;
   var cg=34;
   datosCh.push({
    x:Math.cos(ca)*az()*3,z:Math.sin(ca)*az()*3,y:0.5,
    vx:Math.cos(ca)*cV*(1.15-cs*0.5),vz:Math.sin(ca)*cV*(1.15-cs*0.5),vy:cV*cs,
    g:cg,r:0.06+Math.pow(az(),3)*0.42,t0:T_IMPACTO+az()*0.06,
    ex:az()-0.5,ey:az()-0.5,ez:az()-0.5,sp:3+az()*14,
   });
   dColor.setHSL(0.03+az()*0.04,0.12,0.05+az()*0.1);
   trozos.setColorAt(ci,dColor);
  }
  for (var li=0; li<NLO; li++) {
   var la=li/NLO*6.283*2.6+az()*0.7,lr=li<11 ? 2.6+az()*2.2 : 5+az()*az()*15;
   var dx=Math.cos(la),dz=Math.sin(la);
   if (dx*heroDir.x+dz*heroDir.z>0.2) { dx=-dx; dz=-dz; }
   var tam=(li<11 ? 1.5 : 1)+az()*(li<11 ? 0.9 : 1.7);
   datosLo.push({
    x:dx*lr,z:dz*lr,y:li<11 ? -0.5 : 0.25+az()*0.4,
    sx:tam*(0.8+az()*0.6),sy:0.7+az()*0.9,sz:tam*(0.7+az()*0.5),
    rot:new T.Euler((az()-0.5)*0.8+(dz*0.95),az()*6.28,(az()-0.5)*0.8-(dx*0.95), "XYZ"),
    retraso:az()*0.04+lr*0.006,
   });
   dColor.setHSL(0.03+az()*0.05,0.1,0.045+az()*0.07);
   losas.setColorAt(li,dColor);
  }
  // ── postproceso: HDR, bloom barato en dos escalas, desenfoque radial
  var camFS=new T.OrthographicCamera(-1,1,1,-1,0,1);
  var geoFS=guardar(new T.BufferGeometry());
  geoFS.setAttribute("position", new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  geoFS.setAttribute("uv", new T.Float32BufferAttribute([0,0,2,0,0,2],2));
  var sceneFS=new T.Scene(),mFS=new T.Mesh(geoFS);
  mFS.frustumCulled=false; sceneFS.add(mFS);
  var matBrillo=guardar(new T.ShaderMaterial({
   depthTest:false,depthWrite:false,uniforms:{ t:{ value:null }, e:{ value:new T.Vector2() } }, vertexShader:G_PANTALLA,
   fragmentShader:"varying vec2 vU;uniform sampler2D t;uniform vec2 e;vec3 f(vec2 u){vec3 c=min(texture2D(t,u).rgb,vec3(14.));float l=max(c.r,max(c.g,c.b));return c*smoothstep(.95,1.9,l);}" +
    `void main(){gl_FragColor=vec4((f(vU+e*vec2(-1.,-1.))+f(vU+e*vec2(1.,-1.))+f(vU+e*vec2(-1.,1.))+f(vU+e*vec2(1.,1.)))*.25,1.);}`,
  }));
  var matBlur=guardar(new T.ShaderMaterial({
   depthTest:false,depthWrite:false,uniforms:{ t:{ value:null }, d:{ value:new T.Vector2() } }, vertexShader:G_PANTALLA,
   fragmentShader:"varying vec2 vU;uniform sampler2D t;uniform vec2 d;void main(){vec3 c=texture2D(t,vU).rgb*.227;" +
    `c+=(texture2D(t,vU+d*1.385).rgb+texture2D(t,vU-d*1.385).rgb)*.316;c+=(texture2D(t,vU+d*3.231).rgb+texture2D(t,vU-d*3.231).rgb)*.07;gl_FragColor=vec4(c,1.);}`,
  }));
  var uFin={
   tE:{ value:null }, tB1:{ value:null }, tB2:{ value:null }, uRad:{ value:0 },  uFlash:{ value:0 },
   uBloom:{ value:0.75 }, uExpo:{ value:1 }, uGr:{ value:0 },
  };
  var hazFin=function (pasos) {
   return guardar(new T.ShaderMaterial({
    depthTest:false,depthWrite:false,uniforms:uFin,vertexShader:G_PANTALLA,
    defines:{ PASOS:pasos },
    fragmentShader:[
     `varying vec2 vU;uniform sampler2D tE,tB1,tB2;uniform float uRad,uFlash,uBloom,uExpo,uGr;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 c=vU-.5;vec3 col;
#if PASOS>0
 if(uRad>.0015){col=vec3(0.);float g=fract(52.98*fract(dot(gl_FragCoord.xy,vec2(.0671,.00584))));for(int i=0;i<PASOS;i++){col+=texture2D(tE,vU-c*uRad*(float(i)+g)/float(PASOS)).rgb;}col/=float(PASOS);}else{col=texture2D(tE,vU).rgb;}
#else
 col=texture2D(tE,vU).rgb;
#endif
 col+=(texture2D(tB1,vU).rgb*.65+texture2D(tB2,vU).rgb*.85)*uBloom;
 col+=vec3(1.,.82,.58)*uFlash*5.;
 float vg=dot(vU-.5,vU-.5);col*=1.-smoothstep(.1,.72,vg)*.62;
 col=aces(col*uExpo*.72);col=pow(col,vec3(1./2.2));
 col+=(fract(sin(dot(gl_FragCoord.xy+uGr,vec2(12.9898,78.233)))*43758.5453)-.5)*.022;
 gl_FragColor=vec4(col,1.);}`,
    ].join("\n"),
   }));
  };
  var matsFin={};
  var finDe=function (n) { return matsFin[n] || (matsFin[n]=hazFin(n)); };
  var rt=null,rtA=null,rtB=null,rtC=null,rtD=null,anchoCss=1,altoCss=1,nivelRT=-1;
  function medirRT() {
   var e=lienzoGL.parentElement || lienzoGL;
   anchoCss=Math.max(1,e.clientWidth || window.innerWidth); altoCss=Math.max(1,e.clientHeight || window.innerHeight);
   var N=NIVELES[nivel],dpr=Math.min(N.dpr,window.devicePixelRatio || 1);
   renderer.setPixelRatio(dpr);
   renderer.setSize(anchoCss,altoCss,false);
   var w=Math.max(2,Math.round(anchoCss*dpr)),h=Math.max(2,Math.round(altoCss*dpr));
   [rt,rtA,rtB,rtC,rtD].forEach(function (r) { if (r) r.dispose(); });
   var opts={ type:TIPO,depthBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter };
   rt=new T.WebGLRenderTarget(w,h, { type:TIPO,depthBuffer:true,samples:N.muestras,minFilter:T.LinearFilter,magFilter:T.LinearFilter });
   var w4=Math.max(2,w >> 2),h4=Math.max(2,h >> 2);
   rtA=new T.WebGLRenderTarget(w4,h4,opts); rtB=new T.WebGLRenderTarget(w4,h4,opts);
   rtC=new T.WebGLRenderTarget(Math.max(2,w >> 3),Math.max(2,h >> 3),opts); rtD=new T.WebGLRenderTarget(Math.max(2,w >> 3),Math.max(2,h >> 3),opts);
   camera.aspect=anchoCss/altoCss;
   nivelRT=nivel;
   var P=NIVELES[nivel].part;
   [nubes,polvo,chispas,pavesas,lineas].forEach(function (x) {
    x.geometry.instanceCount=Math.max(8,Math.floor(x.userData.n*P));
   });
   trozos.count=Math.floor(NCH*Math.max(0.4,P));
  }
  medirRT();
  function pase(mat,destino) {
   mFS.material=mat;
   renderer.setRenderTarget(destino);
   renderer.render(sceneFS,camFS);
  }
  // ── la cámara
  // Relativa al logo: [t, distancia, elevación°, azimut°, fov, alabeo°]. Dos ondas:
  // el logo pasa rozando la cámara (0,95 s), se aleja (1,35 s), la cámara se tira
  // tras él (1,82 s) y lo pierde contra el suelo. El fov respira a contrapié (dolly-zoom).
  var HA=Math.atan2(heroDir.x,heroDir.z)*180/Math.PI;
  var camRel=curva([
   [0.00,440,-17,HA-196,22,0],
   [0.40,300,-21,HA-186,25,2],
   [0.72,80,-26,HA-165,38,-6],
   [0.98,7.5,-8,HA-120,74,-16],
   [1.20,22,28,HA-90,54,8],
   [1.42,44,52,HA-60,36,16],
   [1.66,22,62,HA-34,52,6],
   [1.84,8.5,66,HA-22,80,-14],
   [2.10,60,72,HA-10,58,-6],
  ]);
  var camAbs=curva([
   [1.84,-3,345,4,80,-14],
   [2.04,-6,196,9,66,-8],
   [2.20,-9,118,14,56,-2],
   [2.50,-4,54,40,50,3],
   [2.95,8,15,34,50,2],
   [3.40,10.6,6.6,16.5,50,0.6],
   [3.80,11.2,5.6,13.5,48,0],
   [9.00,12.2,5.8,12.9,46,0],
  ]);
  var tg=new T.Vector3(),rel=[0,0,0,0,0],ab=[0,0,0,0,0];
  var vA=new T.Vector3(),vB=new T.Vector3();
  var qTmp=new T.Quaternion(),qGiro=new T.Quaternion(),qCara=new T.Quaternion();
  var eje1=new T.Vector3(0.74,0.3,0.6).normalize(),Z=new T.Vector3(0,0,1);
  var mTmp=new T.Matrix4(),obj=new T.Object3D();
  var lookM=new T.Matrix4(),ARRIBA=new T.Vector3(0,1,0);
  function logoY(t) { var u=sat(t/T_IMPACTO); return mezcla(ALTURA,POSE_Y,u*u*u); }
  function colocarCamara(t) {
   var y=logoY(t),w=suave(tramo(t,1.84,2.02)),fov,roll;
   var ajuste=Math.min(1,0.72+0.28*(0.46/Math.max(0.3,camera.aspect)));
   if (t<2.1) {
    camRel(t,rel);
    var d=rel[0],el=rel[1]*Math.PI/180,azm=rel[2]*Math.PI/180;
    vA.set(Math.sin(azm)*Math.cos(el)*d,Math.sin(el)*d+y,Math.cos(azm)*Math.cos(el)*d);
    fov=rel[3]; roll=rel[4];
   }
   if (t >= 1.84) {
    camAbs(t,ab);
    vB.set(ab[0]*ajuste,ab[1],ab[2]*ajuste);
    if (t<2.1) { camera.position.lerpVectors(vA,vB,w); fov=mezcla(fov,ab[3],w); roll=mezcla(roll,ab[4],w); }
    else { camera.position.copy(vB); fov=ab[3]; roll=ab[4]; }
   } else camera.position.copy(vA);
   var mira=suave(tramo(t,2.45,3.5));
   tg.set(0,y,0);
   if (t>2.2) tg.y=mezcla(POSE_Y,-0.55,mira);
   // Sacudida del impacto: suma de senos que muere. Determinista.
   var dt=t-T_IMPACTO;
   if (dt>0 && dt<1.1 && !op.corta) {
    var f=Math.exp(-dt*5.2)*(dt<0.03 ? dt/0.03 : 1);
    var A=Math.min(9,1.2+camera.position.y*0.05);
    camera.position.x += Math.sin(dt*73)*f*A*0.7;
    camera.position.y += Math.sin(dt*91+1.3)*f*A;
    camera.position.z += Math.sin(dt*61+2.1)*f*A*0.6;
    roll += Math.sin(dt*47)*f*7;
    fov += f*14;
   }
   camera.fov=fov;
   camera.near=camera.position.y>60 ? 2 : 0.2;
   camera.far=40000;
   lookM.lookAt(camera.position,tg,ARRIBA);
   camera.quaternion.setFromRotationMatrix(lookM);
   camera.rotateZ(roll*Math.PI/180);
   camera.updateProjectionMatrix();
   camera.updateMatrixWorld();
  }
  function colocarLogo(t) {
   var y=logoY(t);
   logo.position.set(0,y,0);
   if (t >= T_IMPACTO) { logo.quaternion.copy(qHero); return; }
   // Rodando en el aire. Cerca de la cámara se le pone de cara para que se lea, y en
   // los últimos instantes llega a su pose, que es la de clavado.
   var u=t/T_IMPACTO,resto=(1-u*u)*15.5;
   qGiro.setFromAxisAngle(eje1,resto);
   lookM.lookAt(camera.position,logo.position,ARRIBA);
   qCara.setFromRotationMatrix(lookM).multiply(qTmp.setFromAxisAngle(ARRIBA,Math.PI));
   qCara.multiply(qTmp.setFromAxisAngle(Z,resto*0.6)).multiply(qTmp.setFromAxisAngle(ARRIBA,Math.sin(t*5)*0.36));
   var w=Math.max(campana(t,0.72,0.98,1.24),campana(t,1.5,1.84,2.08))*0.95;
   logo.quaternion.copy(qHero).multiply(qGiro).slerp(qCara,w);
   var w2=suave(tramo(t,2.02,T_IMPACTO));
   logo.quaternion.slerp(qHero,w2);
  }
  function colocarEscombros(t) {
   var hay=t >= T_IMPACTO;
   trozos.visible=losas.visible=hay;
   if (!hay) return;
   for (var i=0; i<trozos.count; i++) {
    var d=datosCh[i],tt=Math.max(0,t-d.t0);
    var disc=d.vy*d.vy+2*d.g*(d.y-0.1),tl=(d.vy+Math.sqrt(Math.max(0,disc)))/d.g;
    var tf=Math.min(tt,tl);
    obj.position.set(d.x+d.vx*tf,d.y+d.vy*tf-0.5*d.g*tf*tf,d.z+d.vz*tf);
    var ang=d.sp*tf;
    obj.rotation.set(d.ex*ang,d.ey*ang,d.ez*ang);
    obj.scale.setScalar(d.r*sat(tt*30));
    obj.updateMatrix();
    trozos.setMatrixAt(i,obj.matrix);
   }
   trozos.instanceMatrix.needsUpdate=true;
   for (var j=0; j<NLO; j++) {
    var L=datosLo[j],k=muelle(tramo(t-T_IMPACTO-L.retraso,0,0.52));
    obj.position.set(L.x,mezcla(-1.2,L.y,k),L.z);
    obj.rotation.set(L.rot.x*k,L.rot.y,L.rot.z*k);
    obj.scale.set(L.sx,L.sy,L.sz);
    obj.updateMatrix();
    losas.setMatrixAt(j,obj.matrix);
   }
   losas.instanceMatrix.needsUpdate=true;
  }
  function muelle(u) {     // sale disparado,se pasa y se asienta
   if (u <= 0) return 0;
   return 1+Math.exp(-u*6.5)*Math.cos(u*11)*-1;
  }
  function colocarEstela(t) {
   var enAire=t<T_IMPACTO;
   estela.visible=enAire && t>0.35;
   var vel=(3*ALTURA/T_IMPACTO)*Math.pow(sat(t/T_IMPACTO),2);      // u/s
   lineas.visible=enAire && t>0.45;
   lineas.userData.uni.uVel.value=vel/900;
   if (enAire) {
    var k=suave(tramo(t,0.35,1.0));
    estela.position.copy(logo.position);
    var L=8+vel*0.14,A=LADO*(0.46+0.08*k);
    estela.scale.set(A,L,A);
    vA.copy(camera.position).sub(logo.position).normalize();
    uEst.uK.value=k*(0.55+0.75*sat(vel/700))*(1-0.72*Math.pow(Math.max(0,vA.y),2));
   }
   var dist=camera.position.distanceTo(logo.position);
   var ang=2*dist*Math.tan(camera.fov*Math.PI/360);
   var vis=enAire ? 1 : Math.exp(-(t-T_IMPACTO)*11);
   var maxA=0.24*ang;
   var desea=enAire ? mezcla(ang*0.2,LADO*3.6,sat(1-dist/90)) : LADO*9;
   var s=Math.min(desea,maxA);
   if (!enAire) s=Math.min(LADO*26,0.7*ang);
   halo.position.copy(logo.position);
   halo.scale.setScalar(s);
   halo.material.opacity=vis*(enAire ? 0.8+0.2*Math.sin(t*38) : 1);
   halo.visible=vis>0.01;
  }
  // ── un cuadro: la función de t
  function pintar(t) {
   if (op.corta) t=Math.max(t,T_BOTON);
   renderer.info.reset();
   uT.value=t;
   var dt=t-T_IMPACTO;
   colocarCamara(t);
   colocarLogo(t);
   colocarEscombros(t);
   colocarEstela(t);
   cieloM.position.copy(camera.position);
   uS.uRompe.value=dt <= 0 ? 0 : sat(muelle(tramo(dt,0,0.42)));
   uS.uRevela.value=dt <= 0 ? 0 : mezcla(2,RC+12,salida3(tramo(dt,0,0.5)));
   uS.uAbre.value=dt <= 0 ? 0 : mezcla(0.1,1,salida3(tramo(dt,0,1.3)));
   var respira=1+0.1*Math.sin(t*2.3)+0.05*Math.sin(t*5.7+1);
   uS.uBrasa.value=dt <= 0 ? 0 : mezcla(1,15*Math.exp(-dt*2.6),1)+3.1*respira*sat(dt*3);
   uS.uOnda.value=dt <= 0 ? -100 : 3+165*(1-Math.exp(-dt*2.4));
   uS.uOndaF.value=dt <= 0 ? 0 : 5*Math.exp(-dt*3.8);
   uCalor.value=t<T_IMPACTO ? suave(tramo(t,0.9,2.2))*0.5 : 0.75*Math.exp(-dt*2.7);
   var foco=suave(tramo(t,2.5,3.5));
   uBorde.value=foco;
   relleno.position.copy(camera.position).setY(camera.position.y+6);
   relleno.intensity=mezcla(0.3,1.1,foco);
   uLuzLogo.value=mezcla(0.42,0.72,foco);
   glifoMat.emissiveIntensity=mezcla(0.52,0.5,foco);
   brasa.intensity=dt <= 0 ? 0 : 700*Math.exp(-dt*3.6)+34*respira;
   hemi.intensity=mezcla(0.7,0.16,foco);
   polvo.visible=chispas.visible=dt>0;
   pavesas.visible=dt>0.15;
   var camY=camera.position.y;
   nubes.visible=camY>150;
   [nubes,polvo,chispas,pavesas,lineas].forEach(function (m) { m.userData.uni.uCam.value.copy(camera.position); });
   lineas.userData.uni.uK.value=suave(tramo(t,0.45,0.9))*(1-suave(tramo(t,2.0,2.2)));
   var velo=t<T_IMPACTO ? Math.pow(sat(t/T_IMPACTO),2) : 0;
   var pasa=Math.max(campana(t,0.82,0.98,1.14)*0.6,campana(t,1.7,1.84,2.0)*0.8);
   var rad=op.corta || !NIVELES[nivel].radial ? 0 : Math.max(0.03*velo+pasa*0.07,dt>0 ? 0.13*Math.exp(-dt*8) : 0);
   uFin.uRad.value=rad;
   uFin.uFlash.value=op.corta ? 0 : (dt <= 0 ? 0 : (dt<0.02 ? dt/0.02 : Math.exp(-(dt-0.02)*34)));
   uFin.uBloom.value=mezcla(0.85,0.55,foco);
   uFin.uExpo.value=mezcla(1.08,1.12,foco);
   uFin.uGr.value=t*60 % 97;
   var N=NIVELES[nivel];
   renderer.setRenderTarget(rt);
   renderer.render(scene,camera);
   matBrillo.uniforms.t.value=rt.texture; matBrillo.uniforms.e.value.set(1/rt.width,1/rt.height);
   pase(matBrillo,rtA);
   matBlur.uniforms.t.value=rtA.texture; matBlur.uniforms.d.value.set(1/rtA.width,0); pase(matBlur,rtB);
   matBlur.uniforms.t.value=rtB.texture; matBlur.uniforms.d.value.set(0,1/rtA.height); pase(matBlur,rtA);
   if (N.bloom2) {
    matBlur.uniforms.t.value=rtA.texture; matBlur.uniforms.d.value.set(1.4/rtC.width,0); pase(matBlur,rtC);
    matBlur.uniforms.t.value=rtC.texture; matBlur.uniforms.d.value.set(0,1.4/rtC.height); pase(matBlur,rtD);
    uFin.tB2.value=rtD.texture;
   } else uFin.tB2.value=rtA.texture;
   uFin.tE.value=rt.texture; uFin.tB1.value=rtA.texture;
   pase(finDe(N.radial),null);
  }
  // ── el bucle, y la degradación por fps
  var estado={ saltar:1,raf:0,t0:0,corriendo:false,destruido:false,ventana:0,cuadros:0,ultimo:0,fps:[] };
  function bucle(ahora) {
   if (estado.destruido || !estado.corriendo) return;
   estado.raf=requestAnimationFrame(bucle);
   var t=(ahora-estado.t0)/1000;
   if (estado.ultimo) {
    estado.ventana += ahora-estado.ultimo; estado.cuadros++;
    if (estado.ventana >= 320) {
     var fps=estado.cuadros*1000/estado.ventana;
     estado.fps.push(Math.round(fps));
     if (estado.saltar>0) estado.saltar--;
     else if (fps<42 && nivel<3) { nivel++; medirRT(); estado.saltar=1; }
     estado.ventana=0; estado.cuadros=0;
    }
   }
   estado.ultimo=ahora;
   try { pintar(t); } catch (e) { if (op.alFallar) op.alFallar(e); }
  }
  var alRedim=function () { medirRT(); if (!estado.corriendo && estado.tFijo != null) pintar(estado.tFijo); };
  window.addEventListener("resize", alRedim);
  return {
   calentar:function () {
    [trozos,losas,estela,polvo,chispas,pavesas,nubes,lineas,halo].forEach(function (o) { o.visible=true; });
    renderer.compile(scene,camera);
    pintar(T_IMPACTO+0.05); pintar(0);
   },
   arrancar:function (ahora) {
    estado.corriendo=true; estado.t0=ahora == null ? performance.now() : ahora;
    estado.raf=requestAnimationFrame(bucle);
   },
   irA:function (t) { estado.corriendo=false; cancelAnimationFrame(estado.raf); estado.tFijo=t; pintar(t); },
   pintar:pintar,
   info:function () {
    return {
     nivel:nivel,fps:estado.fps.slice(),hdr:hdr,llamadas:renderer.info.render.calls,
     triangulos:renderer.info.render.triangles,
     particulas:[nubes,polvo,chispas,pavesas,lineas].reduce(function (a,m) { return a+m.geometry.instanceCount; }, 0),
    };
   },
   destruir:function () {
    estado.destruido=true; estado.corriendo=false;
    cancelAnimationFrame(estado.raf);
    window.removeEventListener("resize", alRedim);
    desechables.forEach(function (x) { if (x && x.dispose) x.dispose(); });
    [rt,rtA,rtB,rtC,rtD].forEach(function (r) { if (r) r.dispose(); });
    for (var k in matsFin) matsFin[k].dispose();
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
   },
  };
 }
 // ── la página: botón, «Saltar», cuenta atrás
 function css() {
  if (document.getElementById("ic3-estilos")) return;
  var s=document.createElement("style");
  s.id="ic3-estilos";
  s.textContent=[
   `.ic3 *{box-sizing:border-box}.ic3{--tinta:rgb(8,8,16);--oro:rgb(200,168,75);--oro2:rgb(228,212,165);--suave:rgba(228,212,165,.72);
position:fixed;inset:0;z-index:2147483000;background:var(--tinta);color:var(--oro2);overflow:hidden;
font-family:'Instrument Serif','Iowan Old Style','Palatino Linotype',Georgia,'Times New Roman',serif;-webkit-tap-highlight-color:transparent}
.ic3 canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .12s}
.ic3.ic3-viva canvas{opacity:1}
.ic3-saltar{position:absolute;top:calc(14px + env(safe-area-inset-top));right:16px;padding:10px 16px;border-radius:999px;font:400 15px/1 inherit;font-family:inherit;
letter-spacing:.04em;color:var(--oro2);text-decoration:none;background:rgba(8,8,16,.42);border:1px solid rgba(228,212,165,.26);
-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.ic3-saltar:focus-visible{outline:2px solid var(--oro2);outline-offset:3px}
.ic3-pie{position:absolute;left:0;right:0;bottom:0;padding:clamp(120px,24vh,220px) 16px calc(26px + env(safe-area-inset-bottom));
display:flex;flex-direction:column;align-items:center;gap:13px;text-align:center;pointer-events:none;
background:linear-gradient(to top,rgba(8,8,16,.95),rgba(8,8,16,.86) 46%,rgba(8,8,16,.5) 72%,transparent);
opacity:0;transition:opacity .4s ease}
.ic3-fin .ic3-pie{opacity:1}
.ic3-cuenta{margin:0;font-size:clamp(30px,8.6vw,42px);line-height:1;font-style:italic;color:var(--oro2);text-shadow:0 2px 14px rgba(8,8,16,.9);
opacity:0;transform:translateY(12px);transition:opacity .5s ease .05s,transform .6s cubic-bezier(.2,.8,.2,1) .05s}
.ic3-ir{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-height:68px;width:min(340px,100%);padding:11px 30px 13px;
border-radius:999px;font-family:inherit;font-size:31px;line-height:1.05;color:var(--tinta);isolation:isolate;text-decoration:none;overflow:hidden;
background:linear-gradient(135deg,var(--oro2),var(--oro) 58%,rgb(170,136,52));
box-shadow:0 16px 48px rgba(200,168,75,.34),inset 0 1px 0 rgba(255,246,216,.75);
opacity:0;transform:translateY(18px) scale(.97);pointer-events:none;transition:opacity .45s ease .12s,transform .6s cubic-bezier(.2,.8,.2,1) .12s}
.ic3-ir::after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,transparent 35%,rgba(255,250,232,.7) 50%,transparent 65%);transform:translateX(-120%)}
.ic3-fin .ic3-ir{opacity:1;transform:none;pointer-events:auto}
.ic3-fin .ic3-ir::after{animation:ic3-brillo 1.3s .5s ease-out both}
.ic3-fin .ic3-cuenta{opacity:1;transform:none}
.ic3-ir:focus-visible{outline:3px solid var(--oro2);outline-offset:4px}
.ic3-reloj{margin:0;min-height:1.3em;font-size:16px;letter-spacing:.015em;color:var(--suave);
font-variant-numeric:tabular-nums;opacity:0;transition:opacity .4s ease .3s}
.ic3-fin .ic3-reloj{opacity:1}
.ic3-reloj b{font-weight:400;color:var(--oro2);font-style:italic}
.ic3-barra{position:absolute;left:0;bottom:0;height:3px;width:100%;background:rgba(8,8,16,.5);transform-origin:left;transform:scaleX(var(--p,1))}
@keyframes ic3-brillo{to{transform:translateX(120%)}}
@media (prefers-reduced-motion:reduce){.ic3 *{transition-duration:.01s!important;transition-delay:0s!important;animation:none!important}}`,
  ].join("");
  document.head.appendChild(s);
 }
 function fuente() {
  if (document.querySelector("link[data-ic3-fuente]")) return;
  var l=document.createElement("link");
  l.rel="stylesheet"; l.href=FUENTE; l.setAttribute("data-ic3-fuente", "1");
  document.head.appendChild(l);
 }
 function hayWebGL() {
  try {
   var c=document.createElement("canvas");
   var g=c.getContext("webgl2");       // la escena usa WebGL2:three 0.170 ya no da otra
   if (!g) return false;
   var x=g.getExtension("WEBGL_lose_context");
   if (x) x.loseContext();
   return true;
  } catch (e) { return false; }
 }
 function cargarThree() {
  var f=window.__introImportar;
  if (typeof f==="function") return f(THREE_URL);
  return import(THREE_URL);
 }
 function volviendo() {
  try {
   var n=performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
   return !!(n && n.type==="back_forward");
  } catch (e) { return false; }
 }
 function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g,function (c) {
   return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
 }
 function usuarioDe(destino) {
  try {
   var u=new URL(destino,location.href);
   if (!/instagram\.com$/.test(u.hostname.replace(/^www\./, ""))) return "";
   var p=u.pathname.split("/").filter(Boolean)[0];
   return p ? "@" + p : "";
  } catch (e) { return ""; }
 }
 function montar(elemento,op) {
  op=op || {};
  var destino=String(op.destino || "/");
  var marca=String(op.marca || "Shopy Crafter");
  var usuario=op.usuario != null ? String(op.usuario) : usuarioDe(destino);
  var esIG=/instagram\.com/.test(destino);
  var textoBoton=op.boton || (esIG ? "Ir a Instagram" : "Ir a " + marca);
  var corta=!!(window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches);
  var congelado=op.congelar_t != null && isFinite(+op.congelar_t);
  var redirigir=op.redirigir!==false && !volviendo() && !congelado;
  var segundos=+op.segundos>0 ? +op.segundos : 4.5;
  var espera=op.espera_s == null ? 1.5 : Math.max(0, +op.espera_s);
  var tBoton=corta ? 0.25 : T_BOTON;
  var tIrse=Math.max(tBoton+2,corta ? Math.min(segundos,1.4)+espera : segundos+espera);
  var padre=elemento || document.body;
  var hecho=false,tempos=[],escena=null,terminada=false,finalizado=false;
  css(); fuente();
  var raiz=document.createElement("div");
  raiz.className="ic3";
  raiz.setAttribute("role", "dialog");
  raiz.setAttribute("aria-label", marca);
  raiz.innerHTML =
   '<canvas aria-hidden="true"></canvas>' +
   '<a class="ic3-saltar" href="' + esc(destino) + '">Saltar</a>' +
   '<div class="ic3-pie">' +
    (usuario ? '<p class="ic3-cuenta">' + esc(usuario) + "</p>" : "") +
    '<a class="ic3-ir" href="' + esc(destino) + '" tabindex="-1">' + esc(textoBoton) + '<span class="ic3-barra"></span></a>' +
    '<p class="ic3-reloj" aria-live="off"></p>' +
   "</div>";
  padre.appendChild(raiz);
  var lienzoGL=raiz.querySelector("canvas"),boton=raiz.querySelector(".ic3-ir");
  var reloj=raiz.querySelector(".ic3-reloj"),barra=raiz.querySelector(".ic3-barra");
  var luego=function (f,ms) { var t=setTimeout(f,ms); tempos.push(t); return t; };
  function ir() {
   if (hecho) return;
   hecho=true;
   try { window.location.replace(destino); } catch (e) { window.location.href=destino; }
  }
  function terminar() {
   if (terminada) return;
   terminada=true;
   raiz.classList.add("ic3-fin");
   boton.removeAttribute("tabindex");
   if (typeof op.alTerminar==="function") { try { op.alTerminar(); } catch (e) { /* lo de fuera no para esto */ } }
  }
  function cuenta(t) {
   var queda=tIrse-t;
   if (!redirigir && !congelado) { reloj.textContent=""; barra.style.display="none"; return; }
   if (queda>0) {
    var n=Math.ceil(queda);
    var txt = "Te llevamos en <b>" + n + "</b> " + (n === 1 ? "segundo" : "segundos");
    if (reloj.getAttribute("data-n")!==String(n)) { reloj.innerHTML=txt; reloj.setAttribute("data-n", String(n)); }
   }
   barra.style.setProperty("--p", sat(queda/Math.max(0.1,tIrse-tBoton)).toFixed(3));
  }
  if (redirigir) luego(ir,(segundos+espera+6)*1000);
  window.addEventListener("pageshow", function (ev) {
   if (ev.persisted) { redirigir=false; hecho=false; tempos.forEach(clearTimeout); terminar(); cuenta(0); }
  });
  function caer(motivo) {
   raiz.setAttribute("data-motivo", String(motivo || ""));
   if (escena) { try { escena.destruir(); } catch (e) { /* ya está */ } escena=null; }
   finalizado=true;
   if (redirigir) { ir(); return; }
   terminar(); cuenta(0);
  }
  var resolver,rechazar;
  var listo=new Promise(function (a,b) { resolver=a; rechazar=b; });
  listo.catch(function () { /* el fallo ya se ha gestionado:se va al destino */ });
  var tick=0;
  function latido(t0) {            // UI de la cuenta atrás al ritmo de la escena
   if (finalizado || hecho) return;
   var t=(performance.now()-t0)/1000;
   if (t >= tBoton) { terminar(); cuenta(t); }
   if (t >= tIrse && redirigir) { ir(); return; }
   tick=setTimeout(function () { latido(t0); }, 120);
   tempos.push(tick);
  }
  if (!hayWebGL()) {
   caer("sin_webgl");
   rechazar(new Error("sin_webgl"));
  } else {
   var tope=luego(function () { caer("tarda"); rechazar(new Error("tarda")); }, 3500);
   var pThree;
   try { pThree=cargarThree(); } catch (e) { pThree=Promise.reject(e); }
   pThree.then(function (THREE) {
    if (finalizado) return;
    escena=crearEscena(THREE,lienzoGL, {
     corta:corta,preservar:!!op.preservar,nivel:op.nivel,
     alFallar:function (e) { caer("fallo:" + ((e && e.message) || e)); },
    });
    escena.calentar();
    clearTimeout(tope);
    raiz.classList.add("ic3-viva");
    if (congelado) {
     irA(+op.congelar_t);
    } else if (corta) {
     escena.pintar(T_BOTON+0.2);
     var t0c=performance.now();
     latido(t0c);
    } else {
     var t0=performance.now();
     escena.arrancar(t0);
     latido(t0);
    }
    resolver();
   }).catch(function (e) { caer("fallo:" + ((e && e.message) || e)); rechazar(e); });
   lienzoGL.addEventListener("webglcontextlost", function (ev) { ev.preventDefault(); caer("contexto_perdido"); });
  }
  function irA(t) {
   tempos.forEach(clearTimeout);
   redirigir=false; congelado=true;
   if (!escena) return;
   escena.irA(t);
   if (t >= tBoton) { terminar(); cuenta(t); }
   else { terminada=false; raiz.classList.remove("ic3-fin"); boton.setAttribute("tabindex", "-1"); }
  }
  return {
   saltar:ir,
   irA:irA,
   listo:listo,
   info:function () { return Object.assign({ tBoton:tBoton,tIrse:tIrse,corta:corta,motivo:raiz.getAttribute("data-motivo") }, escena ? escena.info() : {}); },
   destruir:function () {
    finalizado=true;
    tempos.forEach(clearTimeout);
    if (escena) { try { escena.destruir(); } catch (e) { /* ya está */ } escena=null; }
    if (raiz.parentNode) raiz.parentNode.removeChild(raiz);
   },
  };
 }
 window.IntroLogo3D={ montar:montar,version:"2026-11-03-caida", THREE_URL:THREE_URL,escena:"caida" };
})();