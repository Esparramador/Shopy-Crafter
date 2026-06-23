import { Link } from "wouter";
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type FooterData = {
  site: { name: string; logo: { value: string; imageUrl: string | null } };
  footer: { tagline: string; columns: { title: string; links: { label: string; href: string }[] }[]; copyright: string; badges: string[] };
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [footer, setFooter] = useState<FooterData | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/cms/content`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setFooter({ site: d.site, footer: d.footer }))
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
            <span style={{ fontSize: 20 }}>{footer?.site.logo.value ?? "💎"}</span>
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

      {footer && (
        <footer className="fp-footer fp-footer-standalone">
          <div className="fp-footer-inner">
            <div className="fp-footer-brand">
              <Link href="/" className="l-nav-logo" style={{ textDecoration: "none" }}>
                {footer.site.logo.imageUrl ? (
                  <img src={`${API_BASE}${footer.site.logo.imageUrl}`} alt={footer.site.name} style={{ height: 28, width: 28, borderRadius: 6 }} />
                ) : (
                  <div className="l-nav-gem">{footer.site.logo.value}</div>
                )}
                <div className="l-nav-logo-text">{footer.site.name}</div>
              </Link>
              <p className="l-footer-desc">{footer.footer.tagline}</p>
            </div>
            <div className="fp-footer-cols">
              {footer.footer.columns.map((col, i) => (
                <div key={i} className="fp-footer-col">
                  <div className="l-footer-col-title">{col.title}</div>
                  <ul className="l-footer-links">
                    {col.links.map((l, li) => {
                      const href = (l.href || "").trim();
                      if (href.startsWith("/") && !href.startsWith("//")) {
                        return <li key={li}><Link href={href}>{l.label}</Link></li>;
                      }
                      if (href.startsWith("http")) {
                        return <li key={li}><a href={href} target="_blank" rel="noopener noreferrer">{l.label}</a></li>;
                      }
                      if (href.startsWith("mailto:") || href.startsWith("tel:")) {
                        return <li key={li}><a href={href}>{l.label}</a></li>;
                      }
                      return <li key={li}><span style={{ color: "var(--t4, #555)", cursor: "default" }}>{l.label}</span></li>;
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="l-footer-bottom">
            <div className="l-footer-copy">{footer.footer.copyright}</div>
            <div className="l-footer-badges">
              {footer.footer.badges.map((b, i) => (
                <span key={i} className="l-footer-badge">{b}</span>
              ))}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
