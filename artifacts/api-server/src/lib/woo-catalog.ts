import { WooClient, WooError } from "./woo-client.js";
import { getWooJson, putWooJson } from "./woo-storage.js";
import { createHash } from "node:crypto";

export const wooResources = ["products","variations","categories","attributes","terms","orders","customers","coupons"] as const;
export type WooResource = typeof wooResources[number];
export const wooEditableFields: Record<WooResource,string[]> = {
  products: ["name","type","status","description","short_description","sku","regular_price","sale_price","manage_stock","stock_quantity","stock_status","backorders","categories","attributes","default_attributes","images","downloadable","downloads"],
  variations: ["status","description","sku","regular_price","sale_price","manage_stock","stock_quantity","stock_status","backorders","attributes","image","downloadable","downloads"],
  categories: ["name","slug","parent","description","image"],
  attributes: ["name","slug","type","order_by","has_archives"],
  terms: ["name","slug","description"],
  orders: ["status","customer_note"],
  customers: ["first_name","last_name","email","billing","shipping"],
  coupons: ["code","discount_type","amount","description","date_expires","usage_limit","usage_limit_per_user","individual_use","free_shipping","minimum_amount","maximum_amount","email_restrictions","product_ids","excluded_product_ids","product_categories","excluded_product_categories"],
};
export function wooResourcePath(resource: WooResource, parentId?: number) {
  if (resource === "variations") {
    if (!parentId) throw new WooError("Selecciona el producto padre",400);
    return `/products/${parentId}/variations`;
  }
  if (resource === "terms") {
    if (!parentId) throw new WooError("Selecciona el atributo padre",400);
    return `/products/attributes/${parentId}/terms`;
  }
  return { categories: "/products/categories", attributes: "/products/attributes" }[resource as "categories"|"attributes"] ?? `/${resource}`;
}
function checkValue(value: any, schema: any, name: string) {
  if (value === null && (schema.type === "null" || schema.type?.includes?.("null"))) return;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (schema.enum && !schema.enum.includes(value)) throw new WooError(`${name}: valor no admitido`,400);
  if (types.includes("string") && typeof value !== "string") throw new WooError(`${name}: requiere texto`,400);
  if (types.includes("boolean") && typeof value !== "boolean") throw new WooError(`${name}: requiere sí/no`,400);
  if (types.includes("integer") && !Number.isSafeInteger(value)) throw new WooError(`${name}: requiere entero`,400);
  if (types.includes("number") && (typeof value !== "number" || !Number.isFinite(value))) throw new WooError(`${name}: número inválido`,400);
  if (types.includes("array")) {
    if (!Array.isArray(value) || value.length > 100) throw new WooError(`${name}: lista inválida o demasiado grande`,400);
    if (schema.items) value.forEach((v: any) => checkValue(v,schema.items,name));
  }
  if (types.includes("object")) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new WooError(`${name}: objeto inválido`,400);
    for (const [k,v] of Object.entries(value)) {
      const s = schema.properties?.[k];
      if (!s || s.readonly) throw new WooError(`${name}.${k}: campo no editable`,400);
      checkValue(v,s,`${name}.${k}`);
    }
  }
}
export async function wooSchema(wc: WooClient, path: string, method: string) {
  const options = await wc.request("OPTIONS",path);
  const endpoint = options.endpoints?.find((e:any) => e.methods?.includes(method));
  if (!endpoint) throw new WooError(`La instalación no expone ${method} para este recurso`,403);
  return endpoint.args ?? {};
}
export async function validateWooWrite(wc: WooClient, resource: WooResource, path: string, method: string, data: any) {
  if (!data || typeof data !== "object" || Array.isArray(data) || JSON.stringify(data).length > 100_000) throw new WooError("Datos inválidos",400);
  const schema = await wooSchema(wc,path,method);
  for (const [k,v] of Object.entries(data)) {
    if (!wooEditableFields[resource].includes(k) || !schema[k] || schema[k].readonly) throw new WooError(`Campo no admitido: ${k}`,400);
    checkValue(v,schema[k],k);
    if (["regular_price","sale_price","amount","minimum_amount","maximum_amount"].includes(k) && (typeof v !== "string" || (v !== "" && !/^\d+(\.\d{1,2})?$/.test(v)))) throw new WooError(`${k}: importe inválido`,400);
  }
  if (!Object.keys(data).length) throw new WooError("No hay cambios",400);
  if (resource === "products" && data.type && !["simple","variable"].includes(data.type)) throw new WooError("Solo productos simples o variables",400);
  if (resource === "orders" && data.status === "refunded") throw new WooError("Los reembolsos deben gestionarse en WooCommerce; cambiar el estado no devuelve dinero",400);
}
/** Durable create-only claim: uncertain writes cannot be automatically replayed. */
export async function verifiedWooWrite(wc: WooClient, resource: WooResource, path: string, method: string, data: any, operationId: string) {
  if (!/^[a-f0-9-]{36}$/.test(operationId)) throw new WooError("Falta identificador de operación",400);
  await validateWooWrite(wc,resource,path,method,data);
  const fingerprint = createHash("sha256").update(JSON.stringify({path,method,data})).digest("hex");
  const key = `operations/${operationId}.json`;
  const operation = { fingerprint, resource, method, state:"pending", startedAt:new Date().toISOString() };
  try { await putWooJson(wc.project.id,key,operation,true); }
  catch (e:any) {
    if (e.code !== 412) throw e;
    const previous = await getWooJson(wc.project.id,key);
    if (previous.fingerprint !== fingerprint) throw new WooError("Identificador reutilizado con datos distintos",409);
    if (previous.state === "verified") return { ...previous, result: await wc.request("GET",`${path.replace(/\/\d+$/,"")}/${previous.entityId}`) };
    throw new WooError("Operación pendiente o incierta: revisar en WooCommerce antes de repetir",409);
  }
  try {
    const response = await wc.request(method,path,data);
    if (!Number.isSafeInteger(response.id)) throw new WooError("Escritura sin identificador verificable");
    const readPath = method === "POST" ? `${path}/${response.id}` : path;
    const result = await wc.request("GET",readPath);
    if (result.id !== response.id) throw new WooError("No se pudo verificar el recurso escrito");
    for (const k of Object.keys(data)) {
      if (typeof data[k] === "object" && JSON.stringify(result[k]) !== JSON.stringify(response[k])) throw new WooError(`WooCommerce no confirmó la lectura de ${k}`);
    }
    for (const k of ["images","downloads","categories","attributes","default_attributes"]) {
      if (!Array.isArray(data[k])) continue;
      if (!Array.isArray(result[k]) || result[k].length!==data[k].length) throw new WooError(`WooCommerce no confirmó todos los elementos de ${k}`);
      data[k].forEach((requested:any,index:number)=>{
        const actual=result[k][index];
        for(const [field,value] of Object.entries(requested)) {
          if(k==="images" && field==="src") {
            if(!actual?.id || !actual.src) throw new WooError("Imagen importada sin medio persistente");
          } else if(JSON.stringify(actual?.[field])!==JSON.stringify(value)) {
            throw new WooError(`WooCommerce no confirmó ${k}.${field}`);
          }
        }
      });
    }
    if (data.image?.src && (!result.image?.id || !result.image?.src)) throw new WooError("Variación sin imagen persistente confirmada");
    // Compare scalar editable fields. WC may normalize HTML, arrays and monetary formatting.
    for (const [k,v] of Object.entries(data)) {
      if (typeof v === "boolean" || typeof v === "number") {
        if (result[k] !== v) throw new WooError(`WooCommerce no confirmó el campo ${k}`);
      } else if (typeof v === "string" && !["description","short_description","customer_note"].includes(k)) {
        const price = /price|amount/.test(k);
        if (price ? (v === "" ? result[k] !== "" : Number(result[k]) !== Number(v)) : result[k] !== v) throw new WooError(`WooCommerce no confirmó el campo ${k}`);
      }
    }
    const verified = { ...operation, state:"verified", entityId:result.id, verifiedAt:new Date().toISOString() };
    await putWooJson(wc.project.id,key,verified);
    return { ...verified, result };
  } catch (e) {
    await putWooJson(wc.project.id,key,{ ...operation,state:"uncertain" }).catch(()=>{});
    throw e;
  }
}
