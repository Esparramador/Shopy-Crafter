import { Router } from "express";
import { SHOPIFY_API_VERSION } from "../lib/shopify.js";
import { logger } from "../lib/logger.js";

const router = Router();

const STOREFRONT_ENDPOINT = () =>
  `https://${process.env.SHOP_DOMAIN || "comic-crafter.myshopify.com"}/api/${SHOPIFY_API_VERSION}/graphql.json`;

const STOREFRONT_TOKEN = () =>
  process.env.STOREFRONT_ACCESS_TOKEN || "";

const COLLECTION_HANDLE = () =>
  process.env.COLLECTION_HANDLE || "shopify-automatization";

const PRODUCT_FIELDS = `
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
`;

const COLLECTION_QUERY = `
  query getCollectionProducts($handle: String!) {
    collectionByHandle(handle: $handle) {
      title
      products(first: 20) {
        edges { node { ${PRODUCT_FIELDS} } }
      }
    }
  }
`;

const ALL_PRODUCTS_QUERY = `
  query getAllProducts {
    products(first: 20, sortKey: BEST_SELLING) {
      edges { node { ${PRODUCT_FIELDS} } }
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

async function shopifyFetch(query: string, variables?: Record<string, any>) {
  const response = await fetch(STOREFRONT_ENDPOINT(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN(),
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json() as any;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

router.get("/store/products", async (_req, res): Promise<void> => {
  try {
    const currency = process.env.SHOP_CURRENCY || "EUR";
    try {
      // Try collection first
      const collectionData = await shopifyFetch(COLLECTION_QUERY, { handle: COLLECTION_HANDLE() });
      const collectionProducts = collectionData?.collectionByHandle?.products?.edges?.map((e: any) => e.node) || [];
  
      if (collectionProducts.length > 0) {
        res.set("Cache-Control", "public, max-age=1800");
        res.json({ products: collectionProducts, currency });
        return;
      }
  
      // Fallback: all products (collection doesn't exist or is empty)
      logger.info("Collection not found or empty — fetching all products");
      const allData = await shopifyFetch(ALL_PRODUCTS_QUERY);
      const allProducts = allData?.products?.edges?.map((e: any) => e.node) || [];
  
      res.set("Cache-Control", "public, max-age=1800");
      res.json({ products: allProducts, currency });
    } catch (err: any) {
      logger.error("Storefront API error:", err.message);
      res.set("Cache-Control", "no-cache");
      res.json({ products: [], currency });
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/store/checkout", async (req, res): Promise<void> => {
  try {
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
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: msg });
  }
});

export default router;
