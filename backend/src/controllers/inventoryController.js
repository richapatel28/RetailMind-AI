const pool = require("../config/db");

// GET CURRENT INVENTORY
const getInventory = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT
        id,
        sku,
        name,
        unit,
        current_stock,
        reorder_level,
        purchase_price,
        selling_price,

        CASE
          WHEN current_stock <= reorder_level
          THEN true
          ELSE false
        END AS low_stock

      FROM products

      WHERE is_active = true
        AND user_id = $1

      ORDER BY name ASC`,
      [userId]
    );

    res.json({
      message: "Inventory fetched successfully",
      inventory: result.rows
    });

  } catch (error) {
    console.error("INVENTORY ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch inventory",
      error: error.message
    });
  }
};


// GET INVENTORY MOVEMENTS
const getInventoryMovements = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT
        im.id,
        im.product_id,
        p.name AS product_name,
        im.movement_type,
        im.quantity,
        im.reference_id,
        im.created_at

      FROM inventory_movements im

      JOIN products p
        ON im.product_id = p.id

      WHERE p.user_id = $1

      ORDER BY im.created_at DESC`,
      [userId]
    );

    res.json({
      message: "Inventory movements fetched successfully",
      movements: result.rows
    });

  } catch (error) {
    console.error("INVENTORY MOVEMENT ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch inventory movements",
      error: error.message
    });
  }
};


// GET LOW STOCK PRODUCTS
const getLowStock = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT
        id,
        sku,
        name,
        unit,
        current_stock,
        reorder_level,
        purchase_price,
        selling_price

      FROM products

      WHERE is_active = true
        AND current_stock <= reorder_level
        AND user_id = $1

      ORDER BY current_stock ASC`,
      [userId]
    );

    res.json({
      message: "Low-stock products fetched successfully",
      products: result.rows
    });

  } catch (error) {
    console.error("LOW STOCK ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch low-stock products",
      error: error.message
    });
  }
};


module.exports = {
  getInventory,
  getInventoryMovements,
  getLowStock
};