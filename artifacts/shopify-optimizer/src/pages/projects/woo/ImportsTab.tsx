import { useCallback, useEffect, useState } from "react";
import { FileUp, RefreshCw } from "lucide-react";
import { hubBase, req, type HttpError } from "./api";
import { AMBER, Btn, ConfirmDialog, Empty, ErrorBox, GREEN, inputStyle, MUTED, mono, panelStyle, RED, Section, Select, Skeleton, WL } from "./ui";

type Entry = { name: string; size: number; mime: string; previewUrl?:string };
type RowResult = { name: string; state: string; productId: number; variationId?: number; error?: string; mediaId?: number; url?: string };
type Assignment = { name: string; productId: number; variationId?: number; sku?: string; kind: "image" | "download" };
type ImportState = { id: string; state: string; entries: Entry[]; results?: RowResult[]; assignments?: Assignment[] };
type RowForm = { selected: boolean; productId: string; variationId: string; sku: string; kind: "image" | "download" };

const storageKey = (pid: string) => `shopy:woo-hub:${pid}:importId`;
const DONE = ["applied", "done", "verified", "imported", "success"];
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function ImportsTab({ projectId }: { projectId: string }) {
  const [importId, setImportId] = useState<string | null>(() => localStorage.getItem(storageKey(projectId)));
  const [imp, setImp] = useState<ImportState | null>(null);
  const [rows, setRows] = useState<Record<string, RowForm>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<HttpError | string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [confirm, setConfirm] = useState(false);
  const [applying, setApplying] = useState(false);

  const adopt = useCallback((s: ImportState) => {
    setImp(s);
    setRows(prev => {
      const n = { ...prev };
      for (const e of s.entries ?? []) {
        const a=s.assignments?.find(a=>a.name===e.name);
        const result=s.results?.find(r=>r.name===e.name);
        if(a) n[e.name]={selected:!result,productId:String(a.productId),variationId:a.variationId?String(a.variationId):"",sku:a.sku??"",kind:a.kind};
        else if (!n[e.name]) n[e.name] = { selected: false, productId: "", variationId: "", sku: "", kind: e.mime === "application/pdf" ? "download" : "image" };
      }
      return n;
    });
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true); setError(null);
    try { adopt(await req<ImportState>(`${hubBase(projectId)}/imports/${encodeURIComponent(id)}`)); }
    catch (e) { setError(e as HttpError); }
    finally { setLoading(false); }
  }, [projectId, adopt]);

  useEffect(() => { if (importId) load(importId); }, [importId, load]);

  const upload = async (file: File) => {
    setError(null);
    try {
      setPhase("Solicitando URL de subida");
      const up = await req<{ id: string; uploadURL: string }>(`${hubBase(projectId)}/uploads`, { method: "POST", body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }) });
      setPhase(`Subiendo ${file.name} (${kb(file.size)})`);
      const put = await fetch(up.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!put.ok) throw new Error(`La subida directa falló (HTTP ${put.status})`);
      setPhase("Generando vista previa");
      const pv = await req<ImportState>(`${hubBase(projectId)}/imports/preview`, { method: "POST", body: JSON.stringify({ uploadId: up.id }) });
      localStorage.setItem(storageKey(projectId), pv.id);
      setRows({});
      setImportId(pv.id);
      adopt(pv);
    } catch (e) { setError(e as HttpError); }
    finally { setPhase(""); }
  };

  const resultFor = (name: string) => imp?.results?.find(r => r.name === name);
  const locked = (name: string) => { const r = resultFor(name); return !!r && (DONE.includes(r.state) || r.state === "uncertain"); };
  const selected = Object.entries(rows).filter(([n, r]) => r.selected && !locked(n));
  const invalid = selected.filter(([, r]) => !/^\d+$/.test(r.productId) || (r.variationId !== "" && !/^\d+$/.test(r.variationId)));
  const hasDownloads = selected.some(([, r]) => r.kind === "download");
  const setRow = (n: string, p: Partial<RowForm>) => setRows(prev => ({ ...prev, [n]: { ...prev[n], ...p } }));

  const apply = async () => {
    if (!imp) return;
    setConfirm(false); setApplying(true); setError(null);
    try {
      const s = await req<ImportState>(`${hubBase(projectId)}/imports/${encodeURIComponent(imp.id)}/apply`, {
        method: "POST",
        body: JSON.stringify({
          confirmed: true, publicFilesConfirmed: true,
          assignments: imp.assignments ?? selected.map(([name, r]) => ({ name, productId: Number(r.productId), ...(r.variationId ? { variationId: Number(r.variationId) } : {}), ...(r.sku.trim() ? { sku: r.sku.trim() } : {}), kind: r.kind })),
        }),
      });
      adopt(s);
      setRows(prev => Object.fromEntries(Object.entries(prev).map(([n, r]) => [n, { ...r, selected: false }])));
    } catch (e) {
      setError(e as HttpError);
      await load(imp.id); // estado persistente real tras un fallo
    } finally { setApplying(false); }
  };

  const reset = () => { localStorage.removeItem(storageKey(projectId)); setImportId(null); setImp(null); setRows({}); setError(null); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Section title="Importar imágenes y descargables" right={imp && <><Btn onClick={() => load(imp.id)} testId="button-reload-import"><RefreshCw size={13} /> Recargar estado</Btn><Btn onClick={reset} testId="button-new-import">Nueva importación</Btn></>}>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>
          Sube una imagen, un PDF o un ZIP con imágenes/PDF. Nada se asigna por nombre: cada fila necesita un ID de producto explícito (y de variación si aplica). El SKU, si lo indicas, se contrasta con el producto antes de escribir.
          Las imágenes se añaden al final de la galería; el orden se edita desde la ficha del producto.
        </div>
        {!imp && (
          <label style={{ border: `1px dashed ${WL}77`, borderRadius: 12, padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: phase ? "wait" : "pointer", background: "rgba(150,88,138,0.05)" }}>
            <FileUp size={22} color={WL} />
            <span style={{ fontWeight: 700 }}>{phase || "Seleccionar archivo"}</span>
            <span style={{ fontSize: 11.5, color: MUTED }}>.zip, .pdf, .jpg, .png, .webp</span>
            <input type="file" accept=".zip,application/zip,application/pdf,image/*" hidden disabled={!!phase} data-testid="input-import-file"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
          </label>
        )}
        {error && <ErrorBox error={error} />}
      </Section>

      {loading && !imp ? <Skeleton rows={4} /> : imp && (
        <div style={{ ...panelStyle, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
            <span style={mono}>importación {imp.id}</span>
            <span>estado: <b style={{ color: WL }}>{imp.state}</b></span>
            <span style={{ color: MUTED }}>{imp.entries.length} archivo(s) · {selected.length} seleccionado(s)</span>
            <div style={{ marginLeft: "auto" }}>
              <Btn variant="primary" disabled={!selected.length || invalid.length > 0 || applying} onClick={() => setConfirm(true)} testId="button-apply-import">{applying ? "Aplicando…" : `Revisar y aplicar ${selected.length}`}</Btn>
            </div>
          </div>
          {invalid.length > 0 && <div style={{ padding: "0 16px 10px", fontSize: 12, color: AMBER }}>Filas seleccionadas sin ID de producto numérico: {invalid.map(([n]) => n).join(", ")}</div>}
          {imp.entries.length === 0 ? <Empty>El archivo no contiene imágenes ni PDF admitidos.</Empty> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr>{["", "Archivo", "Tipo", "ID producto", "ID variación", "SKU (contraste)", "Resultado"].map(h => <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: MUTED, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {imp.entries.map(e => {
                    const r = rows[e.name]; const res = resultFor(e.name); const lock = locked(e.name) || !!imp.assignments;
                    if (!r) return null;
                    return (
                      <tr key={e.name} data-testid={`row-import-${e.name}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: lock ? 0.75 : 1 }}>
                        <td style={{ padding: "8px 10px" }}><input type="checkbox" checked={r.selected} disabled={lock} onChange={x => setRow(e.name, { selected: x.target.checked })} data-testid={`checkbox-import-${e.name}`} /></td>
                        <td style={{ padding: "8px 10px" }}>
                          {e.previewUrl && e.mime.startsWith("image/") && <img src={e.previewUrl} alt={e.name} loading="lazy" style={{width:56,height:56,objectFit:"contain",background:"#fff",borderRadius:4}} />}
                          <div style={{ fontWeight: 600, wordBreak: "break-all" }}>{e.name}</div><div style={{ fontSize: 11, color: MUTED }}>{e.mime} · {kb(e.size)}</div>
                          {e.previewUrl && <a href={e.previewUrl} target="_blank" rel="noreferrer" style={{color:WL}}>Ver archivo validado</a>}
                        </td>
                        <td style={{ padding: "8px 10px" }}><Select value={r.kind} onChange={v => setRow(e.name, { kind: v as RowForm["kind"] })} testId={`select-import-kind-${e.name}`} options={[{ value: "image", label: "Imagen" }, { value: "download", label: "Descargable" }]} /></td>
                        <td style={{ padding: "8px 10px" }}><input style={{ ...inputStyle, width: 100 }} disabled={lock} value={r.productId} onChange={x => setRow(e.name, { productId: x.target.value.replace(/\D/g, ""), selected: true })} data-testid={`input-import-product-${e.name}`} /></td>
                        <td style={{ padding: "8px 10px" }}><input style={{ ...inputStyle, width: 100 }} disabled={lock} value={r.variationId} placeholder="opcional" onChange={x => setRow(e.name, { variationId: x.target.value.replace(/\D/g, "") })} data-testid={`input-import-variation-${e.name}`} /></td>
                        <td style={{ padding: "8px 10px" }}><input style={{ ...inputStyle, width: 130 }} disabled={lock} value={r.sku} placeholder="opcional" onChange={x => setRow(e.name, { sku: x.target.value })} data-testid={`input-import-sku-${e.name}`} /></td>
                        <td style={{ padding: "8px 10px", minWidth: 180 }}>
                          {!res ? <span style={{ color: MUTED }}>{r.selected ? "Pendiente de aplicar" : "Ignorada"}</span> : (
                            <div>
                              <b style={{ color: DONE.includes(res.state) ? GREEN : res.state === "uncertain" ? AMBER : RED }}>{res.state}</b>
                              <span style={{ ...mono, fontSize: 11, color: MUTED }}> p#{res.productId}{res.variationId ? ` v#${res.variationId}` : ""}{res.mediaId ? ` media#${res.mediaId}` : ""}</span>
                              {res.url && <div><a href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: WL, ...mono, wordBreak: "break-all" }}>{res.url}</a></div>}
                              {res.error && <div style={{ fontSize: 11.5, color: RED }}>{res.error}</div>}
                              {res.state === "uncertain" && <div style={{ fontSize: 11, color: AMBER }}>Bloqueada para no duplicar: revisa el producto en WooCommerce.</div>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={confirm} title={`Aplicar ${selected.length} archivo(s) a productos reales`} onCancel={() => setConfirm(false)} onConfirm={apply}
        requireCheck={hasDownloads ? "Confirmo que los PDF quedarán como enlace público permanente para quien compre o acceda al producto." : "Confirmo las asignaciones revisadas arriba."}>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {selected.map(([n, r]) => <li key={n}><span style={mono}>{n}</span> como {r.kind === "image" ? "imagen" : "descargable"} en producto #{r.productId}{r.variationId ? ` variación #${r.variationId}` : ""}{r.sku ? ` (SKU ${r.sku})` : ""}</li>)}
        </ul>
        <div style={{ marginTop: 8, fontSize: 11.5, color: MUTED }}>Las filas no seleccionadas se ignoran. Si algo falla, el resultado parcial se conserva y podrás reanudar.</div>
      </ConfirmDialog>
    </div>
  );
}
