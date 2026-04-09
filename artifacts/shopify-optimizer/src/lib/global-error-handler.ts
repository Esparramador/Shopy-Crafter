import { toast } from "@/hooks/use-toast";

let initialized = false;

const IGNORED_ERRORS = [
  "ResizeObserver",
  "Script error",
  "AbortError",
  "ChunkLoadError",
  "Loading chunk",
  "Failed to fetch dynamically imported module",
  "NetworkError",
  "Load failed",
  "The operation was aborted",
  "cancelled",
  "TypeError: Failed to fetch",
  "TypeError: Load failed",
  "TypeError: NetworkError",
  "The play() request was interrupted",
  "NotAllowedError",
];

function shouldIgnore(msg: string): boolean {
  return IGNORED_ERRORS.some(pattern => msg.includes(pattern));
}

export function initGlobalErrorHandlers(): void {
  if (initialized) return;
  initialized = true;

  window.onerror = (message, _source, _lineno, _colno, _error) => {
    const msg = typeof message === "string" ? message : "Error inesperado";
    if (shouldIgnore(msg)) return;
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
    if (shouldIgnore(msg)) return;
    toast({
      title: "Error",
      description: msg.length > 120 ? msg.slice(0, 120) + "..." : msg,
      variant: "destructive",
    });
  });
}
