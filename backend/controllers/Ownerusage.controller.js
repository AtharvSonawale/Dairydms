const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  GET /api/owner-usage?date=YYYY-MM-DD
//  All owner usage entries for a given date (operator-scoped)
// ══════════════════════════════════════════════════════════════
exports.getEntries = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        // REMOVED operator filter - both admin and operator see all
        let query = `
            SELECT ou.*, o.name AS operator_name
            FROM owner_usage ou
            JOIN operators o ON o.operator_id = ou.operator_id
            WHERE ou.centre_id = ?
        `;
        let params = [centreId];

        if (from && to) {
            query += ` AND ou.usage_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            query += ` AND ou.usage_date = ?`;
            params.push(singleDate);
        }

        query += ` ORDER BY ou.created_at DESC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);

    } catch (err) {
        console.error('getEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/owner-usage/summary?date=YYYY-MM-DD
//  Get summary of owner usage for a date
// ══════════════════════════════════════════════════════════════
exports.getSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        // REMOVED operator filter - both admin and operator see all
        let query = `
            SELECT
                COALESCE(SUM(CASE WHEN milk_type = 'cow' THEN quantity ELSE 0 END), 0) AS total_cow,
                COALESCE(SUM(CASE WHEN milk_type = 'buffalo' THEN quantity ELSE 0 END), 0) AS total_buffalo,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COUNT(*) AS total_entries,
                COUNT(DISTINCT shift) AS shifts_used
            FROM owner_usage
            WHERE centre_id = ?
        `;
        let params = [centreId];

        if (from && to) {
            query += ` AND usage_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            query += ` AND usage_date = ?`;
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
//  POST /api/owner-usage
//  Record a new owner usage entry
// ══════════════════════════════════════════════════════════════
exports.createEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { usage_date, shift, milk_type, quantity, purpose } = req.body;

        // ── validation ──
        if (!usage_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Usage date is required.' });
        }
        if (!shift || !['morning', 'evening'].includes(shift)) {
            await conn.rollback();
            return res.status(400).json({ error: "Shift must be 'morning' or 'evening'." });
        }
        if (!milk_type || !['cow', 'buffalo'].includes(milk_type)) {
            await conn.rollback();
            return res.status(400).json({ error: "Milk type must be 'cow' or 'buffalo'." });
        }
        if (!quantity || parseFloat(quantity) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Quantity must be greater than 0.' });
        }

        // ── stock availability check (with centre isolation) ──
        // collected for the day - REMOVED operator filter
        const [collected] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM milk_entries
             WHERE centre_id = ? AND entry_date = ? AND milk_type = ?`,
            [centreId, usage_date, milk_type]
        );

        // already consumed (walkin sales) - REMOVED operator filter
        const [walkinOut] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM walkin_sales
             WHERE centre_id = ? AND sale_date = ? AND milk_type = ?`,
            [centreId, usage_date, milk_type]
        );

        // already used by owner today for this milk_type - REMOVED operator filter
        const [ownerOut] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM owner_usage
             WHERE centre_id = ? AND usage_date = ? AND milk_type = ?`,
            [centreId, usage_date, milk_type]
        );

        const available = parseFloat(collected[0].total)
            - parseFloat(walkinOut[0].total)
            - parseFloat(ownerOut[0].total);

        if (parseFloat(quantity) > available) {
            await conn.rollback();
            return res.status(400).json({
                error: `Insufficient stock. Only ${Math.max(0, available).toFixed(2)} L of ${milk_type} milk available for ${usage_date}.`,
            });
        }

        // ── insert ──
        const [result] = await conn.query(
            `INSERT INTO owner_usage
                (usage_date, shift, milk_type, quantity, purpose, operator_id, centre_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                usage_date,
                shift,
                milk_type,
                parseFloat(quantity),
                purpose ? String(purpose).trim() : 'Personal use',
                operatorId,
                centreId,
            ]
        );

        await conn.commit();

        // ── return inserted row ──
        const [newRow] = await pool.query(
            `SELECT ou.*, o.name AS operator_name
             FROM owner_usage ou
             JOIN operators o ON o.operator_id = ou.operator_id
             WHERE ou.usage_id = ? AND ou.centre_id = ?`,
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
//  DELETE /api/owner-usage/:id
//  Remove an entry (operator-scoped)
// ══════════════════════════════════════════════════════════════
exports.deleteEntry = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        let checkQuery = `SELECT usage_id FROM owner_usage WHERE usage_id = ? AND centre_id = ?`;
        let checkParams = [id, centreId];

        if (!isAdmin) {
            checkQuery += ` AND operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await pool.query(checkQuery, checkParams);
        if (!existing[0]) {
            return res.status(404).json({ error: 'Entry not found or unauthorized.' });
        }

        let deleteQuery = `DELETE FROM owner_usage WHERE usage_id = ? AND centre_id = ?`;
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
//  PUT /api/owner-usage/:id
//  Update an owner usage entry
// ══════════════════════════════════════════════════════════════
exports.updateEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { usage_date, shift, milk_type, quantity, purpose } = req.body;

        // Check if entry exists and user has access
        let checkQuery = `
            SELECT ou.*, 
                   (SELECT COALESCE(SUM(quantity), 0) FROM milk_entries 
                    WHERE centre_id = ? AND entry_date = ? AND milk_type = ?) AS collected,
                   (SELECT COALESCE(SUM(quantity), 0) FROM walkin_sales 
                    WHERE centre_id = ? AND sale_date = ? AND milk_type = ?) AS walkin_used,
                   (SELECT COALESCE(SUM(quantity), 0) FROM owner_usage 
                    WHERE centre_id = ? AND usage_date = ? AND milk_type = ? AND usage_id != ?) AS other_owner_used
            FROM owner_usage ou
            WHERE ou.usage_id = ? AND ou.centre_id = ?
        `;

        let checkParams = [
            centreId, usage_date, milk_type,
            centreId, usage_date, milk_type,
            centreId, usage_date, milk_type, id,
            id, centreId
        ];

        if (!isAdmin) {
            checkQuery += ` AND ou.operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await conn.query(checkQuery, checkParams);
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Entry not found or unauthorized.' });
        }

        const entry = existing[0];

        // Check stock if quantity changed
        if (parseFloat(quantity) !== parseFloat(entry.quantity)) {
            const available = parseFloat(entry.collected || 0)
                - parseFloat(entry.walkin_used || 0)
                - parseFloat(entry.other_owner_used || 0);

            if (parseFloat(quantity) > available) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock. Only ${Math.max(0, available).toFixed(2)} L of ${milk_type} milk available for ${usage_date}.`,
                });
            }
        }

        // ── update ──
        let updateQuery = `
            UPDATE owner_usage SET
                usage_date = ?,
                shift = ?,
                milk_type = ?,
                quantity = ?,
                purpose = ?
            WHERE usage_id = ? AND centre_id = ?
        `;
        let updateParams = [
            usage_date,
            shift,
            milk_type,
            parseFloat(quantity),
            purpose ? String(purpose).trim() : 'Personal use',
            id,
            centreId
        ];

        if (!isAdmin) {
            updateQuery += ` AND operator_id = ?`;
            updateParams.push(operatorId);
        }

        await conn.query(updateQuery, updateParams);

        await conn.commit();

        // ── return updated row ──
        const [updated] = await pool.query(
            `SELECT ou.*, o.name AS operator_name
             FROM owner_usage ou
             JOIN operators o ON o.operator_id = ou.operator_id
             WHERE ou.usage_id = ? AND ou.centre_id = ?`,
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
//  GET /api/owner-usage/monthly-summary?year=&month=
//  Get monthly summary of owner usage
// ══════════════════════════════════════════════════════════════
exports.getMonthlySummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({ error: 'Year and month are required.' });
        }

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT
                DATE(usage_date) AS date,
                COALESCE(SUM(CASE WHEN milk_type = 'cow' THEN quantity ELSE 0 END), 0) AS cow_quantity,
                COALESCE(SUM(CASE WHEN milk_type = 'buffalo' THEN quantity ELSE 0 END), 0) AS buffalo_quantity,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COUNT(*) AS entry_count
            FROM owner_usage
            WHERE centre_id = ?
              AND usage_date BETWEEN ? AND ?
            GROUP BY DATE(usage_date)
            ORDER BY date ASC
        `;

        const [rows] = await pool.query(query, [centreId, startDate, endDate]);
        res.json(rows);
    } catch (err) {
        console.error('getMonthlySummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/owner-usage/centre-summary (Admin only)
//  Get summary of all owner usage in the centre
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
                COALESCE(SUM(CASE WHEN milk_type = 'cow' THEN quantity ELSE 0 END), 0) AS total_cow,
                COALESCE(SUM(CASE WHEN milk_type = 'buffalo' THEN quantity ELSE 0 END), 0) AS total_buffalo,
                COALESCE(SUM(quantity), 0) AS total_quantity,
                COUNT(DISTINCT operator_id) AS active_operators,
                COUNT(DISTINCT DATE(usage_date)) AS active_days
            FROM owner_usage
            WHERE centre_id = ?`,
            [centreId]
        );

        res.json(summary[0]);
    } catch (err) {
        console.error('getCentreSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};