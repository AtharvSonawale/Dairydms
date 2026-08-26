const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/productSalesReport.controller');

// ── Product Sales Report Routes ──────────────────────────────

// GET /api/product-sales/report
//   Full report with transactions, items, and summary stats
//   Query params: from, to, seller_type, buyer_type, product_id,
//   seller_id, operator_id, shift, milk_type, min_amount, max_amount
router.get('/report', protect, ctrl.getSalesReport);

// GET /api/product-sales/report/summary
//   Quick summary stats for dashboard
//   Query params: from, to (optional)
router.get('/report/summary', protect, ctrl.getReportSummary);

// GET /api/product-sales/report/export
//   Export report data as CSV or JSON
//   Query params: from, to, format (csv|json), ...filters
router.get('/report/export', protect, ctrl.exportReport);

module.exports = router;