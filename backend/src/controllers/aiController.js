const pool = require("../config/db");

const {
  matchProduct,
  reconcilePayment,
  parseVoice,
  parseVoiceText,
  extractInvoice,
  queryStoreCopilot,
  runAgentTask
} = require("../services/aiService");


/*
|--------------------------------------------------------------------------
| PRODUCT MATCHING
|--------------------------------------------------------------------------
*/

async function productMatch(req, res) {
  try {
    const {
      product_name
    } = req.body;


    const userId =
      req.user.id;


    if (
      !product_name ||
      !String(product_name).trim()
    ) {
      return res.status(400).json({
        message:
          "Product name is required"
      });
    }


    const result =
      await matchProduct(
        String(product_name).trim()
      );

    // Enrich matched product with PostgreSQL catalog pricing and stock
    if (result.matched_product && result.matched_product.id) {
      const pRes = await pool.query(
        "SELECT id, name, sku, selling_price, purchase_price, current_stock FROM products WHERE id = $1",
        [result.matched_product.id]
      );
      if (pRes.rows.length > 0) {
        result.matched_product.selling_price = Number(pRes.rows[0].selling_price);
        result.matched_product.purchase_price = Number(pRes.rows[0].purchase_price);
        result.matched_product.current_stock = Number(pRes.rows[0].current_stock);
        if (pRes.rows[0].sku) result.matched_product.sku = pRes.rows[0].sku;
      }
    }

    // Enrich candidates with real prices and stock
    if (result.candidates && Array.isArray(result.candidates) && result.candidates.length > 0) {
      const candIds = result.candidates.map((c) => c.id).filter(Boolean);
      if (candIds.length > 0) {
        const cRes = await pool.query(
          "SELECT id, name, sku, selling_price, current_stock FROM products WHERE id = ANY($1::int[])",
          [candIds]
        );
        const map = new Map(cRes.rows.map((r) => [r.id, r]));
        for (const cand of result.candidates) {
          const info = map.get(cand.id);
          if (info) {
            cand.selling_price = Number(info.selling_price);
            cand.current_stock = Number(info.current_stock);
            if (info.sku) cand.sku = info.sku;
          }
        }
      }
    }

    const confidence =
      Number(
        result.confidence || 0
      );

    const extractedJson = {
      input:
        String(product_name).trim(),

      candidates:
        result.candidates || [],

      best_match:
        result.best_match || null,

      status:
        result.status || "NO_MATCH"
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
          'PRODUCT_MATCHING',
          $2,
          $3,
          $4,
          false,
          NULL
        )
        RETURNING id
        `,
        [
          userId,

          result.model ||
            "product-matching-v1",

          confidence,

          JSON.stringify(
            extractedJson
          )
        ]
      );


    return res.status(200).json({
      message:
        "Product matching completed",

      event_id:
        eventResult.rows[0].id,

      ...result
    });


  } catch (error) {
    console.error(
      "PRODUCT MATCH ERROR:",
      error
    );


    return res.status(500).json({
      message:
        "Product matching failed",

      error:
        error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| CONFIRM PRODUCT MATCH
|--------------------------------------------------------------------------
*/

async function confirmProductMatch(
  req,
  res
) {
  try {
    const userId =
      req.user.id;


    const {
      event_id,
      product_id
    } = req.body;


    if (!event_id) {
      return res.status(400).json({
        message:
          "event_id is required"
      });
    }


    if (!product_id) {
      return res.status(400).json({
        message:
          "product_id is required"
      });
    }


    const eventResult =
      await pool.query(
        `
        SELECT *
        FROM ai_events
        WHERE
          id = $1
          AND user_id = $2
        LIMIT 1
        `,
        [
          event_id,
          userId
        ]
      );


    if (
      eventResult.rowCount === 0
    ) {
      return res.status(404).json({
        message:
          "AI event not found"
      });
    }


    const event =
      eventResult.rows[0];


    if (
      event.input_type !==
      "PRODUCT_MATCHING"
    ) {
      return res.status(400).json({
        message:
          "Invalid AI event type"
      });
    }


    if (event.confirmed) {
      return res.status(400).json({
        message:
          "This AI result has already been confirmed"
      });
    }


    const productResult =
      await pool.query(
        `
        SELECT id
        FROM products
        WHERE
          id = $1
          AND user_id = $2
          AND is_active = true
        LIMIT 1
        `,
        [
          product_id,
          userId
        ]
      );


    if (
      productResult.rowCount === 0
    ) {
      return res.status(404).json({
        message:
          "Product not found or does not belong to this owner"
      });
    }


    const extracted =
      typeof event.extracted_json ===
      "string"
        ? JSON.parse(
            event.extracted_json
          )
        : event.extracted_json;


    const candidates =
      Array.isArray(
        extracted?.candidates
      )
        ? extracted.candidates
        : [];


    const selectedCandidate =
      candidates.find(
        candidate =>
          Number(
            candidate.product_id
          ) ===
          Number(product_id)
      );


    if (!selectedCandidate) {
      return res.status(400).json({
        message:
          "Selected product was not one of the AI candidates"
      });
    }


    await pool.query(
      `
      UPDATE ai_events

      SET
        confirmed = true,
        selected_product_id = $1,
        confirmed_at = NOW()

      WHERE
        id = $2
        AND user_id = $3
      `,
      [
        product_id,
        event_id,
        userId
      ]
    );


    return res.status(200).json({
      message:
        "Product match confirmed",

      event_id,

      product_id
    });


  } catch (error) {
    console.error(
      "CONFIRM PRODUCT MATCH ERROR:",
      error
    );


    return res.status(500).json({
      message:
        "Failed to confirm product match",

      error:
        error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| PAYMENT RECONCILIATION AI
|--------------------------------------------------------------------------
*/

async function reconcilePaymentTransaction(
  req,
  res
) {
  try {
    const userId =
      req.user.id;


    const {
      transaction_date,
      amount,
      reference,
      narration,
      direction
    } = req.body;


    if (!transaction_date) {
      return res.status(400).json({
        message:
          "transaction_date is required"
      });
    }


    const numericAmount =
      Number(amount);


    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        message:
          "amount must be greater than 0"
      });
    }


    const normalizedDirection =
      String(
        direction || ""
      )
        .trim()
        .toUpperCase();


    if (
      normalizedDirection !==
        "CREDIT" &&
      normalizedDirection !==
        "DEBIT"
    ) {
      return res.status(400).json({
        message:
          "direction must be CREDIT or DEBIT"
      });
    }


    const transaction = {
      transaction_date,

      amount:
        numericAmount,

      reference:
        reference
          ? String(reference).trim()
          : null,

      narration:
        narration
          ? String(narration).trim()
          : null,

      direction:
        normalizedDirection
    };


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
      aiResult.best_match ||
      null;


    let confidence =
  Number(
    aiResult.confidence ??
    aiResult.best_match?.confidence ??
    0
  );

    let finalStatus =
      aiResult.status ||
      "UNMATCHED";


    /*
     * Backend independently validates AI result.
     */

    if (bestMatch) {
      let ownershipValid = false;


      if (
        normalizedDirection ===
        "CREDIT"
      ) {
        if (
          bestMatch.payment_id &&
          bestMatch.sale_id
        ) {
          const validation =
            await pool.query(
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
                bestMatch.payment_id,
                bestMatch.sale_id,
                userId
              ]
            );


          ownershipValid =
            validation.rowCount === 1;
        }
      }


      if (
        normalizedDirection ===
        "DEBIT"
      ) {
        if (
          bestMatch.supplier_payment_id &&
          bestMatch.purchase_id
        ) {
          const validation =
            await pool.query(
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
                bestMatch.supplier_payment_id,
                bestMatch.purchase_id,
                userId
              ]
            );


          ownershipValid =
            validation.rowCount === 1;
        }
      }


      /*
       * Ensure AI cannot invent a best_match
       * that was not present in candidates.
       */

      let candidateValid = false;


      if (
        normalizedDirection ===
        "CREDIT"
      ) {
        candidateValid =
          candidates.some(
            candidate =>
              Number(
                candidate.payment_id
              ) ===
                Number(
                  bestMatch.payment_id
                ) &&
              Number(
                candidate.sale_id
              ) ===
                Number(
                  bestMatch.sale_id
                )
          );
      }


      if (
        normalizedDirection ===
        "DEBIT"
      ) {
        candidateValid =
          candidates.some(
            candidate =>
              Number(
                candidate.supplier_payment_id
              ) ===
                Number(
                  bestMatch.supplier_payment_id
                ) &&
              Number(
                candidate.purchase_id
              ) ===
                Number(
                  bestMatch.purchase_id
                )
          );
      }


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
      source: "DIRECT",

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
        RETURNING id
        `,
        [
          userId,

          confidence,

          JSON.stringify(
            extractedJson
          )
        ]
      );


    return res.status(200).json({
      message:
        "Payment reconciliation completed",

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
      "PAYMENT RECONCILIATION ERROR:",
      error
    );


    return res.status(500).json({
      message:
        "Payment reconciliation failed",

      error:
        error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| CONFIRM PAYMENT RECONCILIATION
|--------------------------------------------------------------------------
*/

async function confirmPaymentReconciliation(
  req,
  res
) {
  const client =
    await pool.connect();


  try {
    const userId =
      req.user.id;


    const {
      event_id,
      direction
    } = req.body;


    const normalizedDirection =
      String(
        direction || ""
      )
        .trim()
        .toUpperCase();


    if (!event_id) {
      return res.status(400).json({
        message:
          "event_id is required"
      });
    }


    if (
      normalizedDirection !==
        "CREDIT" &&
      normalizedDirection !==
        "DEBIT"
    ) {
      return res.status(400).json({
        message:
          "direction must be CREDIT or DEBIT"
      });
    }


    await client.query("BEGIN");


    /*
     * Lock the AI event.
     */

    const eventResult =
      await client.query(
        `
        SELECT *
        FROM ai_events

        WHERE
          id = $1
          AND user_id = $2

        FOR UPDATE
        `,
        [
          event_id,
          userId
        ]
      );


    if (
      eventResult.rowCount === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(404).json({
        message:
          "AI reconciliation event not found"
      });
    }


    const event =
      eventResult.rows[0];


    if (
      event.input_type !==
      "PAYMENT_RECONCILIATION"
    ) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        message:
          "Invalid AI event type"
      });
    }


    if (event.confirmed) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        message:
          "This reconciliation result has already been confirmed"
      });
    }


    const extracted =
      typeof event.extracted_json ===
      "string"
        ? JSON.parse(
            event.extracted_json
          )
        : event.extracted_json;


    const transaction =
      extracted?.transaction;


    const candidates =
      Array.isArray(
        extracted?.candidates
      )
        ? extracted.candidates
        : [];


    const bestMatch =
      extracted?.best_match ||
      null;


    if (!transaction) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        message:
          "Transaction information is missing from AI event"
      });
    }


    /*
     * IMPORTANT:
     *
     * Confirmation is allowed only if the
     * best_match exists in the candidates returned
     * by the AI service.
     */

    if (!bestMatch) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        message:
          "This reconciliation result has no valid match to confirm"
      });
    }


    let selectedCandidate = null;


    if (
      normalizedDirection ===
      "CREDIT"
    ) {
      selectedCandidate =
        candidates.find(
          candidate =>
            Number(
              candidate.payment_id
            ) ===
              Number(
                bestMatch.payment_id
              ) &&
            Number(
              candidate.sale_id
            ) ===
              Number(
                bestMatch.sale_id
              )
        );
    }


    if (
      normalizedDirection ===
      "DEBIT"
    ) {
      selectedCandidate =
        candidates.find(
          candidate =>
            Number(
              candidate.supplier_payment_id
            ) ===
              Number(
                bestMatch.supplier_payment_id
              ) &&
            Number(
              candidate.purchase_id
            ) ===
              Number(
                bestMatch.purchase_id
              )
        );
    }


    if (!selectedCandidate) {
      await client.query(
        "ROLLBACK"
      );

      return res.status(400).json({
        message:
          "Selected reconciliation match was not one of the AI candidates"
      });
    }


    /*
     |--------------------------------------------------------------------------
     | CREDIT
     |--------------------------------------------------------------------------
     |
     | Customer pays shop.
     |
     */

    if (
      normalizedDirection ===
      "CREDIT"
    ) {
      const paymentResult =
        await client.query(
          `
          SELECT
            p.id AS payment_id,
            p.sale_id,
            p.amount,
            p.user_id,
            s.total_amount,
            s.user_id AS sale_user_id

          FROM payments p

          INNER JOIN sales s
            ON s.id = p.sale_id

          WHERE
            p.id = $1
            AND s.id = $2

          FOR UPDATE
          `,
          [
            bestMatch.payment_id,
            bestMatch.sale_id
          ]
        );


      if (
        paymentResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Payment or sale not found"
        });
      }


      const payment =
        paymentResult.rows[0];


      if (
        Number(payment.user_id) !==
        Number(userId)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(403).json({
          message:
            "Payment does not belong to this owner"
        });
      }


      if (
        Number(
          payment.sale_user_id
        ) !== Number(userId)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(403).json({
          message:
            "Sale does not belong to this owner"
        });
      }


      if (
        Number(payment.amount) !==
        Number(transaction.amount)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Bank transaction amount does not match payment amount"
        });
      }


      /*
       * Prevent duplicate reconciliation.
       */

      const duplicateResult =
        await client.query(
          `
          SELECT id

          FROM reconciliation_matches

          WHERE
            user_id = $1
            AND payment_id = $2

          LIMIT 1
          `,
          [
            userId,
            bestMatch.payment_id
          ]
        );


      if (
        duplicateResult.rowCount > 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "This payment has already been reconciled",

          reconciliation_match_id:
            duplicateResult.rows[0].id
        });
      }


      /*
       * Create reconciliation record.
       */

      const matchResult =
        await client.query(
          `
          INSERT INTO reconciliation_matches (
            user_id,
            payment_id,
            sale_id,
            confidence,
            status,
            direction
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'MATCHED',
            'CREDIT'
          )
          RETURNING id
          `,
          [
            userId,

            bestMatch.payment_id,

            bestMatch.sale_id,

            Number(
              event.confidence || 0
            )
          ]
        );


      /*
       * Mark AI event confirmed.
       */

      await client.query(
        `
        UPDATE ai_events

        SET
          confirmed = true,
          confirmed_at = NOW()

        WHERE
          id = $1
          AND user_id = $2
        `,
        [
          event_id,
          userId
        ]
      );


      await client.query(
        "COMMIT"
      );


      return res.status(200).json({
        message:
          "Customer payment reconciliation confirmed",

        event_id,

        reconciliation_match_id:
          matchResult.rows[0].id,

        direction:
          "CREDIT",

        payment_id:
          bestMatch.payment_id,

        sale_id:
          bestMatch.sale_id
      });
    }


    /*
     |--------------------------------------------------------------------------
     | DEBIT
     |--------------------------------------------------------------------------
     |
     | Shop pays supplier/distributor.
     |
     */

    if (
      normalizedDirection ===
      "DEBIT"
    ) {
      const supplierPaymentResult =
        await client.query(
          `
          SELECT
            sp.id AS supplier_payment_id,
            sp.purchase_id,
            sp.supplier_id,
            sp.amount,
            sp.user_id,
            p.total_amount,
            p.user_id AS purchase_user_id

          FROM supplier_payments sp

          INNER JOIN purchases p
            ON p.id = sp.purchase_id

          WHERE
            sp.id = $1
            AND p.id = $2

          FOR UPDATE
          `,
          [
            bestMatch.supplier_payment_id,
            bestMatch.purchase_id
          ]
        );


      if (
        supplierPaymentResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          message:
            "Supplier payment or purchase not found"
        });
      }


      const supplierPayment =
        supplierPaymentResult.rows[0];


      if (
        Number(
          supplierPayment.user_id
        ) !== Number(userId)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(403).json({
          message:
            "Supplier payment does not belong to this owner"
        });
      }


      if (
        Number(
          supplierPayment.purchase_user_id
        ) !== Number(userId)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(403).json({
          message:
            "Purchase does not belong to this owner"
        });
      }


      if (
        Number(
          supplierPayment.amount
        ) !==
        Number(transaction.amount)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "Bank transaction amount does not match supplier payment amount"
        });
      }


      /*
       * Prevent duplicate reconciliation.
       */

      const duplicateResult =
        await client.query(
          `
          SELECT id

          FROM reconciliation_matches

          WHERE
            user_id = $1
            AND supplier_payment_id = $2

          LIMIT 1
          `,
          [
            userId,
            bestMatch.supplier_payment_id
          ]
        );


      if (
        duplicateResult.rowCount > 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          message:
            "This supplier payment has already been reconciled",

          reconciliation_match_id:
            duplicateResult.rows[0].id
        });
      }


      /*
       * Create reconciliation record.
       */

      const matchResult =
        await client.query(
          `
          INSERT INTO reconciliation_matches (
            user_id,
            purchase_id,
            supplier_payment_id,
            confidence,
            status,
            direction
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'MATCHED',
            'DEBIT'
          )
          RETURNING id
          `,
          [
            userId,

            bestMatch.purchase_id,

            bestMatch.supplier_payment_id,

            Number(
              event.confidence || 0
            )
          ]
        );


      /*
       * Mark AI event confirmed.
       */

      await client.query(
        `
        UPDATE ai_events

        SET
          confirmed = true,
          confirmed_at = NOW()

        WHERE
          id = $1
          AND user_id = $2
        `,
        [
          event_id,
          userId
        ]
      );


      await client.query(
        "COMMIT"
      );


      return res.status(200).json({
        message:
          "Supplier payment reconciliation confirmed",

        event_id,

        reconciliation_match_id:
          matchResult.rows[0].id,

        direction:
          "DEBIT",

        supplier_payment_id:
          bestMatch.supplier_payment_id,

        purchase_id:
          bestMatch.purchase_id
      });
    }


    await client.query(
      "ROLLBACK"
    );


    return res.status(400).json({
      message:
        "Unsupported reconciliation direction"
    });


  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (_) {
      // Ignore rollback errors
    }


    console.error(
      "CONFIRM PAYMENT RECONCILIATION ERROR:",
      error
    );


    return res.status(500).json({
      message:
        "Failed to confirm payment reconciliation",

      error:
        error.message
    });


  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| VOICE ANALYSIS
|--------------------------------------------------------------------------
*/

async function processVoiceSale(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file && (!req.body || !req.body.text)) {
      return res.status(400).json({
        message: "Audio file or speech text is required"
      });
    }

    const preferredLanguage = req.body?.language || null;
    let aiResult;

    if (req.file) {
      aiResult = await parseVoice(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        preferredLanguage
      );
    } else {
      aiResult = await parseVoiceText(
        req.body.text,
        preferredLanguage
      );
    }

    // Helper to resolve a product specifically for the logged-in user
    const resolveUserProduct = async (pId, pName, pSku) => {
      // 1. If pId is provided, check if it already belongs to this user
      if (pId) {
        const directRes = await pool.query(
          "SELECT id, name, sku, selling_price, purchase_price, current_stock FROM products WHERE id = $1 AND user_id = $2 AND is_active = true",
          [pId, userId]
        );
        if (directRes.rows.length > 0) {
          return directRes.rows[0];
        }
      }

      // 2. Lookup in this user's catalog by name, sku, or aliases
      const cleanName = (pName || "").trim();
      const cleanSku = (pSku || "").trim();
      if (cleanName || cleanSku) {
        const nameRes = await pool.query(
          `SELECT id, name, sku, selling_price, purchase_price, current_stock
           FROM products
           WHERE user_id = $1 AND is_active = true
             AND (
               LOWER(TRIM(name)) = LOWER(TRIM($2))
               OR ($3::text <> '' AND LOWER(TRIM(sku)) = LOWER(TRIM($3)))
               OR LOWER(TRIM(name)) LIKE LOWER(TRIM($4))
               OR (LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(name)) || '%')
             )
           ORDER BY (LOWER(TRIM(name)) = LOWER(TRIM($2))) DESC, id ASC
           LIMIT 1`,
          [userId, cleanName, cleanSku, `%${cleanName}%`]
        );
        if (nameRes.rows.length > 0) {
          return nameRes.rows[0];
        }
      }

      // 3. Fallback: if user doesn't have it yet, check if system product exists
      if (pId) {
        const fallbackRes = await pool.query(
          "SELECT id, name, sku, selling_price, purchase_price, current_stock FROM products WHERE id = $1 AND is_active = true",
          [pId]
        );
        if (fallbackRes.rows.length > 0) {
          return fallbackRes.rows[0];
        }
      }
      return null;
    };

    // Enrich top-level matched_product for this user
    if (aiResult.product_match?.matched_product) {
      const orig = aiResult.product_match.matched_product;
      const resolved = await resolveUserProduct(orig.id, orig.name, orig.sku);
      if (resolved) {
        aiResult.product_match.matched_product.id = resolved.id;
        aiResult.product_match.matched_product.name = resolved.name;
        aiResult.product_match.matched_product.sku = resolved.sku;
        aiResult.product_match.matched_product.selling_price = Number(resolved.selling_price);
        aiResult.product_match.matched_product.purchase_price = Number(resolved.purchase_price);
        aiResult.product_match.matched_product.current_stock = Number(resolved.current_stock);
      }
    }

    // Enrich all items in multi-item basket for this user
    if (aiResult.items && Array.isArray(aiResult.items) && aiResult.items.length > 0) {
      let calculatedTotal = 0;
      for (const item of aiResult.items) {
        const matched = item.product_match?.matched_product;
        const targetId = matched?.id || null;
        const targetName = matched?.name || item.product_text || "";
        const targetSku = matched?.sku || "";

        const resolved = await resolveUserProduct(targetId, targetName, targetSku);
        if (resolved) {
          if (!item.product_match) {
            item.product_match = {};
          }
          if (!item.product_match.matched_product) {
            item.product_match.matched_product = {};
          }
          item.product_match.matched_product.id = resolved.id;
          item.product_match.matched_product.name = resolved.name;
          item.product_match.matched_product.sku = resolved.sku;
          item.product_match.matched_product.selling_price = Number(resolved.selling_price);
          item.product_match.matched_product.purchase_price = Number(resolved.purchase_price);
          item.product_match.matched_product.current_stock = Number(resolved.current_stock);

          const qty = Number(item.quantity || 1);
          item.unit_price = Number(resolved.selling_price);
          item.total_amount = Number((qty * item.unit_price).toFixed(2));
          calculatedTotal += item.total_amount;
        } else if (item.unit_price) {
          calculatedTotal += Number((Number(item.quantity || 1) * Number(item.unit_price)).toFixed(2));
        }
      }

      if (!aiResult.amount || Number(aiResult.amount) <= 0) {
        aiResult.amount = calculatedTotal;
      }
    }

    // Enrich candidates with selling_price and stock
    if (
      aiResult.product_match?.candidates &&
      Array.isArray(aiResult.product_match.candidates) &&
      aiResult.product_match.candidates.length > 0
    ) {
      const candIds = aiResult.product_match.candidates.map((c) => c.id).filter(Boolean);
      if (candIds.length > 0) {
        const cRes = await pool.query(
          "SELECT id, name, sku, selling_price, current_stock FROM products WHERE id = ANY($1::int[])",
          [candIds]
        );
        const candMap = new Map(cRes.rows.map((r) => [r.id, r]));
        for (const cand of aiResult.product_match.candidates) {
          const info = candMap.get(cand.id);
          if (info) {
            cand.name = info.name;
            cand.sku = info.sku;
            cand.selling_price = Number(info.selling_price);
            cand.current_stock = Number(info.current_stock);
          }
        }
      }
    }

    // Auto-calculate missing financial fields if product is matched
    const matched = aiResult.product_match?.matched_product;
    if (matched && matched.selling_price > 0) {
      if (aiResult.quantity && (aiResult.amount === null || aiResult.amount === undefined)) {
        aiResult.amount = Number(aiResult.quantity) * Number(matched.selling_price);
      } else if (aiResult.amount && (aiResult.quantity === null || aiResult.quantity === undefined)) {
        aiResult.quantity = Math.round(Number(aiResult.amount) / Number(matched.selling_price));
      }

      if (aiResult.amount && aiResult.quantity && Number(aiResult.quantity) > 0) {
        aiResult.unit_price = Number((Number(aiResult.amount) / Number(aiResult.quantity)).toFixed(2));
      } else {
        aiResult.unit_price = Number(matched.selling_price);
      }
    } else if (aiResult.amount && aiResult.quantity && Number(aiResult.quantity) > 0) {
      aiResult.unit_price = Number((Number(aiResult.amount) / Number(aiResult.quantity)).toFixed(2));
    }

    const confidence = Number(aiResult.confidence || 0);
    const selectedProductId =
      aiResult.product_match?.matched_product?.id || null;

    const eventResult = await pool.query(
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
      VALUES ($1, 'VOICE_SALE', 'whisper-small-nlp-v1', $2, $3, false, $4)
      RETURNING id
      `,
      [
        userId,
        confidence,
        JSON.stringify(aiResult),
        selectedProductId
      ]
    );

    return res.status(200).json({
      message: "Voice transaction processed successfully",
      event_id: eventResult.rows[0].id,
      ...aiResult
    });

  } catch (error) {
    console.error("VOICE PROCESS ERROR:", error);
    return res.status(500).json({
      message: "Voice processing failed",
      error: error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| CONFIRM VOICE SALE
|--------------------------------------------------------------------------
*/

async function confirmVoiceSale(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const {
      event_id,
      customer_id = null,
      customer_name = null,
      customer_phone = null,
      date = null,
      items,
      payment_mode = "CASH",
      payment_amount = null,
      payment_reference = null
    } = req.body;

    if (!event_id) {
      return res.status(400).json({
        message: "event_id is required"
      });
    }

    await client.query("BEGIN");

    // Lock and verify AI event
    const eventResult = await client.query(
      `
      SELECT *
      FROM ai_events
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [event_id, userId]
    );

    if (eventResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Voice AI event not found"
      });
    }

    const event = eventResult.rows[0];

    if (event.input_type !== "VOICE_SALE") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Invalid AI event type: expected VOICE_SALE"
      });
    }

    if (event.confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "This voice sale has already been confirmed"
      });
    }

    const extracted =
      typeof event.extracted_json === "string"
        ? JSON.parse(event.extracted_json)
        : event.extracted_json;

    // Resolve items to confirm
    let saleItems = items;
    if (!saleItems || !Array.isArray(saleItems) || saleItems.length === 0) {
      if (extracted?.items && Array.isArray(extracted.items) && extracted.items.length > 0) {
        saleItems = extracted.items
          .filter(it => it.product_match?.matched_product?.id)
          .map(it => ({
            product_id: it.product_match.matched_product.id,
            quantity: Number(it.quantity || 1),
            selling_price: it.unit_price || it.product_match.matched_product.selling_price
          }));
      }

      // Reconstruct from single product match if extracted.items was empty
      if (!saleItems || saleItems.length === 0) {
        const defaultProductId =
          event.selected_product_id ||
          extracted?.product_match?.matched_product?.id;
        const defaultQty = Number(extracted?.quantity || 1);

        if (!defaultProductId) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Items array is required because no default product was matched"
          });
        }

        saleItems = [
          {
            product_id: defaultProductId,
            quantity: defaultQty
          }
        ];
      }
    }

    // Resolve customer by ID or Name
    let resolvedCustomerId = customer_id ? Number(customer_id) : null;
    let resolvedCustomerName = null;

    if (!resolvedCustomerId && customer_name && String(customer_name).trim()) {
      const cleanName = String(customer_name).trim();
      const cleanPhone = customer_phone && String(customer_phone).trim() ? String(customer_phone).trim() : null;

      const existingCust = await client.query(
        `SELECT id, name, current_due FROM customers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND (user_id = $2 OR user_id IS NULL) LIMIT 1`,
        [cleanName, userId]
      );

      if (existingCust.rowCount > 0) {
        resolvedCustomerId = existingCust.rows[0].id;
        resolvedCustomerName = existingCust.rows[0].name;
      } else {
        const newCust = await client.query(
          `INSERT INTO customers (name, contact, user_id, current_due) VALUES ($1, $2, $3, 0) RETURNING id, name`,
          [cleanName, cleanPhone, userId]
        );
        resolvedCustomerId = newCust.rows[0].id;
        resolvedCustomerName = newCust.rows[0].name;
      }
    } else if (resolvedCustomerId) {
      const customerResult = await client.query(
        `SELECT id, name, current_due FROM customers WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
        [resolvedCustomerId, userId]
      );
      if (customerResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: "Customer not found"
        });
      }
      resolvedCustomerName = customerResult.rows[0].name;
    }

    // Validate products and check stock
    let totalSaleAmount = 0;
    const resolvedItems = [];

    for (const item of saleItems) {
      const productId = Number(item.product_id);
      const qty = Number(item.quantity);

      if (!productId || !qty || qty <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Each item must have a valid product_id and quantity > 0"
        });
      }

      const productResult = await client.query(
        `
        SELECT id, name, purchase_price, selling_price, current_stock
        FROM products
        WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) AND is_active = true
        FOR UPDATE
        `,
        [productId, userId]
      );

      if (productResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: `Product ID ${productId} not found or inactive`
        });
      }

      const product = productResult.rows[0];

      if (Number(product.current_stock) < qty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.current_stock}, Requested: ${qty}`
        });
      }

      const sellingPrice =
        item.selling_price !== undefined && item.selling_price !== null
          ? Number(item.selling_price)
          : Number(product.selling_price);

      const costPrice = Number(product.purchase_price);
      const lineTotal = qty * sellingPrice;
      const profit = qty * (sellingPrice - costPrice);

      totalSaleAmount += lineTotal;

      resolvedItems.push({
        product_id: productId,
        name: product.name,
        quantity: qty,
        selling_price: sellingPrice,
        cost_price: costPrice,
        total_amount: lineTotal,
        profit
      });
    }

    // Determine payment status
    const isCredit = String(payment_mode || "").toUpperCase() === "CREDIT";
    const effectivePaymentAmount = isCredit
      ? 0
      : (payment_amount !== null && payment_amount !== undefined
          ? Number(payment_amount)
          : totalSaleAmount);

    let paymentStatus = "PENDING";
    if (isCredit) {
      paymentStatus = "CREDIT";
    } else if (effectivePaymentAmount >= totalSaleAmount) {
      paymentStatus = "PAID";
    } else if (effectivePaymentAmount > 0) {
      paymentStatus = "PARTIAL";
    } else {
      paymentStatus = "CREDIT";
    }

    // Insert Sale record
    const saleResult = await client.query(
      `
      INSERT INTO sales (
        customer_id,
        sale_date,
        total_amount,
        payment_status,
        input_source,
        user_id
      )
      VALUES ($1, COALESCE($2, CURRENT_TIMESTAMP), $3, $4, 'VOICE', $5)
      RETURNING *
      `,
      [
        resolvedCustomerId,
        date || null,
        totalSaleAmount,
        paymentStatus,
        userId
      ]
    );

    const sale = saleResult.rows[0];
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const billNumber = `BILL-${todayStr}-${String(sale.id).padStart(4, "0")}`;
    await client.query(
      `UPDATE sales SET bill_number = $1 WHERE id = $2`,
      [billNumber, sale.id]
    );
    sale.bill_number = billNumber;

    // If Credit / Udhaar, update customer's current due
    if (isCredit && resolvedCustomerId) {
      await client.query(
        `UPDATE customers SET current_due = COALESCE(current_due, 0) + $1 WHERE id = $2`,
        [totalSaleAmount, resolvedCustomerId]
      );
    }

    // Insert Sale Items, decrement stock, log inventory movements
    for (const item of resolvedItems) {
      await client.query(
        `
        INSERT INTO sale_items (
          sale_id,
          product_id,
          quantity,
          selling_price,
          cost_price,
          total_amount,
          profit
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          sale.id,
          item.product_id,
          item.quantity,
          item.selling_price,
          item.cost_price,
          item.total_amount,
          item.profit
        ]
      );

      await client.query(
        `
        UPDATE products
        SET current_stock = current_stock - $1
        WHERE id = $2
        `,
        [item.quantity, item.product_id]
      );

      await client.query(
        `
        INSERT INTO inventory_movements (
          product_id,
          movement_type,
          quantity,
          reference_id
        )
        VALUES ($1, 'SALE', $2, $3)
        `,
        [item.product_id, -item.quantity, sale.id]
      );
    }

    // Record Payment if amount > 0 and not CREDIT
    let paymentRecord = null;
    if (!isCredit && effectivePaymentAmount > 0) {
      const mode = (payment_mode || "CASH").toUpperCase();
      const validModes = ["CASH", "UPI", "BANK"];
      const finalMode = validModes.includes(mode) ? mode : "CASH";

      const paymentResult = await client.query(
        `
        INSERT INTO payments (
          sale_id,
          customer_id,
          amount,
          mode,
          reference,
          payment_date,
          status,
          user_id
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'CONFIRMED', $6)
        RETURNING *
        `,
        [
          sale.id,
          resolvedCustomerId,
          effectivePaymentAmount,
          finalMode,
          payment_reference || null,
          userId
        ]
      );
      paymentRecord = paymentResult.rows[0];
    }

    // Mark AI Event as confirmed
    const primaryProductId = resolvedItems[0].product_id;
    await client.query(
      `
      UPDATE ai_events
      SET confirmed = true,
          selected_product_id = $1,
          confirmed_at = NOW()
      WHERE id = $2 AND user_id = $3
      `,
      [primaryProductId, event_id, userId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Voice sale confirmed and recorded successfully",
      sale_id: sale.id,
      bill_number: billNumber,
      event_id,
      total_amount: totalSaleAmount,
      payment_status: paymentStatus,
      customer_id: resolvedCustomerId,
      customer_name: resolvedCustomerName,
      items: resolvedItems,
      payment: paymentRecord
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("CONFIRM VOICE SALE ERROR:", error);
    return res.status(500).json({
      message: "Failed to confirm voice sale",
      error: error.message
    });
  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| INVOICE EXTRACTION
|--------------------------------------------------------------------------
*/

async function processInvoice(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        message: "Invoice file is required"
      });
    }

    const aiResult = await extractInvoice(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const confidence = Number(aiResult.confidence || 0);

    const eventResult = await pool.query(
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
      VALUES ($1, 'INVOICE_EXTRACTION', 'gemini-3.5-flash-lite-vision', $2, $3, false, NULL)
      RETURNING id
      `,
      [
        userId,
        confidence,
        JSON.stringify(aiResult)
      ]
    );

    return res.status(200).json({
      message: "Invoice processed successfully",
      event_id: eventResult.rows[0].id,
      ...aiResult
    });

  } catch (error) {
    console.error("INVOICE PROCESS ERROR:", error);
    return res.status(500).json({
      message: "Invoice processing failed",
      error: error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| CONFIRM INVOICE PURCHASE
|--------------------------------------------------------------------------
*/

async function confirmInvoicePurchase(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const {
      event_id,
      supplier_id = null,
      invoice_no = null,
      purchase_date = null,
      items
    } = req.body;

    if (!event_id) {
      return res.status(400).json({
        message: "event_id is required"
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "items array must contain at least one product item"
      });
    }

    await client.query("BEGIN");

    // Lock and verify AI event
    const eventResult = await client.query(
      `
      SELECT *
      FROM ai_events
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [event_id, userId]
    );

    if (eventResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Invoice AI event not found"
      });
    }

    const event = eventResult.rows[0];

    if (event.input_type !== "INVOICE_EXTRACTION") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Invalid AI event type: expected INVOICE_EXTRACTION"
      });
    }

    if (event.confirmed) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "This invoice has already been confirmed"
      });
    }

    const extracted =
      typeof event.extracted_json === "string"
        ? JSON.parse(event.extracted_json)
        : event.extracted_json;

    // Validate or resolve supplier
    let finalSupplierId = supplier_id ? Number(supplier_id) : null;
    const rawSupplierName = (req.body.supplier_name || extracted?.supplier || "").trim();

    if (finalSupplierId) {
      const supplierResult = await client.query(
        `SELECT id FROM suppliers WHERE id = $1`,
        [finalSupplierId]
      );
      if (supplierResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          message: `Supplier ID ${finalSupplierId} not found`
        });
      }
    } else if (rawSupplierName) {
      // Find existing supplier or auto-create one
      const existingSupp = await client.query(
        `SELECT id FROM suppliers WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
        [rawSupplierName]
      );
      if (existingSupp.rowCount > 0) {
        finalSupplierId = existingSupp.rows[0].id;
      } else {
        const newSupp = await client.query(
          `INSERT INTO suppliers (name) VALUES ($1) RETURNING id`,
          [rawSupplierName]
        );
        finalSupplierId = newSupp.rows[0].id;
      }
    }

    // Resolve invoice number
    const finalInvoiceNo =
      invoice_no || extracted?.invoice_number || null;

    // Validate items and calculate total amount
    let totalPurchaseAmount = 0;
    const validatedItems = [];
    const newProductsCreated = [];

    for (const item of items) {
      let productId = item.product_id && item.product_id !== "__NEW__" ? Number(item.product_id) : null;
      const isNewProduct = Boolean(item.is_new_product || !productId || item.product_id === "__NEW__");
      const productName = (item.product_name || item.name || item.description || "").trim();
      const rawSku = (item.sku || "").trim() || null;
      const qty = Number(item.quantity);
      const unitCost = Number(item.unit_cost !== undefined ? item.unit_cost : item.unitCost);

      if (!productId && !productName) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Either product_id or product_name is required for each item"
        });
      }

      if (!qty || qty <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Quantity must be greater than 0 for item '${productName || productId}'`
        });
      }

      if (isNaN(unitCost) || unitCost < 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `Unit cost must be a valid non-negative number for item '${productName || productId}'`
        });
      }

      let resolvedProduct = null;

      if (productId && !isNewProduct) {
        const productResult = await client.query(
          `
          SELECT id, name, current_stock, purchase_price, sku
          FROM products
          WHERE id = $1 AND user_id = $2
          FOR UPDATE
          `,
          [productId, userId]
        );

        if (productResult.rowCount > 0) {
          resolvedProduct = productResult.rows[0];
        }
      }

      if (!resolvedProduct) {
        // Look up by name or sku first for THIS USER
        const existingResult = await client.query(
          `
          SELECT id, name, current_stock, purchase_price, sku
          FROM products
          WHERE (LOWER(TRIM(name)) = LOWER(TRIM($1))
             OR ($2::text IS NOT NULL AND LOWER(TRIM(sku)) = LOWER(TRIM($2))))
            AND user_id = $3
          FOR UPDATE
          LIMIT 1
          `,
          [productName, rawSku, userId]
        );

        if (existingResult.rowCount > 0) {
          resolvedProduct = existingResult.rows[0];
          productId = resolvedProduct.id;
        } else {
          // Auto-create new product in THIS USER's catalog!
          let finalSku = rawSku;
          if (finalSku) {
            const skuCheck = await client.query(
              `SELECT id FROM products WHERE LOWER(TRIM(sku)) = LOWER(TRIM($1)) AND user_id = $2 LIMIT 1`,
              [finalSku, userId]
            );
            if (skuCheck.rowCount > 0) {
              finalSku = `${finalSku}-${Math.floor(100 + Math.random() * 900)}`;
            }
          } else {
            const cleanSlug = productName
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 8);
            finalSku = `${cleanSlug || "PROD"}${Math.floor(100 + Math.random() * 900)}`;
          }

          const defaultSellingPrice = item.selling_price && Number(item.selling_price) > 0
            ? Number(item.selling_price)
            : unitCost > 0
            ? Number((unitCost * 1.25).toFixed(2)) // 25% standard retail margin
            : 10.0;

          const newProdResult = await client.query(
            `
            INSERT INTO products (
              name,
              sku,
              unit,
              purchase_price,
              selling_price,
              current_stock,
              reorder_level,
              is_active,
              user_id
            )
            VALUES ($1, $2, $3, $4, $5, 0, 5, true, $6)
            RETURNING id, name, current_stock, purchase_price, sku
            `,
            [
              productName,
              finalSku,
              item.unit || "piece",
              unitCost,
              defaultSellingPrice,
              userId
            ]
          );

          resolvedProduct = newProdResult.rows[0];
          productId = resolvedProduct.id;
          newProductsCreated.push({
            id: resolvedProduct.id,
            name: resolvedProduct.name,
            sku: resolvedProduct.sku,
            purchase_price: unitCost,
            selling_price: defaultSellingPrice,
            initial_stock: qty
          });
        }
      }

      const itemTotal = Number((qty * unitCost).toFixed(2));
      totalPurchaseAmount += itemTotal;

      validatedItems.push({
        product_id: productId,
        name: resolvedProduct.name,
        sku: resolvedProduct.sku,
        quantity: qty,
        unit_cost: unitCost,
        total_cost: itemTotal,
        is_new: newProductsCreated.some((p) => p.id === productId)
      });
    }

    // Insert into purchases
    const purchaseResult = await client.query(
      `
      INSERT INTO purchases (
        supplier_id,
        invoice_no,
        purchase_date,
        total_amount,
        user_id
      )
      VALUES ($1, $2, COALESCE($3, CURRENT_TIMESTAMP), $4, $5)
      RETURNING *
      `,
      [
        finalSupplierId,
        finalInvoiceNo,
        purchase_date || null,
        totalPurchaseAmount,
        userId
      ]
    );

    const purchase = purchaseResult.rows[0];

    // Insert purchase items, increment stock, update purchase price, log movement
    for (const item of validatedItems) {
      await client.query(
        `
        INSERT INTO purchase_items (
          purchase_id,
          product_id,
          quantity,
          unit_cost,
          total_cost
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          purchase.id,
          item.product_id,
          item.quantity,
          item.unit_cost,
          item.total_cost
        ]
      );

      await client.query(
        `
        UPDATE products
        SET current_stock = current_stock + $1,
            purchase_price = $2
        WHERE id = $3
        `,
        [item.quantity, item.unit_cost, item.product_id]
      );

      await client.query(
        `
        INSERT INTO inventory_movements (
          product_id,
          movement_type,
          quantity,
          reference_id
        )
        VALUES ($1, 'PURCHASE', $2, $3)
        `,
        [item.product_id, item.quantity, purchase.id]
      );
    }

    // Mark AI Event confirmed
    await client.query(
      `
      UPDATE ai_events
      SET confirmed = true,
          confirmed_at = NOW()
      WHERE id = $1 AND user_id = $2
      `,
      [event_id, userId]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Invoice purchase confirmed and inventory updated successfully",
      purchase_id: purchase.id,
      event_id,
      invoice_no: finalInvoiceNo,
      supplier_id: finalSupplierId,
      total_amount: totalPurchaseAmount,
      items: validatedItems,
      new_products_created: newProductsCreated
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("CONFIRM INVOICE PURCHASE ERROR:", error);
    return res.status(500).json({
      message: "Failed to confirm invoice purchase",
      error: error.message
    });
  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| STORE INTELLIGENCE COPILOT (LOCAL MULTILINGUAL RAG)
|--------------------------------------------------------------------------
*/

async function askStoreCopilot(req, res) {
  try {
    const userId = req.user.id;
    const { query, language = "en" } = req.body;

    if (!query || !String(query).trim()) {
      return res.status(400).json({ message: "Query text is required" });
    }

    // 1. Fetch live supplier purchases & items
    const purchasesResult = await pool.query(
      `SELECT p.id, p.invoice_no, p.purchase_date, p.total_amount, s.name as supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.user_id = $1
       ORDER BY p.id DESC LIMIT 40`,
      [userId]
    );

    const purchases = purchasesResult.rows;
    for (const p of purchases) {
      const itemsRes = await pool.query(
        `SELECT pi.*, COALESCE(pr.name, 'Product') as product_name, pi.unit_cost as purchase_price
         FROM purchase_items pi
         LEFT JOIN products pr ON pi.product_id = pr.id
         WHERE pi.purchase_id = $1`,
        [p.id]
      );
      p.items = itemsRes.rows;
    }

    // 2. Fetch pending credit sales (Udhaar)
    const creditResult = await pool.query(
      `SELECT s.id, s.bill_number, s.total_amount, s.payment_status, s.sale_date, s.created_at,
              COALESCE(c.name, 'Walk-in Customer') as customer_name, c.contact as customer_phone
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.user_id = $1 AND s.payment_status IN ('CREDIT', 'PENDING', 'PARTIAL')
       ORDER BY s.id DESC LIMIT 50`,
      [userId]
    );

    // Also fetch customer records with current_due > 0
    const customerLedgersResult = await pool.query(
      `SELECT id, name, contact, current_due
       FROM customers
       WHERE user_id = $1 AND current_due > 0
       ORDER BY current_due DESC`,
      [userId]
    );

    // 3. Fetch products and stock
    const productsResult = await pool.query(
      `SELECT id, name, sku, purchase_price, selling_price, current_stock
       FROM products
       WHERE user_id = $1 AND is_active = true
       ORDER BY id ASC`,
      [userId]
    );

    // 4. Fetch recent sales with profit and cost
    const salesResult = await pool.query(
      `SELECT s.id, s.bill_number, s.total_amount, s.payment_status, s.input_source, s.sale_date, s.created_at,
              COALESCE(SUM(si.profit), 0) AS profit,
              COALESCE(SUM(si.quantity * si.cost_price), 0) AS cost
       FROM sales s
       LEFT JOIN sale_items si ON s.id = si.sale_id
       WHERE s.user_id = $1
       GROUP BY s.id, s.bill_number, s.total_amount, s.payment_status, s.input_source, s.sale_date, s.created_at
       ORDER BY s.id DESC LIMIT 100`,
      [userId]
    );

    // Compute today's sales based on local date
    const now = new Date();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todaySales = salesResult.rows.filter(s => {
      const d = s.sale_date || s.created_at;
      if (!d) return false;
      const dObj = new Date(d);
      const sDateStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`;
      return sDateStr === todayDateStr;
    });

    const storeData = {
      purchases,
      credit_sales: creditResult.rows,
      customer_ledgers: customerLedgersResult.rows,
      products: productsResult.rows,
      recent_sales: salesResult.rows,
      today_sales: todaySales,
      today_date: todayDateStr
    };

    // Execute local RAG query
    const ragResult = await queryStoreCopilot(query, storeData, language);

    // Audit log
    try {
      await pool.query(
        `INSERT INTO ai_events (input_type, raw_payload, extracted_json, confidence, confirmed, user_id)
         VALUES ('COPILOT_RAG', $1, $2, $3, true, $4)`,
        [
          query,
          JSON.stringify(ragResult),
          ragResult.confidence || 0.9,
          userId
        ]
      );
    } catch (auditErr) {
      console.warn("Failed to audit log RAG query:", auditErr.message);
    }

    return res.json({
      success: true,
      ...ragResult
    });

  } catch (error) {
    console.error("COPILOT RAG ERROR:", error);
    return res.status(500).json({
      message: "Failed to answer question via Store Copilot",
      error: error.message
    });
  }
}


/*
|--------------------------------------------------------------------------
| AUTONOMOUS RETAIL OPERATIONS AGENT (REACT LOOP)
|--------------------------------------------------------------------------
*/

async function executeAgentTask(req, res) {
  try {
    const userId = req.user.id;
    const { task = "restock" } = req.body;

    const productsResult = await pool.query(
      `SELECT id, name, sku, purchase_price, selling_price, current_stock
       FROM products
       WHERE user_id = $1 AND is_active = true
       ORDER BY id ASC`,
      [userId]
    );

    const purchasesResult = await pool.query(
      `SELECT p.id, p.invoice_no, p.purchase_date, p.total_amount, s.name as supplier_name
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.user_id = $1
       ORDER BY p.id DESC LIMIT 40`,
      [userId]
    );

    const purchases = purchasesResult.rows;
    for (const p of purchases) {
      const itemsRes = await pool.query(
        `SELECT pi.*, pr.name as product_name
         FROM purchase_items pi
         LEFT JOIN products pr ON pi.product_id = pr.id
         WHERE pi.purchase_id = $1`,
        [p.id]
      );
      p.items = itemsRes.rows;
    }

    const creditResult = await pool.query(
      `SELECT s.id, s.bill_number, s.total_amount, s.payment_status, s.sale_date, s.created_at, c.name as customer_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.user_id = $1 AND s.payment_status IN ('CREDIT', 'PENDING', 'PARTIAL')
       ORDER BY s.id DESC LIMIT 40`,
      [userId]
    );

    const storeData = {
      products: productsResult.rows,
      purchases,
      credit_sales: creditResult.rows
    };

    const agentResult = await runAgentTask(task, storeData);

    try {
      await pool.query(
        `INSERT INTO ai_events (input_type, raw_payload, extracted_json, confidence, confirmed, user_id)
         VALUES ('AGENT_REACT', $1, $2, 0.95, false, $3)`,
        [
          task,
          JSON.stringify(agentResult),
          userId
        ]
      );
    } catch (auditErr) {
      console.warn("Failed to audit log agent task:", auditErr.message);
    }

    return res.json({
      success: true,
      ...agentResult
    });

  } catch (error) {
    console.error("AGENT EXECUTION ERROR:", error);
    return res.status(500).json({
      message: "Autonomous agent execution failed",
      error: error.message
    });
  }
}

async function approveAgentAction(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id;
    const { action_type, product_id, quantity } = req.body;

    if (action_type === "PURCHASE_ORDER_DRAFT" && product_id && quantity) {
      await client.query("BEGIN");

      const prodRes = await client.query(
        `SELECT id, name, current_stock FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [product_id, userId]
      );

      if (prodRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Product not found or unauthorized" });
      }

      const product = prodRes.rows[0];
      const addedQty = Number(quantity);

      await client.query(
        `UPDATE products SET current_stock = current_stock + $1 WHERE id = $2`,
        [addedQty, product_id]
      );

      await client.query(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, reference_id)
         VALUES ($1, 'AGENT_RESTOCK', $2, NULL)`,
        [product_id, addedQty]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: `Successfully approved reorder for ${product.name}! Stock increased by ${addedQty}.`,
        new_stock: Number(product.current_stock) + addedQty
      });
    }

    return res.json({
      success: true,
      message: "Agent action acknowledged and approved."
    });

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    console.error("AGENT APPROVAL ERROR:", error);
    return res.status(500).json({
      message: "Failed to execute agent action approval",
      error: error.message
    });
  } finally {
    client.release();
  }
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
  productMatch,
  confirmProductMatch,
  reconcilePaymentTransaction,
  confirmPaymentReconciliation,
  processVoiceSale,
  confirmVoiceSale,
  processInvoice,
  confirmInvoicePurchase,
  askStoreCopilot,
  executeAgentTask,
  approveAgentAction
};