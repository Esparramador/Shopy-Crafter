import { useLocation } from "wouter";

const ERROR_CONFIG: Record<string, { title: string; subtitle: string; icon: string }> = {
  "400": { title: "Solicitud Incorrecta", subtitle: "La solicitud no pudo ser procesada. Revisa los datos enviados.", icon: "⚠️" },
  "401": { title: "No Autorizado", subtitle: "Necesitas iniciar sesión para acceder a esta página.", icon: "🔐" },
  "402": { title: "Pago Requerido", subtitle: "Esta funcionalidad requiere una suscripción activa.", icon: "💳" },
  "403": { title: "Acceso Denegado", subtitle: "No tienes permisos para acceder a este recurso.", icon: "🚫" },
  "404": { title: "Página No Encontrada", subtitle: "La página que buscas no existe o ha sido movida.", icon: "🔍" },
  "429": { title: "Demasiadas Solicitudes", subtitle: "Has excedido el límite de peticiones. Espera un momento e inténtalo de nuevo.", icon: "⏳" },
  "500": { title: "Error Interno", subtitle: "Algo salió mal en el servidor. Estamos trabajando para solucionarlo.", icon: "🔧" },
  "502": { title: "Bad Gateway", subtitle: "El servidor de respaldo no respondió correctamente.", icon: "🌐" },
  "503": { title: "Servicio No Disponible", subtitle: "El servicio está temporalmente fuera de línea por mantenimiento.", icon: "🔄" },
  "504": { title: "Timeout del Servidor", subtitle: "La solicitud tardó demasiado en procesarse. Inténtalo de nuevo.", icon: "⏰" },
};

export default function NotFound({ code }: { code?: string }) {
  const [, navigate] = useLocation();
  const errorCode = code ?? "404";
  const config = ERROR_CONFIG[errorCode] ?? ERROR_CONFIG["404"];

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #080810 0%, #0d0d1a 50%, #080810 100%)",
      fontFamily: "'Geist', system-ui, sans-serif",
    }}>
      <div style={{
        maxWidth: 520, width: "100%", margin: "0 24px", textAlign: "center",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,168,75,0.15)",
        borderRadius: 16, padding: "48px 40px", backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,168,75,0.08)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>{config.icon}</div>

        <div style={{
          fontSize: 72, fontWeight: 800, lineHeight: 1,
          background: "linear-gradient(135deg, #c8a84b 0%, #e8d48b 50%, #c8a84b 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          marginBottom: 8, letterSpacing: -2,
        }}>
          {errorCode}
        </div>

        <h1 style={{
          fontSize: 22, fontWeight: 700, color: "#f0f0f5", marginBottom: 12,
          fontFamily: "'Instrument Serif', Georgia, serif",
        }}>
          {config.title}
        </h1>

        <p style={{ fontSize: 15, color: "rgba(240,240,245,0.55)", lineHeight: 1.6, marginBottom: 32 }}>
          {config.subtitle}
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "12px 28px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg, #c8a84b, #a08838)", color: "#080810",
              fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(200,168,75,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            Ir al Inicio
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: "12px 28px", borderRadius: 8, cursor: "pointer",
              background: "transparent", border: "1px solid rgba(200,168,75,0.3)",
              color: "#c8a84b", fontSize: 14, fontWeight: 500,
              transition: "border-color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(200,168,75,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(200,168,75,0.3)"; }}
          >
            Volver Atrás
          </button>
        </div>

        <div style={{
          marginTop: 40, paddingTop: 20,
          borderTop: "1px solid rgba(200,168,75,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: "#c8a84b", letterSpacing: 1.5,
          }}>
            SHOPY CRAFTER
          </span>
          <span style={{ fontSize: 11, color: "rgba(240,240,245,0.3)" }}>
            — IA para tu eCommerce
          </span>
        </div>
      </div>
    </div>
  );
}
