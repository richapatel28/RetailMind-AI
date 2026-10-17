const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const {
  register,
  login,
  updateLanguage,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/language", authMiddleware, updateLanguage);

module.exports = router;