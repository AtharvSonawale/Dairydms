const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/cattlefeedsales.controller');

// ── Cattle Feed Sales (stock OUT to seller) ──────────────────
// GET  /api/cattle-feed-sales?date=YYYY-MM-DD  → sales for that date (operator-scoped)
// POST /api/cattle-feed-sales                  → record sale + decrement stock

// ── Transactions & grouped views ─────────────────────────────
router.get('/transactions', protect, ctrl.getTransactions);

// ── Speed feeds (quick‑tap strip) ────────────────────────────
router.get('/speed-feeds', protect, ctrl.getSpeedFeeds);
router.post('/speed-feeds', protect, ctrl.createSpeedFeed);
router.put('/speed-feeds/:id', protect, ctrl.updateSpeedFeed);
router.delete('/speed-feeds/:id', protect, ctrl.deleteSpeedFeed);

// ── Main sales endpoints ──────────────────────────────────────
router.get('/', protect, ctrl.getSales);
router.post('/', protect, ctrl.createSale);

// ── Update a single sale line ────────────────────────────────
router.put('/:id', protect, ctrl.updateSale);

// ── Update all lines in a transaction ────────────────────────
router.put('/transaction/:transaction_id', protect, ctrl.updateTransaction);

// ── Delete a single sale line ────────────────────────────────
router.delete('/:id', protect, ctrl.deleteSale);

// ── Admin summary (optional) ──────────────────────────────────
router.get('/summary', protect, ctrl.getSalesSummary);

module.exports = router;