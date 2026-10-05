import { useCallback, useEffect, useState } from "react";
import { S, SP, api, fmt, fmtDate, AssociationFields, assocPayload, AssocBadge, Notice, type Association } from "./shared";

interface Payment {
  id: string; amount: number; amountReceived: number; amountRefunded: number; currency: string; status: string;
  description: string | null; created: number; email: string | null; customerName: string | null; method: string | null;
  receiptUrl: string | null; disputed: boolean; metadata: Record<string, string>;
}

const STATUS_ES: Record<string, string> = {
  succeeded: "Pagado", processing: "Procesando", requires_payment_method: "Pendiente de pago",
  requires_confirmation: "Sin confirmar", requires_action: "Requiere acción", requires_capture: "Por capturar", canceled: "Cancelado",
};

function PaymentRow({ projectId, p, onChanged }: { projectId: number; p: Payment; onChanged: (msg: string) => void }) {
  const [open, setOpen] = useState<"" | "assoc" | "refund">("");
  const [assoc, setAssoc] = useState<Association>({ type: p.metadata?.sc_ref_type ?? "", ref: p.metadata?.sc_ref ?? "" });
  const [note, setNote] = useState(p.metadata?.sc_note ?? "");
  const [refund, setRefund] = useState({ amount: "", reason: "requested_by_customer" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const base = `/admin/stripe/project/${projectId}/payments/${p.id}`;
  const refundable = p.status === "succeeded" && p.amountRefunded < p.amountReceived;

  const saveAssoc = async () => {
    setBusy(true); setErr("");
    try { await api(`${base}/association`, { method: "PATCH", body: { association: assocPayload(assoc), note } }); setOpen(""); onChanged("Asociación guardada en Stripe"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const doRefund = async () => {
    if (!confirm(refund.amount ? `¿Devolver ${refund.amount} ${p.currency.toUpperCase()}?` : "¿Devolver el pago completo?")) return;
    setBusy(true); setErr("");
    try { await api(`${base}/refund`, { method: "POST", body: { amount: refund.amount || null, reason: refund.reason } }); setOpen(""); onChanged("Devolución enviada a Stripe"); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <tr>
        <td style={S.td}>{fmtDate(p.created)}</td>
        <td style={S.td}>
          <div style={{ color: "#a5b4fc" }}>{p.customerName ?? p.email ?? "—"}</div>
          {p.customerName && p.email && <div style={{ fontSize: 11, color: "rgba(240,237,230,0.45)" }}>{p.email}</div>}
        </td>
        <td style={{ ...S.td, fontWeight: 800, color: SP }}>
          {fmt(p.amount, p.currency)}
          {p.amountRefunded > 0 && <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>Devuelto {fmt(p.amountRefunded, p.currency)}</div>}
        </td>
        <td style={S.td}>{STATUS_ES[p.status] ?? p.status}{p.disputed && <div style={{ fontSize: 11, color: "#f43f5e" }}>En disputa</div>}</td>
        <td style={S.td}>
          <div style={{ color: "rgba(240,237,230,0.7)" }}>{p.description ?? "—"}</div>
          <div style={{ marginTop: 4 }}><AssocBadge metadata={p.metadata} /></div>
          {p.metadata?.sc_note && <div style={{ fontSize: 11, color: "rgba(240,237,230,0.5)", marginTop: 3 }}>📝 {p.metadata.sc_note}</div>}
        </td>
        <td style={S.td}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={{ ...S.btn, ...S.btnG, ...S.btnSm }} onClick={() => setOpen(open === "assoc" ? "" : "assoc")}>🔗 Asociar</button>
            {refundable && <button style={{ ...S.btn, ...S.btnD, ...S.btnSm }} onClick={() => setOpen(open === "refund" ? "" : "refund")}>↩ Devolver</button>}
            {p.receiptUrl && <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ ...S.btn, ...S.btnG, ...S.btnSm, textDecoration: "none" }}>Recibo</a>}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ ...S.td, background: "rgba(99,91,255,0.04)" }}>
            {err && <Notice kind="err" onClose={() => setErr("")}>{err}</Notice>}
            {open === "assoc" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 680 }}>
                <AssociationFields value={assoc} onChange={setAssoc} help="Queda guardado en el pago en Stripe (visible también en su Dashboard)." />
                <div><label style={S.lbl}>Nota interna</label><input style={S.inp} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></div>
                <div><button style={{ ...S.btn, ...S.btnP, ...S.btnSm }} disabled={busy} onClick={saveAssoc}>Guardar</button></div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "160px 220px auto", gap: 10, alignItems: "end", maxWidth: 680 }}>
                <div><label style={S.lbl}>Importe (vacío = total)</label><input style={S.inp} inputMode="decimal" value={refund.amount} onChange={e => setRefund(r => ({ ...r, amount: e.target.value }))} /></div>
                <div>
                  <label style={S.lbl}>Motivo</label>
                  <select style={S.sel} value={refund.reason} onChange={e => setRefund(r => ({ ...r, reason: e.target.value }))}>
                    <option value="requested_by_customer">Lo pide el cliente</option><option value="duplicate">Duplicado</option><option value="fraudulent">Fraudulento</option>
                  </select>
                </div>
                <button style={{ ...S.btn, ...S.btnD, ...S.btnSm }} disabled={busy} onClick={doRefund}>Confirmar devolución</button>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function PaymentsTab({ projectId }: { projectId: number }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "assoc">("paid");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setPayments((await api<{ data: Payment[] }>(`/admin/stripe/project/${projectId}/payments?limit=100`)).data); }
    catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const shown = payments.filter(p => filter === "all" ? true : filter === "paid" ? p.status === "succeeded" : Boolean(p.metadata?.sc_ref_type || p.metadata?.sc_ref));
  return (
    <div style={S.card}>
      {err && <Notice kind="err" onClose={() => setErr("")}>{err}</Notice>}
      {msg && <Notice kind="ok" onClose={() => setMsg("")}>{msg}</Notice>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ ...S.title, marginBottom: 0 }}>💶 Pagos ({shown.length})</div>
        <select style={{ ...S.sel, width: "auto" }} value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="paid">Cobrados</option><option value="all">Todos (incl. pendientes)</option><option value="assoc">Con asociación</option>
        </select>
      </div>
      {loading ? <div style={S.empty}>Cargando pagos…</div> : shown.length === 0 ? <div style={S.empty}>Sin pagos</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Fecha", "Cliente", "Importe", "Estado", "Concepto / asociación", "Acciones"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{shown.map(p => <PaymentRow key={p.id} projectId={projectId} p={p} onChanged={m => { setMsg(m); void load(); }} />)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
