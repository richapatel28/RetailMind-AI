import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ToastProvider } from "./components/Toast";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import VoiceSale from "./pages/VoiceSale";
import Invoice from "./pages/Invoice";
import Reconciliation from "./pages/Reconciliation";
import Inventory from "./pages/Inventory";
import SalesHistory from "./pages/SalesHistory";
import StoreCopilot from "./pages/StoreCopilot";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ToastProvider>
            <Routes>
            {/* Root redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected SaaS Layout */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/voice-sale" element={<VoiceSale />} />
              <Route path="/invoice" element={<Invoice />} />
              <Route path="/reconciliation" element={<Reconciliation />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<SalesHistory />} />
              <Route path="/copilot" element={<StoreCopilot />} />
            </Route>

            {/* Fallback — unknown routes go to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  </BrowserRouter>
);
}

export default App;
