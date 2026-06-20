import { useGame } from "../lib/gameStore";

export function DialogBox() {
  const { dialogOpen, dialogNpcName, dialogText, dialogLoading, closeDialog } = useGame();

  if (!dialogOpen) return null;

  return (
    <div className="dialog-box" style={{ pointerEvents: "all" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
            💬 Diálogo
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#ffd700" }}>{dialogNpcName}</div>
        </div>
        <button
          onClick={closeDialog}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        >✕</button>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.9)", minHeight: 40 }}>
        {dialogLoading ? (
          <span style={{ color: "rgba(255,255,255,0.4)", fontStyle: "italic" }}>Pensando…</span>
        ) : dialogText}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={closeDialog}>
          Cerrar (Esc)
        </button>
      </div>
    </div>
  );
}
