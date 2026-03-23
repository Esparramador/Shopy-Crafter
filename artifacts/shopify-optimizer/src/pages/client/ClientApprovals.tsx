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
      .then((d) => { setApprovals(d); setLoading(false); });
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
    return <ClientLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#5b4eff]" /></div></ClientLayout>;
  }

  return (
    <ClientLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Aprobaciones Pendientes</h1>
          <p className="text-white/40 text-sm mt-1">
            Tu agencia necesita tu confirmación antes de aplicar estos cambios en tu tienda.
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="bg-white/5 border border-white/8 rounded-2xl p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-white font-semibold">Todo al día</p>
            <p className="text-white/40 text-sm mt-1">No tienes aprobaciones pendientes por ahora.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => (
              <div key={item.id} className="bg-white/5 border border-[#ffd32a]/20 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-[#ffd32a]" />
                      <span className="text-xs text-[#ffd32a] font-semibold uppercase tracking-wider">{item.type}</span>
                    </div>
                    <h3 className="text-white font-bold text-lg">{item.title}</h3>
                    <p className="text-white/50 text-sm mt-1">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs text-yellow-400 font-medium">Pendiente</span>
                  </div>
                </div>

                {(item.beforeValue || item.afterValue) && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {item.beforeValue && (
                      <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                        <p className="text-xs text-red-400 font-semibold mb-1 uppercase tracking-wider">Antes</p>
                        <p className="text-white font-mono text-sm">{item.beforeValue}</p>
                      </div>
                    )}
                    {item.afterValue && (
                      <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                        <p className="text-xs text-green-400 font-semibold mb-1 uppercase tracking-wider">Después</p>
                        <p className="text-white font-mono text-sm">{item.afterValue}</p>
                      </div>
                    )}
                  </div>
                )}

                {item.reasoning && (
                  <div className="bg-black/20 rounded-xl p-4 mb-4">
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Razonamiento IA</p>
                    <p className="text-sm text-white/70">{item.reasoning}</p>
                  </div>
                )}

                {item.estimatedImpact && (
                  <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 mb-4">
                    <p className="text-xs text-green-400 font-semibold mb-0.5 uppercase tracking-wider">Impacto estimado</p>
                    <p className="text-sm text-white">{item.estimatedImpact}</p>
                  </div>
                )}

                <div className="mb-4">
                  <label className="text-xs text-white/40 block mb-2">Comentario (opcional para rechazo)</label>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-white/30 flex-shrink-0" />
                    <input
                      value={comments[item.id] ?? ""}
                      onChange={(e) => setComments((p) => ({ ...p, [item.id]: e.target.value }))}
                      className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors placeholder:text-white/20"
                      placeholder="¿Por qué rechazas este cambio?"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => act(item.id, "approve")}
                    disabled={processing === item.id}
                    className="flex-1 bg-green-500 text-black py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-green-400 disabled:opacity-60 transition-all"
                  >
                    {processing === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Aprobar
                  </button>
                  <button
                    onClick={() => act(item.id, "reject")}
                    disabled={processing === item.id}
                    className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-500/20 disabled:opacity-60 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white/60 mb-4">Historial</h2>
            <div className="space-y-3">
              {resolved.map((item) => (
                <div key={item.id} className={`bg-white/5 border rounded-xl p-4 flex items-start justify-between gap-4 ${item.status === "approved" ? "border-green-500/15" : "border-red-500/15"}`}>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    {item.clientComment && <p className="text-xs text-white/40 mt-0.5">Comentario: {item.clientComment}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${item.status === "approved" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
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
