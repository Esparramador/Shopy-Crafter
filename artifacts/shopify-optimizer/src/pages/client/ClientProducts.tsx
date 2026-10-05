import { useState, useEffect, useRef, useCallback } from "react";
import { ClientLayout } from "./ClientLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useClientPreview } from "./ClientPreviewContext";
import { Loader2, X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Product {
  id: number;
  title: string;
  price: string;
  auditScore: number | null;
  auditGrade: string | null;
  images: string[];
  imageUrl: string | null;
  handle: string | null;
  bodyHtml: string | null;
  vendor: string | null;
  shopDomain: string | null;
}

const GRADE_COLORS: Record<string, string> = { A: "#34d399", B: "#60a5fa", C: "#f59e0b", D: "#fb923c", F: "#f43f5e" };
const GRADE_GLOWS:  Record<string, string> = { A: "rgba(52,211,153,0.3)", B: "rgba(96,165,250,0.3)", C: "rgba(245,158,11,0.3)", D: "rgba(251,146,60,0.3)", F: "rgba(244,63,94,0.3)" };

/* ── Image Gallery (inside modal) ────────────────────────────── */
function ImageGallery({ images, title }: { images: string[]; title: string }) {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  if (!images.length) {
    return (
      <div style={{ width: "100%", aspectRatio: "16/9", background: "var(--ink3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, opacity: 0.15 }}>
        📦
      </div>
    );
  }

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Main image */}
      <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 14, overflow: "hidden", background: "var(--ink3)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!loaded[idx] && !failed[idx] && (
          <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite", position: "absolute" }} />
        )}
        {failed[idx] ? (
          <div style={{ fontSize: 48, opacity: 0.12 }}>📦</div>
        ) : (
          <img
            key={images[idx]}
            src={images[idx]}
            alt={`${title} ${idx + 1}`}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => setLoaded(prev => ({ ...prev, [idx]: true }))}
            onError={() => setFailed(prev => ({ ...prev, [idx]: true }))}
            style={{
              width: "100%", height: "100%", objectFit: "contain",
              opacity: loaded[idx] ? 1 : 0, transition: "opacity 0.2s",
            }}
          />
        )}

        {/* Prev/next arrows */}
        {images.length > 1 && (
          <>
            <button onClick={prev} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--t1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={next} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: "50%", background: "rgba(10,10,20,0.7)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--t1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Counter */}
        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(10,10,20,0.75)", borderRadius: 8, padding: "2px 8px", fontSize: 11, color: "var(--t2)", backdropFilter: "blur(6px)" }}>
            {idx + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
          {images.map((src, i) => (
            <button key={i} onClick={() => setIdx(i)}
              style={{ flexShrink: 0, width: 60, height: 60, borderRadius: 8, overflow: "hidden", border: `2px solid ${i === idx ? "var(--gold)" : "rgba(255,255,255,0.1)"}`, background: "var(--ink3)", padding: 0, cursor: "pointer", transition: "border-color 0.15s" }}>
              <img src={src} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={e => { e.currentTarget.style.display = "none"; }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Product Detail Modal ─────────────────────────────────────── */
function ProductModal({ p, onClose }: { p: Product; onClose: () => void }) {
  const grade = p.auditGrade;
  const gc = grade ? GRADE_COLORS[grade] ?? "var(--t3)" : "var(--t3)";
  const shopifyUrl = p.handle && p.shopDomain ? `https://${p.shopDomain}/products/${p.handle}` : null;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(5,5,15,0.85)", backdropFilter: "blur(8px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--ink)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
          width: "100%", maxWidth: 820, maxHeight: "90vh", overflow: "hidden",
          display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--bdr)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {grade && (
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${gc}22`, border: `1.5px solid ${gc}`, color: gc, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900 }}>
                {grade}
              </div>
            )}
            <span style={{ fontSize: 10, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Detalle del producto</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {shopifyUrl && (
              <a href={shopifyUrl} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--gold)", textDecoration: "none", padding: "5px 10px", borderRadius: 8, background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.25)" }}>
                <ExternalLink size={11} />Ver en Shopify
              </a>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--t3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* Left — gallery */}
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <ImageGallery images={p.images ?? []} title={p.title} />
          </div>

          {/* Right — info */}
          <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Title + price */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", margin: 0, lineHeight: 1.3, marginBottom: 8 }}>{p.title}</h2>
              {p.vendor && <p style={{ fontSize: 11, color: "var(--t3)", margin: "0 0 8px" }}>por <span style={{ color: "var(--t2)" }}>{p.vendor}</span></p>}
              {p.price && (
                <div style={{ display: "inline-flex", alignItems: "center", padding: "5px 14px", background: "rgba(201,169,97,0.1)", border: "1px solid rgba(201,169,97,0.25)", borderRadius: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "var(--gold2)" }}>€{parseFloat(p.price).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Score */}
            {p.auditScore != null && (
              <div style={{ background: "var(--srf)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--bdr)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>Score IA</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: gc }}>{p.auditScore}/100</span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p.auditScore}%`, background: `linear-gradient(90deg, ${gc}99, ${gc})`, borderRadius: 3, transition: "width 0.8s ease" }} />
                </div>
              </div>
            )}

            {/* Shopify link full-width */}
            {shopifyUrl && (
              <a href={shopifyUrl} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 0", borderRadius: 12, background: "rgba(201,169,97,0.08)", border: "1.5px solid rgba(201,169,97,0.3)", color: "var(--gold)", textDecoration: "none", fontSize: 13, fontWeight: 700, transition: "background 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,169,97,0.15)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(201,169,97,0.08)")}
              >
                <ExternalLink size={14} />Ver producto real en Shopify
              </a>
            )}
          </div>

          {/* Full-width description */}
          {p.bodyHtml && p.bodyHtml.replace(/<[^>]+>/g, "").trim() && (
            <div style={{ width: "100%", borderTop: "1px solid var(--bdr)", paddingTop: 16 }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.09em", color: "var(--t3)", fontWeight: 700, marginBottom: 10 }}>Descripción del producto</p>
              <div
                className="product-html-body"
                dangerouslySetInnerHTML={{ __html: p.bodyHtml }}
                style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.7 }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .product-html-body h1,.product-html-body h2,.product-html-body h3{color:var(--t1);margin:10px 0 6px;font-size:15px;}
        .product-html-body p{margin:0 0 8px;}
        .product-html-body ul,.product-html-body ol{padding-left:18px;margin:0 0 8px;}
        .product-html-body li{margin-bottom:3px;}
        .product-html-body strong,.product-html-body b{color:var(--t1);}
        .product-html-body a{color:var(--gold);text-decoration:underline;}
        .product-html-body table{width:100%;border-collapse:collapse;margin-bottom:8px;}
        .product-html-body td,.product-html-body th{border:1px solid var(--bdr);padding:6px 10px;font-size:12px;}
      `}</style>
    </div>
  );
}

/* ── Tilt Card ────────────────────────────────────────────────── */
function TiltCard({ p, onClick }: { p: Product; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const grade = p.auditGrade ?? null;
  const img = p.images?.[0] ?? p.imageUrl ?? null;
  const gc = grade ? GRADE_COLORS[grade] ?? "var(--t3)" : "var(--t3)";
  const gg = grade ? GRADE_GLOWS[grade]  ?? "transparent" : "transparent";

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    el.style.transform  = `perspective(700px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) scale(1.03)`;
    el.style.boxShadow  = `0 20px 50px rgba(0,0,0,0.45), ${-x * 10}px ${-y * 10}px 30px ${gg}`;
  }, [gg]);

  const onLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(700px) rotateX(0) rotateY(0) scale(1)";
    ref.current.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)";
  }, []);

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
      style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", transition: "transform 0.12s ease, box-shadow 0.12s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", cursor: onClick ? "pointer" : "default", transformStyle: "preserve-3d" }}>

      {/* Image */}
      <div style={{ aspectRatio: "4/3", background: "var(--ink3)", position: "relative", overflow: "hidden" }}>
        {img ? (
          <img src={img} alt={p.title} referrerPolicy="no-referrer" crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease" }}
            onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex"); }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          />
        ) : null}
        <div style={{ width: "100%", height: "100%", display: img ? "none" : "flex", alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.12, position: img ? "absolute" : "relative", inset: 0 }}>📦</div>

        {/* Multi-image badge */}
        {p.images && p.images.length > 1 && (
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(10,10,20,0.75)", borderRadius: 6, padding: "2px 7px", fontSize: 10, color: "var(--t2)", backdropFilter: "blur(6px)" }}>
            📷 {p.images.length}
          </div>
        )}

        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,20,0.6) 0%, transparent 50%)" }} />
        {grade && (
          <div style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 10, background: gc, color: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, boxShadow: `0 0 14px ${gg}` }}>
            {grade}
          </div>
        )}
        {p.price && (
          <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(10,10,20,0.8)", border: "1px solid rgba(201,169,97,0.25)", borderRadius: 8, padding: "3px 8px", fontSize: 13.5, fontWeight: 800, color: "var(--gold2)", backdropFilter: "blur(8px)" }}>
            €{parseFloat(p.price).toFixed(2)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", margin: 0, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.4 }}>{p.title}</p>
        {p.auditScore != null ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "var(--t3)" }}>Score IA</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: gc }}>{p.auditScore}/100</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${p.auditScore}%`, background: `linear-gradient(90deg, ${gc}99, ${gc})`, borderRadius: 2, transition: "width 0.8s ease" }} />
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 10.5, color: "var(--t3)", margin: 0 }}>Sin auditoría aún</p>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
export default function ClientProducts() {
  const { user } = useAuth();
  const { previewPid } = useClientPreview();
  const isAdmin = user?.role === "admin";
  function apid(url: string) { return isAdmin && previewPid ? `${url}${url.includes("?") ? "&" : "?"}pid=${encodeURIComponent(previewPid)}` : url; }

  const [products, setProducts]           = useState<Product[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [gradeFilter, setGradeFilter]     = useState<string>("all");
  const [sortBy, setSortBy]               = useState<"score" | "price" | "name">("score");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(apid(`${API}/client/products`), { credentials: "include" })
      .then(r => r.json())
      .then(d => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [previewPid]);

  const filtered = products
    .filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.title?.toLowerCase().includes(q);
      const matchGrade  = gradeFilter === "all" || p.auditGrade === gradeFilter || (!p.auditGrade && gradeFilter === "none");
      return matchSearch && matchGrade;
    })
    .sort((a, b) => {
      if (sortBy === "score") return (b.auditScore ?? -1) - (a.auditScore ?? -1);
      if (sortBy === "price") return parseFloat(b.price ?? "0") - parseFloat(a.price ?? "0");
      return (a.title ?? "").localeCompare(b.title ?? "");
    });

  const gradeCount = ["A", "B", "C", "D", "F"].reduce<Record<string, number>>((acc, g) => {
    acc[g] = products.filter(p => p.auditGrade === g).length; return acc;
  }, {});

  return (
    <ClientLayout padded>
      <style>{`
        @keyframes prod-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .prod-grid .prod-item{animation:prod-in 0.35s ease both;}
        .grade-chip{transition:all 0.15s!important;}
        .grade-chip:hover{opacity:1!important;}
        .sort-btn{transition:all 0.15s!important;}
        .sort-btn:hover{background:rgba(255,255,255,0.08)!important;}
      `}</style>

      {selectedProduct && <ProductModal p={selectedProduct} onClose={() => setSelectedProduct(null)} />}

      <div style={{ maxWidth: 1020, animation: "rise 0.4s ease" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 26, fontWeight: 400, margin: 0, marginBottom: 6 }}>
            Tu <span style={{ color: "var(--gold2)" }}>Catálogo</span>
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", margin: 0 }}>
            {products.length} productos · haz clic en cualquiera para ver detalles
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--t3)", pointerEvents: "none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos…"
              style={{ width: "100%", paddingLeft: 34, paddingRight: 12, height: 38, background: "var(--srf)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, color: "var(--t1)", outline: "none", boxSizing: "border-box" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
          </div>

          <div style={{ display: "flex", gap: 5 }}>
            <button className="grade-chip" onClick={() => setGradeFilter("all")}
              style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: gradeFilter === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: gradeFilter === "all" ? "var(--t1)" : "var(--t3)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", opacity: gradeFilter === "all" ? 1 : 0.7 }}>
              Todos ({products.length})
            </button>
            {["A","B","C","D","F"].filter(g => gradeCount[g] > 0).map(g => (
              <button key={g} className="grade-chip" onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)}
                style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${gradeFilter === g ? GRADE_COLORS[g] : "rgba(255,255,255,0.08)"}`, background: gradeFilter === g ? `${GRADE_COLORS[g]}20` : "transparent", color: gradeFilter === g ? GRADE_COLORS[g] : "var(--t3)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", opacity: gradeFilter === g ? 1 : 0.7 }}>
                {g} ({gradeCount[g]})
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {[{ id: "score", l: "Score" }, { id: "price", l: "Precio" }, { id: "name", l: "Nombre" }].map(s => (
              <button key={s.id} className="sort-btn" onClick={() => setSortBy(s.id as any)}
                style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: sortBy === s.id ? "rgba(201,169,97,0.12)" : "transparent", color: sortBy === s.id ? "var(--gold)" : "var(--t3)", fontSize: 11.5, cursor: "pointer" }}>
                {s.l}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={28} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--t3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <p style={{ fontSize: 13 }}>{search ? "No hay productos que coincidan con tu búsqueda." : "Tu agencia aún no ha sincronizado tu catálogo."}</p>
          </div>
        ) : (
          <div className="prod-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px,1fr))", gap: 14 }}>
            {filtered.map((p, i) => (
              <div key={p.id} className="prod-item" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
                <TiltCard p={p} onClick={() => setSelectedProduct(p)} />
              </div>
            ))}
          </div>
        )}

        {/* Stats footer */}
        {!loading && products.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
            {["A","B","C","D","F"].map(g => gradeCount[g] > 0 ? (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: GRADE_COLORS[g] }} />
                <span style={{ fontSize: 11, color: "var(--t3)" }}>{g}: {gradeCount[g]}</span>
              </div>
            ) : null)}
            <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
              Mostrando {filtered.length} / {products.length}
            </span>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
