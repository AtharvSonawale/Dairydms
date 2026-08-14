const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/ownerUsage.controller');

// GET    /api/owner-usage?date=YYYY-MM-DD  → entries for that date (operator-scoped)
// POST   /api/owner-usage                  → record new usage entry
// PUT    /api/owner-usage/:id              → update an entry
// DELETE /api/owner-usage/:id              → remove an entry
router.get('/', protect, ctrl.getEntries);
router.get('/summary', protect, ctrl.getSummary);
router.get('/monthly-summary', protect, ctrl.getMonthlySummary);
router.get('/centre-summary', protect, ctrl.getCentreSummary);
router.post('/', protect, ctrl.createEntry);
router.put('/:id', protect, ctrl.updateEntry);
router.delete('/:id', protect, ctrl.deleteEntry);

module.exports = router;