const pool = require("../config/db");

// ── GET /api/action-bar/:pageKey ──────────────────────────────
// Returns this user's saved pin/order preferences for one page's ActionBar.
// Empty array means "no customization saved yet — use page defaults".
exports.getPreferences = async (req, res) => {
    try {
        const { pageKey } = req.params;
        const centreId = req.user.centre_id;
        const userId = req.user.id;
        const userRole = req.user.role === "admin" ? "admin" : "operator";

        const [rows] = await pool.query(
            `SELECT action_key, is_pinned, sort_order
         FROM action_bar_preferences
        WHERE user_role = ? AND user_id = ? AND centre_id = ? AND page_key = ?
        ORDER BY sort_order ASC`,
            [userRole, userId, centreId, pageKey],
        );

        res.json(rows);
    } catch (err) {
        console.error("getPreferences error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ── PUT /api/action-bar/:pageKey ──────────────────────────────
// Replaces this user's preferences for one page in a single transaction.
// Body: { actions: [{ action_key, is_pinned, sort_order }, ...] }
exports.savePreferences = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { pageKey } = req.params;
        const { actions } = req.body;
        const centreId = req.user.centre_id;
        const userId = req.user.id;
        const userRole = req.user.role === "admin" ? "admin" : "operator";

        if (!Array.isArray(actions))
            return res.status(400).json({ message: "actions array is required" });

        // Basic guard so a malformed payload can't write garbage keys.
        const cleaned = actions
            .filter((a) => a && typeof a.action_key === "string" && a.action_key.length <= 50)
            .map((a, idx) => [
                userRole,
                userId,
                centreId,
                pageKey,
                a.action_key,
                a.is_pinned ? 1 : 0,
                Number.isFinite(a.sort_order) ? a.sort_order : idx,
            ]);

        await conn.beginTransaction();

        await conn.query(
            `DELETE FROM action_bar_preferences
        WHERE user_role = ? AND user_id = ? AND centre_id = ? AND page_key = ?`,
            [userRole, userId, centreId, pageKey],
        );

        if (cleaned.length > 0) {
            await conn.query(
                `INSERT INTO action_bar_preferences
           (user_role, user_id, centre_id, page_key, action_key, is_pinned, sort_order)
         VALUES ?`,
                [cleaned],
            );
        }

        await conn.commit();
        res.json({ message: "Action bar preferences saved.", count: cleaned.length });
    } catch (err) {
        await conn.rollback();
        console.error("savePreferences error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        conn.release();
    }
};

// ── DELETE /api/action-bar/:pageKey ───────────────────────────
// Resets this user's preferences for a page back to page defaults.
exports.resetPreferences = async (req, res) => {
    try {
        const { pageKey } = req.params;
        const centreId = req.user.centre_id;
        const userId = req.user.id;
        const userRole = req.user.role === "admin" ? "admin" : "operator";

        await pool.query(
            `DELETE FROM action_bar_preferences
        WHERE user_role = ? AND user_id = ? AND centre_id = ? AND page_key = ?`,
            [userRole, userId, centreId, pageKey],
        );

        res.json({ message: "Action bar reset to default." });
    } catch (err) {
        console.error("resetPreferences error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};