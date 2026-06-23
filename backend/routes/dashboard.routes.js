// backend/routes/dashboard.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/dashboard.controller');

// ── Dashboard ─────────────────────────────────────────────────
// GET /api/dashboard?date=YYYY-MM-DD
//   → Full payload: all raw rows + computed stats.
//     Use this for the initial page load of the dashboard.
//
// GET /api/dashboard/summary?date=YYYY-MM-DD
//   → Stat cards only (pure SQL aggregation, no row data).
//     Use this for lightweight auto-refresh of stat cards
//     without re-rendering the detail tables.

// IMPORTANT: /summary must be before / so Express doesn't
// treat the string "summary" as a query param on the root route.
router.get('/summary', protect, ctrl.getSummary);
router.get('/', protect, ctrl.getDashboard);


module.exports = router;