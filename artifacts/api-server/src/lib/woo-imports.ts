import AdmZip from "adm-zip";
import sharp from "sharp";
import { inflateRawSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { WooClient, WooError, wooId } from "./woo-client.js";
import { downloadWooUpload, getWooJson, putWooJson, wooObject } from "./woo-storage.js";
import { verifiedWooWrite } from "./woo-catalog.js";
import { signObjectURL } from "./objectStorage.js";

const MB = 1024 * 1024;
const MAX_FILE = 10*MB, MAX_EXPANDED = 80*MB;
const reject = (message:string): never => { throw new WooError(message,400); };
function crc32(buf: Buffer) {
  let crc = -1;
  for (const b of buf) {
    crc ^= b;
    for (let i=0;i<8;i++) crc = (crc>>>1) ^ (0xedb88320 & -(crc&1));
  }
  return (crc ^ -1)>>>0;
}
export function unpackWooZip(bytes: Buffer): Array<{name:string;bytes:Buffer}> {
  if (bytes.length > 20*MB) reject("ZIP demasiado grande");
  // Validate central-directory count before instantiating a parser; no ZIP64 or multi-disk.
  let end = -1;
  for (let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if (bytes.readUInt32LE(i) === 0x06054b50) { end=i; break; }
  if (end<0 || bytes.readUInt16LE(end+4) || bytes.readUInt16LE(end+6) || bytes.readUInt16LE(end+8)!==bytes.readUInt16LE(end+10) || bytes.readUInt16LE(end+10)>100 || bytes.readUInt32LE(end+16)===0xffffffff) reject("ZIP inválido, ZIP64 o demasiadas entradas");
  const files: Array<{name:string;bytes:Buffer}> = [], seen = new Set<string>();
  let expanded = 0;
  const zip = new AdmZip(bytes);
  const entries=zip.getEntries();
  if (entries.length!==bytes.readUInt16LE(end+10)) reject("Directorio ZIP inconsistente");
  for (const e of entries) {
    const name = e.rawEntryName.toString("utf8");
    if (!name || name.length>200 || /[\\\x00-\x1f:]/.test(name) || name.startsWith("/") || name.split("/").some(p=>p===".."||p==="."||p==="")) {
      // A single trailing slash is the only allowed empty segment for directories.
      if (!(e.isDirectory && /^[a-zA-Z0-9 _./-]+\/$/.test(name) && !name.slice(0,-1).split("/").some(p=>p===".."||p==="."||p==="") && !name.startsWith("/"))) reject("Ruta peligrosa en ZIP");
    }
    if (((e.attr >>> 16) & 0xf000) === 0xa000) reject("No se admiten enlaces simbólicos");
    if (e.header.flags & 1) reject("No se admiten ZIP cifrados");
    if (e.isDirectory) continue;
    if (seen.has(name.toLowerCase())) reject("Nombres duplicados o ambiguos en ZIP");
    seen.add(name.toLowerCase());
    if (!/\.(png|jpe?g|webp|pdf)$/i.test(name)) reject("ZIP contiene archivos no admitidos; no se admiten ZIP anidados, código, temas ni plugins");
    if (e.header.size < 1 || e.header.size > MAX_FILE || e.header.size/Math.max(1,e.header.compressedSize)>100) reject("Archivo demasiado grande o ratio de expansión peligroso");
    expanded += e.header.size;
    if (expanded > MAX_EXPANDED) reject("ZIP supera 80 MiB expandidos");
    let data: Buffer;
    try {
      const compressed = e.getCompressedData();
      data = e.header.method === 0 ? compressed : e.header.method === 8 ? inflateRawSync(compressed,{maxOutputLength:MAX_FILE}) : reject("Compresión ZIP no admitida");
    } catch { reject("ZIP corrupto o expansión excesiva"); }
    if (data!.length !== e.header.size || crc32(data!) !== (e.header.crc>>>0)) reject("Integridad ZIP incorrecta");
    files.push({name,bytes:data!});
  }
  if (!files.length) reject("ZIP vacío");
  return files;
}
async function validateFile(name: string, bytes: Buffer) {
  if (!bytes.length || bytes.length>MAX_FILE) reject("Cada archivo admite hasta 10 MiB");
  if (/\.pdf$/i.test(name)) {
    if (bytes.subarray(0,5).toString()!=="%PDF-" || /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(bytes.toString("latin1"))) reject("PDF inválido o con contenido activo no admitido");
    return { mime:"application/pdf",bytes };
  }
  const metadata = await sharp(bytes,{limitInputPixels:40_000_000}).metadata().catch(()=>reject("Imagen no válida"));
  const expected = /\.png$/i.test(name) ? "png" : /\.webp$/i.test(name) ? "webp" : /\.jpe?g$/i.test(name) ? "jpeg" : "";
  if (metadata.format !== expected || (metadata.pages ?? 1)>1) reject("Extensión o formato de imagen no admitido");
  // Decode and re-encode: discard embedded metadata and payloads before publishing.
  const cleaned = await sharp(bytes,{limitInputPixels:40_000_000}).toFormat(expected as "png"|"jpeg"|"webp").toBuffer();
  return { mime:`image/${expected}`,bytes:cleaned };
}
export async function previewWooImport(projectId:number, uploadId:string) {
  const {meta,bytes} = await downloadWooUpload(projectId,uploadId);
  const entries = /\.zip$/i.test(meta.name) ? unpackWooZip(bytes) : [{name:meta.name,bytes}];
  const id = randomUUID(), rows = [];
  for (let index=0; index<entries.length;index++) {
    const entry = entries[index]!;
    const file = await validateFile(entry.name,entry.bytes);
    await wooObject(projectId,`imports/${id}/files/${index}`).save(file.bytes,{contentType:file.mime,resumable:false});
    rows.push({name:entry.name,size:file.bytes.length,mime:file.mime,index,token:randomUUID()});
  }
  const manifest = {id,state:"preview",createdAt:new Date().toISOString(),entries:rows,results:[] as any[]};
  await putWooJson(projectId,`imports/${id}.json`,manifest,true);
  return manifest;
}
export async function wooImportPreviews(projectId:number,manifest:any) {
  const entries=await Promise.all(manifest.entries.map(async(e:any)=>{
    const file=wooObject(projectId,`imports/${manifest.id}/files/${e.index}`);
    const previewUrl=await signObjectURL({bucketName:file.bucket.name,objectName:file.name,method:"GET",ttlSec:300});
    return {...e,previewUrl};
  }));
  return {...manifest,entries};
}
export async function applyWooImport(wc:WooClient,id:string,assignments:any[], publicBase:string) {
  if (!/^[a-f0-9-]{36}$/.test(id) || !Array.isArray(assignments) || !assignments.length || assignments.length>100) reject("Asignaciones inválidas");
  const manifest = await getWooJson(wc.project.id,`imports/${id}.json`);
  const selected = new Set<string>();
  const resolved = [];
  // Validate ALL assignments before starting any business write.
  for (const a of assignments) {
    if (!a || typeof a.name!=="string" || selected.has(a.name)) reject("Asignación duplicada o inválida");
    selected.add(a.name);
    const entry = manifest.entries.find((e:any)=>e.name===a.name);
    if (!entry || !["image","download"].includes(a.kind) || (a.kind==="image" && !entry.mime.startsWith("image/"))) reject("Tipo o archivo inválido");
    const pid = wooId(a.productId), vid = a.variationId == null ? undefined : wooId(a.variationId);
    const path = vid ? `/products/${pid}/variations/${vid}` : `/products/${pid}`;
    const p = await wc.request("GET",path);
    if (a.sku && a.sku!==p.sku) reject("El SKU no coincide con el recurso seleccionado");
    resolved.push({a,entry,path,p,pid,vid});
  }
  // Immutable mapping on first apply; retries may not silently redirect files to other products.
  const mappingKey = `imports/${id}/mapping.json`;
  try { await putWooJson(wc.project.id,mappingKey,assignments,true); }
  catch (e:any) {
    if (e.code!==412) throw e;
    if (JSON.stringify(await getWooJson(wc.project.id,mappingKey))!==JSON.stringify(assignments)) throw new WooError("La importación ya tiene otra asignación confirmada",409);
  }
  // Generation-match lock; if a process dies, the in-flight row remains uncertain, never replayed.
  const lock = wooObject(wc.project.id,`imports/${id}/lock`);
  try { await lock.save("",{resumable:false,preconditionOpts:{ifGenerationMatch:0}}); }
  catch (e:any) { if (e.code===412) throw new WooError("Importación en curso o interrumpida; revisa las filas inciertas",409); throw e; }
  try {
    manifest.assignments=assignments;
    manifest.state="applying";
    await putWooJson(wc.project.id,`imports/${id}.json`,manifest);
    for (const {a,entry,path,pid,vid} of resolved) {
      let row = manifest.results.find((r:any)=>r.name===a.name);
      if (row?.state==="verified" || row?.state==="uncertain") continue;
      row = {name:a.name,productId:pid,variationId:vid,state:"uncertain"};
      manifest.results = manifest.results.filter((r:any)=>r.name!==a.name).concat(row);
      await putWooJson(wc.project.id,`imports/${id}.json`,manifest);
      try {
        const current = await wc.request("GET",path);
        const file = wooObject(wc.project.id,`imports/${id}/files/${entry.index}`);
        const [b] = await file.download();
        let url:string;
        if(a.kind==="image") {
          // Temporary source is ONLY for WC ingestion. Only the WC-owned URL is
          // recorded as the successful image result, never this signed URL.
          url=await signObjectURL({bucketName:file.bucket.name,objectName:file.name,method:"GET",ttlSec:900});
        } else {
          if(!publicBase) throw new WooError("Los descargables necesitan el dominio publicado permanente; no se publican enlaces de desarrollo",422);
          await wooObject(wc.project.id,`published/${entry.token}`).save(b,{contentType:entry.mime,resumable:false});
          await putWooJson(wc.project.id,`published/${entry.token}.json`,{mime:entry.mime,name:entry.name});
          url=`${publicBase}/api/woo-media/${wc.project.id}/${entry.token}`;
        }
        const images = (current.images ?? []).map((i:any)=>({id:i.id}));
        const payload = a.kind==="image"
          ? vid ? {image:{src:url}} : {images:[...images,{src:url}]}
          : {downloadable:true,downloads:[...(current.downloads??[]).map((d:any)=>({id:d.id,name:d.name,file:d.file})),{name:entry.name,file:url}]};
        const written = await verifiedWooWrite(wc,vid?"variations":"products",path,"PUT",payload,randomUUID());
        const read = written.result;
        if (a.kind==="image") {
          const media = vid ? read.image : read.images?.at(-1);
          if (!media?.id || !media.src || media.src===url) throw new WooError("WooCommerce no confirmó una imagen persistente");
          row.mediaId=media.id; row.url=media.src;
        } else {
          if (!read.downloads?.some((d:any)=>d.file===url)) throw new WooError("WooCommerce no confirmó el archivo");
          row.url=url;
        }
        row.state="verified";
      } catch (e:any) {
        row.error = e instanceof WooError ? e.message : "Falló la importación; comprobar el recurso antes de repetir";
        // A pre-write failure could be retried but conservatively keep uncertain.
        row.state="uncertain";
      }
      await putWooJson(wc.project.id,`imports/${id}.json`,manifest);
    }
    manifest.state = manifest.results.every((r:any)=>r.state==="verified") ? "verified" : "partial";
    await putWooJson(wc.project.id,`imports/${id}.json`,manifest);
    return manifest;
  } finally { await lock.delete().catch(()=>{}); }
}
