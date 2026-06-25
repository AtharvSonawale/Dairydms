const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const {
    getPortSettings,
    savePortSettings,
    testPortConnection,
} = require('../controllers/ports.controller');

router.use(protect);

router.get('/', getPortSettings);
router.post('/', savePortSettings);
router.post('/test', testPortConnection);

module.exports = router;