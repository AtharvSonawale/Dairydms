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