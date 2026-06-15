import PageMeta from "@/components/PageMeta";

export default function LandingSSR() {
  return (
    <>
      <PageMeta
        title="Shopy Crafter — Optimización IA para tiendas Shopify"
        description="7 motores de IA para mejorar SEO, imágenes y conversión en tu tienda Shopify. Sin conocimientos técnicos. Prueba gratis 14 días."
        canonical="https://shopycrafter.com/"
      />
      <div style={{ minHeight: "100vh", background: "#0a0a0c", color: "#eee", fontFamily: "system-ui, sans-serif" }}>

        <header style={{ padding: "1.25rem 2rem", borderBottom: "1px solid #1f1f1f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "#e6c668" }}>Shopy Crafter</span>
          <nav aria-label="Navegación principal" style={{ display: "flex", gap: "1.5rem", fontSize: "0.9rem" }}>
            <a href="/sobre-nosotros" style={{ color: "#aaa", textDecoration: "none" }}>Sobre nosotros</a>
            <a href="/blog" style={{ color: "#aaa", textDecoration: "none" }}>Blog</a>
            <a href="/faq" style={{ color: "#aaa", textDecoration: "none" }}>FAQ</a>
            <a href="/contacto" style={{ color: "#aaa", textDecoration: "none" }}>Contacto</a>
          </nav>
        </header>

        <main>
          <section aria-labelledby="hero-heading" style={{ padding: "5rem 2rem 4rem", textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
            <p style={{ color: "#2dd49f", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem", fontSize: "0.85rem" }}>
              Inteligencia Artificial para eCommerce Shopify
            </p>
            <h1 id="hero-heading" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.5rem", color: "#fff" }}>
              Optimiza tu tienda Shopify con <span style={{ color: "#e6c668" }}>7 motores de IA</span>
            </h1>
            <p style={{ fontSize: "1.2rem", color: "#aaa", maxWidth: 640, margin: "0 auto 2.5rem", lineHeight: 1.6 }}>
              Mejora el SEO, genera imágenes de producto, automatiza emails y aumenta la conversión de tu tienda Shopify. Sin conocimientos técnicos. Resultados en 48 horas.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "2rem" }}>
              <a href="#planes" style={{ background: "#e6c668", color: "#0a0a0c", padding: "0.85rem 2rem", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: "1rem" }}>Ver planes →</a>
              <a href="/contacto" style={{ border: "1.5px solid #e6c668", color: "#e6c668", padding: "0.85rem 2rem", borderRadius: 8, fontWeight: 600, textDecoration: "none", fontSize: "1rem" }}>Hablar con un experto</a>
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
              {["✓ Prueba gratis 14 días", "✓ Sin tarjeta de crédito", "✓ Cancela cuando quieras", "✓ Soporte en español"].map(item => (
                <li key={item} style={{ color: "#7a9", fontSize: "0.9rem" }}>{item}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="stats-heading" style={{ padding: "3rem 2rem", background: "#0d0d11", borderTop: "1px solid #1f1f1f", borderBottom: "1px solid #1f1f1f" }}>
            <h2 id="stats-heading" style={{ textAlign: "center", fontSize: "0.85rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2rem" }}>Resultados reales de nuestros clientes</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "2rem", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
              {[
                { num: "+340%", label: "Incremento medio en conversión" },
                { num: "+234%", label: "Más tráfico orgánico" },
                { num: "48h", label: "Tiempo de configuración" },
                { num: "99.9%", label: "Uptime garantizado" },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#e6c668", marginBottom: "0.4rem" }}>{stat.num}</div>
                  <div style={{ color: "#888", fontSize: "0.9rem" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="engines-heading" style={{ padding: "5rem 2rem", maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <p style={{ color: "#2dd49f", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>Los 7 motores IA</p>
              <h2 id="engines-heading" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: "1rem" }}>
                Una plataforma. Siete motores. Resultados reales.
              </h2>
              <p style={{ color: "#888", maxWidth: 580, margin: "0 auto", lineHeight: 1.6 }}>
                Cada motor se especializa en un área clave del crecimiento de tu tienda Shopify, funcionando de forma autónoma las 24 horas del día.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
              {[
                { icon: "🔍", num: "01", title: "Motor SEO", description: "Optimiza automáticamente los títulos, descripciones y metadatos de todos tus productos para posicionarte en Google.", tags: ["On-page SEO", "Metadatos", "Palabras clave"] },
                { icon: "🎨", num: "02", title: "Motor de Imágenes IA", description: "Genera y mejora imágenes de producto con IA generativa. Fondo blanco, lifestyle shots, infografías y más.", tags: ["Flux 1.1 Pro", "Fondo blanco", "Lifestyle"] },
                { icon: "📧", num: "03", title: "Motor de Email Marketing", description: "Crea secuencias de emails automatizadas: bienvenida, carritos abandonados, post-compra y reactivación.", tags: ["Automatización", "A/B Testing", "Flows"] },
                { icon: "📝", num: "04", title: "Motor de Contenido", description: "Redacta descripciones de producto, posts de blog y textos de landing page optimizados para SEO y conversión.", tags: ["Blog", "Copy de producto", "Landing pages"] },
                { icon: "💰", num: "05", title: "Motor de Pricing", description: "Analiza la competencia y optimiza precios dinámicamente para maximizar margen y volumen de ventas.", tags: ["Análisis competitivo", "Pricing dinámico", "Márgenes"] },
                { icon: "🧪", num: "06", title: "Motor A/B Testing", description: "Diseña y ejecuta experimentos en títulos, imágenes y descripciones para encontrar qué convierte mejor.", tags: ["Experimentos", "Estadística", "CRO"] },
                { icon: "📊", num: "07", title: "Motor de Analítica", description: "Dashboard unificado con métricas de rendimiento, alertas inteligentes y reportes automatizados.", tags: ["KPIs", "Alertas", "Reportes PDF"] },
              ].map(engine => (
                <article key={engine.num} style={{ background: "#111116", border: "1px solid #222", borderRadius: 12, padding: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <span style={{ fontSize: "1.5rem" }}>{engine.icon}</span>
                    <span style={{ color: "#555", fontSize: "0.8rem", fontWeight: 700 }}>{engine.num}</span>
                    <h3 style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>{engine.title}</h3>
                  </div>
                  <p style={{ color: "#888", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>{engine.description}</p>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {engine.tags.map(tag => (
                      <span key={tag} style={{ background: "#1a1a22", color: "#666", fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: 4 }}>{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="how-heading" style={{ padding: "5rem 2rem", background: "#0d0d11", borderTop: "1px solid #1f1f1f" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
              <p style={{ color: "#2dd49f", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>Cómo funciona</p>
              <h2 id="how-heading" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: "3rem" }}>
                Configura tu tienda en <span style={{ color: "#e6c668" }}>tres pasos</span>
              </h2>
              <ol style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "2rem" }}>
                {[
                  { num: "01", title: "Conecta tu tienda Shopify", desc: "Instala la app de Shopy Crafter desde el App Store de Shopify. La conexión es segura, con OAuth 2.0, y tarda menos de 2 minutos." },
                  { num: "02", title: "Configura tus objetivos", desc: "Elige qué quieres mejorar: SEO, imágenes, emails, precios o todo a la vez. Los motores IA se adaptan a tu catálogo y nicho." },
                  { num: "03", title: "Observa cómo crece tu tienda", desc: "Los motores trabajan de forma autónoma 24/7. Recibe reportes semanales con los resultados y optimizaciones realizadas." },
                ].map(step => (
                  <li key={step.num} style={{ display: "flex", gap: "1.5rem", textAlign: "left", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 48, height: 48, borderRadius: "50%", background: "#1a1a22", border: "2px solid #e6c668", display: "flex", alignItems: "center", justifyContent: "center", color: "#e6c668", fontWeight: 800, fontSize: "0.85rem", flexShrink: 0 }}>{step.num}</div>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, marginBottom: "0.4rem" }}>{step.title}</div>
                      <div style={{ color: "#888", fontSize: "0.9rem", lineHeight: 1.6 }}>{step.desc}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section aria-labelledby="pricing-heading" id="planes" style={{ padding: "5rem 2rem", maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <p style={{ color: "#2dd49f", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>Planes y precios</p>
              <h2 id="pricing-heading" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: "1rem" }}>
                Sin compromisos. <span style={{ color: "#e6c668" }}>Cancela cuando quieras.</span>
              </h2>
              <p style={{ color: "#888", maxWidth: 500, margin: "0 auto" }}>14 días de prueba gratuita. Sin tarjeta de crédito. Todas las funcionalidades disponibles desde el primer día.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem" }}>
              {[
                { name: "Starter", price: "49€", period: "/mes", desc: "Para tiendas que empiezan a escalar", features: ["Motor SEO", "Motor de Imágenes (50 imgs/mes)", "Motor de Contenido", "Soporte por email", "1 tienda Shopify"] },
                { name: "Pro", price: "149€", period: "/mes", featured: true, badge: "Más popular", desc: "Para tiendas en crecimiento activo", features: ["Todo lo de Starter", "Motor de Email Marketing", "Motor de Pricing", "Motor A/B Testing", "Motor de Analítica", "500 imgs/mes", "3 tiendas Shopify", "Soporte prioritario"] },
                { name: "Agency", price: "399€", period: "/mes", desc: "Para agencias y marcas enterprise", features: ["Todo lo de Pro", "Imágenes ilimitadas", "Tiendas ilimitadas", "White label", "Account manager dedicado", "SLA 99.9%", "Onboarding personalizado"] },
              ].map(plan => (
                <article key={plan.name} style={{ background: plan.featured ? "#13130e" : "#111116", border: `1.5px solid ${plan.featured ? "#e6c668" : "#222"}`, borderRadius: 12, padding: "2rem", position: "relative" }}>
                  {plan.badge && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#e6c668", color: "#0a0a0c", fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.75rem", borderRadius: 20 }}>{plan.badge}</div>}
                  <h3 style={{ color: "#fff", fontWeight: 800, marginBottom: "0.25rem" }}>{plan.name}</h3>
                  <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: "1rem" }}>{plan.desc}</p>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <span style={{ fontSize: "2.5rem", fontWeight: 800, color: plan.featured ? "#e6c668" : "#fff" }}>{plan.price}</span>
                    <span style={{ color: "#666", fontSize: "0.9rem" }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ color: "#aaa", fontSize: "0.9rem", display: "flex", gap: "0.5rem" }}>
                        <span style={{ color: "#2dd49f" }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <a href="/contacto" style={{ display: "block", textAlign: "center", background: plan.featured ? "#e6c668" : "transparent", color: plan.featured ? "#0a0a0c" : "#e6c668", border: `1.5px solid ${plan.featured ? "#e6c668" : "#e6c668"}`, padding: "0.75rem", borderRadius: 8, fontWeight: 700, textDecoration: "none" }}>
                    Empezar ahora →
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="testimonials-heading" style={{ padding: "5rem 2rem", background: "#0d0d11", borderTop: "1px solid #1f1f1f" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              <h2 id="testimonials-heading" style={{ textAlign: "center", fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: "3rem" }}>
                Lo que dicen nuestros <span style={{ color: "#e6c668" }}>clientes</span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                {[
                  { stars: 5, text: "Shopy Crafter transformó completamente el SEO de mi tienda. En 3 meses pasé de 200 a 1.800 visitas orgánicas mensuales sin hacer nada manual.", author: "Carlos M.", role: "Tienda de moda", metric: "+800% tráfico orgánico" },
                  { stars: 5, text: "El motor de imágenes IA es una pasada. Generé 500 fotos de producto con fondo blanco en una tarde. Antes me costaba semanas y miles de euros.", author: "Laura P.", role: "eCommerce de decoración", metric: "500 imágenes en 4 horas" },
                  { stars: 5, text: "Desde que uso Shopy Crafter mi tasa de conversión ha subido un 230%. El A/B testing automatizado encontró variantes de copy que yo jamás hubiera pensado.", author: "Marcos R.", role: "Tienda de electrónica", metric: "+230% conversión" },
                ].map(t => (
                  <blockquote key={t.author} style={{ background: "#111116", border: "1px solid #222", borderRadius: 12, padding: "1.5rem", margin: 0 }}>
                    <div style={{ color: "#e6c668", marginBottom: "0.75rem" }}>{"★".repeat(t.stars)}</div>
                    <p style={{ color: "#ccc", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1rem" }}>&ldquo;{t.text}&rdquo;</p>
                    <footer>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.9rem" }}>{t.author}</div>
                      <div style={{ color: "#666", fontSize: "0.8rem" }}>{t.role}</div>
                      <div style={{ color: "#2dd49f", fontSize: "0.8rem", fontWeight: 600, marginTop: "0.25rem" }}>{t.metric}</div>
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          </section>

          <section aria-labelledby="cta-heading" style={{ padding: "5rem 2rem", textAlign: "center", maxWidth: 700, margin: "0 auto" }}>
            <h2 id="cta-heading" style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#fff", marginBottom: "1rem" }}>
              Empieza a crecer hoy mismo
            </h2>
            <p style={{ color: "#888", fontSize: "1.1rem", marginBottom: "2rem", lineHeight: 1.6 }}>
              Únete a cientos de tiendas Shopify que ya usan Shopy Crafter para automatizar su crecimiento con inteligencia artificial.
            </p>
            <a href="/contacto" style={{ display: "inline-block", background: "#e6c668", color: "#0a0a0c", padding: "1rem 2.5rem", borderRadius: 8, fontWeight: 800, textDecoration: "none", fontSize: "1.1rem" }}>
              Prueba gratis 14 días →
            </a>
            <p style={{ color: "#555", fontSize: "0.85rem", marginTop: "1rem" }}>Sin tarjeta de crédito · Cancela cuando quieras · Soporte en español</p>
          </section>
        </main>

        <footer style={{ padding: "2rem", borderTop: "1px solid #1a1a1a", color: "#555", fontSize: "0.85rem" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <span>© {new Date().getFullYear()} Shopy Crafter. Todos los derechos reservados.</span>
            <nav aria-label="Footer" style={{ display: "flex", gap: "1.5rem" }}>
              <a href="/privacidad" style={{ color: "#555", textDecoration: "none" }}>Privacidad</a>
              <a href="/terminos" style={{ color: "#555", textDecoration: "none" }}>Términos</a>
              <a href="/cookies" style={{ color: "#555", textDecoration: "none" }}>Cookies</a>
              <a href="/contacto" style={{ color: "#555", textDecoration: "none" }}>Contacto</a>
            </nav>
          </div>
        </footer>

      </div>
    </>
  );
}
