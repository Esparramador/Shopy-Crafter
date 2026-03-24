import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const dupCheck = await client.query(`
    SELECT shopify_product_id, project_id, count(*) as cnt 
    FROM products 
    GROUP BY shopify_product_id, project_id 
    HAVING count(*) > 1
  `);
  
  if (dupCheck.rows.length > 0) {
    console.log(`Found ${dupCheck.rows.length} duplicate product groups, cleaning...`);
    const result = await client.query(`
      DELETE FROM products a USING products b
      WHERE a.id < b.id
        AND a.project_id = b.project_id
        AND a.shopify_product_id = b.shopify_product_id
    `);
    console.log(`Removed ${result.rowCount} duplicate rows`);
  } else {
    console.log("No duplicate products found");
  }
} catch (err) {
  if (err.message?.includes('relation "products" does not exist')) {
    console.log("Products table does not exist yet, skipping dedup");
  } else {
    console.error("Pre-migrate error:", err.message);
  }
} finally {
  await client.end();
}
