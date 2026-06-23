// backend/routes/cashadvance.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/cashAdvance.controller');

// IMPORTANT: /previous/:sellerId must be before /:id so Express
// does not treat the string "previous" as a numeric id param.
router.get('/previous/:sellerId', protect, ctrl.getPrevious);
router.get('/register/:sellerId', protect, ctrl.getSellerRegister);

router.get('/', protect, ctrl.getEntries);
router.post('/', protect, ctrl.createEntry);
router.delete('/:id', protect, ctrl.deleteEntry);

module.exports = router;