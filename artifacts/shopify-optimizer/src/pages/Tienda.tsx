import { useEffect } from "react";

const STORE_URL = "https://comic-crafter.myshopify.com";

export default function Tienda() {
  useEffect(() => {
    window.location.replace(STORE_URL);
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--ink)",
      flexDirection: "column", gap: 16, color: "var(--t3)",
    }}>
      <div style={{ fontSize: 32 }}>🛒</div>
      <p style={{ fontSize: 14 }}>Redirigiendo a la tienda…</p>
      <a
        href={STORE_URL}
        style={{ fontSize: 13, color: "var(--gold2)", textDecoration: "underline" }}
      >
        Haz clic aquí si no te redirige automáticamente
      </a>
    </div>
  );
}
