const {
  extractPdfText
} = require("../services/pdfStatementParser");

const {
  parseBankStatementText
} = require("../services/bankStatementParser");


async function parsePdfBankStatement(req, res) {
  try {

    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required"
      });
    }

    if (
      !req.file.originalname
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return res.status(400).json({
        message: "Only PDF files are allowed"
      });
    }

    // --------------------------------------------
    // STEP 1: Extract PDF text
    // --------------------------------------------

    const extracted = await extractPdfText(
      req.file.buffer
    );

    if (!extracted.text.trim()) {
      return res.status(400).json({
        message:
          "No readable text found in PDF. The PDF may be scanned and require OCR."
      });
    }

    // --------------------------------------------
    // STEP 2: Parse transactions
    // --------------------------------------------

    const transactions = parseBankStatementText(
      extracted.text
    );

    return res.status(200).json({
      message: "Bank statement parsed successfully",

      filename: req.file.originalname,

      text_length: extracted.text.length,

      transaction_count: transactions.length,

      transactions
    });

  } catch (error) {

    console.error(
      "PDF BANK STATEMENT PARSE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Failed to parse bank statement",
      error: error.message
    });
  }
}


module.exports = {
  parsePdfBankStatement
};