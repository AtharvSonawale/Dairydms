const pool = require('../config/db');

// ─── Global Settings ──────────────────────────────────────────────────────────

// GET /api/settings/global
exports.getGlobalSettings = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;

        const [rows] = await pool.query(
            `SELECT setting_key, setting_value FROM global_settings WHERE dairy_id = ?`,
            [dairyId]
        );
        const result = {};
        rows.forEach(r => { result[r.setting_key] = r.setting_value; });
        res.json(result);
    } catch (err) {
        console.error('getGlobalSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/settings/global
exports.saveGlobalSettings = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const { app_name, logo_url, text_size, language } = req.body;
        const entries = [
            [dairyId, 'app_name', app_name ?? 'MilkApp'],
            [dairyId, 'logo_url', logo_url ?? ''],
            [dairyId, 'text_size', text_size ?? 'base'],
            [dairyId, 'language', language ?? 'en'],
        ];

        await pool.query(
            `INSERT INTO global_settings (dairy_id, setting_key, setting_value)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               setting_value = VALUES(setting_value),
               updated_at    = CURRENT_TIMESTAMP`,
            [entries]
        );

        res.json({ message: 'Dairy settings saved.' });
    } catch (err) {
        console.error('saveGlobalSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── Operator Permissions ─────────────────────────────────────────────────────

// GET /api/settings/permissions/:operatorId
exports.getPermissions = async (req, res) => {
    try {
        const { operatorId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Verify operator belongs to the same centre
        let verifyQuery = `SELECT operator_id FROM operators WHERE operator_id = ? AND centre_id = ?`;
        let verifyParams = [operatorId, centreId];

        if (!isAdmin) {
            verifyQuery += ` AND operator_id = ?`;
            verifyParams.push(req.user.id);
        }

        const [verify] = await pool.query(verifyQuery, verifyParams);
        if (!verify.length) {
            return res.status(403).json({ error: 'Access denied. Operator not found in your centre.' });
        }

        const [rows] = await pool.query(
            `SELECT page_key, can_create, can_read, can_update, can_delete
             FROM operator_permissions WHERE operator_id = ?`,
            [operatorId]
        );
        const result = {};
        rows.forEach(r => {
            result[r.page_key] = {
                C: !!r.can_create,
                R: !!r.can_read,
                U: !!r.can_update,
                D: !!r.can_delete,
            };
        });
        res.json(result);
    } catch (err) {
        console.error('getPermissions error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/settings/permissions/:operatorId
exports.savePermissions = async (req, res) => {
    try {
        const { operatorId } = req.params;
        const { access } = req.body;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Verify operator belongs to the same centre
        let verifyQuery = `SELECT operator_id FROM operators WHERE operator_id = ? AND centre_id = ?`;
        let verifyParams = [operatorId, centreId];

        if (!isAdmin) {
            verifyQuery += ` AND operator_id = ?`;
            verifyParams.push(req.user.id);
        }

        const [verify] = await pool.query(verifyQuery, verifyParams);
        if (!verify.length) {
            return res.status(403).json({ error: 'Access denied. Operator not found in your centre.' });
        }

        const entries = Object.entries(access);
        if (!entries.length) return res.json({ message: 'Nothing to save.' });

        const values = entries.map(([page_key, ops]) => [
            operatorId, page_key,
            ops.C ? 1 : 0,
            ops.R ? 1 : 0,
            ops.U ? 1 : 0,
            ops.D ? 1 : 0,
        ]);

        await pool.query(
            `INSERT INTO operator_permissions
               (operator_id, page_key, can_create, can_read, can_update, can_delete)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               can_create = VALUES(can_create),
               can_read   = VALUES(can_read),
               can_update = VALUES(can_update),
               can_delete = VALUES(can_delete)`,
            [values]
        );
        res.json({ message: 'Permissions saved.' });
    } catch (err) {
        console.error('savePermissions error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/settings/permissions/apply-defaults
exports.applyDefaults = async (req, res) => {
    try {
        const { access } = req.body;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Only admins can apply defaults
        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        // Get all operators in the centre
        const [operators] = await pool.query(
            `SELECT operator_id FROM operators WHERE centre_id = ?`,
            [centreId]
        );

        for (const op of operators) {
            const entries = Object.entries(access);
            const values = entries.map(([page_key, ops]) => [
                op.operator_id, page_key,
                ops.C ? 1 : 0,
                ops.R ? 1 : 0,
                ops.U ? 1 : 0,
                ops.D ? 1 : 0,
            ]);
            await pool.query(
                `INSERT INTO operator_permissions
                   (operator_id, page_key, can_create, can_read, can_update, can_delete)
                 VALUES ?
                 ON DUPLICATE KEY UPDATE
                   can_create = VALUES(can_create),
                   can_read   = VALUES(can_read),
                   can_update = VALUES(can_update),
                   can_delete = VALUES(can_delete)`,
                [values]
            );
        }
        res.json({ message: 'Defaults applied to all operators in your centre.' });
    } catch (err) {
        console.error('applyDefaults error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── Per-Operator App Settings ───────────────────────────────────────────────

// GET /api/settings/app
exports.getAppSettings = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;

        // Get operator-specific settings
        const [rows] = await pool.query(
            `SELECT setting_key, setting_value
             FROM app_settings WHERE operator_id = ? AND centre_id = ?`,
            [operatorId, centreId]
        );
        const result = {};
        rows.forEach(r => { result[r.setting_key] = r.setting_value; });

        // Get centre-level defaults if operator doesn't have specific settings
        if (Object.keys(result).length === 0) {
            const [centreRows] = await pool.query(
                `SELECT setting_key, setting_value
                 FROM app_settings WHERE centre_id = ? AND operator_id IS NULL`,
                [centreId]
            );
            centreRows.forEach(r => {
                if (!result[r.setting_key]) {
                    result[r.setting_key] = r.setting_value;
                }
            });
        }

        res.json(result);
    } catch (err) {
        console.error('getAppSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/settings/app
exports.saveAppSettings = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const { text_size, theme, language, date_format, time_format } = req.body;

        const entries = [];

        if (text_size !== undefined) {
            entries.push([operatorId, centreId, 'text_size', text_size]);
        }
        if (theme !== undefined) {
            entries.push([operatorId, centreId, 'theme', theme]);
        }
        if (language !== undefined) {
            entries.push([operatorId, centreId, 'language', language]);
        }
        if (date_format !== undefined) {
            entries.push([operatorId, centreId, 'date_format', date_format]);
        }
        if (time_format !== undefined) {
            entries.push([operatorId, centreId, 'time_format', time_format]);
        }

        if (entries.length === 0) {
            return res.json({ message: 'No settings to save.' });
        }

        await pool.query(
            `INSERT INTO app_settings (operator_id, centre_id, setting_key, setting_value)
             VALUES ?
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [entries]
        );

        res.json({ message: 'App settings saved.' });
    } catch (err) {
        console.error('saveAppSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── Centre Settings (Admin only) ─────────────────────────────────────────────

// GET /api/settings/centre
exports.getCentreSettings = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const [rows] = await pool.query(
            `SELECT setting_key, setting_value
             FROM app_settings 
             WHERE centre_id = ? AND operator_id IS NULL`,
            [centreId]
        );
        const result = {};
        rows.forEach(r => { result[r.setting_key] = r.setting_value; });
        res.json(result);
    } catch (err) {
        console.error('getCentreSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// POST /api/settings/centre
exports.saveCentreSettings = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const { default_text_size, default_theme, default_language, default_date_format, default_time_format } = req.body;

        const entries = [];

        if (default_text_size !== undefined) {
            entries.push([null, centreId, 'default_text_size', default_text_size]);
        }
        if (default_theme !== undefined) {
            entries.push([null, centreId, 'default_theme', default_theme]);
        }
        if (default_language !== undefined) {
            entries.push([null, centreId, 'default_language', default_language]);
        }
        if (default_date_format !== undefined) {
            entries.push([null, centreId, 'default_date_format', default_date_format]);
        }
        if (default_time_format !== undefined) {
            entries.push([null, centreId, 'default_time_format', default_time_format]);
        }

        if (entries.length === 0) {
            return res.json({ message: 'No settings to save.' });
        }

        await pool.query(
            `INSERT INTO app_settings (operator_id, centre_id, setting_key, setting_value)
             VALUES ?
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [entries]
        );

        res.json({ message: 'Centre settings saved.' });
    } catch (err) {
        console.error('saveCentreSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── Data Management ──────────────────────────────────────────────────────────

// POST /api/settings/clear-data
exports.clearAllData = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // Tables that should be cleared by centre
        const centreTables = [
            'bill_milk_entries',
            'bill_product_sales',
            'bill_cash_advance_snapshot',
            'bill_deposit_snapshot',
            'bill_walkin_sales',
            'bill_master',
            'seller_payments',
            'seller_deposits',
            'cash_advance',
            'product_sales',
            'product_purchases',
            'walkin_sales',
            'walkin_payments',
            'tank_dispatch',
            'owner_usage',
            'bonus_register',
            'bonus_payments',
            'bonus_slabs',
            'bonus_events',
            'gavali_bonus_payments',
            'gavali_bonus_events',
            'generated_rates',
            'milk_entries'
        ];

        for (const table of centreTables) {
            let deleteQuery = `DELETE FROM ${table} WHERE centre_id = ?`;
            let deleteParams = [centreId];

            // For operator, also filter by operator_id
            if (!isAdmin) {
                // Check if table has operator_id column
                const [columns] = await conn.query(
                    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                     WHERE TABLE_NAME = ? AND COLUMN_NAME = 'operator_id'`,
                    [table]
                );
                if (columns.length > 0) {
                    deleteQuery += ` AND operator_id = ?`;
                    deleteParams.push(operatorId);
                }
            }

            await conn.query(deleteQuery, deleteParams);
        }

        // Reset sequences if needed
        for (const table of centreTables) {
            // Only reset if table was fully cleared (admin)
            if (isAdmin) {
                try {
                    await conn.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
                } catch (e) {
                    // Some tables might not have auto_increment
                }
            }
        }

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        await conn.commit();

        res.json({
            success: true,
            message: isAdmin ? 'All centre data cleared.' : 'Your data cleared.'
        });
    } catch (err) {
        await conn.rollback();
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        console.error('clearAllData error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
};

// ─── System Info ──────────────────────────────────────────────────────────────

// GET /api/settings/system-info
exports.getSystemInfo = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Get centre info
        const [[centre]] = await pool.query(
            `SELECT c.*, d.dairy_name 
             FROM centres c
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE c.centre_id = ?`,
            [centreId]
        );

        // Get counts
        const [counts] = await pool.query(
            `SELECT
                (SELECT COUNT(*) FROM operators WHERE centre_id = ?) AS total_operators,
                (SELECT COUNT(*) FROM sellers WHERE centre_id = ?) AS total_sellers,
                (SELECT COUNT(*) FROM milk_entries WHERE centre_id = ?) AS total_milk_entries,
                (SELECT COUNT(*) FROM bill_master WHERE centre_id = ?) AS total_bills
            `,
            [centreId, centreId, centreId, centreId]
        );

        res.json({
            centre: centre,
            counts: counts[0],
            user: {
                id: req.user.id,
                role: req.user.role,
                name: req.user.name
            }
        });
    } catch (err) {
        console.error('getSystemInfo error:', err);
        res.status(500).json({ error: err.message });
    }
};