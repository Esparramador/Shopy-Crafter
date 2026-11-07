import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDetail, useSchema, useWrite, type ResourceName } from "./api";
import { Btn, ConfirmDialog, ErrorBox, Field, Grid, inputStyle, MUTED, SchemaExtras, Section, Select, Skeleton, WriteStatus } from "./ui";

export type FieldSpec = {
  key: string; // admite rutas: "billing.phone"
  label: string;
  kind: "text" | "number" | "textarea" | "select" | "bool" | "date" | "ids" | "list";
  options?: { value: string; label: string }[];
  hint?: string;
  span?: number;
  required?: boolean;
  createOnly?: boolean;
};

const getPath = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o: Record<string, any>, p: string, v: unknown) => {
  const ks = p.split(".");
  let cur = o;
  ks.slice(0, -1).forEach(k => { cur[k] = cur[k] && typeof cur[k] === "object" ? cur[k] : {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
};

const toText = (f: FieldSpec, v: any): string => {
  if (v == null) return "";
  if (f.kind === "bool") return v ? "1" : "0";
  if (f.kind === "ids" || f.kind === "list") return Array.isArray(v) ? v.join(", ") : String(v);
  if (f.kind === "date") return String(v).slice(0, 10);
  return String(v);
};
const toValue = (f: FieldSpec, s: string): unknown => {
  if (f.kind === "bool") return s === "1";
  if (f.kind === "number") return s === "" ? null : Number(s);
  if (f.kind === "ids") return s.split(",").map(x => x.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
  if (f.kind === "list") return s.split(",").map(x => x.trim()).filter(Boolean);
  if (f.kind === "date") return s === "" ? null : s;
  return s;
};

/** Editor genérico: lee el detalle completo antes de editar y envía sólo lo cambiado. */
export function EntityEditor({ projectId, resource, id, parentId, fields, title, onSaved, onClose, confirmText, header, extraExclude = [] }: {
  projectId: string; resource: ResourceName; id: number | null; parentId?: number; fields: FieldSpec[]; title: string;
  onSaved: (id: number | null) => void; onClose: () => void; confirmText?: ReactNode; header?: (entity: any) => ReactNode; extraExclude?: string[];
}) {
  const detail = useDetail<any>(projectId, resource, id, parentId);
  const schema = useSchema(projectId, resource, parentId, id ?? undefined);
  const initial = useRef<Record<string, string>>({});
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(fields.map(f => [f.key, f.kind === "bool" ? "0" : ""])));
  const [extras, setExtras] = useState<Record<string, unknown>>({});
  const dirty = useRef(false);
  const [confirm, setConfirm] = useState(false);
  const w = useWrite(projectId);

  useEffect(() => {
    if (detail.data && !dirty.current) {
      const v = Object.fromEntries(fields.map(f => [f.key, toText(f, getPath(detail.data, f.key))]));
      initial.current = v;
      setVals(v);
    }
  }, [detail.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = fields.filter(f => (id == null ? vals[f.key] !== "" && !(f.kind === "bool" && vals[f.key] === "0") : vals[f.key] !== initial.current[f.key]));
  const missing = fields.filter(f => f.required && !vals[f.key]);

  const save = async () => {
    setConfirm(false);
    const data: Record<string, any> = { ...extras };
    changed.forEach(f => setPath(data, f.key, toValue(f, vals[f.key])));
    const r = await w.run(resource, id, data, parentId);
    if (r) {
      dirty.current = false;
      setExtras({});
      if (id) detail.reload();
      onSaved(id ?? r.entityId ?? r.result?.id ?? null);
    }
  };

  const topKeys = fields.map(f => f.key.split(".")[0]);
  if (id != null && detail.loading && !detail.data) return <Skeleton rows={5} />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={detail.reload} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {header && detail.data && header(detail.data)}
      <Section title={title}>
        <Grid>
          {fields.filter(f => !(f.createOnly && id != null)).map(f => (
            <Field key={f.key} label={f.label + (f.required ? " *" : "")} hint={f.hint} span={f.span}>
              {f.kind === "textarea" ? (
                <textarea rows={4} style={{ ...inputStyle, resize: "vertical" }} value={vals[f.key]} data-testid={`input-${resource}-${f.key}`} onChange={e => { dirty.current = true; setVals(v => ({ ...v, [f.key]: e.target.value })); }} />
              ) : f.kind === "select" || f.kind === "bool" ? (
                <Select value={vals[f.key]} style={{ width: "100%" }} testId={`select-${resource}-${f.key}`} onChange={x => { dirty.current = true; setVals(v => ({ ...v, [f.key]: x })); }}
                  options={f.kind === "bool" ? [{ value: "0", label: "No" }, { value: "1", label: "Sí" }] : f.options ?? []} />
              ) : (
                <input style={inputStyle} type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"} value={vals[f.key]} data-testid={`input-${resource}-${f.key}`}
                  onChange={e => { dirty.current = true; setVals(v => ({ ...v, [f.key]: e.target.value })); }} />
              )}
            </Field>
          ))}
        </Grid>
      </Section>
      <SchemaExtras fields={schema.data?.fields ?? null} error={schema.error} exclude={[...topKeys, ...extraExclude, "id"]} values={extras}
        onChange={(k, v) => { dirty.current = true; setExtras(p => { const n = { ...p }; if (v === undefined) delete n[k]; else n[k] = v; return n; }); }} />
      <WriteStatus state={w.state} message={w.message} operationId={w.operationId} onReload={() => { dirty.current = false; w.release(); detail.reload(); }} onRetry={() => setConfirm(true)} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: MUTED, marginRight: "auto" }}>{changed.length + Object.keys(extras).length} campo(s) a enviar{missing.length ? ` · faltan: ${missing.map(m => m.label).join(", ")}` : ""}</span>
        <Btn onClick={onClose} testId={`button-cancel-${resource}`}>Cerrar</Btn>
        <Btn variant="primary" disabled={w.state === "saving" || w.state === "uncertain" || missing.length > 0 || changed.length + Object.keys(extras).length === 0} onClick={() => setConfirm(true)} testId={`button-save-${resource}`}>{id ? "Guardar cambios" : "Crear"}</Btn>
      </div>
      <ConfirmDialog open={confirm} title={id ? `Escribir en ${resource} #${id}` : `Crear en ${resource}`} onCancel={() => setConfirm(false)} onConfirm={save}>
        {confirmText}
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          {changed.map(f => <li key={f.key}>{f.label}: <b>{vals[f.key] === "" ? "(vacío)" : f.kind === "bool" ? (vals[f.key] === "1" ? "Sí" : "No") : vals[f.key]}</b></li>)}
          {Object.entries(extras).map(([k, v]) => <li key={k}>{k}: <b>{String(v)}</b></li>)}
        </ul>
      </ConfirmDialog>
    </div>
  );
}
