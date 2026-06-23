// routes/dailyCollection.routes.js
const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth"); // same default-export pattern as seller.routes.js

const {
    getReport,
    getEntries,
    getTotals,
    getShiftSummary,
    getSellerSummary,
    getWalkin,
    getDispatch,
    getOwnerUsage,
} = require("../controllers/dailycollection.controller");

router.use(protect); // all routes require login

// ── Main route — single call, full day data ───────────────────
// GET /api/daily-collection/report?date=YYYY-MM-DD
router.get("/report", getReport);

// ── Granular routes — for targeted fetches ────────────────────
// GET /api/daily-collection/entries?date=YYYY-MM-DD
router.get("/entries", getEntries);

// GET /api/daily-collection/totals?date=YYYY-MM-DD
router.get("/totals", getTotals);

// GET /api/daily-collection/shift-summary?date=YYYY-MM-DD
router.get("/shift-summary", getShiftSummary);

// GET /api/daily-collection/sellers?date=YYYY-MM-DD
router.get("/sellers", getSellerSummary);

// GET /api/daily-collection/walkin?date=YYYY-MM-DD
router.get("/walkin", getWalkin);

// GET /api/daily-collection/dispatch?date=YYYY-MM-DD
router.get("/dispatch", getDispatch);

// GET /api/daily-collection/owner-usage?date=YYYY-MM-DD
router.get("/owner-usage", getOwnerUsage);

module.exports = router;

// ── Register in index.js ──────────────────────────────────────
//
//   const dailyCollectionRoutes = require("./routes/dailyCollection.routes");
//   app.use("/api/daily-collection", dailyCollectionRoutes);