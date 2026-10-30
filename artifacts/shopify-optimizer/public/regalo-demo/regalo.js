// Regalo envuelto de verdad: caja de cartón con tapa, papel de regalo en piezas (cuatro laterales y cuatro
// solapas de arriba), cinta de raso y lazo. Al desenvolver: el lazo se deshace y sale volando, el papel se
// rasga por las diagonales de arriba y se abre como una flor hasta quedar en el suelo, y la tapa se levanta
// dejando salir la luz.
import * as THREE from "three";

const S = 0.42, H = 0.36, TAPA_H = 0.075;          // caja (m)
const A = S / 2 + 0.012, HP = H + 0.006;            // medio ancho y alto del papel (por fuera de la tapa)
const CINTA = 0.052;

function lienzo(w, h, pinta) { const c = document.createElement("canvas"); c.width = w; c.height = h; pinta(c.getContext("2d"), w, h); return c; }
function texturaPapel() {
  const t = new THREE.CanvasTexture(lienzo(512, 512, (g, w, h) => {
    const fondo = g.createLinearGradient(0, 0, w, h); fondo.addColorStop(0, "#b3173f"); fondo.addColorStop(1, "#9c1036");
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    // rayitas finas en diagonal y lunares dorados
    g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 2;
    for (let i = -h; i < w; i += 14) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); }
    const estrella = (x, y, r) => { g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const cx = x * 64 + (y % 2 ? 32 : 0) + 16, cy = y * 64 + 16;
      g.fillStyle = "#f2cf86"; if ((x + y) % 3 === 0) estrella(cx, cy, 9); else { g.beginPath(); g.arc(cx, cy, 4.5, 0, 7); g.fill(); }
      g.fillStyle = "rgba(255,240,210,0.55)"; g.beginPath(); g.arc(cx + 30, cy + 30, 1.6, 0, 7); g.fill();
    }
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function texturaDorso() {             // cara interior del papel: crema rosado con la trama apenas marcada
  const t = new THREE.CanvasTexture(lienzo(256, 256, (g, w, h) => {
    g.fillStyle = "#efdcd3"; g.fillRect(0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 8; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0);
    g.fillStyle = "rgba(179,23,63,0.07)";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 32 + (y % 2 ? 16 : 0) + 8, y * 32 + 8, 2.5, 0, 7); g.fill(); }
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function texturaCarton(texto) {
  const t = new THREE.CanvasTexture(lienzo(512, 512, (g, w, h) => {
    g.fillStyle = "#c79a64"; g.fillRect(0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 18; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n * 0.8; }
    g.putImageData(d, 0, 0);
    g.strokeStyle = "rgba(90,60,30,0.10)"; for (let y = 0; y < h; y += 6) { g.beginPath(); g.moveTo(0, y + Math.random() * 2); g.lineTo(w, y + Math.random() * 2); g.stroke(); }
    if (texto) {
      g.strokeStyle = "rgba(150,105,40,0.9)"; g.lineWidth = 6; g.strokeRect(46, 46, w - 92, h - 92);
      g.fillStyle = "#8f6322"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "italic 400 120px 'Cormorant Garamond', Georgia, serif"; g.fillText(texto, w / 2, h / 2 + 6);
    }
  }));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Malla deformable: guarda las posiciones planas y las curva alrededor de la bisagra (eje x local, y = distancia).
class Hoja {
  constructor(geo, mats, desfaseZ = 0) {
    this.geo = geo; this.base = geo.attributes.position.array.slice(); this.dz = desfaseZ;
    this.mallas = mats.map((m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; return o; });
    this.curva = -1; this.doblar(0);
  }
  doblar(c) {                     // c: curvatura (1/m); positiva hacia fuera (+z)
    if (Math.abs(c - this.curva) < 1e-4) return; this.curva = c;
    const p = this.geo.attributes.position.array, b = this.base;
    for (let i = 0; i < p.length; i += 3) {
      const y = b[i + 1], z = b[i + 2] + this.dz;
      if (Math.abs(c) < 1e-4) { p[i] = b[i]; p[i + 1] = y; p[i + 2] = z; continue; }
      const r = 1 / c, a = y * c;
      p[i] = b[i]; p[i + 1] = Math.sin(a) * (r - z); p[i + 2] = r - Math.cos(a) * (r - z);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
}
function planoRect(ancho, alto, nx, ny, u0 = 0, v0 = 0, escalaUV = 1) {
  const g = new THREE.PlaneGeometry(ancho, alto, nx, ny); g.translate(0, alto / 2, 0);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + pos.getX(i) * escalaUV, v0 + pos.getY(i) * escalaUV);
  return g;
}
function trianguloSolapa(nx, ny) {    // base en la bisagra (ancho 2A) y punta en el centro de la tapa (a distancia A)
  const g = new THREE.PlaneGeometry(1, 1, nx, ny), pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2, v = pos.getY(i) + 0.5;            // u -1..1, v 0..1
    const x = u * A * (1 - v) * 0.995, y = v * A * 0.995;
    pos.setXYZ(i, x, y, 0); uv.setXY(i, x * 2.4, y * 2.4 + 0.37);
  }
  return g;
}

export function crearRegalo(escena, { movil, brilloTex, posicion, giro = 0.45 }) {
  const grupo = new THREE.Group(); grupo.position.copy(posicion); grupo.rotation.y = giro; escena.add(grupo);
  const Mat = THREE.MeshStandardMaterial;
  const papelTex = texturaPapel();
  const papelFuera = new Mat({ map: papelTex, roughness: 0.42, metalness: 0.05, side: THREE.FrontSide });
  const papelDentro = new Mat({ map: texturaDorso(), roughness: 0.75, side: THREE.BackSide });
  const raso = new Mat({ color: 0xe9c27a, roughness: 0.28, metalness: 0.55, side: THREE.DoubleSide });
  const carton = new Mat({ map: texturaCarton(), roughness: 0.85 });
  const cartonTapa = new Mat({ map: texturaCarton("Para ti"), roughness: 0.8 });
  const interior = new Mat({ color: 0x3a2716, roughness: 1 });

  // ---- caja de cartón (abierta por arriba) y tapa
  const caja = new THREE.Group(); grupo.add(caja);
  const pared = 0.008;
  for (let k = 0; k < 4; k++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(S, H - TAPA_H + 0.02, pared), [carton, carton, carton, carton, carton, interior]);
    const a = k * Math.PI / 2; p.position.set(Math.sin(a) * (S / 2 - pared / 2), (H - TAPA_H + 0.02) / 2, Math.cos(a) * (S / 2 - pared / 2)); p.rotation.y = a;
    p.castShadow = p.receiveShadow = true; caja.add(p);
  }
  const fondo = new THREE.Mesh(new THREE.BoxGeometry(S, 0.01, S), interior); fondo.position.y = 0.005; caja.add(fondo);
  // papel de seda dentro (se ilumina al abrir)
  const seda = new Mat({ color: 0xfff6ea, roughness: 0.9, emissive: 0xffc46b, emissiveIntensity: 0 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.IcosahedronGeometry(0.07, 1), p = g.attributes.position;
    for (let j = 0; j < p.count; j++) { const f = 0.75 + Math.random() * 0.5; p.setXYZ(j, p.getX(j) * f, p.getY(j) * f * 0.8, p.getZ(j) * f); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, seda); const a = i * 0.9;
    m.position.set(Math.cos(a) * 0.05 * (i % 3), H - TAPA_H - 0.06 + Math.random() * 0.03, Math.sin(a) * 0.05 * (i % 3)); m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    caja.add(m);
  }
  const tapa = new THREE.Group(); tapa.position.y = H - TAPA_H; caja.add(tapa);
  {
    const SL = S + 0.014;
    const techo = new THREE.Mesh(new THREE.BoxGeometry(SL, 0.01, SL), [carton, carton, cartonTapa, interior, carton, carton]);
    techo.position.y = TAPA_H - 0.005; techo.castShadow = techo.receiveShadow = true; tapa.add(techo);
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(SL, TAPA_H, 0.007), [carton, carton, carton, carton, carton, interior]);
      const a = k * Math.PI / 2; f.position.set(Math.sin(a) * (SL / 2 - 0.0035), TAPA_H / 2, Math.cos(a) * (SL / 2 - 0.0035)); f.rotation.y = a;
      f.castShadow = true; tapa.add(f);
    }
  }

  // ---- papel: 4 laterales con bisagra abajo y una solapa triangular cada uno arriba
  const laterales = [];
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const piv = new THREE.Group(); piv.position.set(Math.sin(a) * A, 0.002, Math.cos(a) * A); piv.rotation.y = a; grupo.add(piv);
    const lado = new THREE.Group(); piv.add(lado);       // gira alrededor de x (bisagra abajo)
    const hoja = new Hoja(planoRect(2 * A, HP, 8, 10, 0.13 * k, 0, 2.4), [papelFuera, papelDentro]);
    hoja.mallas.forEach((m) => lado.add(m));
    // cinta vertical en los cuatro lados (la cinta cruza la caja en las dos direcciones)
    const cinta = new Hoja(planoRect(CINTA, HP, 1, 10), [raso], 0.0025); cinta.mallas.forEach((m) => lado.add(m));
    const bis = new THREE.Group(); bis.position.y = HP; lado.add(bis);
    const solapaPiv = new THREE.Group(); bis.add(solapaPiv);
    const solapa = new Hoja(trianguloSolapa(10, 8), [papelFuera, papelDentro]); solapa.mallas.forEach((m) => solapaPiv.add(m));
    const cintaS = new Hoja(planoRect(CINTA, A * 0.995, 1, 8), [raso], 0.0025); cintaS.mallas.forEach((m) => solapaPiv.add(m));
    solapaPiv.rotation.x = -Math.PI / 2;               // cerrada: tumbada hacia dentro, encima de la tapa
    laterales.push({ lado, bis, solapaPiv, hojas: [hoja, cinta], hojasS: [solapa, cintaS], giro: a });
  }

  // ---- lazo
  const lazo = new THREE.Group(); lazo.position.y = HP + 0.012; grupo.add(lazo);
  const nudo = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), raso); nudo.scale.set(1.25, 0.8, 1); nudo.castShadow = true; lazo.add(nudo);
  const lazadas = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.rotation.z = s * 0.38; lazo.add(piv);
    const g = new THREE.TorusGeometry(0.058, 0.011, 10, 36); g.scale(1, 0.62, 2.2);
    const m = new THREE.Mesh(g, raso); m.position.x = s * 0.062; m.position.y = 0.018; m.castShadow = true; piv.add(m);
    lazadas.push(piv);
    const cola = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.15, 1, 6), raso);
    { const p = cola.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin((y + 0.075) * 18) * 0.012); } cola.geometry.computeVertexNormals(); }
    cola.position.set(s * 0.04, -0.004, 0.07); cola.rotation.set(-Math.PI / 2 + 0.12, 0, s * 0.45); cola.castShadow = true; lazo.add(cola);
    lazadas.push(cola);
  }

  // ---- luz que sale de dentro
  const luz = new THREE.PointLight(0xffc56b, 0, 2.6, 2); luz.position.y = H * 0.75; grupo.add(luz);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilloTex, color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = H; halo.scale.setScalar(0.2); grupo.add(halo);
  const haz = (() => {
    const g = new THREE.CylinderGeometry(0.75, S * 0.42, 2.2, 32, 1, true); g.translate(0, 1.1, 0);
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { fuerza: { value: 0 } },
      vertexShader: "varying float vy; varying vec3 vn, vv; void main(){ vy = position.y / 2.2; vn = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform float fuerza; varying float vy; varying vec3 vn, vv; void main(){ float borde = pow(abs(dot(vn, vv)), 1.6); float a = fuerza * (1. - vy) * (1. - vy) * borde * 0.28; gl_FragColor = vec4(1., .85, .55, a); }",
    });
    const o = new THREE.Mesh(g, m); o.position.y = H - 0.02; o.renderOrder = 3; grupo.add(o); return o;
  })();
  const chispas = (() => {
    const n = movil ? 70 : 140, pos = new Float32Array(n * 3), vida = new Float32Array(n);
    for (let i = 0; i < n; i++) vida[i] = Math.random();
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: brilloTex, size: 0.06, color: 0xffe0a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false; p.userData.vida = vida; grupo.add(p); return p;
  })();

  // ---- estado de animación
  const st = { abierto: 0, solapa: 0, lado: 0, tapaSube: 0, tapaFuera: 0, luz: 0, sacude: 0 };
  const orden = [0, 1, 3, 2];        // primero el lado de la cámara; el del personaje, el último
  function aplica(t) {
    for (let i = 0; i < 4; i++) {
      const L = laterales[orden[i]], ret = i * 0.11;
      const ks = THREE.MathUtils.clamp((st.solapa - ret) / 0.6, 0, 1), kl = THREE.MathUtils.clamp((st.lado - ret) / 0.75, 0, 1);
      const ss = 1 - Math.pow(1 - ks, 3);
      // la solapa se levanta (rasgándose por las diagonales) y queda en línea con el lateral
      L.solapaPiv.rotation.x = -Math.PI / 2 * (1 - ss) + Math.sin(ss * Math.PI) * 0.35;
      // el lateral cae hacia fuera hasta el suelo, con un pequeño rebote
      const caida = kl * kl * (3 - 2 * kl);
      const rebote = kl > 0.8 ? Math.sin((kl - 0.8) / 0.2 * Math.PI) * 0.08 : 0;
      L.lado.rotation.x = (Math.PI / 2 - 0.03) * caida - rebote;
      // el papel se riza hacia fuera mientras se mueve y en el suelo queda con los bordes algo levantados
      const cl = Math.sin(kl * Math.PI) * 1.6 - kl * 0.7, cs = Math.sin(ks * Math.PI) * 3.2 + Math.sin(kl * Math.PI) * 1.5 - kl * 1.6;
      L.hojas.forEach((h) => h.doblar(cl)); L.hojasS.forEach((h) => h.doblar(cs));
      // la bisagra de la solapa sigue el borde (curvado) del lateral
      if (Math.abs(cl) < 1e-4) { L.bis.position.set(0, HP, 0); L.bis.rotation.x = 0; }
      else { const an = HP * cl; L.bis.position.set(0, Math.sin(an) / cl, (1 - Math.cos(an)) / cl); L.bis.rotation.x = an; }
      if (st.sacude > 0) L.lado.position.z = Math.sin(t * 60 + i) * 0.0025 * st.sacude;
    }
    // tapa: se levanta, se inclina y cae al lado
    const su = st.tapaSube, fu = st.tapaFuera;
    const SUELO_T = TAPA_H + 0.004;          // la tapa acaba boca abajo en la esquina libre de papel
    tapa.position.set(fu * 0.53, H - TAPA_H + su * 0.2 * (1 - fu) + Math.sin(fu * Math.PI) * 0.24 - fu * (H - TAPA_H - SUELO_T), fu * 0.53);
    tapa.rotation.set(Math.sin(su * Math.PI) * 0.05 + Math.sin(fu * Math.PI) * 0.3, fu * 0.1, -su * 0.12 - fu * (Math.PI - 0.12));
    // luz
    const l = st.luz;
    luz.intensity = 1.6 * l; seda.emissiveIntensity = 0.7 * l; haz.material.uniforms.fuerza.value = l;
    halo.material.opacity = 0.6 * l; halo.scale.setScalar(0.25 + 1.1 * l);
  }
  aplica(0);

  function actualizar(t, dt) {
    if (st.abierto > 0) aplica(t);
    // chispas que suben de la caja abierta
    if (st.luz > 0.01) {
      const p = chispas.geometry.attributes.position, v = chispas.userData.vida;
      for (let i = 0; i < v.length; i++) {
        v[i] += dt * (0.35 + (i % 7) * 0.04);
        if (v[i] > 1) v[i] -= 1;
        const a = i * 2.39996 + v[i] * 2, r = 0.05 + v[i] * 0.25 * ((i % 5) / 5 + 0.4);
        p.setXYZ(i, Math.cos(a) * r, H - 0.05 + v[i] * 1.6, Math.sin(a) * r);
      }
      p.needsUpdate = true; chispas.material.opacity = st.luz * 0.9;
    }
  }

  // Desenvolver. `tween(retraso, duración, fn(k))` lo pone app.js; `sonidos` = {cinta, rasgar(intensidad), carton, luz}.
  function desenvolver(tween, sonidos = {}) {
    st.abierto = 1;
    // 1. tira del lazo: las lazadas se cierran y el nudo se suelta
    tween(0.45, 0.55, (k) => {
      const s = k * k;
      lazadas.forEach((o, i) => { o.scale.setScalar(Math.max(0.001, 1 - s * 0.85)); o.rotation.y = (i % 2 ? 1 : -1) * s * 0.8; });
      nudo.scale.set(1.25 * (1 - s * 0.4), 0.8, 1 - s * 0.4);
    });
    tween(0.45, 0.01, () => sonidos.cinta && sonidos.cinta());
    // 2. el lazo sale volando y cae al suelo, delante
    tween(0.95, 0.9, (k) => {
      lazo.position.set(-0.55 * k, HP + 0.012 + Math.sin(k * Math.PI) * 0.35 - k * HP, 0.5 * k);
      lazo.rotation.set(k * Math.PI * 2, k * 1.3, k * Math.PI * 2);
    });
    // 3. tensión: el papel tiembla un instante antes de rasgarse
    tween(1.05, 0.35, (k) => { st.sacude = Math.sin(k * Math.PI); });
    // 4. rasgado: se levantan las solapas una tras otra
    tween(1.35, 1.0, (k) => { st.solapa = k * 1.0 + 0.33 * k; });
    [0, 0.11, 0.22, 0.33].forEach((r, i) => tween(1.35 + r, 0.01, () => sonidos.rasgar && sonidos.rasgar(1 - i * 0.12)));
    // 5. los laterales caen hacia fuera: el papel se abre como una flor
    tween(1.95, 1.2, (k) => { st.lado = k * 1.33; st.curva = 0.6 - k * 0.3; });
    tween(2.35, 0.01, () => sonidos.papel && sonidos.papel());
    // 6. la tapa se despega (se escapa luz por la rendija) y se aparta
    tween(3.15, 0.55, (k) => { st.tapaSube = 1 - Math.pow(1 - k, 2); st.luz = 0.35 * k; });
    tween(3.15, 0.01, () => sonidos.carton && sonidos.carton());
    tween(3.75, 0.85, (k) => { st.tapaFuera = k < 1 ? k * k * (3 - 2 * k) : 1; st.luz = 0.35 + 0.65 * k; });
    tween(4.55, 0.01, () => sonidos.carton && sonidos.carton(0.6));
  }
  return { grupo, desenvolver, actualizar, alturaTapa: HP };
}
