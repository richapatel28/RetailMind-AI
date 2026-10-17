import api from "./api";

/**
 * Uploads an audio recording or file to be parsed by Whisper STT and AI classifier.
 * @param {File|Blob} file - The audio file or blob
 * @param {string} language - Optional language hint ('en', 'hi', 'mr')
 */
export const processVoiceAudio = async (file, language = "en") => {
  const formData = new FormData();
  const filename = file.name || "voice_recording.webm";
  formData.append("file", file, filename);
  if (language) {
    formData.append("language", language);
  }

  const response = await api.post("/ai/voice/process", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

/**
 * Sends a speech text phrase directly to be analyzed by AI classifier and product matcher.
 * @param {string} text - Voice transcript text
 * @param {string} language - Optional language hint ('en', 'hi', 'mr')
 */
export const processVoiceText = async (text, language = "en") => {
  const response = await api.post("/ai/voice/process", {
    text,
    language,
  });
  return response.data;
};

/**
 * Confirms a voice sale transaction and commits changes to PostgreSQL.
 * @param {Object} payload - { event_id, items: [{ product_id, quantity, selling_price }], payment_mode, payment_amount }
 */
export const confirmVoiceSale = async (payload) => {
  const response = await api.post("/ai/voice/confirm", payload);
  return response.data;
};
