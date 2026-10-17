import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Phone,
  Store,
  MapPin,
  Globe,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Check
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { registerUser } from "../services/authApi";
import Logo from "../components/Logo";

export const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { language, setLanguage, supportedLanguages, t } = useLanguage();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Account
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",

    // Step 2: Store
    store_name: "",
    business_type: "Grocery / Kirana",
    location: "",
    currency: "INR",

    // Step 3: Preferred Language — Default strictly English
    language: "en",
    voice_language: "en",
    ai_preference: "Standard",
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) return "Full name is required";
    if (!formData.email.trim()) return "Email address is required";
    if (!formData.password) return "Password is required";
    if (formData.password.length < 6) return "Password must be at least 6 characters";
    if (formData.password !== formData.confirmPassword) return "Passwords do not match";
    return null;
  };

  const validateStep2 = () => {
    if (!formData.store_name.trim()) return "Shop or Business name is required";
    if (!formData.location.trim()) return "Store location / city is required";
    return null;
  };

  const handleNext = () => {
    setError("");
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    setError("");
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || null,
        store_name: formData.store_name,
        business_type: formData.business_type,
        location: formData.location,
        currency: formData.currency,
        language: formData.language,
        voice_language: formData.voice_language || formData.language,
        ai_preference: formData.ai_preference,
      };

      const res = await registerUser(payload);

      // Auto login with created credentials
      if (res.token && res.user) {
        localStorage.setItem("retailmind_token", res.token);
        localStorage.setItem("retailmind_user", JSON.stringify(res.user));
        if (formData.language) {
          await setLanguage(formData.language);
        }
        await login(formData.email, formData.password);
      } else {
        if (formData.language) {
          await setLanguage(formData.language);
        }
        await login(formData.email, formData.password);
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.message || "Failed to create your store. Please check your details."
      );
    } finally {
      setLoading(false);
    }
  };

  const businessTypes = [
    { value: "Grocery / Kirana", label: "Grocery / Kirana Store" },
    { value: "Supermarket", label: "Supermarket / Provision Store" },
    { value: "Pharmacy", label: "Pharmacy & Medical Store" },
    { value: "Clothing / Fashion", label: "Clothing & Garments" },
    { value: "Electronics", label: "Electronics & Mobile" },
    { value: "General Retail", label: "General Retail Store" },
  ];

  const languageOptions = [
    { code: "en", name: "English", native: "English", flag: "🇬🇧" },
    { code: "gu", name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
    { code: "hi", name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
    { code: "mr", name: "Marathi", native: "मराठी", flag: "🇮🇳" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-primary-500 selection:text-white">
      {/* Subtle Language Selector (Top Right, defaults strictly to English) */}
      <div className="absolute top-6 right-6 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
        >
          {supportedLanguages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.native}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Header with Logo */}
        <div className="flex flex-col items-center text-center">
          <Logo size="lg" showTagline={false} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
            {t("register.createStore", "Create your store")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Set up your shop in a few simple steps.
          </p>

          {/* Simple Clean Step Progress Bar */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 my-5 w-full">
            {[
              { num: 1, label: t("register.stepAccount", "Account") },
              { num: 2, label: t("register.stepStore", "Store") },
              { num: 3, label: t("register.stepPreferences", "Language") },
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                {idx > 0 && (
                  <div
                    className={`w-8 sm:w-12 h-0.5 transition-colors ${
                      step >= s.num ? "bg-primary-600" : "bg-slate-200"
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < step) setStep(s.num);
                    else if (s.num === 2 && !validateStep1()) setStep(2);
                  }}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step === s.num
                        ? "bg-primary-600 text-white shadow-xs"
                        : step > s.num
                        ? "bg-primary-100 text-primary-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {step > s.num ? "✓" : s.num}
                  </div>
                  <span
                    className={`text-xs ${
                      step === s.num
                        ? "text-slate-900 font-bold"
                        : step > s.num
                        ? "text-slate-600 font-medium"
                        : "text-slate-400 font-medium"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Clean Subtle Form Card */}
        <div className="bg-white py-8 px-6 shadow-xs border border-slate-200 rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error}</div>
            </div>
          )}

          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            {/* STEP 1: OWNER ACCOUNT */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="owner@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mobile Phone (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => handleChange("confirmPassword", e.target.value)}
                        placeholder="Re-enter"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: STORE PROFILE */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store / Shop Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Store className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.store_name}
                      onChange={(e) => handleChange("store_name", e.target.value)}
                      placeholder="e.g. Patel General Store"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Business Category
                  </label>
                  <select
                    value={formData.business_type}
                    onChange={(e) => handleChange("business_type", e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {businessTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    City / Location *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => handleChange("location", e.target.value)}
                      placeholder="e.g. Ahmedabad, Gujarat"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Store Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 3: PREFERRED LANGUAGE */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select Your Preferred Language
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Your dashboard and reports will display in this language.
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    {languageOptions.map((lang) => {
                      const isSelected = formData.language === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            handleChange("language", lang.code);
                            handleChange("voice_language", lang.code);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                            isSelected
                              ? "bg-primary-50 border-primary-500 text-primary-900 shadow-xs"
                              : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">{lang.flag}</span>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{lang.native}</div>
                              <div className="text-[10px] text-slate-500">{lang.name}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center flex-shrink-0">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t("register.back", "Back")}</span>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Back to Sign in
                </Link>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ml-auto"
                >
                  <span>{t("register.next", "Continue")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-60 ml-auto"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Store...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Existing Store Link */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 hover:underline">
            Sign in to your store
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
