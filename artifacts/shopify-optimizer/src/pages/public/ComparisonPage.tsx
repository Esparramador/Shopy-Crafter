import { useLocation, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import { getComparisonPage } from "@/lib/comparison-data";

export default function ComparisonPage() {
  const [location] = useLocation();
  const page = getComparisonPage(location);

  if (!page) {
    return (
      <PublicLayout>
        <div style={{ padding: "120px 24px", maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, color: "var(--t, #eee)", marginBottom: 16 }}>Página no encontrada</h1>
          <p style={{ color: "var(--t3, #999)", marginBottom: 24 }}>El contenido que buscas no existe o ha sido movido.</p>
          <Link href="/" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 700 }}>← Ir al inicio</Link>
        </div>
      </PublicLayout>
    );
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.subtitle,
    author: { "@type": "Organization", name: "Shopy Crafter" },
    publisher: { "@type": "Organization", name: "Shopy Crafter", url: "https://shopycrafter.com" },
    mainEntityOfPage: { "@type": "WebPage", "@id": page.canonical },
  };

  return (
    <PublicLayout>
      <PageMeta
        title={page.metaTitle}
        description={page.metaDescription}
        canonical={page.canonical}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div style={{ padding: "80px 24px 64px", maxWidth: 900, margin: "0 auto" }}>
        <Link href="/" style={{
          display: "flex", width: "fit-content", alignItems: "center", gap: 6,
          color: "var(--t4, #666)", fontSize: 13, textDecoration: "none", marginBottom: 20,
        }}>
          ← Inicio
        </Link>

        <div style={{
          display: "inline-block", padding: "6px 14px", borderRadius: 999,
          background: "rgba(200,168,75,0.12)", color: "#e6c668",
          border: "1px solid rgba(200,168,75,0.2)",
          fontSize: 12, fontWeight: 700, letterSpacing: "0.5px",
          textTransform: "uppercase", marginBottom: 16,
        }}>
          {page.badge}
        </div>

        <h1 style={{
          fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800,
          color: "var(--t, #eee)", lineHeight: 1.15, marginBottom: 16,
        }}>
          {page.h1}
        </h1>

        <p style={{
          fontSize: 17, color: "var(--t3, #999)", lineHeight: 1.7,
          marginBottom: 48, paddingBottom: 32,
          borderBottom: "1px solid var(--ink3, #1e1e22)",
        }}>
          {page.subtitle}
        </p>

        <div
          className="blog-body"
          dangerouslySetInnerHTML={{ __html: page.body }}
          style={{ color: "var(--t2, #ccc)", lineHeight: 1.8, fontSize: 15 }}
        />

        <div style={{
          marginTop: 56, padding: 32,
          background: "rgba(200,168,75,0.06)",
          border: "1px solid rgba(200,168,75,0.15)",
          borderRadius: 16, textAlign: "center",
        }}>
          <p style={{ fontSize: 16, color: "var(--t, #eee)", fontWeight: 700, marginBottom: 8 }}>
            ¿Listo para optimizar tu tienda Shopify con IA?
          </p>
          <p style={{ fontSize: 14, color: "var(--t3, #999)", marginBottom: 20 }}>
            Setup completo en 48h · 6 motores de IA · Sin tarjeta de crédito
          </p>
          <a href="/contacto" style={{
            display: "inline-block", padding: "14px 32px", borderRadius: 10,
            background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
            fontWeight: 700, fontSize: 15, textDecoration: "none",
          }}>
            Solicitar acceso gratuito →
          </a>
        </div>

        <div style={{
          marginTop: 40, paddingTop: 32,
          borderTop: "1px solid var(--ink3, #1e1e22)",
          display: "flex", gap: 24, flexWrap: "wrap",
        }}>
          <Link href="/blog" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
            → Artículos del blog
          </Link>
          <Link href="/casos-de-exito" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
            → Casos de éxito
          </Link>
          <Link href="/faq" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
            → Preguntas frecuentes
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
