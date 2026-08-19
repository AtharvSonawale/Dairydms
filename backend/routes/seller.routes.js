const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/seller.controller');

router.use(protect); // all seller routes require login

// ✅ Specific static routes FIRST
router.get('/active', ctrl.getActiveSellers);        // ← add this
router.get('/centre', ctrl.listCentreSellers);       // if you have it
router.get('/operator/:operatorId', ctrl.listSellersByOperator); // if you have it
router.post('/import', protect, ctrl.importSellers);
router.post('/bulk-update', protect, ctrl.updateSellersBulk);

// ✅ Then parameterised routes (/:id) and their sub‑routes
router.get('/', ctrl.listSellers);

// All routes that start with /:id/... MUST come BEFORE the bare /:id
router.get('/:id/summary', ctrl.getSellerSummary);
router.get('/:id/entries', ctrl.getSellerEntries);
router.get('/:id/deposit', ctrl.getSellerDeposits);
router.get('/:id/deposit-balance', ctrl.getSellerDepositBalance); // only once
router.get('/:id/advance', ctrl.getSellerAdvance);
router.get('/:id/products', ctrl.getSellerProducts);
router.get('/:id/premium', ctrl.getSellerPremium);

router.get('/:id/commission', ctrl.getSellerCommission);
router.get('/:id/bills', ctrl.getSellerBills);
router.get('/:id/bonus', ctrl.getSellerBonus);
router.get('/:id/cattle-feed', ctrl.getSellerCattleFeed);

// The bare /:id must be LAST among all :id‑based routes
router.get('/:id', ctrl.getSellerById);

// POST, PUT, DELETE (they don't conflict because they use different HTTP methods)
router.post('/', ctrl.createSeller);
router.put('/:id', ctrl.updateSeller);
router.delete('/:id', ctrl.deleteSeller);

module.exports = router;