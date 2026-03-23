import { useState, useEffect, useCallback } from "react";
import { Mail, Send, Users, BarChart3, Zap, CheckCircle, XCircle, RefreshCw, Plus, Eye } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface KlaviyoList { id: string; attributes: { name: string; created: string; updated: string } }
interface KlaviyoCampaign { id: string; attributes: { name: string; status: string; created_at: string; send_time?: string } }
interface KlaviyoFlow { id: string; attributes: { name: string; status: string; trigger_type: string; created: string } }

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400 bg-emerald-900/30",
  live: "text-emerald-400 bg-emerald-900/30",
  draft: "text-amber-400 bg-amber-900/30",
  sent: "text-blue-400 bg-blue-900/30",
  cancelled: "text-red-400 bg-red-900/30",
  manual: "text-violet-400 bg-violet-900/30",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status?.toLowerCase()] ?? "text-gray-400 bg-gray-900/30";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {status ?? "—"}
    </span>
  );
}

export default function Emails() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lists, setLists] = useState<KlaviyoList[]>([]);
  const [campaigns, setCampaigns] = useState<KlaviyoCampaign[]>([]);
  const [flows, setFlows] = useState<KlaviyoFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "lists" | "campaigns" | "flows" | "send">("overview");
  const [sendForm, setSendForm] = useState({ email: "", eventName: "", subject: "", properties: "" });
  const [sendStatus, setSendStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [welcomeForm, setWelcomeForm] = useState({ email: "", name: "", shopDomain: "", plan: "Starter" });
  const [welcomeSent, setWelcomeSent] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [testRes, listsRes, campaignsRes, flowsRes] = await Promise.all([
        fetch(`${API_BASE}/api/klaviyo/test`, { credentials: "include" }),
        fetch(`${API_BASE}/api/klaviyo/lists`, { credentials: "include" }),
        fetch(`${API_BASE}/api/klaviyo/campaigns`, { credentials: "include" }),
        fetch(`${API_BASE}/api/klaviyo/flows`, { credentials: "include" }),
      ]);
      const testData = await testRes.json();
      setConnected(testData.connected === true);
      if (testRes.ok) {
        const listsData = await listsRes.json();
        setCampaigns((await campaignsRes.json()).data ?? []);
        setFlows((await flowsRes.json()).data ?? []);
        setLists(listsData.data ?? []);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSendEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendStatus(null);
    try {
      let props: Record<string, unknown> = {};
      if (sendForm.properties) {
        try { props = JSON.parse(sendForm.properties); } catch { props = {}; }
      }
      const res = await fetch(`${API_BASE}/api/klaviyo/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: sendForm.email,
          metricName: sendForm.eventName,
          subject: sendForm.subject,
          properties: props,
        }),
      });
      const data = await res.json();
      setSendStatus({ ok: res.ok, msg: data.message ?? data.error ?? (res.ok ? "Enviado" : "Error") });
    } catch {
      setSendStatus({ ok: false, msg: "Error de red" });
    } finally {
      setSending(false);
    }
  };

  const handleWelcome = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/klaviyo/welcome-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(welcomeForm),
      });
      if (res.ok) setWelcomeSent(true);
    } catch { /* ignore */ } finally {
      setSending(false);
    }
  };

  const TABS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "lists", label: `Listas (${lists.length})`, icon: Users },
    { id: "campaigns", label: `Campañas (${campaigns.length})`, icon: Mail },
    { id: "flows", label: `Flows (${flows.length})`, icon: Zap },
    { id: "send", label: "Enviar", icon: Send },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Marketing</h1>
          <p className="text-gray-400 text-sm mt-0.5">Klaviyo · Listas, campañas, flows y eventos</p>
        </div>
        <div className="flex items-center gap-3">
          {connected === true && (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium bg-emerald-900/30 border border-emerald-800/50 px-3 py-1.5 rounded-lg">
              <CheckCircle size={14} /> Conectado
            </span>
          )}
          {connected === false && (
            <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium bg-red-900/30 border border-red-800/50 px-3 py-1.5 rounded-lg">
              <XCircle size={14} /> Sin conexión
            </span>
          )}
          <button onClick={loadAll} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center py-16">
          <RefreshCw className="animate-spin mx-auto mb-3 text-amber-400" size={28} />
          <p className="text-gray-400">Cargando datos de Klaviyo…</p>
        </div>
      )}

      {!loading && connected === false && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-center">
          <XCircle className="mx-auto mb-3 text-red-400" size={32} />
          <p className="text-red-300 font-medium">No se puede conectar con Klaviyo</p>
          <p className="text-red-400/70 text-sm mt-1">Verifica que <code className="bg-white/10 px-1 rounded">KLAVIYO_API_KEY</code> esté configurado correctamente.</p>
        </div>
      )}

      {!loading && connected === true && (
        <>
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Listas</p>
                  <p className="text-3xl font-bold text-white">{lists.length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Campañas</p>
                  <p className="text-3xl font-bold text-white">{campaigns.length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Flows activos</p>
                  <p className="text-3xl font-bold text-white">{flows.filter(f => f.attributes?.status === "live").length}</p>
                </div>
              </div>

              {/* Welcome client quick form */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Plus size={16} className="text-amber-400" />
                  Enviar Welcome Email a cliente nuevo
                </h3>
                {welcomeSent ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle size={18} /> Welcome email enviado correctamente
                  </div>
                ) : (
                  <form onSubmit={handleWelcome} className="grid grid-cols-2 gap-3">
                    <input
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="Email del cliente *"
                      value={welcomeForm.email}
                      onChange={e => setWelcomeForm(p => ({ ...p, email: e.target.value }))}
                      required type="email"
                    />
                    <input
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="Nombre del cliente *"
                      value={welcomeForm.name}
                      onChange={e => setWelcomeForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                    <input
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="shopDomain (ej: mitienda.myshopify.com)"
                      value={welcomeForm.shopDomain}
                      onChange={e => setWelcomeForm(p => ({ ...p, shopDomain: e.target.value }))}
                    />
                    <select
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                      value={welcomeForm.plan}
                      onChange={e => setWelcomeForm(p => ({ ...p, plan: e.target.value }))}
                    >
                      <option value="Starter">Starter</option>
                      <option value="Agency Pro">Agency Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                    <button
                      type="submit"
                      disabled={sending}
                      className="col-span-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold text-sm hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all"
                    >
                      {sending ? "Enviando…" : "Enviar Welcome Email"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* LISTS */}
          {activeTab === "lists" && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Nombre</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Creada</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Actualizada</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.length === 0 && (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500">No hay listas en Klaviyo</td></tr>
                  )}
                  {lists.map(l => (
                    <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{l.attributes?.name}</td>
                      <td className="px-5 py-3 text-gray-400">{l.attributes?.created ? new Date(l.attributes.created).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-5 py-3 text-gray-400">{l.attributes?.updated ? new Date(l.attributes.updated).toLocaleDateString("es-ES") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CAMPAIGNS */}
          {activeTab === "campaigns" && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Campaña</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Envío</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">No hay campañas creadas</td></tr>
                  )}
                  {campaigns.map(c => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{c.attributes?.name}</td>
                      <td className="px-5 py-3"><StatusBadge status={c.attributes?.status} /></td>
                      <td className="px-5 py-3 text-gray-400">{c.attributes?.send_time ? new Date(c.attributes.send_time).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-5 py-3 text-gray-400">{c.attributes?.created_at ? new Date(c.attributes.created_at).toLocaleDateString("es-ES") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* FLOWS */}
          {activeTab === "flows" && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Flow</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Trigger</th>
                    <th className="text-left px-5 py-3 text-gray-400 font-medium">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.length === 0 && (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">No hay flows configurados</td></tr>
                  )}
                  {flows.map(f => (
                    <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{f.attributes?.name}</td>
                      <td className="px-5 py-3"><StatusBadge status={f.attributes?.status} /></td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{f.attributes?.trigger_type}</td>
                      <td className="px-5 py-3 text-gray-400">{f.attributes?.created ? new Date(f.attributes.created).toLocaleDateString("es-ES") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SEND */}
          {activeTab === "send" && (
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-1">Enviar evento Klaviyo</h3>
                <p className="text-gray-400 text-xs mb-4">Lanza un evento que puede activar un flow o registrar actividad de un perfil.</p>
                <form onSubmit={handleSendEvent} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="Email del destinatario *"
                      type="email"
                      required
                      value={sendForm.email}
                      onChange={e => setSendForm(p => ({ ...p, email: e.target.value }))}
                    />
                    <input
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
                      placeholder="Nombre del evento (ej: Report Ready) *"
                      required
                      value={sendForm.eventName}
                      onChange={e => setSendForm(p => ({ ...p, eventName: e.target.value }))}
                    />
                  </div>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50"
                    placeholder="Asunto del email"
                    value={sendForm.subject}
                    onChange={e => setSendForm(p => ({ ...p, subject: e.target.value }))}
                  />
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                    placeholder='Propiedades adicionales (JSON, opcional): {"clientName": "Ana", "reportUrl": "..."}'
                    rows={3}
                    value={sendForm.properties}
                    onChange={e => setSendForm(p => ({ ...p, properties: e.target.value }))}
                  />
                  {sendStatus && (
                    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${sendStatus.ok ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"}`}>
                      {sendStatus.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {sendStatus.msg}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold text-sm hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Send size={14} />
                    {sending ? "Enviando…" : "Enviar evento"}
                  </button>
                </form>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-white font-semibold mb-1">Eventos disponibles</h3>
                <p className="text-gray-400 text-xs mb-4">Eventos configurados en tus flows de Klaviyo que puedes disparar manualmente:</p>
                <div className="space-y-2">
                  {[
                    { name: "Client Welcome", desc: "Bienvenida a nuevo cliente" },
                    { name: "Report Ready", desc: "Informe mensual disponible" },
                    { name: "Password Reset Requested", desc: "Recuperación de contraseña" },
                    { name: "Optimization Complete", desc: "Optimización de productos terminada" },
                    { name: "Invoice Sent", desc: "Factura enviada al cliente" },
                    { name: "Alert Critical", desc: "Alerta crítica en tienda" },
                  ].map(ev => (
                    <div
                      key={ev.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                      onClick={() => { setSendForm(p => ({ ...p, eventName: ev.name })); setActiveTab("send"); }}
                    >
                      <div>
                        <p className="text-white text-sm font-medium">{ev.name}</p>
                        <p className="text-gray-400 text-xs">{ev.desc}</p>
                      </div>
                      <Eye size={14} className="text-gray-600 group-hover:text-amber-400 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
