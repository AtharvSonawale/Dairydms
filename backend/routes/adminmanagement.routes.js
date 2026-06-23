const express = require('express');
const router = express.Router();
const adminManagement = require('../controllers/adminManagement.controller');
const { authenticate, requireRole } = require('../middleware/auth');

// All routes here require a valid token AND the admin role.
// centre-scoping is enforced inside the controller (req.user.centre_id),
// not here — these middlewares only gate role, not centre.
router.use(authenticate, requireRole('admin'));

router.get('/', adminManagement.getAdmins);
router.get('/:id', adminManagement.getAdminById);
router.post('/', adminManagement.createAdmin);
router.put('/:id', adminManagement.updateAdmin);
router.delete('/:id', adminManagement.deleteAdmin);
router.patch('/:id/status', adminManagement.toggleAdminStatus);

module.exports = router;