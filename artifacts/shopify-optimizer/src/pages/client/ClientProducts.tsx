import { useEffect, useState } from "react";
import { ClientLayout } from "./ClientLayout";
import { useCmsSection } from "@/contexts/CmsContext";
import { Loader2, Package } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Product {
  id: number;
  title: string;
  price: string;
  auditScore: number | null;
  auditGrade: string | null;
  images: string[] | null;
}

const GRADE_COLORS: Record<string, string> = {
  A: "var(--jade)", B: "var(--sky)", C: "var(--amber)", D: "#ff8c42", F: "var(--crim)",
};

export default function ClientProducts() {
  const { t } = useCmsSection("labels.clientProducts");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/client/products`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ClientLayout>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
          <Loader2 size={26} style={{ color: "var(--gold)", animation: "spin 0.6s linear infinite" }} />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div style={{ maxWidth: 960 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 24, fontWeight: 400, marginBottom: 4 }}>
            {t("title", "Tus Productos")}
          </h1>
          <p style={{ fontSize: 12, color: "var(--t3)" }}>
            {products.length} {t("subtitle", "productos en tu catálogo, ordenados por score de calidad.")}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">📦</div>
            <p className="empty-title">{t("emptyTitle", "Sin productos todavía")}</p>
            <p className="empty-desc">{t("emptyDesc", "Tu agencia aún no ha sincronizado tu catálogo.")}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {products.map((p) => {
              const img = Array.isArray(p.images) ? p.images[0] : null;
              const gradeColor = p.auditGrade ? GRADE_COLORS[p.auditGrade] ?? "var(--t3)" : "var(--t3)";
              return (
                <div key={p.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "1/1", background: "var(--ink3)", position: "relative" }}>
                    {img ? (
                      <img src={img} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Package size={36} style={{ color: "var(--t3)", opacity: 0.3 }} />
                      </div>
                    )}
                    {p.auditGrade && (
                      <div style={{
                        position: "absolute", top: 10, right: 10,
                        width: 30, height: 30, borderRadius: 8,
                        background: gradeColor, color: "#0a0a14",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800,
                      }}>
                        {p.auditGrade}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "12px 14px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.title}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "var(--gold2)" }}>
                        {p.price ? `€${parseFloat(p.price).toFixed(2)}` : "–"}
                      </span>
                      {p.auditScore != null && (
                        <span style={{ fontSize: 11, color: "var(--t3)" }}>{p.auditScore}/100</span>
                      )}
                    </div>
                    {p.auditScore != null && (
                      <div style={{ marginTop: 8, height: 3, background: "var(--ink3)", borderRadius: 2 }}>
                        <div style={{
                          height: "100%", width: `${p.auditScore}%`, borderRadius: 2,
                          background: gradeColor, transition: "width 0.3s",
                        }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
