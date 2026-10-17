import api from "./api";

export const getSales = async () => {
  const response = await api.get("/sales");
  const data = response.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.sales)) return data.sales;
  return [];
};

export const getSale = async (id) => {
  const response = await api.get(`/sales/${id}`);
  return response.data;
};

export const createSale = async (saleData) => {
  const response = await api.post("/sales", saleData);
  return response.data;
};
