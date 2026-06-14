import { useParams, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { RELEASES } from "@/lib/changelog-data";

const tagStyle = (tag: string) => ({
  fontSize: 11,
  padding: "3px 10px",
  borderRadius: 4,
  fontWeight: 700,
  background: tag === "Major" ? "rgba(200,168,75,0.15)" : tag === "Feature" ? "rgba(45,212,159,0.12)" : "rgba(100,149,237,0.12)",
  color: tag === "Major" ? "#e6c668" : tag === "Feature" ? "#2dd49f" : "#6495ed",
});

export default function ChangelogRelease() {
  const { version } = useParams<{ version: string }>();
  const release = RELEASES.find(r => r.version === version);

  const currentIdx = release ? RELEASES.findIndex(r => r.version === version) : -1;
  const prevRelease = currentIdx > 0 ? RELEASES[currentIdx - 1] : null;
  const nextRelease = currentIdx < RELEASES.length - 1 ? RELEASES[currentIdx + 1] : null;

  if (!release) {
    return (
      <PublicLayout>
        <div style={{ padding: "120px 24px", maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, color: "var(--t, #eee)", marginBottom: 16 }}>Versión no encontrada</h1>
          <p style={{ color: "var(--t3, #999)", marginBottom: 24 }}>La versión que buscas no existe en el changelog.</p>
          <Link href="/changelog" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 700 }}>← Ver changelog</Link>
        </div>
      </PublicLayout>
    );
  }

  const releaseSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `Shopy Crafter v${release.version} — ${release.title}`,
    description: release.description ?? release.changes.join(". "),
    datePublished: release.date,
    author: { "@type": "Organization", name: "Shopy Crafter" },
    publisher: { "@type": "Organization", name: "Shopy Crafter", url: "https://shopycrafter.com" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://shopycrafter.com/changelog/${release.version}` },
  };

  return (
    <PublicLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(releaseSchema) }}
      />
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <Link href="/changelog" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--t4, #666)", fontSize: 13, textDecoration: "none", marginBottom: 32 }}>
          ← Changelog
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#e6c668" }}>v{release.version}</span>
          <span style={tagStyle(release.tag)}>{release.tag}</span>
          <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>
            {new Date(release.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "var(--t, #eee)", lineHeight: 1.2, marginBottom: 24 }}>
          {release.title}
        </h1>

        {release.description && (
          <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 40, paddingBottom: 32, borderBottom: "1px solid var(--ink3, #1e1e22)" }}>
            {release.description}
          </p>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.5px", fontSize: 12 }}>
          Cambios incluidos
        </h2>
        <ul style={{ margin: "0 0 48px", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {release.changes.map((ch, i) => (
            <li key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 18px",
              background: "var(--ink2, #111113)",
              border: "1px solid var(--ink3, #1e1e22)",
              borderRadius: 10,
              fontSize: 14, color: "var(--t2, #ccc)", lineHeight: 1.6,
            }}>
              <span style={{ color: "#2dd49f", marginTop: 2, flexShrink: 0 }}>✓</span>
              {ch}
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 24, borderTop: "1px solid var(--ink3, #1e1e22)", flexWrap: "wrap", gap: 12 }}>
          {nextRelease ? (
            <Link href={`/changelog/${nextRelease.version}`} style={{ color: "var(--t3, #999)", textDecoration: "none", fontSize: 13 }}>
              ← v{nextRelease.version}: {nextRelease.title}
            </Link>
          ) : <span />}
          {prevRelease ? (
            <Link href={`/changelog/${prevRelease.version}`} style={{ color: "var(--t3, #999)", textDecoration: "none", fontSize: 13 }}>
              v{prevRelease.version}: {prevRelease.title} →
            </Link>
          ) : <span />}
        </div>
      </div>
    </PublicLayout>
  );
}
