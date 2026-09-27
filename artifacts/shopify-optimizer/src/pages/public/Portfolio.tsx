import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { WEB_DEMOS } from "@/lib/portfolio-data";
import ApkDownloadButton from "@/components/ApkDownloadButton";

export default function Portfolio() {
  return (
    <>
      <PageMeta {...metaFor("/portfolio")} />
      <PublicLayout>
        <div style={{ padding: "80px 24px 64px", maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Portfolio</div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
            Diseño web, 3D y apps
          </h1>
          <p style={{ fontSize: 17, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 40, maxWidth: 760 }}>
            {WEB_DEMOS.length} demos interactivas que puedes abrir en tu navegador: 3D en tiempo real, scroll inmersivo, shaders, animación y componentes. Son la base con la que diseñamos webs a medida.
            {" "}<Link href="/diseno-web-profesional" style={{ color: "#e6c668" }}>Cómo trabajamos el diseño web →</Link>
          </p>

          <section aria-labelledby="demos-web" style={{ marginBottom: 56 }}>
            <h2 id="demos-web" style={{ fontSize: 22, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 20 }}>Demos de diseño web</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {WEB_DEMOS.map((d, i) => (
                <li key={d.file}>
                  <a
                    href={`/web-demos/${d.file}`}
                    target="_blank"
                    rel="noopener"
                    style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%", boxSizing: "border-box", padding: 20, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 14, textDecoration: "none" }}
                  >
                    <span style={{ fontFamily: "var(--l-fm, monospace)", fontSize: 11, color: "#c8a84b" }}>{String(i + 1).padStart(2, "0")}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--t, #eee)" }}>{d.title}</span>
                    <span style={{ fontSize: 13.5, color: "var(--t3, #999)", lineHeight: 1.55, flex: 1 }}>{d.description}</span>
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {d.tags.map(t => (
                        <span key={t} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(45,212,159,0.25)", color: "#2dd49f" }}>{t}</span>
                      ))}
                    </span>
                    <span style={{ fontSize: 12.5, color: "#e6c668", fontWeight: 600 }}>Abrir demo ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="app-android" style={{ padding: 32, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", borderRadius: 16 }}>
            <h2 id="app-android" style={{ fontSize: 22, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 10 }}>App nativa Android de Shopy Crafter</h2>
            <p style={{ fontSize: 15, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 18, maxWidth: 720 }}>
              Nuestra propia app, construida con Capacitor sobre la misma base de código que la plataforma web. El mismo enfoque que usamos para convertir webs y tiendas en apps nativas.
              {" "}<Link href="/desarrollo-apps-nativas" style={{ color: "#e6c668" }}>Desarrollo de apps nativas →</Link>
            </p>
            <ApkDownloadButton />
          </section>
        </div>
      </PublicLayout>
    </>
  );
}
