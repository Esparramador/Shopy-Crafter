import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";

/**
 * Indicador de progreso "vivo" para operaciones largas en las que el backend
 * devuelve un único response al final (no streaming).
 *
 * Muestra:
 *  - Spinner animado
 *  - Mensaje principal (rotativo si se pasan varios)
 *  - Tiempo transcurrido (mm:ss) actualizado cada segundo
 *  - Tiempo estimado (opcional) y aviso si nos pasamos
 *  - Barra de progreso opcional (porcentaje real si lo conocemos)
 *
 * Es honesto: no inventa porcentajes falsos. Si no sabemos % real,
 * mostramos elapsed time y mensaje rotativo, así el usuario ve actividad
 * y sabe exactamente cuánto lleva esperando.
 */
export function LiveOperation({
  active,
  title,
  messages,
  rotateEverySec = 5,
  estimatedSec,
  percent,
  variant = "info",
  className = "",
}: {
  active: boolean;
  title?: string;
  /** Lista de mensajes que se van rotando para que el usuario vea movimiento */
  messages: string[];
  rotateEverySec?: number;
  /** Tiempo estimado en segundos. Si nos pasamos, mostramos aviso. */
  estimatedSec?: number;
  /** Porcentaje real (0-100) si el backend lo proporciona. */
  percent?: number;
  variant?: "info" | "warn" | "success";
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!active) { setElapsed(0); setMsgIdx(0); return; }
    setElapsed(0);
    setMsgIdx(0);
    const t0 = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    const rotate = messages.length > 1
      ? setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), Math.max(2, rotateEverySec) * 1000)
      : null;
    return () => {
      clearInterval(tick);
      if (rotate) clearInterval(rotate);
    };
  }, [active, messages.length, rotateEverySec]);

  if (!active) return null;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const isOver = estimatedSec ? elapsed > estimatedSec : false;
  const currentMsg = messages[msgIdx] ?? messages[0] ?? "Procesando...";

  const colors = variant === "warn"
    ? { border: "rgba(234, 179, 8, 0.35)", bg: "rgba(234, 179, 8, 0.08)", text: "rgb(250, 204, 21)" }
    : variant === "success"
    ? { border: "rgba(34, 197, 94, 0.35)", bg: "rgba(34, 197, 94, 0.08)", text: "rgb(74, 222, 128)" }
    : { border: "rgba(91, 78, 255, 0.35)", bg: "rgba(91, 78, 255, 0.08)", text: "rgb(167, 139, 250)" };

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Loader2 className="animate-spin" style={{ width: 18, height: 18, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          {title && <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>}
          <div style={{ opacity: 0.92 }}>{currentMsg}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums", fontSize: 12, opacity: 0.85 }}>
          <Clock style={{ width: 14, height: 14 }} />
          <span>{fmt(elapsed)}{estimatedSec ? ` / ~${fmt(estimatedSec)}` : ""}</span>
        </div>
      </div>

      {typeof percent === "number" && percent >= 0 && (
        <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, percent))}%`,
              height: "100%",
              background: "currentColor",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      )}

      {isOver && (
        <div style={{ fontSize: 11, opacity: 0.8, fontStyle: "italic" }}>
          Está tardando más de lo previsto. Sigue procesando — espera o cancela si has esperado demasiado.
        </div>
      )}
    </div>
  );
}
