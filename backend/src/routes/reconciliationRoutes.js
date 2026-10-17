const express = require("express");

const multer = require("multer");

const authenticate = require("../middleware/authMiddleware");

const {
  uploadBankStatement,
  reconcilePdfBankStatement,
  getReconciliationHistory,
  getReconciliationSummary,
  getFinancialOverviewController
} = require("../controllers/reconciliationController");

const {
  testPdfExtraction
} = require("../controllers/pdfTestController");

const {
  parsePdfBankStatement
} = require("../controllers/pdfParseController");


const router = express.Router();


/*
|--------------------------------------------------------------------------
| Multer configuration
|--------------------------------------------------------------------------
*/

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  }
});


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

router.use(authenticate);


/*
|--------------------------------------------------------------------------
| CSV Bank Statement Upload
|--------------------------------------------------------------------------
*/

router.post(
  "/upload",

  (req, res, next) => {
    upload.single("file")(
      req,
      res,
      error => {
        if (error) {
          console.error(
            "MULTER ERROR:",
            error
          );

          return res.status(400).json({
            message:
              "File upload failed",

            error:
              error.message,

            code:
              error.code || null,

            field:
              error.field || null
          });
        }

        next();
      }
    );
  },

  uploadBankStatement
);


/*
|--------------------------------------------------------------------------
| PDF Text Extraction Test
|--------------------------------------------------------------------------
*/

router.post(
  "/pdf-test",

  (req, res, next) => {
    upload.single("file")(
      req,
      res,
      error => {
        if (error) {
          console.error(
            "MULTER ERROR:",
            error
          );

          return res.status(400).json({
            message:
              "File upload failed",

            error:
              error.message,

            code:
              error.code || null,

            field:
              error.field || null
          });
        }

        next();
      }
    );
  },

  testPdfExtraction
);


/*
|--------------------------------------------------------------------------
| PDF Parsing Test
|--------------------------------------------------------------------------
*/

router.post(
  "/pdf-parse-test",

  (req, res, next) => {
    upload.single("file")(
      req,
      res,
      error => {
        if (error) {
          console.error(
            "MULTER ERROR:",
            error
          );

          return res.status(400).json({
            message:
              "File upload failed",

            error:
              error.message,

            code:
              error.code || null,

            field:
              error.field || null
          });
        }

        next();
      }
    );
  },

  parsePdfBankStatement
);


/*
|--------------------------------------------------------------------------
| REAL PDF RECONCILIATION
|--------------------------------------------------------------------------
*/

router.post(
  "/pdf-upload",

  (req, res, next) => {
    upload.single("file")(
      req,
      res,
      error => {
        if (error) {
          console.error(
            "MULTER ERROR:",
            error
          );

          return res.status(400).json({
            message:
              "File upload failed",

            error:
              error.message,

            code:
              error.code || null,

            field:
              error.field || null
          });
        }

        next();
      }
    );
  },

  reconcilePdfBankStatement
);


/*
|--------------------------------------------------------------------------
| Reconciliation History
|--------------------------------------------------------------------------
*/

router.get(
  "/history",
  getReconciliationHistory
);


/*
|--------------------------------------------------------------------------
| Reconciliation Summary
|--------------------------------------------------------------------------
*/

router.get(
  "/summary",
  getReconciliationSummary
);

router.get(
  "/financials",
  getFinancialOverviewController
);

module.exports = router;