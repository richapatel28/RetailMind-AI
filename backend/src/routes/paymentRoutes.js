const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  createPayment,
  getPayments
} = require("../controllers/paymentController");

const router = express.Router();

router.use(authenticate);

router.post("/", createPayment);
router.get("/", getPayments);

module.exports = router;