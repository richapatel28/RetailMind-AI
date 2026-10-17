const pool = require('../src/config/db');

async function inspectAndRepair() {
  const client = await pool.connect();
  try {
    const userRes = await client.query("SELECT id, name, email FROM users WHERE email = 'garvita@gmail.com'");
    if (userRes.rows.length === 0) {
      console.log("User garvita@gmail.com not found!");
      return;
    }
    const user = userRes.rows[0];
    console.log("User:", user);
    const userId = user.id;

    // Fetch all purchases for this user
    const purchasesRes = await client.query(
      "SELECT * FROM purchases WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );
    console.log(`Found ${purchasesRes.rows.length} purchases for user ${userId}`);

    for (const purchase of purchasesRes.rows) {
      console.log(`\nProcessing purchase ID ${purchase.id}, invoice: ${purchase.invoice_no}, amount: ${purchase.total_amount}`);
      const itemsRes = await client.query(
        `SELECT pi.*, p.name as product_name, p.user_id as product_user_id, p.sku as product_sku, p.selling_price as product_selling_price
         FROM purchase_items pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.purchase_id = $1`,
        [purchase.id]
      );
      console.log(`Items count: ${itemsRes.rows.length}`);
      for (const item of itemsRes.rows) {
        console.log(`- Item ID: ${item.id}, product_id: ${item.product_id}, name: "${item.product_name}", qty: ${item.quantity}, unit_cost: ${item.unit_cost}, product_user_id: ${item.product_user_id}`);
      }
    }

    // Check existing products for user 13
    const productsRes = await client.query(
      "SELECT id, name, sku, current_stock, purchase_price, selling_price, user_id FROM products WHERE user_id = $1",
      [userId]
    );
    console.log(`\nCurrent products for user ${userId}: ${productsRes.rows.length}`);
    for (const p of productsRes.rows) {
      console.log(`- Product #${p.id}: ${p.name} | stock: ${p.current_stock} | buy: ${p.purchase_price} | sell: ${p.selling_price}`);
    }

  } catch (err) {
    console.error("Error during inspection:", err);
  } finally {
    client.release();
    pool.end();
  }
}

inspectAndRepair();
