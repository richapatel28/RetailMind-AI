import React from "react";
import { Sparkles } from "lucide-react";

export const ConfidenceMeter = ({ value = 0, showBar = true, size = "sm" }) => {
  // Normalize value to 0-100 percentage
  const num = typeof value === "number" ? value : parseFloat(value) || 0;
  const percentage = num <= 1 ? Math.round(num * 100) : Math.round(num);

  let color = "text-emerald-700 bg-emerald-50 border-emerald-200";
  let barColor = "bg-emerald-500";
  let label = "High Confidence";

  if (percentage < 60) {
    color = "text-rose-700 bg-rose-50 border-rose-200";
    barColor = "bg-rose-500";
    label = "Low Confidence";
  } else if (percentage < 85) {
    color = "text-amber-700 bg-amber-50 border-amber-200";
    barColor = "bg-amber-500";
    label = "Moderate Confidence";
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${color}`}
          title={label}
        >
          <Sparkles className="w-3 h-3 text-accent-600" />
          <span>{percentage}%</span>
        </span>
      </div>

      {showBar && (
        <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.max(percentage, 5)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ConfidenceMeter;
