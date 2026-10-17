const pool = require('../src/config/db');

async function repairPurchase14() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userId = 13;
    const purchaseId = 14;

    console.log("Starting repair for Purchase ID 14 (User 13)...");

    // Revert incorrectly updated stocks on old products
    const oldItems = [
      { prodId: 1, qty: 50, name: "Maggi", buyPrice: 12.00, sellPrice: 15.00, unit: "piece" },
      { prodId: 3, qty: 40, name: "Parle-G", buyPrice: 10.00, sellPrice: 12.00, unit: "piece" },
      { prodId: 13, qty: 24, name: "Amul Taaza Milk (1L)", buyPrice: 58.00, sellPrice: 65.00, unit: "litre" },
      { prodId: 4, qty: 30, name: "Coca Cola", buyPrice: 20.00, sellPrice: 25.00, unit: "bottle" },
      { prodId: 14, qty: 30, name: "Lay's Classic (52g)", buyPrice: 20.00, sellPrice: 25.00, unit: "pack" },
      { prodId: 2, qty: 20, name: "Tata Salt", buyPrice: 18.00, sellPrice: 22.00, unit: "kg" },
      { prodId: 15, qty: 12, name: "Fortune Sunflower Oil (1L)", buyPrice: 110.00, sellPrice: 135.00, unit: "litre" },
      { prodId: 5, qty: 10, name: "Surf Excel", buyPrice: 145.00, sellPrice: 175.00, unit: "kg" },
      { prodId: 16, qty: 20, name: "Colgate Strong Teeth (200g)", buyPrice: 52.00, sellPrice: 65.00, unit: "piece" },
      { prodId: 17, qty: 10, name: "Aashirvaad Atta (5kg)", buyPrice: 250.00, sellPrice: 295.00, unit: "bag" },
    ];

    for (const item of oldItems) {
      await client.query(
        "UPDATE products SET current_stock = GREATEST(0, current_stock - $1) WHERE id = $2",
        [item.qty, item.prodId]
      );
      console.log(`Reverted -${item.qty} stock from legacy product #${item.prodId}`);
    }

    // Now insert products for user 13 and link to purchase_items
    for (let i = 0; i < oldItems.length; i++) {
      const item = oldItems[i];
      const skuCode = item.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) + "-" + Math.floor(100 + Math.random() * 900);

      // Insert product for user 13
      const newProdRes = await client.query(
        `INSERT INTO products (
          name,
          sku,
          unit,
          purchase_price,
          selling_price,
          current_stock,
          reorder_level,
          is_active,
          user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
        RETURNING id, name, sku, current_stock, purchase_price, selling_price`,
        [
          item.name,
          skuCode,
          item.unit,
          item.buyPrice,
          item.sellPrice,
          item.qty,
          5,
          userId
        ]
      );

      const newProd = newProdRes.rows[0];
      console.log(`Created product #${newProd.id} (${newProd.name}) with stock ${newProd.current_stock} for user ${userId}`);

      // Update purchase_item to link to new product
      const pItemId = 23 + i; // 23 to 32
      await client.query(
        "UPDATE purchase_items SET product_id = $1 WHERE id = $2 AND purchase_id = $3",
        [newProd.id, pItemId, purchaseId]
      );

      // Create inventory movement
      await client.query(
        `INSERT INTO inventory_movements (
          product_id,
          movement_type,
          quantity,
          reference_id
        ) VALUES ($1, 'PURCHASE', $2, $3)`,
        [newProd.id, item.qty, purchaseId]
      );
    }

    await client.query("COMMIT");
    console.log("Repair completed successfully!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Repair failed, transaction rolled back:", err);
  } finally {
    client.release();
    pool.end();
  }
}

repairPurchase14();
