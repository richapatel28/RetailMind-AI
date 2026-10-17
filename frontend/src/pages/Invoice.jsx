import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building,
  Calendar,
  Hash,
  Calculator,
  Plus,
  Trash2,
  Camera,
  PenTool,
  ArrowLeft,
  Store,
  PackageCheck,
  Receipt,
  Sparkles
} from "lucide-react";
import {
  processInvoice,
  confirmInvoicePurchase,
  createManualPurchase,
  getPurchases,
  getSuppliers
} from "../services/invoiceApi";
import { getProducts } from "../services/productApi";
import { useToast } from "../components/Toast";
import { useLanguage } from "../context/LanguageContext";

export const Invoice = () => {
  const { addToast } = useToast();
  const { t } = useLanguage();

  // Mode: "CHOICE" | "MANUAL" | "UPLOAD"
  const [activeMode, setActiveMode] = useState("CHOICE");

  // Catalog products and suppliers
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);

  // Upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [attentionReason, setAttentionReason] = useState("");

  // Form fields (used for both manual and upload-exception review)
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState([]);

  // Loading & confirmation
  const [saving, setSaving] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Load products, suppliers, and recent purchases
  const loadData = async () => {
    try {
      const [prodData, supData, purchData] = await Promise.all([
        getProducts().catch(() => []),
        getSuppliers().catch(() => []),
        getPurchases().catch(() => ({ purchases: [] })),
      ]);
      setProducts(Array.isArray(prodData) ? prodData : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
      setRecentPurchases(purchData.purchases || []);
    } catch (err) {
      console.error("Error loading invoice dependencies:", err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Reset to initial mode selection
  const handleReset = () => {
    setActiveMode("CHOICE");
    setSelectedFile(null);
    setProcessing(false);
    setUploadResult(null);
    setNeedsAttention(false);
    setAttentionReason("");
    setSupplierName("");
    setInvoiceNo("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setItems([]);
    setSaving(false);
    setSuccessReceipt(null);
    setError(null);
    loadData();
  };

  // Start manual entry mode
  const handleStartManual = () => {
    setActiveMode("MANUAL");
    setError(null);
    setSuccessReceipt(null);
    setSupplierName("");
    setInvoiceNo(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    // Pre-populate with 1 editable item
    setItems([
      {
        id: Date.now(),
        product_id: products[0]?.id ? String(products[0].id) : "__NEW__",
        name: products[0]?.name || "",
        description: products[0]?.name || "",
        is_new_product: !products[0],
        quantity: 1,
        unit_cost: products[0]?.purchase_price ? Number(products[0].purchase_price) : 0,
        total_cost: products[0]?.purchase_price ? Number(products[0].purchase_price) : 0,
      },
    ]);
  };

  // Line item manipulation
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      if (field === "name" || field === "description") {
        const val = String(value || "");
        updated[index].name = val;
        updated[index].description = val;
        const matchingProd = products.find(
          (p) => p.name.trim().toLowerCase() === val.trim().toLowerCase()
        );
        if (matchingProd) {
          updated[index].product_id = String(matchingProd.id);
          updated[index].is_new_product = false;
          if ((!updated[index].unit_cost || Number(updated[index].unit_cost) === 0) && matchingProd.purchase_price) {
            updated[index].unit_cost = Number(matchingProd.purchase_price);
            updated[index].total_cost = Number(
              (updated[index].quantity * Number(matchingProd.purchase_price)).toFixed(2)
            );
          }
        } else {
          updated[index].product_id = "__NEW__";
          updated[index].is_new_product = true;
        }
      }

      if (field === "product_id") {
        if (value === "__NEW__" || !value) {
          updated[index].product_id = "__NEW__";
          updated[index].is_new_product = true;
        } else {
          updated[index].is_new_product = false;
          const prod = products.find((p) => String(p.id) === String(value));
          if (prod) {
            updated[index].name = prod.name;
            updated[index].description = prod.name;
            if (prod.purchase_price) {
              updated[index].unit_cost = Number(prod.purchase_price);
              updated[index].total_cost = Number(
                (updated[index].quantity * Number(prod.purchase_price)).toFixed(2)
              );
            }
          }
        }
      }

      if (field === "quantity" || field === "unit_cost") {
        const qty = field === "quantity" ? Math.max(1, Number(value) || 1) : updated[index].quantity;
        const cost = field === "unit_cost" ? Math.max(0, Number(value) || 0) : updated[index].unit_cost;
        updated[index].quantity = qty;
        updated[index].unit_cost = cost;
        updated[index].total_cost = Number((qty * cost).toFixed(2));
      }

      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        product_id: "__NEW__",
        name: "",
        description: "",
        is_new_product: true,
        quantity: 1,
        unit_cost: 0,
        total_cost: 0,
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      addToast(t("common.error", "At least one line item is required."), "error");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Math Validation Helper
  const calculateMathStatus = (itemList, expectedTotal) => {
    const computedTotal = itemList.reduce((sum, it) => sum + (Number(it.total_cost) || 0), 0);
    const lineTotalsValid = itemList.every((it) => {
      const calc = Number((Number(it.quantity) * Number(it.unit_cost)).toFixed(2));
      return Math.abs(calc - Number(it.total_cost)) < 0.1;
    });

    const isMatch = expectedTotal
      ? Math.abs(computedTotal - Number(expectedTotal)) < 1.0
      : true;

    return {
      computedTotal,
      isValid: lineTotalsValid && isMatch,
    };
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      handleProcessUpload(file);
    }
  };

  // Process uploaded invoice
  const handleProcessUpload = async (file) => {
    setActiveMode("UPLOAD");
    setProcessing(true);
    setError(null);
    setSuccessReceipt(null);
    setNeedsAttention(false);

    try {
      const data = await processInvoice(file);

      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        setActiveMode("MANUAL");
        setSupplierName(data.supplier || "");
        setInvoiceNo(data.invoice_number || `INV-${Math.floor(1000 + Math.random() * 9000)}`);
        setInvoiceDate(data.invoice_date || new Date().toISOString().split("T")[0]);
        setItems([
          {
            id: Date.now(),
            product_id: "__NEW__",
            name: "",
            description: "",
            is_new_product: true,
            quantity: 1,
            unit_cost: 0,
            total_cost: 0,
          },
        ]);
        addToast(
          t(
            "invoice.uploadFallbackNotice",
            "Could not auto-read this invoice. Please enter the product name and price manually below."
          ),
          "warning"
        );
        setProcessing(false);
        return;
      }

      const extractedSupplier = data.supplier || "Supplier";
      const extractedInvNo = data.invoice_number || `INV-${Math.floor(1000 + Math.random() * 9000)}`;
      const extractedDate = data.invoice_date || new Date().toISOString().split("T")[0];

      setSupplierName(extractedSupplier);
      setInvoiceNo(extractedInvNo);
      setInvoiceDate(extractedDate);
      setUploadResult(data);

      // Map line items to UI rows
      const mappedRows = data.items.map((item, idx) => {
        const matchedProductId = item.product_match?.matched_product?.id
          ? String(item.product_match.matched_product.id)
          : "";

        const qty = Number(item.quantity) || 1;
        const unitCost = Number(item.unit_price) || 0;
        const lineTotal = Number(item.total) || Number((qty * unitCost).toFixed(2));
        const rawDescription = (
          item.product_text ||
          item.product_name ||
          item.product ||
          item.description ||
          `Item ${idx + 1}`
        ).trim();
        const rawSku = (item.sku || "").trim() || null;

        // Auto-assign __NEW__ if not matched to existing catalog product
        const isNew = !matchedProductId;

        return {
          id: idx,
          name: rawDescription,
          description: rawDescription,
          sku: rawSku,
          product_id: matchedProductId || "__NEW__",
          is_new_product: isNew,
          quantity: qty,
          unit_cost: unitCost,
          total_cost: lineTotal,
          isMatched: Boolean(matchedProductId),
        };
      });

      setItems(mappedRows);

      // Check criteria for AUTOMATIC SAVE
      const unmappedCount = mappedRows.filter(
        (it) => !it.product_id || (it.product_id === "__NEW__" && !it.description?.trim())
      ).length;
      
      // Math validation
      const math = calculateMathStatus(mappedRows, data.grand_total || data.total || data.subtotal);
      const isMathValid = data.validation?.is_valid !== false && math.isValid;

      if (unmappedCount === 0 && isMathValid) {
        // High confidence! Automatically save purchase immediately!
        try {
          const autoSavePayload = {
            event_id: data.event_id,
            invoice_no: extractedInvNo,
            supplier_id: null,
            supplier_name: extractedSupplier,
            purchase_date: extractedDate,
            items: mappedRows.map((it) => ({
              product_id: it.product_id === "__NEW__" ? null : Number(it.product_id),
              is_new_product: it.product_id === "__NEW__",
              product_name: it.description,
              sku: it.sku || null,
              quantity: Number(it.quantity),
              unit_cost: Number(it.unit_cost),
            })),
          };

          const confirmed = await confirmInvoicePurchase(autoSavePayload);

          setSuccessReceipt({
            purchase_id: confirmed.purchase_id,
            invoice_no: confirmed.invoice_no || extractedInvNo,
            supplier_name: extractedSupplier,
            total_amount: confirmed.total_amount,
            items_count: confirmed.items_count || mappedRows.length,
            items: confirmed.items || mappedRows,
            new_products_created: confirmed.new_products_created || [],
            autoSaved: true,
          });

          addToast(t("invoice.autoSavedTitle", "Invoice processed and saved successfully! Store stock updated."), "success");
          loadData();
        } catch (saveErr) {
          console.error("Auto-save failed, falling back to review:", saveErr);
          setNeedsAttention(true);
          setAttentionReason("Please review and confirm this purchase.");
        }
      } else {
        // Needs attention
        setNeedsAttention(true);
        if (unmappedCount > 0) {
          setAttentionReason(
            `${unmappedCount} item${unmappedCount > 1 ? "s need" : " needs"} your attention.`
          );
        } else if (!isMathValid) {
          setAttentionReason("Invoice calculation totals need attention. Please verify the amounts.");
        } else {
          setAttentionReason("Please review the line items before saving.");
        }
      }
    } catch (err) {
      console.error("Invoice process error:", err);
      setError(err.response?.data?.message || "Unable to read invoice file. Please try a clearer picture or enter the bill manually.");
      addToast(t("common.error", "Failed to process invoice."), "error");
    } finally {
      setProcessing(false);
    }
  };

  // Save Purchase button (for Manual Entry OR when resolving uploaded invoice)
  const handleSavePurchase = async () => {
    // Validation
    if (items.length === 0) {
      setError("Please add at least one line item.");
      return;
    }

    const unmappedIdx = items.findIndex(
      (it) => !it.product_id || (it.product_id === "__NEW__" && !it.description?.trim())
    );
    if (unmappedIdx !== -1) {
      setError(`Item #${unmappedIdx + 1} requires a valid product name or catalog product.`);
      return;
    }

    const invalidQtyOrPrice = items.find((it) => Number(it.quantity) <= 0 || Number(it.unit_cost) < 0);
    if (invalidQtyOrPrice) {
      setError("Each item must have a valid quantity (> 0) and non-negative unit cost.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (activeMode === "UPLOAD" && uploadResult?.event_id) {
        // Confirming uploaded invoice
        const payload = {
          event_id: uploadResult.event_id,
          invoice_no: invoiceNo || "INV-MANUAL",
          supplier_name: supplierName || "Supplier",
          purchase_date: invoiceDate,
          items: items.map((it) => ({
            product_id: it.product_id === "__NEW__" ? null : Number(it.product_id),
            is_new_product: it.product_id === "__NEW__",
            product_name: it.description,
            sku: it.sku || null,
            quantity: Number(it.quantity),
            unit_cost: Number(it.unit_cost),
          })),
        };

        const confirmed = await confirmInvoicePurchase(payload);

        setSuccessReceipt({
          purchase_id: confirmed.purchase_id,
          invoice_no: confirmed.invoice_no || invoiceNo,
          supplier_name: supplierName || "Supplier",
          total_amount: confirmed.total_amount,
          items_count: confirmed.items_count || items.length,
          items: confirmed.items || items,
          new_products_created: confirmed.new_products_created || [],
          autoSaved: false,
        });

        addToast(t("invoice.manualSavedTitle", "Purchase saved and store inventory updated!"), "success");
      } else {
        // Manual purchase
        const mappedItems = items.map((it) => {
          const isNew = !it.product_id || it.product_id === "__NEW__";
          const pName = (it.name || it.description || "").trim();
          return {
            productId: isNew ? null : Number(it.product_id),
            isNewProduct: isNew,
            productName: pName,
            sku: it.sku || null,
            quantity: Math.max(1, Number(it.quantity) || 1),
            unitCost: Math.max(0, Number(it.unit_cost) || 0),
          };
        });

        const missingName = mappedItems.find((it) => !it.productId && !it.productName);
        if (missingName) {
          setError(t("invoice.nameRequired", "Please enter a product name for each item."));
          setSaving(false);
          return;
        }

        const payload = {
          supplierName: supplierName.trim() || "Supplier",
          invoiceNo: invoiceNo.trim() || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
          purchaseDate: invoiceDate,
          items: mappedItems,
        };

        const res = await createManualPurchase(payload);

        setSuccessReceipt({
          purchase_id: res.purchase?.id,
          invoice_no: res.purchase?.invoice_no || invoiceNo,
          supplier_name: supplierName || "Supplier",
          total_amount: res.purchase?.total_amount || grandTotal,
          items_count: res.purchase?.items_count || items.length,
          items: items,
          new_products_created: res.new_products_created || [],
          autoSaved: false,
        });

        addToast(t("invoice.manualSavedTitle", "Purchase saved and store inventory updated!"), "success");
      }

      loadData();
    } catch (err) {
      console.error("Save purchase error:", err);
      setError(err.response?.data?.message || "Failed to save purchase. Please try again.");
      addToast(t("common.error", "Failed to save purchase."), "error");
    } finally {
      setSaving(false);
    }
  };

  const grandTotal = items.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
  const mathStatus = calculateMathStatus(items, uploadResult?.total_amount);

  // Workflow steps
  const getCurrentStepIndex = () => {
    if (successReceipt) return 3;
    if (items.length > 0 && !processing) return 2;
    if (processing) return 1;
    return 0;
  };
  const currentStep = getCurrentStepIndex();
  const invoiceSteps = [
    { label: t("invoice.stepUpload", "Upload") },
    { label: t("invoice.stepProcessing", "Processing") },
    { label: t("invoice.stepReview", "Review Items") },
    { label: t("invoice.stepConfirm", "Confirm Purchase") },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Stepper & Action Controls */}
      <div className="flex items-center justify-end gap-2">
        <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            {invoiceSteps.map((step, idx) => {
              const isActive = currentStep === idx;
              const isCompleted = currentStep > idx;
              return (
                <React.Fragment key={idx}>
                  <span
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : isCompleted
                        ? "text-slate-600"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < invoiceSteps.length - 1 && (
                    <span className="text-slate-300 text-[10px]">→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {activeMode !== "CHOICE" && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t("invoice.allOptions", "Back")}</span>
            </button>
          )}
        </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* SUCCESS RECEIPT / SUMMARY */}
      {successReceipt && (
        <div className="p-6 bg-emerald-50/90 border border-emerald-200 rounded-2xl shadow-sm space-y-5 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 flex-shrink-0">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-emerald-950">
                  {successReceipt.autoSaved
                    ? t("invoice.autoSavedTitle", "Invoice Processed & Saved Successfully!")
                    : t("invoice.manualSavedTitle", "Purchase Saved & Stock Updated!")}
                </h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                  {t("invoice.inventoryUpdated", "Inventory Updated")}
                </span>
              </div>
              <p className="text-xs text-emerald-700 mt-0.5">
                {t("invoice.receiptDesc", "All purchased items have been added to your current store stock and purchase costs recorded.")}
              </p>
            </div>
          </div>

          {/* Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white p-4 rounded-xl border border-emerald-200/80 shadow-sm">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("invoice.supplier", "Supplier")}</div>
              <div className="text-sm font-black text-slate-900 truncate">{successReceipt.supplier_name || "Supplier"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("invoice.invoiceNo", "Invoice No")}</div>
              <div className="text-sm font-black text-slate-800 truncate">{successReceipt.invoice_no || "N/A"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("invoice.itemCount", "Item Count")}</div>
              <div className="text-sm font-black text-indigo-700">{successReceipt.items_count} items</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("dashboard.amount", "Total Amount")}</div>
              <div className="text-base font-black text-emerald-700">₹{Number(successReceipt.total_amount).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("invoice.stockUpdated", "Stock Updated")}</div>
              <div className="text-sm font-black text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {t("invoice.yes", "Yes")}
              </div>
            </div>
          </div>

          {/* New Products Created Highlight */}
          {successReceipt.new_products_created && successReceipt.new_products_created.length > 0 && (
            <div className="p-4 bg-white/90 border border-emerald-300 rounded-xl shadow-xs space-y-2">
              <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{t("invoice.newProductsAdded", "✨ New Product(s) Added to Store Catalog:")}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {successReceipt.new_products_created.map((np) => (
                  <span
                    key={np.id || np.sku}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-bold shadow-2xs"
                  >
                    <span>{np.name}</span>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      ({t("invoice.initialStock", "Initial Stock")}: +{np.initial_stock || 1}, {t("invoice.cost", "Purchase Cost")}: ₹{Number(np.purchase_price).toFixed(2)})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleStartManual}
              className="px-4 py-2 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              {t("invoice.enterAnother", "Enter Another Bill")}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-emerald-200"
            >
              {t("invoice.uploadAnother", "Upload Another Invoice")}
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: CHOICE SCREEN (TWO CARDS) */}
      {activeMode === "CHOICE" && !successReceipt && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card A: Enter Invoice Manually */}
          <div
            onClick={handleStartManual}
            className="group relative bg-white hover:bg-slate-50/80 border-2 border-slate-200 hover:border-primary-500 rounded-2xl p-7 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <PenTool className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {t("invoice.optionA", "Option A")}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2">
                  {t("invoice.enterManually", "Enter Invoice Manually")}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {t("invoice.enterManuallyDesc", "Add a supplier bill yourself. Type supplier details, select products, enter quantities, and save.")}
                </p>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="button"
                className="w-full py-2.5 px-4 bg-slate-900 group-hover:bg-primary-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{t("invoice.enterBillBtn", "Enter Bill Manually")}</span>
              </button>
            </div>
          </div>

          {/* Card B: Upload Invoice */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative bg-white hover:bg-slate-50/80 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl p-7 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  {t("invoice.optionB", "Option B")}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2">
                  {t("invoice.uploadBill", "Upload Invoice")}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {t("invoice.uploadBillDesc", "Take a photo or upload a supplier bill and RetailMind will read it for you automatically.")}
                </p>
              </div>
            </div>

            <div className="pt-6 space-y-2">
              <button
                type="button"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
              >
                <Upload className="w-4 h-4" />
                <span>{t("invoice.uploadBillBtn", "Upload Bill (Image / PDF)")}</span>
              </button>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700 font-medium py-1 px-2"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t("invoice.takePhoto", "Take Photo with Camera")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING STATE */}
      {processing && (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl text-center space-y-4 shadow-sm animate-in fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 animate-spin">
            <RefreshCw className="w-7 h-7" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-slate-900">
              {t("invoice.readingBill", "Reading Supplier Bill...")}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {t("invoice.readingBillDesc", "Extracting supplier details, line items, item costs, and verifying bill totals.")}
            </p>
          </div>
        </div>
      )}

      {/* VIEW 2: FORM (Manual Entry OR Exception Review) */}
      {!processing && !successReceipt && (activeMode === "MANUAL" || (activeMode === "UPLOAD" && needsAttention)) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in">
          {/* Attention Banner if Upload needed user input */}
          {needsAttention && (
            <div className="bg-amber-50 border-b border-amber-200 p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div className="text-xs font-semibold text-amber-900">
                {attentionReason}
              </div>
            </div>
          )}

          {/* Form Header */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {activeMode === "MANUAL" ? t("invoice.manualDetails", "Manual Invoice Details") : t("invoice.reviewLineItems", "Review Bill Line Items")}
              </h3>
              <p className="text-xs text-slate-500">
                {activeMode === "MANUAL"
                  ? t("invoice.manualSubtitle", "Enter the supplier name, invoice details, and products purchased.")
                  : t("invoice.reviewSubtitle", "Resolve unmapped products or adjust prices before saving to inventory.")}
              </p>
            </div>

            {/* Math validation status badge */}
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  mathStatus.isValid
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                {mathStatus.isValid ? t("invoice.totalsVerified", "Invoice totals verified") : t("invoice.totalsNeedAttention", "Invoice totals need attention")}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Supplier Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t("invoice.supplierName", "Supplier Name")}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder={t("invoice.supplierPlaceholder", "e.g. Gupta Wholesalers")}
                    list="suppliers-list"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t("invoice.billNo", "Invoice Number")}
                </label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder={t("invoice.invNoPlaceholder", "e.g. INV-9021")}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t("invoice.billDate", "Invoice Date")}
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {t("invoice.lineItems", "Line Items")} ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("invoice.addItem", "Add Item")}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">{t("invoice.colProduct", "Product")}</th>
                      <th className="px-3 py-2.5 w-24 text-right">{t("invoice.colQuantity", "Quantity")}</th>
                      <th className="px-3 py-2.5 w-32 text-right">{t("invoice.colUnitCost", "Unit Cost (₹)")}</th>
                      <th className="px-3 py-2.5 w-32 text-right">{t("invoice.colTotal", "Total (₹)")}</th>
                      <th className="px-3 py-2.5 w-12 text-center">{t("invoice.colAction", "Action")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const isNewProduct = item.product_id === "__NEW__";
                      const isUnmapped = !item.product_id;
                      return (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            isNewProduct
                              ? "bg-emerald-50/30"
                              : isUnmapped
                              ? "bg-amber-50/40"
                              : ""
                          }`}
                        >
                          {/* Product Input / Autocomplete */}
                          <td className="px-3 py-2.5">
                            <div className="space-y-1.5">
                              {item.description && activeMode === "UPLOAD" && (
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {t("voice.extracted", "Extracted:")} <span className="font-bold text-slate-800">{item.description}</span>
                                </div>
                              )}
                              <div className="relative">
                                <input
                                  type="text"
                                  value={item.name || item.description || ""}
                                  onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                                  placeholder={t("invoice.enterProdPlaceholder", "Enter product name (e.g. Maggi, Soap, Oil)...")}
                                  list={`catalog-list-${idx}`}
                                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none transition-all ${
                                    isNewProduct
                                      ? "border border-indigo-300 bg-indigo-50/30 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                                      : item.product_id
                                      ? "border border-emerald-300 bg-emerald-50/30 text-slate-900 focus:border-emerald-500"
                                      : "border border-amber-300 bg-amber-50/30 text-slate-900 focus:border-amber-500"
                                  }`}
                                />
                                <datalist id={`catalog-list-${idx}`}>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.name}>
                                      {p.name} (Stock: {p.current_stock}, Cost: ₹{p.purchase_price || 0})
                                    </option>
                                  ))}
                                </datalist>
                              </div>

                              {/* Status Badges: Matched (green), Needs Review (amber), New Product (indigo) */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.product_id && item.product_id !== "__NEW__" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    <span>✓ {t("invoice.matched", "Matched")}</span>
                                    <span className="text-emerald-600/70">
                                      ({t("inventory.currentStock", "Stock")}: {products.find((p) => String(p.id) === String(item.product_id))?.current_stock ?? 0})
                                    </span>
                                  </span>
                                ) : (item.name || item.description) ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                    <span>✨ {t("invoice.newProductBadge", "New Product")}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                    <span>⚠️ {t("invoice.needsReviewBadge", "Needs Review")}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              className="w-20 px-2 py-1.5 text-right bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary-500"
                            />
                          </td>

                          {/* Unit Cost */}
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_cost}
                              onChange={(e) => handleItemChange(idx, "unit_cost", e.target.value)}
                              className="w-28 px-2 py-1.5 text-right bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-primary-500"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="px-3 py-2.5 text-right font-black text-slate-900 text-xs">
                            ₹{Number(item.total_cost || 0).toFixed(2)}
                          </td>

                          {/* Remove Row */}
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Summary Bar */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{t("invoice.totalItems", "Total Items")}</div>
                    <div className="text-sm font-bold text-slate-800">{items.length}</div>
                  </div>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{t("invoice.grandTotal", "Grand Total")}</div>
                    <div className="text-lg font-black text-emerald-700">
                      ₹{grandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSavePurchase}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-emerald-200"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t("invoice.savingPurchase", "Saving Purchase...")}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t("invoice.savePurchase", "Save Purchase")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: RECENT SUPPLIER BILLS */}
      {recentPurchases.length > 0 && !processing && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-800">
                {t("invoice.recentPurchases", "Recent Supplier Purchases")} ({recentPurchases.length})
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">{t("invoice.colDate", "Date")}</th>
                  <th className="px-4 py-2.5">{t("invoice.supplier", "Supplier")}</th>
                  <th className="px-4 py-2.5">{t("invoice.invoiceNo", "Invoice No")}</th>
                  <th className="px-4 py-2.5 text-center">{t("invoice.lineItems", "Items")}</th>
                  <th className="px-4 py-2.5 text-right">{t("dashboard.amount", "Total Amount")}</th>
                  <th className="px-4 py-2.5 text-center">{t("invoice.colStockStatus", "Stock Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700">
                      {p.purchase_date ? new Date(p.purchase_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      {p.supplier_name || "Supplier"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">
                      {p.invoice_no || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center font-semibold text-indigo-700">
                      {p.items_count || 1}
                    </td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-700">
                      ₹{Number(p.total_amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> {t("invoice.updated", "Updated")}
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
  );
};

export default Invoice;
