import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check, ExternalLink, ShoppingBag, Globe, Store, Info } from "lucide-react";
import { useCmsSection } from "@/contexts/CmsContext";

type PlatformType = "shopify" | "woocommerce" | "prestashop" | "universal" | "stripe";

interface StepData {
  title: string;
  description: string;
  code?: string;
  codeLabel?: string;
  tip?: string;
  link?: { label: string; url: string };
  validation?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 6,
        border: "1px solid var(--bdr)",
        background: copied ? "rgba(61,184,122,0.1)" : "rgba(255,255,255,0.05)",
        cursor: "pointer",
        fontSize: 11,
        color: copied ? "#3db87a" : "var(--t3)",
        transition: "all 0.15s",
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function StepItem({ step, index, isOpen, onToggle }: { step: StepData; index: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        border: "1px solid var(--bdr)",
        borderRadius: 10,
        overflow: "hidden",
        transition: "all 0.15s",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "12px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "rgba(200,168,75,0.12)",
            color: "#c9a84c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontFamily: "var(--fb)",
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontFamily: "var(--fb)", color: "var(--t1)" }}>
          {step.title}
        </span>
        {isOpen ? <ChevronUp size={14} style={{ color: "var(--t3)" }} /> : <ChevronDown size={14} style={{ color: "var(--t3)" }} />}
      </button>

      {isOpen && (
        <div style={{ padding: "0 14px 14px 14px" }}>
          <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7, margin: "0 0 8px 0" }}>
            {step.description}
          </p>

          {step.code && (
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              {step.codeLabel && (
                <p style={{ fontSize: 11, fontFamily: "var(--fb)", color: "var(--t3)", marginBottom: 4 }}>
                  {step.codeLabel}
                </p>
              )}
              <div
                style={{
                  background: "rgba(0,0,0,0.4)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  position: "relative",
                  overflow: "auto",
                }}
              >
                <pre style={{ margin: 0, fontSize: 11, fontFamily: "var(--fm)", color: "#e0e0e0", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>
                  {step.code}
                </pre>
                <div style={{ position: "absolute", top: 8, right: 8 }}>
                  <CopyButton text={step.code} />
                </div>
              </div>
            </div>
          )}

          {step.tip && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 6,
                background: "rgba(200,168,75,0.06)",
                border: "1px solid rgba(200,168,75,0.15)",
                marginTop: 8,
              }}
            >
              <Info size={13} style={{ color: "#c9a84c", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{step.tip}</span>
            </div>
          )}

          {step.link && (
            <a
              href={step.link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                color: "#5b9bd5",
                textDecoration: "none",
                marginTop: 8,
              }}
            >
              <ExternalLink size={11} />
              {step.link.label}
            </a>
          )}

          {step.validation && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                fontSize: 11,
                color: "#3db87a",
              }}
            >
              <Check size={12} />
              {step.validation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getShopifySteps(t: (k: string, fb: string) => string): StepData[] {
  return [
    {
      title: t("shopify.step1.title", "Crea una app personalizada en Shopify"),
      description: t("shopify.step1.description", "Ve a tu panel de Shopify Admin → Configuración → Apps y canales de venta → Desarrollar apps → Crear una app. Dale un nombre descriptivo como \"Shopy Crafter\"."),
      tip: t("shopify.step1.tip", "Si no ves la opción \"Desarrollar apps\", necesitas ser propietario de la tienda o tener permisos de desarrollador."),
      link: { label: t("shopify.step1.linkLabel", "Documentación de Shopify Apps"), url: "https://shopify.dev/docs/apps/getting-started" },
      validation: t("shopify.step1.validation", "App creada en el panel de Shopify"),
    },
    {
      title: t("shopify.step2.title", "Configura los permisos (scopes) de la API"),
      description: t("shopify.step2.description", "En la configuración de tu app, ve a \"Configuración de la API de Admin\" y activa los siguientes permisos: read_products, write_products, read_orders, read_customers, read_analytics, read_inventory, write_inventory, read_price_rules, write_price_rules, read_content, write_content, read_themes, write_themes."),
      tip: t("shopify.step2.tip", "Estos permisos permiten a Shopy Crafter optimizar productos, gestionar imágenes, analizar ventas y mejorar el SEO de tu tienda."),
      validation: t("shopify.step2.validation", "Permisos configurados correctamente"),
    },
    {
      title: t("shopify.step3.title", "Instala la app en tu tienda"),
      description: t("shopify.step3.description", "Haz clic en \"Instalar app\" en la parte superior de la página de configuración. Shopify te pedirá que confirmes los permisos. Acepta para completar la instalación."),
      validation: t("shopify.step3.validation", "App instalada en la tienda"),
    },
    {
      title: t("shopify.step4.title", "Copia las credenciales API"),
      description: t("shopify.step4.description", "Una vez instalada la app, ve a la pestaña \"Credenciales de la API\". Copia el Client ID (API Key) y genera un Client Secret (API Secret Key). El token de acceso se mostrará una sola vez — cópialo inmediatamente."),
      tip: t("shopify.step4.tip", "Guarda el API Secret Key en un lugar seguro. Si lo pierdes, tendrás que generar uno nuevo."),
      validation: t("shopify.step4.validation", "Client ID y Client Secret copiados"),
    },
    {
      title: t("shopify.step5.title", "Pega las credenciales en el formulario"),
      description: t("shopify.step5.description", "Introduce tu dominio de Shopify (ej: mi-tienda.myshopify.com), pega el Client ID en el campo \"API Key\" y el Client Secret en el campo \"Clave secreta\". Haz clic en \"Probar Conexión\" para verificar."),
      validation: t("shopify.step5.validation", "Credenciales introducidas y conexión verificada"),
    },
  ];
}

function getWooCommerceSteps(t: (k: string, fb: string) => string): StepData[] {
  return [
    {
      title: t("woocommerce.step1.title", "Accede al panel de WordPress"),
      description: t("woocommerce.step1.description", "Inicia sesión en tu panel de administración de WordPress. Normalmente accedes desde tutienda.com/wp-admin con tus credenciales de administrador."),
      validation: t("woocommerce.step1.validation", "Sesión iniciada en WordPress Admin"),
    },
    {
      title: t("woocommerce.step2.title", "Navega a WooCommerce → REST API"),
      description: t("woocommerce.step2.description", "Ve a WooCommerce → Ajustes → Avanzado → REST API. Esta sección te permite crear claves de acceso para aplicaciones externas."),
      tip: t("woocommerce.step2.tip", "Si no ves la pestaña \"REST API\", asegúrate de tener WooCommerce actualizado a la última versión."),
      validation: t("woocommerce.step2.validation", "Sección REST API encontrada"),
    },
    {
      title: t("woocommerce.step3.title", "Crea una nueva clave API"),
      description: t("woocommerce.step3.description", "Haz clic en \"Añadir clave\". En el formulario:\n• Descripción: \"Shopy Crafter\"\n• Usuario: Selecciona tu usuario administrador\n• Permisos: Selecciona \"Lectura/Escritura\""),
      tip: t("woocommerce.step3.tip", "Es importante seleccionar \"Lectura/Escritura\" (no solo \"Lectura\") para que Shopy Crafter pueda optimizar tus productos."),
      validation: t("woocommerce.step3.validation", "Clave creada con permisos de Lectura/Escritura"),
    },
    {
      title: t("woocommerce.step4.title", "Copia las claves INMEDIATAMENTE"),
      description: t("woocommerce.step4.description", "Al hacer clic en \"Generar clave API\", se mostrarán el Consumer Key (empieza por ck_) y el Consumer Secret (empieza por cs_). ¡COPIA AMBOS AHORA! El Consumer Secret solo se muestra una vez y no podrás verlo de nuevo."),
      tip: t("woocommerce.step4.tip", "Si pierdes el Consumer Secret, tendrás que eliminar la clave y crear una nueva."),
      validation: t("woocommerce.step4.validation", "Consumer Key y Consumer Secret copiados"),
    },
    {
      title: t("woocommerce.step5.title", "Verifica los Permalinks"),
      description: t("woocommerce.step5.description", "Ve a Ajustes → Enlaces permanentes. Asegúrate de que NO esté seleccionada la opción \"Simple\" (Plain). Recomendamos \"Nombre de la entrada\" (Post name). Guarda los cambios."),
      tip: t("woocommerce.step5.tip", "WooCommerce REST API requiere URLs amigables (pretty permalinks). Si usas \"Simple\", la API no funcionará."),
      validation: t("woocommerce.step5.validation", "Permalinks configurados correctamente"),
    },
    {
      title: t("woocommerce.step6.title", "Verifica que tu tienda usa HTTPS"),
      description: t("woocommerce.step6.description", "Tu tienda debe usar HTTPS (certificado SSL) para proteger las credenciales durante la comunicación. Verifica que tu URL empieza con https:// en la barra del navegador."),
      tip: t("woocommerce.step6.tip", "Si tu tienda no tiene SSL, contacta con tu proveedor de hosting para activarlo. La mayoría ofrecen certificados Let's Encrypt gratuitos."),
      validation: t("woocommerce.step6.validation", "HTTPS activo en la tienda"),
    },
    {
      title: t("woocommerce.step7.title", "(Opcional) Habilitar acceso SEO con Yoast"),
      description: t("woocommerce.step7.description", "Si tienes Yoast SEO instalado y quieres que Shopy Crafter pueda leer y escribir los meta títulos y descripciones SEO, necesitas añadir un snippet PHP a tu tema. Copia el código de abajo y pégalo al final del archivo functions.php de tu tema (Apariencia → Editor de temas → functions.php)."),
      code: `// Habilitar lectura/escritura de campos Yoast SEO vía WooCommerce REST API
// Añadir al final de functions.php de tu tema activo

add_filter('woocommerce_rest_prepare_product_object', function($response, $product) {
    $product_id = $product->get_id();
    $response->data['yoast_title'] = get_post_meta($product_id, '_yoast_wpseo_title', true);
    $response->data['yoast_description'] = get_post_meta($product_id, '_yoast_wpseo_metadesc', true);
    $response->data['yoast_focus_keyword'] = get_post_meta($product_id, '_yoast_wpseo_focuskw', true);
    return $response;
}, 10, 2);

add_action('woocommerce_rest_insert_product_object', function($product, $request) {
    $product_id = $product->get_id();
    if (isset($request['yoast_title'])) {
        update_post_meta($product_id, '_yoast_wpseo_title', sanitize_text_field($request['yoast_title']));
    }
    if (isset($request['yoast_description'])) {
        update_post_meta($product_id, '_yoast_wpseo_metadesc', sanitize_textarea_field($request['yoast_description']));
    }
    if (isset($request['yoast_focus_keyword'])) {
        update_post_meta($product_id, '_yoast_wpseo_focuskw', sanitize_text_field($request['yoast_focus_keyword']));
    }
}, 10, 2);`,
      codeLabel: t("woocommerce.step7.codeLabel", "Snippet PHP para functions.php:"),
      tip: t("woocommerce.step7.tip", "Este paso es opcional. Sin él, Shopy Crafter puede optimizar productos pero no podrá gestionar los campos SEO de Yoast directamente."),
    },
    {
      title: t("woocommerce.step8.title", "Pega las credenciales en el formulario"),
      description: t("woocommerce.step8.description", "Introduce la URL de tu tienda (ej: https://mitienda.com), pega el Consumer Key (ck_...) y el Consumer Secret (cs_...) en los campos correspondientes. Haz clic en \"Probar Conexión\" para verificar."),
      validation: t("woocommerce.step8.validation", "Credenciales introducidas y conexión verificada"),
    },
  ];
}

function getPrestaShopSteps(t: (k: string, fb: string) => string): StepData[] {
  return [
    {
      title: t("prestashop.step1.title", "Accede al back office de PrestaShop"),
      description: t("prestashop.step1.description", "Inicia sesión en tu panel de administración de PrestaShop. Normalmente accedes desde tutienda.com/admin o tutienda.com/adminXXXX con tus credenciales de administrador."),
      validation: t("prestashop.step1.validation", "Sesión iniciada en el back office"),
    },
    {
      title: t("prestashop.step2.title", "Navega a Parámetros Avanzados → Webservice"),
      description: t("prestashop.step2.description", "En el menú lateral, ve a Parámetros Avanzados → Webservice. Esta sección te permite habilitar la API y crear claves de acceso."),
      validation: t("prestashop.step2.validation", "Sección Webservice encontrada"),
    },
    {
      title: t("prestashop.step3.title", "Activa el webservice"),
      description: t("prestashop.step3.description", "En la parte superior de la página, asegúrate de que el interruptor \"Activar el servicio web de PrestaShop\" esté en \"Sí\". Si no lo estaba, actívalo y guarda los cambios."),
      tip: t("prestashop.step3.tip", "Sin el webservice activado, ninguna aplicación externa podrá conectarse a tu tienda."),
      validation: t("prestashop.step3.validation", "Webservice activado"),
    },
    {
      title: t("prestashop.step4.title", "Crea una nueva clave de webservice"),
      description: t("prestashop.step4.description", "Haz clic en \"Añadir nueva clave de webservice\". En la parte superior, haz clic en \"Generar\" para crear una clave de 32 caracteres automáticamente. Esta clave es tu contraseña API."),
      tip: t("prestashop.step4.tip", "La clave debe tener exactamente 32 caracteres alfanuméricos. No la modifiques manualmente."),
      validation: t("prestashop.step4.validation", "Clave de 32 caracteres generada"),
    },
    {
      title: t("prestashop.step5.title", "Configura los permisos de recursos"),
      description: t("prestashop.step5.description", "En la matriz de permisos, activa TODAS las casillas (GET, POST, PUT, DELETE) para los siguientes recursos:\n• products (productos)\n• categories (categorías)\n• images (imágenes)\n• stock_availables (stock disponible)\n• combinations (combinaciones/variantes)\n• product_option_values (opciones de producto)\n• orders (pedidos)\n• customers (clientes)\n• manufacturers (fabricantes)\n• tags (etiquetas)"),
      tip: t("prestashop.step5.tip", "Puedes hacer clic en la fila de cabecera de cada columna (GET, POST, PUT, DELETE) para marcar todas las casillas de esa columna a la vez."),
      validation: t("prestashop.step5.validation", "Permisos configurados para todos los recursos necesarios"),
    },
    {
      title: t("prestashop.step6.title", "Guarda la clave"),
      description: t("prestashop.step6.description", "Haz clic en \"Guardar\" en la parte inferior de la página. La clave quedará registrada y podrás usarla para conectar Shopy Crafter."),
      validation: t("prestashop.step6.validation", "Clave guardada correctamente"),
    },
    {
      title: t("prestashop.step7.title", "Verifica las URLs amigables"),
      description: t("prestashop.step7.description", "Ve a Preferencias → SEO y URLs. Asegúrate de que la opción \"URLs amigables\" (Friendly URLs) esté activada. Esto es necesario para que la API funcione correctamente."),
      tip: t("prestashop.step7.tip", "Si tu servidor no tiene mod_rewrite habilitado, las URLs amigables no funcionarán. Contacta con tu proveedor de hosting para activarlo."),
      validation: t("prestashop.step7.validation", "URLs amigables activadas"),
    },
    {
      title: t("prestashop.step8.title", "Pega la clave en el formulario"),
      description: t("prestashop.step8.description", "Introduce la URL de tu tienda PrestaShop (ej: https://mitienda.com) y pega la clave de 32 caracteres en el campo \"Clave API\". Haz clic en \"Probar Conexión\" para verificar."),
      validation: t("prestashop.step8.validation", "Clave introducida y conexión verificada"),
    },
  ];
}

function getUniversalSteps(t: (k: string, fb: string) => string): StepData[] {
  return [
    {
      title: t("universal.step1.title", "Introduce el nombre de tu negocio"),
      description: t("universal.step1.description", "Escribe el nombre de tu empresa o marca en el campo \"Nombre del proyecto\". Esto nos ayuda a personalizar el análisis."),
      validation: t("universal.step1.validation", "Nombre introducido"),
    },
    {
      title: t("universal.step2.title", "Introduce la URL de tu web"),
      description: t("universal.step2.description", "Introduce la URL completa de tu sitio web (ej: https://miempresa.com). Analizaremos la estructura, SEO, velocidad y contenido de tu web automáticamente."),
      validation: t("universal.step2.validation", "URL introducida"),
    },
    {
      title: t("universal.step3.title", "(Opcional) Añade tu Instagram"),
      description: t("universal.step3.description", "Si tienes una cuenta de Instagram, puedes añadir la URL (ej: https://instagram.com/miempresa) en el campo de contexto de marca. Analizaremos tu presencia en redes sociales."),
    },
    {
      title: t("universal.step4.title", "Haz clic en Guardar"),
      description: t("universal.step4.description", "No necesitas credenciales API ni configuración adicional. Simplemente guarda el proyecto y nuestro sistema analizará automáticamente: estructura y navegación de tu web, SEO técnico y on-page, velocidad de carga (Core Web Vitals), contenido y copywriting, presencia en redes sociales, y oportunidades de mejora."),
      validation: t("universal.step4.validation", "Proyecto guardado y análisis iniciado"),
    },
  ];
}

const PLATFORM_CONFIG: Record<PlatformType, { label: string; color: string; icon: any; getSteps: (t: (k: string, fb: string) => string) => StepData[] }> = {
  shopify: { label: "Shopify", color: "#95bf47", icon: ShoppingBag, getSteps: getShopifySteps },
  woocommerce: { label: "WooCommerce", color: "#7f54b3", icon: Globe, getSteps: getWooCommerceSteps },
  prestashop: { label: "PrestaShop", color: "#df0067", icon: Store, getSteps: getPrestaShopSteps },
  universal: { label: "Auditoría Universal", color: "#888", icon: Globe, getSteps: getUniversalSteps },
  stripe: { label: "Stripe", color: "#635bff", icon: Globe, getSteps: getUniversalSteps },
};

interface ConnectionGuideProps {
  platform: PlatformType;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export default function ConnectionGuide({ platform, defaultExpanded = false, compact = false }: ConnectionGuideProps) {
  const { t } = useCmsSection("labels.connectionGuides");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    defaultExpanded ? new Set([0]) : new Set()
  );
  const [collapsed, setCollapsed] = useState(!defaultExpanded);

  const config = PLATFORM_CONFIG[platform];
  const Icon = config.icon;
  const steps = config.getSteps(t);

  const toggleStep = (index: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const expandAll = () => setExpandedSteps(new Set(steps.map((_, i) => i)));
  const collapseAll = () => setExpandedSteps(new Set());

  return (
    <div
      style={{
        border: `1px solid ${config.color}30`,
        borderRadius: 12,
        overflow: "hidden",
        background: `${config.color}05`,
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: compact ? "10px 14px" : "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Icon size={18} style={{ color: config.color }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontFamily: "var(--fb)", color: "var(--t1)", display: "block" }}>
            {t(`${platform}.guideTitle`, `Guía de conexión: ${config.label}`)}
          </span>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            {t(`${platform}.guideSubtitle`, `${steps.length} pasos para conectar tu tienda`)}
          </span>
        </div>
        {collapsed ? <ChevronDown size={16} style={{ color: "var(--t3)" }} /> : <ChevronUp size={16} style={{ color: "var(--t3)" }} />}
      </button>

      {!collapsed && (
        <div style={{ padding: compact ? "0 14px 14px" : "0 18px 18px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={expandAll}
              style={{ fontSize: 11, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              {t("expandAll", "Expandir todo")}
            </button>
            <button
              type="button"
              onClick={collapseAll}
              style={{ fontSize: 11, color: "var(--t3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              {t("collapseAll", "Colapsar todo")}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((step, i) => (
              <StepItem
                key={i}
                step={step}
                index={i}
                isOpen={expandedSteps.has(i)}
                onToggle={() => toggleStep(i)}
              />
            ))}
          </div>

          {platform === "universal" && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(59,130,246,0.06)",
                border: "1px solid rgba(59,130,246,0.12)",
              }}
            >
              <p style={{ fontSize: 12, fontFamily: "var(--fb)", color: "var(--t2)", marginBottom: 6 }}>
                {t("universal.whatWeAnalyze", "¿Qué analizamos?")}
              </p>
              <ul style={{ fontSize: 11, color: "var(--t3)", margin: 0, paddingLeft: 16, lineHeight: 1.7 }}>
                <li>{t("universal.analyze1", "Estructura y navegación del sitio web")}</li>
                <li>{t("universal.analyze2", "SEO técnico: meta tags, schema, sitemap, robots.txt")}</li>
                <li>{t("universal.analyze3", "Velocidad de carga y Core Web Vitals")}</li>
                <li>{t("universal.analyze4", "Calidad del contenido y copywriting")}</li>
                <li>{t("universal.analyze5", "Presencia en redes sociales")}</li>
                <li>{t("universal.analyze6", "Oportunidades de mejora y recomendaciones")}</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConnectionGuideTabs() {
  const [activePlatform, setActivePlatform] = useState<PlatformType>("shopify");

  const platforms: Array<{ key: PlatformType; label: string; color: string; icon: any }> = [
    { key: "shopify", label: "Shopify", color: "#95bf47", icon: ShoppingBag },
    { key: "woocommerce", label: "WooCommerce", color: "#7f54b3", icon: Globe },
    { key: "prestashop", label: "PrestaShop", color: "#df0067", icon: Store },
    { key: "universal", label: "Auditoría", color: "#888", icon: Globe },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {platforms.map(p => {
          const Icon = p.icon;
          return (
            <button
              key={p.key}
              onClick={() => setActivePlatform(p.key)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1.5px solid ${activePlatform === p.key ? p.color : "var(--bdr)"}`,
                background: activePlatform === p.key ? `${p.color}18` : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <Icon size={14} style={{ color: activePlatform === p.key ? p.color : "var(--t3)" }} />
              <span style={{ fontSize: 12, fontFamily: "var(--fb)", color: activePlatform === p.key ? p.color : "var(--t2)" }}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      <ConnectionGuide platform={activePlatform} defaultExpanded={true} />
    </div>
  );
}
