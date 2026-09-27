import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { RELEASES } from "@/lib/changelog-data";

export default function Changelog() {
  return (
    <>
      <PageMeta {...metaFor("/changelog")} />
      <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Changelog</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
          Novedades y actualizaciones
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 48 }}>
          Historial de cambios, nuevas funcionalidades y mejoras de la plataforma.
        </p>

        <div style={{ position: "relative", paddingLeft: 28 }}>
          <div style={{ position: "absolute", left: 8, top: 0, bottom: 0, width: 2, background: "var(--ink3, #1e1e22)" }} />
          {RELEASES.map(release => (
            <div key={release.version} style={{ marginBottom: 32, position: "relative" }}>
              <div style={{
                position: "absolute", left: -24, top: 6, width: 12, height: 12,
                borderRadius: "50%", background: release.tag === "Major" ? "#e6c668" : "var(--jade, #2dd49f)",
                border: "2px solid var(--ink, #0a0a0c)",
              }} />
              <Link href={`/changelog/${release.version}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{
                  padding: "20px 24px",
                  background: "var(--ink2, #111113)",
                  border: "1px solid var(--ink3, #1e1e22)",
                  borderRadius: 12,
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,168,75,0.3)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "var(--ink3, #1e1e22)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#e6c668" }}>v{release.version}</span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                      background: release.tag === "Major" ? "rgba(200,168,75,0.15)" : release.tag === "Feature" ? "rgba(45,212,159,0.12)" : "rgba(100,149,237,0.12)",
                      color: release.tag === "Major" ? "#e6c668" : release.tag === "Feature" ? "var(--jade, #2dd49f)" : "#6495ed",
                    }}>{release.tag}</span>
                    <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>{new Date(release.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
                    <span style={{ fontSize: 12, color: "#e6c668", fontWeight: 600, marginLeft: "auto" }}>Ver detalles →</span>
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 10 }}>{release.title}</h2>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                    {release.changes.map((ch, i) => (
                      <li key={i} style={{ fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.6 }}>{ch}</li>
                    ))}
                  </ul>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
    </>
  );
}
