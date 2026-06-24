const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { markTourSeen } = require('../controllers/tour.controller');

// PUT /api/admin/mark-tour-seen
// Marks the currently logged-in admin's tour as seen (has_seen_tour = 1).
router.put('/mark-tour-seen', authenticate, requireRole('admin'), markTourSeen);

module.exports = router;