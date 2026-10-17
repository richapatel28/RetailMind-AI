const fs = require("fs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const pool = require("d:/Capstone_Project/RetailMind/backend/src/config/db");
require("dotenv").config({ path: "d:/Capstone_Project/RetailMind/backend/.env" });

const BACKEND_URL = "http://localhost:5000";
const JWT_SECRET = process.env.JWT_SECRET;

const tokenUser1 = jwt.sign(
  { id: 1, email: "owner@test.com", role: "OWNER" },
  JWT_SECRET,
  { expiresIn: "1h" }
);
const authHeader = { Authorization: `Bearer ${tokenUser1}` };

async function verifyVoiceConsistency() {
  console.log("==================================================");
  console.log("VOICE CONFIRMATION CONSISTENCY VERIFICATION");
  console.log("==================================================");

  // 1. Process Voice
  const audioPath = "C:/Users/Patel Richa/.gemini/antigravity/brain/667b9ed0-7779-4979-a74b-c4084819751c/scratch/voice/english.m4a";
  const audioBuffer = fs.readFileSync(audioPath);

  const voiceFormData = new FormData();
  voiceFormData.append("file", new Blob([audioBuffer], { type: "audio/m4a" }), "english.m4a");
  voiceFormData.append("language", "en");

  console.log("\n[STEP 1] Calling POST /api/ai/voice/process with english.m4a...");
  const processRes = await axios.post(
    `${BACKEND_URL}/api/ai/voice/process`,
    voiceFormData,
    { headers: authHeader }
  );

  console.log("  Status:", processRes.status);
  console.log("  Transcript:", processRes.data.transcript);
  console.log("  Extracted Quantity:", processRes.data.quantity, `(Type: ${typeof processRes.data.quantity})`);
  console.log("  Extracted Amount:", processRes.data.amount, `(Type: ${typeof processRes.data.amount})`);
  console.log("  Payment Mode:", processRes.data.payment_mode);
  console.log("  Matched Product:", processRes.data.product_match?.matched_product?.name);

  const extractedQty = processRes.data.quantity;
  const extractedAmount = processRes.data.amount;
  const eventId = processRes.data.event_id;
  const matchedProductId = processRes.data.product_match?.matched_product?.id;

  // Assertions for Step 1
  if (extractedQty !== 5) {
    throw new Error(`Expected extracted quantity to be 5, got ${extractedQty}`);
  }
  if (extractedAmount !== 300) {
    throw new Error(`Expected extracted amount to be 300, got ${extractedAmount}`);
  }
  console.log("  ==> VERIFIED: /api/ai/voice/process returned quantity=5 and amount=300");

  // 2. Check current product stock in DB
  const preStockRes = await pool.query("SELECT current_stock, selling_price, name FROM products WHERE id = $1", [matchedProductId]);
  const initialStock = Number(preStockRes.rows[0].current_stock);
  const dbSellingPrice = Number(preStockRes.rows[0].selling_price);
  console.log(`\n[STEP 2] Pre-confirmation DB check for ${preStockRes.rows[0].name} (ID: ${matchedProductId}):`);
  console.log("  Current stock:", initialStock);
  console.log("  Catalog selling price:", dbSellingPrice);

  // 3. Confirm sale using exact extracted values
  const unitSellingPrice = extractedAmount / extractedQty; // 300 / 5 = 60
  console.log(`\n[STEP 3] Calling POST /api/ai/voice/confirm with exact extracted values:`);
  console.log(`  quantity: ${extractedQty}, selling_price: ${unitSellingPrice}, total: ${extractedAmount}`);

  const confirmRes = await axios.post(
    `${BACKEND_URL}/api/ai/voice/confirm`,
    {
      event_id: eventId,
      items: [
        {
          product_id: matchedProductId,
          quantity: extractedQty,
          selling_price: unitSellingPrice
        }
      ],
      payment_mode: processRes.data.payment_mode ? processRes.data.payment_mode.toUpperCase() : "CASH",
      payment_amount: extractedAmount
    },
    { headers: authHeader }
  );

  console.log("  Status:", confirmRes.status);
  console.log("  Created Sale ID:", confirmRes.data.sale_id);
  console.log("  Recorded Total Amount:", confirmRes.data.total_amount);
  console.log("  Recorded Payment Status:", confirmRes.data.payment_status);
  console.log("  Recorded Items:", JSON.stringify(confirmRes.data.items, null, 2));

  // Assertions for Step 3
  if (Number(confirmRes.data.total_amount) !== 300) {
    throw new Error(`Expected total_amount to be 300, got ${confirmRes.data.total_amount}`);
  }
  if (confirmRes.data.items[0].quantity !== 5) {
    throw new Error(`Expected item quantity to be 5, got ${confirmRes.data.items[0].quantity}`);
  }

  // 4. Verify DB changes
  console.log("\n[STEP 4] Verifying PostgreSQL database state...");
  const postStockRes = await pool.query("SELECT current_stock FROM products WHERE id = $1", [matchedProductId]);
  const postStock = Number(postStockRes.rows[0].current_stock);
  console.log("  Post-sale stock:", postStock);
  if (postStock !== initialStock - 5) {
    throw new Error(`Expected stock to decrement by 5 (${initialStock} -> ${initialStock - 5}), got ${postStock}`);
  }

  const dbSale = await pool.query("SELECT * FROM sales WHERE id = $1", [confirmRes.data.sale_id]);
  console.log("  DB Sale total_amount:", Number(dbSale.rows[0].total_amount));
  console.log("  DB Sale input_source:", dbSale.rows[0].input_source);
  if (Number(dbSale.rows[0].total_amount) !== 300) {
    throw new Error(`DB Sale total_amount is not 300: ${dbSale.rows[0].total_amount}`);
  }

  const dbSaleItems = await pool.query("SELECT * FROM sale_items WHERE sale_id = $1", [confirmRes.data.sale_id]);
  console.log("  DB Sale Item quantity:", Number(dbSaleItems.rows[0].quantity));
  console.log("  DB Sale Item selling_price:", Number(dbSaleItems.rows[0].selling_price));
  console.log("  DB Sale Item total_amount:", Number(dbSaleItems.rows[0].total_amount));
  if (Number(dbSaleItems.rows[0].quantity) !== 5) {
    throw new Error(`DB Sale Item quantity is not 5: ${dbSaleItems.rows[0].quantity}`);
  }
  if (Number(dbSaleItems.rows[0].total_amount) !== 300) {
    throw new Error(`DB Sale Item total_amount is not 300: ${dbSaleItems.rows[0].total_amount}`);
  }

  const dbPayment = await pool.query("SELECT * FROM payments WHERE sale_id = $1", [confirmRes.data.sale_id]);
  console.log("  DB Payment amount:", Number(dbPayment.rows[0].amount));
  console.log("  DB Payment mode:", dbPayment.rows[0].mode);
  if (Number(dbPayment.rows[0].amount) !== 300) {
    throw new Error(`DB Payment amount is not 300: ${dbPayment.rows[0].amount}`);
  }

  console.log("\n==================================================");
  console.log("ALL VOICE CONSISTENCY CHECKS PASSED!");
  console.log("==================================================");

  await pool.end();
}

verifyVoiceConsistency().catch(err => {
  console.error("CONSISTENCY CHECK FAILED:", err.response?.data || err.message);
  process.exit(1);
});
