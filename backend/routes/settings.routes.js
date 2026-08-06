const router = require('express').Router();
const protect = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const settingsController = require('../controllers/settings.controller');

// Global settings
router.get('/global', protect, settingsController.getGlobalSettings);
router.post('/global', protect, settingsController.saveGlobalSettings);

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

module.exports = router;