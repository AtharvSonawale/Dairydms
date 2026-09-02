// backend/routes/rate.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/rate.controller');
const correctionCtrl = require('../controllers/rate-correction.controller');

// copy-forward and premium MUST be before /:id
// otherwise Express matches "copy-forward" as id param
router.post('/copy-forward', protect, isAdmin, ctrl.copyForward);
router.get('/auto-carry-forward', protect, ctrl.getAutoCarryForwardSetting);
router.put('/auto-carry-forward', protect, isAdmin, ctrl.updateAutoCarryForwardSetting);
router.post('/generate', protect, ctrl.generateRates);
router.post('/premium', protect, isAdmin, ctrl.assignPremiumRate);
router.get('/premium', protect, ctrl.getPremiumRates);
router.put('/premium/:id', protect, isAdmin, ctrl.updatePremiumRate);
router.patch('/premium/:id/deactivate', protect, isAdmin, ctrl.deactivatePremiumRate);
router.delete('/premium/:id', protect, isAdmin, ctrl.deletePremiumRate);

// ── Date Range Operations ──
// GET  — preview rates in date range (both admin and operator can view)
// DELETE — delete rates in date range (admin only)
router.get('/range', protect, ctrl.getRatesByDateRange);
router.delete('/range', protect, isAdmin, ctrl.deleteRatesByDateRange);

// GET  — both admin and operator can view rates
// POST — both can add rates
router.get('/lookup', protect, ctrl.lookupRate);
router.get('/pending-adjustments', protect, correctionCtrl.getPendingAdjustments);
router.post('/recompute-preview', protect, isAdmin, correctionCtrl.previewRecompute);
router.post('/recompute-apply', protect, isAdmin, correctionCtrl.applyRecompute);
router.get('/', protect, ctrl.getRates);
router.post('/', protect, ctrl.createRate);
router.delete('/all', protect, isAdmin, ctrl.deleteAllRates);

// Import routes
router.post('/import', protect, isAdmin, ctrl.importRates);
router.post('/import/update', protect, isAdmin, ctrl.importUpdateRates);

// PUT / DELETE — admin only
// milk_type passed as query param: /api/rates/5?milk_type=cow
router.put('/:id', protect, isAdmin, ctrl.updateRate);
router.delete('/:id', protect, isAdmin, ctrl.deleteRate);

module.exports = router;