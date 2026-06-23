const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// ── GET /api/operators ────────────────────────────────────────
exports.listOperators = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const adminId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Only admins can list operators
        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const [rows] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.mobile, o.is_active, o.created_at,
                    a.name AS admin_name, a.admin_id,
                    c.centre_name, c.centre_code
             FROM operators o
             JOIN admins a ON a.admin_id = o.admin_id
             JOIN centres c ON c.centre_id = o.centre_id
             WHERE o.centre_id = ?
             ORDER BY o.created_at DESC`,
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('listOperators error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/operators/all (Super Admin only) ────────────────
exports.listAllOperators = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const [rows] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.mobile, o.is_active, o.created_at,
                    a.name AS admin_name, a.admin_id,
                    c.centre_name, c.centre_code,
                    d.dairy_name, d.dairy_id
             FROM operators o
             JOIN admins a ON a.admin_id = o.admin_id
             JOIN centres c ON c.centre_id = o.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             ORDER BY d.dairy_name, c.centre_name, o.created_at DESC`
        );

        res.json(rows);
    } catch (err) {
        console.error('listAllOperators error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/operators ───────────────────────────────────────
exports.createOperator = async (req, res) => {
    try {
        const { name, email, mobile, password } = req.body;
        const adminId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Only admins can create operators
        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required.' });
        }

        // Check if email already exists as admin or operator
        const [existingAdmin] = await pool.query(
            `SELECT admin_id FROM admins WHERE email = ?`, [email]
        );
        const [existingOperator] = await pool.query(
            `SELECT operator_id FROM operators WHERE email = ?`, [email]
        );

        if (existingAdmin.length > 0 || existingOperator.length > 0) {
            return res.status(409).json({ message: 'An account with this email already exists.' });
        }

        // Verify admin exists and is active (removed centre check since admin already has centre_id from token)
        const [adminCheck] = await pool.query(
            `SELECT admin_id, centre_id FROM admins WHERE admin_id = ? AND is_active = 1`,
            [adminId]
        );

        if (!adminCheck.length) {
            return res.status(403).json({ message: 'Admin not found or inactive.' });
        }

        // Use the admin's centre_id from the token, but verify it matches the database
        if (adminCheck[0].centre_id !== centreId) {
            return res.status(403).json({
                message: 'Centre mismatch. Please refresh your session.'
            });
        }

        const hash = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO operators (admin_id, centre_id, name, email, mobile, password_hash)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [adminId, centreId, name, email, mobile || null, hash]
        );

        // Fetch the created operator with details
        const [newOperator] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.mobile, o.is_active, o.created_at,
                    a.name AS admin_name,
                    c.centre_name, c.centre_code
             FROM operators o
             JOIN admins a ON a.admin_id = o.admin_id
             JOIN centres c ON c.centre_id = o.centre_id
             WHERE o.operator_id = ?`,
            [result.insertId]
        );

        res.status(201).json(newOperator[0]);
    } catch (err) {
        console.error('createOperator error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PUT /api/operators/:id ────────────────────────────────────
exports.updateOperator = async (req, res) => {
    try {
        const { name, email, mobile, is_active, password } = req.body;
        const { id } = req.params;
        const adminId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        // Verify operator belongs to this admin and centre
        const [existing] = await pool.query(
            `SELECT operator_id FROM operators WHERE operator_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        if (!existing[0]) {
            return res.status(404).json({ message: 'Operator not found in your centre.' });
        }

        // Check email uniqueness if email is being changed
        if (email) {
            const [emailCheck] = await pool.query(
                `SELECT operator_id FROM operators WHERE email = ? AND operator_id != ?`,
                [email, id]
            );
            if (emailCheck.length > 0) {
                return res.status(409).json({ message: 'Another operator with this email already exists.' });
            }
        }

        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await pool.query(
                `UPDATE operators SET name=?, email=?, mobile=?, is_active=?, password_hash=?
                 WHERE operator_id=? AND centre_id=?`,
                [name, email, mobile || null, is_active ?? 1, hash, id, centreId]
            );
        } else {
            await pool.query(
                `UPDATE operators SET name=?, email=?, mobile=?, is_active=?
                 WHERE operator_id=? AND centre_id=?`,
                [name, email, mobile || null, is_active ?? 1, id, centreId]
            );
        }

        const [rows] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.mobile, o.is_active, o.created_at,
                    a.name AS admin_name,
                    c.centre_name, c.centre_code
             FROM operators o
             JOIN admins a ON a.admin_id = o.admin_id
             JOIN centres c ON c.centre_id = o.centre_id
             WHERE o.operator_id = ?`,
            [id]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('updateOperator error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── DELETE /api/operators/:id ─────────────────────────────────
exports.deleteOperator = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const adminId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            await conn.rollback();
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        // Verify operator belongs to this admin and centre
        const [existing] = await conn.query(
            `SELECT operator_id, name FROM operators WHERE operator_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        if (!existing[0]) {
            await conn.rollback();
            return res.status(404).json({ message: 'Operator not found in your centre.' });
        }

        // Check if operator has linked data
        const tables = [
            'milk_entries',
            'cash_advance',
            'seller_deposits',
            'product_sales',
            'product_purchases',
            'walkin_sales',
            'walkin_payments',
            'tank_dispatch',
            'owner_usage',
            'bonus_events',
            'gavali_bonus_events',
            'excel_export_config',
            'app_settings'
        ];

        let hasData = false;
        for (const table of tables) {
            const [rows] = await conn.query(
                `SELECT COUNT(*) AS count FROM ${table} WHERE operator_id = ? AND centre_id = ?`,
                [id, centreId]
            );
            if (rows[0].count > 0) {
                hasData = true;
                break;
            }
        }

        if (hasData) {
            // Soft delete instead of hard delete
            await conn.query(
                `UPDATE operators SET is_active = 0 WHERE operator_id = ? AND centre_id = ?`,
                [id, centreId]
            );
            await conn.commit();
            return res.json({
                message: 'Operator deactivated successfully (has linked data).',
                soft_delete: true
            });
        }

        // Hard delete if no data
        await conn.query(`DELETE FROM operators WHERE operator_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.commit();

        res.json({ message: 'Operator deleted successfully.' });
    } catch (err) {
        await conn.rollback();
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                message: 'Cannot delete — operator has linked records (entries, sales, etc). Deactivate instead.',
            });
        }
        console.error('deleteOperator error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/operators/:id ────────────────────────────────────
exports.getOperator = async (req, res) => {
    try {
        const { id } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const [rows] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.mobile, o.is_active, o.created_at,
                    a.name AS admin_name, a.admin_id,
                    c.centre_name, c.centre_code,
                    d.dairy_name, d.dairy_id
             FROM operators o
             JOIN admins a ON a.admin_id = o.admin_id
             JOIN centres c ON c.centre_id = o.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE o.operator_id = ? AND o.centre_id = ?`,
            [id, centreId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Operator not found in your centre.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('getOperator error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── PATCH /api/operators/:id/toggle-status ──────────────────
exports.toggleOperatorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        const [existing] = await pool.query(
            `SELECT operator_id, is_active FROM operators WHERE operator_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing[0]) {
            return res.status(404).json({ message: 'Operator not found in your centre.' });
        }

        const newStatus = existing[0].is_active === 1 ? 0 : 1;

        await pool.query(
            `UPDATE operators SET is_active = ? WHERE operator_id = ? AND centre_id = ?`,
            [newStatus, id, centreId]
        );

        res.json({
            message: `Operator ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
            is_active: newStatus
        });
    } catch (err) {
        console.error('toggleOperatorStatus error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/operators/me ─────────────────────────────────────
exports.getMyOperatorProfile = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;

        const [rows] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.mobile, o.is_active, o.created_at,
                    a.name AS admin_name, a.admin_id,
                    c.centre_name, c.centre_code,
                    d.dairy_name, d.dairy_id
             FROM operators o
             JOIN admins a ON a.admin_id = o.admin_id
             JOIN centres c ON c.centre_id = o.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE o.operator_id = ? AND o.centre_id = ?`,
            [operatorId, centreId]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Operator not found.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('getMyOperatorProfile error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};