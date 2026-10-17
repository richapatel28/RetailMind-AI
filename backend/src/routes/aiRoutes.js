const express = require("express");
const multer = require("multer");

const authenticate =
  require("../middleware/authMiddleware");

const {
  productMatch,
  confirmProductMatch,
  reconcilePaymentTransaction,
  confirmPaymentReconciliation,
  processVoiceSale,
  confirmVoiceSale,
  processInvoice,
  confirmInvoicePurchase,
  askStoreCopilot,
  executeAgentTask,
  approveAgentAction
} = require("../controllers/aiController");


const router =
  express.Router();


/*
|--------------------------------------------------------------------------
| Multer Upload Configurations (In-Memory Storage)
|--------------------------------------------------------------------------
*/

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(m4a|mp3|wav|ogg|webm)$/i;
    if (
      file.mimetype.startsWith("audio/") ||
      allowed.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid audio file format. Supported: .m4a, .mp3, .wav, .ogg, .webm"
        )
      );
    }
  }
});

function handleVoiceUpload(req, res, next) {
  voiceUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}

const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(jpg|jpeg|png|webp|pdf)$/i;
    const allowedMime = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf"
    ];

    if (
      allowedMime.includes(file.mimetype) ||
      allowedExt.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid invoice file format. Supported: .jpg, .jpeg, .png, .webp, .pdf"
        )
      );
    }
  }
});

function handleInvoiceUpload(req, res, next) {
  invoiceUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

router.use(authenticate);


/*
|--------------------------------------------------------------------------
| Product Matching
|--------------------------------------------------------------------------
*/

router.post(
  "/product-match",
  productMatch
);


router.post(
  "/product-match/confirm",
  confirmProductMatch
);


/*
|--------------------------------------------------------------------------
| Payment Reconciliation
|--------------------------------------------------------------------------
*/

router.post(
  "/reconciliation",
  reconcilePaymentTransaction
);


router.post(
  "/reconciliation/confirm",
  confirmPaymentReconciliation
);


/*
|--------------------------------------------------------------------------
| Voice Sales
|--------------------------------------------------------------------------
*/

router.post(
  "/voice/process",
  handleVoiceUpload,
  processVoiceSale
);


router.post(
  "/voice/confirm",
  confirmVoiceSale
);


/*
|--------------------------------------------------------------------------
| Invoice Intelligence
|--------------------------------------------------------------------------
*/

router.post(
  "/invoice/process",
  handleInvoiceUpload,
  processInvoice
);


router.post(
  "/invoice/confirm",
  confirmInvoicePurchase
);


/*
|--------------------------------------------------------------------------
| Store Intelligence Copilot (Local RAG)
|--------------------------------------------------------------------------
*/

router.post(
  "/copilot/query",
  askStoreCopilot
);


/*
|--------------------------------------------------------------------------
| Autonomous Retail Operations Agent (ReAct)
|--------------------------------------------------------------------------
*/

router.post(
  "/agent/run",
  executeAgentTask
);

router.post(
  "/agent/approve",
  approveAgentAction
);


module.exports = router;