const pool = require('../config/db');

// ── GET /api/milk-entries?date=YYYY-MM-DD
//        OR ?from=YYYY-MM-DD&to=YYYY-MM-DD ──────────────────────
exports.getEntries = async (req, res) => {
    try {
        const { date, from, to } = req.query;
        const fromDate = from || date || new Date().toISOString().split('T')[0];
        const toDate = to || date || fromDate;

        const centreId = req.user.centre_id;

        // Both admin and operator see all entries under their centre
        // AFTER
        const query = `
            SELECT me.*, s.name AS seller_name, s.seller_code AS seller_code,
                   COALESCE(o.name, a.name) AS operator_name
            FROM milk_entries me
            JOIN sellers s ON s.seller_id = me.seller_id
            LEFT JOIN operators o ON o.operator_id = me.operator_id
            LEFT JOIN admins a ON a.admin_id = me.created_by_admin_id
            WHERE me.entry_date BETWEEN ? AND ?
              AND me.centre_id = ?
            ORDER BY me.entry_date ASC, me.entry_time DESC
        `;

        const [rows] = await pool.query(query, [fromDate, toDate, centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/milk-entries/all (Admin only - get all entries in centre) ──
exports.getAllCentreEntries = async (req, res) => {
    try {
        const { date, from, to } = req.query;
        const fromDate = from || date || new Date().toISOString().split('T')[0];
        const toDate = to || date || fromDate;

        const centreId = req.user.centre_id;

        // Only admins can access this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const query = `
            SELECT me.*, s.name AS seller_name, s.seller_code AS seller_code,
                   o.name AS operator_name
            FROM milk_entries me
            JOIN sellers s ON s.seller_id = me.seller_id
            JOIN operators o ON o.operator_id = me.operator_id
            WHERE me.entry_date BETWEEN ? AND ?
              AND me.centre_id = ?
            ORDER BY me.entry_date ASC, me.entry_time DESC
        `;

        const [rows] = await pool.query(query, [fromDate, toDate, centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getAllCentreEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/milk-entries ───────────────────────────────────
exports.createEntry = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            seller_id,
            seller_type,
            entry_date,
            shift,
            milk_type,
            quantity,
            fat,
            snf,
            water,
            rate_applied,
            total_amount,
        } = req.body;

        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operator_id = isAdmin ? null : req.user.id;
        const created_by_admin_id = isAdmin ? req.user.id : null;

        // Verify seller belongs to the same centre
        const [sellerCheck] = await conn.query(
            `SELECT seller_id FROM sellers 
             WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centre_id]
        );

        if (!sellerCheck.length) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. Seller does not belong to your centre.'
            });
        }

        // Insert new entry with centre_id and created_by_admin_id
        const [result] = await conn.query(
            `INSERT INTO milk_entries
             (seller_id, operator_id, centre_id, created_by_admin_id, seller_type, 
              entry_date, shift, milk_type, quantity, fat, snf, water, 
              rate_applied, total_amount, entry_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                seller_id, operator_id, centre_id, created_by_admin_id,
                seller_type, entry_date, shift, milk_type,
                quantity, fat, snf, water, rate_applied, total_amount
            ]
        );

        await conn.commit();

        // AFTER
        const [newRow] = await pool.query(
            `SELECT me.*, s.name AS seller_name, s.seller_code,
                    COALESCE(o.name, a.name) AS operator_name
             FROM milk_entries me
             JOIN sellers s ON s.seller_id = me.seller_id
             LEFT JOIN operators o ON o.operator_id = me.operator_id
             LEFT JOIN admins a ON a.admin_id = me.created_by_admin_id
             WHERE me.entry_id = ?`,
            [result.insertId]
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

// ── GET /api/milk-entries/premium-rate?seller_id=&milk_type=&date= ──
exports.getPremiumRate = async (req, res) => {
    try {
        const { seller_id, milk_type, date } = req.query;
        if (!seller_id || !milk_type || !date)
            return res.status(400).json({ error: 'seller_id, milk_type and date are required.' });

        const centreId = req.user.centre_id;

        // Verify seller belongs to the same centre
        const [sellerCheck] = await pool.query(
            `SELECT seller_id FROM sellers 
             WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );

        if (!sellerCheck.length) {
            return res.status(403).json({
                error: 'Access denied. Seller does not belong to your centre.'
            });
        }

        const [rows] = await pool.query(
            `SELECT rate_per_liter FROM premium_rates
             WHERE seller_id = ?
               AND milk_type = ?
               AND centre_id = ?
               AND is_active = 1
               AND effective_from <= ?
               AND (effective_to IS NULL OR effective_to >= ?)
             ORDER BY effective_from DESC
             LIMIT 1`,
            [seller_id, milk_type, centreId, date, date]
        );

        if (!rows.length)
            return res.status(404).json({ error: 'No active premium rate found.' });

        res.json(rows[0]);
    } catch (err) {
        console.error('getPremiumRate error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/milk-entries/by-operator?operator_id=&from=&to= ──
// Admin can view entries of specific operator in their centre
exports.getEntriesByOperator = async (req, res) => {
    try {
        const { operator_id, from, to } = req.query;
        const fromDate = from || new Date().toISOString().split('T')[0];
        const toDate = to || fromDate;
        const centreId = req.user.centre_id;

        // Only admins can access this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        // Verify operator belongs to the same centre
        const [operatorCheck] = await pool.query(
            `SELECT operator_id FROM operators 
             WHERE operator_id = ? AND centre_id = ?`,
            [operator_id, centreId]
        );

        if (!operatorCheck.length) {
            return res.status(403).json({
                error: 'Access denied. Operator does not belong to your centre.'
            });
        }

        const query = `
            SELECT me.*, s.name AS seller_name, s.seller_code AS seller_code
            FROM milk_entries me
            JOIN sellers s ON s.seller_id = me.seller_id
            WHERE me.entry_date BETWEEN ? AND ?
              AND me.operator_id = ?
              AND me.centre_id = ?
            ORDER BY me.entry_date ASC, me.entry_time DESC
        `;

        const [rows] = await pool.query(query, [fromDate, toDate, operator_id, centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getEntriesByOperator error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/milk-entries/summary?from=&to= ──
// Admin can get summary of all entries in their centre
exports.getCentreSummary = async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || new Date().toISOString().split('T')[0];
        const toDate = to || fromDate;
        const centreId = req.user.centre_id;

        // Only admins can access this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const query = `
            SELECT 
                COUNT(*) as total_entries,
                SUM(quantity) as total_quantity,
                SUM(total_amount) as total_amount,
                COUNT(DISTINCT seller_id) as unique_sellers,
                COUNT(DISTINCT operator_id) as active_operators,
                SUM(CASE WHEN milk_type = 'cow' THEN quantity ELSE 0 END) as cow_quantity,
                SUM(CASE WHEN milk_type = 'buffalo' THEN quantity ELSE 0 END) as buffalo_quantity,
                AVG(fat) as avg_fat,
                AVG(snf) as avg_snf
            FROM milk_entries
            WHERE entry_date BETWEEN ? AND ?
              AND centre_id = ?
        `;

        const [rows] = await pool.query(query, [fromDate, toDate, centreId]);
        res.json(rows[0]);
    } catch (err) {
        console.error('getCentreSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── PUT /api/milk-entries/:id ─────────────────────────────────
exports.updateEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            shift, milk_type, seller_type, quantity, fat, snf,
            water, rate_applied, total_amount
        } = req.body;

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check if entry exists and belongs to the same centre
        const [existing] = await pool.query(
            `SELECT entry_id, seller_id, entry_date, operator_id, centre_id 
             FROM milk_entries WHERE entry_id = ?`,
            [id]
        );

        if (!existing[0]) {
            return res.status(404).json({ error: 'Entry not found.' });
        }

        // Check centre access
        if (existing[0].centre_id !== centreId) {
            return res.status(403).json({ error: 'Access denied. Entry belongs to a different centre.' });
        }

        // Check if operator owns the entry (or admin can edit any)
        if (!isAdmin && existing[0].operator_id !== operatorId) {
            return res.status(403).json({ error: 'Access denied. You can only edit your own entries.' });
        }

        // Re-check premium
        const { seller_id, entry_date } = existing[0];
        const [premiumRows] = await pool.query(
            `SELECT rate_per_liter FROM premium_rates
             WHERE seller_id = ? 
               AND milk_type = ? 
               AND centre_id = ?
               AND is_active = 1
               AND effective_from <= ? 
               AND (effective_to IS NULL OR effective_to >= ?)
             LIMIT 1`,
            [seller_id, milk_type, centreId, entry_date, entry_date]
        );
        const is_premium = premiumRows.length > 0 ? 1 : 0;
        const computedTotal = (parseFloat(quantity) * parseFloat(rate_applied)).toFixed(2);
        const finalTotal = parseFloat(total_amount || computedTotal);

        // Admin can update any entry in their centre, operator only their own
        let updateQuery = `
            UPDATE milk_entries SET
                shift = ?, milk_type = ?, seller_type = ?, quantity = ?, 
                fat = ?, snf = ?, water = ?, rate_applied = ?, 
                total_amount = ?, is_premium = ?
            WHERE entry_id = ?
        `;
        let params = [
            shift, milk_type, seller_type,
            parseFloat(quantity), parseFloat(fat), parseFloat(snf),
            parseFloat(water || 0), parseFloat(rate_applied),
            finalTotal, is_premium, id
        ];

        if (!isAdmin) {
            updateQuery += ` AND operator_id = ?`;
            params.push(operatorId);
        }

        const [result] = await pool.query(updateQuery, params);

        if (result.affectedRows === 0) {
            return res.status(403).json({ error: 'Unauthorized to update this entry.' });
        }

        const [updated] = await pool.query(
            `SELECT me.*, s.name AS seller_name, s.seller_code,
                    COALESCE(o.name, a.name) AS operator_name
             FROM milk_entries me
             JOIN sellers s ON s.seller_id = me.seller_id
             LEFT JOIN operators o ON o.operator_id = me.operator_id
             LEFT JOIN admins a ON a.admin_id = me.created_by_admin_id
             WHERE me.entry_id = ? AND me.centre_id = ?`,
            [id, centreId]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error('updateEntry error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── DELETE /api/milk-entries/:id ───────────────────────────────
exports.deleteEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check if entry exists and belongs to the centre
        const [existing] = await pool.query(
            `SELECT entry_id, operator_id, centre_id FROM milk_entries
             WHERE entry_id = ?`,
            [id]
        );

        if (!existing[0]) {
            return res.status(404).json({ error: 'Entry not found.' });
        }

        // Check centre access
        if (existing[0].centre_id !== centreId) {
            return res.status(403).json({ error: 'Access denied. Entry belongs to a different centre.' });
        }

        // Check if operator owns the entry (or admin can delete any)
        if (!isAdmin && existing[0].operator_id !== operatorId) {
            return res.status(403).json({ error: 'Access denied. You can only delete your own entries.' });
        }

        let deleteQuery = `DELETE FROM milk_entries WHERE entry_id = ?`;
        let params = [id];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            params.push(operatorId);
        }

        const [result] = await pool.query(deleteQuery, params);

        if (result.affectedRows === 0) {
            return res.status(403).json({ error: 'Unauthorized to delete this entry.' });
        }

        res.json({ message: 'Milk entry deleted successfully.' });
    } catch (err) {
        console.error('deleteEntry error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── BULK DELETE /api/milk-entries/bulk ──────────────────────
exports.bulkDeleteEntries = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { entry_ids } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
            return res.status(400).json({ error: 'entry_ids array is required.' });
        }

        // Verify all entries belong to the centre
        const placeholders = entry_ids.map(() => '?').join(',');
        const [existing] = await conn.query(
            `SELECT entry_id, operator_id, centre_id FROM milk_entries
             WHERE entry_id IN (${placeholders})`,
            entry_ids
        );

        if (existing.length !== entry_ids.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Some entries not found.' });
        }

        // Check centre access
        const invalidEntries = existing.filter(e => e.centre_id !== centreId);
        if (invalidEntries.length > 0) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. Some entries belong to a different centre.'
            });
        }

        // Check ownership (if not admin)
        if (!isAdmin) {
            const invalidOwnership = existing.filter(e => e.operator_id !== operatorId);
            if (invalidOwnership.length > 0) {
                await conn.rollback();
                return res.status(403).json({
                    error: 'Access denied. You can only delete your own entries.'
                });
            }
        }

        const deletePlaceholders = entry_ids.map(() => '?').join(',');
        await conn.query(
            `DELETE FROM milk_entries WHERE entry_id IN (${deletePlaceholders})`,
            entry_ids
        );

        await conn.commit();
        res.json({
            message: `${entry_ids.length} entries deleted successfully.`,
            deleted_count: entry_ids.length
        });
    } catch (err) {
        await conn.rollback();
        console.error('bulkDeleteEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/milk-entries/export?from=&to= ──────────────────
exports.exportEntries = async (req, res) => {
    try {
        const { from, to } = req.query;
        const fromDate = from || new Date().toISOString().split('T')[0];
        const toDate = to || fromDate;
        const centreId = req.user.centre_id;

        // Both admin and operator see all entries under their centre
        const query = `
            SELECT 
                me.entry_id, me.entry_date, me.shift, me.milk_type,
                s.name AS seller_name, s.seller_code,
                me.quantity, me.fat, me.snf, me.water, me.rate_applied,
                me.total_amount, me.is_premium,
                COALESCE(o.name, a.name) AS operator_name,
                me.entry_time
            FROM milk_entries me
            JOIN sellers s ON s.seller_id = me.seller_id
            LEFT JOIN operators o ON o.operator_id = me.operator_id
            LEFT JOIN admins a ON a.admin_id = me.created_by_admin_id
            WHERE me.entry_date BETWEEN ? AND ?
              AND me.centre_id = ?
            ORDER BY me.entry_date ASC, me.entry_time DESC
        `;

        const [rows] = await pool.query(query, [fromDate, toDate, centreId]);
        res.json(rows);
    } catch (err) {
        console.error('exportEntries error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};