const pool = require('../config/db');

// ── GET /api/sellers ──────────────────────────────────────
exports.listSellers = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // Both admin and operator see all sellers under their centre
        const query = `
            SELECT
                seller_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, ifsc_code,
                address, advance_enabled, advance_deduction, product_sale_enabled,
                is_active, created_at,
                deposit_enabled, deposit_per_litre,
                operator_id
            FROM sellers
            WHERE centre_id = ?
            ORDER BY created_at DESC
        `;

        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('listSellers error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/centre (Admin only) ─────────────────
exports.listCentreSellers = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // Only admins can access this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const query = `
            SELECT
                s.seller_id, s.seller_code, s.name, s.mobile, s.aadhaar,
                s.pan_number, s.seller_id_code,
                s.seller_type, s.milk_type, s.jamin,
                s.bank_account, s.bank_name, s.ifsc_code,
                s.address, s.advance_enabled, s.advance_deduction, s.product_sale_enabled,
                s.is_active, s.created_at,
                s.deposit_enabled, s.deposit_per_litre,
                o.name AS operator_name, o.operator_id
            FROM sellers s
            JOIN operators o ON o.operator_id = s.operator_id
            WHERE s.centre_id = ?
            ORDER BY s.created_at DESC
        `;

        const [rows] = await pool.query(query, [centreId]);
        res.json(rows);
    } catch (err) {
        console.error('listCentreSellers error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/operator/:operatorId (Admin only) ───
exports.listSellersByOperator = async (req, res) => {
    try {
        const { operatorId } = req.params;
        const centreId = req.user.centre_id;

        // Only admins can access this endpoint
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        // Verify operator belongs to the same centre
        const [operatorCheck] = await pool.query(
            `SELECT operator_id FROM operators 
             WHERE operator_id = ? AND centre_id = ?`,
            [operatorId, centreId]
        );

        if (!operatorCheck.length) {
            return res.status(403).json({
                error: 'Access denied. Operator does not belong to your centre.'
            });
        }

        const query = `
            SELECT
                seller_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, ifsc_code,
                address, advance_enabled, advance_deduction, product_sale_enabled,
                is_active, created_at,
                deposit_enabled, deposit_per_litre
            FROM sellers
            WHERE operator_id = ? AND centre_id = ?
            ORDER BY created_at DESC
        `;

        const [rows] = await pool.query(query, [operatorId, centreId]);
        res.json(rows);
    } catch (err) {
        console.error('listSellersByOperator error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id ──────────────────────────────────
exports.getSellerById = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        let query, params;

        if (isAdmin) {
            query = `
                SELECT
                    seller_id, seller_code, name, mobile, aadhaar,
                    pan_number, seller_id_code,
                    seller_type, milk_type, jamin,
                    bank_account, bank_name, ifsc_code,
                    address, advance_enabled, advance_deduction, product_sale_enabled,
                    is_active, created_at,
                    deposit_enabled, deposit_per_litre,
                    operator_id
                FROM sellers
                WHERE seller_id = ? AND centre_id = ?
            `;
            params = [req.params.id, centreId];
        } else {
            query = `
                SELECT
                    seller_id, seller_code, name, mobile, aadhaar,
                    pan_number, seller_id_code,
                    seller_type, milk_type, jamin,
                    bank_account, bank_name, ifsc_code,
                    address, advance_enabled, advance_deduction, product_sale_enabled,
                    is_active, created_at,
                    deposit_enabled, deposit_per_litre,
                    operator_id
                FROM sellers
                WHERE seller_id = ? AND operator_id = ? AND centre_id = ?
            `;
            params = [req.params.id, operatorId, centreId];
        }

        const [rows] = await pool.query(query, params);

        if (!rows[0]) {
            return res.status(404).json({ message: 'Seller not found or unauthorized' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('getSellerById error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/summary ─────────────────────────
exports.getSellerSummary = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        // Total milk delivered + total amount earned (all time)
        const [[milkTotals]] = await pool.query(
            `SELECT
                COUNT(*)                        AS total_entries,
                COALESCE(SUM(quantity), 0)      AS total_quantity,
                COALESCE(SUM(total_amount), 0)  AS total_earned,
                COALESCE(AVG(fat), 0)           AS avg_fat,
                COALESCE(AVG(snf), 0)           AS avg_snf
             FROM milk_entries
             WHERE seller_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        // This month
        const [[thisMonth]] = await pool.query(
            `SELECT
                COALESCE(SUM(quantity), 0)     AS month_quantity,
                COALESCE(SUM(total_amount), 0) AS month_amount
             FROM milk_entries
             WHERE seller_id = ?
               AND centre_id = ?
               AND MONTH(entry_date) = MONTH(CURDATE())
               AND YEAR(entry_date)  = YEAR(CURDATE())`,
            [id, centreId]
        );

        // Pending cash advance balance (given - received)
        const [[advance]] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'given'    THEN amount ELSE 0 END), 0) AS total_given,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS total_received
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        // Product sales outstanding
        const [[products]] = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS product_total
             FROM product_sales
             WHERE seller_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        // Active premium rate
        const [premium] = await pool.query(
            `SELECT rate_per_liter, reason, effective_from, effective_to
             FROM premium_rates
             WHERE seller_id = ?
               AND centre_id = ?
               AND is_active = 1
               AND effective_from <= CURDATE()
               AND (effective_to IS NULL OR effective_to >= CURDATE())
             ORDER BY created_at DESC LIMIT 1`,
            [id, centreId]
        );

        res.json({
            ...milkTotals,
            ...thisMonth,
            advance_balance: advance.total_given - advance.total_received,
            product_total: products.product_total,
            premium_rate: premium[0] || null,
        });
    } catch (err) {
        console.error('getSellerSummary error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/entries ─────────────────────────
exports.getSellerEntries = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;
        const { month, from, to } = req.query;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        let dateFilter = '';
        const params = [id, centreId];

        if (from && to) {
            dateFilter = `AND entry_date BETWEEN ? AND ?`;
            params.push(from, to);
        } else if (month) {
            dateFilter = `AND DATE_FORMAT(entry_date, '%Y-%m') = ?`;
            params.push(month);
        }

        const [rows] = await pool.query(
            `SELECT entry_id, entry_date, shift, milk_type,
                    quantity, fat, snf, water,
                    rate_applied, is_premium, total_amount, entry_time,
                    operator_id
             FROM milk_entries
             WHERE seller_id = ? AND centre_id = ? ${dateFilter}
             ORDER BY entry_date DESC, shift DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerEntries error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/advance ─────────────────────────
exports.getSellerAdvance = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks, created_at, operator_id
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ?
             ORDER BY transaction_date DESC`,
            [id, centreId]
        );

        // Running balance
        let balance = 0;
        const withBalance = [...rows].reverse().map(r => {
            balance += r.type === 'given' ? Number(r.amount) : -Number(r.amount);
            return { ...r, running_balance: balance };
        }).reverse();

        res.json(withBalance);
    } catch (err) {
        console.error('getSellerAdvance error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/deposit ─────────────────────────
exports.getSellerDeposits = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT id, seller_id, operator_id, type, amount, transaction_date, remarks, created_at
             FROM seller_deposits
             WHERE seller_id = ? AND centre_id = ?
             ORDER BY transaction_date DESC`,
            [id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerDeposits error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/products ────────────────────────
exports.getSellerProducts = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT ps.sale_id, ps.sale_date, ps.quantity, ps.rate, ps.total_amount,
                    p.product_name, p.unit
             FROM product_sales ps
             JOIN products p ON p.product_id = ps.product_id
             WHERE ps.seller_id = ? AND ps.centre_id = ?
             ORDER BY ps.sale_date DESC`,
            [id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerProducts error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/premium ─────────────────────────
exports.getSellerPremium = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT id, milk_type, rate_per_liter, reason,
                    effective_from, effective_to, is_active, created_at
             FROM premium_rates
             WHERE seller_id = ? AND centre_id = ?
             ORDER BY created_at DESC`,
            [id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerPremium error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/sellers ─────────────────────────────────────
exports.createSeller = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            seller_code, name, mobile, aadhaar,
            pan_number, seller_id_code,
            seller_type, milk_type, jamin,
            bank_account, bank_name, ifsc_code, address,
            advance_enabled, advance_deduction, product_sale_enabled,
            deposit_enabled, deposit_per_litre
        } = req.body;

        if (!name || !mobile) {
            await conn.rollback();
            return res.status(400).json({ message: 'Name and mobile are required' });
        }

        const operator_id = req.user.id;
        const centre_id = req.user.centre_id;

        // Check if seller already exists in this centre
        const [existing] = await conn.query(
            `SELECT seller_id FROM sellers
             WHERE (seller_code = ? OR (mobile = ? AND centre_id = ?))`,
            [seller_code, mobile, centre_id]
        );

        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({
                error: 'Seller with this code or mobile already exists in your centre'
            });
        }

        const [result] = await conn.query(
            `INSERT INTO sellers
             (operator_id, centre_id, seller_code, name, mobile, aadhaar,
              pan_number, seller_id_code,
              seller_type, milk_type, jamin,
              bank_account, bank_name, ifsc_code, address,
              advance_enabled, advance_deduction, product_sale_enabled,
              deposit_enabled, deposit_per_litre)
             VALUES (?, ?, ?, ?, ?, ?,
                     ?, ?,
                     ?, ?, ?,
                     ?, ?, ?, ?,
                     ?, ?, ?,
                     ?, ?)`,
            [
                operator_id,
                centre_id,
                seller_code || null,
                name,
                mobile,
                aadhaar || null,
                pan_number || null,
                seller_id_code || null,
                seller_type || 'Utpadak',
                milk_type || 'mixed',
                jamin || null,
                bank_account || null,
                bank_name || null,
                ifsc_code || null,
                address || null,
                advance_enabled !== undefined ? advance_enabled : 1,
                advance_deduction || null,
                product_sale_enabled !== undefined ? product_sale_enabled : 0,
                deposit_enabled !== undefined ? deposit_enabled : 0,
                deposit_per_litre || null
            ]
        );

        await conn.commit();
        res.status(201).json({
            seller_id: result.insertId,
            name,
            mobile,
            seller_code,
            centre_id
        });
    } catch (err) {
        await conn.rollback();
        console.error('createSeller error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
        conn.release();
    }
};

// ── PUT /api/sellers/:id ───────────────────────────────────
exports.updateSeller = async (req, res) => {
    try {
        const {
            seller_code, name, mobile, aadhaar,
            pan_number, seller_id_code,
            seller_type, milk_type, jamin,
            bank_account, bank_name, ifsc_code, address,
            advance_enabled, advance_deduction, product_sale_enabled,
            deposit_enabled, deposit_per_litre,
            is_active
        } = req.body;

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check if seller exists and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [req.params.id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [req.params.id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        // Check for duplicate seller_code or mobile in the same centre
        const [duplicate] = await pool.query(
            `SELECT seller_id FROM sellers 
             WHERE (seller_code = ? OR (mobile = ? AND centre_id = ?))
               AND seller_id != ?`,
            [seller_code, mobile, centreId, req.params.id]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                error: 'Another seller with this code or mobile already exists in your centre'
            });
        }

        const [result] = await pool.query(
            `UPDATE sellers SET
                seller_code          = ?,
                name                 = ?,
                mobile               = ?,
                aadhaar              = ?,
                pan_number           = ?,
                seller_id_code       = ?,
                seller_type          = ?,
                milk_type            = ?,
                jamin                = ?,
                bank_account         = ?,
                bank_name            = ?,
                ifsc_code            = ?,
                address              = ?,
                advance_enabled      = ?,
                advance_deduction    = ?,
                product_sale_enabled = ?,
                deposit_enabled      = ?,
                deposit_per_litre    = ?,
                is_active            = ?
             WHERE seller_id = ? AND centre_id = ?`,
            [
                seller_code || null,
                name || null,
                mobile || null,
                aadhaar || null,
                pan_number || null,
                seller_id_code || null,
                seller_type || 'Utpadak',
                milk_type || 'mixed',
                jamin || null,
                bank_account || null,
                bank_name || null,
                ifsc_code || null,
                address || null,
                advance_enabled !== undefined ? advance_enabled : 1,
                advance_deduction || null,
                product_sale_enabled !== undefined ? product_sale_enabled : 0,
                deposit_enabled !== undefined ? deposit_enabled : 0,
                deposit_per_litre || null,
                is_active !== undefined ? is_active : 1,
                req.params.id,
                centreId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Seller not found or unauthorized' });
        }

        // Fetch the updated seller data
        const [rows] = await pool.query(
            `SELECT
                seller_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, ifsc_code,
                address, advance_enabled, advance_deduction,
                product_sale_enabled, deposit_enabled, deposit_per_litre,
                is_active, created_at, operator_id
             FROM sellers
             WHERE seller_id = ? AND centre_id = ?`,
            [req.params.id, centreId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('updateSeller error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── DELETE /api/sellers/:id ───────────────────────────────
exports.deleteSeller = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        // Check if seller exists and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [req.params.id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [req.params.id, operatorId, centreId];
        }

        const [accessCheck] = await conn.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            await conn.rollback();
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        // Delete all linked data in correct order
        await conn.query(`DELETE FROM bonus_payments WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);
        await conn.query(`DELETE FROM gavali_bonus_payments WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);
        await conn.query(`DELETE FROM product_sales WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);
        await conn.query(`DELETE FROM cash_advance WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);
        await conn.query(`DELETE FROM seller_deposits WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);
        await conn.query(`DELETE FROM premium_rates WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);
        await conn.query(`DELETE FROM milk_entries WHERE seller_id = ? AND centre_id = ?`, [req.params.id, centreId]);

        const [result] = await conn.query(
            `DELETE FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [req.params.id, centreId]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Seller not found or unauthorized' });
        }

        await conn.commit();
        res.json({ message: 'Seller and all linked data deleted successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('deleteSeller error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/sellers/:id/deposit-balance ─────────────────
exports.getSellerDepositBalance = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        // Verify seller belongs to the centre and user has access
        let accessQuery, accessParams;
        if (isAdmin) {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
            accessParams = [id, centreId];
        } else {
            accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND operator_id = ? AND centre_id = ?`;
            accessParams = [id, operatorId, centreId];
        }

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [[balance]] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0)  AS total_credit,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS total_debit,
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS net_balance
             FROM seller_deposits
             WHERE seller_id = ? AND centre_id = ?`,
            [id, centreId]
        );
        res.json(balance);
    } catch (err) {
        console.error('getSellerDepositBalance error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/active (Admin only) ─────────────────
exports.getActiveSellers = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const [rows] = await pool.query(
            `SELECT
                seller_id, seller_code, name, mobile,
                pan_number, seller_id_code,
                seller_type, milk_type,
                bank_account, bank_name, ifsc_code,
                address, advance_enabled, advance_deduction, product_sale_enabled,
                deposit_enabled, deposit_per_litre,
                operator_id
             FROM sellers
             WHERE centre_id = ? AND is_active = 1
             ORDER BY name ASC`,
            [centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getActiveSellers error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};