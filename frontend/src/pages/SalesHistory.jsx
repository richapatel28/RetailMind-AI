import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  Search,
  Filter,
  Printer,
  X,
  Plus,
  RefreshCw,
  ShoppingBag,
  Mic,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ChevronRight,
  ArrowUpRight,
  User,
  Trash2,
  AlertCircle
} from "lucide-react";
import { getSales, getSale, createSale } from "../services/saleApi";
import { getProducts } from "../services/productApi";
import { getCustomers } from "../services/customerApi";
import StatusBadge from "../components/StatusBadge";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { localizeCustomerName } from "../utils/nameLocalization";

export const SalesHistory = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("ALL");

  // Selected Sale Details Modal (Bill Receipt)
  const [activeSale, setActiveSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Manual Sale Modal State
  const [showManualSaleModal, setShowManualSaleModal] = useState(false);
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [manualCustomerPhone, setManualCustomerPhone] = useState("");
  const [manualItems, setManualItems] = useState([
    { product_id: "", quantity: 1, selling_price: 0, max_stock: 0, name: "" }
  ]);
  const [manualPaymentMode, setManualPaymentMode] = useState("CASH");
  const [submittingManual, setSubmittingManual] = useState(false);

  // Load Sales, Products, and Customers
  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, productsData, customersData] = await Promise.all([
        getSales(),
        getProducts(),
        getCustomers()
      ]);
      setSales(Array.isArray(salesData) ? salesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (err) {
      console.error("Failed to load sales history:", err);
      addToast(t("common.error", "Failed to load sales records"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch full details of a single sale for bill printing
  const handleViewBill = async (sale) => {
    setActiveSale(sale);
    setLoadingDetails(true);
    try {
      const data = await getSale(sale.id);
      setSaleDetails(data);
    } catch (err) {
      console.error("Error fetching sale bill details:", err);
      addToast("Failed to fetch bill items", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Close Bill Modal
  const handleCloseBill = () => {
    setActiveSale(null);
    setSaleDetails(null);
  };

  // Filtered Sales
  const filteredSales = sales.filter((s) => {
    const billNoMatch = (s.bill_number || `#${s.id}`).toLowerCase().includes(searchQuery.toLowerCase());
    const customerMatch = (s.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = billNoMatch || customerMatch;

    const matchesChannel =
      selectedChannel === "ALL" ||
      (selectedChannel === "VOICE" && s.input_source === "VOICE") ||
      (selectedChannel === "MANUAL" && (!s.input_source || s.input_source === "MANUAL"));

    return matchesSearch && matchesChannel;
  });

  // Calculate quick metrics
  const isSameDay = (dateVal) => {
    if (!dateVal) return false;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const todaySalesList = sales.filter((s) => isSameDay(s.sale_date || s.created_at));
  const todayRevenue = todaySalesList.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const todaySalesCount = todaySalesList.length;

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const voiceSalesCount = sales.filter((s) => s.input_source === "VOICE").length;
  const manualSalesCount = sales.filter((s) => !s.input_source || s.input_source === "MANUAL").length;

  // Manual Sale Row Helpers
  const handleItemChange = (index, field, value) => {
    const updated = [...manualItems];
    if (field === "product_id") {
      const prod = products.find((p) => String(p.id) === String(value));
      updated[index] = {
        ...updated[index],
        product_id: value,
        name: prod?.name || "",
        selling_price: prod ? Number(prod.selling_price) : 0,
        max_stock: prod ? Number(prod.current_stock) : 0,
      };
    } else if (field === "quantity") {
      updated[index].quantity = Math.max(1, Number(value) || 1);
    } else if (field === "selling_price") {
      updated[index].selling_price = Math.max(0, Number(value) || 0);
    }
    setManualItems(updated);
  };

  const handleAddManualRow = () => {
    setManualItems([
      ...manualItems,
      { product_id: "", quantity: 1, selling_price: 0, max_stock: 0, name: "" }
    ]);
  };

  const handleRemoveManualRow = (index) => {
    if (manualItems.length <= 1) return;
    setManualItems(manualItems.filter((_, i) => i !== index));
  };

  const manualGrandTotal = manualItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.selling_price) || 0),
    0
  );

  const handleSubmitManualSale = async (e) => {
    e.preventDefault();
    const validItems = manualItems.filter((it) => it.product_id && it.quantity > 0);
    if (validItems.length === 0) {
      addToast("Please select at least one product with valid quantity.", "warning");
      return;
    }

    if (manualPaymentMode === "CREDIT" && !manualCustomerName.trim()) {
      addToast(t("bill.customerNameRequired", "Customer name is required for credit (Udhaar) sales."), "warning");
      return;
    }

    setSubmittingManual(true);
    try {
      const payload = {
        customer_name: manualCustomerName.trim() || null,
        customer_phone: manualCustomerPhone.trim() || null,
        items: validItems.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          selling_price: Number(it.selling_price)
        })),
        payment_mode: manualPaymentMode,
        payment_amount: manualGrandTotal,
        input_source: "MANUAL"
      };

      const result = await createSale(payload);
      addToast(t("voice.saleRecordedSuccess", "Sale recorded and bill generated!"), "success");
      setShowManualSaleModal(false);
      setManualItems([{ product_id: "", quantity: 1, selling_price: 0, max_stock: 0, name: "" }]);
      setManualCustomerName("");
      setManualCustomerPhone("");

      await loadData();

      // Open bill receipt for the newly created sale
      if (result?.sale) {
        handleViewBill(result.sale);
      }
    } catch (err) {
      console.error("Create manual sale error:", err);
      addToast(err.response?.data?.message || "Failed to record manual sale.", "error");
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Controls */}
      <div className="flex items-center justify-end gap-2.5">
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{t("common.refresh", "Refresh")}</span>
        </button>

        <button
          onClick={() => setShowManualSaleModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t("bill.newSale", "+ New Sale")}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Sales */}
        <div className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t("dashboard.todaySales", "Today's Sales")}
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              ₹{todayRevenue.toFixed(2)}
            </div>
            <span className="text-xs text-slate-500">{todaySalesCount} bills today</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total All-Time Sales */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t("dashboard.totalRevenue", "All-Time Sales")}
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              ₹{totalRevenue.toFixed(2)}
            </div>
            <span className="text-xs text-slate-500">{sales.length} total bills</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Voice Billing */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t("bill.voiceChannel", "Voice Billing")}
            </span>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              {voiceSalesCount}
            </div>
            <span className="text-xs text-slate-500">Voice entries</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Mic className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Counter Billing */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t("bill.manualChannel", "Counter Billing")}
            </span>
            <div className="text-2xl font-black text-slate-800 mt-1">
              {manualSalesCount}
            </div>
            <span className="text-xs text-slate-500">Counter entries</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("common.search", "Search by Bill No or Customer...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Channel Filter */}
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="ALL">{t("bill.filterAll", "All Channels")}</option>
            <option value="VOICE">{t("bill.voiceChannel", "Voice POS")}</option>
            <option value="MANUAL">{t("bill.manualChannel", "Manual POS")}</option>
          </select>
        </div>
      </div>

      {/* Sales History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-500" />
            <span>{t("common.loading", "Loading sales history...")}</span>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold">{t("bill.noSales", "No sales records found.")}</p>
            <p className="text-xs text-slate-400 mt-1">Try recording a sale via Voice POS or Manual POS.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">{t("bill.billNo", "Bill Number")}</th>
                  <th className="px-4 py-3.5">{t("bill.date", "Date & Time")}</th>
                  <th className="px-4 py-3.5">{t("bill.channel", "Source")}</th>
                  <th className="px-4 py-3.5">{t("bill.customer", "Customer")}</th>
                  <th className="px-4 py-3.5">{t("bill.amount", "Total Amount")}</th>
                  <th className="px-4 py-3.5">{t("bill.status", "Payment Status")}</th>
                  <th className="px-4 py-3.5 text-right">{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                      {sale.bill_number || `BILL-${sale.id}`}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(sale.sale_date || sale.created_at || Date.now()).toLocaleDateString()}{" "}
                      <span className="text-[10px] text-slate-400">
                        {new Date(sale.sale_date || sale.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.input_source === "VOICE"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {sale.input_source === "VOICE" ? (
                          <>
                            <Mic className="w-2.5 h-2.5" />
                            <span>Voice POS</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-2.5 h-2.5" />
                            <span>Manual POS</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {localizeCustomerName(sale.customer_name, language)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 text-sm">
                      ₹{Number(sale.total_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sale.payment_status} size="xs" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleViewBill(sale)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl transition-colors shadow-xs"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>{t("bill.viewReceipt", "View Bill")}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* OFFICIAL BILL RECEIPT MODAL WITH PRINT STYLING */}
      {activeSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Actions Header (Hidden in Print) */}
            <div className="print:hidden flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t("bill.receipt", "Official Bill Receipt")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t("bill.printBill", "Print Bill")}</span>
                </button>
                <button
                  onClick={handleCloseBill}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Receipt Body - STRICTLY ENGLISH FOR OFFICIAL TAX / BILL COMPLIANCE */}
            <div className="p-6 overflow-y-auto space-y-5 print:p-0 print:m-0" id="printable-receipt">
              {/* Receipt Store Branding */}
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {user?.store_name || "Garvita General Store"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official Retail Tax Invoice
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Owner: {user?.name || "Garvita"} • {user?.email || "support@retailmind.com"}
                </p>
              </div>

              {/* Bill & Customer Metadata */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Bill Number
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {activeSale.bill_number || `BILL-${activeSale.id}`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Date & Time
                  </span>
                  <span className="font-medium text-slate-800">
                    {new Date(activeSale.sale_date || activeSale.created_at || Date.now()).toLocaleDateString()}{" "}
                    {new Date(activeSale.sale_date || activeSale.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Customer
                  </span>
                  <span className="font-semibold text-slate-800">
                    {activeSale.customer_name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Payment Status
                  </span>
                  <span className="inline-block">
                    <StatusBadge status={activeSale.payment_status} size="xs" forceEnglish={true} />
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-2">Item</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Rate (₹)</th>
                      <th className="py-2 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingDetails ? (
                      <tr>
                        <td colSpan="4" className="py-4 text-center text-slate-400">
                          <RefreshCw className="w-4 h-4 animate-spin mx-auto inline mr-1 text-primary-500" />
                          <span>Loading bill items...</span>
                        </td>
                      </tr>
                    ) : saleDetails?.items && saleDetails.items.length > 0 ? (
                      saleDetails.items.map((it, idx) => (
                        <tr key={idx} className="text-slate-800">
                          <td className="py-2">
                            <span className="font-semibold block">{it.product_name || "Product"}</span>
                            {it.sku && <span className="text-[10px] text-slate-400">SKU: {it.sku}</span>}
                          </td>
                          <td className="py-2 text-center font-bold">{it.quantity}</td>
                          <td className="py-2 text-right text-slate-600">₹{Number(it.selling_price).toFixed(2)}</td>
                          <td className="py-2 text-right font-bold text-slate-900">
                            ₹{Number(it.total_amount).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="py-2 text-center text-slate-400">
                          Total Amount: ₹{Number(activeSale.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bill Totals Summary */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>₹{Number(activeSale.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-slate-900 border-t border-slate-200 pt-2">
                  <span>Net Payable</span>
                  <span className="text-emerald-700 text-base">₹{Number(activeSale.total_amount).toFixed(2)}</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="border-t border-slate-100 pt-3 text-center">
                <p className="text-[11px] text-slate-400 font-medium">
                  Thank you for your business! Please visit again.
                </p>
                <p className="text-[9px] text-slate-300 mt-0.5">
                  Generated by RetailMind AI • Easy Store Billing & Management
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK MANUAL SALE MODAL */}
      {showManualSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {t("bill.newSale", "Record Manual Counter Sale")}
                </h3>
              </div>
              <button
                onClick={() => setShowManualSaleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitManualSale} className="p-6 overflow-y-auto space-y-4">
              {products.length === 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>{t("bill.noProductsInStock", "No products found in inventory.")}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {t("bill.noProductsDesc", "To record a sale, first add products by uploading a supplier invoice or entering one manually.")}
                  </p>
                  <Link
                    to="/invoice"
                    onClick={() => setShowManualSaleModal(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("bill.addStockLink", "Add Stock via Supplier Invoice")}</span>
                  </Link>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                  {t("bill.itemsToSell", "Items to Sell")}
                </label>
                {manualItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex-1">
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(idx, "product_id", e.target.value)}
                        required
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">{t("bill.selectProduct", "-- Select Product --")}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.current_stock}, ₹{p.selling_price})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        required
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-center"
                      />
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Rate ₹"
                        value={item.selling_price}
                        onChange={(e) => handleItemChange(idx, "selling_price", e.target.value)}
                        required
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-right font-medium"
                      />
                    </div>

                    <div className="w-20 text-right font-bold text-xs text-slate-900">
                      ₹{((Number(item.quantity) || 0) * (Number(item.selling_price) || 0)).toFixed(2)}
                    </div>

                    {manualItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveManualRow(idx)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-700 py-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("bill.addItem", "+ Add Another Item")}</span>
                </button>
              </div>

              {/* Payment Mode */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">
                    {t("bill.payment", "Payment Mode")}
                  </label>
                  <select
                    value={manualPaymentMode}
                    onChange={(e) => setManualPaymentMode(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="CREDIT">Customer Credit (Udhaar)</option>
                  </select>
                </div>

                <div className="text-right flex flex-col justify-end">
                  <span className="text-xs text-slate-400 uppercase font-semibold">
                    {t("bill.netTotal", "Grand Total")}
                  </span>
                  <span className="text-xl font-black text-slate-900">
                    ₹{manualGrandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Customer Details for Udhaar / Credit */}
              {manualPaymentMode === "CREDIT" ? (
                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                      <User className="w-3.5 h-3.5 text-amber-600" />
                      <span>{t("voice.customerCreditDetails", "Customer Credit Details (Udhaar)")} *</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      {t("voice.creditLedgerNote", "Added to Credit Ledger")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        {t("voice.customerName", "Customer Name")} *
                      </label>
                      <input
                        type="text"
                        list="customer-manual-list"
                        value={manualCustomerName}
                        onChange={(e) => setManualCustomerName(e.target.value)}
                        placeholder={t("voice.customerPlaceholder", "e.g. Ramesh Patel")}
                        required
                        className="w-full text-xs bg-white border border-amber-200 rounded-lg p-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <datalist id="customer-manual-list">
                        {customers.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.contact ? `${c.name} (${c.contact})` : c.name}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                        {t("voice.customerPhone", "Mobile / WhatsApp (Optional)")}
                      </label>
                      <input
                        type="tel"
                        value={manualCustomerPhone}
                        onChange={(e) => setManualCustomerPhone(e.target.value)}
                        placeholder={t("voice.phonePlaceholder", "e.g. 9876543210")}
                        className="w-full text-xs bg-white border border-amber-200 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      list="customer-manual-list"
                      value={manualCustomerName}
                      onChange={(e) => setManualCustomerName(e.target.value)}
                      placeholder={t("voice.optionalCustomer", "Customer Name (Optional)")}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <datalist id="customer-manual-list">
                      {customers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.contact ? `${c.name} (${c.contact})` : c.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowManualSaleModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  {t("common.cancel", "Cancel")}
                </button>

                <button
                  type="submit"
                  disabled={submittingManual || manualGrandTotal <= 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {submittingManual ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>{t("bill.completeSale", "Record Sale & Generate Bill")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
