import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Mic,
  FileText,
  CreditCard,
  Package,
  Receipt,
  Bot,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Logo from "./Logo";

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navGroups = [
    {
      title: "OVERVIEW",
      items: [
        {
          to: "/dashboard",
          icon: LayoutDashboard,
          label: t("nav.dashboard", "Dashboard"),
        },
      ],
    },
    {
      title: "OPERATIONS",
      items: [
        {
          to: "/voice-sale",
          icon: Mic,
          label: t("nav.voiceSale", "Voice Sale"),
        },
        {
          to: "/sales",
          icon: Receipt,
          label: t("nav.sales", "Billing & Sales"),
        },
        {
          to: "/invoice",
          icon: FileText,
          label: t("nav.invoices", "Supplier Bills"),
        },
        {
          to: "/inventory",
          icon: Package,
          label: t("nav.inventory", "Inventory & Stock"),
        },
        {
          to: "/reconciliation",
          icon: CreditCard,
          label: t("nav.reconciliation", "Bank & UPI Match"),
        },
      ],
    },
    {
      title: "STORE HELP",
      items: [
        {
          to: "/copilot",
          icon: Bot,
          label: t("nav.copilot", "AI Store Help"),
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Top: Logo & Grouped Navigation */}
        <div className="flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 flex items-center px-5 border-b border-slate-100">
            <Logo size="md" showTagline={false} />
          </div>

          {/* Grouped Navigation Links */}
          <div className="px-3 py-3 space-y-4">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>

                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
                          isActive
                            ? "bg-primary-50/80 text-primary-700 font-semibold shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className={`w-4 h-4 flex-shrink-0 transition-colors ${
                                isActive ? "text-primary-600" : "text-slate-400 group-hover:text-slate-600"
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.tag && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                isActive
                                  ? "bg-primary-100 text-primary-700"
                                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70"
                              }`}
                            >
                              {item.tag}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: User Profile & Logout */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100/70 transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary-600 text-white font-bold flex items-center justify-center text-xs shadow-xs flex-shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : "O"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 truncate" title={user?.name}>
                  {user?.name || t("nav.role", "Shop Owner")}
                </div>
                <div className="text-[11px] text-slate-400 truncate" title={user?.email}>
                  {user?.email || "owner@retailmind.com"}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title={t("nav.logout", "Sign out")}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
