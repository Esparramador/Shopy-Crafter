import { createRoot } from "react-dom/client";
import App from "./App";
import "./design-system.css";
import { installLongRunningFetchFix } from "./lib/long-running-fetch";

installLongRunningFetchFix();

// Tras un despliegue, una pestaña vieja pide chunks que ya no existen: se recarga una sola vez por ruta.
window.addEventListener("vite:preloadError", e => {
  const k = `sc-reload:${location.pathname}`;
  if (sessionStorage.getItem(k)) return;
  e.preventDefault();
  sessionStorage.setItem(k, "1");
  location.reload();
});

// La portada baja su chunk en paralelo con el resto, no después de montar la app.
if (window.location.pathname === "/") void import("@/pages/Landing");

createRoot(document.getElementById("root")!).render(<App />);
