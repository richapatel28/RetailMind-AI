const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  createSale,
  getSales,
  getSale
} = require("../controllers/saleController");

const router = express.Router();

router.use(authenticate);

router.post("/", createSale);
router.get("/", getSales);
router.get("/:id", getSale);

module.exports = router;