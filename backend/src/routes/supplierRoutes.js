const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  createSupplier,
  getSuppliers,
  getSupplier
} = require("../controllers/supplierController");

const router = express.Router();

router.use(authenticate);

router.post("/", createSupplier);
router.get("/", getSuppliers);
router.get("/:id", getSupplier);

module.exports = router;