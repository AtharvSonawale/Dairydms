const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/commission.controller');

router.use(protect);
router.get('/settings', ctrl.getSettings);
router.post('/settings', ctrl.saveSettings);
router.get('/preview', ctrl.previewCommission);

router.get('/seller-overrides', ctrl.getSellerCommissions);
router.post('/seller-overrides', ctrl.assignSellerCommission);
router.put('/seller-overrides/:id', ctrl.updateSellerCommission);
router.patch('/seller-overrides/:id/deactivate', ctrl.deactivateSellerCommission);
router.delete('/seller-overrides/:id', ctrl.deleteSellerCommission);

module.exports = router;