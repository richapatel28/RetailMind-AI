import api from "./api";

/**
 * Runs an autonomous agent task with ReAct reasoning loop.
 * @param {string} task "restock" | "credit_recovery"
 */
export const runAgentTask = async (task = "restock") => {
  const response = await api.post("/ai/agent/run", { task });
  return response.data;
};

/**
 * Approves a proposed agent action (human-in-the-loop).
 * @param {object} payload
 */
export const approveAgentAction = async (payload) => {
  const response = await api.post("/ai/agent/approve", payload);
  return response.data;
};
