const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../uploads/speed_products');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `sp_${Date.now()}${ext}`);
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

// ── helpers ───────────────────────────────────────────────────
const generateTxnId = () => {
    const now = new Date();
    const pad = (n, l = 2) => String(n).padStart(l, '0');
    return `TXN${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
};

// ══════════════════════════════════════════════════════════════
// GET /api/product-sales?date=YYYY-MM-DD  OR  ?from=...&to=...
//   Returns rows grouped into transactions
// ══════════════════════════════════════════════════════════════
exports.getSales = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND ps.sale_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            dateCondition = `AND ps.sale_date = ?`;
            dateParams = [singleDate];
        }

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT
                ps.*,
                p.product_name,
                p.unit,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                s.seller_type AS seller_type,
                o.name        AS operator_name
            FROM product_sales ps
            JOIN products p ON p.product_id = ps.product_id
            JOIN sellers  s ON s.seller_id  = ps.seller_id
            JOIN operators o ON o.operator_id = ps.operator_id
            WHERE ps.centre_id = ?
            ${dateCondition}
            ORDER BY ps.transaction_id ASC, ps.sale_id ASC
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
// GET /api/product-sales/transactions?date=...  OR  ?from=&to=
//   Returns one entry per transaction_id with nested items[]
// ══════════════════════════════════════════════════════════════
exports.getTransactions = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { date, from, to } = req.query;

        let dateCondition, dateParams;
        if (from && to) {
            dateCondition = `AND ps.sale_date BETWEEN ? AND ?`;
            dateParams = [from, to];
        } else {
            const singleDate = date || new Date().toISOString().split('T')[0];
            dateCondition = `AND ps.sale_date = ?`;
            dateParams = [singleDate];
        }

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT
                ps.*,
                p.product_name,
                p.unit,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                s.seller_type AS seller_type,
                o.name        AS operator_name
            FROM product_sales ps
            JOIN products p ON p.product_id = ps.product_id
            JOIN sellers  s ON s.seller_id  = ps.seller_id
            JOIN operators o ON o.operator_id = ps.operator_id
            WHERE ps.centre_id = ?
            ${dateCondition}
            ORDER BY ps.transaction_id ASC, ps.sale_id ASC
        `;
        const params = [centreId, ...dateParams];

        const [rows] = await pool.query(query, params);

        // Group flat rows → transactions
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
                product_id: row.product_id,
                product_name: row.product_name,
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
// POST /api/product-sales
//   Body: { seller_id, sale_date, lines: [{ product_id, quantity, rate }] }
//   Creates ONE transaction_id for all lines
// ══════════════════════════════════════════════════════════════
exports.createSale = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
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
            return res.status(400).json({ error: 'At least one product line is required.' });
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

        // REMOVED operator ownership check - any operator can use any seller

        // ── validate & stock-check every line up front ──
        for (const [i, line] of lines.entries()) {
            const { product_id, quantity, rate } = line;
            if (!product_id) {
                await conn.rollback();
                return res.status(400).json({ error: `Line ${i + 1}: product is required.` });
            }
            if (!quantity || parseFloat(quantity) <= 0) {
                await conn.rollback();
                return res.status(400).json({ error: `Line ${i + 1}: quantity must be > 0.` });
            }
            if (!rate || parseFloat(rate) <= 0) {
                await conn.rollback();
                return res.status(400).json({ error: `Line ${i + 1}: rate must be > 0.` });
            }

            const [product] = await conn.query(
                `SELECT product_id, product_name, current_stock FROM products 
                 WHERE product_id = ? AND centre_id = ?`,
                [product_id, centreId]
            );
            if (!product.length) {
                await conn.rollback();
                return res.status(404).json({ error: `Line ${i + 1}: product not found in your centre.` });
            }
            if (parseFloat(quantity) > parseFloat(product[0].current_stock)) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock for "${product[0].product_name}". Only ${parseFloat(product[0].current_stock).toFixed(2)} units available.`,
                });
            }
        }

        // ── generate one transaction ID ──
        const transaction_id = generateTxnId();

        // ── insert all lines + deduct stock ──
        const insertedIds = [];
        for (const line of lines) {
            const { product_id, quantity, rate } = line;
            const saleQty = parseFloat(quantity);
            const saleRate = parseFloat(rate);
            const saleTotal = parseFloat((saleQty * saleRate).toFixed(2));

            const [result] = await conn.query(
                `INSERT INTO product_sales
                    (transaction_id, product_id, seller_id, operator_id, centre_id, 
                     quantity, rate, total_amount, sale_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [transaction_id, Number(product_id), Number(seller_id), operatorId, centreId,
                    saleQty, saleRate, saleTotal, sale_date]
            );
            insertedIds.push(result.insertId);

            await conn.query(
                `UPDATE products SET current_stock = current_stock - ? 
                 WHERE product_id = ? AND centre_id = ?`,
                [saleQty, Number(product_id), centreId]
            );
        }

        await conn.commit();

        // ── return all inserted rows with joins ──
        const [newRows] = await pool.query(
            `SELECT
                ps.*,
                p.product_name, p.unit,
                s.name AS seller_name, s.seller_code, s.seller_type,
                o.name AS operator_name
             FROM product_sales ps
             JOIN products p ON p.product_id = ps.product_id
             JOIN sellers  s ON s.seller_id  = ps.seller_id
             JOIN operators o ON o.operator_id = ps.operator_id
             WHERE ps.sale_id IN (?) AND ps.centre_id = ?`,
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
// PUT /api/product-sales/:id   (single line edit)
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
            `SELECT * FROM product_sales WHERE sale_id = ? AND centre_id = ?`,
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
            const [product] = await conn.query(
                `SELECT current_stock FROM products WHERE product_id = ? AND centre_id = ?`,
                [existing[0].product_id, centreId]
            );
            if (qtyDiff > parseFloat(product[0].current_stock)) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock. Only ${parseFloat(product[0].current_stock).toFixed(2)} units available.`,
                });
            }
        }

        await conn.query(
            `UPDATE product_sales SET quantity = ?, rate = ?, total_amount = ?, sale_date = ?
             WHERE sale_id = ? AND centre_id = ?`,
            [parseFloat(quantity), parseFloat(rate), parseFloat(newTotal), sale_date, id, centreId]
        );
        await conn.query(
            `UPDATE products SET current_stock = current_stock - ? 
             WHERE product_id = ? AND centre_id = ?`,
            [qtyDiff, existing[0].product_id, centreId]
        );

        await conn.commit();

        const [updated] = await pool.query(
            `SELECT ps.*, p.product_name, p.unit, 
                    s.name AS seller_name, s.seller_code,
                    o.name AS operator_name
             FROM product_sales ps
             JOIN products p ON p.product_id = ps.product_id
             JOIN sellers s ON s.seller_id = ps.seller_id
             JOIN operators o ON o.operator_id = ps.operator_id
             WHERE ps.sale_id = ? AND ps.centre_id = ?`,
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
// DELETE /api/product-sales/:id   (single line delete)
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
            `SELECT * FROM product_sales WHERE sale_id = ? AND centre_id = ?`,
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

        await conn.query(`DELETE FROM product_sales WHERE sale_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(
            `UPDATE products SET current_stock = current_stock + ? 
             WHERE product_id = ? AND centre_id = ?`,
            [parseFloat(existing[0].quantity), existing[0].product_id, centreId]
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
// PUT /api/product-sales/transaction/:transaction_id
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
            `SELECT * FROM product_sales WHERE transaction_id = ? AND centre_id = ?`,
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

        // Process each item in the transaction
        for (const item of items) {
            const { sale_id, quantity, rate } = item;
            const existingSale = existingSales.find(s => s.sale_id === sale_id);
            if (!existingSale) {
                await conn.rollback();
                return res.status(404).json({ error: `Sale ${sale_id} not found in transaction.` });
            }

            const qtyDiff = parseFloat(quantity) - parseFloat(existingSale.quantity);
            const newTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);

            // Check stock if quantity is increased
            if (qtyDiff > 0) {
                const [product] = await conn.query(
                    `SELECT current_stock FROM products WHERE product_id = ? AND centre_id = ?`,
                    [existingSale.product_id, centreId]
                );
                if (qtyDiff > parseFloat(product[0].current_stock)) {
                    await conn.rollback();
                    return res.status(400).json({
                        error: `Insufficient stock for product ${existingSale.product_id}. Only ${parseFloat(product[0].current_stock).toFixed(2)} units available.`,
                    });
                }
            }

            // Update the sale
            await conn.query(
                `UPDATE product_sales SET quantity = ?, rate = ?, total_amount = ?, sale_date = ? 
                 WHERE sale_id = ? AND centre_id = ?`,
                [parseFloat(quantity), parseFloat(rate), parseFloat(newTotal), sale_date, sale_id, centreId]
            );

            // Adjust stock
            await conn.query(
                `UPDATE products SET current_stock = current_stock - ? 
                 WHERE product_id = ? AND centre_id = ?`,
                [qtyDiff, existingSale.product_id, centreId]
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

// ── GET /api/product-sales/speed-products ──────────────────
exports.getSpeedProducts = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // REMOVED operator filter - both admin and operator see all
        const query = `
            SELECT sp.id, sp.product_id, sp.display_name, sp.image_url,
                   sp.sort_order, sp.is_active,
                   p.product_name, p.current_stock, p.unit, p.mrp_rate, p.rate, p.supplier_name,
                   COALESCE(o.name, a.name) AS operator_name
            FROM speed_products sp
            JOIN products p ON p.product_id = sp.product_id
            LEFT JOIN operators o ON o.operator_id = sp.operator_id
            LEFT JOIN admins a ON a.admin_id = sp.created_by_admin_id
            WHERE sp.centre_id = ?
            ORDER BY sp.sort_order ASC, sp.id ASC
        `;

        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getSpeedProducts error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── POST /api/product-sales/speed-products ─────────────────
exports.createSpeedProduct = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = isAdmin ? null : req.user.id;
        const createdByAdminId = isAdmin ? req.user.id : null;
        const { product_id, display_name, sort_order, image_url } = req.body;

        if (!product_id) return res.status(400).json({ error: 'product_id is required.' });

        // Verify product belongs to centre
        const [productCheck] = await pool.query(
            'SELECT product_id FROM products WHERE product_id = ? AND centre_id = ?',
            [product_id, centreId]
        );
        if (!productCheck.length) {
            return res.status(404).json({ error: 'Product not found in your centre.' });
        }

        await pool.query(
            `INSERT INTO speed_products (operator_id, created_by_admin_id, centre_id, product_id, display_name, image_url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               display_name = VALUES(display_name),
               image_url    = COALESCE(VALUES(image_url), image_url),
               sort_order   = VALUES(sort_order)`,
            [operatorId, createdByAdminId, centreId, product_id, display_name || null,
                image_url || null, parseInt(sort_order) || 0]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('createSpeedProduct error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── PUT /api/product-sales/speed-products/:id ──────────────
exports.updateSpeedProduct = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;
        const { display_name, sort_order, is_active, image_url } = req.body;

        // Check if speed product exists and user has access
        let accessQuery = `SELECT id FROM speed_products WHERE id = ? AND centre_id = ?`;
        let accessParams = [id, centreId];

        if (!isAdmin) {
            accessQuery += ` AND operator_id = ?`;
            accessParams.push(operatorId);
        }

        const [existing] = await pool.query(accessQuery, accessParams);
        if (!existing.length) {
            return res.status(403).json({
                error: 'Access denied. Speed product not found or unauthorized.'
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
            `UPDATE speed_products SET ${fields.join(', ')}
             WHERE id = ? AND centre_id = ?`,
            values
        );
        res.json({ success: true });
    } catch (err) {
        console.error('updateSpeedProduct error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── DELETE /api/product-sales/speed-products/:id ───────────
exports.deleteSpeedProduct = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { id } = req.params;

        let deleteQuery = `DELETE FROM speed_products WHERE id = ? AND centre_id = ?`;
        let deleteParams = [id, centreId];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            deleteParams.push(operatorId);
        }

        const [result] = await pool.query(deleteQuery, deleteParams);

        if (result.affectedRows === 0) {
            return res.status(403).json({
                error: 'Access denied. Speed product not found or unauthorized.'
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('deleteSpeedProduct error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ── GET /api/product-sales/summary (Admin only) ────────────
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
                COUNT(DISTINCT product_id) AS unique_products
            FROM product_sales
            WHERE centre_id = ?`,
            [centreId]
        );

        res.json(summary[0]);
    } catch (err) {
        console.error('getSalesSummary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
};