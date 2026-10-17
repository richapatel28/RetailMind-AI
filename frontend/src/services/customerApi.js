import api from "./api";

/**
 * Fetch all customers for the logged-in user
 */
export const getCustomers = async () => {
  const response = await api.get("/customers");
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.customers)) return data.customers;
  return [];
};

/**
 * Create a new customer
 * @param {Object} customerData - { name, contact, address }
 */
export const createCustomer = async (customerData) => {
  const response = await api.post("/customers", customerData);
  return response.data;
};
