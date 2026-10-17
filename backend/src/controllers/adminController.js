const pool = require("../config/db");


// ==========================================
// GET SYSTEM STATISTICS
// ==========================================

const getSystemStats = async (req, res) => {

  try {

    const ownersResult = await pool.query(`
      SELECT COUNT(*) AS total_owners
      FROM users
      WHERE role = 'OWNER'
    `);

    const productsResult = await pool.query(`
      SELECT COUNT(*) AS total_products
      FROM products
    `);

    const customersResult = await pool.query(`
      SELECT COUNT(*) AS total_customers
      FROM customers
    `);

    const suppliersResult = await pool.query(`
      SELECT COUNT(*) AS total_suppliers
      FROM suppliers
    `);

    const salesResult = await pool.query(`
      SELECT COUNT(*) AS total_sales
      FROM sales
    `);

    res.json({
      total_owners: Number(ownersResult.rows[0].total_owners),
      total_products: Number(productsResult.rows[0].total_products),
      total_customers: Number(customersResult.rows[0].total_customers),
      total_suppliers: Number(suppliersResult.rows[0].total_suppliers),
      total_sales: Number(salesResult.rows[0].total_sales)
    });

  } catch (error) {

    console.error("ADMIN STATS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch system statistics"
    });
  }
};


// ==========================================
// GET REGISTERED OWNERS
// ==========================================

const getOwners = async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        name,
        email,
        role,
        language,
        created_at
      FROM users
      WHERE role = 'OWNER'
      ORDER BY created_at DESC
    `);

    res.json({
      message: "Owners fetched successfully",
      owners: result.rows
    });

  } catch (error) {

    console.error("GET OWNERS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch owners"
    });
  }
};


// ==========================================
// GET OWNER COUNT
// ==========================================

const getOwnerCount = async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT COUNT(*) AS total_owners
      FROM users
      WHERE role = 'OWNER'
    `);

    res.json({
      total_owners: Number(result.rows[0].total_owners)
    });

  } catch (error) {

    console.error("OWNER COUNT ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch owner count"
    });
  }
};


module.exports = {
  getSystemStats,
  getOwners,
  getOwnerCount
};