import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const STOREFRONT_ENDPOINT = () =>
  `https://${process.env.SHOP_DOMAIN || "comic-crafter.myshopify.com"}/api/2024-10/graphql.json`;

const STOREFRONT_TOKEN = () =>
  process.env.STOREFRONT_ACCESS_TOKEN || "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";

const COLLECTION_HANDLE = () =>
  process.env.COLLECTION_HANDLE || "shopify-automatization";

const PRODUCTS_QUERY = `
  query getCollectionProducts($handle: String!) {
    collectionByHandle(handle: $handle) {
      title
      products(first: 20) {
        edges {
          node {
            id
            title
            handle
            descriptionHtml
            productType
            tags
            priceRange {
              minVariantPrice { amount currencyCode }
            }
            compareAtPriceRange {
              minVariantPrice { amount currencyCode }
            }
            images(first: 3) {
              edges {
                node { url altText width height }
              }
            }
            variants(first: 5) {
              edges {
                node {
                  id
                  title
                  price { amount currencyCode }
                  compareAtPrice { amount currencyCode }
                  availableForSale
                  selectedOptions { name value }
                }
              }
            }
            metafields(
              identifiers: [
                {namespace: "custom", key: "features"},
                {namespace: "custom", key: "highlight"},
                {namespace: "custom", key: "badge"}
              ]
            ) {
              key
              value
            }
          }
        }
      }
    }
  }
`;

const CHECKOUT_MUTATION = `
  mutation cartCreate($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

router.get("/store/products", async (_req, res): Promise<void> => {
  try {
    const response = await fetch(STOREFRONT_ENDPOINT(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN(),
      },
      body: JSON.stringify({
        query: PRODUCTS_QUERY,
        variables: { handle: COLLECTION_HANDLE() },
      }),
    });

    const data = await response.json() as any;

    if (!response.ok || data.errors) {
      logger.error("Storefront API error:", JSON.stringify(data.errors || response.status));
      res.set("Cache-Control", "no-cache");
      res.json({ products: [], currency: process.env.SHOP_CURRENCY || "EUR", error: "collection_not_found" });
      return;
    }

    const products = data.data?.collectionByHandle?.products?.edges?.map((e: any) => e.node) || [];

    res.set("Cache-Control", "public, max-age=1800");
    res.json({ products, currency: process.env.SHOP_CURRENCY || "EUR" });
  } catch (err: any) {
    logger.error("Store products error:", err.message);
    res.status(500).json({ error: "Store temporarily unavailable" });
  }
});

router.post("/store/checkout", async (req, res): Promise<void> => {
  const { variantId, quantity = 1 } = req.body;

  if (!variantId) {
    res.status(400).json({ error: "variantId required" });
    return;
  }

  try {
    const response = await fetch(STOREFRONT_ENDPOINT(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN(),
      },
      body: JSON.stringify({
        query: CHECKOUT_MUTATION,
        variables: { lines: [{ merchandiseId: variantId, quantity }] },
      }),
    });

    const data = await response.json() as any;
    const checkoutUrl = data.data?.cartCreate?.cart?.checkoutUrl;
    const errors = data.data?.cartCreate?.userErrors;

    if (!checkoutUrl || (errors && errors.length > 0)) {
      throw new Error(errors?.[0]?.message || "Checkout creation failed");
    }

    res.json({ checkoutUrl });
  } catch (err: any) {
    logger.error("Checkout error:", err.message);
    res.status(500).json({ error: "Could not create checkout" });
  }
});

export default router;
