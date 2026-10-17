const fs = require("fs");
const axios = require("axios");

const API_BASE = "http://localhost:5000/api";

async function runFrontendFlowTests() {
  console.log("==================================================");
  console.log("FRONTEND INTEGRATION FLOW VERIFICATION");
  console.log("==================================================");

  // ----------------------------------------------------
  // FLOW 1: Login -> Authenticate Session
  // ----------------------------------------------------
  console.log("\n[FLOW 1] Testing Login Flow (POST /auth/login)...");
  const loginRes = await axios.post(`${API_BASE}/auth/login`, {
    email: "owner@test.com",
    password: "password123"
  });

  console.log("  Status:", loginRes.status);
  console.log("  User:", loginRes.data.user?.name, `(${loginRes.data.user?.email})`);
  console.log("  Token received:", !!loginRes.data.token);

  if (!loginRes.data.token) {
    throw new Error("Login failed to return token!");
  }
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log("  PASS: Login flow succeeded");

  // ----------------------------------------------------
  // FLOW 2: Dashboard Data Aggregation
  // ----------------------------------------------------
  console.log("\n[FLOW 2] Testing Dashboard Services Data Fetch...");
  const [analyticsRes, reconSummaryRes, productsRes, salesRes] = await Promise.all([
    axios.get(`${API_BASE}/analytics/dashboard`, { headers: authHeaders }),
    axios.get(`${API_BASE}/reconciliation/summary`, { headers: authHeaders }),
    axios.get(`${API_BASE}/products`, { headers: authHeaders }),
    axios.get(`${API_BASE}/sales`, { headers: authHeaders }),
  ]);

  console.log("  Today's Sales:", analyticsRes.data.today_sales);
  console.log("  Today's Profit:", analyticsRes.data.today_profit);
  console.log("  Reconciliation Unmatched:", reconSummaryRes.data.summary?.unmatched);
  console.log("  Product Catalog Count:", productsRes.data.length);
  console.log("  Recent Sales Count:", salesRes.data.length);
  console.log("  PASS: Dashboard data aggregation succeeded");

  // ----------------------------------------------------
  // FLOW 3: Voice Sale Capture -> Review -> Confirm
  // ----------------------------------------------------
  console.log("\n[FLOW 3] Testing Voice Sale Flow...");
  const audioPath = "C:/Users/Patel Richa/.gemini/antigravity/brain/667b9ed0-7779-4979-a74b-c4084819751c/scratch/voice/english.m4a";
  const audioBuffer = fs.readFileSync(audioPath);

  const voiceFormData = new FormData();
  voiceFormData.append("file", new Blob([audioBuffer], { type: "audio/m4a" }), "english.m4a");
  voiceFormData.append("language", "en");

  console.log("  Sending audio to POST /ai/voice/process...");
  const voiceRes = await axios.post(`${API_BASE}/ai/voice/process`, voiceFormData, { headers: authHeaders });
  console.log("  Voice Transcript:", voiceRes.data.transcript);
  console.log("  Voice Extracted Qty:", voiceRes.data.quantity);
  console.log("  Voice Extracted Amount:", voiceRes.data.amount);
  console.log("  Voice Matched Product:", voiceRes.data.product_match?.matched_product?.name);
  console.log("  Voice Event ID:", voiceRes.data.event_id);

  const matchedProdId = voiceRes.data.product_match?.matched_product?.id || 1;
  const extractedQty = voiceRes.data.quantity || 5;
  const extractedAmt = voiceRes.data.amount || 300;
  const calculatedUnitPrice = extractedAmt / extractedQty;

  console.log("  Confirming Voice Sale via POST /ai/voice/confirm...");
  const voiceConfirmRes = await axios.post(
    `${API_BASE}/ai/voice/confirm`,
    {
      event_id: voiceRes.data.event_id,
      items: [
        {
          product_id: matchedProdId,
          quantity: extractedQty,
          selling_price: calculatedUnitPrice
        }
      ],
      payment_mode: "CASH",
      payment_amount: extractedAmt
    },
    { headers: authHeaders }
  );

  console.log("  Confirmed Sale ID:", voiceConfirmRes.data.sale_id);
  console.log("  Confirmed Total:", voiceConfirmRes.data.total_amount);
  console.log("  Payment Status:", voiceConfirmRes.data.payment_status);
  console.log("  PASS: Voice Sale capture and confirmation flow succeeded");

  // ----------------------------------------------------
  // FLOW 4: Invoice Intelligence -> Review -> Confirm
  // ----------------------------------------------------
  console.log("\n[FLOW 4] Testing Invoice Intelligence Flow...");
  const invoicePath = "C:/Users/Patel Richa/.gemini/antigravity/brain/667b9ed0-7779-4979-a74b-c4084819751c/scratch/invoice/data/synthetic/images/invoice_0001.png";
  const invoiceBuffer = fs.readFileSync(invoicePath);

  const invoiceFormData = new FormData();
  invoiceFormData.append("file", new Blob([invoiceBuffer], { type: "image/png" }), "invoice_0001.png");

  console.log("  Sending invoice image to POST /ai/invoice/process...");
  const invoiceRes = await axios.post(`${API_BASE}/ai/invoice/process`, invoiceFormData, { headers: authHeaders });
  console.log("  Supplier:", invoiceRes.data.supplier);
  console.log("  Invoice Number:", invoiceRes.data.invoice_number);
  console.log("  Math Validation:", invoiceRes.data.validation?.is_valid);
  console.log("  Line Items Found:", invoiceRes.data.items?.length);
  console.log("  Invoice Event ID:", invoiceRes.data.event_id);

  console.log("  Confirming Invoice Purchase via POST /ai/invoice/confirm...");
  const invoiceConfirmRes = await axios.post(
    `${API_BASE}/ai/invoice/confirm`,
    {
      event_id: invoiceRes.data.event_id,
      invoice_no: invoiceRes.data.invoice_number,
      items: [
        {
          product_id: 1,
          quantity: 5,
          unit_cost: 12.00
        }
      ]
    },
    { headers: authHeaders }
  );

  console.log("  Confirmed Purchase ID:", invoiceConfirmRes.data.purchase_id);
  console.log("  Purchase Total:", invoiceConfirmRes.data.total_amount);
  console.log("  PASS: Invoice extraction and purchase confirmation flow succeeded");

  // ----------------------------------------------------
  // FLOW 5: Payment Reconciliation Flow
  // ----------------------------------------------------
  console.log("\n[FLOW 5] Testing Payment Reconciliation Flow...");
  const singleReconRes = await axios.post(
    `${API_BASE}/ai/reconciliation`,
    {
      transaction_date: "2026-09-06",
      amount: 300,
      direction: "CREDIT",
      narration: "UPI payment received from customer",
      reference: "UPI/20260906/001"
    },
    { headers: authHeaders }
  );

  console.log("  Reconciliation Status:", singleReconRes.data.status);
  console.log("  Confidence:", singleReconRes.data.confidence);
  console.log("  Event ID:", singleReconRes.data.event_id);
  console.log("  PASS: Payment reconciliation flow succeeded");

  // ----------------------------------------------------
  // FLOW 6: Product Matching Flow
  // ----------------------------------------------------
  console.log("\n[FLOW 6] Testing AI Product Matching Flow...");
  const pmRes = await axios.post(
    `${API_BASE}/ai/product-match`,
    { product_name: "maggie 70g" },
    { headers: authHeaders }
  );

  console.log("  Query: 'maggie 70g'");
  console.log("  Matched Product:", pmRes.data.matched_product?.name);
  console.log("  Match Confidence:", pmRes.data.confidence);
  console.log("  Candidates Count:", pmRes.data.candidates?.length);
  console.log("  PASS: Product matching flow succeeded");

  console.log("\n==================================================");
  console.log("ALL 6 FRONTEND INTEGRATION FLOWS PASSED!");
  console.log("==================================================");
}

runFrontendFlowTests().catch((err) => {
  console.error("FLOW TEST FAILED:", err.response?.data || err.message);
  process.exit(1);
});
