const pool = require('../config/db');

exports.markTourSeen = async (req, res) => {
    try {
        const adminId = req.user.id;
        await pool.query(
            `UPDATE admins SET has_seen_tour = 1 WHERE admin_id = ?`,
            [adminId]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};