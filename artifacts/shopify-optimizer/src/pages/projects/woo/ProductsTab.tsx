import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { fmt, fmtDateShort, SearchBar, Table } from "@/components/commerce/hub-kit";
import { money, stripHtml, useDetail, useList, useSchema, useWrite, type ResourceName } from "./api";
import { Badge, Btn, ConfirmDialog, Drawer, Empty, ErrorBox, Field, Grid, inputStyle, ListMeta, MUTED, mono, panelStyle, Section, SchemaExtras, Select, Skeleton, Toolbar, WL, WriteStatus, AMBER } from "./ui";

type Img = { id?: number; src: string; alt?: string; name?: string };
type Attr = { id: number; name: string; options: string[]; visible: boolean; variation: boolean };
type Cat = { id: number; name?: string };
type PForm = { name: string; type: string; status: string; sku: string; regular_price: string; sale_price: string; description: string; short_description: string; manage_stock: boolean; stock_quantity: string; stock_status: string; categories: Cat[]; images: Img[]; attributes: Attr[] };

const EMPTY: PForm = { name: "", type: "simple", status: "draft", sku: "", regular_price: "", sale_price: "", description: "", short_description: "", manage_stock: false, stock_quantity: "", stock_status: "instock", categories: [], images: [], attributes: [] };
const CORE = ["name", "type", "status", "sku", "regular_price", "sale_price", "description", "short_description", "manage_stock", "stock_quantity", "stock_status", "categories", "images", "attributes", "price", "id"];
const PER = 20;

const fromWoo = (p: any): PForm => ({
  name: p.name ?? "", type: p.type ?? "simple", status: p.status ?? "draft", sku: p.sku ?? "",
  regular_price: p.regular_price ?? "", sale_price: p.sale_price ?? "", description: p.description ?? "", short_description: p.short_description ?? "",
  manage_stock: !!p.manage_stock, stock_quantity: p.stock_quantity == null ? "" : String(p.stock_quantity), stock_status: p.stock_status ?? "instock",
  categories: (p.categories ?? []).map((c: any) => ({ id: c.id, name: c.name })),
  images: (p.images ?? []).map((i: any) => ({ id: i.id, src: i.src, alt: i.alt, name: i.name })),
  attributes: (p.attributes ?? []).map((a: any) => ({ id: a.id ?? 0, name: a.name ?? "", options: a.options ?? [], visible: a.visible ?? true, variation: !!a.variation })),
});

const toPayload = (f: PForm, extras: Record<string, unknown>) => {
  const d: Record<string, unknown> = {
    ...extras,
    name: f.name, type: f.type, status: f.status, sku: f.sku, description: f.description, short_description: f.short_description,
    manage_stock: f.manage_stock, stock_status: f.stock_status,
    categories: f.categories.map(c => ({ id: c.id })),
    images: f.images.map(i => (i.id ? { id: i.id } : { src: i.src, alt: i.alt ?? "" })),
    attributes: f.attributes.map((a, position) => ({ ...(a.id ? { id: a.id } : { name: a.name }), options: a.options, visible: a.visible, variation: a.variation, position })),
  };
  if (f.manage_stock) d.stock_quantity = f.stock_quantity === "" ? null : Number(f.stock_quantity);
  if (f.type !== "variable") { d.regular_price = f.regular_price; d.sale_price = f.sale_price; }
  return d;
};

export function ProductsTab({ projectId, currency }: { projectId: string; currency?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);
  const list = useList<any>(projectId, "products", { page, per_page: PER, search: q, status });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o SKU" />
        <Select value={status} onChange={v => { setStatus(v); setPage(1); }} testId="select-product-status"
          options={[{ value: "", label: "Todos los estados" }, { value: "publish", label: "Publicado" }, { value: "draft", label: "Borrador" }, { value: "pending", label: "Pendiente" }, { value: "private", label: "Privado" }]} />
        <div style={{ marginLeft: "auto" }}><Btn variant="primary" onClick={() => setEditing("new")} testId="button-new-product"><Plus size={14} /> Nuevo producto</Btn></div>
      </Toolbar>
      <div style={{ ...panelStyle, overflow: "hidden" }}>
        {list.loading ? <Skeleton /> : list.error ? <div style={{ padding: 14 }}><ErrorBox error={list.error} onRetry={list.reload} /></div> : list.data && (
          <>
            {list.data.data.length === 0 ? <Empty>{q || status ? "Ningún producto coincide con estos filtros." : "La tienda no tiene productos todavía."}</Empty> : (
              <Table cols={["Producto", "Tipo", "SKU", "Precio", "Stock", "Estado", "Modificado", ""]}
                rows={list.data.data.map((p: any) => [
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }} data-testid={`row-product-${p.id}`}>
                    {p.images?.[0]?.src ? <img src={p.images[0].src} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} /> : <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />}
                    <div><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 11, color: MUTED, ...mono }}>ID {p.id}{p.categories?.length ? ` · ${p.categories.map((c: any) => c.name).join(", ")}` : ""}</div></div>
                  </div>,
                  <Badge status={p.type} />,
                  <span style={{ ...mono, fontSize: 11, color: MUTED }}>{p.sku || "—"}</span>,
                  <div><div style={{ fontWeight: 700, color: WL }}>{money(fmt, p.price, currency)}</div>{p.sale_price && <div style={{ fontSize: 11, color: AMBER }}>Oferta, normal {money(fmt, p.regular_price, currency)}</div>}</div>,
                  <div><Badge status={p.stock_status} />{p.manage_stock && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{p.stock_quantity ?? "—"} uds.</div>}</div>,
                  <Badge status={p.status} />,
                  <span style={{ fontSize: 11, color: MUTED }}>{fmtDateShort(p.date_modified)}</span>,
                  <Btn variant="soft" onClick={() => setEditing(p.id)} testId={`button-edit-product-${p.id}`}><Pencil size={12} /> Editar</Btn>,
                ])} emptyMsg="" />
            )}
            <ListMeta meta={list.data} perPage={PER} onPage={setPage} />
          </>
        )}
      </div>
      {editing !== null && (
        <ProductEditor key={String(editing)} projectId={projectId} id={editing === "new" ? null : editing} currency={currency}
          onClose={() => setEditing(null)} onSaved={id => { list.reload(); setEditing(id); }} />
      )}
    </div>
  );
}

function ProductEditor({ projectId, id, currency, onClose, onSaved }: { projectId: string; id: number | null; currency?: string; onClose: () => void; onSaved: (id: number) => void }) {
  const detail = useDetail<any>(projectId, "products", id);
  const schema = useSchema(projectId, "products", undefined, id ?? undefined);
  const [f, setF] = useState<PForm>(EMPTY);
  const [extras, setExtras] = useState<Record<string, unknown>>({});
  const dirty = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const w = useWrite(projectId);

  useEffect(() => { if (detail.data && !dirty.current) setF(fromWoo(detail.data)); }, [detail.data]);
  const set = <K extends keyof PForm>(k: K, v: PForm[K]) => { dirty.current = true; setF(prev => ({ ...prev, [k]: v })); };

  const save = async () => {
    setConfirm(false);
    const r = await w.run("products", id, toPayload(f, extras));
    if (r) {
      dirty.current = false;
      setExtras({});
      if (r.result) setF(fromWoo(r.result));
      const newId = id ?? r.entityId ?? r.result?.id;
      if (id) detail.reload();
      if (newId) onSaved(newId);
    }
  };
  const reloadFromWoo = () => { dirty.current = false; w.release(); detail.reload(); };

  const ready = id == null || !!detail.data;
  return (
    <Drawer open title={id ? `Producto #${id}` : "Nuevo producto"} subtitle={id && detail.data ? `${detail.data.name} · detalle completo leído de WooCommerce` : "Se crea y se verifica con una lectura posterior"} onClose={onClose}>
      {id != null && detail.loading && !detail.data ? <Skeleton rows={8} /> : detail.error ? <ErrorBox error={detail.error} onRetry={detail.reload} /> : ready && (
        <>
          <Section title="General">
            <Grid>
              <Field label="Nombre" span={2}><input style={inputStyle} value={f.name} onChange={e => set("name", e.target.value)} data-testid="input-product-name" /></Field>
              <Field label="Tipo"><Select value={f.type} onChange={v => set("type", v)} style={{ width: "100%" }} testId="select-product-type" options={[{ value: "simple", label: "Simple" }, { value: "variable", label: "Variable" }]} /></Field>
              <Field label="Estado"><Select value={f.status} onChange={v => set("status", v)} style={{ width: "100%" }} testId="select-product-status-edit" options={["publish", "draft", "pending", "private"].map(s => ({ value: s, label: s }))} /></Field>
              <Field label="SKU"><input style={inputStyle} value={f.sku} onChange={e => set("sku", e.target.value)} data-testid="input-product-sku" /></Field>
            </Grid>
          </Section>

          {f.type !== "variable" ? (
            <Section title={`Precio${currency ? ` (${currency})` : ""}`}>
              <Grid>
                <Field label="Precio normal"><input style={inputStyle} inputMode="decimal" value={f.regular_price} onChange={e => set("regular_price", e.target.value)} data-testid="input-regular-price" /></Field>
                <Field label="Precio de oferta" hint={f.sale_price === "" ? "Sin oferta: se envía vacío para que WooCommerce la elimine" : undefined}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={inputStyle} inputMode="decimal" value={f.sale_price} onChange={e => set("sale_price", e.target.value)} data-testid="input-sale-price" />
                    <Btn onClick={() => set("sale_price", "")} disabled={f.sale_price === ""} testId="button-clear-sale">Quitar</Btn>
                  </div>
                </Field>
              </Grid>
            </Section>
          ) : <div style={{ fontSize: 12, color: MUTED }}>En productos variables el precio y la oferta se gestionan en cada variación.</div>}

          <Section title="Inventario">
            <Grid>
              <Field label="Gestionar stock"><Select value={f.manage_stock ? "1" : "0"} onChange={v => set("manage_stock", v === "1")} style={{ width: "100%" }} testId="select-manage-stock" options={[{ value: "0", label: "No" }, { value: "1", label: "Sí" }]} /></Field>
              {f.manage_stock && <Field label="Cantidad"><input type="number" style={inputStyle} value={f.stock_quantity} onChange={e => set("stock_quantity", e.target.value)} data-testid="input-stock-qty" /></Field>}
              <Field label="Estado de stock"><Select value={f.stock_status} onChange={v => set("stock_status", v)} style={{ width: "100%" }} testId="select-stock-status" options={[{ value: "instock", label: "En stock" }, { value: "outofstock", label: "Sin stock" }, { value: "onbackorder", label: "Bajo pedido" }]} /></Field>
            </Grid>
          </Section>

          <Section title="Descripciones">
            <Field label="Descripción completa (HTML)"><textarea rows={9} style={{ ...inputStyle, resize: "vertical", ...mono, fontSize: 12 }} value={f.description} onChange={e => set("description", e.target.value)} data-testid="textarea-description" /></Field>
            <Field label="Descripción corta (HTML)"><textarea rows={3} style={{ ...inputStyle, resize: "vertical", ...mono, fontSize: 12 }} value={f.short_description} onChange={e => set("short_description", e.target.value)} data-testid="textarea-short-description" /></Field>
          </Section>

          <CategoryPicker projectId={projectId} value={f.categories} onChange={v => set("categories", v)} />
          <GalleryEditor images={f.images} onChange={v => set("images", v)} />
          <AttributesEditor projectId={projectId} value={f.attributes} onChange={v => set("attributes", v)} />

          <SchemaExtras fields={schema.data?.fields ?? null} error={schema.error} exclude={CORE} values={extras} onChange={(k, v) => { dirty.current = true; setExtras(p => { const n = { ...p }; if (v === undefined) delete n[k]; else n[k] = v; return n; }); }} />

          <WriteStatus state={w.state} message={w.message} operationId={w.operationId} onReload={reloadFromWoo} onRetry={() => setConfirm(true)} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {id && <Btn onClick={reloadFromWoo} testId="button-discard">Descartar y recargar</Btn>}
            <Btn variant="primary" disabled={w.state === "saving" || w.state === "uncertain" || !f.name.trim()} onClick={() => setConfirm(true)} testId="button-save-product">{id ? "Guardar cambios" : "Crear producto"}</Btn>
          </div>

          {id && f.type === "variable" && detail.data?.type === "variable" && <VariationsPanel projectId={projectId} product={detail.data} currency={currency} />}
          {id && f.type === "variable" && detail.data?.type !== "variable" && <div style={{ fontSize: 12, color: AMBER }}>Guarda el producto como variable para gestionar sus variaciones.</div>}

          <ConfirmDialog open={confirm} title={id ? `Escribir en el producto #${id}` : "Crear producto en WooCommerce"} onCancel={() => setConfirm(false)} onConfirm={save}>
            Se enviará a la tienda real: nombre, tipo ({f.type}), estado ({f.status}), {f.type !== "variable" ? `precio ${f.regular_price || "vacío"}, oferta ${f.sale_price || "eliminada"}, ` : ""}
            stock, {f.categories.length} categorías, {f.images.length} imágenes en este orden y {f.attributes.length} atributos.
            {Object.keys(extras).length > 0 && <> Campos adicionales: {Object.keys(extras).join(", ")}.</>}
            <div style={{ marginTop: 8, fontSize: 11.5, color: MUTED }}>Imágenes quitadas de la galería se desvinculan del producto; no se borran de la biblioteca de medios.</div>
          </ConfirmDialog>
        </>
      )}
    </Drawer>
  );
}

function CategoryPicker({ projectId, value, onChange }: { projectId: string; value: Cat[]; onChange: (v: Cat[]) => void }) {
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");
  const cats = useList<any>(projectId, "categories", { search, per_page: 50 });
  const has = (id: number) => value.some(c => c.id === id);
  return (
    <Section title={`Categorías (${value.length})`}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {value.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Sin categorías asignadas.</span>}
        {value.map(c => (
          <span key={c.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "rgba(150,88,138,0.15)", color: WL, borderRadius: 100, padding: "3px 6px 3px 11px", fontSize: 12 }}>
            {c.name ?? "?"} <span style={{ ...mono, fontSize: 10, opacity: 0.7 }}>#{c.id}</span>
            <button onClick={() => onChange(value.filter(x => x.id !== c.id))} data-testid={`button-remove-cat-${c.id}`} style={{ background: "none", border: "none", color: WL, cursor: "pointer", padding: 2 }} aria-label="Quitar">×</button>
          </span>
        ))}
      </div>
      <Toolbar>
        <input style={{ ...inputStyle, width: 220 }} placeholder="Buscar categoría" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-cat-search" />
        <input style={{ ...inputStyle, width: 120 }} placeholder="ID explícito" inputMode="numeric" value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ""))} data-testid="input-cat-id" />
        <Btn disabled={!manual || has(Number(manual))} onClick={() => { onChange([...value, { id: Number(manual) }]); setManual(""); }} testId="button-add-cat-id">Añadir ID</Btn>
      </Toolbar>
      {cats.error ? <ErrorBox error={cats.error} onRetry={cats.reload} /> : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 130, overflowY: "auto" }}>
          {cats.loading ? <span style={{ fontSize: 12, color: MUTED }}>Cargando categorías…</span> : (cats.data?.data ?? []).map((c: any) => (
            <button key={c.id} disabled={has(c.id)} onClick={() => onChange([...value, { id: c.id, name: c.name }])} data-testid={`button-pick-cat-${c.id}`}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: has(c.id) ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)", borderRadius: 100, padding: "3px 10px", fontSize: 12, cursor: has(c.id) ? "default" : "pointer" }}>
              {c.name} <span style={{ ...mono, fontSize: 10, opacity: 0.6 }}>#{c.id}</span>
            </button>
          ))}
          {cats.data && <span style={{ fontSize: 11, color: MUTED, alignSelf: "center" }}>{cats.data.data.length} de {cats.data.total}</span>}
        </div>
      )}
    </Section>
  );
}

function GalleryEditor({ images, onChange }: { images: Img[]; onChange: (v: Img[]) => void }) {
  const [url, setUrl] = useState("");
  const move = (i: number, d: number) => { const n = [...images]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <Section title={`Galería (${images.length})`}>
      <div style={{ fontSize: 11.5, color: MUTED }}>La primera imagen es la principal. Para subir archivos usa la pestaña Importar; aquí se reordena, se quita o se añade por URL pública.</div>
      {images.length === 0 && <Empty>Sin imágenes.</Empty>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {images.map((img, i) => (
          <div key={`${img.id ?? "u"}-${img.src}-${i}`} data-testid={`row-image-${i}`} style={{ display: "flex", gap: 10, alignItems: "center", background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 6 }}>
            <img src={img.src} alt={img.alt ?? ""} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{i === 0 ? "Principal" : `Posición ${i + 1}`} {img.id ? <span style={{ ...mono, fontSize: 10, color: MUTED }}>media #{img.id}</span> : <span style={{ fontSize: 10, color: AMBER }}>nueva por URL</span>}</div>
              <a href={img.src} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: WL, ...mono, wordBreak: "break-all" }}>{img.src}</a>
            </div>
            <Btn onClick={() => move(i, -1)} disabled={i === 0} testId={`button-img-up-${i}`} title="Subir"><ArrowUp size={13} /></Btn>
            <Btn onClick={() => move(i, 1)} disabled={i === images.length - 1} testId={`button-img-down-${i}`} title="Bajar"><ArrowDown size={13} /></Btn>
            <Btn variant="danger" onClick={() => onChange(images.filter((_, j) => j !== i))} testId={`button-img-remove-${i}`} title="Quitar de la galería"><Trash2 size={13} /></Btn>
          </div>
        ))}
      </div>
      <Toolbar>
        <input style={{ ...inputStyle, flex: 1, minWidth: 220 }} placeholder="https://… URL pública de imagen" value={url} onChange={e => setUrl(e.target.value)} data-testid="input-image-url" />
        <Btn disabled={!/^https?:\/\//.test(url)} onClick={() => { onChange([...images, { src: url.trim() }]); setUrl(""); }} testId="button-add-image-url"><ImagePlus size={13} /> Añadir URL</Btn>
      </Toolbar>
    </Section>
  );
}

function AttributesEditor({ projectId, value, onChange }: { projectId: string; value: Attr[]; onChange: (v: Attr[]) => void }) {
  const globals = useList<any>(projectId, "attributes", { per_page: 100 });
  const upd = (i: number, p: Partial<Attr>) => onChange(value.map((a, j) => (j === i ? { ...a, ...p } : a)));
  return (
    <Section title={`Atributos (${value.length})`} right={<Btn variant="soft" onClick={() => onChange([...value, { id: 0, name: "", options: [], visible: true, variation: false }])} testId="button-add-attribute"><Plus size={13} /> Atributo</Btn>}>
      {globals.error && <ErrorBox error={globals.error} onRetry={globals.reload} />}
      {value.length === 0 && <span style={{ fontSize: 12, color: MUTED }}>Sin atributos. Los productos variables necesitan al menos uno marcado "para variaciones".</span>}
      {value.map((a, i) => (
        <div key={i} data-testid={`row-attribute-${i}`} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Grid>
            <Field label="Atributo global">
              <Select value={String(a.id)} style={{ width: "100%" }} testId={`select-attr-global-${i}`} onChange={v => { const g = (globals.data?.data ?? []).find((x: any) => String(x.id) === v); upd(i, { id: Number(v), name: g?.name ?? a.name, options: [] }); }}
                options={[{ value: "0", label: "Personalizado (local)" }, ...(globals.data?.data ?? []).map((g: any) => ({ value: String(g.id), label: `${g.name} #${g.id}` }))]} />
            </Field>
            {a.id === 0 && <Field label="Nombre"><input style={inputStyle} value={a.name} onChange={e => upd(i, { name: e.target.value })} data-testid={`input-attr-name-${i}`} /></Field>}
            <Field label="Opciones" hint="Separadas por |" span={a.id === 0 ? 1 : 2}><input style={inputStyle} value={a.options.join(" | ")} onChange={e => upd(i, { options: e.target.value.split("|").map(s => s.trim()).filter(Boolean) })} data-testid={`input-attr-options-${i}`} /></Field>
          </Grid>
          {a.id > 0 && <TermChips projectId={projectId} attrId={a.id} selected={a.options} onToggle={t => upd(i, { options: a.options.includes(t) ? a.options.filter(o => o !== t) : [...a.options, t] })} />}
          <div style={{ display: "flex", gap: 16, fontSize: 12, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 6 }}><input type="checkbox" checked={a.visible} onChange={e => upd(i, { visible: e.target.checked })} data-testid={`checkbox-attr-visible-${i}`} /> Visible en la ficha</label>
            <label style={{ display: "flex", gap: 6 }}><input type="checkbox" checked={a.variation} onChange={e => upd(i, { variation: e.target.checked })} data-testid={`checkbox-attr-variation-${i}`} /> Usar para variaciones</label>
            <div style={{ marginLeft: "auto" }}><Btn variant="danger" onClick={() => onChange(value.filter((_, j) => j !== i))} testId={`button-remove-attr-${i}`}><Trash2 size={12} /> Quitar del producto</Btn></div>
          </div>
        </div>
      ))}
    </Section>
  );
}

function TermChips({ projectId, attrId, selected, onToggle }: { projectId: string; attrId: number; selected: string[]; onToggle: (t: string) => void }) {
  const terms = useList<any>(projectId, "terms", { parentId: attrId, per_page: 100 });
  if (terms.loading) return <span style={{ fontSize: 11, color: MUTED }}>Cargando términos…</span>;
  if (terms.error) return <span style={{ fontSize: 11, color: AMBER }}>Términos no disponibles: {terms.error.message}</span>;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {(terms.data?.data ?? []).map((t: any) => {
        const on = selected.includes(t.name);
        return <button key={t.id} onClick={() => onToggle(t.name)} data-testid={`button-term-${attrId}-${t.id}`} style={{ borderRadius: 100, padding: "3px 10px", fontSize: 12, cursor: "pointer", background: on ? "rgba(150,88,138,0.3)" : "rgba(255,255,255,0.04)", border: `1px solid ${on ? WL : "rgba(255,255,255,0.1)"}`, color: on ? "#fff" : "rgba(255,255,255,0.6)" }}>{t.name}</button>;
      })}
      {terms.data && terms.data.total > terms.data.data.length && <span style={{ fontSize: 11, color: MUTED }}>Mostrando {terms.data.data.length} de {terms.data.total}; escribe el resto en Opciones.</span>}
    </div>
  );
}

// ─── Variaciones ─────────────────────────────────────────────────────────────
type VForm = { sku: string; regular_price: string; sale_price: string; status: string; manage_stock: boolean; stock_quantity: string; stock_status: string; description: string; image: string; imageId?: number; attrs: Record<string, string> };
const vKey = (a: { id?: number; name: string }) => (a.id ? `id:${a.id}` : `n:${a.name}`);
const vFrom = (v: any): VForm => ({
  sku: v.sku ?? "", regular_price: v.regular_price ?? "", sale_price: v.sale_price ?? "", status: v.status ?? "publish", manage_stock: v.manage_stock === true, stock_quantity: v.stock_quantity == null ? "" : String(v.stock_quantity),
  stock_status: v.stock_status ?? "instock", description: v.description ?? "", image: v.image?.src ?? "", imageId: v.image?.id,
  attrs: Object.fromEntries((v.attributes ?? []).map((a: any) => [vKey(a), a.option])),
});

function VariationsPanel({ projectId, product, currency }: { projectId: string; product: any; currency?: string }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const list = useList<any>(projectId, "variations", { parentId: product.id, page, per_page: PER });
  return (
    <Section title="Variaciones" right={<Btn variant="soft" onClick={() => setEditing("new")} testId="button-new-variation"><Plus size={13} /> Variación</Btn>}>
      {list.loading ? <Skeleton rows={3} /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : list.data && (
        <>
          {list.data.data.length === 0 ? <Empty>Este producto no tiene variaciones.</Empty> : (
            <Table cols={["ID", "Atributos", "SKU", "Precio", "Stock", "Estado", ""]} rows={list.data.data.map((v: any) => [
              <span style={{ ...mono, color: WL }}>#{v.id}</span>,
              <span style={{ fontSize: 12 }}>{(v.attributes ?? []).map((a: any) => `${a.name}: ${a.option}`).join(" · ") || "Cualquiera"}</span>,
              <span style={{ ...mono, fontSize: 11, color: MUTED }}>{v.sku || "—"}</span>,
              <div>{money(fmt, v.price, currency)}{v.sale_price && <div style={{ fontSize: 11, color: AMBER }}>normal {money(fmt, v.regular_price, currency)}</div>}</div>,
              <div><Badge status={v.stock_status} />{v.manage_stock === true && <div style={{ fontSize: 11, color: MUTED }}>{v.stock_quantity ?? "—"} uds.</div>}</div>,
              <Badge status={v.status} />,
              <Btn variant="soft" onClick={() => setEditing(v.id)} testId={`button-edit-variation-${v.id}`}><Pencil size={12} /> Editar</Btn>,
            ])} emptyMsg="" />
          )}
          <ListMeta meta={list.data} perPage={PER} onPage={setPage} />
        </>
      )}
      {editing !== null && <VariationEditor key={String(editing)} projectId={projectId} product={product} id={editing === "new" ? null : editing} currency={currency} onClose={() => setEditing(null)} onSaved={vid => { list.reload(); setEditing(vid); }} />}
    </Section>
  );
}

function VariationEditor({ projectId, product, id, currency, onClose, onSaved }: { projectId: string; product: any; id: number | null; currency?: string; onClose: () => void; onSaved: (id: number) => void }) {
  const resource: ResourceName = "variations";
  const detail = useDetail<any>(projectId, resource, id, product.id);
  const [f, setF] = useState<VForm>({ sku: "", regular_price: "", sale_price: "", status: "publish", manage_stock: false, stock_quantity: "", stock_status: "instock", description: "", image: "", attrs: {} });
  const dirty = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const w = useWrite(projectId);
  useEffect(() => { if (detail.data && !dirty.current) setF(vFrom(detail.data)); }, [detail.data]);
  const set = <K extends keyof VForm>(k: K, v: VForm[K]) => { dirty.current = true; setF(p => ({ ...p, [k]: v })); };
  const varAttrs: any[] = (product.attributes ?? []).filter((a: any) => a.variation);

  const save = async () => {
    setConfirm(false);
    const data: Record<string, unknown> = {
      sku: f.sku, regular_price: f.regular_price, sale_price: f.sale_price, status: f.status, manage_stock: f.manage_stock, stock_status: f.stock_status, description: f.description,
      attributes: varAttrs.filter(a => f.attrs[vKey(a)]).map(a => ({ ...(a.id ? { id: a.id } : { name: a.name }), option: f.attrs[vKey(a)] })),
    };
    if (f.manage_stock) data.stock_quantity = f.stock_quantity === "" ? null : Number(f.stock_quantity);
    if (f.image && !(f.imageId && detail.data?.image?.src === f.image)) data.image = { src: f.image };
    else if (f.imageId && f.image) data.image = { id: f.imageId };
    const r = await w.run(resource, id, data, product.id);
    if (r) { dirty.current = false; const vid = id ?? r.entityId ?? r.result?.id; if (id) detail.reload(); if (vid) onSaved(vid); }
  };

  return (
    <div style={{ border: `1px solid ${WL}55`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12, background: "rgba(150,88,138,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center" }}><b>{id ? `Variación #${id}` : "Nueva variación"}</b><div style={{ marginLeft: "auto" }}><Btn onClick={onClose} testId="button-close-variation">Cerrar</Btn></div></div>
      {id != null && detail.loading && !detail.data ? <Skeleton rows={3} /> : detail.error ? <ErrorBox error={detail.error} onRetry={detail.reload} /> : (
        <>
          {varAttrs.length === 0 && <div style={{ fontSize: 12, color: AMBER }}>El producto no tiene atributos marcados para variaciones.</div>}
          <Grid>
            {varAttrs.map(a => (
              <Field key={vKey(a)} label={a.name}>
                <Select value={f.attrs[vKey(a)] ?? ""} style={{ width: "100%" }} testId={`select-var-attr-${a.id || a.name}`} onChange={v => set("attrs", { ...f.attrs, [vKey(a)]: v })}
                  options={[{ value: "", label: `Cualquier ${a.name}` }, ...(a.options ?? []).map((o: string) => ({ value: o, label: o }))]} />
              </Field>
            ))}
            <Field label="SKU"><input style={inputStyle} value={f.sku} onChange={e => set("sku", e.target.value)} data-testid="input-var-sku" /></Field>
            <Field label={`Precio normal${currency ? ` (${currency})` : ""}`}><input style={inputStyle} inputMode="decimal" value={f.regular_price} onChange={e => set("regular_price", e.target.value)} data-testid="input-var-regular" /></Field>
            <Field label="Precio de oferta">
              <div style={{ display: "flex", gap: 6 }}><input style={inputStyle} inputMode="decimal" value={f.sale_price} onChange={e => set("sale_price", e.target.value)} data-testid="input-var-sale" /><Btn onClick={() => set("sale_price", "")} disabled={!f.sale_price} testId="button-var-clear-sale">Quitar</Btn></div>
            </Field>
            <Field label="Estado"><Select value={f.status} onChange={v => set("status", v)} style={{ width: "100%" }} testId="select-var-status" options={["publish", "private"].map(s => ({ value: s, label: s }))} /></Field>
            <Field label="Gestionar stock"><Select value={f.manage_stock ? "1" : "0"} onChange={v => set("manage_stock", v === "1")} style={{ width: "100%" }} testId="select-var-manage" options={[{ value: "0", label: "No / hereda" }, { value: "1", label: "Sí" }]} /></Field>
            {f.manage_stock && <Field label="Cantidad"><input type="number" style={inputStyle} value={f.stock_quantity} onChange={e => set("stock_quantity", e.target.value)} data-testid="input-var-qty" /></Field>}
            <Field label="Estado de stock"><Select value={f.stock_status} onChange={v => set("stock_status", v)} style={{ width: "100%" }} testId="select-var-stock-status" options={[{ value: "instock", label: "En stock" }, { value: "outofstock", label: "Sin stock" }, { value: "onbackorder", label: "Bajo pedido" }]} /></Field>
            <Field label="Imagen (URL)" span={2}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {f.image && <img src={f.image} alt="" style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 6 }} />}
                <input style={inputStyle} value={f.image} onChange={e => set("image", e.target.value)} data-testid="input-var-image" />
              </div>
            </Field>
          </Grid>
          <Field label="Descripción de la variación"><textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={f.description} onChange={e => set("description", e.target.value)} data-testid="textarea-var-description" /></Field>
          {detail.data?.description && <div style={{ fontSize: 11, color: MUTED }}>Texto actual: {stripHtml(detail.data.description)}</div>}
          <WriteStatus state={w.state} message={w.message} operationId={w.operationId} onReload={() => { dirty.current = false; w.release(); detail.reload(); }} onRetry={() => setConfirm(true)} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn variant="primary" disabled={w.state === "saving" || w.state === "uncertain"} onClick={() => setConfirm(true)} testId="button-save-variation">{id ? "Guardar variación" : "Crear variación"}</Btn></div>
          <ConfirmDialog open={confirm} title={id ? `Escribir variación #${id}` : `Crear variación en el producto #${product.id}`} onCancel={() => setConfirm(false)} onConfirm={save}>
            Precio {f.regular_price || "vacío"}, oferta {f.sale_price || "eliminada"}, stock {f.manage_stock ? f.stock_quantity || "vacío" : f.stock_status}, atributos {varAttrs.map(a => `${a.name}=${f.attrs[vKey(a)] || "cualquiera"}`).join(", ") || "ninguno"}.
          </ConfirmDialog>
        </>
      )}
    </div>
  );
}
