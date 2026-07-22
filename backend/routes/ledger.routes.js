// Add these lines to your existing payments/router file (wherever
// `/api/payments/...` routes are registered), or create a new
// `routes/ledgerRoutes.js` and mount it as `/api/ledger`.

const express = require('express');
const router = express.Router();
const farmerLedgerController = require('../controllers/farmerledger.controller');
const { authenticate } = require('../middleware/auth');

// Per-farmer summary (advance account, deposit account, last paid bill) —
// used by the main Farmer Ledger list page.
router.get('/summary', authenticate, farmerLedgerController.getFarmerSummaries);

router.get('/', authenticate, farmerLedgerController.getLedger);
router.get('/farmer/:seller_id', authenticate, farmerLedgerController.getFarmerInfo);
router.get('/farmer/:seller_id/milk-entries', authenticate, farmerLedgerController.getFarmerMilkEntries);

module.exports = router;

// In your main app/router setup:
// app.use('/api/ledger', require('./routes/ledgerRoutes'));