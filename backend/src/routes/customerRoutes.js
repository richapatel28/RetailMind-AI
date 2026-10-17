const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const {
  createCustomer,
  getCustomers,
  getCustomer
} = require("../controllers/customerController");

const router = express.Router();

router.use(authenticate);

router.post("/", createCustomer);
router.get("/", getCustomers);
router.get("/:id", getCustomer);

module.exports = router;