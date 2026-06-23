const pool = require('../config/db');

// ── helper — pick the right table ────────────────────────────
const tbl = (milk_type) =>
    milk_type === 'buffalo' ? 'buffalo_milk_rates' : 'cow_milk_rates';

// ── GET /api/rates?date=YYYY-MM-DD&milk_type=cow|buffalo ─────
// Returns rates only for the EXACT selected date (effective_from = date).
// Rates saved for 2026-05-01 will NOT appear on 2026-05-02 unless copied.
exports.getRates = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const milk_type = req.query.milk_type === 'buffalo' ? 'buffalo' : 'cow';
        const table = tbl(milk_type);

        const [rows] = await pool.query(
            `SELECT *, '${milk_type}' AS milk_type
             FROM ${table}
             WHERE centre_id = ? AND effective_from = ?
             ORDER BY fat ASC, snf ASC`,
            [centreId, date]
        );

        res.json(rows);
    } catch (err) {
        console.error('getRates error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/rates ───────────────────────────────────────────
exports.createRate = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { milk_type, fat, snf, rate, mrp, effective_from, effective_to } = req.body;

        if (!milk_type || fat == null || snf == null || !rate || !effective_from)
            return res.status(400).json({ message: 'milk_type, fat, snf, rate and effective_from are required' });

        if (!['cow', 'buffalo'].includes(milk_type))
            return res.status(400).json({ message: "milk_type must be 'cow' or 'buffalo'" });

        const table = tbl(milk_type);

        const [result] = await pool.query(
            `INSERT INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                centreId,
                parseFloat(fat),
                parseFloat(snf),
                parseFloat(rate),
                mrp ? parseFloat(mrp) : null,
                effective_from,
                effective_to || null,
            ]
        );

        const [newRow] = await pool.query(
            `SELECT *, '${milk_type}' AS milk_type FROM ${table} WHERE rate_id = ? AND centre_id = ?`,
            [result.insertId, centreId]
        );

        res.status(201).json(newRow[0]);
    } catch (err) {
        console.error('createRate error:', err);
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ message: 'A rate for this FAT, SNF and date already exists.' });
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PUT /api/rates/:id?milk_type=cow|buffalo ─────────────────
exports.updateRate = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;
        const milk_type = req.query.milk_type || req.body.milk_type || 'cow';
        const { fat, snf, rate, mrp, effective_from, effective_to } = req.body;
        const table = tbl(milk_type);

        const [existing] = await pool.query(
            `SELECT * FROM ${table} WHERE rate_id = ? AND centre_id = ?`, [id, centreId]
        );
        if (!existing[0])
            return res.status(404).json({ message: 'Rate not found in your centre' });

        // ── check for duplicate EXCLUDING the row being edited ──
        const [dup] = await pool.query(
            `SELECT rate_id FROM ${table}
             WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?
               AND rate_id != ?`,
            [centreId, parseFloat(fat), parseFloat(snf), effective_from, id]
        );
        if (dup[0])
            return res.status(409).json({
                message: `Another rate for FAT ${fat}, SNF ${snf} on ${effective_from} already exists.`,
            });

        await pool.query(
            `UPDATE ${table}
             SET fat = ?, snf = ?, rate = ?, mrp = ?, effective_from = ?, effective_to = ?
             WHERE rate_id = ? AND centre_id = ?`,
            [
                parseFloat(fat),
                parseFloat(snf),
                parseFloat(rate),
                parseFloat(mrp),
                effective_from,
                effective_to || null,
                id,
                centreId,
            ]
        );

        const [updated] = await pool.query(
            `SELECT *, '${milk_type}' AS milk_type FROM ${table} WHERE rate_id = ? AND centre_id = ?`, [id, centreId]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error('updateRate error:', err);
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ message: 'A rate for this FAT, SNF and date already exists.' });
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── DELETE /api/rates/:id?milk_type=cow|buffalo ──────────────
exports.deleteRate = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;
        const milk_type = req.query.milk_type || 'cow';
        const table = tbl(milk_type);

        const [existing] = await pool.query(
            `SELECT * FROM ${table} WHERE rate_id = ? AND centre_id = ?`, [id, centreId]
        );
        if (!existing[0])
            return res.status(404).json({ message: 'Rate not found in your centre' });

        await pool.query(`DELETE FROM ${table} WHERE rate_id = ? AND centre_id = ?`, [id, centreId]);
        res.json({ message: 'Rate deleted successfully' });
    } catch (err) {
        console.error('deleteRate error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
// ── POST /api/rates/copy-forward ─────────────────────────────
// Copies all rates from from_date as new rows with effective_from = to_date.
// Source must have rates saved for from_date exactly — no bleeding from other dates.
exports.copyForward = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { from_date, to_date, milk_type } = req.body;

        if (!from_date || !to_date || !milk_type)
            return res.status(400).json({ message: 'from_date, to_date and milk_type are required' });

        const table = tbl(milk_type);

        // only fetch rates saved exactly for from_date, in this centre
        const [rows] = await pool.query(
            `SELECT * FROM ${table} WHERE centre_id = ? AND effective_from = ?`,
            [centreId, from_date]
        );

        if (rows.length === 0)
            return res.status(404).json({
                message: `No rates found for ${from_date}. Only dates with saved rates can be copied.`,
            });

        let inserted = 0;
        let skipped = 0;

        for (const row of rows) {
            const [dup] = await pool.query(
                `SELECT rate_id FROM ${table}
                 WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
                [centreId, row.fat, row.snf, to_date]
            );
            if (dup.length > 0) { skipped++; continue; }

            await pool.query(
                `INSERT INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to) VALUES (?, ?, ?, ?, ?, ?, NULL)`,
                [centreId, row.fat, row.snf, row.rate, row.mrp || null, to_date]
            );
            inserted++;
        }

        res.json({
            message: `${inserted} rate(s) copied to ${to_date}${skipped ? `, ${skipped} skipped (already exist)` : ''}.`,
            inserted,
            skipped,
        });
    } catch (err) {
        console.error('copyForward error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/rates/premium ───────────────────────────────────
exports.assignPremiumRate = async (req, res) => {
    try {
        const { seller_ids, milk_type, rate_per_liter, reason, effective_from, effective_to } = req.body;
        const centreId = req.user.centre_id;
        const operatorId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!seller_ids?.length || !milk_type || !rate_per_liter || !effective_from || !reason)
            return res.status(400).json({ message: 'All fields are required' });

        // Verify sellers belong to the centre
        const placeholders = seller_ids.map(() => '?').join(',');
        const [sellers] = await pool.query(
            `SELECT seller_id FROM sellers 
             WHERE seller_id IN (${placeholders}) AND centre_id = ?`,
            [...seller_ids, centreId]
        );

        if (sellers.length !== seller_ids.length) {
            return res.status(403).json({
                message: 'Some sellers not found in your centre.'
            });
        }

        // REMOVED operator ownership check - any operator can assign premium rates to any seller

        const values = seller_ids.map(id => [
            id,
            centreId,
            milk_type,
            parseFloat(rate_per_liter),
            reason,
            effective_from,
            effective_to || null,
        ]);

        await pool.query(
            `INSERT INTO premium_rates
     (seller_id, centre_id, milk_type, rate_per_liter, reason, effective_from, effective_to)
     VALUES ?`,
            [values]
        );

        res.json({ message: `Premium rate assigned to ${seller_ids.length} seller(s).` });
    } catch (err) {
        console.error('assignPremiumRate error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/rates/lookup?fat=3.5&snf=8.4&milk_type=cow&date=2026-05-10 ──
exports.lookupRate = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { fat, snf, milk_type, date } = req.query;

        if (!fat || !snf || !milk_type || !date)
            return res.status(400).json({ error: 'fat, snf, milk_type and date are required' });

        const table = tbl(milk_type);

        const [rows] = await pool.query(
            `SELECT *, ABS(fat - ?) + ABS(snf - ?) AS diff
             FROM ${table}
             WHERE centre_id = ? AND effective_from = ?
             ORDER BY diff ASC
             LIMIT 1`,
            [parseFloat(fat), parseFloat(snf), centreId, date]
        );

        if (!rows.length)
            return res.status(404).json({ error: 'No matching rate found' });

        res.json({ ...rows[0], milk_type });
    } catch (err) {
        console.error('lookupRate error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/rates/premium ────────────────────────────────────
// Returns all premium rates with seller info, newest first
exports.getPremiumRates = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // REMOVED operator filter - both admin and operator see all premium rates
        const query = `
            SELECT
                pr.id,
                pr.seller_id,
                pr.milk_type,
                pr.rate_per_liter,
                pr.reason,
                pr.effective_from,
                pr.effective_to,
                pr.is_active,
                pr.created_at,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                o.name        AS operator_name
            FROM premium_rates pr
            JOIN sellers s ON s.seller_id = pr.seller_id
            JOIN operators o ON o.operator_id = s.operator_id
            WHERE s.centre_id = ?
            ORDER BY pr.created_at DESC
        `;

        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getPremiumRates error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PUT /api/rates/premium/:id ────────────────────────────────
exports.updatePremiumRate = async (req, res) => {
    try {
        const { id } = req.params;
        const { seller_id, milk_type, rate_per_liter, reason, effective_from, effective_to } = req.body;
        const centreId = req.user.centre_id;
        const operatorId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!seller_id || !milk_type || !rate_per_liter || !effective_from)
            return res.status(400).json({ message: 'seller_id, milk_type, rate_per_liter and effective_from are required.' });

        // Verify seller belongs to centre
        const [sellerCheck] = await pool.query(
            `SELECT seller_id, operator_id FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!sellerCheck.length) {
            return res.status(403).json({ message: 'Seller not found in your centre.' });
        }

        if (!isAdmin && sellerCheck[0].operator_id !== operatorId) {
            return res.status(403).json({ message: 'Access denied. You can only update premium rates for your own sellers.' });
        }

        const [existing] = await pool.query(
            `SELECT id FROM premium_rates WHERE id = ?`, [id]
        );
        if (!existing[0])
            return res.status(404).json({ message: 'Premium rate not found.' });

        await pool.query(
            `UPDATE premium_rates
             SET seller_id      = ?,
                 milk_type      = ?,
                 rate_per_liter = ?,
                 reason         = ?,
                 effective_from = ?,
                 effective_to   = ?
             WHERE id = ?`,
            [
                seller_id,
                milk_type,
                parseFloat(rate_per_liter),
                reason || null,
                effective_from,
                effective_to || null,
                id,
            ]
        );

        const [updated] = await pool.query(
            `SELECT
                pr.*,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                o.name        AS operator_name
             FROM premium_rates pr
             JOIN sellers s ON s.seller_id = pr.seller_id
             JOIN operators o ON o.operator_id = s.operator_id
             WHERE pr.id = ?`,
            [id]
        );

        res.json(updated[0]);
    } catch (err) {
        console.error('updatePremiumRate error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PATCH /api/rates/premium/:id/deactivate ───────────────────
exports.deactivatePremiumRate = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;
        const operatorId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Verify premium rate belongs to a seller in the centre
        let verifyQuery = `
            SELECT pr.id, pr.is_active, pr.seller_id
            FROM premium_rates pr
            JOIN sellers s ON s.seller_id = pr.seller_id
            WHERE pr.id = ? AND s.centre_id = ?
        `;
        let verifyParams = [id, centreId];

        if (!isAdmin) {
            verifyQuery += ` AND s.operator_id = ?`;
            verifyParams.push(operatorId);
        }

        const [existing] = await pool.query(verifyQuery, verifyParams);
        if (!existing[0])
            return res.status(404).json({ message: 'Premium rate not found.' });

        if (!existing[0].is_active)
            return res.status(400).json({ message: 'Rate is already inactive.' });

        await pool.query(
            `UPDATE premium_rates SET is_active = 0 WHERE id = ?`, [id]
        );

        res.json({ message: 'Premium rate deactivated successfully.', id: Number(id), is_active: 0 });
    } catch (err) {
        console.error('deactivatePremiumRate error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── DELETE /api/rates/premium/:id ────────────────────────────
exports.deletePremiumRate = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;
        const operatorId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Verify premium rate belongs to a seller in the centre
        let verifyQuery = `
            SELECT pr.id, pr.is_active, pr.seller_id
            FROM premium_rates pr
            JOIN sellers s ON s.seller_id = pr.seller_id
            WHERE pr.id = ? AND s.centre_id = ?
        `;
        let verifyParams = [id, centreId];

        if (!isAdmin) {
            verifyQuery += ` AND s.operator_id = ?`;
            verifyParams.push(operatorId);
        }

        const [existing] = await pool.query(verifyQuery, verifyParams);
        if (!existing[0])
            return res.status(404).json({ message: 'Premium rate not found.' });

        if (existing[0].is_active)
            return res.status(400).json({
                message: 'Cannot delete an active rate. Deactivate it first.',
            });

        await pool.query(`DELETE FROM premium_rates WHERE id = ?`, [id]);

        res.json({ message: 'Premium rate deleted successfully.' });
    } catch (err) {
        console.error('deletePremiumRate error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/rates/generate ──────────────────────────────────
exports.generateRates = async (req, res) => {
    try {
        const { milk_type, rate_date, rates } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;

        if (!milk_type || !rate_date || !Array.isArray(rates) || rates.length === 0)
            return res.status(400).json({ message: 'milk_type, rate_date and rates array are required' });

        if (!['cow', 'buffalo'].includes(milk_type))
            return res.status(400).json({ message: "milk_type must be 'cow' or 'buffalo'" });

        const table = tbl(milk_type);

        let inserted = 0;
        let skipped = 0;

        for (const row of rates) {
            const fat = parseFloat(row.fat);
            const snf = parseFloat(row.snf);
            const rate = parseFloat(row.rate);
            const mrp = row.mrp ? parseFloat(row.mrp) : null;

            // 1. insert into cow/buffalo_milk_rates (skip if duplicate)
            const [dup] = await pool.query(
                `SELECT rate_id FROM ${table} WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
                [centreId, fat, snf, rate_date]
            );
            if (dup.length > 0) { skipped++; }
            else {
                await pool.query(
                    `INSERT INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to)
                     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
                    [centreId, fat, snf, rate, mrp, rate_date]
                );
                inserted++;
            }
            // 2. always insert into generated_rates with centre_id
            await pool.query(
                `INSERT INTO generated_rates (milk_type, fat, snf, rate, mrp, rate_date, operator_id, centre_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [milk_type, fat, snf, rate, mrp, rate_date, operatorId, centreId]
            );
        }

        res.json({
            message: `${inserted} rate(s) inserted, ${skipped} skipped (already exist) for ${rate_date}.`,
            inserted,
            skipped,
            total: rates.length,
        });
    } catch (err) {
        console.error('generateRates error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── DELETE /api/rates/all?date=YYYY-MM-DD&milk_type=cow|buffalo ──
exports.deleteAllRates = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, milk_type } = req.query;

        if (!date || !milk_type)
            return res.status(400).json({ message: 'date and milk_type are required' });

        const table = tbl(milk_type);

        const [result] = await pool.query(
            `DELETE FROM ${table} WHERE centre_id = ? AND effective_from = ?`,
            [centreId, date]
        );

        res.json({
            message: `${result.affectedRows} ${milk_type} rate(s) deleted for ${date}.`,
            deleted: result.affectedRows,
        });
    } catch (err) {
        console.error('deleteAllRates error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/rates/generated-history ──────────────────────────
// Returns history of generated rates
exports.getGeneratedRatesHistory = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { from, to, milk_type } = req.query;

        // REMOVED operator filter - both admin and operator see all generated rates
        let query = `
            SELECT gr.*, o.name AS operator_name
            FROM generated_rates gr
            JOIN operators o ON o.operator_id = gr.operator_id
            WHERE gr.centre_id = ?
        `;
        let params = [centreId];

        if (milk_type) {
            query += ` AND gr.milk_type = ?`;
            params.push(milk_type);
        }

        if (from && to) {
            query += ` AND gr.rate_date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        query += ` ORDER BY gr.generated_at DESC LIMIT 1000`;

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('getGeneratedRatesHistory error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};