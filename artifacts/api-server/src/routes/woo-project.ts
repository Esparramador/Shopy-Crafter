import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth.js";
import { WooClient, WooError, wooId } from "../lib/woo-client.js";
import { wooOverview, wooInventory } from "../lib/woo-metrics.js";
import { wooResources, wooResourcePath, wooSchema, wooEditableFields, verifiedWooWrite, type WooResource } from "../lib/woo-catalog.js";
import { CreateWooResourceBody, UpdateWooResourceBody, RequestWooUploadBody, PreviewWooFilesBody, ApplyWooFilesBody } from "@workspace/api-zod";
import { getWooJson, wooUpload, wooObject } from "../lib/woo-storage.js";
import { previewWooImport, applyWooImport, wooImportPreviews } from "../lib/woo-imports.js";

const router = Router();
const base = "/admin/woo/project/:id";
export async function resolveWooClient(projectId: number) {
  const project = await db.query.projectsTable.findFirst({where:eq(projectsTable.id,projectId)});
  if (!project) throw new WooError("Proyecto no encontrado",404);
  if (project.platformType !== "woocommerce") throw new WooError("El proyecto no es WooCommerce",400);
  return new WooClient(project);
}
const handler = (fn: (req:Request,res:Response,wc:WooClient)=>Promise<void>) =>
  async (req:Request,res:Response):Promise<void> => {
    try { await fn(req,res,await resolveWooClient(wooId(req.params.id))); }
    catch (e:any) {
      req.log?.warn({projectId:Number(req.params.id),status:e instanceof WooError ? e.status : 502},"WooCommerce operation failed");
      res.status(e instanceof WooError ? e.status : 502).json({error:e instanceof WooError ? e.message : "No se pudo completar la operación WooCommerce. No repetir una escritura sin comprobar el resultado."});
    }
  };
const resource = (req:Request) => {
  const r = String(req.params.resource) as WooResource;
  if (!wooResources.includes(r)) throw new WooError("Recurso no admitido",400);
  return r;
};
const parent = (req:Request) => req.query.parentId != null ? wooId(req.query.parentId) : req.body?.parentId != null ? wooId(req.body.parentId) : undefined;
const pathFor = (req:Request) => wooResourcePath(resource(req),parent(req));
// No router-wide auth without a prefix: public media must remain before the global admin gate.
router.get("/woo-media/:projectId/:token",async(req,res):Promise<void>=>{
  try {
    const pid = wooId(req.params.projectId), token=String(req.params.token);
    if (!/^[a-f0-9-]{36}$/.test(token)) {res.sendStatus(404);return;}
    const meta = await getWooJson(pid,`published/${token}.json`);
    const file = wooObject(pid,`published/${token}`);
    const [metadata] = await file.getMetadata();
    res.set({"Content-Type":meta.mime,"Content-Length":String(metadata.size),"X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'","Cache-Control":"public, max-age=31536000, immutable",...(meta.mime==="application/pdf" ? {"Content-Disposition":"attachment"} : {})});
    file.createReadStream().on("error",()=>res.destroy()).pipe(res);
  } catch {res.sendStatus(404);}
});
router.use(base,requireAdmin);
router.get(`${base}/overview`,handler(async(_req,res,wc)=>{res.json(await wooOverview(wc));}));
router.get(`${base}/inventory`,handler(async(_req,res,wc)=>{
  const settings = await wc.request("GET","/settings/general");
  const currency=settings.find((s:any)=>s.id==="woocommerce_currency")?.value;
  if (!currency) throw new WooError("Moneda no disponible");
  res.json({...await wooInventory(wc),currency,source:wc.origin,fetchedAt:new Date().toISOString()});
}));
router.get(`${base}/resources/:resource`,handler(async(req,res,wc)=>{
  const page=wooId(req.query.page ?? 1), perPage=wooId(req.query.per_page ?? 20);
  if (perPage>100) throw new WooError("Máximo 100 registros por página",400);
  const query:Record<string,string>={page:String(page),per_page:String(perPage)};
  if (req.query.search) query.search=String(req.query.search).slice(0,200);
  if (req.query.status) {
    const status=String(req.query.status), r=resource(req);
    const allowed=r==="orders" ? ["pending","processing","on-hold","completed","cancelled","refunded","failed","trash"] : ["publish","draft","pending","private","future","trash"];
    if (!["orders","products","variations"].includes(r) || !allowed.includes(status)) throw new WooError("Filtro de estado inválido; selecciona un solo estado",400);
    query.status=status;
  }
  // Validate filters against this installation, not an assumed comma-separated enum.
  const args = await wooSchema(wc,pathFor(req),"GET");
  // Core product attributes is an explicitly unpaginated collection. Do not invent
  // upstream filters or demand pagination headers that the resource does not expose.
  if (resource(req)==="attributes" && !args.page && !args.per_page) {
    let data=await wc.request("GET",pathFor(req));
    if (!Array.isArray(data) || data.length>5000) throw new WooError("Listado de atributos inválido o superior al límite");
    if(query.search) data=data.filter((a:any)=>String(a.name).toLocaleLowerCase().includes(query.search.toLocaleLowerCase()));
    const total=data.length;
    res.json({data:data.slice((page-1)*perPage,page*perPage),total,totalPages:Math.ceil(total/perPage),page,hasMore:page*perPage<total,source:wc.origin,fetchedAt:new Date().toISOString()});
    return;
  }
  if (args.hide_empty) query.hide_empty="false";
  for (const [k,v] of Object.entries(query)) {
    if (!args[k]) throw new WooError(`La tienda no admite el filtro ${k}`,400);
    if (args[k].enum && !args[k].enum.includes(v)) throw new WooError(`Valor no admitido para ${k}`,400);
  }
  res.json(await wc.page(pathFor(req),query));
}));
router.get(`${base}/resources/:resource/:entityId`,handler(async(req,res,wc)=>{
  res.json({result:await wc.request("GET",`${pathFor(req)}/${wooId(req.params.entityId)}`)});
}));
router.get(`${base}/schema/:resource`,handler(async(req,res,wc)=>{
  const path=pathFor(req)+(req.query.entityId ? `/${wooId(req.query.entityId)}` : "");
  const schema=await wc.request("OPTIONS",path);
  const args=await wooSchema(wc,path,req.query.entityId ? "PUT" : "POST");
  res.json({fields:Object.fromEntries(Object.entries(args).filter(([k])=>wooEditableFields[resource(req)].includes(k))),methods:schema.methods ?? []});
}));
router.post(`${base}/resources/:resource`,handler(async(req,res,wc)=>{
  const parsed=CreateWooResourceBody.safeParse(req.body);
  if (!parsed.success) throw new WooError("Datos de creación inválidos",400);
  req.body=parsed.data;
  const r=resource(req);
  if (["orders","customers"].includes(r)) throw new WooError("La creación de pedidos o cuentas se realiza en WooCommerce",403);
  if (req.body.confirmed !== true) throw new WooError("Confirma la creación",400);
  res.status(201).json(await verifiedWooWrite(wc,r,pathFor(req),"POST",req.body.data,req.body.operationId));
}));
router.put(`${base}/resources/:resource/:entityId`,handler(async(req,res,wc)=>{
  const parsed=UpdateWooResourceBody.safeParse(req.body);
  if (!parsed.success) throw new WooError("Datos de actualización inválidos",400);
  req.body=parsed.data;
  if (req.body.confirmed!==true) throw new WooError("Confirma los cambios comerciales",400);
  res.json(await verifiedWooWrite(wc,resource(req),`${pathFor(req)}/${wooId(req.params.entityId)}`,"PUT",req.body.data,req.body.operationId));
}));
router.post(`${base}/uploads`,handler(async(req,res,wc)=>{
  const parsed=RequestWooUploadBody.safeParse(req.body);
  if (!parsed.success) throw new WooError("Metadatos de subida inválidos",400);
  req.body=parsed.data;
  res.status(201).json(await wooUpload(wc.project.id,req.body.name,req.body.size,req.body.contentType));
}));
router.post(`${base}/imports/preview`,handler(async(req,res,wc)=>{
  const parsed=PreviewWooFilesBody.safeParse(req.body);
  if (!parsed.success) throw new WooError("Identificador de subida inválido",400);
  req.body=parsed.data;
  res.status(201).json(await wooImportPreviews(wc.project.id,await previewWooImport(wc.project.id,req.body.uploadId)));
}));
router.get(`${base}/imports/:importId`,handler(async(req,res,wc)=>{
  if (!/^[a-f0-9-]{36}$/.test(String(req.params.importId))) throw new WooError("Importación inválida",400);
  res.json(await wooImportPreviews(wc.project.id,await getWooJson(wc.project.id,`imports/${req.params.importId}.json`)));
}));
router.post(`${base}/imports/:importId/apply`,handler(async(req,res,wc)=>{
  const parsed=ApplyWooFilesBody.safeParse(req.body);
  if (!parsed.success) throw new WooError("Asignaciones o confirmación inválidas",400);
  req.body=parsed.data;
  if (req.body.confirmed!==true || req.body.publicFilesConfirmed!==true) throw new WooError("Confirma las asignaciones y la publicación de los archivos",400);
  const allowed = (process.env.REPLIT_DOMAINS ?? "").split(",").map(v=>v.trim()).filter(Boolean);
  const host=allowed.find(v=>v===req.get("host")) ?? allowed[0];
  const permanentBase=process.env.REPLIT_DEPLOYMENT==="1" && host && /^[a-zA-Z0-9.-]+$/.test(host) ? `https://${host}` : "";
  if(req.body.assignments.some((a:any)=>a.kind==="download") && !permanentBase) throw new WooError("Los descargables necesitan el dominio publicado permanente; no se guardan URLs de desarrollo",422);
  res.json(await applyWooImport(wc,String(req.params.importId),req.body.assignments,permanentBase));
}));
export default router;
