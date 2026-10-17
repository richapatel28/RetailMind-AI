import React from "react";
import { CheckCircle2, AlertCircle, HelpCircle, Clock, XCircle, Sparkles } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const STATUS_CONFIGS = {
  MATCHED: {
    labels: {
      en: "Matched",
      gu: "મેળ ખાધેલ",
      hi: "मिलान हुआ",
      mr: "जुळले",
    },
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  PROCESSED: {
    labels: {
      en: "Processed",
      gu: "પ્રક્રિયા પૂર્ણ",
      hi: "संसाधित",
      mr: "प्रक्रिया झाली",
    },
    bg: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Sparkles,
  },
  REVIEW_REQUIRED: {
    labels: {
      en: "Review Required",
      gu: "સમીક્ષા જરૂરી",
      hi: "समीक्षा आवश्यक",
      mr: "पुनरावलोकन आवश्यक",
    },
    bg: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertCircle,
  },
  REVIEW: {
    labels: {
      en: "Review",
      gu: "સમીક્ષા",
      hi: "समीक्षा",
      mr: "पुनरावलोकन",
    },
    bg: "bg-amber-50 text-amber-700 border-amber-200",
    icon: AlertCircle,
  },
  UNMATCHED: {
    labels: {
      en: "Unmatched",
      gu: "મેળ નથી",
      hi: "मेल नहीं खाता",
      mr: "जुळले नाही",
    },
    bg: "bg-rose-50 text-rose-700 border-rose-200",
    icon: HelpCircle,
  },
  PAID: {
    labels: {
      en: "Paid",
      gu: "ચૂકવેલ",
      hi: "चुकाया",
      mr: "भरले",
    },
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  PARTIAL: {
    labels: {
      en: "Partial",
      gu: "અંશતઃ",
      hi: "आंशिक",
      mr: "अंशतः",
    },
    bg: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  PENDING: {
    labels: {
      en: "Pending",
      gu: "બાકી",
      hi: "लंबित",
      mr: "प्रलंबित",
    },
    bg: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Clock,
  },
  CREDIT: {
    labels: {
      en: "Credit",
      gu: "બાકી (ઉધાર)",
      hi: "उधार (Credit)",
      mr: "उधारी (Credit)",
    },
    bg: "bg-amber-50 text-amber-800 border-amber-300",
    icon: AlertCircle,
  },
  CONFIRMED: {
    labels: {
      en: "Confirmed",
      gu: "પુષ્ટિ થયેલ",
      hi: "पुष्टि",
      mr: "पुष्टी",
    },
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  ERROR: {
    labels: {
      en: "Error",
      gu: "ભૂલ",
      hi: "त्रुटि",
      mr: "त्रुटी",
    },
    bg: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
};

export const StatusBadge = ({ status, size = "sm", forceEnglish = false }) => {
  if (!status) return null;

  let activeLang = "en";
  try {
    const langCtx = useLanguage();
    if (langCtx?.language && !forceEnglish) {
      activeLang = langCtx.language;
    }
  } catch (e) {
    activeLang = "en";
  }

  const normalized = String(status).toUpperCase();
  const current = STATUS_CONFIGS[normalized];

  if (!current) {
    const sizeClasses = size === "xs" ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2.5 py-1";
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full border bg-slate-100 text-slate-700 border-slate-200 ${sizeClasses}`}>
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  const Icon = current.icon;
  const label = current.labels[activeLang] || current.labels.en || status;
  const sizeClasses = size === "xs" ? "text-[11px] px-1.5 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${current.bg} ${sizeClasses}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{label}</span>
    </span>
  );
};

export default StatusBadge;
