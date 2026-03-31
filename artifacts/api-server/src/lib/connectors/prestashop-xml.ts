const XML_SPECIAL: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => XML_SPECIAL[ch] ?? ch);
}

function wrapCdata(value: string): string {
  const safe = value.replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safe}]]>`;
}

export interface MultiLangValue {
  languageId: number;
  value: string;
}

function renderMultiLang(tagName: string, values: MultiLangValue[]): string {
  const inner = values
    .map((v) => `<language id="${v.languageId}">${wrapCdata(v.value)}</language>`)
    .join("");
  return `<${tagName}>${inner}</${tagName}>`;
}

function renderMultiLangSingle(tagName: string, value: string, langId: number = 1): string {
  return renderMultiLang(tagName, [{ languageId: langId, value }]);
}

export interface PrestaShopProductXml {
  id?: number;
  id_category_default?: number;
  active?: number;
  price?: string;
  reference?: string;
  ean13?: string;
  weight?: string;
  name?: string;
  description?: string;
  description_short?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  link_rewrite?: string;
  categories?: number[];
  langId?: number;
}

const MULTI_LANG_FIELDS = new Set([
  "name", "description", "description_short",
  "meta_title", "meta_description", "meta_keywords", "link_rewrite",
]);

const SKIP_SCHEMA_FIELDS = new Set([
  "id", "manufacturer_name", "quantity", "position_in_category",
  "id_default_image", "id_default_combination", "date_add", "date_upd",
]);

function extractSchemaFields(blankSchema: string): string[] {
  const fieldNames: string[] = [];
  const productMatch = blankSchema.match(/<product[^>]*>([\s\S]*?)<\/product>/);
  if (!productMatch) return fieldNames;
  const productContent = productMatch[1];
  const tagRegex = /<(\w+)(?:\s[^>]*)?\s*(?:\/>|>[^<]*<\/\1>|>[\s\S]*?<\/\1>)/g;
  let m;
  while ((m = tagRegex.exec(productContent)) !== null) {
    const tag = m[1];
    if (tag !== "associations" && !SKIP_SCHEMA_FIELDS.has(tag)) {
      fieldNames.push(tag);
    }
  }
  return fieldNames;
}

export function buildProductXml(data: PrestaShopProductXml, blankSchema?: string): string {
  const langId = data.langId ?? 1;
  const fields: string[] = [];

  const dataMap: Record<string, string | number | undefined> = {
    id: data.id,
    id_category_default: data.id_category_default,
    active: data.active,
    price: data.price,
    reference: data.reference,
    ean13: data.ean13,
    weight: data.weight,
    name: data.name,
    description: data.description,
    description_short: data.description_short,
    meta_title: data.meta_title,
    meta_description: data.meta_description,
    meta_keywords: data.meta_keywords,
    link_rewrite: data.link_rewrite,
  };

  if (blankSchema) {
    const schemaFields = extractSchemaFields(blankSchema);

    for (const fieldName of schemaFields) {
      const val = dataMap[fieldName];
      if (MULTI_LANG_FIELDS.has(fieldName)) {
        const strVal = val !== undefined ? String(val) : "";
        fields.push(renderMultiLangSingle(fieldName, strVal, langId));
      } else if (val !== undefined) {
        fields.push(`<${fieldName}>${escapeXml(String(val))}</${fieldName}>`);
      } else {
        const defaults: Record<string, string> = {
          active: "1",
          price: "0.000000",
          id_category_default: "2",
          id_tax_rules_group: "0",
          state: "1",
          minimal_quantity: "1",
          show_price: "1",
          available_for_order: "1",
          condition: "new",
          visibility: "both",
        };
        if (defaults[fieldName] !== undefined) {
          fields.push(`<${fieldName}>${defaults[fieldName]}</${fieldName}>`);
        }
      }
    }
  } else {
    if (data.id !== undefined) fields.push(`<id>${data.id}</id>`);
    if (data.id_category_default !== undefined) fields.push(`<id_category_default>${data.id_category_default}</id_category_default>`);
    if (data.active !== undefined) fields.push(`<active>${data.active}</active>`);
    if (data.price !== undefined) fields.push(`<price>${escapeXml(data.price)}</price>`);
    if (data.reference !== undefined) fields.push(`<reference>${escapeXml(data.reference)}</reference>`);
    if (data.ean13 !== undefined) fields.push(`<ean13>${escapeXml(data.ean13)}</ean13>`);
    if (data.weight !== undefined) fields.push(`<weight>${escapeXml(data.weight)}</weight>`);

    if (data.name !== undefined) fields.push(renderMultiLangSingle("name", data.name, langId));
    if (data.description !== undefined) fields.push(renderMultiLangSingle("description", data.description, langId));
    if (data.description_short !== undefined) fields.push(renderMultiLangSingle("description_short", data.description_short, langId));
    if (data.meta_title !== undefined) fields.push(renderMultiLangSingle("meta_title", data.meta_title, langId));
    if (data.meta_description !== undefined) fields.push(renderMultiLangSingle("meta_description", data.meta_description, langId));
    if (data.meta_keywords !== undefined) fields.push(renderMultiLangSingle("meta_keywords", data.meta_keywords, langId));
    if (data.link_rewrite !== undefined) fields.push(renderMultiLangSingle("link_rewrite", data.link_rewrite, langId));
  }

  if (data.categories && data.categories.length > 0) {
    const catEntries = data.categories.map((cid) => `<category><id>${cid}</id></category>`).join("");
    fields.push(`<associations><categories>${catEntries}</categories></associations>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<product>\n${fields.join("\n")}\n</product>\n</prestashop>`;
}

export interface PrestaShopStockXml {
  id: number;
  id_product: number;
  id_product_attribute: number;
  quantity: number;
}

export function buildStockXml(data: PrestaShopStockXml): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<stock_available>\n<id>${data.id}</id>\n<id_product>${data.id_product}</id_product>\n<id_product_attribute>${data.id_product_attribute}</id_product_attribute>\n<quantity>${data.quantity}</quantity>\n</stock_available>\n</prestashop>`;
}

export function buildCombinationXml(data: {
  id_product: number;
  price?: string;
  weight?: string;
  reference?: string;
  ean13?: string;
  quantity?: number;
  optionValueIds?: number[];
}): string {
  const fields: string[] = [];
  fields.push(`<id_product>${data.id_product}</id_product>`);
  if (data.price !== undefined) fields.push(`<price>${escapeXml(data.price)}</price>`);
  if (data.weight !== undefined) fields.push(`<weight>${escapeXml(data.weight)}</weight>`);
  if (data.reference !== undefined) fields.push(`<reference>${escapeXml(data.reference)}</reference>`);
  if (data.ean13 !== undefined) fields.push(`<ean13>${escapeXml(data.ean13)}</ean13>`);
  if (data.quantity !== undefined) fields.push(`<quantity>${data.quantity}</quantity>`);
  if (data.optionValueIds && data.optionValueIds.length > 0) {
    const ovEntries = data.optionValueIds.map((id) => `<product_option_value><id>${id}</id></product_option_value>`).join("");
    fields.push(`<associations><product_option_values>${ovEntries}</product_option_values></associations>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">\n<combination>\n${fields.join("\n")}\n</combination>\n</prestashop>`;
}

export function extractDefaultLang(field: unknown, langId: number = 1): string {
  if (typeof field === "string") return field;
  if (Array.isArray(field)) {
    const match = field.find((item: { id?: string | number; value?: string }) => String(item.id) === String(langId));
    return (match?.value ?? field[0]?.value ?? "") as string;
  }
  if (field && typeof field === "object" && "language" in (field as Record<string, unknown>)) {
    const lang = (field as { language: unknown }).language;
    return extractDefaultLang(lang, langId);
  }
  return String(field ?? "");
}
