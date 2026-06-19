import { useParams, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import { CASES } from "@/lib/casos-data";

export default function CasoDeExitoDetail() {
  const { slug } = useParams<{ slug: string }>();
  const caso = CASES.find(c => c.slug === slug);

  if (!caso) {
    return (
      <PublicLayout>
        <div style={{ padding: "120px 24px", maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, color: "var(--t, #eee)", marginBottom: 16 }}>Caso no encontrado</h1>
          <p style={{ color: "var(--t3, #999)", marginBottom: 24 }}>El caso de éxito que buscas no existe o ha sido eliminado.</p>
          <Link href="/casos-de-exito" style={{ color: "#2dd49f", textDecoration: "none", fontWeight: 700 }}>← Ver todos los casos</Link>
        </div>
      </PublicLayout>
    );
  }

  const caseSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `https://shopycrafter.com/casos-de-exito/${caso.slug}`,
    headline: `Caso de éxito: ${caso.name} — ${caso.highlight} con Shopy Crafter`,
    description: `${caso.name} (${caso.niche}): antes ${caso.before}. Después: ${caso.after}. En ${caso.time}.`,
    author: { "@type": "Organization", name: "Shopy Crafter" },
    publisher: { "@type": "Organization", name: "Shopy Crafter", url: "https://shopycrafter.com" },
  };

  return (
    <PublicLayout>
      <PageMeta
        title={`${caso.name} — Caso de éxito · Shopy Crafter`}
        description={`${caso.name} (${caso.niche}): ${caso.before}. Resultado: ${caso.after}. En ${caso.time}.`}
        canonical={`https://shopycrafter.com/casos-de-exito/${caso.slug}`}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(caseSchema) }}
      />
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <Link href="/casos-de-exito" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--t4, #666)", fontSize: 13, textDecoration: "none", marginBottom: 32 }}>
          ← Casos de éxito
        </Link>

        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(45,212,159,0.12)", color: "var(--jade, #2dd49f)", border: "1px solid rgba(45,212,159,0.25)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>
          Caso de éxito
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "var(--t, #eee)", lineHeight: 1.15, marginBottom: 8 }}>
              {caso.name}
            </h1>
            <p style={{ fontSize: 15, color: "var(--t3, #999)", margin: 0 }}>{caso.niche} · {caso.time}</p>
          </div>
          <div style={{ padding: "20px 28px", background: "rgba(45,212,159,0.08)", border: "1px solid rgba(45,212,159,0.2)", borderRadius: 16, textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "var(--jade, #2dd49f)" }}>{caso.highlight}</div>
            <div style={{ fontSize: 11, color: "var(--t4, #666)", textTransform: "uppercase", letterSpacing: "0.5px" }}>resultado</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
          <div style={{ padding: 20, background: "rgba(232,69,88,0.06)", border: "1px solid rgba(232,69,88,0.15)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t4, #666)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Antes</div>
            <p style={{ fontSize: 14, color: "var(--t3, #999)", lineHeight: 1.5, margin: 0 }}>{caso.before}</p>
          </div>
          <div style={{ padding: 20, background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--jade, #2dd49f)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Después</div>
            <p style={{ fontSize: 14, color: "var(--t, #eee)", lineHeight: 1.5, margin: 0 }}>{caso.after}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 40 }}>
          <span style={{ fontSize: 11, color: "var(--t4, #666)", alignSelf: "center" }}>Motores usados:</span>
          {caso.engines.map(e => (
            <span key={e} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)", color: "var(--t3, #999)" }}>{e}</span>
          ))}
        </div>

        <div
          className="blog-body"
          dangerouslySetInnerHTML={{ __html: caso.body }}
          style={{ color: "var(--t2, #ccc)", lineHeight: 1.8, fontSize: 15 }}
        />

        <div style={{ marginTop: 56, padding: 28, background: "rgba(45,212,159,0.06)", border: "1px solid rgba(45,212,159,0.15)", borderRadius: 16, textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "var(--t, #eee)", fontWeight: 600, marginBottom: 8 }}>
            ¿Tu tienda puede ser el próximo caso de éxito?
          </p>
          <p style={{ fontSize: 13, color: "var(--t3, #999)", marginBottom: 16 }}>Cuéntanos sobre tu negocio y te decimos qué podemos hacer.</p>
          <a href="/contacto" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>Solicitar análisis gratuito →</a>
        </div>

        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--ink3, #1e1e22)" }}>
          <Link href="/casos-de-exito" style={{ color: "#2dd49f", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>← Ver todos los casos</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
