const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');

// Public routes
router.post('/admin/login', auth.adminLogin);
router.post('/admin/signup', auth.adminSignup);
router.post('/operator/login', auth.operatorLogin);
router.post('/forgot-password', auth.forgotPassword);
router.post('/verify-otp', auth.verifyOtp);
router.post('/reset-password', auth.resetPassword);

// Dairy and Centre routes (public for signup)
router.get('/dairies/active', auth.getActiveDairies);
router.get('/centres/active', auth.getActiveCentresByDairy);

module.exports = router;