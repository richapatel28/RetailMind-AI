import api from "./api";

/**
 * Retrieves payment reconciliation summary stats.
 */
export const getReconciliationSummary = async () => {
  const response = await api.get("/reconciliation/summary");
  return response.data;
};

/**
 * Retrieves store financial metrics (Sales, Purchases, Expenses, Profit).
 */
export const getStoreFinancials = async () => {
  const response = await api.get("/reconciliation/financials");
  return response.data;
};

/**
 * Retrieves reconciliation history.
 */
export const getReconciliationHistory = async () => {
  const response = await api.get("/reconciliation/history");
  return response.data;
};

/**
 * Uploads a CSV bank statement for batch reconciliation.
 * @param {File} file
 */
export const uploadCsvStatement = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/reconciliation/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Uploads a PDF bank statement for batch reconciliation.
 * @param {File} file
 */
export const uploadPdfStatement = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/reconciliation/pdf-upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Reconciles a single bank transaction through the AI matching engine.
 * @param {Object} tx - { transaction_date, amount, direction, narration, reference }
 */
export const reconcileSingleTransaction = async (tx) => {
  const response = await api.post("/ai/reconciliation", tx);
  return response.data;
};

/**
 * Confirms a reconciliation candidate match.
 * @param {Object} payload - { event_id, status, matched_payment_id, etc. }
 */
export const confirmReconciliation = async (payload) => {
  const response = await api.post("/ai/reconciliation/confirm", payload);
  return response.data;
};
