const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/cattleFeedSalesReport.controller');

// ── Cattle Feed Sales Report Routes ──────────────────────────

// GET /api/cattle-feed-sales/report
//   Full report with transactions, items, and summary stats
//   Query params: from, to, seller_type, buyer_type, feed_id,
//   seller_id, operator_id, min_amount, max_amount, supplier_name
router.get('/report', protect, ctrl.getSalesReport);

// GET /api/cattle-feed-sales/report/summary
//   Quick summary stats for dashboard
//   Query params: from, to (optional)
router.get('/report/summary', protect, ctrl.getReportSummary);

// GET /api/cattle-feed-sales/report/export
//   Export report data as CSV or JSON
//   Query params: from, to, format (csv|json), ...filters
router.get('/report/export', protect, ctrl.exportReport);

module.exports = router;