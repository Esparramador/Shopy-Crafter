import { useState, useEffect } from "react";
import { Link } from "wouter";
import PageMeta, { metaFor } from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import "./contacto.css";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const nicheOptions = ["Moda y ropa","Electrónica y gadgets","Hogar y decoración","Belleza y cosmética","Deporte y fitness","Alimentación y gourmet","Arte y coleccionismo","Mascotas","Joyería y accesorios","Otro"];
const revenueOptions = ["Menos de €1.000","€1.000 – €5.000","€5.000 – €15.000","€15.000 – €50.000","Más de €50.000"];
const serviceOptions = ["Auditoría completa","Generación de imágenes IA","SEO y schemas","A/B Testing","Pricing y COGS","Rediseño web","Programa de afiliados","Plan personalizado"];

const EMPTY_FORM = { name:"", email:"", phone:"", storeUrl:"", niche:"", customNiche:"", revenue:"", socialMedia:"", message:"" };

type FormKey = keyof typeof EMPTY_FORM;

export default function Contacto() {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [services, setServices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle"|"sending"|"sent"|"error">("idle");
  const [error, setError] = useState("");

  // Desde la Tienda: «Pedir presupuesto» llega con el servicio ya escrito (solo rellena el mensaje, no envía nada).
  useEffect(() => {
    const asunto = new URLSearchParams(window.location.search).get("asunto")?.trim().slice(0, 120);
    if (asunto) setForm(f => (f.message ? f : { ...f, message: `Me interesa: ${asunto}. ` }));
  }, []);

  const CF = (field: FormKey) =>
    (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const toggleService = (s: string) =>
    setServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending"); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, services }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al enviar");
      setStatus("sent");
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error inesperado");
    }
  };

  return (
    <>
      <PageMeta {...metaFor("/contacto")} />
      <PublicLayout>
        <header className="pp-hero ct-hero">
          <div className="pp-wrap">
            <span className="pp-eyebrow">Contacto</span>
            <h1 className="pp-h1">Cuéntanos qué necesitas y lo vemos juntos</h1>
            <p className="pp-lead">Una tienda que optimizar, una web nueva, una app o una idea sin definir: escríbenos con lo que tengas y te respondemos por email.</p>
          </div>
        </header>

        <div className="pp-wrap ct-grid">
          <aside className="ct-side" aria-label="Datos de contacto">
            <div className="ct-box">
              <h2>Datos</h2>
              <div className="ct-line"><div><b>Email directo</b><a href="mailto:craftershopy@gmail.com">craftershopy@gmail.com</a></div></div>
              <div className="ct-line"><div><b>Ubicación</b><span>España · trabajo remoto</span></div></div>
            </div>
            <div className="ct-box">
              <h2>Qué pasa después</h2>
              <ol className="ct-steps">
                <li><strong>Leemos tu mensaje</strong>Y miramos tu web o tu tienda si nos has dado la dirección.</li>
                <li><strong>Te respondemos por email</strong>Con preguntas, o directamente con una propuesta.</li>
                <li><strong>Presupuesto por escrito</strong>Con alcance y precio, antes de empezar nada.</li>
              </ol>
            </div>
            <div className="ct-box">
              <h2>Mientras tanto</h2>
              <div className="ct-links">
                <Link href="/tienda">Tienda</Link>
                <a href="/#fp-pricing">Packs y precios</a>
                <Link href="/faq">Preguntas frecuentes</Link>
                <Link href="/casos-de-exito">Casos de éxito</Link>
              </div>
            </div>
          </aside>

          <section className="ct-form-card" aria-labelledby="ct-title">
            {status === "sent" ? (
              <div className="ct-sent" role="status">
                <div className="ct-sent-mark" aria-hidden="true">✓</div>
                <h2>Solicitud recibida</h2>
                <p>Gracias. Hemos recibido tu mensaje y te escribiremos al email que nos has indicado.</p>
                <div className="pp-actions" style={{ justifyContent: "center" }}>
                  <Link href="/tienda" className="pp-btn">Ver la Tienda</Link>
                  <Link href="/" className="pp-btn">Volver al inicio</Link>
                </div>
              </div>
            ) : (
              <>
                <h2 id="ct-title">Cuéntanos sobre tu negocio</h2>
                <p>Solo nombre y email son obligatorios. Cuanto más nos cuentes, mejor será nuestra respuesta.</p>

                <form onSubmit={submit} className="ct-form" aria-describedby={status === "error" ? "ct-err" : undefined}>
                  <div className="ct-row">
                    <div>
                      <label className="ct-label" htmlFor="ct-name">Nombre completo <i aria-hidden="true">*</i></label>
                      <input id="ct-name" name="name" type="text" required autoComplete="name" className="ct-input" value={form.name} onChange={CF("name")} placeholder="Tu nombre y apellidos" />
                    </div>
                    <div>
                      <label className="ct-label" htmlFor="ct-email">Email de contacto <i aria-hidden="true">*</i></label>
                      <input id="ct-email" name="email" type="email" required autoComplete="email" className="ct-input" value={form.email} onChange={CF("email")} placeholder="tu@email.com" />
                    </div>
                  </div>

                  <div className="ct-row">
                    <div>
                      <label className="ct-label" htmlFor="ct-phone">Teléfono <em>(opcional)</em></label>
                      <input id="ct-phone" name="phone" type="tel" autoComplete="tel" className="ct-input" value={form.phone} onChange={CF("phone")} placeholder="+34 600 000 000" />
                    </div>
                    <div>
                      <label className="ct-label" htmlFor="ct-url">Web o tienda <em>(opcional)</em></label>
                      <input id="ct-url" name="storeUrl" type="text" inputMode="url" autoComplete="url" className="ct-input" value={form.storeUrl} onChange={CF("storeUrl")} placeholder="mitienda.com" />
                    </div>
                  </div>

                  <div className="ct-row">
                    <div>
                      <label className="ct-label" htmlFor="ct-niche">Sector <em>(opcional)</em></label>
                      <select id="ct-niche" name="niche" className="ct-input" value={form.niche} onChange={CF("niche")}>
                        <option value="">Selecciona tu sector</option>
                        {nicheOptions.map(o => <option key={o}>{o}</option>)}
                      </select>
                      {form.niche === "Otro" && (
                        <input type="text" aria-label="Describe tu sector" value={form.customNiche} onChange={CF("customNiche")} placeholder="Describe tu sector…" className="ct-input" style={{ marginTop: 8 }} />
                      )}
                    </div>
                    <div>
                      <label className="ct-label" htmlFor="ct-revenue">Facturación mensual aprox. <em>(opcional)</em></label>
                      <select id="ct-revenue" name="revenue" className="ct-input" value={form.revenue} onChange={CF("revenue")}>
                        <option value="">Selecciona un rango</option>
                        {revenueOptions.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="ct-label" htmlFor="ct-social">Redes sociales o Instagram <em>(opcional)</em></label>
                    <input id="ct-social" name="socialMedia" type="text" className="ct-input" value={form.socialMedia} onChange={CF("socialMedia")} placeholder="@tu_cuenta o enlace" />
                  </div>

                  <fieldset className="ct-fieldset">
                    <legend>¿Qué te interesa? <em style={{ fontStyle: "normal", fontWeight: 400, color: "var(--pp-muted)" }}>(puedes marcar varios)</em></legend>
                    <div className="ct-chips">
                      {serviceOptions.map(s => (
                        <button key={s} type="button" className="ct-chip" aria-pressed={services.includes(s)} onClick={() => toggleService(s)}>{s}</button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label className="ct-label" htmlFor="ct-msg">Mensaje <em>(opcional)</em></label>
                    <textarea id="ct-msg" name="message" rows={5} className="ct-input" value={form.message} onChange={CF("message")} placeholder="Cuéntanos sobre tu proyecto, tus retos actuales o lo que quieres conseguir…" />
                  </div>

                  <div aria-live="polite">
                    {status === "error" && <div id="ct-err" className="ct-error" role="alert">{error}</div>}
                  </div>

                  <div className="ct-foot">
                    <p className="ct-legal">Usamos tus datos solo para responderte sobre tu proyecto. Más en la <Link href="/privacidad">política de privacidad</Link>.</p>
                    <button type="submit" disabled={status === "sending"} className="pp-btn pp-btn-gold ct-submit">
                      {status === "sending" ? "Enviando…" : "Enviar solicitud →"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      </PublicLayout>
    </>
  );
}
