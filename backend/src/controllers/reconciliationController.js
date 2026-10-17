const pool = require("../config/db");

const {
  extractPdfText
} = require("../services/pdfStatementParser");

const {
  parseBankStatementText
} = require("../services/bankStatementParser");

const {
  reconcilePayment
} = require("../services/aiService");

const { parse } = require("csv-parse/sync");


/*
|--------------------------------------------------------------------------
| Helper: Validate AI candidate ownership
|--------------------------------------------------------------------------
*/

async function validateCandidateOwnership(
  client,
  userId,
  direction,
  candidate
) {
  if (!candidate) {
    return false;
  }

  if (direction === "CREDIT") {
    if (!candidate.payment_id || !candidate.sale_id) {
      return false;
    }

    const result = await client.query(
      `
      SELECT
        p.id AS payment_id,
        s.id AS sale_id
      FROM payments p
      INNER JOIN sales s
        ON s.id = p.sale_id
      WHERE
        p.id = $1
        AND s.id = $2
        AND p.user_id = $3
        AND s.user_id = $3
      LIMIT 1
      `,
      [
        candidate.payment_id,
        candidate.sale_id,
        userId
      ]
    );

    return result.rowCount === 1;
  }


  if (direction === "DEBIT") {
    if (
      !candidate.supplier_payment_id ||
      !candidate.purchase_id
    ) {
      return false;
    }

    const result = await client.query(
      `
      SELECT
        sp.id AS supplier_payment_id,
        p.id AS purchase_id
      FROM supplier_payments sp
      INNER JOIN purchases p
        ON p.id = sp.purchase_id
      WHERE
        sp.id = $1
        AND p.id = $2
        AND sp.user_id = $3
        AND p.user_id = $3
      LIMIT 1
      `,
      [
        candidate.supplier_payment_id,
        candidate.purchase_id,
        userId
      ]
    );

    return result.rowCount === 1;
  }


  return false;
}


/*
|--------------------------------------------------------------------------
| Helper: Check whether best match exists inside candidates
|--------------------------------------------------------------------------
*/

function candidateExists(
  candidates,
  bestMatch,
  direction
) {
  if (
    !Array.isArray(candidates) ||
    !bestMatch
  ) {
    return false;
  }

  return candidates.some(candidate => {
    if (direction === "CREDIT") {
      return (
        Number(candidate.payment_id) ===
          Number(bestMatch.payment_id) &&
        Number(candidate.sale_id) ===
          Number(bestMatch.sale_id)
      );
    }

    if (direction === "DEBIT") {
      return (
        Number(candidate.supplier_payment_id) ===
          Number(bestMatch.supplier_payment_id) &&
        Number(candidate.purchase_id) ===
          Number(bestMatch.purchase_id)
      );
    }

    return false;
  });
}


/*
|--------------------------------------------------------------------------
| CSV Upload
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Helper: Fetch Store Financial Overview from PostgreSQL
|--------------------------------------------------------------------------
*/

async function getStoreFinancialOverview(userId) {
  // Monthly
  const monthlySalesResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM sales
     WHERE user_id = $1
       AND (sale_date >= date_trunc('month', CURRENT_DATE) OR created_at >= date_trunc('month', CURRENT_DATE))`,
    [userId]
  );
  const monthlyPurchasesResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM purchases
     WHERE user_id = $1
       AND (purchase_date >= date_trunc('month', CURRENT_DATE) OR created_at >= date_trunc('month', CURRENT_DATE))`,
    [userId]
  );
  const monthlyExpensesResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM expenses
     WHERE user_id = $1 AND expense_date >= date_trunc('month', CURRENT_DATE)`,
    [userId]
  ).catch(() => ({ rows: [{ total: 0, count: 0 }] }));

  // Yearly
  const yearlySalesResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM sales
     WHERE user_id = $1
       AND (sale_date >= date_trunc('year', CURRENT_DATE) OR created_at >= date_trunc('year', CURRENT_DATE))`,
    [userId]
  );
  const yearlyPurchasesResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM purchases
     WHERE user_id = $1
       AND (purchase_date >= date_trunc('year', CURRENT_DATE) OR created_at >= date_trunc('year', CURRENT_DATE))`,
    [userId]
  );
  const yearlyExpensesResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM expenses
     WHERE user_id = $1 AND expense_date >= date_trunc('year', CURRENT_DATE)`,
    [userId]
  ).catch(() => ({ rows: [{ total: 0, count: 0 }] }));

  // All-time (fallback if monthly is 0)
  const allSalesResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM sales
     WHERE user_id = $1`,
    [userId]
  );
  const allPurchasesResult = await pool.query(
    `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
     FROM purchases
     WHERE user_id = $1`,
    [userId]
  );

  const mSales = Number(monthlySalesResult.rows[0]?.total || 0);
  const mPurchases = Number(monthlyPurchasesResult.rows[0]?.total || 0);
  const mExpenses = Number(monthlyExpensesResult.rows[0]?.total || 0);

  const ySales = Number(yearlySalesResult.rows[0]?.total || 0);
  const yPurchases = Number(yearlyPurchasesResult.rows[0]?.total || 0);
  const yExpenses = Number(yearlyExpensesResult.rows[0]?.total || 0);

  const allSales = Number(allSalesResult.rows[0]?.total || 0);
  const allPurchases = Number(allPurchasesResult.rows[0]?.total || 0);

  return {
    monthly: {
      total_sales: mSales || allSales,
      total_purchases: mPurchases || allPurchases,
      expenses: mExpenses,
      estimated_profit: (mSales || allSales) - (mPurchases || allPurchases) - mExpenses,
    },
    yearly: {
      total_sales: ySales || allSales,
      total_purchases: yPurchases || allPurchases,
      expenses: yExpenses,
      estimated_profit: (ySales || allSales) - (yPurchases || allPurchases) - yExpenses,
    },
    all_time: {
      total_sales: allSales,
      total_purchases: allPurchases,
      expenses: yExpenses,
      estimated_profit: allSales - allPurchases - yExpenses,
    },
  };
}

async function getFinancialOverviewController(req, res) {
  try {
    const userId = req.user.id;
    const overview = await getStoreFinancialOverview(userId);
    return res.status(200).json({
      message: "Financial overview retrieved successfully",
      financial_overview: overview,
    });
  } catch (error) {
    console.error("FINANCIAL OVERVIEW ERROR:", error);
    return res.status(500).json({
      message: "Failed to retrieve financial overview",
      error: error.message,
    });
  }
}

async function uploadBankStatement(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        message: "Bank statement file is required"
      });
    }

    const filename =
      req.file.originalname || "";

    if (!filename.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({
        message: "Only CSV files are allowed"
      });
    }


    const csvText =
      req.file.buffer.toString("utf-8");


    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      relax_column_count: true,
      trim: true
    });


    if (!records.length) {
      return res.status(400).json({
        message: "CSV contains no transactions"
      });
    }


    const results = [];

    for (let index = 0; index < records.length; index++) {
      const row = records[index];

      try {
        const transactionDate =
          row.transaction_date ||
          row.date ||
          row.Date ||
          row["Transaction Date"];

        const amountValue =
          row.amount ||
          row.Amount ||
          row["Transaction Amount"];

        const reference =
          row.reference ||
          row.Reference ||
          row["Reference"];

        const narration =
          row.narration ||
          row.Narration ||
          row.description ||
          row.Description ||
          row["Transaction Description"] ||
          "";

        const direction =
          (
            row.direction ||
            row.Direction ||
            row.type ||
            row.Type ||
            ""
          )
            .toString()
            .trim()
            .toUpperCase();


        const amount = Number(
          String(amountValue || "")
            .replace(/,/g, "")
            .replace(/[₹$]/g, "")
            .trim()
        );


        if (!transactionDate) {
          results.push({
            row: index + 2,
            status: "ERROR",
            error: "Transaction date is missing"
          });

          continue;
        }


        if (!Number.isFinite(amount) || amount <= 0) {
          results.push({
            row: index + 2,
            status: "ERROR",
            error: "Invalid transaction amount"
          });

          continue;
        }


        if (
          direction !== "CREDIT" &&
          direction !== "DEBIT"
        ) {
          results.push({
            row: index + 2,
            status: "ERROR",
            error:
              "Direction must be CREDIT or DEBIT"
          });

          continue;
        }


        const transaction = {
          transaction_date: transactionDate,
          amount,
          reference:
            reference
              ? String(reference).trim()
              : null,
          narration:
            narration
              ? String(narration).trim()
              : null,
          direction
        };


        const aiResult =
          await reconcilePayment(
            transaction,
            userId
          );


        let finalStatus =
          aiResult.status || "UNMATCHED";

        let bestMatch =
          aiResult.best_match || null;

       let confidence =
  Number(
    aiResult.confidence ??
    aiResult.best_match?.confidence ??
    0
  );

        const candidates =
          Array.isArray(aiResult.candidates)
            ? aiResult.candidates
            : [];


        /*
         * Security validation:
         *
         * AI must not be able to create a cross-owner match.
         */
        if (bestMatch) {
          const ownershipValid =
            await validateCandidateOwnership(
              pool,
              userId,
              direction,
              bestMatch
            );

          const candidateValid =
            candidateExists(
              candidates,
              bestMatch,
              direction
            );

          if (
            !ownershipValid ||
            !candidateValid
          ) {
            bestMatch = null;
            confidence = 0;
            finalStatus =
              "REVIEW_REQUIRED";
          }
        }


        const extractedJson = {
          source: "CSV",
          transaction,
          candidates,
          best_match: bestMatch,
          status: finalStatus
        };


        const eventResult =
          await pool.query(
            `
            INSERT INTO ai_events (
              user_id,
              input_type,
              model,
              confidence,
              extracted_json,
              confirmed,
              selected_product_id
            )
            VALUES (
              $1,
              'PAYMENT_RECONCILIATION',
              'reconciliation-rule-v1',
              $2,
              $3,
              false,
              NULL
            )
            RETURNING id, created_at
            `,
            [
              userId,
              confidence,
              JSON.stringify(extractedJson)
            ]
          );


        results.push({
          row: index + 2,
          event_id:
            eventResult.rows[0].id,
          transaction,
          candidates,
          best_match: bestMatch,
          confidence,
          status: finalStatus
        });


      } catch (error) {
        console.error(
          "CSV ROW RECONCILIATION ERROR:",
          error
        );

        results.push({
          row: index + 2,
          status: "ERROR",
          error: error.message
        });
      }
    }


    const salesMatched = results.filter(
      r => r.status === "MATCHED" && (r.transaction?.direction === "CREDIT" || r.direction === "CREDIT")
    ).length;

    const purchasesMatched = results.filter(
      r => r.status === "MATCHED" && (r.transaction?.direction === "DEBIT" || r.direction === "DEBIT")
    ).length;

    const needsReview = results.filter(
      r => r.status === "REVIEW_REQUIRED" || r.status === "UNMATCHED"
    ).length;

    const financialOverview = await getStoreFinancialOverview(userId);

    const unidentifiedTransactions = results
      .filter(r => r.status === "REVIEW_REQUIRED" || r.status === "UNMATCHED")
      .map(r => {
        const txn = r.transaction || {};
        let dirLabel = "Money In";
        if (txn.direction === "DEBIT" || String(txn.direction).toUpperCase() === "DEBIT") {
          dirLabel = "Money Out";
        } else if (txn.direction === "CREDIT" || String(txn.direction).toUpperCase() === "CREDIT") {
          dirLabel = "Money In";
        } else if (Number(txn.amount) < 0) {
          dirLabel = "Money Out";
        }
        return {
          row: r.row,
          event_id: r.event_id,
          date: txn.transaction_date || "—",
          description: txn.narration || txn.reference || "Bank Transaction",
          reference: txn.reference || "",
          amount: Math.abs(Number(txn.amount || 0)),
          direction: dirLabel,
          status: "Needs Review",
        };
      });

    const summary = {
      transactions_analyzed: results.length,
      sales_matched: salesMatched,
      purchases_matched: purchasesMatched,
      needs_review: needsReview,
      total: results.length,
      matched: salesMatched + purchasesMatched,
      review_required: results.filter(r => r.status === "REVIEW_REQUIRED").length,
      unmatched: results.filter(r => r.status === "UNMATCHED").length,
      errors: results.filter(r => r.status === "ERROR").length,
    };

    return res.status(200).json({
      message: "Bank statement reconciled successfully",
      filename,
      summary,
      financial_overview: financialOverview,
      unidentified_transactions: unidentifiedTransactions,
      results,
    });


  } catch (error) {
    console.error(
      "BANK STATEMENT UPLOAD ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to process bank statement",

      error: error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| PDF Upload + Reconciliation
|--------------------------------------------------------------------------
*/

async function reconcilePdfBankStatement(
  req,
  res
) {
  try {
    const userId = req.user.id;


    if (!req.file) {
      return res.status(400).json({
        message: "PDF file is required"
      });
    }


    const filename =
      req.file.originalname || "";


    if (
      !filename
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      return res.status(400).json({
        message:
          "Only PDF files are allowed"
      });
    }


    /*
     * Step 1:
     * Extract text from PDF
     */

    const extracted =
      await extractPdfText(
        req.file.buffer
      );


    if (
      !extracted.text ||
      !extracted.text.trim()
    ) {
      return res.status(400).json({
        message:
          "No readable text found in PDF. The PDF may be scanned and require OCR."
      });
    }


    /*
     * Step 2:
     * Parse transactions
     */

    const transactions =
      parseBankStatementText(
        extracted.text
      );


    if (!transactions.length) {
      return res.status(400).json({
        message:
          "No transactions could be parsed from the PDF."
      });
    }


    const results = [];


    /*
     * Step 3:
     * Reconcile every transaction
     */

    for (
      let index = 0;
      index < transactions.length;
      index++
    ) {
      const transaction =
        transactions[index];


      try {
        const aiResult =
          await reconcilePayment(
            transaction,
            userId
          );


        const candidates =
          Array.isArray(
            aiResult.candidates
          )
            ? aiResult.candidates
            : [];


        let bestMatch =
          aiResult.best_match || null;


        let confidence =
          Number(
            aiResult.confidence || 0
          );


        let finalStatus =
          aiResult.status ||
          "UNMATCHED";


        /*
         * Backend validation.
         *
         * AI only suggests.
         * Backend remains final authority.
         */

        if (bestMatch) {
          const ownershipValid =
            await validateCandidateOwnership(
              pool,
              userId,
              transaction.direction,
              bestMatch
            );


          const candidateValid =
            candidateExists(
              candidates,
              bestMatch,
              transaction.direction
            );


          if (
            !ownershipValid ||
            !candidateValid
          ) {
            bestMatch = null;

            confidence = 0;

            finalStatus =
              "REVIEW_REQUIRED";
          }
        }


        /*
         * Store AI result in audit log.
         *
         * We DO NOT automatically reconcile.
         */

        const extractedJson = {
          source: "PDF",

          transaction,

          candidates,

          best_match:
            bestMatch,

          status:
            finalStatus
        };


        const eventResult =
          await pool.query(
            `
            INSERT INTO ai_events (
              user_id,
              input_type,
              model,
              confidence,
              extracted_json,
              confirmed,
              selected_product_id
            )
            VALUES (
              $1,
              'PAYMENT_RECONCILIATION',
              'reconciliation-rule-v1',
              $2,
              $3,
              false,
              NULL
            )
            RETURNING id, created_at
            `,
            [
              userId,
              confidence,
              JSON.stringify(
                extractedJson
              )
            ]
          );


        results.push({
          row: index + 1,

          event_id:
            eventResult.rows[0].id,

          transaction,

          candidates,

          best_match:
            bestMatch,

          confidence,

          status:
            finalStatus
        });


      } catch (error) {
        console.error(
          "PDF ROW RECONCILIATION ERROR:",
          error
        );


        results.push({
          row: index + 1,

          transaction,

          status: "ERROR",

          error:
            error.message
        });
      }
    }


    const salesMatched = results.filter(
      r => r.status === "MATCHED" && (r.transaction?.direction === "CREDIT" || r.direction === "CREDIT")
    ).length;

    const purchasesMatched = results.filter(
      r => r.status === "MATCHED" && (r.transaction?.direction === "DEBIT" || r.direction === "DEBIT")
    ).length;

    const needsReview = results.filter(
      r => r.status === "REVIEW_REQUIRED" || r.status === "UNMATCHED"
    ).length;

    const financialOverview = await getStoreFinancialOverview(userId);

    const unidentifiedTransactions = results
      .filter(r => r.status === "REVIEW_REQUIRED" || r.status === "UNMATCHED")
      .map(r => {
        const txn = r.transaction || {};
        let dirLabel = "Money In";
        if (txn.direction === "DEBIT" || String(txn.direction).toUpperCase() === "DEBIT") {
          dirLabel = "Money Out";
        } else if (txn.direction === "CREDIT" || String(txn.direction).toUpperCase() === "CREDIT") {
          dirLabel = "Money In";
        } else if (Number(txn.amount) < 0) {
          dirLabel = "Money Out";
        }
        return {
          row: r.row,
          event_id: r.event_id,
          date: txn.transaction_date || "—",
          description: txn.narration || txn.reference || "Bank Transaction",
          reference: txn.reference || "",
          amount: Math.abs(Number(txn.amount || 0)),
          direction: dirLabel,
          status: "Needs Review",
        };
      });

    const summary = {
      transactions_analyzed: results.length,
      sales_matched: salesMatched,
      purchases_matched: purchasesMatched,
      needs_review: needsReview,
      total: results.length,
      matched: salesMatched + purchasesMatched,
      review_required: results.filter(r => r.status === "REVIEW_REQUIRED").length,
      unmatched: results.filter(r => r.status === "UNMATCHED").length,
      errors: results.filter(r => r.status === "ERROR").length,
    };

    return res.status(200).json({
      message: "PDF bank statement reconciled successfully",
      filename,
      summary,
      financial_overview: financialOverview,
      unidentified_transactions: unidentifiedTransactions,
      results,
    });


  } catch (error) {
    console.error(
      "PDF BANK STATEMENT RECONCILIATION ERROR:",
      error
    );


    return res.status(500).json({
      message:
        "Failed to reconcile PDF bank statement",

      error:
        error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| Reconciliation History
|--------------------------------------------------------------------------
*/

async function getReconciliationHistory(
  req,
  res
) {
  try {
    const userId = req.user.id;


    const result =
      await pool.query(
        `
        SELECT
          id,
          input_type,
          model,
          confidence,
          extracted_json,
          confirmed,
          created_at,
          confirmed_at

        FROM ai_events

        WHERE
          user_id = $1
          AND input_type =
            'PAYMENT_RECONCILIATION'

        ORDER BY
          created_at DESC
        `,
        [userId]
      );


    const history =
      result.rows.map(row => {
        const extracted =
          typeof row.extracted_json ===
          "string"
            ? JSON.parse(
                row.extracted_json
              )
            : row.extracted_json;


        return {
          event_id:
            row.id,

          source:
            extracted?.source ||
            "UNKNOWN",

          transaction:
            extracted?.transaction ||
            null,

          candidates:
            extracted?.candidates ||
            [],

          best_match:
            extracted?.best_match ||
            null,

          confidence:
            Number(
              row.confidence || 0
            ),

          status:
            extracted?.status ||
            "UNMATCHED",

          confirmed:
            row.confirmed,

          confirmed_at:
            row.confirmed_at,

          created_at:
            row.created_at
        };
      });


    return res.status(200).json({
      message:
        "Reconciliation history retrieved successfully",

      count:
        history.length,

      history
    });


  } catch (error) {
    console.error(
      "RECONCILIATION HISTORY ERROR:",
      error
    );


    return res.status(500).json({
      message:
        "Failed to retrieve reconciliation history",

      error:
        error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| Reconciliation Summary
|--------------------------------------------------------------------------
*/

async function getReconciliationSummary(
  req,
  res
) {
  try {
    const userId = req.user.id;

    // 1. Reconciliation AI Event summary
    const result = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE extracted_json->>'status' = 'MATCHED' OR confirmed = true
        ) AS matched,
        COUNT(*) FILTER (
          WHERE extracted_json->>'status' = 'REVIEW_REQUIRED'
        ) AS review_required,
        COUNT(*) FILTER (
          WHERE extracted_json->>'status' = 'UNMATCHED'
        ) AS unmatched,
        COUNT(*) FILTER (
          WHERE confirmed = true
        ) AS confirmed,
        COUNT(*) FILTER (
          WHERE (extracted_json->>'status' = 'MATCHED' OR confirmed = true)
            AND (extracted_json->>'direction' = 'CREDIT' OR extracted_json->'transaction'->>'direction' = 'CREDIT')
        ) AS sales_matched_events,
        COUNT(*) FILTER (
          WHERE (extracted_json->>'status' = 'MATCHED' OR confirmed = true)
            AND (extracted_json->>'direction' = 'DEBIT' OR extracted_json->'transaction'->>'direction' = 'DEBIT')
        ) AS purchases_matched_events
      FROM ai_events
      WHERE
        user_id = $1
        AND input_type = 'PAYMENT_RECONCILIATION'
      `,
      [userId]
    );

    const row = result.rows[0];

    // Check matches in reconciliation_matches table
    const matchCountsResult = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE direction = 'CREDIT' AND status = 'MATCHED') AS sales_matched,
        COUNT(*) FILTER (WHERE direction = 'DEBIT' AND status = 'MATCHED') AS purchases_matched
      FROM reconciliation_matches
      WHERE user_id = $1
      `,
      [userId]
    );
    const matchCounts = matchCountsResult.rows[0] || {};

    const salesMatched = Math.max(
      Number(matchCounts.sales_matched || 0),
      Number(row.sales_matched_events || 0)
    );
    const purchasesMatched = Math.max(
      Number(matchCounts.purchases_matched || 0),
      Number(row.purchases_matched_events || 0)
    );
    const needsReview = Number(row.review_required || 0) + Number(row.unmatched || 0);
    const totalAnalyzed = Number(row.total || 0);

    // 2. Real Financial Overview from PostgreSQL (Sales, Purchases, Expenses)
    // Monthly
    const monthlySalesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM sales
       WHERE user_id = $1
         AND (sale_date >= date_trunc('month', CURRENT_DATE) OR created_at >= date_trunc('month', CURRENT_DATE))`,
      [userId]
    );
    const monthlyPurchasesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = $1
         AND (purchase_date >= date_trunc('month', CURRENT_DATE) OR created_at >= date_trunc('month', CURRENT_DATE))`,
      [userId]
    );
    const monthlyExpensesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM expenses
       WHERE user_id = $1 AND expense_date >= date_trunc('month', CURRENT_DATE)`,
      [userId]
    ).catch(() => ({ rows: [{ total: 0, count: 0 }] }));

    // Yearly
    const yearlySalesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM sales
       WHERE user_id = $1
         AND (sale_date >= date_trunc('year', CURRENT_DATE) OR created_at >= date_trunc('year', CURRENT_DATE))`,
      [userId]
    );
    const yearlyPurchasesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = $1
         AND (purchase_date >= date_trunc('year', CURRENT_DATE) OR created_at >= date_trunc('year', CURRENT_DATE))`,
      [userId]
    );
    const yearlyExpensesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM expenses
       WHERE user_id = $1 AND expense_date >= date_trunc('year', CURRENT_DATE)`,
      [userId]
    ).catch(() => ({ rows: [{ total: 0, count: 0 }] }));

    // All-time (fallback if monthly is 0)
    const allSalesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM sales
       WHERE user_id = $1`,
      [userId]
    );
    const allPurchasesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0)::numeric AS total, COUNT(*)::int AS count
       FROM purchases
       WHERE user_id = $1`,
      [userId]
    );

    const mSales = Number(monthlySalesResult.rows[0]?.total || 0);
    const mPurchases = Number(monthlyPurchasesResult.rows[0]?.total || 0);
    const mExpenses = Number(monthlyExpensesResult.rows[0]?.total || 0);

    const ySales = Number(yearlySalesResult.rows[0]?.total || 0);
    const yPurchases = Number(yearlyPurchasesResult.rows[0]?.total || 0);
    const yExpenses = Number(yearlyExpensesResult.rows[0]?.total || 0);

    const allSales = Number(allSalesResult.rows[0]?.total || 0);
    const allPurchases = Number(allPurchasesResult.rows[0]?.total || 0);

    // 3. Unidentified / Needs Review transactions
    const unidentifiedResult = await pool.query(
      `
      SELECT id, extracted_json, created_at
      FROM ai_events
      WHERE user_id = $1
        AND input_type = 'PAYMENT_RECONCILIATION'
        AND (
          extracted_json->>'status' IN ('REVIEW_REQUIRED', 'UNMATCHED')
          OR (confirmed = false AND (extracted_json->>'status' IS NULL OR extracted_json->>'status' != 'MATCHED'))
        )
      ORDER BY created_at DESC
      LIMIT 30
      `,
      [userId]
    );

    const unidentified = unidentifiedResult.rows.map(r => {
      const ext = typeof r.extracted_json === "string" ? JSON.parse(r.extracted_json) : r.extracted_json;
      const txn = ext?.transaction || {};
      let dirLabel = "Money In";
      if (txn.direction === "DEBIT" || String(txn.direction).toUpperCase() === "DEBIT") {
        dirLabel = "Money Out";
      } else if (txn.direction === "CREDIT" || String(txn.direction).toUpperCase() === "CREDIT") {
        dirLabel = "Money In";
      } else if (txn.amount < 0) {
        dirLabel = "Money Out";
      }

      return {
        event_id: r.id,
        date: txn.transaction_date || r.created_at,
        description: txn.narration || txn.reference || "Bank Transaction",
        reference: txn.reference || "",
        amount: Math.abs(Number(txn.amount || 0)),
        direction: dirLabel,
        status: "Needs Review",
      };
    });

    return res.status(200).json({
      message: "Reconciliation summary retrieved successfully",
      summary: {
        transactions_analyzed: totalAnalyzed,
        sales_matched: salesMatched,
        purchases_matched: purchasesMatched,
        needs_review: needsReview,
        total: totalAnalyzed,
        matched: Number(row.matched || 0),
        unmatched: Number(row.unmatched || 0),
        confirmed: Number(row.confirmed || 0),
      },
      financial_overview: {
        monthly: {
          total_sales: mSales || allSales, // graceful if dates span multiple months
          total_purchases: mPurchases || allPurchases,
          expenses: mExpenses,
          estimated_profit: (mSales || allSales) - (mPurchases || allPurchases) - mExpenses,
        },
        yearly: {
          total_sales: ySales || allSales,
          total_purchases: yPurchases || allPurchases,
          expenses: yExpenses,
          estimated_profit: (ySales || allSales) - (yPurchases || allPurchases) - yExpenses,
        },
        all_time: {
          total_sales: allSales,
          total_purchases: allPurchases,
          expenses: yExpenses,
          estimated_profit: allSales - allPurchases - yExpenses,
        },
      },
      unidentified_transactions: unidentified,
    });
  } catch (error) {
    console.error("RECONCILIATION SUMMARY ERROR:", error);
    return res.status(500).json({
      message: "Failed to retrieve reconciliation summary",
      error: error.message,
    });
  }
}


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  uploadBankStatement,
  reconcilePdfBankStatement,
  getReconciliationHistory,
  getReconciliationSummary,
  getFinancialOverviewController,
  getStoreFinancialOverview,
};