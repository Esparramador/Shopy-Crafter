/** URL a la suscripción en el dashboard de Stripe (modo test o live según la clave configurada). */
export function stripeSubscriptionDashboardUrl(stripeSubscriptionId: string, secretKey = process.env.STRIPE_SECRET_KEY): string {
  const test = !secretKey || secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}subscriptions/${encodeURIComponent(stripeSubscriptionId)}`;
}
