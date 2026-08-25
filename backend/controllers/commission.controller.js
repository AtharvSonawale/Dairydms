const pool = require('../config/db');
const { getCommissionSettingsMap, computeCommissionAmount } = require('../utils/commission');

const MILK_TYPES = ['cow', 'buffalo'];

const DEFAULTS = {
    cow: { base_fat: 4.0, base_snf: 8.5, base_commission: 0, fat_step_cut: 0, snf_step_cut: 0 },
    buffalo: { base_fat: 6.5, base_snf: 9.0, base_commission: 0, fat_step_cut: 0, snf_step_cut: 0 },
};

// GET /api/commission/settings
exports.getSettings = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const [rows] = await pool.query(
            `SELECT milk_type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut, is_active, updated_at
             FROM commission_settings WHERE centre_id = ?`,
            [centreId]
        );

        const result = {};
        for (const type of MILK_TYPES) {
            const row = rows.find(r => r.milk_type === type);
            result[type] = row
                ? {
                    base_fat: parseFloat(row.base_fat),
                    base_snf: parseFloat(row.base_snf),
                    base_commission: parseFloat(row.base_commission),
                    fat_step_cut: parseFloat(row.fat_step_cut),
                    snf_step_cut: parseFloat(row.snf_step_cut),
                    is_active: !!row.is_active,
                    updated_at: row.updated_at,
                    configured: true,
                }
                : { ...DEFAULTS[type], is_active: true, configured: false };
        }
        res.json(result);
    } catch (err) {
        console.error('getCommissionSettings error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// POST /api/commission/settings
// body: { cow: {base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut, is_active}, buffalo: {...} }
exports.saveSettings = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const updatedBy = req.user.role === 'admin' ? null : req.user.id;
        const payload = req.body || {};

        for (const type of MILK_TYPES) {
            const s = payload[type];
            if (!s) continue;

            const {
                base_fat, base_snf, base_commission = 0,
                fat_step_cut = 0, snf_step_cut = 0, is_active = true,
            } = s;

            if (base_fat === undefined || base_fat === '' || base_snf === undefined || base_snf === '') {
                return res.status(400).json({ error: `base_fat and base_snf are required for ${type}.` });
            }

            await pool.query(
                `INSERT INTO commission_settings
                   (centre_id, milk_type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut, is_active, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   base_fat = VALUES(base_fat),
                   base_snf = VALUES(base_snf),
                   base_commission = VALUES(base_commission),
                   fat_step_cut = VALUES(fat_step_cut),
                   snf_step_cut = VALUES(snf_step_cut),
                   is_active = VALUES(is_active),
                   updated_by = VALUES(updated_by)`,
                [centreId, type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut, is_active ? 1 : 0, updatedBy]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('saveCommissionSettings error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// GET /api/commission/preview?milk_type=cow&fat=4.0&snf=8.5&rate=37
exports.previewCommission = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { milk_type, fat, snf, rate = 0 } = req.query;
        if (!milk_type || fat === undefined || snf === undefined) {
            return res.status(400).json({ error: 'milk_type, fat, and snf are required.' });
        }
        const settingsMap = await getCommissionSettingsMap(pool, centreId);
        const commission = computeCommissionAmount(settingsMap[milk_type], fat, snf);
        res.json({
            commission_per_litre: commission,
            base_rate: parseFloat(rate) || 0,
            effective_rate: parseFloat(((parseFloat(rate) || 0) + commission).toFixed(2)),
        });
    } catch (err) {
        console.error('previewCommission error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// GET /api/commission/seller-overrides
exports.getSellerCommissions = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const [rows] = await pool.query(
            `SELECT sco.*, s.name AS seller_name, s.seller_code, s.seller_type
             FROM seller_commission_overrides sco
             JOIN sellers s ON s.seller_id = sco.seller_id
             WHERE sco.centre_id = ?
             ORDER BY sco.created_at DESC`,
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerCommissions error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// POST /api/commission/seller-overrides
exports.assignSellerCommission = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const {
            seller_id, milk_type, base_fat, base_snf,
            base_commission = 0, fat_step_cut = 0, snf_step_cut = 0,
            reason, effective_from, effective_to,
        } = req.body;

        if (!seller_id || !milk_type || base_fat === undefined || base_fat === '' ||
            base_snf === undefined || base_snf === '' || !effective_from)
            return res.status(400).json({
                message: 'seller_id, milk_type, base_fat, base_snf and effective_from are required.',
            });

        if (!['cow', 'buffalo'].includes(milk_type))
            return res.status(400).json({ message: "milk_type must be 'cow' or 'buffalo'." });

        // Verify seller belongs to centre AND is a Gavali seller
        const [sellerRows] = await pool.query(
            `SELECT seller_id, seller_type FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!sellerRows.length)
            return res.status(403).json({ message: 'Seller not found in your centre.' });
        if (sellerRows[0].seller_type !== 'Gavali')
            return res.status(400).json({ message: 'Custom commission can only be assigned to Gavali sellers.' });

        await pool.query(
            `INSERT INTO seller_commission_overrides
               (seller_id, centre_id, milk_type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut, reason, effective_from, effective_to)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [seller_id, centreId, milk_type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut, reason || null, effective_from, effective_to || null]
        );

        res.status(201).json({ message: 'Custom commission assigned to seller.' });
    } catch (err) {
        console.error('assignSellerCommission error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// PUT /api/commission/seller-overrides/:id
exports.updateSellerCommission = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;
        const {
            seller_id, milk_type, base_fat, base_snf,
            base_commission = 0, fat_step_cut = 0, snf_step_cut = 0,
            reason, effective_from, effective_to,
        } = req.body;

        if (!seller_id || !milk_type || base_fat === undefined || base_snf === undefined || !effective_from)
            return res.status(400).json({
                message: 'seller_id, milk_type, base_fat, base_snf and effective_from are required.',
            });

        const [existing] = await pool.query(
            `SELECT id FROM seller_commission_overrides WHERE id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length)
            return res.status(404).json({ message: 'Custom commission entry not found.' });

        await pool.query(
            `UPDATE seller_commission_overrides
             SET seller_id = ?, milk_type = ?, base_fat = ?, base_snf = ?,
                 base_commission = ?, fat_step_cut = ?, snf_step_cut = ?,
                 reason = ?, effective_from = ?, effective_to = ?
             WHERE id = ? AND centre_id = ?`,
            [seller_id, milk_type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut,
                reason || null, effective_from, effective_to || null, id, centreId]
        );

        const [updated] = await pool.query(
            `SELECT sco.*, s.name AS seller_name, s.seller_code, s.seller_type
             FROM seller_commission_overrides sco
             JOIN sellers s ON s.seller_id = sco.seller_id
             WHERE sco.id = ?`,
            [id]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error('updateSellerCommission error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// PATCH /api/commission/seller-overrides/:id/deactivate
exports.deactivateSellerCommission = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;

        const [existing] = await pool.query(
            `SELECT id, is_active FROM seller_commission_overrides WHERE id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length)
            return res.status(404).json({ message: 'Custom commission entry not found.' });
        if (!existing[0].is_active)
            return res.status(400).json({ message: 'Entry is already inactive.' });

        await pool.query(`UPDATE seller_commission_overrides SET is_active = 0 WHERE id = ?`, [id]);
        res.json({ message: 'Custom commission deactivated.', id: Number(id), is_active: 0 });
    } catch (err) {
        console.error('deactivateSellerCommission error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// DELETE /api/commission/seller-overrides/:id
exports.deleteSellerCommission = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;

        const [existing] = await pool.query(
            `SELECT id, is_active FROM seller_commission_overrides WHERE id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length)
            return res.status(404).json({ message: 'Custom commission entry not found.' });
        if (existing[0].is_active)
            return res.status(400).json({ message: 'Cannot delete an active entry. Deactivate it first.' });

        await pool.query(`DELETE FROM seller_commission_overrides WHERE id = ?`, [id]);
        res.json({ message: 'Custom commission entry deleted.' });
    } catch (err) {
        console.error('deleteSellerCommission error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};