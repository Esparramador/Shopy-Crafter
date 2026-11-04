import { Link, useLocation } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import PageMeta from "@/components/PageMeta";
import "@/pages/public/public-pages.css";
import "@/pages/public/legal.css";

const ERROR_CONFIG: Record<string, { title: string; subtitle: string }> = {
  "400": { title: "Solicitud incorrecta", subtitle: "La solicitud no pudo procesarse. Revisa los datos enviados." },
  "401": { title: "Necesitas iniciar sesión", subtitle: "Inicia sesión para acceder a esta página." },
  "402": { title: "Pago requerido", subtitle: "Esta funcionalidad requiere una suscripción activa." },
  "403": { title: "Acceso denegado", subtitle: "No tienes permisos para acceder a este recurso." },
  "404": { title: "Esta página no existe", subtitle: "Puede que el enlace esté mal escrito o que la página haya cambiado de sitio. Estos son los caminos más habituales." },
  "429": { title: "Demasiadas solicitudes", subtitle: "Has superado el límite de peticiones. Espera un momento e inténtalo de nuevo." },
  "500": { title: "Error interno", subtitle: "Algo ha fallado en el servidor. Inténtalo de nuevo en unos minutos." },
  "502": { title: "Servidor sin respuesta", subtitle: "El servidor de respaldo no ha respondido correctamente." },
  "503": { title: "Servicio no disponible", subtitle: "El servicio está temporalmente fuera de línea por mantenimiento." },
  "504": { title: "Tiempo de espera agotado", subtitle: "La solicitud ha tardado demasiado. Inténtalo de nuevo." },
};

const WAYS = [
  { href: "/tienda", tag: "Tienda", t: "Tienda", d: "Tarjetas, placas QR, regalos 3D y servicios web con pago seguro." },
  { href: "/automatizacion-shopify-ia", tag: "Servicios", t: "Automatización con IA", d: "Shopify, WooCommerce, PrestaShop y Stripe." },
  { href: "/diseno-web-profesional", tag: "Servicios", t: "Diseño web profesional", d: "Webs y landings con 3D y animación." },
  { href: "/blog", tag: "Blog", t: "Blog", d: "Guías y novedades de eCommerce." },
  { href: "/faq", tag: "Ayuda", t: "Preguntas frecuentes", d: "Packs, portal y cómo trabajamos." },
  { href: "/contacto", tag: "Contacto", t: "Hablar con nosotros", d: "Cuéntanos qué buscas." },
];

export default function NotFound({ code }: { code?: string }) {
  const [location] = useLocation();
  const errorCode = code ?? "404";
  const config = ERROR_CONFIG[errorCode] ?? ERROR_CONFIG["404"];

  return (
    <PublicLayout>
      <PageMeta title={`${config.title} — Shopy Crafter`} description={config.subtitle} canonical={`https://shopycrafter.com${location}`} noindex />
      <header className="pp-hero lg-hero">
        <div className="pp-wrap" style={{ textAlign: "center" }}>
          <span className="pp-eyebrow">Error {errorCode}</span>
          <h1 className="pp-h1" style={{ margin: "0 auto 18px" }}>{config.title}</h1>
          <p className="pp-lead" style={{ margin: "0 auto" }}>{config.subtitle}</p>
          <div className="pp-actions" style={{ justifyContent: "center" }}>
            <Link href="/" className="pp-btn pp-btn-gold">Ir al inicio</Link>
            <button type="button" className="pp-btn" onClick={() => window.history.back()}>Volver atrás</button>
          </div>
        </div>
      </header>
      {errorCode === "404" && (
        <div className="pp-wrap">
          <section className="pp-section" aria-labelledby="h-ways">
            <h2 className="pp-h2" id="h-ways">Quizá buscabas</h2>
            <div className="pp-grid">
              {WAYS.map(w => (
                <Link key={w.href} href={w.href} className="pp-card">
                  <span className="pp-tag">{w.tag}</span>
                  <h3>{w.t}</h3>
                  <p>{w.d}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </PublicLayout>
  );
}
