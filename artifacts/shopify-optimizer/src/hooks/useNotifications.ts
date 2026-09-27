import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export function showLocalNotification(title: string, body: string, url = "/") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: `sc-${Date.now()}`,
    });
  } catch {}
}

export function useNotifications() {
  const { user } = useAuth();
  const doneRef = useRef(false);

  useEffect(() => {
    if (!user || doneRef.current) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    doneRef.current = true;

    const setup = async () => {
      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
      }
      if (perm !== "granted") return;

      try {
        const r = await fetch(`${API}/push/vapid-key`, { credentials: "include" });
        if (!r.ok) return;
        const { key: publicKey } = await r.json() as { key: string | null };
        if (!publicKey) return;

        const reg = await navigator.serviceWorker.ready;
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });

        await fetch(`${API}/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch (err) {
        console.warn("[notifications] push registration failed:", err);
      }
    };

    setup().catch(console.warn);
  }, [user]);
}

export function useCalendarReminders() {
  const { user } = useAuth();
  const notifiedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    if (!("Notification" in window)) return;

    const check = async () => {
      if (Notification.permission !== "granted") return;
      try {
        // /calendar/events devuelve { appointments } con meeting_date/client_name
        // (antes se leían data.events/ev.start y nunca saltaba ningún aviso).
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const r = await fetch(`${API}/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: "include" });
        if (!r.ok) return;
        const data = await r.json() as { appointments?: Array<{ id: number; meeting_date: string; client_name?: string; company?: string; status?: string }> };
        const events = Array.isArray(data.appointments) ? data.appointments : [];
        const now = Date.now();
        for (const ev of events) {
          if (ev.status === "cancelled" || ev.status === "completed") continue;
          const start = new Date(ev.meeting_date).getTime();
          const diffMin = (start - now) / 60000;
          const key = String(ev.id);
          if (diffMin > 0 && diffMin <= 20 && !notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            new Notification(`📅 Reunión en ${Math.round(diffMin)} min`, {
              body: [ev.client_name, ev.company].filter(Boolean).join(" · ") || "Cita próxima",
              icon: "/favicon.png",
              badge: "/favicon.png",
              tag: `meeting-${key}`,
              requireInteraction: true,
            });
          }
        }
      } catch {}
    };

    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);
}
