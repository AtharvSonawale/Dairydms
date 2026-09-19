const pool = require('../config/db');
const bcrypt = require('bcryptjs');

const jwt = require('jsonwebtoken');

// Strips spaces, dashes, and an optional +91/91 country-code prefix,
// leaving a bare 10-digit number for storage and validation.
function normalizeMobile(raw) {
    if (!raw) return raw;
    let digits = raw.replace(/[\s-]/g, '');
    if (digits.startsWith('+91')) digits = digits.slice(3);
    else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
    return digits;
}

// POST /api/admins
// Creates a new admin in the SAME centre as the requesting admin.
// Auth: requireRole('admin') must run before this (see admins.routes.js).
//
// centre_id is taken ONLY from req.user.centre_id (the requesting admin's
// own JWT, verified by the `authenticate` middleware). It is never read
// from req.body -- even if a client sends { centre_id: 99, ... }, that
// value is ignored. This is the actual enforcement point for "an admin
// can only create admins within their own centre."
exports.createAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const mobile = normalizeMobile(req.body.mobile);

        if (!name || name.trim().length < 2)
            return res.status(400).json({ message: 'Name must be at least 2 characters.' });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            return res.status(400).json({ message: 'A valid email is required.' });
        if (mobile && !/^[6-9]\d{9}$/.test(mobile))
            return res.status(400).json({ message: 'Invalid mobile number.' });
        if (!password || password.length < 6)
            return res.status(400).json({ message: 'Password must be at least 6 characters.' });

        const centreId = req.user.centre_id;
        if (!centreId)
            return res.status(403).json({ message: 'Unable to determine centre for this request.' });

        const [existing] = await pool.query('SELECT admin_id FROM admins WHERE email = ?', [email.trim()]);
        if (existing.length > 0)
            return res.status(409).json({ message: 'An admin with this email already exists.' });

        const hash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO admins (centre_id, name, email, password_hash, mobile, has_seen_tour) VALUES (?, ?, ?, ?, ?, 0)',
            [centreId, name.trim(), email.trim(), hash, mobile || null]
        );

        const [rows] = await pool.query(
            `SELECT admin_id, centre_id, name, email, mobile, is_active,
                    created_at, has_seen_tour
             FROM admins WHERE admin_id = ?`,
            [result.insertId]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// GET /api/admins
// Lists admins in the requesting admin's own centre only.
exports.listAdmins = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const [rows] = await pool.query(
            `SELECT admin_id, centre_id, name, email, mobile, is_active,
                    created_at, has_seen_tour
             FROM admins
             WHERE centre_id = ?
             ORDER BY created_at DESC`,
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Example logout with blacklist
exports.logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(400).json({ message: 'Token required' });
        }

        // Decode token to get expiry (you need jwt.decode)
        const decoded = jwt.decode(token);
        const expiresAt = new Date(decoded.exp * 1000); // convert to Date

        await pool.query(
            'INSERT INTO token_blacklist (token, expires_at) VALUES (?, ?)',
            [token, expiresAt]
        );

        res.json({ message: 'Logged out successfully.' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/admins/me
// Returns the profile of the currently authenticated admin.
exports.getMe = async (req, res) => {
    try {
        const adminId = req.user.id;
        const [rows] = await pool.query(
            `SELECT admin_id, centre_id, name, email, mobile, address, pincode,
                    profile_image, role, created_at, has_seen_tour
             FROM admins WHERE admin_id = ?`,
            [adminId]
        );
        if (rows.length === 0)
            return res.status(404).json({ message: 'Admin not found.' });

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// PUT /api/admins/:id
// Updates the admin's own editable profile fields.
exports.updateAdmin = async (req, res) => {
    try {
        const requestedId = parseInt(req.params.id, 10);
        const selfId = req.user.admin_id || req.user.id;

        // An admin may only edit their own profile via this endpoint.
        if (requestedId !== selfId)
            return res.status(403).json({ message: 'You can only edit your own profile.' });

        const { name, email, address, pincode, profile_image } = req.body;
        const mobile = normalizeMobile(req.body.mobile);

        if (!name || name.trim().length < 2)
            return res.status(400).json({ message: 'Name must be at least 2 characters.' });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            return res.status(400).json({ message: 'A valid email is required.' });
        if (mobile && !/^[6-9]\d{9}$/.test(mobile))
            return res.status(400).json({ message: 'Invalid mobile number.' });

        await pool.query(
            `UPDATE admins
             SET name = ?, email = ?, mobile = ?, address = ?, pincode = ?, profile_image = ?
             WHERE admin_id = ?`,
            [name.trim(), email.trim(), mobile || null, address || null, pincode || null, profile_image || null, selfId]
        );

        const [rows] = await pool.query(
            `SELECT admin_id, centre_id, name, email, mobile, address, pincode,
                    profile_image, role, created_at, has_seen_tour
             FROM admins WHERE admin_id = ?`,
            [selfId]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PATCH /api/admins/:id/status ────────────────────────────
// Toggles or sets another admin's is_active within the same centre.
// Guards: caller cannot deactivate themselves, and cannot touch admins
// outside their own centre.
exports.updateAdminStatus = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const selfId = req.user.admin_id || req.user.id;
        const centreId = req.user.centre_id;
        const { is_active } = req.body;

        if (isNaN(targetId))
            return res.status(400).json({ message: 'Invalid admin id.' });
        if (targetId === selfId)
            return res.status(400).json({ message: 'You cannot change your own status.' });
        if (is_active !== 0 && is_active !== 1)
            return res.status(400).json({ message: 'is_active must be 0 or 1.' });

        // Verify the target admin belongs to the caller's centre
        const [existing] = await pool.query(
            'SELECT admin_id FROM admins WHERE admin_id = ? AND centre_id = ?',
            [targetId, centreId]
        );
        if (!existing.length)
            return res.status(404).json({ message: 'Admin not found in your centre.' });

        await pool.query(
            'UPDATE admins SET is_active = ? WHERE admin_id = ?',
            [is_active, targetId]
        );

        const [rows] = await pool.query(
            `SELECT admin_id, centre_id, name, email, mobile, is_active,
                    created_at, has_seen_tour
             FROM admins WHERE admin_id = ?`,
            [targetId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('updateAdminStatus error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PUT /api/admins/:id/manage ──────────────────────────────
// Centre-scoped edit for admins to edit *other* admins' profile fields.
// Only name/email/mobile are editable here — password, role, centre are not.
exports.manageUpdateAdmin = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const centreId = req.user.centre_id;

        if (isNaN(targetId))
            return res.status(400).json({ message: 'Invalid admin id.' });

        const { name, email } = req.body;
        const mobile = normalizeMobile(req.body.mobile);

        if (!name || name.trim().length < 2)
            return res.status(400).json({ message: 'Name must be at least 2 characters.' });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            return res.status(400).json({ message: 'A valid email is required.' });
        if (mobile && !/^[6-9]\d{9}$/.test(mobile))
            return res.status(400).json({ message: 'Invalid mobile number.' });

        const [existing] = await pool.query(
            'SELECT admin_id FROM admins WHERE admin_id = ? AND centre_id = ?',
            [targetId, centreId]
        );
        if (!existing.length)
            return res.status(404).json({ message: 'Admin not found in your centre.' });

        const [emailCheck] = await pool.query(
            'SELECT admin_id FROM admins WHERE email = ? AND admin_id != ?',
            [email.trim(), targetId]
        );
        if (emailCheck.length)
            return res.status(409).json({ message: 'Another admin with this email already exists.' });

        await pool.query(
            `UPDATE admins SET name = ?, email = ?, mobile = ? WHERE admin_id = ? AND centre_id = ?`,
            [name.trim(), email.trim(), mobile || null, targetId, centreId]
        );

        const [rows] = await pool.query(
            `SELECT admin_id, centre_id, name, email, mobile, is_active,
                    created_at, has_seen_tour
             FROM admins WHERE admin_id = ?`,
            [targetId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('manageUpdateAdmin error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── DELETE /api/admins/:id ──────────────────────────────────
// Centre-scoped delete of another admin. Guards:
//   - caller cannot delete themselves
//   - caller cannot delete an admin outside their centre
//   - caller cannot delete the LAST active admin in the centre
//     (would lock everyone out)
exports.deleteAdmin = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const selfId = req.user.admin_id || req.user.id;
        const centreId = req.user.centre_id;

        if (isNaN(targetId))
            return res.status(400).json({ message: 'Invalid admin id.' });
        if (targetId === selfId)
            return res.status(400).json({ message: 'You cannot delete your own account.' });

        // Verify target belongs to this centre
        const [existing] = await pool.query(
            'SELECT admin_id, is_active FROM admins WHERE admin_id = ? AND centre_id = ?',
            [targetId, centreId]
        );
        if (!existing.length)
            return res.status(404).json({ message: 'Admin not found in your centre.' });

        // Refuse if this is the only active admin left in the centre
        const [activeCount] = await pool.query(
            'SELECT COUNT(*) AS cnt FROM admins WHERE centre_id = ? AND is_active = 1',
            [centreId]
        );
        if (activeCount[0].cnt <= 1 && existing[0].is_active === 1)
            return res.status(400).json({
                message: 'Cannot delete the last active admin in this centre.'
            });

        await pool.query(
            'DELETE FROM admins WHERE admin_id = ? AND centre_id = ?',
            [targetId, centreId]
        );

        res.json({ message: 'Admin deleted successfully.' });
    } catch (err) {
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                message:
                    'Cannot delete — this admin has linked records. Deactivate instead.'
            });
        }
        console.error('deleteAdmin error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};