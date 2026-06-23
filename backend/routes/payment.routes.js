const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const ctrl = require("../controllers/payment.controller");

router.use(protect);
router.get("/seller-summary", ctrl.getSellerSummary);
router.post("/mark-paid", ctrl.markPaid);
router.get("/bills/search", ctrl.searchBills);
router.get("/bill/:bill_no", ctrl.getBillByNo);
router.delete('/bill/:bill_no', ctrl.deleteBill);
router.get('/cycle-config', ctrl.getCycleConfig);
router.post('/cycle-config', ctrl.saveCycleConfig);
router.get('/export-excel', ctrl.exportExcel);
router.get('/excel-config', ctrl.getExcelConfig);
router.post('/excel-config', ctrl.saveExcelConfig);

module.exports = router;