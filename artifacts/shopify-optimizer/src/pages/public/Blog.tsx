import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { POSTS } from "@/lib/blog-data";

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
            <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: "none", display: "block" }}>
              <article style={{
                padding: 28, background: "var(--ink2, #111113)", border: "1px solid var(--ink3, #1e1e22)",
                borderRadius: 16, display: "flex", flexDirection: "column", gap: 12,
                height: "100%", boxSizing: "border-box",
                transition: "border-color 0.2s, transform 0.2s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,168,75,0.3)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--ink3, #1e1e22)";
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, background: "rgba(200,168,75,0.1)", color: "#e6c668", fontWeight: 600 }}>{post.tag}</span>
                  <span style={{ fontSize: 11, color: "var(--t4, #666)" }}>{post.readTime}</span>
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--t, #eee)", lineHeight: 1.3, margin: 0 }}>{post.title}</h2>
                <p style={{ fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.6, margin: 0, flex: 1 }}>{post.excerpt}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid var(--ink3, #1e1e22)" }}>
                  <span style={{ fontSize: 12, color: "var(--t4, #666)" }}>{new Date(post.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</span>
                  <span style={{ fontSize: 12, color: "#e6c668", fontWeight: 600 }}>Leer →</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}
