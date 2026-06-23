const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/operator.controller');

router.use(protect, isAdmin);           // all operator routes → admin only

router.get('/', ctrl.listOperators);
router.post('/', ctrl.createOperator);
router.patch('/:id/toggle', ctrl.toggleOperator);

module.exports = router;