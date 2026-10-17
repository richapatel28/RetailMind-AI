import React from "react";

export const Logo = ({ size = "md", showTagline = false, variant = "dark" }) => {
  const sizeMap = {
    sm: { icon: "w-7 h-7", text: "text-lg", sub: "text-[10px]" },
    md: { icon: "w-9 h-9", text: "text-xl", sub: "text-xs" },
    lg: { icon: "w-12 h-12", text: "text-2xl", sub: "text-sm" },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className="flex items-center gap-3 select-none">
      {/* SVG Icon: Retail Store + AI Neural Core */}
      <div className={`relative ${currentSize.icon} flex-shrink-0`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          {/* Base rounded container */}
          <rect width="40" height="40" rx="10" fill="url(#logo_grad)" />
          {/* Store front awning & cart contour */}
          <path
            d="M10 16L12 11H28L30 16"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Basket base */}
          <path
            d="M11 16L13.5 28C13.8 29.1 14.7 30 15.8 30H24.2C25.3 30 26.2 29.1 26.5 28L29 16"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* AI Neural Spark at Center */}
          <circle cx="20" cy="22" r="3" fill="#22D3EE" />
          <path
            d="M20 17V19M20 25V27M15 22H17M23 22H25"
            stroke="#22D3EE"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Gradient definitions */}
          <defs>
            <linearGradient id="logo_grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4F46E5" />
              <stop offset="1" stopColor="#312E81" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span
            className={`font-bold tracking-tight ${
              variant === "light" ? "text-white" : "text-slate-900"
            } ${currentSize.text}`}
          >
            Retail<span className="text-primary-600 dark:text-primary-400">Mind</span>
          </span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-50 text-accent-700 border border-accent-200">
            AI
          </span>
        </div>
        {showTagline && (
          <span
            className={`font-medium tracking-wide mt-1 ${
              variant === "light" ? "text-slate-300" : "text-slate-500"
            } ${currentSize.sub}`}
          >
            Intelligent Retail. Simplified.
          </span>
        )}
      </div>
    </div>
  );
};

export default Logo;
