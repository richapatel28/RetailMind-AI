const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  createPurchase,
  getPurchases,
} = require("../controllers/purchaseController");

const router = express.Router();

router.use(authenticate);

router.post("/", createPurchase);
router.get("/", getPurchases);

module.exports = router;