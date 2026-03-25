import { useEffect, useCallback, useRef, useState } from "react";

const DEBOUNCE_MS = 800;

export function useDraftPersistence<T>(
  key: string,
  data: T,
  setData: (d: T) => void,
  opts?: { enabled?: boolean; debounceMs?: number }
) {
  const enabled = opts?.enabled ?? true;
  const debounce = opts?.debounceMs ?? DEBOUNCE_MS;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!enabled || loaded.current) return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; savedAt: number };
        const age = Date.now() - (parsed.savedAt || 0);
        if (age < 24 * 60 * 60 * 1000) {
          setData(parsed.data);
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {
      localStorage.removeItem(key);
    }
    loaded.current = true;
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled || !loaded.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
      } catch {}
    }, debounce);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [key, data, enabled, debounce]);

  const clear = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  return { clear };
}

export function useBeforeUnload(hasChanges: boolean) {
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);
}

export function useAutoReconnectSSE(
  url: string,
  eventHandlers: Record<string, () => void>,
  opts?: { enabled?: boolean }
) {
  const enabled = opts?.enabled ?? true;
  const esRef = useRef<EventSource | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (esRef.current) { try { esRef.current.close(); } catch {} }
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => { retryCount.current = 0; });

    for (const [event, handler] of Object.entries(eventHandlers)) {
      es.addEventListener(event, handler);
    }

    es.onerror = () => {
      es.close();
      esRef.current = null;
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000);
      retryCount.current++;
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [url, eventHandlers]);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      if (esRef.current) { try { esRef.current.close(); } catch {} }
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [enabled, connect]);
}

export function useOnlineStatus(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      wasOffline.current = true;
    };
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        onReconnect?.();
      }
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [onReconnect]);

  return { isOnline };
}

export function useRetryFetch() {
  return useCallback(async (url: string, options?: RequestInit, maxRetries = 3): Promise<Response> => {
    let lastError: Error | null = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.ok || res.status < 500) return res;
        lastError = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastError = e as Error;
      }
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    throw lastError;
  }, []);
}
