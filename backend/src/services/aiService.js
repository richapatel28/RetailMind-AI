const axios = require("axios");


const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL;


/*
|--------------------------------------------------------------------------
| Product Matching
|--------------------------------------------------------------------------
*/

async function matchProduct(
  productName
) {
  try {
    const response =
      await axios.post(
        `${AI_SERVICE_URL}/ai/product/match`,

        {
          product_name:
            productName
        },

        {
          timeout: 10000
        }
      );


    return response.data;


  } catch (error) {
    console.error(
      "Product Matching AI Service Error:",
      error.message
    );


    throw new Error(
      "Product matching service is unavailable"
    );
  }
}


/*
|--------------------------------------------------------------------------
| Payment Reconciliation
|--------------------------------------------------------------------------
*/

async function reconcilePayment(
  transaction,
  userId
) {
  try {
    const response =
      await axios.post(
        `${AI_SERVICE_URL}/ai/reconciliation/match`,

        transaction,

        {
          params: {
            user_id: userId
          },

          timeout: 10000
        }
      );


    return response.data;


  } catch (error) {
    console.error(
      "Payment Reconciliation AI Service Error:",
      error.message
    );


    throw new Error(
      "Payment reconciliation service is unavailable"
    );
  }
}


/*
|--------------------------------------------------------------------------
| Voice Analysis (Speech-to-Text + NLP Extraction)
|--------------------------------------------------------------------------
*/

async function parseVoice(
  audioBuffer,
  originalname,
  mimeType,
  language = null
) {
  try {
    const formData = new FormData();
    const blob = new Blob(
      [audioBuffer],
      { type: mimeType || "audio/m4a" }
    );

    formData.append(
      "file",
      blob,
      originalname || "recording.m4a"
    );

    if (language) {
      formData.append(
        "language",
        language
      );
    }

    const response =
      await axios.post(
        `${AI_SERVICE_URL}/ai/voice/parse`,
        formData,
        {
          timeout: 60000
        }
      );

    return response.data;

  } catch (error) {
    console.error(
      "Voice AI Service Error:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.detail ||
      "Voice analysis service is unavailable"
    );
  }
}

async function parseVoiceText(text, language = null) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/voice/parse-text`,
      {
        text,
        language: language || undefined,
      },
      {
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Voice Text AI Service Error:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.detail ||
      "Voice text analysis service is unavailable"
    );
  }
}



/*
|--------------------------------------------------------------------------
| Invoice Extraction (Gemini Multimodal Vision + Math Validation)
|--------------------------------------------------------------------------
*/

async function extractInvoice(
  fileBuffer,
  originalname,
  mimeType
) {
  try {
    const formData = new FormData();
    const blob = new Blob(
      [fileBuffer],
      { type: mimeType || "image/png" }
    );

    formData.append(
      "file",
      blob,
      originalname || "invoice.png"
    );

    const response =
      await axios.post(
        `${AI_SERVICE_URL}/ai/invoice/extract`,
        formData,
        {
          timeout: 60000
        }
      );

    return response.data;

  } catch (error) {
    console.error(
      "Invoice AI Service Error:",
      error.response?.data || error.message
    );

    throw new Error(
      error.response?.data?.detail ||
      "Invoice extraction service is unavailable"
    );
  }
}

async function queryStoreCopilot(query, storeData, language = "en", topK = 4) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/copilot/query`,
      {
        query,
        store_data: storeData,
        language,
        top_k: topK
      },
      {
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Copilot RAG AI Service Error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.detail ||
      "Store Copilot RAG service is unavailable"
    );
  }
}

async function runAgentTask(task = "restock", storeData = {}) {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/ai/agent/run`,
      {
        task,
        store_data: storeData
      },
      {
        timeout: 30000
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      "Agent ReAct AI Service Error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.detail ||
      "Autonomous Agent service is unavailable"
    );
  }
}

module.exports = {
  matchProduct,
  reconcilePayment,
  parseVoice,
  parseVoiceText,
  extractInvoice,
  queryStoreCopilot,
  runAgentTask
};