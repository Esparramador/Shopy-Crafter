import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { shopifyRequest } from "../lib/shopify.js";

const router = Router();

function generateMetaTitle(title: string): string {
  let clean = title.replace(/\s*[|—–]\s*Comic Crafter.*$/i, "").trim();
  if (clean.length > 55) clean = clean.slice(0, 52) + "...";
  const result = clean.length > 45 ? clean : `${clean} | Comic Crafter`;
  return result.slice(0, 60);
}

function generateMetaDescription(title: string, price: string, bodyHtml: string): string {
  const plainText = (bodyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const firstSentence = plainText.split(/[.!]/).filter(s => s.trim().length > 20)[0]?.trim() || "";
  const benefit = firstSentence.slice(0, 80);
  const priceText = parseFloat(price) > 0 ? ` Desde ${price}€.` : "";
  const cta = " Personalizado con IA. Pide el tuyo hoy.";
  let desc = benefit + "." + priceText + cta;
  if (desc.length > 155) desc = desc.slice(0, 152) + "...";
  if (desc.length < 130) desc = `${benefit}. ${title.slice(0, 40)}.${priceText} Encárgalo ahora con IA profesional.`;
  return desc.slice(0, 155);
}

function mapToShopifyTaxonomy(productType: string, title: string): string {
  const lower = (productType + " " + title).toLowerCase();

  if (/shopybrain|shopy.*crafter.*pro|shopy.*crafter.*—/i.test(lower)) return "Software > Computer Software > Business & Productivity Software";
  if (/crédito|pack.*crédito|narrador\s|ilustrador\s|creador\s|director\s|estudio\s/i.test(lower)) return "Software > Computer Software > Business & Productivity Software";

  if (/auditoría|auditoria|seo.*shopify|optimización|performance.*lab|growth.*studio/i.test(lower)) return "Business & Industrial > Business Services > Consulting Services";
  if (/informe|análisis|pricing|márgenes|competidores|proyección|forecast/i.test(lower)) return "Business & Industrial > Business Services > Consulting Services";
  if (/investigación.*proveedores|sourcing/i.test(lower)) return "Business & Industrial > Business Services > Consulting Services";
  if (/sesión.*estratégica|consultoría/i.test(lower)) return "Business & Industrial > Business Services > Consulting Services";
  if (/email.*marketing|klaviyo|setup.*email/i.test(lower)) return "Business & Industrial > Advertising & Marketing > Email Marketing";
  if (/rediseño.*producto|creación.*producto|pack.*producto|catálogo/i.test(lower)) return "Business & Industrial > Business Services > Consulting Services";
  if (/imágenes.*ia.*profesional|photoshoot|foto.*producto|pack.*30.*imág/i.test(lower)) return "Business & Industrial > Advertising & Marketing > Photography & Videography Services";
  if (/post.*ia.*profesional|redes.*sociales|contenido.*redes/i.test(lower)) return "Business & Industrial > Advertising & Marketing > Social Media Management";

  if (/logo|branding|identidad.*visual|pack.*branding/i.test(lower)) return "Business & Industrial > Advertising & Marketing > Brand Management";

  if (/cómic|comic|manga|cuento|saga|storyboard|audiobook|narración|portada.*libro/i.test(lower)) {
    if (/audiobook|narración.*inmer|voces.*ia/i.test(lower)) return "Media > Music & Sound Recordings > Music Albums & EPs";
    if (/manga/i.test(lower)) return "Media > Books > Fiction Books";
    if (/cuento.*infantil|tu.*hij/i.test(lower)) return "Media > Books > Children's Books";
    if (/storyboard/i.test(lower)) return "Media > Books > Non-Fiction Books";
    if (/portada/i.test(lower)) return "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Craft Kits";
    if (/boda/i.test(lower)) return "Arts & Entertainment > Party & Celebration > Gift Giving > Gift Cards & Certificates";
    if (/pet.*comic|mascota/i.test(lower)) return "Media > Books > Fiction Books";
    if (/album.*foto/i.test(lower)) return "Media > Books > Non-Fiction Books";
    return "Media > Books > Fiction Books";
  }

  if (/funko|figura|3d.*resina|modelo.*3d|personaje.*360|modelos.*3d/i.test(lower)) {
    if (/funko/i.test(lower)) return "Toys & Games > Toys > Dolls, Playsets & Toy Figures > Action & Toy Figures";
    return "Arts & Entertainment > Hobbies & Creative Arts > Collectibles > Figurines";
  }

  if (/carta.*tcg|pokemon|coleccionable.*carta/i.test(lower)) return "Toys & Games > Games > Card Games > Collectible Card Games";
  if (/tatuaje|tattoo/i.test(lower)) return "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Art & Craft Kits";
  if (/nft/i.test(lower)) return "Arts & Entertainment > Hobbies & Creative Arts > Collectibles > Autographs";
  if (/poster|lienzo|canvas|póster/i.test(lower)) return "Home & Garden > Decor > Artwork > Posters, Prints & Visual Artwork";
  if (/retrato.*pop.*art/i.test(lower)) return "Home & Garden > Decor > Artwork > Posters, Prints & Visual Artwork";
  if (/emoji|sticker/i.test(lower)) return "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Craft Supplies";
  if (/merchandising|camiseta|taza/i.test(lower)) return "Apparel & Accessories > Clothing";
  if (/escape.*room/i.test(lower)) return "Arts & Entertainment > Entertainment > Games & Puzzles";
  if (/asset.*videojuego|game.*ready/i.test(lower)) return "Software > Computer Software > Multimedia & Design Software";

  return "Business & Industrial > Business Services";
}

function generateMetafields(productType: string, title: string, price: string): Array<{ namespace: string; key: string; value: string; type: string }> {
  const lower = (productType + " " + title).toLowerCase();
  const mfs: Array<{ namespace: string; key: string; value: string; type: string }> = [];

  const isDigital = /digital|ia|ai|3d|seo|audit|informe|servicio|crédito|pack|plataforma|shopybrain|email|post/i.test(lower);
  const isComic = /cómic|comic|manga|cuento|storyboard|audiobook|saga/i.test(lower);
  const isArt = /arte|poster|póster|lienzo|retrato|tatuaje|nft|logo|branding|album|emoji|sticker/i.test(lower);
  const is3D = /funko|figura|3d|resina|modelo/i.test(lower);
  const isService = /auditoría|informe|sesión|rediseño|creación.*producto|pack.*producto|email.*marketing|photoshoot|optimización|growth|performance/i.test(lower);
  const isPlatform = /shopybrain|shopy.*crafter.*pro|plataforma/i.test(lower);
  const isCredits = /crédito|pack.*crédito|narrador|ilustrador|creador|director|estudio/i.test(lower);

  mfs.push({ namespace: "custom", key: "delivery_format", value: isDigital ? "Digital — Entrega por email/descarga" : "Producto físico con envío", type: "single_line_text_field" });

  if (isDigital) {
    mfs.push({ namespace: "custom", key: "delivery_time", value: isService ? "3-5 días laborables" : isComic ? "24-72 horas" : "Acceso inmediato", type: "single_line_text_field" });
  }

  mfs.push({ namespace: "custom", key: "language", value: "Español", type: "single_line_text_field" });

  if (isComic) {
    mfs.push({ namespace: "custom", key: "material", value: "Ilustración digital profesional generada con IA", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "file_format", value: "PDF alta resolución + PNG sin fondo", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "customization_level", value: "100% personalizado — tu historia, personajes y estilo", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "revision_policy", value: "2 rondas de revisiones incluidas", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "target_audience", value: "Amantes del cómic, regalos originales, coleccionistas", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "tools_used", value: "Inteligencia Artificial generativa + dirección artística humana", type: "single_line_text_field" });
  } else if (isArt) {
    mfs.push({ namespace: "custom", key: "material", value: "Arte digital de alta resolución", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "file_format", value: "PNG 4K + PDF imprimible", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "customization_level", value: "Totalmente personalizable", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "target_audience", value: "Artistas, creadores, coleccionistas", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "tools_used", value: "IA generativa profesional (GPT Image-1, Stable Diffusion)", type: "single_line_text_field" });
  } else if (is3D) {
    mfs.push({ namespace: "custom", key: "material", value: "Modelado 3D digital + impresión en resina premium", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "file_format", value: "STL + OBJ + FBX + renders PNG", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "customization_level", value: "100% personalizado desde tu foto", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "target_audience", value: "Coleccionistas, gamers, regalos únicos", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "tools_used", value: "Blender + ZBrush + IA 3D", type: "single_line_text_field" });
  } else if (isService) {
    mfs.push({ namespace: "custom", key: "material", value: "Informe/servicio profesional digital", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "file_format", value: "PDF profesional + presentación ejecutiva", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "target_audience", value: "Propietarios de tiendas online, eCommerce managers", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "tools_used", value: "IA avanzada + análisis experto Shopify", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "includes", value: "Análisis completo + recomendaciones + plan de acción", type: "multi_line_text_field" });
  } else if (isPlatform || isCredits) {
    mfs.push({ namespace: "custom", key: "material", value: "Plataforma SaaS / créditos digitales", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "target_audience", value: "Emprendedores, artistas digitales, tiendas Shopify", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "tools_used", value: "Plataforma Comic Crafter con IA integrada", type: "single_line_text_field" });
    mfs.push({ namespace: "custom", key: "customization_level", value: "Uso flexible — tú decides qué crear", type: "single_line_text_field" });
  }

  return mfs;
}

router.get("/projects/:projectId/product-ids", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId as string);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  let allProducts: Array<{ id: number; title: string }> = [];
  const data = await shopifyRequest<{ products: Array<{ id: number; title: string }> }>(
    projectId, project.shopDomain,
    `/products.json?limit=250&fields=id,title&status=active`
  );
  if (data?.products) allProducts = data.products;

  res.json({ total: allProducts.length, products: allProducts.map(p => ({ id: String(p.id), title: p.title })) });
});

router.post("/projects/:projectId/enrich-batch", async (req, res): Promise<void> => {
  const projectId = parseInt(req.params.projectId as string);
  const { productIds } = req.body as { productIds: string[] };

  if (!productIds || !productIds.length) { res.status(400).json({ error: "productIds required" }); return; }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const results: Array<{ id: string; title: string; status: string; category?: string; meta_title?: string; metafields?: number }> = [];

  for (const pid of productIds) {
    try {
      const data = await shopifyRequest<{ product: Record<string, unknown> }>(
        projectId, project.shopDomain,
        `/products/${pid}.json?fields=id,title,product_type,body_html,tags,variants,images`
      );
      const p = data.product;
      const title = p.title as string;
      const productType = (p.product_type as string) || "";
      const bodyHtml = (p.body_html as string) || "";
      const variants = (p.variants as Array<Record<string, unknown>>) || [];
      const price = (variants[0]?.price as string) || "0";

      const metaTitle = generateMetaTitle(title);
      const metaDescription = generateMetaDescription(title, price, bodyHtml);
      const category = mapToShopifyTaxonomy(productType, title);
      const metafields = generateMetafields(productType, title, price);

      const updatePayload: Record<string, unknown> = {
        id: parseInt(pid),
        metafields_global_title_tag: metaTitle,
        metafields_global_description_tag: metaDescription,
        product_type: category,
      };

      if (variants.length > 0) {
        updatePayload.variants = variants.map((v) => ({
          id: v.id,
          inventory_management: null,
        }));
      }

      await shopifyRequest(projectId, project.shopDomain, `/products/${pid}.json`, {
        method: "PUT",
        body: JSON.stringify({ product: updatePayload }),
      });

      let mfCount = 0;
      for (const mf of metafields) {
        try {
          await shopifyRequest(projectId, project.shopDomain, `/products/${pid}/metafields.json`, {
            method: "POST",
            body: JSON.stringify({
              metafield: { namespace: mf.namespace, key: mf.key, value: mf.value, type: mf.type },
            }),
          });
          mfCount++;
        } catch {
          try {
            const existing = await shopifyRequest<{ metafields: Array<{ id: number; namespace: string; key: string }> }>(
              projectId, project.shopDomain, `/products/${pid}/metafields.json`
            );
            const match = existing?.metafields?.find(m => m.namespace === mf.namespace && m.key === mf.key);
            if (match) {
              await shopifyRequest(projectId, project.shopDomain, `/products/${pid}/metafields/${match.id}.json`, {
                method: "PUT",
                body: JSON.stringify({ metafield: { id: match.id, value: mf.value, type: mf.type } }),
              });
              mfCount++;
            }
          } catch {}
        }
      }

      results.push({ id: pid, title: title.slice(0, 60), status: "OK", category, meta_title: metaTitle, metafields: mfCount });
    } catch (err: unknown) {
      results.push({ id: pid, title: "?", status: `ERROR: ${(err instanceof Error ? err.message : "unknown").slice(0, 100)}` });
    }
  }

  const ok = results.filter(r => r.status === "OK").length;
  const totalMf = results.reduce((s, r) => s + (r.metafields || 0), 0);

  res.json({
    success: true,
    message: `${ok}/${productIds.length} products enriched. ${totalMf} metafields set.`,
    results,
  });
});

export default router;
