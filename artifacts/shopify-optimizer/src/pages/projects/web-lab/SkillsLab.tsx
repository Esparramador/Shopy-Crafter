import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LiveOperation } from "@/components/LiveOperation";

// ══════════════════════════════════════════════════════════════════════════
// Web Lab · Skills — elegir una skill real (agencia o ciberseguridad), darle
// lo que pide y EJECUTARLA con el motor de la plataforma. Backend:
// GET /api/web-lab/skills · GET /api/web-lab/skills/:id · POST /api/web-lab/skills/run
// ══════════════════════════════════════════════════════════════════════════

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const HISTORY_KEY = "weblab.skills.history.v1";
const HISTORY_MAX = 15;
const PAGE = 60;

type Source = "agency" | "cybersec";
interface InputSpec {
  key: "text" | "url" | "imageUrl" | "format";
  label: string;
  kind: "textarea" | "url" | "select";
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}
export interface WebLabSkill {
  id: string;
  source: Source;
  skillId: string;
  name: string;
  description: string;
  category: string;
  executable: boolean;
  reason?: string;
  engine: "claude" | "claude-vision" | "gemini-search";
  output: "markdown" | "html" | "document";
  inputs: InputSpec[];
  note?: string;
}
interface CatalogResponse {
  total: number;
  executable: number;
  notExecutable: number;
  engines: { claude: boolean; gemini: boolean };
  skills: WebLabSkill[];
}
type RunOutput =
  | { kind: "markdown"; text: string }
  | { kind: "html"; html: string; text?: string }
  | { kind: "document"; file: { name: string; mimeType: string; base64: string; sizeBytes: number; vaultId: number | null }; outline: { title: string; sections: Array<{ heading?: string }> } };
interface RunResult {
  skill: { id: string; name: string; source: Source };
  output: RunOutput;
  engine: { provider: string; model: string; fallbackNote?: string };
  usage?: { inputTokens: number; outputTokens: number; costUsd: number };
  truncated: boolean;
  durationMs: number;
  fetched?: { url: string; status: number; bytes: number; contentType: string };
  sources?: string[];
}
interface HistoryEntry {
  at: string;
  skillId: string;
  skillName: string;
  summary: string;
  ok: boolean;
  error?: string;
  result?: RunResult;
}

const ENGINE_LABEL: Record<WebLabSkill["engine"], string> = {
  "claude": "Claude",
  "claude-vision": "Claude visión",
  "gemini-search": "Gemini + búsqueda web",
};
const OUTPUT_LABEL: Record<WebLabSkill["output"], string> = {
  markdown: "Informe de texto",
  html: "Página HTML",
  document: "Archivo de Office",
};

function readHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
function writeHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    // Sin espacio: se guarda sin los resultados pesados.
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX).map(h => ({ ...h, result: undefined })))); } catch { /* sin almacenamiento */ }
  }
}
/** Recorta lo que se guarda en el historial para no llenar localStorage. */
function compactForHistory(r: RunResult): RunResult {
  const o = r.output;
  if (o.kind === "markdown") return { ...r, output: { kind: "markdown", text: o.text.slice(0, 40_000) } };
  if (o.kind === "html") return o.html.length > 250_000 ? { ...r, output: { kind: "markdown", text: (o.text ?? "") + "\n\n(La página era demasiado grande para guardarla en el historial.)" } } : r;
  return o.file.base64.length > 700_000 ? { ...r, output: { ...o, file: { ...o.file, base64: "" } } } : r;
}

function downloadBase64(base64: string, mimeType: string, name: string): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadText(text: string, mimeType: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Markdown mínimo y seguro (sin innerHTML) ─────────────────────────────────
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("**")
      ? <strong key={i++} style={{ color: "var(--t, #f2f0ff)" }}>{tok.slice(2, -2)}</strong>
      : <code key={i++} style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4, fontSize: "0.92em" }}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0; let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={k++} style={{ background: "var(--ink, #0a0a0a)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 8, padding: 12, overflowX: "auto", fontSize: 12, color: "#86efac", margin: "10px 0" }}>{code.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const size = [20, 17, 15, 14][h[1].length - 1];
      blocks.push(<div key={k++} style={{ fontSize: size, fontWeight: 700, color: "var(--gold, #d4a843)", margin: "16px 0 6px" }}>{inline(h[2])}</div>);
      i++; continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); i++; }
      blocks.push(<ul key={k++} style={{ margin: "6px 0 6px 18px", padding: 0 }}>{items.map((it, j) => <li key={j} style={{ margin: "3px 0" }}>{inline(it)}</li>)}</ul>);
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(lines[i]); i++; }
      const cells = rows.filter(r => !/^\s*\|[\s:-]+\|/.test(r) || /[a-z0-9]/i.test(r.replace(/[|:\-\s]/g, ""))).map(r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
      blocks.push(
        <div key={k++} style={{ overflowX: "auto", margin: "8px 0" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: "60%" }}>
            <tbody>{cells.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", padding: "5px 8px", fontWeight: ri === 0 ? 700 : 400, color: ri === 0 ? "var(--t, #f2f0ff)" : undefined }}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(<p key={k++} style={{ margin: "6px 0", lineHeight: 1.6 }}>{inline(para.join(" "))}</p>);
  }
  return <div style={{ fontSize: 13.5, color: "var(--t2, #ccc)" }}>{blocks}</div>;
}

// ── Estilos compartidos ──────────────────────────────────────────────────────
const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "var(--ink, #0a0a0a)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))",
  borderRadius: 8, color: "var(--t, #f2f0ff)", fontSize: 13, outline: "none", boxSizing: "border-box",
};
const chip = (active: boolean): React.CSSProperties => ({
  padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
  border: active ? "1px solid transparent" : "1px solid var(--bdr2, rgba(255,255,255,0.10))",
  background: active ? "linear-gradient(135deg, #d4a843, #b8860b)" : "transparent",
  color: active ? "#000" : "var(--t2, #aaa)", fontWeight: active ? 700 : 500,
});
const badge = (color: string): React.CSSProperties => ({
  display: "inline-block", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
  color, border: `1px solid ${color}55`, background: `${color}14`, whiteSpace: "nowrap",
});

export function SkillsLab({ projectId, defaultUrl, initialSkillId }: { projectId: number; defaultUrl?: string; initialSkillId?: string | null }) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | Source>("all");
  const [category, setCategory] = useState("");
  const [onlyExecutable, setOnlyExecutable] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [selectedId, setSelectedId] = useState<string | null>(initialSkillId ?? null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readHistory());
  const [skillMd, setSkillMd] = useState<{ id: string; text: string; chars: number } | null>(null);
  const [showMd, setShowMd] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch(`${API_BASE}/api/web-lab/skills`, { credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setCatalog(j as CatalogResponse);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (initialSkillId) { setSelectedId(initialSkillId); setOnlyExecutable(false); }
  }, [initialSkillId]);

  const selected = useMemo(() => catalog?.skills.find(s => s.id === selectedId) ?? null, [catalog, selectedId]);

  // Al cambiar de skill: entradas por defecto, resultado limpio y SKILL.md bajo demanda.
  useEffect(() => {
    if (!selected) return;
    const init: Record<string, string> = {};
    for (const spec of selected.inputs) {
      if (spec.defaultValue) init[spec.key] = spec.defaultValue;
      if (spec.key === "url" && defaultUrl) init.url = defaultUrl;
    }
    setInputs(init);
    setRunError(null);
    setResult(null);
    setShowMd(false);
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selected, defaultUrl]);

  useEffect(() => {
    if (!showMd || !selected || skillMd?.id === selected.id) return;
    void (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/web-lab/skills/${encodeURIComponent(selected.id)}`, { credentials: "include" });
        const j = await r.json();
        setSkillMd({ id: selected.id, text: j.skillMd ?? "", chars: j.skillMdChars ?? 0 });
      } catch { setSkillMd({ id: selected.id, text: "No se pudo cargar el SKILL.md.", chars: 0 }); }
    })();
  }, [showMd, selected, skillMd?.id]);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of catalog?.skills ?? []) {
      if (source !== "all" && s.source !== source) continue;
      m.set(s.category, (m.get(s.category) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalog, source]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return (catalog?.skills ?? []).filter(s => {
      if (source !== "all" && s.source !== source) return false;
      if (category && s.category !== category) return false;
      if (onlyExecutable && !s.executable) return false;
      if (!words.length) return true;
      const hay = `${s.name} ${s.skillId} ${s.description} ${s.category}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [catalog, query, source, category, onlyExecutable]);

  useEffect(() => { setLimit(PAGE); }, [query, source, category, onlyExecutable]);

  const missing = selected?.inputs.filter(s => s.required && !(inputs[s.key] ?? "").trim()) ?? [];
  const needsTextOrUrl = selected && selected.engine !== "claude-vision" && !(inputs.text ?? "").trim() && !(inputs.url ?? "").trim();
  const canRun = !!selected?.executable && !running && missing.length === 0 && !needsTextOrUrl;

  const run = async () => {
    if (!selected || !canRun) return;
    setRunning(true); setRunError(null); setResult(null);
    const summary = (inputs.text || inputs.url || inputs.imageUrl || "").slice(0, 120);
    try {
      const r = await fetch(`${API_BASE}/api/web-lab/skills/run`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, inputs, projectId }),
      });
      const j = await r.json().catch(() => ({ error: `Respuesta no válida del servidor (HTTP ${r.status})` }));
      if (!r.ok || j?.error) throw new Error(j?.error || `HTTP ${r.status}`);
      const res = j as RunResult;
      setResult(res);
      const next = [{ at: new Date().toISOString(), skillId: selected.id, skillName: selected.name, summary, ok: true, result: compactForHistory(res) }, ...history].slice(0, HISTORY_MAX);
      setHistory(next); writeHistory(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRunError(msg);
      const next = [{ at: new Date().toISOString(), skillId: selected.id, skillName: selected.name, summary, ok: false, error: msg }, ...history].slice(0, HISTORY_MAX);
      setHistory(next); writeHistory(next);
    } finally {
      setRunning(false);
    }
  };

  const openHistory = (h: HistoryEntry) => {
    setSelectedId(h.skillId);
    // El efecto de selección limpia el resultado; se restaura después.
    setTimeout(() => { if (h.result) setResult(h.result); if (h.error) setRunError(h.error); }, 0);
  };

  const progressMessages = useMemo(() => {
    if (!selected) return ["Ejecutando…"];
    const m: string[] = [];
    if ((inputs.url ?? "").trim() && selected.engine !== "claude-vision") m.push(`Leyendo ${inputs.url} en pasivo…`);
    m.push(`Cargando el SKILL.md real de «${selected.skillId}»…`);
    m.push(selected.engine === "gemini-search" ? "Investigando con Gemini y Google Search…" : selected.engine === "claude-vision" ? "Claude está mirando la captura…" : "Claude está ejecutando la skill…");
    if (selected.output === "document") m.push("Montando el archivo de Office real…");
    if (selected.output === "html") m.push("Construyendo la página HTML…");
    return m;
  }, [selected, inputs.url]);

  if (loadError) {
    return (
      <div style={{ background: "#1a0a0a", border: "1px solid #ef444455", borderRadius: 12, padding: 20, color: "#fca5a5" }}>
        No se pudo cargar el catálogo de skills: {loadError}
        <button onClick={() => void load()} style={{ marginLeft: 12, ...chip(false) }}>Reintentar</button>
      </div>
    );
  }
  if (!catalog) return <div style={{ color: "var(--t2, #aaa)", padding: 24 }}>Cargando catálogo de skills…</div>;

  return (
    <div data-testid="skills-lab" style={{ display: "grid", gap: 20 }}>
      {/* Resumen honesto */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={badge("#22c55e")}>{catalog.executable} ejecutables</span>
        <span style={badge("#f59e0b")}>{catalog.notExecutable} no ejecutables (con motivo)</span>
        <span style={badge(catalog.engines.claude ? "#60a5fa" : "#ef4444")}>Claude {catalog.engines.claude ? "configurado" : "sin clave"}</span>
        <span style={badge(catalog.engines.gemini ? "#a78bfa" : "#9ca3af")}>Gemini {catalog.engines.gemini ? "configurado" : "sin clave"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 20, alignItems: "start" }}>
        {/* ── Selector ── */}
        <div style={{ background: "var(--ink2, #111121)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 16, padding: 16, minWidth: 0 }}>
          <input
            data-testid="skills-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Buscar entre ${catalog.total} skills (p. ej. «seo», «cabeceras», «factura»)`}
            style={fieldStyle}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {([["all", "Todas"], ["agency", "Agencia"], ["cybersec", "Ciberseguridad"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => { setSource(v); setCategory(""); }} style={chip(source === v)}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...fieldStyle, width: "auto", flex: 1, minWidth: 160, padding: "8px 10px" }}>
              <option value="">Todas las categorías</option>
              {categories.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
            </select>
            <label style={{ fontSize: 12, color: "var(--t2, #aaa)", display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={onlyExecutable} onChange={e => setOnlyExecutable(e.target.checked)} />
              Solo ejecutables
            </label>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--t3, #777)", margin: "10px 0 6px" }}>{filtered.length} skills</div>
          <div role="listbox" aria-label="Skills" style={{ maxHeight: 560, overflowY: "auto", display: "grid", gap: 6, paddingRight: 4 }}>
            {filtered.slice(0, limit).map(s => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  role="option"
                  aria-selected={active}
                  data-skill-id={s.id}
                  onClick={() => setSelectedId(s.id)}
                  style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    border: active ? "1px solid #d4a843" : "1px solid var(--bdr2, rgba(255,255,255,0.10))",
                    background: active ? "rgba(212,168,67,0.10)" : "var(--ink, #0a0a0a)",
                    color: "var(--t, #f2f0ff)", transition: "border-color .15s, background .15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    {s.executable ? <span style={badge("#22c55e")}>▶ ejecutable</span> : <span style={badge("#f59e0b")} title={s.reason}>no ejecutable</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--t3, #888)", marginTop: 3 }}>{s.source === "agency" ? "Agencia" : "Ciberseguridad"} · {s.category}</div>
                </button>
              );
            })}
            {filtered.length > limit && (
              <button onClick={() => setLimit(l => l + PAGE)} style={{ ...chip(false), justifySelf: "center", margin: "6px 0" }}>Ver {Math.min(PAGE, filtered.length - limit)} más</button>
            )}
            {filtered.length === 0 && <div style={{ fontSize: 12.5, color: "var(--t3, #777)", padding: 12 }}>Ninguna skill coincide. Quita filtros o desmarca «Solo ejecutables».</div>}
          </div>
        </div>

        {/* ── Detalle + ejecución ── */}
        <div ref={detailRef} style={{ background: "var(--ink2, #111121)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 16, padding: 20, minWidth: 0 }}>
          {!selected ? (
            <div style={{ color: "var(--t2, #aaa)", fontSize: 14, lineHeight: 1.6 }}>
              Elige una skill de la lista. Verás qué hace, qué necesita y con qué motor se ejecuta; pulsa <b>Ejecutar</b> y el resultado sale aquí.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }} data-testid="skill-detail">
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <span style={badge(selected.source === "agency" ? "#d4a843" : "#60a5fa")}>{selected.source === "agency" ? "Agencia" : "Ciberseguridad"} · {selected.category}</span>
                  <span style={badge("#a78bfa")}>{ENGINE_LABEL[selected.engine]}</span>
                  <span style={badge("#22d3ee")}>{OUTPUT_LABEL[selected.output]}</span>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--t, #f2f0ff)", margin: "4px 0" }}>{selected.name}</h3>
                <code style={{ fontSize: 11, color: "var(--t3, #777)" }}>{selected.skillId}</code>
                {selected.description && <p style={{ fontSize: 13, color: "var(--t2, #bbb)", lineHeight: 1.6, margin: "8px 0 0" }}>{selected.description}</p>}
                {selected.note && <p style={{ fontSize: 12, color: "#93c5fd", margin: "8px 0 0" }}>ℹ️ {selected.note}</p>}
                <button onClick={() => setShowMd(v => !v)} style={{ ...chip(showMd), marginTop: 10, fontSize: 11 }}>{showMd ? "Ocultar SKILL.md" : "Ver SKILL.md real"}</button>
                {showMd && (
                  <pre style={{ marginTop: 8, maxHeight: 260, overflow: "auto", background: "var(--ink, #0a0a0a)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 8, padding: 10, fontSize: 11, color: "var(--t2, #aaa)", whiteSpace: "pre-wrap" }}>
                    {skillMd?.id === selected.id ? `${skillMd.text}${skillMd.chars > skillMd.text.length ? `\n\n… (${skillMd.chars} caracteres en total; el motor recibe el archivo entero)` : ""}` : "Cargando…"}
                  </pre>
                )}
              </div>

              {!selected.executable ? (
                <div data-testid="skill-not-executable" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: 14, fontSize: 13, color: "#fcd34d", lineHeight: 1.6 }}>
                  <b>No se puede ejecutar desde el Web Lab.</b><br />{selected.reason}
                </div>
              ) : (
                <>
                  {selected.inputs.map(spec => (
                    <div key={spec.key}>
                      <label style={{ fontSize: 12, color: "var(--t2, #999)", display: "block", marginBottom: 5 }}>
                        {spec.label}{spec.required ? " *" : ""}
                      </label>
                      {spec.kind === "textarea" ? (
                        <textarea
                          data-testid={`skill-input-${spec.key}`}
                          value={inputs[spec.key] ?? ""}
                          onChange={e => setInputs(v => ({ ...v, [spec.key]: e.target.value }))}
                          placeholder={spec.placeholder}
                          rows={5}
                          disabled={running}
                          style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
                        />
                      ) : spec.kind === "select" ? (
                        <select value={inputs[spec.key] ?? spec.defaultValue ?? ""} onChange={e => setInputs(v => ({ ...v, [spec.key]: e.target.value }))} disabled={running} style={fieldStyle}>
                          {spec.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          data-testid={`skill-input-${spec.key}`}
                          type="url"
                          value={inputs[spec.key] ?? ""}
                          onChange={e => setInputs(v => ({ ...v, [spec.key]: e.target.value }))}
                          placeholder={spec.placeholder}
                          disabled={running}
                          style={fieldStyle}
                        />
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      data-testid="skill-run"
                      onClick={() => void run()}
                      disabled={!canRun}
                      style={{
                        padding: "12px 26px", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14,
                        background: canRun ? "linear-gradient(135deg, #d4a843, #b8860b)" : "#333",
                        color: canRun ? "#000" : "#777", cursor: canRun ? "pointer" : "not-allowed",
                        boxShadow: canRun ? "0 6px 20px rgba(212,168,67,0.25)" : "none", transition: "transform .1s",
                      }}
                    >
                      {running ? "Ejecutando…" : "▶ Ejecutar skill"}
                    </button>
                    {!running && (missing.length > 0 || needsTextOrUrl) && (
                      <span style={{ fontSize: 12, color: "var(--t3, #888)" }}>
                        {missing.length > 0 ? `Falta: ${missing.map(m => m.label).join(", ")}` : "Escribe el encargo o indica una URL."}
                      </span>
                    )}
                  </div>
                  <LiveOperation active={running} title={`Ejecutando ${selected.name}`} messages={progressMessages} rotateEverySec={6} estimatedSec={selected.output === "document" ? 60 : 45} />
                </>
              )}

              {runError && (
                <div data-testid="skill-error" role="alert" style={{ background: "#1a0a0a", border: "1px solid #ef444466", borderRadius: 10, padding: 12, color: "#fca5a5", fontSize: 13 }}>
                  ❌ {runError}
                </div>
              )}

              {result && <ResultView result={result} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Historial ── */}
      <div style={{ background: "var(--ink2, #111121)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t, #f2f0ff)" }}>Últimas ejecuciones</span>
          {history.length > 0 && <button onClick={() => { setHistory([]); writeHistory([]); }} style={{ ...chip(false), fontSize: 11 }}>Vaciar</button>}
        </div>
        {history.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--t3, #777)" }}>Aún no has ejecutado ninguna skill en este navegador.</div>
        ) : (
          <div data-testid="skills-history" style={{ display: "grid", gap: 6 }}>
            {history.map((h, i) => (
              <button key={`${h.at}-${i}`} onClick={() => openHistory(h)} style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", background: "var(--ink, #0a0a0a)", color: "var(--t2, #bbb)", cursor: "pointer", fontSize: 12.5 }}>
                <span style={{ color: h.ok ? "#22c55e" : "#ef4444" }}>{h.ok ? "✔" : "✖"}</span>
                <span style={{ fontWeight: 600, color: "var(--t, #f2f0ff)", whiteSpace: "nowrap" }}>{h.skillName}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--t3, #888)" }}>{h.ok ? h.summary : h.error}</span>
                <span style={{ fontSize: 11, color: "var(--t3, #777)", whiteSpace: "nowrap" }}>{new Date(h.at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({ result }: { result: RunResult }) {
  const o = result.output;
  const [copied, setCopied] = useState(false);
  const meta = [
    `${result.engine.provider === "gemini" ? "Gemini" : "Claude"} · ${result.engine.model}`,
    `${(result.durationMs / 1000).toFixed(1)} s`,
    result.usage ? `${result.usage.inputTokens.toLocaleString("es-ES")} → ${result.usage.outputTokens.toLocaleString("es-ES")} tokens` : null,
    result.fetched ? `URL leída: HTTP ${result.fetched.status} · ${(result.fetched.bytes / 1024).toFixed(0)} KB` : null,
  ].filter(Boolean).join(" · ");
  const copyText = o.kind === "markdown" ? o.text : o.kind === "html" ? o.html : "";

  return (
    <div data-testid="skill-result" style={{ borderTop: "1px solid var(--bdr2, rgba(255,255,255,0.10))", paddingTop: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#22c55e" }}>✔ Resultado</span>
        <span style={{ fontSize: 11, color: "var(--t3, #888)" }}>{meta}</span>
      </div>
      {result.engine.fallbackNote && <div style={{ fontSize: 12, color: "#fcd34d" }}>⚠️ {result.engine.fallbackNote}</div>}
      {result.truncated && <div style={{ fontSize: 12, color: "#fcd34d" }}>⚠️ La respuesta llegó al límite de longitud y puede estar incompleta.</div>}

      {o.kind === "markdown" && (
        <div style={{ background: "var(--ink, #0a0a0a)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 10, padding: 16, maxHeight: 620, overflowY: "auto" }}>
          <Markdown text={o.text} />
        </div>
      )}

      {o.kind === "html" && (
        <>
          <iframe
            title="Resultado HTML de la skill"
            data-testid="skill-result-iframe"
            srcDoc={o.html}
            sandbox="allow-scripts"
            style={{ width: "100%", height: 520, border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 10, background: "#fff" }}
          />
          {o.text && <div style={{ fontSize: 12.5 }}><Markdown text={o.text} /></div>}
        </>
      )}

      {o.kind === "document" && (
        <div style={{ background: "var(--ink, #0a0a0a)", border: "1px solid var(--bdr2, rgba(255,255,255,0.10))", borderRadius: 10, padding: 16, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t, #f2f0ff)" }}>📄 {o.file.name}</div>
          <div style={{ fontSize: 12, color: "var(--t3, #888)" }}>
            {(o.file.sizeBytes / 1024).toFixed(1)} KB · {o.outline.sections.length} secciones{o.file.vaultId ? ` · guardado en el Vault (#${o.file.vaultId})` : ""}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--t2, #bbb)" }}>
            {o.outline.sections.slice(0, 12).map((s, i) => <li key={i}>{s.heading || `Sección ${i + 1}`}</li>)}
          </ul>
          {o.file.base64 ? (
            <button data-testid="skill-download" onClick={() => downloadBase64(o.file.base64, o.file.mimeType, o.file.name)} style={{ ...chip(true), justifySelf: "start", padding: "10px 18px", fontSize: 13 }}>⬇ Descargar {o.file.name}</button>
          ) : (
            <div style={{ fontSize: 12, color: "var(--t3, #888)" }}>El archivo era demasiado grande para el historial; vuelve a ejecutar la skill para descargarlo.</div>
          )}
        </div>
      )}

      {(o.kind === "markdown" || o.kind === "html") && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { void navigator.clipboard?.writeText(copyText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} style={chip(false)}>{copied ? "Copiado" : "Copiar"}</button>
          {o.kind === "markdown" && <button onClick={() => downloadText(o.text, "text/markdown", `${result.skill.id.split(":")[1]}.md`)} style={chip(false)}>Descargar .md</button>}
          {o.kind === "html" && <button onClick={() => downloadText(o.html, "text/html", `${result.skill.id.split(":")[1]}.html`)} style={chip(false)}>Descargar .html</button>}
        </div>
      )}

      {result.sources && result.sources.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--t3, #888)" }}>
          Fuentes: {result.sources.slice(0, 10).map((s, i) => <a key={i} href={s} target="_blank" rel="noreferrer noopener" style={{ color: "#93c5fd", marginRight: 10 }}>{(() => { try { return new URL(s).hostname; } catch { return s; } })()}</a>)}
        </div>
      )}
    </div>
  );
}
