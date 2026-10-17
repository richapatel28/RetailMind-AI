import React, { useState } from "react";
import {
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  Tag
} from "lucide-react";
import { matchProduct } from "../services/productApi";
import StatusBadge from "../components/StatusBadge";
import ConfidenceMeter from "../components/ConfidenceMeter";
import { useToast } from "../components/Toast";
import { useLanguage } from "../context/LanguageContext";

export const ProductMatching = () => {
  const { addToast } = useToast();
  const { t } = useLanguage();

  const [query, setQuery] = useState("Maggi noodles 70g");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleMatch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const data = await matchProduct(query.trim());
      setResult(data);
      addToast(t("common.success", "Catalog search completed."), "success");
    } catch (err) {
      console.error("Product match error:", err);
      setError(err.response?.data?.message || "Failed to execute product match.");
      addToast(t("common.error", "Matching failed."), "error");
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "Maggi noodles",
    "maggie 70g",
    "Dettol Soap 100g",
    "Tata Salt 1kg",
    "Parle-G biscuit",
    "surf excel matic",
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">


      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-sm text-rose-800 flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-snug">{error}</div>
        </div>
      )}

      {/* SEARCH INPUT CARD */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleMatch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("pm.placeholder", "Enter product name (e.g. maggie 70g, tata salt, dettol)...")}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="py-2.5 px-5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t("pm.searching", "Searching Catalog...")}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("pm.findMatch", "Find Match")}</span>
              </>
            )}
          </button>
        </form>

        {/* Sample query pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-[11px] font-semibold text-slate-400">{t("pm.tryExample", "Try quick example:")}</span>
          {sampleQueries.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuery(sample);
              }}
              className="text-[11px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* MATCH RESULTS SECTION */}
      {result && (
        <div className="space-y-4 animate-in fade-in">
          {/* Top Match Hero Card */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary-600" />
                <h3 className="font-bold text-slate-900 text-base">{t("pm.topMatched", "Top Matched Product")}</h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={result.status} />
                <ConfidenceMeter value={result.confidence} />
              </div>
            </div>

            {result.matched_product ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-primary-50/40 p-4 rounded-xl border border-primary-100">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("pm.productName", "Product Name")}</span>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {result.matched_product.name}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("pm.skuCode", "Product SKU / Code")}</span>
                  <div className="text-sm font-bold text-slate-700 mt-0.5">
                    {result.matched_product.sku || `PROD-${result.matched_product.id}`}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">{t("pm.retailPrice", "Current Retail Price")}</span>
                  <div className="text-base font-black text-emerald-700 mt-0.5">
                    ₹{Number(result.matched_product.selling_price || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-sm text-amber-800">
                {t("pm.noDirectMatch", "No direct single product exceeded the confidence threshold. See candidate rankings below.")}
              </div>
            )}
          </div>

          {/* Alternative Candidates Table */}
          {result.candidates && result.candidates.length > 0 && (
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <h4 className="font-bold text-slate-900 text-sm">
                  {t("pm.candidateRankings", "Catalog Candidate Rankings")} ({result.candidates.length})
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5">{t("pm.candidateProduct", "Candidate Product")}</th>
                      <th className="px-4 py-2.5">{t("pm.catalogPrice", "Catalog Price")}</th>
                      <th className="px-4 py-2.5">{t("pm.matchConfidence", "Match Confidence")}</th>
                      <th className="px-4 py-2.5">{t("pm.status", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.candidates.map((cand, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {cand.name || cand.product_name}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          ₹{Number(cand.selling_price || cand.price || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <ConfidenceMeter value={cand.confidence !== undefined ? cand.confidence : (cand.similarity || cand.score || 0)} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              idx === 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {idx === 0 ? t("pm.rank1", "Rank #1 Match") : `${t("pm.rank", "Rank #")}${idx + 1}`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductMatching;
