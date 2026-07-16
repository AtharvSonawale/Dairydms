const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/farmer.controller');

router.use(protect);

router.get('/dashboard', ctrl.getFarmerDashboard);
router.get('/bill/:bill_no', ctrl.getFarmerBillDetail);
router.get('/milk-entries', ctrl.getFarmerMilkEntries);
router.get('/bills', ctrl.getFarmerBills);
router.get('/finance', ctrl.getFarmerFinance);

module.exports = router;