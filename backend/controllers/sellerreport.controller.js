// controllers/sellerReportController.js
const {
    getAllSellers,
    getMilkEntriesByRange,
    getProductSalesByRange,
    getCashAdvanceByRange,
    getCashDepositByRange,
    getSellerMonthlySummary,
    getMonthGrandTotals,
} = require("../model/sellerreport.model");

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

/**
 * Derive the first and last calendar day for a given YYYY-MM string,
 * or accept explicit start_date / end_date query params.
 * Priority: start_date + end_date > month > current month
 */
const resolveDateRange = (query) => {
    const { start_date, end_date, month } = query;

    if (start_date && end_date) {
        return { startDate: start_date, endDate: end_date };
    }

    const ym = month || new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const [y, m] = ym.split("-").map(Number);
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();            // day-0 of next month = last day of this
    const endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    return { startDate, endDate };
};

const validateDateRange = (startDate, endDate, res) => {
    if (!startDate || !endDate) {
        res.status(400).json({ error: "Provide month (YYYY-MM) or start_date + end_date." });
        return false;
    }
    if (startDate > endDate) {
        res.status(400).json({ error: "start_date must be ≤ end_date." });
        return false;
    }
    return true;
};

// ─────────────────────────────────────────────────────────────
// GET /api/seller-report/sellers
//   Returns all sellers (no date dependency)
// ─────────────────────────────────────────────────────────────
const getSellers = async (req, res) => {
    try {
        const sellers = await getAllSellers();
        res.json(sellers);
    } catch (err) {
        console.error("getSellers error:", err);
        res.status(500).json({ error: "Failed to fetch sellers." });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/seller-report/summary
//   ?month=YYYY-MM  OR  ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
//   Returns one aggregated row per seller + grand totals
// ─────────────────────────────────────────────────────────────
const getMonthlySummary = async (req, res) => {
    try {
        const { startDate, endDate } = resolveDateRange(req.query);
        if (!validateDateRange(startDate, endDate, res)) return;

        const [summary, totals] = await Promise.all([
            getSellerMonthlySummary(startDate, endDate),
            getMonthGrandTotals(startDate, endDate),
        ]);

        res.json({
            start_date: startDate,
            end_date: endDate,
            grand_totals: totals,
            sellers: summary,
        });
    } catch (err) {
        console.error("getMonthlySummary error:", err);
        res.status(500).json({ error: "Failed to generate monthly summary." });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/seller-report/milk-entries
//   ?month=YYYY-MM  OR  ?start_date=&end_date=
//   ?seller_id=N        (optional — omit for all sellers)
// ─────────────────────────────────────────────────────────────
const getMilkEntries = async (req, res) => {
    try {
        const { startDate, endDate } = resolveDateRange(req.query);
        if (!validateDateRange(startDate, endDate, res)) return;

        const sellerId = req.query.seller_id ? parseInt(req.query.seller_id, 10) : null;
        if (req.query.seller_id && isNaN(sellerId)) {
            return res.status(400).json({ error: "seller_id must be a number." });
        }

        const entries = await getMilkEntriesByRange(startDate, endDate, sellerId);
        res.json(entries);
    } catch (err) {
        console.error("getMilkEntries error:", err);
        res.status(500).json({ error: "Failed to fetch milk entries." });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/seller-report/product-sales
//   ?month=YYYY-MM  OR  ?start_date=&end_date=
//   ?seller_id=N        (optional)
// ─────────────────────────────────────────────────────────────
const getProductSales = async (req, res) => {
    try {
        const { startDate, endDate } = resolveDateRange(req.query);
        if (!validateDateRange(startDate, endDate, res)) return;

        const sellerId = req.query.seller_id ? parseInt(req.query.seller_id, 10) : null;
        if (req.query.seller_id && isNaN(sellerId)) {
            return res.status(400).json({ error: "seller_id must be a number." });
        }

        const sales = await getProductSalesByRange(startDate, endDate, sellerId);
        res.json(sales);
    } catch (err) {
        console.error("getProductSales error:", err);
        res.status(500).json({ error: "Failed to fetch product sales." });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/seller-report/cash-advance
//   ?month=YYYY-MM  OR  ?start_date=&end_date=
//   ?seller_id=N        (optional)
// ─────────────────────────────────────────────────────────────
const getCashAdvance = async (req, res) => {
    try {
        const { startDate, endDate } = resolveDateRange(req.query);
        if (!validateDateRange(startDate, endDate, res)) return;

        const sellerId = req.query.seller_id ? parseInt(req.query.seller_id, 10) : null;
        if (req.query.seller_id && isNaN(sellerId)) {
            return res.status(400).json({ error: "seller_id must be a number." });
        }

        const advances = await getCashAdvanceByRange(startDate, endDate, sellerId);
        res.json(advances);
    } catch (err) {
        console.error("getCashAdvance error:", err);
        res.status(500).json({ error: "Failed to fetch cash advances." });
    }
};

const getSellerDeposits = async (req, res) => {
    try {
        const sellerId = parseInt(req.params.id, 10);
        const [rows] = await db.query(
            `SELECT 
                cd.id,
                cd.seller_id,
                cd.operator_id,
                'deposit' AS type,
                cd.amount,
                cd.transaction_date,
                cd.remarks,
                cd.created_at
             FROM seller_deposits cd
             WHERE cd.seller_id = ?
             ORDER BY cd.transaction_date DESC`,
            [sellerId]
        );
        res.json(rows);
    } catch (err) {
        console.error("getSellerDeposits error:", err);
        res.status(500).json({ error: "Failed to fetch deposits." });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/seller-report/detail/:sellerId
//   ?month=YYYY-MM  OR  ?start_date=&end_date=
//   Returns milk entries + product sales + advances for ONE seller
//   (single round-trip for the expanded row)
// ─────────────────────────────────────────────────────────────
const getSellerDetail = async (req, res) => {
    try {
        const sellerId = parseInt(req.params.sellerId, 10);
        if (isNaN(sellerId)) {
            return res.status(400).json({ error: "Invalid seller_id." });
        }

        const { startDate, endDate } = resolveDateRange(req.query);
        if (!validateDateRange(startDate, endDate, res)) return;

        const [entries, productSales, advances] = await Promise.all([
            getMilkEntriesByRange(startDate, endDate, sellerId),
            getProductSalesByRange(startDate, endDate, sellerId),
            getCashAdvanceByRange(startDate, endDate, sellerId),
        ]);

        // Compute inline summary for the detail panel
        const totalQty = entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const totalMilkAmt = entries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const prodSalesAmt = productSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
        const advGiven = advances.filter((a) => a.type === "given").reduce((s, a) => s + parseFloat(a.amount || 0), 0);
        const advReceived = advances.filter((a) => a.type === "received").reduce((s, a) => s + parseFloat(a.amount || 0), 0);
        const avgFat = entries.length ? entries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / entries.length : 0;
        const avgSnf = entries.length ? entries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / entries.length : 0;

        res.json({
            seller_id: sellerId,
            start_date: startDate,
            end_date: endDate,
            summary: {
                totalQty,
                totalMilkAmt,
                prodSalesAmt,
                advGiven,
                advReceived,
                avgFat,
                avgSnf,
                netPayable: totalMilkAmt - prodSalesAmt - (advGiven - advReceived),
                entryCount: entries.length,
                activeDays: [...new Set(entries.map((e) => e.entry_date))].length,
            },
            entries,
            productSales,
            advances,
        });
    } catch (err) {
        console.error("getSellerDetail error:", err);
        res.status(500).json({ error: "Failed to fetch seller detail." });
    }
};

module.exports = {
    getSellers,
    getMonthlySummary,
    getMilkEntries,
    getProductSales,
    getCashAdvance,
    getSellerDeposits,
    getSellerDetail,
};