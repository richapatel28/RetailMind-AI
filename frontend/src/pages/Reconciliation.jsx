import React, { useState, useRef } from "react";
import {
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  X,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  History
} from "lucide-react";
import {
  uploadCsvStatement,
  uploadPdfStatement,
  getReconciliationHistory
} from "../services/reconciliationApi";
import { useToast } from "../components/Toast";
import { useLanguage } from "../context/LanguageContext";

export const Reconciliation = () => {
  const { addToast } = useToast();
  const { t } = useLanguage();

  // Selected file state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Analysis result state
  const [hasAnalyzedStatement, setHasAnalyzedStatement] = useState(false);
  const [analyzedData, setAnalyzedData] = useState(null);

  // Period filter for financial overview: "monthly" | "yearly"
  const [period, setPeriod] = useState("monthly");

  // Optional reconciliation history state (collapsed by default)
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState([]);

  const csvInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Handle file selection from either card
  const handleSelectFile = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset error & clear previous analysis to start clean
    setError(null);
    setSelectedFile({
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      type: type || (file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "csv"),
    });

    // Reset input value so same file can be re-selected if needed
    e.target.value = "";
  };

  // Clear selected file
  const handleClearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  // Reset entire page back to empty state
  const handleResetToEmpty = () => {
    setSelectedFile(null);
    setHasAnalyzedStatement(false);
    setAnalyzedData(null);
    setError(null);
    setUploading(false);
  };

  // Run statement analysis
  const handleAnalyzeStatement = async () => {
    if (!selectedFile?.file) {
      setError("Please select a bank statement file first.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let res;
      if (selectedFile.type === "pdf") {
        res = await uploadPdfStatement(selectedFile.file);
      } else {
        res = await uploadCsvStatement(selectedFile.file);
      }

      if (!res || !res.summary) {
        throw new Error("Invalid response from server.");
      }

      setAnalyzedData({
        filename: res.filename || selectedFile.name,
        summary: {
          transactions_analyzed: res.summary.transactions_analyzed !== undefined
            ? res.summary.transactions_analyzed
            : (res.summary.total || 0),
          sales_matched: res.summary.sales_matched || 0,
          purchases_matched: res.summary.purchases_matched || 0,
          needs_review: res.summary.needs_review !== undefined
            ? res.summary.needs_review
            : (res.summary.review_required || 0) + (res.summary.unmatched || 0),
        },
        financial_overview: res.financial_overview || {
          monthly: { total_sales: 0, total_purchases: 0, expenses: 0, estimated_profit: 0 },
          yearly: { total_sales: 0, total_purchases: 0, expenses: 0, estimated_profit: 0 },
        },
        unidentified_transactions: Array.isArray(res.unidentified_transactions)
          ? res.unidentified_transactions
          : [],
      });

      setHasAnalyzedStatement(true);
      addToast(t("recon.successTitle", "✓ Statement analyzed successfully!"), "success");
    } catch (err) {
      console.error("Statement analysis error:", err);
      setHasAnalyzedStatement(false);
      setAnalyzedData(null);
      setError(
        err.response?.data?.message ||
        "Couldn't analyze this statement. Please check that the file is a valid CSV or PDF bank statement."
      );
      addToast(t("common.error", "Failed to analyze statement."), "error");
    } finally {
      setUploading(false);
    }
  };

  // Optional: Load previous statements history
  const toggleHistory = async () => {
    if (!showHistory && historyRecords.length === 0) {
      setHistoryLoading(true);
      try {
        const hist = await getReconciliationHistory();
        setHistoryRecords(Array.isArray(hist) ? hist : []);
      } catch (err) {
        console.error("History load error:", err);
      } finally {
        setHistoryLoading(false);
      }
    }
    setShowHistory(!showHistory);
  };

  const currentFinancials =
    analyzedData?.financial_overview?.[period] ||
    analyzedData?.financial_overview?.monthly || {
      total_sales: 0,
      total_purchases: 0,
      expenses: 0,
      estimated_profit: 0,
    };

  const isProfitPositive = Number(currentFinancials.estimated_profit || 0) >= 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Action Controls */}
      {hasAnalyzedStatement && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResetToEmpty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
          >
            <Upload className="w-3 h-3 text-slate-500" />
            <span>{t("recon.uploadAnother", "Upload Another Statement")}</span>
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-snug">{error}</div>
        </div>
      )}

      {/* 1. UPLOAD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Hidden inputs */}
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => handleSelectFile(e, "csv")}
          className="hidden"
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => handleSelectFile(e, "pdf")}
          className="hidden"
        />

        {/* Card 1: CSV Bank Statement */}
        <div
          onClick={() => !uploading && csvInputRef.current?.click()}
          className="group relative bg-white hover:bg-slate-50/80 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                {t("recon.spreadsheet", "Spreadsheet")}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                {t("recon.csvTitle", "CSV Bank Statement")}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t("recon.csvDesc", "Upload bank transactions in CSV format exported from online banking.")}
              </p>
            </div>
          </div>

          <div className="pt-5">
            <button
              type="button"
              disabled={uploading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t("recon.uploadCsv", "Upload CSV")}</span>
            </button>
          </div>
        </div>

        {/* Card 2: PDF Bank Statement */}
        <div
          onClick={() => !uploading && pdfInputRef.current?.click()}
          className="group relative bg-white hover:bg-slate-50/80 border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                {t("recon.document", "Document")}
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-1.5">
                {t("recon.pdfTitle", "PDF Bank Statement")}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t("recon.pdfDesc", "Upload scanned or official bank statement PDF downloaded from your bank.")}
              </p>
            </div>
          </div>

          <div className="pt-5">
            <button
              type="button"
              disabled={uploading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-200"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{t("recon.uploadPdf", "Upload PDF")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. FILE SELECTED BANNER & [ ANALYZE STATEMENT ] ACTION */}
      {selectedFile && !hasAnalyzedStatement && (
        <div className="bg-white border-2 border-primary-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                {selectedFile.type === "pdf" ? (
                  <FileText className="w-5 h-5" />
                ) : (
                  <FileSpreadsheet className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("recon.selectedFile", "Selected File")}
                </div>
                <div className="text-sm font-bold text-slate-900 truncate max-w-sm sm:max-w-md">
                  {selectedFile.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {selectedFile.size} • {selectedFile.type.toUpperCase()} {t("recon.statement", "Statement")}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={handleClearFile}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                {t("recon.changeFile", "Change File")}
              </button>

              <button
                type="button"
                disabled={uploading}
                onClick={handleAnalyzeStatement}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl shadow-md shadow-primary-200 transition-all"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("recon.analyzingStatement", "Analyzing statement...")}</span>
                  </>
                ) : (
                  <>
                    <FileCheck2 className="w-4 h-4" />
                    <span>{t("recon.analyzeStatement", "Analyze Statement")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. UPLOADING / PROCESSING INDICATOR */}
      {uploading && (
        <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-sm animate-in fade-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 text-primary-600 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">
              {t("recon.analyzingStatement", "Analyzing statement...")}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {t("recon.analyzingDesc", "Extracting bank transactions and matching customer deposits and supplier payments against store records.")}
            </p>
          </div>
        </div>
      )}

      {/* 4. EMPTY STATE */}
      {!hasAnalyzedStatement && !selectedFile && !uploading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-900">
              {t("recon.noStatementTitle", "No statement analyzed yet")}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {t("recon.noStatementDesc", "Upload a CSV or PDF bank statement above and RetailMind will read your transactions, match deposits to sales, and calculate your store's estimated profit.")}
            </p>
          </div>
        </div>
      )}

      {/* 5. SUCCESS RESULTS SECTION */}
      {hasAnalyzedStatement && analyzedData && (
        <div className="space-y-6 animate-in fade-in">
          {/* Success Banner */}
          <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-black text-emerald-950">
                  {t("recon.successTitle", "✓ Statement analyzed successfully")}
                </div>
                <div className="text-xs text-emerald-700">
                  {t("recon.statement", "Statement:")} <span className="font-semibold">{analyzedData.filename}</span> • {analyzedData.summary.transactions_analyzed} {t("recon.extractedVerified", "transactions extracted and verified")}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetToEmpty}
              className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              {t("recon.uploadAnother", "Upload Another Statement")}
            </button>
          </div>

          {/* FINANCIAL OVERVIEW */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t("recon.finOverview", "Financial Overview")}
                </h3>
                <p className="text-xs text-slate-500">
                  {t("recon.finDesc", "Real store revenue, supplier purchases, and estimated store profit from verified records.")}
                </p>
              </div>

              {/* Period Filter Toggle */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setPeriod("monthly")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    period === "monthly"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t("recon.monthly", "Monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod("yearly")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    period === "yearly"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t("recon.yearly", "Yearly")}
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sales */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {t("recon.totalSales", "Total Sales")}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{Number(currentFinancials.total_sales || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  {t("recon.moneyIn", "Store revenue (Money In)")}
                </div>
              </div>

              {/* Total Purchases */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {t("recon.totalPurchases", "Total Purchases")}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{Number(currentFinancials.total_purchases || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
                  {t("recon.moneyOut", "Supplier bills (Money Out)")}
                </div>
              </div>

              {/* Expenses */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {t("recon.expenses", "Expenses")}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  ₹{Number(currentFinancials.expenses || 0).toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {currentFinancials.expenses > 0 ? t("recon.trackedExpenses", "Tracked expenses") : t("recon.noExpenses", "No tracked expenses")}
                </div>
              </div>

              {/* Estimated Profit */}
              <div
                className={`p-4 rounded-xl border space-y-1.5 ${
                  isProfitPositive
                    ? "bg-emerald-50/60 border-emerald-200"
                    : "bg-rose-50/60 border-rose-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      isProfitPositive ? "text-emerald-800" : "text-rose-800"
                    }`}
                  >
                    {t("recon.estimatedProfit", "Estimated Profit")}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isProfitPositive
                        ? "bg-emerald-200 text-emerald-800"
                        : "bg-rose-200 text-rose-800"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div
                  className={`text-2xl font-black ${
                    isProfitPositive ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  ₹{Number(currentFinancials.estimated_profit || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {t("recon.profitFormula", "Sales Revenue - Purchases - Expenses")}
                </div>
              </div>
            </div>
          </div>

          {/* RECONCILIATION SUMMARY */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t("recon.summaryTitle", "Statement Matching Summary")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("recon.summaryDesc", "Summary of entries analyzed strictly from")} <span className="font-semibold text-slate-800">{analyzedData.filename}</span>.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t("recon.txnsAnalyzed", "Transactions Analyzed")}
                </span>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {analyzedData.summary.transactions_analyzed}
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {t("recon.inUploaded", "In uploaded statement")}
                </div>
              </div>

              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("recon.salesMatched", "Sales Matched")}
                </span>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  {analyzedData.summary.sales_matched}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  {t("recon.customerVerified", "Customer payments verified")}
                </div>
              </div>

              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t("recon.purchasesMatched", "Purchases Matched")}
                </span>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {analyzedData.summary.purchases_matched}
                </div>
                <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                  {t("recon.supplierVerified", "Supplier bills verified")}
                </div>
              </div>

              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {t("recon.needsReview", "Needs Review")}
                </span>
                <div className="text-2xl font-black text-amber-700 mt-1">
                  {analyzedData.summary.needs_review}
                </div>
                <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                  {t("recon.unmatchedEntries", "Unmatched entries")}
                </div>
              </div>
            </div>
          </div>

          {/* TRANSACTIONS WE COULDN'T IDENTIFY */}
          {analyzedData.unidentified_transactions.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t("recon.unidentifiedTitle", "Transactions We Couldn't Identify")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("recon.unidentifiedDesc", "These entries could not be matched automatically. You do not have to review them immediately.")}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                  {analyzedData.unidentified_transactions.length} {t("recon.entries", "entries")}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">{t("recon.colDate", "Date")}</th>
                      <th className="px-5 py-3">{t("recon.colDesc", "Description")}</th>
                      <th className="px-5 py-3">{t("recon.colType", "Type")}</th>
                      <th className="px-5 py-3 text-right">{t("recon.colAmount", "Amount (₹)")}</th>
                      <th className="px-5 py-3 text-center">{t("recon.colStatus", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analyzedData.unidentified_transactions.map((txn, idx) => (
                      <tr key={txn.event_id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3 text-slate-700 font-medium whitespace-nowrap">
                          {txn.date ? new Date(txn.date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          <div>{txn.description}</div>
                          {txn.reference && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              Ref: {txn.reference}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              txn.direction === "Money In"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {txn.direction === "Money In" ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {txn.direction || "Bank Entry"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                          ₹{Number(txn.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> {t("recon.needsReview", "Needs Review")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                {t("recon.allMatchedTitle", "All transactions were successfully identified!")}
              </div>
              <p className="text-xs text-slate-400">
                {t("recon.allMatchedDesc", "Every entry in this statement matched against your store records.")}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 6. OPTIONAL COLLAPSED RECONCILIATION HISTORY */}
      <div className="border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={toggleHistory}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <History className="w-4 h-4" />
          <span>{t("recon.historyTitle", "Past Statement History")}</span>
          {showHistory ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showHistory && (
          <div className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t("recon.activityTitle", "Previous Statement Activity")} ({historyRecords.length})
            </h4>

            {historyLoading ? (
              <div className="py-4 text-center text-xs text-slate-400">
                {t("recon.loadingHistory", "Loading history...")}
              </div>
            ) : historyRecords.length === 0 ? (
              <p className="text-xs text-slate-400">{t("recon.noHistory", "No past statement history found.")}</p>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase">
                    <tr>
                      <th className="px-3 py-2">{t("recon.colDate", "Date")}</th>
                      <th className="px-3 py-2">{t("recon.colDesc", "Description")}</th>
                      <th className="px-3 py-2 text-right">{t("recon.colAmount", "Amount")}</th>
                      <th className="px-3 py-2 text-center">{t("recon.colStatus", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyRecords.slice(0, 15).map((h, i) => (
                      <tr key={h.event_id || i}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {h.transaction?.transaction_date || "—"}
                        </td>
                        <td className="px-3 py-2 truncate max-w-xs">
                          {h.transaction?.narration || h.transaction?.reference || "Transaction"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">
                          ₹{Number(h.transaction?.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {h.decision || (h.confirmed ? "CONFIRMED" : "REVIEWED")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reconciliation;
