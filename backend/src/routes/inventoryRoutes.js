const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  getInventory,
  getInventoryMovements,
  getLowStock
} = require("../controllers/inventoryController");

const router = express.Router();

router.use(authenticate);

router.get("/", getInventory);
router.get("/movements", getInventoryMovements);
router.get("/low-stock", getLowStock);

module.exports = router;