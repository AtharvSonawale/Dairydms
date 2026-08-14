// backend/controllers/cattlefeedpurchase.controller.js

const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  CATTLE FEEDS CATALOGUE
// ══════════════════════════════════════════════════════════════

// GET /api/cattle-feeds
exports.getFeeds = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;

        // both admin and operator see all feeds
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

// GET /api/cattle-feeds/all (Admin only)
exports.getAllCentreFeeds = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const [rows] = await pool.query(
            `SELECT f.*, 
                    COALESCE(SUM(fp.quantity), 0) AS total_purchased,
                    COALESCE(SUM(fs.quantity), 0) AS total_sold
             FROM cattle_feeds f
             LEFT JOIN cattle_feed_purchases fp ON fp.feed_id = f.feed_id AND fp.centre_id = f.centre_id
             LEFT JOIN cattle_feed_sales fs ON fs.feed_id = f.feed_id AND fs.centre_id = f.centre_id
             WHERE f.centre_id = ?
             GROUP BY f.feed_id
             ORDER BY f.feed_name ASC`,
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getAllCentreFeeds error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/cattle-feeds
exports.createFeed = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { feed_name, unit, supplier_name, rate, mrp_rate } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!feed_name || !feed_name.trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Feed name is required.' });
        }
        if (!unit || !unit.trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Unit is required.' });
        }

        // Check for duplicate feed in same centre (same name + same supplier)
        const [existing] = await conn.query(
            `SELECT feed_id FROM cattle_feeds 
             WHERE feed_name = ? AND centre_id = ?
               AND (supplier_name = ? OR (supplier_name IS NULL AND ? IS NULL) OR (supplier_name = '' AND (? IS NULL OR ? = '')))`,
            [feed_name.trim(), centreId, supplier_name?.trim() || '', supplier_name?.trim() || null, supplier_name?.trim() || null, supplier_name?.trim() || '']
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'A feed with this name and supplier already exists in your centre.' });
        }

        const [result] = await conn.query(
            `INSERT INTO cattle_feeds
                (centre_id, feed_name, unit, current_stock, supplier_name, rate, mrp_rate)
             VALUES (?, ?, ?, 0.00, ?, ?, ?)`,
            [
                centreId,
                feed_name.trim(),
                unit.trim(),
                supplier_name?.trim() || '',
                parseFloat(rate) || 0.00,
                parseFloat(mrp_rate) || 0.00
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

// PUT /api/cattle-feeds/:id
exports.updateFeed = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;
        const { feed_name, unit, current_stock, supplier_name, rate, mrp_rate } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!feed_name || !feed_name.trim()) {
            return res.status(400).json({ error: 'Feed name is required.' });
        }
        if (!unit || !unit.trim()) {
            return res.status(400).json({ error: 'Unit is required.' });
        }

        // Check feed exists
        const [existing] = await pool.query(
            `SELECT feed_id FROM cattle_feeds 
             WHERE feed_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        const [result] = await pool.query(
            `UPDATE cattle_feeds
             SET feed_name = ?, unit = ?, current_stock = ?,
                 supplier_name = ?, rate = ?, mrp_rate = ?
             WHERE feed_id = ? AND centre_id = ?`,
            [
                feed_name.trim(),
                unit.trim(),
                parseFloat(current_stock) || 0,
                supplier_name?.trim() || null,
                parseFloat(rate) || null,
                parseFloat(mrp_rate) || null,
                id,
                centreId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Feed not found.' });
        }

        const [updatedRows] = await pool.query(
            `SELECT * FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        res.json(updatedRows[0]);

    } catch (err) {
        console.error('updateFeed error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// DELETE /api/cattle-feeds/:id
exports.deleteFeed = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check feed exists
        const [existing] = await conn.query(
            `SELECT feed_id, feed_name FROM cattle_feeds 
             WHERE feed_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        // Delete related records first
        await conn.query(`DELETE FROM cattle_feed_sales WHERE feed_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(`DELETE FROM cattle_feed_purchases WHERE feed_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(`DELETE FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`, [id, centreId]);

        await conn.commit();
        res.json({ message: `"${existing[0].feed_name}" deleted successfully.` });

    } catch (err) {
        await conn.rollback();
        console.error('deleteFeed error:', err);
        res.status(500).json({ error: err.message, code: err.code });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
//  CATTLE FEED PURCHASES (stock IN from supplier)
// ══════════════════════════════════════════════════════════════

// GET /api/cattle-feeds/purchases?date=YYYY-MM-DD
exports.getPurchases = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;
        const { date, from, to, feed_id } = req.query;

        // both admin and operator see all purchases
        let query = `
            SELECT
                fp.*,
                COALESCE(fp.feed_name, f.feed_name) AS feed_name,
                f.unit,
                o.name AS operator_name
            FROM cattle_feed_purchases fp
            JOIN cattle_feeds f ON f.feed_id = fp.feed_id
            JOIN operators o ON o.operator_id = fp.operator_id
            WHERE fp.centre_id = ?
        `;
        let params = [centreId];

        if (feed_id) {
            query += ` AND fp.feed_id = ?`;
            params.push(feed_id);
        }

        if (from && to) {
            query += ` AND fp.purchase_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else if (date) {
            query += ` AND fp.purchase_date = ?`;
            params.push(date);
        } else {
            // Default to today if no date filter
            const today = new Date().toISOString().split('T')[0];
            query += ` AND fp.purchase_date = ?`;
            params.push(today);
        }

        query += ` ORDER BY fp.purchase_date ASC, fp.created_at ASC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);

    } catch (err) {
        console.error('getPurchases error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// GET /api/cattle-feeds/purchases/suggestions?feed_id=X
exports.getPurchaseSuggestions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { feed_id } = req.query;
        const centreId = req.user.centre_id;

        if (!feed_id) {
            return res.status(400).json({ error: 'feed_id is required.' });
        }

        const [rows] = await pool.query(
            `SELECT supplier_name, rate, MAX(purchase_date) AS last_date
             FROM cattle_feed_purchases
             WHERE feed_id = ? AND centre_id = ?
             GROUP BY supplier_name, rate
             ORDER BY last_date DESC
             LIMIT 5`,
            [feed_id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getPurchaseSuggestions error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/cattle-feeds/purchases
exports.createPurchase = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // ── If admin, get a valid operator from the same centre ──
        let effectiveOperatorId = operatorId;
        if (isAdmin) {
            const [ops] = await conn.query(
                `SELECT operator_id FROM operators WHERE centre_id = ? AND is_active = 1 LIMIT 1`,
                [centreId]
            );
            if (!ops.length) {
                await conn.rollback();
                return res.status(400).json({
                    error: 'No active operator found for this centre. Please contact admin.'
                });
            }
            effectiveOperatorId = ops[0].operator_id;
        } else {
            // Operator: verify the operator belongs to the centre
            const [opCheck] = await conn.query(
                `SELECT operator_id FROM operators WHERE operator_id = ? AND centre_id = ?`,
                [operatorId, centreId]
            );
            if (!opCheck.length) {
                await conn.rollback();
                return res.status(403).json({ error: 'Operator not found in your centre.' });
            }
            effectiveOperatorId = operatorId;
        }

        const {
            feed_id,
            supplier_name,
            quantity,
            rate,
            mrp_rate,
            total_amount,
            purchase_date,
        } = req.body;

        // ── validation ──
        if (!feed_id) {
            await conn.rollback();
            return res.status(400).json({ error: 'Feed is required.' });
        }
        if (!supplier_name || !String(supplier_name).trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Supplier name is required.' });
        }
        if (!quantity || parseFloat(quantity) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Quantity must be greater than 0.' });
        }
        if (!rate || parseFloat(rate) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Rate must be greater than 0.' });
        }
        if (!purchase_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Purchase date is required.' });
        }

        const trimmedSupplier = String(supplier_name).trim();

        // ── load the originally-selected feed ──
        const [[baseFeed]] = await conn.query(
            `SELECT feed_id, feed_name, unit, supplier_name 
             FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
            [feed_id, centreId]
        );
        if (!baseFeed) {
            await conn.rollback();
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        // ── resolve which feed row this purchase actually belongs to ──
        const baseSupplier = (baseFeed.supplier_name || '').trim();
        const sameSupplier = !baseSupplier || baseSupplier.toLowerCase() === trimmedSupplier.toLowerCase();

        let targetFeedId = baseFeed.feed_id;

        if (!sameSupplier) {
            const [[existingVariant]] = await conn.query(
                `SELECT feed_id FROM cattle_feeds 
                 WHERE feed_name = ? AND supplier_name = ? AND centre_id = ?`,
                [baseFeed.feed_name, trimmedSupplier, centreId]
            );

            if (existingVariant) {
                targetFeedId = existingVariant.feed_id;
            } else {
                const [createResult] = await conn.query(
                    `INSERT INTO cattle_feeds 
                        (centre_id, feed_name, unit, current_stock, supplier_name, rate, mrp_rate)
                     VALUES (?, ?, ?, 0.00, ?, ?, ?)`,
                    [
                        centreId,
                        baseFeed.feed_name,
                        baseFeed.unit,
                        trimmedSupplier,
                        parseFloat(rate),
                        parseFloat(mrp_rate || 0)
                    ]
                );
                targetFeedId = createResult.insertId;
            }
        }

        const computedTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);

        // ── insert purchase record using the effective operator ID ──
        const [result] = await conn.query(
            `INSERT INTO cattle_feed_purchases
                (feed_id, operator_id, centre_id, supplier_name, quantity, rate, mrp_rate, total_amount, purchase_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetFeedId,
                effectiveOperatorId,
                centreId,
                trimmedSupplier,
                parseFloat(quantity),
                parseFloat(rate),
                parseFloat(mrp_rate || 0),
                parseFloat(total_amount || computedTotal),
                purchase_date,
            ]
        );

        // ── update feed stock ──
        await conn.query(
            `UPDATE cattle_feeds
             SET current_stock = current_stock + ?,
                 supplier_name = ?,
                 rate = ?,
                 mrp_rate = ?
             WHERE feed_id = ? AND centre_id = ?`,
            [
                parseFloat(quantity),
                trimmedSupplier,
                parseFloat(rate),
                parseFloat(mrp_rate || 0.00),
                targetFeedId,
                centreId
            ]
        );

        await conn.commit();

        const [newRow] = await pool.query(
            `SELECT fp.*, f.feed_name, f.unit, f.supplier_name, f.rate, f.mrp_rate, o.name AS operator_name
             FROM cattle_feed_purchases fp
             JOIN cattle_feeds f ON f.feed_id = fp.feed_id
             JOIN operators o ON o.operator_id = fp.operator_id
             WHERE fp.purchase_id = ? AND fp.centre_id = ?`,
            [result.insertId, centreId]
        );
        res.status(201).json(newRow[0]);

    } catch (err) {
        await conn.rollback();
        console.error('createPurchase error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// PUT /api/cattle-feeds/purchases/:id
exports.updatePurchase = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { feed_id, quantity, rate, mrp_rate, supplier_name, purchase_date } = req.body;

        // ── Defensive check for req.user ──
        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // ── Validation ──
        if (!quantity || parseFloat(quantity) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Quantity must be greater than 0.' });
        }
        if (!rate || parseFloat(rate) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Rate must be greater than 0.' });
        }

        // ── Check purchase exists and user has access ──
        const [existing] = await conn.query(
            `SELECT fp.* 
             FROM cattle_feed_purchases fp
             WHERE fp.purchase_id = ? AND fp.centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Purchase not found in your centre.' });
        }

        // ── Permission check ──
        // Admin can update any purchase, operator can only update their own
        if (!isAdmin && existing[0].operator_id !== operatorId) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. You can only update your own purchases.'
            });
        }

        // ── Get feed details ──
        const targetFeedId = feed_id || existing[0].feed_id;
        const [feed] = await conn.query(
            `SELECT feed_id, feed_name, current_stock 
             FROM cattle_feeds 
             WHERE feed_id = ? AND centre_id = ?`,
            [targetFeedId, centreId]
        );

        if (!feed.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        // ── Calculate quantity difference and new total ──
        const qtyDiff = parseFloat(quantity) - parseFloat(existing[0].quantity);
        const newTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);
        const trimmedSupplier = String(supplier_name || existing[0].supplier_name).trim();

        // ── Update the purchase ──
        await conn.query(
            `UPDATE cattle_feed_purchases
             SET feed_id = ?, quantity = ?, rate = ?, 
                 mrp_rate = ?, supplier_name = ?, total_amount = ?, purchase_date = ?
             WHERE purchase_id = ? AND centre_id = ?`,
            [
                targetFeedId,
                parseFloat(quantity),
                parseFloat(rate),
                parseFloat(mrp_rate || 0),
                trimmedSupplier,
                parseFloat(newTotal),
                purchase_date || existing[0].purchase_date,
                id,
                centreId
            ]
        );

        // ── Update feed stock ──
        await conn.query(
            `UPDATE cattle_feeds 
             SET current_stock = current_stock + ?,
                 rate = ?, mrp_rate = ?, supplier_name = ?
             WHERE feed_id = ? AND centre_id = ?`,
            [
                qtyDiff,
                parseFloat(rate),
                parseFloat(mrp_rate || 0),
                trimmedSupplier,
                feed[0].feed_id,
                centreId
            ]
        );

        await conn.commit();

        // ── Fetch updated purchase with details ──
        const [updated] = await pool.query(
            `SELECT fp.*, f.feed_name, f.unit, o.name AS operator_name
             FROM cattle_feed_purchases fp
             JOIN cattle_feeds f ON f.feed_id = fp.feed_id
             JOIN operators o ON o.operator_id = fp.operator_id
             WHERE fp.purchase_id = ? AND fp.centre_id = ?`,
            [id, centreId]
        );
        res.json(updated[0]);

    } catch (err) {
        await conn.rollback();
        console.error('updatePurchase error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// DELETE /api/cattle-feeds/purchases/:id
exports.deletePurchase = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;

        // ── Defensive check for req.user ──
        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // ── Check purchase exists and user has access ──
        const [existing] = await conn.query(
            `SELECT fp.* 
             FROM cattle_feed_purchases fp
             WHERE fp.purchase_id = ? AND fp.centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Purchase not found in your centre.' });
        }

        // ── Permission check ──
        // Admin can delete any purchase, operator can only delete their own
        if (!isAdmin && existing[0].operator_id !== operatorId) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. You can only delete your own purchases.'
            });
        }

        // ── Get feed details before deletion ──
        const [feed] = await conn.query(
            `SELECT feed_id, feed_name, current_stock 
             FROM cattle_feeds 
             WHERE feed_id = ? AND centre_id = ?`,
            [existing[0].feed_id, centreId]
        );

        if (!feed.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Feed not found.' });
        }

        // ── Delete the purchase ──
        await conn.query(
            `DELETE FROM cattle_feed_purchases 
             WHERE purchase_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        // ── Update feed stock (reverse the quantity) ──
        await conn.query(
            `UPDATE cattle_feeds 
             SET current_stock = current_stock - ?
             WHERE feed_id = ? AND centre_id = ?`,
            [parseFloat(existing[0].quantity), existing[0].feed_id, centreId]
        );

        await conn.commit();
        res.json({
            message: 'Purchase deleted successfully.',
            feed_name: feed[0].feed_name,
            quantity: existing[0].quantity
        });

    } catch (err) {
        await conn.rollback();
        console.error('deletePurchase error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── Additional helper function for getting purchase by ID ──
// GET /api/cattle-feeds/purchases/:id
exports.getPurchaseById = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;
        const centreId = req.user.centre_id;

        const [rows] = await pool.query(
            `SELECT fp.*, f.feed_name, f.unit, o.name AS operator_name
             FROM cattle_feed_purchases fp
             JOIN cattle_feeds f ON f.feed_id = fp.feed_id
             JOIN operators o ON o.operator_id = fp.operator_id
             WHERE fp.purchase_id = ? AND fp.centre_id = ?`,
            [id, centreId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Purchase not found in your centre.' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('getPurchaseById error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── Get purchases by date range ──
// GET /api/cattle-feeds/purchases/range?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getPurchasesByDateRange = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: 'Both from and to dates are required.' });
        }

        const [rows] = await pool.query(
            `SELECT fp.*, f.feed_name, f.unit, o.name AS operator_name
             FROM cattle_feed_purchases fp
             JOIN cattle_feeds f ON f.feed_id = fp.feed_id
             JOIN operators o ON o.operator_id = fp.operator_id
             WHERE fp.centre_id = ? 
               AND fp.purchase_date BETWEEN ? AND ?
             ORDER BY fp.purchase_date ASC, fp.created_at ASC`,
            [centreId, from, to]
        );

        res.json(rows);
    } catch (err) {
        console.error('getPurchasesByDateRange error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── Get purchase statistics ──
// GET /api/cattle-feeds/purchases/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.getPurchaseStats = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        let query = `
            SELECT 
                COUNT(*) AS total_purchases,
                SUM(quantity) AS total_quantity,
                SUM(total_amount) AS total_amount,
                AVG(rate) AS avg_rate,
                COUNT(DISTINCT supplier_name) AS total_suppliers
            FROM cattle_feed_purchases
            WHERE centre_id = ?
        `;
        let params = [centreId];

        if (from && to) {
            query += ` AND purchase_date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows[0] || {
            total_purchases: 0,
            total_quantity: 0,
            total_amount: 0,
            avg_rate: 0,
            total_suppliers: 0
        });
    } catch (err) {
        console.error('getPurchaseStats error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};