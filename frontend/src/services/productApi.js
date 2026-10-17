import api from "./api";

/**
 * Searches the user's inventory using AI semantic/lexical product matching.
 * @param {string} productName - The raw or misspelled product string
 */
export const matchProduct = async (productName) => {
  const response = await api.post("/ai/product-match", {
    product_name: productName,
  });
  return response.data;
};

/**
 * Fetches the user's product catalog.
 */
export const getProducts = async () => {
  const response = await api.get("/products");
  return response.data;
};
