import PublicLayout from "@/components/PublicLayout";

const POSTS = [
  {
    date: "2026-04-28",
    tag: "SEO",
    title: "Cómo optimizar fichas de producto para Google Shopping en 2026",
    excerpt: "Los schemas JSON-LD, las imágenes de alta calidad y las descripciones únicas son clave. Te mostramos el proceso exacto que usamos con nuestros clientes.",
    readTime: "6 min",
  },
  {
    date: "2026-04-15",
    tag: "IA",
    title: "Claude vs Gemini: qué modelo de IA es mejor para tu eCommerce",
    excerpt: "Hemos probado ambos modelos en 15.000+ generaciones reales. Te damos los resultados: cuándo usar cada uno y por qué no deberías elegir solo uno.",
    readTime: "8 min",
  },
  {
    date: "2026-03-30",
    tag: "Pricing",
    title: "La guía definitiva de COGS para tiendas online",
    excerpt: "Si no conoces tu coste real por producto, estás perdiendo dinero. Desglosamos las 9 categorías de costes que toda tienda debería trackear.",
    readTime: "10 min",
  },
  {
    date: "2026-03-12",
    tag: "A/B Testing",
    title: "A/B Testing automatizado: cómo dejamos que la IA elija el ganador",
    excerpt: "Nuestro motor de A/B testing compara imágenes, precios y descripciones con intervalos de confianza del 95%. Así funciona el auto-winner.",
    readTime: "7 min",
  },
  {
    date: "2026-02-28",
    tag: "Caso de éxito",
    title: "Cómo Comic Crafter aumentó ventas un 340% en 90 días",
    excerpt: "Auditoría completa + SEO automatizado + imágenes IA. El caso paso a paso de una tienda de cómics que multiplicó sus ventas sin pagar publicidad.",
    readTime: "5 min",
  },
  {
    date: "2026-02-10",
    tag: "Herramientas",
    title: "17 motores de IA para eCommerce: qué hace cada uno",
    excerpt: "Audit, SEO, Images, A/B Testing, Pricing, WebLab, Fusion Studio... Explicamos cada motor y cuándo usarlo para sacar el máximo partido.",
    readTime: "12 min",
  },
];

export default function Blog() {
  return (
    <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Blog</div>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 16, lineHeight: 1.1 }}>
          Blog de <em style={{ color: "#e6c668", fontStyle: "normal" }}>Shopy Crafter</em>
        </h1>
        <p style={{ fontSize: 16, color: "var(--t3, #999)", lineHeight: 1.7, marginBottom: 48 }}>
          Estrategias, tutoriales y casos reales para hacer crecer tu eCommerce con IA.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {POSTS.map(post => (
            <article key={post.title} style={{
              padding: 28, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)",
              borderRadius: 16, display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(200,168,75,0.3)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--ink3, #1e1e22)")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(200,168,75,0.1)", color: "#e6c668", fontWeight: 600 }}>{post.tag}</span>
                <span style={{ fontSize: 11, color: "var(--t4, #666)" }}>{post.readTime}</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--t, #eee)", lineHeight: 1.3, margin: 0 }}>{post.title}</h3>
              <p style={{ fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.6, margin: 0, flex: 1 }}>{post.excerpt}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--ink3, #1e1e22)" }}>
                <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>{new Date(post.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
                <span style={{ fontSize: 12, color: "#e6c668", fontWeight: 600 }}>Leer →</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
