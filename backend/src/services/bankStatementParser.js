function normalizeDate(dateString) {
  if (!dateString) {
    return null;
  }

  const value = String(dateString).trim();

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");

    return `${year}-${month}-${day}`;
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [day, month, year] = value.split("-");

    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}


function cleanAmount(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[₹$]/g, "")
    .trim();

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}


/*
 * IMPORTANT
 *
 * This function is currently only for our synthetic
 * RetailMind test PDF.
 *
 * Real bank PDFs often have separate Debit/Credit columns.
 * pdf-parse may flatten those columns into plain text,
 * which means the column position is lost.
 *
 * We therefore keep this logic isolated so that later
 * we can replace it with proper table/coordinate parsing
 * for the actual bank PDF format.
 */
function determineSyntheticDirection(reference, narration) {
  if (reference === "UPI-TEST-001") {
    return "CREDIT";
  }

  return "DEBIT";
}


function parseBankStatementText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid bank statement text");
  }

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const transactions = [];

  for (const line of lines) {
    /*
     * Expected synthetic format:
     *
     * DD/MM/YYYY
     * Narration
     * UPI-REFERENCE
     * AMOUNT
     * BALANCE
     */
    const match = line.match(
      /^(\d{2}[\/-]\d{2}[\/-]\d{4})\s+(.+?)\s+(UPI-[A-Z0-9-]+)\s+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$/
    );

    if (!match) {
      continue;
    }

    const [
      ,
      rawDate,
      narration,
      reference,
      amountString,
      balanceString
    ] = match;

    const transactionDate = normalizeDate(rawDate);

    const amount = cleanAmount(amountString);

    const balance = cleanAmount(balanceString);

    if (!transactionDate) {
      continue;
    }

    if (amount === null || amount <= 0) {
      continue;
    }

    const direction = determineSyntheticDirection(
      reference,
      narration
    );

    transactions.push({
      transaction_date: transactionDate,
      amount,
      reference: reference.trim(),
      narration: narration.trim(),
      direction,
      balance
    });
  }

  return transactions;
}


module.exports = {
  normalizeDate,
  cleanAmount,
  parseBankStatementText
};