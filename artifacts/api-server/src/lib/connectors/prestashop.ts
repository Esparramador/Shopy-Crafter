import type { Project } from "@workspace/db";
import { safeDecrypt } from "../crypto.js";
import { learnFromOperation } from "../claude.js";
import { saveToVault } from "../vault.js";
import type {
  IPlatformConnector,
  ConnectionTestResult,
  PlatformProduct,
  PlatformOrder,
  SeoData,
  InventoryData,
  PagedResult,
  PlatformFeature,
} from "./types";
import {
  buildProductXml,
  buildStockXml,
  buildCombinationXml,
  extractDefaultLang,
  type PrestaShopProductXml,
} from "./prestashop-xml";

export class PrestaShopConnector implements IPlatformConnector {
  readonly platformType = "prestashop" as const;
  readonly projectId: number;
  readonly storeDomain: string;
  private readonly project: Project;
  private defaultLangId: number = 1;

  constructor(project: Project) {
    this.project = project;
    this.projectId = project.id;
    this.storeDomain = project.shopDomain.replace(/\/+$/, "");
  }

  private get apiKey(): string {
    return safeDecrypt(this.project.clientSecret) || this.project.clientSecret;
  }

  private get baseUrl(): string {
    // FIX F-16: forzar HTTPS siempre (rechazar HTTP plano)
    const cleanDomain = this.storeDomain
      .replace(/\/api\/?$/, "")
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    return `https://${cleanDomain}/api`;
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`;
  }

  supportsFeature(feature: PlatformFeature): boolean {
    const supported: PlatformFeature[] = [
      "products",
      "product_create",
      "product_update",
      "product_delete",
      "variants",
      "images",
      "image_upload_file",
      "seo_read",
      "seo_write",
      "orders",
      "inventory",
    ];
    return supported.includes(feature);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const root = await this.apiGet<{ api: Record<string, unknown> }>("/");
      const resources = root.api ? Object.keys(root.api) : [];

      const requiredResources = ["products", "categories", "images", "stock_availables"];
      const missing = requiredResources.filter((r) => !resources.includes(r));
      if (missing.length > 0) {
        return {
          connected: false,
          storeName: null,
          platformInfo: null,
          productCount: null,
          tokenValid: false,
          error: `Permisos insuficientes. Recursos no accesibles: ${missing.join(", ")}. Activa estos permisos en Parámetros Avanzados → Webservice.`,
          errorCode: "PERMISSIONS_INSUFFICIENT",
        };
      }

      const permissionIssues: string[] = [];

      let productCount: number | null = null;
      try {
        const products = await this.apiGet<{ products?: unknown[] }>("/products");
        productCount = Array.isArray(products.products) ? products.products.length : null;
      } catch (e) {
        permissionIssues.push("products (lectura)");
      }

      try {
        await this.apiGet<unknown>("/categories");
      } catch {
        permissionIssues.push("categories (lectura)");
      }

      try {
        await this.apiGet<unknown>("/stock_availables");
      } catch {
        permissionIssues.push("stock_availables (lectura)");
      }

      try {
        const schemaUrl = `${this.baseUrl}/products?schema=blank`;
        const schemaRes = await fetch(schemaUrl, {
          headers: { Authorization: this.authHeader },
        });
        if (!schemaRes.ok && schemaRes.status === 405) {
          permissionIssues.push("products (escritura — HEAD/schema)");
        }
      } catch {
        permissionIssues.push("products (esquema escritura)");
      }

      if (permissionIssues.length > 0) {
        return {
          connected: false,
          storeName: null,
          platformInfo: null,
          productCount: null,
          tokenValid: true,
          error: `API Key conecta pero faltan permisos para: ${permissionIssues.join(", ")}. Activa permisos GET/PUT/POST en Parámetros Avanzados → Webservice.`,
          errorCode: "PERMISSIONS_INSUFFICIENT",
        };
      }

      let storeName: string | null = null;
      let version: string | null = null;
      try {
        const configs = await this.apiGet<{
          configurations?: Array<{ id: number; name: string; value: string }>;
        }>("/configurations?filter[name]=PS_SHOP_NAME");
        if (configs.configurations?.[0]?.value) {
          storeName = configs.configurations[0].value;
        }
      } catch {
        storeName = this.storeDomain;
      }

      try {
        const versionCfg = await this.apiGet<{
          configurations?: Array<{ id: number; name: string; value: string }>;
        }>("/configurations?filter[name]=PS_VERSION_DB");
        if (versionCfg.configurations?.[0]?.value) {
          version = versionCfg.configurations[0].value;
        }
      } catch {
        version = null;
      }

      await this.detectDefaultLanguage();

      learnFromOperation({
        operationType: "product_optimization",
        title: `PrestaShop connection established: ${this.storeDomain}`,
        content: `Conexión exitosa a PrestaShop ${version ?? "desconocida"} en ${this.storeDomain}. Recursos disponibles: ${resources.join(", ")}. Idioma predeterminado: ${this.defaultLangId}. Productos: ${productCount ?? "N/A"}. Patrón: HTTP Basic Auth con API key como usuario, output_format=JSON para lecturas, XML para escrituras. PrestaShop PUT requiere recurso completo (fetch+merge).`,
        confidence: 0.9,
        tags: ["prestashop", "connection_pattern", "api_quirks"],
      });

      return {
        connected: true,
        storeName: storeName ?? this.storeDomain,
        platformInfo: `PrestaShop ${version ?? ""}`.trim(),
        productCount,
        tokenValid: true,
        error: null,
        resources,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      let errorCode = "UNKNOWN";
      if (message.includes("401")) errorCode = "AUTH_FAILED";
      else if (message.includes("403")) errorCode = "PERMISSIONS_INSUFFICIENT";
      else if (message.includes("404")) errorCode = "STORE_NOT_FOUND";
      else if (message.includes("ENOTFOUND") || message.includes("ECONNREFUSED")) errorCode = "URL_UNREACHABLE";

      return {
        connected: false,
        storeName: null,
        platformInfo: null,
        productCount: null,
        tokenValid: false,
        error: message,
        errorCode,
      };
    }
  }

  async refreshAuth(): Promise<string | null> {
    const result = await this.testConnection();
    if (!result.connected) {
      throw new Error(result.error ?? "La clave API de PrestaShop no es válida");
    }
    return null;
  }

  async request<T = unknown>(method: string, path: string, body?: unknown, options?: RequestInit): Promise<T> {
    if (method === "GET") {
      return this.apiGet<T>(path);
    }
    const url = `${this.baseUrl}${path}${path.includes("?") ? "&" : "?"}output_format=JSON`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      ...(options?.headers as Record<string, string> ?? {}),
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      ...options,
    };

    if (body) {
      if (typeof body === "string") {
        headers["Content-Type"] = "application/xml";
        fetchOptions.body = body;
      } else {
        headers["Content-Type"] = "application/xml";
        fetchOptions.body = body as string;
      }
    }

    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PrestaShop API ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  async requestPaged<T = unknown>(path: string, params?: Record<string, string>): Promise<PagedResult<T>> {
    let fullPath = path;
    if (params && Object.keys(params).length > 0) {
      const sep = path.includes("?") ? "&" : "?";
      const qs = new URLSearchParams(params).toString();
      fullPath = `${path}${sep}${qs}`;
    }
    const data = await this.apiGet<Record<string, unknown>>(fullPath);
    const firstKey = Object.keys(data).find((k) => Array.isArray(data[k]));
    const items = firstKey ? (data[firstKey] as T[]) : [];
    return { data: items, total: items.length, hasMore: false };
  }

  async getProducts(params?: { status?: string; page?: number; limit?: number }): Promise<PlatformProduct[]> {
    const limit = params?.limit ?? 100;
    const offset = params?.page ? (params.page - 1) * limit : 0;
    await this.detectDefaultLanguage();

    const data = await this.apiGet<{ products?: PrestaShopRawProduct[] }>(
      `/products?display=full&limit=${offset},${limit}`
    );

    if (!data.products || !Array.isArray(data.products)) return [];

    const filtered =
      params?.status === "active"
        ? data.products.filter((p) => String(p.active) === "1")
        : params?.status === "draft"
          ? data.products.filter((p) => String(p.active) === "0")
          : data.products;

    return filtered.map((p) => this.mapProduct(p));
  }

  async getProduct(platformProductId: string): Promise<PlatformProduct> {
    await this.detectDefaultLanguage();
    const data = await this.apiGet<{ product: PrestaShopRawProduct }>(
      `/products/${platformProductId}`
    );
    return this.mapProduct(data.product);
  }

  async createProduct(productData: Partial<PlatformProduct>): Promise<PlatformProduct> {
    await this.detectDefaultLanguage();

    let blankSchema: string | undefined;
    try {
      const schemaUrl = `${this.baseUrl}/products?schema=blank`;
      const schemaRes = await fetch(schemaUrl, {
        headers: { Authorization: this.authHeader },
      });
      if (schemaRes.ok) {
        blankSchema = await schemaRes.text();
      }
    } catch {
      blankSchema = undefined;
    }

    const xmlData = this.mapToPrestaShopXml(productData);
    if (!xmlData.id_category_default) {
      xmlData.id_category_default = 2;
    }
    if (!xmlData.link_rewrite && xmlData.name) {
      xmlData.link_rewrite = xmlData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    }
    const xml = buildProductXml({ ...xmlData, langId: this.defaultLangId }, blankSchema);

    const result = await this.apiPost<{ product: PrestaShopRawProduct }>("/products", xml);
    const createdId = String(result.product.id);

    if (productData.variants && productData.variants.length > 1) {
      for (const variant of productData.variants) {
        try {
          const combXml = buildCombinationXml({
            id_product: result.product.id,
            price: variant.price ? String(variant.price) : undefined,
            reference: variant.sku ?? undefined,
          });
          const combResult = await this.apiPost<{ combination: { id: number } }>("/combinations", combXml);

          if (variant.inventoryQuantity !== undefined && variant.inventoryQuantity !== null) {
            try {
              await this.updateInventory(createdId, variant.inventoryQuantity, String(combResult.combination.id));
            } catch { /* stock update best-effort */ }
          }
        } catch (combErr) {
          console.warn(`PrestaShop combination creation failed for product ${createdId}:`, combErr);
        }
      }
    }

    return this.mapProduct(result.product);
  }

  async updateProduct(platformProductId: string, productData: Partial<PlatformProduct>): Promise<PlatformProduct> {
    await this.detectDefaultLanguage();
    const current = await this.apiGet<{ product: PrestaShopRawProduct }>(`/products/${platformProductId}`);
    const currentProduct = current.product;

    const xmlData: PrestaShopProductXml = {
      id: parseInt(platformProductId, 10),
      langId: this.defaultLangId,
      active: productData.status !== undefined
        ? (productData.status === "active" ? 1 : 0)
        : (String(currentProduct.active) === "1" ? 1 : 0),
      price: productData.price ?? String(currentProduct.price ?? "0"),
      name: productData.title ?? extractDefaultLang(currentProduct.name, this.defaultLangId),
      description: productData.bodyHtml ?? extractDefaultLang(currentProduct.description, this.defaultLangId),
      link_rewrite: productData.handle ?? extractDefaultLang(currentProduct.link_rewrite, this.defaultLangId),
      reference: productData.variants?.[0]?.sku ?? currentProduct.reference ?? "",
      meta_title: productData.seo?.metaTitle ?? extractDefaultLang(currentProduct.meta_title, this.defaultLangId),
      meta_description: productData.seo?.metaDescription ?? extractDefaultLang(currentProduct.meta_description, this.defaultLangId),
      meta_keywords: productData.seo?.focusKeyword ?? extractDefaultLang(currentProduct.meta_keywords, this.defaultLangId),
    };

    if (currentProduct.id_category_default) {
      xmlData.id_category_default = currentProduct.id_category_default;
    }

    const xml = buildProductXml(xmlData);
    const result = await this.apiPut<{ product: PrestaShopRawProduct }>(`/products/${platformProductId}`, xml);

    if (productData.variants && productData.variants.length > 0) {
      for (const variant of productData.variants) {
        if (variant.inventoryQuantity !== undefined && variant.inventoryQuantity !== null) {
          try {
            const variantId = variant.platformId;
            await this.updateInventory(platformProductId, variant.inventoryQuantity, variantId);
          } catch { /* stock update best-effort */ }
        }
      }
    }

    return this.mapProduct(result.product);
  }

  async deleteProduct(platformProductId: string): Promise<void> {
    await this.request("DELETE", `/products/${platformProductId}`);
  }

  async uploadImage(platformProductId: string, imageSource: string, _alt?: string): Promise<{ src: string; id?: string }> {
    const imageBuffer = await this.downloadImage(imageSource);
    const boundary = `----PrestaShopBoundary${Date.now()}`;
    const filename = `product_${platformProductId}_${Date.now()}.jpg`;

    const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`;
    const epilogue = `\r\n--${boundary}--\r\n`;

    const preambleBuffer = Buffer.from(preamble, "utf-8");
    const epilogueBuffer = Buffer.from(epilogue, "utf-8");
    const body = Buffer.concat([preambleBuffer, imageBuffer, epilogueBuffer]);

    const url = `${this.baseUrl}/images/products/${platformProductId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PrestaShop image upload failed (${res.status}): ${text.slice(0, 300)}`);
    }

    // FIX F-16: forzar HTTPS
    const cleanDomain = this.storeDomain
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "");
    const imgSrc = `https://${cleanDomain}/api/images/products/${platformProductId}`;

    learnFromOperation({
      operationType: "image_generation",
      title: `PrestaShop image uploaded: product ${platformProductId}`,
      content: `Imagen subida a PrestaShop para producto ${platformProductId}. Fuente: ${imageSource.slice(0, 100)}. Método: multipart/form-data POST a /api/images/products/${platformProductId}. PrestaShop auto-redimensiona a todos los formatos configurados.`,
      confidence: 0.85,
      tags: ["prestashop", "image_upload", "multipart"],
    });

    saveToVault({
      projectId: this.projectId,
      fileType: "image",
      category: "product_image",
      title: `Image: product ${platformProductId}`,
      originalUrl: imageSource,
      productId: platformProductId,
      generatedBy: "prestashop_connector",
      fileSizeBytes: imageBuffer.length,
    });

    return { src: imgSrc };
  }

  async getOrders(params?: { page?: number; limit?: number; after?: string; before?: string }): Promise<PlatformOrder[]> {
    const limit = params?.limit ?? 50;
    const offset = params?.page ? (params.page - 1) * limit : 0;
    let path = `/orders?display=full&limit=${offset},${limit}&sort=[date_add_DESC]`;

    if (params?.after) path += `&filter[date_add]=[${params.after},]`;
    if (params?.before) path += `&filter[date_add]=[,${params.before}]`;

    const data = await this.apiGet<{ orders?: PrestaShopRawOrder[] }>(path);
    if (!data.orders || !Array.isArray(data.orders)) return [];

    const orders = data.orders.map((o) => ({
      platformId: String(o.id),
      orderNumber: String(o.reference ?? o.id),
      status: String(o.current_state ?? "unknown"),
      total: String(o.total_paid ?? "0"),
      currency: o.id_currency ? String(o.id_currency) : "EUR",
      createdAt: o.date_add ?? new Date().toISOString(),
      customerEmail: undefined,
      lineItems: (o.associations?.order_rows ?? []).map((row) => ({
        title: row.product_name ?? "",
        quantity: row.product_quantity ?? 1,
        price: String(row.product_price ?? "0"),
        productId: row.product_id ? String(row.product_id) : undefined,
      })),
    }));

    if (orders.length > 0) {
      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const totalItems = orders.reduce((sum, o) => sum + o.lineItems.reduce((s, li) => s + li.quantity, 0), 0);
      learnFromOperation({
        operationType: "inventory_sales_analytics",
        title: `PrestaShop orders fetched: ${orders.length} orders`,
        content: `Análisis de ventas PrestaShop: ${orders.length} pedidos recuperados. Revenue total: ${totalRevenue.toFixed(2)}. Items vendidos: ${totalItems}. ${params?.after ? `Desde: ${params.after}.` : ""} ${params?.before ? `Hasta: ${params.before}.` : ""} Datos de /api/orders con order_rows. PrestaShop usa estados numéricos (current_state) para el flujo de pedidos.`,
        confidence: 0.85,
        tags: ["prestashop", "orders", "sales_analytics"],
      });
    }

    return orders;
  }

  async getProductCount(params?: { status?: string }): Promise<number> {
    const data = await this.apiGet<{ products?: Array<{ id: number }> }>("/products");
    if (!data.products) return 0;

    if (params?.status === "active") {
      const fullData = await this.apiGet<{ products?: PrestaShopRawProduct[] }>("/products?display=full");
      return (fullData.products ?? []).filter((p) => String(p.active) === "1").length;
    }

    return data.products.length;
  }

  async getSeoData(platformProductId: string): Promise<SeoData | null> {
    await this.detectDefaultLanguage();
    const data = await this.apiGet<{ product: PrestaShopRawProduct }>(`/products/${platformProductId}`);
    const p = data.product;

    return {
      metaTitle: extractDefaultLang(p.meta_title, this.defaultLangId),
      metaDescription: extractDefaultLang(p.meta_description, this.defaultLangId),
      focusKeyword: extractDefaultLang(p.meta_keywords, this.defaultLangId),
      handle: extractDefaultLang(p.link_rewrite, this.defaultLangId),
    };
  }

  async updateSeo(platformProductId: string, data: Partial<SeoData>): Promise<SeoData> {
    await this.detectDefaultLanguage();
    const current = await this.apiGet<{ product: PrestaShopRawProduct }>(`/products/${platformProductId}`);
    const currentProduct = current.product;

    const xmlData: PrestaShopProductXml = {
      id: parseInt(platformProductId, 10),
      langId: this.defaultLangId,
      active: String(currentProduct.active) === "1" ? 1 : 0,
      price: String(currentProduct.price ?? "0"),
      name: extractDefaultLang(currentProduct.name, this.defaultLangId),
      description: extractDefaultLang(currentProduct.description, this.defaultLangId),
      link_rewrite: data.handle ?? extractDefaultLang(currentProduct.link_rewrite, this.defaultLangId),
      reference: currentProduct.reference ?? "",
      meta_title: data.metaTitle ?? extractDefaultLang(currentProduct.meta_title, this.defaultLangId),
      meta_description: data.metaDescription ?? extractDefaultLang(currentProduct.meta_description, this.defaultLangId),
      meta_keywords: data.focusKeyword ?? extractDefaultLang(currentProduct.meta_keywords, this.defaultLangId),
    };

    if (currentProduct.id_category_default) {
      xmlData.id_category_default = currentProduct.id_category_default;
    }

    const xml = buildProductXml(xmlData);
    await this.apiPut(`/products/${platformProductId}`, xml);

    const result: SeoData = {
      metaTitle: data.metaTitle ?? extractDefaultLang(currentProduct.meta_title, this.defaultLangId),
      metaDescription: data.metaDescription ?? extractDefaultLang(currentProduct.meta_description, this.defaultLangId),
      focusKeyword: data.focusKeyword ?? extractDefaultLang(currentProduct.meta_keywords, this.defaultLangId),
      handle: data.handle ?? extractDefaultLang(currentProduct.link_rewrite, this.defaultLangId),
    };

    learnFromOperation({
      operationType: "seo",
      title: `PrestaShop SEO updated: product ${platformProductId}`,
      content: `SEO actualizado en PrestaShop para producto ${platformProductId}. meta_title: "${result.metaTitle}", meta_description: "${result.metaDescription}", link_rewrite: "${result.handle}", keywords: "${result.focusKeyword}". SEO nativo de PrestaShop (sin plugin necesario).`,
      confidence: 0.85,
      tags: ["prestashop", "seo", "native_seo"],
    });

    saveToVault({
      projectId: this.projectId,
      fileType: "seo",
      category: "seo_optimization",
      title: `SEO: product ${platformProductId}`,
      content: JSON.stringify(result),
      productId: platformProductId,
      generatedBy: "prestashop_connector",
    });

    return result;
  }

  async getInventory(platformProductId: string): Promise<InventoryData | null> {
    const data = await this.apiGet<{
      stock_availables?: Array<{
        id: number;
        id_product: number;
        id_product_attribute: number;
        quantity: number;
      }>;
    }>(`/stock_availables?filter[id_product]=${platformProductId}&display=full`);

    if (!data.stock_availables || data.stock_availables.length === 0) {
      return { productId: platformProductId, tracked: false, quantity: null };
    }

    const mainStock = data.stock_availables.find(
      (s) => s.id_product_attribute === 0
    ) ?? data.stock_availables[0];

    return {
      productId: platformProductId,
      tracked: true,
      quantity: mainStock.quantity,
      variants: data.stock_availables
        .filter((s) => s.id_product_attribute !== 0)
        .map((s) => ({
          variantId: String(s.id_product_attribute),
          quantity: s.quantity,
        })),
    };
  }

  async updateInventory(platformProductId: string, quantity: number, variantId?: string): Promise<void> {
    const data = await this.apiGet<{
      stock_availables?: Array<{
        id: number;
        id_product: number;
        id_product_attribute: number;
        quantity: number;
      }>;
    }>(`/stock_availables?filter[id_product]=${platformProductId}&display=full`);

    if (!data.stock_availables || data.stock_availables.length === 0) {
      throw new Error(`No se encontró registro de stock para el producto ${platformProductId}`);
    }

    let stockRecord;
    if (variantId) {
      stockRecord = data.stock_availables.find(
        (s) => String(s.id_product_attribute) === variantId
      );
      if (!stockRecord) {
        throw new Error(`No se encontró stock para la combinación ${variantId} del producto ${platformProductId}`);
      }
    } else {
      stockRecord = data.stock_availables.find(
        (s) => s.id_product_attribute === 0
      ) ?? data.stock_availables[0];
    }

    const xml = buildStockXml({
      id: stockRecord.id,
      id_product: stockRecord.id_product,
      id_product_attribute: stockRecord.id_product_attribute,
      quantity,
    });

    await this.apiPut(`/stock_availables/${stockRecord.id}`, xml);

    learnFromOperation({
      operationType: "inventory_update",
      title: `PrestaShop stock updated: product ${platformProductId}`,
      content: `Stock actualizado en PrestaShop para producto ${platformProductId}${variantId ? ` (combinación ${variantId})` : ""}. Cantidad anterior: ${stockRecord.quantity}. Nueva cantidad: ${quantity}. Recurso: /api/stock_availables/${stockRecord.id}.`,
      confidence: 0.85,
      tags: ["prestashop", "inventory_update", "stock_availables"],
    });
  }

  async getCategories(): Promise<Array<{ id: number; name: string; parentId: number }>> {
    await this.detectDefaultLanguage();
    const data = await this.apiGet<{
      categories?: Array<{
        id: number;
        name: unknown;
        id_parent: number | string;
        active: number | string;
        level_depth: number | string;
      }>;
    }>("/categories?display=full");

    if (!data.categories || !Array.isArray(data.categories)) return [];

    return data.categories.map((c) => ({
      id: c.id,
      name: extractDefaultLang(c.name, this.defaultLangId),
      parentId: typeof c.id_parent === "string" ? parseInt(c.id_parent, 10) : c.id_parent,
    }));
  }

  async getCombinations(platformProductId: string): Promise<Array<{
    id: number;
    price: string;
    reference: string;
    optionValues: Array<{ id: number }>;
  }>> {
    const data = await this.apiGet<{
      combinations?: Array<{
        id: number;
        id_product: number;
        price: string | number;
        reference?: string;
        associations?: {
          product_option_values?: Array<{ id: number }>;
        };
      }>;
    }>(`/combinations?filter[id_product]=${platformProductId}&display=full`);

    if (!data.combinations || !Array.isArray(data.combinations)) return [];

    return data.combinations.map((c) => ({
      id: c.id,
      price: String(c.price ?? "0"),
      reference: c.reference ?? "",
      optionValues: c.associations?.product_option_values ?? [],
    }));
  }

  async createCombination(platformProductId: string, data: {
    price?: string;
    reference?: string;
    quantity?: number;
    optionValueIds?: number[];
  }): Promise<{ id: number }> {
    const xml = buildCombinationXml({
      id_product: parseInt(platformProductId, 10),
      price: data.price,
      reference: data.reference,
      quantity: data.quantity,
      optionValueIds: data.optionValueIds,
    });
    const result = await this.apiPost<{ combination: { id: number } }>("/combinations", xml);
    return { id: result.combination.id };
  }

  private async apiGet<T>(path: string): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${sep}output_format=JSON`;
    const res = await fetch(url, {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PrestaShop GET ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  private async apiPost<T>(path: string, xmlBody: string): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${sep}output_format=JSON`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/xml",
      },
      body: xmlBody,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PrestaShop POST ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async apiPut<T>(path: string, xmlBody: string): Promise<T> {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${sep}output_format=JSON`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/xml",
      },
      body: xmlBody,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PrestaShop PUT ${path} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only HTTP(S) image URLs are supported");
    }
    const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "169.254.169.254"];
    if (blockedHosts.includes(parsed.hostname)) {
      throw new Error("Image URL points to a blocked host");
    }
    const ipParts = parsed.hostname.split(".");
    if (ipParts.length === 4 && ipParts.every((p) => /^\d+$/.test(p))) {
      const first = parseInt(ipParts[0], 10);
      const second = parseInt(ipParts[1], 10);
      if (
        first === 10 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168) ||
        first === 127
      ) {
        throw new Error("Image URL points to a private/internal network");
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Failed to download image from ${url}: ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
      if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large (${Math.round(arrayBuffer.byteLength / 1024 / 1024)}MB). Max 20MB.`);
      }
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async detectDefaultLanguage(): Promise<void> {
    try {
      const data = await this.apiGet<{
        languages?: Array<{ id: number; active: string; iso_code: string; is_default?: string }>;
      }>("/languages?filter[active]=1&display=full");

      if (data.languages && data.languages.length > 0) {
        const defaultLang = data.languages.find((l) => l.is_default === "1") ?? data.languages[0];
        this.defaultLangId = defaultLang.id;
      }
    } catch {
      this.defaultLangId = 1;
    }
  }

  private mapProduct(p: PrestaShopRawProduct): PlatformProduct {
    const langId = this.defaultLangId;
    const name = extractDefaultLang(p.name, langId);
    const description = extractDefaultLang(p.description, langId);
    const descShort = extractDefaultLang(p.description_short, langId);
    const linkRewrite = extractDefaultLang(p.link_rewrite, langId);
    const metaTitle = extractDefaultLang(p.meta_title, langId);
    const metaDesc = extractDefaultLang(p.meta_description, langId);
    const metaKeywords = extractDefaultLang(p.meta_keywords, langId);

    const images: Array<{ src: string; alt?: string; position?: number }> = [];
    if (p.associations?.images) {
      for (let i = 0; i < p.associations.images.length; i++) {
        const img = p.associations.images[i];
        // FIX F-16: forzar HTTPS
        const cleanDomain = this.storeDomain
          .replace(/^https?:\/\//i, "")
          .replace(/\/+$/, "");
        images.push({
          src: `https://${cleanDomain}/api/images/products/${p.id}/${img.id}`,
          position: i,
        });
      }
    }

    const variants: PlatformProduct["variants"] = [];
    if (p.associations?.combinations) {
      for (const combo of p.associations.combinations) {
        variants.push({
          platformId: String(combo.id),
          title: `Combination ${combo.id}`,
          price: String(p.price ?? "0"),
          sku: p.reference ?? "",
        });
      }
    }

    if (variants.length === 0) {
      variants.push({
        platformId: String(p.id),
        title: "Default",
        price: String(p.price ?? "0"),
        sku: p.reference ?? "",
        inventoryQuantity: undefined,
      });
    }

    return {
      platformId: String(p.id),
      title: name,
      handle: linkRewrite,
      bodyHtml: description || descShort,
      vendor: p.manufacturer_name ?? "",
      productType: p.type?.toString() ?? "",
      status: String(p.active) === "1" ? "active" : "draft",
      tags: metaKeywords,
      price: p.price ? String(p.price) : null,
      compareAtPrice: null,
      images,
      variants,
      seo: {
        metaTitle: metaTitle,
        metaDescription: metaDesc,
        focusKeyword: metaKeywords,
      },
    };
  }

  private mapToPrestaShopXml(data: Partial<PlatformProduct>): PrestaShopProductXml {
    const xmlData: PrestaShopProductXml = { langId: this.defaultLangId };

    if (data.title !== undefined) xmlData.name = data.title;
    if (data.bodyHtml !== undefined) xmlData.description = data.bodyHtml;
    if (data.handle !== undefined) xmlData.link_rewrite = data.handle;
    if (data.price !== undefined) xmlData.price = data.price ?? "0";
    if (data.status !== undefined) xmlData.active = data.status === "active" ? 1 : 0;

    if (data.variants?.[0]?.sku) xmlData.reference = data.variants[0].sku;

    if (data.seo) {
      if (data.seo.metaTitle) xmlData.meta_title = data.seo.metaTitle;
      if (data.seo.metaDescription) xmlData.meta_description = data.seo.metaDescription;
      if (data.seo.focusKeyword) xmlData.meta_keywords = data.seo.focusKeyword;
    }

    return xmlData;
  }
}

interface PrestaShopRawProduct {
  id: number;
  id_category_default?: number;
  active: number | string;
  price: string | number;
  reference?: string;
  ean13?: string;
  weight?: string;
  name: unknown;
  description: unknown;
  description_short: unknown;
  meta_title: unknown;
  meta_description: unknown;
  meta_keywords: unknown;
  link_rewrite: unknown;
  manufacturer_name?: string;
  type?: string | number;
  associations?: {
    images?: Array<{ id: number }>;
    combinations?: Array<{ id: number }>;
    categories?: Array<{ id: number }>;
  };
}

interface PrestaShopRawOrder {
  id: number;
  reference?: string;
  current_state?: number;
  total_paid?: string | number;
  id_currency?: number;
  date_add?: string;
  associations?: {
    order_rows?: Array<{
      product_id?: number;
      product_name?: string;
      product_quantity?: number;
      product_price?: string | number;
    }>;
  };
}
