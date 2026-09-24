// backend/routes/actionBar.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/actionBar.controller');

// Preferences are always scoped to the logged-in user (user_id + role + centre_id
// come from req.user inside the controller), so no isAdmin gate is needed here —
// every authenticated user manages only their own ActionBar layout.

router.get('/:pageKey', protect, ctrl.getPreferences);
router.put('/:pageKey', protect, ctrl.savePreferences);
router.delete('/:pageKey', protect, ctrl.resetPreferences);

module.exports = router;