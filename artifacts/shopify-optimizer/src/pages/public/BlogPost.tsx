import { useParams, Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import { POSTS } from "@/lib/blog-data";

const tagColors: Record<string, string> = {
  SEO: "#e6c668",
  IA: "#2dd49f",
  Pricing: "#6495ed",
  "A/B Testing": "#e88",
  "Caso de éxito": "#2dd49f",
  Herramientas: "#e6c668",
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = POSTS.find(p => p.slug === slug);

  if (!post) {
    return (
      <PublicLayout>
        <div style={{ padding: "120px 24px", maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, color: "var(--t, #eee)", marginBottom: 16 }}>Artículo no encontrado</h1>
          <p style={{ color: "var(--t3, #999)", marginBottom: 24 }}>El artículo que buscas no existe o ha sido eliminado.</p>
          <Link href="/blog" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 700 }}>← Volver al blog</Link>
        </div>
      </PublicLayout>
    );
  }

  const tagColor = tagColors[post.tag] ?? "#e6c668";

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: { "@type": "Organization", name: "Shopy Crafter" },
    publisher: {
      "@type": "Organization",
      name: "Shopy Crafter",
      url: "https://shopycrafter.com",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://shopycrafter.com/blog/${post.slug}` },
  };

  return (
    <PublicLayout>
      <PageMeta
        title={`${post.title} — Blog de Shopy Crafter`}
        description={post.excerpt}
        canonical={`https://shopycrafter.com/blog/${post.slug}`}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <Link href="/blog" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--t4, #666)", fontSize: 13, textDecoration: "none", marginBottom: 32 }}>
          ← Blog
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: `${tagColor}1a`, color: tagColor, fontWeight: 700 }}>{post.tag}</span>
          <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>{new Date(post.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
          <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>· {post.readTime} de lectura</span>
        </div>

        <h1 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, color: "var(--t, #eee)", lineHeight: 1.2, marginBottom: 20 }}>
          {post.title}
        </h1>

        <p style={{ fontSize: 17, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 40, borderBottom: "1px solid var(--ink3, #1e1e22)", paddingBottom: 32 }}>
          {post.excerpt}
        </p>

        <div
          className="blog-body"
          dangerouslySetInnerHTML={{ __html: post.body }}
          style={{ color: "var(--t2, #ccc)", lineHeight: 1.8, fontSize: 15 }}
        />

        <div style={{ marginTop: 56, padding: 28, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 16, textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "var(--t, #eee)", fontWeight: 600, marginBottom: 8 }}>
            ¿Listo para optimizar tu tienda con IA?
          </p>
          <p style={{ fontSize: 13, color: "var(--t3, #999)", marginBottom: 16 }}>Cuéntanos tu proyecto y te preparamos una propuesta sin compromiso.</p>
          <a href="/contacto" style={{
            display: "inline-block", padding: "12px 28px", borderRadius: 10,
            background: "linear-gradient(135deg, #d4a843, #b8860b)", color: "#000",
            fontWeight: 700, fontSize: 14, textDecoration: "none",
          }}>Contactar →</a>
        </div>

        <div style={{ marginTop: 40, paddingTop: 32, borderTop: "1px solid var(--ink3, #1e1e22)" }}>
          <Link href="/blog" style={{ color: "#e6c668", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>← Ver todos los artículos</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
