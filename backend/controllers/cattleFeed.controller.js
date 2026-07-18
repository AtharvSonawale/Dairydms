const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  CATTLE FEEDS – CRUD (used by the catalogue page)
// ══════════════════════════════════════════════════════════════

// GET /api/cattle-feeds - List all feeds for the centre
exports.getFeeds = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        const query = `
            SELECT f.*, 
                   COALESCE(SUM(fp.quantity), 0) AS total_purchased,
                   COALESCE(SUM(fs.quantity), 0) AS total_sold
            FROM cattle_feeds f
            LEFT JOIN cattle_feed_purchases fp ON fp.feed_id = f.feed_id AND fp.centre_id = f.centre_id
            LEFT JOIN cattle_feed_sales fs ON fs.feed_id = f.feed_id AND fs.centre_id = f.centre_id
            WHERE f.centre_id = ?
            GROUP BY f.feed_id
            ORDER BY f.feed_name ASC
        `;

        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getFeeds error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/cattle-feeds - Create a new feed
exports.createFeed = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { feed_name, unit, supplier_name, rate, mrp_rate, current_stock } = req.body;
        const centreId = req.user.centre_id;

        // Validate
        if (!feed_name || !feed_name.trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Feed name is required.' });
        }
        if (!unit || !unit.trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Unit is required.' });
        }

        // Check for duplicate (same name + same supplier)
        const trimmedName = feed_name.trim();
        const trimmedSupplier = supplier_name?.trim() || '';
        const [existing] = await conn.query(
            `SELECT feed_id FROM cattle_feeds 
             WHERE feed_name = ? AND centre_id = ? AND supplier_name = ?`,
            [trimmedName, centreId, trimmedSupplier]
        );
        if (existing.length) {
            await conn.rollback();
            return res.status(409).json({ error: 'A feed with this name and supplier already exists.' });
        }

        const [result] = await conn.query(
            `INSERT INTO cattle_feeds
                (centre_id, feed_name, unit, current_stock, supplier_name, rate, mrp_rate)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                centreId,
                trimmedName,
                unit.trim(),
                parseFloat(current_stock) || 0,
                trimmedSupplier,
                parseFloat(rate) || 0,
                parseFloat(mrp_rate) || 0
            ]
        );

        await conn.commit();

        const [newRow] = await pool.query(
            `SELECT * FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
            [result.insertId, centreId]
        );
        res.status(201).json(newRow[0]);

    } catch (err) {
        await conn.rollback();
        console.error('createFeed error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// PUT /api/cattle-feeds/:id - Update a feed
exports.updateFeed = async (req, res) => {
    try {
        const { id } = req.params;
        const { feed_name, unit, current_stock, supplier_name, rate, mrp_rate } = req.body;
        const centreId = req.user.centre_id;

        if (!feed_name || !feed_name.trim()) {
            return res.status(400).json({ error: 'Feed name is required.' });
        }
        if (!unit || !unit.trim()) {
            return res.status(400).json({ error: 'Unit is required.' });
        }

        // Check existence
        const [existing] = await pool.query(
            `SELECT feed_id FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        const trimmedName = feed_name.trim();
        const trimmedSupplier = supplier_name?.trim() || '';

        // Check duplicate (excluding itself)
        const [duplicate] = await pool.query(
            `SELECT feed_id FROM cattle_feeds 
             WHERE feed_name = ? AND centre_id = ? AND supplier_name = ? AND feed_id != ?`,
            [trimmedName, centreId, trimmedSupplier, id]
        );
        if (duplicate.length) {
            return res.status(409).json({ error: 'Another feed with this name and supplier already exists.' });
        }

        const [result] = await pool.query(
            `UPDATE cattle_feeds SET
                feed_name = ?,
                unit = ?,
                current_stock = ?,
                supplier_name = ?,
                rate = ?,
                mrp_rate = ?
             WHERE feed_id = ? AND centre_id = ?`,
            [
                trimmedName,
                unit.trim(),
                parseFloat(current_stock) || 0,
                trimmedSupplier,
                parseFloat(rate) || 0,
                parseFloat(mrp_rate) || 0,
                id,
                centreId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feed not found.' });
        }

        const [updatedRow] = await pool.query(
            `SELECT * FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        res.json(updatedRow[0]);

    } catch (err) {
        console.error('updateFeed error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// DELETE /api/cattle-feeds/:id - Delete a feed (cascades to sales/purchases)
exports.deleteFeed = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const centreId = req.user.centre_id;

        // Fetch feed details for response
        const [feed] = await conn.query(
            `SELECT feed_name FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!feed.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        // Delete dependent records (cascading is optional, we do manually for safety)
        await conn.query(`DELETE FROM cattle_feed_sales WHERE feed_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(`DELETE FROM cattle_feed_purchases WHERE feed_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(`DELETE FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`, [id, centreId]);

        await conn.commit();
        res.json({ message: `"${feed[0].feed_name}" deleted successfully.` });

    } catch (err) {
        await conn.rollback();
        console.error('deleteFeed error:', err);
        res.status(500).json({ error: err.message, code: err.code });
    } finally {
        conn.release();
    }
};

// ── (Optional) Additional endpoints for purchases / sales are in other controllers ──