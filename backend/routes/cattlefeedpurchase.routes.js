// backend/routes/cattlefeed.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/cattlefeedpurchase.controller');

// ── Cattle Feeds catalogue ─────────────────────────────────────
// GET  /api/cattle-feeds      → list all feeds (with current stock)
// POST /api/cattle-feeds      → add a new feed to catalogue
router.get('/', protect, ctrl.getFeeds);
router.get('/all', protect, ctrl.getAllCentreFeeds);
router.post('/', protect, ctrl.createFeed);
router.put('/:id', protect, ctrl.updateFeed);
router.delete('/:id', protect, ctrl.deleteFeed);


// ── Cattle Feed Purchases (stock IN) ───────────────────────────
// GET  /api/cattle-feeds/purchases?date=  → purchases for that date
// POST /api/cattle-feeds/purchases        → record purchase + increment stock
router.get('/purchases', protect, ctrl.getPurchases);
router.post('/purchases', protect, ctrl.createPurchase);
router.get('/purchases/suggestions', protect, ctrl.getPurchaseSuggestions);
router.put('/purchases/:id', protect, ctrl.updatePurchase);
router.delete('/purchases/:id', protect, ctrl.deletePurchase);


module.exports = router;