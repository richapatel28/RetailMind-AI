import React, { createContext, useContext, useState, useEffect } from "react";
import { translations } from "../i18n/translations";
import { updateUserLanguage } from "../services/authApi";

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", native: "English", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
];

export const normalizeLangCode = (raw) => {
  if (!raw) return "en";
  const str = String(raw).toLowerCase().trim();
  if (str.startsWith("hi")) return "hi";
  if (str.startsWith("mr") || str.startsWith("mar")) return "mr";
  if (str.startsWith("gu")) return "gu";
  return "en";
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    try {
      // First check if an authenticated user session exists with a preferred language
      const storedToken = localStorage.getItem("retailmind_token");
      const storedUser = localStorage.getItem("retailmind_user");
      if (storedToken && storedUser) {
        const u = JSON.parse(storedUser);
        if (u.language) return normalizeLangCode(u.language);
      }
      // If someone explicitly set a language during current session, respect it
      const explicitLang = sessionStorage.getItem("retailmind_active_lang");
      if (explicitLang) return normalizeLangCode(explicitLang);
    } catch (e) {
      console.warn("Could not read initial language:", e);
    }
    // Default is strictly English ('en') for first-time visitors & unauthenticated screens
    return "en";
  });

  // Switch active language, persist to localStorage and sync to database if logged in
  const setLanguage = async (newLang) => {
    const normalized = normalizeLangCode(newLang);
    setLanguageState(normalized);
    try {
      sessionStorage.setItem("retailmind_active_lang", normalized);
      localStorage.setItem("retailmind_language", normalized);
      const storedToken = localStorage.getItem("retailmind_token");
      if (storedToken) {
        // Also update stored user json
        const storedUser = localStorage.getItem("retailmind_user");
        if (storedUser) {
          const u = JSON.parse(storedUser);
          u.language = normalized;
          localStorage.setItem("retailmind_user", JSON.stringify(u));
        }
        // Async update to backend (fire and don't block UI)
        updateUserLanguage(normalized).catch((err) => {
          console.warn("Could not sync language to backend:", err.message);
        });
      }
    } catch (e) {
      console.error("Failed to persist language:", e);
    }
  };

  // Translation helper function with automatic English fallback
  const t = (key, fallback = "") => {
    if (!key) return "";
    const currentDict = translations[language] || translations.en;
    if (currentDict && currentDict[key]) {
      return currentDict[key];
    }
    // Fallback to English
    if (translations.en && translations.en[key]) {
      return translations.en[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
        currentLangMeta:
          SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
          SUPPORTED_LANGUAGES[0],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
