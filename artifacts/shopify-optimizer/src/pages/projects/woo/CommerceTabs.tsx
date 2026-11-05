import { useEffect, useRef, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { fmt, fmtDate, SearchBar, Table } from "@/components/commerce/hub-kit";
import { money, useDetail, useList, useWrite, type ResourceName } from "./api";
import { EntityEditor, type FieldSpec } from "./EntityEditor";
import { AMBER, Badge, Btn, ConfirmDialog, Drawer, Empty, ErrorBox, Field, Grid, inputStyle, ListMeta, MUTED, mono, panelStyle, Provenance, Section, Select, Skeleton, Toolbar, WL, WriteStatus } from "./ui";

const PER = 20;
const ORDER_STATUSES = ["pending", "processing", "on-hold", "completed", "cancelled", "failed"]; // refunded no permitido

function useDebounced(v: string) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), 350); return () => clearTimeout(t); }, [v]);
  return d;
}

// ─── Pedidos ─────────────────────────────────────────────────────────────────
export function OrdersTab({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { setPage(1); }, [q, status]);
  const list = useList<any>(projectId, "orders", { page, per_page: PER, search: q, status });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por número, cliente o email" />
        <Select value={status} onChange={setStatus} testId="select-order-status" options={[{ value: "", label: "Todos los estados" }, ...[...ORDER_STATUSES, "refunded"].map(s => ({ value: s, label: s }))]} />
        <span style={{ fontSize: 11.5, color: MUTED }}>Los pedidos no se crean ni se reembolsan desde el Hub.</span>
      </Toolbar>
      <div style={{ ...panelStyle, overflow: "hidden" }}>
        {list.loading ? <Skeleton /> : list.error ? <div style={{ padding: 14 }}><ErrorBox error={list.error} onRetry={list.reload} /></div> : list.data && (
          <>
            {list.data.data.length === 0 ? <Empty>No hay pedidos con estos filtros.</Empty> : (
              <Table cols={["Pedido", "Cliente", "Artículos", "Total", "Estado", "Pago", "Fecha", ""]} emptyMsg="" rows={list.data.data.map((o: any) => [
                <span style={{ ...mono, color: WL }} data-testid={`text-order-${o.id}`}>#{o.number ?? o.id}</span>,
                <div><div style={{ fontWeight: 600 }}>{[o.billing?.first_name, o.billing?.last_name].filter(Boolean).join(" ") || "Invitado"}</div><div style={{ fontSize: 11, color: MUTED }}>{o.billing?.email}</div></div>,
                <span style={{ color: MUTED }}>{(o.line_items ?? []).reduce((a: number, l: any) => a + (l.quantity ?? 0), 0)}</span>,
                <span style={{ fontWeight: 700, color: WL }}>{money(fmt, o.total, o.currency)}</span>,
                <Badge status={o.status} />,
                <span style={{ fontSize: 12, color: MUTED }}>{o.payment_method_title || "—"}</span>,
                <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(o.date_created)}</span>,
                <Btn variant="soft" onClick={() => setOpen(o.id)} testId={`button-open-order-${o.id}`}><Eye size={12} /> Abrir</Btn>,
              ])} />
            )}
            <ListMeta meta={list.data} perPage={PER} onPage={setPage} />
          </>
        )}
      </div>
      {open !== null && <OrderDrawer key={open} projectId={projectId} id={open} onClose={() => setOpen(null)} onSaved={list.reload} />}
    </div>
  );
}

function OrderDrawer({ projectId, id, onClose, onSaved }: { projectId: string; id: number; onClose: () => void; onSaved: () => void }) {
  const d = useDetail<any>(projectId, "orders", id);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const dirty = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const w = useWrite(projectId);
  useEffect(() => { if (d.data && !dirty.current) { setStatus(d.data.status); setNote(d.data.customer_note ?? ""); } }, [d.data]);
  const o = d.data;
  const statusChanged = !!o && status !== o.status;
  const noteChanged = !!o && note !== (o.customer_note ?? "");

  const save = async () => {
    setConfirm(false);
    const data: Record<string, unknown> = {};
    if (statusChanged) data.status = status;
    if (noteChanged) data.customer_note = note;
    const r = await w.run("orders", id, data);
    if (r) { dirty.current = false; d.reload(); onSaved(); }
  };
  const addr = (a: any) => a ? [[a.first_name, a.last_name].filter(Boolean).join(" "), a.company, a.address_1, a.address_2, [a.postcode, a.city].filter(Boolean).join(" "), a.state, a.country, a.phone, a.email].filter(Boolean) : [];

  return (
    <Drawer open title={`Pedido #${o?.number ?? id}`} subtitle={o ? `Divisa del pedido: ${o.currency} · creado ${fmtDate(o.date_created)}` : "Leyendo pedido completo"} onClose={onClose}>
      {d.loading && !o ? <Skeleton rows={8} /> : d.error ? <ErrorBox error={d.error} onRetry={d.reload} /> : o && (
        <>
          <Section title="Líneas">
            <Table cols={["Producto", "IDs", "SKU", "Cant.", "Total"]} emptyMsg="Sin líneas" rows={(o.line_items ?? []).map((l: any) => [
              l.name, <span style={{ ...mono, fontSize: 11, color: MUTED }}>p#{l.product_id}{l.variation_id ? ` v#${l.variation_id}` : ""}</span>, <span style={{ ...mono, fontSize: 11 }}>{l.sku || "—"}</span>, l.quantity, money(fmt, l.total, o.currency),
            ])} />
            <div style={{ display: "grid", gridTemplateColumns: "auto auto", justifyContent: "end", gap: "4px 24px", fontSize: 13 }}>
              <span style={{ color: MUTED }}>Envío</span><span>{money(fmt, o.shipping_total, o.currency)}</span>
              <span style={{ color: MUTED }}>Impuestos</span><span>{money(fmt, o.total_tax, o.currency)}</span>
              <span style={{ color: MUTED }}>Descuento</span><span>{money(fmt, o.discount_total, o.currency)}</span>
              {(o.refunds ?? []).length > 0 && <><span style={{ color: AMBER }}>Reembolsos registrados</span><span style={{ color: AMBER }}>{(o.refunds ?? []).length}</span></>}
              <span style={{ fontWeight: 800 }}>Total</span><span style={{ fontWeight: 800, color: WL }}>{money(fmt, o.total, o.currency)}</span>
            </div>
          </Section>
          <Grid cols={2}>
            <Section title="Facturación"><div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{addr(o.billing).map((l, i) => <div key={i}>{l}</div>)}</div></Section>
            <Section title="Envío"><div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{addr(o.shipping).length ? addr(o.shipping).map((l, i) => <div key={i}>{l}</div>) : <span style={{ color: MUTED }}>Sin dirección de envío</span>}</div></Section>
          </Grid>
          <Section title="Gestión">
            <Grid cols={2}>
              <Field label="Estado" hint={o.status === "refunded" ? "Pedido reembolsado: no se cambia desde el Hub." : "Cambiar el estado puede enviar emails, ajustar stock o disparar integraciones en WooCommerce."}>
                <Select value={status} style={{ width: "100%" }} testId="select-order-new-status" onChange={v => { dirty.current = true; setStatus(v); }}
                  options={(o.status === "refunded" ? ["refunded"] : ORDER_STATUSES.includes(o.status) ? ORDER_STATUSES : [o.status, ...ORDER_STATUSES]).map(s => ({ value: s, label: s }))} />
              </Field>
              <Field label="Nota del cliente (customer_note)" span={2}>
                <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={note} onChange={e => { dirty.current = true; setNote(e.target.value); }} data-testid="textarea-order-note" />
              </Field>
            </Grid>
            <WriteStatus state={w.state} message={w.message} operationId={w.operationId} onReload={() => { dirty.current = false; w.release(); d.reload(); }} onRetry={() => setConfirm(true)} />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Btn variant="primary" disabled={(!statusChanged && !noteChanged) || o.status === "refunded" || w.state === "saving" || w.state === "uncertain"} onClick={() => setConfirm(true)} testId="button-save-order">Guardar pedido</Btn>
            </div>
          </Section>
          <ConfirmDialog open={confirm} title={`Modificar pedido #${o.number ?? id}`} onCancel={() => setConfirm(false)} onConfirm={save}
            requireCheck={statusChanged ? `Entiendo que pasar de "${o.status}" a "${status}" puede notificar al cliente, mover stock o activar efectos comerciales en WooCommerce.` : undefined}>
            {statusChanged && <div>Estado: <b>{o.status}</b> a <b>{status}</b></div>}
            {noteChanged && <div>Nota del cliente actualizada.</div>}
            <div style={{ marginTop: 6, fontSize: 11.5, color: MUTED }}>No se realizan cobros ni reembolsos.</div>
          </ConfirmDialog>
        </>
      )}
    </Drawer>
  );
}

// ─── Clientes ────────────────────────────────────────────────────────────────
const ADDR = (p: "billing" | "shipping", label: string): FieldSpec[] => [
  { key: `${p}.first_name`, label: `${label}: nombre`, kind: "text" },
  { key: `${p}.last_name`, label: `${label}: apellidos`, kind: "text" },
  { key: `${p}.company`, label: `${label}: empresa`, kind: "text" },
  { key: `${p}.address_1`, label: `${label}: dirección`, kind: "text", span: 2 },
  { key: `${p}.address_2`, label: `${label}: dirección 2`, kind: "text" },
  { key: `${p}.postcode`, label: `${label}: CP`, kind: "text" },
  { key: `${p}.city`, label: `${label}: ciudad`, kind: "text" },
  { key: `${p}.state`, label: `${label}: provincia`, kind: "text" },
  { key: `${p}.country`, label: `${label}: país (ISO)`, kind: "text" },
  ...(p === "billing" ? [{ key: "billing.email", label: "Facturación: email", kind: "text" as const }] : []),
  { key: `${p}.phone`, label: `${label}: teléfono`, kind: "text" },
];
const CUSTOMER_FIELDS: FieldSpec[] = [
  { key: "first_name", label: "Nombre", kind: "text" },
  { key: "last_name", label: "Apellidos", kind: "text" },
  { key: "email", label: "Email de cuenta", kind: "text" },
  ...ADDR("billing", "Facturación"),
  ...ADDR("shipping", "Envío"),
];

export function CustomersTab({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [editing, setEditing] = useState<number | null>(null);
  useEffect(() => { setPage(1); }, [q]);
  const list = useList<any>(projectId, "customers", { page, per_page: PER, search: q });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toolbar><SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o email" /><span style={{ fontSize: 11.5, color: MUTED }}>Edición de datos de contacto. Los clientes no se crean desde el Hub.</span></Toolbar>
      <div style={{ ...panelStyle, overflow: "hidden" }}>
        {list.loading ? <Skeleton /> : list.error ? <div style={{ padding: 14 }}><ErrorBox error={list.error} onRetry={list.reload} /></div> : list.data && (
          <>
            {list.data.data.length === 0 ? <Empty>No hay clientes con estos filtros.</Empty> : (
              <Table cols={["Cliente", "ID", "Email", "Teléfono", "Localidad", "Alta", ""]} emptyMsg="" rows={list.data.data.map((c: any) => [
                <span style={{ fontWeight: 600 }}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "—"}</span>,
                <span style={{ ...mono, fontSize: 11, color: MUTED }}>#{c.id}</span>,
                <span style={{ fontSize: 12 }}>{c.email}</span>,
                <span style={{ fontSize: 12, color: MUTED }}>{c.billing?.phone || "—"}</span>,
                <span style={{ fontSize: 12, color: MUTED }}>{[c.billing?.city, c.billing?.country].filter(Boolean).join(", ") || "—"}</span>,
                <span style={{ fontSize: 12, color: MUTED }}>{fmtDate(c.date_created)}</span>,
                <Btn variant="soft" onClick={() => setEditing(c.id)} testId={`button-edit-customer-${c.id}`}><Pencil size={12} /> Contacto</Btn>,
              ])} />
            )}
            <ListMeta meta={list.data} perPage={PER} onPage={setPage} />
          </>
        )}
      </div>
      <Drawer open={editing !== null} title={`Cliente #${editing}`} subtitle="Datos de contacto leídos completos de WooCommerce" onClose={() => setEditing(null)}>
        {editing !== null && <EntityEditor key={editing} projectId={projectId} resource="customers" id={editing} fields={CUSTOMER_FIELDS} title="Contacto" onClose={() => setEditing(null)} onSaved={() => list.reload()}
          confirmText="Se actualizarán los datos de contacto del cliente en la tienda real." />}
      </Drawer>
    </div>
  );
}

// ─── Cupones ─────────────────────────────────────────────────────────────────
const COUPON_FIELDS: FieldSpec[] = [
  { key: "code", label: "Código", kind: "text", required: true },
  { key: "discount_type", label: "Tipo", kind: "select", required: true, options: [{ value: "", label: "Elegir…" }, { value: "percent", label: "Porcentaje" }, { value: "fixed_cart", label: "Fijo en carrito" }, { value: "fixed_product", label: "Fijo por producto" }] },
  { key: "amount", label: "Importe", kind: "text", required: true, hint: "Porcentaje o importe en la divisa de la tienda" },
  { key: "date_expires", label: "Caduca", kind: "date" },
  { key: "individual_use", label: "Uso individual", kind: "bool" },
  { key: "free_shipping", label: "Envío gratis", kind: "bool" },
  { key: "usage_limit", label: "Límite total de usos", kind: "number" },
  { key: "usage_limit_per_user", label: "Límite por cliente", kind: "number" },
  { key: "minimum_amount", label: "Gasto mínimo", kind: "text" },
  { key: "maximum_amount", label: "Gasto máximo", kind: "text" },
  { key: "product_ids", label: "IDs de producto incluidos", kind: "ids", span: 2, hint: "Separados por comas" },
  { key: "excluded_product_ids", label: "IDs de producto excluidos", kind: "ids" },
  { key: "product_categories", label: "IDs de categoría incluidas", kind: "ids" },
  { key: "excluded_product_categories", label: "IDs de categoría excluidas", kind: "ids" },
  { key: "email_restrictions", label: "Emails permitidos", kind: "list", span: 2 },
  { key: "description", label: "Descripción interna", kind: "textarea", span: 3 },
];

export function CouponsTab({ projectId, currency }: { projectId: string; currency?: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  useEffect(() => { setPage(1); }, [q]);
  const list = useList<any>(projectId, "coupons" as ResourceName, { page, per_page: PER, search: q });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Toolbar>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar código" />
        <div style={{ marginLeft: "auto" }}><Btn variant="primary" onClick={() => setEditing("new")} testId="button-new-coupon"><Plus size={13} /> Nuevo cupón</Btn></div>
      </Toolbar>
      <div style={{ ...panelStyle, overflow: "hidden" }}>
        {list.loading ? <Skeleton /> : list.error ? <div style={{ padding: 14 }}><ErrorBox error={list.error} onRetry={list.reload} /></div> : list.data && (
          <>
            {list.data.data.length === 0 ? <Empty>{q ? "Ningún cupón coincide." : "Esta tienda no tiene cupones."}</Empty> : (
              <Table cols={["Código", "Tipo", "Descuento", "Usos", "Caduca", "Mínimo", ""]} emptyMsg="" rows={list.data.data.map((c: any) => [
                <span style={{ ...mono, fontWeight: 700, color: WL, background: "rgba(150,88,138,0.15)", padding: "3px 10px", borderRadius: 6, fontSize: 12 }}>{c.code}</span>,
                <Badge status={c.discount_type} />,
                <span style={{ fontWeight: 700 }}>{c.discount_type === "percent" ? `${c.amount}%` : money(fmt, c.amount, currency)}</span>,
                <span>{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</span>,
                <span style={{ fontSize: 12, color: c.date_expires && new Date(c.date_expires) < new Date() ? "#f43f5e" : MUTED }}>{c.date_expires ? fmtDate(c.date_expires) : "Sin caducidad"}</span>,
                <span style={{ fontSize: 12, color: MUTED }}>{c.minimum_amount && Number(c.minimum_amount) > 0 ? money(fmt, c.minimum_amount, currency) : "—"}</span>,
                <Btn variant="soft" onClick={() => setEditing(c.id)} testId={`button-edit-coupon-${c.id}`}><Pencil size={12} /> Editar</Btn>,
              ])} />
            )}
            <ListMeta meta={list.data} perPage={PER} onPage={setPage} />
          </>
        )}
      </div>
      <Drawer open={editing !== null} title={editing === "new" ? "Nuevo cupón" : `Cupón #${editing}`} subtitle={currency ? `Importes en ${currency}` : "Divisa de la tienda no disponible"} onClose={() => setEditing(null)}>
        {editing !== null && <EntityEditor key={String(editing)} projectId={projectId} resource="coupons" id={editing === "new" ? null : editing} fields={COUPON_FIELDS} title="Cupón"
          onClose={() => setEditing(null)} onSaved={id => { list.reload(); setEditing(id); }} confirmText="El cupón será utilizable por clientes reales en cuanto se guarde." />}
      </Drawer>
      <Provenance source={list.data?.source} fetchedAt={list.data?.fetchedAt} />
    </div>
  );
}
