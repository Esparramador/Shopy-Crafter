---
name: Canonical Pricing Plans
description: Single source of truth for pricing; where prices live and how billing.ts aligns.
---

# Canonical Pricing Plans

**Why:** Four conflicting pricing definitions existed (landing CMS, LANDING_FALLBACK, billing.ts PLANS, plan-limits.ts). User confirmed: use canonical competitive prices, 2 months free annual discount, remove trial + free plan from public UI.

## Source of truth
`artifacts/shopify-optimizer/src/lib/pricing-plans.ts` — `CANONICAL_PLANS` array.
Landing.tsx imports and renders from this; CMS prices have NO effect on the pricing cards.

## Plans (June 2026)
| id | name | Monthly | Annual/yr | Stores | Images/mo |
|----|------|---------|-----------|--------|-----------|
| emprendedor | Emprendedor | €19 | €190 | 1 | 10 |
| starter | Starter | €49 | €490 | 3 | 45 |
| agency_pro | Growth | €149 | €1490 | 10 | 300 |
| enterprise | Enterprise | €399 | €3990 | ∞ | 1200 |

Annual = monthly × 10 (2 free months = 16.7% off).

## billing.ts
- PLANS record uses these same keys (emprendedor/starter/agency_pro/enterprise)
- Legacy keys (pro/agency) kept with `visible: false` for backward compat with DB rows
- GET /billing/plans filters `visible !== false` so admin only sees canonical 4 plans
- trial: `visible: false` (no free plan in public listing)

## How to apply
- To change prices: edit `CANONICAL_PLANS` in pricing-plans.ts AND billing.ts PLANS simultaneously
- Do NOT edit CMS pricing for canonical plan cards — those fields are now ignored
- plan-limits.ts `PLAN_LIMITS` must also match (productsPerMonth/maxImagesPerMonth)
