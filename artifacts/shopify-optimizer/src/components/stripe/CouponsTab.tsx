import { useCallback, useEffect, useState } from "react";
import { S, SL, api, fmt, fmtDate, CURRENCIES, Notice, CopyButton } from "./shared";

interface PromoCode { id: string; code: string; active: boolean; timesRedeemed: number; maxRedemptions: number | null; expiresAt: number | null; firstTimeOnly: boolean }
interface Coupon {
  id: string; name: string | null; percentOff: number | null; amountOff: number | null; currency: string | null;
  duration: "once" | "repeating" | "forever"; durationInMonths: number | null; maxRedemptions: number | null;
  timesRedeemed: number; redeemBy: number | null; valid: boolean; created: number; codes: PromoCode[];
}

const DURATION_ES = { once: "Una vez", repeating: "Varios meses", forever: "Siempre" } as const;

export default function CouponsTab({ projectId }: { projectId: number }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: "", kind: "percent", percentOff: "", amountOff: "", currency: "eur", duration: "once", durationInMonths: "3",
    maxRedemptions: "", redeemBy: "", code: "", codeMaxRedemptions: "", firstTimeOnly: false, minimumAmount: "",
  });
  const [newCode, setNewCode] = useState<Record<string, string>>({});

  const base = `/admin/stripe/project/${projectId}`;
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setCoupons((await api<{ data: Coupon[] }>(`${base}/coupons`)).data); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      await api(`${base}/coupons`, {
        method: "POST",
        body: {
          name: f.name || undefined,
          percentOff: f.kind === "percent" ? f.percentOff : null,
          amountOff: f.kind === "amount" ? f.amountOff : null,
          currency: f.kind === "amount" ? f.currency : undefined,
          duration: f.duration,
          durationInMonths: f.duration === "repeating" ? Number(f.durationInMonths) : null,
          maxRedemptions: f.maxRedemptions ? Number(f.maxRedemptions) : null,
          redeemBy: f.redeemBy ? Math.floor(new Date(`${f.redeemBy}T23:59:59`).getTime() / 1000) : null,
          code: f.code || undefined,
          codeMaxRedemptions: f.codeMaxRedemptions ? Number(f.codeMaxRedemptions) : null,
          firstTimeOnly: f.firstTimeOnly,
          minimumAmount: f.minimumAmount || null,
        },
      });
      setMsg(f.code ? `Cupón y código ${f.code.toUpperCase()} creados. Actívalo en el enlace de pago con «Permitir códigos promocionales».` : "Cupón creado (sin código: se aplica desde facturas o suscripciones).");
      setF(x => ({ ...x, name: "", percentOff: "", amountOff: "", code: "", codeMaxRedemptions: "", maxRedemptions: "", redeemBy: "", minimumAmount: "" }));
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const addCode = async (couponId: string) => {
    setErr(""); setMsg("");
    try { await api(`${base}/coupons/${couponId}/codes`, { method: "POST", body: { code: newCode[couponId] } }); setNewCode(n => ({ ...n, [couponId]: "" })); setMsg("Código creado"); await load(); }
    catch (e) { setErr((e as Error).message); }
  };
  const toggleCode = async (c: PromoCode) => {
    setErr(""); setMsg("");
    try { await api(`${base}/promotion-codes/${c.id}`, { method: "PATCH", body: { active: !c.active } }); await load(); }
    catch (e) { setErr((e as Error).message); }
  };
  const remove = async (c: Coupon) => {
    if (!confirm("¿Eliminar el cupón? No se podrá volver a usar; los descuentos ya aplicados se mantienen.")) return;
    setErr(""); setMsg("");
    try { await api(`${base}/coupons/${c.id}`, { method: "DELETE" }); setMsg("Cupón eliminado"); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      {err && <Notice kind="err" onClose={() => setErr("")}>{err}</Notice>}
      {msg && <Notice kind="ok" onClose={() => setMsg("")}>{msg}</Notice>}
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.sectionTitle}>🏷️ Nuevo cupón de descuento</div>
        <div style={S.grid3}>
          <div><label style={S.lbl}>Nombre (lo ve el cliente)</label><input style={S.inp} maxLength={40} value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="Ej.: Verano 15%" /></div>
          <div>
            <label style={S.lbl}>Tipo</label>
            <select style={S.sel} value={f.kind} onChange={e => setF(x => ({ ...x, kind: e.target.value }))}><option value="percent">Porcentaje</option><option value="amount">Importe fijo</option></select>
          </div>
          {f.kind === "percent"
            ? <div><label style={S.lbl}>% de descuento</label><input style={S.inp} inputMode="decimal" value={f.percentOff} onChange={e => setF(x => ({ ...x, percentOff: e.target.value }))} placeholder="15" /></div>
            : <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 6 }}>
                <div><label style={S.lbl}>Descuento</label><input style={S.inp} inputMode="decimal" value={f.amountOff} onChange={e => setF(x => ({ ...x, amountOff: e.target.value }))} placeholder="10" /></div>
                <div><label style={S.lbl}>Moneda</label><select style={S.sel} value={f.currency} onChange={e => setF(x => ({ ...x, currency: e.target.value }))}>{CURRENCIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></div>
              </div>}
          <div>
            <label style={S.lbl}>En suscripciones se aplica</label>
            <select style={S.sel} value={f.duration} onChange={e => setF(x => ({ ...x, duration: e.target.value }))}>
              <option value="once">Solo el primer pago</option><option value="repeating">Durante varios meses</option><option value="forever">Siempre</option>
            </select>
          </div>
          {f.duration === "repeating" && <div><label style={S.lbl}>Meses</label><input style={S.inp} type="number" min={1} value={f.durationInMonths} onChange={e => setF(x => ({ ...x, durationInMonths: e.target.value }))} /></div>}
          <div><label style={S.lbl}>Usos máximos (total)</label><input style={S.inp} type="number" min={1} placeholder="Sin límite" value={f.maxRedemptions} onChange={e => setF(x => ({ ...x, maxRedemptions: e.target.value }))} /></div>
          <div><label style={S.lbl}>Válido hasta</label><input style={S.inp} type="date" value={f.redeemBy} onChange={e => setF(x => ({ ...x, redeemBy: e.target.value }))} /></div>
        </div>
        <div style={{ ...S.sub, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: SL, marginBottom: 8 }}>Código que escribe el cliente en la página de pago</div>
          <div style={S.grid3}>
            <div><label style={S.lbl}>Código</label><input style={{ ...S.inp, textTransform: "uppercase" }} value={f.code} onChange={e => setF(x => ({ ...x, code: e.target.value.replace(/[^A-Za-z0-9-]/g, "") }))} placeholder="VERANO15" /></div>
            <div><label style={S.lbl}>Usos del código</label><input style={S.inp} type="number" min={1} placeholder="Sin límite" value={f.codeMaxRedemptions} onChange={e => setF(x => ({ ...x, codeMaxRedemptions: e.target.value }))} /></div>
            <div><label style={S.lbl}>Compra mínima</label><input style={S.inp} inputMode="decimal" placeholder="Sin mínimo" value={f.minimumAmount} onChange={e => setF(x => ({ ...x, minimumAmount: e.target.value }))} /></div>
          </div>
          <label style={{ fontSize: 12, display: "inline-flex", gap: 6, marginTop: 8 }}><input type="checkbox" checked={f.firstTimeOnly} onChange={e => setF(x => ({ ...x, firstTimeOnly: e.target.checked }))} /> Solo primera compra del cliente</label>
        </div>
        <button style={{ ...S.btn, ...S.btnP, marginTop: 12 }} disabled={busy || (f.kind === "percent" ? !f.percentOff : !f.amountOff)} onClick={create}>{busy ? "Creando…" : "Crear cupón"}</button>
      </div>

      <div style={S.card}>
        <div style={S.title}>Cupones ({coupons.length})</div>
        {loading ? <div style={S.empty}>Cargando…</div> : coupons.length === 0 ? <div style={S.empty}>Sin cupones</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {coupons.map(c => (
              <div key={c.id} style={{ ...S.sub, opacity: c.valid ? 1 : 0.55 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.name ?? c.id} <span style={{ ...S.tag, marginLeft: 6 }}>{c.percentOff != null ? `-${c.percentOff}%` : `-${fmt(c.amountOff ?? 0, c.currency ?? "eur")}`}</span></div>
                    <div style={{ fontSize: 12, color: "rgba(240,237,230,0.55)", marginTop: 3 }}>
                      {c.duration === "repeating" ? `${c.durationInMonths} meses` : DURATION_ES[c.duration]} · usado {c.timesRedeemed}{c.maxRedemptions ? `/${c.maxRedemptions}` : ""} veces{c.redeemBy ? ` · hasta ${fmtDate(c.redeemBy)}` : ""}{!c.valid ? " · no válido" : ""}
                    </div>
                  </div>
                  <button style={{ ...S.btn, ...S.btnD, ...S.btnSm }} onClick={() => remove(c)}>Eliminar</button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                  {c.codes.map(pc => (
                    <span key={pc.id} style={{ display: "inline-flex", gap: 6, alignItems: "center", ...S.sub, padding: "5px 10px" }}>
                      <b style={{ fontFamily: "monospace", color: pc.active ? "#fff" : "#9ca3af" }}>{pc.code}</b>
                      <span style={{ fontSize: 11, color: "rgba(240,237,230,0.5)" }}>{pc.timesRedeemed}{pc.maxRedemptions ? `/${pc.maxRedemptions}` : ""} usos{pc.firstTimeOnly ? " · 1ª compra" : ""}</span>
                      <CopyButton text={pc.code} label="" />
                      <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => toggleCode(pc)}>{pc.active ? "Pausar" : "Activar"}</button>
                    </span>
                  ))}
                  {c.valid && (
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <input style={{ ...S.inp, width: 140, padding: "5px 10px" }} placeholder="NUEVO-CODIGO" value={newCode[c.id] ?? ""} onChange={e => setNewCode(n => ({ ...n, [c.id]: e.target.value.replace(/[^A-Za-z0-9-]/g, "") }))} />
                      <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} disabled={!newCode[c.id]} onClick={() => addCode(c.id)}>+ Código</button>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
