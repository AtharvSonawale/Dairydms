const pool = require('../config/db');

// ── Helper: Build filter conditions ──────────────────────────
const buildFilterConditions = (filters, centreId) => {
    const conditions = ['cfs.centre_id = ?'];
    const params = [centreId];

    if (filters.from && filters.to) {
        conditions.push('cfs.sale_date BETWEEN ? AND ?');
        params.push(filters.from, filters.to);
    }

    if (filters.seller_type && filters.seller_type !== 'all') {
        conditions.push('s.seller_type = ?');
        params.push(filters.seller_type);
    }

    if (filters.buyer_type && filters.buyer_type !== 'all') {
        conditions.push('cfs.buyer_type = ?');
        params.push(filters.buyer_type);
    }

    if (filters.feed_id && filters.feed_id !== 'all') {
        conditions.push('cfs.feed_id = ?');
        params.push(parseInt(filters.feed_id));
    }

    if (filters.seller_id && filters.seller_id !== 'all') {
        conditions.push('cfs.seller_id = ?');
        params.push(parseInt(filters.seller_id));
    }

    if (filters.operator_id && filters.operator_id !== 'all') {
        conditions.push('cfs.operator_id = ?');
        params.push(parseInt(filters.operator_id));
    }

    if (filters.min_amount && parseFloat(filters.min_amount) > 0) {
        conditions.push('cfs.total_amount >= ?');
        params.push(parseFloat(filters.min_amount));
    }

    if (filters.max_amount && parseFloat(filters.max_amount) > 0) {
        conditions.push('cfs.total_amount <= ?');
        params.push(parseFloat(filters.max_amount));
    }

    if (filters.supplier_name && filters.supplier_name.trim()) {
        conditions.push('cf.supplier_name LIKE ?');
        params.push(`%${filters.supplier_name.trim()}%`);
    }

    return { conditions, params };
};

// ══════════════════════════════════════════════════════════════
// GET /api/cattle-feed-sales/report
//   Query params: from, to, seller_type, buyer_type, feed_id,
//   seller_id, operator_id, min_amount, max_amount, supplier_name
// ══════════════════════════════════════════════════════════════
exports.getSalesReport = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const filters = req.query;

        const { conditions, params } = buildFilterConditions(filters, centreId);
        const whereClause = conditions.join(' AND ');

        // ── Main query: get all sales with joins ──
        const query = `
            SELECT
                cfs.*,
                cf.feed_name,
                cf.unit,
                cf.supplier_name,
                cf.mrp_rate AS feed_mrp,
                s.name AS seller_name,
                s.seller_code AS seller_code,
                s.seller_type AS seller_type,
                s.milk_type AS seller_milk_type,
                s.mobile AS seller_mobile,
                nb.name AS registered_buyer_name,
                nb.mobile AS buyer_mobile,
                o.name AS operator_name,
                o.email AS operator_email
            FROM cattle_feed_sales cfs
            JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
            LEFT JOIN sellers s ON s.seller_id = cfs.seller_id
            LEFT JOIN cattle_feed_named_buyers nb ON nb.buyer_id = cfs.buyer_id
            JOIN operators o ON o.operator_id = cfs.operator_id
            WHERE ${whereClause}
            ORDER BY cfs.sale_date DESC, cfs.created_at DESC
        `;

        const [rows] = await pool.query(query, params);

        // ── Group into transactions ──
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
                    seller_milk_type: row.seller_milk_type,
                    seller_mobile: row.seller_mobile,
                    buyer_id: row.buyer_id,
                    buyer_name: row.buyer_name,
                    buyer_type: row.buyer_type,
                    registered_buyer_name: row.registered_buyer_name,
                    buyer_mobile: row.buyer_mobile,
                    sale_date: row.sale_date,
                    created_at: row.created_at,
                    operator_id: row.operator_id,
                    operator_name: row.operator_name,
                    operator_email: row.operator_email,
                    items: [],
                    total_amount: 0,
                    total_qty: 0,
                });
            }
            const txn = txnMap.get(tid);
            txn.items.push({
                sale_id: row.sale_id,
                feed_id: row.feed_id,
                feed_name: row.feed_name,
                unit: row.unit,
                supplier_name: row.supplier_name,
                feed_mrp: row.feed_mrp,
                quantity: row.quantity,
                rate: row.rate,
                total_amount: row.total_amount,
            });
            txn.total_amount += parseFloat(row.total_amount || 0);
            txn.total_qty += parseFloat(row.quantity || 0);
        }

        // ── Build summary stats ──
        const transactions = [...txnMap.values()];
        const summary = {
            total_transactions: transactions.length,
            total_revenue: transactions.reduce((s, t) => s + t.total_amount, 0),
            total_qty: transactions.reduce((s, t) => s + t.total_qty, 0),
            total_items: rows.length,
            unique_sellers: new Set(transactions.map(t => t.seller_id).filter(Boolean)).size,
            unique_feeds: new Set(rows.map(r => r.feed_id)).size,
            unique_operators: new Set(transactions.map(t => t.operator_id)).size,
            seller_type_breakdown: {},
            buyer_type_breakdown: {},
            supplier_breakdown: {},
        };

        // Seller type breakdown
        transactions.forEach(t => {
            const type = t.seller_type || 'unknown';
            if (!summary.seller_type_breakdown[type]) {
                summary.seller_type_breakdown[type] = { count: 0, revenue: 0 };
            }
            summary.seller_type_breakdown[type].count += 1;
            summary.seller_type_breakdown[type].revenue += t.total_amount;
        });

        // Buyer type breakdown
        transactions.forEach(t => {
            const type = t.buyer_type || 'unknown';
            if (!summary.buyer_type_breakdown[type]) {
                summary.buyer_type_breakdown[type] = { count: 0, revenue: 0 };
            }
            summary.buyer_type_breakdown[type].count += 1;
            summary.buyer_type_breakdown[type].revenue += t.total_amount;
        });

        // Supplier breakdown
        rows.forEach(r => {
            const supplier = r.supplier_name || 'unknown';
            if (!summary.supplier_breakdown[supplier]) {
                summary.supplier_breakdown[supplier] = { count: 0, revenue: 0, qty: 0 };
            }
            summary.supplier_breakdown[supplier].count += 1;
            summary.supplier_breakdown[supplier].revenue += parseFloat(r.total_amount || 0);
            summary.supplier_breakdown[supplier].qty += parseFloat(r.quantity || 0);
        });

        res.json({
            transactions,
            summary,
            total: rows.length,
        });

    } catch (err) {
        console.error('getSalesReport error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// GET /api/cattle-feed-sales/report/summary
//   Quick summary for dashboard cards
// ══════════════════════════════════════════════════════════════
exports.getReportSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        let dateCondition = '';
        let params = [centreId];

        if (from && to) {
            dateCondition = 'AND cfs.sale_date BETWEEN ? AND ?';
            params.push(from, to);
        } else {
            const today = new Date().toISOString().split('T')[0];
            dateCondition = 'AND cfs.sale_date = ?';
            params.push(today);
        }

        const query = `
            SELECT
                COUNT(DISTINCT cfs.transaction_id) AS total_transactions,
                COALESCE(SUM(cfs.total_amount), 0) AS total_revenue,
                COALESCE(SUM(cfs.quantity), 0) AS total_qty,
                COUNT(DISTINCT cfs.seller_id) AS unique_sellers,
                COUNT(DISTINCT cfs.feed_id) AS unique_feeds,
                COUNT(DISTINCT cfs.operator_id) AS active_operators,
                COUNT(*) AS total_items
            FROM cattle_feed_sales cfs
            WHERE cfs.centre_id = ?
            ${dateCondition}
        `;

        const [rows] = await pool.query(query, params);

        // ── Top 5 feeds ──
        const topFeedsQuery = `
            SELECT
                cf.feed_id,
                cf.feed_name,
                cf.unit,
                cf.supplier_name,
                COUNT(*) AS sale_count,
                COALESCE(SUM(cfs.quantity), 0) AS total_qty,
                COALESCE(SUM(cfs.total_amount), 0) AS total_revenue
            FROM cattle_feed_sales cfs
            JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
            WHERE cfs.centre_id = ?
            ${dateCondition}
            GROUP BY cf.feed_id, cf.feed_name, cf.unit, cf.supplier_name
            ORDER BY total_revenue DESC
            LIMIT 5
        `;
        const [topFeeds] = await pool.query(topFeedsQuery, params);

        // ── Top 5 sellers ──
        const topSellersQuery = `
            SELECT
                s.seller_id,
                s.name AS seller_name,
                s.seller_code,
                s.seller_type,
                COUNT(DISTINCT cfs.transaction_id) AS transaction_count,
                COALESCE(SUM(cfs.quantity), 0) AS total_qty,
                COALESCE(SUM(cfs.total_amount), 0) AS total_revenue
            FROM cattle_feed_sales cfs
            LEFT JOIN sellers s ON s.seller_id = cfs.seller_id
            WHERE cfs.centre_id = ?
            ${dateCondition}
            AND cfs.seller_id IS NOT NULL
            GROUP BY s.seller_id, s.name, s.seller_code, s.seller_type
            ORDER BY total_revenue DESC
            LIMIT 5
        `;
        const [topSellers] = await pool.query(topSellersQuery, params);

        // ── Top suppliers ──
        const topSuppliersQuery = `
            SELECT
                cf.supplier_name,
                COUNT(*) AS sale_count,
                COALESCE(SUM(cfs.quantity), 0) AS total_qty,
                COALESCE(SUM(cfs.total_amount), 0) AS total_revenue
            FROM cattle_feed_sales cfs
            JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
            WHERE cfs.centre_id = ?
            ${dateCondition}
            AND cf.supplier_name != ''
            GROUP BY cf.supplier_name
            ORDER BY total_revenue DESC
            LIMIT 5
        `;
        const [topSuppliers] = await pool.query(topSuppliersQuery, params);

        res.json({
            ...rows[0],
            topFeeds,
            topSellers,
            topSuppliers,
        });

    } catch (err) {
        console.error('getReportSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// GET /api/cattle-feed-sales/report/export
//   Export report data in CSV or JSON format
// ══════════════════════════════════════════════════════════════
exports.exportReport = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const filters = req.query;
        const format = filters.format || 'csv';

        const { conditions, params } = buildFilterConditions(filters, centreId);
        const whereClause = conditions.join(' AND ');

        const query = `
            SELECT
                cfs.transaction_id,
                cfs.sale_date,
                cfs.buyer_type,
                s.name AS seller_name,
                s.seller_code,
                s.seller_type,
                cf.feed_name,
                cf.unit,
                cf.supplier_name,
                cfs.quantity,
                cfs.rate,
                cfs.total_amount,
                o.name AS operator_name,
                cfs.created_at
            FROM cattle_feed_sales cfs
            JOIN cattle_feeds cf ON cf.feed_id = cfs.feed_id
            LEFT JOIN sellers s ON s.seller_id = cfs.seller_id
            JOIN operators o ON o.operator_id = cfs.operator_id
            WHERE ${whereClause}
            ORDER BY cfs.sale_date DESC, cfs.transaction_id ASC
        `;

        const [rows] = await pool.query(query, params);

        if (format === 'json') {
            res.json({
                exported_at: new Date().toISOString(),
                total_records: rows.length,
                data: rows
            });
            return;
        }

        // ── CSV format ──
        const headers = [
            'Transaction ID', 'Date', 'Buyer Type', 'Seller Name',
            'Seller Code', 'Seller Type', 'Feed Name', 'Unit',
            'Supplier', 'Quantity', 'Rate', 'Total Amount', 'Operator'
        ];

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += [
                row.transaction_id,
                row.sale_date,
                row.buyer_type || '',
                row.seller_name || '',
                row.seller_code || '',
                row.seller_type || '',
                row.feed_name || '',
                row.unit || '',
                row.supplier_name || '',
                parseFloat(row.quantity || 0).toFixed(2),
                parseFloat(row.rate || 0).toFixed(2),
                parseFloat(row.total_amount || 0).toFixed(2),
                row.operator_name || ''
            ].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=cattle_feed_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);

    } catch (err) {
        console.error('exportReport error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};