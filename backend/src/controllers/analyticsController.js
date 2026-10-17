const pool = require("../config/db");


// ==========================================
// DASHBOARD SUMMARY
// ==========================================

const getDashboardSummary = async (req, res) => {

  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const salesResult = await pool.query(
      `SELECT
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(*) AS total_transactions
      FROM sales
      WHERE user_id = $1
        AND (DATE(sale_date) = CURRENT_DATE OR DATE(created_at) = CURRENT_DATE)`,
      [userId]
    );


    const profitResult = await pool.query(
      `SELECT
        COALESCE(SUM(si.profit), 0) AS total_profit
      FROM sale_items si
      JOIN sales s
        ON si.sale_id = s.id
      WHERE s.user_id = $1
        AND (DATE(s.sale_date) = CURRENT_DATE OR DATE(s.created_at) = CURRENT_DATE)`,
      [userId]
    );


    const expenseResult = await pool.query(
      `SELECT
        COALESCE(SUM(amount), 0) AS total_expenses
      FROM expenses
      WHERE user_id = $1
        AND DATE(expense_date) = CURRENT_DATE`,
      [userId]
    );


    const lowStockResult = await pool.query(
      `SELECT COUNT(*) AS low_stock_products
       FROM products
       WHERE is_active = true
         AND current_stock <= reorder_level
         AND user_id = $1`,
      [userId]
    );


    res.json({

      today_sales:
        Number(salesResult.rows[0].total_sales),

      today_transactions:
        Number(salesResult.rows[0].total_transactions),

      today_profit:
        Number(profitResult.rows[0].total_profit),

      today_expenses:
        Number(expenseResult.rows[0].total_expenses),

      low_stock_products:
        Number(lowStockResult.rows[0].low_stock_products)

    });


  } catch (error) {

    console.error("DASHBOARD ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch dashboard summary"
    });

  }
};


// ==========================================
// PROFIT BY PRODUCT
// ==========================================

const getProfit = async (req, res) => {

  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT
        p.id,
        p.name,

        COALESCE(SUM(si.quantity), 0) AS units_sold,

        COALESCE(
          SUM(si.total_amount),
          0
        ) AS revenue,

        COALESCE(
          SUM(si.quantity * si.cost_price),
          0
        ) AS cost,

        COALESCE(
          SUM(si.profit),
          0
        ) AS profit

      FROM products p

      LEFT JOIN (
        SELECT si.product_id, si.quantity, si.total_amount, si.cost_price, si.profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.user_id = $1
      ) si ON p.id = si.product_id

      GROUP BY p.id, p.name

      ORDER BY profit DESC`,
      [userId]
    );


    res.json(result.rows);

  } catch (error) {

    console.error("PROFIT ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch profit analytics"
    });

  }
};


// ==========================================
// SALES SUMMARY
// ==========================================

const getSalesSummary = async (req, res) => {

  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT
        DATE(sale_date) AS sale_date,
        COUNT(*) AS transactions,
        COALESCE(SUM(total_amount), 0) AS sales
      FROM sales
      WHERE user_id = $1
      GROUP BY DATE(sale_date)
      ORDER BY DATE(sale_date) DESC
      LIMIT 30`,
      [userId]
    );


    res.json({
      message: "Sales summary fetched successfully",
      data: result.rows
    });

  } catch (error) {

    console.error("SALES SUMMARY ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch sales summary"
    });

  }
};


// ==========================================
// TOP SELLING PRODUCTS
// ==========================================

const getTopProducts = async (req, res) => {

  try {

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await pool.query(
      `SELECT
        p.id,
        p.name,
        p.sku,
        SUM(si.quantity) AS units_sold,
        SUM(si.total_amount) AS revenue

      FROM sale_items si

      JOIN sales s
        ON si.sale_id = s.id

      JOIN products p
        ON si.product_id = p.id

      WHERE s.user_id = $1

      GROUP BY p.id, p.name, p.sku

      ORDER BY units_sold DESC

      LIMIT 10`,
      [userId]
    );


    res.json({
      message: "Top products fetched successfully",
      products: result.rows
    });

  } catch (error) {

    console.error("TOP PRODUCTS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch top products"
    });

  }
};


// ==========================================
// LOW STOCK SUMMARY
// ==========================================

const getLowStockSummary = async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        name,
        sku,
        current_stock,
        reorder_level
      FROM products
      WHERE is_active = true
      AND current_stock <= reorder_level
      ORDER BY current_stock ASC
    `);


    res.json({
      message: "Low stock summary fetched successfully",
      products: result.rows
    });

  } catch (error) {

    console.error("LOW STOCK ANALYTICS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch low stock summary"
    });

  }
};


module.exports = {
  getDashboardSummary,
  getProfit,
  getSalesSummary,
  getTopProducts,
  getLowStockSummary
};