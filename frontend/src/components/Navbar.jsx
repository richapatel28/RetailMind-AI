import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Menu, Globe, ChevronDown, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export const Navbar = ({ onOpenSidebar }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { language, setLanguage, supportedLanguages, currentLangMeta, t } = useLanguage();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPageMeta = () => {
    switch (location.pathname) {
      case "/dashboard":
        return {
          title: t("nav.dashboard", "Dashboard"),
          subtitle: t("dashboard.perfSubtitle", "Your store at a glance — sales, profit, and inventory."),
        };
      case "/voice-sale":
        return {
          title: t("voice.title", "Voice Sale"),
          subtitle: t("voice.brandSubtitle", "Sell faster with your voice."),
        };
      case "/invoice":
        return {
          title: t("invoice.title", "Supplier Bills"),
          subtitle: t("invoice.brandSubtitle", "Turn supplier bills into inventory automatically."),
        };
      case "/reconciliation":
        return {
          title: t("recon.title", "Bank & UPI Match"),
          subtitle: t("recon.brandSubtitle", "Keep your bank payments aligned with your sales."),
        };
      case "/inventory":
        return {
          title: t("inventory.title", "Inventory & Stock"),
          subtitle: t("inventory.brandSubtitle", "Know what you have. Know what you need."),
        };
      case "/sales":
        return {
          title: t("sales.title", "Billing & Sales"),
          subtitle: t("sales.brandSubtitle", "Fast, simple checkout for your store."),
        };
      case "/copilot":
        return {
          title: t("copilot.title", "AI Store Help"),
          subtitle: t("copilot.brandSubtitle", "Your intelligent retail assistant."),
        };
      default:
        return {
          title: "RetailMind AI",
          subtitle: "Smarter Retail. Simpler Every Day.",
        };
    }
  };

  const meta = getPageMeta();

  return (
    <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg lg:hidden"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
            {meta.title}
          </h1>
          <p className="text-xs text-slate-400 hidden sm:block">
            {meta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Language Selector */}
      <div className="flex items-center gap-3">

        {/* Language Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setLangDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-sm transition-all"
            title={t("common.selectLanguage", "Select Language")}
          >
            <Globe className="w-3.5 h-3.5 text-primary-600" />
            <span className="text-sm">{currentLangMeta.flag}</span>
            <span>{currentLangMeta.native}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                {t("common.selectLanguage", "Select Language")}
              </div>
              {supportedLanguages.map((l) => {
                const isSelected = l.code === language;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLanguage(l.code);
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      isSelected
                        ? "bg-primary-50 text-primary-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{l.flag}</span>
                      <span>{l.native}</span>
                      <span className="text-[10px] text-slate-400">({l.name})</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
