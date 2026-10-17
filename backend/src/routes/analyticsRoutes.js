const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  getDashboardSummary,
  getProfit,
  getSalesSummary,
  getTopProducts,
  getLowStockSummary
} = require("../controllers/analyticsController");

const router = express.Router();


// Owner authentication required

router.use(authenticate);


router.get("/dashboard", getDashboardSummary);

router.get("/profit", getProfit);

router.get("/sales", getSalesSummary);

router.get("/top-products", getTopProducts);

router.get("/low-stock", getLowStockSummary);


module.exports = router;