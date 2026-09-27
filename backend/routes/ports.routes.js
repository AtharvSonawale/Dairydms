const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
    getPortSettings,
    savePortSettings,
    testPortConnection,
    listAvailablePorts,
    closePort,
    getWeightStatus,
    connectWeightMachine,
    disconnectWeightMachine,
    getFatStatus,
    connectFatMachine,
    disconnectFatMachine,
    getWeightConfig,
    saveWeightConfig,
} = require('../controllers/ports.controller');

router.use(protect);

router.get('/', getPortSettings);
router.post('/', savePortSettings);
router.post('/test', testPortConnection);
router.get('/available', listAvailablePorts);
router.post('/close', closePort);

router.get('/weight/:subtype/status', getWeightStatus);
router.post('/weight/:subtype/connect', connectWeightMachine);
router.post('/weight/:subtype/disconnect', disconnectWeightMachine);

router.get('/fat/:subtype/status', getFatStatus);
router.post('/fat/:subtype/connect', connectFatMachine);
router.post('/fat/:subtype/disconnect', disconnectFatMachine);
router.get('/weight-config', getWeightConfig);
router.post('/weight-config', saveWeightConfig);

module.exports = router;