const express = require("express");

const adminAuthenticate = require("../middleware/adminMiddleware");

const {
  getSystemStats,
  getOwners,
  getOwnerCount
} = require("../controllers/adminController");

const router = express.Router();


// All admin routes require developer API key

router.use(adminAuthenticate);


router.get("/stats", getSystemStats);

router.get("/owners", getOwners);

router.get("/owners/count", getOwnerCount);


module.exports = router;