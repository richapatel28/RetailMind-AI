import api from "./api";

/**
 * Queries the Store Intelligence Copilot using local RAG over store documents.
 * @param {string} query Natural language question
 * @param {string} language Language code ('en', 'hi', 'mr', 'gu')
 */
export const askCopilot = async (query, language = "en") => {
  const response = await api.post("/ai/copilot/query", {
    query,
    language
  });
  return response.data;
};
