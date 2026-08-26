const pool = require('../config/db');
const bcrypt = require('bcrypt');

// ── GET /api/sellers ──────────────────────────────────────
exports.listSellers = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        const query = `
            SELECT
                seller_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code,
                address, pincode, advance_enabled, advance_deduction, product_sale_enabled,
                cattle_feed_sale_enabled,
                is_active, created_at,
                deposit_enabled, deposit_per_litre,
                operator_id,
                cheque,
                (password_hash IS NOT NULL AND password_hash <> '') AS has_password
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

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        const query = `
            SELECT
                s.seller_id, s.seller_code, s.name, s.mobile, s.aadhaar,
                s.pan_number, s.seller_id_code,
                s.seller_type, s.milk_type, s.jamin,
                s.bank_account, s.bank_name, s.account_holder_name, s.branch_name, s.ifsc_code,
                s.address, s.pincode, s.advance_enabled, s.advance_deduction, s.product_sale_enabled,
                s.is_active, s.created_at,
                s.deposit_enabled, s.deposit_per_litre,
                s.cheque,
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

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

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
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code,
                address, pincode, advance_enabled, advance_deduction, product_sale_enabled,
                is_active, created_at,
                deposit_enabled, deposit_per_litre,
                cheque
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

        const query = `
            SELECT
                seller_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code,
                address, pincode, advance_enabled, advance_deduction,
                product_sale_enabled, product_sale_rate,
                cattle_feed_sale_enabled,
                is_active, created_at,
                deposit_enabled, deposit_per_litre,
                operator_id,
                cheque,
                (password_hash IS NOT NULL AND password_hash <> '') AS has_password
            FROM sellers
            WHERE seller_id = ? AND centre_id = ?
        `;
        const params = [req.params.id, centreId];

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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

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

        const [[advance]] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type = 'given'    THEN amount ELSE 0 END), 0) AS total_given,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS total_received
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ?`,
            [id, centreId]
        );

        const [[products]] = await pool.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS product_total
             FROM product_sales
             WHERE seller_id = ? AND centre_id = ?`,
            [id, centreId]
        );

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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

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
            bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
            advance_enabled, advance_deduction, product_sale_enabled, product_sale_rate,
            deposit_enabled, deposit_per_litre, password,
            cattle_feed_sale_enabled,
            cheque
        } = req.body;

        if (!name || !mobile) {
            await conn.rollback();
            return res.status(400).json({ message: 'Name and mobile are required' });
        }

        const isAdmin = req.user.role === 'admin';
        const operator_id = isAdmin ? null : req.user.id;
        const created_by_admin_id = isAdmin ? req.user.id : null;
        const centre_id = req.user.centre_id;

        const [[centreRow]] = await conn.query(
            `SELECT dairy_id FROM centres WHERE centre_id = ?`,
            [centre_id]
        );
        if (!centreRow) {
            await conn.rollback();
            return res.status(400).json({ message: 'Invalid centre: no matching dairy found' });
        }
        const dairy_id = centreRow.dairy_id;
        const password_hash = password ? await bcrypt.hash(password, 10) : null;

        // Check for duplicate seller_code only (mobile validation removed)
        const [existing] = await conn.query(
            `SELECT seller_id FROM sellers
             WHERE seller_code = ? AND centre_id = ?`,
            [seller_code, centre_id]
        );

        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({
                error: 'Seller with this code already exists in your centre'
            });
        }

        // Check duplicate bank account (max 2 allowed)
        if (bank_account) {
            const [bankAccounts] = await conn.query(
                `SELECT COUNT(*) as count FROM sellers WHERE bank_account = ? AND centre_id = ?`,
                [bank_account, centre_id]
            );
            if (bankAccounts[0].count >= 2) {
                await conn.rollback();
                return res.status(409).json({
                    error: 'Bank Account number already exists for 2 sellers (max 2 allowed)'
                });
            }
        }

        // Check duplicate PAN (max 2 allowed)
        if (pan_number) {
            const [panNumbers] = await conn.query(
                `SELECT COUNT(*) as count FROM sellers WHERE pan_number = ? AND centre_id = ?`,
                [pan_number, centre_id]
            );
            if (panNumbers[0].count >= 2) {
                await conn.rollback();
                return res.status(409).json({
                    error: 'PAN number already exists for 2 sellers (max 2 allowed)'
                });
            }
        }

        // Check duplicate Aadhaar (max 2 allowed)
        if (aadhaar) {
            const [aadhaars] = await conn.query(
                `SELECT COUNT(*) as count FROM sellers WHERE aadhaar = ? AND centre_id = ?`,
                [aadhaar, centre_id]
            );
            if (aadhaars[0].count >= 2) {
                await conn.rollback();
                return res.status(409).json({
                    error: 'Aadhaar number already exists for 2 sellers (max 2 allowed)'
                });
            }
        }

        const [result] = await conn.query(
            `INSERT INTO sellers (
                operator_id, created_by_admin_id, centre_id, dairy_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
                advance_enabled, advance_deduction, product_sale_enabled, product_sale_rate,
                deposit_enabled, deposit_per_litre,
                cattle_feed_sale_enabled,
                password_hash, must_change_password,
                cheque
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                      ?, ?,
                      ?, ?, ?,
                      ?, ?, ?, ?, ?, ?, ?,
                      ?, ?, ?, ?,
                      ?, ?,
                      ?,
                      ?, ?,
                      ?)`,
            [
                operator_id,
                created_by_admin_id,
                centre_id,
                dairy_id,
                seller_code || null,
                name,
                mobile,
                aadhaar || null,
                pan_number || null,
                seller_id_code || null,
                seller_type || 'Utpadak',
                milk_type || 'both',
                jamin || null,
                bank_account || null,
                bank_name || null,
                account_holder_name || null,
                branch_name || null,
                ifsc_code || null,
                address || null,
                pincode || null,
                advance_enabled !== undefined ? advance_enabled : 1,
                advance_deduction || null,
                product_sale_enabled !== undefined ? product_sale_enabled : 0,
                product_sale_rate || null,
                deposit_enabled !== undefined ? deposit_enabled : 0,
                deposit_per_litre || null,
                cattle_feed_sale_enabled !== undefined ? cattle_feed_sale_enabled : 0,
                password_hash,
                password_hash ? 0 : 1,
                cheque || null
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
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Seller with this code already exists in your centre' });
        }
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
            bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
            advance_enabled, advance_deduction, product_sale_enabled,
            deposit_enabled, deposit_per_litre, password, is_active,
            cattle_feed_sale_enabled,
            cheque
        } = req.body;

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

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

        // Check duplicate seller_code
        const cleanSellerCode = seller_code ? String(seller_code).trim() : null;
        if (cleanSellerCode) {
            const [duplicate] = await pool.query(
                `SELECT seller_id FROM sellers 
                 WHERE seller_code = ? AND centre_id = ?
                   AND seller_id != ?`,
                [cleanSellerCode, centreId, req.params.id]
            );
            if (duplicate.length > 0) {
                return res.status(409).json({
                    error: 'Another seller with this code already exists in your centre'
                });
            }
        }

        // Check duplicate bank account (max 2 allowed)
        if (bank_account) {
            const [bankAccounts] = await pool.query(
                `SELECT COUNT(*) as count FROM sellers 
                 WHERE bank_account = ? AND centre_id = ? AND seller_id != ?`,
                [bank_account, centreId, req.params.id]
            );
            if (bankAccounts[0].count >= 2) {
                return res.status(409).json({
                    error: 'Bank Account number already exists for 2 sellers (max 2 allowed)'
                });
            }
        }

        // Check duplicate PAN (max 2 allowed)
        if (pan_number) {
            const [panNumbers] = await pool.query(
                `SELECT COUNT(*) as count FROM sellers 
                 WHERE pan_number = ? AND centre_id = ? AND seller_id != ?`,
                [pan_number, centreId, req.params.id]
            );
            if (panNumbers[0].count >= 2) {
                return res.status(409).json({
                    error: 'PAN number already exists for 2 sellers (max 2 allowed)'
                });
            }
        }

        // Check duplicate Aadhaar (max 2 allowed)
        if (aadhaar) {
            const [aadhaars] = await pool.query(
                `SELECT COUNT(*) as count FROM sellers 
                 WHERE aadhaar = ? AND centre_id = ? AND seller_id != ?`,
                [aadhaar, centreId, req.params.id]
            );
            if (aadhaars[0].count >= 2) {
                return res.status(409).json({
                    error: 'Aadhaar number already exists for 2 sellers (max 2 allowed)'
                });
            }
        }

        const password_hash = password ? await bcrypt.hash(password, 10) : null;

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
                account_holder_name  = ?,
                branch_name          = ?,
                ifsc_code            = ?,
                address              = ?,
                pincode              = ?,
                advance_enabled      = ?,
                advance_deduction    = ?,
                product_sale_enabled = ?,
                deposit_enabled      = ?,
                deposit_per_litre    = ?,
                cattle_feed_sale_enabled = ?,
                is_active            = ?,
                password_hash        = COALESCE(?, password_hash),
                must_change_password = CASE WHEN ? IS NOT NULL THEN 0 ELSE must_change_password END,
                cheque               = ?
            WHERE seller_id = ? AND centre_id = ?`,
            [
                cleanSellerCode || null,
                name || null,
                mobile || null,
                aadhaar || null,
                pan_number || null,
                seller_id_code || null,
                seller_type || 'Utpadak',
                milk_type || 'both',
                jamin || null,
                bank_account || null,
                bank_name || null,
                account_holder_name || null,
                branch_name || null,
                ifsc_code || null,
                address || null,
                pincode || null,
                advance_enabled !== undefined ? advance_enabled : 1,
                advance_deduction || null,
                product_sale_enabled !== undefined ? product_sale_enabled : 0,
                deposit_enabled !== undefined ? deposit_enabled : 0,
                deposit_per_litre || null,
                cattle_feed_sale_enabled !== undefined ? cattle_feed_sale_enabled : 0,
                is_active !== undefined ? is_active : 1,
                password_hash,
                password_hash,
                cheque || null,
                req.params.id,
                centreId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Seller not found or unauthorized' });
        }

        const [rows] = await pool.query(
            `SELECT
                seller_id, seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code,
                address, pincode, advance_enabled, advance_deduction,
                product_sale_enabled,
                deposit_enabled, deposit_per_litre,
                cattle_feed_sale_enabled,
                is_active, created_at, operator_id,
                cheque,
                (password_hash IS NOT NULL AND password_hash <> '') AS has_password
             FROM sellers
             WHERE seller_id = ? AND centre_id = ?`,
            [req.params.id, centreId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error('updateSeller error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Another seller with this code already exists in your centre' });
        }
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

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];

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
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code,
                address, pincode, advance_enabled, advance_deduction, product_sale_enabled,
                cattle_feed_sale_enabled,
                deposit_enabled, deposit_per_litre,
                operator_id,
                cheque,
                (password_hash IS NOT NULL AND password_hash <> '') AS has_password
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

// ── POST /api/sellers/import ──────────────────────────────
exports.importSellers = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { sellers } = req.body;
        if (!sellers || !Array.isArray(sellers) || sellers.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'No seller data provided.' });
        }

        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operator_id = isAdmin ? null : req.user.id;
        const created_by_admin_id = isAdmin ? req.user.id : null;

        const [[centreRow]] = await conn.query(
            `SELECT dairy_id FROM centres WHERE centre_id = ?`,
            [centreId]
        );
        if (!centreRow) {
            await conn.rollback();
            return res.status(400).json({ error: 'Invalid centre.' });
        }
        const dairy_id = centreRow.dairy_id;

        const results = {
            added: 0,
            skipped: 0,
            errors: []
        };

        for (let i = 0; i < sellers.length; i++) {
            const row = sellers[i];
            const {
                seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
                advance_enabled, advance_deduction, product_sale_enabled,
                deposit_enabled, deposit_per_litre, password,
                cattle_feed_sale_enabled,
                cheque
            } = row;

            const mobileClean = mobile ? String(mobile).replace(/[^\d]/g, "") : "";

            let finalSellerCode = seller_code ? String(seller_code).trim() : '';
            if (finalSellerCode && /^0+[0-9]+$/.test(finalSellerCode)) {
                finalSellerCode = finalSellerCode.replace(/^0+/, '');
            }

            if (!finalSellerCode) {
                const [codes] = await conn.query(
                    `SELECT seller_code FROM sellers WHERE centre_id = ? AND seller_code REGEXP '^[0-9]+$'`,
                    [centreId]
                );
                const numCodes = codes.map(c => parseInt(c.seller_code, 10)).filter(n => !isNaN(n));
                const next = numCodes.length > 0 ? Math.max(...numCodes) + 1 : 1;
                finalSellerCode = String(next);

                const [codeCheck] = await conn.query(
                    `SELECT seller_id FROM sellers WHERE seller_code = ? AND centre_id = ?`,
                    [finalSellerCode, centreId]
                );
                if (codeCheck.length > 0) {
                    let counter = parseInt(finalSellerCode, 10);
                    let found = false;
                    while (!found) {
                        counter++;
                        const testCode = String(counter);
                        const [check] = await conn.query(
                            `SELECT seller_id FROM sellers WHERE seller_code = ? AND centre_id = ?`,
                            [testCode, centreId]
                        );
                        if (check.length === 0) {
                            finalSellerCode = testCode;
                            found = true;
                        }
                    }
                }
            }

            const password_hash = password ? await bcrypt.hash(password, 10) : null;

            try {
                await conn.query(
                    `INSERT INTO sellers (
                        operator_id, created_by_admin_id, centre_id, dairy_id, seller_code, name, mobile, aadhaar,
                        pan_number, seller_id_code,
                        seller_type, milk_type, jamin,
                        bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
                        advance_enabled, advance_deduction, product_sale_enabled,
                        deposit_enabled, deposit_per_litre,
                        cattle_feed_sale_enabled,
                        password_hash, must_change_password,
                        cheque
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                              ?, ?,
                              ?, ?, ?,
                              ?, ?, ?, ?, ?, ?, ?,
                              ?, ?, ?,
                              ?, ?,
                              ?,
                              ?, ?,
                              ?)`,
                    [
                        operator_id,
                        created_by_admin_id,
                        centreId,
                        dairy_id,
                        finalSellerCode,
                        name,
                        mobileClean,
                        aadhaar || null,
                        pan_number || null,
                        seller_id_code || null,
                        seller_type || 'Utpadak',
                        milk_type || 'both',
                        jamin || null,
                        bank_account || null,
                        bank_name || null,
                        account_holder_name || null,
                        branch_name || null,
                        ifsc_code || null,
                        address || null,
                        pincode || null,
                        advance_enabled !== undefined ? advance_enabled : 1,
                        advance_deduction || null,
                        product_sale_enabled !== undefined ? product_sale_enabled : 0,
                        deposit_enabled !== undefined ? deposit_enabled : 0,
                        deposit_per_litre || null,
                        cattle_feed_sale_enabled !== undefined ? cattle_feed_sale_enabled : 0,
                        password_hash,
                        password_hash ? 0 : 1,
                        cheque || null
                    ]
                );
                results.added++;
            } catch (err) {
                results.skipped++;
                results.errors.push({ row: i + 1, error: err.message });
            }
        }

        await conn.commit();
        res.status(201).json({
            message: `Added ${results.added} sellers, skipped ${results.skipped}.`,
            ...results
        });
    } catch (err) {
        await conn.rollback();
        console.error('importSellers error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── POST /api/sellers/bulk-update ─────────────────────────
exports.updateSellersBulk = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { sellers, deleteMissing } = req.body;
        if (!sellers || !Array.isArray(sellers) || sellers.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: 'No seller data provided.' });
        }

        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operator_id = isAdmin ? null : req.user.id;
        const created_by_admin_id = isAdmin ? req.user.id : null;

        const [[centreRow]] = await conn.query(
            `SELECT dairy_id FROM centres WHERE centre_id = ?`,
            [centreId]
        );
        if (!centreRow) {
            await conn.rollback();
            return res.status(400).json({ error: 'Invalid centre.' });
        }
        const dairy_id = centreRow.dairy_id;

        const results = { updated: 0, inserted: 0, deleted: 0, skipped: 0, errors: [] };

        if (deleteMissing) {
            const incomingCodes = new Set(
                sellers
                    .map(r => (r.seller_code || '').toString().trim())
                    .filter(c => c !== '')
            );

            const [allCentreSellers] = await conn.query(
                `SELECT seller_id, seller_code FROM sellers WHERE centre_id = ?`,
                [centreId]
            );

            const toDelete = allCentreSellers.filter(
                s => !incomingCodes.has(String(s.seller_code || '').trim())
            );

            for (const s of toDelete) {
                try {
                    await conn.query(`DELETE FROM bonus_payments WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM gavali_bonus_payments WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM product_sales WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM cash_advance WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM seller_deposits WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM premium_rates WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM milk_entries WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    await conn.query(`DELETE FROM sellers WHERE seller_id = ? AND centre_id = ?`, [s.seller_id, centreId]);
                    results.deleted++;
                } catch (err) {
                    results.errors.push({ row: null, error: `Failed to delete seller code "${s.seller_code}": ${err.message}` });
                }
            }
        }

        for (let i = 0; i < sellers.length; i++) {
            const row = sellers[i];
            const {
                seller_code, name, mobile, aadhaar,
                pan_number, seller_id_code,
                seller_type, milk_type, jamin,
                bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
                advance_enabled, advance_deduction, product_sale_enabled,
                deposit_enabled, deposit_per_litre, password,
                cattle_feed_sale_enabled,
                cheque
            } = row;

            if (!seller_code) {
                results.skipped++;
                results.errors.push({ row: i + 1, error: 'Seller Code is required to match an existing seller.' });
                continue;
            }

            const mobileClean = mobile ? String(mobile).replace(/[^\d]/g, "") : "";

            const [[existing]] = await conn.query(
                `SELECT seller_id FROM sellers WHERE seller_code = ? AND centre_id = ?`,
                [seller_code, centreId]
            );

            const password_hash = password ? await bcrypt.hash(password, 10) : null;

            if (existing) {
                const sellerId = existing.seller_id;
                try {
                    await conn.query(
                        `UPDATE sellers SET
                            name = ?, mobile = ?, aadhaar = ?, pan_number = ?, seller_id_code = ?,
                            seller_type = ?, milk_type = ?, jamin = ?,
                            bank_account = ?, bank_name = ?, account_holder_name = ?, branch_name = ?, ifsc_code = ?,
                            address = ?, pincode = ?,
                            advance_enabled = ?, advance_deduction = ?, product_sale_enabled = ?,
                            deposit_enabled = ?, deposit_per_litre = ?, cattle_feed_sale_enabled = ?,
                            password_hash = COALESCE(?, password_hash),
                            must_change_password = CASE WHEN ? IS NOT NULL THEN 0 ELSE must_change_password END,
                            cheque = ?
                        WHERE seller_id = ? AND centre_id = ?`,
                        [
                            name, mobileClean, aadhaar || null, pan_number || null, seller_id_code || null,
                            seller_type || 'Utpadak', milk_type || 'both', jamin || null,
                            bank_account || null, bank_name || null, account_holder_name || null, branch_name || null, ifsc_code || null,
                            address || null, pincode || null,
                            advance_enabled !== undefined ? advance_enabled : 1,
                            advance_deduction || null,
                            product_sale_enabled !== undefined ? product_sale_enabled : 0,
                            deposit_enabled !== undefined ? deposit_enabled : 0,
                            deposit_per_litre || null,
                            cattle_feed_sale_enabled !== undefined ? cattle_feed_sale_enabled : 0,
                            password_hash,
                            password_hash,
                            cheque || null,
                            sellerId, centreId
                        ]
                    );
                    results.updated++;
                } catch (err) {
                    results.skipped++;
                    results.errors.push({ row: i + 1, error: err.message });
                }
            } else {
                try {
                    await conn.query(
                        `INSERT INTO sellers (
                            operator_id, created_by_admin_id, centre_id, dairy_id, seller_code, name, mobile, aadhaar,
                            pan_number, seller_id_code,
                            seller_type, milk_type, jamin,
                            bank_account, bank_name, account_holder_name, branch_name, ifsc_code, address, pincode,
                            advance_enabled, advance_deduction, product_sale_enabled,
                            deposit_enabled, deposit_per_litre,
                            cattle_feed_sale_enabled,
                            password_hash, must_change_password,
                            cheque
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                                  ?, ?,
                                  ?, ?, ?,
                                  ?, ?, ?, ?, ?, ?, ?,
                                  ?, ?, ?,
                                  ?, ?,
                                  ?,
                                  ?, ?,
                                  ?)`,
                        [
                            operator_id,
                            created_by_admin_id,
                            centreId,
                            dairy_id,
                            seller_code,
                            name,
                            mobileClean,
                            aadhaar || null,
                            pan_number || null,
                            seller_id_code || null,
                            seller_type || 'Utpadak',
                            milk_type || 'both',
                            jamin || null,
                            bank_account || null,
                            bank_name || null,
                            account_holder_name || null,
                            branch_name || null,
                            ifsc_code || null,
                            address || null,
                            pincode || null,
                            advance_enabled !== undefined ? advance_enabled : 1,
                            advance_deduction || null,
                            product_sale_enabled !== undefined ? product_sale_enabled : 0,
                            deposit_enabled !== undefined ? deposit_enabled : 0,
                            deposit_per_litre || null,
                            cattle_feed_sale_enabled !== undefined ? cattle_feed_sale_enabled : 0,
                            password_hash,
                            password_hash ? 0 : 1,
                            cheque || null
                        ]
                    );
                    results.inserted++;
                } catch (err) {
                    results.skipped++;
                    results.errors.push({ row: i + 1, error: err.message });
                }
            }
        }

        await conn.commit();
        res.status(200).json({
            message: `Updated ${results.updated} sellers, added ${results.inserted} new, deleted ${results.deleted} missing, skipped ${results.skipped}.`,
            ...results
        });
    } catch (err) {
        await conn.rollback();
        console.error('updateSellersBulk error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/sellers/:id/commission ──────────────────────
exports.getSellerCommission = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        const accessQuery = `SELECT seller_id, seller_type, milk_type FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];
        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [settings] = await pool.query(
            `SELECT id, milk_type, base_fat, base_snf, base_commission,
                    fat_step_cut, snf_step_cut, is_active, updated_at
             FROM commission_settings
             WHERE centre_id = ?
             ORDER BY milk_type ASC`,
            [centreId]
        );

        const [[totals]] = await pool.query(
            `SELECT COALESCE(SUM(bme.commission_amount), 0) AS total_commission_earned
             FROM bill_milk_entries bme
             JOIN bill_master bm ON bm.bill_id = bme.bill_id
             WHERE bm.seller_id = ? AND bm.centre_id = ?`,
            [id, centreId]
        );

        res.json({
            seller_type: accessCheck[0].seller_type,
            milk_type: accessCheck[0].milk_type,
            settings,
            total_commission_earned: totals.total_commission_earned,
        });
    } catch (err) {
        console.error('getSellerCommission error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/bills ────────────────────────────
exports.getSellerBills = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];
        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT bill_id, bill_no, from_date, to_date, milk_amount, advance_balance,
                    installment_cut, deposit_amount, product_deduction, walkin_deduction,
                    cattle_feed_deduction, commission_amount, tds_amount, final_payable,
                    cash_paid, total_qty, total_entries, paid_at
             FROM bill_master
             WHERE seller_id = ? AND centre_id = ?
             ORDER BY paid_at DESC`,
            [id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerBills error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/bonus ────────────────────────────
exports.getSellerBonus = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];
        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [bonusRows] = await pool.query(
            `SELECT bp.payment_id, be.event_name, be.occasion, bp.total_qty,
                    bp.total_bonus, bp.is_paid, bp.paid_at, bp.remarks, bp.created_at
             FROM bonus_payments bp
             JOIN bonus_events be ON be.event_id = bp.event_id
             WHERE bp.seller_id = ? AND bp.centre_id = ?
             ORDER BY bp.created_at DESC`,
            [id, centreId]
        );

        const [gavaliRows] = await pool.query(
            `SELECT gbp.payment_id, gbe.event_name, gbe.occasion, gbp.cow_qty, gbp.buffalo_qty,
                    gbp.total_qty, gbp.total_bonus, gbp.is_paid, gbp.paid_at, gbp.remarks, gbp.created_at
             FROM gavali_bonus_payments gbp
             JOIN gavali_bonus_events gbe ON gbe.event_id = gbp.event_id
             WHERE gbp.seller_id = ? AND gbp.centre_id = ?
             ORDER BY gbp.created_at DESC`,
            [id, centreId]
        );

        res.json({ bonus: bonusRows, gavaliBonus: gavaliRows });
    } catch (err) {
        console.error('getSellerBonus error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/sellers/:id/cattle-feed ──────────────────────
exports.getSellerCattleFeed = async (req, res) => {
    try {
        const id = req.params.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.id;

        const accessQuery = `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`;
        const accessParams = [id, centreId];
        const [accessCheck] = await pool.query(accessQuery, accessParams);
        if (!accessCheck.length) {
            return res.status(403).json({ error: 'Access denied. Seller not found or unauthorized.' });
        }

        const [rows] = await pool.query(
            `SELECT cfs.sale_id, cfs.sale_date, cfs.quantity, cfs.rate, cfs.total_amount,
                    cf.feed_name, cf.unit
             FROM cattle_feed_sales cfs
             JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
             WHERE cfs.seller_id = ? AND cfs.centre_id = ?
             ORDER BY cfs.sale_date DESC`,
            [id, centreId]
        );
        res.json(rows);
    } catch (err) {
        console.error('getSellerCattleFeed error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};