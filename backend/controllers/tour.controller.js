const pool = require('../config/db');

// PUT /api/admin/mark-tour-seen
// Flips has_seen_tour to 1 for the currently authenticated admin so the
// app tour doesn't run again on subsequent logins.
exports.markTourSeen = async (req, res) => {
    try {
        const adminId = req.user.id;

        await pool.query(
            'UPDATE admins SET has_seen_tour = 1 WHERE admin_id = ?',
            [adminId]
        );

        res.json({ message: 'Tour marked as seen', has_seen_tour: 1 });
    } catch (err) {
        console.error('markTourSeen error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};