import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";

const SECTIONS = [
  { h: "1. Qué son las cookies", p: "Las cookies son pequeños archivos de texto que se almacenan en tu navegador cuando visitas un sitio web. Se usan para hacer funcionar la web, recordar tus preferencias y, en algunos casos, medir el uso." },
  { h: "2. Cookies técnicas (necesarias)", p: "Usamos cookies de sesión para mantenerte autenticado y proteger tu cuenta (CSRF). Estas cookies son imprescindibles para el funcionamiento del servicio y no requieren consentimiento." },
  { h: "3. Cookies de preferencias", p: "Almacenamos preferencias de interfaz (modo claro/oscuro, idioma, último proyecto abierto) localmente para mejorar tu experiencia. Puedes borrarlas desde la configuración de tu navegador." },
  { h: "4. Cookies de medición", p: "No usamos por defecto cookies publicitarias de terceros. Si en algún momento se incorporan, te lo informaremos previamente y podrás aceptarlas o rechazarlas con un banner de consentimiento." },
  { h: "5. Cómo gestionarlas", p: "Puedes configurar o eliminar las cookies desde tu navegador (Chrome, Firefox, Safari, Edge). Ten en cuenta que desactivar las cookies técnicas impedirá iniciar sesión." },
];

const COOKIE_TABLE = [
  { name: "session_token", type: "Técnica", duration: "Sesión", purpose: "Autenticación de usuario" },
  { name: "csrf_token", type: "Técnica", duration: "Sesión", purpose: "Protección contra CSRF" },
  { name: "theme_pref", type: "Preferencia", duration: "1 año", purpose: "Tema visual (claro/oscuro)" },
  { name: "last_project", type: "Preferencia", duration: "30 días", purpose: "Último proyecto abierto" },
  { name: "lang", type: "Preferencia", duration: "1 año", purpose: "Idioma de la interfaz" },
];

export default function Cookies() {
  return (
    <>
      <PageMeta {...metaFor("/cookies")} />
      <PublicLayout>
      <div style={{ padding: "80px 24px", maxWidth: 820, margin: "0 auto" }}>
        <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(200,168,75,0.12)", color: "#e6c668", border: "1px solid rgba(200,168,75,0.2)", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 16 }}>Legal</div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "var(--t, #eee)", marginBottom: 12, lineHeight: 1.15 }}>Política de Cookies</h1>
        <p style={{ fontSize: 14, color: "var(--t4, #666)", marginBottom: 40 }}>Última actualización: mayo 2026</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 48 }}>
          {SECTIONS.map(s => (
            <div key={s.h}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 8 }}>{s.h}</h2>
              <p style={{ fontSize: 15, color: "var(--t3, #999)", lineHeight: 1.8, margin: 0 }}>{s.p}</p>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--t, #eee)", marginBottom: 16 }}>Detalle de cookies utilizadas</h2>
        <div style={{ overflowX: "auto", marginBottom: 40 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ink3, #1e1e22)" }}>
                {["Cookie", "Tipo", "Duración", "Finalidad"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: "var(--t4, #666)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COOKIE_TABLE.map(c => (
                <tr key={c.name} style={{ borderBottom: "1px solid var(--ink3, #1e1e22)" }}>
                  <td style={{ padding: "10px 12px", color: "#e6c668", fontFamily: "monospace", fontSize: 12 }}>{c.name}</td>
                  <td style={{ padding: "10px 12px", color: "var(--t3, #999)" }}>{c.type}</td>
                  <td style={{ padding: "10px 12px", color: "var(--t3, #999)" }}>{c.duration}</td>
                  <td style={{ padding: "10px 12px", color: "var(--t3, #999)" }}>{c.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: 20, background: "rgba(200,168,75,0.06)", border: "1px solid rgba(200,168,75,0.15)", borderRadius: 12, fontSize: 13, color: "var(--t3, #999)", lineHeight: 1.6 }}>
          Para cualquier consulta sobre esta política, escríbenos a <a href="mailto:craftershopy@gmail.com" style={{ color: "#e6c668" }}>craftershopy@gmail.com</a>.
        </div>
      </div>
    </PublicLayout>
    </>
  );
}
