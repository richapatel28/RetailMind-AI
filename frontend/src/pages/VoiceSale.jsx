import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Mic,
  Square,
  Upload,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  FileAudio,
  ArrowRight,
  ShieldCheck,
  Edit3,
  Globe,
  Plus,
  Trash2,
  Printer,
  Receipt,
  ShoppingBag,
  User
} from "lucide-react";
import { processVoiceAudio, processVoiceText, confirmVoiceSale } from "../services/voiceApi";
import { getProducts } from "../services/productApi";
import { getCustomers } from "../services/customerApi";
import StatusBadge from "../components/StatusBadge";
import ConfidenceMeter from "../components/ConfidenceMeter";
import { useToast } from "../components/Toast";
import { useLanguage } from "../context/LanguageContext";

// Localized test phrases for each language (Single & Multi-Product commands + Udhaar)
const quickPhrasesByLang = {
  en: [
    { text: "sold 2 Maggie and 1 Coca Cola for 45 rupees cash", label: "2 Maggie + 1 Coke Rs 45 cash" },
    { text: "sold 2 Maggie to Ramesh on credit", label: "2 Maggie to Ramesh (Udhaar)" },
    { text: "gave 1 Tata Salt and 2 Parle-G for 40 rupees UPI", label: "1 Salt + 2 Parle-G Rs 40 UPI" },
  ],
  hi: [
    { text: "२ मैगी और १ कोका कोला ३० रुपये नकद", label: "२ मैगी + १ कोका कोला ३० रुपये नकद" },
    { text: "रमेश को २ मैगी उधार दिया", label: "२ मैगी रमेश को उधार" },
    { text: "एक टाटा नमक और दो पारले जी ४० रुपये यूपीआई", label: "१ टाटा नमक + २ पारले जी UPI" },
  ],
  mr: [
    { text: "२ मॅगी आणि १ कोका कोला ३० रुपये रोख", label: "२ मॅगी + १ कोका कोला ३० रुपये रोख" },
    { text: "रमेशला २ मॅगी उधारीवर दिली", label: "२ मॅगी रमेशला उधारी" },
    { text: "एक टाटा मीठ आणि दोन पारले जी ४० रुपये यूपीआय", label: "१ टाटा मीठ + २ पारले जी UPI" },
  ],
  gu: [
    { text: "૨ મેગી અને ૧ કોકા કોલા ૩૦ રૂપિયા રોકડ", label: "૨ મેગી + ૧ કોકા કોલા ૩૦ રૂપિયા રોકડ" },
    { text: "રમેશભાઈને ૨ મેગી ઉધાર આપી", label: "૨ મેગી રમેશભાઈને ઉધાર" },
    { text: "૧ ટાટા મીઠું અને ૨ પારલે જી ૪૦ રૂપિયા યુપીઆઈ", label: "૧ મીઠું + ૨ પારલે જી UPI" },
  ],
};

export const VoiceSale = () => {
  const { addToast } = useToast();
  const { t, language, currentLangMeta } = useLanguage();

  // Voice speech & model analysis is locked strictly to the active user's registered language
  const voiceLanguage = language;

  // Recording & Upload States
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Text Phrase Fallback / Testing State
  const [phraseInput, setPhraseInput] = useState("");
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");

  // Result & Multi-Item Basket States
  const [result, setResult] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [basketItems, setBasketItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [manualEditMode, setManualEditMode] = useState(false);

  // Confirmation & Receipt State
  const [confirming, setConfirming] = useState(false);
  const [confirmedSale, setConfirmedSale] = useState(null);
  const [error, setError] = useState(null);

  // MediaRecorder refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch product catalog and customer list
  useEffect(() => {
    getProducts()
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load products:", err));

    getCustomers()
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load customers:", err));
  }, []);

  // Timer for audio recording
  useEffect(() => {
    if (recording) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingDuration(0);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  const speechRecognitionRef = useRef(null);

  // Start live microphone recording
  const startRecording = async () => {
    setError(null);
    setConfirmedSale(null);
    setResult(null);
    setSelectedFile(null);
    setAudioBlob(null);
    setBasketItems([]);
    setManualEditMode(false);
    setPhraseInput("");

    // Initialize Web Speech API for real-time live transcription in Chrome/Edge
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    let liveTranscript = "";
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang =
          voiceLanguage === "gu"
            ? "gu-IN"
            : voiceLanguage === "hi"
            ? "hi-IN"
            : voiceLanguage === "mr"
            ? "mr-IN"
            : "en-IN";

        recognition.onresult = (event) => {
          let text = "";
          for (let i = 0; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            liveTranscript = text;
            setPhraseInput(text);
          }
        };

        recognition.onerror = (e) => {
          console.warn("Speech recognition notice:", e.error);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (recErr) {
        console.warn("Speech recognition init warning:", recErr);
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());

        // Automatically trigger AI analysis when recording stops!
        setTimeout(() => {
          if (liveTranscript && liveTranscript.trim().length > 2) {
            handleProcessText(liveTranscript.trim());
          } else {
            handleProcessAudio(blob);
          }
        }, 400);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      setError(t("voice.micError", "Microphone not available or permission denied. Please use the text input below to test."));
    }
  };

  // Stop live microphone recording
  const stopRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (_) {}
    }
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // Handle local audio file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setAudioBlob(null);
      setError(null);
      setConfirmedSale(null);
      setResult(null);
      setBasketItems([]);
      setManualEditMode(false);
    }
  };

  // Helper to find matching catalog product for current tenant
  const findCatalogProduct = (candidateId, candidateName, rawText) => {
    if (candidateId) {
      const found = products.find((p) => String(p.id) === String(candidateId));
      if (found) return found;
    }

    const cleanTarget = (candidateName || rawText || "").trim().toLowerCase();
    if (!cleanTarget) return null;

    // 1. Exact name match
    let found = products.find((p) => (p.name || "").trim().toLowerCase() === cleanTarget);
    if (found) return found;

    // 2. Substring / partial name match
    found = products.find((p) => {
      const pName = (p.name || "").trim().toLowerCase();
      return pName.includes(cleanTarget) || cleanTarget.includes(pName);
    });
    if (found) return found;

    // 3. Alias match
    found = products.find((p) => {
      if (!Array.isArray(p.aliases)) return false;
      return p.aliases.some((a) => {
        const aLower = (a || "").trim().toLowerCase();
        return aLower === cleanTarget || aLower.includes(cleanTarget) || cleanTarget.includes(aLower);
      });
    });
    if (found) return found;

    // 4. Gujarati/Indic term matching heuristics
    const gujaratiMap = {
      "મેગી": "maggi",
      "મેગ્ગી": "maggi",
      "કોકા": "coca",
      "કોલા": "cola",
      "કોક": "coca cola",
      "પાર્લે": "parle",
      "દૂધ": "milk",
      "તેલ": "oil",
      "મીઠું": "salt",
      "સાબુ": "soap",
      "સર્ફ": "surf",
      "કોલગેટ": "colgate",
      "લોટ": "atta",
      "આટા": "atta"
    };

    for (const [guWord, enWord] of Object.entries(gujaratiMap)) {
      if (cleanTarget.includes(guWord)) {
        found = products.find((p) => (p.name || "").toLowerCase().includes(enWord));
        if (found) return found;
      }
    }

    return null;
  };

  // Populate extracted results into interactive multi-product basket
  const populateResultData = (data) => {
    setResult(data);

    let extractedItems = [];

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      extractedItems = data.items.map((it, idx) => {
        const matched = it.product_match?.matched_product;
        const catalogProd = findCatalogProduct(matched?.id, matched?.name, it.product_text);
        const prodId = catalogProd ? String(catalogProd.id) : (matched?.id ? String(matched.id) : "");
        const qty = Number(it.quantity || 1);
        const price = Number(
          catalogProd?.selling_price ||
          it.unit_price ||
          matched?.selling_price ||
          0
        );

        return {
          id: idx + 1,
          product_id: prodId,
          name: catalogProd?.name || matched?.name || it.product_text || "Product",
          raw_text: it.product_text || "",
          quantity: qty,
          unit_price: price,
          confidence: it.product_match?.confidence || 0,
          stock: catalogProd?.current_stock ?? matched?.current_stock ?? null,
          sku: catalogProd?.sku || matched?.sku || "",
        };
      });
    } else if (data.product_match?.matched_product) {
      const matched = data.product_match.matched_product;
      const catalogProd = findCatalogProduct(matched.id, matched.name, data.product_text);
      const prodId = catalogProd ? String(catalogProd.id) : (matched.id ? String(matched.id) : "");
      const qty = Number(data.quantity || 1);
      const price = Number(catalogProd?.selling_price || data.unit_price || matched.selling_price || 0);

      extractedItems = [
        {
          id: 1,
          product_id: prodId,
          name: catalogProd?.name || matched.name || data.product_text || "Product",
          raw_text: data.product_text || "",
          quantity: qty,
          unit_price: price,
          confidence: data.product_match?.confidence || 0,
          stock: catalogProd?.current_stock ?? matched.current_stock ?? null,
          sku: catalogProd?.sku || matched.sku || "",
        },
      ];
    } else if (data.product_text) {
      const catalogProd = findCatalogProduct(null, null, data.product_text);
      const prodId = catalogProd ? String(catalogProd.id) : "";
      const price = Number(catalogProd?.selling_price || 0);

      extractedItems = [
        {
          id: 1,
          product_id: prodId,
          name: catalogProd?.name || data.product_text,
          raw_text: data.product_text,
          quantity: Number(data.quantity || 1),
          unit_price: price,
          confidence: catalogProd ? 0.9 : 0,
          stock: catalogProd?.current_stock ?? null,
          sku: catalogProd?.sku || "",
        },
      ];
    }

    setBasketItems(extractedItems);

    const mode = (data.payment_mode || "CASH").toUpperCase();
    setPaymentMode(["CASH", "UPI", "CREDIT"].includes(mode) ? mode : "CASH");
    if (data.customer && typeof data.customer === "string") {
      setCustomerName(data.customer.trim());
    }
    setManualEditMode(false);
    setIsEditingTranscript(false);

    const allHaveProduct = extractedItems.length > 0 && extractedItems.every((it) => Boolean(it.product_id));
    if (allHaveProduct) {
      addToast(t("voice.reviewPrompt", "Voice sale recognized! Review and confirm below."), "success");
    } else {
      addToast(t("voice.couldNotUnderstand", "Voice processed. Review required."), "warning");
    }
  };

  // Process the recorded audio or uploaded file
  const handleProcessAudio = async (overrideFile = null) => {
    const fileToProcess = overrideFile || selectedFile || audioBlob;
    if (!fileToProcess) {
      setError("Please record audio or upload an audio file first.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const data = await processVoiceAudio(fileToProcess, voiceLanguage);
      populateResultData(data);
    } catch (err) {
      console.error("Voice process error:", err);
      setError(err.response?.data?.message || "Failed to process audio. Please try again.");
      addToast("Voice processing failed.", "error");
    } finally {
      setProcessing(false);
    }
  };

  // Process typed speech phrase directly (testing or manual transcript edit)
  const handleProcessText = async (textOverride = null) => {
    const textToProcess = textOverride || phraseInput;
    if (!textToProcess || !textToProcess.trim()) {
      setError("Please enter a speech phrase to analyze.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const data = await processVoiceText(textToProcess.trim(), voiceLanguage);
      populateResultData(data);
    } catch (err) {
      console.error("Voice text process error:", err);
      setError(err.response?.data?.message || "Failed to analyze speech text. Please try again.");
      addToast("Voice analysis failed.", "error");
    } finally {
      setProcessing(false);
    }
  };

  // Basket item handlers
  const handleItemProductChange = (itemId, prodId) => {
    const p = products.find((prod) => String(prod.id) === prodId);
    setBasketItems((prev) =>
      prev.map((it) => {
        if (it.id === itemId) {
          return {
            ...it,
            product_id: prodId,
            name: p ? p.name : it.name,
            unit_price: p ? Number(p.selling_price) : it.unit_price,
            stock: p ? Number(p.current_stock) : null,
            sku: p ? p.sku : "",
          };
        }
        return it;
      })
    );
  };

  const handleItemQuantityChange = (itemId, val) => {
    const qty = val === "" ? "" : Math.max(1, Number(val));
    setBasketItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, quantity: qty } : it))
    );
  };

  const handleItemPriceChange = (itemId, val) => {
    const price = val === "" ? "" : Number(val);
    setBasketItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, unit_price: price } : it))
    );
  };

  const handleRemoveItem = (itemId) => {
    setBasketItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      product_id: "",
      name: "",
      raw_text: "",
      quantity: 1,
      unit_price: 0,
      confidence: 1.0,
      stock: null,
      sku: "",
    };
    setBasketItems((prev) => [...prev, newItem]);
  };

  // Calculate grand total from basket items
  const grandTotal = basketItems.reduce(
    (acc, it) => acc + (Number(it.quantity || 0) * Number(it.unit_price || 0)),
    0
  );

  const canConfirm =
    basketItems.length > 0 &&
    basketItems.every(
      (it) => it.product_id && Number(it.quantity) > 0 && Number(it.unit_price) >= 0
    ) &&
    grandTotal > 0;

  // Confirm Sale Transaction
  const handleConfirmSale = async () => {
    if (!result?.event_id) {
      setError("No active voice event to confirm.");
      return;
    }

    if (basketItems.length === 0) {
      setError("Please add at least one product to confirm the sale.");
      return;
    }

    const invalid = basketItems.find((it) => !it.product_id || Number(it.quantity) <= 0);
    if (invalid) {
      setError("Each item in the basket must have a selected product and quantity greater than 0.");
      return;
    }

    if (paymentMode === "CREDIT" && !customerName.trim()) {
      setError(t("voice.creditNameRequired", "Customer name is required for Credit (Udhaar) sales."));
      addToast("Customer name is required for Udhaar / Credit sale.", "warning");
      return;
    }

    setConfirming(true);
    setError(null);

    try {
      const payload = {
        event_id: result.event_id,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        items: basketItems.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
          selling_price: Number(it.unit_price || 0),
        })),
        payment_mode: paymentMode,
        payment_amount: paymentMode === "CREDIT" ? 0 : Number(grandTotal.toFixed(2)),
      };

      const confirmation = await confirmVoiceSale(payload);
      setConfirmedSale({
        ...confirmation,
        customer_name: customerName.trim() || confirmation.customer_name || null,
        basket: basketItems,
        grandTotal: Number(grandTotal.toFixed(2)),
        paymentMode,
      });
      addToast(t("voice.saleRecordedSuccess", "Sale recorded and saved!"), "success");

      // Refresh product list and customer list to show updated stock and customers
      getProducts().then((data) => setProducts(Array.isArray(data) ? data : []));
      getCustomers().then((data) => setCustomers(Array.isArray(data) ? data : []));
    } catch (err) {
      console.error("Voice confirm error:", err);
      setError(err.response?.data?.message || "Failed to confirm sale transaction.");
      addToast("Sale confirmation failed.", "error");
    } finally {
      setConfirming(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setAudioBlob(null);
    setSelectedFile(null);
    setConfirmedSale(null);
    setError(null);
    setBasketItems([]);
    setCustomerName("");
    setCustomerPhone("");
    setPaymentMode("CASH");
    setManualEditMode(false);
    setPhraseInput("");
    setIsEditingTranscript(false);
    setEditedTranscript("");
  };

  const activeQuickPhrases = quickPhrasesByLang[language] || quickPhrasesByLang.en;

  // Determine current workflow state
  const getCurrentStepIndex = () => {
    if (confirmedSale) return 4;
    if (result && !processing) return 4;
    if (processing) return 2; // Transcribing / Understanding
    if (recording) return 1; // Listening
    return 0; // Ready
  };
  const currentStep = getCurrentStepIndex();
  const workflowSteps = [
    { label: t("voice.stepReady", "Ready") },
    { label: t("voice.stepListening", "Listening") },
    { label: t("voice.stepTranscribing", "Transcribing") },
    { label: t("voice.stepUnderstanding", "Understanding") },
    { label: t("voice.stepReview", "Review") },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Workflow State Tracker */}
      <div className="flex items-center justify-end">
        <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          {workflowSteps.map((step, idx) => {
            const isActive = currentStep === idx;
            const isCompleted = currentStep > idx;
            return (
              <React.Fragment key={idx}>
                <span
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700 font-semibold"
                      : isCompleted
                      ? "text-slate-600"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
                {idx < workflowSteps.length - 1 && (
                  <span className="text-slate-300 text-[10px]">→</span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-snug">{error}</div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION RECEIPT / BILL GENERATION */}
      {confirmedSale && (
        <div className="p-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl shadow-sm space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-950">
                  {t("voice.saleRecordedSuccess", "Sale Recorded Successfully!")}
                </h3>
                <p className="text-xs text-emerald-700">
                  {t("voice.saleRecordedDesc", "Sale #{id} has been recorded and inventory stock has been updated.").replace("{id}", confirmedSale.sale_id)}
                </p>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 text-xs font-semibold shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t("voice.printBill", "Print Bill")}</span>
            </button>
          </div>

          {/* BILL RECEIPT CARD */}
          <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-900 text-sm">{t("voice.billReceipt", "Official Bill Receipt")}</span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 block">
                  {confirmedSale.bill_number || `Sale #${confirmedSale.sale_id}`} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {confirmedSale.customer_name && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium mt-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t("voice.customerLabel", "Customer")}: <strong className="text-slate-900">{confirmedSale.customer_name}</strong></span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-800 uppercase">
                  {confirmedSale.paymentMode === "CREDIT" ? t("voice.credit", "Customer Credit") : confirmedSale.paymentMode}
                </div>
                {confirmedSale.payment_status === "CREDIT" || confirmedSale.paymentMode === "CREDIT" ? (
                  <span className="text-[10px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    {t("voice.udhaarDue", "UDHAAR / DUE")}
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {confirmedSale.payment_status || "PAID"}
                  </span>
                )}
              </div>
            </div>

            {/* Line items table in Bill */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                    <th className="py-2">{t("voice.item", "Item")}</th>
                    <th className="py-2 text-center">{t("voice.qty", "Qty")}</th>
                    <th className="py-2 text-right">{t("voice.price", "Rate (₹)")}</th>
                    <th className="py-2 text-right">{t("voice.lineTotal", "Total (₹)")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {confirmedSale.basket && confirmedSale.basket.map((item, idx) => (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-2 font-medium">{item.name}</td>
                      <td className="py-2 text-center font-bold">{item.quantity}</td>
                      <td className="py-2 text-right">₹{Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right font-bold text-slate-900">
                        ₹{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-500 uppercase">{t("voice.grandTotal", "Grand Total")}</span>
              <span className="text-xl font-black text-emerald-700">₹{confirmedSale.total_amount || confirmedSale.grandTotal}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link
              to="/sales"
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-emerald-300 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t("nav.sales", "View All Bills")}</span>
            </Link>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t("voice.recordAnother", "Record Another Sale")}</span>
            </button>
          </div>
        </div>
      )}

      {/* RECORDING / INPUT PANEL */}
      {!confirmedSale && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Active Store Language Badge (No manual override permitted) */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary-600" />
              <span className="text-xs font-bold text-slate-700">
                {t("voice.currentLanguage", "Speech Recognition Language:")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-primary-100 text-primary-800 border border-primary-200 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {currentLangMeta?.native || currentLangMeta?.name || "English"} ({voiceLanguage.toUpperCase()})
              </span>
            </div>
          </div>

          {/* PRIMARY RECORDING CONTROLS */}
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50/60 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4">
            {recording ? (
              <div className="space-y-4">
                <div className="relative inline-flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-rose-500/20 animate-ping absolute" />
                  <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg relative">
                    <Mic className="w-8 h-8 animate-pulse" />
                  </div>
                </div>
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {t("voice.listening", "Listening in")} {currentLangMeta?.native || currentLangMeta?.name}...
                  </div>
                  <div className="text-xs text-rose-600 font-semibold mt-1">
                    {recordingDuration}s • {t("voice.speakMultipleProducts", "Speak multiple products e.g., '2 Maggi and 1 Coke for 45 rupees cash'")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 mx-auto"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>{t("voice.stopRecording", "Stop Recording")}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-primary-600 hover:bg-primary-700 active:scale-95 text-white flex items-center justify-center shadow-lg transition-all mx-auto group"
                >
                  <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />
                </button>
                <div>
                  <div className="text-sm font-bold text-slate-800">
                    {t("voice.clickToRecord", "Click to speak customer order")}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t("voice.multiProductTip", "Supports 1 or multiple items in a single sentence in")} {currentLangMeta?.native || currentLangMeta?.name}
                  </div>
                </div>
              </div>
            )}

            {/* AUDIO FILE UPLOAD FALLBACK */}
            <div className="pt-2 flex items-center justify-center gap-3 text-xs text-slate-500">
              <span>{t("voice.or", "or")}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-semibold"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t("voice.uploadAudio", "Upload Audio File")}</span>
              </button>
            </div>

            {/* Selected File / Recorded Blob Badge */}
            {(selectedFile || audioBlob) && !processing && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full text-xs font-medium">
                <FileAudio className="w-3.5 h-3.5 text-indigo-600" />
                <span>{selectedFile ? selectedFile.name : `Voice Recording (${recordingDuration || "Ready"}s)`}</span>
                <button
                  type="button"
                  onClick={() => handleProcessAudio()}
                  className="ml-2 font-bold underline hover:text-indigo-950"
                >
                  {t("voice.analyzeVoice", "Analyze Audio")}
                </button>
              </div>
            )}

            {/* DIRECT TEXT PHRASE INPUT (FOR QUICK MULTI-PRODUCT TEST) */}
            <div className="w-full max-w-lg pt-4 border-t border-slate-200/60 space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessText();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  placeholder={t("voice.speakExample", 'e.g., "sold 2 Maggie and 1 Coca Cola for 45 rupees cash"')}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-slate-50/70"
                />
                <button
                  type="submit"
                  disabled={processing || !phraseInput.trim()}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shadow-sm"
                >
                  {t("voice.analyze", "Analyze")}
                </button>
              </form>

              {/* Dynamic Quick Test Phrases for the active language */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-medium text-slate-500 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                  <span>{t("voice.quickTest", "Try sample orders:")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {activeQuickPhrases.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setPhraseInput(sample.text);
                        handleProcessText(sample.text);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-900 text-xs font-bold transition-all shadow-xs active:scale-95"
                    >
                      <span>⚡</span>
                      <span>{sample.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PROCESSING STATE */}
          {processing && (
            <div className="p-8 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-center space-y-3 animate-in fade-in">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-700 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                {t("voice.processingSale", "Processing your voice recording...")}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t("voice.processing", "Transcribing speech and extracting products from inventory catalog.")}
              </p>
            </div>
          )}

          {/* AI EXTRACTION RESULT */}
          {result && !processing && (
            <div className="border-t border-slate-100 pt-6 space-y-6">
              {/* Transcript Banner */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {t("voice.transcribedSpeech", "Transcribed Speech")}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingTranscript(!isEditingTranscript);
                      setEditedTranscript(result.transcript || "");
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    {isEditingTranscript ? t("common.cancel", "Cancel") : t("voice.editSpeech", "Edit Speech")}
                  </button>
                </div>
                {isEditingTranscript ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleProcessText(editedTranscript);
                    }}
                    className="flex items-center gap-2 mt-2"
                  >
                    <input
                      type="text"
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="submit"
                      disabled={processing || !editedTranscript.trim()}
                      className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      {t("voice.reAnalyze", "Re-analyze")}
                    </button>
                  </form>
                ) : (
                  <div className="text-base font-semibold text-slate-900 italic">
                    "{result.transcript}"
                  </div>
                )}
              </div>

              {/* Extraction Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">{t("voice.intent", "Intent")}</span>
                  <div className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                    {result.intent || t("voice.sale", "Sale")}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">{t("voice.detectedMode", "Detected Mode")}</span>
                  <div className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                    {result.payment_mode || t("voice.cash", "Cash")}
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">{t("voice.confidence", "Confidence")}</span>
                  <div className="mt-1">
                    <ConfidenceMeter value={result.confidence} />
                  </div>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">{t("voice.matchStatus", "Match Status")}</span>
                  <div className="mt-1">
                    <StatusBadge status={result.status || "MATCHED"} size="xs" />
                  </div>
                </div>
              </div>

              {/* MULTI-PRODUCT REVIEW & CONFIRMATION BASKET */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-primary-600" />
                      <span>{t("voice.detectedItems", "Detected Items Basket")}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-primary-100 text-primary-800">
                        {basketItems.length}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {t("voice.reviewSubtitle", "Review detected products, adjust quantities, or add new items before generating bill.")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("voice.addItem", "Add Product")}</span>
                  </button>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px]">
                        <th className="py-2.5 px-2">{t("voice.productName", "Product")}</th>
                        <th className="py-2.5 px-2 w-28 text-center">{t("voice.quantity", "Quantity")}</th>
                        <th className="py-2.5 px-2 w-32 text-right">{t("voice.price", "Rate (₹)")}</th>
                        <th className="py-2.5 px-2 w-32 text-right">{t("voice.lineTotal", "Total (₹)")}</th>
                        <th className="py-2.5 px-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {basketItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          {/* Product Selection */}
                          <td className="py-2.5 px-2">
                            <select
                              value={item.product_id}
                              onChange={(e) => handleItemProductChange(item.id, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="">{t("voice.selectProduct", "-- Select Product --")}</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (Stock: {p.current_stock}, ₹{p.selling_price})
                                </option>
                              ))}
                            </select>
                            {item.raw_text && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Spoken: "{item.raw_text}"
                              </div>
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(item.id, e.target.value)}
                              className="w-20 px-2 py-1.5 text-center font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleItemPriceChange(item.id, e.target.value)}
                              className="w-24 px-2 py-1.5 text-right font-medium bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </td>

                          {/* Line Total */}
                          <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                            ₹{(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2)}
                          </td>

                          {/* Delete action */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Basket Footer with Payment & Confirmation */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 items-center">
                  {/* Payment Mode */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      {t("voice.paymentMode", "Payment Mode")}
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="CASH">{t("voice.cash", "Cash")}</option>
                      <option value="UPI">{t("voice.upi", "UPI / QR Code")}</option>
                      <option value="CREDIT">{t("voice.credit", "Customer Credit (Udhaar)")}</option>
                    </select>
                  </div>

                  {/* Grand Total */}
                  <div className="sm:col-span-2 text-right space-y-1">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">
                      {t("voice.grandTotal", "Grand Total")}
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      ₹{grandTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* CUSTOMER DETAILS FOR UDHAAR / CREDIT */}
                {paymentMode === "CREDIT" ? (
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                        <User className="w-4 h-4 text-amber-600" />
                        <span>{t("voice.customerCreditDetails", "Customer Credit Details (Udhaar)")} *</span>
                      </div>
                      <span className="text-[10px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                        {t("voice.creditLedgerNote", "Added to Credit Ledger")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                          {t("voice.customerName", "Customer Name")} *
                        </label>
                        <input
                          type="text"
                          list="customer-voice-list"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder={t("voice.customerPlaceholder", "e.g. Ramesh Patel")}
                          required
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                        <datalist id="customer-voice-list">
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
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder={t("voice.phonePlaceholder", "e.g. 9876543210")}
                          className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-2 text-xs">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      list="customer-voice-list"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t("voice.optionalCustomer", "Customer Name (Optional)")}
                      className="w-full max-w-sm px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                    <datalist id="customer-voice-list">
                      {customers.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.contact ? `${c.name} (${c.contact})` : c.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                )}

                {/* Primary Confirm Button */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    {t("voice.discard", "Discard")}
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSale}
                    disabled={confirming || !canConfirm}
                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {confirming ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{t("voice.savingSale", "Saving Sale...")}</span>
                      </>
                    ) : (
                      <>
                        <span>
                          {canConfirm
                            ? `${t("voice.confirmSale", "Confirm Sale & Generate Bill")} (₹${grandTotal.toFixed(2)})`
                            : t("voice.selectProductToConfirm", "Select Product & Details to Confirm")}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceSale;
