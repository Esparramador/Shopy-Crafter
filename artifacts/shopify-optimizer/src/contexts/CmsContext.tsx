import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CmsContextType {
  content: Record<string, any>;
  ready: boolean;
  t: (path: string, fallback: string) => string;
  reload: () => void;
}

const CmsContext = createContext<CmsContextType>({
  content: {},
  ready: false,
  t: (_p, fb) => fb,
  reload: () => {},
});

function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function getNestedString(obj: any, path: string): string | undefined {
  const val = getNestedValue(obj, path);
  return typeof val === "string" ? val : undefined;
}

export function CmsProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Record<string, any>>({});
  const [ready, setReady] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);

  const load = useCallback(() => {
    fetch(`${API_BASE}/api/cms/content`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setContent(d);
          setReady(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!ready) return;
    function connectSSE() {
      esRef.current = new EventSource(`${API_BASE}/api/cms/events`);
      esRef.current.addEventListener("connected", () => { retriesRef.current = 0; });
      esRef.current.addEventListener("content_updated", () => { load(); });
      esRef.current.onerror = () => {
        esRef.current?.close();
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
        retriesRef.current++;
        retryRef.current = setTimeout(connectSSE, delay);
      };
    }
    connectSSE();
    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [load, ready]);

  const t = useCallback(
    (path: string, fallback: string): string => getNestedString(content, path) ?? fallback,
    [content]
  );

  return (
    <CmsContext.Provider value={{ content, ready, t, reload: load }}>
      {children}
    </CmsContext.Provider>
  );
}

export function useCms() {
  return useContext(CmsContext);
}

export function useCmsSection(section: string) {
  const { content, t } = useCms();
  const sectionT = useCallback(
    (key: string, fallback: string) => t(`${section}.${key}`, fallback),
    [section, t]
  );
  const data = getNestedValue(content, section) as Record<string, any> | undefined;
  return { data: data ?? {}, t: sectionT };
}
