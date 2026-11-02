import { createContext, useContext, useState, type ReactNode } from "react";

interface PreviewCtx {
  previewPid: string;
  setPreviewPid: (pid: string) => void;
}

const ClientPreviewCtx = createContext<PreviewCtx>({ previewPid: "", setPreviewPid: () => {} });

export function ClientPreviewProvider({ children }: { children: ReactNode }) {
  const [previewPid, setPreviewPidState] = useState<string>(() => {
    try { return localStorage.getItem("sc_preview_pid") ?? ""; } catch { return ""; }
  });

  const setPreviewPid = (pid: string) => {
    setPreviewPidState(pid);
    try { localStorage.setItem("sc_preview_pid", pid); } catch {}
  };

  return (
    <ClientPreviewCtx.Provider value={{ previewPid, setPreviewPid }}>
      {children}
    </ClientPreviewCtx.Provider>
  );
}

export function useClientPreview(): PreviewCtx {
  return useContext(ClientPreviewCtx);
}

/** Añade ?pid= a una URL del API cuando el admin está viendo el portal de un cliente. */
export function withPreviewPid(url: string, isAdmin: boolean, previewPid: string): string {
  return isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url;
}
