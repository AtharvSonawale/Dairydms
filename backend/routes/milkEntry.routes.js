const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const ctrl = require('../controllers/milkEntry.controller');

// ── GET /api/milk-entries ──
// Query params:
//   ?date=YYYY-MM-DD (single day)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD (date range)
//   &seller_type=Utpadak|Gavali (optional filter)
router.get('/', protect, ctrl.getEntries);

// ── GET /api/milk-entries/all (Admin only) ──
// Same query params as above, but returns all entries in the centre
router.get('/all', protect, isAdmin, ctrl.getAllCentreEntries);

// ── GET /api/milk-entries/premium-rate ──
// Query params: ?seller_id=&milk_type=&date=
router.get('/premium-rate', protect, ctrl.getPremiumRate);

// ── GET /api/milk-entries/by-operator (Admin only) ──
// Query params: ?operator_id=&from=&to=&seller_type=
router.get('/by-operator', protect, isAdmin, ctrl.getEntriesByOperator);

// ── GET /api/milk-entries/summary (Admin only) ──
// Query params: ?from=&to=&seller_type=
router.get('/summary', protect, isAdmin, ctrl.getCentreSummary);

// ── GET /api/milk-entries/stats ──
// Query params: ?date=YYYY-MM-DD
router.get('/stats', protect, ctrl.getDailyStats);

// ── GET /api/milk-entries/export ──
// Query params: ?from=&to=&seller_type=
router.get('/export', protect, ctrl.exportEntries);

// ── POST /api/milk-entries ──
// Body: { seller_id, seller_type, entry_date, shift, milk_type, 
//         quantity, fat, snf, water, rate_applied, total_amount, machine_qty }
router.post('/', protect, ctrl.createEntry);

// ── PUT /api/milk-entries/:id ──
// Admin only - updates any entry
// Body: { shift, milk_type, seller_type, quantity, fat, snf, 
//         water, rate_applied, total_amount, machine_qty }
router.put('/:id', protect, isAdmin, ctrl.updateEntry);

// ── DELETE /api/milk-entries/:id ──
// Admin only - deletes any entry
router.delete('/:id', protect, isAdmin, ctrl.deleteEntry);

// ── DELETE /api/milk-entries/bulk ──
// Admin only - bulk delete
// Body: { entry_ids: [1, 2, 3, ...] }
router.delete('/bulk', protect, isAdmin, ctrl.bulkDeleteEntries);

module.exports = router;