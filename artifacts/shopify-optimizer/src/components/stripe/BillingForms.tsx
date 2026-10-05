import { useEffect, useMemo, useState } from "react";
import {
  S, SL, api, fmt, priceText, CURRENCIES, AssociationFields, assocPayload, Notice,
  type Association, type CatalogProduct, type CustomerLite,
} from "./shared";

interface CouponLite { id: string; name: string | null; percentOff: number | null; amountOff: number | null; currency: string | null; valid: boolean }

function useBillingData(projectId: number) {
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [coupons, setCoupons] = useState<CouponLite[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => {
    const base = `/admin/stripe/project/${projectId}`;
    Promise.all([
      api<{ data: CustomerLite[] }>(`${base}/customers?limit=100`),
      api<{ data: CatalogProduct[] }>(`${base}/catalog`),
      api<{ data: CouponLite[] }>(`${base}/coupons`),
    ]).then(([c, p, k]) => { setCustomers(c.data); setCatalog(p.data); setCoupons(k.data.filter(x => x.valid)); })
      .catch(e => setErr((e as Error).message));
  }, [projectId]);
  return { customers, catalog, coupons, err };
}

function CustomerSelect({ customers, value, onChange }: { customers: CustomerLite[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={S.lbl}>Cliente *</label>
      <select style={S.sel} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Elige un cliente…</option>
        {customers.map(c => <option key={c.id} value={c.id} disabled={!c.email}>{c.name ? `${c.name} · ` : ""}{c.email ?? "(sin email)"}</option>)}
      </select>
      <div style={S.hint}>Stripe envía la factura al email del cliente. Si no aparece, créalo en la pestaña Clientes.</div>
    </div>
  );
}

function CouponSelect({ coupons, value, onChange }: { coupons: CouponLite[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={S.lbl}>Descuento</label>
      <select style={S.sel} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Sin descuento</option>
        {coupons.map(c => <option key={c.id} value={c.id}>{c.name ?? c.id} ({c.percentOff != null ? `-${c.percentOff}%` : `-${fmt(c.amountOff ?? 0, c.currency ?? "eur")}`})</option>)}
      </select>
    </div>
  );
}

export function SubscriptionCreate({ projectId, onCreated }: { projectId: number; onCreated: () => void }) {
  const { customers, catalog, coupons, err: loadErr } = useBillingData(projectId);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<Array<{ priceId: string; quantity: string }>>([{ priceId: "", quantity: "1" }]);
  const [daysUntilDue, setDays] = useState("7");
  const [trialDays, setTrial] = useState("");
  const [couponId, setCoupon] = useState("");
  const [assoc, setAssoc] = useState<Association>({ type: "", ref: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const recurring = useMemo(() => catalog.filter(p => p.active).map(p => ({ p, prices: p.prices.filter(pr => pr.active && pr.interval) })).filter(x => x.prices.length), [catalog]);
  const submit = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const d = await api<{ subscription: { id: string; status: string } }>(`/admin/stripe/project/${projectId}/subscriptions`, {
        method: "POST",
        body: {
          customerId, items: items.filter(i => i.priceId).map(i => ({ priceId: i.priceId, quantity: Number(i.quantity || 1) })),
          daysUntilDue: Number(daysUntilDue), trialDays: trialDays ? Number(trialDays) : null, couponId: couponId || undefined, association: assocPayload(assoc),
        },
      });
      setMsg(`Suscripción ${d.subscription.id} creada (${d.subscription.status === "trialing" ? "en prueba" : "activa"}). Stripe enviará la factura de cada periodo al cliente.`);
      setItems([{ priceId: "", quantity: "1" }]); setCustomerId(""); setAssoc({ type: "", ref: "" });
      onCreated();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={S.sectionTitle}>➕ Nueva suscripción</div>
      <div style={{ ...S.hint, marginTop: -6, marginBottom: 12 }}>Para clientes que pagan por factura (transferencia o tarjeta desde el email de Stripe). Si prefieres que el cliente se suscriba él mismo con tarjeta, crea un enlace de pago con un precio recurrente.</div>
      {(loadErr || err) && <Notice kind="err" onClose={() => setErr("")}>{loadErr || err}</Notice>}
      {msg && <Notice kind="ok" onClose={() => setMsg("")}>{msg}</Notice>}
      <div style={S.grid2}>
        <CustomerSelect customers={customers} value={customerId} onChange={setCustomerId} />
        <CouponSelect coupons={coupons} value={couponId} onChange={setCoupon} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={S.lbl}>Plan recurrente</label>
              <select style={S.sel} value={it.priceId} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, priceId: e.target.value } : x))}>
                <option value="">Elige…</option>
                {recurring.map(({ p, prices }) => <optgroup key={p.id} label={p.name}>{prices.map(pr => <option key={pr.id} value={pr.id}>{p.name} — {priceText(pr)}</option>)}</optgroup>)}
              </select>
            </div>
            <div><label style={S.lbl}>Cantidad</label><input style={S.inp} type="number" min={1} value={it.quantity} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} /></div>
            {items.length > 1 ? <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => setItems(xs => xs.filter((_, j) => j !== i))}>✕</button> : <span />}
          </div>
        ))}
        {recurring.length === 0 && <div style={S.hint}>No hay precios recurrentes: créalos en Productos (cobro mensual, anual…).</div>}
        <button style={{ ...S.btn, ...S.btnG, ...S.btnSm, alignSelf: "flex-start" }} onClick={() => setItems(xs => [...xs, { priceId: "", quantity: "1" }])}>+ Otro plan (misma periodicidad)</button>
      </div>
      <div style={{ ...S.grid3, marginTop: 12 }}>
        <div><label style={S.lbl}>Días para pagar cada factura</label><input style={S.inp} type="number" min={1} max={365} value={daysUntilDue} onChange={e => setDays(e.target.value)} /></div>
        <div><label style={S.lbl}>Días de prueba gratis</label><input style={S.inp} type="number" min={0} max={730} placeholder="0" value={trialDays} onChange={e => setTrial(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 12 }}><AssociationFields value={assoc} onChange={setAssoc} /></div>
      <button style={{ ...S.btn, ...S.btnP, marginTop: 12 }} disabled={busy || !customerId || !items.some(i => i.priceId)} onClick={submit}>{busy ? "Creando…" : "Crear suscripción"}</button>
    </div>
  );
}

type Line = { mode: "catalog" | "free"; priceId: string; description: string; amount: string; quantity: string };

export function InvoiceCreate({ projectId, onCreated }: { projectId: number; onCreated: () => void }) {
  const { customers, catalog, coupons, err: loadErr } = useBillingData(projectId);
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState("eur");
  const [lines, setLines] = useState<Line[]>([{ mode: "free", priceId: "", description: "", amount: "", quantity: "1" }]);
  const [daysUntilDue, setDays] = useState("30");
  const [autoSend, setAutoSend] = useState(true);
  const [couponId, setCoupon] = useState("");
  const [memo, setMemo] = useState("");
  const [footer, setFooter] = useState("");
  const [assoc, setAssoc] = useState<Association>({ type: "", ref: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ number: string | null; hostedInvoiceUrl: string | null; pdfUrl: string | null; amountDue: number; currency: string } | null>(null);

  const oneTime = useMemo(() => catalog.filter(p => p.active).map(p => ({ p, prices: p.prices.filter(pr => pr.active && !pr.interval) })).filter(x => x.prices.length), [catalog]);
  const priceById = useMemo(() => new Map(catalog.flatMap(p => p.prices.map(pr => [pr.id, pr] as const))), [catalog]);
  const lineCurrency = lines.find(l => l.mode === "catalog" && l.priceId) ? priceById.get(lines.find(l => l.mode === "catalog" && l.priceId)!.priceId)?.currency ?? currency : currency;

  const submit = async () => {
    setBusy(true); setErr(""); setResult(null);
    try {
      const d = await api<{ invoice: { number: string | null; hostedInvoiceUrl: string | null; pdfUrl: string | null; amountDue: number; currency: string } }>(`/admin/stripe/project/${projectId}/invoices`, {
        method: "POST",
        body: {
          customerId, currency: lineCurrency, daysUntilDue: Number(daysUntilDue), autoSend, couponId: couponId || undefined,
          memo: memo || undefined, footer: footer || undefined, association: assocPayload(assoc),
          lines: lines.map(l => l.mode === "catalog"
            ? { priceId: l.priceId, quantity: Number(l.quantity || 1) }
            : { description: l.description, amount: l.amount, quantity: Number(l.quantity || 1) }),
        },
      });
      setResult(d.invoice);
      setLines([{ mode: "free", priceId: "", description: "", amount: "", quantity: "1" }]); setMemo(""); setAssoc({ type: "", ref: "" });
      onCreated();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={S.sectionTitle}>➕ Nueva factura</div>
      {(loadErr || err) && <Notice kind="err" onClose={() => setErr("")}>{loadErr || err}</Notice>}
      {result && (
        <Notice kind="ok" onClose={() => setResult(null)}>
          Factura {result.number ?? ""} por {fmt(result.amountDue, result.currency)} {autoSend ? "emitida y enviada al cliente." : "emitida."}{" "}
          {result.hostedInvoiceUrl && <a href={result.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Página de pago</a>}{" "}
          {result.pdfUrl && <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>PDF</a>}
        </Notice>
      )}
      <div style={S.grid2}>
        <CustomerSelect customers={customers} value={customerId} onChange={setCustomerId} />
        <CouponSelect coupons={coupons} value={couponId} onChange={setCoupon} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        <label style={S.lbl}>Líneas</label>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 80px auto", gap: 8, alignItems: "end" }}>
            <select style={S.sel} value={l.mode} onChange={e => setLines(xs => xs.map((x, j) => j === i ? { ...x, mode: e.target.value as Line["mode"] } : x))}>
              <option value="free">Concepto libre</option><option value="catalog">Del catálogo</option>
            </select>
            {l.mode === "catalog" ? (
              <select style={S.sel} value={l.priceId} onChange={e => setLines(xs => xs.map((x, j) => j === i ? { ...x, priceId: e.target.value } : x))}>
                <option value="">Elige producto…</option>
                {oneTime.map(({ p, prices }) => <optgroup key={p.id} label={p.name}>{prices.map(pr => <option key={pr.id} value={pr.id}>{p.name} — {priceText(pr)}</option>)}</optgroup>)}
              </select>
            ) : (
              <input style={S.inp} maxLength={500} placeholder="Concepto" value={l.description} onChange={e => setLines(xs => xs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            )}
            {l.mode === "free"
              ? <input style={S.inp} inputMode="decimal" placeholder="Precio unidad" value={l.amount} onChange={e => setLines(xs => xs.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
              : <span style={{ fontSize: 12, color: SL }}>{l.priceId ? fmt(priceById.get(l.priceId)?.unitAmount ?? 0, priceById.get(l.priceId)?.currency ?? "eur") : ""}</span>}
            <input style={S.inp} type="number" min={1} title="Cantidad" value={l.quantity} onChange={e => setLines(xs => xs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
            {lines.length > 1 ? <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => setLines(xs => xs.filter((_, j) => j !== i))}>✕</button> : <span />}
          </div>
        ))}
        <button style={{ ...S.btn, ...S.btnG, ...S.btnSm, alignSelf: "flex-start" }} onClick={() => setLines(xs => [...xs, { mode: "free", priceId: "", description: "", amount: "", quantity: "1" }])}>+ Línea</button>
      </div>
      <div style={{ ...S.grid3, marginTop: 12 }}>
        <div>
          <label style={S.lbl}>Moneda</label>
          <select style={S.sel} value={lineCurrency} disabled={lineCurrency !== currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>
        </div>
        <div><label style={S.lbl}>Días hasta vencimiento</label><input style={S.inp} type="number" min={1} max={365} value={daysUntilDue} onChange={e => setDays(e.target.value)} /></div>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", paddingTop: 18 }}><input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} /> Enviar por email al emitir</label>
      </div>
      <div style={{ ...S.grid2, marginTop: 12 }}>
        <div><label style={S.lbl}>Nota en la factura</label><input style={S.inp} maxLength={1500} value={memo} onChange={e => setMemo(e.target.value)} placeholder="Ej.: Gracias por tu confianza" /></div>
        <div><label style={S.lbl}>Pie (datos fiscales, IBAN…)</label><input style={S.inp} maxLength={5000} value={footer} onChange={e => setFooter(e.target.value)} /></div>
      </div>
      <div style={{ marginTop: 12 }}><AssociationFields value={assoc} onChange={setAssoc} /></div>
      <button style={{ ...S.btn, ...S.btnP, marginTop: 12 }} disabled={busy || !customerId} onClick={submit}>{busy ? "Emitiendo en Stripe…" : "Emitir factura"}</button>
    </div>
  );
}
