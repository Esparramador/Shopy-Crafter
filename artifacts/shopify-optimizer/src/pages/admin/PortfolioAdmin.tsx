import { useEffect, useRef, useState } from "react";
import { mediaSrc, type PortfolioProject } from "@/components/ProjectsShowcase";

const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Project = PortfolioProject & { published: boolean; sortOrder: number };
type QrImageCheck = { sizePx: number; passed: boolean };
type QrFileReport = { filename: string; checks: QrImageCheck[]; passed: boolean; reason?: string };
class ApiError extends Error {
  constructor(message: string, readonly body: unknown) { super(message); }
}

const EMPTY = { title: "", client: "", category: "", status: "", summary: "", description: "", features: "", tech: "", liveUrl: "", appUrl: "" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_ROOT}${path}`, { credentials: "include", ...init });
  const d: unknown = await r.json().catch(() => ({}));
  if (!r.ok) {
    const message = d && typeof d === "object" && "error" in d && typeof d.error === "string" ? d.error : `HTTP ${r.status}`;
    throw new ApiError(message, d);
  }
  return d as T;
}

function readQrReports(value: unknown): QrFileReport[] | null {
  if (!value || typeof value !== "object" || !("qrChecks" in value) || !Array.isArray(value.qrChecks)) return null;
  return value.qrChecks.filter((item): item is QrFileReport =>
    !!item && typeof item === "object" &&
    typeof item.filename === "string" && typeof item.passed === "boolean" &&
    Array.isArray(item.checks) &&
    item.checks.every((check: unknown) =>
      !!check && typeof check === "object" &&
      "sizePx" in check && typeof check.sizePx === "number" &&
      "passed" in check && typeof check.passed === "boolean"
    )
  );
}

const s = {
  card: { background: "var(--ink2,#13131f)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 } as React.CSSProperties,
  input: { width: "100%", background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 13, boxSizing: "border-box" } as React.CSSProperties,
  label: { fontSize: 11, color: "#9896ba", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, display: "block" } as React.CSSProperties,
  btn: { background: "#c9a961", color: "#000", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" } as React.CSSProperties,
  ghost: { background: "transparent", color: "#e8e0d0", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" } as React.CSSProperties,
};

/** Admin → Portfolio: proyectos realizados que se muestran en la landing. */
export default function PortfolioAdmin() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [qrArtwork, setQrArtwork] = useState(false);
  const [qrReports, setQrReports] = useState<QrFileReport[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setProjects(await api<Project[]>("/admin/portfolio")); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
  };
  useEffect(() => { void load(); }, []);

  const current = projects.find(p => p.id === selected) ?? null;
  useEffect(() => {
    setForm(current ? {
      title: current.title, client: current.client ?? "", category: current.category, status: current.status ?? "", summary: current.summary,
      description: current.description, features: (current.features ?? []).join("\n"), tech: current.tech.join(", "),
      liveUrl: current.liveUrl ?? "", appUrl: current.appUrl ?? "",
    } : EMPTY);
    setQrArtwork(false);
    setQrReports(null);
  }, [selected, current?.id]);

  const payload = () => ({
    title: form.title, client: form.client, category: form.category, status: form.status, summary: form.summary, description: form.description,
    features: form.features.split("\n").map(t => t.trim()).filter(Boolean),
    tech: form.tech.split(",").map(t => t.trim()).filter(Boolean), liveUrl: form.liveUrl, appUrl: form.appUrl,
  });

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); }
    catch (e) {
      if (e instanceof ApiError) {
        const reports = readQrReports(e.body);
        if (reports) setQrReports(reports);
      }
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" });
    }
    finally { setBusy(false); }
  };

  const save = () => run(async () => {
    if (current) await api(`/admin/portfolio/${current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
    else {
      const created = await api<Project>("/admin/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      setSelected(created.id);
    }
  }, "Guardado");

  const upload = (files: FileList | null) => {
    if (!current || !files?.length) return;
    const checkAsQrArtwork = qrArtwork;
    const fd = new FormData();
    Array.from(files).slice(0, 12).forEach(f => fd.append("files", f));
    if (checkAsQrArtwork) fd.append("qrArtwork", "true");
    setQrReports(null);
    void run(async () => {
      const response = await api<unknown>(`/admin/portfolio/${current.id}/images`, { method: "POST", body: fd });
      const reports = readQrReports(response);
      if (checkAsQrArtwork && reports) setQrReports(reports);
    }, checkAsQrArtwork ? "QR verificado y añadido" : "Imágenes subidas");
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => current && run(async () => {
    await api(`/admin/portfolio/${current.id}/images`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
  }, "Imagen eliminada");

  const makeCover = (url: string) => current && run(async () => {
    const images = [current.images.find(i => i.url === url)!, ...current.images.filter(i => i.url !== url)];
    await api(`/admin/portfolio/${current.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images }) });
  }, "Portada actualizada");

  const togglePublished = (p: Project) => run(async () => {
    await api(`/admin/portfolio/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !p.published }) });
  }, p.published ? "Oculto en la landing" : "Publicado en la landing");

  const move = (p: Project, delta: number) => {
    const sorted = [...projects];
    const i = sorted.findIndex(x => x.id === p.id);
    const j = i + delta;
    if (j < 0 || j >= sorted.length) return;
    [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    void run(async () => {
      await Promise.all(sorted.map((x, idx) => x.sortOrder === idx ? null : api(`/admin/portfolio/${x.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: idx }),
      })));
    }, "Orden actualizado");
  };

  const remove = () => current && window.confirm(`¿Borrar "${current.title}" y sus imágenes?`) && run(async () => {
    await api(`/admin/portfolio/${current.id}`, { method: "DELETE" });
    setSelected(null);
  }, "Proyecto borrado");

  const field = (key: keyof typeof EMPTY, label: string, opts: { area?: boolean; placeholder?: string } = {}) => (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={s.label}>{label}</span>
      {opts.area
        ? <textarea style={{ ...s.input, minHeight: 90, resize: "vertical" }} value={form[key]} placeholder={opts.placeholder} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
        : <input style={s.input} value={form[key]} placeholder={opts.placeholder} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />}
    </label>
  );

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1200, margin: "0 auto", color: "#e8e0d0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Portfolio de proyectos</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9896ba" }}>Lo que aparece en la sección "Proyectos realizados" de la landing. Sube capturas reales de cada proyecto.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/#fp-projects`} target="_blank" rel="noopener noreferrer" style={{ ...s.ghost, textDecoration: "none" }}>Ver en la landing ↗</a>
          <button type="button" style={s.btn} onClick={() => setSelected(null)}>＋ Nuevo proyecto</button>
        </div>
      </div>

      {msg && <div style={{ marginBottom: 12, fontSize: 13, color: msg.ok ? "#2dd49f" : "#ef4444" }}>{msg.text}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)", gap: 16 }} className="pf-admin-grid">
        <div style={s.card}>
          {projects.length === 0 && <div style={{ fontSize: 13, color: "#9896ba" }}>Sin proyectos todavía.</div>}
          {projects.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px", borderRadius: 8, background: p.id === selected ? "rgba(201,169,97,0.1)" : "transparent", cursor: "pointer" }}
              onClick={() => setSelected(p.id)}>
              <div style={{ width: 48, height: 32, borderRadius: 6, overflow: "hidden", background: "#0d0d1a", flexShrink: 0 }}>
                {p.images[0] && <img src={mediaSrc(p.images[0].url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                <div style={{ fontSize: 11, color: p.images.length ? "#9896ba" : "#eab308" }}>
                  {p.images.length ? `${p.images.length} imágenes` : "Sin imágenes"} · {p.published ? "publicado" : "oculto"}
                </div>
              </div>
              <button type="button" title="Subir" style={{ ...s.ghost, padding: "2px 6px" }} disabled={busy || i === 0} onClick={e => { e.stopPropagation(); move(p, -1); }}>↑</button>
              <button type="button" title="Bajar" style={{ ...s.ghost, padding: "2px 6px" }} disabled={busy || i === projects.length - 1} onClick={e => { e.stopPropagation(); move(p, 1); }}>↓</button>
              <button type="button" style={{ ...s.ghost, padding: "2px 8px" }} disabled={busy} onClick={e => { e.stopPropagation(); void togglePublished(p); }}>{p.published ? "Ocultar" : "Publicar"}</button>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>{current ? `Editar: ${current.title}` : "Nuevo proyecto"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0 12px" }}>
            {field("title", "Título")}
            {field("client", "Cliente (opcional)")}
            {field("category", "Categoría", { placeholder: "Web y app, Sistema a medida, Plataforma IA…" })}
            {field("tech", "Tecnologías / etiquetas (separadas por comas)")}
            {field("status", "Estado (En producción, Entregado, En desarrollo…)")}
            {field("liveUrl", "URL de la web (opcional)", { placeholder: "https://…" })}
            {field("appUrl", "URL de la app / tienda de apps (opcional)", { placeholder: "https://…" })}
          </div>
          {current?.slug === "qr-artisticos-3d" && (
            <p style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 8, background: "rgba(201,169,97,0.08)", color: "#d6c89f", fontSize: 12 }}>
              Esta ficha es solo para QR artísticos. Los regalos web y vídeos animados en 3D son servicios distintos; las placas y soportes físicos se gestionan en la tienda.
            </p>
          )}
          {field("summary", "Resumen (tarjeta)")}
          {field("features", "Qué hace: una característica por línea (máx. 12; la tarjeta enseña las 4 primeras)", { area: true })}
          {field("description", "Descripción (al abrir el proyecto)", { area: true })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={s.btn} disabled={busy || !form.title.trim()} onClick={() => void save()}>{busy ? "Guardando…" : current ? "Guardar cambios" : "Crear proyecto"}</button>
            {current && <button type="button" style={{ ...s.ghost, color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }} disabled={busy} onClick={() => void remove()}>Borrar proyecto</button>}
          </div>

          {current && (
            <div style={{ marginTop: 20 }}>
              <span style={s.label}>Imágenes ({current.images.length}) — la primera es la portada</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 10 }}>
                {current.images.map((im, idx) => (
                  <div key={im.url} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: idx === 0 ? "2px solid #c9a961" : "1px solid rgba(255,255,255,0.1)" }}>
                    <img src={mediaSrc(im.url)} alt={im.alt} style={{ width: "100%", aspectRatio: "16 / 10", objectFit: "cover", display: "block" }} />
                    <div style={{ display: "flex", gap: 4, padding: 6, background: "rgba(0,0,0,0.6)" }}>
                      {idx !== 0 && <button type="button" style={{ ...s.ghost, padding: "2px 6px", fontSize: 11 }} disabled={busy} onClick={() => void makeCover(im.url)}>Portada</button>}
                      <button type="button" style={{ ...s.ghost, padding: "2px 6px", fontSize: 11, color: "#ef4444" }} disabled={busy} onClick={() => void removeImage(im.url)}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => upload(e.target.files)} />
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <button type="button" style={s.btn} disabled={busy} onClick={() => fileRef.current?.click()}>
                  {qrArtwork ? "Comprobar y subir QR" : "Subir imágenes (hasta 12)"}
                </button>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "#e8e0d0", cursor: busy ? "default" : "pointer" }}>
                  <input
                    type="checkbox"
                    checked={qrArtwork}
                    disabled={busy}
                    onChange={e => { setQrArtwork(e.target.checked); setQrReports(null); setMsg(null); }}
                  />
                  Verificar como QR artístico
                </label>
              </div>
              <p style={{ fontSize: 12, color: "#9896ba", margin: "8px 0 0" }}>
                Actívalo solo si todas las imágenes elegidas son QR. Se revisan en JPG, PNG o WebP hasta 15 MB a 320, 256, 192, 160 y 128 px; si alguna falla, no se sube ninguna.
              </p>
              {qrReports && (
                <section aria-live="polite" role="status" style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: 13 }}>Resultado de lectura QR</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    {qrReports.map((report, index) => (
                      <div key={`${report.filename}-${index}`} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                        <strong style={{ fontSize: 12, overflowWrap: "anywhere" }}>
                          {report.filename} · {report.passed ? "Apto y subido" : "No publicado"}
                        </strong>
                        {report.reason && <p style={{ margin: "4px 0", color: "#fca5a5", fontSize: 12 }}>{report.reason}</p>}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          {report.checks.map(check => (
                            <span key={check.sizePx} style={{ padding: "4px 7px", borderRadius: 6, background: check.passed ? "rgba(45,212,159,.12)" : "rgba(239,68,68,.12)", color: check.passed ? "#6ee7b7" : "#fca5a5", fontSize: 11 }}>
                              {check.sizePx}px: {check.passed ? "legible" : "no legible"}
                            </span>
                          ))}
                          {report.checks.length === 0 && <span style={{ color: "#fca5a5", fontSize: 11 }}>Sin tamaños comprobables</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 860px) { .pf-admin-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
