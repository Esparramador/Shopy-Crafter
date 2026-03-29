import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
  login: (email: string, password: string) => Promise<{ role: string; clientId: string | null }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const u = await fetchMe();
    setUser(u);
  };

  useEffect(() => {
    fetchMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

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
    return { role: data.role, clientId: data.clientId };
  };

  const logout = async () => {
    await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
