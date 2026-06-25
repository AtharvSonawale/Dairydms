const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
    getPermissions,
    savePermissions,
    getAppSettings,
    saveAppSettings,
    getGlobalSettings,
    saveGlobalSettings,
    clearAllData,
} = require('../controllers/settings.controller');
const { getPortSettings, savePortSettings, testPortConnection } = require('../controllers/ports.controller');


router.use(protect);

// Global settings (app name, logo, language, text size)
router.get('/global', getGlobalSettings);
router.post('/global', saveGlobalSettings);

// Per-operator app settings
router.get('/app', getAppSettings);
router.post('/app', saveAppSettings);

// Per-operator permissions
router.get('/permissions/:operatorId', getPermissions);
router.post('/permissions/:operatorId', savePermissions);
router.post('/clear-all-data', clearAllData);

router.get('/ports', getPortSettings);
router.post('/ports', savePortSettings);
router.post('/ports/test', testPortConnection);

module.exports = router;