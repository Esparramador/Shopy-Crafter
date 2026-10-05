import { useCallback, useEffect, useState } from "react";
import {
  S, SL, api, fmtDate, priceText, CURRENCIES, AssociationFields, assocPayload, AssocBadge, Notice,
  type Association, type CatalogProduct,
} from "./shared";

type PriceRow = { amount: string; currency: string; interval: string; intervalCount: string; nickname: string; taxBehavior: string };
const emptyPrice = (currency = "eur"): PriceRow => ({ amount: "", currency, interval: "", intervalCount: "1", nickname: "", taxBehavior: "unspecified" });

function toPricePayload(r: PriceRow) {
  return {
    amount: r.amount,
    currency: r.currency,
    interval: r.interval || null,
    intervalCount: r.interval ? Number(r.intervalCount || 1) : null,
    nickname: r.nickname || undefined,
    taxBehavior: r.taxBehavior,
  };
}

function PriceFields({ row, onChange, onRemove }: { row: PriceRow; onChange: (r: PriceRow) => void; onRemove?: () => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 1.3fr 80px 1.2fr 1.2fr auto", gap: 8, alignItems: "end" }}>
      <div>
        <label style={S.lbl}>Precio *</label>
        <input style={S.inp} inputMode="decimal" placeholder="29,90" value={row.amount} onChange={e => onChange({ ...row, amount: e.target.value })} />
      </div>
      <div>
        <label style={S.lbl}>Moneda</label>
        <select style={S.sel} value={row.currency} onChange={e => onChange({ ...row, currency: e.target.value })}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
      </div>
      <div>
        <label style={S.lbl}>Cobro</label>
        <select style={S.sel} value={row.interval} onChange={e => onChange({ ...row, interval: e.target.value })}>
          <option value="">Pago único</option>
          <option value="day">Diario</option>
          <option value="week">Semanal</option>
          <option value="month">Mensual</option>
          <option value="year">Anual</option>
        </select>
      </div>
      <div>
        <label style={S.lbl}>Cada</label>
        <input style={S.inp} type="number" min={1} disabled={!row.interval} value={row.interval ? row.intervalCount : ""} onChange={e => onChange({ ...row, intervalCount: e.target.value })} title="Ej.: cada 3 meses = trimestral" />
      </div>
      <div>
        <label style={S.lbl}>Nombre interno</label>
        <input style={S.inp} placeholder="Ej.: Tarifa anual" value={row.nickname} onChange={e => onChange({ ...row, nickname: e.target.value })} />
      </div>
      <div>
        <label style={S.lbl}>Impuestos</label>
        <select style={S.sel} value={row.taxBehavior} onChange={e => onChange({ ...row, taxBehavior: e.target.value })} title="Solo afecta si usas Stripe Tax">
          <option value="unspecified">Según ajustes de Stripe</option>
          <option value="inclusive">IVA incluido</option>
          <option value="exclusive">IVA aparte</option>
        </select>
      </div>
      <div>{onRemove && <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={onRemove} aria-label="Quitar precio">✕</button>}</div>
    </div>
  );
}

function ImagesField({ images, onChange }: { images: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <label style={S.lbl}>Fotos (URL pública https, máx. 8)</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {images.map((u, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {u && <img src={u} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, background: "#222" }} onError={e => { (e.target as HTMLImageElement).style.opacity = "0.2"; }} />}
            <input style={S.inp} value={u} placeholder="https://…/foto.jpg" onChange={e => onChange(images.map((x, j) => j === i ? e.target.value : x))} />
            <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="Quitar foto">✕</button>
          </div>
        ))}
        {images.length < 8 && <button style={{ ...S.btn, ...S.btnG, ...S.btnSm, alignSelf: "flex-start" }} onClick={() => onChange([...images, ""])}>+ Añadir foto</button>}
      </div>
      <div style={S.hint}>Stripe muestra la primera foto en la página de pago, en la tarjeta compartible y en los recibos.</div>
    </div>
  );
}

function ProductEditor({ projectId, product, onSaved, onReload, onClose }: { projectId: number; product: CatalogProduct; onSaved: (p: CatalogProduct) => void; onReload: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [images, setImages] = useState<string[]>(product.images);
  const [assoc, setAssoc] = useState<Association>({ type: product.metadata?.sc_ref_type ?? "", ref: product.metadata?.sc_ref ?? "" });
  const [newPrice, setNewPrice] = useState<PriceRow>(emptyPrice(product.prices[0]?.currency ?? "eur"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const base = `/admin/stripe/project/${projectId}/catalog`;
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const d = await api<{ product: CatalogProduct }>(`${base}/products/${product.id}`, {
        method: "PATCH",
        body: { name, description, images: images.filter(Boolean), association: assocPayload(assoc) ?? { type: "", ref: "" } },
      });
      onSaved(d.product);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const addPrice = async (makeDefault: boolean) => {
    setBusy(true); setErr("");
    try {
      await api(`${base}/products/${product.id}/prices`, { method: "POST", body: { ...toPricePayload(newPrice), makeDefault } });
      await onReload();
      setNewPrice(emptyPrice(newPrice.currency));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div style={{ ...S.sub, marginTop: 12, borderColor: "rgba(99,91,255,0.35)" }}>
      {err && <Notice kind="err" onClose={() => setErr("")}>{err}</Notice>}
      <div style={S.grid2}>
        <div><label style={S.lbl}>Nombre *</label><input style={S.inp} value={name} onChange={e => setName(e.target.value)} /></div>
        <div><label style={S.lbl}>Descripción</label><input style={S.inp} value={description} onChange={e => setDescription(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 12 }}><ImagesField images={images} onChange={setImages} /></div>
      <div style={{ marginTop: 12 }}><AssociationFields value={assoc} onChange={setAssoc} help="Asocia el producto (p. ej. al servicio o cliente). Se guarda en Stripe." /></div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={{ ...S.btn, ...S.btnP }} disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar cambios"}</button>
        <button style={{ ...S.btn, ...S.btnG }} onClick={onClose}>Cerrar</button>
      </div>
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ ...S.sectionTitle, marginBottom: 8 }}>Nuevo precio</div>
        <div style={S.hint}>En Stripe el importe de un precio no se puede modificar: para cambiarlo crea uno nuevo, márcalo por defecto y archiva el anterior. Los clientes ya suscritos conservan su precio.</div>
        <div style={{ marginTop: 10 }}><PriceFields row={newPrice} onChange={setNewPrice} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ ...S.btn, ...S.btnG }} disabled={busy || !newPrice.amount} onClick={() => addPrice(false)}>Añadir precio</button>
          <button style={{ ...S.btn, ...S.btnP }} disabled={busy || !newPrice.amount} onClick={() => addPrice(true)}>Añadir y usar por defecto</button>
        </div>
      </div>
    </div>
  );
}

export default function CatalogTab({ projectId, onCreateLink }: { projectId: number; onCreateLink: (priceId: string) => void }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", unitLabel: "" });
  const [images, setImages] = useState<string[]>([""]);
  const [prices, setPrices] = useState<PriceRow[]>([emptyPrice()]);
  const [defaultIndex, setDefaultIndex] = useState(0);
  const [assoc, setAssoc] = useState<Association>({ type: "", ref: "" });

  const base = `/admin/stripe/project/${projectId}/catalog`;
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const d = await api<{ data: CatalogProduct[] }>(`${base}${showArchived ? "?archived=1" : ""}`);
      setProducts(d.data);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [base, showArchived]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const d = await api<{ product: CatalogProduct }>(`${base}/products`, {
        method: "POST",
        body: {
          name: form.name, description: form.description || undefined, unitLabel: form.unitLabel || undefined,
          images: images.filter(Boolean),
          prices: prices.filter(p => p.amount).map(toPricePayload),
          defaultIndex,
          association: assocPayload(assoc),
        },
      });
      setMsg(`Producto «${d.product.name}» creado en Stripe con ${d.product.prices.length} precio(s).`);
      setForm({ name: "", description: "", unitLabel: "" }); setImages([""]); setPrices([emptyPrice()]); setDefaultIndex(0); setAssoc({ type: "", ref: "" });
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const patchProduct = async (p: CatalogProduct, body: Record<string, unknown>, ok: string) => {
    setErr(""); setMsg("");
    try {
      const d = await api<{ product: CatalogProduct }>(`${base}/products/${p.id}`, { method: "PATCH", body });
      const np = { ...d.product, prices: showArchived ? d.product.prices : d.product.prices.filter(pr => pr.active) };
      setProducts(prev => prev.map(x => x.id === p.id ? np : x).filter(x => showArchived || x.active));
      setMsg(ok);
    } catch (e) { setErr((e as Error).message); }
  };
  const patchPrice = async (priceId: string, body: Record<string, unknown>, ok: string) => {
    setErr(""); setMsg("");
    try { await api(`${base}/prices/${priceId}`, { method: "PATCH", body }); setMsg(ok); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      {err && <Notice kind="err" onClose={() => setErr("")}>{err}</Notice>}
      {msg && <Notice kind="ok" onClose={() => setMsg("")}>{msg}</Notice>}

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.sectionTitle}>➕ Nuevo producto o servicio</div>
        <div style={S.grid2}>
          <div><label style={S.lbl}>Nombre *</label><input style={S.inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej.: Paella para 4 personas" /></div>
          <div><label style={S.lbl}>Descripción</label><input style={S.inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Aparece en la página de pago" /></div>
          <div><label style={S.lbl}>Unidad (opcional)</label><input style={S.inp} maxLength={12} value={form.unitLabel} onChange={e => setForm(f => ({ ...f, unitLabel: e.target.value }))} placeholder="persona, hora, kg…" /></div>
        </div>
        <div style={{ marginTop: 12 }}><ImagesField images={images} onChange={setImages} /></div>
        <div style={{ marginTop: 14 }}>
          <label style={S.lbl}>Precios</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {prices.map((row, i) => (
              <div key={i}>
                <PriceFields row={row} onChange={r => setPrices(ps => ps.map((x, j) => j === i ? r : x))} onRemove={prices.length > 1 ? () => { setPrices(ps => ps.filter((_, j) => j !== i)); setDefaultIndex(0); } : undefined} />
                {prices.length > 1 && (
                  <label style={{ fontSize: 12, color: "rgba(240,237,230,0.6)", display: "inline-flex", gap: 6, marginTop: 4 }}>
                    <input type="radio" checked={defaultIndex === i} onChange={() => setDefaultIndex(i)} /> Precio por defecto
                  </label>
                )}
              </div>
            ))}
            <button style={{ ...S.btn, ...S.btnG, ...S.btnSm, alignSelf: "flex-start" }} onClick={() => setPrices(ps => [...ps, emptyPrice(ps[0]?.currency)])}>+ Otro precio (p. ej. mensual y anual)</button>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><AssociationFields value={assoc} onChange={setAssoc} /></div>
        <button style={{ ...S.btn, ...S.btnP, marginTop: 14 }} disabled={busy || !form.name} onClick={create}>{busy ? "Creando en Stripe…" : "Crear producto"}</button>
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
          <div style={{ ...S.title, marginBottom: 0 }}>📦 Catálogo ({products.length})</div>
          <label style={{ fontSize: 12, color: "rgba(240,237,230,0.6)", display: "inline-flex", gap: 6 }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Mostrar archivados
          </label>
        </div>
        {loading ? <div style={S.empty}>Cargando catálogo de Stripe…</div> : products.length === 0 ? <div style={S.empty}>Sin productos todavía</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {products.map(p => (
              <div key={p.id} style={{ ...S.sub, opacity: p.active ? 1 : 0.6 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", background: "rgba(99,91,255,0.12)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: SL, fontWeight: 800, fontSize: 22 }}>
                    {p.images[0] ? <img src={p.images[0]} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                      {!p.active && <span style={{ ...S.tag, background: "rgba(156,163,175,0.15)", color: "#9ca3af" }}>Archivado</span>}
                      <AssocBadge metadata={p.metadata} />
                    </div>
                    {p.description && <div style={{ fontSize: 12, color: "rgba(240,237,230,0.55)", marginTop: 2 }}>{p.description}</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                      {p.prices.length === 0 && <span style={{ fontSize: 12, color: "#fbbf24" }}>Sin precios: añade uno para poder venderlo.</span>}
                      {p.prices.map(pr => (
                        <div key={pr.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", opacity: pr.active ? 1 : 0.55 }}>
                          <span style={S.tag}>{priceText(pr)}</span>
                          {pr.nickname && <span style={{ fontSize: 12, color: "rgba(240,237,230,0.55)" }}>{pr.nickname}</span>}
                          {p.defaultPriceId === pr.id && <span style={{ ...S.tag, background: "rgba(52,211,153,0.12)", color: "#34d399" }}>Por defecto</span>}
                          {!pr.active && <span style={{ fontSize: 11, color: "#9ca3af" }}>archivado</span>}
                          {pr.active && p.active && <button style={{ ...S.btn, ...S.btnP, ...S.btnSm }} onClick={() => onCreateLink(pr.id)}>🔗 Enlace de pago</button>}
                          {pr.active && p.defaultPriceId !== pr.id && <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => patchProduct(p, { defaultPriceId: pr.id }, "Precio por defecto actualizado")}>Usar por defecto</button>}
                          {pr.active && p.defaultPriceId !== pr.id && <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => patchPrice(pr.id, { active: false }, "Precio archivado: ya no se puede comprar, los suscriptores actuales lo mantienen")}>Archivar</button>}
                          {!pr.active && <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => patchPrice(pr.id, { active: true }, "Precio reactivado")}>Reactivar</button>}
                          <code style={S.code}>{pr.id}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => setEditing(editing === p.id ? null : p.id)}>✏️ Editar</button>
                    {p.active
                      ? <button style={{ ...S.btn, ...S.btnD, ...S.btnSm }} onClick={() => { if (confirm(`¿Archivar «${p.name}»? Dejará de poder comprarse; el historial se conserva.`)) void patchProduct(p, { active: false }, "Producto archivado"); }}>Archivar</button>
                      : <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => patchProduct(p, { active: true }, "Producto reactivado")}>Reactivar</button>}
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{fmtDate(p.created)}</span>
                  </div>
                </div>
                {editing === p.id && (
                  <ProductEditor projectId={projectId} product={p}
                    onSaved={np => { setProducts(prev => prev.map(x => x.id === np.id ? { ...np, prices: showArchived ? np.prices : np.prices.filter(pr => pr.active) } : x)); setMsg("Producto actualizado en Stripe"); }}
                    onReload={load}
                    onClose={() => setEditing(null)} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
