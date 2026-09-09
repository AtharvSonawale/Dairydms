const router = require('express').Router();
const admins = require('../controllers/admins.controller');
const { authenticate, requireRole } = require('../middleware/auth');


// Only a logged-in admin can create or list admins, and only within
// their own centre (enforced inside the controller via req.user.centre_id).
router.post('/', authenticate, requireRole('admin'), admins.createAdmin);
router.get('/', authenticate, requireRole('admin'), admins.listAdmins);

// GET /api/admins/me — the requesting admin's own profile.
// Registered before '/:id' so 'me' is never captured as an id param.
router.get('/me', authenticate, requireRole('admin'), admins.getMe);

// PUT /api/admins/:id — update the requesting admin's own profile.
// Ownership (id must equal the requester's own admin_id) is enforced
// inside the controller, not here.
router.put('/:id', authenticate, requireRole('admin'), admins.updateAdmin);

module.exports = router;

// ── Wiring reminder for app.js / server.js ──────────────────────────────
// const adminsRoutes = require('./routes/admins.routes');
// app.use('/api/admins', adminsRoutes);