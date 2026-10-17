const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct
} = require("../controllers/productController");

const router = express.Router();

router.use(authenticate);

router.post("/", createProduct);
router.get("/", getProducts);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);

module.exports = router;