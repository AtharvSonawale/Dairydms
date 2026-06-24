const router = require('express').Router();
const admins = require('../controllers/admins.controller');
const { authenticate, requireRole } = require('../middleware/auth');


// Only a logged-in admin can create or list admins, and only within
// their own centre (enforced inside the controller via req.user.centre_id).
router.post('/', authenticate, requireRole('admin'), admins.createAdmin);
router.get('/', authenticate, requireRole('admin'), admins.listAdmins);


module.exports = router;

// ── Wiring reminder for app.js / server.js ──────────────────────────────
// const adminsRoutes = require('./routes/admins.routes');
// app.use('/api/admins', adminsRoutes);