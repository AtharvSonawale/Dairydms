// backend/routes/rate.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/rate.controller');

// copy-forward and premium MUST be before /:id
// otherwise Express matches "copy-forward" as id param
router.post('/copy-forward', protect, isAdmin, ctrl.copyForward);
router.post('/generate', protect, ctrl.generateRates);
router.post('/premium', protect, isAdmin, ctrl.assignPremiumRate);
router.get('/premium', protect, ctrl.getPremiumRates);
router.put('/premium/:id', protect, isAdmin, ctrl.updatePremiumRate);
router.patch('/premium/:id/deactivate', protect, isAdmin, ctrl.deactivatePremiumRate);
router.delete('/premium/:id', protect, isAdmin, ctrl.deletePremiumRate);

// GET  — both admin and operator can view rates
// POST — both can add rates
router.get('/lookup', protect, ctrl.lookupRate);  // ← add this line
router.get('/', protect, ctrl.getRates);
router.post('/', protect, ctrl.createRate);
router.delete('/all', protect, isAdmin, ctrl.deleteAllRates);   // ← ADD before /:id routes


// PUT / DELETE — admin only
// milk_type passed as query param: /api/rates/5?milk_type=cow
router.put('/:id', protect, isAdmin, ctrl.updateRate);
router.delete('/:id', protect, isAdmin, ctrl.deleteRate);


module.exports = router;