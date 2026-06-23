// backend/routes/stock.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/stock.controller');

// GET /api/stock/available?date=YYYY-MM-DD
// Returns remaining milk stock after walkin, owner usage, and dispatches
router.get('/available', protect, ctrl.getAvailableStock);

module.exports = router;