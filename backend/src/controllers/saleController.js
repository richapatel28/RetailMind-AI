const pool = require("../config/db");


// ======================================================
// CREATE SALE
// ======================================================

const createSale = async (req, res) => {

  const client = await pool.connect();

  try {

    const {
      customer_id,
      customer_name,
      customer_phone,
      date,
      items,
      payment_mode = "CASH",
      payment_amount = 0,
      payment_reference = null,
      input_source = "MANUAL"
    } = req.body;

    // Logged-in owner
    const userId = req.user.id;


    // --------------------------------------------------
    // Validate items
    // --------------------------------------------------

    if (!items || items.length === 0) {

      return res.status(400).json({
        message: "Sale must contain at least one item"
      });

    }


    await client.query("BEGIN");


    let total = 0;


    // --------------------------------------------------
    // Validate products and stock
    // --------------------------------------------------

    for (const item of items) {

      const productResult = await client.query(
        `SELECT
           id,
           name,
           purchase_price,
           selling_price,
           current_stock
         FROM products
         WHERE id = $1
         FOR UPDATE`,
        [item.product_id]
      );


      if (productResult.rows.length === 0) {

        throw new Error(
          `Product ${item.product_id} not found`
        );

      }


      const product = productResult.rows[0];


      // Check stock

      if (Number(product.current_stock) < Number(item.quantity)) {

        throw new Error(
          `Insufficient stock for ${product.name}`
        );

      }


      // Use selling price from request
      // If not provided, use product selling price

      const sellingPrice =
        item.selling_price !== undefined
          ? Number(item.selling_price)
          : Number(product.selling_price);


      if (sellingPrice < 0) {

        throw new Error(
          `Invalid selling price for ${product.name}`
        );

      }


      total +=
        Number(item.quantity) * sellingPrice;

    }


    // --------------------------------------------------
    // Payment status
    // --------------------------------------------------

    const isCredit = String(payment_mode || "").toUpperCase() === "CREDIT";
    const paymentAmount = isCredit ? 0 : Number(payment_amount || 0);

    let paymentStatus = "PENDING";
    if (isCredit) {
      paymentStatus = "CREDIT";
    } else if (paymentAmount >= total) {
      paymentStatus = "PAID";
    } else if (paymentAmount > 0) {
      paymentStatus = "PARTIAL";
    }


    // --------------------------------------------------
    // Resolve Customer by ID or Name
    // --------------------------------------------------

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
      if (customerResult.rowCount > 0) {
        resolvedCustomerName = customerResult.rows[0].name;
      }
    }

    // --------------------------------------------------
    // Create sale
    // --------------------------------------------------

    const saleResult = await client.query(
      `INSERT INTO sales
       (
         customer_id,
         sale_date,
         total_amount,
         payment_status,
         input_source,
         user_id
       )
       VALUES
       (
         $1,
         COALESCE($2, CURRENT_DATE),
         $3,
         $4,
         $5,
         $6
       )
       RETURNING *`,
      [
        resolvedCustomerId,
        date || null,
        total,
        paymentStatus,
        input_source,
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
    sale.customer_name = resolvedCustomerName;

    // If Credit / Udhaar, update customer's current due
    if (isCredit && resolvedCustomerId) {
      await client.query(
        `UPDATE customers SET current_due = COALESCE(current_due, 0) + $1 WHERE id = $2`,
        [total, resolvedCustomerId]
      );
    }


    // --------------------------------------------------
    // Create sale items + update stock
    // --------------------------------------------------

    for (const item of items) {


      const productResult = await client.query(
        `SELECT
           name,
           purchase_price,
           selling_price
         FROM products
         WHERE id = $1`,
        [item.product_id]
      );


      const product = productResult.rows[0];


      const sellingPrice =
        item.selling_price !== undefined
          ? Number(item.selling_price)
          : Number(product.selling_price);


      const costPrice =
        Number(product.purchase_price);


      const quantity =
        Number(item.quantity);


      const itemTotal =
        quantity * sellingPrice;


      const profit =
        quantity * (sellingPrice - costPrice);


      // ------------------------------------------------
      // Insert sale item
      // ------------------------------------------------

      await client.query(
        `INSERT INTO sale_items
        (
          sale_id,
          product_id,
          quantity,
          selling_price,
          cost_price,
          total_amount,
          profit
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          sale.id,
          item.product_id,
          quantity,
          sellingPrice,
          costPrice,
          itemTotal,
          profit
        ]
      );


      // ------------------------------------------------
      // Reduce product stock
      // ------------------------------------------------

      await client.query(
        `UPDATE products
         SET current_stock = current_stock - $1
         WHERE id = $2`,
        [
          quantity,
          item.product_id
        ]
      );


      // ------------------------------------------------
      // Inventory movement
      // ------------------------------------------------

      await client.query(
        `INSERT INTO inventory_movements
        (
          product_id,
          movement_type,
          quantity,
          reference_id
        )
        VALUES ($1, 'SALE', $2, $3)`,
        [
          item.product_id,
          -quantity,
          sale.id
        ]
      );

    }


    // --------------------------------------------------
    // Create payment
    // --------------------------------------------------

    if (paymentAmount > 0) {

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
        ($1,$2,$3,$4,$5,CURRENT_DATE,$6,$7)`,
        [
          sale.id,
          resolvedCustomerId,
          paymentAmount,
          payment_mode,
          payment_reference,
          paymentStatus,
          userId
        ]
      );

    }


    // --------------------------------------------------
    // Commit transaction
    // --------------------------------------------------

    await client.query("COMMIT");


    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    res.status(201).json({

      message: "Sale created successfully",

      sale: sale

    });


  } catch (error) {

    await client.query("ROLLBACK");

    console.error("SALE ERROR:", error);

    res.status(400).json({

      message: error.message || "Sale creation failed"

    });

  } finally {

    client.release();

  }

};


// ======================================================
// GET ALL SALES
// ======================================================

const getSales = async (req, res) => {

  try {

    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         s.*,
         c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c
       ON s.customer_id = c.id
       WHERE s.user_id = $1
       ORDER BY s.id DESC`,
      [userId]
    );


    res.json({

      message: "Sales fetched successfully",

      sales: result.rows

    });


  } catch (error) {

    console.error("GET SALES ERROR:", error);

    res.status(500).json({

      message: "Failed to fetch sales"

    });

  }

};


// ======================================================
// GET SINGLE SALE
// ======================================================

const getSale = async (req, res) => {

  try {

    const userId = req.user.id;


    // -----------------------------------------------
    // Get sale
    // -----------------------------------------------

    const saleResult = await pool.query(
      `SELECT
         s.*,
         c.name AS customer_name
       FROM sales s
       LEFT JOIN customers c
       ON s.customer_id = c.id
       WHERE s.id = $1
       AND s.user_id = $2`,
      [
        req.params.id,
        userId
      ]
    );


    if (saleResult.rows.length === 0) {

      return res.status(404).json({

        message: "Sale not found"

      });

    }


    // -----------------------------------------------
    // Get sale items
    // -----------------------------------------------

    const itemsResult = await pool.query(
      `SELECT
         si.*,
         p.name AS product_name,
         p.sku
       FROM sale_items si
       JOIN products p
       ON si.product_id = p.id
       WHERE si.sale_id = $1
       ORDER BY si.id`,
      [req.params.id]
    );


    // -----------------------------------------------
    // Get payments
    // -----------------------------------------------

    const paymentsResult = await pool.query(
      `SELECT *
       FROM payments
       WHERE sale_id = $1
       AND user_id = $2
       ORDER BY id`,
      [
        req.params.id,
        userId
      ]
    );


    res.json({

      sale: saleResult.rows[0],

      items: itemsResult.rows,

      payments: paymentsResult.rows

    });


  } catch (error) {

    console.error("GET SALE ERROR:", error);

    res.status(500).json({

      message: "Failed to fetch sale"

    });

  }

};


module.exports = {

  createSale,
  getSales,
  getSale

};