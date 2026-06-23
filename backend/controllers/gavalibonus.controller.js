const pool = require("../config/db");

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/events
// Returns all Gavali bonus events for the current operator/centre
// ═══════════════════════════════════════════════════════════════
exports.getGavaliEvents = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        let query = `
            SELECT
                event_id,
                event_name,
                occasion,
                from_date,
                to_date,
                cow_bonus,
                buffalo_bonus,
                is_active,
                created_at
            FROM gavali_bonus_events
            WHERE centre_id = ?
        `;
        let params = [centreId];

        if (!isAdmin) {
            query += ` AND created_by = ?`;
            params.push(operatorId);
        }

        query += ` ORDER BY created_at DESC`;

        const [events] = await pool.query(query, params);
        res.json(events);
    } catch (err) {
        console.error("getGavaliEvents error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/gavali-bonus/events
// Creates a new Gavali bonus event
// Body: { event_name, occasion, from_date, to_date, cow_bonus, buffalo_bonus }
// ═══════════════════════════════════════════════════════════════
exports.createGavaliEvent = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const { event_name, occasion, from_date, to_date } = req.body;

        if (!event_name || !from_date || !to_date) {
            return res.status(400).json({
                message: "event_name, from_date, and to_date are required.",
            });
        }

        const [result] = await pool.query(
            `INSERT INTO gavali_bonus_events
             (event_name, occasion, from_date, to_date, cow_bonus, buffalo_bonus, created_by, centre_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [event_name, occasion, from_date, to_date, cow_bonus, buffalo_bonus, operatorId, centreId]
        );

        res.status(201).json({
            message: "Gavali bonus event created successfully.",
            event_id: result.insertId,
        });
    } catch (err) {
        console.error("createGavaliEvent error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// PUT /api/gavali-bonus/events/:eventId
// Updates a Gavali bonus event
// Body: { event_name, occasion, from_date, to_date, cow_bonus, buffalo_bonus }
// ═══════════════════════════════════════════════════════════════
exports.updateGavaliEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { event_name, occasion, from_date, to_date } = req.body;

        if (!event_name || !from_date || !to_date) {
            return res.status(400).json({
                message: "event_name, from_date, and to_date are required.",
            });
        }

        // Fetch existing event first so we can fall back to existing bonus values
        let eventQuery = `SELECT * FROM gavali_bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];

        if (!isAdmin) {
            eventQuery += ` AND created_by = ?`;
            eventParams.push(operatorId);
        }

        const [[event]] = await pool.query(eventQuery, eventParams);
        if (!event) {
            return res.status(404).json({ message: "Gavali bonus event not found or unauthorized." });
        }

        // Fall back to existing values if not provided
        const cow_bonus = req.body.cow_bonus ?? event.cow_bonus;
        const buffalo_bonus = req.body.buffalo_bonus ?? event.buffalo_bonus;

        await pool.query(
            `UPDATE gavali_bonus_events
             SET event_name = ?, occasion = ?, from_date = ?, to_date = ?,
                 cow_bonus = ?, buffalo_bonus = ?
             WHERE event_id = ? AND centre_id = ?`,
            [event_name, occasion, from_date, to_date, cow_bonus, buffalo_bonus, eventId, centreId]
        );

        res.json({ message: "Gavali bonus event updated successfully." });
    } catch (err) {
        console.error("updateGavaliEvent error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// DELETE /api/gavali-bonus/events/:eventId
// Deletes a Gavali bonus event
// ═══════════════════════════════════════════════════════════════
exports.deleteGavaliEvent = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { eventId } = req.params;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Verify the event belongs to the centre
        let eventQuery = `SELECT event_id FROM gavali_bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];

        if (!isAdmin) {
            eventQuery += ` AND created_by = ?`;
            eventParams.push(operatorId);
        }

        const [[event]] = await conn.query(eventQuery, eventParams);
        if (!event) {
            await conn.rollback();
            return res.status(404).json({ message: "Event not found or unauthorized." });
        }

        await conn.query(
            `DELETE FROM gavali_bonus_payments WHERE event_id = ? AND centre_id = ?`,
            [eventId, centreId]
        );
        await conn.query(
            `DELETE FROM gavali_bonus_events WHERE event_id = ? AND centre_id = ?`,
            [eventId, centreId]
        );

        await conn.commit();
        res.json({ message: "Gavali bonus event deleted successfully." });
    } catch (err) {
        await conn.rollback();
        console.error("deleteGavaliEvent error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        conn.release();
    }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/gavali-bonus/events/:eventId/mark-paid
// Marks a Gavali seller's bonus as paid for the event
// Body: { seller_id }
// ═══════════════════════════════════════════════════════════════
exports.markGavaliBonusPaid = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { eventId } = req.params;
        const { seller_id } = req.body;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!seller_id) {
            await conn.rollback();
            return res.status(400).json({ message: "seller_id is required." });
        }

        // Verify the event exists and belongs to the centre
        let eventQuery = `
            SELECT
                event_id,
                from_date,
                to_date,
                cow_bonus,
                buffalo_bonus
            FROM gavali_bonus_events
            WHERE event_id = ? AND centre_id = ?
        `;
        let eventParams = [eventId, centreId];

        if (!isAdmin) {
            eventQuery += ` AND created_by = ?`;
            eventParams.push(operatorId);
        }

        const [[event]] = await conn.query(eventQuery, eventParams);
        if (!event) {
            await conn.rollback();
            return res.status(404).json({ message: "Gavali bonus event not found or unauthorized." });
        }

        // Verify seller belongs to centre and is Gavali type
        const [sellerCheck] = await conn.query(
            `SELECT seller_id FROM sellers 
             WHERE seller_id = ? AND centre_id = ? AND seller_type = 'Gavali'`,
            [seller_id, centreId]
        );
        if (!sellerCheck.length) {
            await conn.rollback();
            return res.status(404).json({ message: "Gavali seller not found in your centre." });
        }

        // Recompute cow and buffalo quantities for the seller
        let entriesQuery = `
            SELECT milk_type, quantity
            FROM milk_entries
            WHERE seller_id = ? AND centre_id = ? AND entry_date BETWEEN ? AND ?
        `;
        let entriesParams = [seller_id, centreId, event.from_date, event.to_date];

        if (!isAdmin) {
            entriesQuery += ` AND operator_id = ?`;
            entriesParams.push(operatorId);
        }

        const [entries] = await conn.query(entriesQuery, entriesParams);

        let cowQty = 0;
        let buffaloQty = 0;
        let totalBonus = 0;

        for (const e of entries) {
            const qty = parseFloat(e.quantity);
            if (e.milk_type === "cow") {
                cowQty = parseFloat((cowQty + qty).toFixed(2));
                totalBonus = parseFloat((totalBonus + qty * event.cow_bonus).toFixed(2));
            } else if (e.milk_type === "buffalo") {
                buffaloQty = parseFloat((buffaloQty + qty).toFixed(2));
                totalBonus = parseFloat((totalBonus + qty * event.buffalo_bonus).toFixed(2));
            }
        }

        const totalQty = cowQty + buffaloQty;

        // Insert or update payment in gavali_bonus_payments
        await conn.query(
            `INSERT INTO gavali_bonus_payments
                (event_id, seller_id, centre_id, cow_qty, buffalo_qty, total_qty, total_bonus, is_paid, paid_at, paid_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)
             ON DUPLICATE KEY UPDATE
                cow_qty = VALUES(cow_qty),
                buffalo_qty = VALUES(buffalo_qty),
                total_qty = VALUES(total_qty),
                total_bonus = VALUES(total_bonus),
                is_paid = 1,
                paid_at = NOW(),
                paid_by = VALUES(paid_by)`,
            [eventId, seller_id, centreId, cowQty, buffaloQty, totalQty, totalBonus, operatorId]
        );

        await conn.commit();

        res.json({
            message: "Gavali bonus payment marked as paid successfully.",
            total_qty: totalQty,
            total_bonus: totalBonus,
        });
    } catch (err) {
        await conn.rollback();
        console.error("markGavaliBonusPaid error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        conn.release();
    }
};

// ═══════════════════════════════════════════════════════════════
// POST /api/gavali-bonus/events/:eventId/undo-paid
// Undoes a Gavali seller's bonus payment for the event
// Body: { seller_id }
// ═══════════════════════════════════════════════════════════════
exports.undoGavaliBonusPaid = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { eventId } = req.params;
        const { seller_id } = req.body;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!seller_id) {
            await conn.rollback();
            return res.status(400).json({ message: "seller_id is required." });
        }

        // Verify the event exists and belongs to the centre
        let eventQuery = `SELECT event_id FROM gavali_bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];

        if (!isAdmin) {
            eventQuery += ` AND created_by = ?`;
            eventParams.push(operatorId);
        }

        const [[event]] = await conn.query(eventQuery, eventParams);
        if (!event) {
            await conn.rollback();
            return res.status(404).json({ message: "Gavali bonus event not found or unauthorized." });
        }

        // Undo the payment by setting is_paid to 0 and clearing paid_at
        await conn.query(
            `UPDATE gavali_bonus_payments
             SET is_paid = 0, paid_at = NULL, paid_by = NULL
             WHERE event_id = ? AND seller_id = ? AND centre_id = ?`,
            [eventId, seller_id, centreId]
        );

        await conn.commit();
        res.json({ message: "Gavali bonus payment marked as unpaid successfully." });
    } catch (err) {
        await conn.rollback();
        console.error("undoGavaliBonusPaid error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        conn.release();
    }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/no-event-register?from=&to=
// ═══════════════════════════════════════════════════════════════
exports.getGavaliNoEventRegister = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: "from and to dates are required." });
        }

        let query = `
            SELECT
                s.seller_id,
                s.seller_code,
                s.name,
                s.milk_type,
                COALESCE(SUM(CASE WHEN me.milk_type = 'cow'     THEN me.quantity ELSE 0 END), 0) AS cow_qty,
                COALESCE(SUM(CASE WHEN me.milk_type = 'buffalo' THEN me.quantity ELSE 0 END), 0) AS buffalo_qty,
                COALESCE(SUM(me.quantity), 0) AS total_qty
            FROM sellers s
            LEFT JOIN milk_entries me
                ON me.seller_id = s.seller_id
               AND me.centre_id = s.centre_id
               AND me.entry_date BETWEEN ? AND ?
            WHERE s.centre_id = ?
              AND s.seller_type = 'Gavali'
              AND s.is_active = 1
        `;
        let params = [from, to, centreId];

        if (!isAdmin) {
            query += ` AND s.operator_id = ?`;
            params.push(operatorId);
        }

        query += ` GROUP BY s.seller_id, s.seller_code, s.name, s.milk_type
            HAVING total_qty > 0`;

        const [sellers] = await pool.query(query, params);

        res.json({ sellers });
    } catch (err) {
        console.error("getGavaliNoEventRegister error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/events/:eventId/register
// ═══════════════════════════════════════════════════════════════
exports.getGavaliRegister = async (req, res) => {
    try {
        const { eventId } = req.params;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Verify event belongs to centre
        let eventQuery = `
            SELECT event_id, event_name, occasion, from_date, to_date,
                   cow_bonus, buffalo_bonus, is_active
            FROM gavali_bonus_events
            WHERE event_id = ? AND centre_id = ?
        `;
        let eventParams = [eventId, centreId];

        if (!isAdmin) {
            eventQuery += ` AND created_by = ?`;
            eventParams.push(operatorId);
        }

        const [[event]] = await pool.query(eventQuery, eventParams);
        if (!event) {
            return res.status(404).json({ message: "Gavali bonus event not found or unauthorized." });
        }

        const effectiveFrom = event.from_date;
        const effectiveTo = event.to_date;

        let query = `
            SELECT
                s.seller_id,
                s.seller_code,
                s.name,
                s.milk_type,
                COALESCE(SUM(CASE WHEN me.milk_type = 'cow'     THEN me.quantity ELSE 0 END), 0) AS cow_qty,
                COALESCE(SUM(CASE WHEN me.milk_type = 'buffalo' THEN me.quantity ELSE 0 END), 0) AS buffalo_qty,
                COALESCE(
                    (SUM(CASE WHEN me.milk_type = 'cow'     THEN me.quantity ELSE 0 END) * ?) +
                    (SUM(CASE WHEN me.milk_type = 'buffalo' THEN me.quantity ELSE 0 END) * ?), 0
                ) AS total_bonus
            FROM sellers s
            LEFT JOIN milk_entries me
                ON me.seller_id = s.seller_id
               AND me.centre_id = s.centre_id
               AND me.entry_date BETWEEN ? AND ?
            WHERE s.centre_id = ?
              AND s.seller_type = 'Gavali'
              AND s.is_active = 1
        `;
        let params = [event.cow_bonus, event.buffalo_bonus, effectiveFrom, effectiveTo, centreId];

        if (!isAdmin) {
            query += ` AND s.operator_id = ? AND (me.operator_id = ? OR me.operator_id IS NULL)`;
            params.push(operatorId, operatorId);
        }

        query += ` GROUP BY s.seller_id, s.seller_code, s.name, s.milk_type`;

        const [sellers] = await pool.query(query, params);

        // Payment status
        const [paidRows] = await pool.query(
            `SELECT seller_id, is_paid, paid_at
             FROM gavali_bonus_payments WHERE event_id = ? AND centre_id = ?`,
            [eventId, centreId]
        );
        const paidMap = Object.fromEntries(paidRows.map(p => [p.seller_id, p]));

        const result = sellers.map(seller => {
            const currentTotalQty = parseFloat(seller.cow_qty) + parseFloat(seller.buffalo_qty);
            return {
                ...seller,
                total_qty: currentTotalQty,
                is_paid: !!(paidMap[seller.seller_id]?.is_paid),
                paid_at: paidMap[seller.seller_id]?.paid_at || null,
            };
        }).filter(s => s.total_qty > 0);  // only sellers with actual milk in this period

        res.json({ event, sellers: result });
    } catch (err) {
        console.error("getGavaliRegister error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/monthly-breakdown?from=&to=
// Returns per-seller per-month cow/buffalo qty for the date range
// Uses sellers table with seller_type = 'Gavali' and operator_id
// ═══════════════════════════════════════════════════════════════
exports.getGavaliMonthlyBreakdown = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: "from and to dates are required." });
        }

        let query = `
            SELECT
                me.seller_id,
                DATE_FORMAT(me.entry_date, '%Y-%m') AS month_key,
                COALESCE(SUM(CASE WHEN me.milk_type = 'cow'     THEN me.quantity ELSE 0 END), 0) AS cow_qty,
                COALESCE(SUM(CASE WHEN me.milk_type = 'buffalo' THEN me.quantity ELSE 0 END), 0) AS buffalo_qty
            FROM milk_entries me
            INNER JOIN sellers s
                ON s.seller_id = me.seller_id
               AND s.centre_id = ?
               AND s.seller_type = 'Gavali'
            WHERE me.centre_id = ?
              AND me.entry_date BETWEEN ? AND ?
        `;
        let params = [centreId, centreId, from, to];

        if (!isAdmin) {
            query += ` AND s.operator_id = ? AND me.operator_id = ?`;
            params.push(operatorId, operatorId);
        }

        query += ` GROUP BY me.seller_id, month_key
            ORDER BY me.seller_id, month_key`;

        const [rows] = await pool.query(query, params);

        // Shape: { "seller_id_string": { "YYYY-MM": { cow_qty, buffalo_qty } } }
        const breakdown = {};
        for (const row of rows) {
            const sid = String(row.seller_id);
            if (!breakdown[sid]) breakdown[sid] = {};
            breakdown[sid][row.month_key] = {
                cow_qty: parseFloat(row.cow_qty),
                buffalo_qty: parseFloat(row.buffalo_qty),
            };
        }

        res.json({ breakdown });
    } catch (err) {
        console.error("getGavaliMonthlyBreakdown error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/events/:eventId/paid-status
// Returns paid status for all sellers in a Gavali event
// ═══════════════════════════════════════════════════════════════
exports.getGavaliPaidStatus = async (req, res) => {
    try {
        const { eventId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;

        let query = `
            SELECT seller_id, is_paid, paid_at, paid_by
            FROM gavali_bonus_payments
            WHERE event_id = ? AND centre_id = ?
        `;
        let params = [eventId, centreId];

        if (!isAdmin) {
            query += ` AND paid_by = ?`;
            params.push(operatorId);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("getGavaliPaidStatus error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/sellers
// Returns all Gavali sellers in the centre
// ═══════════════════════════════════════════════════════════════
exports.getGavaliSellers = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        let query = `
            SELECT
                seller_id,
                seller_code,
                name,
                mobile,
                milk_type,
                is_active,
                created_at
            FROM sellers
            WHERE centre_id = ?
              AND seller_type = 'Gavali'
              AND is_active = 1
        `;
        let params = [centreId];

        if (!isAdmin) {
            query += ` AND operator_id = ?`;
            params.push(operatorId);
        }

        query += ` ORDER BY name ASC`;

        const [sellers] = await pool.query(query, params);
        res.json(sellers);
    } catch (err) {
        console.error("getGavaliSellers error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ═══════════════════════════════════════════════════════════════
// GET /api/gavali-bonus/events/:eventId/summary
// Returns summary statistics for a Gavali event
// ═══════════════════════════════════════════════════════════════
exports.getGavaliEventSummary = async (req, res) => {
    try {
        const { eventId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;

        // Verify event belongs to centre
        let eventQuery = `SELECT * FROM gavali_bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];

        if (!isAdmin) {
            eventQuery += ` AND created_by = ?`;
            eventParams.push(operatorId);
        }

        const [[event]] = await pool.query(eventQuery, eventParams);
        if (!event) {
            return res.status(404).json({ message: "Gavali bonus event not found or unauthorized." });
        }

        // Get summary statistics
        let statsQuery = `
            SELECT
                COUNT(DISTINCT me.seller_id) AS total_sellers,
                COALESCE(SUM(CASE WHEN me.milk_type = 'cow' THEN me.quantity ELSE 0 END), 0) AS total_cow_qty,
                COALESCE(SUM(CASE WHEN me.milk_type = 'buffalo' THEN me.quantity ELSE 0 END), 0) AS total_buffalo_qty,
                COALESCE(SUM(me.quantity), 0) AS total_qty,
                COALESCE(
                    SUM(CASE WHEN me.milk_type = 'cow' THEN me.quantity ELSE 0 END) * ? +
                    SUM(CASE WHEN me.milk_type = 'buffalo' THEN me.quantity ELSE 0 END) * ?, 0
                ) AS total_bonus
            FROM milk_entries me
            INNER JOIN sellers s ON s.seller_id = me.seller_id
            WHERE s.centre_id = ?
              AND s.seller_type = 'Gavali'
              AND me.entry_date BETWEEN ? AND ?
        `;
        let statsParams = [event.cow_bonus, event.buffalo_bonus, centreId, event.from_date, event.to_date];

        if (!isAdmin) {
            statsQuery += ` AND s.operator_id = ? AND me.operator_id = ?`;
            statsParams.push(operatorId, operatorId);
        }

        const [stats] = await pool.query(statsQuery, statsParams);

        // Get paid statistics
        const [paidStats] = await pool.query(
            `SELECT
                COUNT(*) AS paid_sellers,
                COALESCE(SUM(total_bonus), 0) AS paid_amount
            FROM gavali_bonus_payments
            WHERE event_id = ? AND centre_id = ? AND is_paid = 1`,
            [eventId, centreId]
        );

        res.json({
            event,
            statistics: {
                total_sellers: parseInt(stats[0]?.total_sellers || 0),
                total_cow_qty: parseFloat(stats[0]?.total_cow_qty || 0),
                total_buffalo_qty: parseFloat(stats[0]?.total_buffalo_qty || 0),
                total_qty: parseFloat(stats[0]?.total_qty || 0),
                total_bonus: parseFloat(stats[0]?.total_bonus || 0),
                paid_sellers: parseInt(paidStats[0]?.paid_sellers || 0),
                paid_amount: parseFloat(paidStats[0]?.paid_amount || 0),
                pending_sellers: parseInt(stats[0]?.total_sellers || 0) - parseInt(paidStats[0]?.paid_sellers || 0),
                pending_amount: parseFloat(stats[0]?.total_bonus || 0) - parseFloat(paidStats[0]?.paid_amount || 0),
            }
        });
    } catch (err) {
        console.error("getGavaliEventSummary error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};