import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  clientId: string | null;
  avatarColor: string;
  impersonating?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isOnline: boolean;
  login: (email: string, password: string) => Promise<{ role: string; clientId: string | null }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const LAST_ROUTE_KEY = "sc_last_route";
const SESSION_ALIVE_KEY = "sc_session_alive";

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function saveLastRoute(path: string) {
  try {
    if (
      path &&
      !path.startsWith("/login") &&
      !path.startsWith("/landing") &&
      !path.startsWith("/mockup-sandbox") &&
      !path.startsWith("/mockup") &&
      path !== "/"
    ) {
      localStorage.setItem(LAST_ROUTE_KEY, path);
    }
  } catch {}
}

export function getLastRoute(): string | null {
  try {
    return localStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}

export function clearLastRoute() {
  try { localStorage.removeItem(LAST_ROUTE_KEY); } catch {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const refreshingRef = useRef(false);
  const visibilityRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const u = await fetchMe();
      setUser(u);
      if (u) {
        try { localStorage.setItem(SESSION_ALIVE_KEY, "1"); } catch {}
      }
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchMe().then((u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        try { localStorage.setItem(SESSION_ALIVE_KEY, "1"); } catch {}
      }
    });
  }, []);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      refresh();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && user) {
        if (visibilityRefreshTimer.current) clearTimeout(visibilityRefreshTimer.current);
        visibilityRefreshTimer.current = setTimeout(() => refresh(), 500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (visibilityRefreshTimer.current) clearTimeout(visibilityRefreshTimer.current);
    };
  }, [user, refresh]);

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error("No se puede conectar con el servidor. Intenta de nuevo en unos segundos.");
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      throw new Error("El servidor no responde correctamente. Espera unos segundos e intenta de nuevo.");
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Error al iniciar sesión");
    const u = await fetchMe();
    setUser(u);
    try { localStorage.setItem(SESSION_ALIVE_KEY, "1"); } catch {}
    return { role: data.role, clientId: data.clientId };
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
    clearLastRoute();
    try { localStorage.removeItem(SESSION_ALIVE_KEY); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, isOnline, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
