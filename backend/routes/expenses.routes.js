const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/expenses.controller');

// ══════════════════════════════════════════════════════════════
//  GET /api/expenses?date=YYYY-MM-DD
//  GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
//  Get expense entries for a date or range (centre-scoped)
// ══════════════════════════════════════════════════════════════
router.get('/', protect, ctrl.getEntries);

// ══════════════════════════════════════════════════════════════
//  GET /api/expenses/summary?date=YYYY-MM-DD
//  GET /api/expenses/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//  Get totals for a date or range (centre-scoped)
// ══════════════════════════════════════════════════════════════
router.get('/summary', protect, ctrl.getSummary);

// ══════════════════════════════════════════════════════════════
//  GET /api/expenses/centre-summary (Admin only)
//  Overall expense summary for the centre
// ══════════════════════════════════════════════════════════════
router.get('/centre-summary', protect, ctrl.getCentreSummary);

// ══════════════════════════════════════════════════════════════
//  POST /api/expenses
//  Record a new expense entry
// ══════════════════════════════════════════════════════════════
router.post('/', protect, ctrl.createEntry);

// ══════════════════════════════════════════════════════════════
//  PUT /api/expenses/:id
//  Update an expense entry
// ══════════════════════════════════════════════════════════════
router.put('/:id', protect, ctrl.updateEntry);

// ══════════════════════════════════════════════════════════════
//  DELETE /api/expenses/:id
//  Remove an expense entry
// ══════════════════════════════════════════════════════════════
router.delete('/:id', protect, ctrl.deleteEntry);

module.exports = router;