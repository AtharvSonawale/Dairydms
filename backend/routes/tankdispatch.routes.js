const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/tankDispatch.controller');
const isAdmin = require('../middleware/isAdmin');

// GET  /api/tank-dispatch?date=YYYY-MM-DD  → all dispatches for that date
// POST /api/tank-dispatch                  → record new dispatch
// DELETE /api/tank-dispatch/:id            → remove a dispatch
router.get('/history', protect, ctrl.getHistory);
router.get('/', protect, ctrl.getDispatches);
router.post('/', protect, ctrl.createDispatch);
router.delete('/:id', protect, ctrl.deleteDispatch);
router.put('/:id', protect, isAdmin, ctrl.updateDispatch);

// ─── Dispatch Settings Routes ──────────────────────────────
// GET  /api/settings/dispatch  → get FSSAI code
// POST /api/settings/dispatch  → save FSSAI code
router.get('/settings/dispatch', protect, ctrl.getDispatchSettings);
router.post('/settings/dispatch', protect, isAdmin, ctrl.saveDispatchSettings);

module.exports = router;