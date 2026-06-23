const pool = require('../config/db');
const bcrypt = require('bcryptjs');

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
        const { name, email, mobile, password } = req.body;

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
            'INSERT INTO admins (centre_id, name, email, password_hash, mobile) VALUES (?, ?, ?, ?, ?)',
            [centreId, name.trim(), email.trim(), hash, mobile || null]
        );

        const [rows] = await pool.query(
            'SELECT admin_id, centre_id, name, email, mobile, created_at FROM admins WHERE admin_id = ?',
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
            'SELECT admin_id, centre_id, name, email, mobile, created_at FROM admins WHERE centre_id = ? ORDER BY created_at DESC',
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};