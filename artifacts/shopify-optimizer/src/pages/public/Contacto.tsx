import PageMeta from "@/components/PageMeta";
import PublicLayout from "@/components/PublicLayout";
import { ContactoHero } from "@/components/ContactoHero";

export default function Contacto() {
  return (
    <>
      <PageMeta
        title="Contacto — Shopy Crafter"
        description="Contacta con el equipo de Shopy Crafter. Respondemos en menos de 24 horas con análisis personalizado de tu tienda Shopify."
        canonical="https://shopycrafter.com/contacto"
      />
      <PublicLayout>
        {/* Hero fullscreen: video bg + info cards at t=3.5s + form at t=5s */}
        <div style={{
          position: "relative",
          width: "100%",
          minHeight: "calc(100vh - 64px)",
          background: "#050318",
          overflow: "hidden",
        }}>
          <ContactoHero />
        </div>
      </PublicLayout>
    </>
  );
}
