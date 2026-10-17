const pool = require("../config/db");

const createSupplier = async (req, res) => {
  try {
    const { name, contact } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Supplier name is required"
      });
    }

    const result = await pool.query(
      `INSERT INTO suppliers (name, contact)
       VALUES ($1, $2)
       RETURNING *`,
      [name, contact]
    );

    res.status(201).json({
      message: "Supplier created successfully",
      supplier: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create supplier"
    });
  }
};


const getSuppliers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM suppliers
       ORDER BY id DESC`
    );

    res.json(result.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch suppliers"
    });
  }
};


const getSupplier = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM suppliers
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Supplier not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch supplier"
    });
  }
};


module.exports = {
  createSupplier,
  getSuppliers,
  getSupplier
};