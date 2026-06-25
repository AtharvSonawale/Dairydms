const pool = require('../config/db');

function generateBillNo(personId, buyerType, fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const month = String(from.getMonth() + 1).padStart(2, '0');
    const year = String(from.getFullYear()).slice(-2);
    const toDay = String(to.getDate()).padStart(2, '0');
    const idSuffix = String(personId).padStart(4, '0');
    const prefix = buyerType === 'seller' ? 'S' : 'W';
    return `${prefix}${month}${year}${toDay}${idSuffix}`;
}

// ── GET /api/walkin-payments/buyers ───────────────────────────
// Get all named buyers with their outstanding balances
exports.getBuyers = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        // REMOVED operator filter - both admin and operator see all
        // Named buyers
        const [namedRows] = await pool.query(
            `SELECT 
                'named' AS buyer_type,
                nb.buyer_id,
                NULL AS seller_id,
                nb.name,
                nb.mobile,
                COALESCE(SUM(ws.total_amount), 0) AS total_purchases,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM walkin_named_buyers nb
             LEFT JOIN walkin_sales ws 
               ON ws.buyer_id = nb.buyer_id 
               AND ws.centre_id = nb.centre_id
             WHERE nb.centre_id = ? AND nb.is_active = 1
             GROUP BY nb.buyer_id, nb.name, nb.mobile
             ORDER BY nb.name ASC`,
            [centre_id]
        );

        // Sellers who have walkin purchases (dry sellers or partial month sellers)
        const [sellerRows] = await pool.query(
            `SELECT 
                'seller' AS buyer_type,
                NULL AS buyer_id,
                s.seller_id,
                s.name,
                s.mobile,
                COALESCE(SUM(ws.total_amount), 0) AS total_purchases,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM sellers s
             INNER JOIN walkin_sales ws 
               ON ws.seller_id = s.seller_id 
               AND ws.centre_id = s.centre_id
               AND ws.buyer_id IS NULL
             WHERE s.centre_id = ? AND s.is_active = 1
             GROUP BY s.seller_id, s.name, s.mobile
             ORDER BY s.name ASC`,
            [centre_id]
        );

        const allBuyers = [...namedRows, ...sellerRows].map(r => ({
            ...r,
            outstanding_balance: parseFloat(r.outstanding_balance || 0),
            total_purchases: parseFloat(r.total_purchases || 0),
            total_paid: parseFloat(r.total_paid || 0)
        }));

        res.json(allBuyers);
    } catch (err) {
        console.error("getBuyers error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/walkin-payments/buyers ──────────────────────────
// Register a new named buyer
exports.createBuyer = async (req, res) => {
    try {
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const { name, mobile, address } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Buyer name is required' });
        }

        // Check if buyer with same name already exists in this centre
        const [existing] = await pool.query(
            `SELECT buyer_id FROM walkin_named_buyers 
             WHERE centre_id = ? AND name = ? AND is_active = 1`,
            [centre_id, name.trim()]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'A buyer with this name already exists in your centre' });
        }

        const [result] = await pool.query(
            `INSERT INTO walkin_named_buyers (operator_id, centre_id, name, mobile, address)
             VALUES (?, ?, ?, ?, ?)`,
            [operator_id, centre_id, name.trim(), mobile || null, address || null]
        );

        const [newBuyer] = await pool.query(
            `SELECT nb.*, 0 AS outstanding_balance, 0 AS total_purchases, 0 AS total_paid
             FROM walkin_named_buyers nb
             WHERE nb.buyer_id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            ...newBuyer[0],
            outstanding_balance: 0,
            total_purchases: 0,
            total_paid: 0
        });
    } catch (err) {
        console.error("createBuyer error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/outstanding-buyers ───────────────
// Get buyers with outstanding balances only
exports.getOutstandingBuyers = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        // REMOVED operator filter - both admin and operator see all
        const [namedRows] = await pool.query(
            `SELECT 
                'named' AS buyer_type,
                nb.buyer_id,
                NULL AS seller_id,
                nb.name,
                nb.mobile,
                COALESCE(SUM(ws.total_amount), 0) AS total_amount,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM walkin_named_buyers nb
             LEFT JOIN walkin_sales ws 
               ON ws.buyer_id = nb.buyer_id 
               AND ws.centre_id = nb.centre_id
             WHERE nb.centre_id = ? AND nb.is_active = 1
             GROUP BY nb.buyer_id, nb.name, nb.mobile
             HAVING outstanding_balance > 0.01
             ORDER BY outstanding_balance DESC`,
            [centre_id]
        );

        const [sellerRows] = await pool.query(
            `SELECT 
                'seller' AS buyer_type,
                NULL AS buyer_id,
                s.seller_id,
                s.name,
                s.mobile,
                COALESCE(SUM(ws.total_amount), 0) AS total_amount,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM sellers s
             INNER JOIN walkin_sales ws 
               ON ws.seller_id = s.seller_id 
               AND ws.centre_id = s.centre_id
               AND ws.buyer_id IS NULL
             WHERE s.centre_id = ? AND s.is_active = 1
             GROUP BY s.seller_id, s.name, s.mobile
             HAVING outstanding_balance > 0.01
             ORDER BY outstanding_balance DESC`,
            [centre_id]
        );

        const all = [...namedRows, ...sellerRows]
            .map(r => ({
                ...r,
                total_amount: parseFloat(r.total_amount),
                total_paid: parseFloat(r.total_paid),
                outstanding_balance: parseFloat(r.outstanding_balance)
            }))
            .sort((a, b) => b.outstanding_balance - a.outstanding_balance);

        res.json(all);
    } catch (err) {
        console.error("getOutstandingBuyers error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/payments ─────────────────────────
// Get payments with filters
exports.getPayments = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { from, to, buyer_id, seller_id, mode } = req.query;

        // REMOVED operator filter - both admin and operator see all
        let query = `
            SELECT 
                wp.payment_id,
                wp.buyer_id,
                wp.seller_id,
                wp.amount,
                wp.payment_mode,
                wp.remarks,
                wp.payment_date,
                wp.created_at,
                COALESCE(nb.name, s.name) AS buyer_name,
                COALESCE(nb.mobile, s.mobile) AS mobile,
                CASE WHEN wp.seller_id IS NOT NULL THEN 'seller' ELSE 'named' END AS buyer_type
            FROM walkin_payments wp
            LEFT JOIN walkin_named_buyers nb ON nb.buyer_id = wp.buyer_id AND nb.centre_id = wp.centre_id
            LEFT JOIN sellers s ON s.seller_id = wp.seller_id AND s.centre_id = wp.centre_id
            WHERE wp.centre_id = ?
        `;
        const params = [centre_id];

        if (from && to) {
            query += ` AND wp.payment_date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        if (buyer_id) {
            query += ` AND wp.buyer_id = ?`;
            params.push(buyer_id);
        }

        if (seller_id) {
            query += ` AND wp.seller_id = ?`;
            params.push(seller_id);
        }

        if (mode && mode !== 'all') {
            query += ` AND wp.payment_mode = ?`;
            params.push(mode);
        }

        query += ` ORDER BY wp.payment_date DESC, wp.created_at DESC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("getPayments error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/walkin-payments/payments ────────────────────────
// Record a new payment and apply to outstanding sales
exports.createPayment = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { buyer_id, seller_id, amount, payment_mode, remarks, payment_date } = req.body;

        // Validation
        if (!buyer_id && !seller_id) {
            await conn.rollback();
            return res.status(400).json({ error: 'Buyer ID or Seller ID is required' });
        }

        // Verify buyer/seller exists and belongs to centre
        if (buyer_id) {
            const [buyerCheck] = await conn.query(
                `SELECT buyer_id, name FROM walkin_named_buyers 
                 WHERE buyer_id = ? AND centre_id = ? AND is_active = 1`,
                [buyer_id, centre_id]
            );
            if (buyerCheck.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Buyer not found in your centre' });
            }
        } else {
            const [sellerCheck] = await conn.query(
                `SELECT seller_id, name FROM sellers 
                 WHERE seller_id = ? AND centre_id = ? AND is_active = 1`,
                [seller_id, centre_id]
            );
            if (sellerCheck.length === 0) {
                await conn.rollback();
                return res.status(404).json({ error: 'Seller not found in your centre' });
            }

            // REMOVED operator ownership check - any operator can use any seller
        }

        const paymentAmount = parseFloat(amount);
        const paymentDate = payment_date || new Date().toISOString().split('T')[0];

        // Insert payment record
        const [result] = await conn.query(
            `INSERT INTO walkin_payments 
             (operator_id, centre_id, buyer_id, seller_id, amount, payment_mode, remarks, payment_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [operator_id, centre_id, buyer_id || null, seller_id || null,
                paymentAmount, payment_mode || 'cash', remarks || null, paymentDate]
        );

        const unpaidWhere = buyer_id
            ? `buyer_id = ? AND centre_id = ?`
            : `seller_id = ? AND buyer_id IS NULL AND centre_id = ?`;
        const unpaidParam = buyer_id ? buyer_id : seller_id;

        const [unpaidSales] = await conn.query(
            `SELECT sale_id, total_amount, COALESCE(amount_paid, 0) AS paid
             FROM walkin_sales
             WHERE ${unpaidWhere}
               AND (amount_paid IS NULL OR amount_paid < total_amount)
             ORDER BY sale_date ASC, sale_id ASC`,
            [unpaidParam, centre_id]
        );

        // Distribute payment across sales
        let remainingToApply = paymentAmount;
        let salesUpdated = 0;

        for (const sale of unpaidSales) {
            if (remainingToApply <= 0.01) break;

            const owed = parseFloat(sale.total_amount) - parseFloat(sale.paid);
            const toApply = Math.min(remainingToApply, owed);
            const newPaid = parseFloat(sale.paid) + toApply;

            await conn.query(
                `UPDATE walkin_sales SET amount_paid = ? WHERE sale_id = ? AND centre_id = ?`,
                [newPaid, sale.sale_id, centre_id]
            );
            remainingToApply -= toApply;
            salesUpdated++;
        }

        await conn.commit();

        // Get the created payment with buyer details
        const [newPayment] = await conn.query(
            `SELECT wp.*, nb.name AS buyer_name, nb.mobile 
             FROM walkin_payments wp
             LEFT JOIN walkin_named_buyers nb ON nb.buyer_id = wp.buyer_id
             WHERE wp.payment_id = ?`,
            [result.insertId]
        );

        // Get updated outstanding balance
        const balanceWhere = buyer_id
            ? `buyer_id = ? AND centre_id = ?`
            : `seller_id = ? AND buyer_id IS NULL AND centre_id = ?`;
        const balanceParam = buyer_id ? buyer_id : seller_id;

        const [[balanceRow]] = await conn.query(
            `SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, total_amount)), 0) AS outstanding_balance
             FROM walkin_sales
             WHERE ${balanceWhere}`,
            [balanceParam, centre_id]
        );

        res.status(201).json({
            ...newPayment[0],
            outstanding_balance: parseFloat(balanceRow.outstanding_balance),
            sales_updated: salesUpdated,
            amount_applied: paymentAmount - remainingToApply
        });
    } catch (err) {
        await conn.rollback();
        console.error("createPayment error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── DELETE /api/walkin-payments/payments/:id ──────────────────
// Delete a payment and recalculate all balances
exports.deletePayment = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        // Get payment details before deletion
        const [payment] = await conn.query(
            `SELECT * FROM walkin_payments WHERE payment_id = ? AND centre_id = ?`,
            [id, centre_id]
        );

        if (payment.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: 'Payment not found in your centre' });
        }

        // Check ownership
        if (!isAdmin && payment[0].operator_id !== operator_id) {
            await conn.rollback();
            return res.status(403).json({ error: 'Not authorized to delete this payment' });
        }

        const buyer_id = payment[0].buyer_id;
        const seller_id = payment[0].seller_id;

        // Delete the payment
        await conn.query(`DELETE FROM walkin_payments WHERE payment_id = ? AND centre_id = ?`, [id, centre_id]);

        // Get all remaining payments for this buyer/seller
        const remainingWhere = buyer_id
            ? `buyer_id = ? AND centre_id = ?`
            : `seller_id = ? AND centre_id = ?`;
        const remainingParam = buyer_id ? buyer_id : seller_id;

        const [remainingPayments] = await conn.query(
            `SELECT amount FROM walkin_payments 
             WHERE ${remainingWhere}
             ORDER BY payment_date ASC, created_at ASC`,
            [remainingParam, centre_id]
        );

        // Get all sales for this buyer/seller
        const salesWhere = buyer_id
            ? `buyer_id = ? AND centre_id = ?`
            : `seller_id = ? AND buyer_id IS NULL AND centre_id = ?`;
        const salesParam = buyer_id ? buyer_id : seller_id;

        const [sales] = await conn.query(
            `SELECT sale_id, total_amount
             FROM walkin_sales
             WHERE ${salesWhere}
             ORDER BY sale_date ASC, sale_id ASC`,
            [salesParam, centre_id]
        );

        // Reset all amount_paid to 0
        for (const sale of sales) {
            await conn.query(
                `UPDATE walkin_sales SET amount_paid = 0 WHERE sale_id = ? AND centre_id = ?`,
                [sale.sale_id, centre_id]
            );
        }

        // Re-distribute all remaining payments
        let totalToDistribute = remainingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

        for (const sale of sales) {
            if (totalToDistribute <= 0.01) break;
            const toApply = Math.min(totalToDistribute, parseFloat(sale.total_amount));
            await conn.query(
                `UPDATE walkin_sales SET amount_paid = ? WHERE sale_id = ? AND centre_id = ?`,
                [toApply, sale.sale_id, centre_id]
            );
            totalToDistribute -= toApply;
        }

        await conn.commit();
        res.json({
            message: 'Payment deleted and balances recalculated successfully',
            payments_recalculated: remainingPayments.length,
            sales_updated: sales.length
        });
    } catch (err) {
        await conn.rollback();
        console.error("deletePayment error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/walkin-payments/buyer-balance/:buyerId ───────────
// Get current outstanding balance for a specific buyer
exports.getBuyerBalance = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { buyerId } = req.params;
        const { type } = req.query; // 'named' or 'seller'

        const whereClause = type === 'seller'
            ? `ws.seller_id = ? AND ws.centre_id = ?`
            : `ws.buyer_id = ? AND ws.centre_id = ?`;

        const [[row]] = await pool.query(
            `SELECT 
                COALESCE(SUM(ws.total_amount), 0) AS total_purchases,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM walkin_sales ws
             WHERE ${whereClause}`,
            [buyerId, centre_id]
        );
        res.json({
            outstanding_balance: parseFloat(row.outstanding_balance),
            total_purchases: parseFloat(row.total_purchases),
            total_paid: parseFloat(row.total_paid)
        });
    } catch (err) {
        console.error("getBuyerBalance error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/buyer-payments/:buyerId ──────────
// Get all payments for a specific buyer
exports.getBuyerPayments = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { buyerId } = req.params;
        const { type } = req.query; // 'named' or 'seller'

        const whereClause = type === 'seller'
            ? `wp.seller_id = ? AND wp.centre_id = ?`
            : `wp.buyer_id = ? AND wp.centre_id = ?`;

        const [rows] = await pool.query(
            `SELECT wp.*, 
                COALESCE(nb.name, s.name) AS buyer_name,
                COALESCE(nb.mobile, s.mobile) AS mobile
             FROM walkin_payments wp
             LEFT JOIN walkin_named_buyers nb ON nb.buyer_id = wp.buyer_id
             LEFT JOIN sellers s ON s.seller_id = wp.seller_id
             WHERE ${whereClause}
             ORDER BY wp.payment_date DESC, wp.created_at DESC`,
            [buyerId, centre_id]
        );

        res.json(rows);
    } catch (err) {
        console.error("getBuyerPayments error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/walkin-payments/clear-bill ──────────────────────
// Clear entire bill for a buyer (full payment)
exports.clearBuyerBill = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { buyer_id, seller_id, amount_paid, outstanding } = req.body;

        if ((!buyer_id && !seller_id) || amount_paid == null) {
            await conn.rollback();
            return res.status(400).json({ error: 'buyer_id or seller_id and amount_paid required' });
        }

        const paid = parseFloat(amount_paid);
        const totalOwed = parseFloat(outstanding);

        if (paid <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Amount paid must be greater than 0' });
        }

        if (paid > totalOwed + 0.01) {
            await conn.rollback();
            return res.status(400).json({ error: 'Amount paid cannot exceed outstanding balance' });
        }

        const remaining = Math.max(0, totalOwed - paid);

        // Get buyer/seller name for remarks
        let personName = 'Buyer';
        if (buyer_id) {
            const [buyerInfo] = await conn.query(
                `SELECT name FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?`,
                [buyer_id, centre_id]
            );
            personName = buyerInfo[0]?.name || 'Buyer';
        } else {
            const [sellerInfo] = await conn.query(
                `SELECT name FROM sellers WHERE seller_id = ? AND centre_id = ?`,
                [seller_id, centre_id]
            );
            personName = sellerInfo[0]?.name || 'Seller';
        }

        // Record the payment in walkin_payments table
        const [paymentResult] = await conn.query(
            `INSERT INTO walkin_payments 
             (operator_id, centre_id, buyer_id, seller_id, amount, payment_mode, remarks, payment_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [operator_id, centre_id, buyer_id || null, seller_id || null,
                paid, 'cash', `Bill clearance payment - ${personName}`,
                new Date().toISOString().split('T')[0]]
        );

        // Get all unpaid/partial sales for this buyer, oldest first
        const clearWhere = buyer_id
            ? `buyer_id = ? AND centre_id = ?`
            : `seller_id = ? AND buyer_id IS NULL AND centre_id = ?`;
        const clearParam = buyer_id ? buyer_id : seller_id;

        const [sales] = await conn.query(
            `SELECT sale_id, total_amount, COALESCE(amount_paid, 0) AS paid
             FROM walkin_sales
             WHERE ${clearWhere}
               AND (amount_paid IS NULL OR amount_paid < total_amount)
             ORDER BY sale_date ASC, sale_id ASC`,
            [clearParam, centre_id]
        );

        // Distribute payment across sales
        let budgetLeft = paid;
        let salesCleared = 0;

        for (const sale of sales) {
            if (budgetLeft <= 0.01) break;
            const owed = parseFloat(sale.total_amount) - parseFloat(sale.paid);
            const toApply = Math.min(budgetLeft, owed);
            const newPaid = parseFloat(sale.paid) + toApply;
            await conn.query(
                `UPDATE walkin_sales SET amount_paid = ? WHERE sale_id = ? AND centre_id = ?`,
                [newPaid, sale.sale_id, centre_id]
            );
            budgetLeft -= toApply;
            salesCleared++;
        }

        await conn.commit();
        res.json({
            success: true,
            payment_id: paymentResult.insertId,
            paid,
            remaining,
            sales_cleared: salesCleared,
            message: remaining > 0.01
                ? `₹${remaining.toFixed(2)} carries forward as remaining balance`
                : 'Bill fully cleared successfully',
        });
    } catch (err) {
        await conn.rollback();
        console.error("clearBuyerBill error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/walkin-payments/summary ──────────────────────────
// Get payment summary for a date range
exports.getPaymentSummary = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: 'from and to dates are required' });
        }

        // REMOVED operator filter - both admin and operator see all
        let query = `
            SELECT 
                COALESCE(SUM(amount), 0) AS total_received,
                COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END), 0) AS cash_total,
                COALESCE(SUM(CASE WHEN payment_mode = 'upi' THEN amount ELSE 0 END), 0) AS upi_total,
                COALESCE(SUM(CASE WHEN payment_mode = 'credit' THEN amount ELSE 0 END), 0) AS credit_total,
                COUNT(*) AS total_transactions
            FROM walkin_payments
            WHERE centre_id = ?
            AND payment_date BETWEEN ? AND ?
        `;

        const [rows] = await pool.query(query, [centre_id, from, to]);

        // Also get total outstanding across all buyers
        const [[outstandingRow]] = await pool.query(
            `SELECT COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM walkin_sales ws
             INNER JOIN walkin_named_buyers nb ON nb.buyer_id = ws.buyer_id
             WHERE ws.centre_id = ?`,
            [centre_id]
        );

        res.json({
            total_received: parseFloat(rows[0].total_received),
            cash_total: parseFloat(rows[0].cash_total),
            upi_total: parseFloat(rows[0].upi_total),
            credit_total: parseFloat(rows[0].credit_total),
            total_transactions: rows[0].total_transactions,
            total_outstanding: parseFloat(outstandingRow.outstanding_balance || 0)
        });
    } catch (err) {
        console.error("getPaymentSummary error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/buyer-statement/:buyerId ─────────
// Get complete statement for a buyer (all sales and payments)
exports.getBuyerStatement = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { buyerId } = req.params;
        const { from, to } = req.query;

        // Get buyer details
        const [buyer] = await pool.query(
            `SELECT * FROM walkin_named_buyers 
             WHERE buyer_id = ? AND centre_id = ? AND is_active = 1`,
            [buyerId, centre_id]
        );

        if (buyer.length === 0) {
            return res.status(404).json({ error: 'Buyer not found in your centre' });
        }

        // Get all sales for this buyer - REMOVED operator filter
        let salesQuery = `
            SELECT 
                'sale' as type,
                sale_date as date,
                sale_id as reference_id,
                quantity,
                mrp,
                total_amount as amount,
                COALESCE(amount_paid, 0) as paid,
                (total_amount - COALESCE(amount_paid, 0)) as balance,
                payment_mode,
                shift
            FROM walkin_sales
            WHERE buyer_id = ? AND centre_id = ?
        `;
        const params = [buyerId, centre_id];

        if (from && to) {
            salesQuery += ` AND sale_date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        // Get all payments for this buyer - REMOVED operator filter
        let paymentsQuery = `
            SELECT 
                'payment' as type,
                payment_date as date,
                payment_id as reference_id,
                NULL as quantity,
                NULL as mrp,
                amount,
                amount as paid,
                0 as balance,
                payment_mode,
                NULL as shift
            FROM walkin_payments
            WHERE buyer_id = ? AND centre_id = ?
        `;

        const paymentParams = [buyerId, centre_id];

        if (from && to) {
            paymentsQuery += ` AND payment_date BETWEEN ? AND ?`;
            paymentParams.push(from, to);
        }

        const [sales] = await pool.query(salesQuery, params);
        const [payments] = await pool.query(paymentsQuery, paymentParams);

        // Combine and sort by date
        const statement = [...sales, ...payments].sort((a, b) =>
            new Date(a.date) - new Date(b.date)
        );

        // Calculate running balance
        let runningBalance = 0;
        const statementWithBalance = statement.map(entry => {
            if (entry.type === 'sale') {
                runningBalance += parseFloat(entry.amount);
            } else {
                runningBalance -= parseFloat(entry.amount);
            }
            return { ...entry, running_balance: runningBalance };
        });

        // Calculate summary
        const total_sales = sales.reduce((sum, s) => sum + parseFloat(s.amount), 0);
        const total_payments = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const current_balance = total_sales - total_payments;

        res.json({
            buyer: buyer[0],
            statement: statementWithBalance,
            summary: {
                total_sales,
                total_payments,
                current_balance,
                total_transactions: statement.length,
                sales_count: sales.length,
                payments_count: payments.length
            }
        });
    } catch (err) {
        console.error("getBuyerStatement error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/sales-for-range ─────────────────
// Get all sales (milk purchases) within date range
exports.getSalesForRange = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { from, to } = req.query;

        // REMOVED operator filter - both admin and operator see all
        let query = `
            SELECT 
                ws.sale_id,
                ws.buyer_id,
                ws.seller_id,
                ws.quantity,
                ws.total_amount,
                ws.amount_paid,
                ws.sale_date,
                COALESCE(nb.name, s.name) AS buyer_name,
                CASE 
                    WHEN ws.seller_id IS NOT NULL THEN 'seller'
                    WHEN ws.buyer_id IS NOT NULL THEN 'named'
                    ELSE 'anonymous'
                END AS buyer_type
            FROM walkin_sales ws
            LEFT JOIN walkin_named_buyers nb ON nb.buyer_id = ws.buyer_id AND nb.centre_id = ws.centre_id
            LEFT JOIN sellers s ON s.seller_id = ws.seller_id AND s.centre_id = ws.centre_id
            WHERE ws.centre_id = ?
            AND ws.sale_date BETWEEN ? AND ?
            AND (ws.buyer_id IS NOT NULL OR ws.seller_id IS NOT NULL)
            ORDER BY ws.sale_date ASC
        `;

        const [rows] = await pool.query(query, [centre_id, from, to]);

        res.json(rows.map(r => ({
            ...r,
            sale_date: r.sale_date instanceof Date
                ? `${r.sale_date.getFullYear()}-${String(r.sale_date.getMonth() + 1).padStart(2, '0')}-${String(r.sale_date.getDate()).padStart(2, '0')}`
                : String(r.sale_date || '').split('T')[0].slice(0, 10),
        })));
    } catch (err) {
        console.error("getSalesForRange error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/walkin-payments/buyers-with-activity ────────────
// Get buyers who have milk purchases in the selected date range
exports.getBuyersWithActivity = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { from, to } = req.query;

        // REMOVED operator filter - both admin and operator see all
        // Get named buyers with sales in date range
        const [namedRows] = await pool.query(
            `SELECT 
                'named' AS buyer_type,
                nb.buyer_id,
                NULL AS seller_id,
                nb.name,
                nb.mobile,
                COALESCE(SUM(ws.total_amount), 0) AS total_purchases,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance,
                MIN(ws.sale_date) AS first_sale_date,
                MAX(ws.sale_date) AS last_sale_date
            FROM walkin_named_buyers nb
            INNER JOIN walkin_sales ws 
                ON ws.buyer_id = nb.buyer_id 
                AND ws.centre_id = nb.centre_id
            WHERE nb.centre_id = ? AND ws.sale_date BETWEEN ? AND ? AND nb.is_active = 1
            GROUP BY nb.buyer_id, nb.name, nb.mobile
            ORDER BY nb.name ASC`,
            [centre_id, from, to]
        );

        // Get sellers with sales in date range
        const [sellerRows] = await pool.query(
            `SELECT 
                'seller' AS buyer_type,
                NULL AS buyer_id,
                s.seller_id,
                s.name,
                s.mobile,
                COALESCE(SUM(ws.total_amount), 0) AS total_purchases,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance,
                MIN(ws.sale_date) AS first_sale_date,
                MAX(ws.sale_date) AS last_sale_date
            FROM sellers s
            INNER JOIN walkin_sales ws 
                ON ws.seller_id = s.seller_id 
                AND ws.centre_id = s.centre_id
                AND ws.buyer_id IS NULL
            WHERE s.centre_id = ? AND ws.sale_date BETWEEN ? AND ? AND s.is_active = 1
            GROUP BY s.seller_id, s.name, s.mobile
            ORDER BY s.name ASC`,
            [centre_id, from, to]
        );

        const allBuyers = [...namedRows, ...sellerRows].map(r => ({
            ...r,
            outstanding_balance: parseFloat(r.outstanding_balance || 0),
            total_purchases: parseFloat(r.total_purchases || 0),
            total_paid: parseFloat(r.total_paid || 0)
        }));

        res.json(allBuyers);
    } catch (err) {
        console.error("getBuyersWithActivity error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/monthly-summary ─────────────────
// Get monthly payment summary with opening/closing balances
exports.getMonthlySummary = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { year, month } = req.query;

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        // REMOVED operator filter - both admin and operator see all
        let paymentQuery = `
            SELECT 
                SUM(amount) AS total_payments,
                SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END) AS cash_total,
                SUM(CASE WHEN payment_mode = 'upi' THEN amount ELSE 0 END) AS upi_total,
                SUM(CASE WHEN payment_mode = 'credit' THEN amount ELSE 0 END) AS credit_total
            FROM walkin_payments
            WHERE centre_id = ?
            AND payment_date BETWEEN ? AND ?
        `;

        // Get all payments for the month
        const [payments] = await pool.query(paymentQuery, [centre_id, startDate, endDate]);

        // Get total sales for the month - REMOVED operator filter
        const [sales] = await pool.query(
            `SELECT SUM(total_amount) AS total_sales
             FROM walkin_sales
             WHERE centre_id = ?
             AND sale_date BETWEEN ? AND ?
             AND (buyer_id IS NOT NULL OR seller_id IS NOT NULL)`,
            [centre_id, startDate, endDate]
        );

        // Get opening balance (outstanding from previous month)
        const previousMonthEnd = new Date(year, month - 1, 0).toISOString().split('T')[0];
        const [openingBalance] = await pool.query(
            `SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, 0)), 0) AS opening_balance
             FROM walkin_sales
             WHERE centre_id = ?
             AND sale_date <= ?
             AND (buyer_id IS NOT NULL OR seller_id IS NOT NULL)
             AND (amount_paid IS NULL OR amount_paid < total_amount)`,
            [centre_id, previousMonthEnd]
        );

        res.json({
            month: parseInt(month),
            year: parseInt(year),
            start_date: startDate,
            end_date: endDate,
            opening_balance: parseFloat(openingBalance[0]?.opening_balance || 0),
            total_sales: parseFloat(sales[0]?.total_sales || 0),
            total_payments: parseFloat(payments[0]?.total_payments || 0),
            cash_total: parseFloat(payments[0]?.cash_total || 0),
            upi_total: parseFloat(payments[0]?.upi_total || 0),
            credit_total: parseFloat(payments[0]?.credit_total || 0),
            closing_balance: parseFloat(openingBalance[0]?.opening_balance || 0) +
                parseFloat(sales[0]?.total_sales || 0) -
                parseFloat(payments[0]?.total_payments || 0)
        });
    } catch (err) {
        console.error("getMonthlySummary error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-payments/search-bills ─────────────────────
exports.searchBills = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const q = (req.query.q || '').trim();
        const like = `%${q}%`;

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT
                bill_id, bill_no, buyer_id, seller_id, buyer_type, buyer_name,
                from_date, to_date, total_sales_amount, amount_paid,
                previous_balance, remaining_balance, paid_at
            FROM walkin_bill_master
            WHERE centre_id = ?
            AND (bill_no LIKE ? OR buyer_name LIKE ?)
            ORDER BY paid_at DESC
            LIMIT 100
        `;

        const [rows] = await pool.query(query, [centre_id, like, like]);
        res.json(rows);
    } catch (err) {
        console.error('searchBills error:', err);
        res.status(500).json({ error: 'Failed to search bills' });
    }
};

// ── GET /api/walkin-payments/bill/:bill_no ────────────────────
exports.getBillDetail = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { bill_no } = req.params;

        // REMOVED operator filter - both admin and operator can view
        const [[payment]] = await pool.query(
            `SELECT * FROM walkin_bill_master WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centre_id]
        );
        if (!payment) return res.status(404).json({ error: 'Bill not found in your centre' });

        const [entries] = await pool.query(
            `SELECT * FROM walkin_bill_sales_snapshot
             WHERE bill_id = ?
             ORDER BY sale_date ASC, shift ASC`,
            [payment.bill_id]
        );

        res.json({ payment, entries });
    } catch (err) {
        console.error('getBillDetail error:', err);
        res.status(500).json({ error: 'Failed to load bill' });
    }
};

// ── POST /api/walkin-payments/bills/save ──────────────────────
exports.saveBill = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { buyer_id, seller_id, buyer_type, from_date, to_date, amount_paid } = req.body;

        if (!buyer_type || !from_date || !to_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'buyer_type, from_date, to_date are required' });
        }

        const personId = buyer_type === 'seller' ? seller_id : buyer_id;
        if (!personId) {
            await conn.rollback();
            return res.status(400).json({ error: 'buyer_id or seller_id is required' });
        }

        // ── 1. Prevent duplicate ───────────────────────────────────
        const dupWhere = buyer_type === 'seller'
            ? 'buyer_type = ? AND seller_id = ? AND from_date = ? AND to_date = ? AND centre_id = ?'
            : 'buyer_type = ? AND buyer_id = ? AND from_date = ? AND to_date = ? AND centre_id = ?';

        const [[existing]] = await conn.query(
            `SELECT bill_id FROM walkin_bill_master
             WHERE ${dupWhere}`,
            [buyer_type, personId, from_date, to_date, centre_id]
        );
        if (existing) {
            await conn.rollback();
            return res.status(409).json({ error: 'Bill already exists for this buyer and period' });
        }

        // ── 2. Buyer name snapshot ─────────────────────────────────
        let buyerName = 'Unknown';
        if (buyer_type === 'seller' && seller_id) {
            const [[s]] = await conn.query(
                'SELECT name FROM sellers WHERE seller_id = ? AND centre_id = ?',
                [seller_id, centre_id]
            );
            if (s) buyerName = s.name;
        } else if (buyer_id) {
            const [[b]] = await conn.query(
                'SELECT name FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?',
                [buyer_id, centre_id]
            );
            if (b) buyerName = b.name;
        }

        // ── 3. Fetch sales in range ────────────────────────────────
        const salesWhere = buyer_type === 'seller'
            ? 'seller_id = ? AND buyer_id IS NULL AND centre_id = ?'
            : 'buyer_id = ? AND centre_id = ?';

        const [sales] = await conn.query(
            `SELECT sale_id, sale_date, shift, milk_type, quantity, mrp, total_amount
             FROM walkin_sales
             WHERE ${salesWhere}
               AND sale_date BETWEEN ? AND ?`,
            [personId, centre_id, from_date, to_date]
        );

        const totalSalesAmount = sales.reduce(
            (sum, s) => sum + parseFloat(s.total_amount || 0), 0
        );

        // ── 4. Previous outstanding balance ────────────────────────
        const [[prevSales]] = await conn.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS total
             FROM walkin_sales
             WHERE ${salesWhere} AND sale_date < ?`,
            [personId, centre_id, from_date]
        );

        const paidWhere = buyer_type === 'seller'
            ? 'seller_id = ? AND centre_id = ?'
            : 'buyer_id = ? AND centre_id = ?';

        const [[prevPaid]] = await conn.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM walkin_payments
             WHERE ${paidWhere} AND payment_date < ?`,
            [personId, centre_id, from_date]
        );

        const previousBalance = Math.max(
            0,
            parseFloat(prevSales.total) - parseFloat(prevPaid.total)
        );

        const paidAmt = parseFloat(amount_paid || 0);
        const remaining = Math.max(0, totalSalesAmount + previousBalance - paidAmt);
        const bill_no = generateBillNo(personId, buyer_type, from_date, to_date);

        // ── 5. Insert master ───────────────────────────────────────
        const [masterResult] = await conn.query(
            `INSERT INTO walkin_bill_master
               (bill_no, operator_id, centre_id, buyer_id, seller_id, buyer_type, buyer_name,
                from_date, to_date, total_sales_amount, amount_paid,
                previous_balance, remaining_balance, paid_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                bill_no, operator_id, centre_id,
                buyer_id ?? null,
                seller_id ?? null,
                buyer_type, buyerName,
                from_date, to_date,
                totalSalesAmount.toFixed(2),
                paidAmt.toFixed(2),
                previousBalance.toFixed(2),
                remaining.toFixed(2),
            ]
        );
        const billId = masterResult.insertId;

        // ── 6. Snapshot sales rows ─────────────────────────────────
        if (sales.length > 0) {
            await conn.query(
                `INSERT INTO walkin_bill_sales_snapshot
                   (bill_id, sale_id, centre_id, sale_date, shift, milk_type, quantity, mrp, total_amount)
                 VALUES ?`,
                [sales.map(s => [
                    billId, s.sale_id, centre_id, s.sale_date,
                    s.shift, s.milk_type, s.quantity, s.mrp, s.total_amount
                ])]
            );
        }


        await conn.commit();
        res.json({
            bill_no, bill_id: billId,
            total_sales_amount: totalSalesAmount,
            amount_paid: paidAmt,
            previous_balance: previousBalance,
            remaining_balance: remaining,
        });
    } catch (err) {
        await conn.rollback();
        console.error('saveBill error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Bill number already exists' });
        }
        res.status(500).json({ error: 'Failed to save walkin bill' });
    } finally {
        conn.release();
    }
};

// ── DELETE /api/walkin-payments/bill/:bill_no ─────────────────
exports.deleteBill = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { bill_no } = req.params;

        let query = `SELECT * FROM walkin_bill_master WHERE bill_no = ? AND centre_id = ?`;
        let params = [bill_no, centre_id];

        if (!isAdmin) {
            query += ` AND operator_id = ?`;
            params.push(operator_id);
        }

        const [[bill]] = await conn.query(query, params);
        if (!bill) {
            await conn.rollback();
            return res.status(404).json({ error: 'Bill not found in your centre' });
        }

        // Delete master (CASCADE removes snapshot)
        await conn.query(
            `DELETE FROM walkin_bill_master WHERE bill_id = ? AND centre_id = ?`,
            [bill.bill_id, centre_id]
        );

        await conn.commit();
        res.json({ success: true, bill_no });
    } catch (err) {
        await conn.rollback();
        console.error('deleteBill error:', err);
        res.status(500).json({ error: 'Failed to delete walkin bill' });
    } finally {
        conn.release();
    }
};