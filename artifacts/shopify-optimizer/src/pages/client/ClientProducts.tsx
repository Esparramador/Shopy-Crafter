import { useState, useEffect, useRef, useCallback } from "react";
import { ClientLayout } from "./ClientLayout";
import { Loader2 } from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Product { id: number; title: string; price: string; auditScore: number | null; auditGrade: string | null; images: string[] | null; }

const GRADE_COLORS: Record<string, string> = { A: "#34d399", B: "#60a5fa", C: "#f59e0b", D: "#fb923c", F: "#f43f5e" };
const GRADE_GLOWS: Record<string, string> = { A: "rgba(52,211,153,0.3)", B: "rgba(96,165,250,0.3)", C: "rgba(245,158,11,0.3)", D: "rgba(251,146,60,0.3)", F: "rgba(244,63,94,0.3)" };

function TiltCard({ p, onClick }: { p: Product; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const grade = p.auditGrade ?? null;
  const img = Array.isArray(p.images) ? p.images[0] : null;
  const gc = grade ? GRADE_COLORS[grade] ?? "var(--t3)" : "var(--t3)";
  const gg = grade ? GRADE_GLOWS[grade] ?? "transparent" : "transparent";

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) scale(1.03)`;
    el.style.boxShadow = `0 20px 50px rgba(0,0,0,0.45), ${-x * 10}px ${-y * 10}px 30px ${gg}`;
  }, [gg]);

  const onLeave = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(700px) rotateX(0) rotateY(0) scale(1)";
    ref.current.style.boxShadow = "0 4px 20px rgba(0,0,0,0.25)";
  }, []);

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
      style={{ background: "var(--srf)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden", transition: "transform 0.12s ease, box-shadow 0.12s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", cursor: "default", transformStyle: "preserve-3d" }}>
      {/* Image */}
      <div style={{ aspectRatio: "4/3", background: "var(--ink3)", position: "relative", overflow: "hidden" }}>
        {img ? (
          <img src={img} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s ease" }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.06)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, opacity: 0.12 }}>📦</div>
        )}
        {/* Overlay gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,20,0.6) 0%, transparent 50%)" }} />
        {/* Grade badge */}
        {grade && (
          <div style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 10, background: gc, color: "#0a0a14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, boxShadow: `0 0 14px ${gg}` }}>
            {grade}
          </div>
        )}
        {/* Price chip */}
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

export default function ClientProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "price" | "name">("score");

  useEffect(() => {
    fetch(`${API}/client/products`, { credentials: "include" })
      .then(r => r.json()).then(d => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = products
    .filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || (p.title?.toLowerCase().includes(q));
      const matchGrade = gradeFilter === "all" || p.auditGrade === gradeFilter || (!p.auditGrade && gradeFilter === "none");
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
    <ClientLayout>
      <style>{`
        @keyframes prod-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .prod-grid .prod-item{animation:prod-in 0.35s ease both;}
        .grade-chip{transition:all 0.15s!important;}
        .grade-chip:hover{opacity:1!important;}
        .sort-btn{transition:all 0.15s!important;}
        .sort-btn:hover{background:rgba(255,255,255,0.08)!important;}
      `}</style>

      <div style={{ maxWidth: 1020, animation: "rise 0.4s ease" }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 26, fontWeight: 400, margin: 0, marginBottom: 6 }}>
            Tu <span style={{ color: "var(--gold2)" }}>Catálogo</span>
          </h1>
          <p style={{ fontSize: 12.5, color: "var(--t3)", margin: 0 }}>
            {products.length} productos · ordenados por score de calidad IA
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--t3)", pointerEvents: "none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar productos…"
              style={{ width: "100%", paddingLeft: 34, paddingRight: 12, height: 38, background: "var(--srf)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 13, color: "var(--t1)", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
              onFocus={e => e.target.style.borderColor = "rgba(201,169,97,0.4)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
          </div>

          {/* Grade filter chips */}
          <div style={{ display: "flex", gap: 5 }}>
            <button className="grade-chip" onClick={() => setGradeFilter("all")} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: gradeFilter === "all" ? "rgba(255,255,255,0.1)" : "transparent", color: gradeFilter === "all" ? "var(--t1)" : "var(--t3)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", opacity: gradeFilter === "all" ? 1 : 0.7 }}>
              Todos ({products.length})
            </button>
            {["A","B","C","D","F"].filter(g => gradeCount[g] > 0).map(g => (
              <button key={g} className="grade-chip" onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${gradeFilter === g ? GRADE_COLORS[g] : "rgba(255,255,255,0.08)"}`, background: gradeFilter === g ? `${GRADE_COLORS[g]}20` : "transparent", color: gradeFilter === g ? GRADE_COLORS[g] : "var(--t3)", fontSize: 11.5, fontWeight: 700, cursor: "pointer", opacity: gradeFilter === g ? 1 : 0.7 }}>
                {g} ({gradeCount[g]})
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: "flex", gap: 4 }}>
            {[{ id: "score", l: "Score" }, { id: "price", l: "Precio" }, { id: "name", l: "Nombre" }].map(s => (
              <button key={s.id} className="sort-btn" onClick={() => setSortBy(s.id as any)} style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: sortBy === s.id ? "rgba(201,169,97,0.12)" : "transparent", color: sortBy === s.id ? "var(--gold)" : "var(--t3)", fontSize: 11.5, cursor: "pointer" }}>
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
                <TiltCard p={p} />
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
