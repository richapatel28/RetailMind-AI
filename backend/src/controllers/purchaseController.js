const pool = require("../config/db");

const createPurchase = async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user?.id || null;
    const {
      supplierId,
      supplierName,
      invoiceNo,
      purchaseDate,
      items,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "Purchase must contain at least one item",
      });
    }

    await client.query("BEGIN");

    // Resolve supplier ID if name given or supplierId provided
    let resolvedSupplierId = supplierId ? Number(supplierId) : null;
    if (!resolvedSupplierId && supplierName && supplierName.trim()) {
      const cleanName = supplierName.trim();
      const existing = await client.query(
        "SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1",
        [cleanName]
      );
      if (existing.rowCount > 0) {
        resolvedSupplierId = existing.rows[0].id;
      } else {
        const newSupplier = await client.query(
          "INSERT INTO suppliers (name, user_id) VALUES ($1, $2) RETURNING id",
          [cleanName, userId]
        );
        resolvedSupplierId = newSupplier.rows[0].id;
      }
    }

    let totalAmount = 0;
    const normalizedItems = [];
    const newProductsCreated = [];

    for (const item of items) {
      let productId = item.productId || item.product_id ? Number(item.productId || item.product_id) : null;
      if (item.productId === "__NEW__" || item.product_id === "__NEW__") {
        productId = null;
      }
      const isNewProduct = Boolean(item.isNewProduct || item.is_new_product || !productId);
      const productName = (item.productName || item.product_name || item.name || item.description || "").trim();
      const rawSku = (item.sku || "").trim() || null;
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost !== undefined ? item.unitCost : item.unit_cost);

      if (!productId && !productName) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Either productId or productName is required for each item",
        });
      }

      if (qty <= 0 || isNaN(unitCost) || unitCost < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Invalid quantity or unit cost for item '${productName || productId}'`,
        });
      }

      let resolvedProduct = null;

      if (productId && !isNewProduct) {
        const prodCheck = await client.query(
          "SELECT id, name, current_stock, purchase_price, sku FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE",
          [productId, userId]
        );
        if (prodCheck.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            message: `Product ID ${productId} not found`,
          });
        }
        resolvedProduct = prodCheck.rows[0];
      } else {
        // Look up by name or sku first for this user
        const existing = await client.query(
          `SELECT id, name, current_stock, purchase_price, sku FROM products
           WHERE (LOWER(TRIM(name)) = LOWER(TRIM($1))
              OR ($2::text IS NOT NULL AND LOWER(TRIM(sku)) = LOWER(TRIM($2))))
             AND user_id = $3
           FOR UPDATE LIMIT 1`,
          [productName, rawSku, userId]
        );

        if (existing.rowCount > 0) {
          resolvedProduct = existing.rows[0];
          productId = resolvedProduct.id;
        } else {
          // Auto create product
          let finalSku = rawSku;
          if (finalSku) {
            const skuCheck = await client.query(
              "SELECT id FROM products WHERE LOWER(TRIM(sku)) = LOWER(TRIM($1)) AND user_id = $2 LIMIT 1",
              [finalSku, userId]
            );
            if (skuCheck.rowCount > 0) {
              finalSku = `${finalSku}-${Math.floor(100 + Math.random() * 900)}`;
            }
          } else {
            const cleanSlug = productName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
            finalSku = `${cleanSlug || "PROD"}${Math.floor(100 + Math.random() * 900)}`;
          }

          const defaultSellingPrice = item.sellingPrice && Number(item.sellingPrice) > 0
            ? Number(item.sellingPrice)
            : unitCost > 0
            ? Number((unitCost * 1.25).toFixed(2))
            : 10.0;

          const newProd = await client.query(
            `INSERT INTO products (name, sku, unit, purchase_price, selling_price, current_stock, reorder_level, is_active, user_id)
             VALUES ($1, $2, $3, $4, $5, 0, 5, true, $6)
             RETURNING id, name, current_stock, purchase_price, sku`,
            [productName, finalSku, item.unit || "piece", unitCost, defaultSellingPrice, userId]
          );

          resolvedProduct = newProd.rows[0];
          productId = resolvedProduct.id;
          newProductsCreated.push(resolvedProduct);
        }
      }

      const itemTotal = Number((qty * unitCost).toFixed(2));
      totalAmount += itemTotal;

      normalizedItems.push({
        productId,
        name: resolvedProduct.name,
        sku: resolvedProduct.sku,
        quantity: qty,
        unitCost,
        itemTotal,
      });
    }

    const purchaseResult = await client.query(
      `INSERT INTO purchases
       (supplier_id, invoice_no, purchase_date, total_amount, user_id)
       VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), $4, $5)
       RETURNING *`,
      [
        resolvedSupplierId,
        invoiceNo ? String(invoiceNo).trim() : null,
        purchaseDate || null,
        totalAmount,
        userId,
      ]
    );

    const purchase = purchaseResult.rows[0];

    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO purchase_items
        (purchase_id, product_id, quantity, unit_cost, total_cost)
        VALUES ($1,$2,$3,$4,$5)`,
        [
          purchase.id,
          item.productId,
          item.quantity,
          item.unitCost,
          item.itemTotal,
        ]
      );

      await client.query(
        `UPDATE products
         SET current_stock = current_stock + $1,
             purchase_price = $2
         WHERE id = $3`,
        [
          item.quantity,
          item.unitCost,
          item.productId,
        ]
      );

      await client.query(
        `INSERT INTO inventory_movements
        (product_id, movement_type, quantity, reference_id)
        VALUES ($1,'PURCHASE',$2,$3)`,
        [
          item.productId,
          item.quantity,
          purchase.id,
        ]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Purchase created successfully",
      purchase: {
        id: purchase.id,
        invoice_no: purchase.invoice_no,
        supplier_id: purchase.supplier_id,
        purchase_date: purchase.purchase_date,
        total_amount: purchase.total_amount,
        items_count: normalizedItems.length,
      },
      inventory_updated: true,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CREATE PURCHASE ERROR:", error);
    res.status(500).json({
      message: "Failed to create purchase",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const getPurchases = async (req, res) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query(
      `SELECT p.id, p.invoice_no, p.purchase_date, p.total_amount, p.created_at,
              COALESCE(s.name, 'Supplier') AS supplier_name,
              COUNT(pi.id)::int AS items_count
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id, s.name
       ORDER BY p.purchase_date DESC, p.id DESC
       LIMIT 30`,
      [userId]
    );

    res.json({
      message: "Purchases fetched successfully",
      purchases: result.rows,
    });
  } catch (error) {
    console.error("GET PURCHASES ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch purchases",
      error: error.message,
    });
  }
};

module.exports = {
  createPurchase,
  getPurchases,
};