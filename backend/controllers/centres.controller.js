const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const signToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// GET /api/centres
// Lists every centre in the admin's own dairy (their dairy_id, from the JWT).
exports.listCentres = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;
        const [rows] = await pool.query(
            `SELECT centre_id, centre_name, centre_code, address, contact_number, is_active, created_at
             FROM centres
             WHERE dairy_id = ?
             ORDER BY centre_name ASC`,
            [dairyId]
        );
        res.json(rows.map(r => ({ ...r, is_current: r.centre_id === req.user.centre_id })));
    } catch (err) {
        console.error('listCentres error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// POST /api/centres
// Creates a new centre under the admin's own dairy_id. dairy_id is taken
// ONLY from req.user.dairy_id (the JWT) -- never from req.body -- same
// enforcement pattern as createAdmin's centre_id scoping.
exports.createCentre = async (req, res) => {
    try {
        const { centre_name, centre_code, address, contact_number } = req.body;
        const dairyId = req.user.dairy_id;

        if (!centre_name || !centre_name.trim())
            return res.status(400).json({ message: 'Centre name is required.' });
        if (!centre_code || !centre_code.trim())
            return res.status(400).json({ message: 'Centre code is required.' });
        if (contact_number && !/^\+?[0-9]{10,15}$/.test(contact_number))
            return res.status(400).json({ message: 'Invalid contact number format.' });

        // centre_code is globally unique (schema: UNIQUE KEY centre_code),
        // not just within this dairy -- check up front for a clean error
        // instead of surfacing a raw SQL duplicate-key error.
        const [existing] = await pool.query(
            'SELECT centre_id FROM centres WHERE centre_code = ?',
            [centre_code.trim()]
        );
        if (existing.length > 0)
            return res.status(409).json({ message: 'Centre code already exists.' });

        const [result] = await pool.query(
            `INSERT INTO centres (dairy_id, centre_name, centre_code, address, contact_number, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [dairyId, centre_name.trim(), centre_code.trim(), address || null, contact_number || null]
        );

        const [rows] = await pool.query(
            'SELECT centre_id, centre_name, centre_code, address, contact_number, is_active, created_at FROM centres WHERE centre_id = ?',
            [result.insertId]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('createCentre error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// POST /api/centres/switch
// Body: { centre_id }
// Re-issues a fresh JWT with a different centre_id, but the SAME
// dairy_id/id/role/name as the current token. Only allowed if the target
// centre belongs to the admin's own dairy_id -- this is the actual
// enforcement point ("an admin can switch to any centre, but only within
// their own dairy"), mirroring how createAdmin scopes by centre_id today.
exports.switchCentre = async (req, res) => {
    try {
        const { centre_id } = req.body;
        if (!centre_id)
            return res.status(400).json({ message: 'centre_id is required.' });

        const [rows] = await pool.query(
            `SELECT c.centre_id, c.centre_name, c.dairy_id, d.dairy_name
             FROM centres c
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE c.centre_id = ? AND c.dairy_id = ? AND c.is_active = 1`,
            [centre_id, req.user.dairy_id]
        );

        if (rows.length === 0)
            return res.status(403).json({ message: 'That centre is not part of your dairy, or is inactive.' });

        const target = rows[0];

        // has_seen_tour is per-admin, not per-centre -- re-fetch it so the
        // tour logic in AppLayout keeps working correctly after switching.
        const [[adminRow]] = await pool.query(
            'SELECT has_seen_tour FROM admins WHERE admin_id = ?',
            [req.user.id]
        );

        const token = signToken({
            id: req.user.id,
            role: req.user.role,
            name: req.user.name,
            centre_id: target.centre_id,
            dairy_id: target.dairy_id,
        });

        // Same response shape as adminLogin -- frontend can reuse login()
        // to store it, no separate handling needed.
        res.json({
            token,
            role: req.user.role,
            name: req.user.name,
            centre_id: target.centre_id,
            dairy_id: target.dairy_id,
            dairy_name: target.dairy_name,
            centre_name: target.centre_name,
            has_seen_tour: adminRow?.has_seen_tour,
        });
    } catch (err) {
        console.error('switchCentre error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// PUT /api/centres/:id
// Updates a centre's editable fields. Scoped to the admin's own dairy_id.
exports.updateCentre = async (req, res) => {
    try {
        const { id } = req.params;
        const { centre_name, centre_code, address, contact_number } = req.body;
        const dairyId = req.user.dairy_id;

        if (!centre_name || !centre_name.trim())
            return res.status(400).json({ message: 'Centre name is required.' });
        if (!centre_code || !centre_code.trim())
            return res.status(400).json({ message: 'Centre code is required.' });
        if (contact_number && !/^\+?[0-9]{10,15}$/.test(contact_number))
            return res.status(400).json({ message: 'Invalid contact number format.' });

        const [[existingCentre]] = await pool.query(
            'SELECT centre_id FROM centres WHERE centre_id = ? AND dairy_id = ?',
            [id, dairyId]
        );
        if (!existingCentre)
            return res.status(404).json({ message: 'Centre not found in your dairy.' });

        // centre_code is globally unique -- check no OTHER centre has it
        const [dupCode] = await pool.query(
            'SELECT centre_id FROM centres WHERE centre_code = ? AND centre_id != ?',
            [centre_code.trim(), id]
        );
        if (dupCode.length > 0)
            return res.status(409).json({ message: 'Centre code already exists.' });

        await pool.query(
            `UPDATE centres SET centre_name = ?, centre_code = ?, address = ?, contact_number = ? WHERE centre_id = ?`,
            [centre_name.trim(), centre_code.trim(), address || null, contact_number || null, id]
        );

        const [rows] = await pool.query(
            'SELECT centre_id, centre_name, centre_code, address, contact_number, is_active, created_at FROM centres WHERE centre_id = ?',
            [id]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('updateCentre error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// DELETE /api/centres/:id
// Deletes a centre AND all data scoped to it across the schema.
//
// Most tables with a centre_id column do NOT have ON DELETE CASCADE
// defined (only bonus_default_slabs, buffalo_milk_rates, cow_milk_rates,
// gavali_bonus_default_rates, payment_cycle_config, speed_cattle_feeds,
// speed_products do). Rather than hand-order ~50 tables around every FK
// (including cross-references like bonus_payments -> sellers -> centres,
// or bill_walkin_sales -> bill_master -> centres), we temporarily disable
// FK checks for this transaction, explicitly clear every centre-scoped
// table, then delete the centre row, then re-enable FK checks. This is a
// destructive, irreversible operation -- the frontend requires typing the
// centre name to confirm before calling this endpoint.
exports.deleteCentre = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { id } = req.params;
        const dairyId = req.user.dairy_id;

        const [[centre]] = await pool.query(
            'SELECT centre_id, centre_name FROM centres WHERE centre_id = ? AND dairy_id = ?',
            [id, dairyId]
        );
        if (!centre) {
            return res.status(404).json({ message: 'Centre not found in your dairy.' });
        }

        // Can't delete the centre you're currently operating in
        if (Number(id) === Number(req.user.centre_id)) {
            return res.status(400).json({ message: 'You cannot delete the centre you are currently logged into. Switch to another centre first.' });
        }

        // Can't delete the last remaining centre in the dairy
        const [[{ count }]] = await pool.query(
            'SELECT COUNT(*) AS count FROM centres WHERE dairy_id = ?',
            [dairyId]
        );
        if (count <= 1) {
            return res.status(400).json({ message: 'Cannot delete the only centre in your dairy.' });
        }

        await conn.beginTransaction();
        await conn.query('SET FOREIGN_KEY_CHECKS = 0');

        // Every table in the schema that has a centre_id column.
        // Order doesn't matter here since FK checks are disabled.
        const centreScopedTables = [
            'bill_cash_advance_snapshot', 'bill_cattle_feed_sales', 'bill_deposit_snapshot',
            'bill_milk_entries', 'bill_product_sales', 'bill_walkin_sales', 'bill_master',
            'walkin_bill_sales_snapshot', 'walkin_bill_master',
            'bonus_payments', 'bonus_register', 'bonus_slabs', 'bonus_events', 'bonus_default_slabs',
            'gavali_bonus_payments', 'gavali_bonus_events', 'gavali_bonus_default_rates',
            'buffalo_milk_rates', 'cow_milk_rates', 'generated_rates', 'premium_rates',
            'cash_advance', 'seller_deposits', 'seller_payments',
            'cattle_feed_purchase_bill_items', 'cattle_feed_purchase_bills', 'cattle_feed_purchases',
            'cattle_feed_sales', 'cattle_feeds', 'speed_cattle_feeds',
            'product_purchase_bill_items', 'product_purchase_bills', 'product_purchase_payments',
            'product_purchases', 'products', 'speed_products',
            'walkin_payments', 'walkin_sales', 'walkin_named_buyers', 'walkin_product_types',
            'milk_entries', 'owner_usage', 'tank_dispatch', 'expenses',
            'payment_cycle_config', 'excel_export_config', 'app_settings',
            'sellers', 'operators', 'admins',
        ];

        for (const table of centreScopedTables) {
            await conn.query(`DELETE FROM ${table} WHERE centre_id = ?`, [id]);
        }

        await conn.query('DELETE FROM centres WHERE centre_id = ?', [id]);

        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
        await conn.commit();

        res.json({ success: true, message: `Centre "${centre.centre_name}" and all related data deleted.` });
    } catch (err) {
        await conn.rollback();
        console.error('deleteCentre error:', err);
        res.status(500).json({ message: 'Server error while deleting centre', error: err.message });
    } finally {
        conn.release();
    }
};