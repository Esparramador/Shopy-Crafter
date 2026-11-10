/**
 * Panel «Cerebro» (/admin/cerebro): todo lo que ha entrado por cada puerta
 * (admin, cliente, público), qué decidió ShopyBrain, con qué motor, qué acciones
 * lanzó o descartó por permiso, y cómo acabó. Lee brain_events por cursor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ShieldAlert, Inbox } from "lucide-react";
import {
  GATE_INFO, buildEventsUrl, channelsForGate, formatDuration, formatWhen, gateInfo, kindInfo, statusInfo, summarizeEvents,
  type BrainChannel, type BrainEvent, type BrainGate,
} from "@/lib/brain-events";
import "@/components/brain/brain.css";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const PAGE = 40;
const GATES: Array<"" | BrainGate> = ["", "admin", "client", "public"];

function Pill({ tone, children, dot, title }: { tone: string; children: React.ReactNode; dot?: boolean; title?: string }) {
  return <span className={`brain-pill brain-tone-${tone}`} title={title}>{dot && <span className="brain-pill-dot" />}{children}</span>;
}

function EventCard({ ev, index }: { ev: BrainEvent; index: number }) {
  const [open, setOpen] = useState(false);
  const gate = gateInfo(ev.gate);
  const kind = kindInfo(ev.kind);
  const status = statusInfo(ev.status);
  const dropped = ev.droppedActions ?? [];
  const actions = ev.actions ?? [];
  const isErr = status.tone === "crim";
  const long = (ev.input?.length ?? 0) > 180;
  const hasMore = long || actions.some(a => a.params && Object.keys(a.params).length) || dropped.length > 0 || ev.userId || ev.projectId;
  const when = new Date(ev.createdAt);

  return (
    <article
      className={`brain-ev brain-tone-${gate.tone}${dropped.length ? " has-dropped" : ""}`}
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
      aria-label={`${kind.label} por la puerta ${gate.label}, canal ${ev.channel}`}
    >
      <div className="brain-ev-top">
        <time className="brain-ev-time" dateTime={ev.createdAt} title={Number.isNaN(when.getTime()) ? "" : when.toLocaleString("es-ES")}>
          {formatWhen(ev.createdAt)}
        </time>
        <Pill tone={gate.tone} dot title={gate.hint}>{gate.label}</Pill>
        <span className="brain-mono" title="Canal">{ev.channel}</span>
        <Pill tone={kind.tone}>{kind.label}</Pill>
        <Pill tone={status.tone}>{status.label}</Pill>
        {dropped.length > 0 && (
          <Pill tone="crim" title="El modelo propuso acciones que esta puerta no permite; el servidor las descartó">
            <ShieldAlert size={11} /> {dropped.length} descartada{dropped.length > 1 ? "s" : ""}
          </Pill>
        )}
        <div className="brain-ev-meta">
          {(ev.engine || ev.model) && (
            <span className="brain-ev-engine" title={[ev.engine, ev.model].filter(Boolean).join(" · ")}>
              {[ev.engine, ev.model].filter(Boolean).join(" · ")}
            </span>
          )}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDuration(ev.durationMs)}</span>
        </div>
      </div>

      <p className={`brain-ev-input${ev.input ? "" : " is-empty"}${long && !open ? " is-clamped" : ""}`}>
        {ev.input || "Sin texto de entrada"}
      </p>

      {(actions.length > 0 || dropped.length > 0) && (
        <div className="brain-ev-row">
          {actions.length > 0 && <span className="brain-ev-label">Acciones</span>}
          {actions.map((a, i) => <span key={`a${i}`} className="brain-chip">{a.action}</span>)}
          {dropped.length > 0 && <span className="brain-ev-label" style={{ color: "var(--crim)", marginLeft: actions.length ? 8 : 0 }}>Descartadas por permiso</span>}
          {dropped.map((a, i) => <span key={`d${i}`} className="brain-chip is-dropped" title="No permitida en esta puerta">{a.action}</span>)}
        </div>
      )}

      {ev.detail && <div className={`brain-ev-detail${isErr ? " is-err" : ""}`}>{ev.detail}</div>}

      {hasMore && (
        <button type="button" className="brain-ev-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {open ? "Ocultar detalles" : "Ver detalles"}
        </button>
      )}
      {open && (
        <div className="brain-ev-more">
          <div className="brain-kv">
            <div><b>Evento</b> #{ev.id}</div>
            {ev.userId && <div><b>Usuario</b> {ev.userId}</div>}
            {ev.projectId && <div><b>Proyecto</b> #{ev.projectId}</div>}
            <div><b>Hora</b> {Number.isNaN(when.getTime()) ? "—" : when.toLocaleString("es-ES")}</div>
          </div>
          {actions.length > 0 && <pre className="brain-json">{JSON.stringify(actions, null, 2)}</pre>}
          {dropped.length > 0 && <pre className="brain-json" style={{ borderColor: "color-mix(in srgb, var(--crim) 35%, transparent)" }}>{JSON.stringify(dropped, null, 2)}</pre>}
        </div>
      )}
    </article>
  );
}

export default function BrainPanel() {
  const [gate, setGate] = useState<"" | BrainGate>("");
  const [channel, setChannel] = useState("");
  const [events, setEvents] = useState<BrainEvent[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [channels, setChannels] = useState<BrainChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  const load = useCallback(async (before: number | null) => {
    const id = ++reqId.current;
    if (before) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const r = await fetch(buildEventsUrl(API_BASE, { gate, channel, before, limit: PAGE }), { credentials: "include" });
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Necesitas entrar como admin." : `No se pudo leer el registro (${r.status})`);
      const d = await r.json() as { events?: BrainEvent[]; nextBefore?: number | null };
      if (id !== reqId.current) return;
      setEvents(prev => (before ? [...prev, ...(d.events ?? [])] : d.events ?? []));
      setNextBefore(d.nextBefore ?? null);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      if (id === reqId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [gate, channel]);

  const loadChannels = useCallback(() => {
    fetch(`${API_BASE}/api/shopybrain/events/channels`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setChannels(Array.isArray(d?.channels) ? d.channels : []))
      .catch(() => setChannels([]));
  }, []);

  useEffect(() => { void load(null); }, [load]);
  useEffect(() => { loadChannels(); }, [loadChannels]);

  const channelOptions = useMemo(() => channelsForGate(channels, gate), [channels, gate]);
  const stats = useMemo(() => summarizeEvents(events), [events]);
  const gateCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of channels) acc[c.gate] = (acc[c.gate] ?? 0) + c.count;
    return acc;
  }, [channels]);

  const pickGate = (g: "" | BrainGate) => {
    setGate(g);
    if (channel && g && !channels.some(c => c.channel === channel && c.gate === g)) setChannel("");
  };

  return (
    <div className="brain-page">
      <header className="brain-hero">
        <h1><span className="brain-answer-orb" style={{ width: 34, height: 34, fontSize: 16 }} aria-hidden="true">✦</span>Cerebro</h1>
        <p>
          Todo lo que entra por cada puerta pasa por ShopyBrain. Aquí ves qué llegó, qué decidió (responder, actuar o derivar),
          con qué motor, y las acciones que el servidor descartó porque esa puerta no las permite.
        </p>
        <div style={{ marginTop: 10 }}><span className="brain-live">Registro de los últimos 90 días</span></div>
        <div className="brain-stats" aria-label="Cifras de los eventos cargados">
          <div className="brain-stat"><b>{stats.total}{nextBefore ? "+" : ""}</b><span>eventos en pantalla</span></div>
          <div className="brain-stat"><b>{stats.actions}</b><span>acciones lanzadas</span></div>
          <div className={`brain-stat${stats.dropped ? " is-alert" : ""}`}><b>{stats.dropped}</b><span>descartadas por permiso</span></div>
          <div className={`brain-stat${stats.failures ? " is-alert" : ""}`}><b>{stats.failures}</b><span>errores o denegadas</span></div>
          <div className="brain-stat"><b>{formatDuration(stats.avgMs)}</b><span>duración media</span></div>
        </div>
      </header>

      <div className="brain-filters" role="toolbar" aria-label="Filtros">
        <div className="brain-seg" role="group" aria-label="Puerta">
          {GATES.map(g => (
            <button key={g || "all"} type="button" aria-pressed={gate === g} onClick={() => pickGate(g)}>
              {g ? <span className={`brain-tone-${GATE_INFO[g].tone}`}><span className="brain-pill-dot" style={{ display: "block" }} /></span> : null}
              {g ? GATE_INFO[g].label : "Todas"}
              {g && gateCounts[g] ? <span className="brain-seg-count">{gateCounts[g]}</span> : null}
            </button>
          ))}
        </div>
        <select className="form-input" value={channel} onChange={e => setChannel(e.target.value)} aria-label="Canal">
          <option value="">Todos los canales</option>
          {channelOptions.map(c => <option key={c.channel} value={c.channel}>{c.channel} ({c.count})</option>)}
          {channel && !channelOptions.some(c => c.channel === channel) && <option value={channel}>{channel}</option>}
        </select>
        <span className="brain-filters-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void load(null); loadChannels(); }} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : undefined} /> Actualizar
        </button>
      </div>

      {error && <div className="brain-ev-detail is-err" role="alert">{error}</div>}

      {loading ? (
        <div className="brain-list" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="brain-ev-skel" />)}</div>
      ) : events.length === 0 && !error ? (
        <div className="card empty-state">
          <div className="empty-icon"><Inbox size={36} /></div>
          <div className="empty-title">Nada por aquí todavía</div>
          <div className="empty-desc">
            {gate || channel ? "No hay eventos con estos filtros. Prueba con «Todas» o con otro canal." : "Cuando alguien escriba al chat, a la paleta, al buscador o use un estudio, aparecerá aquí."}
          </div>
        </div>
      ) : (
        <div className="brain-list">
          {events.map((ev, i) => <EventCard key={ev.id} ev={ev} index={i} />)}
        </div>
      )}

      {!loading && nextBefore && (
        <div className="brain-more">
          <button type="button" className="btn btn-ghost" onClick={() => load(nextBefore)} disabled={loadingMore}>
            {loadingMore ? <RefreshCw size={13} className="animate-spin" /> : null}
            {loadingMore ? "Cargando…" : "Cargar anteriores"}
          </button>
        </div>
      )}
    </div>
  );
}
