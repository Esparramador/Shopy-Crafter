import { Link } from "wouter";
import { SITE_LINK_GROUPS } from "@/seo/meta";

/** Enlazado interno del sitio (mismos grupos que el HTML prerenderizado). */
export default function SiteLinks({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 28, width: "100%" }}
    >
      {SITE_LINK_GROUPS.map(group => (
        <nav key={group.title} aria-label={group.title}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#c8a84b", marginBottom: 12 }}>
            {group.title}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {group.links.map(l => (
              <li key={l.href}>
                <Link href={l.href} style={{ fontSize: 13, color: "var(--t3, #9896ba)", textDecoration: "none" }}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </div>
  );
}
