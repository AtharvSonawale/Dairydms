// backend/controllers/productpurchase.controller.js

const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  PRODUCTS CATALOGUE
// ══════════════════════════════════════════════════════════════

// GET /api/products
exports.getProducts = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;

        // both admin and operator see all products
        const query = `
            SELECT p.*, 
                   COALESCE(SUM(pp.quantity), 0) AS total_purchased,
                   COALESCE(SUM(ps.quantity), 0) AS total_sold
            FROM products p
            LEFT JOIN product_purchases pp ON pp.product_id = p.product_id AND pp.centre_id = p.centre_id
            LEFT JOIN product_sales ps ON ps.product_id = p.product_id AND ps.centre_id = p.centre_id
            WHERE p.centre_id = ?
            GROUP BY p.product_id
            ORDER BY p.product_name ASC
        `;

        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('getProducts error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// GET /api/products/all (Admin only)
exports.getAllCentreProducts = async (req, res) => {
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
            `SELECT p.*, 
                    COALESCE(SUM(pp.quantity), 0) AS total_purchased,
                    COALESCE(SUM(ps.quantity), 0) AS total_sold
             FROM products p
             LEFT JOIN product_purchases pp ON pp.product_id = p.product_id AND pp.centre_id = p.centre_id
             LEFT JOIN product_sales ps ON ps.product_id = p.product_id AND ps.centre_id = p.centre_id
             WHERE p.centre_id = ?
             GROUP BY p.product_id
             ORDER BY p.product_name ASC`,
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getAllCentreProducts error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/products
exports.createProduct = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { product_name, unit, supplier_name, rate, mrp_rate } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!product_name || !product_name.trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Product name is required.' });
        }
        if (!unit || !unit.trim()) {
            await conn.rollback();
            return res.status(400).json({ error: 'Unit is required.' });
        }

        // Check for duplicate product in same centre (same name + same supplier)
        const [existing] = await conn.query(
            `SELECT product_id FROM products 
             WHERE product_name = ? AND centre_id = ?
               AND (supplier_name = ? OR (supplier_name IS NULL AND ? IS NULL) OR (supplier_name = '' AND (? IS NULL OR ? = '')))`,
            [product_name.trim(), centreId, supplier_name?.trim() || '', supplier_name?.trim() || null, supplier_name?.trim() || null, supplier_name?.trim() || '']
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({ error: 'A product with this name and supplier already exists in your centre.' });
        }

        const [result] = await conn.query(
            `INSERT INTO products
                (centre_id, product_name, unit, current_stock, supplier_name, rate, mrp_rate)
             VALUES (?, ?, ?, 0.00, ?, ?, ?)`,
            [
                centreId,
                product_name.trim(),
                unit.trim(),
                supplier_name?.trim() || '',
                parseFloat(rate) || 0.00,
                parseFloat(mrp_rate) || 0.00
            ]
        );

        await conn.commit();

        const [newRow] = await pool.query(
            `SELECT * FROM products WHERE product_id = ? AND centre_id = ?`,
            [result.insertId, centreId]
        );
        res.status(201).json(newRow[0]);

    } catch (err) {
        await conn.rollback();
        console.error('createProduct error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { id } = req.params;
        const { product_name, unit, current_stock, supplier_name, rate, mrp_rate } = req.body;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!product_name || !product_name.trim()) {
            return res.status(400).json({ error: 'Product name is required.' });
        }
        if (!unit || !unit.trim()) {
            return res.status(400).json({ error: 'Unit is required.' });
        }

        // Check product exists
        const [existing] = await pool.query(
            `SELECT product_id FROM products 
             WHERE product_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            return res.status(404).json({ error: 'Product not found in your centre.' });
        }

        const [result] = await pool.query(
            `UPDATE products
             SET product_name = ?, unit = ?, current_stock = ?,
                 supplier_name = ?, rate = ?, mrp_rate = ?
             WHERE product_id = ? AND centre_id = ?`,
            [
                product_name.trim(),
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
            return res.status(404).json({ error: 'Product not found.' });
        }

        const [updatedRows] = await pool.query(
            `SELECT * FROM products WHERE product_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        res.json(updatedRows[0]);

    } catch (err) {
        console.error('updateProduct error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
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

        // Check product exists
        const [existing] = await conn.query(
            `SELECT product_id, product_name FROM products 
             WHERE product_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Product not found in your centre.' });
        }

        // Delete related records first
        await conn.query(`DELETE FROM product_sales WHERE product_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(`DELETE FROM product_purchases WHERE product_id = ? AND centre_id = ?`, [id, centreId]);
        await conn.query(`DELETE FROM products WHERE product_id = ? AND centre_id = ?`, [id, centreId]);

        await conn.commit();
        res.json({ message: `"${existing[0].product_name}" deleted successfully.` });

    } catch (err) {
        await conn.rollback();
        console.error('deleteProduct error:', err);
        res.status(500).json({ error: err.message, code: err.code });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
//  PRODUCT PURCHASES (stock IN from supplier)
// ══════════════════════════════════════════════════════════════

// GET /api/products/purchases?date=YYYY-MM-DD
exports.getPurchases = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const centreId = req.user.centre_id;
        const { date, from, to, product_id } = req.query;

        let query = `
            SELECT
                pp.*,
                COALESCE(pp.product_name, p.product_name) AS product_name,
                p.unit,
                o.name AS operator_name
            FROM product_purchases pp
            JOIN products p ON p.product_id = pp.product_id
            JOIN operators o ON o.operator_id = pp.operator_id
            WHERE pp.centre_id = ?
        `;
        let params = [centreId];

        if (product_id) {
            query += ` AND pp.product_id = ?`;
            params.push(product_id);
        }

        if (from && to) {
            query += ` AND pp.purchase_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else if (date) {
            query += ` AND pp.purchase_date = ?`;
            params.push(date);
        } else {
            const today = new Date().toISOString().split('T')[0];
            query += ` AND pp.purchase_date = ?`;
            params.push(today);
        }

        query += ` ORDER BY pp.purchase_date ASC, pp.created_at ASC`;

        const [rows] = await pool.query(query, params);
        res.json(rows);

    } catch (err) {
        console.error('getPurchases error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// GET /api/products/purchases/suggestions?product_id=X
exports.getPurchaseSuggestions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { product_id } = req.query;
        const centreId = req.user.centre_id;

        if (!product_id) {
            return res.status(400).json({ error: 'product_id is required.' });
        }

        const [rows] = await pool.query(
            `SELECT supplier_name, rate, MAX(purchase_date) AS last_date
             FROM product_purchases
             WHERE product_id = ? AND centre_id = ?
             GROUP BY supplier_name, rate
             ORDER BY last_date DESC
             LIMIT 5`,
            [product_id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getPurchaseSuggestions error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/products/purchases
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
            product_id,
            supplier_name,
            quantity,
            rate,
            mrp_rate,
            total_amount,
            purchase_date,
        } = req.body;

        if (!product_id) {
            await conn.rollback();
            return res.status(400).json({ error: 'Product is required.' });
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

        const [[baseProduct]] = await conn.query(
            `SELECT product_id, product_name, unit, supplier_name 
             FROM products WHERE product_id = ? AND centre_id = ?`,
            [product_id, centreId]
        );
        if (!baseProduct) {
            await conn.rollback();
            return res.status(404).json({ error: 'Product not found in your centre.' });
        }

        const baseSupplier = (baseProduct.supplier_name || '').trim();
        const sameSupplier = !baseSupplier || baseSupplier.toLowerCase() === trimmedSupplier.toLowerCase();

        let targetProductId = baseProduct.product_id;

        if (!sameSupplier) {
            const [[existingVariant]] = await conn.query(
                `SELECT product_id FROM products 
                 WHERE product_name = ? AND supplier_name = ? AND centre_id = ?`,
                [baseProduct.product_name, trimmedSupplier, centreId]
            );

            if (existingVariant) {
                targetProductId = existingVariant.product_id;
            } else {
                const [createResult] = await conn.query(
                    `INSERT INTO products 
                        (centre_id, product_name, unit, current_stock, supplier_name, rate, mrp_rate)
                     VALUES (?, ?, ?, 0.00, ?, ?, ?)`,
                    [
                        centreId,
                        baseProduct.product_name,
                        baseProduct.unit,
                        trimmedSupplier,
                        parseFloat(rate),
                        parseFloat(mrp_rate || 0)
                    ]
                );
                targetProductId = createResult.insertId;
            }
        }

        const computedTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);

        const [result] = await conn.query(
            `INSERT INTO product_purchases
                (product_id, operator_id, centre_id, supplier_name, quantity, rate, mrp_rate, total_amount, purchase_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetProductId,
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

        await conn.query(
            `UPDATE products
             SET current_stock = current_stock + ?,
                 supplier_name = ?,
                 rate = ?,
                 mrp_rate = ?
             WHERE product_id = ? AND centre_id = ?`,
            [
                parseFloat(quantity),
                trimmedSupplier,
                parseFloat(rate),
                parseFloat(mrp_rate || 0.00),
                targetProductId,
                centreId
            ]
        );

        await conn.commit();

        const [newRow] = await pool.query(
            `SELECT pp.*, p.product_name, p.unit, p.supplier_name, p.rate, p.mrp_rate, o.name AS operator_name
             FROM product_purchases pp
             JOIN products p ON p.product_id = pp.product_id
             JOIN operators o ON o.operator_id = pp.operator_id
             WHERE pp.purchase_id = ? AND pp.centre_id = ?`,
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

// PUT /api/products/purchases/:id
exports.updatePurchase = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;
        const { product_id, quantity, rate, mrp_rate, supplier_name, purchase_date } = req.body;

        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

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

        const [existing] = await conn.query(
            `SELECT pp.* 
             FROM product_purchases pp
             WHERE pp.purchase_id = ? AND pp.centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Purchase not found in your centre.' });
        }

        if (!isAdmin && existing[0].operator_id !== operatorId) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. You can only update your own purchases.'
            });
        }

        const targetProductId = product_id || existing[0].product_id;
        const [product] = await conn.query(
            `SELECT product_id, product_name, current_stock 
             FROM products 
             WHERE product_id = ? AND centre_id = ?`,
            [targetProductId, centreId]
        );

        if (!product.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Product not found in your centre.' });
        }

        const qtyDiff = parseFloat(quantity) - parseFloat(existing[0].quantity);
        const newTotal = (parseFloat(quantity) * parseFloat(rate)).toFixed(2);
        const trimmedSupplier = String(supplier_name || existing[0].supplier_name).trim();

        await conn.query(
            `UPDATE product_purchases
             SET product_id = ?, quantity = ?, rate = ?, 
                 mrp_rate = ?, supplier_name = ?, total_amount = ?, purchase_date = ?
             WHERE purchase_id = ? AND centre_id = ?`,
            [
                targetProductId,
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

        await conn.query(
            `UPDATE products 
             SET current_stock = current_stock + ?,
                 rate = ?, mrp_rate = ?, supplier_name = ?
             WHERE product_id = ? AND centre_id = ?`,
            [
                qtyDiff,
                parseFloat(rate),
                parseFloat(mrp_rate || 0),
                trimmedSupplier,
                product[0].product_id,
                centreId
            ]
        );

        await conn.commit();

        const [updated] = await pool.query(
            `SELECT pp.*, p.product_name, p.unit, o.name AS operator_name
             FROM product_purchases pp
             JOIN products p ON p.product_id = pp.product_id
             JOIN operators o ON o.operator_id = pp.operator_id
             WHERE pp.purchase_id = ? AND pp.centre_id = ?`,
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

// DELETE /api/products/purchases/:id
exports.deletePurchase = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { id } = req.params;

        if (!req.user) {
            await conn.rollback();
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        const [existing] = await conn.query(
            `SELECT pp.* 
             FROM product_purchases pp
             WHERE pp.purchase_id = ? AND pp.centre_id = ?`,
            [id, centreId]
        );
        if (!existing.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Purchase not found in your centre.' });
        }

        if (!isAdmin && existing[0].operator_id !== operatorId) {
            await conn.rollback();
            return res.status(403).json({
                error: 'Access denied. You can only delete your own purchases.'
            });
        }

        const [product] = await conn.query(
            `SELECT product_id, product_name, current_stock 
             FROM products 
             WHERE product_id = ? AND centre_id = ?`,
            [existing[0].product_id, centreId]
        );

        if (!product.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Product not found.' });
        }

        await conn.query(
            `DELETE FROM product_purchases 
             WHERE purchase_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        await conn.query(
            `UPDATE products 
             SET current_stock = current_stock - ?
             WHERE product_id = ? AND centre_id = ?`,
            [parseFloat(existing[0].quantity), existing[0].product_id, centreId]
        );

        await conn.commit();
        res.json({
            message: 'Purchase deleted successfully.',
            product_name: product[0].product_name,
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