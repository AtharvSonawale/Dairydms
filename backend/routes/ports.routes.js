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
} = require('../controllers/ports.controller');

router.use(protect);

router.get('/', getPortSettings);
router.post('/', savePortSettings);
router.post('/test', testPortConnection);
router.get('/available', listAvailablePorts);
router.post('/close', closePort);

router.get('/weight/status', getWeightStatus);
router.post('/weight/connect', connectWeightMachine);
router.post('/weight/disconnect', disconnectWeightMachine);

router.get('/fat/status', getFatStatus);
router.post('/fat/connect', connectFatMachine);
router.post('/fat/disconnect', disconnectFatMachine);

module.exports = router;