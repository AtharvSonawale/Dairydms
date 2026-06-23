const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  PRODUCT CATALOGUE CONTROLLER
// ══════════════════════════════════════════════════════════════

// GET /api/product-catalogue - List all products
exports.getAllProducts = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM products ORDER BY product_name ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error('getAllProducts error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/product-catalogue - Create new product
exports.createProduct = async (req, res) => {
    try {
        const {
            product_name,
            unit,
            rate = 0,
            mrp_rate = 0,
            supplier_name = '',
            current_stock = 0
        } = req.body;

        // Validation
        if (!product_name || !product_name.trim()) {
            return res.status(400).json({ error: 'Product name is required.' });
        }
        if (!unit || !unit.trim()) {
            return res.status(400).json({ error: 'Unit is required.' });
        }

        const [result] = await pool.query(
            `INSERT INTO products
                (product_name, unit, current_stock, rate, mrp_rate, supplier_name)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                product_name.trim(),
                unit.trim(),
                parseFloat(current_stock) || 0,
                parseFloat(rate) || 0,
                parseFloat(mrp_rate) || 0,
                supplier_name?.trim() || ''
            ]
        );

        // Return the newly created product
        const [newRow] = await pool.query(
            `SELECT * FROM products WHERE product_id = ?`,
            [result.insertId]
        );
        res.status(201).json(newRow[0]);

    } catch (err) {
        console.error('createProduct error:', err);
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'This product already exists for that supplier.' });
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// PUT /api/product-catalogue/:id - Update product
exports.updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            product_name,
            unit,
            current_stock,
            rate,
            mrp_rate,
            supplier_name
        } = req.body;

        // Validation
        if (!product_name || !product_name.trim()) {
            return res.status(400).json({ error: 'Product name is required.' });
        }
        if (!unit || !unit.trim()) {
            return res.status(400).json({ error: 'Unit is required.' });
        }

        const [result] = await pool.query(
            `UPDATE products SET
                product_name = ?,
                unit = ?,
                current_stock = ?,
                rate = ?,
                mrp_rate = ?,
                supplier_name = ?
             WHERE product_id = ?`,
            [
                product_name.trim(),
                unit.trim(),
                parseFloat(current_stock) || 0,
                parseFloat(rate) || 0,
                parseFloat(mrp_rate) || 0,
                supplier_name?.trim() || '',
                productId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        // Return updated product
        const [updatedRow] = await pool.query(
            `SELECT * FROM products WHERE product_id = ?`,
            [productId]
        );
        res.json(updatedRow[0]);

    } catch (err) {
        console.error('updateProduct error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const productId = req.params.id;

        const [[product]] = await conn.query(
            `SELECT * FROM products WHERE product_id = ?`, [productId]
        );
        if (!product) {
            await conn.rollback();
            return res.status(404).json({ error: 'Product not found' });
        }

        // Delete in leaf-first order — add any other FK-dependent tables here
        await conn.query(`DELETE FROM product_sales WHERE product_id = ?`, [productId]);
        await conn.query(`DELETE FROM product_purchases WHERE product_id = ?`, [productId]);
        await conn.query(`DELETE FROM products WHERE product_id = ?`, [productId]);

        await conn.commit();
        res.json({ success: true, message: `"${product.product_name}" deleted successfully` });

    } catch (err) {
        await conn.rollback();
        console.error('deleteProduct error:', err);
        // Send the actual DB error so you can debug it
        res.status(500).json({ error: err.message, code: err.code });
    } finally {
        conn.release();
    }
};