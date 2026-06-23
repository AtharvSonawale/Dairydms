const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/operator.controller');

router.get('/', protect, isAdmin, ctrl.listOperators);
router.post('/', protect, isAdmin, ctrl.createOperator);
router.put('/:id', protect, isAdmin, ctrl.updateOperator);
router.delete('/:id', protect, isAdmin, ctrl.deleteOperator);

module.exports = router;