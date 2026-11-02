import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Botón "Copiar" con confirmación (Kit de Campañas, Vista Explosionada). */
export function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }, [text]);
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors" title="Copiar al portapapeles">
      {copied ? <><Check size={12} className="text-emerald-400" /> Copiado</> : <><Copy size={12} /> Copiar</>}
    </button>
  );
}
