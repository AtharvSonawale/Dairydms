const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');

// Public routes
router.post('/admin/login', auth.adminLogin);
router.post('/admin/signup', auth.adminSignup);
router.post('/operator/login', auth.operatorLogin);
router.post('/seller/login', auth.sellerLogin);
router.post('/seller/set-password', auth.sellerSetPassword);
router.post('/forgot-password', auth.forgotPassword);
router.post('/verify-otp', auth.verifyOtp);
router.post('/reset-password', auth.resetPassword);
// router.get('/farmer/my-entries', requireRole('seller'), auth.getMyEntriesHandler);

// Dairy and Centre routes (public for signup)
router.get('/dairies/active', auth.getActiveDairies);
router.get('/centres/active', auth.getActiveCentresByDairy);

module.exports = router;