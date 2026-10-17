const pool = require("../config/db");


// ======================================================
// CREATE PAYMENT
// ======================================================

const createPayment = async (req, res) => {

  const client = await pool.connect();

  try {

    const {
      sale_id,
      amount,
      mode,
      reference,
      date
    } = req.body;


    const userId = req.user.id;


    if (!sale_id || !amount || !mode) {

      return res.status(400).json({
        message: "Sale, amount and payment mode are required"
      });

    }


    await client.query("BEGIN");


    // --------------------------------------------------
    // Get sale belonging to logged-in owner
    // --------------------------------------------------

    const saleResult = await client.query(
      `SELECT *
       FROM sales
       WHERE id = $1
       AND user_id = $2
       FOR UPDATE`,
      [
        sale_id,
        userId
      ]
    );


    if (saleResult.rows.length === 0) {

      throw new Error(
        "Sale not found"
      );

    }


    const sale = saleResult.rows[0];


    // --------------------------------------------------
    // Create payment
    // --------------------------------------------------

    await client.query(
      `INSERT INTO payments
       (
         sale_id,
         customer_id,
         amount,
         mode,
         reference,
         payment_date,
         status,
         user_id
       )
       VALUES
       (
         $1,
         $2,
         $3,
         $4,
         $5,
         COALESCE($6, CURRENT_DATE),
         'COMPLETED',
         $7
       )`,
      [
        sale_id,
        sale.customer_id,
        amount,
        mode,
        reference,
        date || null,
        userId
      ]
    );


    // --------------------------------------------------
    // Calculate total completed payments
    // --------------------------------------------------

    const paidResult = await client.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS paid
       FROM payments
       WHERE sale_id = $1
       AND user_id = $2
       AND status IN ('COMPLETED', 'PAID', 'CONFIRMED')`,
      [
        sale_id,
        userId
      ]
    );


    const paid =
      Number(paidResult.rows[0].paid);


    // --------------------------------------------------
    // Update sale payment status
    // --------------------------------------------------

    let status = "PENDING";


    if (paid >= Number(sale.total_amount)) {

      status = "PAID";

    } else if (paid > 0) {

      status = "PARTIAL";

    }


    await client.query(
      `UPDATE sales
       SET payment_status = $1
       WHERE id = $2
       AND user_id = $3`,
      [
        status,
        sale_id,
        userId
      ]
    );


    await client.query("COMMIT");


    res.status(201).json({

      message: "Payment recorded successfully",

      payment_status: status

    });


  } catch (error) {

    await client.query("ROLLBACK");

    console.error("PAYMENT ERROR:", error);

    res.status(400).json({

      message:
        error.message ||
        "Payment failed"

    });

  } finally {

    client.release();

  }

};


// ======================================================
// GET ALL PAYMENTS
// ======================================================

const getPayments = async (req, res) => {

  try {

    const userId = req.user.id;


    const result = await pool.query(
      `SELECT
         p.*,
         s.total_amount AS sale_total
       FROM payments p
       JOIN sales s
       ON p.sale_id = s.id
       WHERE p.user_id = $1
       AND s.user_id = $1
       ORDER BY p.id DESC`,
      [userId]
    );


    res.json(result.rows);


  } catch (error) {

    console.error(
      "GET PAYMENTS ERROR:",
      error
    );

    res.status(500).json({

      message:
        "Failed to fetch payments"

    });

  }

};


module.exports = {

  createPayment,
  getPayments

};