const pool = require('../config/db');
const ExcelJS = require('exceljs');

// ── Helpers ────────────────────────────────────────────────────
const generateBillNo = (supplierName, fromDate, toDate, centreId) => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const month = String(from.getMonth() + 1).padStart(2, '0');
    const year = String(from.getFullYear()).slice(-2);
    const day = String(to.getDate()).padStart(2, '0');
    const suffix = String(centreId).padStart(3, '0');
    const namePrefix = supplierName.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, '');
    return `CF${year}${month}${day}${namePrefix}${suffix}`;
};

// ── GET /api/cattle-feed-payments/summary ──────────────────
exports.getSummary = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ message: "from and to dates are required." });
        }

        const centreId = req.user.centre_id;

        const [purchases] = await pool.query(
            `SELECT 
                fp.purchase_id,
                fp.feed_id,
                fp.supplier_name,
                fp.quantity,
                fp.rate,
                fp.mrp_rate,
                fp.total_amount,
                fp.purchase_date,
                fp.bill_no,
                fp.paid_at,
                f.feed_name,
                f.unit
             FROM cattle_feed_purchases fp
             JOIN cattle_feeds f ON f.feed_id = fp.feed_id
             WHERE fp.centre_id = ? AND fp.purchase_date BETWEEN ? AND ?
             ORDER BY fp.supplier_name, fp.purchase_date`,
            [centreId, from, to]
        );

        const supplierMap = new Map();
        purchases.forEach(p => {
            const key = p.supplier_name;
            if (!supplierMap.has(key)) {
                supplierMap.set(key, {
                    supplier_name: key,
                    total_amount: 0,
                    entries: [],
                    is_paid: false,
                    bill_no: null,
                    paid_at: null,
                });
            }
            const group = supplierMap.get(key);
            group.total_amount += parseFloat(p.total_amount || 0);
            group.entries.push(p);
            if (p.bill_no) {
                group.is_paid = true;
                group.bill_no = p.bill_no;
                group.paid_at = p.paid_at;
            }
        });

        // Normalize: mark as paid only if all purchases have the same bill_no
        const result = Array.from(supplierMap.values()).map(group => {
            const allPaid = group.entries.every(e => e.bill_no);
            if (allPaid) {
                group.is_paid = true;
                group.bill_no = group.entries[0].bill_no;
                group.paid_at = group.entries[0].paid_at;
            } else {
                group.is_paid = false;
                group.bill_no = null;
                group.paid_at = null;
            }
            return group;
        });

        res.json(result);
    } catch (err) {
        console.error('getCattleFeedPaymentSummary error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ── POST /api/cattle-feed-payments/mark-paid ──────────────
exports.markPaid = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // admin: operator_id = null ; operator: use their id
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const { supplier_name, from_date, to_date, bill_no: providedBillNo } = req.body;

        if (!supplier_name || !from_date || !to_date) {
            await conn.rollback();
            return res.status(400).json({ error: "supplier_name, from_date, and to_date are required." });
        }

        // Check if any purchases already have a bill_no
        const [existing] = await conn.query(
            `SELECT purchase_id, bill_no FROM cattle_feed_purchases
             WHERE supplier_name = ? AND centre_id = ? AND purchase_date BETWEEN ? AND ?
               AND bill_no IS NOT NULL`,
            [supplier_name, centreId, from_date, to_date]
        );
        if (existing.length > 0) {
            const bills = existing.map(e => e.bill_no);
            const unique = [...new Set(bills)];
            if (unique.length > 1) {
                await conn.rollback();
                return res.status(400).json({ error: "Cannot mark paid: purchases already have different bill numbers." });
            }
            await conn.rollback();
            return res.status(400).json({ error: "Purchases already have a bill number." });
        }

        // Fetch unpaid purchases
        const [unpaid] = await conn.query(
            `SELECT purchase_id, total_amount
             FROM cattle_feed_purchases
             WHERE supplier_name = ? AND centre_id = ? AND purchase_date BETWEEN ? AND ?
               AND bill_no IS NULL`,
            [supplier_name, centreId, from_date, to_date]
        );
        if (unpaid.length === 0) {
            const [count] = await conn.query(
                `SELECT COUNT(*) AS cnt FROM cattle_feed_purchases
                 WHERE supplier_name = ? AND centre_id = ? AND purchase_date BETWEEN ? AND ?`,
                [supplier_name, centreId, from_date, to_date]
            );
            if (count[0].cnt === 0) {
                await conn.rollback();
                return res.status(404).json({ error: "No purchases found for this supplier in the given date range." });
            }
            const [existingBill] = await conn.query(
                `SELECT DISTINCT bill_no FROM cattle_feed_purchases
                 WHERE supplier_name = ? AND centre_id = ? AND purchase_date BETWEEN ? AND ?
                   AND bill_no IS NOT NULL`,
                [supplier_name, centreId, from_date, to_date]
            );
            if (existingBill.length > 0) {
                await conn.commit();
                return res.json({
                    message: "All purchases already paid.",
                    bill_no: existingBill[0].bill_no,
                    already_paid: true
                });
            } else {
                await conn.rollback();
                return res.status(400).json({ error: "No purchases to pay." });
            }
        }

        const totalAmount = unpaid.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
        const bill_no = providedBillNo || generateBillNo(supplier_name, from_date, to_date, centreId);

        // Insert bill
        const [billResult] = await conn.query(
            `INSERT INTO cattle_feed_purchase_bills
                (bill_no, centre_id, supplier_name, from_date, to_date, total_amount, paid_at, operator_id)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
            [bill_no, centreId, supplier_name, from_date, to_date, totalAmount, operatorId]
        );
        const billId = billResult.insertId;

        // Update purchases
        const purchaseIds = unpaid.map(p => p.purchase_id);
        await conn.query(
            `UPDATE cattle_feed_purchases
             SET bill_no = ?, paid_at = NOW(), bill_id = ?
             WHERE purchase_id IN (?)`,
            [bill_no, billId, purchaseIds]
        );

        // Insert bill items
        for (const p of unpaid) {
            await conn.query(
                `INSERT INTO cattle_feed_purchase_bill_items (bill_id, purchase_id, amount)
                 VALUES (?, ?, ?)`,
                [billId, p.purchase_id, p.total_amount]
            );
        }

        await conn.commit();
        res.json({
            message: "Payment marked as paid.",
            bill_no,
            total_amount: totalAmount,
            purchases_count: unpaid.length,
        });

    } catch (err) {
        await conn.rollback();
        console.error('markCattleFeedPaid error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};

// ── GET /api/cattle-feed-payments/bill/:bill_no ────────────
exports.getBill = async (req, res) => {
    try {
        const { bill_no } = req.params;
        const centreId = req.user.centre_id;

        const [[bill]] = await pool.query(
            `SELECT * FROM cattle_feed_purchase_bills
             WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centreId]
        );
        if (!bill) {
            return res.status(404).json({ message: "Bill not found." });
        }

        const [items] = await pool.query(
            `SELECT fp.*, f.feed_name, f.unit
             FROM cattle_feed_purchases fp
             JOIN cattle_feeds f ON f.feed_id = fp.feed_id
             WHERE fp.bill_no = ? AND fp.centre_id = ?`,
            [bill_no, centreId]
        );

        res.json({ bill, items });
    } catch (err) {
        console.error('getCattleFeedBill error:', err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ── DELETE /api/cattle-feed-payments/bill/:bill_no ─────────
exports.deleteBill = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { bill_no } = req.params;
        const centreId = req.user.centre_id;

        const [[bill]] = await conn.query(
            `SELECT bill_id FROM cattle_feed_purchase_bills
             WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centreId]
        );
        if (!bill) {
            await conn.rollback();
            return res.status(404).json({ error: "Bill not found." });
        }

        // Remove bill_no and paid_at from purchases
        await conn.query(
            `UPDATE cattle_feed_purchases
             SET bill_no = NULL, paid_at = NULL, bill_id = NULL
             WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centreId]
        );

        // Delete bill (cascade deletes bill items)
        await conn.query(
            `DELETE FROM cattle_feed_purchase_bills
             WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centreId]
        );

        await conn.commit();
        res.json({ success: true, message: `Bill ${bill_no} deleted.` });

    } catch (err) {
        await conn.rollback();
        console.error('deleteCattleFeedBill error:', err);
        res.status(500).json({ error: "Failed to delete bill." });
    } finally {
        conn.release();
    }
};

// ── GET /api/cattle-feed-payments/bills/search ──────────────
exports.searchBills = async (req, res) => {
    try {
        const { q } = req.query;
        const centreId = req.user.centre_id;

        let where = "WHERE centre_id = ?";
        const params = [centreId];
        if (q) {
            where += " AND (bill_no LIKE ? OR supplier_name LIKE ?)";
            params.push(`%${q}%`, `%${q}%`);
        }

        const [rows] = await pool.query(
            `SELECT bill_id, bill_no, supplier_name, from_date, to_date, total_amount, paid_at
             FROM cattle_feed_purchase_bills
             ${where}
             ORDER BY paid_at DESC
             LIMIT 200`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error('searchBills error:', err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ── GET /api/cattle-feed-payments/cycle-config ─────────────
exports.getCycleConfig = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const [[row]] = await pool.query(
            `SELECT seed_from, days_per_cycle FROM cattle_feed_purchase_cycle_config WHERE centre_id = ?`,
            [centreId]
        );
        if (!row) return res.json(null);
        res.json({ seed_from: row.seed_from, days_per_cycle: row.days_per_cycle });
    } catch (err) {
        console.error('getCattleFeedCycleConfig error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── POST /api/cattle-feed-payments/cycle-config ────────────
exports.saveCycleConfig = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const { seed_from, days_per_cycle } = req.body;

        if (!seed_from || !days_per_cycle) {
            return res.status(400).json({ error: "seed_from and days_per_cycle are required." });
        }

        await pool.query(
            `INSERT INTO cattle_feed_purchase_cycle_config (operator_id, centre_id, seed_from, days_per_cycle)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE seed_from = VALUES(seed_from), days_per_cycle = VALUES(days_per_cycle)`,
            [operatorId, centreId, seed_from, days_per_cycle]
        );
        res.json({ success: true, seed_from, days_per_cycle });
    } catch (err) {
        console.error('saveCattleFeedCycleConfig error:', err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── GET /api/cattle-feed-payments/export-excel ─────────────
exports.exportExcel = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ message: "from and to dates are required." });
        }

        const centreId = req.user.centre_id;

        const [bills] = await pool.query(
            `SELECT bill_no, supplier_name, from_date, to_date, total_amount, paid_at
             FROM cattle_feed_purchase_bills
             WHERE centre_id = ? AND from_date = ? AND to_date = ?
             ORDER BY supplier_name ASC`,
            [centreId, from, to]
        );

        if (bills.length === 0) {
            return res.status(404).json({ message: "No paid bills found for this cycle." });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cattle Feed Payments');

        worksheet.columns = [
            { header: 'Bill No', key: 'bill_no', width: 15 },
            { header: 'Supplier', key: 'supplier', width: 25 },
            { header: 'Period', key: 'period', width: 20 },
            { header: 'Total Amount', key: 'amount', width: 15 },
            { header: 'Paid On', key: 'paid_on', width: 20 },
        ];

        bills.forEach(b => {
            worksheet.addRow({
                bill_no: b.bill_no,
                supplier: b.supplier_name,
                period: `${new Date(b.from_date).toLocaleDateString('en-IN')} – ${new Date(b.to_date).toLocaleDateString('en-IN')}`,
                amount: parseFloat(b.total_amount || 0),
                paid_on: new Date(b.paid_at).toLocaleString('en-IN'),
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="cattle_feed_payments_${from}_to_${to}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error('exportCattleFeedExcel error:', err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};