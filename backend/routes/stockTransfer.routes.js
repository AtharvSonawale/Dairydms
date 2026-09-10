// backend/routes/stockTransfer.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/stockTransfer.controller');
const stockCtrl = require('../controllers/stock.controller');

// Stock lookups (used by Stock Transfer page)
router.get('/stock/available', auth, stockCtrl.getAvailableStock);
router.get('/stock/products', auth, stockCtrl.getAvailableProducts);
router.get('/stock/feeds', auth, stockCtrl.getAvailableFeeds);
router.get('/stock/transferable', auth, stockCtrl.getTransferableStock);

// Transfers
router.get('/stock-transfers', auth, ctrl.listTransfers);
router.get('/stock-transfers/stats', auth, ctrl.getStats);
router.get('/stock-transfers/eligible-centres', auth, ctrl.getEligibleCentres);
router.get('/stock-transfers/:id', auth, ctrl.getTransferDetail);
router.post('/stock-transfers', auth, ctrl.createTransfer);
router.put('/stock-transfers/:id/approve', auth, ctrl.approveTransfer);
router.put('/stock-transfers/:id/reject', auth, ctrl.rejectTransfer);
router.delete('/stock-transfers/:id', auth, ctrl.cancelTransfer);

module.exports = router;