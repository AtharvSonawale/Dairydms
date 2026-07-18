const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Multer config for image uploads (same as product sales) ──
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/speed_cattle_feeds');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `scf_${Date.now()}${ext}`);
    },
});
const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images allowed'));
    },
});
exports.uploadMiddleware = upload.single('image');

// ── helper: generate unique transaction ID ──────────────────
const generateTxnId = () => {
    const now = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `TXN${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
};

// ══════════════════════════════════════════════════════════════
// GET /api/cattle-feed-sales?date=YYYY-MM-DD  OR  ?from=&to=
//   Returns flat rows (one per sale line)
// ══════════════════════════════════════════════════════════════
exports.getSales = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND cfs.sale_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            dateCondition = `AND cfs.sale_date = ?`;
            dateParams = [singleDate];
        }

        const query = `
            SELECT
                cfs.*,
                cf.feed_name,
                cf.unit,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                s.seller_type AS seller_type,
                o.name        AS operator_name
            FROM cattle_feed_sales cfs
            JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
            JOIN sellers     s ON s.seller_id  = cfs.seller_id
            JOIN operators   o ON o.operator_id = cfs.operator_id
            WHERE cfs.centre_id = ?
            ${dateCondition}
            ORDER BY cfs.transaction_id ASC, cfs.sale_id ASC
        `;
        const params = [centreId, ...dateParams];
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error('getSales error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// GET /api/cattle-feed-sales/transactions?date=...  OR  ?from=&to=
//   Returns grouped by transaction_id with nested items[]
// ══════════════════════════════════════════════════════════════
exports.getTransactions = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND cfs.sale_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            dateCondition = `AND cfs.sale_date = ?`;
            dateParams = [singleDate];
        }

        const query = `
            SELECT
                cfs.*,
                cf.feed_name,
                cf.unit,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                s.seller_type AS seller_type,
                o.name        AS operator_name
            FROM cattle_feed_sales cfs
            JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
            JOIN sellers     s ON s.seller_id  = cfs.seller_id
            JOIN operators   o ON o.operator_id = cfs.operator_id
            WHERE cfs.centre_id = ?
            ${dateCondition}
            ORDER BY cfs.transaction_id ASC, cfs.sale_id ASC
        `;
        const params = [centreId, ...dateParams];
        const [rows] = await pool.query(query, params);

        // Group by transaction_id
        const txnMap = new Map();
        for (const row of rows) {
            const tid = row.transaction_id || `SOLO_${row.sale_id}`;
            if (!txnMap.has(tid)) {
                txnMap.set(tid, {
                    transaction_id: tid,
                    seller_id: row.seller_id,
                    seller_name: row.seller_name,
                    seller_code: row.seller_code,
                    seller_type: row.seller_type,
                    sale_date: row.sale_date,
                    created_at: row.created_at,
                    operator_id: row.operator_id,
                    operator_name: row.operator_name,
                    items: [],
                    total_amount: 0,
                });
            }
            const txn = txnMap.get(tid);
            txn.items.push({
                sale_id: row.sale_id,
                feed_id: row.feed_id,
                feed_name: row.feed_name,
                unit: row.unit,
                quantity: row.quantity,
                rate: row.rate,
                total_amount: row.total_amount,
            });
            txn.total_amount += parseFloat(row.total_amount || 0);
        }

        res.json([...txnMap.values()]);
    } catch (err) {
        console.error('getTransactions error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// POST /api/cattle-feed-sales
//   Body: { seller_id, sale_date, lines: [{ feed_id, quantity, rate }] }
//   Creates ONE transaction_id for all lines
// ══════════════════════════════════════════════════════════════
// ── POST /api/cattle-feed-sales ──────────────────────────────
exports.createSale = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // ── Resolve a valid operator ID ──
        let effectiveOperatorId = userId;
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
            // Verify the operator belongs to this centre
            const [opCheck] = await conn.query(
                `SELECT operator_id FROM operators WHERE operator_id = ? AND centre_id = ?`,
                [userId, centreId]
            );
            if (!opCheck.length) {
                await conn.rollback();
                return res.status(403).json({ error: 'Operator not found in your centre.' });
            }
            effectiveOperatorId = userId;
        }

        const { seller_id, sale_date, lines } = req.body;

        // ── top-level validation ──
        if (!seller_id) {
            await conn.rollback();
            return res.status(400).json({ error: 'Seller is required.' });
        }
        if (!sale_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Sale date is required.' });
        }
        if (!Array.isArray(lines) || lines.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'At least one feed line is required.' });
        }

        // ── verify seller belongs to centre ──
        const [seller] = await conn.query(
            `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!seller.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Seller not found in your centre.' });
        }

        // ── validate & stock-check every line up front ──
        for (const [i, line] of lines.entries()) {
            const { feed_id, quantity, rate } = line;
            if (!feed_id) {
                await conn.rollback();
                return res.status(400).json({ error: `Line ${i + 1}: feed is required.` });
            }
            if (!quantity || parseFloat(quantity) <= 0) {
                await conn.rollback();
                return res.status(400).json({ error: `Line ${i + 1}: quantity must be > 0.` });
            }
            if (!rate || parseFloat(rate) <= 0) {
                await conn.rollback();
                return res.status(400).json({ error: `Line ${i + 1}: rate must be > 0.` });
            }

            const [feed] = await conn.query(
                `SELECT feed_id, feed_name, current_stock FROM cattle_feeds 
                 WHERE feed_id = ? AND centre_id = ?`,
                [feed_id, centreId]
            );
            if (!feed.length) {
                await conn.rollback();
                return res.status(404).json({ error: `Line ${i + 1}: feed not found in your centre.` });
            }
            if (parseFloat(quantity) > parseFloat(feed[0].current_stock)) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock for "${feed[0].feed_name}". Only ${parseFloat(feed[0].current_stock).toFixed(2)} units available.`,
                });
            }
        }

        // ── generate one transaction ID ──
        const transaction_id = generateTxnId();

        // ── insert all lines + deduct stock ──
        const insertedIds = [];
        for (const line of lines) {
            const { feed_id, quantity, rate } = line;
            const saleQty = parseFloat(quantity);
            const saleRate = parseFloat(rate);
            const saleTotal = parseFloat((saleQty * saleRate).toFixed(2));

            const [result] = await conn.query(
                `INSERT INTO cattle_feed_sales
                    (transaction_id, feed_id, seller_id, operator_id, centre_id, 
                     quantity, rate, total_amount, sale_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [transaction_id, Number(feed_id), Number(seller_id), effectiveOperatorId, centreId,
                    saleQty, saleRate, saleTotal, sale_date]
            );
            insertedIds.push(result.insertId);

            await conn.query(
                `UPDATE cattle_feeds SET current_stock = current_stock - ? 
                 WHERE feed_id = ? AND centre_id = ?`,
                [saleQty, Number(feed_id), centreId]
            );
        }

        await conn.commit();

        // ── return all inserted rows with joins ──
        const [newRows] = await pool.query(
            `SELECT
                cfs.*,
                cf.feed_name, cf.unit,
                s.name AS seller_name, s.seller_code, s.seller_type,
                o.name AS operator_name
             FROM cattle_feed_sales cfs
             JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
             JOIN sellers     s ON s.seller_id  = cfs.seller_id
             JOIN operators   o ON o.operator_id = cfs.operator_id
             WHERE cfs.sale_id IN (?) AND cfs.centre_id = ?`,
            [insertedIds, centreId]
        );
        res.status(201).json({ transaction_id, items: newRows });

    } catch (err) {
        await conn.rollback();
        console.error('createSale error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
// PUT /api/cattle-feed-sales/:id   (single line edit)
// ══════════════════════════════════════════════════════════════
exports.updateSale = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { quantity, rate, sale_date } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!quantity || parseFloat(quantity) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Quantity must be greater than 0.' });
        }
        if (!rate || parseFloat(rate) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Rate must be greater than 0.' });
        }

        // Check sale exists and user has access
        const [existing] = await conn.query(
            `SELECT * FROM cattle_feed_sales WHERE sale_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Sale not found in your centre.' });
        }

        if (!isAdmin && existing[0].operator_id !== operatorId) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. You can only update your own sales.'
            });
        }

        const qtyDiff = parseFloat(quantity) - parseFloat(existing[0].quantity);
        const newTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);

        if (qtyDiff > 0) {
            const [feed] = await conn.query(
                `SELECT current_stock FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
                [existing[0].feed_id, centreId]
            );
            if (qtyDiff > parseFloat(feed[0].current_stock)) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock. Only ${parseFloat(feed[0].current_stock).toFixed(2)} units available.`,
                });
            }
        }

        await conn.query(
            `UPDATE cattle_feed_sales SET quantity = ?, rate = ?, total_amount = ?, sale_date = ?
             WHERE sale_id = ? AND centre_id = ?`,
            [parseFloat(quantity), parseFloat(rate), parseFloat(newTotal), sale_date, id, centreId]
        );
        await conn.query(
            `UPDATE cattle_feeds SET current_stock = current_stock - ? 
             WHERE feed_id = ? AND centre_id = ?`,
            [qtyDiff, existing[0].feed_id, centreId]
        );

        await conn.commit();

        const [updated] = await pool.query(
            `SELECT cfs.*, cf.feed_name, cf.unit, 
                    s.name AS seller_name, s.seller_code,
                    o.name AS operator_name
             FROM cattle_feed_sales cfs
             JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
             JOIN sellers s ON s.seller_id = cfs.seller_id
             JOIN operators o ON o.operator_id = cfs.operator_id
             WHERE cfs.sale_id = ? AND cfs.centre_id = ?`,
            [id, centreId]
        );
        res.json(updated[0]);
    } catch (err) {
        await conn.rollback();
        console.error('updateSale error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
// DELETE /api/cattle-feed-sales/:id   (single line delete)
// ══════════════════════════════════════════════════════════════
exports.deleteSale = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check sale exists and user has access
        const [existing] = await conn.query(
            `SELECT * FROM cattle_feed_sales WHERE sale_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Sale not found in your centre.' });
        }

        if (!isAdmin && existing[0].operator_id !== operatorId) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. You can only delete your own sales.'
            });
        }

        await conn.query(`DELETE FROM cattle_feed_sales WHERE sale_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(
            `UPDATE cattle_feeds SET current_stock = current_stock + ? 
             WHERE feed_id = ? AND centre_id = ?`,
            [parseFloat(existing[0].quantity), existing[0].feed_id, centreId]
        );

        await conn.commit();
        res.json({ message: 'Sale deleted successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('deleteSale error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
// PUT /api/cattle-feed-sales/transaction/:transaction_id
//   Updates multiple lines in one transaction
// ══════════════════════════════════════════════════════════════
exports.updateTransaction = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { transaction_id } = req.params;
        const { items, sale_date } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Fetch all existing sales in the transaction
        const [existingSales] = await conn.query(
            `SELECT * FROM cattle_feed_sales WHERE transaction_id = ? AND centre_id = ?`,
            [transaction_id, centreId]
        );
        if (!existingSales.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Transaction not found in your centre.' });
        }

        // Check ownership
        if (!isAdmin) {
            const ownedByOperator = existingSales.every(s => s.operator_id === operatorId);
            if (!ownedByOperator) {
                await conn.rollback();
                return res.status(403).json({
                    error: 'Access denied. You can only update your own transactions.'
                });
            }
        }

        // Process each item
        for (const item of items) {
            const { sale_id, quantity, rate } = item;
            const existingSale = existingSales.find(s => s.sale_id === sale_id);
            if (!existingSale) {
                await conn.rollback();
                return res.status(404).json({ error: `Sale ${sale_id} not found in transaction.` });
            }

            const qtyDiff = parseFloat(quantity) - parseFloat(existingSale.quantity);
            const newTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);

            if (qtyDiff > 0) {
                const [feed] = await conn.query(
                    `SELECT current_stock FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?`,
                    [existingSale.feed_id, centreId]
                );
                if (qtyDiff > parseFloat(feed[0].current_stock)) {
                    await conn.rollback();
                    return res.status(400).json({
                        error: `Insufficient stock for feed ${existingSale.feed_id}. Only ${parseFloat(feed[0].current_stock).toFixed(2)} units available.`,
                    });
                }
            }

            await conn.query(
                `UPDATE cattle_feed_sales SET quantity = ?, rate = ?, total_amount = ?, sale_date = ? 
                 WHERE sale_id = ? AND centre_id = ?`,
                [parseFloat(quantity), parseFloat(rate), parseFloat(newTotal), sale_date, sale_id, centreId]
            );

            await conn.query(
                `UPDATE cattle_feeds SET current_stock = current_stock - ? 
                 WHERE feed_id = ? AND centre_id = ?`,
                [qtyDiff, existingSale.feed_id, centreId]
            );
        }

        await conn.commit();
        res.json({ message: 'Transaction updated successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('updateTransaction error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/cattle-feed-sales/speed-feeds ──────────────────
exports.getSpeedFeeds = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const query = `
            SELECT scf.id, scf.feed_id, scf.display_name, scf.image_url,
                   scf.sort_order, scf.is_active,
                   cf.feed_name, cf.current_stock, cf.unit, cf.mrp_rate, cf.rate, cf.supplier_name,
                   COALESCE(o.name, a.name) AS operator_name
            FROM speed_cattle_feeds scf
            JOIN cattle_feeds cf ON cf.feed_id = scf.feed_id
            LEFT JOIN operators o ON o.operator_id = scf.operator_id
            LEFT JOIN admins a ON a.admin_id = scf.created_by_admin_id
            WHERE scf.centre_id = ?
            ORDER BY scf.sort_order ASC, scf.id ASC
        `;
        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getSpeedFeeds error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── POST /api/cattle-feed-sales/speed-feeds ─────────────────
exports.createSpeedFeed = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = isAdmin ? null : req.user.id;
        const createdByAdminId = isAdmin ? req.user.id : null;
        const { feed_id, display_name, sort_order, image_url } = req.body;

        if (!feed_id) return res.status(400).json({ error: 'feed_id is required.' });

        // Verify feed belongs to centre
        const [feedCheck] = await pool.query(
            'SELECT feed_id FROM cattle_feeds WHERE feed_id = ? AND centre_id = ?',
            [feed_id, centreId]
        );
        if (!feedCheck.length) {
            return res.status(404).json({ error: 'Feed not found in your centre.' });
        }

        await pool.query(
            `INSERT INTO speed_cattle_feeds (operator_id, created_by_admin_id, centre_id, feed_id, display_name, image_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               display_name = VALUES(display_name),
               image_url    = COALESCE(VALUES(image_url), image_url),
               sort_order   = VALUES(sort_order)`,
            [operatorId, createdByAdminId, centreId, feed_id, display_name || null,
                image_url || null, parseInt(sort_order) || 0]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('createSpeedFeed error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── PUT /api/cattle-feed-sales/speed-feeds/:id ──────────────
exports.updateSpeedFeed = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;
        const { display_name, sort_order, is_active, image_url } = req.body;

        // Check if speed feed exists and user has access
        let accessQuery = `SELECT id FROM speed_cattle_feeds WHERE id = ? AND centre_id = ?`;
        let accessParams = [id, centreId];

        if (!isAdmin) {
            accessQuery += ` AND operator_id = ?`;
            accessParams.push(operatorId);
        }

        const [existing] = await pool.query(accessQuery, accessParams);
        if (!existing.length) {
            return res.status(403).json({
                error: 'Access denied. Speed feed not found or unauthorized.'
            });
        }

        const fields = ['display_name = ?', 'sort_order = ?', 'is_active = ?'];
        const values = [
            display_name || null,
            parseInt(sort_order) || 0,
            is_active === '0' || is_active === false ? 0 : 1,
        ];

        if (image_url !== undefined) {
            fields.push('image_url = ?');
            values.push(image_url);
        }
        values.push(id, centreId);

        await pool.query(
            `UPDATE speed_cattle_feeds SET ${fields.join(', ')}
             WHERE id = ? AND centre_id = ?`,
            values
        );
        res.json({ success: true });
    } catch (err) {
        console.error('updateSpeedFeed error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── DELETE /api/cattle-feed-sales/speed-feeds/:id ───────────
exports.deleteSpeedFeed = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        let deleteQuery = `DELETE FROM speed_cattle_feeds WHERE id = ? AND centre_id = ?`;
        let deleteParams = [id, centreId];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            deleteParams.push(operatorId);
        }

        const [result] = await pool.query(deleteQuery, deleteParams);

        if (result.affectedRows === 0) {
            return res.status(403).json({
                error: 'Access denied. Speed feed not found or unauthorized.'
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('deleteSpeedFeed error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── GET /api/cattle-feed-sales/summary (Admin only) ─────────
exports.getSalesSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.'
            });
        }

        const [summary] = await pool.query(
            `SELECT
                COUNT(*) AS total_sales,
                COUNT(DISTINCT transaction_id) AS total_transactions,
                COALESCE(SUM(total_amount), 0) AS total_revenue,
                COUNT(DISTINCT seller_id) AS unique_sellers,
                COUNT(DISTINCT operator_id) AS active_operators,
                COUNT(DISTINCT feed_id) AS unique_feeds
            FROM cattle_feed_sales
            WHERE centre_id = ?`,
            [centreId]
        );

        res.json(summary[0]);
    } catch (err) {
        console.error('getSalesSummary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};