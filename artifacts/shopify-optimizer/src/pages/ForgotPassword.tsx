import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error ?? "Error al procesar la solicitud");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mx-auto mb-4">
            <Mail size={22} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold text-white">Recuperar contraseña</h1>
          <p className="text-gray-400 text-sm mt-2">
            Introduce tu email y te enviaremos un enlace de recuperación
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-emerald-400 mx-auto mb-4" />
              <h2 className="text-white font-semibold text-lg mb-2">Email enviado</h2>
              <p className="text-gray-400 text-sm mb-6">
                Si el email está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
              </p>
              <Link href="/login" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
                ← Volver al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="tu@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 transition-all"
              >
                {loading ? "Enviando…" : "Enviar enlace de recuperación"}
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
