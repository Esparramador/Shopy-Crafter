import { Link } from "wouter";
import { useEffect, useState } from "react";
import SiteLinks from "./SiteLinks";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type FooterData = {
  site: { name: string; logo: { value: string; imageUrl: string | null } };
  footer: { tagline: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string; badges: string[] };
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [footer, setFooter] = useState<FooterData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/cms/content`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.site && d?.footer) setFooter({ site: d.site, footer: d.footer }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--ink, #0a0a0c)", color: "var(--t, #eee)", display: "flex", flexDirection: "column" }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,12,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--ink3, #1e1e22)",
        padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--t, #eee)" }}>
          {footer?.site.logo.imageUrl ? (
            <img src={`${API_BASE}${footer.site.logo.imageUrl}`} alt={footer.site.name} style={{ height: 26, borderRadius: 6 }} />
          ) : (
            <span style={{ width: 28, height: 28, background: "linear-gradient(135deg,#c8a84b,#b8860b)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#060500", flexShrink: 0 }}>{footer?.site.logo.value ?? "SC"}</span>
          )}
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>{footer?.site.name ?? "Shopy Crafter"}</span>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--t3, #999)", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
            ← Volver al inicio
          </Link>
          <Link href="/login" style={{
            fontSize: 13, fontWeight: 600, color: "#000",
            background: "linear-gradient(135deg, #d4a843, #b8860b)",
            padding: "8px 18px", borderRadius: 8, textDecoration: "none",
          }}>
            Iniciar sesión
          </Link>
        </div>
      </nav>

      <main style={{ flex: 1 }}>
        {children}
      </main>

      <footer style={{ borderTop: "1px solid var(--ink3, #1e1e22)", padding: "48px 24px 24px", background: "var(--ink2, #111113)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(200px, 1fr) 3fr", gap: 32, marginBottom: 32 }} className="pl-footer-grid">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {footer?.site.logo.imageUrl ? (
                <img src={`${API_BASE}${footer.site.logo.imageUrl}`} alt={footer.site.name} style={{ height: 22, borderRadius: 4 }} />
              ) : (
                <span style={{ width: 22, height: 22, background: "linear-gradient(135deg,#c8a84b,#b8860b)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#060500", flexShrink: 0 }}>{footer?.site.logo.value ?? "SC"}</span>
              )}
              <span style={{ fontSize: 14, fontWeight: 700 }}>{footer?.site.name ?? "Shopy Crafter"}</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--t4, #666)", lineHeight: 1.5, margin: 0 }}>
              IA para tiendas Shopify, WooCommerce y PrestaShop, gestión de Stripe, diseño web y apps nativas.
            </p>
          </div>
          <SiteLinks />
        </div>
        <div style={{ maxWidth: 1100, margin: "0 auto", borderTop: "1px solid var(--ink3, #1e1e22)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: "var(--t4, #555)" }}>{footer?.footer.copyright ?? `© ${new Date().getFullYear()} Shopy Crafter`}</div>
          <a href="mailto:craftershopy@gmail.com" style={{ fontSize: 12, color: "var(--t3, #999)", textDecoration: "none" }}>craftershopy@gmail.com</a>
        </div>
        <style>{`@media (max-width: 720px) { .pl-footer-grid { grid-template-columns: 1fr !important; } }`}</style>
      </footer>
    </div>
  );
}
