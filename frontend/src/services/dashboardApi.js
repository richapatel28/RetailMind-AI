import api from "./api";

/**
 * Fetches dashboard statistics combining core analytics, reconciliation, and inventory data.
 */
export const getDashboardData = async () => {
  const results = await Promise.allSettled([
    api.get("/analytics/dashboard"),
    api.get("/reconciliation/summary"),
    api.get("/products"),
    api.get("/sales"),
  ]);

  const analytics = results[0].status === "fulfilled" ? results[0].value.data : {};
  const reconciliation = results[1].status === "fulfilled" ? results[1].value.data?.summary : {};
  const products = results[2].status === "fulfilled" && Array.isArray(results[2].value.data)
    ? results[2].value.data
    : [];
  const rawSales = results[3].status === "fulfilled" ? results[3].value.data : [];
  const sales = Array.isArray(rawSales)
    ? rawSales
    : Array.isArray(rawSales.sales)
    ? rawSales.sales
    : [];

  return {
    analytics,
    reconciliation,
    productsCount: Array.isArray(products) ? products.length : 0,
    products: Array.isArray(products) ? products : [],
    recentSales: sales.slice(0, 5),
    totalSalesCount: sales.length,
  };
};
