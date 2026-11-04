import PageMeta, { metaFor } from "@/components/PageMeta";
import LegalDoc from "./LegalDoc";

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

const TABLE = (
  <section className="lg-table" id="detalle" aria-labelledby="h-detalle">
    <h2 id="h-detalle">Detalle de cookies utilizadas</h2>
    <div className="lg-scroll" role="region" aria-labelledby="h-detalle" tabIndex={0}>
      <table>
        <thead>
          <tr>{["Cookie", "Tipo", "Duración", "Finalidad"].map(h => <th key={h} scope="col">{h}</th>)}</tr>
        </thead>
        <tbody>
          {COOKIE_TABLE.map(c => (
            <tr key={c.name}><td>{c.name}</td><td>{c.type}</td><td>{c.duration}</td><td>{c.purpose}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default function Cookies() {
  return (
    <>
      <PageMeta {...metaFor("/cookies")} />
      <LegalDoc
        current="/cookies"
        title="Política de Cookies"
        lead="Qué cookies usamos, para qué sirven y cómo puedes gestionarlas desde tu navegador."
        updated="mayo 2026"
        sections={SECTIONS}
        extra={TABLE}
      />
    </>
  );
}
