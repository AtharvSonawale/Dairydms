const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/seller.controller');

router.use(protect); // all seller routes require login

router.get('/', ctrl.listSellers);
router.get('/:id', ctrl.getSellerById);
router.get('/:id/summary', ctrl.getSellerSummary);   // stats + totals for profile header
router.get('/:id/entries', ctrl.getSellerEntries);   // milk entry history
router.get("/:id/deposit", ctrl.getSellerDeposits);
router.get("/:id/deposit-balance", ctrl.getSellerDepositBalance);
router.get('/:id/advance', ctrl.getSellerAdvance);   // cash advance history
router.get('/:id/products', ctrl.getSellerProducts); // product sales history
router.get('/:id/premium', ctrl.getSellerPremium);  // active premium rate if any
router.post('/', ctrl.createSeller);
router.put('/:id', ctrl.updateSeller);
router.delete('/:id', ctrl.deleteSeller);
router.get("/:id/deposit-balance", ctrl.getSellerDepositBalance);


module.exports = router;