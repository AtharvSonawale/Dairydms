const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/commission.controller');

router.use(protect);
router.get('/settings', ctrl.getSettings);
router.post('/settings', ctrl.saveSettings);
router.get('/preview', ctrl.previewCommission);

module.exports = router;