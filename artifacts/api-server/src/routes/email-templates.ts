import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { logger } from "../lib/logger.js";
import { askClaudeWithBrain, askClaudeJsonWithBrain, learnFromOperation } from "../lib/claude.js";

const router = Router();
router.use(requireAdmin);

const TEMPLATE_TYPES: Record<string, { label: string; category: string; description: string }> = {
  "welcome-client": { label: "Bienvenida Cliente", category: "agency", description: "Email de bienvenida al incorporar un nuevo cliente a la agencia" },
  "invite-client": { label: "Invitación Cliente", category: "agency", description: "Invitación profesional para que un nuevo cliente acceda al portal" },
  "onboarding-steps": { label: "Pasos Onboarding", category: "agency", description: "Guía paso a paso del proceso de onboarding" },
  "monthly-report": { label: "Informe Mensual", category: "agency", description: "Resumen mensual de rendimiento y métricas" },
  "proposal-sent": { label: "Propuesta Enviada", category: "agency", description: "Notificación de nueva propuesta de servicios" },
  "invoice-sent": { label: "Factura Enviada", category: "agency", description: "Notificación de nueva factura" },
  "project-update": { label: "Actualización Proyecto", category: "agency", description: "Notificación de progreso del proyecto" },
  "approval-request": { label: "Solicitud Aprobación", category: "agency", description: "Solicita aprobación del cliente para cambios" },
  "checkout-abandoned": { label: "Carrito Abandonado", category: "ecommerce", description: "Recupera ventas de carritos abandonados" },
  "order-confirmation": { label: "Confirmación Pedido", category: "ecommerce", description: "Confirmación profesional de pedido" },
  "post-purchase": { label: "Post-Compra", category: "ecommerce", description: "Seguimiento después de la compra" },
  "review-request": { label: "Solicitar Reseña", category: "ecommerce", description: "Pide una reseña al cliente satisfecho" },
  "win-back": { label: "Reactivación", category: "ecommerce", description: "Recupera clientes inactivos" },
  "vip-exclusive": { label: "VIP / Exclusivo", category: "ecommerce", description: "Ofertas exclusivas para mejores clientes" },
  "product-launch": { label: "Lanzamiento Producto", category: "ecommerce", description: "Anuncio de nuevo producto" },
  "flash-sale": { label: "Venta Flash", category: "ecommerce", description: "Oferta limitada con urgencia" },
  "back-in-stock": { label: "De Vuelta en Stock", category: "ecommerce", description: "Aviso de disponibilidad" },
  "price-drop": { label: "Bajada de Precio", category: "ecommerce", description: "Notificación de descuento" },
  "shipping-update": { label: "Actualización Envío", category: "transactional", description: "Estado del envío en tiempo real" },
  "password-reset": { label: "Reset Contraseña", category: "transactional", description: "Recuperación de contraseña segura" },
  "account-created": { label: "Cuenta Creada", category: "transactional", description: "Confirmación de registro de cuenta" },
  "subscription-renewal": { label: "Renovación Suscripción", category: "transactional", description: "Recordatorio de renovación" },
  "seasonal-campaign": { label: "Campaña Estacional", category: "campaign", description: "Black Friday, Navidad, San Valentín..." },
  "newsletter": { label: "Newsletter", category: "campaign", description: "Boletín informativo periódico" },
  "referral-program": { label: "Programa Referidos", category: "campaign", description: "Invita amigos y gana recompensas" },
  "loyalty-reward": { label: "Recompensa Fidelidad", category: "campaign", description: "Premio por fidelidad del cliente" },
};

router.get("/email-templates/types", (_req, res) => {
  res.json(TEMPLATE_TYPES);
});

router.get("/email-templates", async (req, res): Promise<void> => {
  try {
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const category = req.query.category as string | undefined;
    let query = "SELECT * FROM email_templates";
    const conditions: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (projectId) { conditions.push(`project_id = $${i++}`); params.push(projectId); }
    if (category) { conditions.push(`category = $${i++}`); params.push(category); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY is_favorite DESC, updated_at DESC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/email-templates/:id", async (req, res): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT * FROM email_templates WHERE id = $1", [req.params.id]);
    if (!rows.length) { res.status(404).json({ error: "Template not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/email-templates", async (req, res): Promise<void> => {
  const {
    project_id, name, template_type, category = "agency",
    subject_a, subject_b, preview_text, html_content, text_content,
    tone = "profesional", language = "es",
    brand_name, brand_logo_url, brand_colors, brand_tagline,
    variables_used, from_email, from_name, reply_email,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO email_templates 
        (project_id, name, template_type, category, subject_a, subject_b, preview_text,
         html_content, text_content, tone, language, brand_name, brand_logo_url,
         brand_colors, brand_tagline, variables_used, from_email, from_name, reply_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [project_id, name, template_type, category, subject_a, subject_b, preview_text,
        html_content, text_content, tone, language, brand_name, brand_logo_url,
        brand_colors ? JSON.stringify(brand_colors) : "{}", brand_tagline,
        variables_used, from_email, from_name, reply_email]
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/email-templates/:id", async (req, res): Promise<void> => {
  const fields = [
    "name", "template_type", "category", "subject_a", "subject_b", "preview_text",
    "html_content", "text_content", "tone", "language", "brand_name", "brand_logo_url",
    "brand_tagline", "variables_used", "from_email", "from_name", "reply_email", "is_favorite",
  ];
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${i}`);
      values.push(req.body[f]);
      i++;
    }
  }
  if (req.body.brand_colors !== undefined) {
    updates.push(`brand_colors = $${i}`);
    values.push(JSON.stringify(req.body.brand_colors));
    i++;
  }
  if (!updates.length) { res.status(400).json({ error: "No fields to update" }); return; }
  updates.push(`updated_at = NOW()`);
  updates.push(`version = version + 1`);
  values.push(req.params.id);

  try {
    const { rows } = await pool.query(
      `UPDATE email_templates SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/email-templates/:id", async (req, res): Promise<void> => {
  try {
    await pool.query("DELETE FROM email_templates WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/email-templates/generate", async (req, res): Promise<void> => {
  const {
    templateType, projectId, tone = "profesional", language = "es",
    brandName, brandLogoUrl, brandTagline, brandColors,
    customInstructions,
  } = req.body;

  if (!templateType) { res.status(400).json({ error: "templateType requerido" }); return; }
  if (!projectId) { res.status(400).json({ error: "projectId requerido — selecciona un proyecto" }); return; }

  try {
    const { rows } = await pool.query(
      "SELECT name, shop_domain, store_niche, brand_tone FROM projects WHERE id = $1",
      [projectId]
    );
    if (!rows.length) { res.status(404).json({ error: "Proyecto no encontrado" }); return; }

    const project = rows[0];
    const realStoreName = project.name;
    const realDomain = project.shop_domain || "";
    const realNiche = project.store_niche || "ecommerce";
    const realBrandTone = project.brand_tone || "";

    const effectiveBrandName = brandName || realStoreName;

    let visualDna = "";
    const { rows: dnaRows } = await pool.query(
      "SELECT background_style, lighting_style, mood, brand_colors, color_temp FROM visual_dna WHERE project_id = $1 LIMIT 1",
      [projectId]
    );
    if (dnaRows.length) {
      const d = dnaRows[0];
      const parts: string[] = [];
      if (d.mood) parts.push(`Mood: ${d.mood}`);
      if (d.brand_colors?.length) parts.push(`Colores: ${d.brand_colors.join(", ")}`);
      if (d.color_temp) parts.push(`Temperatura: ${d.color_temp}`);
      if (d.lighting_style) parts.push(`Iluminación: ${d.lighting_style}`);
      visualDna = parts.join(" · ");
    }

    let topProducts = "";
    try {
      const { rows: prodRows } = await pool.query(
        `SELECT title, product_type, vendor FROM products WHERE project_id = $1 ORDER BY id LIMIT 5`,
        [projectId]
      );
      if (prodRows.length) {
        topProducts = prodRows.map((p: any) => `${p.title}${p.product_type ? ` (${p.product_type})` : ""}`).join(", ");
      }
    } catch {}

    const typeMeta = TEMPLATE_TYPES[templateType];
    const typeName = typeMeta?.label || templateType;
    const typeDesc = typeMeta?.description || "";

    const systemPrompt = `Eres ShopyBrain, el copywriter de email más cotizado del mundo. Combinas la precisión de David Ogilvy con la creatividad de Apple y la conversión de Amazon.

REGLAS INQUEBRANTABLES:
1. SIEMPRE escribes copy que suena humano, nunca robótico ni genérico
2. Cada frase tiene un propósito: informar, emocionar o convertir
3. El diseño visual es tan importante como el copy — eres diseñador + redactor
4. NUNCA inventes datos, nombres de marca, URLs, productos, o información que no se te haya proporcionado
5. El email DEBE funcionar perfectamente en todos los clientes de email (Gmail, Outlook, Apple Mail)
6. El HTML usa SOLO tablas para layout — NUNCA flexbox ni grid
7. TODOS los estilos son inline — los email clients ignoran <style> tags
8. Máximo 600px de ancho para el contenido principal

⚠️ REGLA CRÍTICA DE IDENTIDAD DE MARCA ⚠️
Este email es EXCLUSIVAMENTE para la marca "${effectiveBrandName}".
- El nombre de la empresa que aparece en TODOS los textos, header, footer, alt-texts y subjects DEBE ser "${effectiveBrandName}" — NUNCA otro nombre.
- Si el negocio es "${realNiche}", el copy debe reflejar ESE nicho exacto, no otro genérico.
- ${realDomain ? `El dominio real es "${realDomain}" — NUNCA uses otro dominio ni URLs inventadas.` : "No uses dominios inventados."}
- ${realBrandTone ? `El tono de voz de esta marca es: "${realBrandTone}" — respeta este tono en TODO el copy.` : ""}
- NUNCA uses nombres como "Tu Tienda", "Mi Marca", "Acme", "Store Name", "Your Brand" ni NINGÚN placeholder genérico. Siempre "${effectiveBrandName}".
- Cuando uses {{ store_name }}, su valor real será "${effectiveBrandName}".`;

    const brandBlock = [
      `EMPRESA/MARCA: ${effectiveBrandName}`,
      `NOMBRE REAL DE LA TIENDA: ${realStoreName}`,
      `NICHO: ${realNiche}`,
      realBrandTone ? `TONO DE MARCA: ${realBrandTone}` : null,
      realDomain ? `DOMINIO SHOPIFY: ${realDomain}` : null,
      brandTagline ? `TAGLINE: ${brandTagline}` : null,
      brandLogoUrl ? `LOGO URL: ${brandLogoUrl}` : null,
      brandColors ? `COLORES MARCA: principal=${brandColors.primary || "#c8a84b"}, acento=${brandColors.accent || "#2dd49f"}, oscuro=${brandColors.dark || "#0a0a0f"}, claro=${brandColors.light || "#f0eefc"}` : null,
      visualDna ? `DNA VISUAL: ${visualDna}` : null,
      topProducts ? `PRODUCTOS DE LA TIENDA (reales): ${topProducts}` : null,
    ].filter(Boolean).join("\n");

    const userPrompt = `Genera un email HTML COMPLETO y PROFESIONAL para "${effectiveBrandName}" (${realNiche}).
Todo el contenido DEBE ser específico para esta marca. No uses nombres genéricos.

TIPO DE PLANTILLA: ${typeName}
DESCRIPCIÓN: ${typeDesc}
TONO: ${tone}
IDIOMA: ${language === "es" ? "Español" : "English"}

${brandBlock}

${customInstructions ? `INSTRUCCIONES ADICIONALES DEL USUARIO:\n${customInstructions}\n` : ""}

DISEÑO VISUAL OBLIGATORIO:
- Fondo exterior: ${brandColors?.dark || "#0a0a0f"}
- Fondo email: #13131f
- Header: gradiente o sólido usando colores de marca (${brandColors?.primary || "#c8a84b"} como acento principal)
- Texto principal: ${brandColors?.light || "#f0eefc"}
- Texto secundario: #9d9db8
- Links: ${brandColors?.accent || "#c8a84b"}
- Botón CTA principal: fondo ${brandColors?.primary || "#c8a84b"}, texto #060400, padding 16px 36px, border-radius 8px, font-weight bold, font-size 16px
- Botón CTA secundario (si aplica): borde 2px solid ${brandColors?.primary || "#c8a84b"}, fondo transparente, texto ${brandColors?.primary || "#c8a84b"}
- Font: Arial, Helvetica, sans-serif (seguro para email)
- Separadores: líneas sutiles #1e1e2e
- Iconos: usa emojis Unicode para iconos (✓ ✉ ⭐ 🎁 etc.)
${brandLogoUrl ? `- INCLUIR LOGO: <img src="${brandLogoUrl}" alt="${effectiveBrandName}" style="max-height:48px;"> en el header` : `- Header: mostrar "${effectiveBrandName}" como texto grande con estilo premium`}

ESTRUCTURA DEL EMAIL:
1. PREHEADER invisible (texto preview para inbox) — mencionando "${effectiveBrandName}"
2. HEADER con ${brandLogoUrl ? "logo" : `"${effectiveBrandName}" en texto estilizado`}
3. HERO — titular impactante relevante al nicho ${realNiche} y tono ${tone}
4. CUERPO — contenido principal adaptado al tipo ${typeName}, con referencias reales al negocio
5. CTA PRINCIPAL — botón grande, centrado, con microcopy debajo
6. SOCIAL PROOF / TRUST — si aplica, adaptado al nicho ${realNiche}
7. FOOTER — con "${effectiveBrandName}", links legales, redes sociales, dirección, unsubscribe

VARIABLES DISPONIBLES (usa las que apliquen al tipo):
- {{ first_name }} — nombre del destinatario
- {{ store_name }} — nombre de la tienda (valor real = "${effectiveBrandName}")
- {{ product_title }} — nombre del producto
- {{ product_image_url }} — imagen del producto  
- {{ product_url }} — link al producto
- {{ checkout_url }} — link al carrito/checkout
- {{ discount_code }} — código de descuento
- {{ order_number }} — número de pedido
- {{ tracking_url }} — link de seguimiento
- {{ unsubscribe_url }} — link para desuscribirse
- {{ company_address }} — dirección legal
- {{ current_year }} — año actual

Devuelve SOLO este JSON (nada más):
{
  "subject_a": "asunto variante A — máx 55 chars, con marca ${effectiveBrandName}",
  "subject_b": "asunto variante B con {{ first_name }} — personalizado para ${effectiveBrandName}",
  "preview_text": "texto preview para inbox — máx 100 chars — específico de ${effectiveBrandName}",
  "html": "HTML COMPLETO del email con TODA referencia a ${effectiveBrandName} (DOCTYPE html, head, body con tablas, inline CSS, RESPONSIVE)",
  "text": "versión texto plano profesional mencionando ${effectiveBrandName}",
  "variables_used": ["lista", "de", "variables", "klaviyo", "usadas"],
  "copywriting_notes": "estrategia de copy específica para ${effectiveBrandName} y su nicho ${realNiche}"
}`;

    const result = await askClaudeJsonWithBrain<{
      subject_a: string;
      subject_b: string;
      preview_text: string;
      html: string;
      text: string;
      variables_used: string[];
      copywriting_notes: string;
    }>(
      projectId || 0,
      userPrompt,
      systemPrompt,
      "general",
      projectInfo.niche,
      8000
    );

    learnFromOperation({
      operationType: "email_template",
      niche: projectInfo.niche,
      title: `Email Template: ${typeName} para ${projectInfo.name}`,
      content: `Plantilla: ${typeName} | Tono: ${tone} | Marca: ${projectInfo.name} | Subject A: ${result.subject_a ?? ""}`,
      confidence: 0.75,
      tags: ["email", "template", templateType, tone, projectInfo.niche],
    });

    res.json(result);
  } catch (err: any) {
    logger.error("Email template generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/email-templates/:id/push-klaviyo", async (req, res): Promise<void> => {
  const tmplId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT et.*, p.name as project_name 
       FROM email_templates et 
       LEFT JOIN projects p ON p.id = et.project_id 
       WHERE et.id = $1`,
      [tmplId]
    );
    if (!rows.length) { res.status(404).json({ error: "Template not found" }); return; }
    const tmpl = rows[0];

    if (!tmpl.html_content) { res.status(400).json({ error: "Genera el contenido del email primero" }); return; }

    const key = process.env.KLAVIYO_API_KEY;
    if (!key) { res.status(400).json({ error: "KLAVIYO_API_KEY no configurada" }); return; }

    const templateName = `[${tmpl.project_name || "ShopyBrain"}] ${tmpl.name}`;

    const klaviyoRes = await fetch("https://a.klaviyo.com/api/templates/", {
      method: "POST",
      headers: {
        "Authorization": `Klaviyo-API-Key ${key}`,
        "Content-Type": "application/json",
        "revision": "2024-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "template",
          attributes: {
            name: templateName,
            editor_type: "CODE",
            html: tmpl.html_content,
            text: tmpl.text_content || "",
          },
        },
      }),
    });

    if (!klaviyoRes.ok) {
      const err = await klaviyoRes.text();
      throw new Error(`Klaviyo ${klaviyoRes.status}: ${err}`);
    }

    const data = await klaviyoRes.json() as any;
    const klaviyoTemplateId = data.data?.id;

    await pool.query(
      `UPDATE email_templates 
       SET klaviyo_template_id = $1, klaviyo_status = 'live', 
           klaviyo_error = NULL, pushed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [klaviyoTemplateId, tmplId]
    );

    res.json({ success: true, klaviyoTemplateId });
  } catch (err: any) {
    logger.error("Push template to Klaviyo error:", err.message);
    await pool.query(
      `UPDATE email_templates SET klaviyo_status = 'error', klaviyo_error = $1 WHERE id = $2`,
      [err.message, tmplId]
    );
    res.status(500).json({ error: err.message });
  }
});

router.post("/email-templates/:id/duplicate", async (req, res): Promise<void> => {
  try {
    const { rows } = await pool.query("SELECT * FROM email_templates WHERE id = $1", [req.params.id]);
    if (!rows.length) { res.status(404).json({ error: "Template not found" }); return; }
    const src = rows[0];

    const { rows: dup } = await pool.query(
      `INSERT INTO email_templates 
        (project_id, name, template_type, category, subject_a, subject_b, preview_text,
         html_content, text_content, tone, language, brand_name, brand_logo_url,
         brand_colors, brand_tagline, variables_used, from_email, from_name, reply_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [src.project_id, `${src.name} (copia)`, src.template_type, src.category,
        src.subject_a, src.subject_b, src.preview_text, src.html_content, src.text_content,
        src.tone, src.language, src.brand_name, src.brand_logo_url,
        JSON.stringify(src.brand_colors || {}), src.brand_tagline,
        src.variables_used, src.from_email, src.from_name, src.reply_email]
    );
    res.json(dup[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
