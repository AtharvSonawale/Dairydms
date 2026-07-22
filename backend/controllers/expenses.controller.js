const pool = require('../config/db');

const PAYMENT_MODES = ['cash', 'card', 'upi'];
const PAYMENT_STATUSES = ['paid', 'unpaid'];

// ══════════════════════════════════════════════════════════════
//  GET /api/expenses?date=YYYY-MM-DD
//  GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
//  All expense entries for a date or range (centre-scoped)
// ══════════════════════════════════════════════════════════════
exports.getEntries = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let query = `
            SELECT e.*,
                   o.name  AS operator_name,
                   a.name  AS admin_name
            FROM expenses e
            LEFT JOIN operators o ON o.operator_id = e.operator_id
            LEFT JOIN admins a ON a.admin_id = e.created_by_admin_id
            WHERE e.centre_id = ?
        `;
        let params = [centreId];

        if (from && to) {
            query += ` AND e.expense_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            query += ` AND e.expense_date = ?`;
            params.push(singleDate);
        }

        query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);

    } catch (err) {
        console.error('getEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/expenses/summary?date=YYYY-MM-DD
//  GET /api/expenses/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//  Totals for a date or range (centre-scoped)
// ══════════════════════════════════════════════════════════════
exports.getSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let query = `
            SELECT
                COUNT(*) AS total_entries,
                COALESCE(SUM(amount), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END), 0) AS unpaid_amount
            FROM expenses
            WHERE centre_id = ?
        `;
        let params = [centreId];

        if (from && to) {
            query += ` AND expense_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            query += ` AND expense_date = ?`;
            params.push(singleDate);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows[0]);

    } catch (err) {
        console.error('getSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  POST /api/expenses
//  Record a new expense entry
// ══════════════════════════════════════════════════════════════
exports.createEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = isAdmin ? null : req.user.id;
        const adminId = isAdmin ? req.user.id : null;

        const {
            expense_date, reason, amount,
            vendor_name, vendor_contact,
            payment_mode, bill_no, payment_status,
        } = req.body;

        // ── validation ──
        if (!expense_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Expense date is required.' });
        }
        if (!reason || !String(reason).trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Reason is required.' });
        }
        if (!amount || parseFloat(amount) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Amount must be greater than 0.' });
        }
        const mode = payment_mode || 'cash';
        if (!PAYMENT_MODES.includes(mode)) {
            await conn.rollback();
            return res.status(400).json({ error: "Payment mode must be 'cash', 'card', or 'upi'." });
        }
        const status = payment_status || 'paid';
        if (!PAYMENT_STATUSES.includes(status)) {
            await conn.rollback();
            return res.status(400).json({ error: "Payment status must be 'paid' or 'unpaid'." });
        }

        // ── insert ──
        const [result] = await conn.query(
            `INSERT INTO expenses
                (expense_date, reason, amount, vendor_name, vendor_contact,
                 payment_mode, bill_no, payment_status, operator_id, created_by_admin_id, centre_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                expense_date,
                String(reason).trim(),
                parseFloat(amount),
                vendor_name ? String(vendor_name).trim() : null,
                vendor_contact ? String(vendor_contact).trim() : null,
                mode,
                bill_no ? String(bill_no).trim() : null,
                status,
                operatorId,
                adminId,
                centreId,
            ]
        );

        await conn.commit();

        // ── return inserted row ──
        const [newRow] = await pool.query(
            `SELECT e.*, o.name AS operator_name, a.name AS admin_name
             FROM expenses e
             LEFT JOIN operators o ON o.operator_id = e.operator_id
             LEFT JOIN admins a ON a.admin_id = e.created_by_admin_id
             WHERE e.expense_id = ? AND e.centre_id = ?`,
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
//  PUT /api/expenses/:id
//  Update an expense entry
// ══════════════════════════════════════════════════════════════
exports.updateEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        const {
            expense_date, reason, amount,
            vendor_name, vendor_contact,
            payment_mode, bill_no, payment_status,
        } = req.body;

        // ── validation ──
        if (!expense_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Expense date is required.' });
        }
        if (!reason || !String(reason).trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Reason is required.' });
        }
        if (!amount || parseFloat(amount) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Amount must be greater than 0.' });
        }
        const mode = payment_mode || 'cash';
        if (!PAYMENT_MODES.includes(mode)) {
            await conn.rollback();
            return res.status(400).json({ error: "Payment mode must be 'cash', 'card', or 'upi'." });
        }
        const status = payment_status || 'paid';
        if (!PAYMENT_STATUSES.includes(status)) {
            await conn.rollback();
            return res.status(400).json({ error: "Payment status must be 'paid' or 'unpaid'." });
        }

        // Check the entry exists and this user has access.
        // Admins can edit anyone's entry; operators only their own.
        let checkQuery = `SELECT expense_id FROM expenses WHERE expense_id = ? AND centre_id = ?`;
        let checkParams = [id, centreId];
        if (!isAdmin) {
            checkQuery += ` AND operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await conn.query(checkQuery, checkParams);
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Entry not found or unauthorized.' });
        }

        // ── update ──
        let updateQuery = `
            UPDATE expenses SET
                expense_date = ?,
                reason = ?,
                amount = ?,
                vendor_name = ?,
                vendor_contact = ?,
                payment_mode = ?,
                bill_no = ?,
                payment_status = ?
            WHERE expense_id = ? AND centre_id = ?
        `;
        let updateParams = [
            expense_date,
            String(reason).trim(),
            parseFloat(amount),
            vendor_name ? String(vendor_name).trim() : null,
            vendor_contact ? String(vendor_contact).trim() : null,
            mode,
            bill_no ? String(bill_no).trim() : null,
            status,
            id,
            centreId,
        ];

        if (!isAdmin) {
            updateQuery += ` AND operator_id = ?`;
            updateParams.push(operatorId);
        }

        await conn.query(updateQuery, updateParams);
        await conn.commit();

        // ── return updated row ──
        const [updated] = await pool.query(
            `SELECT e.*, o.name AS operator_name, a.name AS admin_name
             FROM expenses e
             LEFT JOIN operators o ON o.operator_id = e.operator_id
             LEFT JOIN admins a ON a.admin_id = e.created_by_admin_id
             WHERE e.expense_id = ? AND e.centre_id = ?`,
            [id, centreId]
        );
        res.json(updated[0]);

    } catch (err) {
        await conn.rollback();
        console.error('updateEntry error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
//  DELETE /api/expenses/:id
//  Remove an entry (admin: any entry in centre; operator: own only)
// ══════════════════════════════════════════════════════════════
exports.deleteEntry = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        let checkQuery = `SELECT expense_id FROM expenses WHERE expense_id = ? AND centre_id = ?`;
        let checkParams = [id, centreId];
        if (!isAdmin) {
            checkQuery += ` AND operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await pool.query(checkQuery, checkParams);
        if (!existing[0]) {
            return res.status(404).json({ error: 'Entry not found or unauthorized.' });
        }

        let deleteQuery = `DELETE FROM expenses WHERE expense_id = ? AND centre_id = ?`;
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
//  GET /api/expenses/centre-summary (Admin only)
//  Overall expense summary for the centre
// ══════════════════════════════════════════════════════════════
exports.getCentreSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const [summary] = await pool.query(
            `SELECT
                COUNT(*) AS total_entries,
                COALESCE(SUM(amount), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN amount ELSE 0 END), 0) AS paid_amount,
                COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN amount ELSE 0 END), 0) AS unpaid_amount,
                COUNT(DISTINCT DATE(expense_date)) AS active_days
            FROM expenses
            WHERE centre_id = ?`,
            [centreId]
        );

        res.json(summary[0]);
    } catch (err) {
        console.error('getCentreSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};