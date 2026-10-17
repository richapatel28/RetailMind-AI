const pool = require("../config/db");

const createCustomer = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { name, contact, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Customer name is required"
      });
    }

    const result = await pool.query(
      `INSERT INTO customers (name, contact, address, user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), contact ? contact.trim() : null, address ? address.trim() : null, userId]
    );

    res.status(201).json({
      message: "Customer created successfully",
      customer: result.rows[0]
    });

  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    res.status(500).json({
      message: "Failed to create customer"
    });
  }
};


const getCustomers = async (req, res) => {
  try {
    const userId = req.user?.id || null;

    const result = await pool.query(
      `SELECT *
       FROM customers
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY name ASC`,
      [userId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch customers"
    });
  }
};


const getCustomer = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM customers
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Customer not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch customer"
    });
  }
};


module.exports = {
  createCustomer,
  getCustomers,
  getCustomer
};