import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useCmsSection } from "@/contexts/CmsContext";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useCmsSection("labels.login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { role } = await login(email, password);
      navigate(role === "admin" ? "/home" : "/client");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("loginError", "Error al iniciar sesión"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div className="login-logo">
          <div className="logo-gem">⚡</div>
          <h1>Shopy<em>Crafter</em></h1>
          <p>{t("subtitle", "Plataforma de agencia premium")}</p>
        </div>

        <div className="login-card">
          <p className="login-title">{t("heading", "Iniciar sesión")}</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t("email", "Email")}</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder={t("emailPlaceholder", "tu@email.com")}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("password", "Contraseña")}</label>
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

            <button
              type="submit"
              disabled={loading}
              className={`btn btn-gold${loading ? " loading" : ""}`}
              style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "11px 16px" }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? t("loggingIn", "Iniciando sesión...") : t("loginBtn", "Entrar")}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Link
              href="/forgot-password"
              style={{ fontSize: 12, color: "var(--t3)", textDecoration: "none" }}
            >
              {t("forgotPassword", "¿Olvidaste tu contraseña?")}
            </Link>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--bdr)", textAlign: "center" }}>
            <p style={{ fontSize: 10, color: "var(--t3)", opacity: 0.6 }}>
              Shopy Crafter &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
