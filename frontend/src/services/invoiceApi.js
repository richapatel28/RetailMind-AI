import api from "./api";

/**
 * Uploads an invoice document (image/pdf) for Gemini Vision extraction and line item candidate matching.
 * @param {File|Blob} file - The invoice image or PDF file
 */
export const processInvoice = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/ai/invoice/process", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Confirms an invoice purchase and increments inventory.
 * @param {Object} payload - { event_id, supplier_id, invoice_no, items: [{ product_id, quantity, unit_cost }] }
 */
export const confirmInvoicePurchase = async (payload) => {
  const response = await api.post("/ai/invoice/confirm", payload);
  return response.data;
};

/**
 * Creates a purchase manually entered by the user.
 * @param {Object} payload - { supplierName, supplierId, invoiceNo, purchaseDate, items }
 */
export const createManualPurchase = async (payload) => {
  const response = await api.post("/purchases", payload);
  return response.data;
};

/**
 * Fetches recent purchases.
 */
export const getPurchases = async () => {
  const response = await api.get("/purchases");
  return response.data;
};

/**
 * Fetches suppliers list.
 */
export const getSuppliers = async () => {
  const response = await api.get("/suppliers");
  return response.data;
};
