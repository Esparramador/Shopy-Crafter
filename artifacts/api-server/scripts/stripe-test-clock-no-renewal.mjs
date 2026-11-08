// Verificación con reloj de pruebas de Stripe (#112): una suscripción cancelada "al final del
// periodo" termina en esa fecha SIN crear ni cobrar una factura de renovación.
//
// Uso (desde artifacts/api-server):
//   E2E_STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-test-clock-no-renewal.mjs
//   (o: pnpm --filter @workspace/api-server run e2e:stripe-test-clock)
//
// Solo acepta claves de TEST (sk_test_). Sin E2E_STRIPE_SECRET_KEY se salta con aviso (exit 0).
// No toca la base de datos ni el servidor: comprueba el lado de Stripe del mismo cambio que hace
// el panel (subscriptions.update(id, { cancel_at_period_end: true }), como
// stripeSubscriptionClientFromKey().cancelAtPeriodEnd en src/lib/subscription-cancel.ts).
// El recorrido completo por el panel está en
// artifacts/shopify-optimizer/e2e/admin-delete-client.e2e.mjs (escenario 7).
//
// Pasos: reloj congelado en "ahora" → cliente con tarjeta de test bajo ese reloj → suscripción
// mensual de 1 € → primera factura pagada → programar cancelación al final del periodo →
// avanzar el reloj más allá de cancel_at → Stripe la marca canceled y no hay factura nueva.
// Limpieza: se borra el reloj (Stripe borra con él cliente y suscripciones) y se archiva el producto.
import Stripe from "stripe";

const key = process.env.E2E_STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.log("↷ E2E_STRIPE_SECRET_KEY no definido: se omite la verificación con test clock de Stripe.");
  console.log("  Para ejecutarla: E2E_STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-test-clock-no-renewal.mjs");
  process.exit(0);
}
if (!key.startsWith("sk_test_")) {
  console.error("✗ E2E_STRIPE_SECRET_KEY debe empezar por sk_test_: este script nunca usa una clave real.");
  process.exit(1);
}

const stripe = new Stripe(key);
const failures = [];
const ok = (m) => console.log(`✓ ${m}`);
const check = (cond, m) => { if (cond) ok(m); else { console.error(`✗ ${m}`); failures.push(m); } };
const tag = Math.random().toString(36).slice(2, 10);

async function waitForClock(id, timeoutMs = 180_000) {
  const start = Date.now();
  for (;;) {
    const clock = await stripe.testHelpers.testClocks.retrieve(id);
    if (clock.status === "ready") return clock;
    if (clock.status === "internal_failure") throw new Error("El test clock de Stripe falló al avanzar");
    if (Date.now() - start > timeoutMs) throw new Error(`El test clock no terminó de avanzar (estado ${clock.status})`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

let clockId = null;
let productId = null;
try {
  const now = Math.floor(Date.now() / 1000);
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: now, name: `no-renewal ${tag}` });
  clockId = clock.id;
  ok(`Test clock creado (${clock.id}) congelado en ${new Date(now * 1000).toISOString()}`);

  const customer = await stripe.customers.create({
    test_clock: clock.id,
    email: `stripe-clock-${tag}@e2e.invalid`,
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: "pm_card_visa" },
    metadata: { e2e: "stripe-test-clock-no-renewal" },
  });
  const product = await stripe.products.create({ name: `E2E no-renewal ${tag}` });
  productId = product.id;

  let sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price_data: { currency: "eur", product: product.id, unit_amount: 100, recurring: { interval: "month" } } }],
    payment_behavior: "error_if_incomplete",
    metadata: { e2e: "stripe-test-clock-no-renewal" },
  });
  check(sub.status === "active", `Suscripción de test activa (${sub.id})`);
  const firstInvoices = await stripe.invoices.list({ subscription: sub.id, limit: 10 });
  check(firstInvoices.data.length === 1 && firstInvoices.data[0].status === "paid",
    `Primera factura cobrada (facturas=${firstInvoices.data.length}, estado=${firstInvoices.data[0]?.status})`);

  // Lo mismo que hace «Cancelar al final del periodo» del panel.
  sub = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  check(sub.cancel_at_period_end === true && Number.isInteger(sub.cancel_at), `Cancelación programada para ${sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : "?"}`);

  const target = sub.cancel_at + 3600; // una hora después del corte
  await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: target });
  await waitForClock(clock.id);
  ok(`Reloj avanzado a ${new Date(target * 1000).toISOString()}`);

  const after = await stripe.subscriptions.retrieve(sub.id);
  check(after.status === "canceled", `Stripe marca la suscripción como canceled (obtenido "${after.status}")`);
  check(Number.isInteger(after.ended_at) && after.ended_at <= target, "Tiene fecha de fin (ended_at) no posterior al reloj");
  const invoices = await stripe.invoices.list({ subscription: sub.id, limit: 10 });
  const renewals = invoices.data.filter((i) => i.billing_reason === "subscription_cycle");
  check(invoices.data.length === 1 && renewals.length === 0,
    `Sin factura de renovación (facturas=${invoices.data.length}, de ciclo=${renewals.length})`);
  const charges = await stripe.charges.list({ customer: customer.id, limit: 10 });
  check(charges.data.filter((c) => c.paid).length === 1, `Un único cobro en total (cobros=${charges.data.length})`);
} catch (err) {
  console.error(`✗ ${err?.message ?? err}`);
  failures.push(String(err?.message ?? err));
} finally {
  if (clockId) {
    try { await stripe.testHelpers.testClocks.del(clockId); ok("Test clock borrado (con su cliente y suscripción)"); }
    catch (e) { console.warn(`  ! No se pudo borrar el test clock ${clockId}: ${e?.message ?? e}`); failures.push("limpieza del test clock"); }
  }
  if (productId) {
    try { await stripe.products.update(productId, { active: false }); }
    catch (e) { console.warn(`  ! No se pudo archivar el producto ${productId}: ${e?.message ?? e}`); }
  }
}

if (failures.length) { console.error(`\n${failures.length} comprobación(es) fallida(s)`); process.exit(1); }
console.log("\nTodo OK — Stripe no renueva tras la fecha de fin programada.");
