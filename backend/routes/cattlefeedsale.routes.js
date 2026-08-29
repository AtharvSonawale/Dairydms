// ── Combined routes file (cattle-feed-sales.js) ──────────────
const router = require('express').Router();
const protect = require('../middleware/auth');

// Import controllers
const salesCtrl = require('../controllers/cattlefeedsales.controller');
const reportCtrl = require('../controllers/cattleFeedSalesReport.controller');

// ── Main Cattle Feed Sales (CRUD) ──────────────────────────
router.get('/transactions', protect, salesCtrl.getTransactions);
router.get('/', protect, salesCtrl.getSales);
router.post('/', protect, salesCtrl.createSale);
router.put('/:id', protect, salesCtrl.updateSale);
router.put('/transaction/:transaction_id', protect, salesCtrl.updateTransaction);
router.delete('/:id', protect, salesCtrl.deleteSale);

// ── Speed Feeds ─────────────────────────────────────────────
router.get('/speed-feeds', protect, salesCtrl.getSpeedFeeds);
router.post('/speed-feeds', protect, salesCtrl.createSpeedFeed);
router.put('/speed-feeds/:id', protect, salesCtrl.updateSpeedFeed);
router.delete('/speed-feeds/:id', protect, salesCtrl.deleteSpeedFeed);

// ── Named Buyers ────────────────────────────────────────────
router.get('/named-buyers', protect, salesCtrl.getFeedNamedBuyers);
router.post('/named-buyers', protect, salesCtrl.createFeedNamedBuyer);

// ── Fulfillment (QR pickup verification) ─────────────────────


// ── Report Routes ────────────────────────────────────────────
router.get('/report', protect, reportCtrl.getSalesReport);
router.get('/report/summary', protect, reportCtrl.getReportSummary);
router.get('/report/export', protect, reportCtrl.exportReport);

// ── Admin summary ────────────────────────────────────────────
router.get('/summary', protect, salesCtrl.getSalesSummary);

module.exports = router;