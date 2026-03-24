import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { role } = await login(email, password);
      navigate(role === "admin" ? "/" : "/client");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-gem">⚡</div>
          <h1>Shopify<em>AI</em></h1>
          <p>Plataforma de agencia premium</p>
        </div>

        {/* Card */}
        <div className="login-card">
          <p className="login-title">Iniciar sesión</p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="tu@email.com"
              />
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  className="form-input"
                  style={{ paddingRight: 40 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute", right: 10, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none",
                    cursor: "pointer", color: "var(--t3)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  background: "rgba(232,69,88,0.08)",
                  border: "1px solid rgba(232,69,88,0.2)",
                  borderRadius: "var(--r)",
                  padding: "10px 12px",
                  color: "var(--crim)",
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`btn btn-gold${loading ? " loading" : ""}`}
              style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "11px 16px" }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? "Iniciando sesión..." : "Entrar"}
            </button>
          </form>

          {/* Forgot password */}
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: 12, color: "var(--t3)", textDecoration: "none" }}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {/* Footer hint */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--bdr)", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--t3)", opacity: 0.6 }}>
              Plataforma exclusiva · Solo usuarios autorizados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
