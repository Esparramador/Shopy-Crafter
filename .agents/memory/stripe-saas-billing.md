---
name: Stripe SaaS billing flow
description: How platform Stripe Checkout works for SaaS plan upgrades; env priority and webhook handler.
---

## Rule
When `STRIPE_SECRET_KEY` is set in env, `/billing/upgrade` creates a real Stripe Checkout session (mode=subscription, EUR, price_data with inline product). Priority order in upgrade handler: **Stripe > Shopify Billing > Manual email**.

## Webhook
`POST /api/webhooks/stripe` (webhook-gateway.ts) handles `checkout.session.completed` — reads `metadata.userId` + `metadata.planId`, upserts `subscriptions` table row with `status: active`, stores `stripeCustomerId` + `stripeSubscriptionId`. Only fires when `!connectedAccountId` (platform billing, not connected tenant).

**Why:** Connected account events have `event.account` set — platform SaaS billing does not. This prevents mistakenly activating plans from tenant Stripe events.

## How to apply
- Set `STRIPE_SECRET_KEY=sk_live_...` in Replit secrets
- Set `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard → Webhooks)
- Add webhook endpoint `POST /api/webhooks/stripe` in Stripe Dashboard
- Stripe API version used: `2025-01-27.acacia`
