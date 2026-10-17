const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const pool = require("d:/Capstone_Project/RetailMind/backend/src/config/db");

require("dotenv").config({ path: "d:/Capstone_Project/RetailMind/backend/.env" });

const BACKEND_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET;

// 1. Generate auth tokens
const tokenUser1 = jwt.sign(
  { id: 1, email: "owner@test.com", role: "OWNER" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const tokenUser3 = jwt.sign(
  { id: 3, email: "richa@gmail.com", role: "OWNER" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const authHeaderUser1 = { Authorization: `Bearer ${tokenUser1}` };
const authHeaderUser3 = { Authorization: `Bearer ${tokenUser3}` };

async function runTests() {
  console.log("==================================================");
  console.log("PHASE 4: NODE.JS BACKEND END-TO-END VERIFICATION");
  console.log("==================================================");

  // ----------------------------------------------------
  // TEST 1: Authentication enforcement
  // ----------------------------------------------------
  console.log("\n[TEST 1] Authentication check without token");
  try {
    await axios.post(`${BACKEND_URL}/api/ai/product-match`, { product_name: "Maggi" });
    throw new Error("Expected 401 Unauthorized, but request succeeded!");
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log("  PASS: Properly rejected with 401 Unauthorized");
    } else {
      throw err;
    }
  }

  // ----------------------------------------------------
  // TEST 2: Product Matching Regression via Node
  // ----------------------------------------------------
  console.log("\n[TEST 2] Product Matching via Node Backend: POST /api/ai/product-match");
  const pmRes = await axios.post(
    `${BACKEND_URL}/api/ai/product-match`,
    { product_name: "Maggi noodles" },
    { headers: authHeaderUser1 }
  );
  console.log("  Status:", pmRes.status);
  console.log("  Matched Product:", pmRes.data.matched_product?.name);
  console.log("  Event ID created:", pmRes.data.event_id);
  if (pmRes.status !== 200 || pmRes.data.matched_product?.id !== 1) {
    throw new Error("Product Matching failed!");
  }
  console.log("  PASS: Product matching regression succeeded");

  // ----------------------------------------------------
  // TEST 3: Payment Reconciliation Regression via Node
  // ----------------------------------------------------
  console.log("\n[TEST 3] Payment Reconciliation via Node Backend: POST /api/ai/reconciliation");
  const reconRes = await axios.post(
    `${BACKEND_URL}/api/ai/reconciliation`,
    {
      transaction_date: "2026-09-06",
      amount: 300,
      direction: "CREDIT",
      narration: "Payment received from customer",
      reference: "REF12345"
    },
    { headers: authHeaderUser1 }
  );
  console.log("  Status:", reconRes.status);
  console.log("  Status field:", reconRes.data.status);
  console.log("  Event ID created:", reconRes.data.event_id);
  if (reconRes.status !== 200) {
    throw new Error("Payment Reconciliation failed!");
  }
  console.log("  PASS: Payment reconciliation regression succeeded");

  // ----------------------------------------------------
  // TEST 4: Voice Process via Node Backend
  // ----------------------------------------------------
  console.log("\n[TEST 4] Voice Process: POST /api/ai/voice/process");
  const audioPath = "C:/Users/Patel Richa/.gemini/antigravity/brain/667b9ed0-7779-4979-a74b-c4084819751c/scratch/voice/english.m4a";
  const audioBuffer = fs.readFileSync(audioPath);

  const voiceFormData = new FormData();
  voiceFormData.append("file", new Blob([audioBuffer], { type: "audio/m4a" }), "english.m4a");
  voiceFormData.append("language", "en");

  const voiceProcessRes = await axios.post(
    `${BACKEND_URL}/api/ai/voice/process`,
    voiceFormData,
    { headers: { ...authHeaderUser1 } }
  );
  console.log("  Status:", voiceProcessRes.status);
  console.log("  Transcript:", voiceProcessRes.data.transcript);
  console.log("  Intent:", voiceProcessRes.data.intent);
  console.log("  Product Text:", voiceProcessRes.data.product_text);
  console.log("  Matched Product:", voiceProcessRes.data.product_match?.matched_product?.name);
  console.log("  Voice Event ID:", voiceProcessRes.data.event_id);

  const voiceEventId = voiceProcessRes.data.event_id;
  if (!voiceEventId || voiceProcessRes.data.intent !== "sale") {
    throw new Error("Voice processing failed!");
  }
  console.log("  PASS: Voice processing succeeded");

  // ----------------------------------------------------
  // TEST 5: Voice Sale Confirmation (Database Transaction)
  // ----------------------------------------------------
  console.log("\n[TEST 5] Voice Sale Confirmation: POST /api/ai/voice/confirm");
  
  // Check initial stock for Product ID 1 (Maggi)
  const preStockRes = await pool.query("SELECT current_stock FROM products WHERE id = 1");
  const initialStock = Number(preStockRes.rows[0].current_stock);
  console.log("  Current stock of Maggi before sale:", initialStock);

  const voiceConfirmRes = await axios.post(
    `${BACKEND_URL}/api/ai/voice/confirm`,
    {
      event_id: voiceEventId,
      items: [
        {
          product_id: 1,
          quantity: 2,
          selling_price: 15
        }
      ],
      payment_mode: "CASH",
      payment_amount: 30
    },
    { headers: authHeaderUser1 }
  );

  console.log("  Status:", voiceConfirmRes.status);
  console.log("  Sale ID created:", voiceConfirmRes.data.sale_id);
  console.log("  Total Amount:", voiceConfirmRes.data.total_amount);
  console.log("  Payment Status:", voiceConfirmRes.data.payment_status);

  // Verify stock decremented
  const postStockRes = await pool.query("SELECT current_stock FROM products WHERE id = 1");
  const postStock = Number(postStockRes.rows[0].current_stock);
  console.log("  Current stock of Maggi after sale:", postStock);
  if (postStock !== initialStock - 2) {
    throw new Error(`Expected stock ${initialStock - 2}, got ${postStock}`);
  }

  // Verify sale record in DB
  const dbSale = await pool.query("SELECT * FROM sales WHERE id = $1", [voiceConfirmRes.data.sale_id]);
  console.log("  DB Sale input_source:", dbSale.rows[0].input_source);
  if (dbSale.rows[0].input_source !== "VOICE") {
    throw new Error("Sale input_source is not VOICE!");
  }

  // Verify ai_event marked confirmed
  const dbEvent = await pool.query("SELECT confirmed, confirmed_at, selected_product_id FROM ai_events WHERE id = $1", [voiceEventId]);
  console.log("  AI Event confirmed:", dbEvent.rows[0].confirmed, "at", dbEvent.rows[0].confirmed_at);
  if (!dbEvent.rows[0].confirmed) {
    throw new Error("AI event not marked confirmed!");
  }
  console.log("  PASS: Voice sale confirmed and DB verified");

  // ----------------------------------------------------
  // TEST 6: Duplicate Confirmation Protection
  // ----------------------------------------------------
  console.log("\n[TEST 6] Duplicate Confirmation Protection");
  try {
    await axios.post(
      `${BACKEND_URL}/api/ai/voice/confirm`,
      { event_id: voiceEventId, items: [{ product_id: 1, quantity: 1 }] },
      { headers: authHeaderUser1 }
    );
    throw new Error("Duplicate confirmation should have been rejected!");
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log("  PASS: Duplicate confirmation cleanly rejected with 400");
    } else {
      throw err;
    }
  }

  // ----------------------------------------------------
  // TEST 7: Cross-Owner Security Check
  // ----------------------------------------------------
  console.log("\n[TEST 7] Cross-Owner Security Check (User 3 trying to confirm User 1's event)");
  try {
    await axios.post(
      `${BACKEND_URL}/api/ai/voice/confirm`,
      { event_id: voiceEventId, items: [{ product_id: 1, quantity: 1 }] },
      { headers: authHeaderUser3 }
    );
    throw new Error("Cross-owner confirmation should have been rejected!");
  } catch (err) {
    if (err.response && (err.response.status === 404 || err.response.status === 403)) {
      console.log(`  PASS: Cross-owner request blocked with ${err.response.status}`);
    } else {
      throw err;
    }
  }

  // ----------------------------------------------------
  // TEST 8: Invoice Process via Node Backend
  // ----------------------------------------------------
  console.log("\n[TEST 8] Invoice Process: POST /api/ai/invoice/process");
  const invoicePath = "C:/Users/Patel Richa/.gemini/antigravity/brain/667b9ed0-7779-4979-a74b-c4084819751c/scratch/invoice/data/synthetic/images/invoice_0001.png";
  const invoiceBuffer = fs.readFileSync(invoicePath);

  const invoiceFormData = new FormData();
  invoiceFormData.append("file", new Blob([invoiceBuffer], { type: "image/png" }), "invoice_0001.png");

  const invoiceProcessRes = await axios.post(
    `${BACKEND_URL}/api/ai/invoice/process`,
    invoiceFormData,
    { headers: { ...authHeaderUser1 } }
  );
  console.log("  Status:", invoiceProcessRes.status);
  console.log("  Supplier:", invoiceProcessRes.data.supplier);
  console.log("  Invoice No:", invoiceProcessRes.data.invoice_number);
  console.log("  Line Items Count:", invoiceProcessRes.data.items?.length);
  console.log("  Validation is_valid:", invoiceProcessRes.data.validation?.is_valid);
  console.log("  Invoice Event ID:", invoiceProcessRes.data.event_id);

  const invoiceEventId = invoiceProcessRes.data.event_id;
  if (!invoiceEventId || !invoiceProcessRes.data.items?.length) {
    throw new Error("Invoice processing failed!");
  }
  console.log("  PASS: Invoice processing succeeded");

  // ----------------------------------------------------
  // TEST 9: Invoice Purchase Confirmation (Database Transaction)
  // ----------------------------------------------------
  console.log("\n[TEST 9] Invoice Purchase Confirmation: POST /api/ai/invoice/confirm");
  
  // Check initial stock for Product ID 1 (Maggi)
  const prePurchaseStockRes = await pool.query("SELECT current_stock FROM products WHERE id = 1");
  const prePurchaseStock = Number(prePurchaseStockRes.rows[0].current_stock);
  console.log("  Current stock of Maggi before purchase:", prePurchaseStock);

  const invoiceConfirmRes = await axios.post(
    `${BACKEND_URL}/api/ai/invoice/confirm`,
    {
      event_id: invoiceEventId,
      invoice_no: invoiceProcessRes.data.invoice_number,
      items: [
        {
          product_id: 1,
          quantity: 10,
          unit_cost: 12.50
        }
      ]
    },
    { headers: authHeaderUser1 }
  );

  console.log("  Status:", invoiceConfirmRes.status);
  console.log("  Purchase ID created:", invoiceConfirmRes.data.purchase_id);
  console.log("  Total Amount:", invoiceConfirmRes.data.total_amount);

  // Verify stock incremented
  const postPurchaseStockRes = await pool.query("SELECT current_stock, purchase_price FROM products WHERE id = 1");
  const postPurchaseStock = Number(postPurchaseStockRes.rows[0].current_stock);
  const updatedPurchasePrice = Number(postPurchaseStockRes.rows[0].purchase_price);
  console.log("  Current stock of Maggi after purchase:", postPurchaseStock);
  console.log("  Updated purchase price of Maggi:", updatedPurchasePrice);
  if (postPurchaseStock !== prePurchaseStock + 10) {
    throw new Error(`Expected stock ${prePurchaseStock + 10}, got ${postPurchaseStock}`);
  }
  if (updatedPurchasePrice !== 12.50) {
    throw new Error(`Expected purchase_price 12.50, got ${updatedPurchasePrice}`);
  }

  // Verify purchase record in DB
  const dbPurchase = await pool.query("SELECT * FROM purchases WHERE id = $1", [invoiceConfirmRes.data.purchase_id]);
  console.log("  DB Purchase ID:", dbPurchase.rows[0].id, "total:", dbPurchase.rows[0].total_amount);

  // Verify ai_event marked confirmed
  const dbInvoiceEvent = await pool.query("SELECT confirmed, confirmed_at FROM ai_events WHERE id = $1", [invoiceEventId]);
  console.log("  AI Event confirmed:", dbInvoiceEvent.rows[0].confirmed, "at", dbInvoiceEvent.rows[0].confirmed_at);
  if (!dbInvoiceEvent.rows[0].confirmed) {
    throw new Error("Invoice AI event not marked confirmed!");
  }
  console.log("  PASS: Invoice purchase confirmed and DB verified");

  // ----------------------------------------------------
  // TEST 10: Invalid File Upload Format Rejection
  // ----------------------------------------------------
  console.log("\n[TEST 10] Invalid File Upload Format Rejection");
  const invalidFormData = new FormData();
  invalidFormData.append("file", new Blob([Buffer.from("dummy text")], { type: "text/plain" }), "test.txt");

  try {
    await axios.post(`${BACKEND_URL}/api/ai/voice/process`, invalidFormData, { headers: authHeaderUser1 });
    throw new Error("Expected 400 for text/plain file on voice endpoint!");
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log("  PASS: Invalid audio format cleanly rejected with 400:", err.response.data.message);
    } else {
      throw err;
    }
  }

  console.log("\n==================================================");
  console.log("ALL 10 END-TO-END & REGRESSION TESTS PASSED!");
  console.log("==================================================");
  await pool.end();
}

runTests().catch(err => {
  console.error("TEST FAILED WITH ERROR:", err.response?.data || err.message);
  process.exit(1);
});
