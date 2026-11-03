import { createRoot } from "react-dom/client";
import App from "./App";
import "./design-system.css";
import { installLongRunningFetchFix } from "./lib/long-running-fetch";

installLongRunningFetchFix();

// La portada baja su chunk en paralelo con el resto, no después de montar la app.
if (window.location.pathname === "/") void import("@/pages/Landing");

createRoot(document.getElementById("root")!).render(<App />);
