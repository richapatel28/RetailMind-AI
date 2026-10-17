const { extractPdfText } = require("../services/pdfStatementParser");

async function testPdfExtraction(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required"
      });
    }

    if (!req.file.originalname.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({
        message: "Only PDF files are allowed"
      });
    }

    const result = await extractPdfText(req.file.buffer);

    return res.json({
      message: "PDF extracted successfully",
      filename: req.file.originalname,
      text_length: result.text.length,
      text: result.text
    });

  } catch (error) {
    console.error("PDF EXTRACTION ERROR:", error);

    return res.status(500).json({
      message: "Failed to extract PDF",
      error: error.message
    });
  }
}

module.exports = {
  testPdfExtraction
};