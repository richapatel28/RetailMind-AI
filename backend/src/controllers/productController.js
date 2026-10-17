const pool = require("../config/db");

// CREATE PRODUCT
const createProduct = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const {
      sku,
      name,
      aliases = [],
      unit = "pcs",
      selling_price,
      cost_price = 0,
      current_stock = 0,
      reorder_level = 0
    } = req.body;

    if (!name || selling_price === undefined) {
      return res.status(400).json({
        message: "Product name and selling price are required"
      });
    }

    const result = await pool.query(
      `INSERT INTO products
       (sku, name, aliases, unit, selling_price, purchase_price,
        current_stock, reorder_level, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        sku,
        name,
        aliases,
        unit,
        selling_price,
        cost_price,
        current_stock,
        reorder_level,
        userId
      ]
    );

    res.status(201).json({
      message: "Product created successfully",
      product: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create product"
    });
  }
};


// GET ALL PRODUCTS
const getProducts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE user_id = $1 AND is_active = true
       ORDER BY id DESC`,
      [userId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch products"
    });
  }
};


// GET ONE PRODUCT
const getProduct = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM products
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch product"
    });
  }
};


// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    const {
      sku,
      name,
      aliases,
      unit,
      selling_price,
      cost_price,
      reorder_level
    } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET sku = $1,
           name = $2,
           aliases = $3,
           unit = $4,
           selling_price = $5,
           purchase_price = $6,
           reorder_level = $7
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        sku,
        name,
        aliases,
        unit,
        selling_price,
        cost_price,
        reorder_level,
        id,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.json({
      message: "Product updated successfully",
      product: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to update product"
    });
  }
};


module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct
};