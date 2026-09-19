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

// PATCH /api/admins/:id/status — activate / deactivate another admin
// in the same centre. Self-protection + centre-scoping live in the
// controller. Registered BEFORE '/:id' so 'status' is never captured
// as an id param.
router.patch('/:id/status', authenticate, requireRole('admin'), admins.updateAdminStatus);

// PUT /api/admins/:id/manage — centre-scoped edit of another admin's
// name / email / mobile. Distinct from PUT /:id (own profile) so the
// "you can only edit yourself" rule on PUT /:id stays intact.
// Registered BEFORE '/:id' for the same reason as above.
router.put('/:id/manage', authenticate, requireRole('admin'), admins.manageUpdateAdmin);

// DELETE /api/admins/:id — remove another admin in the same centre.
router.delete('/:id', authenticate, requireRole('admin'), admins.deleteAdmin);

// PUT /api/admins/:id — update the requesting admin's own profile.
// Ownership (id must equal the requester's own admin_id) is enforced
// inside the controller, not here.
router.put('/:id', authenticate, requireRole('admin'), admins.updateAdmin);

module.exports = router;

// ── Wiring reminder for app.js / server.js ──────────────────────────────
// const adminsRoutes = require('./routes/admins.routes');
// app.use('/api/admins', adminsRoutes);