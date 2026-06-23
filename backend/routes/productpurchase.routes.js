// backend/routes/product.routes.js

const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/productpurchase.controller.');

// ── Products catalogue ────────────────────────────────────────
// GET  /api/products      → list all products (with current stock)
// POST /api/products      → add a new product to catalogue
router.get('/', protect, ctrl.getProducts);
router.post('/', protect, ctrl.createProduct);
router.put('/:id', protect, ctrl.updateProduct);
router.delete('/:id', protect, ctrl.deleteProduct);


// ── Product Purchases (stock IN) ──────────────────────────────
// GET  /api/product-purchases?date=  → purchases for that date
// POST /api/product-purchases        → record purchase + increment stock
router.get('/purchases', protect, ctrl.getPurchases);
router.post('/purchases', protect, ctrl.createPurchase);
router.get('/purchases/suggestions', protect, ctrl.getPurchaseSuggestions);
router.put('/purchases/:id', ctrl.updatePurchase);
router.delete('/purchases/:id', ctrl.deletePurchase);


module.exports = router;