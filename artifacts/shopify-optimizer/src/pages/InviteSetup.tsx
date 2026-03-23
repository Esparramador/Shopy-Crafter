import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Loader2, Eye, EyeOff } from "lucide-react";
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

  const shell: React.CSSProperties = {
    minHeight: "100vh",
    background: "var(--ink)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 440,
    background: "var(--srf)",
    border: "1px solid var(--bdr)",
    borderRadius: 16,
    padding: "40px 36px",
  };

  if (loading) {
    return (
      <div style={shell}>
        <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
      </div>
    );
  }

  if (invalid || !inviteData) {
    return (
      <div style={shell}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(220,53,69,0.12)", border: "1px solid rgba(220,53,69,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 28,
          }}>
            🔒
          </div>
          <h1 style={{ fontFamily: "var(--fh)", fontSize: 24, fontStyle: "italic", marginBottom: 8 }}>
            Enlace inválido
          </h1>
          <p style={{ color: "var(--t3)", fontSize: 13 }}>
            Este enlace de invitación ha expirado o ya fue utilizado.
          </p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={shell}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(45,212,159,0.12)", border: "1px solid rgba(45,212,159,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 28,
          }}>
            ✅
          </div>
          <h1 style={{ fontFamily: "var(--fh)", fontSize: 24, fontStyle: "italic", marginBottom: 8, color: "var(--jade)" }}>
            ¡Cuenta activada!
          </h1>
          <p style={{ color: "var(--t3)", fontSize: 13 }}>Redirigiendo a tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
            fontSize: 24, marginBottom: 16, boxShadow: "0 4px 20px rgba(200,168,75,0.35)",
          }}>
            ⚡
          </div>
          <h1 style={{ fontFamily: "var(--fh)", fontSize: 26, fontStyle: "italic", fontWeight: 400, marginBottom: 4 }}>
            Configura tu acceso
          </h1>
          <p style={{ fontSize: 13, color: "var(--t3)" }}>
            Bienvenido, <span style={{ color: "var(--gold2)", fontWeight: 600 }}>{inviteData.name}</span>
          </p>
        </div>

        {/* Card */}
        <div style={card}>
          <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 24, lineHeight: 1.6 }}>
            Crea una contraseña segura para acceder a tu panel de tienda como{" "}
            <span style={{ color: "var(--t1)", fontWeight: 500 }}>{inviteData.email}</span>.
          </p>

          <form onSubmit={handleSetup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Password field */}
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
                textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 8,
              }}>
                Nueva contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  style={{
                    width: "100%", padding: "11px 44px 11px 14px", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                    borderRadius: 8, color: "var(--t1)", fontSize: 14,
                    outline: "none", transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--t3)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm field */}
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "1.2px",
                textTransform: "uppercase", color: "var(--t3)", display: "block", marginBottom: 8,
              }}>
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repetir contraseña"
                style={{
                  width: "100%", padding: "11px 14px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                  borderRadius: 8, color: "var(--t1)", fontSize: 14,
                  outline: "none", transition: "border-color 0.15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
              />
            </div>

            {error && (
              <div style={{
                background: "rgba(220,53,69,0.08)", border: "1px solid rgba(220,53,69,0.2)",
                borderRadius: 8, padding: "10px 14px", color: "var(--crim)", fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg,var(--gold) 0%,var(--gold2) 100%)",
                color: "#0a0a14", fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "opacity 0.15s",
              }}
            >
              {submitting && <Loader2 size={15} style={{ animation: "spin 0.6s linear infinite" }} />}
              {submitting ? "Configurando..." : "Activar cuenta"}
            </button>
          </form>

          <p style={{ fontSize: 11, color: "var(--t3)", textAlign: "center", marginTop: 20 }}>
            Plataforma exclusiva · Solo usuarios autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
