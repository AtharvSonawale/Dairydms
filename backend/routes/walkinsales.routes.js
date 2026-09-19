// routes/walkinsales.routes.js
// Mounted in app.js as:  app.use('/api/walkin-sales', walkinRoutes);
//
// RULE: every fixed-path route (e.g. '/buyer-settings') must be registered
// BEFORE the '/:id' routes at the bottom, otherwise Express treats the fixed
// word as an :id and calls updateSale/deleteSale -> "Sale not found" 404.

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/walkinsales.controller');

// ── Sales: list + create ─────────────────────────────────────
router.get('/', protect, ctrl.getSales);
router.post('/', protect, ctrl.createSale);

// ── Stock & summaries ────────────────────────────────────────
router.get('/available-stock', protect, ctrl.getAvailableStock);
router.get('/billing-summary', protect, ctrl.getBillingSummary);

// ── MRP rates (Flutter calls /api/walkin-sales/mrp-rates) ────
router.get('/mrp-rates', protect, ctrl.getMRPRates);
router.post('/mrp-rates', protect, ctrl.saveMRPRates);

// ── Buyer-type visibility settings ───────────────────────────
router.get('/buyer-settings', protect, ctrl.getBuyerSettings);
router.put('/buyer-settings', protect, ctrl.updateBuyerSettings);

// ── Product types ────────────────────────────────────────────
router.get('/product-types', protect, ctrl.getProductTypes);
router.post('/product-types', protect, ctrl.saveProductType);
router.put('/product-types/:id', protect, ctrl.updateProductType);
router.delete('/product-types/:id', protect, ctrl.deleteProductType);

// ── Named buyers ─────────────────────────────────────────────
router.get('/named-buyers', protect, ctrl.getNamedBuyers);
router.post('/named-buyers', protect, ctrl.saveNamedBuyer);
router.put('/named-buyers/:id', protect, ctrl.updateNamedBuyer);
router.patch('/named-buyers/:id/status', protect, ctrl.toggleBuyerStatus);
router.delete('/named-buyers/:id', protect, ctrl.deleteNamedBuyer);

// ── Named buyer balances / bill clearing ─────────────────────
router.get('/named-buyer-balance/:buyerId', protect, ctrl.getNamedBuyerBalance);
router.get('/named-buyer-summaries', protect, ctrl.getNamedBuyerSummaries);
router.post('/clear-buyer-bill', protect, ctrl.clearBuyerBill);

// ── Single-sale update/delete (KEEP LAST) ────────────────────
router.put('/:id', protect, ctrl.updateSale);
router.delete('/:id', protect, ctrl.deleteSale);

module.exports = router;