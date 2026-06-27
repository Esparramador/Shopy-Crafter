import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Plus, X, Check, Clock, User, Building, Mail, Phone, FileText, ChevronLeft, ChevronRight, Calendar, Link, Unlink, Trash2, Edit3, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Appointment {
  id: number;
  google_event_id: string | null;
  client_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  meeting_date: string;
  duration_minutes: number;
  description: string | null;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  arrival_time: string | null;
  services_requested: ServiceItem[];
  services_rendered: ServiceItem[];
  actual_duration_min: number | null;
  quote_amount: string | null;
  quote_breakdown: QuoteItem[];
  notes: string | null;
}

interface ServiceItem { name: string; price?: number; hours?: number; }
interface QuoteItem   { name: string; price: number; hours: number; subtotal: number; }
interface Slot        { time: string; label: string; available: boolean; }

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:     { label: "Pendiente",    color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   dot: "🟡" },
  confirmed:   { label: "Confirmada",   color: "#3b82f6", bg: "rgba(59,130,246,0.1)",   dot: "🔵" },
  in_progress: { label: "En curso",     color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",   dot: "🟣" },
  completed:   { label: "Completada",   color: "#10b981", bg: "rgba(16,185,129,0.1)",   dot: "🟢" },
  cancelled:   { label: "Cancelada",    color: "#ef4444", bg: "rgba(239,68,68,0.1)",    dot: "🔴" },
};

const PRESET_SERVICES = [
  { name: "Auditoría Shopify completa",      price: 150, hours: 2 },
  { name: "Optimización de conversión (CRO)",price: 200, hours: 3 },
  { name: "Setup tienda Shopify",            price: 500, hours: 8 },
  { name: "Integración de pagos",            price: 120, hours: 2 },
  { name: "SEO técnico y contenido",         price: 180, hours: 3 },
  { name: "Diseño de tema personalizado",    price: 350, hours: 5 },
  { name: "Automatización de marketing",     price: 250, hours: 4 },
  { name: "Consultoría estratégica (hora)",  price: 90,  hours: 1 },
  { name: "Migración de plataforma",         price: 400, hours: 6 },
  { name: "App/Plugin personalizado",        price: 600, hours: 10 },
];

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES = ["L","M","X","J","V","S","D"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d: string | Date) {
  const dt = new Date(d);
  return dt.toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" });
}
function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" });
}
function fmtDateTime(d: string | Date) { return `${fmtDate(d)} ${fmtTime(d)}`; }
function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ""}` : `${m}min`;
}
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfWeek(year: number, month: number) { return (new Date(year, month, 1).getDay() + 6) % 7; }

// ─── Inline styles ────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { padding: "0 0 40px 0", minHeight: "100vh", background: "var(--ink)", color: "var(--t)" },
  card: { background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 12, padding: 16 },
  label: { fontSize: 11, fontWeight: 700, color: "var(--t2)", textTransform: "uppercase" as const, letterSpacing: 1, display: "block", marginBottom: 6 },
  input: { width: "100%", background: "var(--ink3)", border: "1px solid var(--ink4)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--t)", outline: "none" },
  btn: (color = "var(--gold)") => ({ padding: "8px 18px", borderRadius: 8, border: "none", background: color, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }),
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modalBox: { background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" as const },
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminCalendar() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [view, setView] = useState<"month" | "list">("month");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [showComplete, setShowComplete] = useState<Appointment | null>(null);
  const [showDetail, setShowDetail] = useState<Appointment | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // New appointment form
  const [form, setForm] = useState({
    client_name: "", company: "", email: "", phone: "",
    meeting_date: "", meeting_time: "10:00",
    duration_minutes: 60, description: "", services_requested: [] as ServiceItem[],
  });

  // Complete meeting form
  const [completeForm, setCompleteForm] = useState({
    arrival_time: "", services_rendered: [] as ServiceItem[], actual_duration_min: 60, notes: "",
  });
  const [newService, setNewService] = useState({ name: "", price: 0, hours: 1 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load data ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evts, status, st] = await Promise.all([
        fetch(`${API}/calendar/events`, { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/calendar/status`,  { credentials: "include" }).then(r => r.json()),
        fetch(`${API}/calendar/stats`,   { credentials: "include" }).then(r => r.json()),
      ]);
      setAppointments(evts.appointments || []);
      setConnected(status.connected);
      setConnectedEmail(status.email || null);
      setStats(st);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Listen for OAuth popup callback ─────────────────────────────────────────
  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === "CALENDAR_CONNECTED") { setConnected(true); setConnectedEmail(ev.data.email); load(); }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [load]);

  // ── Fetch slots when date changes in create modal ────────────────────────────
  useEffect(() => {
    if (!form.meeting_date || !showCreate) return;
    setLoadingSlots(true);
    fetch(`${API}/calendar/slots?date=${form.meeting_date}&duration=${form.duration_minutes}`, { credentials: "include" })
      .then(r => r.json()).then(d => setSlots(d.slots || [])).catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [form.meeting_date, form.duration_minutes, showCreate]);

  // ── Connect Google Calendar ──────────────────────────────────────────────────
  async function connectGoogle() {
    try {
      const r = await fetch(`${API}/calendar/oauth/url`, { credentials: "include" });
      const { url, error: err } = await r.json();
      if (err) { setError(err); return; }
      window.open(url, "_blank", "width=500,height=600");
    } catch (e: any) { setError(e.message); }
  }

  async function disconnectGoogle() {
    await fetch(`${API}/calendar/oauth/disconnect`, { method: "DELETE", credentials: "include" });
    setConnected(false); setConnectedEmail(null);
  }

  async function syncCalendar() {
    setSyncing(true);
    try {
      const r = await fetch(`${API}/calendar/sync`, { method: "POST", credentials: "include" });
      const d = await r.json();
      if (d.synced > 0) await load();
    } catch {}
    setSyncing(false);
  }

  // ── Create appointment ───────────────────────────────────────────────────────
  async function createAppointment() {
    if (!form.client_name || !form.meeting_date) { setError("Nombre y fecha son obligatorios"); return; }
    setSaving(true); setError(null);
    try {
      const meetingDate = new Date(`${form.meeting_date}T${form.meeting_time}:00`).toISOString();
      const r = await fetch(`${API}/calendar/events`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, meeting_date: meetingDate }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowCreate(false);
      setForm({ client_name: "", company: "", email: "", phone: "", meeting_date: "", meeting_time: "10:00", duration_minutes: 60, description: "", services_requested: [] });
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  // ── Complete meeting ──────────────────────────────────────────────────────────
  async function completeMeeting() {
    if (!showComplete) return;
    setSaving(true); setError(null);
    try {
      const r = await fetch(`${API}/calendar/events/${showComplete.id}/complete`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setShowComplete(null);
      setCompleteForm({ arrival_time: "", services_rendered: [], actual_duration_min: 60, notes: "" });
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  // ── Delete appointment ────────────────────────────────────────────────────────
  async function deleteAppointment(id: number) {
    if (!confirm("¿Cancelar esta cita?")) return;
    await fetch(`${API}/calendar/events/${id}`, { method: "DELETE", credentials: "include" });
    await load();
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  function getApptsForDay(day: number) {
    return appointments.filter(a => {
      const d = new Date(a.meeting_date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && d.getDate() === day;
    });
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }
  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  const today = new Date();
  const upcomingAppts = appointments.filter(a => new Date(a.meeting_date) >= today && a.status !== "cancelled")
    .sort((a, b) => new Date(a.meeting_date).getTime() - new Date(b.meeting_date).getTime());

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a1200,#0a0a0a)", borderBottom: "1px solid var(--ink3)", padding: "20px 24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "var(--t)" }}>
              📅 Calendario CRM
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--t3)" }}>
              Gestión de citas · Seguimiento de reuniones · Presupuestos automáticos
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {connected ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, fontSize: 12, color: "var(--jade)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--jade)", display: "inline-block" }} />
                  {connectedEmail || "Google Calendar"}
                </div>
                <button onClick={syncCalendar} disabled={syncing}
                  style={{ ...S.btn("var(--ink3)"), color: "var(--t)", border: "1px solid var(--ink4)", display: "flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={13} className={syncing ? "spin" : ""} /> Sincronizar
                </button>
                <button onClick={disconnectGoogle}
                  style={{ ...S.btn("var(--ink3)"), color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Unlink size={13} />
                </button>
              </>
            ) : (
              <button onClick={connectGoogle}
                style={{ ...S.btn(), display: "flex", alignItems: "center", gap: 8 }}>
                <Link size={14} /> Conectar Google Calendar
              </button>
            )}
            <button onClick={() => { setShowCreate(true); setError(null); }}
              style={{ ...S.btn(), display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={14} /> Nueva Cita
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { icon: "📋", label: "Próximas", val: stats.upcoming, color: "#3b82f6" },
              { icon: "✅", label: "Completadas", val: stats.completed, color: "#10b981" },
              { icon: "⏳", label: "Pendientes", val: stats.pending, color: "#f59e0b" },
              { icon: "💰", label: "Facturado", val: `${parseFloat(stats.total_revenue || 0).toFixed(0)}€`, color: "var(--gold)" },
              { icon: "⏱️", label: "Duración media", val: stats.avg_duration ? fmtDuration(Math.round(stats.avg_duration)) : "—", color: "var(--t2)" },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 20, fontSize: 12 }}>
                <span>{s.icon}</span>
                <span style={{ color: "var(--t3)" }}>{s.label}:</span>
                <span style={{ fontWeight: 800, color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* ── CALENDAR GRID ─────────────────────────────────────────────── */}
        <div>
          {/* View toggle + Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={prevMonth} style={{ background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--t)" }}>
                <ChevronLeft size={16} />
              </button>
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {MONTHS_ES[currentMonth]} {currentYear}
              </h2>
              <button onClick={nextMonth} style={{ background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--t)" }}>
                <ChevronRight size={16} />
              </button>
              <button onClick={() => { setCurrentYear(today.getFullYear()); setCurrentMonth(today.getMonth()); }}
                style={{ background: "none", border: "1px solid var(--ink4)", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "var(--t3)" }}>
                Hoy
              </button>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["month", "list"] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid", fontSize: 12, cursor: "pointer",
                    borderColor: view === v ? "var(--gold)" : "var(--ink4)",
                    background: view === v ? "rgba(251,191,36,0.1)" : "var(--ink2)",
                    color: view === v ? "var(--gold)" : "var(--t3)", fontWeight: view === v ? 700 : 400 }}>
                  {v === "month" ? "📆 Mes" : "📋 Lista"}
                </button>
              ))}
            </div>
          </div>

          {view === "month" ? (
            /* ── MONTH VIEW ─────────────────────────────────────────────── */
            <div style={{ background: "var(--ink2)", border: "1px solid var(--ink3)", borderRadius: 16, overflow: "hidden" }}>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--ink3)" }}>
                {DAYS_ES.map(d => (
                  <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase" }}>{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 90, borderRight: "1px solid var(--ink3)", borderBottom: "1px solid var(--ink3)", background: "rgba(0,0,0,0.15)" }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayAppts = getApptsForDay(day);
                  const isToday = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === day;
                  const colIdx = (firstDay + i) % 7;
                  const isWeekend = colIdx === 5 || colIdx === 6;
                  return (
                    <div key={day} onClick={() => { setSelectedDate(`${currentYear}-${String(currentMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`); setForm(f => ({ ...f, meeting_date: `${currentYear}-${String(currentMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` })); setShowCreate(true); }}
                      style={{ minHeight: 90, borderRight: "1px solid var(--ink3)", borderBottom: "1px solid var(--ink3)", padding: 6, cursor: "pointer",
                        background: isToday ? "rgba(251,191,36,0.06)" : isWeekend ? "rgba(0,0,0,0.12)" : "transparent",
                        transition: "background 0.15s" }}>
                      <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, color: isToday ? "var(--gold)" : "var(--t)",
                        width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        background: isToday ? "rgba(251,191,36,0.2)" : "transparent" }}>
                        {day}
                      </div>
                      <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayAppts.slice(0, 3).map(a => (
                          <div key={a.id} onClick={e => { e.stopPropagation(); setShowDetail(a); }}
                            style={{ padding: "2px 5px", borderRadius: 4, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              background: STATUS_CONFIG[a.status]?.bg || "rgba(59,130,246,0.1)",
                              color: STATUS_CONFIG[a.status]?.color || "#3b82f6", cursor: "pointer",
                              borderLeft: `3px solid ${STATUS_CONFIG[a.status]?.color || "#3b82f6"}` }}>
                            {fmtTime(a.meeting_date)} {a.client_name}
                          </div>
                        ))}
                        {dayAppts.length > 3 && <div style={{ fontSize: 9, color: "var(--t3)" }}>+{dayAppts.length - 3} más</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── LIST VIEW ──────────────────────────────────────────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--t3)" }}><RefreshCw size={20} className="spin" /></div>
              ) : appointments.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
                  <Calendar size={40} style={{ opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
                  <p>Sin citas aún. Crea tu primera cita o sincroniza con Google Calendar.</p>
                </div>
              ) : appointments.map(a => <AppointmentCard key={a.id} appt={a} onDetail={() => setShowDetail(a)} onComplete={() => { setShowComplete(a); setCompleteForm({ arrival_time: new Date().toTimeString().slice(0,5), services_rendered: [...(a.services_requested||[])], actual_duration_min: a.duration_minutes, notes: "" }); }} onDelete={() => deleteAppointment(a.id)} />)}
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Próximas citas */}
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} style={{ color: "var(--gold)" }} /> Próximas Citas
            </div>
            {upcomingAppts.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--t3)", margin: 0 }}>Sin citas próximas</p>
            ) : upcomingAppts.slice(0, 6).map(a => (
              <div key={a.id} onClick={() => setShowDetail(a)}
                style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--ink3)", cursor: "pointer", alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_CONFIG[a.status]?.color, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.client_name}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>{fmtDateTime(a.meeting_date)} · {fmtDuration(a.duration_minutes)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Omnichatbot hint */}
          <div style={{ ...S.card, background: "linear-gradient(135deg,rgba(139,92,246,0.1),rgba(251,191,36,0.05))", border: "1px solid rgba(139,92,246,0.3)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#a78bfa" }}>🤖 OmniChatbot</div>
            <p style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.6, margin: "0 0 10px" }}>Puedes pedirle al chatbot que gestione tus citas:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                '"¿Qué citas tengo esta semana?"',
                '"Crea cita con Juan García el lunes 15 a las 10h"',
                '"¿Hay hueco el martes por la tarde?"',
                '"Muéstrame las citas de hoy"',
              ].map(t => (
                <div key={t} style={{ padding: "4px 8px", background: "var(--ink3)", borderRadius: 6, fontSize: 10, color: "var(--t2)", fontStyle: "italic" }}>{t}</div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={S.card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Leyenda</div>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.color }} />
                <span style={{ color: "var(--t2)" }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — CREATE APPOINTMENT
      ══════════════════════════════════════════════════════════════════════ */}
      {showCreate && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={S.modalBox}>
            <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📅 Nueva Cita</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, fontSize: 12, color: "#f87171" }}><AlertCircle size={12} style={{ display: "inline", marginRight: 6 }} />{error}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Nombre cliente *</label>
                  <input style={S.input} placeholder="Juan García" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Empresa</label>
                  <input style={S.input} placeholder="Empresa S.L." value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Email</label>
                  <input style={S.input} type="email" placeholder="juan@empresa.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Teléfono</label>
                  <input style={S.input} placeholder="+34 600 000 000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Fecha *</label>
                  <input style={S.input} type="date" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Hora *</label>
                  {/* Slots si hay fecha */}
                  {form.meeting_date && slots.length > 0 ? (
                    <select style={S.input} value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))}>
                      {slots.filter(s => s.available).map(s => (
                        <option key={s.time} value={new Date(s.time).toTimeString().slice(0,5)}>{s.label} ✓</option>
                      ))}
                      {slots.filter(s => !s.available).map(s => (
                        <option key={s.time} value={new Date(s.time).toTimeString().slice(0,5)} disabled>{s.label} ✗</option>
                      ))}
                    </select>
                  ) : (
                    <input style={S.input} type="time" value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} />
                  )}
                  {loadingSlots && <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Verificando disponibilidad…</div>}
                </div>
                <div>
                  <label style={S.label}>Duración</label>
                  <select style={S.input} value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}>
                    {[30,45,60,90,120,180,240].map(m => <option key={m} value={m}>{fmtDuration(m)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={S.label}>Descripción / Motivo de la reunión</label>
                <textarea style={{ ...S.input, minHeight: 70, resize: "vertical" }} placeholder="Consulta para setup tienda Shopify + integración de pagos…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {/* Services requested */}
              <div>
                <label style={S.label}>Servicios solicitados (previsión)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {PRESET_SERVICES.map(s => (
                    <button key={s.name} onClick={() => {
                      if (!form.services_requested.find(x => x.name === s.name))
                        setForm(f => ({ ...f, services_requested: [...f.services_requested, s] }));
                    }}
                      style={{ padding: "4px 10px", fontSize: 11, borderRadius: 20, border: "1px solid",
                        borderColor: form.services_requested.find(x => x.name === s.name) ? "var(--gold)" : "var(--ink4)",
                        background: form.services_requested.find(x => x.name === s.name) ? "rgba(251,191,36,0.1)" : "var(--ink3)",
                        color: form.services_requested.find(x => x.name === s.name) ? "var(--gold)" : "var(--t3)",
                        cursor: "pointer" }}>
                      {s.name}
                    </button>
                  ))}
                </div>
                {form.services_requested.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>
                    {form.services_requested.map(s => (
                      <span key={s.name} style={{ padding: "2px 8px", background: "rgba(251,191,36,0.1)", borderRadius: 12, marginRight: 4, marginBottom: 4, display: "inline-block" }}>
                        {s.name} <button onClick={() => setForm(f => ({ ...f, services_requested: f.services_requested.filter(x => x.name !== s.name) }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 10 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={createAppointment} disabled={saving}
                style={{ ...S.btn(), width: "100%", padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
                {saving ? <><RefreshCw size={14} className="spin" /> Guardando…</> : <><Check size={14} /> Crear Cita{connected ? " y sincronizar con Google" : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — APPOINTMENT DETAIL
      ══════════════════════════════════════════════════════════════════════ */}
      {showDetail && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowDetail(null); }}>
          <div style={{ ...S.modalBox, maxWidth: 560 }}>
            <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: STATUS_CONFIG[showDetail.status]?.bg, color: STATUS_CONFIG[showDetail.status]?.color }}>
                    {STATUS_CONFIG[showDetail.status]?.dot} {STATUS_CONFIG[showDetail.status]?.label}
                  </span>
                  {showDetail.google_event_id && <span style={{ fontSize: 10, color: "var(--jade)" }}>📅 Sync Google</span>}
                </div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{showDetail.client_name}</h2>
                {showDetail.company && <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--t3)" }}>{showDetail.company}</p>}
              </div>
              <button onClick={() => setShowDetail(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Date/Time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <InfoRow icon={<Clock size={13} />} label="Fecha y hora" val={fmtDateTime(showDetail.meeting_date)} />
                <InfoRow icon={<Clock size={13} />} label="Duración prevista" val={fmtDuration(showDetail.duration_minutes)} />
              </div>
              {(showDetail.email || showDetail.phone) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {showDetail.email && <InfoRow icon={<Mail size={13} />} label="Email" val={showDetail.email} />}
                  {showDetail.phone && <InfoRow icon={<Phone size={13} />} label="Teléfono" val={showDetail.phone} />}
                </div>
              )}
              {showDetail.description && <InfoRow icon={<FileText size={13} />} label="Descripción" val={showDetail.description} />}
              {(showDetail.services_requested?.length > 0) && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t3)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>Servicios solicitados</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {showDetail.services_requested.map((s, i) => (
                      <span key={i} style={{ padding: "3px 10px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 20, fontSize: 11, color: "var(--gold)" }}>{s.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Post-meeting data */}
              {showDetail.status === "completed" && (
                <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--jade)", marginBottom: 10 }}>✅ Reunión completada</div>
                  {showDetail.arrival_time && <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6 }}>🕐 Llegada: <strong style={{ color: "var(--t)" }}>{fmtTime(showDetail.arrival_time)}</strong></div>}
                  {showDetail.actual_duration_min && <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 6 }}>⏱️ Duración real: <strong style={{ color: "var(--t)" }}>{fmtDuration(showDetail.actual_duration_min)}</strong></div>}
                  {showDetail.quote_amount && (
                    <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 6 }}>PRESUPUESTO GENERADO</div>
                      {showDetail.quote_breakdown?.map((q, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: "var(--t2)" }}>{q.name} ({q.hours}h)</span>
                          <span style={{ color: "var(--gold)", fontWeight: 700 }}>{q.subtotal.toFixed(2)}€</span>
                        </div>
                      ))}
                      <div style={{ borderTop: "1px solid rgba(251,191,36,0.3)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}>
                        <span style={{ color: "var(--t)" }}>TOTAL</span>
                        <span style={{ color: "var(--gold)" }}>{parseFloat(showDetail.quote_amount).toFixed(2)}€</span>
                      </div>
                    </div>
                  )}
                  {showDetail.notes && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 8 }}>📝 {showDetail.notes}</div>}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                {showDetail.status !== "completed" && showDetail.status !== "cancelled" && (
                  <button onClick={() => { setShowComplete(showDetail); setShowDetail(null); setCompleteForm({ arrival_time: new Date().toTimeString().slice(0,5), services_rendered: [...(showDetail.services_requested||[])], actual_duration_min: showDetail.duration_minutes, notes: "" }); }}
                    style={{ ...S.btn("var(--jade)"), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Check size={13} /> Completar reunión
                  </button>
                )}
                <button onClick={() => { deleteAppointment(showDetail.id); setShowDetail(null); }}
                  style={{ ...S.btn("rgba(239,68,68,0.1)"), color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — COMPLETE MEETING
      ══════════════════════════════════════════════════════════════════════ */}
      {showComplete && (
        <div style={S.modal} onClick={e => { if (e.target === e.currentTarget) setShowComplete(null); }}>
          <div style={S.modalBox}>
            <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>✅ Cerrar Reunión</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--t3)" }}>{showComplete.client_name} · {fmtDateTime(showComplete.meeting_date)}</p>
              </div>
              <button onClick={() => setShowComplete(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)" }}><X size={20} /></button>
            </div>
            <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {error && <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>{error}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={S.label}>Hora de llegada del cliente</label>
                  <input style={S.input} type="time" value={completeForm.arrival_time} onChange={e => setCompleteForm(f => ({ ...f, arrival_time: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Duración real de la reunión</label>
                  <select style={S.input} value={completeForm.actual_duration_min} onChange={e => setCompleteForm(f => ({ ...f, actual_duration_min: parseInt(e.target.value) }))}>
                    {[15,20,30,45,60,90,120,150,180,240,300].map(m => <option key={m} value={m}>{fmtDuration(m)}</option>)}
                  </select>
                </div>
              </div>

              {/* Servicios realizados */}
              <div>
                <label style={S.label}>Servicios realizados / Presupuesto</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {PRESET_SERVICES.map(s => (
                    <button key={s.name} onClick={() => {
                      if (!completeForm.services_rendered.find(x => x.name === s.name))
                        setCompleteForm(f => ({ ...f, services_rendered: [...f.services_rendered, { ...s }] }));
                    }}
                      style={{ padding: "3px 9px", fontSize: 10, borderRadius: 16, border: "1px solid",
                        borderColor: completeForm.services_rendered.find(x => x.name === s.name) ? "var(--jade)" : "var(--ink4)",
                        background: completeForm.services_rendered.find(x => x.name === s.name) ? "rgba(16,185,129,0.1)" : "var(--ink3)",
                        color: completeForm.services_rendered.find(x => x.name === s.name) ? "var(--jade)" : "var(--t3)",
                        cursor: "pointer" }}>
                      {s.name}
                    </button>
                  ))}
                </div>

                {/* Custom service */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px auto", gap: 8, marginBottom: 8 }}>
                  <input style={S.input} placeholder="Servicio personalizado" value={newService.name} onChange={e => setNewService(s => ({ ...s, name: e.target.value }))} />
                  <input style={S.input} type="number" placeholder="€/hora" value={newService.price || ""} onChange={e => setNewService(s => ({ ...s, price: parseFloat(e.target.value) || 0 }))} />
                  <input style={S.input} type="number" placeholder="h" value={newService.hours || ""} onChange={e => setNewService(s => ({ ...s, hours: parseFloat(e.target.value) || 1 }))} />
                  <button onClick={() => {
                    if (newService.name) { setCompleteForm(f => ({ ...f, services_rendered: [...f.services_rendered, { ...newService }] })); setNewService({ name: "", price: 0, hours: 1 }); }
                  }} style={{ ...S.btn(), padding: "8px 12px" }}><Plus size={14} /></button>
                </div>

                {/* Breakdown preview */}
                {completeForm.services_rendered.length > 0 && (
                  <div style={{ background: "var(--ink3)", borderRadius: 10, overflow: "hidden" }}>
                    {completeForm.services_rendered.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--ink4)", gap: 8 }}>
                        <div style={{ flex: 1, fontSize: 12, color: "var(--t)" }}>{s.name}</div>
                        <input type="number" value={s.price || 0} onChange={e => { const v = parseFloat(e.target.value)||0; setCompleteForm(f => ({ ...f, services_rendered: f.services_rendered.map((x,j) => j===i ? {...x,price:v} : x) })); }}
                          style={{ ...S.input, width: 70, padding: "4px 8px", fontSize: 12 }} placeholder="€/h" />
                        <input type="number" value={s.hours || 1} onChange={e => { const v = parseFloat(e.target.value)||1; setCompleteForm(f => ({ ...f, services_rendered: f.services_rendered.map((x,j) => j===i ? {...x,hours:v} : x) })); }}
                          style={{ ...S.input, width: 50, padding: "4px 8px", fontSize: 12 }} placeholder="h" />
                        <div style={{ width: 70, textAlign: "right", fontWeight: 700, fontSize: 12, color: "var(--gold)" }}>{((s.price||0) * (s.hours||1)).toFixed(0)}€</div>
                        <button onClick={() => setCompleteForm(f => ({ ...f, services_rendered: f.services_rendered.filter((_,j) => j !== i) }))}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}><X size={13} /></button>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontWeight: 800, fontSize: 15 }}>
                      <span style={{ color: "var(--t2)" }}>TOTAL PRESUPUESTO</span>
                      <span style={{ color: "var(--gold)" }}>
                        {completeForm.services_rendered.reduce((acc, s) => acc + (s.price||0)*(s.hours||1), 0).toFixed(2)}€
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={S.label}>Notas internas</label>
                <textarea style={{ ...S.input, minHeight: 60, resize: "vertical" }} placeholder="Observaciones de la reunión, próximos pasos…" value={completeForm.notes} onChange={e => setCompleteForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button onClick={completeMeeting} disabled={saving}
                style={{ ...S.btn("var(--jade)"), width: "100%", padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14 }}>
                {saving ? <><RefreshCw size={14} className="spin" /> Guardando…</> : <><DollarSign size={14} /> Cerrar reunión y generar presupuesto</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function AppointmentCard({ appt, onDetail, onComplete, onDelete }: { appt: Appointment; onDetail: () => void; onComplete: () => void; onDelete: () => void }) {
  const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.confirmed;
  return (
    <div style={{ background: "var(--ink2)", border: `1px solid var(--ink3)`, borderLeft: `4px solid ${cfg.color}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }} onClick={onDetail}>
      <div style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 10, background: cfg.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{new Date(appt.meeting_date).getDate()}</div>
        <div style={{ fontSize: 9, color: cfg.color, opacity: 0.8 }}>{MONTHS_ES[new Date(appt.meeting_date).getMonth()].slice(0,3)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--t)" }}>{appt.client_name}</span>
          {appt.company && <span style={{ fontSize: 11, color: "var(--t3)" }}>· {appt.company}</span>}
          <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--t3)", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>🕐 {fmtDateTime(appt.meeting_date)}</span>
          <span>⏱ {fmtDuration(appt.duration_minutes)}</span>
          {appt.quote_amount && <span style={{ color: "var(--gold)", fontWeight: 700 }}>💰 {parseFloat(appt.quote_amount).toFixed(0)}€</span>}
        </div>
        {appt.description && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{appt.description}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {appt.status !== "completed" && appt.status !== "cancelled" && (
          <button onClick={onComplete} style={{ padding: "5px 10px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 7, fontSize: 11, color: "var(--jade)", cursor: "pointer", fontWeight: 700 }}>
            ✅ Cerrar
          </button>
        )}
        <button onClick={onDelete} style={{ padding: "5px 8px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, color: "#f87171", cursor: "pointer" }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, val }: { icon: React.ReactNode; label: string; val: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ color: "var(--gold)", marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--t)" }}>{val}</div>
      </div>
    </div>
  );
}
