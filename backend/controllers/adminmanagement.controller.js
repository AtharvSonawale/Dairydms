const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// All endpoints here are scoped to req.user.centre_id — an admin can only
// see/manage other admins within their own centre, never across centres
// or dairies. req.user is populated by the `authenticate` middleware from
// the JWT (see middleware/auth.js), and centre_id is trusted from the
// token by design (see comments in that file).

// ── GET /api/admin-management ─────────────────────────────────
// List all admins in the acting admin's centre.
exports.getAdmins = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        const [rows] = await pool.query(
            `SELECT a.admin_id, a.name, a.email, a.mobile, a.is_active, a.created_at,
                    c.centre_name, c.centre_code, d.dairy_name
             FROM admins a
             JOIN centres c ON c.centre_id = a.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE a.centre_id = ?
             ORDER BY a.is_active DESC, a.name ASC`,
            [centre_id]
        );

        res.json(rows);
    } catch (err) {
        console.error('getAdmins error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/admin-management/:id ─────────────────────────────
// Single admin profile, only if they belong to the acting admin's centre.
exports.getAdminById = async (req, res) => {
    try {
        const { id } = req.params;
        const centre_id = req.user.centre_id;

        const [rows] = await pool.query(
            `SELECT a.admin_id, a.name, a.email, a.mobile, a.is_active, a.created_at,
                    a.centre_id, c.centre_name, c.centre_code, d.dairy_name
             FROM admins a
             JOIN centres c ON c.centre_id = a.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE a.admin_id = ? AND a.centre_id = ?`,
            [id, centre_id]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Admin not found in your centre.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('getAdminById error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/admin-management ────────────────────────────────
// Create a new admin in the acting admin's own centre.
exports.createAdmin = async (req, res) => {
    const { name, email, password, mobile } = req.body;
    const centre_id = req.user.centre_id;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (mobile && !/^\+?[0-9]{10,15}$/.test(mobile)) {
        return res.status(400).json({ message: 'Invalid mobile number format.' });
    }

    const conn = await pool.getConnection();
    try {
        const [existing] = await conn.query('SELECT admin_id FROM admins WHERE email = ?', [email]);
        if (existing.length > 0) {
            conn.release();
            return res.status(409).json({ message: 'Email already registered.' });
        }

        await conn.beginTransaction();

        const hash = await bcrypt.hash(password, 10);
        const [result] = await conn.query(
            `INSERT INTO admins (centre_id, name, email, password_hash, mobile, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`,
            [centre_id, name.trim(), email.trim(), hash, mobile || null]
        );

        await conn.commit();

        const [row] = await pool.query(
            `SELECT a.admin_id, a.name, a.email, a.mobile, a.is_active, a.created_at,
                    c.centre_name, d.dairy_name
             FROM admins a
             JOIN centres c ON c.centre_id = a.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE a.admin_id = ?`,
            [result.insertId]
        );

        res.status(201).json(row[0]);
    } catch (err) {
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        console.error('createAdmin error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
        conn.release();
    }
};

// ── PUT /api/admin-management/:id ─────────────────────────────
// Update name/email/mobile/active-status. Password is optional —
// only changed if a new one is supplied.
exports.updateAdmin = async (req, res) => {
    const { id } = req.params;
    const centre_id = req.user.centre_id;
    const { name, email, mobile, password, is_active } = req.body;

    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required.' });
    }
    if (mobile && !/^\+?[0-9]{10,15}$/.test(mobile)) {
        return res.status(400).json({ message: 'Invalid mobile number format.' });
    }
    if (password && password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const conn = await pool.getConnection();
    try {
        const [existing] = await conn.query(
            'SELECT admin_id FROM admins WHERE admin_id = ? AND centre_id = ?',
            [id, centre_id]
        );
        if (!existing.length) {
            conn.release();
            return res.status(404).json({ message: 'Admin not found in your centre.' });
        }

        // Prevent email collision with a different admin
        const [emailClash] = await conn.query(
            'SELECT admin_id FROM admins WHERE email = ? AND admin_id != ?',
            [email.trim(), id]
        );
        if (emailClash.length) {
            conn.release();
            return res.status(409).json({ message: 'Email already in use by another account.' });
        }

        await conn.beginTransaction();

        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await conn.query(
                `UPDATE admins SET name = ?, email = ?, mobile = ?, password_hash = ?, is_active = ?
                 WHERE admin_id = ? AND centre_id = ?`,
                [name.trim(), email.trim(), mobile || null, hash,
                is_active !== undefined ? is_active : 1, id, centre_id]
            );
        } else {
            await conn.query(
                `UPDATE admins SET name = ?, email = ?, mobile = ?, is_active = ?
                 WHERE admin_id = ? AND centre_id = ?`,
                [name.trim(), email.trim(), mobile || null,
                is_active !== undefined ? is_active : 1, id, centre_id]
            );
        }

        await conn.commit();

        const [row] = await pool.query(
            `SELECT a.admin_id, a.name, a.email, a.mobile, a.is_active, a.created_at,
                    c.centre_name, d.dairy_name
             FROM admins a
             JOIN centres c ON c.centre_id = a.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE a.admin_id = ?`,
            [id]
        );

        res.json(row[0]);
    } catch (err) {
        try { await conn.rollback(); } catch (_) { /* ignore */ }
        console.error('updateAdmin error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
        conn.release();
    }
};

// ── DELETE /api/admin-management/:id ──────────────────────────
// Soft delete: sets is_active = 0. Never hard-deletes, so billing/audit
// history tied to created_by_admin_id elsewhere stays intact.
exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const centre_id = req.user.centre_id;

        if (parseInt(id, 10) === req.user.id) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        const [existing] = await pool.query(
            'SELECT admin_id FROM admins WHERE admin_id = ? AND centre_id = ?',
            [id, centre_id]
        );
        if (!existing.length) {
            return res.status(404).json({ message: 'Admin not found in your centre.' });
        }

        await pool.query(
            'UPDATE admins SET is_active = 0 WHERE admin_id = ? AND centre_id = ?',
            [id, centre_id]
        );

        res.json({ message: 'Admin deactivated successfully.' });
    } catch (err) {
        console.error('deleteAdmin error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PATCH /api/admin-management/:id/status ────────────────────
// Convenience endpoint to reactivate/deactivate without a full update.
exports.toggleAdminStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const centre_id = req.user.centre_id;
        const { is_active } = req.body;

        if (parseInt(id, 10) === req.user.id && !is_active) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        const [existing] = await pool.query(
            'SELECT admin_id FROM admins WHERE admin_id = ? AND centre_id = ?',
            [id, centre_id]
        );
        if (!existing.length) {
            return res.status(404).json({ message: 'Admin not found in your centre.' });
        }

        await pool.query(
            'UPDATE admins SET is_active = ? WHERE admin_id = ? AND centre_id = ?',
            [is_active ? 1 : 0, id, centre_id]
        );

        const [row] = await pool.query(
            'SELECT admin_id, name, email, is_active FROM admins WHERE admin_id = ?',
            [id]
        );

        res.json(row[0]);
    } catch (err) {
        console.error('toggleAdminStatus error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};