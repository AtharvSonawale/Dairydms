const pool = require('../config/db');

const getShiftByTime = () => {
    const h = new Date().getHours();
    return h >= 5 && h < 14 ? 'morning' : 'evening';
};

// ══════════════════════════════════════════════════════════════
//  GET /api/tank-dispatch?date=YYYY-MM-DD
//  All dispatches for a given date (operator-scoped)
// ══════════════════════════════════════════════════════════════
exports.getDispatches = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND dispatch_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            dateCondition = `AND dispatch_date = ?`;
            dateParams = [singleDate];
        }

        const query = `
    SELECT td.*, o.name AS operator_name, a.name AS admin_name
    FROM tank_dispatch td
    LEFT JOIN operators o ON o.operator_id = td.operator_id
    LEFT JOIN admins a ON a.admin_id = td.created_by_admin_id
    WHERE td.centre_id = ?
    ${dateCondition}
    ORDER BY td.dispatch_date ASC, FIELD(td.shift,'morning','evening') ASC, td.milk_type ASC, td.created_at ASC
`;

        const [rows] = await pool.query(query, [centreId, ...dateParams]);
        res.json(rows);

    } catch (err) {
        console.error('getDispatches error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  POST /api/tank-dispatch
//  Record a new tank dispatch
// ══════════════════════════════════════════════════════════════
exports.createDispatch = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const isAdmin = req.user.role === 'admin';
        const operatorId = isAdmin ? null : req.user.id;
        const createdByAdminId = isAdmin ? req.user.id : null;
        const centreId = req.user.centre_id;
        const {
            dispatch_date,
            milk_type,
            shift,
            cow_liters,
            buffalo_liters,
            total_liters,
            avg_fat,
            avg_snf,
            avg_fat_cow,
            avg_snf_cow,
            avg_fat_buffalo,
            avg_snf_buffalo,
            factory_name,
            vehicle_no,
            driver_name,
            factory_rate,
            total_amount,
            remarks,
            acidity,
            temperature,
            fssai_code,
        } = req.body;

        // ── validation ──
        if (!dispatch_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Dispatch date is required.' });
        }
        if (!factory_name || !String(factory_name).trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Factory name is required.' });
        }
        const parsedLiters = parseFloat(total_liters);
        if (!total_liters || isNaN(parsedLiters) || parsedLiters <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Total liters must be greater than 0.' });
        }

        // ── insert ──
        const [result] = await conn.query(
            `INSERT INTO tank_dispatch
(dispatch_date, milk_type, shift, cow_liters, buffalo_liters,
 total_liters, avg_fat, avg_snf,
 avg_fat_cow, avg_snf_cow, avg_fat_buffalo, avg_snf_buffalo,
 factory_name, vehicle_no, driver_name,
 factory_rate, total_amount, operator_id, created_by_admin_id, centre_id, remarks,
 acidity, temperature, fssai_code)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                dispatch_date,
                milk_type || 'cow',
                shift ? String(shift) : getShiftByTime(),
                cow_liters != null ? parseFloat(cow_liters) : 0,
                buffalo_liters != null ? parseFloat(buffalo_liters) : 0,
                parseFloat(total_liters),
                avg_fat != null ? parseFloat(avg_fat) : null,
                avg_snf != null ? parseFloat(avg_snf) : null,
                avg_fat_cow != null ? parseFloat(avg_fat_cow) : null,
                avg_snf_cow != null ? parseFloat(avg_snf_cow) : null,
                avg_fat_buffalo != null ? parseFloat(avg_fat_buffalo) : null,
                avg_snf_buffalo != null ? parseFloat(avg_snf_buffalo) : null,
                String(factory_name).trim(),
                vehicle_no ? String(vehicle_no).trim() : null,
                driver_name ? String(driver_name).trim() : null,
                (factory_rate !== null && factory_rate !== undefined && factory_rate !== '' && !isNaN(parseFloat(factory_rate))) ? parseFloat(factory_rate) : null,
                (total_amount != null && !isNaN(parseFloat(total_amount))) ? parseFloat(total_amount) : 0,
                operatorId,
                createdByAdminId,
                centreId,
                remarks ? String(remarks).trim() : null,
                acidity || '12.5',
                temperature || '2',
                fssai_code || '11521040000016',
            ]
        );

        await conn.commit();

        // ── return the inserted row ──
        const [newRow] = await pool.query(
            `SELECT td.*, o.name AS operator_name, a.name AS admin_name
 FROM tank_dispatch td
 LEFT JOIN operators o ON o.operator_id = td.operator_id
 LEFT JOIN admins a ON a.admin_id = td.created_by_admin_id
 WHERE td.dispatch_id = ? AND td.centre_id = ?`,
            [result.insertId, centreId]
        );
        res.status(201).json(newRow[0]);

    } catch (err) {
        await conn.rollback();
        console.error('createDispatch error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
//  DELETE /api/tank-dispatch/:id
//  Remove a dispatch record (operator-scoped)
// ══════════════════════════════════════════════════════════════
exports.deleteDispatch = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        let checkQuery = `SELECT dispatch_id FROM tank_dispatch WHERE dispatch_id = ? AND centre_id = ?`;
        let checkParams = [id, centreId];

        if (!isAdmin) {
            checkQuery += ` AND operator_id = ?`;
            checkParams.push(operatorId);
        }

        const [existing] = await pool.query(checkQuery, checkParams);
        if (!existing[0]) {
            return res.status(404).json({ error: 'Dispatch record not found or unauthorized.' });
        }

        let deleteQuery = `DELETE FROM tank_dispatch WHERE dispatch_id = ? AND centre_id = ?`;
        let deleteParams = [id, centreId];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            deleteParams.push(operatorId);
        }

        await pool.query(deleteQuery, deleteParams);
        res.json({ message: 'Dispatch deleted successfully.' });

    } catch (err) {
        console.error('deleteDispatch error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/tank-dispatch/history
//  Get history of dispatches for auto-complete
// ══════════════════════════════════════════════════════════════
exports.getHistory = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        const query = `
            SELECT factory_name, vehicle_no, driver_name, factory_rate, created_at, acidity, temperature
            FROM tank_dispatch
            WHERE centre_id = ?
            ORDER BY created_at DESC LIMIT 100
        `;

        const [rows] = await pool.query(query, [centreId]);

        // Deduplicate by factory_name keeping the most recent entry for each
        const seen = new Set();
        const unique = [];
        for (const row of rows) {
            if (!seen.has(row.factory_name)) {
                seen.add(row.factory_name);
                unique.push(row);
            }
        }

        res.json(unique);
    } catch (err) {
        console.error("getHistory error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  PUT /api/tank-dispatch/:id
//  Update a dispatch record
// ══════════════════════════════════════════════════════════════
exports.updateDispatch = async (req, res) => {
    try {
        const { id } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        const {
            factory_name,
            vehicle_no,
            driver_name,
            factory_rate,
            total_amount,
            total_liters,
            cow_liters,
            buffalo_liters,
            remarks,
            acidity,
            temperature,
        } = req.body;

        // Check if dispatch exists and user has access
        let checkQuery = `SELECT dispatch_id, total_liters AS old_liters, centre_id, operator_id FROM tank_dispatch WHERE dispatch_id = ?`;
        let checkParams = [id];

        const [existing] = await pool.query(checkQuery, checkParams);
        if (!existing[0]) {
            return res.status(404).json({ error: 'Dispatch not found.' });
        }

        // Check centre access
        if (existing[0].centre_id !== centreId) {
            return res.status(403).json({ error: 'Access denied. Dispatch belongs to a different centre.' });
        }

        if (!isAdmin && existing[0].operator_id !== operatorId) {
            return res.status(403).json({ error: 'Access denied. You can only update your own dispatches.' });
        }

        // Recompute amount if rate and liters are present
        const usedLiters = total_liters != null && !isNaN(parseFloat(total_liters))
            ? parseFloat(total_liters)
            : parseFloat(existing[0].old_liters);

        const usedRate = factory_rate != null && factory_rate !== '' && !isNaN(parseFloat(factory_rate))
            ? parseFloat(factory_rate)
            : null;

        const computedAmount = usedRate
            ? parseFloat((usedLiters * usedRate).toFixed(2))
            : parseFloat(total_amount || 0);

        let updateQuery = `
            UPDATE tank_dispatch SET
                factory_name = ?,
                vehicle_no   = ?,
                driver_name  = ?,
                factory_rate = ?,
                total_liters = ?,
                cow_liters   = ?,
                buffalo_liters = ?,
                total_amount = ?,
                remarks      = ?,
                acidity      = ?,
                temperature  = ?
            WHERE dispatch_id = ? AND centre_id = ?
        `;
        let updateParams = [
            factory_name,
            vehicle_no || null,
            driver_name || null,
            usedRate,
            usedLiters,
            cow_liters != null ? parseFloat(cow_liters) : usedLiters,
            buffalo_liters != null ? parseFloat(buffalo_liters) : 0,
            computedAmount,
            remarks || null,
            acidity || '12.5',
            temperature || '2',
            id,
            centreId
        ];

        if (!isAdmin) {
            updateQuery += ` AND operator_id = ?`;
            updateParams.push(operatorId);
        }

        await pool.query(updateQuery, updateParams);

        const [updated] = await pool.query(
            `SELECT td.*, o.name AS operator_name, a.name AS admin_name
 FROM tank_dispatch td
 LEFT JOIN operators o ON o.operator_id = td.operator_id
 LEFT JOIN admins a ON a.admin_id = td.created_by_admin_id
 WHERE td.dispatch_id = ? AND td.centre_id = ?`,
            [id, centreId]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error('updateDispatch error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/settings/dispatch
//  Get dispatch settings (acidity, temperature, FSSAI code)
// ══════════════════════════════════════════════════════════════
exports.getDispatchSettings = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // Get from global_settings or app_settings
        const [rows] = await pool.query(
            `SELECT setting_key, setting_value 
             FROM app_settings 
             WHERE centre_id = ? 
               AND setting_key IN ('default_acidity', 'default_temperature', 'fssai_code')
               AND operator_id IS NULL`,
            [centreId]
        );

        const result = {
            default_acidity: '12.5',
            default_temperature: '2',
            fssai_code: '11521040000016'
        };

        rows.forEach(row => {
            result[row.setting_key] = row.setting_value;
        });

        res.json(result);
    } catch (err) {
        console.error('getDispatchSettings error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  POST /api/settings/dispatch
//  Save dispatch settings (acidity, temperature, FSSAI code)
// ══════════════════════════════════════════════════════════════
exports.saveDispatchSettings = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const { default_acidity, default_temperature, fssai_code } = req.body;

        const entries = [
            [null, centreId, 'default_acidity', default_acidity || '12.5'],
            [null, centreId, 'default_temperature', default_temperature || '2'],
            [null, centreId, 'fssai_code', fssai_code || '11521040000016'],
        ];

        await pool.query(
            `INSERT INTO app_settings (operator_id, centre_id, setting_key, setting_value)
             VALUES ?
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [entries]
        );

        res.json({ message: 'Dispatch settings saved successfully.' });
    } catch (err) {
        console.error('saveDispatchSettings error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};