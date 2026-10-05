import { useCallback, useEffect, useMemo, useState } from "react";
import {
  S, SL, API, api, fmt, fmtDate, priceText, intervalLabel, CURRENCIES, AssociationFields, assocPayload, AssocBadge, Notice, CopyButton,
  type Association, type CatalogProduct, type CatalogPrice,
} from "./shared";

interface LinkItem { priceId: string | null; description: string | null; quantity: number | null; amount: number; currency: string; interval: string | null; intervalCount: number | null }
interface PaymentLink {
  id: string; url: string; active: boolean; metadata: Record<string, string>; currency: string;
  allowPromotionCodes: boolean; maxCompletedSessions: number | null; completedSessions: number | null;
  trialDays: number | null; invoiceAfterPayment: boolean; collectPhone: boolean; billingAddress: string;
  shippingCountries: string[]; items: LinkItem[]; mode: "payment" | "subscription";
}
interface Sale { id: string; created: number; amountTotal: number | null; currency: string | null; paymentStatus: string; email: string | null; name: string | null; paymentIntentId: string | null; subscriptionId: string | null }

type ItemRow = { priceId: string; quantity: string; adjustable: boolean; min: string; max: string };

const SHIPPING_PRESETS: Record<string, string[]> = {
  "": [],
  ES: ["ES"],
  "ES+PT": ["ES", "PT"],
  UE: ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"],
};

async function downloadCardPng(svgUrl: string, filename: string) {
  const r = await fetch(svgUrl, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `HTTP ${r.status}`);
  const svg = await r.text();
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("No se pudo renderizar la tarjeta")); img.src = blobUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1350;
    canvas.getContext("2d")!.drawImage(img, 0, 0, 1080, 1350);
    const png = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/png"));
    if (!png) throw new Error("No se pudo exportar PNG");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } finally { URL.revokeObjectURL(blobUrl); }
}

function ShareModal({ projectId, link, onClose }: { projectId: number; link: PaymentLink; onClose: () => void }) {
  const [qr, setQr] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [accent, setAccent] = useState("#c9a961");
  const [err, setErr] = useState("");
  const [bust, setBust] = useState(0);
  const base = `/admin/stripe/project/${projectId}/payment-links/${link.id}`;
  useEffect(() => { api<{ dataUrl: string }>(`${base}/qr`).then(d => setQr(d.dataUrl)).catch(e => setErr((e as Error).message)); }, [base]);
  const cardUrl = `${API}${base}/card?brand=${encodeURIComponent(brand)}&accent=${encodeURIComponent(accent)}&v=${bust}`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ ...S.card, background: "#14141f", maxWidth: 900, width: "100%", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={S.title}>Compartir enlace de pago</div>
          <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={onClose}>Cerrar</button>
        </div>
        {err && <Notice kind="err">{err}</Notice>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <code style={{ ...S.code, color: SL, fontSize: 12, wordBreak: "break-all" }}>{link.url}</code>
          <CopyButton text={link.url} label="Copiar enlace" />
          <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration: "none" }}>Abrir ↗</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(link.url)}`} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration: "none" }}>WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent("Enlace de pago")}&body=${encodeURIComponent(link.url)}`} style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration: "none" }}>Email</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          <div>
            <div style={S.sectionTitle}>Código QR</div>
            {qr ? <img src={qr} alt="QR del enlace de pago" style={{ width: 240, height: 240, background: "#fff", borderRadius: 12 }} /> : <div style={S.empty}>Generando…</div>}
            {qr && <div style={{ marginTop: 8 }}><a href={qr} download={`qr-${link.id}.png`} style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration: "none" }}>Descargar QR (PNG)</a></div>}
            <div style={S.hint}>Para mostrador, carta, flyer o pantalla: al escanearlo se abre la página de pago de Stripe.</div>
          </div>
          <div>
            <div style={S.sectionTitle}>Tarjeta para redes (1080 × 1350)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 8, alignItems: "end", marginBottom: 10 }}>
              <div><label style={S.lbl}>Marca</label><input style={S.inp} maxLength={60} value={brand} onChange={e => setBrand(e.target.value)} placeholder="Nombre del negocio" /></div>
              <div><label style={S.lbl}>Color</label><input type="color" style={{ ...S.inp, padding: 2, height: 38 }} value={accent} onChange={e => setAccent(e.target.value)} /></div>
              <button style={{ ...S.btn, ...S.btnG }} onClick={() => setBust(b => b + 1)}>Aplicar</button>
            </div>
            <img key={cardUrl} src={cardUrl} alt="Tarjeta del producto con precio y QR" style={{ width: "100%", maxWidth: 360, aspectRatio: "1080 / 1350", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={{ ...S.btn, ...S.btnP, ...S.btnSm }} onClick={() => downloadCardPng(cardUrl, `tarjeta-${link.id}.png`).catch(e => setErr((e as Error).message))}>Descargar PNG</button>
              <a href={cardUrl} download={`tarjeta-${link.id}.svg`} style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration: "none" }}>Descargar SVG</a>
            </div>
            <div style={S.hint}>Usa la primera foto, nombre, descripción y precio del producto en Stripe, con el QR al enlace.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesPanel({ projectId, linkId }: { projectId: number; linkId: string }) {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api<{ data: Sale[] }>(`/admin/stripe/project/${projectId}/payment-links/${linkId}/sales`).then(d => setSales(d.data)).catch(e => setErr((e as Error).message));
  }, [projectId, linkId]);
  if (err) return <Notice kind="err">{err}</Notice>;
  if (!sales) return <div style={{ fontSize: 12, color: "rgba(240,237,230,0.5)", marginTop: 8 }}>Cargando ventas…</div>;
  if (sales.length === 0) return <div style={{ fontSize: 12, color: "rgba(240,237,230,0.5)", marginTop: 8 }}>Todavía sin ventas completadas.</div>;
  const total = sales.reduce((s, x) => s + (x.amountTotal ?? 0), 0);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, color: "rgba(240,237,230,0.6)", marginBottom: 6 }}>{sales.length} venta(s) · {fmt(total, sales[0]?.currency ?? "eur")}</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Fecha", "Cliente", "Importe", "Estado", "Referencia"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>
          {sales.map(s => (
            <tr key={s.id}>
              <td style={S.td}>{fmtDate(s.created)}</td>
              <td style={S.td}>{s.name ?? "—"}<div style={{ fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{s.email ?? ""}</div></td>
              <td style={{ ...S.td, fontWeight: 700 }}>{s.amountTotal != null ? fmt(s.amountTotal, s.currency ?? "eur") : "—"}</td>
              <td style={S.td}>{s.paymentStatus === "paid" ? "Pagado" : s.paymentStatus === "no_payment_required" ? "Sin cobro (prueba)" : s.paymentStatus}</td>
              <td style={S.td}><code style={S.code}>{s.subscriptionId ?? s.paymentIntentId ?? s.id}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PaymentLinksTab({ projectId, preselectPriceId, onPreselectUsed }: { projectId: number; preselectPriceId?: string | null; onPreselectUsed?: () => void }) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<PaymentLink | null>(null);
  const [salesOf, setSalesOf] = useState<string | null>(null);
  const [onlyActive, setOnlyActive] = useState(true);

  const [items, setItems] = useState<ItemRow[]>([]);
  const [opts, setOpts] = useState({
    allowPromotionCodes: false, billingAddress: "auto", collectPhone: false, shipping: "",
    after: "hosted_confirmation", message: "", redirectUrl: "", maxSales: "", trialDays: "",
    invoiceAfterPayment: false, submitType: "auto", description: "",
  });
  const [assoc, setAssoc] = useState<Association>({ type: "", ref: "" });
  const [quick, setQuick] = useState({ amount: "", currency: "eur", concept: "", invoiceAfterPayment: false, singleUse: true });
  const [quickAssoc, setQuickAssoc] = useState<Association>({ type: "", ref: "" });

  const base = `/admin/stripe/project/${projectId}`;
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [l, c] = await Promise.all([
        api<{ data: PaymentLink[] }>(`${base}/payment-links${onlyActive ? "?active=1" : ""}`),
        api<{ data: CatalogProduct[] }>(`${base}/catalog`),
      ]);
      setLinks(l.data); setCatalog(c.data);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [base, onlyActive]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (preselectPriceId) {
      setItems([{ priceId: preselectPriceId, quantity: "1", adjustable: false, min: "1", max: "10" }]);
      onPreselectUsed?.();
    }
  }, [preselectPriceId, onPreselectUsed]);

  const priceIndex = useMemo(() => {
    const m = new Map<string, { price: CatalogPrice; product: CatalogProduct }>();
    for (const p of catalog) for (const pr of p.prices) if (pr.active) m.set(pr.id, { price: pr, product: p });
    return m;
  }, [catalog]);

  const selected = items.map(i => priceIndex.get(i.priceId)).filter(Boolean) as Array<{ price: CatalogPrice; product: CatalogProduct }>;
  const isSub = selected.some(s => s.price.interval);
  const estTotal = items.reduce((s, i) => s + (priceIndex.get(i.priceId)?.price.unitAmount ?? 0) * Number(i.quantity || 1), 0);
  const currency = selected[0]?.price.currency ?? "eur";

  const create = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const after = opts.after === "redirect"
        ? { type: "redirect", url: opts.redirectUrl }
        : { type: "hosted_confirmation", message: opts.message || undefined };
      const d = await api<{ link: PaymentLink }>(`${base}/payment-links`, {
        method: "POST",
        body: {
          items: items.map(i => ({
            priceId: i.priceId, quantity: Number(i.quantity || 1),
            adjustable: i.adjustable ? { enabled: true, minimum: Number(i.min || 0), maximum: Number(i.max || 99) } : null,
          })),
          allowPromotionCodes: opts.allowPromotionCodes,
          billingAddress: opts.billingAddress,
          collectPhone: opts.collectPhone,
          shippingCountries: SHIPPING_PRESETS[opts.shipping] ?? [],
          afterCompletion: after,
          maxCompletedSessions: opts.maxSales ? Number(opts.maxSales) : null,
          trialDays: isSub && opts.trialDays ? Number(opts.trialDays) : null,
          invoiceAfterPayment: !isSub && opts.invoiceAfterPayment,
          submitType: opts.submitType,
          description: opts.description || undefined,
          association: assocPayload(assoc),
        },
      });
      setMsg(`Enlace creado: ${d.link.url}`);
      setItems([]); setAssoc({ type: "", ref: "" });
      setShare(d.link);
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const createQuick = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const d = await api<{ link: PaymentLink }>(`${base}/quick-link`, { method: "POST", body: { ...quick, association: assocPayload(quickAssoc) } });
      setMsg(`Cobro creado: ${d.link.url}`);
      setQuick(q => ({ ...q, amount: "", concept: "" })); setQuickAssoc({ type: "", ref: "" });
      setShare(d.link);
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const toggle = async (l: PaymentLink) => {
    setErr(""); setMsg("");
    try {
      const d = await api<{ link: PaymentLink }>(`${base}/payment-links/${l.id}`, { method: "PATCH", body: { active: !l.active } });
      setLinks(prev => prev.map(x => x.id === l.id ? d.link : x).filter(x => !onlyActive || x.active));
      setMsg(d.link.active ? "Enlace reactivado" : "Enlace desactivado: quien lo abra verá que ya no está disponible");
    } catch (e) { setErr((e as Error).message); }
  };

  const productOptions = catalog.filter(p => p.active && p.prices.some(pr => pr.active));

  return (
    <div>
      {err && <Notice kind="err" onClose={() => setErr("")}>{err}</Notice>}
      {msg && <Notice kind="ok" onClose={() => setMsg("")}>{msg}</Notice>}
      {share && <ShareModal projectId={projectId} link={share} onClose={() => setShare(null)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginBottom: 16 }}>
        {/* ── Enlace a productos del catálogo ── */}
        <div style={S.card}>
          <div style={S.sectionTitle}>🔗 Enlace de pago de productos</div>
          {productOptions.length === 0 && !loading && <div style={{ ...S.hint, marginBottom: 10 }}>Crea primero un producto con precio en la pestaña Productos.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it, i) => {
              const sel = priceIndex.get(it.priceId);
              return (
                <div key={i} style={S.sub}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, alignItems: "end" }}>
                    <div>
                      <label style={S.lbl}>Producto / precio</label>
                      <select style={S.sel} value={it.priceId} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, priceId: e.target.value } : x))}>
                        <option value="">Elige…</option>
                        {productOptions.map(p => (
                          <optgroup key={p.id} label={p.name}>
                            {p.prices.filter(pr => pr.active).map(pr => <option key={pr.id} value={pr.id}>{p.name} — {priceText(pr)}{pr.nickname ? ` (${pr.nickname})` : ""}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div><label style={S.lbl}>Cantidad</label><input style={S.inp} type="number" min={1} value={it.quantity} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} /></div>
                    <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => setItems(xs => xs.filter((_, j) => j !== i))} aria-label="Quitar línea">✕</button>
                  </div>
                  <label style={{ fontSize: 12, color: "rgba(240,237,230,0.65)", display: "inline-flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="checkbox" checked={it.adjustable} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, adjustable: e.target.checked } : x))} />
                    El cliente elige la cantidad
                    {it.adjustable && <>
                      entre <input style={{ ...S.inp, width: 64, padding: "4px 8px" }} type="number" min={0} value={it.min} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, min: e.target.value } : x))} />
                      y <input style={{ ...S.inp, width: 72, padding: "4px 8px" }} type="number" min={1} value={it.max} onChange={e => setItems(xs => xs.map((x, j) => j === i ? { ...x, max: e.target.value } : x))} />
                    </>}
                  </label>
                  {sel && <div style={S.hint}>{sel.price.interval ? "Recurrente: crea una suscripción en Stripe." : "Pago único."}</div>}
                </div>
              );
            })}
            {items.length < 20 && <button style={{ ...S.btn, ...S.btnG, ...S.btnSm, alignSelf: "flex-start" }} onClick={() => setItems(xs => [...xs, { priceId: "", quantity: "1", adjustable: false, min: "1", max: "10" }])}>+ Añadir producto</button>}
          </div>

          {items.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ ...S.sub, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(240,237,230,0.6)" }}>{isSub ? "Suscripción" : "Pago único"} · total estimado</span>
                <span style={{ fontWeight: 800, color: SL }}>{fmt(estTotal, currency)}</span>
              </div>
              <div style={S.grid2}>
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={opts.allowPromotionCodes} onChange={e => setOpts(o => ({ ...o, allowPromotionCodes: e.target.checked }))} /> Permitir códigos promocionales</label>
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={opts.collectPhone} onChange={e => setOpts(o => ({ ...o, collectPhone: e.target.checked }))} /> Pedir teléfono</label>
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={opts.billingAddress === "required"} onChange={e => setOpts(o => ({ ...o, billingAddress: e.target.checked ? "required" : "auto" }))} /> Dirección de facturación obligatoria</label>
                {!isSub && <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={opts.invoiceAfterPayment} onChange={e => setOpts(o => ({ ...o, invoiceAfterPayment: e.target.checked }))} /> Emitir factura tras el pago</label>}
              </div>
              <div style={S.grid2}>
                <div>
                  <label style={S.lbl}>Envío (pedir dirección)</label>
                  <select style={S.sel} value={opts.shipping} onChange={e => setOpts(o => ({ ...o, shipping: e.target.value }))}>
                    <option value="">Sin envío</option><option value="ES">España</option><option value="ES+PT">España y Portugal</option><option value="UE">Unión Europea</option>
                  </select>
                </div>
                <div><label style={S.lbl}>Límite de ventas</label><input style={S.inp} type="number" min={1} placeholder="Sin límite" value={opts.maxSales} onChange={e => setOpts(o => ({ ...o, maxSales: e.target.value }))} /></div>
                {isSub && <div><label style={S.lbl}>Días de prueba gratis</label><input style={S.inp} type="number" min={0} max={730} placeholder="0" value={opts.trialDays} onChange={e => setOpts(o => ({ ...o, trialDays: e.target.value }))} /></div>}
                <div>
                  <label style={S.lbl}>Botón de pago</label>
                  <select style={S.sel} value={opts.submitType} onChange={e => setOpts(o => ({ ...o, submitType: e.target.value }))}>
                    <option value="auto">Automático</option>
                    {isSub ? <option value="subscribe">Suscribirse</option> : <>
                      <option value="pay">Pagar</option><option value="book">Reservar</option><option value="donate">Donar</option>
                    </>}
                  </select>
                </div>
              </div>
              <div style={S.grid2}>
                <div>
                  <label style={S.lbl}>Después del pago</label>
                  <select style={S.sel} value={opts.after} onChange={e => setOpts(o => ({ ...o, after: e.target.value }))}>
                    <option value="hosted_confirmation">Página de confirmación de Stripe</option>
                    <option value="redirect">Redirigir a mi web</option>
                  </select>
                </div>
                {opts.after === "redirect"
                  ? <div><label style={S.lbl}>URL de redirección</label><input style={S.inp} placeholder="https://tuweb.com/gracias" value={opts.redirectUrl} onChange={e => setOpts(o => ({ ...o, redirectUrl: e.target.value }))} /></div>
                  : <div><label style={S.lbl}>Mensaje de confirmación</label><input style={S.inp} maxLength={500} placeholder="¡Gracias! Te escribimos en 24 h" value={opts.message} onChange={e => setOpts(o => ({ ...o, message: e.target.value }))} /></div>}
              </div>
              <div><label style={S.lbl}>Descripción del cobro (extracto y Stripe)</label><input style={S.inp} maxLength={500} value={opts.description} onChange={e => setOpts(o => ({ ...o, description: e.target.value }))} placeholder="Ej.: Reserva menú degustación" /></div>
              <AssociationFields value={assoc} onChange={setAssoc} help="Cada pago o suscripción de este enlace llevará esta asociación en Stripe." />
              <button style={{ ...S.btn, ...S.btnP }} disabled={busy || items.some(i => !i.priceId)} onClick={create}>{busy ? "Creando en Stripe…" : "Crear enlace de pago"}</button>
            </div>
          )}
        </div>

        {/* ── Cobro rápido por importe ── */}
        <div style={S.card}>
          <div style={S.sectionTitle}>⚡ Cobro rápido por importe</div>
          <div style={{ ...S.hint, marginTop: -6, marginBottom: 12 }}>Para un presupuesto, una señal o un servicio puntual sin crearlo en el catálogo. Genera un enlace de pago de Stripe listo para enviar.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8 }}>
            <div><label style={S.lbl}>Importe *</label><input style={S.inp} inputMode="decimal" placeholder="150,00" value={quick.amount} onChange={e => setQuick(q => ({ ...q, amount: e.target.value }))} /></div>
            <div><label style={S.lbl}>Moneda</label><select style={S.sel} value={quick.currency} onChange={e => setQuick(q => ({ ...q, currency: e.target.value }))}>{CURRENCIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></div>
          </div>
          <div style={{ marginTop: 10 }}><label style={S.lbl}>Concepto *</label><input style={S.inp} maxLength={250} placeholder="Ej.: Señal reserva boda 12/06" value={quick.concept} onChange={e => setQuick(q => ({ ...q, concept: e.target.value }))} /></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={quick.singleUse} onChange={e => setQuick(q => ({ ...q, singleUse: e.target.checked }))} /> Un solo pago (el enlace se cierra al cobrarse)</label>
            <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={quick.invoiceAfterPayment} onChange={e => setQuick(q => ({ ...q, invoiceAfterPayment: e.target.checked }))} /> Emitir factura tras el pago</label>
          </div>
          <div style={{ marginTop: 10 }}><AssociationFields value={quickAssoc} onChange={setQuickAssoc} /></div>
          <button style={{ ...S.btn, ...S.btnP, marginTop: 12 }} disabled={busy || !quick.amount || !quick.concept} onClick={createQuick}>{busy ? "Creando…" : "Crear cobro"}</button>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
          <div style={{ ...S.title, marginBottom: 0 }}>Enlaces de pago ({links.length})</div>
          <label style={{ fontSize: 12, color: "rgba(240,237,230,0.6)", display: "inline-flex", gap: 6 }}>
            <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} /> Solo activos
          </label>
        </div>
        {loading ? <div style={S.empty}>Cargando…</div> : links.length === 0 ? <div style={S.empty}>Sin enlaces de pago</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {links.map(l => (
              <div key={l.id} style={{ ...S.sub, opacity: l.active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={S.tag}>{l.mode === "subscription" ? "Suscripción" : "Pago único"}</span>
                      {!l.active && <span style={{ ...S.tag, background: "rgba(156,163,175,0.15)", color: "#9ca3af" }}>Desactivado</span>}
                      {l.allowPromotionCodes && <span style={{ ...S.tag, background: "rgba(52,211,153,0.12)", color: "#34d399" }}>Admite códigos</span>}
                      {l.trialDays ? <span style={S.tag}>{l.trialDays} días de prueba</span> : null}
                      {l.maxCompletedSessions ? <span style={S.tag}>{l.completedSessions ?? 0}/{l.maxCompletedSessions} ventas</span> : null}
                      <AssocBadge metadata={l.metadata} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      {l.items.map((it, i) => (
                        <div key={i}>{it.quantity}× {it.description ?? "—"} · <b>{fmt(it.amount, it.currency)}</b>{it.interval ? ` ${intervalLabel(it.interval, it.intervalCount)}` : ""}</div>
                      ))}
                    </div>
                    <code style={{ ...S.code, color: SL, wordBreak: "break-all" }}>{l.url}</code>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <CopyButton text={l.url} />
                    <button style={{ ...S.btn, ...S.btnP, ...S.btnSm }} onClick={() => setShare(l)}>QR y tarjeta</button>
                    <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => setSalesOf(salesOf === l.id ? null : l.id)}>Ventas</button>
                    <button style={{ ...S.btn, ...(l.active ? S.btnD : S.btnG), ...S.btnSm }} onClick={() => toggle(l)}>{l.active ? "Desactivar" : "Activar"}</button>
                  </div>
                </div>
                {salesOf === l.id && <SalesPanel projectId={projectId} linkId={l.id} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
