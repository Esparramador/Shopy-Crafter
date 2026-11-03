/* arranque.js — monta la escena «caída» (app.js) en /instagram/ y nunca bloquea.
 *
 * Opciones de montaje (03/11/2026): botón a los 3,8 s, salto a los 9,8 s
 * (segundos 4,5 + espera_s 5,3 = 6 s de botón en pantalla). Sin eval: la escena
 * carga three con import() nativo, que la CSP permite por script-src jsDelivr.
 *
 * Red de seguridad: si app.js no llega, no deja IntroLogo3D o `montar` lanza, se
 * va en el acto; y pase lo que pase, a segundos + espera_s + 6 (15,8 s) también.
 * Salvo al VOLVER ATRÁS (back_forward / bfcache): entonces la escena se queda
 * quieta con su botón, y aquí tampoco se empuja a nadie fuera.
 */
(function () {
  "use strict";
  var O = {
    destino: "https://www.instagram.com/shopycrafter/",
    marca: "Shopy Crafter",
    usuario: "@shopycrafter",
    segundos: 4.5,
    espera_s: 5.3,
    redirigir: true,
  };
  // Arnés de control de calidad: `?t=2.3` deja la escena quieta en ese segundo,
  // sin irse (ni la escena ni esta red). Para capturas por cuadro; nada más.
  var congelar = NaN;
  try { congelar = parseFloat(new URLSearchParams(location.search).get("t")); } catch (e) { /* sin arnés */ }
  if (isFinite(congelar)) O.congelar_t = congelar;
  var hecho = false;
  function volviendo() {
    try {
      var n = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      return !!(n && n.type === "back_forward");
    } catch (e) { return false; }
  }
  function ir() {
    if (hecho) return;
    hecho = true;
    try { location.replace(O.destino); } catch (e) { location.href = O.destino; }
  }
  var red = null;
  function arrancar() {
    var I = window.IntroLogo3D;
    if (!I || typeof I.montar !== "function") return ir();
    if (!volviendo() && !isFinite(congelar)) red = setTimeout(ir, (O.segundos + O.espera_s + 6) * 1000);
    try { window.__intro = I.montar(document.getElementById("intro3d"), O); }
    catch (e) { ir(); }
  }
  window.addEventListener("pageshow", function (ev) {
    if (ev.persisted) { hecho = true; if (red) clearTimeout(red); }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();
})();
