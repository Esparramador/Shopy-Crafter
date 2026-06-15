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
