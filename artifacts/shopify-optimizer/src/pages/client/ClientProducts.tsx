import { useEffect, useState } from "react";
import { ClientLayout } from "./ClientLayout";
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
  A: "#00d68f", B: "#00b4d8", C: "#ffd32a", D: "#ff8c42", F: "#ff4757",
};

export default function ClientProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/client/products`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setProducts(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#5b4eff]" />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Tus Productos</h1>
          <p className="text-white/40 text-sm mt-1">
            {products.length} productos en tu catálogo, ordenados por score de calidad.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="bg-white/5 border border-white/8 rounded-2xl p-12 text-center">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white font-semibold">Sin productos todavía</p>
            <p className="text-white/40 text-sm mt-1">Tu agencia aún no ha sincronizado tu catálogo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const img = Array.isArray(p.images) ? p.images[0] : null;
              const color = p.auditGrade ? GRADE_COLORS[p.auditGrade] ?? "#666" : "#666";
              return (
                <div key={p.id} className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="aspect-square bg-black/20 relative">
                    {img ? (
                      <img src={img} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-white/10" />
                      </div>
                    )}
                    {p.auditGrade && (
                      <div
                        className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-black"
                        style={{ backgroundColor: color }}
                      >
                        {p.auditGrade}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-white truncate">{p.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-white">
                        {p.price ? `€${parseFloat(p.price).toFixed(2)}` : "–"}
                      </span>
                      {p.auditScore != null && (
                        <span className="text-xs text-white/40">{p.auditScore}/100</span>
                      )}
                    </div>
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
