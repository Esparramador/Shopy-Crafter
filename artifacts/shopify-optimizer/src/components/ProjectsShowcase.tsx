import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_ROOT = BASE + "/api";

export interface PortfolioImage { url: string; alt: string; w?: number; h?: number }
export interface PortfolioProject {
  id: number; slug: string; title: string; client: string | null; category: string;
  summary: string; description: string; tech: string[]; liveUrl: string | null; appUrl: string | null;
  images: PortfolioImage[];
  features?: string[];
  status?: string;
}

/** Las URLs de /api/media y las capturas de /portfolio vienen sin la base de la app: se prefijan para subrutas. */
export function mediaSrc(url: string): string {
  if (url.startsWith("/api/")) return API_ROOT + url.slice(4);
  if (url.startsWith("/portfolio/")) return BASE + url;
  return url;
}

type Shape = "phone" | "wide" | "square";
const shapeOf = (im: PortfolioImage): Shape => {
  if (!im.w || !im.h) return "wide";
  const r = im.w / im.h;
  return r < 0.8 ? "phone" : r < 1.2 ? "square" : "wide";
};

/** Un proyecto «en marcha» se dice de otro color: es lo próximo, no lo ya entregado. */
const isUpcoming = (status?: string) => /desarrollo|dise[ñn]o|pr[oó]xim/i.test(status ?? "");

/** Las capturas del proyecto, colocadas según su forma: móviles en abanico, ventana de navegador o mosaico. */
function ProjectMedia({ p }: { p: PortfolioProject }) {
  const phones = p.images.filter(im => shapeOf(im) === "phone");
  const wides = p.images.filter(im => shapeOf(im) === "wide");
  const squares = p.images.filter(im => shapeOf(im) === "square");

  if (p.images.length === 0) {
    const words = p.title.split(/[\s·]+/).filter(w => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w));
    // Unas siglas (LPH) se enseñan enteras; un nombre, por sus dos iniciales.
    const initials = words[0] && words[0].length <= 4 && words[0] === words[0].toUpperCase() ? words[0] : words.slice(0, 2).map(w => w[0].toUpperCase()).join("");
    return <div className="lxp-media lxp-media-type" aria-hidden="true"><span>{initials || "SC"}</span></div>;
  }
  if (wides.length > 0) {
    return (
      <div className="lxp-media lxp-media-wide">
        <div className="lxp-browser">
          <div className="lxp-browser-bar" aria-hidden="true"><i /><i /><i /></div>
          <img src={mediaSrc(wides[0].url)} alt={wides[0].alt || p.title} loading="lazy" decoding="async" />
        </div>
        {phones[0] && (
          <div className="lxp-phone lxp-phone-over">
            <img src={mediaSrc(phones[0].url)} alt={phones[0].alt || p.title} loading="lazy" decoding="async" />
          </div>
        )}
        {!phones[0] && wides[1] && (
          <div className="lxp-browser lxp-browser-over">
            <div className="lxp-browser-bar" aria-hidden="true"><i /><i /><i /></div>
            <img src={mediaSrc(wides[1].url)} alt={wides[1].alt || p.title} loading="lazy" decoding="async" />
          </div>
        )}
      </div>
    );
  }
  if (phones.length > 0) {
    return (
      <div className={`lxp-media lxp-media-phones lxp-n${Math.min(phones.length, 3)}`}>
        {phones.slice(0, 3).map((im, i) => (
          <div key={im.url} className={`lxp-phone lxp-phone-${i}`}>
            <img src={mediaSrc(im.url)} alt={im.alt || p.title} loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`lxp-media lxp-media-tiles lxp-n${Math.min(squares.length, 3)}`}>
      {squares.slice(0, 3).map((im, i) => (
        <div key={im.url} className={`lxp-tile lxp-tile-${i}`}>
          <img src={mediaSrc(im.url)} alt={im.alt || p.title} loading="lazy" decoding="async" />
        </div>
      ))}
    </div>
  );
}

interface Props {
  /** «Quiero algo así»: lleva al contacto con el proyecto ya anotado. */
  onContact?: (project: PortfolioProject | null) => void;
}

/**
 * Proyectos reales del equipo (Admin → Portfolio).
 *
 * Escritorio: tarjetas grandes que se APILAN al hacer scroll. Cada una se queda fija arriba y, cuando
 * llega la siguiente, se encoge y se apaga un poco: el visitante avanza proyecto a proyecto. El avance
 * se calcula con la posición real del scroll (una variable CSS por tarjeta), sin librerías.
 * Móvil y «reducir movimiento»: lista normal, cada tarjeta aparece al entrar en pantalla.
 */
export default function ProjectsShowcase({ onContact }: Props) {
  const [projects, setProjects] = useState<PortfolioProject[] | null>(null);
  const [filter, setFilter] = useState("Todos");
  const [open, setOpen] = useState<PortfolioProject | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [active, setActive] = useState(0);
  const stackRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_ROOT}/portfolio`)
      .then(r => (r.ok ? r.json() : []))
      .then((d: unknown) => { if (alive) setProjects(Array.isArray(d) ? d as PortfolioProject[] : []); })
      .catch(() => { if (alive) setProjects([]); });
    return () => { alive = false; };
  }, []);

  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    (projects ?? []).forEach(p => seen.set(p.category, (seen.get(p.category) ?? 0) + 1));
    return ["Todos", ...[...seen.keys()]];
  }, [projects]);
  const visible = useMemo(() => (projects ?? []).filter(p => filter === "Todos" || p.category === filter), [projects, filter]);

  // ── El apilado: una variable por tarjeta con cuánto la ha tapado la siguiente ──
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || visible.length === 0) return;
    const cards = [...stack.querySelectorAll<HTMLElement>(".lxp-card")];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    // Entrada: cada tarjeta se «enciende» la primera vez que asoma.
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.18 });
    cards.forEach(c => io.observe(c));

    const update = () => {
      raf = 0;
      const stacked = window.innerWidth > 900 && window.innerHeight > 600 && !reduce.matches;
      stack.classList.toggle("is-stacked", stacked);
      const vh = window.innerHeight;
      let current = 0;
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const r = c.getBoundingClientRect();
        // Dónde está la tarjeta en la pantalla (0 arriba, 1 abajo): mueve la captura un poco (paralaje).
        c.style.setProperty("--v", String(Math.max(0, Math.min(1, (r.top + r.height / 2) / vh))));
        if (r.top < vh * 0.55) current = i;
        if (!stacked) { c.style.setProperty("--p", "0"); continue; }
        const next = cards[i + 1];
        if (!next) { c.style.setProperty("--p", "0"); continue; }
        // La siguiente empieza a taparla cuando asoma por abajo y termina cuando queda fija encima.
        const nr = next.getBoundingClientRect();
        const travel = Math.max(1, vh - r.top - 40);
        const p = Math.max(0, Math.min(1, (vh - nr.top) / travel));
        c.style.setProperty("--p", p.toFixed(3));
      }
      setActive(prev => (prev === current ? prev : current));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [visible]);

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

  const contact = (p: PortfolioProject | null) => { setOpen(null); onContact?.(p); };
  const jumpTo = (i: number) => {
    const card = stackRef.current?.querySelectorAll<HTMLElement>(".lxp-card")[i];
    if (!card) return;
    // Con las tarjetas apiladas, la posición «natural» de cada una es la del hueco que ocupa en el flujo.
    const top = window.scrollY + card.parentElement!.getBoundingClientRect().top - 84;
    window.scrollTo({ top, behavior: "smooth" });
  };

  if (projects === null) return <div className="lx-projects-loading" aria-busy="true" />;
  if (projects.length === 0) return null;

  return (
    <div className="lxp">
      {categories.length > 2 && (
        <div className="lxp-filters" role="tablist" aria-label="Filtrar proyectos por tipo">
          {categories.map(c => (
            <button key={c} type="button" role="tab" aria-selected={filter === c} className={`lxp-filter${filter === c ? " on" : ""}`} onClick={() => setFilter(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="lxp-scene">
        {/* Carril de avance: en qué proyecto vas y cuántos quedan. */}
        <nav className="lxp-rail" aria-label="Proyectos">
          <span className="lxp-rail-count"><b>{String(active + 1).padStart(2, "0")}</b> / {String(visible.length).padStart(2, "0")}</span>
          <span className="lxp-rail-track" aria-hidden="true"><i style={{ height: `${((active + 1) / visible.length) * 100}%` }} /></span>
          <span className="lxp-rail-dots">
            {visible.map((p, i) => (
              <button key={p.id} type="button" className={i === active ? "on" : ""} onClick={() => jumpTo(i)} aria-label={`Ir a ${p.title}`} title={p.title} />
            ))}
          </span>
        </nav>

        <ol className="lxp-stack" ref={stackRef} aria-label="Proyectos realizados">
          {visible.map((p, i) => {
            const feats = (p.features ?? []).slice(0, 4);
            const upcoming = isUpcoming(p.status);
            return (
              <li key={p.id} className="lxp-slot" style={{ ["--i" as string]: i } as CSSProperties}>
                <article className={`lxp-card${upcoming ? " lxp-upcoming" : ""}`} data-slug={p.slug}>
                  <div className="lxp-glow" aria-hidden="true" />
                  <div className="lxp-copy">
                    <div className="lxp-meta">
                      <span className="lxp-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                      <span className="lxp-cat">{p.category}</span>
                      {p.status && <span className={`lxp-status${upcoming ? " next" : ""}`}><i aria-hidden="true" />{p.status}</span>}
                    </div>
                    <h3 className="lxp-title">{p.title}</h3>
                    {p.client && <p className="lxp-client">{p.client}</p>}
                    <p className="lxp-summary">{p.summary}</p>
                    {feats.length > 0 && (
                      <ul className="lxp-feats">
                        {feats.map(f => <li key={f}>{f}</li>)}
                      </ul>
                    )}
                    {p.tech.length > 0 && <div className="lxp-tech">{p.tech.slice(0, 6).map(t => <span key={t}>{t}</span>)}</div>}
                    <div className="lxp-actions">
                      <button type="button" className="lxp-btn lxp-btn-main" onClick={() => contact(p)}>Quiero algo así <span aria-hidden="true">→</span></button>
                      <button type="button" className="lxp-btn" onClick={() => { setOpen(p); setImgIdx(0); }}>
                        Ver el proyecto{p.images.length > 1 ? ` · ${p.images.length} imágenes` : ""}
                      </button>
                    </div>
                  </div>
                  <button type="button" className="lxp-visual" onClick={() => { setOpen(p); setImgIdx(0); }} aria-label={`Ver las imágenes de ${p.title}`}>
                    <ProjectMedia p={p} />
                  </button>
                </article>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="lxp-end">
        <p className="lxp-end-kicker">Lo siguiente puede ser lo tuyo</p>
        <h3>Cuéntanos qué necesita tu negocio.</h3>
        <p>Una web, una app, un sistema para tu local o un asistente que atienda por ti. Te decimos cómo lo haríamos y cuánto cuesta, sin compromiso.</p>
        <button type="button" className="lxp-btn lxp-btn-main lxp-btn-big" onClick={() => contact(null)}>Hablar de mi proyecto <span aria-hidden="true">→</span></button>
      </div>

      {open && (
        <div className="lx-project-modal" role="dialog" aria-modal="true" aria-label={open.title} onClick={close}>
          <div className="lx-project-modal-card" onClick={e => e.stopPropagation()}>
            <button type="button" className="lx-project-close" onClick={close} aria-label="Cerrar">×</button>
            {open.images.length > 0 && (
              <div className="lx-project-gallery">
                <img src={mediaSrc(open.images[imgIdx].url)} alt={open.images[imgIdx].alt || open.title} />
                {open.images[imgIdx].alt && <p className="lxp-caption">{open.images[imgIdx].alt}</p>}
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
              <span className="lx-project-cat">{open.category}{open.client ? ` · ${open.client}` : ""}{open.status ? ` · ${open.status}` : ""}</span>
              <h3>{open.title}</h3>
              <p>{open.description || open.summary}</p>
              {(open.features ?? []).length > 0 && <ul className="lxp-feats lxp-feats-all">{(open.features ?? []).map(f => <li key={f}>{f}</li>)}</ul>}
              {open.tech.length > 0 && <div className="lx-project-tech">{open.tech.map(t => <span key={t}>{t}</span>)}</div>}
              <div className="lx-project-links">
                <button type="button" className="l-btn-gold" onClick={() => contact(open)}>Quiero algo así →</button>
                {open.liveUrl && <a href={open.liveUrl} target="_blank" rel="noopener noreferrer" className="l-btn-secondary">Verlo en vivo ↗</a>}
                {open.appUrl && <a href={open.appUrl} target="_blank" rel="noopener noreferrer" className="l-btn-secondary">Ver la app ↗</a>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
