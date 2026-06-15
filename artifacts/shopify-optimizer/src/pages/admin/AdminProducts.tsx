import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Product {
  id: string;
  projectId: number;
  projectName: string;
  title: string;
  handle: string;
  vendor: string | null;
  productType: string | null;
  status: string;
  price: string | null;
  imageCount: number;
  variantCount: number;
  auditScore: number | null;
  auditGrade: string | null;
}

interface ProjectOption {
  id: number;
  name: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#2dd49f",
  B: "#4a9edd",
  C: "#c8a84b",
  D: "#e08a3c",
  F: "#e84558",
};

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [gradeCounts, setGradeCounts] = useState<Record<string, number>>({});
  const [filterProject, setFilterProject] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("project") ?? "";
  });
  const [filterGrade, setFilterGrade] = useState<string>("");
  const [search, setSearch] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") ?? "";
  });

  const loadProducts = async (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (filterProject) params.set("projectId", filterProject);
    if (filterGrade) params.set("grade", filterGrade);
    try {
      const res = await fetch(`${API_BASE}/api/admin/all-products?${params}`, { credentials: "include" });
      const data = await res.json();
      setProducts(data.products);
      setProjects(data.projects);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setGradeCounts(data.gradeCounts);
      setPage(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadProducts(1); }, [filterProject, filterGrade]);

  const debouncedSearch = useDebounce(search, 250);
  const filtered = debouncedSearch
    ? products.filter(p => p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || p.handle?.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : products;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--t)" }}>Productos Globales</h1>
        <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 4 }}>Todos los productos de todos los proyectos</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(160px, 100%), 1fr))", gap: 12, marginBottom: 20 }}>
        {(["A", "B", "C", "D", "F"] as const).map(grade => (
          <button key={grade} onClick={() => setFilterGrade(filterGrade === grade ? "" : grade)}
            className="glass-card" style={{
              padding: "14px 16px", cursor: "pointer", textAlign: "center",
              borderColor: filterGrade === grade ? GRADE_COLORS[grade] : "transparent",
              transition: "all 0.15s",
            }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: GRADE_COLORS[grade] }}>{gradeCounts[grade] ?? 0}</div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>Grado {grade}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "min(200px, 100%)" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--t4)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar productos..."
            style={{
              width: "100%", padding: "8px 12px 8px 34px", fontSize: 13,
              background: "var(--ink2)", border: "1px solid var(--bdr)", borderRadius: 10,
              color: "var(--t)", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} style={{ color: "var(--t4)" }} />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            style={{
              padding: "8px 12px", fontSize: 13, background: "var(--ink2)",
              border: "1px solid var(--bdr)", borderRadius: 10, color: "var(--t)", outline: "none",
            }}>
            <option value="">Todos los proyectos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--t3)" }}>Cargando productos...</div>
        </div>
      ) : (
        <>
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ink3)" }}>
                  {["Producto", "Proyecto", "Estado", "Precio", "Imágenes", "Variantes", "Grado", "Score"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={`${p.projectId}-${p.id}`} style={{ borderBottom: "1px solid var(--ink3)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/projects/${p.projectId}/audit`}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t)", cursor: "pointer" }}>{p.title}</span>
                      </Link>
                      {p.vendor && <div style={{ fontSize: 11, color: "var(--t4)", marginTop: 2 }}>{p.vendor}</div>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/projects/${p.projectId}/audit`}>
                        <span style={{ fontSize: 12, color: "var(--gold)", cursor: "pointer" }}>{p.projectName}</span>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: p.status === "active" ? "rgba(45,212,159,0.15)" : "rgba(200,168,75,0.15)",
                        color: p.status === "active" ? "#2dd49f" : "var(--gold)",
                      }}>{(p.status ?? "active").toUpperCase()}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--t)" }}>{p.price ? `€${p.price}` : "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--t2)" }}>{p.imageCount}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--t2)" }}>{p.variantCount}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 28, height: 28, borderRadius: 8, fontSize: 13, fontWeight: 800,
                        background: `${GRADE_COLORS[p.auditGrade ?? "F"]}18`,
                        color: GRADE_COLORS[p.auditGrade ?? "F"],
                      }}>{p.auditGrade ?? "—"}</span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--t)" }}>{p.auditScore ?? "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "var(--t3)" }}>
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <span style={{ fontSize: 12, color: "var(--t3)" }}>{total} productos en total</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => loadProducts(page - 1)} disabled={page <= 1}
                className="glass-card" style={{ padding: "6px 12px", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 12, color: "var(--t2)", display: "flex", alignItems: "center" }}>
                {page} / {totalPages}
              </span>
              <button onClick={() => loadProducts(page + 1)} disabled={page >= totalPages}
                className="glass-card" style={{ padding: "6px 12px", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
