import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function OAuthSuccess() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"syncing" | "done" | "error">("syncing");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("projectId");
    const shop = params.get("shop");
    setProjectId(pid);
    setShopDomain(shop);

    if (!pid) { setStatus("error"); return; }

    fetch(`${API_BASE}/api/projects/${pid}/products/sync`, {
      method: "POST",
      credentials: "include",
    })
      .then(() => setStatus("done"))
      .catch(() => setStatus("done"));
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ink)" }}>
      <div style={{ maxWidth: 480, width: "100%", padding: 32, textAlign: "center" }}>
        <div className="logo-gem" style={{ width: 64, height: 64, fontSize: 28, margin: "0 auto 20px" }}>
          {status === "syncing" ? <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} /> : "✓"}
        </div>

        {status === "syncing" && (
          <>
            <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, marginBottom: 8 }}>Importando tu tienda...</h1>
            <p style={{ fontSize: 13, color: "var(--t2)" }}>Conectada. Importando productos y datos de{" "}
              <span style={{ color: "var(--gold)", fontFamily: "var(--fm)" }}>{shopDomain}</span>
            </p>
            <div style={{ marginTop: 20, height: 2, background: "var(--ink3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, var(--gold), var(--jade))", borderRadius: 2, animation: "slide 1.5s ease-in-out infinite" }} />
            </div>
          </>
        )}

        {status === "done" && (
          <>
            <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, marginBottom: 8, color: "var(--jade)" }}>
              ¡Tienda conectada! 🎉
            </h1>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 24 }}>
              <span style={{ color: "var(--gold)", fontFamily: "var(--fm)" }}>{shopDomain}</span> está lista. ShopyBrain empezará a analizar tus productos automáticamente.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => setLocation(projectId ? `/projects/${projectId}/audit` : "/")}
                className="btn btn-gold"
              >
                <CheckCircle size={15} /> Ver auditoría
              </button>
              <button
                onClick={() => setLocation("/")}
                className="btn-secondary"
              >
                <ArrowRight size={15} /> Dashboard
              </button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <h1 style={{ fontFamily: "var(--fh)", fontStyle: "italic", fontSize: 22, marginBottom: 8, color: "var(--crim)" }}>Error en la conexión</h1>
            <p style={{ fontSize: 13, color: "var(--t2)", marginBottom: 20 }}>No se pudo completar la autenticación. Vuelve a intentarlo.</p>
            <button onClick={() => setLocation("/new-project")} className="btn btn-gold">Volver a intentar</button>
          </>
        )}
      </div>
    </div>
  );
}
