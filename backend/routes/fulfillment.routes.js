// routes/fulfillment.routes.js
const router = require('express').Router();
const protect = require('../middleware/auth');
const fulfillmentCtrl = require('../controllers/fulfillment.controller');

// :type must be "feed" or "product" — validated inside the controller
router.get('/:type/:token', protect, fulfillmentCtrl.getFulfillmentByToken);
router.post('/:type/:token/confirm', protect, fulfillmentCtrl.confirmFulfillment);

module.exports = router;