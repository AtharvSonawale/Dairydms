const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/walkinPayment.controller');

router.use(protect);

router.get('/buyers', ctrl.getBuyers);
router.post('/buyers', ctrl.createBuyer);
router.get('/outstanding-buyers', ctrl.getOutstandingBuyers);
router.get('/payments', ctrl.getPayments);
router.post('/payments', ctrl.createPayment);
router.delete('/payments/:id', ctrl.deletePayment);
router.get('/buyer-balance/:buyerId', ctrl.getBuyerBalance);
router.get('/buyer-payments/:buyerId', ctrl.getBuyerPayments);
router.post('/clear-bill', ctrl.clearBuyerBill);
router.get('/summary', ctrl.getPaymentSummary);
router.get('/buyer-statement/:buyerId', ctrl.getBuyerStatement);

router.get('/bills/search', ctrl.searchBills);
router.post('/bills/save', ctrl.saveBill);
router.get('/bill/:bill_no', ctrl.getBillDetail);
router.delete('/bill/:bill_no', ctrl.deleteBill);

module.exports = router;