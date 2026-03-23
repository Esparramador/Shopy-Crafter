import { useState } from "react";
import { Eye, EyeOff, Lock, User, Shield, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminSettings() {
  const { user } = useAuth();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const strengthScore = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8)  s++;
    if (newPw.length >= 12) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();

  const strengthLabel = ["", "Muy débil", "Débil", "Aceptable", "Fuerte", "Muy fuerte"][strengthScore];
  const strengthColor = ["", "var(--crim)", "var(--amber)", "var(--gold)", "var(--jade)", "var(--jade2)"][strengthScore];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPw !== confirmPw) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPw.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar contraseña");
      setSuccess("¡Contraseña actualizada correctamente!");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(200,168,75,0.1)", border: "1px solid var(--bdr)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield size={18} style={{ color: "var(--gold2)" }} />
          </div>
          <h1 className="section-title" style={{ margin: 0 }}>Ajustes de cuenta</h1>
        </div>
        <p className="section-subtitle">Gestiona tu perfil y seguridad</p>
      </div>

      {/* Perfil */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "4px 0" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--gold), var(--gold2))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, color: "#060400",
            flexShrink: 0, border: "2px solid rgba(200,168,75,0.3)",
          }}>
            {user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{user?.name ?? "Admin"}</div>
            <div style={{ fontSize: 12.5, color: "var(--t2)", marginBottom: 4 }}>{user?.email}</div>
            <span className="badge badge-gold">
              <Shield size={9} style={{ marginRight: 3 }} />
              Administrador · Acceso total
            </span>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <Lock size={15} style={{ color: "var(--gold)" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Cambiar contraseña</span>
        </div>

        <form onSubmit={handleChangePassword}>
          {/* Contraseña actual */}
          <div className="form-group">
            <label className="form-label">Contraseña actual</label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrent ? "text" : "password"}
                className="form-input"
                style={{ paddingRight: 40 }}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Tu contraseña actual"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t3)", display: "flex", alignItems: "center",
                }}
              >
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Nueva contraseña */}
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                type={showNew ? "text" : "password"}
                className="form-input"
                style={{ paddingRight: 40 }}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t3)", display: "flex", alignItems: "center",
                }}
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* Medidor de fuerza */}
            {newPw && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      height: 3, flex: 1, borderRadius: 2,
                      background: i <= strengthScore ? strengthColor : "var(--ink4)",
                      transition: "background 0.2s",
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 10.5, color: strengthColor }}>{strengthLabel}</span>
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Confirmar nueva contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirm ? "text" : "password"}
                className="form-input"
                style={{
                  paddingRight: 40,
                  borderColor: confirmPw && newPw && confirmPw !== newPw ? "rgba(232,69,88,0.5)" : undefined,
                }}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repite la nueva contraseña"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--t3)", display: "flex", alignItems: "center",
                }}
              >
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {confirmPw && newPw && confirmPw !== newPw && (
              <p style={{ fontSize: 11, color: "var(--crim)", marginTop: 4 }}>Las contraseñas no coinciden</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(232,69,88,0.08)", border: "1px solid rgba(232,69,88,0.2)",
              borderRadius: "var(--r)", padding: "10px 12px",
              color: "var(--crim)", fontSize: 13, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          {/* Éxito */}
          {success && (
            <div style={{
              background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.2)",
              borderRadius: "var(--r)", padding: "10px 12px",
              color: "var(--jade)", fontSize: 13, marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={15} />
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!!confirmPw && newPw !== confirmPw)}
            className={`btn btn-gold${loading ? " loading" : ""}`}
            style={{ minWidth: 180 }}
          >
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
        </form>

        {/* Ayuda */}
        <div style={{
          marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--bdr)",
          fontSize: 12, color: "var(--t3)", lineHeight: 1.6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <User size={11} />
            <span>Admin exclusivo: <strong style={{ color: "var(--t2)" }}>sadiagiljoan@gmail.com</strong></span>
          </div>
          <span>Usa al menos 8 caracteres con mayúsculas, números y símbolos para mayor seguridad.</span>
        </div>
      </div>
    </div>
  );
}
