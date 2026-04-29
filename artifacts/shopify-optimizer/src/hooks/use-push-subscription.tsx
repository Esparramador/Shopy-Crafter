import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type PushState = "unsupported" | "denied" | "default" | "granted-not-subscribed" | "subscribed" | "checking";

// urlBase64ToUint8Array: convert VAPID public key from base64url to Uint8Array
// (PushManager.subscribe requires this format)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) arr[i] = rawData.charCodeAt(i);
  return arr;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined") { setState("unsupported"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported"); return;
    }
    if (Notification.permission === "denied") { setState("denied"); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (Notification.permission === "default") setState("default");
      else if (sub) setState("subscribed");
      else setState("granted-not-subscribed");
    } catch (e: any) {
      setError(e?.message || "Error verificando suscripción");
      setState("default");
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register("/service-worker.js");
      await navigator.serviceWorker.ready;

      // 2. Request permission if not granted
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setState(perm === "denied" ? "denied" : "default"); setBusy(false); return; }
      }

      // 3. Get VAPID public key from server
      const keyRes = await fetch(`${API_BASE}/api/push/vapid-key`, { credentials: "include" });
      const keyData = await keyRes.json();
      if (!keyData.configured || !keyData.key) {
        setError("Las claves VAPID no están configuradas en el servidor. Configúralas desde Ajustes → Push Notifications.");
        setBusy(false);
        return;
      }

      // 4. Subscribe via PushManager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.key) as unknown as BufferSource,
      });

      // 5. Send subscription to backend
      const subRes = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!subRes.ok) {
        const d = await subRes.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${subRes.status}`);
      }
      setState("subscribed");
    } catch (e: any) {
      setError(e?.message || "Error al activar notificaciones");
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) await sub.unsubscribe();
      await fetch(`${API_BASE}/api/push/subscribe`, { method: "DELETE", credentials: "include" });
      setState("granted-not-subscribed");
    } catch (e: any) {
      setError(e?.message || "Error al desactivar");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, subscribe, unsubscribe, refresh };
}

// ─── Button component for easy embedding (e.g., in Settings or Sidebar) ────
export function PushNotificationsButton() {
  const { state, busy, error, subscribe, unsubscribe } = usePushSubscription();

  if (state === "unsupported") {
    return <div style={{ fontSize: 11, color: "var(--t3, #888)" }}>Tu navegador no soporta notificaciones push.</div>;
  }

  if (state === "denied") {
    return (
      <div style={{ fontSize: 11, color: "#ef4444" }}>
        Notificaciones bloqueadas. Desbloquea desde la configuración del navegador (candado en la barra de URL).
      </div>
    );
  }

  return (
    <div>
      {state === "subscribed" ? (
        <button onClick={unsubscribe} disabled={busy}
          style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
            background: "rgba(45,212,159,0.1)", color: "#2dd49f", border: "1px solid rgba(45,212,159,0.3)",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          {busy ? "..." : "🔔 Notificaciones activas — desactivar"}
        </button>
      ) : (
        <button onClick={subscribe} disabled={busy || state === "checking"}
          style={{
            padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer",
            background: "var(--gold, #c8a84b)", color: "#000", border: "none",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          {busy ? "Activando..." : "🔔 Activar notificaciones push"}
        </button>
      )}
      {error && <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444" }}>{error}</div>}
    </div>
  );
}
