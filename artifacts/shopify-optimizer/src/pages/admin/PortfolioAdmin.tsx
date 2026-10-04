import { useEffect, useRef, useState } from "react";
import { mediaSrc, type PortfolioProject } from "@/components/ProjectsShowcase";

const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Project = PortfolioProject & { published: boolean; sortOrder: number };

const EMPTY = { title: "", client: "", category: "", summary: "", description: "", tech: "", liveUrl: "", appUrl: "" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_ROOT}${path}`, { credentials: "include", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `HTTP ${r.status}`);
  return d as T;
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
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setProjects(await api<Project[]>("/admin/portfolio")); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
  };
  useEffect(() => { void load(); }, []);

  const current = projects.find(p => p.id === selected) ?? null;
  useEffect(() => {
    setForm(current ? {
      title: current.title, client: current.client ?? "", category: current.category, summary: current.summary,
      description: current.description, tech: current.tech.join(", "), liveUrl: current.liveUrl ?? "", appUrl: current.appUrl ?? "",
    } : EMPTY);
  }, [selected, current?.id]);

  const payload = () => ({
    title: form.title, client: form.client, category: form.category, summary: form.summary, description: form.description,
    tech: form.tech.split(",").map(t => t.trim()).filter(Boolean), liveUrl: form.liveUrl, appUrl: form.appUrl,
  });

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); }
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
    const fd = new FormData();
    Array.from(files).slice(0, 12).forEach(f => fd.append("files", f));
    void run(async () => { await api(`/admin/portfolio/${current.id}/images`, { method: "POST", body: fd }); }, "Imágenes subidas");
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
            {field("liveUrl", "URL de la web (opcional)", { placeholder: "https://…" })}
            {field("appUrl", "URL de la app / tienda de apps (opcional)", { placeholder: "https://…" })}
          </div>
          {field("summary", "Resumen (tarjeta)")}
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
              <button type="button" style={s.btn} disabled={busy} onClick={() => fileRef.current?.click()}>Subir imágenes (hasta 12)</button>
              <p style={{ fontSize: 12, color: "#9896ba", margin: "8px 0 0" }}>JPG, PNG o WebP hasta 15 MB. Se optimizan a WebP de 2000 px.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 860px) { .pf-admin-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
