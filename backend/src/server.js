const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const customerRoutes = require("./routes/customerRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const saleRoutes = require("./routes/saleRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const aiRoutes = require("./routes/aiRoutes");
const reconciliationRoutes = require("./routes/reconciliationRoutes");
const app = express();


// --------------------
// MIDDLEWARE
// --------------------

app.use(cors());

app.use(express.json());


// --------------------
// ROUTES
// --------------------

app.use("/api/auth", authRoutes);

app.use("/api/products", productRoutes);

app.use("/api/suppliers", supplierRoutes);

app.use("/api/customers", customerRoutes);

app.use("/api/purchases", purchaseRoutes);

app.use("/api/inventory", inventoryRoutes);

app.use("/api/sales", saleRoutes);

app.use("/api/payments", paymentRoutes);

app.use("/api/analytics", analyticsRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/ai", aiRoutes);

app.use("/api/reconciliation", reconciliationRoutes);

// --------------------
// HOME
// --------------------

app.get("/", (req, res) => {

  res.json({
    message: "RetailMind AI Backend is running"
  });

});


// --------------------
// DATABASE TEST
// --------------------

app.get("/api/test-db", async (req, res) => {

  try {

    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully",
      time: result.rows[0].now
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Database connection failed"
    });

  }

});


// --------------------
// 404 HANDLER
// --------------------

app.use((req, res) => {

  res.status(404).json({
    message: "API endpoint not found"
  });

});


// --------------------
// SERVER
// --------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`RetailMind AI backend running on port ${PORT}`);
});