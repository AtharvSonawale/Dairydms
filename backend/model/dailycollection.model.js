// models/dailyCollection.model.js
const pool = require("../config/db");

// ─────────────────────────────────────────────────────────────
// 1. Full daily milk entries for a single date
//    Grouped display: each entry row with seller info
// ─────────────────────────────────────────────────────────────
const getDailyEntries = async (date) => {
    const [rows] = await pool.query(
        `SELECT
            me.entry_id,
            me.seller_id,
            s.seller_code,
            s.name          AS seller_name,
            s.seller_type,
            s.mobile,
            me.operator_id,
            op.name         AS operator_name,
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
        JOIN sellers   s  ON s.seller_id   = me.seller_id
        JOIN operators op ON op.operator_id = me.operator_id
        WHERE me.entry_date = ?
        ORDER BY me.shift ASC, s.name ASC`,
        [date]
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 2. Shift-wise summary totals for a date
// ─────────────────────────────────────────────────────────────
const getShiftSummary = async (date) => {
    const [rows] = await pool.query(
        `SELECT
            shift,
            milk_type,
            COUNT(*)                AS entry_count,
            COUNT(DISTINCT seller_id) AS seller_count,
            SUM(quantity)           AS total_qty,
            SUM(total_amount)       AS total_amount,
            AVG(fat)                AS avg_fat,
            AVG(snf)                AS avg_snf,
            MIN(fat)                AS min_fat,
            MAX(fat)                AS max_fat
        FROM milk_entries
        WHERE entry_date = ?
        GROUP BY shift, milk_type
        ORDER BY shift ASC, milk_type ASC`,
        [date]
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 3. Grand totals for a date (single row)
// ─────────────────────────────────────────────────────────────
const getDayTotals = async (date) => {
    const [[row]] = await pool.query(
        `SELECT
            COUNT(*)                                                        AS total_entries,
            COUNT(DISTINCT seller_id)                                       AS total_sellers,
            COALESCE(SUM(quantity),     0)                                  AS total_qty,
            COALESCE(SUM(total_amount), 0)                                  AS total_amount,
            COALESCE(AVG(fat),          0)                                  AS avg_fat,
            COALESCE(AVG(snf),          0)                                  AS avg_snf,
            COALESCE(SUM(CASE WHEN shift     = 'morning'  THEN quantity ELSE 0 END), 0) AS morning_qty,
            COALESCE(SUM(CASE WHEN shift     = 'evening'  THEN quantity ELSE 0 END), 0) AS evening_qty,
            COALESCE(SUM(CASE WHEN milk_type = 'cow'      THEN quantity ELSE 0 END), 0) AS cow_qty,
            COALESCE(SUM(CASE WHEN milk_type = 'buffalo'  THEN quantity ELSE 0 END), 0) AS buf_qty,
            COALESCE(SUM(CASE WHEN milk_type = 'cow'      THEN total_amount ELSE 0 END), 0) AS cow_amount,
            COALESCE(SUM(CASE WHEN milk_type = 'buffalo'  THEN total_amount ELSE 0 END), 0) AS buf_amount,
            COALESCE(SUM(CASE WHEN is_premium = 1         THEN quantity ELSE 0 END), 0) AS premium_qty,
            COUNT(CASE  WHEN is_premium = 1 THEN 1 END)                     AS premium_count
        FROM milk_entries
        WHERE entry_date = ?`,
        [date]
    );
    return row;
};

// ─────────────────────────────────────────────────────────────
// 4. Per-seller daily summary (for the seller table)
// ─────────────────────────────────────────────────────────────
const getSellerDailySummary = async (date) => {
    const [rows] = await pool.query(
        `SELECT
            s.seller_id,
            s.seller_code,
            s.name              AS seller_name,
            s.seller_type,
            s.mobile,
            op.name             AS operator_name,

            COUNT(me.entry_id)  AS entry_count,
            SUM(me.quantity)    AS total_qty,
            SUM(me.total_amount) AS total_amount,
            AVG(me.fat)         AS avg_fat,
            AVG(me.snf)         AS avg_snf,

            SUM(CASE WHEN me.shift     = 'morning'  THEN me.quantity ELSE 0 END) AS morning_qty,
            SUM(CASE WHEN me.shift     = 'evening'  THEN me.quantity ELSE 0 END) AS evening_qty,
            SUM(CASE WHEN me.milk_type = 'cow'      THEN me.quantity ELSE 0 END) AS cow_qty,
            SUM(CASE WHEN me.milk_type = 'buffalo'  THEN me.quantity ELSE 0 END) AS buf_qty,

            MAX(me.is_premium)  AS has_premium,

            /* individual entries for expand panel */
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'entry_id',    me.entry_id,
                    'shift',       me.shift,
                    'milk_type',   me.milk_type,
                    'quantity',    me.quantity,
                    'fat',         me.fat,
                    'snf',         me.snf,
                    'water',       me.water,
                    'rate_applied',me.rate_applied,
                    'is_premium',  me.is_premium,
                    'total_amount',me.total_amount,
                    'entry_time',  me.entry_time
                )
            ) AS entries

        FROM sellers s
        JOIN milk_entries me ON me.seller_id  = s.seller_id
                             AND me.entry_date = ?
        JOIN operators op    ON op.operator_id = me.operator_id
        GROUP BY
            s.seller_id, s.seller_code, s.name,
            s.seller_type, s.mobile, op.name
        ORDER BY s.name ASC`,
        [date]
    );

    // Parse JSON_ARRAYAGG result (mysql2 returns it as a string in some versions)
    return rows.map((r) => ({
        ...r,
        entries: typeof r.entries === "string" ? JSON.parse(r.entries) : r.entries,
    }));
};

// ─────────────────────────────────────────────────────────────
// 5. Walk-in sales totals for a date
// ─────────────────────────────────────────────────────────────
const getWalkinSummary = async (date) => {
    const [rows] = await pool.query(
        `SELECT
            shift,
            milk_type,
            COUNT(*)            AS sale_count,
            SUM(quantity)       AS total_qty,
            SUM(total_amount)   AS total_amount,
            AVG(rate)           AS avg_rate
        FROM walkin_sales
        WHERE sale_date = ?
        GROUP BY shift, milk_type
        ORDER BY shift ASC`,
        [date]
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 6. Tank dispatch for a date
// ─────────────────────────────────────────────────────────────
const getTankDispatch = async (date) => {
    const [rows] = await pool.query(
        `SELECT
            td.dispatch_id,
            td.total_liters,
            td.avg_fat,
            td.avg_snf,
            td.factory_name,
            td.vehicle_no,
            td.driver_name,
            td.factory_rate,
            td.total_amount,
            td.remarks,
            op.name AS operator_name
        FROM tank_dispatch td
        JOIN operators op ON op.operator_id = td.operator_id
        WHERE td.dispatch_date = ?
        ORDER BY td.created_at ASC`,
        [date]
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 7. Owner usage for a date
// ─────────────────────────────────────────────────────────────
const getOwnerUsage = async (date) => {
    const [rows] = await pool.query(
        `SELECT
            ou.usage_id,
            ou.shift,
            ou.milk_type,
            ou.quantity,
            ou.purpose,
            op.name AS operator_name
        FROM owner_usage ou
        JOIN operators op ON op.operator_id = ou.operator_id
        WHERE ou.usage_date = ?
        ORDER BY ou.shift ASC`,
        [date]
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────
// 8. Full report — all data for a date in one call
// ─────────────────────────────────────────────────────────────
const getFullDayReport = async (date) => {
    const [
        dayTotals,
        shiftSummary,
        sellerSummary,
        walkinSummary,
        tankDispatch,
        ownerUsage,
    ] = await Promise.all([
        getDayTotals(date),
        getShiftSummary(date),
        getSellerDailySummary(date),
        getWalkinSummary(date),
        getTankDispatch(date),
        getOwnerUsage(date),
    ]);

    return {
        date,
        day_totals: dayTotals,
        shift_summary: shiftSummary,
        seller_summary: sellerSummary,
        walkin_summary: walkinSummary,
        tank_dispatch: tankDispatch,
        owner_usage: ownerUsage,
    };
};

module.exports = {
    getDailyEntries,
    getShiftSummary,
    getDayTotals,
    getSellerDailySummary,
    getWalkinSummary,
    getTankDispatch,
    getOwnerUsage,
    getFullDayReport,
};