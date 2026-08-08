// controllers/favourites.controller.js
const pool = require('../config/db'); // ⚠ adjust to whatever seller.controller.js imports for its db pool

// Resolves { role, id, centre_id } from the authenticated user.
// `protect` middleware attaches req.user — adjust these field names if
// your JWT payload uses different keys (check seller.controller.js for
// how it reads req.user.seller_id / req.user.operator_id, etc.)
function getIdentity(req) {
    const role = req.user.role; // 'admin' | 'operator' | 'seller'
    const id = req.user.id; // generic id field used for all roles
    return { role, id, centre_id: req.user.centre_id };
}

exports.listFavourites = async (req, res) => {
    try {
        const { role, id } = getIdentity(req);
        const [rows] = await pool.query(
            `SELECT id, nav_path, nav_label, sort_order
             FROM user_favourites
             WHERE user_role = ? AND user_id = ?
             ORDER BY sort_order ASC, id ASC`,
            [role, id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Could not load favourites', error: err.message });
    }
};

exports.addFavourite = async (req, res) => {
    try {
        const { role, id, centre_id } = getIdentity(req);
        const { nav_path, nav_label } = req.body;
        if (!nav_path || !nav_label) {
            return res.status(400).json({ message: 'nav_path and nav_label are required' });
        }
        await pool.query(
            `INSERT INTO user_favourites (user_role, user_id, centre_id, nav_path, nav_label)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nav_label = VALUES(nav_label)`,
            [role, id, centre_id, nav_path, nav_label]
        );
        const [rows] = await pool.query(
            `SELECT id, nav_path, nav_label, sort_order
             FROM user_favourites WHERE user_role = ? AND user_id = ? AND nav_path = ?`,
            [role, id, nav_path]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ message: 'Could not add favourite', error: err.message });
    }
};

exports.removeFavourite = async (req, res) => {
    try {
        const { role, id } = getIdentity(req);
        await pool.query(
            `DELETE FROM user_favourites WHERE id = ? AND user_role = ? AND user_id = ?`,
            [req.params.id, role, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Could not remove favourite', error: err.message });
    }
};