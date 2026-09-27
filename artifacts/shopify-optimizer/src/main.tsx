import { createRoot } from "react-dom/client";
import App from "./App";
import "./design-system.css";
import { installLongRunningFetchFix } from "./lib/long-running-fetch";

installLongRunningFetchFix();

createRoot(document.getElementById("root")!).render(<App />);
