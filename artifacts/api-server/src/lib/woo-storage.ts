import { randomUUID } from "node:crypto";
import { objectStorageClient, ObjectStorageService, signObjectURL } from "./objectStorage.js";
import { WooError } from "./woo-client.js";

/** JSON metadata and file bytes stay in existing App Storage, never PostgreSQL. */
export function wooObject(projectId: number, key: string) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(key) || key.includes("..")) throw new WooError("Clave inválida", 400);
  const root = new ObjectStorageService().getPrivateObjectDir().replace(/^\//, "");
  const [bucket, ...prefix] = root.split("/");
  return objectStorageClient.bucket(bucket!).file([...prefix, "woo", String(projectId), key].join("/"));
}
export async function putWooJson(projectId: number, key: string, value: unknown, createOnly = false) {
  await wooObject(projectId, key).save(JSON.stringify(value), {
    contentType: "application/json", resumable: false,
    ...(createOnly ? { preconditionOpts: { ifGenerationMatch: 0 } } : {}),
  });
}
export async function getWooJson<T = any>(projectId: number, key: string): Promise<T> {
  try { const [b] = await wooObject(projectId, key).download(); return JSON.parse(b.toString()); }
  catch (e: any) { if (e.code === 404) throw new WooError("Archivo u operación no encontrado",404); throw e; }
}
export async function wooUpload(projectId: number, name: string, size: number, contentType: string) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 20 * 1024 * 1024) throw new WooError("Límite de subida: 20 MiB", 400);
  if (!/\.(zip|png|jpe?g|webp|pdf)$/i.test(name)) throw new WooError("Solo ZIP, PNG, JPEG, WebP o PDF",400);
  const id = randomUUID();
  const file = wooObject(projectId, `uploads/${id}`);
  await putWooJson(projectId, `uploads/${id}.json`, { id, name: name.slice(0,200), size, contentType, createdAt: new Date().toISOString() }, true);
  const uploadURL = await signObjectURL({ bucketName: file.bucket.name, objectName:file.name, method:"PUT", ttlSec:900 });
  return { id, uploadURL };
}
export async function downloadWooUpload(projectId: number, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new WooError("Archivo inválido",400);
  const meta = await getWooJson(projectId, `uploads/${id}.json`);
  const file = wooObject(projectId,`uploads/${id}`);
  const [remote] = await file.getMetadata();
  if (Number(remote.size) !== meta.size || Number(remote.size) > 20*1024*1024) throw new WooError("Tamaño de subida incorrecto",400);
  const [bytes] = await file.download();
  return { meta, bytes };
}
