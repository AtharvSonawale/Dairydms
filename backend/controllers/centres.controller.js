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