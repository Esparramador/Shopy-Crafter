// Acciones del cerebro — Otras plataformas (WooCommerce, PrestaShop…) y Stripe.
// Extraídas tal cual del switch de POST /shopybrain/execute-action (routes/shopybrain.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { withPlatform, getProjectPlatformType } from "../../lib/platform-helper.js";
import {
  isConfirmed
} from "../../lib/shopybrain-helpers.js";

import { NOT_HANDLED, type BrainActionCtx, type BrainActionOutcome } from "./action-context.js";

export async function runCommerceActions(ctx: BrainActionCtx): Promise<BrainActionOutcome> {
  const { req, res, action, params, resolveStripeAccountId } = ctx;
  let result: Record<string, unknown> = {};
      switch (action) {
        case "platform_store_status": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: "projectId requerido" }; break; }
          const platformType = await getProjectPlatformType(parseInt(projectId));
          const r2 = await withPlatform(parseInt(projectId), "products", async (connector) => {
            const test = await connector.testConnection();
            return { ...test, platformType };
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { ...r2.data, message: `✅ Tienda ${r2.data.storeName || "conectada"} (${r2.data.platformInfo || platformType}) · ${r2.data.productCount ?? "?"} productos · Token: ${r2.data.tokenValid ? "válido" : "expirado"}` };
          break;
        }

        case "platform_list_products": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: "projectId requerido" }; break; }
          const limit = Math.min(params?.limit ?? 20, 100);
          const status = params?.status as string | undefined;
          const r2 = await withPlatform(parseInt(projectId), "products", async (connector) => {
            return connector.getProducts({ status, limit });
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { products: r2.data, total: r2.data.length, message: `${r2.data.length} productos encontrados` };
          break;
        }

        case "platform_get_product": {
          const projectId = params?.projectId;
          const pid = params?.platformProductId;
          if (!projectId || !pid) { result = { error: "projectId y platformProductId requeridos" }; break; }
          const r2 = await withPlatform(parseInt(projectId), "products", async (connector) => {
            return connector.getProduct(pid);
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { product: r2.data, message: `Producto: ${r2.data.title} · ${r2.data.price}€` };
          break;
        }

        case "platform_create_product": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: "projectId requerido" }; break; }
          const title = params?.title;
          if (!title) { result = { error: "title requerido" }; break; }
          // Antes: requireConfirmation(req, texto) con la firma equivocada devolvía siempre
          // null → se pedía confirmación siempre y la acción nunca se ejecutaba.
          if (!isConfirmed(params)) { result = { requiresConfirmation: true, message: `¿Confirmas crear el producto "${title}"?` }; break; }
          const productData = {
            title,
            price: params?.price ? String(params.price) : "0.00",
            bodyHtml: params?.bodyHtml ?? "",
            status: (params?.status ?? "draft") as "active" | "draft" | "archived",
            tags: params?.tags ?? "",
            variants: params?.variants ?? undefined,
          };
          const r2 = await withPlatform(parseInt(projectId), "product_create", async (connector) => {
            return connector.createProduct(productData);
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { product: r2.data, message: `✅ Producto creado: "${r2.data.title}" (ID: ${r2.data.platformId})` };
          break;
        }

        case "platform_edit_product": {
          const projectId = params?.projectId;
          const pid = params?.platformProductId;
          if (!projectId || !pid) { result = { error: "projectId y platformProductId requeridos" }; break; }
          const updateData: Record<string, unknown> = {};
          if (params?.title !== undefined) updateData.title = params.title;
          if (params?.price !== undefined) updateData.price = String(params.price);
          if (params?.bodyHtml !== undefined) updateData.bodyHtml = params.bodyHtml;
          if (params?.status !== undefined) updateData.status = params.status;
          if (params?.tags !== undefined) updateData.tags = params.tags;
          if (params?.compareAtPrice !== undefined) updateData.compareAtPrice = String(params.compareAtPrice);
          const r2 = await withPlatform(parseInt(projectId), "product_update", async (connector) => {
            return connector.updateProduct(pid, updateData);
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { product: r2.data, message: `✅ Producto actualizado: "${r2.data.title}"` };
          break;
        }

        case "platform_delete_product": {
          const projectId = params?.projectId;
          const pid = params?.platformProductId;
          if (!projectId || !pid) { result = { error: "projectId y platformProductId requeridos" }; break; }
          // Antes: requireConfirmation(req, texto) con la firma equivocada devolvía siempre
          // null → se pedía confirmación siempre y la acción nunca se ejecutaba.
          if (!isConfirmed(params)) { result = { requiresConfirmation: true, message: `¿Confirmas ELIMINAR el producto ${pid}? Esta acción es irreversible.` }; break; }
          const r2 = await withPlatform(parseInt(projectId), "product_delete", async (connector) => {
            await connector.deleteProduct(pid);
            return { deleted: true };
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { message: `🗑️ Producto ${pid} eliminado correctamente` };
          break;
        }

        case "platform_get_orders": {
          const projectId = params?.projectId;
          if (!projectId) { result = { error: "projectId requerido" }; break; }
          const limit = Math.min(params?.limit ?? 20, 100);
          const page = params?.page ?? 1;
          const r2 = await withPlatform(parseInt(projectId), "orders", async (connector) => {
            return connector.getOrders({ limit, page });
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = {
            orders: r2.data,
            total: r2.data.length,
            message: `${r2.data.length} pedidos · Total: ${r2.data.reduce((s, o) => s + parseFloat(o.total || "0"), 0).toFixed(2)}${r2.data[0]?.currency ?? "€"}`,
          };
          break;
        }

        case "platform_update_stock": {
          const projectId = params?.projectId;
          const pid = params?.platformProductId;
          const quantity = params?.quantity;
          if (!projectId || !pid || quantity === undefined) { result = { error: "projectId, platformProductId y quantity requeridos" }; break; }
          // Antes: requireConfirmation(req, texto) con la firma equivocada devolvía siempre
          // null → se pedía confirmación siempre y la acción nunca se ejecutaba.
          if (!isConfirmed(params)) { result = { requiresConfirmation: true, message: `¿Confirmas actualizar el stock a ${quantity} unidades?` }; break; }
          const r2 = await withPlatform(parseInt(projectId), "inventory", async (connector) => {
            return connector.updateInventory(pid, parseInt(quantity), params?.variantId);
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { message: `✅ Stock actualizado a ${quantity} unidades`, ...(r2.data as unknown as Record<string,unknown>) };
          break;
        }

        case "platform_update_seo": {
          const projectId = params?.projectId;
          const pid = params?.platformProductId;
          if (!projectId || !pid) { result = { error: "projectId y platformProductId requeridos" }; break; }
          const seoData = { metaTitle: params?.metaTitle, metaDescription: params?.metaDescription, focusKeyword: params?.focusKeyword };
          const r2 = await withPlatform(parseInt(projectId), "seo_write", async (connector) => {
            return connector.updateSeo(pid, seoData);
          });
          if (!r2.ok) { result = { error: r2.error }; break; }
          result = { seo: r2.data, message: `✅ SEO actualizado para producto ${pid}` };
          break;
        }

        case "stripe_list_accounts": {
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando cuentas Stripe" }; break; }
          const rawAccs: any[] = Array.isArray(data2) ? data2 : (data2.accounts || []);
          const accounts = rawAccs.map((a: any) => ({ accountId: a.accountId || a.account_id, email: a.email ?? null, businessName: a.businessName || a.display_name || null, projectId: a.project_id ?? a.projectId ?? null, projectName: a.project_name ?? null, type: a.account_type ?? null, connected: a.onboarding_complete ?? true }));
          result = { accounts, total: accounts.length, message: `${accounts.length} cuenta(s) Stripe conectada(s):\n${accounts.map((a: any) => `• ${a.businessName || a.email || a.accountId}${a.projectName ? ` — proyecto ${a.projectName}` : ""} (${a.accountId})`).join("\n")}` };
          break;
        }

        case "stripe_account_overview": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/overview`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error obteniendo cuenta Stripe" }; break; }
          result = { ...data2, message: `💳 Stripe ${accountId}: Balance disponible ${data2.balance?.available?.[0]?.amount ? (data2.balance.available[0].amount / 100).toFixed(2) + data2.balance.available[0].currency.toUpperCase() : "N/D"} · ${data2.customerCount ?? "?"} clientes · ${data2.subscriptionCount ?? "?"} suscripciones activas` };
          break;
        }

        case "stripe_list_transactions": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const limit2 = Math.min(params?.limit ?? 20, 100);
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/transactions?limit=${limit2}`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando transacciones" }; break; }
          result = { transactions: data2.transactions || [], total: (data2.transactions || []).length, message: `${(data2.transactions || []).length} transacciones Stripe` };
          break;
        }

        case "stripe_list_customers": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const limit2 = Math.min(params?.limit ?? 20, 100);
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/customers?limit=${limit2}`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando clientes Stripe" }; break; }
          result = { customers: data2.customers || [], total: (data2.customers || []).length, message: `${(data2.customers || []).length} clientes en Stripe` };
          break;
        }

        case "stripe_list_subscriptions": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/subscriptions`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando suscripciones Stripe" }; break; }
          const subs2 = data2.data || data2.subscriptions || [];
          result = { subscriptions: subs2, total: subs2.length, message: `${subs2.length} suscripciones en Stripe` };
          break;
        }

        case "stripe_list_products": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const port = process.env.PORT || 8080;
          const limit2 = Math.min(params?.limit ?? 25, 100);
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/products?limit=${limit2}`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando productos Stripe" }; break; }
          const prods = data2.data || [];
          result = { products: prods, total: prods.length, message: `${prods.length} producto(s) en catálogo Stripe:\n${prods.map((p: any) => `• ${p.name} — ${p.prices?.map((pr: any) => pr.amount ? `€${(pr.amount/100).toFixed(2)}${pr.interval ? `/${pr.interval}` : ""}` : "sin precio").join(", ") || "sin precio"}`).join("\n")}` };
          break;
        }

        case "stripe_list_invoices": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const port = process.env.PORT || 8080;
          const limit2 = Math.min(params?.limit ?? 25, 100);
          const statusQ = params?.status ? `&status=${params.status}` : "";
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/invoices?limit=${limit2}${statusQ}`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando facturas" }; break; }
          const invs = data2.data || [];
          result = { invoices: invs, total: invs.length, message: `${invs.length} factura(s) Stripe:\n${invs.slice(0,10).map((inv: any) => `• ${inv.number ?? inv.id} — ${inv.customerEmail ?? inv.customer} — €${((inv.amountDue||0)/100).toFixed(2)} — ${inv.status}`).join("\n")}` };
          break;
        }

        case "stripe_list_payouts": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          const port = process.env.PORT || 8080;
          const limit2 = Math.min(params?.limit ?? 25, 100);
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/payouts?limit=${limit2}`, { headers: { cookie: req.headers.cookie || "" } });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error listando payouts" }; break; }
          const pays = data2.data || [];
          result = { payouts: pays, total: pays.length, message: `${pays.length} payout(s):\n${pays.slice(0,10).map((p: any) => `• €${((p.amount||0)/100).toFixed(2)} — ${p.status} — llegada: ${p.arrivalDate ? new Date(p.arrivalDate*1000).toLocaleDateString("es-ES") : "—"}`).join("\n")}` };
          break;
        }

        case "stripe_create_product": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!params?.name) { result = { error: "name requerido" }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ name: params.name, description: params.description, price: params.price, currency: params.currency, interval: params.interval }),
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || data2.message || "Error creando producto en Stripe" }; break; }
          result = { product: data2.product, price: data2.price, message: data2.message || `Producto "${params.name}" creado en Stripe` };
          break;
        }

        case "stripe_create_charge": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!params?.amount) { result = { error: "amount requerido (en céntimos, ej. 4900 = €49)" }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/charges`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ amount: params.amount, currency: params.currency, customerId: params.customerId, description: params.description, receiptEmail: params.receiptEmail }),
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || data2.message || "Error creando cobro" }; break; }
          result = { paymentIntent: data2.paymentIntent, message: data2.message || `Cobro creado: ${data2.paymentIntent?.id}` };
          break;
        }

        case "stripe_create_customer": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!params?.email) { result = { error: "email requerido" }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/customers`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ email: params.email, name: params.name, phone: params.phone, description: params.description }),
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || data2.message || "Error creando cliente" }; break; }
          result = { customer: data2.customer, message: data2.message || `Cliente ${params.email} creado` };
          break;
        }

        case "stripe_create_invoice": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!params?.customerId) { result = { error: "customerId requerido" }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/invoices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ customerId: params.customerId, description: params.description, daysUntilDue: params.daysUntilDue, lineItems: params.lineItems }),
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || data2.message || "Error creando factura" }; break; }
          result = { invoice: data2.invoice, message: data2.message || `Factura creada: ${data2.invoice?.id}` };
          break;
        }

        case "stripe_send_invoice": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          const invoiceId = params?.invoiceId;
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!invoiceId) { result = { error: "invoiceId requerido" }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/invoices/${invoiceId}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || data2.message || "Error enviando factura" }; break; }
          result = { ok: true, status: data2.status, hostedUrl: data2.hostedUrl, message: data2.message || "Factura enviada al cliente" };
          break;
        }

        case "stripe_create_refund": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!params?.chargeId && !params?.paymentIntentId) { result = { error: "chargeId o paymentIntentId requerido" }; break; }
          const port = process.env.PORT || 8080;
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/refunds`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
            body: JSON.stringify({ chargeId: params.chargeId, paymentIntentId: params.paymentIntentId, amount: params.amount, reason: params.reason }),
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || data2.message || "Error creando reembolso" }; break; }
          result = { refund: data2.refund, message: data2.message || `Reembolso creado: ${data2.refund?.id}` };
          break;
        }

        case "stripe_cancel_subscription": {
          const accountId = await resolveStripeAccountId(params?.accountId);
          const subscriptionId = params?.subscriptionId;
          if (!accountId) { result = { error: "No hay cuentas Stripe conectadas. Ve a Admin → Stripe Manager para conectar una." }; break; }
          if (!subscriptionId) { result = { error: "subscriptionId requerido" }; break; }
          const port = process.env.PORT || 8080;
          const immediately = params?.immediately === true || params?.immediately === "true";
          const r2 = await fetch(`http://localhost:${port}/api/stripe/accounts/${accountId}/subscriptions/${subscriptionId}?immediately=${immediately}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", cookie: req.headers.cookie || "" },
          });
          const data2 = await r2.json() as any;
          if (!r2.ok) { result = { error: data2.error || "Error cancelando suscripción" }; break; }
          result = { ok: true, status: data2.status, message: data2.message || "Suscripción cancelada" };
          break;
        }

        default:
          return NOT_HANDLED;
      }
  return result;
}
