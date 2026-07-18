const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/cattleFeed.controller');

// ── Cattle Feed Catalogue ─────────────────────────────────────
router.get('/', protect, ctrl.getFeeds);
router.post('/', protect, ctrl.createFeed);
router.put('/:id', protect, ctrl.updateFeed);
router.delete('/:id', protect, ctrl.deleteFeed);


module.exports = router;