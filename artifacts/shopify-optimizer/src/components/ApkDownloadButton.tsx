import { useState } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/** Descarga la APK de Android solo si el servidor confirma que está disponible. */
export default function ApkDownloadButton({ labels }: { labels?: { idle: string; checking: string; downloading: string; building: string; unavailable: string } }) {
  const [status, setStatus] = useState<"idle" | "checking" | "downloading" | "unavailable">("idle");
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);
  const lb = labels ?? { idle: "📱 Descargar App Android", checking: "Verificando...", downloading: "⬇ Descargando...", building: "🔜 Disponible próximamente", unavailable: "No disponible" };

  const handleClick = async () => {
    if (status === "downloading") return;
    setStatus("checking");
    try {
      const r = await fetch(`${API_BASE}/api/apk/status`);
      const data = await r.json() as { available: boolean; building?: boolean };
      if (data.available) {
        setApkAvailable(true);
        setStatus("downloading");
        const a = document.createElement("a");
        a.href = `${API_BASE}/api/apk/download`;
        a.download = "ShopyCrafter.apk";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => setStatus("idle"), 3000);
      } else if (data.building) {
        setApkAvailable(false);
        setStatus("unavailable");
        setTimeout(() => setStatus("idle"), 4000);
      } else {
        setApkAvailable(false);
        setStatus("unavailable");
        setTimeout(() => setStatus("idle"), 4000);
      }
    } catch {
      setStatus("idle");
    }
  };

  const label = status === "checking" ? lb.checking
    : status === "downloading" ? lb.downloading
    : status === "unavailable" ? (apkAvailable === false ? lb.building : lb.unavailable)
    : lb.idle;

  return (
    <button
      onClick={handleClick}
      disabled={status !== "idle"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
        padding: "10px 22px",
        borderRadius: 10,
        background: status === "downloading" ? "rgba(45,212,159,0.15)" : "rgba(200,168,75,0.08)",
        border: `1px solid ${status === "downloading" ? "rgba(45,212,159,0.5)" : "rgba(200,168,75,0.35)"}`,
        color: status === "downloading" ? "#2dd49f" : "#c8a84b",
        fontSize: 13,
        fontWeight: 600,
        cursor: status !== "idle" ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        letterSpacing: 0.2,
        opacity: status !== "idle" && status !== "downloading" ? 0.75 : 1,
      }}
    >
      {label}
    </button>
  );
}

