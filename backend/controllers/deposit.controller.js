const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  GET /api/deposits?date=YYYY-MM-DD OR ?seller_id=X
//  Returns all deposits for a date OR all deposits for a seller
// ══════════════════════════════════════════════════════════════
exports.getDeposits = async (req, res) => {
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
                    d.id, d.seller_id, d.type, d.amount, d.remarks,
                    d.transaction_date, d.created_at, d.operator_id,
                    s.name AS seller_name, s.seller_code, s.seller_type, s.deposit_per_litre,
                    o.name AS operator_name,
                    (
                        SELECT SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END)
                        FROM seller_deposits
                        WHERE seller_id = d.seller_id
                          AND centre_id = d.centre_id
                          AND (transaction_date < d.transaction_date 
                               OR (transaction_date = d.transaction_date AND created_at <= d.created_at))
                    ) AS running_balance
                FROM seller_deposits d
                JOIN sellers s ON s.seller_id = d.seller_id
                JOIN operators o ON o.operator_id = d.operator_id
                WHERE d.centre_id = ?
                AND d.seller_id = ?
                ORDER BY d.transaction_date DESC, d.created_at DESC
            `;

            const [rows] = await pool.query(query, [centreId, seller_id]);
            return res.json(rows);
        }

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND d.transaction_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else if (date) {
            dateCondition = `AND d.transaction_date = ?`;
            dateParams = [date];
        } else {
            return res.status(400).json({
                error: "Either date, from/to, or seller_id query parameter is required."
            });
        }

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT
                d.id, d.seller_id, d.type, d.amount, d.remarks,
                d.transaction_date, d.created_at, d.operator_id,
                s.name AS seller_name, s.seller_code, s.seller_type, s.deposit_per_litre,
                o.name AS operator_name
            FROM seller_deposits d
            JOIN sellers s ON s.seller_id = d.seller_id
            JOIN operators o ON o.operator_id = d.operator_id
            WHERE d.centre_id = ?
            ${dateCondition}
            ORDER BY d.created_at DESC
        `;

        const [rows] = await pool.query(query, [centreId, ...dateParams]);
        return res.json(rows);

    } catch (err) {
        console.error("getDeposits error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/deposits/balance/:sellerId
//  Returns:
//    - total_credit: Sum of all 'credit' transactions
//    - total_debit: Sum of all 'debit' transactions
//    - net_balance: total_credit - total_debit
//    - deposit_per_litre: Deposit rate from seller's profile
//    - recent: Last 5 transactions
// ══════════════════════════════════════════════════════════════
exports.getBalance = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { sellerId } = req.params;

        // Verify seller exists and belongs to the centre
        const [sellerRows] = await pool.query(
            `SELECT seller_id, deposit_per_litre FROM sellers
             WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );
        if (!sellerRows[0]) {
            return res.status(404).json({ error: "Seller not found." });
        }

        // REMOVED operator access check - any operator can view any seller

        // Running totals - REMOVED operator filter
        const [totals] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_credit,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS total_debit
            FROM seller_deposits
            WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        const totalCredit = parseFloat(totals[0].total_credit || 0);
        const totalDebit = parseFloat(totals[0].total_debit || 0);
        const netBalance = totalCredit - totalDebit;

        // Last 5 transactions for mini history - REMOVED operator filter
        const [recent] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks, created_at, operator_id
            FROM seller_deposits
            WHERE seller_id = ? AND centre_id = ?
            ORDER BY transaction_date DESC, created_at DESC LIMIT 5`,
            [sellerId, centreId]
        );

        res.json({
            total_credit: totalCredit,
            total_debit: totalDebit,
            net_balance: netBalance,
            deposit_per_litre: sellerRows[0].deposit_per_litre,
            recent: recent,
        });
    } catch (err) {
        console.error("getBalance error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  POST /api/deposits
//  Record a new deposit transaction (type: 'credit' | 'debit')
// ══════════════════════════════════════════════════════════════
exports.createDeposit = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { seller_id, type, amount, transaction_date, remarks } = req.body;

        // Validation
        if (!seller_id) {
            await conn.rollback();
            return res.status(400).json({ error: "Seller is required." });
        }
        if (!type || !["credit", "debit"].includes(type)) {
            await conn.rollback();
            return res.status(400).json({ error: "Type must be 'credit' or 'debit'." });
        }
        if (!amount || parseFloat(amount) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: "Amount must be greater than 0." });
        }
        if (!transaction_date) {
            await conn.rollback();
            return res.status(400).json({ error: "Transaction date is required." });
        }

        // Verify seller exists and belongs to the centre
        const [sellerRows] = await conn.query(
            `SELECT seller_id, deposit_per_litre FROM sellers
             WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!sellerRows[0]) {
            await conn.rollback();
            return res.status(404).json({ error: "Seller not found in your centre." });
        }

        // REMOVED operator ownership check - any operator can create deposits for any seller

        // Insert the deposit entry
        const [result] = await conn.query(
            `INSERT INTO seller_deposits
                (seller_id, operator_id, centre_id, type, amount, remarks, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(seller_id),
                operatorId,
                centreId,
                type,
                parseFloat(amount),
                remarks ? String(remarks).trim() : null,
                transaction_date,
            ]
        );

        await conn.commit();

        // Return the full row with seller info
        const [newRow] = await pool.query(
            `SELECT
                d.id,
                d.seller_id,
                d.type,
                d.amount,
                d.remarks,
                d.transaction_date,
                d.created_at,
                d.operator_id,
                s.name AS seller_name,
                s.seller_code,
                s.seller_type,
                s.deposit_per_litre,
                o.name AS operator_name
            FROM seller_deposits d
            JOIN sellers s ON s.seller_id = d.seller_id
            JOIN operators o ON o.operator_id = d.operator_id
            WHERE d.id = ? AND d.centre_id = ?`,
            [result.insertId, centreId]
        );

        res.status(201).json(newRow[0]);
    } catch (err) {
        await conn.rollback();
        console.error("createDeposit error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
//  DELETE /api/deposits/:id
//  Delete a deposit entry (operator-scoped)
// ══════════════════════════════════════════════════════════════
exports.deleteDeposit = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        // Verify the deposit entry exists and user has access
        let checkQuery = `SELECT id FROM seller_deposits WHERE id = ? AND centre_id = ?`;
        let checkParams = [id, centreId];

        if (!isAdmin) {
            checkQuery += ` AND operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await pool.query(checkQuery, checkParams);
        if (!existing[0]) {
            return res.status(404).json({ error: "Deposit entry not found or unauthorized." });
        }

        let deleteQuery = `DELETE FROM seller_deposits WHERE id = ? AND centre_id = ?`;
        let deleteParams = [id, centreId];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            deleteParams.push(operatorId);
        }

        await pool.query(deleteQuery, deleteParams);
        res.json({ message: "Deposit entry deleted successfully." });
    } catch (err) {
        console.error("deleteDeposit error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/deposits/seller/:sellerId (Admin only)
//  Get all deposits for a specific seller with running balance
// ══════════════════════════════════════════════════════════════
exports.getSellerDeposits = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.'
            });
        }

        // Verify seller belongs to centre
        const [sellerCheck] = await pool.query(
            'SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?',
            [sellerId, centreId]
        );
        if (!sellerCheck.length) {
            return res.status(404).json({ error: "Seller not found in your centre." });
        }

        const [rows] = await pool.query(
            `SELECT
                d.id, d.seller_id, d.type, d.amount, d.remarks,
                d.transaction_date, d.created_at, d.operator_id,
                o.name AS operator_name,
                (
                    SELECT SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END)
                    FROM seller_deposits
                    WHERE seller_id = d.seller_id
                      AND centre_id = d.centre_id
                      AND (transaction_date < d.transaction_date 
                           OR (transaction_date = d.transaction_date AND created_at <= d.created_at))
                ) AS running_balance
            FROM seller_deposits d
            JOIN operators o ON o.operator_id = d.operator_id
            WHERE d.seller_id = ? AND d.centre_id = ?
            ORDER BY d.transaction_date DESC, d.created_at DESC`,
            [sellerId, centreId]
        );

        res.json(rows);
    } catch (err) {
        console.error("getSellerDeposits error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/deposits/summary (Admin only)
//  Get summary of all deposits in the centre
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
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_credit,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS total_debit,
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS net_balance,
                COUNT(DISTINCT seller_id) AS unique_sellers,
                COUNT(DISTINCT operator_id) AS active_operators
            FROM seller_deposits
            WHERE centre_id = ?`,
            [centreId]
        );

        res.json(summary[0]);
    } catch (err) {
        console.error("getCentreSummary error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  POST /api/deposits/bulk (Admin only)
//  Create multiple deposits at once
// ══════════════════════════════════════════════════════════════
exports.bulkCreateDeposits = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.'
            });
        }

        const { deposits } = req.body;

        if (!deposits || !Array.isArray(deposits) || deposits.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: "deposits array is required." });
        }

        const results = [];
        for (const deposit of deposits) {
            const { seller_id, type, amount, transaction_date, remarks } = deposit;

            // Validate each deposit
            if (!seller_id || !type || !amount || !transaction_date) {
                await conn.rollback();
                return res.status(400).json({
                    error: "Each deposit must have seller_id, type, amount, and transaction_date."
                });
            }

            // Verify seller belongs to centre
            const [sellerCheck] = await conn.query(
                'SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?',
                [seller_id, centreId]
            );
            if (!sellerCheck.length) {
                await conn.rollback();
                return res.status(404).json({
                    error: `Seller ${seller_id} not found in your centre.`
                });
            }

            const [result] = await conn.query(
                `INSERT INTO seller_deposits
                    (seller_id, operator_id, centre_id, type, amount, remarks, transaction_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    Number(seller_id),
                    operatorId,
                    centreId,
                    type,
                    parseFloat(amount),
                    remarks ? String(remarks).trim() : null,
                    transaction_date,
                ]
            );

            results.push({ id: result.insertId, seller_id, type, amount });
        }

        await conn.commit();
        res.status(201).json({
            message: `${results.length} deposits created successfully.`,
            deposits: results
        });
    } catch (err) {
        await conn.rollback();
        console.error("bulkCreateDeposits error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    } finally {
        conn.release();
    }
};