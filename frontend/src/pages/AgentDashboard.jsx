import React, { useState } from "react";
import {
  Brain,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Package,
  FileText,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  DollarSign,
  UserCheck,
  Check,
  X
} from "lucide-react";
import { runAgentTask, approveAgentAction } from "../services/agentApi";
import { useLanguage } from "../context/LanguageContext";
import { useToast } from "../components/Toast";

export const AgentDashboard = () => {
  const { t } = useLanguage();
  const { addToast } = useToast();

  const [selectedTask, setSelectedTask] = useState("restock");
  const [running, setRunning] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  const [approvingIdx, setApprovingIdx] = useState(null);
  const [approvedActions, setApprovedActions] = useState({});

  const handleRunAgent = async () => {
    setRunning(true);
    setAgentResult(null);
    setApprovedActions({});
    try {
      const data = await runAgentTask(selectedTask);
      setAgentResult(data);
      addToast("Agent completed reasoning cycle!", "success");
    } catch (err) {
      console.error("Agent error:", err);
      addToast(err.response?.data?.message || "Failed to execute agent reasoning cycle.", "error");
    } finally {
      setRunning(false);
    }
  };

  const handleApproveAction = async (action, idx) => {
    setApprovingIdx(idx);
    try {
      const payload = {
        action_type: action.action_type,
        product_id: action.product_id,
        quantity: action.recommended_quantity
      };
      const res = await approveAgentAction(payload);
      setApprovedActions((prev) => ({ ...prev, [idx]: true }));
      addToast(res.message || t("agent.approvedSuccess", "Action approved and executed!"), "success");
    } catch (err) {
      console.error("Approve error:", err);
      addToast(err.response?.data?.message || "Failed to approve action.", "error");
    } finally {
      setApprovingIdx(null);
    }
  };

  const handleDismissAction = (idx) => {
    setApprovedActions((prev) => ({ ...prev, [idx]: "dismissed" }));
    addToast("Action dismissed.", "info");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">


      {/* Goal Selector Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
          {t("agent.selectGoal", "What would you like to check?")}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedTask("restock")}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
              selectedTask === "restock"
                ? "border-primary-500 bg-primary-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-slate-900">
                {t("agent.goalRestock", "Low Stock & Reorder Suggestions")}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Find items running low and suggest the best supplier to reorder from based on past invoices.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTask("credit_recovery")}
            className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${
              selectedTask === "credit_recovery"
                ? "border-primary-500 bg-primary-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-slate-900">
                {t("agent.goalCredit", "Overdue Credit (Udhaar) Summary")}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Review customers with outstanding balances and get a prioritised follow-up list.
              </p>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleRunAgent}
            disabled={running}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            {running ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>
              {running
                ? t("agent.running", "Analysing your store data...")
                : t("agent.runAgent", "Run Analysis")}
            </span>
          </button>
        </div>
      </div>

      {/* AGENT RESULTS DISPLAY */}
      {agentResult && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary Banner */}
          <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{agentResult.goal}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  {agentResult.status}
                </span>
              </div>
              <p className="text-xs text-indigo-950 font-medium mt-1">
                {agentResult.summary}
              </p>
            </div>
          </div>

          {/* Analysis Steps – plain language */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-600" />
              <span>{t("agent.analysisSteps", "What the assistant checked")}</span>
            </h3>

            <div className="space-y-3 border-l-2 border-primary-100 pl-4 ml-2">
              {agentResult.trace.map((step) => (
                <div key={step.step} className="space-y-1.5 relative">
                  <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-primary-400 border-2 border-white shadow-xs" />

                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Step {step.step}
                  </span>

                  {/* Thought → show as plain observation text */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                    {step.thought}
                  </div>

                  {/* Observation (environment fact) */}
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                    <span className="font-semibold text-emerald-700 block mb-0.5">Finding:</span>
                    {step.observation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proposed Action Cards with Human-in-the-loop Approval */}
          {agentResult.proposed_actions && agentResult.proposed_actions.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    {t("agent.proposedActions", "Suggested Actions — Review & Apply")}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Check each suggestion and approve the ones you'd like to apply to your store.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {agentResult.proposed_actions.length} Actions
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agentResult.proposed_actions.map((act, idx) => {
                  const isApproved = approvedActions[idx] === true;
                  const isDismissed = approvedActions[idx] === "dismissed";
                  const isBusy = approvingIdx === idx;

                  if (isDismissed) {
                    return (
                      <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400 italic">
                        Action #{idx + 1} dismissed.
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isApproved
                          ? "bg-emerald-50/70 border-emerald-300"
                          : "bg-white border-slate-200 shadow-2xs hover:border-primary-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-50 text-primary-700 border border-primary-200">
                          {act.action_type || "PROPOSAL"}
                        </span>
                        {act.severity && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              act.severity === "CRITICAL"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {act.severity}
                          </span>
                        )}
                      </div>

                      {act.action_type === "PURCHASE_ORDER_DRAFT" ? (
                        <div className="space-y-1.5 text-xs text-slate-700">
                          <div className="font-bold text-slate-900 text-sm">{act.product_name}</div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Current Stock:</span>
                            <span className="font-semibold text-rose-600">{act.current_stock} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cheapest Supplier:</span>
                            <span className="font-semibold text-slate-800">{act.supplier_name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Recommended Reorder:</span>
                            <span className="font-bold text-primary-700">{act.recommended_quantity} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Wholesale Unit Cost:</span>
                            <span className="font-semibold">₹{Number(act.unit_cost).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-900">
                            <span>Total Estimated Investment:</span>
                            <span className="text-emerald-700">₹{Number(act.total_cost).toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-xs text-slate-700">
                          <div className="font-bold text-slate-900 text-sm">{act.customer_name}</div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Bill Number:</span>
                            <span className="font-mono font-bold">{act.bill_number}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Overdue Balance:</span>
                            <span className="font-black text-rose-600">₹{Number(act.amount).toFixed(2)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 pt-1 italic">{act.suggested_action}</p>
                        </div>
                      )}

                      {/* Approval Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Approved & Executed</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDismissAction(idx)}
                              disabled={isBusy}
                              className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-semibold"
                            >
                              {t("agent.dismissBtn", "Dismiss")}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApproveAction(act, idx)}
                              disabled={isBusy}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                            >
                              {isBusy ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{t("agent.approveBtn", "Approve & Execute")}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;
