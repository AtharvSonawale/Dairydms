// controllers/dailyCollection.controller.js
const {
    getDailyEntries,
    getShiftSummary,
    getDayTotals,
    getSellerDailySummary,
    getWalkinSummary,
    getTankDispatch,
    getOwnerUsage,
    getFullDayReport,
} = require("../model/dailyCollection.model");

// ─────────────────────────────────────────────────────────────
// helper — validate & resolve date param
// Accepts ?date=YYYY-MM-DD, defaults to today
// ─────────────────────────────────────────────────────────────
const resolveDate = (query, res) => {
    const raw = query.date;

    if (!raw) {
        // default to today in IST
        const today = new Date();
        const ist = new Date(today.getTime() + 5.5 * 60 * 60 * 1000);
        return ist.toISOString().split("T")[0];
    }

    // basic YYYY-MM-DD format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        res.status(400).json({ message: "date must be in YYYY-MM-DD format." });
        return null;
    }

    return raw;
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/report
//   ?date=YYYY-MM-DD   (defaults to today)
//   Returns the full day report in one API call — used by the
//   main page load so the frontend only needs one request.
// ─────────────────────────────────────────────────────────────
exports.getReport = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const report = await getFullDayReport(date);
        res.json(report);
    } catch (err) {
        console.error("getReport error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/entries
//   ?date=YYYY-MM-DD
//   Raw entry rows (for export / print use)
// ─────────────────────────────────────────────────────────────
exports.getEntries = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const entries = await getDailyEntries(date);
        res.json(entries);
    } catch (err) {
        console.error("getEntries error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/totals
//   ?date=YYYY-MM-DD
//   Single-row grand totals only
// ─────────────────────────────────────────────────────────────
exports.getTotals = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const totals = await getDayTotals(date);
        res.json({ date, ...totals });
    } catch (err) {
        console.error("getTotals error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/shift-summary
//   ?date=YYYY-MM-DD
//   Breakdown by shift × milk_type
// ─────────────────────────────────────────────────────────────
exports.getShiftSummary = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const rows = await getShiftSummary(date);
        res.json({ date, summary: rows });
    } catch (err) {
        console.error("getShiftSummary error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/sellers
//   ?date=YYYY-MM-DD
//   Per-seller rollup with embedded entries array
// ─────────────────────────────────────────────────────────────
exports.getSellerSummary = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const sellers = await getSellerDailySummary(date);
        res.json({ date, sellers });
    } catch (err) {
        console.error("getSellerSummary error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/walkin
//   ?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
exports.getWalkin = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const walkin = await getWalkinSummary(date);
        res.json({ date, walkin });
    } catch (err) {
        console.error("getWalkin error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/dispatch
//   ?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
exports.getDispatch = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const dispatch = await getTankDispatch(date);
        res.json({ date, dispatch });
    } catch (err) {
        console.error("getDispatch error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/daily-collection/owner-usage
//   ?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
exports.getOwnerUsage = async (req, res) => {
    try {
        const date = resolveDate(req.query, res);
        if (!date) return;

        const usage = await getOwnerUsage(date);
        res.json({ date, usage });
    } catch (err) {
        console.error("getOwnerUsage error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};