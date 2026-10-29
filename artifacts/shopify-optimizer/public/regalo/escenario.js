// Escenario: jardín al atardecer (hora dorada) para el regalo de Paula.
// Todo procedural: cielo con sol y nubes, colinas en capas con agujas de roca al fondo (guiño a Montserrat),
// césped con hierba que se mece, flores, árboles, guirnalda de bombillas, globos y luciérnagas.
import * as THREE from "three";

// --------------------------------------------------------------- utilidades
function azar(semilla) {                       // generador determinista: la escena sale igual cada vez
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function ruido1(x, semilla = 0) {              // ruido suave 1D (suma de senos)
  return Math.sin(x * 1.0 + semilla) * 0.5 + Math.sin(x * 2.3 + semilla * 1.7) * 0.25 + Math.sin(x * 5.1 + semilla * 2.9) * 0.12 + Math.sin(x * 9.7 + semilla * 4.1) * 0.06;
}
function texturaCanvas(w, h, dibuja, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; dibuja(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const PALETA = {
  cenit: "#2f4a78", medio: "#c98a7a", horizonte: "#ffd09a", bruma: "#efc29a",
  colinaCerca: "#66803f", colinaMedia: "#7d8f6a", colinaLejos: "#9a9aa6",
  cesped: "#7f9a45", sol: "#ffc690",
};

export function crearEscenario(escena, { movil = false, calidad = movil ? 1 : 2, sombras = calidad >= 1, posCaja = new THREE.Vector3(0.9, 0, 0.7), zonaLibre = { x: -0.25, z: -1.0, r: 3.4 } } = {}) {
  const rnd = azar(20261029);
  const Q = (bajo, medio, alto) => (calidad <= 0 ? bajo : calidad === 1 ? medio : alto);
  const actualizables = [];
  const DIR_SOL = new THREE.Vector3(-0.32, 0.105, -1).normalize();        // sol bajo, detrás del regalo

  // ------------------------------------------------------------- cielo
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, defines: { NUBES: calidad >= 2 ? 1 : 0 },
    uniforms: {
      cenit: { value: new THREE.Color(PALETA.cenit) }, medio: { value: new THREE.Color(PALETA.medio) },
      horizonte: { value: new THREE.Color(PALETA.horizonte) }, bruma: { value: new THREE.Color(PALETA.bruma) },
      dirSol: { value: DIR_SOL }, tiempo: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 cenit, medio, horizonte, bruma, dirSol; uniform float tiempo; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float ruido(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * ruido(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizonte, medio, smoothstep(0.0, 0.22, h));
        col = mix(col, cenit, smoothstep(0.18, 0.75, h));
        col = mix(bruma, col, smoothstep(-0.06, 0.03, h));              // bajo el horizonte: bruma
        float s = max(dot(d, dirSol), 0.0);
        col += vec3(1.0, 0.72, 0.42) * (pow(s, 6.0) * 0.45 + pow(s, 40.0) * 0.6);   // halo del sol
        col += vec3(1.0, 0.93, 0.80) * smoothstep(0.9991, 0.9996, s) * 2.5;          // disco
        // nubes finas, más densas cerca del horizonte e iluminadas del lado del sol
        if (h > 0.02) {
          vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(tiempo * 0.004, 0.0);
          #if NUBES
          float n = fbm(uv);
          #else
          float n = ruido(uv) * 0.6 + ruido(uv * 2.03) * 0.3;
          #endif
          float banda = smoothstep(0.02, 0.10, h) * (1.0 - smoothstep(0.35, 0.7, h));
          float nube = smoothstep(0.52, 0.78, n) * banda;
          vec3 cn = mix(vec3(0.95, 0.62, 0.62), vec3(1.0, 0.86, 0.66), pow(s, 3.0));
          col = mix(col, cn, nube * 0.55);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  cielo.frustumCulled = false; cielo.renderOrder = -10;
  escena.add(cielo);
  actualizables.push((t) => { cielo.material.uniforms.tiempo.value = t; });
  escena.fog = new THREE.Fog(PALETA.bruma, 16, 78);

  // ------------------------------------------------------------- luces (hora dorada)
  const hemi = new THREE.HemisphereLight(0xa9c0e0, 0x5e6b35, 0.85); escena.add(hemi);
  const sol = new THREE.DirectionalLight(PALETA.sol, 2.7);
  sol.position.set(DIR_SOL.x * 14, 7.5, DIR_SOL.z * 14);           // misma dirección que el sol del cielo, más alto para sombras útiles
  sol.castShadow = sombras;
  sol.shadow.mapSize.set(Q(512, 1024, 2048), Q(512, 1024, 2048));
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.025;
  escena.add(sol); escena.add(sol.target);
  const relleno = new THREE.DirectionalLight(0xffe7d2, 1.25); relleno.position.set(3, 4, 8); escena.add(relleno);

  // ------------------------------------------------------------- suelo: césped con manchas
  const texCesped = texturaCanvas(512, 512, (g, w, h) => {
    g.fillStyle = "#7b9443"; g.fillRect(0, 0, w, h);
    const r = azar(7);
    for (let i = 0; i < 9000; i++) {                // briznas cortas
      const x = r() * w, y = r() * h, l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      const v = 0.75 + r() * 0.5;
      g.strokeStyle = `rgba(${Math.round(110 * v)},${Math.round(150 * v)},${Math.round(62 * v)},0.55)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
  texCesped.wrapS = texCesped.wrapT = THREE.RepeatWrapping; texCesped.repeat.set(26, 26); texCesped.anisotropy = Q(1, 4, 8);
  const geoSuelo = new THREE.PlaneGeometry(160, 160, 96, 96);
  geoSuelo.rotateX(-Math.PI / 2);
  const colSuelo = [], cA = new THREE.Color("#8fa64f"), cB = new THREE.Color("#5f7d33"), cC = new THREE.Color("#b2a35a"), tmpC = new THREE.Color();
  const ps = geoSuelo.attributes.position;
  for (let i = 0; i < ps.count; i++) {
    const x = ps.getX(i), z = ps.getZ(i);
    const n = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2.1) * Math.cos(z * 0.19 + Math.sin(x * 0.13) * 1.7);
    tmpC.copy(cA).lerp(cB, n * 0.8);
    const lejos = Math.min(1, Math.hypot(x, z) / 40); tmpC.lerp(cC, lejos * 0.35);       // el fondo amarillea con la luz rasante
    colSuelo.push(tmpC.r, tmpC.g, tmpC.b);
    const d = Math.hypot(x, z); if (d > 12) ps.setY(i, Math.sin(x * 0.08) * Math.cos(z * 0.07) * Math.min(1, (d - 12) / 20) * 1.2);
  }
  geoSuelo.setAttribute("color", new THREE.Float32BufferAttribute(colSuelo, 3));
  geoSuelo.computeVertexNormals();
  const suelo = new THREE.Mesh(geoSuelo, new THREE.MeshStandardMaterial({ map: texCesped, vertexColors: true, roughness: 1, metalness: 0 }));
  suelo.receiveShadow = true; escena.add(suelo);

  // ------------------------------------------------------------- colinas en capas + agujas de roca al fondo
  function colina(radio, altura, color, semilla, agujas = false) {
    const seg = 260, pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      let y = altura * (0.55 + 0.45 * ruido1(a * 3.0, semilla));
      if (agujas) {                                   // un macizo de agujas redondeadas detrás, a la izquierda del sol
        const centro = Math.atan2(-1, -0.55), dA = Math.atan2(Math.sin(a - centro), Math.cos(a - centro));
        const macizo = Math.exp(-(dA * dA) / 0.09);
        const picos = Math.pow(Math.abs(Math.sin(a * 46.0 + semilla)), 3.0) * 0.55 + Math.pow(Math.abs(Math.sin(a * 23.0 + semilla * 2.0)), 2.0) * 0.45;
        y += macizo * altura * (1.3 + 1.6 * picos);
      }
      const x = Math.cos(a) * radio, z = Math.sin(a) * radio;
      pos.push(x, -2, z, x, Math.max(0.2, y), z);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    escena.add(m); return m;
  }
  colina(64, 9.5, PALETA.colinaLejos, 3.1, true);
  colina(46, 5.2, PALETA.colinaMedia, 1.7);
  colina(32, 2.6, PALETA.colinaCerca, 5.3);

  // ------------------------------------------------------------- árboles estilizados
  const fuera = (x, z, r) => Math.hypot(x - zonaLibre.x, z - zonaLibre.z) > r;
  const hojasMat = [0x7c9a48, 0x8fab52, 0x6d8b3e, 0xa3b45c].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92 }));
  const troncoMat = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 1 });
  const geoCopa = new THREE.IcosahedronGeometry(1, 2), geoTronco = new THREE.CylinderGeometry(0.1, 0.17, 1, 10);
  function arbol(x, z, s) {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(geoTronco, troncoMat); tr.scale.set(s, 1.7 * s, s); tr.position.y = 0.85 * s; tr.castShadow = true; g.add(tr);
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(geoCopa, hojasMat[Math.floor(rnd() * hojasMat.length)]);
      const r = (0.55 + rnd() * 0.35) * s;
      c.scale.set(r, r * 0.9, r); c.position.set((rnd() - 0.5) * 0.9 * s, (2.0 + rnd() * 0.9) * s, (rnd() - 0.5) * 0.9 * s);
      c.castShadow = true; g.add(c);
    }
    g.position.set(x, 0, z); g.rotation.y = rnd() * Math.PI * 2; escena.add(g);
  }
  const sitiosArboles = [[-7.5, -6.5, 1.25], [-10.5, -2.5, 1.4], [-5.2, -10.5, 1.1], [8.5, -7.5, 1.35], [11.5, -2.0, 1.5], [6.0, -12.5, 1.15],
    [-13.5, -9.0, 1.6], [14.0, -10.0, 1.5], [-2.5, -15.5, 1.3], [2.8, -17.0, 1.2], [-9.5, 4.0, 1.3], [10.5, 3.5, 1.35]];
  sitiosArboles.forEach(([x, z, s]) => arbol(x, z, s));

  // ------------------------------------------------------------- hierba alta que se mece (instanciada) y flores
  const tiempoU = { value: 0 };
  const brizna = new THREE.BufferGeometry();
  brizna.setAttribute("position", new THREE.Float32BufferAttribute([-0.018, 0, 0, 0.018, 0, 0, 0.0, 1, 0], 3));
  brizna.setAttribute("color", new THREE.Float32BufferAttribute([0.24, 0.33, 0.12, 0.24, 0.33, 0.12, 0.72, 0.78, 0.38], 3));
  brizna.computeVertexNormals();
  const matHierba = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  matHierba.onBeforeCompile = (sh) => {
    sh.uniforms.tiempo = tiempoU;
    sh.vertexShader = "uniform float tiempo;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float vaiven = sin(tiempo * 1.7 + base.x * 0.6 + base.z * 0.45) * 0.5 + sin(tiempo * 2.9 + base.x * 1.3) * 0.2;
      transformed.x += vaiven * 0.16 * position.y * position.y;
      transformed.z += vaiven * 0.06 * position.y * position.y;`);
  };
  const N_HIERBA = Q(0, 2500, 11000);
  const hierba = new THREE.InstancedMesh(brizna, matHierba, N_HIERBA);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), esc3 = new THREE.Vector3(), eY = new THREE.Euler();
  let k = 0;
  while (k < N_HIERBA) {
    const a = rnd() * Math.PI * 2, r = 3.2 + Math.pow(rnd(), 0.8) * 15;
    const x = zonaLibre.x + Math.cos(a) * r, z = zonaLibre.z + Math.sin(a) * r;
    if (!fuera(x, z, zonaLibre.r + rnd() * 0.8)) continue;
    if (z > 5.5 && Math.abs(x) < 4) continue;                 // delante de la cámara, despejado
    const alto = 0.22 + rnd() * 0.38;
    eY.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25); q.setFromEuler(eY);
    m4.compose(v3.set(x, 0, z), q, esc3.set(0.8 + rnd() * 0.6, alto, 1)); hierba.setMatrixAt(k++, m4);
  }
  hierba.frustumCulled = false; if (N_HIERBA) escena.add(hierba);
  actualizables.push((t) => { tiempoU.value = t; });

  const N_FLOR = Q(0, 260, 650);
  const flores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.034, 0), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x221100, emissiveIntensity: 0.2 }), N_FLOR);
  const coloresFlor = ["#fff7ec", "#ffd36b", "#f4a6bd", "#e9e3ff"].map((c) => new THREE.Color(c));
  k = 0;
  while (k < N_FLOR) {
    const a = rnd() * Math.PI * 2, r = 3.4 + rnd() * 11;
    const x = zonaLibre.x + Math.cos(a) * r, z = zonaLibre.z + Math.sin(a) * r;
    if (!fuera(x, z, zonaLibre.r + 0.3) || (z > 5.5 && Math.abs(x) < 4)) continue;
    m4.compose(v3.set(x, 0.18 + rnd() * 0.22, z), q.identity(), esc3.setScalar(0.7 + rnd() * 0.7));
    flores.setMatrixAt(k, m4); flores.setColorAt(k, coloresFlor[k % coloresFlor.length]); k++;
  }
  if (N_FLOR) escena.add(flores);

  // ------------------------------------------------------------- guirnalda de bombillas entre dos postes
  const brilloTex = texturaCanvas(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,240,210,1)"); r.addColorStop(0.25, "rgba(255,205,140,.55)"); r.addColorStop(1, "rgba(255,190,120,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const madera = new THREE.MeshStandardMaterial({ color: 0x7a5a3e, roughness: 0.9 });
  const postes = [new THREE.Vector3(-4.2, 0, -3.6), new THREE.Vector3(3.9, 0, -4.4), new THREE.Vector3(5.4, 0, 0.6)];
  const ALTO_POSTE = 2.9;
  postes.forEach((p) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, ALTO_POSTE, 10), madera);
    m.position.set(p.x, ALTO_POSTE / 2, p.z); m.castShadow = true; escena.add(m);
  });
  const bombillas = [];
  const matCable = new THREE.MeshBasicMaterial({ color: 0x2b241f });
  function tramo(a, b, n, comba) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40; const p = new THREE.Vector3().lerpVectors(a, b, t); p.y -= Math.sin(t * Math.PI) * comba; pts.push(p);
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    escena.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 60, 0.008, 5, false), matCable));
    for (let i = 1; i < n; i++) {
      const p = curva.getPoint(i / n);
      const b0 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }));
      b0.position.copy(p).add(new THREE.Vector3(0, -0.045, 0)); escena.add(b0);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilloTex, color: 0xffc98a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
      halo.position.copy(b0.position); halo.scale.setScalar(0.42); escena.add(halo);
      bombillas.push({ b0, halo, fase: rnd() * 6.28 });
    }
  }
  const tope = (p) => p.clone().setY(ALTO_POSTE - 0.05);
  tramo(tope(postes[0]), tope(postes[1]), 22, 0.65);
  tramo(tope(postes[1]), tope(postes[2]), 12, 0.45);
  actualizables.push((t) => {
    for (const b of bombillas) { const f = 0.85 + Math.sin(t * 2.2 + b.fase) * 0.08 + Math.sin(t * 7.1 + b.fase * 3) * 0.04; b.halo.material.opacity = f; b.halo.scale.setScalar(0.38 + f * 0.06); }
  });

  // ------------------------------------------------------------- globos atados al regalo
  const perfil = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = t * Math.PI;
    let r = Math.sin(a) * (1 - 0.18 * t);                      // gota: más ancha arriba
    perfil.push(new THREE.Vector2(Math.max(0.001, r), -Math.cos(a) * 1.18));
  }
  perfil.unshift(new THREE.Vector2(0.06, -1.25)); perfil.unshift(new THREE.Vector2(0.001, -1.27));   // nudo
  const geoGlobo = new THREE.LatheGeometry(perfil, 40);
  const coloresGlobo = [0xe9b49c, 0xe6c07b, 0xf3e6d3, 0xf1a2b4, 0xd99a7a, 0xf6d48f];
  const ancla = posCaja.clone().add(new THREE.Vector3(0, 0.62, 0));
  const globos = [];
  const matCuerda = new THREE.LineBasicMaterial({ color: 0xf6efe6, transparent: true, opacity: 0.75 });
  coloresGlobo.forEach((c, i) => {
    const mat = calidad < 2 ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 0.15 })       // en móvil, material más ligero
      : new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.5, sheenColor: new THREE.Color(0xffffff) });
    const g = new THREE.Mesh(geoGlobo, mat); g.scale.setScalar(0.12 + rnd() * 0.02); g.castShadow = true;
    const ang = -Math.PI * 0.85 + (i / (coloresGlobo.length - 1)) * Math.PI * 0.9;          // abanico detrás del regalo, hacia la derecha
    const reposo = new THREE.Vector3(ancla.x + 0.15 + Math.cos(ang) * (0.25 + rnd() * 0.12), 1.45 + rnd() * 0.4, ancla.z - 0.25 + Math.sin(ang) * (0.22 + rnd() * 0.1));
    g.position.copy(reposo); escena.add(g);
    const cuerda = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ancla.clone(), reposo.clone()]), matCuerda); escena.add(cuerda);
    globos.push({ g, cuerda, reposo, fase: rnd() * 6.28, suelto: false, vel: new THREE.Vector3(), anclaPropia: ancla.clone() });
  });
  actualizables.push((t, dt) => {
    for (const o of globos) {
      if (!o.suelto) {
        o.g.position.set(o.reposo.x + Math.sin(t * 0.9 + o.fase) * 0.05, o.reposo.y + Math.sin(t * 1.3 + o.fase) * 0.04, o.reposo.z + Math.cos(t * 0.8 + o.fase) * 0.04);
      } else {
        o.vel.y = Math.min(o.vel.y + dt * 0.9, 1.6); o.g.position.addScaledVector(o.vel, dt);
        o.g.position.x += Math.sin(t * 1.4 + o.fase) * dt * 0.25; o.anclaPropia.addScaledVector(o.vel, dt * 0.92);
      }
      o.g.rotation.z = Math.sin(t * 1.1 + o.fase) * 0.08;
      const p = o.cuerda.geometry.attributes.position;
      const base = o.g.position.clone().add(new THREE.Vector3(0, -1.27 * o.g.scale.y, 0));
      p.setXYZ(0, o.anclaPropia.x, o.anclaPropia.y, o.anclaPropia.z); p.setXYZ(1, base.x, base.y, base.z); p.needsUpdate = true;
    }
  });
  function soltarGlobos() {
    globos.forEach((o, i) => { o.suelto = true; o.vel.set((rnd() - 0.5) * 0.4, 0.4 + i * 0.05, (rnd() - 0.5) * 0.3); o.anclaPropia.copy(o.g.position).add(new THREE.Vector3(0, -0.6, 0)); });
  }

  // ------------------------------------------------------------- luciérnagas
  const N_LUZ = Q(0, 60, 150);
  const posL = new Float32Array(N_LUZ * 3), semL = [];
  for (let i = 0; i < N_LUZ; i++) {
    const a = rnd() * Math.PI * 2, r = 2 + rnd() * 10;
    posL.set([zonaLibre.x + Math.cos(a) * r, 0.3 + rnd() * 2.6, zonaLibre.z + Math.sin(a) * r], i * 3); semL.push(rnd() * 6.28);
  }
  const geoL = new THREE.BufferGeometry(); geoL.setAttribute("position", new THREE.BufferAttribute(posL, 3));
  const luciernagas = new THREE.Points(geoL, new THREE.PointsMaterial({ size: 0.11, map: brilloTex, color: 0xffd88f, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  escena.add(luciernagas);
  actualizables.push((t, dt) => {
    const p = geoL.attributes.position;
    for (let i = 0; i < N_LUZ; i++) {
      p.setX(i, p.getX(i) + Math.sin(t * 0.35 + semL[i]) * dt * 0.12);
      p.setY(i, p.getY(i) + Math.cos(t * 0.5 + semL[i] * 1.3) * dt * 0.06);
      p.setZ(i, p.getZ(i) + Math.cos(t * 0.3 + semL[i] * 0.7) * dt * 0.12);
    }
    p.needsUpdate = true;
    luciernagas.material.opacity = 0.75 + Math.sin(t * 1.6) * 0.15;
  });

  return {
    sol, brilloTex, soltarGlobos,
    actualizar(t, dt) { for (const f of actualizables) f(t, dt); },
  };
}
