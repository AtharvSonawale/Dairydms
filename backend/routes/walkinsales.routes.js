const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/walkinSales.controller');

router.use(protect);

// Walk-in sales routes
router.get('/', ctrl.getSales);
router.post('/', ctrl.createSale);
router.delete('/:id', ctrl.deleteSale);

// MRP rates routes
router.get('/mrp-rates', ctrl.getMRPRates);
router.post('/mrp-rates', ctrl.saveMRPRates);

// Product types routes
router.get('/product-types', ctrl.getProductTypes);
router.post('/product-types', ctrl.saveProductType);
router.delete('/product-types/:id', ctrl.deleteProductType);

// Named buyers routes
router.get('/named-buyers', ctrl.getNamedBuyers);
router.post('/named-buyers', ctrl.saveNamedBuyer);
router.put('/named-buyers/:id', ctrl.updateNamedBuyer);
router.delete('/named-buyers/:id', ctrl.deleteNamedBuyer);
router.patch('/named-buyers/:id/status', ctrl.toggleBuyerStatus);

// Named buyer balance & summaries
router.get('/named-buyer-balance/:buyerId', ctrl.getNamedBuyerBalance);
router.get('/named-buyer-summaries', ctrl.getNamedBuyerSummaries);

// Bill routes
router.post('/clear-buyer-bill', ctrl.clearBuyerBill);
router.get('/billing-summary', ctrl.getBillingSummary);

// Generic sale update — must stay last to avoid swallowing specific routes
router.put('/:id', ctrl.updateSale);

module.exports = router;