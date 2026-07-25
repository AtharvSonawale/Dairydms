const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/cattleFeedPayment.controller');

// All routes require authentication
router.use(protect);

// ── Summary and payment actions ──────────────────────────────
router.get('/summary', ctrl.getSummary);
router.post('/mark-paid', ctrl.markPaid);

// ── Bill operations ──────────────────────────────────────────
router.get('/bills/search', ctrl.searchBills);
router.get('/bill/:bill_no', ctrl.getBill);
router.delete('/bill/:bill_no', ctrl.deleteBill);

// ── Excel export ─────────────────────────────────────────────
router.get('/export-excel', ctrl.exportExcel);

module.exports = router;