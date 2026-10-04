import { useEffect, useState, useCallback } from "react";

const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface PortfolioProject {
  id: number; slug: string; title: string; client: string | null; category: string;
  summary: string; description: string; tech: string[]; liveUrl: string | null; appUrl: string | null;
  images: { url: string; alt: string }[];
}

/** Las URLs de /api/media vienen sin la base de la app: se prefijan para subrutas. */
export function mediaSrc(url: string): string {
  return url.startsWith("/api/") ? API_ROOT + url.slice(4) : url;
}

/** Proyectos reales del equipo (Admin → Portfolio), con galería de imágenes. */
export default function ProjectsShowcase() {
  const [projects, setProjects] = useState<PortfolioProject[] | null>(null);
  const [open, setOpen] = useState<PortfolioProject | null>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`${API_ROOT}/portfolio`)
      .then(r => (r.ok ? r.json() : []))
      .then((d: unknown) => { if (alive) setProjects(Array.isArray(d) ? d as PortfolioProject[] : []); })
      .catch(() => { if (alive) setProjects([]); });
    return () => { alive = false; };
  }, []);

  const close = useCallback(() => setOpen(null), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setImgIdx(i => Math.min(i + 1, open.images.length - 1));
      if (e.key === "ArrowLeft") setImgIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (projects === null) return <div className="lx-projects-loading" aria-busy="true" />;
  if (projects.length === 0) return null;

  return (
    <>
      <ul className="lx-projects" aria-label="Proyectos realizados">
        {projects.map(p => {
          const cover = p.images[0];
          return (
            <li key={p.id}>
              <button type="button" className="lx-project" onClick={() => { setOpen(p); setImgIdx(0); }}>
                <span className={`lx-project-cover${cover ? "" : " lx-project-cover-text"}`}>
                  {cover
                    ? <img src={mediaSrc(cover.url)} alt={cover.alt || p.title} loading="lazy" decoding="async" />
                    : <span aria-hidden="true">{p.title}</span>}
                  {p.images.length > 1 && <span className="lx-project-count">{p.images.length} imágenes</span>}
                </span>
                <span className="lx-project-body">
                  <span className="lx-project-cat">{p.category}</span>
                  <span className="lx-project-title">{p.title}</span>
                  <span className="lx-project-summary">{p.summary}</span>
                  {p.tech.length > 0 && (
                    <span className="lx-project-tech">{p.tech.slice(0, 4).map(t => <span key={t}>{t}</span>)}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="lx-project-modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={close}>
          <div className="lx-project-modal-card" onClick={e => e.stopPropagation()}>
            <button type="button" className="lx-project-close" onClick={close} aria-label="Cerrar">×</button>
            {open.images.length > 0 && (
              <div className="lx-project-gallery">
                <img src={mediaSrc(open.images[imgIdx].url)} alt={open.images[imgIdx].alt || open.title} />
                {open.images.length > 1 && (
                  <div className="lx-project-thumbs">
                    {open.images.map((im, i) => (
                      <button key={im.url} type="button" className={i === imgIdx ? "active" : ""} onClick={() => setImgIdx(i)} aria-label={`Imagen ${i + 1}`}>
                        <img src={mediaSrc(im.url)} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="lx-project-info">
              <span className="lx-project-cat">{open.category}{open.client ? ` · ${open.client}` : ""}</span>
              <h3>{open.title}</h3>
              <p>{open.description || open.summary}</p>
              {open.tech.length > 0 && <div className="lx-project-tech">{open.tech.map(t => <span key={t}>{t}</span>)}</div>}
              <div className="lx-project-links">
                {open.liveUrl && <a href={open.liveUrl} target="_blank" rel="noopener noreferrer" className="l-btn-gold">Ver la web ↗</a>}
                {open.appUrl && <a href={open.appUrl} target="_blank" rel="noopener noreferrer" className="l-btn-secondary">Ver la app ↗</a>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
