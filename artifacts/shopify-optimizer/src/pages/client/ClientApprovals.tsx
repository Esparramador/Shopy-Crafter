import { useEffect, useState } from "react";
import { ClientLayout } from "./ClientLayout";
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, MessageSquare } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Approval {
  id: string;
  type: string;
  title: string;
  description: string;
  beforeValue?: string;
  afterValue?: string;
  reasoning?: string;
  estimatedImpact?: string;
  status: "pending" | "approved" | "rejected";
  clientComment?: string;
  reviewedAt?: string;
  createdAt: string;
}

export default function ClientApprovals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = () => {
    fetch(`${API_BASE}/api/client/approvals`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setApprovals(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    await fetch(`${API_BASE}/api/client/approvals/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ comment: comments[id] ?? "" }),
    });
    setProcessing(null);
    load();
  };

  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  if (loading) {
    return (
      <ClientLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
          <Loader2 size={26} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div style={{ maxWidth: 760 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 24, fontWeight: 400, marginBottom: 4 }}>
            Aprobaciones Pendientes
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>
            Tu agencia necesita tu confirmación antes de aplicar estos cambios en tu tienda.
          </p>
        </div>

        {/* Pending */}
        {pending.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon" style={{ color: "var(--jade)", fontSize: 32 }}>✅</div>
            <p className="empty-title">Todo al día</p>
            <p className="empty-desc">No tienes aprobaciones pendientes por ahora.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 32 }}>
            {pending.map((item) => (
              <div key={item.id} className="card" style={{ border: "1px solid rgba(200,168,75,0.2)", padding: 22 }}>
                {/* Title row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <AlertTriangle size={13} style={{ color: "var(--amber)" }} />
                      <span style={{ fontSize: 10, color: "var(--amber)", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>
                        {item.type}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{item.title}</h3>
                    <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.5 }}>{item.description}</p>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "rgba(200,168,75,0.08)", border: "1px solid rgba(200,168,75,0.2)",
                    padding: "4px 10px", borderRadius: 20, flexShrink: 0,
                  }}>
                    <Clock size={11} style={{ color: "var(--gold)" }} />
                    <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>Pendiente</span>
                  </div>
                </div>

                {/* Before / After */}
                {(item.beforeValue || item.afterValue) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {item.beforeValue && (
                      <div style={{ background: "rgba(220,53,69,0.05)", border: "1px solid rgba(220,53,69,0.15)", borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ fontSize: 10, color: "var(--crim)", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 5 }}>Antes</p>
                        <p style={{ fontFamily: "var(--fm)", fontSize: 12.5 }}>{item.beforeValue}</p>
                      </div>
                    )}
                    {item.afterValue && (
                      <div style={{ background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 10, padding: "10px 12px" }}>
                        <p style={{ fontSize: 10, color: "var(--jade)", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 5 }}>Después</p>
                        <p style={{ fontFamily: "var(--fm)", fontSize: 12.5 }}>{item.afterValue}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Reasoning */}
                {item.reasoning && (
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                    <p style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 5 }}>Razonamiento IA</p>
                    <p style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{item.reasoning}</p>
                  </div>
                )}

                {/* Impact */}
                {item.estimatedImpact && (
                  <div style={{ background: "rgba(45,212,159,0.05)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                    <p style={{ fontSize: 10, color: "var(--jade)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>Impacto estimado</p>
                    <p style={{ fontSize: 12.5 }}>{item.estimatedImpact}</p>
                  </div>
                )}

                {/* Comment */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10.5, color: "var(--t3)", display: "block", marginBottom: 6 }}>
                    Comentario (opcional para rechazo)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <MessageSquare size={13} style={{ color: "var(--t3)", flexShrink: 0 }} />
                    <input
                      value={comments[item.id] ?? ""}
                      onChange={(e) => setComments((p) => ({ ...p, [item.id]: e.target.value }))}
                      style={{
                        flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--bdr)",
                        borderRadius: 8, padding: "8px 12px", fontSize: 12.5, color: "var(--t1)", outline: "none",
                      }}
                      placeholder="¿Por qué rechazas este cambio?"
                      onFocus={(e) => { e.target.style.borderColor = "var(--gold)"; }}
                      onBlur={(e) => { e.target.style.borderColor = "var(--bdr)"; }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => act(item.id, "approve")}
                    disabled={processing === item.id}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                      background: "var(--jade)", color: "#0a0a14",
                      fontWeight: 700, fontSize: 13, cursor: processing === item.id ? "not-allowed" : "pointer",
                      opacity: processing === item.id ? 0.6 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}
                  >
                    {processing === item.id ? <Loader2 size={13} style={{ animation: "spin 0.6s linear infinite" }} /> : <CheckCircle size={13} />}
                    Aprobar
                  </button>
                  <button
                    onClick={() => act(item.id, "reject")}
                    disabled={processing === item.id}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8,
                      background: "rgba(220,53,69,0.08)", border: "1px solid rgba(220,53,69,0.25)",
                      color: "var(--crim)", fontWeight: 700, fontSize: 13,
                      cursor: processing === item.id ? "not-allowed" : "pointer",
                      opacity: processing === item.id ? 0.6 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}
                  >
                    <XCircle size={13} />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolved history */}
        {resolved.length > 0 && (
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 12 }}>
              Historial
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resolved.map((item) => (
                <div key={item.id} className="card" style={{
                  padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  border: `1px solid ${item.status === "approved" ? "rgba(45,212,159,0.12)" : "rgba(220,53,69,0.12)"}`,
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</p>
                    {item.clientComment && (
                      <p style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Comentario: {item.clientComment}</p>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                    background: item.status === "approved" ? "rgba(45,212,159,0.1)" : "rgba(220,53,69,0.1)",
                    color: item.status === "approved" ? "var(--jade)" : "var(--crim)",
                  }}>
                    {item.status === "approved" ? "Aprobado" : "Rechazado"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
