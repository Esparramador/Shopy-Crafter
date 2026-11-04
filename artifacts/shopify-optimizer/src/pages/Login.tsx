import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, getLastRoute, clearLastRoute } from "@/contexts/AuthContext";
import { useCmsSection } from "@/contexts/CmsContext";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import "./login.css";

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
      const savedRoute = getLastRoute();
      if (savedRoute && role === "admin") {
        clearLastRoute();
        navigate(savedRoute);
      } else {
        navigate(role === "admin" ? "/home" : "/client");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("loginError", "Error al iniciar sesión"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <aside className="lg-brand" aria-label="Qué encontrarás dentro">
        <Link href="/" className="lg-brand-logo" aria-label="Shopy Crafter, volver al inicio">
          <span className="lg-gem" aria-hidden="true">SC</span>
          <span>Shopy<em>Crafter</em></span>
        </Link>
        <div className="lg-brand-copy">
          <p className="lg-eyebrow">Portal de cliente</p>
          <h2>Tu proyecto, <em>a la vista.</em></h2>
          <ul>
            <li><b>Aprobaciones</b><span>Nada se publica sin tu visto bueno.</span></li>
            <li><b>Informes</b><span>Resultados y próximos pasos en un solo sitio.</span></li>
            <li><b>Mensajes</b><span>Hablas con el equipo sin perder el hilo.</span></li>
          </ul>
        </div>
        <p className="lg-brand-foot">Shopy Crafter &copy; {new Date().getFullYear()}</p>
      </aside>

      <main className="lg-main">
        <Link href="/" className="lg-back"><ArrowLeft size={14} aria-hidden="true" /> Volver al inicio</Link>
        <div className="lg-card">
          <h1>{t("heading", "Iniciar sesión")}</h1>
          <p className="lg-sub">{t("subtitle2", "Accede a tu panel con tu email y tu contraseña.")}</p>

          <form onSubmit={handleSubmit} noValidate={false}>
            <label className="lg-field" htmlFor="lg-email">
              <span>{t("email", "Email")}</span>
              <input id="lg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                autoComplete="username" inputMode="email" placeholder={t("emailPlaceholder", "tu@email.com")} />
            </label>

            <label className="lg-field" htmlFor="lg-pw">
              <span className="lg-pw-row">{t("password", "Contraseña")}
                <Link href="/forgot-password" className="lg-forgot">{t("forgotPassword", "¿Olvidaste tu contraseña?")}</Link>
              </span>
              <span className="lg-pw">
                <input id="lg-pw" type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                  autoComplete="current-password" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Ocultar la contraseña" : "Mostrar la contraseña"} aria-pressed={showPw}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>

            {error && <div className="lg-error" role="alert">{error}</div>}

            <button type="submit" disabled={loading} className="lg-submit">
              {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {loading ? t("loggingIn", "Iniciando sesión...") : t("loginBtn", "Entrar")}
            </button>
          </form>

          <p className="lg-help">¿Aún no eres cliente? <Link href="/contacto">Solicita acceso</Link></p>
        </div>
      </main>
    </div>
  );
}
