import { useState, useEffect, useCallback } from "react";
import { ClientLayout } from "./ClientLayout";
import { useClientPreview } from "./ClientPreviewContext";
import { useAuth } from "@/contexts/AuthContext";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

function timeSince(iso: string): string {
  try {
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return "Ahora mismo";
    if (d < 3600) return `Hace ${Math.floor(d / 60)} min`;
    if (d < 86400) return `Hace ${Math.floor(d / 3600)} h`;
    if (d < 604800) return `Hace ${Math.floor(d / 86400)} días`;
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function renderContent(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code style=\"background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:0.92em\">$1</code>")
    .replace(/\n/g, "<br>");
}

export default function ClientNotebook() {
  const { user } = useAuth();
  const { previewPid } = useClientPreview();
  const isAdmin = user?.role === "admin";
  function apid(url: string) { return isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url; }

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [compiling, setCompiling] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(apid(`${API}/client/notebook`), { credentials: "include" })
      .then(r => r.json())
      .then(d => { setNotes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [previewPid]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const deleteNote = async (id: number) => {
    if (!confirm("¿Eliminar esta nota del cuaderno?")) return;
    setDeleting(id);
    await fetch(apid(`${API}/client/notebook/${id}`), { method: "DELETE", credentials: "include" }).catch(() => {});
    setDeleting(null);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const addNote = async () => {
    if (!addContent.trim()) return;
    setAdding(true);
    await fetch(apid(`${API}/client/notebook`), {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: addTitle.trim() || undefined, content: addContent.trim() }),
    }).catch(() => {});
    setAdding(false);
    setAddOpen(false);
    setAddTitle(""); setAddContent("");
    load();
  };

  const compile = async () => {
    setCompiling(true);
    try {
      const r = await fetch(apid(`${API}/client/notebook/compile`), { method: "POST", credentials: "include" });
      if (!r.ok) { alert("No hay notas para compilar"); setCompiling(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cuaderno-investigacion.txt"; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Error compilando"); } finally { setCompiling(false); }
  };

  const filtered = notes.filter(n =>
    !search.trim() ||
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ClientLayout>
      <style>{`
        @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .nb-card{transition:box-shadow 0.15s,border-color 0.15s!important;}
        .nb-card:hover{border-color:rgba(201,169,97,0.22)!important;box-shadow:0 6px 28px rgba(0,0,0,0.4)!important;}
        .nb-del{transition:all 0.13s!important;}
        .nb-del:hover{background:rgba(239,68,68,0.1)!important;color:#f87171!important;border-color:rgba(239,68,68,0.25)!important;}
        .nb-chip{transition:all 0.13s!important;}
        .nb-chip:hover{background:rgba(201,169,97,0.12)!important;border-color:rgba(201,169,97,0.3)!important;color:var(--gold)!important;}
      `}</style>

      <div style={{ maxWidth: 900, animation: "rise 0.35s ease forwards" }}>

        {/* ── HEADER ── */}
        <div style={{
          background: "var(--srf)", border: "1px solid rgba(201,169,97,0.14)", borderRadius: 18,
          padding: "22px 26px", marginBottom: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📋</div>
            <div>
              <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, fontWeight: 400, margin: 0, lineHeight: 1.1 }}>
                Cuaderno de <span style={{ color: "var(--gold2)" }}>Investigación</span>
              </h1>
              <p style={{ fontSize: 11, color: "var(--t3)", margin: 0, marginTop: 3 }}>
                {notes.length} nota{notes.length !== 1 ? "s" : ""} guardada{notes.length !== 1 ? "s" : ""} · Guarda respuestas del chat IA y compílalas en un documento
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => setAddOpen(o => !o)}
              style={{ padding: "9px 16px", background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.2)", borderRadius: 10, color: "var(--gold)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >✏️ Añadir nota</button>
            <button
              onClick={compile} disabled={compiling || notes.length === 0}
              style={{ padding: "9px 16px", background: notes.length > 0 ? "linear-gradient(135deg,#c9a961,#8b6914)" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 10, color: notes.length > 0 ? "#0a0a0f" : "var(--t3)", fontSize: 12.5, fontWeight: 700, cursor: notes.length > 0 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6 }}
            >
              {compiling
                ? <><div style={{ width: 12, height: 12, border: "2px solid rgba(10,10,15,0.2)", borderTopColor: "#0a0a0f", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} /> Compilando…</>
                : "📄 Compilar todo → TXT"}
            </button>
          </div>
        </div>

        {/* ── ADD NOTE PANEL ── */}
        {addOpen && (
          <div style={{ background: "var(--srf)", border: "1px solid rgba(201,169,97,0.18)", borderRadius: 14, padding: "18px 20px", marginBottom: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0, marginBottom: 10 }}>✏️ Nueva nota</p>
            <input
              value={addTitle} onChange={e => setAddTitle(e.target.value)}
              placeholder="Título (opcional — se auto-genera del contenido)"
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--t1)", outline: "none", marginBottom: 8, boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.35)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <textarea
              value={addContent} onChange={e => setAddContent(e.target.value)}
              placeholder="Escribe o pega el contenido de la nota…"
              rows={5}
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "var(--t1)", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.55, boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.35)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setAddOpen(false); setAddTitle(""); setAddContent(""); }} style={{ padding: "8px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, color: "var(--t2)", fontSize: 12.5, cursor: "pointer" }}>Cancelar</button>
              <button onClick={addNote} disabled={adding || !addContent.trim()} style={{ padding: "8px 18px", background: "linear-gradient(135deg,#c9a961,#8b6914)", border: "none", borderRadius: 9, color: "#0a0a0f", fontSize: 12.5, fontWeight: 700, cursor: addContent.trim() ? "pointer" : "not-allowed" }}>
                {adding ? "Guardando…" : "💾 Guardar nota"}
              </button>
            </div>
          </div>
        )}

        {/* ── SEARCH ── */}
        {notes.length > 3 && (
          <div style={{ marginBottom: 12 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar en el cuaderno…"
              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "var(--t1)", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.3)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.07)"}
            />
          </div>
        )}

        {/* ── STATS ROW ── */}
        {notes.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { icon: "📝", label: "Notas", value: notes.length },
              { icon: "📅", label: "Última", value: timeSince(notes[0]?.created_at ?? "") },
              { icon: "📊", label: "Palabras tot.", value: notes.reduce((s, n) => s + n.content.split(/\s+/).length, 0).toLocaleString("es-ES") },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", gap: 9, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
                <span style={{ fontSize: 16 }}>{stat.icon}</span>
                <div>
                  <p style={{ fontSize: 9, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>{stat.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--gold)", margin: 0 }}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── NOTES LIST ── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(201,169,97,0.15)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "52px 24px", textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📋</div>
            <p style={{ color: "var(--t2)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {search ? "No hay notas que coincidan" : "El cuaderno está vacío"}
            </p>
            <p style={{ color: "var(--t3)", fontSize: 13, maxWidth: 420, margin: "0 auto 20px" }}>
              {search
                ? "Prueba con otro término de búsqueda."
                : "Usa el chat IA (botón 🤖 abajo) y cuando obtengas una respuesta útil, haz clic en \"💾 Guardar en Cuaderno\" para guardarla aquí. Después compílalas todas en un TXT listo para Claude o tu agencia."}
            </p>
            {!search && (
              <button onClick={() => setAddOpen(true)} style={{ padding: "10px 20px", background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.25)", borderRadius: 10, color: "var(--gold)", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                ✏️ Añadir primera nota
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((note, idx) => {
              const isOpen = expanded.has(note.id);
              const preview = note.content.length > 180 ? note.content.slice(0, 180) + "…" : note.content;
              const wordCount = note.content.split(/\s+/).length;
              return (
                <div key={note.id} className="nb-card" style={{
                  background: "var(--srf)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
                  overflow: "hidden", boxShadow: "0 3px 16px rgba(0,0,0,0.25)",
                  animation: `rise 0.3s ${idx * 0.04}s ease both`,
                }}>
                  {/* Card header */}
                  <div
                    onClick={() => toggleExpand(note.id)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", cursor: "pointer" }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, marginTop: 1 }}>
                      📝
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1)", margin: 0, marginBottom: 3, lineHeight: 1.35 }}>{note.title}</p>
                      {!isOpen && (
                        <p style={{ fontSize: 11.5, color: "var(--t3)", margin: 0, lineHeight: 1.5 }}>{preview}</p>
                      )}
                      <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>📅 {fmtDate(note.created_at)}</span>
                        <span style={{ fontSize: 10, color: "var(--t3)" }}>📖 {wordCount} palabras</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                        disabled={deleting === note.id}
                        className="nb-del"
                        style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}
                      >
                        {deleting === note.id ? "⏳" : "🗑"}
                      </button>
                      <div style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--t3)", flexShrink: 0 }}>
                        {isOpen ? "▲" : "▼"}
                      </div>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isOpen && (
                    <div style={{ padding: "0 16px 14px 60px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <div
                        style={{ marginTop: 10, fontSize: 13, color: "var(--t2)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}
                        dangerouslySetInnerHTML={{ __html: renderContent(note.content) }}
                      />
                      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(note.content).catch(() => {});
                          }}
                          className="nb-chip"
                          style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--t3)", fontSize: 11, cursor: "pointer" }}
                        >📋 Copiar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── COMPILE CTA (bottom) ── */}
        {notes.length >= 2 && (
          <div style={{
            marginTop: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.06),rgba(42,122,75,0.04))",
            border: "1px solid rgba(201,169,97,0.16)", borderRadius: 14, padding: "18px 22px",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14,
          }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", margin: 0 }}>Listo para compilar</p>
              <p style={{ fontSize: 11.5, color: "var(--t3)", margin: 0, marginTop: 3 }}>
                {notes.length} notas · {notes.reduce((s, n) => s + n.content.split(/\s+/).length, 0).toLocaleString("es-ES")} palabras → 1 documento TXT listo para Claude o tu agencia
              </p>
            </div>
            <button
              onClick={compile} disabled={compiling}
              style={{ padding: "10px 22px", background: "linear-gradient(135deg,#c9a961,#8b6914)", border: "none", borderRadius: 10, color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
            >
              {compiling ? "Compilando…" : "📄 Descargar TXT compilado"}
            </button>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
