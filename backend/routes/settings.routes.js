const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const upload = require('../middleware/upload');
const settingsController = require('../controllers/settings.controller');

// Global settings
router.get('/global', protect, settingsController.getGlobalSettings);
router.post('/global', protect, settingsController.saveGlobalSettings);
router.post('/logo', protect, upload.single('logo'), settingsController.uploadLogo);

// Dispatch settings - FSSAI Code
router.get('/dispatch', protect, settingsController.getDispatchSettings);
router.post('/dispatch', protect, isAdmin, settingsController.saveDispatchSettings);

// App settings
router.get('/app', protect, settingsController.getAppSettings);
router.post('/app', protect, settingsController.saveAppSettings);

// Operator permissions
router.get('/permissions/:operatorId', protect, settingsController.getPermissions);
router.post('/permissions/:operatorId', protect, settingsController.savePermissions);
router.post('/permissions/apply-defaults', protect, isAdmin, settingsController.applyDefaults);

// Centre settings
router.get('/centre', protect, isAdmin, settingsController.getCentreSettings);
router.post('/centre', protect, isAdmin, settingsController.saveCentreSettings);

// Data management
router.post('/clear-data', protect, settingsController.clearAllData);

// System info
router.get('/system-info', protect, settingsController.getSystemInfo);

// Page visibility (per-page, per-platform, applies to all roles)
router.get('/page-visibility', protect, settingsController.getPageVisibility);
router.post('/page-visibility', protect, isAdmin, settingsController.savePageVisibility);

// Receipt print settings (centre-level: thermal/A4, paper width)
router.get('/print', protect, settingsController.getPrintSettings);
router.post('/print', protect, isAdmin, settingsController.savePrintSettings);

// Receipt template (shared header/footer format across all receipt printers)
router.get('/receipt-template', protect, settingsController.getReceiptTemplate);
router.post('/receipt-template', protect, isAdmin, settingsController.saveReceiptTemplate);

module.exports = router;