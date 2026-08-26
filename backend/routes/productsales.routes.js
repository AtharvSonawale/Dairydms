// ── Combined routes file (product-sales.js) ──────────────────
const router = require('express').Router();
const protect = require('../middleware/auth');

// Import controllers
const salesCtrl = require('../controllers/productsales.controller');
const reportCtrl = require('../controllers/productSalesReport.controller');

// ── Main Product Sales (CRUD) ──────────────────────────────
router.get('/transactions', protect, salesCtrl.getTransactions);
router.get('/', protect, salesCtrl.getSales);
router.post('/', protect, salesCtrl.createSale);
router.put('/:id', protect, salesCtrl.updateSale);
router.put('/transaction/:transaction_id', protect, salesCtrl.updateTransaction);
router.delete('/:id', protect, salesCtrl.deleteSale);

// ── Speed Products ──────────────────────────────────────────
router.get('/speed-products', protect, salesCtrl.getSpeedProducts);
router.post('/speed-products', protect, salesCtrl.createSpeedProduct);
router.put('/speed-products/:id', protect, salesCtrl.updateSpeedProduct);
router.delete('/speed-products/:id', protect, salesCtrl.deleteSpeedProduct);

// ── Named Buyers ────────────────────────────────────────────
router.get('/named-buyers', protect, salesCtrl.getProductNamedBuyers);
router.post('/named-buyers', protect, salesCtrl.createProductNamedBuyer);

// ── Report Routes ────────────────────────────────────────────
router.get('/report', protect, reportCtrl.getSalesReport);
router.get('/report/summary', protect, reportCtrl.getReportSummary);
router.get('/report/export', protect, reportCtrl.exportReport);

module.exports = router;