// backend/controllers/dashboard.controller.js

const pool = require('../config/db');

// ══════════════════════════════════════════════════════════════
//  GET /api/dashboard?date=YYYY-MM-DD
//  Single endpoint that returns ALL dashboard data in one shot.
//  The frontend can also call individual module endpoints — this
//  is the "one-shot" option for a faster initial page load.
// ══════════════════════════════════════════════════════════════
exports.getDashboard = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const today = new Date().toISOString().split('T')[0];
        const from = req.query.from || req.query.date || today;
        const to = req.query.to || req.query.date || today;

        const [
            milkRows, walkinRows, productSaleRows,
            purchaseRows, advanceRows, productRows,
            dispatchRows, ownerUsageRows, operatorRows,
        ] = await Promise.all([
            // Milk entries
            pool.query(
                `SELECT me.*, s.name AS seller_name, s.seller_code, s.seller_type, me.rate_applied AS rate
                 FROM milk_entries me
                 JOIN sellers s ON s.seller_id = me.seller_id
                 WHERE me.centre_id = ? AND me.entry_date BETWEEN ? AND ?
                 ORDER BY me.entry_time DESC`,
                [centreId, from, to]
            ),
            // Walk-in sales
            pool.query(
                `SELECT * FROM walkin_sales
                 WHERE centre_id = ? AND sale_date BETWEEN ? AND ?
                 ORDER BY created_at DESC`,
                [centreId, from, to]
            ),
            // Product sales
            // AFTER
            pool.query(
                `SELECT ps.*, p.product_name, p.unit, p.mrp_rate AS selling_price, p.rate AS cost_price, s.name AS seller_name, s.seller_code
                 FROM product_sales ps
                 JOIN products p ON p.product_id = ps.product_id
                 JOIN sellers s ON s.seller_id = ps.seller_id
                 WHERE ps.centre_id = ? AND ps.sale_date BETWEEN ? AND ?
                 ORDER BY ps.created_at DESC`,
                [centreId, from, to]
            ),
            // Purchases
            pool.query(
                `SELECT pp.*, p.product_name, p.unit
                 FROM product_purchases pp
                 JOIN products p ON p.product_id = pp.product_id
                 WHERE pp.centre_id = ? AND pp.purchase_date BETWEEN ? AND ?
                 ORDER BY pp.created_at DESC`,
                [centreId, from, to]
            ),
            // Advances
            pool.query(
                `SELECT ca.*, s.name AS seller_name, s.seller_code
                 FROM cash_advance ca
                 JOIN sellers s ON s.seller_id = ca.seller_id
                 WHERE ca.centre_id = ? AND ca.transaction_date BETWEEN ? AND ?
                 ORDER BY ca.created_at DESC`,
                [centreId, from, to]
            ),
            // Products
            pool.query(
                `SELECT product_id, product_name, unit, current_stock, rate AS cost_price, mrp_rate AS selling_price
                 FROM products WHERE centre_id = ? ORDER BY product_name ASC`,
                [centreId]
            ),
            // Tank dispatch
            pool.query(
                `SELECT * FROM tank_dispatch
                 WHERE centre_id = ? AND dispatch_date BETWEEN ? AND ?
                 ORDER BY created_at DESC`,
                [centreId, from, to]
            ),
            // Owner usage
            pool.query(
                `SELECT * FROM owner_usage
                 WHERE centre_id = ? AND usage_date BETWEEN ? AND ?
                 ORDER BY created_at DESC`,
                [centreId, from, to]
            ),
            // Operators
            pool.query(
                `SELECT operator_id, name, email, mobile, is_active, created_at
                 FROM operators
                 WHERE centre_id = ?
                 ORDER BY name ASC`,
                [centreId]
            ),
        ]);

        // Extract data
        const milk = milkRows[0];
        const walkin = walkinRows[0];
        const productSales = productSaleRows[0];
        const purchases = purchaseRows[0];
        const advances = advanceRows[0];
        const products = productRows[0];
        const dispatches = dispatchRows[0];
        const ownerUsage = ownerUsageRows[0];
        const operators = operatorRows[0];

        // Calculate average milk rates by type
        const cowMilkEntries = milk.filter(e => e.milk_type === 'cow');
        const buffaloMilkEntries = milk.filter(e => e.milk_type === 'buffalo');

        const avgCowRate = cowMilkEntries.length
            ? cowMilkEntries.reduce((sum, e) => sum + parseFloat(e.rate || 0), 0) / cowMilkEntries.length
            : 0;

        const avgBuffaloRate = buffaloMilkEntries.length
            ? buffaloMilkEntries.reduce((sum, e) => sum + parseFloat(e.rate || 0), 0) / buffaloMilkEntries.length
            : 0;

        // 1. Product Sales Profit
        const productSalesProfit = productSales.reduce((sum, sale) => {
            const profitPerUnit = parseFloat(sale.selling_price || 0) - parseFloat(sale.cost_price || 0);
            return sum + profitPerUnit * parseFloat(sale.quantity || 0);
        }, 0);

        // 2. Walk-in Sales Profit (by milk type)
        const walkinCowProfit = walkin.filter(s => s.milk_type === 'cow')
            .reduce((sum, s) => {
                const profitPerLiter = parseFloat(s.mrp || 0) - avgCowRate;
                return sum + profitPerLiter * parseFloat(s.quantity || 0);
            }, 0);

        const walkinBuffaloProfit = walkin.filter(s => s.milk_type === 'buffalo')
            .reduce((sum, s) => {
                const profitPerLiter = parseFloat(s.mrp || 0) - avgBuffaloRate;
                return sum + profitPerLiter * parseFloat(s.quantity || 0);
            }, 0);

        const walkinProfit = walkinCowProfit + walkinBuffaloProfit;

        // 3. Tank Dispatch Profit (by milk type) — milk_type is 'cow' | 'buffalo' | 'mixed', NOT NULL
        const cowDispatchProfit = dispatches.reduce((sum, d) => {
            const factoryRate = parseFloat(d.factory_rate || 0);
            let cowLiters = 0;
            if (d.milk_type === 'cow') {
                cowLiters = parseFloat(d.total_liters || 0);
            } else if (d.milk_type === 'mixed') {
                cowLiters = parseFloat(d.cow_liters || 0);
            }
            return sum + (factoryRate - avgCowRate) * cowLiters;
        }, 0);

        const buffaloDispatchProfit = dispatches.reduce((sum, d) => {
            const factoryRate = parseFloat(d.factory_rate || 0);
            let bufLiters = 0;
            if (d.milk_type === 'buffalo') {
                bufLiters = parseFloat(d.total_liters || 0);
            } else if (d.milk_type === 'mixed') {
                bufLiters = parseFloat(d.buffalo_liters || 0);
            }
            return sum + (factoryRate - avgBuffaloRate) * bufLiters;
        }, 0);

        const dispatchProfit = cowDispatchProfit + buffaloDispatchProfit;

        // 4. Owner Usage Cost (by milk type)
        const cowOwnerUsageCost = ownerUsage.filter(u => u.milk_type === 'cow')
            .reduce((sum, u) => sum + avgCowRate * parseFloat(u.quantity || 0), 0);

        const buffaloOwnerUsageCost = ownerUsage.filter(u => u.milk_type === 'buffalo')
            .reduce((sum, u) => sum + avgBuffaloRate * parseFloat(u.quantity || 0), 0);

        const ownerUsageCost = cowOwnerUsageCost + buffaloOwnerUsageCost;

        // 5. Total Profit
        const totalProfit = productSalesProfit + walkinProfit + dispatchProfit - ownerUsageCost;

        // Return response
        res.json({
            from,
            to,
            milk_entries: milk,
            walkin_sales: walkin,
            product_sales: productSales,
            purchases,
            advances,
            products,
            dispatches,
            owner_usage: ownerUsage,
            operators,
            profits: {
                avg_cow_rate: avgCowRate,
                avg_buffalo_rate: avgBuffaloRate,
                product_sales_profit: productSalesProfit,
                walkin_cow_profit: walkinCowProfit,
                walkin_buffalo_profit: walkinBuffaloProfit,
                walkin_profit: walkinProfit,
                cow_dispatch_profit: cowDispatchProfit,
                buffalo_dispatch_profit: buffaloDispatchProfit,
                dispatch_profit: dispatchProfit,
                cow_owner_usage_cost: cowOwnerUsageCost,
                buffalo_owner_usage_cost: buffaloOwnerUsageCost,
                owner_usage_cost: ownerUsageCost,
                total_profit: totalProfit,
            },
        });

    } catch (err) {
        console.error('getDashboard error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
//  GET /api/dashboard/summary?date=YYYY-MM-DD
//  Lightweight — only stat cards, no raw row data.
//  Useful for a quick top-bar refresh without re-rendering tables.
// ══════════════════════════════════════════════════════════════
exports.getSummary = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const [
            [milkAgg],
            [walkinAgg],
            [prodSaleAgg],
            [purchaseAgg],
            [advanceAgg],
            [productAgg],
            [dispatchAgg],
            [ownerUsageAgg],
        ] = await Promise.all([

            // Milk entries aggregation (by type)
            pool.query(
                `SELECT
                    COUNT(*) AS entry_count,
                    COALESCE(SUM(quantity), 0) AS total_quantity,
                    COALESCE(SUM(total_amount), 0) AS total_amount,
                    COALESCE(AVG(fat), 0) AS avg_fat,
                    COALESCE(AVG(snf), 0) AS avg_snf,
                    COUNT(DISTINCT seller_id) AS unique_sellers,
                    SUM(shift = 'morning') AS morning_count,
                    SUM(shift = 'evening') AS evening_count,
                    COALESCE(SUM(CASE WHEN milk_type = 'cow' THEN quantity ELSE 0 END), 0) AS cow_quantity,
                    COALESCE(SUM(CASE WHEN milk_type = 'buffalo' THEN quantity ELSE 0 END), 0) AS buffalo_quantity,
                    COALESCE(AVG(CASE WHEN milk_type = 'cow' THEN rate_applied ELSE NULL END), 0) AS avg_cow_rate,
                    COALESCE(AVG(CASE WHEN milk_type = 'buffalo' THEN rate_applied ELSE NULL END), 0) AS avg_buffalo_rate
                 FROM milk_entries
                 WHERE centre_id = ? AND entry_date = ?`,
                [centreId, date]
            ),

            // Walk-in sales aggregation (by type)
            pool.query(
                `SELECT
                    COUNT(*) AS transaction_count,
                    COALESCE(SUM(total_amount), 0) AS total_amount,
                    COALESCE(SUM(quantity), 0) AS total_quantity,
                    COALESCE(SUM(CASE WHEN milk_type = 'cow' THEN (mrp - ?) * quantity ELSE 0 END), 0) AS cow_profit,
                    COALESCE(SUM(CASE WHEN milk_type = 'buffalo' THEN (mrp - ?) * quantity ELSE 0 END), 0) AS buffalo_profit
                 FROM walkin_sales
                  WHERE centre_id = ? AND sale_date = ?`,
                [milkAgg[0]?.avg_cow_rate || 0, milkAgg[0]?.avg_buffalo_rate || 0, centreId, date]
            ),

            // Product sales aggregation
            pool.query(
                `SELECT
                    COUNT(*) AS transaction_count,
                    COALESCE(SUM(total_amount), 0) AS total_amount,
                    COALESCE(SUM((p.mrp_rate - p.rate) * ps.quantity), 0) AS product_sales_profit
                 FROM product_sales ps
                 JOIN products p ON p.product_id = ps.product_id
                 WHERE ps.centre_id = ? AND ps.sale_date = ?`,
                [centreId, date]
            ),

            // Purchases aggregation
            pool.query(
                `SELECT
                    COUNT(*) AS transaction_count,
                    COALESCE(SUM(total_amount), 0) AS total_amount
                 FROM product_purchases
                WHERE centre_id = ? AND purchase_date = ?`,
                [centreId, date]
            ),

            // Advances aggregation
            pool.query(
                `SELECT
                    COUNT(*) AS transaction_count,
                    COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS total_given,
                    COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS total_received
                 FROM cash_advance
                 WHERE centre_id = ? AND transaction_date = ?`,
                [centreId, date]
            ),

            // Products aggregation
            pool.query(
                `SELECT
                    COUNT(*) AS total_count,
                    SUM(current_stock <= 0) AS out_of_stock,
                    SUM(current_stock > 0 AND current_stock < 5) AS low_stock
                 FROM products WHERE centre_id = ?`,
                [centreId]
            ),

            // Tank dispatch aggregation (by type)
            pool.query(
                `SELECT
                    COUNT(*) AS dispatch_count,
                    COALESCE(SUM(total_liters), 0) AS total_liters,
                    COALESCE(SUM(total_amount), 0) AS total_amount,
                    COALESCE(AVG(factory_rate), 0) AS avg_factory_rate,
                    COALESCE(SUM(
                        CASE
                            WHEN milk_type = 'cow' THEN (factory_rate - ?) * total_liters
                            WHEN milk_type = 'mixed' THEN (factory_rate - ?) * cow_liters
                            ELSE 0
                        END
                    ), 0) AS cow_dispatch_profit,
                    COALESCE(SUM(
                        CASE
                            WHEN milk_type = 'buffalo' THEN (factory_rate - ?) * total_liters
                            WHEN milk_type = 'mixed' THEN (factory_rate - ?) * buffalo_liters
                            ELSE 0
                        END
                    ), 0) AS buffalo_dispatch_profit
                 FROM tank_dispatch
                      WHERE centre_id = ? AND dispatch_date = ?`,
                [
                    milkAgg[0]?.avg_cow_rate || 0,
                    milkAgg[0]?.avg_cow_rate || 0,
                    milkAgg[0]?.avg_buffalo_rate || 0,
                    milkAgg[0]?.avg_buffalo_rate || 0,
                    centreId,
                    date,
                ]
            ),

            // Owner usage aggregation (by type)
            pool.query(
                `SELECT
                    COALESCE(SUM(CASE WHEN milk_type = 'cow' THEN quantity * ? ELSE 0 END), 0) AS cow_usage_cost,
                    COALESCE(SUM(CASE WHEN milk_type = 'buffalo' THEN quantity * ? ELSE 0 END), 0) AS buffalo_usage_cost
                 FROM owner_usage
              WHERE centre_id = ? AND usage_date = ?`,
                [milkAgg[0]?.avg_cow_rate || 0, milkAgg[0]?.avg_buffalo_rate || 0, centreId, date]
            ),
        ]);

        // Extract values
        const walkinAmt = parseFloat(walkinAgg[0].total_amount || 0);
        const prodSaleAmt = parseFloat(prodSaleAgg[0].total_amount || 0);
        const avgCowRate = parseFloat(milkAgg[0].avg_cow_rate || 0);
        const avgBuffaloRate = parseFloat(milkAgg[0].avg_buffalo_rate || 0);
        const walkinCowProfit = parseFloat(walkinAgg[0].cow_profit || 0);
        const walkinBuffaloProfit = parseFloat(walkinAgg[0].buffalo_profit || 0);
        const walkinProfit = walkinCowProfit + walkinBuffaloProfit;
        const productSalesProfit = parseFloat(prodSaleAgg[0].product_sales_profit || 0);
        const cowDispatchProfit = parseFloat(dispatchAgg[0]?.cow_dispatch_profit || 0);
        const buffaloDispatchProfit = parseFloat(dispatchAgg[0]?.buffalo_dispatch_profit || 0);
        const dispatchProfit = cowDispatchProfit + buffaloDispatchProfit;
        const cowOwnerUsageCost = parseFloat(ownerUsageAgg[0]?.cow_usage_cost || 0);
        const buffaloOwnerUsageCost = parseFloat(ownerUsageAgg[0]?.buffalo_usage_cost || 0);
        const ownerUsageCost = cowOwnerUsageCost + buffaloOwnerUsageCost;
        const totalProfit = productSalesProfit + walkinProfit + dispatchProfit - ownerUsageCost;

        // Return response
        res.json({
            date,
            stats: {
                milk: {
                    entry_count: parseInt(milkAgg[0].entry_count),
                    total_quantity: parseFloat(milkAgg[0].total_quantity),
                    total_amount: parseFloat(milkAgg[0].total_amount),
                    avg_fat: parseFloat(milkAgg[0].avg_fat),
                    avg_snf: parseFloat(milkAgg[0].avg_snf),
                    unique_sellers: parseInt(milkAgg[0].unique_sellers),
                    morning_count: parseInt(milkAgg[0].morning_count),
                    evening_count: parseInt(milkAgg[0].evening_count),
                    cow_quantity: parseFloat(milkAgg[0].cow_quantity),
                    buffalo_quantity: parseFloat(milkAgg[0].buffalo_quantity),
                    avg_cow_rate: avgCowRate,
                    avg_buffalo_rate: avgBuffaloRate,
                },
                walkin: {
                    transaction_count: parseInt(walkinAgg[0].transaction_count),
                    total_amount: walkinAmt,
                    total_quantity: parseFloat(walkinAgg[0].total_quantity),
                    cow_profit: walkinCowProfit,
                    buffalo_profit: walkinBuffaloProfit,
                    walkin_profit: walkinProfit,
                },
                product_sales: {
                    transaction_count: parseInt(prodSaleAgg[0].transaction_count),
                    total_amount: prodSaleAmt,
                    product_sales_profit,
                },
                purchases: {
                    transaction_count: parseInt(purchaseAgg[0].transaction_count),
                    total_amount: parseFloat(purchaseAgg[0].total_amount),
                },
                advances: {
                    transaction_count: parseInt(advanceAgg[0].transaction_count),
                    total_given: parseFloat(advanceAgg[0].total_given),
                    total_received: parseFloat(advanceAgg[0].total_received),
                },
                products: {
                    total_count: parseInt(productAgg[0].total_count),
                    out_of_stock: parseInt(productAgg[0].out_of_stock),
                    low_stock: parseInt(productAgg[0].low_stock),
                },
                dispatches: {
                    dispatch_count: parseInt(dispatchAgg[0]?.dispatch_count || 0),
                    total_liters: parseFloat(dispatchAgg[0]?.total_liters || 0),
                    total_amount: parseFloat(dispatchAgg[0]?.total_amount || 0),
                    avg_factory_rate: parseFloat(dispatchAgg[0]?.avg_factory_rate || 0),
                    cow_dispatch_profit: cowDispatchProfit,
                    buffalo_dispatch_profit: buffaloDispatchProfit,
                    dispatch_profit: dispatchProfit,
                },
                owner_usage: {
                    cow_usage_cost: cowOwnerUsageCost,
                    buffalo_usage_cost: buffaloOwnerUsageCost,
                    owner_usage_cost: ownerUsageCost,
                },
                total_revenue: walkinAmt + prodSaleAmt,
                total_profit: totalProfit,
            },
        });

    } catch (err) {
        console.error('getSummary error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};