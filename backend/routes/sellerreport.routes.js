// routes/sellerreport.routes.js
const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth"); // default export — same as seller.routes.js

const {
    getSellers,
    getMonthlySummary,
    getMilkEntries,
    getProductSales,
    getCashAdvance,
    getSellerDeposits,
    getSellerDetail,
} = require("../controllers/sellerreport.controller");

router.use(protect); // all report routes require login

router.get("/sellers", getSellers);
router.get("/summary", getMonthlySummary);
router.get("/milk-entries", getMilkEntries);
router.get("/product-sales", getProductSales);
router.get("/cash-advance", getCashAdvance);
router.get("/seller-deposits/:id", getSellerDeposits);
router.get("/detail/:sellerId", getSellerDetail);

module.exports = router;