const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/milkEntry.controller');

// GET /api/milk-entries?date=YYYY-MM-DD
router.get('/', protect, ctrl.getEntries);

// GET /api/milk-entries/premium-rate?seller_id=&milk_type=&date=
router.get('/premium-rate', protect, ctrl.getPremiumRate);

// POST /api/milk-entries
router.post('/', protect, ctrl.createEntry);

// PUT /api/milk-entries/:id
router.put('/:id', protect, isAdmin, ctrl.updateEntry);

// DELETE /api/milk-entries/:id
router.delete('/:id', protect, isAdmin, ctrl.deleteEntry);

module.exports = router;