import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useCmsSection } from "@/contexts/CmsContext";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ResetPassword() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { t } = useCmsSection("labels.resetPassword");

  const strengthScore = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const defaultStrength = ["", "Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"];
  const strengthLabel = defaultStrength[strengthScore];
  const strengthColor = ["", "#e84558", "#f0a030", "#c8a84b", "#2dd49f", "#2dd49f"][strengthScore];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError(t("errorNoToken", "Token de recuperación no encontrado en la URL."));
      return;
    }
    if (password.length < 8) {
      setError(t("errorMinLength", "La contraseña debe tener al menos 8 caracteres."));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("errorMismatch", "Las contraseñas no coinciden."));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error ?? "Error al restablecer la contraseña.");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Enlace inválido</h1>
          <p className="text-gray-400 text-sm mb-6">
            Este enlace no contiene un token de recuperación válido. Solicita uno nuevo desde la página de recuperación.
          </p>
          <Link href="/forgot-password" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4">
            <Lock size={22} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nueva contraseña</h1>
          <p className="text-gray-400 text-sm mt-2">
            Introduce tu nueva contraseña para restablecer el acceso
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
              <h2 className="text-white font-semibold text-lg mb-2">Contraseña actualizada</h2>
              <p className="text-gray-400 text-sm mb-6">
                Tu contraseña se ha restablecido correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
              </p>
              <Link href="/login" className="inline-block py-2.5 px-6 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 transition-all">
                Ir al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          style={{
                            height: 3,
                            flex: 1,
                            borderRadius: 2,
                            background: i <= strengthScore ? strengthColor : "rgba(255,255,255,0.1)",
                            transition: "background 0.2s",
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    style={{
                      borderColor: confirmPassword && password && confirmPassword !== password
                        ? "rgba(232,69,88,0.5)"
                        : undefined,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && password && confirmPassword !== password && (
                  <p className="text-red-400 text-xs mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!!confirmPassword && password !== confirmPassword)}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 transition-all"
              >
                {loading ? "Restableciendo..." : "Restablecer contraseña"}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-gray-400 hover:text-white text-sm inline-flex items-center gap-1.5 transition-colors">
                  <ArrowLeft size={14} />
                  Volver al login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
