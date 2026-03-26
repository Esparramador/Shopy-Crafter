import { toast } from "@/hooks/use-toast";

let initialized = false;

export function initGlobalErrorHandlers(): void {
  if (initialized) return;
  initialized = true;

  window.onerror = (message, _source, _lineno, _colno, _error) => {
    const msg = typeof message === "string" ? message : "Error inesperado";
    if (msg.includes("ResizeObserver") || msg.includes("Script error")) return;
    toast({
      title: "Error",
      description: msg.length > 120 ? msg.slice(0, 120) + "..." : msg,
      variant: "destructive",
    });
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    let msg = "Error inesperado en la aplicación";
    if (reason instanceof Error) {
      msg = reason.message;
    } else if (typeof reason === "string") {
      msg = reason;
    }
    if (msg.includes("ResizeObserver") || msg.includes("AbortError")) return;
    toast({
      title: "Error",
      description: msg.length > 120 ? msg.slice(0, 120) + "..." : msg,
      variant: "destructive",
    });
  });
}
