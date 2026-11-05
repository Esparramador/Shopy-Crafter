import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { SearchBar, Table } from "@/components/commerce/hub-kit";
import { stripHtml, useList, type ResourceName } from "./api";
import { EntityEditor, type FieldSpec } from "./EntityEditor";
import { Btn, Drawer, Empty, ErrorBox, ListMeta, MUTED, mono, panelStyle, Skeleton, Toolbar, WL } from "./ui";

const PER = 20;
const CAT_FIELDS: FieldSpec[] = [
  { key: "name", label: "Nombre", kind: "text", required: true },
  { key: "slug", label: "Slug", kind: "text" },
  { key: "parent", label: "ID categoría padre", kind: "number", hint: "0 = raíz" },
  { key: "display", label: "Visualización", kind: "select", options: ["default", "products", "subcategories", "both"].map(v => ({ value: v, label: v })) },
  { key: "menu_order", label: "Orden", kind: "number" },
  { key: "image.src", label: "Imagen (URL)", kind: "text", span: 2 },
  { key: "description", label: "Descripción", kind: "textarea", span: 3 },
];
const ATTR_FIELDS: FieldSpec[] = [
  { key: "name", label: "Nombre", kind: "text", required: true },
  { key: "slug", label: "Slug", kind: "text", hint: "WooCommerce antepone pa_" },
  { key: "type", label: "Tipo", kind: "select", options: [{ value: "select", label: "select" }] },
  { key: "order_by", label: "Orden de términos", kind: "select", options: ["menu_order", "name", "name_num", "id"].map(v => ({ value: v, label: v })) },
  { key: "has_archives", label: "Archivos públicos", kind: "bool" },
];
const TERM_FIELDS: FieldSpec[] = [
  { key: "name", label: "Nombre", kind: "text", required: true },
  { key: "slug", label: "Slug", kind: "text" },
  { key: "menu_order", label: "Orden", kind: "number" },
  { key: "description", label: "Descripción", kind: "textarea", span: 3 },
];

function ResourceList({ projectId, resource, parentId, title, cols, row, fields, canSearch = true, onSelect, selectedId }: {
  projectId: string; resource: ResourceName; parentId?: number; title: string; cols: string[]; row: (e: any) => ReactNode[]; fields: FieldSpec[];
  canSearch?: boolean; onSelect?: (e: any) => void; selectedId?: number | null;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<number | "new" | null>(null);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [parentId]);
  const list = useList<any>(projectId, resource, { parentId, page, per_page: PER, search: canSearch ? q : undefined });

  return (
    <div style={{ ...panelStyle, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</h3>
        <Toolbar>
          {canSearch && <SearchBar value={search} onChange={setSearch} placeholder="Buscar" />}
          <Btn variant="primary" onClick={() => setEditing("new")} testId={`button-new-${resource}`}><Plus size={13} /> Nuevo</Btn>
        </Toolbar>
      </div>
      {list.loading ? <Skeleton rows={4} /> : list.error ? <div style={{ padding: 14 }}><ErrorBox error={list.error} onRetry={list.reload} /></div> : list.data && (
        <>
          {list.data.data.length === 0 ? <Empty>Sin resultados.</Empty> : (
            <Table cols={[...cols, ""]} emptyMsg="" rows={list.data.data.map((e: any) => [
              ...row(e).map((c, i) => i === 0 && onSelect ? <button key={i} onClick={() => onSelect(e)} data-testid={`button-select-${resource}-${e.id}`} style={{ background: "none", border: "none", color: selectedId === e.id ? WL : "#fff", fontWeight: selectedId === e.id ? 800 : 600, cursor: "pointer", padding: 0, textAlign: "left" }}>{c}</button> : c),
              <Btn variant="soft" onClick={() => setEditing(e.id)} testId={`button-edit-${resource}-${e.id}`}><Pencil size={12} /> Editar</Btn>,
            ])} />
          )}
          <ListMeta meta={list.data} perPage={PER} onPage={setPage} />
        </>
      )}
      <Drawer open={editing !== null} title={editing === "new" ? `Nuevo en ${title}` : `${title} #${editing}`} subtitle="Lectura completa antes de editar; se envían sólo los campos cambiados." onClose={() => setEditing(null)}>
        {editing !== null && (
          <EntityEditor key={String(editing)} projectId={projectId} resource={resource} parentId={parentId} id={editing === "new" ? null : editing} fields={fields} title="Datos"
            onClose={() => setEditing(null)} onSaved={id => { list.reload(); setEditing(id); }} extraExclude={["image"]} />
        )}
      </Drawer>
    </div>
  );
}

export function TaxonomyTab({ projectId }: { projectId: string }) {
  const [attr, setAttr] = useState<any | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ResourceList projectId={projectId} resource="categories" title="Categorías" fields={CAT_FIELDS}
        cols={["Nombre", "ID", "Padre", "Productos", "Descripción"]}
        row={c => [c.name, <span style={{ ...mono, fontSize: 11, color: MUTED }}>#{c.id}</span>, <span style={{ ...mono, fontSize: 11, color: MUTED }}>{c.parent ? `#${c.parent}` : "raíz"}</span>, c.count, <span style={{ fontSize: 12, color: MUTED }}>{stripHtml(c.description).slice(0, 80) || "—"}</span>]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, alignItems: "start" }}>
        <ResourceList projectId={projectId} resource="attributes" title="Atributos globales" fields={ATTR_FIELDS} canSearch={false}
          onSelect={setAttr} selectedId={attr?.id ?? null}
          cols={["Nombre", "ID", "Slug", "Orden"]}
          row={a => [a.name, <span style={{ ...mono, fontSize: 11, color: MUTED }}>#{a.id}</span>, <span style={{ ...mono, fontSize: 11 }}>{a.slug}</span>, a.order_by]} />
        {attr ? (
          <ResourceList key={attr.id} projectId={projectId} resource="terms" parentId={attr.id} title={`Términos de ${attr.name}`} fields={TERM_FIELDS}
            cols={["Nombre", "ID", "Slug", "Productos"]}
            row={t => [t.name, <span style={{ ...mono, fontSize: 11, color: MUTED }}>#{t.id}</span>, <span style={{ ...mono, fontSize: 11 }}>{t.slug}</span>, t.count]} />
        ) : (
          <div style={{ ...panelStyle }}><Empty>Selecciona un atributo para ver y editar sus términos.</Empty></div>
        )}
      </div>
    </div>
  );
}
