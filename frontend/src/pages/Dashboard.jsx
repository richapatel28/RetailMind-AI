import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  Mic,
  FileText,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  MapPin,
  Calendar,
  Bot,
  ChevronRight,
  Receipt,
  ShoppingBag,
  ArrowRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { getDashboardData } from "../services/dashboardApi";
import StatusBadge from "../components/StatusBadge";
import { localizeCustomerName } from "../utils/nameLocalization";

export const Dashboard = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardData();
      setData(res);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load store data. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real backend metrics
  const todaySales = Number(data?.analytics?.today_sales || 0);
  const todayProfit = Number(data?.analytics?.today_profit || 0);
  const todayTransactions = Number(data?.analytics?.total_transactions || 0);
  const lowStockCount = Number(data?.analytics?.low_stock_products || 0);
  const productsCount = Number(data?.productsCount || 0);
  const recentSales = data?.recentSales || [];
  
  // Real products list for low stock items
  const products = data?.products || [];
  const lowStockItems = products
    .filter((p) => Number(p.current_stock) <= Number(p.reorder_level || 5))
    .slice(0, 4);

  // Reconciliation pending count
  const paymentsToCheck =
    data?.reconciliation?.review_required ??
    data?.reconciliation?.unmatched ??
    (todayTransactions > 0 ? 0 : 0);

  const storeDisplayName =
    user?.store_name?.trim() ||
    (user?.name ? `${user.name}'s Store` : "RetailMind Store");

  return (
    <div className="space-y-6">
      {/* 1. HEADER & STORE SUMMARY */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {storeDisplayName}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t("dashboard.perfSubtitle", "Your store at a glance — sales, profit, and inventory.")}
          </p>

          {/* Compact Store Location & Date */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600">
            {user?.location && (
              <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md">
                <MapPin className="w-3 h-3 text-slate-400" />
                {user.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-slate-400 px-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            title="Refresh store metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary-600" : ""}`} />
            <span>{t("common.refresh", "Refresh")}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchData} className="underline font-semibold hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* 2. KEY BUSINESS METRICS — 4 Compact Semantic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Sales Today */}
        <div className="p-4 bg-white rounded-2xl border border-indigo-100/80 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("dashboard.todaySales", "Today's Sales")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ₹{todaySales.toLocaleString()}
            </div>
          </div>
        </div>

        {/* KPI 2: Gross Profit */}
        <div className="p-4 bg-white rounded-2xl border border-emerald-100/80 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("dashboard.grossProfit", "Gross Profit")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ₹{todayProfit.toLocaleString()}
            </div>
          </div>
        </div>

        {/* KPI 3: Products in Stock */}
        <div className="p-4 bg-white rounded-2xl border border-teal-100/80 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("dashboard.totalProducts", "Total Products")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {productsCount}{" "}
              <span className="text-xs font-normal text-slate-400">items</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Bank Reconciliation */}
        <div className="p-4 bg-white rounded-2xl border border-amber-100/80 shadow-card hover:shadow-card-hover transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {t("dashboard.reconciliation", "Bank & UPI Match")}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {paymentsToCheck > 0 ? paymentsToCheck : "0"}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT: 2-COLUMN BALANCED LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT / LARGER COLUMN (8 cols): Recent Sales Activity */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          {/* Table Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {t("dashboard.recentTransactions", "Recent Sales & Purchases")}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Latest sales recorded in your store
              </p>
            </div>
            <Link
              to="/sales"
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
            >
              <span>{t("nav.sales", "View all bills")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Table Content */}
          {recentSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-4">{t("bill.billNo", "Bill No")}</th>
                    <th className="py-2.5 px-4">{t("bill.date", "Date")}</th>
                    <th className="py-2.5 px-4">{t("bill.customer", "Customer / Party")}</th>
                    <th className="py-2.5 px-4">{t("bill.payment", "Payment")}</th>
                    <th className="py-2.5 px-4 text-right">{t("bill.amount", "Amount")}</th>
                    <th className="py-2.5 px-4 text-center">{t("bill.status", "Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map((sale) => {
                    const billNo =
                      sale.bill_number ||
                      `BILL-${String(sale.id).padStart(4, "0")}`;
                    const formattedDate = sale.sale_date
                      ? new Date(sale.sale_date).toLocaleDateString()
                      : "Today";
                    const customerName = localizeCustomerName(
                      sale.customer_name || sale.customer?.name,
                      language
                    );
                    const totalAmt = Number(sale.total_amount || 0);
                    const paymentMode = sale.payment_mode || "CASH";

                    return (
                      <tr
                        key={sale.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-slate-800">
                          {billNo}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 truncate max-w-[140px]">
                          {customerName}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            {paymentMode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          ₹{totalAmt.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={sale.payment_status || "PAID"} size="xs" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Empty State */
            <div className="py-12 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                No sales recorded yet today
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Record your first customer sale using spoken voice or standard billing.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Link
                  to="/voice-sale"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Voice Sale</span>
                </Link>
                <Link
                  to="/sales"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  <span>Manual Billing</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT / ACTIONABLE COLUMN (4 cols): Store Copilot + Inventory Alerts */}
        <div className="lg:col-span-4 space-y-5">
          {/* A. SINGLE DEDICATED STORE COPILOT SECTION (Subtle Lavender Tint) */}
          <div className="p-5 bg-gradient-to-br from-violet-50/70 via-white to-indigo-50/40 rounded-2xl border border-violet-100 shadow-card relative overflow-hidden">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {t("copilot.title", "Store Copilot")}
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-violet-700 bg-violet-100/80 px-2 py-0.5 rounded-full">
                Assistant
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Ask questions about sales, inventory, suppliers, or customer credit (Udhaar).
            </p>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1.5 mb-3.5">
              {[
                "How were my sales today?",
                "Which products are running low?",
                "Show recent supplier purchases",
              ].map((query) => (
                <Link
                  key={query}
                  to={`/copilot?q=${encodeURIComponent(query)}`}
                  className="block px-2.5 py-1.5 rounded-lg bg-white/90 border border-violet-100/80 text-[11px] font-medium text-slate-700 hover:bg-violet-50/80 hover:text-violet-900 transition-colors truncate"
                >
                  "{query}"
                </Link>
              ))}
            </div>

            <Link
              to="/copilot"
              className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>{t("copilot.send", "Ask Copilot")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* B. INVENTORY ALERTS / LOW STOCK */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  {t("dashboard.lowStockAlerts", "Inventory Alerts")}
                </h3>
              </div>
              {lowStockCount > 0 && (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                  {lowStockCount} Low
                </span>
              )}
            </div>

            {lowStockItems.length > 0 ? (
              <div className="space-y-2.5">
                {lowStockItems.map((prod) => {
                  const stock = Number(prod.current_stock || 0);
                  const isCritical = stock <= 2;
                  return (
                    <div
                      key={prod.id}
                      className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-semibold text-slate-900 truncate">
                          {prod.name}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Reorder level: {prod.reorder_level || 5} {prod.unit || "pcs"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block font-bold text-xs px-2 py-0.5 rounded-md ${
                            isCritical
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {stock} {prod.unit || "left"}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-1">
                  <Link
                    to="/invoice"
                    className="block text-center text-xs font-semibold text-primary-600 hover:text-primary-700 py-1.5 hover:underline"
                  >
                    + Upload invoice to restock stock
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-500">
                  All active items are healthy and above reorder thresholds.
                </p>
                <Link
                  to="/inventory"
                  className="mt-2 inline-block text-xs font-semibold text-primary-600 hover:underline"
                >
                  Manage inventory →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
