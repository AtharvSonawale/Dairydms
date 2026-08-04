const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/operator.controller');

router.get('/', protect, isAdmin, ctrl.listOperators);
router.get('/all', protect, isAdmin, ctrl.listAllOperators);
router.get('/me', protect, ctrl.getMyOperatorProfile);
router.post('/', protect, isAdmin, ctrl.createOperator);
router.put('/:id', protect, isAdmin, ctrl.updateOperator);
router.delete('/:id', protect, isAdmin, ctrl.deleteOperator);
router.get('/:id', protect, isAdmin, ctrl.getOperator);
router.patch('/:id/toggle-status', protect, isAdmin, ctrl.toggleOperatorStatus);

module.exports = router;