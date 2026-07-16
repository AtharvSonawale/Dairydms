const pool = require('../config/db');

// ── GET /api/farmer/dashboard ─────────────────────────────
// Farmer/seller viewing their OWN data only.
// req.user.id is assumed to be the seller_id for a 'seller' role login.
exports.getFarmerDashboard = async (req, res) => {
    try {
        if (req.user.role !== 'seller') {
            return res.status(403).json({ error: 'Access denied. Farmer login required.' });
        }

        const sellerId = req.user.id;
        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({ message: 'from and to are required' });
        }

        const [milk_entries] = await pool.query(
            `SELECT entry_id, entry_date, shift, milk_type,
                    quantity, fat, snf, water,
                    rate_applied, is_premium, total_amount, entry_time
             FROM milk_entries
             WHERE seller_id = ? AND centre_id = ? AND entry_date BETWEEN ? AND ?
             ORDER BY entry_date DESC, shift DESC`,
            [sellerId, centreId, from, to]
        );

        const [bills] = await pool.query(
            `SELECT bill_id, bill_no, from_date, to_date,
            total_qty, total_entries, final_payable
     FROM bill_master
     WHERE seller_id = ? AND centre_id = ? AND from_date <= ? AND to_date >= ?
     ORDER BY to_date DESC`,
            [sellerId, centreId, to, from]
        );

        const [advances] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ? AND transaction_date BETWEEN ? AND ?
             ORDER BY transaction_date DESC`,
            [sellerId, centreId, from, to]
        );

        const [deposits] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks
             FROM seller_deposits
             WHERE seller_id = ? AND centre_id = ? AND transaction_date BETWEEN ? AND ?
             ORDER BY transaction_date DESC`,
            [sellerId, centreId, from, to]
        );

        // Seller's own profile (personal + bank details, same fields as SellerProfile)
        const [[profile]] = await pool.query(
            `SELECT seller_id, seller_code, name, mobile, aadhaar,
                    pan_number, seller_id_code, seller_type, milk_type, jamin,
                    bank_account, bank_name, ifsc_code, address,
                    advance_enabled, advance_deduction,
                    deposit_enabled, deposit_per_litre,
                    product_sale_enabled, is_active, created_at
             FROM sellers
             WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        // Premium rates assigned to this seller (all-time, not date-scoped)
        const [premium_rates] = await pool.query(
            `SELECT id, milk_type, rate_per_liter, reason,
                    effective_from, effective_to, is_active, created_at
             FROM premium_rates
             WHERE seller_id = ? AND centre_id = ?
             ORDER BY created_at DESC`,
            [sellerId, centreId]
        );

        // Product purchases within the selected date range
        const [product_sales] = await pool.query(
            `SELECT ps.sale_id, ps.sale_date, ps.quantity, ps.rate, ps.total_amount,
                    p.product_name, p.unit
             FROM product_sales ps
             JOIN products p ON p.product_id = ps.product_id
             WHERE ps.seller_id = ? AND ps.centre_id = ? AND ps.sale_date BETWEEN ? AND ?
             ORDER BY ps.sale_date DESC`,
            [sellerId, centreId, from, to]
        );

        // Balances are ALL-TIME, not scoped to the date range
        const [[advanceBal]] = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE -amount END),0) AS advance_balance
             FROM cash_advance WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        const [[depositBal]] = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0) AS deposit_balance
             FROM seller_deposits WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        res.json({
            profile,
            milk_entries,
            bills,
            advances,
            deposits,
            premium_rates,
            product_sales,
            balances: {
                advance_balance: advanceBal.advance_balance,
                deposit_balance: depositBal.deposit_balance,
            },
        });
    } catch (err) {
        console.error('getFarmerDashboard error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/farmer/bill/:bill_no ─────────────────────────
// Full metadata for one of the farmer's own bills. Scoped by seller_id
// so a farmer can never view another seller's bill even by guessing bill_no.
exports.getFarmerBillDetail = async (req, res) => {
    try {
        if (req.user.role !== 'seller') {
            return res.status(403).json({ error: 'Access denied. Farmer login required.' });
        }

        const sellerId = req.user.id;
        const centreId = req.user.centre_id;
        const { bill_no } = req.params;

        const [[payment]] = await pool.query(
            `SELECT sp.id, sp.seller_id, sp.from_date, sp.to_date,
                    sp.milk_amount, sp.advance_given, sp.installment_cut, sp.deposit_amount,
                    sp.product_deduction, sp.walkin_deduction,
                    sp.final_payable, sp.cash_paid, sp.bill_no, sp.paid_at,
                    s.name, s.seller_code, s.deposit_per_litre
             FROM seller_payments sp
             JOIN sellers s ON s.seller_id = sp.seller_id
             WHERE sp.bill_no = ? AND sp.centre_id = ? AND sp.seller_id = ?`,
            [bill_no, centreId, sellerId]
        );

        if (!payment) {
            return res.status(404).json({ message: 'Bill not found or unauthorized.' });
        }

        const [entries] = await pool.query(
            `SELECT entry_id, entry_date, shift, milk_type,
                    quantity, fat, snf, water, rate_applied, total_amount
             FROM milk_entries
             WHERE seller_id = ? AND centre_id = ? AND entry_date BETWEEN ? AND ?
             ORDER BY entry_date ASC, shift ASC`,
            [sellerId, centreId, payment.from_date, payment.to_date]
        );

        const [advances] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ? AND transaction_date BETWEEN ? AND ?
             ORDER BY transaction_date ASC`,
            [sellerId, centreId, payment.from_date, payment.to_date]
        );

        const [productSales] = await pool.query(
            `SELECT ps.sale_id, ps.sale_date, ps.quantity, ps.rate, ps.total_amount,
                    p.product_name, p.unit
             FROM product_sales ps
             JOIN products p ON p.product_id = ps.product_id
             WHERE ps.seller_id = ? AND ps.centre_id = ? AND ps.sale_date BETWEEN ? AND ?
             ORDER BY ps.sale_date ASC`,
            [sellerId, centreId, payment.from_date, payment.to_date]
        );

        res.json({ payment, entries, advances, productSales });
    } catch (err) {
        console.error('getFarmerBillDetail error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/farmer/milk-entries ──────────────────────────
// All of the farmer's own milk entries (all-time). Optional ?month=YYYY-MM
// or ?from=&to= filtering, same convention as getSellerEntries.
exports.getFarmerMilkEntries = async (req, res) => {
    try {
        if (req.user.role !== 'seller') {
            return res.status(403).json({ error: 'Access denied. Farmer login required.' });
        }

        const sellerId = req.user.id;
        const centreId = req.user.centre_id;
        const { month, from, to } = req.query;

        let dateFilter = '';
        const params = [sellerId, centreId];

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
                    rate_applied, is_premium, total_amount, entry_time
             FROM milk_entries
             WHERE seller_id = ? AND centre_id = ? ${dateFilter}
             ORDER BY entry_date DESC, shift DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('getFarmerMilkEntries error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/farmer/bills ─────────────────────────────────
// All of the farmer's own bills (all-time). Optional ?from=&to= filtering
// on the bill's cycle dates, same convention as getFarmerMilkEntries.
exports.getFarmerBills = async (req, res) => {
    try {
        if (req.user.role !== 'seller') {
            return res.status(403).json({ error: 'Access denied. Farmer login required.' });
        }

        const sellerId = req.user.id;
        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [sellerId, centreId];

        if (from && to) {
            dateFilter = `AND from_date <= ? AND to_date >= ?`;
            params.push(to, from);
        }

        const [rows] = await pool.query(
            `SELECT bill_id, bill_no, from_date, to_date,
                    milk_amount, advance_balance, installment_cut, deposit_amount,
                    product_deduction, walkin_deduction, tds_amount,
                    final_payable, cash_paid, total_qty, total_entries, paid_at
             FROM bill_master
             WHERE seller_id = ? AND centre_id = ? ${dateFilter}
             ORDER BY to_date DESC`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('getFarmerBills error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── GET /api/farmer/finance ───────────────────────────────
// All of the farmer's own cash-advance + deposit transactions (all-time).
// Optional ?from=&to= filtering on transaction_date, same convention as
// getFarmerMilkEntries / getFarmerBills. Balances are ALL-TIME regardless
// of from/to, same convention as getFarmerDashboard.
exports.getFarmerFinance = async (req, res) => {
    try {
        if (req.user.role !== 'seller') {
            return res.status(403).json({ error: 'Access denied. Farmer login required.' });
        }

        const sellerId = req.user.id;
        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        let dateFilter = '';
        const params = [sellerId, centreId];

        if (from && to) {
            dateFilter = `AND transaction_date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        const [advances] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks, created_at
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ? ${dateFilter}
             ORDER BY transaction_date DESC, created_at DESC`,
            params
        );

        const [deposits] = await pool.query(
            `SELECT id, type, amount, transaction_date, remarks, created_at
             FROM seller_deposits
             WHERE seller_id = ? AND centre_id = ? ${dateFilter}
             ORDER BY transaction_date DESC, created_at DESC`,
            params
        );

        // Balances are ALL-TIME, not scoped to from/to (mirrors getFarmerDashboard)
        const [[advanceBal]] = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE -amount END),0) AS advance_balance
             FROM cash_advance WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        const [[depositBal]] = await pool.query(
            `SELECT COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE -amount END),0) AS deposit_balance
             FROM seller_deposits WHERE seller_id = ? AND centre_id = ?`,
            [sellerId, centreId]
        );

        res.json({
            advances,
            deposits,
            balances: {
                advance_balance: advanceBal.advance_balance,
                deposit_balance: depositBal.deposit_balance,
            },
        });
    } catch (err) {
        console.error('getFarmerFinance error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};