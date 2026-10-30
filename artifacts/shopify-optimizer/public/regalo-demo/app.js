import * as THREE from "three";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { crearEscenario } from "./escenario.js";
import { crearRegalo } from "./regalo.js";

// ------------------------------------------------------------------ ajustes
const CONFIG = {
  mensaje: "Esto es una demostración de un regalo web de Shopy Crafter. En el tuyo, las fotos serán las vuestras, este mensaje lo escribes tú y el personaje puede ser la persona que lo recibe, hecha en 3D.",
  firma: "Shopy Crafter · @shopycrafter",
  fotos: 10,
  velocidad: 1.3,               // m/s al caminar
  esperaAuto: 7,                // s sin tocar nada → camina sola hacia el regalo
};
const ES_MOVIL = matchMedia("(pointer: coarse)").matches;
// Calidad 2 = ordenador, 1 = móvil, 0 = mínima. Si el móvil pierde el contexto WebGL, se recarga sola un escalón más abajo.
const PARAM_Q = new URLSearchParams(location.search).get("q");
const CALIDAD = PARAM_Q !== null && /^[0-2]$/.test(PARAM_Q) ? Number(PARAM_Q) : (ES_MOVIL ? 1 : 2);

// ------------------------------------------------------------------ DOM
const $ = (id) => document.getElementById(id);
const lienzo = $("escena"), ui = {
  inicio: $("inicio"), progreso: $("progreso"), estado: $("estado"), empezar: $("empezar"), pista: $("pista"),
  abrir: $("abrir"), sonido: $("sonido"), recuerdos: $("recuerdos"), fotos: $("fotos"), final: $("final"),
  mensaje: $("mensaje"), firma: $("firma"), otra: $("otra"), destello: $("destello"),
};

// ------------------------------------------------------------------ diagnóstico: si algo falla en un móvil, se dice en pantalla
const fallos = [];
function avisa(texto) {
  fallos.push(String(texto).slice(0, 400));
  let p = document.getElementById("diagnostico");
  if (!p) {
    p = document.createElement("pre"); p.id = "diagnostico";
    p.style.cssText = "position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom));z-index:99;max-height:38vh;overflow:auto;" +
      "margin:0;padding:10px 12px;border-radius:10px;background:rgba(20,16,24,.92);color:#ffd9a8;font:11px/1.4 ui-monospace,Menlo,monospace;white-space:pre-wrap";
    document.body.appendChild(p);
  }
  p.textContent = "Diagnóstico (haz captura y envíala):\n" + fallos.join("\n---\n");
}
addEventListener("error", (e) => avisa("error: " + (e.message || e.error)));
addEventListener("unhandledrejection", (e) => avisa("promesa: " + (e.reason && (e.reason.message || e.reason))));

// ------------------------------------------------------------------ render
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: CALIDAD >= 2, powerPreference: CALIDAD >= 2 ? "high-performance" : "default" });
} catch (e) { avisa("WebGL no disponible: " + e.message); throw e; }
renderer.debug.onShaderError = (gl, programa, vs, fs) => {
  avisa("shader: " + (gl.getProgramInfoLog(programa) || "") + " | " + (gl.getShaderInfoLog(vs) || "") + " | " + (gl.getShaderInfoLog(fs) || ""));
};
lienzo.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  if (CALIDAD > 0 && ui.recuerdos.classList.contains("oculto")) {
    ui.estado.textContent = "Ajustando a tu móvil…";
    location.replace(location.pathname + "?q=" + (CALIDAD - 1));
  } else avisa("contexto WebGL perdido (calidad " + CALIDAD + ")");
});
renderer.setClearColor(0xefc29a, 1);            // si el cielo no se pinta, se ve la bruma dorada, nunca blanco ni negro
renderer.setPixelRatio(Math.min(devicePixelRatio, [1, 1.25, 2][CALIDAD]));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = CALIDAD >= 1;
renderer.shadowMap.type = CALIDAD >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;

const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(38, 1, 0.1, 220);

// escenario: jardín al atardecer (cielo, colinas, césped, árboles, guirnalda, globos, luciérnagas)
const ambiente = crearEscenario(escena, { movil: ES_MOVIL, calidad: CALIDAD, posCaja: new THREE.Vector3(0.9, 0, 0.7) });
const motaTex = ambiente.brilloTex;

// ------------------------------------------------------------------ carga
const gestor = new THREE.LoadingManager();
gestor.onProgress = (_, n, total) => { ui.progreso.style.width = Math.round(n / total * 100) + "%"; };
const cargador = new GLTFLoader(gestor);
const imagenes = [];
for (let i = 1; i <= CONFIG.fotos; i++) {
  const img = new Image(); img.decoding = "async";
  gestor.itemStart("foto" + i);
  img.onload = img.onerror = () => gestor.itemEnd("foto" + i);
  img.src = `assets/fotos/${String(i).padStart(2, "0")}.jpg`; imagenes.push(img);
}

let paula, mezclador, acciones = {}, accionActual, caja;
const POS_CAJA = new THREE.Vector3(0.9, 0, 0.7);
const POS_INICIO = new THREE.Vector3(-1.4, 0, -2.7);

// Personaje de la demo: RobotExpressive (Tomás Laulhé, CC0). Sus animaciones se renombran a las del regalo.
const NOMBRES = { Idle: "Idle_Loop", Walking: "Walk_Loop", Dance: "Dance_Loop", ThumbsUp: "Interact" };
const promesaPaula = cargador.loadAsync("assets/personaje.glb").then((g) => {
  paula = g.scene;
  // Medida con los huesos aplicados: la caja "rápida" de una malla con esqueleto sale ~33 veces mayor
  paula.updateMatrixWorld(true);
  const alto = new THREE.Box3().setFromObject(paula, true).getSize(new THREE.Vector3()).y || 1;
  paula.scale.setScalar(1.25 / alto);            // la demo mide 1,25
  paula.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material && o.material.map) o.material.map.anisotropy = 4; }
  });
  paula.position.copy(POS_INICIO);
  { const m = POS_CAJA.clone().sub(POS_INICIO); paula.rotation.y = Math.atan2(m.x, m.z); }
  escena.add(paula);
  mezclador = new THREE.AnimationMixer(paula);
  for (const clip of g.animations) { const n = NOMBRES[clip.name]; if (n) acciones[n] = mezclador.clipAction(clip); }
  for (const n of ["Interact"]) if (acciones[n]) { acciones[n].setLoop(THREE.LoopOnce); acciones[n].clampWhenFinished = true; }
  pon("Idle_Loop", 0);
});
const regalo = crearRegalo(escena, { movil: CALIDAD < 2, brilloTex: motaTex, posicion: POS_CAJA, giro: 0.45 });
caja = regalo.grupo;
const promesaCaja = Promise.resolve();

Promise.all([promesaPaula, promesaCaja]).then(() => {
  if (CALIDAD >= 2) { try { renderer.compile(escena, camara); } catch (e) { avisa("compilar: " + e.message); } }
  ui.estado.textContent = "Todo listo";
  ui.empezar.disabled = false;
}).catch((e) => { console.error(e); ui.estado.textContent = "No se ha podido cargar. Prueba a recargar la página."; });

function pon(nombre, fundido = 0.35) {
  const a = acciones[nombre]; if (!a || a === accionActual) return;
  a.reset().setEffectiveWeight(1).fadeIn(fundido).play();
  if (accionActual) accionActual.fadeOut(fundido);
  accionActual = a;
}

// ------------------------------------------------------------------ sonido (sintetizado: sin archivos)
let audio, salida, mudo = false;
function iniciaAudio() {
  if (audio) return;
  audio = new (window.AudioContext || window.webkitAudioContext)();
  salida = audio.createGain(); salida.gain.value = 0.8;
  const rev = audio.createConvolver(), largo = audio.sampleRate * 2.4, buf = audio.createBuffer(2, largo, audio.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 3); }
  rev.buffer = buf; const mojado = audio.createGain(); mojado.gain.value = 0.35;
  salida.connect(audio.destination); salida.connect(rev); rev.connect(mojado); mojado.connect(audio.destination);
}
function nota(freq, t, dur = 1.6, vol = 0.18, tipo = "sine") {
  if (!audio || mudo) return;
  const o = audio.createOscillator(), g = audio.createGain(), o2 = audio.createOscillator(), g2 = audio.createGain();
  o.type = tipo; o.frequency.value = freq; o2.type = "sine"; o2.frequency.value = freq * 2.01; g2.gain.value = 0.25;
  const t0 = audio.currentTime + t;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(salida);
  o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function ruido(t, dur, vol, f0, f1, q = 1.2, tipo = "bandpass") {   // ráfaga de ruido filtrado (papel, cinta, cartón)
  if (!audio || mudo) return;
  const n = Math.floor(audio.sampleRate * dur), b = audio.createBuffer(1, n, audio.sampleRate), d = b.getChannelData(0);
  let crujido = 0;
  for (let i = 0; i < n; i++) { if (Math.random() < 0.004) crujido = 1; crujido *= 0.97; d[i] = (Math.random() * 2 - 1) * (0.45 + crujido); }
  const src = audio.createBufferSource(); src.buffer = b;
  const f = audio.createBiquadFilter(); f.type = tipo; f.Q.value = q;
  const g = audio.createGain(), t0 = audio.currentTime + t;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(salida); src.start(t0); src.stop(t0 + dur + 0.02);
}
const sonidoCinta = () => { ruido(0, 0.45, 0.22, 900, 3200, 2.5); ruido(0.32, 0.25, 0.12, 2600, 1200, 3); };
const sonidoRasgar = (i = 1) => { ruido(0, 0.38, 0.32 * i, 2400, 5200, 0.9); ruido(0.05, 0.3, 0.18 * i, 900, 1800, 1.5); };
const sonidoPapel = () => { for (let k = 0; k < 4; k++) ruido(k * 0.13, 0.35, 0.12, 1800, 700, 1.1); };
const sonidoCarton = (v = 1) => { ruido(0, 0.22, 0.25 * v, 420, 160, 1.4, "lowpass"); nota(hz(43), 0, 0.3, 0.12 * v, "sine"); };
function campanitas() { [84, 88, 91, 96, 100].forEach((m, i) => nota(hz(m), i * 0.09, 2.2, 0.14)); }
function musica(segundos) {     // cajita de música suave en do mayor
  const acordes = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
  let t = 0, k = 0;
  while (t < segundos) {
    const ac = acordes[Math.floor(k / 8) % 4];
    nota(hz(ac[k % 4] + 12), t, 1.4, 0.07, "triangle");
    if (k % 8 === 0) nota(hz(ac[0] - 12), t, 3.2, 0.05, "sine");
    t += 0.24; k++;
  }
}
ui.sonido.onclick = () => { mudo = !mudo; ui.sonido.classList.toggle("mudo", mudo); if (salida) salida.gain.value = mudo ? 0 : 0.8; };

// ------------------------------------------------------------------ control
const estado = { fase: "inicio", objetivo: null, tocado: false, inicioJuego: 0, teclas: {} };
const rayo = new THREE.Raycaster(), planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const marca = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, depthWrite: false }));
marca.rotation.x = -Math.PI / 2; marca.position.y = 0.01; escena.add(marca);

function destinoCercaDeLaCaja(p) {
  const d = p.clone().sub(POS_CAJA); d.y = 0;
  if (d.length() < 1.1) { const desde = paula.position.clone().sub(POS_CAJA); desde.y = 0; desde.setLength(0.95); return POS_CAJA.clone().add(desde); }
  return p;
}
lienzo.addEventListener("pointerdown", (e) => {
  if (estado.fase !== "juego") return;
  const v = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rayo.setFromCamera(v, camara);
  const p = new THREE.Vector3();
  if (rayo.ray.intersectPlane(planoSuelo, p)) {
    if (p.length() > 7) p.setLength(7);
    estado.objetivo = destinoCercaDeLaCaja(p); estado.tocado = true;
    marca.position.set(estado.objetivo.x, 0.01, estado.objetivo.z); marca.material.opacity = 0.9; marca.scale.setScalar(0.6);
    ui.pista.classList.add("oculto");
  }
});
addEventListener("keydown", (e) => { estado.teclas[e.key.toLowerCase()] = true; });
addEventListener("keyup", (e) => { estado.teclas[e.key.toLowerCase()] = false; });

ui.empezar.onclick = () => {
  iniciaAudio(); if (audio.state === "suspended") audio.resume();
  ui.inicio.classList.add("oculto");
  ui.pista.textContent = ES_MOVIL ? "Toca el suelo para caminar hasta el regalo" : "Haz clic en el suelo (o usa las flechas) para ir al regalo";
  setTimeout(() => { ui.pista.classList.remove("oculto"); ui.sonido.classList.remove("oculto"); }, 700);
  estado.fase = "juego"; estado.inicioJuego = reloj.elapsedTime;
  nota(hz(79), 0, 1.2, 0.08);
};
ui.abrir.onclick = () => abrirRegalo();
ui.otra.onclick = () => location.reload();

// ------------------------------------------------------------------ apertura del regalo
const confeti = (() => {
  const n = 220, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [], c = new THREE.Color();
  const paleta = ["#ffd166", "#ef476f", "#ffffff", "#f7a8c4", "#e6c07b", "#c2264a"];
  for (let i = 0; i < n; i++) { c.set(paleta[i % paleta.length]); col.set([c.r, c.g, c.b], i * 3); vel.push(new THREE.Vector3()); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
  p.userData = { vel, activo: false }; p.frustumCulled = false; escena.add(p); return p;
})();
function lanzaConfeti() {
  const a = confeti.geometry.attributes.position, v = confeti.userData.vel;
  for (let i = 0; i < v.length; i++) {
    a.setXYZ(i, POS_CAJA.x, 0.65, POS_CAJA.z);
    const ang = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 1.6;
    v[i].set(Math.cos(ang) * r, 3 + Math.random() * 3.2, Math.sin(ang) * r);
  }
  a.needsUpdate = true; confeti.material.opacity = 1; confeti.userData.activo = true;
}

const anim = [];   // pequeñas animaciones con tiempo: {t0, dur, fn}
const tween = (retraso, dur, fn, fin) => anim.push({ t0: reloj.elapsedTime + retraso, dur, fn, fin });
const suave = (x) => x * x * (3 - 2 * x), sale = (x) => 1 - Math.pow(1 - x, 3);

function abrirRegalo() {
  if (estado.fase !== "cerca") return;
  estado.fase = "abriendo"; estado.objetivo = null;
  ui.abrir.classList.add("oculto"); ui.pista.classList.add("oculto");
  const mira = POS_CAJA.clone().sub(paula.position); paula.rotation.y = Math.atan2(mira.x, mira.z);
  caja.position.y = 0;
  // El personaje tira del lazo y rasga el papel; luego se aparta un poco mientras se abre la caja
  pon(acciones.Interact ? "Interact" : "Idle_Loop", 0.25);
  tween(1.25, 0.01, () => { if (acciones.Interact) { acciones.Interact.reset().play(); } });
  tween(2.7, 0.01, () => pon("Idle_Loop", 0.5));
  regalo.desenvolver(tween, { cinta: sonidoCinta, rasgar: sonidoRasgar, papel: sonidoPapel, carton: sonidoCarton });
  tween(4.35, 0.01, () => { campanitas(); lanzaConfeti(); ambiente.soltarGlobos(); });
  tween(4.7, 0.01, () => pon("Dance_Loop", 0.5));
  tween(5.6, 0.01, () => { estado.fase = "entrando"; });
  tween(8.0, 0.01, () => { ui.destello.style.opacity = 1; });
  tween(9.1, 0.01, () => empiezaRecuerdos());
}

// ------------------------------------------------------------------ secuencia de fotos → negro → mensaje
function empiezaRecuerdos() {
  estado.fase = "recuerdos";
  ui.recuerdos.classList.remove("oculto");
  setTimeout(() => { ui.destello.style.opacity = 0; }, 250);
  musica(15);
  const c = ui.fotos, g = c.getContext("2d");
  const dpr = Math.min(devicePixelRatio, 2);
  const ajusta = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  ajusta(); addEventListener("resize", ajusta);
  // tiempos: cada foto un poco más rápida que la anterior; dos vueltas
  const orden = [...imagenes.keys(), ...imagenes.keys()];
  const tiempos = []; let d = 1.05, t = 0;
  for (let i = 0; i < orden.length; i++) { tiempos.push(t); t += d; d = Math.max(0.16, d * 0.84); }
  const total = t, inicio = performance.now();
  function cubre(img, alfa, zoom, giro) {
    if (!img.naturalWidth) return;
    const W = c.width, H = c.height, s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
    g.save(); g.globalAlpha = alfa; g.translate(W / 2, H / 2); g.rotate(giro);
    g.drawImage(img, -img.naturalWidth * s / 2, -img.naturalHeight * s / 2, img.naturalWidth * s, img.naturalHeight * s);
    g.restore();
  }
  function cuadro(ahora) {
    const s = (ahora - inicio) / 1000, p = Math.min(s / total, 1);
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    let i = tiempos.findIndex((x, k) => s >= x && (k === tiempos.length - 1 || s < tiempos[k + 1])); if (i < 0) i = 0;
    const dur = (i < tiempos.length - 1 ? tiempos[i + 1] : total) - tiempos[i], k = Math.min((s - tiempos[i]) / dur, 1);
    if (i > 0) cubre(imagenes[orden[i - 1]], 1, 1.12 + 0.04, (i % 2 ? 1 : -1) * 0.012);
    cubre(imagenes[orden[i]], Math.min(k / 0.35, 1), 1.04 + k * 0.08, (i % 2 ? -1 : 1) * 0.012 * (1 - k));
    // viñeta
    const v = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.25, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.65)"); g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
    // se va difuminando y apagando
    const desde = 0.35, q = Math.max(0, (p - desde) / (1 - desde));
    c.style.filter = `blur(${(q * q * 16).toFixed(2)}px) saturate(${(1 - q * 0.6).toFixed(2)}) brightness(${(1 - q * 0.85).toFixed(2)})`;
    c.style.transform = `scale(${(1 + q * q * 0.12).toFixed(3)})`;   // el desenfoque no oscurece los bordes
    if (p < 1) requestAnimationFrame(cuadro);
    else { c.style.transition = "opacity 1.2s"; c.style.opacity = 0; setTimeout(muestraMensaje, 1300); }
  }
  requestAnimationFrame(cuadro);
}
function muestraMensaje() {
  ui.mensaje.innerHTML = "";
  const letras = [...CONFIG.mensaje].map((ch) => { const s = document.createElement("span"); s.textContent = ch; ui.mensaje.appendChild(s); return s; });
  ui.final.classList.add("visible");
  letras.forEach((s, i) => setTimeout(() => s.classList.add("si"), 400 + i * 38));
  const fin = 400 + letras.length * 38;
  ui.firma.textContent = CONFIG.firma;
  setTimeout(() => { ui.firma.classList.add("si"); nota(hz(84), 0, 2.5, 0.08); nota(hz(91), 0.15, 2.5, 0.06); }, fin + 600);
  setTimeout(() => document.querySelectorAll(".final .boton").forEach((b) => b.classList.add("si")), fin + 2200);
}

// ------------------------------------------------------------------ bucle
const reloj = new THREE.Clock();
const objetivoCam = new THREE.Vector3(), posCam = new THREE.Vector3(), tmp = new THREE.Vector3();
function encuadre(dt, inmediato = false) {
  const vertical = camara.aspect < 1;
  if (estado.fase === "abriendo" && paula) {
    // plano cercano: el personaje y el regalo, algo picado para ver cómo se abre el papel
    const p = paula.position, medio = tmp.set(p.x * 0.35 + POS_CAJA.x * 0.65, 0.55, p.z * 0.35 + POS_CAJA.z * 0.65);
    const d = vertical ? 3.0 : 2.4;
    objetivoCam.lerp(medio, 1 - Math.exp(-dt * 2.0));
    posCam.lerp(new THREE.Vector3(medio.x + 0.75, 1.45 + d * 0.12, medio.z + d), 1 - Math.exp(-dt * 1.3));
  } else if (estado.fase === "entrando" || estado.fase === "recuerdos") {
    // la cámara se mete en la luz del regalo
    objetivoCam.lerp(tmp.set(POS_CAJA.x, 0.45, POS_CAJA.z), 1 - Math.exp(-dt * 1.6));
    posCam.lerp(tmp.set(POS_CAJA.x + 0.12, 1.15, POS_CAJA.z + 0.85), 1 - Math.exp(-dt * 0.55));
  } else {
    const p = paula ? paula.position : new THREE.Vector3();
    const medio = tmp.set((p.x + POS_CAJA.x) / 2, 1.05, (p.z + POS_CAJA.z) / 2);
    const lejos = THREE.MathUtils.clamp(p.distanceTo(POS_CAJA), 1.5, 6);
    const dist = (vertical ? 4.2 + lejos * 0.55 : 3.6 + lejos * 0.35);
    const deseada = new THREE.Vector3(medio.x + (vertical ? 0.25 : 0.9), 1.15 + dist * 0.11, medio.z + dist);
    if (inmediato) { objetivoCam.copy(medio); posCam.copy(deseada); }
    objetivoCam.lerp(medio, 1 - Math.exp(-dt * 3)); posCam.lerp(deseada, 1 - Math.exp(-dt * 1.8));
  }
  camara.position.copy(posCam); camara.lookAt(objetivoCam);
}
function redimensiona() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
  camara.aspect = w / h; camara.fov = w < h ? 46 : 38; camara.updateProjectionMatrix();
}
addEventListener("resize", redimensiona); redimensiona();

let primero = true;
renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.05), t = reloj.elapsedTime;
  if (paula && primero) { encuadre(dt, true); primero = false; }
  // animaciones con tiempo
  for (let i = anim.length - 1; i >= 0; i--) {
    const a = anim[i]; if (t < a.t0) continue;
    const k = Math.min((t - a.t0) / a.dur, 1); a.fn(k); if (k >= 1) { anim.splice(i, 1); a.fin && a.fin(); }
  }
  if (paula && (estado.fase === "juego" || estado.fase === "cerca")) {
    // teclado
    const tk = estado.teclas, dir = new THREE.Vector3((tk.arrowright || tk.d ? 1 : 0) - (tk.arrowleft || tk.a ? 1 : 0), 0, (tk.arrowdown || tk.s ? 1 : 0) - (tk.arrowup || tk.w ? 1 : 0));
    if (dir.lengthSq()) { estado.tocado = true; ui.pista.classList.add("oculto"); estado.objetivo = destinoCercaDeLaCaja(paula.position.clone().add(dir.setLength(0.6))); }
    // si no toca nada, va sola
    if (!estado.tocado && t - estado.inicioJuego > CONFIG.esperaAuto && !estado.objetivo) estado.objetivo = destinoCercaDeLaCaja(POS_CAJA.clone());
    if (estado.objetivo) {
      const d = estado.objetivo.clone().sub(paula.position); d.y = 0;
      const dist = d.length();
      if (dist > 0.05) {
        pon("Walk_Loop", 0.25);
        const paso = Math.min(dist, CONFIG.velocidad * dt);
        paula.position.add(d.setLength(paso));
        const ang = Math.atan2(d.x, d.z); let da = ang - paula.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
        paula.rotation.y += da * Math.min(1, dt * 10);
      } else { estado.objetivo = null; pon("Idle_Loop", 0.3); }
    }
    // no atraviesa la caja
    const fuera = paula.position.clone().sub(POS_CAJA); fuera.y = 0;
    if (fuera.length() < 0.8) paula.position.copy(POS_CAJA).add(fuera.setLength(0.8));
    const cerca = paula.position.distanceTo(POS_CAJA) < 1.25;
    if (cerca && estado.fase === "juego") { estado.fase = "cerca"; ui.abrir.classList.remove("oculto"); ui.pista.classList.add("oculto"); }
    if (!cerca && estado.fase === "cerca") { estado.fase = "juego"; ui.abrir.classList.add("oculto"); }
    if (estado.fase === "cerca" && !estado.objetivo) {   // se gira hacia el regalo
      const m = POS_CAJA.clone().sub(paula.position); let da = Math.atan2(m.x, m.z) - paula.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
      paula.rotation.y += da * Math.min(1, dt * 4);
    }
  }
  if (mezclador) mezclador.update(dt);
  if (marca.material.opacity > 0) { marca.material.opacity = Math.max(0, marca.material.opacity - dt * 1.2); marca.scale.multiplyScalar(1 + dt * 0.8); }
  ambiente.actualizar(t, dt); regalo.actualizar(t, dt);
  if (caja && estado.fase !== "abriendo" && estado.fase !== "entrando" && estado.fase !== "recuerdos") caja.position.y = Math.max(0, Math.sin(t * 3.2) * 0.012);
  if (confeti.userData.activo) {
    const a = confeti.geometry.attributes.position, v = confeti.userData.vel;
    for (let i = 0; i < v.length; i++) { v[i].y -= 6.5 * dt; v[i].multiplyScalar(1 - dt * 0.6); a.setXYZ(i, a.getX(i) + v[i].x * dt, Math.max(0.01, a.getY(i) + v[i].y * dt), a.getZ(i) + v[i].z * dt); }
    a.needsUpdate = true;
  }
  if (estado.fase !== "recuerdos" || ui.destello.style.opacity !== "0") { encuadre(dt); renderer.render(escena, camara); }
});
