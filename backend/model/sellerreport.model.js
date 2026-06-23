// models/sellerReportModel.js
const db = require("../config/db"); // your mysql2/promise pool

// ─────────────────────────────────────────────────────────────
// 1. All sellers (active + inactive)
// ─────────────────────────────────────────────────────────────
const getAllSellers = async () => {
    const [rows] = await db.query(
        `SELECT seller_id, seller_code, name, mobile, seller_type, is_active
         FROM sellers
         ORDER BY name ASC`
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 2. Milk entries for a date range (all sellers, or one seller)
// ─────────────────────────────────────────────────────────────
const getMilkEntriesByRange = async (startDate, endDate, sellerId = null) => {
    let sql = `
        SELECT
            me.entry_id,
            me.seller_id,
            s.name        AS seller_name,
            s.seller_code,
            me.operator_id,
            me.entry_date,
            me.shift,
            me.milk_type,
            me.quantity,
            me.fat,
            me.snf,
            me.water,
            me.rate_applied,
            me.is_premium,
            me.total_amount,
            me.entry_time
        FROM milk_entries me
        JOIN sellers s ON s.seller_id = me.seller_id
        WHERE me.entry_date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (sellerId) {
        sql += " AND me.seller_id = ?";
        params.push(sellerId);
    }

    sql += " ORDER BY me.entry_date ASC, me.shift ASC";

    const [rows] = await db.query(sql, params);
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 3. Product sales for a date range (all sellers, or one seller)
// ─────────────────────────────────────────────────────────────
const getProductSalesByRange = async (startDate, endDate, sellerId = null) => {
    let sql = `
        SELECT
            ps.sale_id,
            ps.seller_id,
            s.name        AS seller_name,
            ps.product_id,
            p.product_name,
            p.unit,
            ps.quantity,
            ps.rate,
            ps.total_amount,
            ps.sale_date,
            ps.operator_id
        FROM product_sales ps
        JOIN sellers  s ON s.seller_id   = ps.seller_id
        JOIN products p ON p.product_id  = ps.product_id
        WHERE ps.sale_date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (sellerId) {
        sql += " AND ps.seller_id = ?";
        params.push(sellerId);
    }

    sql += " ORDER BY ps.sale_date ASC";

    const [rows] = await db.query(sql, params);
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 4. Cash advances for a date range (all sellers, or one seller)
// ─────────────────────────────────────────────────────────────
const getCashAdvanceByRange = async (startDate, endDate, sellerId = null) => {
    let sql = `
        SELECT
            ca.id,
            ca.seller_id,
            s.name   AS seller_name,
            ca.operator_id,
            ca.type,
            ca.amount,
            ca.transaction_date,
            ca.remarks,
            ca.created_at
        FROM cash_advance ca
        JOIN sellers s ON s.seller_id = ca.seller_id
        WHERE ca.transaction_date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (sellerId) {
        sql += " AND ca.seller_id = ?";
        params.push(sellerId);
    }

    sql += " ORDER BY ca.transaction_date ASC";

    const [rows] = await db.query(sql, params);
    return rows;
};

const getCashDepositByRange = async (startDate, endDate, sellerId = null) => {
    let sql = `
        SELECT
            cd.id,
            cd.seller_id,
            s.name        AS seller_name,
            cd.operator_id,
            'deposit'     AS type,
            cd.amount,
            cd.transaction_date,
            cd.remarks,
            cd.created_at
        FROM seller_deposits cd
        JOIN sellers s ON s.seller_id = cd.seller_id
        WHERE cd.transaction_date BETWEEN ? AND ?
        `;
    const params = [startDate, endDate];

    if (sellerId) {
        sql += " AND cd.seller_id = ?";
        params.push(sellerId);
    }

    sql += " ORDER BY cd.transaction_date ASC";

    const [rows] = await db.query(sql, params);
    return rows;
}

// ─────────────────────────────────────────────────────────────
// 5. Aggregated per-seller monthly summary (single optimised query)
//    Returns one row per seller with all rollup figures.
// ─────────────────────────────────────────────────────────────
const getSellerMonthlySummary = async (startDate, endDate) => {
    const sql = `
        SELECT
            s.seller_id,
            s.seller_code,
            s.name,
            s.mobile,
            s.seller_type,
            s.is_active,

            /* ── Milk ── */
            COALESCE(m.entry_count,    0)    AS entry_count,
            COALESCE(m.total_qty,      0.00) AS total_qty,
            COALESCE(m.total_milk_amt, 0.00) AS total_milk_amt,
            COALESCE(m.avg_fat,        0.00) AS avg_fat,
            COALESCE(m.avg_snf,        0.00) AS avg_snf,
            COALESCE(m.cow_qty,        0.00) AS cow_qty,
            COALESCE(m.buf_qty,        0.00) AS buf_qty,
            COALESCE(m.morning_qty,    0.00) AS morning_qty,
            COALESCE(m.evening_qty,    0.00) AS evening_qty,

            /* ── Product sales ── */
            COALESCE(ps.prod_sales_amt, 0.00) AS prod_sales_amt,

            /* ── Cash advance ── */
            COALESCE(ca.adv_given,     0.00) AS adv_given,
            COALESCE(ca.adv_received,  0.00) AS adv_received,

            /* ── Net payable ── */
            ROUND(
                COALESCE(m.total_milk_amt,  0)
                - COALESCE(ps.prod_sales_amt, 0)
                - (COALESCE(ca.adv_given, 0) - COALESCE(ca.adv_received, 0)),
            2) AS net_payable

        FROM sellers s

        /* milk rollup */
        LEFT JOIN (
            SELECT
                seller_id,
                COUNT(*)                                        AS entry_count,
                SUM(quantity)                                   AS total_qty,
                SUM(total_amount)                               AS total_milk_amt,
                AVG(fat)                                        AS avg_fat,
                AVG(snf)                                        AS avg_snf,
                SUM(CASE WHEN milk_type = 'cow'     THEN quantity ELSE 0 END) AS cow_qty,
                SUM(CASE WHEN milk_type = 'buffalo' THEN quantity ELSE 0 END) AS buf_qty,
                SUM(CASE WHEN shift = 'morning'     THEN quantity ELSE 0 END) AS morning_qty,
                SUM(CASE WHEN shift = 'evening'     THEN quantity ELSE 0 END) AS evening_qty
            FROM milk_entries
            WHERE entry_date BETWEEN ? AND ?
            GROUP BY seller_id
        ) m ON m.seller_id = s.seller_id

        /* product-sales rollup */
        LEFT JOIN (
            SELECT
                seller_id,
                SUM(total_amount) AS prod_sales_amt
            FROM product_sales
            WHERE sale_date BETWEEN ? AND ?
            GROUP BY seller_id
        ) ps ON ps.seller_id = s.seller_id

        /* cash-advance rollup */
        LEFT JOIN (
            SELECT
                seller_id,
                SUM(CASE WHEN type = 'given'    THEN amount ELSE 0 END) AS adv_given,
                SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END) AS adv_received
            FROM cash_advance
            WHERE transaction_date BETWEEN ? AND ?
            GROUP BY seller_id
        ) ca ON ca.seller_id = s.seller_id

        ORDER BY s.name ASC
    `;

    const [rows] = await db.query(sql, [
        startDate, endDate,   // milk
        startDate, endDate,   // product_sales
        startDate, endDate,   // cash_advance
    ]);
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 6. Month-level grand totals
// ─────────────────────────────────────────────────────────────
const getMonthGrandTotals = async (startDate, endDate) => {
    const sql = `
        SELECT
            (SELECT COUNT(DISTINCT seller_id)
             FROM milk_entries
             WHERE entry_date BETWEEN ? AND ?)                     AS active_sellers,

            (SELECT COUNT(*)
             FROM milk_entries
             WHERE entry_date BETWEEN ? AND ?)                     AS total_entries,

            (SELECT COALESCE(SUM(quantity),     0)
             FROM milk_entries
             WHERE entry_date BETWEEN ? AND ?)                     AS total_qty,

            (SELECT COALESCE(SUM(total_amount), 0)
             FROM milk_entries
             WHERE entry_date BETWEEN ? AND ?)                     AS total_milk_amt,

            (SELECT COALESCE(SUM(total_amount), 0)
             FROM product_sales
             WHERE sale_date BETWEEN ? AND ?)                      AS total_prod_sales,

            (SELECT COALESCE(SUM(CASE WHEN type='given'    THEN amount ELSE 0 END), 0)
             FROM cash_advance
             WHERE transaction_date BETWEEN ? AND ?)               AS total_adv_given,

            (SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END), 0)
             FROM cash_advance
             WHERE transaction_date BETWEEN ? AND ?)               AS total_adv_received
    `;

    const params = Array(12).fill(null).map((_, i) =>
        i % 2 === 0 ? startDate : endDate
    );

    const [rows] = await db.query(sql, params);
    const r = rows[0];

    return {
        ...r,
        total_net_payable:
            parseFloat(r.total_milk_amt || 0)
            - parseFloat(r.total_prod_sales || 0)
            - (parseFloat(r.total_adv_given || 0) - parseFloat(r.total_adv_received || 0)),
    };
};

module.exports = {
    getAllSellers,
    getMilkEntriesByRange,
    getProductSalesByRange,
    getCashAdvanceByRange,
    getCashDepositByRange,
    getSellerMonthlySummary,
    getMonthGrandTotals,
};