const pool = require('../config/db');

// ── GET /api/walkin-sales?date=YYYY-MM-DD
//        OR ?from=YYYY-MM-DD&to=YYYY-MM-DD ──────────────────────
exports.getSales = async (req, res) => {
    try {
        const { date, from, to, buyer_id, seller_id } = req.query;
        const centre_id = req.user.centre_id;
        const fromDate = from || date || new Date().toISOString().split('T')[0];
        const toDate = to || date || fromDate;

        let whereClause = `WHERE ws.centre_id = ? AND ws.sale_date BETWEEN ? AND ?`;
        const params = [centre_id, fromDate, toDate];

        // REMOVED operator filter - both admin and operator see all

        if (buyer_id) {
            whereClause += ` AND ws.buyer_id = ?`;
            params.push(buyer_id);
        }

        if (seller_id) {
            whereClause += ` AND ws.seller_id = ? AND ws.buyer_id IS NULL`;
            params.push(seller_id);
        }

        const [rows] = await pool.query(
            `SELECT
                ws.sale_id, ws.buyer_name, ws.buyer_id, ws.seller_id,
                ws.product_type_id, ws.product_type, ws.amount_paid,
                ws.previous_balance,
                wpt.name AS product_type_name,
                wnb.name AS registered_buyer_name,
                sel.seller_code, sel.name AS seller_name,
                ws.milk_type, ws.quantity, ws.mrp, ws.total_amount,
                ws.payment_mode, ws.shift, ws.sale_date, ws.created_at,
                o.name AS operator_name
             FROM walkin_sales ws
             LEFT JOIN operators o ON o.operator_id = ws.operator_id
             LEFT JOIN sellers sel ON sel.seller_id = ws.seller_id
             LEFT JOIN walkin_product_types wpt ON wpt.product_type_id = ws.product_type_id
             LEFT JOIN walkin_named_buyers wnb ON wnb.buyer_id = ws.buyer_id
             ${whereClause}
             ORDER BY ws.sale_date ASC, ws.created_at DESC`,
            params
        );

        return res.json(rows.map(r => ({
            ...r,
            sale_date: r.sale_date instanceof Date
                ? `${r.sale_date.getFullYear()}-${String(r.sale_date.getMonth() + 1).padStart(2, '0')}-${String(r.sale_date.getDate()).padStart(2, '0')}`
                : String(r.sale_date || '').split('T')[0].slice(0, 10),
        })));
    } catch (err) {
        console.error("getSales error:", err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/walkin-sales ────────────────────────────────
exports.createSale = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            buyer_name,
            buyer_id,
            seller_id,
            product_type_id,
            milk_type,
            quantity,
            mrp,
            total_amount,
            payment_mode,
            shift,
            sale_date,
        } = req.body;

        // Validation
        if (!milk_type) {
            await conn.rollback();
            return res.status(400).json({ error: 'Milk type is required' });
        }
        if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Valid quantity is required' });
        }
        if (!mrp || isNaN(mrp) || parseFloat(mrp) <= 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'Valid MRP is required' });
        }
        if (!shift) {
            await conn.rollback();
            return res.status(400).json({ error: 'Shift is required' });
        }
        if (!sale_date) {
            await conn.rollback();
            return res.status(400).json({ error: 'Sale date is required' });
        }

         const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operator_id = isAdmin ? null : req.user.id;
        const created_by_admin_id = isAdmin ? req.user.id : null;

        // Verify seller if provided
        if (seller_id) {
            const [sellerCheck] = await conn.query(
                'SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?',
                [seller_id, centre_id]
            );
            if (!sellerCheck.length) {
                await conn.rollback();
                return res.status(404).json({ error: 'Seller not found in your centre.' });
            }

            // REMOVED operator access check - any operator can use any seller
        }

        // Verify buyer if provided
        if (buyer_id) {
            const [buyerCheck] = await conn.query(
                'SELECT buyer_id FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?',
                [buyer_id, centre_id]
            );
            if (!buyerCheck.length) {
                await conn.rollback();
                return res.status(404).json({ error: 'Buyer not found in your centre.' });
            }
        }

        // Verify product type if provided
        if (product_type_id) {
            const [productTypeCheck] = await conn.query(
                'SELECT product_type_id FROM walkin_product_types WHERE product_type_id = ? AND centre_id = ?',
                [product_type_id, centre_id]
            );
            if (!productTypeCheck.length) {
                await conn.rollback();
                return res.status(404).json({ error: 'Product type not found in your centre.' });
            }
        }

        // Check stock availability
        const [[collected]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM milk_entries
             WHERE entry_date = ? AND milk_type = ? AND centre_id = ?`,
            [sale_date, milk_type, centre_id]
        );

        const [[alreadySold]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS total
             FROM walkin_sales
             WHERE sale_date = ? AND milk_type = ? AND centre_id = ?`,
            [sale_date, milk_type, centre_id]
        );

        const available = parseFloat(collected.total) - parseFloat(alreadySold.total);
        if (parseFloat(quantity) > available && !isAdmin) {
            await conn.rollback();
            return res.status(400).json({
                error: `Insufficient stock. Available: ${available.toFixed(2)} L of ${milk_type} milk for ${sale_date}.`
            });
        }

        // ── Product-type rate uplift ────────────────────────────
        const { product_type, amount_paid } = req.body;
        let effectiveMrp = parseFloat(mrp);
        let extraRate = 0;
        if (product_type_id) {
            const [[pt]] = await conn.query(
                `SELECT extra_rate FROM walkin_product_types WHERE product_type_id = ? AND centre_id = ?`,
                [product_type_id, centre_id]
            );
            if (pt) extraRate = parseFloat(pt.extra_rate || 0);
        }
        if (product_type === 'packaged') effectiveMrp += extraRate;

        const computedTotal = (parseFloat(quantity) * effectiveMrp).toFixed(2);
        const actualPaid = amount_paid != null ? parseFloat(amount_paid) : null;

        // ── Previous balance for named buyer ──────────────────
        let prevBalance = 0;
        if (buyer_id) {
            const [[balRow]] = await conn.query(
                `SELECT COALESCE(SUM(total_amount - COALESCE(amount_paid, total_amount)), 0) AS bal
                 FROM walkin_sales WHERE buyer_id = ? AND centre_id = ?`,
                [buyer_id, centre_id]
            );
            prevBalance = parseFloat(balRow.bal || 0);
        }

        // Insert sale
        const [result] = await conn.query(
            `INSERT INTO walkin_sales
             (buyer_name, buyer_id, seller_id, product_type_id, product_type, 
              milk_type, quantity, mrp, total_amount, amount_paid, 
              previous_balance, payment_mode, shift, sale_date, operator_id, centre_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                buyer_name?.trim() || 'ANON',
                buyer_id || null,
                seller_id || null,
                product_type_id || null,
                product_type || 'loose',
                milk_type,
                parseFloat(quantity),
                effectiveMrp,
                computedTotal,
                actualPaid,
                prevBalance,
                payment_mode || 'cash',
                shift,
                sale_date,
                operator_id,
                centre_id
            ]
        );

        await conn.commit();

        const [newRow] = await pool.query(
            `SELECT ws.*, o.name AS operator_name
             FROM walkin_sales ws
             LEFT JOIN operators o ON o.operator_id = ws.operator_id
             WHERE ws.sale_id = ? AND ws.centre_id = ?`,
            [result.insertId, centre_id]
        );

        res.status(201).json(newRow[0]);
    } catch (err) {
        await conn.rollback();
        console.error('createSale error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── DELETE /api/walkin-sales/:id ──────────────────────────
exports.deleteSale = async (req, res) => {
    try {
        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        const [existing] = await pool.query(
            'SELECT * FROM walkin_sales WHERE sale_id = ? AND centre_id = ?',
            [id, centre_id]
        );
        if (!existing[0]) {
            return res.status(404).json({ error: 'Sale not found in your centre' });
        }

        // Only allow deletion by the same operator or admin
        if (!isAdmin && existing[0].operator_id !== operator_id) {
            return res.status(403).json({ error: 'Not authorized to delete this sale' });
        }

        await pool.query('DELETE FROM walkin_sales WHERE sale_id = ? AND centre_id = ?', [id, centre_id]);
        res.json({ message: 'Sale deleted successfully' });
    } catch (err) {
        console.error('deleteSale error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/mrp-rates ───────────────────────────────────
exports.getMRPRates = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        // Get centre-specific MRP rates from app_settings
        const [rows] = await pool.query(
            `SELECT setting_key, setting_value
             FROM app_settings
             WHERE centre_id = ? AND setting_key IN ('mrp_cow_rate', 'mrp_buffalo_rate')`,
            [centre_id]
        );

        // If no centre-specific rates, fallback to global settings
        let rates = {};
        if (rows.length === 0) {
            const [globalRows] = await pool.query(
                `SELECT setting_key, setting_value
                 FROM global_settings
                 WHERE setting_key IN ('mrp_cow_rate', 'mrp_buffalo_rate')`
            );
            globalRows.forEach(row => {
                rates[row.setting_key] = parseFloat(row.setting_value || 0);
            });
        } else {
            rows.forEach(row => {
                rates[row.setting_key] = parseFloat(row.setting_value || 0);
            });
        }

        res.json({
            mrp_cow_rate: rates.mrp_cow_rate || 0,
            mrp_buffalo_rate: rates.mrp_buffalo_rate || 0,
        });
    } catch (err) {
        console.error("getMRPRates error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/mrp-rates ──────────────────────────────────
exports.saveMRPRates = async (req, res) => {
    try {
        const { mrp_cow_rate, mrp_buffalo_rate } = req.body;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;

        if (mrp_cow_rate === undefined || mrp_buffalo_rate === undefined) {
            return res.status(400).json({ error: 'Both MRP rates are required' });
        }

        // Update or insert MRP rates in app_settings (centre-specific)
        await pool.query(
            `INSERT INTO app_settings (operator_id, centre_id, setting_key, setting_value)
             VALUES (?, ?, 'mrp_cow_rate', ?), (?, ?, 'mrp_buffalo_rate', ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [operator_id, centre_id, mrp_cow_rate, operator_id, centre_id, mrp_buffalo_rate]
        );

        res.json({ success: true, message: 'MRP rates saved successfully' });
    } catch (err) {
        console.error("saveMRPRates error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-sales/product-types ──────────────────────
exports.getProductTypes = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        // Both admin and operator see all product types in their centre
        const query = `
            SELECT wpt.*, o.name AS operator_name
            FROM walkin_product_types wpt
            JOIN operators o ON o.operator_id = wpt.operator_id
            WHERE wpt.centre_id = ? AND wpt.is_active = 1
            ORDER BY wpt.name
        `;

        const [rows] = await pool.query(query, [centre_id]);
        res.json(rows);
    } catch (err) {
        console.error("getProductTypes error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/walkin-sales/product-types ─────────────────────
exports.saveProductType = async (req, res) => {
    try {
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const { name, milk_type, type, extra_rate } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }

        const [result] = await pool.query(
            `INSERT INTO walkin_product_types (operator_id, centre_id, name, milk_type, type, extra_rate)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [operator_id, centre_id, name.trim(), milk_type || 'both', type, parseFloat(extra_rate || 0)]
        );

        const [row] = await pool.query(
            `SELECT * FROM walkin_product_types WHERE product_type_id = ?`,
            [result.insertId]
        );
        res.status(201).json(row[0]);
    } catch (err) {
        console.error("saveProductType error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── PUT /api/walkin-sales/product-types/:id ───────────────────
exports.updateProductType = async (req, res) => {
    try {
        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { name, milk_type, type, extra_rate, is_active } = req.body;

        // Check if product type exists and user has access
        let accessQuery = `SELECT product_type_id FROM walkin_product_types WHERE product_type_id = ? AND centre_id = ?`;
        let accessParams = [id, centre_id];

        if (!isAdmin) {
            accessQuery += ` AND operator_id = ?`;
            accessParams.push(operator_id);
        }

        const [existing] = await pool.query(accessQuery, accessParams);
        if (!existing.length) {
            return res.status(403).json({ error: 'Product type not found or unauthorized.' });
        }

        await pool.query(
            `UPDATE walkin_product_types SET
                name = ?,
                milk_type = ?,
                type = ?,
                extra_rate = ?,
                is_active = ?
             WHERE product_type_id = ? AND centre_id = ?`,
            [
                name || null,
                milk_type || 'both',
                type || 'loose',
                parseFloat(extra_rate) || 0,
                is_active !== undefined ? is_active : 1,
                id,
                centre_id
            ]
        );

        const [updated] = await pool.query(
            `SELECT * FROM walkin_product_types WHERE product_type_id = ?`,
            [id]
        );
        res.json(updated[0]);
    } catch (err) {
        console.error("updateProductType error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── DELETE /api/walkin-sales/product-types/:id ───────────────
exports.deleteProductType = async (req, res) => {
    try {
        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        let deleteQuery = `DELETE FROM walkin_product_types WHERE product_type_id = ? AND centre_id = ?`;
        let deleteParams = [id, centre_id];

        if (!isAdmin) {
            deleteQuery += ` AND operator_id = ?`;
            deleteParams.push(operator_id);
        }

        const [result] = await pool.query(deleteQuery, deleteParams);

        if (result.affectedRows === 0) {
            return res.status(403).json({ error: 'Product type not found or unauthorized.' });
        }

        res.json({ message: 'Product type deleted successfully' });
    } catch (err) {
        console.error("deleteProductType error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-sales/named-buyers ───────────────────────
exports.getNamedBuyers = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        // Both admin and operator see all named buyers in their centre
        const query = `
            SELECT wb.*, o.name AS operator_name,
                   (SELECT COUNT(*) FROM walkin_sales ws 
                    WHERE ws.buyer_id = wb.buyer_id AND ws.centre_id = wb.centre_id) AS total_sales
            FROM walkin_named_buyers wb
            JOIN operators o ON o.operator_id = wb.operator_id
            WHERE wb.centre_id = ?
            ORDER BY wb.name
        `;

        const [rows] = await pool.query(query, [centre_id]);
        res.json(rows);
    } catch (err) {
        console.error("getNamedBuyers error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// POST /api/walkin-sales/named-buyers
exports.saveNamedBuyer = async (req, res) => {
    try {
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const { name, mobile, address } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Check for duplicate — return existing instead of erroring
        const [existing] = await pool.query(
            'SELECT * FROM walkin_named_buyers WHERE name = ? AND centre_id = ?',
            [name.trim(), centre_id]
        );
        if (existing.length) {
            return res.status(200).json(existing[0]);   // ← return existing record
        }

        const [result] = await pool.query(
            `INSERT INTO walkin_named_buyers (operator_id, centre_id, name, mobile, address)
             VALUES (?, ?, ?, ?, ?)`,
            [operator_id, centre_id, name.trim(), mobile || null, address || null]
        );

        const [row] = await pool.query(
            `SELECT * FROM walkin_named_buyers WHERE buyer_id = ?`,
            [result.insertId]
        );
        return res.status(201).json(row[0]);
    } catch (err) {
        console.error("saveNamedBuyer error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-sales/named-buyer-balance/:buyerId ───────
exports.getNamedBuyerBalance = async (req, res) => {
    try {
        const { buyerId } = req.params;
        const centre_id = req.user.centre_id;

        // Verify buyer belongs to centre
        const [buyerCheck] = await pool.query(
            'SELECT buyer_id FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?',
            [buyerId, centre_id]
        );
        if (!buyerCheck.length) {
            return res.status(404).json({ error: 'Buyer not found in your centre.' });
        }

        const [[row]] = await pool.query(
            `SELECT COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding_balance
             FROM walkin_sales ws
             WHERE ws.buyer_id = ? AND ws.centre_id = ?`,
            [buyerId, centre_id]
        );
        res.json({ outstanding_balance: parseFloat(row.outstanding_balance) });
    } catch (err) {
        console.error("getNamedBuyerBalance error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/walkin-sales/named-buyer-summaries ──────────────
exports.getNamedBuyerSummaries = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;

        // Both admin and operator see all buyer summaries
        const query = `
            SELECT
                nb.buyer_id,
                nb.name,
                COALESCE(SUM(ws.total_amount), 0) AS total_amount,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, ws.total_amount)), 0) AS outstanding
            FROM walkin_named_buyers nb
            LEFT JOIN walkin_sales ws ON ws.buyer_id = nb.buyer_id AND ws.centre_id = nb.centre_id
            WHERE nb.centre_id = ? AND nb.is_active = 1
            GROUP BY nb.buyer_id, nb.name
            HAVING outstanding > 0
            ORDER BY nb.name
        `;

        const [rows] = await pool.query(query, [centre_id]);
        res.json(rows.map(r => ({
            ...r,
            total_amount: parseFloat(r.total_amount),
            total_paid: parseFloat(r.total_paid),
            outstanding: parseFloat(r.outstanding),
        })));
    } catch (err) {
        console.error("getNamedBuyerSummaries error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/walkin-sales/clear-buyer-bill ──────────────────
exports.clearBuyerBill = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { buyer_id, amount_paid, outstanding } = req.body;

        if (!buyer_id || amount_paid == null) {
            await conn.rollback();
            return res.status(400).json({ error: 'buyer_id and amount_paid required' });
        }

        // Verify buyer belongs to centre
        const [buyerCheck] = await conn.query(
            'SELECT buyer_id FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?',
            [buyer_id, centre_id]
        );
        if (!buyerCheck.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Buyer not found in your centre.' });
        }

        const paid = parseFloat(amount_paid);
        const totalOwed = parseFloat(outstanding);
        const remaining = Math.max(0, totalOwed - paid);

        // Get all unpaid/partial sales for this buyer, oldest first
        let salesQuery = `
            SELECT sale_id, total_amount, COALESCE(amount_paid, 0) AS paid
            FROM walkin_sales
            WHERE buyer_id = ? AND centre_id = ?
              AND (amount_paid IS NULL OR amount_paid < total_amount)
            ORDER BY sale_date ASC, sale_id ASC
        `;
        let salesParams = [buyer_id, centre_id];

        // REMOVED operator filter

        const [sales] = await conn.query(salesQuery, salesParams);

        // Distribute payment across sales
        let budgetLeft = paid;
        for (const sale of sales) {
            if (budgetLeft <= 0) break;
            const owed = parseFloat(sale.total_amount) - parseFloat(sale.paid);
            const toApply = Math.min(budgetLeft, owed);
            const newPaid = parseFloat(sale.paid) + toApply;
            await conn.query(
                `UPDATE walkin_sales SET amount_paid = ? WHERE sale_id = ? AND centre_id = ?`,
                [newPaid.toFixed(2), sale.sale_id, centre_id]
            );
            budgetLeft -= toApply;
        }

        // Also record in walkin_payments so WalkinPayments page stays in sync
        await conn.query(
            `INSERT INTO walkin_payments 
             (operator_id, centre_id, buyer_id, seller_id, amount, payment_mode, remarks, payment_date)
             VALUES (?, ?, ?, ?, ?, 'cash', ?, CURDATE())`,
            [
                operator_id,
                centre_id,
                buyer_id || null,
                null,
                paid,
                `Bill clearance from Walk-in Sales`
            ]
        );

        await conn.commit();
        res.json({
            success: true,
            paid,
            remaining,
            message: remaining > 0
                ? `₹${remaining.toFixed(2)} carries forward`
                : 'Bill fully cleared',
        });
    } catch (err) {
        await conn.rollback();
        console.error("clearBuyerBill error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/walkin-sales/billing-summary ────────────────────
exports.getBillingSummary = async (req, res) => {
    try {
        const centre_id = req.user.centre_id;
        const { from, to } = req.query;

        let query = `
            SELECT
                COUNT(DISTINCT ws.buyer_id) AS unique_buyers,
                COUNT(DISTINCT ws.seller_id) AS unique_sellers,
                COUNT(*) AS total_sales,
                COALESCE(SUM(ws.total_amount), 0) AS total_revenue,
                COALESCE(SUM(COALESCE(ws.amount_paid, 0)), 0) AS total_paid,
                COALESCE(SUM(ws.total_amount - COALESCE(ws.amount_paid, 0)), 0) AS outstanding
            FROM walkin_sales ws
            WHERE ws.centre_id = ?
        `;
        let params = [centre_id];

        // REMOVED operator filter

        if (from && to) {
            query += ` AND ws.sale_date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows[0]);
    } catch (err) {
        console.error("getBillingSummary error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── PUT /api/walkin-sales/:id ─────────────────────────────────
exports.updateSale = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        const [existing] = await conn.query(
            'SELECT * FROM walkin_sales WHERE sale_id = ? AND centre_id = ?',
            [id, centre_id]
        );
        if (!existing[0]) {
            await conn.rollback();
            return res.status(404).json({ error: 'Sale not found in your centre' });
        }

        if (!isAdmin && existing[0].operator_id !== operator_id) {
            await conn.rollback();
            return res.status(403).json({ error: 'Not authorized to update this sale' });
        }

        const {
            buyer_name, buyer_id, seller_id, product_type_id, product_type,
            milk_type, quantity, mrp, total_amount, amount_paid,
            payment_mode, shift, sale_date,
        } = req.body;

        // Verify seller if provided
        if (seller_id) {
            const [sellerCheck] = await conn.query(
                'SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?',
                [seller_id, centre_id]
            );
            if (!sellerCheck.length) {
                await conn.rollback();
                return res.status(404).json({ error: 'Seller not found in your centre.' });
            }
        }

        // Verify buyer if provided
        if (buyer_id) {
            const [buyerCheck] = await conn.query(
                'SELECT buyer_id FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?',
                [buyer_id, centre_id]
            );
            if (!buyerCheck.length) {
                await conn.rollback();
                return res.status(404).json({ error: 'Buyer not found in your centre.' });
            }
        }

        let effectiveMrp = parseFloat(mrp);
        if (product_type_id && product_type === 'packaged') {
            const [[pt]] = await conn.query(
                `SELECT extra_rate FROM walkin_product_types WHERE product_type_id = ? AND centre_id = ?`,
                [product_type_id, centre_id]
            );
            if (pt) effectiveMrp += parseFloat(pt.extra_rate || 0);
        }

        // Check stock availability if quantity changed
        if (parseFloat(quantity) !== parseFloat(existing[0].quantity)) {
            const [[collected]] = await conn.query(
                `SELECT COALESCE(SUM(quantity), 0) AS total
                 FROM milk_entries
                 WHERE entry_date = ? AND milk_type = ? AND centre_id = ?`,
                [sale_date, milk_type, centre_id]
            );

            const [[alreadySold]] = await conn.query(
                `SELECT COALESCE(SUM(quantity), 0) AS total
                 FROM walkin_sales
                 WHERE sale_date = ? AND milk_type = ? AND centre_id = ? AND sale_id != ?`,
                [sale_date, milk_type, centre_id, id]
            );

            const available = parseFloat(collected.total) - parseFloat(alreadySold.total);
            if (parseFloat(quantity) > available && !isAdmin) {
                await conn.rollback();
                return res.status(400).json({
                    error: `Insufficient stock. Available: ${available.toFixed(2)} L of ${milk_type} milk for ${sale_date}.`
                });
            }
        }

        await conn.query(
            `UPDATE walkin_sales SET
                buyer_name = ?, buyer_id = ?, seller_id = ?, 
                product_type_id = ?, product_type = ?,
                milk_type = ?, quantity = ?, mrp = ?, 
                total_amount = ?, amount_paid = ?,
                payment_mode = ?, shift = ?, sale_date = ?
             WHERE sale_id = ? AND centre_id = ?`,
            [
                buyer_name?.trim() || 'ANON',
                buyer_id || null,
                seller_id || null,
                product_type_id || null,
                product_type || 'loose',
                milk_type,
                parseFloat(quantity),
                effectiveMrp,
                parseFloat(total_amount),
                amount_paid != null ? parseFloat(amount_paid) : null,
                payment_mode || 'cash',
                shift,
                sale_date,
                id,
                centre_id
            ]
        );

        await conn.commit();

        const [updated] = await pool.query(
            `SELECT ws.*, o.name AS operator_name
             FROM walkin_sales ws
             LEFT JOIN operators o ON o.operator_id = ws.operator_id
             WHERE ws.sale_id = ? AND ws.centre_id = ?`,
            [id, centre_id]
        );
        res.json(updated[0]);
    } catch (err) {
        await conn.rollback();
        console.error('updateSale error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── PUT /api/walkin-sales/named-buyers/:id ───────────────────
exports.updateNamedBuyer = async (req, res) => {
    try {
        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { name, mobile, address, is_active } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Check if buyer exists and user has access
        let accessQuery = `SELECT buyer_id FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?`;
        let accessParams = [id, centre_id];

        if (!isAdmin) {
            accessQuery += ` AND operator_id = ?`;
            accessParams.push(operator_id);
        }

        const [existing] = await pool.query(accessQuery, accessParams);
        if (!existing.length) {
            return res.status(403).json({ error: 'Buyer not found or unauthorized.' });
        }

        // Check for duplicate name (excluding current buyer)
        const [duplicate] = await pool.query(
            `SELECT buyer_id FROM walkin_named_buyers 
             WHERE centre_id = ? AND name = ? AND buyer_id != ?`,
            [centre_id, name.trim(), id]
        );

        if (duplicate.length > 0) {
            return res.status(400).json({ error: 'A buyer with this name already exists' });
        }

        await pool.query(
            `UPDATE walkin_named_buyers 
             SET name = ?, mobile = ?, address = ?, is_active = ?
             WHERE buyer_id = ? AND centre_id = ?`,
            [name.trim(), mobile || null, address || null,
            is_active !== undefined ? is_active : 1, id, centre_id]
        );

        const [row] = await pool.query(
            `SELECT * FROM walkin_named_buyers WHERE buyer_id = ?`,
            [id]
        );

        res.json(row[0]);
    } catch (err) {
        console.error("updateNamedBuyer error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── DELETE /api/walkin-sales/named-buyers/:id ────────────────
exports.deleteNamedBuyer = async (req, res) => {
    try {
        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check if buyer exists and user has access
        let accessQuery = `SELECT buyer_id FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?`;
        let accessParams = [id, centre_id];

        if (!isAdmin) {
            accessQuery += ` AND operator_id = ?`;
            accessParams.push(operator_id);
        }

        const [existing] = await pool.query(accessQuery, accessParams);
        if (!existing.length) {
            return res.status(404).json({ error: 'Buyer not found or unauthorized.' });
        }

        // Check if buyer has sales records
        const [sales] = await pool.query(
            `SELECT COUNT(*) AS count FROM walkin_sales 
             WHERE buyer_id = ? AND centre_id = ?`,
            [id, centre_id]
        );

        if (sales[0].count > 0) {
            // Soft delete instead of hard delete
            await pool.query(
                `UPDATE walkin_named_buyers SET is_active = 0 
                 WHERE buyer_id = ? AND centre_id = ?`,
                [id, centre_id]
            );
            res.json({
                message: 'Buyer deactivated successfully',
                softDelete: true
            });
        } else {
            // Hard delete if no sales
            let deleteQuery = `DELETE FROM walkin_named_buyers WHERE buyer_id = ? AND centre_id = ?`;
            let deleteParams = [id, centre_id];

            if (!isAdmin) {
                deleteQuery += ` AND operator_id = ?`;
                deleteParams.push(operator_id);
            }

            await pool.query(deleteQuery, deleteParams);
            res.json({ message: 'Buyer deleted successfully' });
        }
    } catch (err) {
        console.error("deleteNamedBuyer error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── PATCH /api/walkin-sales/named-buyers/:id/status ──────────
exports.toggleBuyerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { is_active } = req.body;

        let updateQuery = `UPDATE walkin_named_buyers SET is_active = ? WHERE buyer_id = ? AND centre_id = ?`;
        let updateParams = [is_active, id, centre_id];

        if (!isAdmin) {
            updateQuery += ` AND operator_id = ?`;
            updateParams.push(operator_id);
        }

        await pool.query(updateQuery, updateParams);

        const [row] = await pool.query(
            `SELECT * FROM walkin_named_buyers WHERE buyer_id = ?`,
            [id]
        );

        res.json(row[0]);
    } catch (err) {
        console.error("toggleBuyerStatus error:", err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};