import React, { useState, useEffect } from "react";
import { Package, Search, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getProducts } from "../services/productApi";
import { useLanguage } from "../context/LanguageContext";

export const Inventory = () => {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Action Controls */}
      <div className="flex justify-end">
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-2xs transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : "text-slate-400"}`} />
          <span>{t("common.refresh", "Refresh Stock")}</span>
        </button>
      </div>

      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder={t("inventory.searchPlaceholder", "Search products in stock...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-primary-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-y border-slate-100">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">{t("inventory.name", "Product Name")}</th>
                <th className="px-4 py-3">{t("inventory.currentStock", "Current Stock")}</th>
                <th className="px-4 py-3">{t("inventory.purchasePrice", "Purchase Price")}</th>
                <th className="px-4 py-3">{t("inventory.sellingPrice", "Selling Price")}</th>
                <th className="px-4 py-3">{t("inventory.status", "Stock Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((product) => {
                const stock = Number(product.current_stock || 0);
                const isLow = stock <= Number(product.reorder_level || 10);
                return (
                  <tr key={product.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-400">#{product.id}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{product.name}</td>
                    <td className="px-4 py-3 font-black text-slate-800">{stock} {product.unit || "units"}</td>
                    <td className="px-4 py-3 text-slate-600">₹{Number(product.purchase_price).toFixed(2)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">
                      ₹{Number(product.selling_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" />
                          {t("inventory.lowStock", "Low Stock")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          {t("inventory.inStock", "In Stock")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
