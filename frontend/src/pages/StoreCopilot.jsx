import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Mic,
  Square,
  RefreshCw,
  AlertCircle,
  User,
  Bot
} from "lucide-react";
import { askCopilot } from "../services/copilotApi";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

// Localized sample questions for quick asking in all 4 languages
const sampleQuestionsByLang = {
  en: [
    "How were my sales today?",
    "Which products are running low?",
    "Show recent supplier purchases",
    "Who has outstanding credit?"
  ],
  hi: [
    "आज मेरी कुल बिक्री कैसी रही?",
    "किन उत्पादों का स्टॉक कम है?",
    "हाल की सप्लायर खरीदारी दिखाएं",
    "किस ग्राहक का उधार बाकी है?"
  ],
  mr: [
    "आज माझी एकूण विक्री कशी झाली?",
    "कोणत्या उत्पादनांचा साठा कमी आहे?",
    "अलीकडील पुरवठादार खरेदी दाखवा",
    "कोणत्या ग्राहकाची उधारी बाकी आहे?"
  ],
  gu: [
    "આજે મારું વેચાણ કેટલું થયું?",
    "કઈ વસ્તુઓનો સ્ટોક ઓછો છે?",
    "છેલ્લા સપ્લાયર બિલ બતાવો",
    "કોનું ઉધાર ખાતું બાકી છે?"
  ]
};

// Helper to render markdown text with bolding and responsive HTML tables
const renderFormattedContent = (content) => {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks = [];
  let currentTable = null;
  let currentText = [];

  const flushText = () => {
    if (currentText.length > 0) {
      const textBlock = currentText.join("\n").trim();
      if (textBlock) {
        blocks.push({ type: "text", content: textBlock });
      }
      currentText = [];
    }
  };

  const flushTable = () => {
    if (currentTable && currentTable.length > 0) {
      blocks.push({ type: "table", rows: currentTable });
      currentTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      flushText();
      if (!currentTable) currentTable = [];
      // Skip separator rows like |:---|:---:|
      if (!line.includes("---")) {
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim());
        currentTable.push(cells);
      }
    } else {
      flushTable();
      currentText.push(lines[i]);
    }
  }
  flushText();
  flushTable();

  const renderInline = (str) => {
    if (!str) return "";
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={pIdx} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-2.5">
      {blocks.map((block, bIdx) => {
        if (block.type === "table") {
          const headerRow = block.rows[0] || [];
          const bodyRows = block.rows.slice(1);
          return (
            <div
              key={bIdx}
              className="overflow-x-auto my-2 rounded-xl border border-slate-200/80 shadow-2xs bg-white"
            >
              <table className="min-w-full text-xs text-left divide-y divide-slate-200">
                <thead className="bg-primary-50/90 text-primary-950 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    {headerRow.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="px-3.5 py-2.5 whitespace-nowrap first:rounded-tl-xl last:rounded-tr-xl border-r border-slate-200/60 last:border-r-0"
                      >
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bodyRows.map((row, rIdx) => {
                    const isTotalRow = row.some(
                      (cell) =>
                        cell.toLowerCase().includes("કુલ") ||
                        cell.toLowerCase().includes("total") ||
                        cell.toLowerCase().includes("कुल") ||
                        cell.toLowerCase().includes("एकूण")
                    );
                    return (
                      <tr
                        key={rIdx}
                        className={`transition-colors ${
                          isTotalRow
                            ? "bg-amber-50/90 font-bold text-slate-900 border-t-2 border-amber-300"
                            : rIdx % 2 === 0
                            ? "bg-white hover:bg-slate-50/80"
                            : "bg-slate-50/50 hover:bg-slate-50/80"
                        }`}
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3.5 py-2 whitespace-nowrap text-slate-700 border-r border-slate-100 last:border-r-0 ${
                              isTotalRow ? "font-bold text-amber-950" : ""
                            }`}
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p
            key={bIdx}
            className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal"
          >
            {renderInline(block.content)}
          </p>
        );
      })}
    </div>
  );
};

export const StoreCopilot = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "bot",
      text: t(
        "copilot.welcomeDesc",
        "Hello! How can I help you today? You can ask about your store sales, profit, low stock items, supplier purchases, or customer balances."
      ),
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Update welcome message dynamically if user switches language before asking
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [
          {
            ...prev[0],
            text: t(
              "copilot.welcomeDesc",
              "Hello! How can I help you today? You can ask about your store sales, profit, low stock items, supplier purchases, or customer balances."
            )
          }
        ];
      }
      return prev;
    });
  }, [language, t]);

  // Web Speech API for voice queries
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Lock speech recognition language to user's selected store language
      const langCodes = {
        en: "en-IN",
        hi: "hi-IN",
        mr: "mr-IN",
        gu: "gu-IN"
      };
      recognition.lang = langCodes[language] || "en-IN";

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setListening(false);
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      addToast("Speech recognition is not supported in this browser.", "warning");
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (err) {
        console.error("Mic start error:", err);
      }
    }
  };

  const handleSend = async (questionText = null) => {
    const query = (questionText || inputText).trim();
    if (!query || loading) return;

    // Add user message
    const userMsg = {
      id: String(Date.now()),
      sender: "user",
      text: query,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const result = await askCopilot(query, language);
      const botMsg = {
        id: String(Date.now() + 1),
        sender: "bot",
        text: result.answer,
        sources: result.sources || [],
        confidence: result.confidence || 0,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Copilot error:", err);
      const errorMsg = {
        id: String(Date.now() + 1),
        sender: "bot",
        text: "Sorry, I encountered an issue retrieving store records. Please ensure your backend and AI services are running.",
        sources: [],
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: "welcome",
        sender: "bot",
        text: t(
          "copilot.welcomeDesc",
          "Hello! How can I help you today? You can ask about your store sales, profit, low stock items, supplier purchases, or customer balances."
        ),
        timestamp: new Date()
      }
    ]);
  };

  const activeQuestions =
    sampleQuestionsByLang[language] || sampleQuestionsByLang.en;

  return (
    <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Top Action Controls */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3 h-3 text-slate-400" />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Suggested Questions Pills */}
      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
          {t("copilot.sampleQueriesLabel", "Suggested Questions (Click to Ask):")}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {activeQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white hover:bg-primary-50 text-slate-700 hover:text-primary-700 border border-slate-200 hover:border-primary-300 transition-all shadow-2xs text-left"
            >
              💬 {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 overflow-y-auto space-y-4 shadow-sm">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender === "bot" && (
              <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-2xl rounded-2xl p-4 space-y-2 ${
                msg.sender === "user"
                  ? "bg-primary-600 text-white rounded-tr-xs shadow-sm"
                  : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs"
              }`}
            >
              {msg.sender === "user" ? (
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal">
                  {msg.text}
                </p>
              ) : (
                renderFormattedContent(msg.text)
              )}

              <div
                className={`text-[10px] flex items-center justify-end gap-1 ${
                  msg.sender === "user" ? "text-primary-100" : "text-slate-400"
                }`}
              >
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
            </div>

            {msg.sender === "user" && (
              <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-600" />
              <span>
                {t("copilot.thinking", "Retrieving grounded store records & reasoning...")}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex-shrink-0"
      >
        <button
          type="button"
          onClick={toggleListening}
          title={listening ? "Stop Recording" : "Speak your question"}
          className={`p-2.5 rounded-xl transition-all ${
            listening
              ? "bg-rose-500 text-white animate-pulse"
              : "text-slate-500 hover:text-primary-600 hover:bg-slate-100"
          }`}
        >
          {listening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            listening
              ? "Listening to speech..."
              : t(
                  "copilot.askPlaceholder",
                  "Ask anything about your store records (e.g. Which supplier gave cheapest price for Maggi?)..."
                )
          }
          disabled={loading}
          className="flex-1 text-xs sm:text-sm bg-transparent border-none focus:outline-none placeholder-slate-400 px-2"
        />

        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("copilot.send", "Ask Copilot")}</span>
        </button>
      </form>
    </div>
  );
};

export default StoreCopilot;
