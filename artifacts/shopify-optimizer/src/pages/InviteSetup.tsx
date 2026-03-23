import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, Store, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function InviteSetupPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const [, navigate] = useLocation();
  const { refresh } = useAuth();

  const [inviteData, setInviteData] = useState<{ name: string; email: string; projectId: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/auth/invite/${token}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { setInviteData(d); setLoading(false); })
      .catch(() => { setInvalid(true); setLoading(false); });
  }, [token]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (password.length < 8) { setError("Mínimo 8 caracteres"); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/invite/${token}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      await refresh();
      setTimeout(() => navigate("/client"), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al configurar la cuenta");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5b4eff] animate-spin" />
      </div>
    );
  }

  if (invalid || !inviteData) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Enlace inválido</h1>
          <p className="text-white/40">Este enlace de invitación ha expirado o ya fue usado.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">¡Cuenta activada!</h1>
          <p className="text-white/40">Redirigiendo a tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#5b4eff]/20 border border-[#5b4eff]/30 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-[#5b4eff]" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configura tu acceso</h1>
          <p className="text-white/40 mt-1">Hola, {inviteData.name}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <p className="text-sm text-white/60 mb-6">
            Crea una contraseña para acceder a tu panel de tienda como{" "}
            <span className="text-white">{inviteData.email}</span>.
          </p>
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-white/60 uppercase tracking-wider block mb-2">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required autoComplete="new-password"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-[#5b4eff]/50 transition-colors"
                  placeholder="Mínimo 8 caracteres"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 uppercase tracking-wider block mb-2">
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required autoComplete="new-password"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5b4eff]/50 transition-colors"
                placeholder="Repetir contraseña"
              />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#5b4eff] text-white py-3 rounded-xl font-semibold hover:bg-[#4a3ef0] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Configurando..." : "Activar cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
