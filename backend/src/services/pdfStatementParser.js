const { PDFParse } = require("pdf-parse");

async function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid PDF buffer");
  }

  const parser = new PDFParse({
    data: buffer
  });

  try {
    const result = await parser.getText();

    return {
      text: result.text || "",
      pages: result.pages || []
    };
  } finally {
    await parser.destroy();
  }
}

module.exports = {
  extractPdfText
};

//This follows the current pdf-parse API: create PDFParse with the PDF data, call getText(), then destroy the parser.