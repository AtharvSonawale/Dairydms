const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  GET /api/cash-advance?date=YYYY-MM-DD OR ?seller_id=X
//  Returns all cash advance transactions for a date OR for a seller
// ══════════════════════════════════════════════════════════════
exports.getEntries = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to, seller_id } = req.query;

        if (seller_id) {
            // Verify seller belongs to centre
            const [sellerCheck] = await pool.query(
                'SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?',
                [seller_id, centreId]
            );
            if (!sellerCheck.length) {
                return res.status(403).json({
                    error: 'Access denied. Seller not found in your centre.'
                });
            }

            // REMOVED operator filter - both admin and operator see all
            const query = `
                SELECT
                    ca.id, ca.seller_id, ca.type, ca.amount,
                    ca.transaction_date, ca.remarks, ca.created_at,
                    ca.operator_id,
                    s.name AS seller_name, s.seller_code, s.seller_type,
                    o.name AS operator_name,
                    (SELECT COALESCE(SUM(CASE WHEN sd.type = 'credit' THEN sd.amount ELSE -sd.amount END), 0)
                     FROM seller_deposits sd
                     WHERE sd.seller_id = ca.seller_id AND sd.centre_id = ca.centre_id) AS deposit_balance
                FROM cash_advance ca
                JOIN sellers s ON s.seller_id = ca.seller_id
                JOIN operators o ON o.operator_id = ca.operator_id
                WHERE ca.centre_id = ?
                AND ca.seller_id = ?
                ORDER BY ca.created_at DESC
            `;

            const [rows] = await pool.query(query, [centreId, seller_id]);
            return res.json(rows);
        }

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND ca.transaction_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else if (date) {
            dateCondition = `AND ca.transaction_date = ?`;
            dateParams = [date];
        } else {
            return res.status(400).json({
                error: "Either date, from/to, or seller_id query parameter is required."
            });
        }

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT
                ca.id, ca.seller_id, ca.type, ca.amount,
                ca.transaction_date, ca.remarks, ca.created_at,
                ca.operator_id,
                s.name AS seller_name, s.seller_code, s.seller_type,
                o.name AS operator_name
            FROM cash_advance ca
            JOIN sellers s ON s.seller_id = ca.seller_id
            JOIN operators o ON o.operator_id = ca.operator_id
            WHERE ca.centre_id = ?
            ${dateCondition}
            ORDER BY ca.created_at DESC
        `;

        const [rows] = await pool.query(query, [centreId, ...dateParams]);
        return res.json(rows);

    } catch (err) {
        console.error('getEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/cash-advance/previous/:sellerId
//  Returns:
//    - total_given: Sum of all 'given' transactions
//    - total_received: Sum of all 'received' transactions
//    - pending_advance: total_given - total_received
//    - product_deduction: Sum of all product sales for the seller
//    - net_balance: pending_advance - product_deduction
//    - recent: Last 5 transactions
// ══════════════════════════════════════════════════════════════
exports.getPrevious = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { sellerId } = req.params;

        // Verify seller exists and belongs to centre
        const [sellerRows] = await pool.query(
            `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        if (!sellerRows[0]) {
            return res.status(404).json({ error: 'Seller not found.' });
        }

        // REMOVED operator access check - any operator can view any seller

        // Fetch cash advance totals - REMOVED operator filter
        const [advanceTotals] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS total_given,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS total_received
            FROM cash_advance
            WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        const totalGiven = parseFloat(advanceTotals[0].total_given || 0);
        const totalReceived = parseFloat(advanceTotals[0].total_received || 0);
        const pendingAdvance = Math.max(0, totalGiven - totalReceived);

        // Fetch product sales deductions - REMOVED operator filter
        const [productRows] = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS product_total
            FROM product_sales
            WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        const productDeduction = parseFloat(productRows[0].product_total || 0);

        // Fetch walk-in sales deductions - REMOVED operator filter
        const [walkinRows] = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS walkin_total
            FROM walkin_sales
            WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        const walkinDeduction = parseFloat(walkinRows[0].walkin_total || 0);

        // Net balance: pending_advance - (product_deduction + walkin_deduction)
        const netBalance = Math.max(0, pendingAdvance - productDeduction - walkinDeduction);

        // Last 5 transactions for mini history - REMOVED operator filter
        const [recent] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks, created_at
            FROM cash_advance
            WHERE seller_id = ? AND centre_id = ?
            ORDER BY transaction_date DESC, created_at DESC LIMIT 5`,
            [sellerId, centreId]
        );

        res.json({
            total_given: totalGiven,
            total_received: totalReceived,
            pending_advance: pendingAdvance,
            product_deduction: productDeduction,
            walkin_deduction: walkinDeduction,
            net_balance: netBalance,
            recent: recent,
        });
    } catch (err) {
        console.error('getPrevious error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  POST /api/cash-advance
//  Record a new cash advance transaction (type: 'given' | 'received')
// ══════════════════════════════════════════════════════════════
exports.createEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        const {
            seller_id,
            type,
            amount,
            transaction_date,
            remarks,
        } = req.body;

        // Validation
        if (!seller_id) {
            await conn.rollback();
            return res.status(400).json({ error: 'Seller is required.' });
        }
        if (!type || !['given', 'received'].includes(type)) {
            await conn.rollback();
            return res.status(400).json({ error: "Type must be 'given' or 'received'." });
        }
        if (!amount || parseFloat(amount) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Amount must be greater than 0.' });
        }
        if (!transaction_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Transaction date is required.' });
        }

        // Verify seller exists and belongs to the centre
        const [sellerRows] = await conn.query(
            `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!sellerRows[0]) {
            await conn.rollback();
            return res.status(404).json({ error: 'Seller not found in your centre.' });
        }

        // REMOVED operator ownership check - any operator can create advances for any seller

        // Insert the transaction
        const [result] = await conn.query(
            `INSERT INTO cash_advance
                (seller_id, operator_id, centre_id, type, amount, transaction_date, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(seller_id),
                operatorId,
                centreId,
                type,
                parseFloat(amount),
                transaction_date,
                remarks ? String(remarks).trim() : null,
            ]
        );

        await conn.commit();

        // Return the full row with seller info
        const [newRow] = await pool.query(
            `SELECT
                ca.id,
                ca.seller_id,
                ca.type,
                ca.amount,
                ca.transaction_date,
                ca.remarks,
                ca.created_at,
                ca.operator_id,
                s.name AS seller_name,
                s.seller_code,
                s.seller_type,
                o.name AS operator_name
            FROM cash_advance ca
            JOIN sellers s ON s.seller_id = ca.seller_id
            JOIN operators o ON o.operator_id = ca.operator_id
            WHERE ca.id = ? AND ca.centre_id = ?`,
            [result.insertId, centreId]
        );

        res.status(201).json(newRow[0]);
    } catch (err) {
        await conn.rollback();
        console.error('createEntry error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
//  DELETE /api/cash-advance/:id
//  Remove a cash advance transaction (operator-scoped)
// ══════════════════════════════════════════════════════════════
exports.deleteEntry = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        // Verify the entry exists and user has access
        let checkQuery = `SELECT id FROM cash_advance WHERE id = ? AND centre_id = ?`;
        let checkParams = [id, centreId];

        if (!isAdmin) {
            checkQuery += ` AND operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await pool.query(checkQuery, checkParams);
        if (!existing[0]) {
            return res.status(404).json({
                error: 'Entry not found or unauthorized.'
            });
        }

        let deleteQuery = `DELETE FROM cash_advance WHERE id = ? AND centre_id = ?`;
        let deleteParams = [id, centreId];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            deleteParams.push(operatorId);
        }

        await pool.query(deleteQuery, deleteParams);
        res.json({ message: 'Entry deleted successfully.' });
    } catch (err) {
        console.error('deleteEntry error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/cash-advance/register/:sellerId?from=YYYY-MM-DD&to=YYYY-MM-DD
//  Combined seller register: cash advance, product sales, deposits
//  + current deposit balance + current advance balance
// ══════════════════════════════════════════════════════════════
exports.getSellerRegister = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { sellerId } = req.params;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: "from and to query parameters are required." });
        }

        // Verify seller exists
        const [sellerRows] = await pool.query(
            `SELECT seller_id, name, seller_code, seller_type, deposit_per_litre
             FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        if (!sellerRows[0]) {
            return res.status(404).json({ error: "Seller not found." });
        }

        // REMOVED operator access check - any operator can view any seller

        // Cash Advance Transactions - REMOVED operator filter
        const [advanceRows] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks, created_at, operator_id
            FROM cash_advance
            WHERE seller_id = ? AND centre_id = ?
              AND transaction_date BETWEEN ? AND ?
            ORDER BY transaction_date ASC, created_at ASC`,
            [sellerId, centreId, from, to]
        );

        // Product Sales - REMOVED operator filter
        const [productRows] = await pool.query(
            `SELECT ps.sale_id, ps.product_id, ps.quantity, ps.rate, ps.total_amount,
                    ps.sale_date, ps.created_at, p.product_name, p.unit, ps.operator_id
            FROM product_sales ps
            JOIN products p ON p.product_id = ps.product_id
            WHERE ps.seller_id = ? AND ps.centre_id = ?
              AND ps.sale_date BETWEEN ? AND ?
            ORDER BY ps.sale_date ASC, ps.created_at ASC`,
            [sellerId, centreId, from, to]
        );

        // Deposits - REMOVED operator filter
        const [depositRows] = await pool.query(
            `SELECT id, type, amount, remarks, transaction_date, created_at, operator_id
            FROM seller_deposits
            WHERE seller_id = ? AND centre_id = ?
              AND transaction_date BETWEEN ? AND ?
            ORDER BY transaction_date ASC, created_at ASC`,
            [sellerId, centreId, from, to]
        );

        // Current Deposit Balance - REMOVED operator filter
        const [depositTotals] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_credit,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS total_debit
            FROM seller_deposits
            WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        const currentDepositBalance =
            parseFloat(depositTotals[0].total_credit || 0) - parseFloat(depositTotals[0].total_debit || 0);

        // Current Advance Balance - REMOVED operator filter
        const [advanceTotals] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS total_given,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS total_received
            FROM cash_advance
            WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        const currentAdvanceBalance = Math.max(
            0,
            parseFloat(advanceTotals[0].total_given || 0) - parseFloat(advanceTotals[0].total_received || 0)
        );

        res.json({
            seller: sellerRows[0],
            cash_advance: advanceRows,
            product_sales: productRows,
            deposits: depositRows,
            current_deposit_balance: currentDepositBalance,
            current_advance_balance: currentAdvanceBalance,
        });
    } catch (err) {
        console.error("getSellerRegister error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/cash-advance/summary (Admin only)
//  Get summary of all cash advances in the centre
// ══════════════════════════════════════════════════════════════
exports.getCentreSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.'
            });
        }

        const [summary] = await pool.query(
            `SELECT
                COUNT(*) AS total_transactions,
                COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS total_given,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS total_received,
                COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE -amount END), 0) AS net_balance,
                COUNT(DISTINCT seller_id) AS unique_sellers,
                COUNT(DISTINCT operator_id) AS active_operators
            FROM cash_advance
            WHERE centre_id = ?`,
            [centreId]
        );

        res.json(summary[0]);
    } catch (err) {
        console.error('getCentreSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};