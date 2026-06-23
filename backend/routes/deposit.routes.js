// backend/routes/deposit.routes.js
const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/deposit.controller');

// IMPORTANT: /balance/:sellerId must be before /:id so Express
// does not treat the string "balance" as a numeric id param.
router.get('/balance/:sellerId', protect, ctrl.getBalance);

router.get('/', protect, ctrl.getDeposits);
router.post('/', protect, ctrl.createDeposit);
router.delete('/:id', protect, ctrl.deleteDeposit);

module.exports = router;