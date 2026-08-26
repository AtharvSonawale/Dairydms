const pool = require('../config/db');

// ── Helper: Build filter conditions ──────────────────────────
const buildFilterConditions = (filters, centreId) => {
    const conditions = ['ps.centre_id = ?'];
    const params = [centreId];

    if (filters.from && filters.to) {
        conditions.push('ps.sale_date BETWEEN ? AND ?');
        params.push(filters.from, filters.to);
    }

    if (filters.seller_type && filters.seller_type !== 'all') {
        conditions.push('s.seller_type = ?');
        params.push(filters.seller_type);
    }

    if (filters.buyer_type && filters.buyer_type !== 'all') {
        conditions.push('ps.buyer_type = ?');
        params.push(filters.buyer_type);
    }

    if (filters.product_id && filters.product_id !== 'all') {
        conditions.push('ps.product_id = ?');
        params.push(parseInt(filters.product_id));
    }

    if (filters.seller_id && filters.seller_id !== 'all') {
        conditions.push('ps.seller_id = ?');
        params.push(parseInt(filters.seller_id));
    }

    if (filters.operator_id && filters.operator_id !== 'all') {
        conditions.push('ps.operator_id = ?');
        params.push(parseInt(filters.operator_id));
    }

    if (filters.milk_type && filters.milk_type !== 'all') {
        conditions.push('ps.milk_type = ?');
        params.push(filters.milk_type);
    }

    if (filters.min_amount && parseFloat(filters.min_amount) > 0) {
        conditions.push('ps.total_amount >= ?');
        params.push(parseFloat(filters.min_amount));
    }

    if (filters.max_amount && parseFloat(filters.max_amount) > 0) {
        conditions.push('ps.total_amount <= ?');
        params.push(parseFloat(filters.max_amount));
    }

    return { conditions, params };
};

// ══════════════════════════════════════════════════════════════
// GET /api/product-sales/report
//   Query params: from, to, seller_type, buyer_type, product_id,
//   seller_id, operator_id, shift, milk_type, min_amount, max_amount
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
                ps.*,
                p.product_name,
                p.unit,
                p.mrp_rate AS product_mrp,
                s.name AS seller_name,
                s.seller_code AS seller_code,
                s.seller_type AS seller_type,
                s.milk_type AS seller_milk_type,
                s.mobile AS seller_mobile,
                nb.name AS registered_buyer_name,
                nb.mobile AS buyer_mobile,
                o.name AS operator_name,
                o.email AS operator_email
            FROM product_sales ps
            JOIN products p ON p.product_id = ps.product_id
            LEFT JOIN sellers s ON s.seller_id = ps.seller_id
            LEFT JOIN product_named_buyers nb ON nb.buyer_id = ps.buyer_id
            JOIN operators o ON o.operator_id = ps.operator_id
            WHERE ${whereClause}
            ORDER BY ps.sale_date DESC, ps.created_at DESC
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
                product_id: row.product_id,
                product_name: row.product_name,
                unit: row.unit,
                product_mrp: row.product_mrp,
                quantity: row.quantity,
                rate: row.rate,
                total_amount: row.total_amount,
                shift: row.shift,
                milk_type: row.milk_type,
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
            unique_products: new Set(rows.map(r => r.product_id)).size,
            unique_operators: new Set(transactions.map(t => t.operator_id)).size,
            seller_type_breakdown: {},
            buyer_type_breakdown: {},
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
// GET /api/product-sales/report/summary
//   Quick summary for dashboard cards
// ══════════════════════════════════════════════════════════════
exports.getReportSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { from, to } = req.query;

        let dateCondition = '';
        let params = [centreId];

        if (from && to) {
            dateCondition = 'AND ps.sale_date BETWEEN ? AND ?';
            params.push(from, to);
        } else {
            const today = new Date().toISOString().split('T')[0];
            dateCondition = 'AND ps.sale_date = ?';
            params.push(today);
        }

        const query = `
            SELECT
                COUNT(DISTINCT ps.transaction_id) AS total_transactions,
                COALESCE(SUM(ps.total_amount), 0) AS total_revenue,
                COALESCE(SUM(ps.quantity), 0) AS total_qty,
                COUNT(DISTINCT ps.seller_id) AS unique_sellers,
                COUNT(DISTINCT ps.product_id) AS unique_products,
                COUNT(DISTINCT ps.operator_id) AS active_operators,
                COUNT(*) AS total_items
            FROM product_sales ps
            WHERE ps.centre_id = ?
            ${dateCondition}
        `;

        const [rows] = await pool.query(query, params);

        // ── Top 5 products ──
        const topProductsQuery = `
            SELECT
                p.product_id,
                p.product_name,
                p.unit,
                COUNT(*) AS sale_count,
                COALESCE(SUM(ps.quantity), 0) AS total_qty,
                COALESCE(SUM(ps.total_amount), 0) AS total_revenue
            FROM product_sales ps
            JOIN products p ON p.product_id = ps.product_id
            WHERE ps.centre_id = ?
            ${dateCondition}
            GROUP BY p.product_id, p.product_name, p.unit
            ORDER BY total_revenue DESC
            LIMIT 5
        `;
        const [topProducts] = await pool.query(topProductsQuery, params);

        // ── Top 5 sellers ──
        const topSellersQuery = `
            SELECT
                s.seller_id,
                s.name AS seller_name,
                s.seller_code,
                s.seller_type,
                COUNT(DISTINCT ps.transaction_id) AS transaction_count,
                COALESCE(SUM(ps.quantity), 0) AS total_qty,
                COALESCE(SUM(ps.total_amount), 0) AS total_revenue
            FROM product_sales ps
            LEFT JOIN sellers s ON s.seller_id = ps.seller_id
            WHERE ps.centre_id = ?
            ${dateCondition}
            AND ps.seller_id IS NOT NULL
            GROUP BY s.seller_id, s.name, s.seller_code, s.seller_type
            ORDER BY total_revenue DESC
            LIMIT 5
        `;
        const [topSellers] = await pool.query(topSellersQuery, params);

        res.json({
            ...rows[0],
            topProducts,
            topSellers,
        });

    } catch (err) {
        console.error('getReportSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// GET /api/product-sales/report/export
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
                ps.transaction_id,
                ps.sale_date,
                ps.buyer_type,
                s.name AS seller_name,
                s.seller_code,
                s.seller_type,
                p.product_name,
                p.unit,
                ps.quantity,
                ps.rate,
                ps.total_amount,
                o.name AS operator_name,
                ps.created_at
            FROM product_sales ps
            JOIN products p ON p.product_id = ps.product_id
            LEFT JOIN sellers s ON s.seller_id = ps.seller_id
            JOIN operators o ON o.operator_id = ps.operator_id
            WHERE ${whereClause}
            ORDER BY ps.sale_date DESC, ps.transaction_id ASC
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
            'Seller Code', 'Seller Type', 'Product Name', 'Unit',
            'Quantity', 'Rate', 'Total Amount', 'Operator'
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
                row.product_name || '',
                row.unit || '',
                parseFloat(row.quantity || 0).toFixed(2),
                parseFloat(row.rate || 0).toFixed(2),
                parseFloat(row.total_amount || 0).toFixed(2),
                row.operator_name || ''
            ].join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=product_sales_report_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);

    } catch (err) {
        console.error('exportReport error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};