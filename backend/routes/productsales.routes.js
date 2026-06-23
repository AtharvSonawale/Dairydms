const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/productSales.controller');

// ── Product Sales (stock OUT to seller) ──────────────────────
// GET  /api/product-sales?date=YYYY-MM-DD  → sales for that date (operator-scoped)
// POST /api/product-sales                  → record sale + decrement stock
router.get('/transactions', protect, ctrl.getTransactions);
router.get('/speed-products', protect, ctrl.getSpeedProducts);
router.post('/speed-products', protect, ctrl.createSpeedProduct);
router.put('/speed-products/:id', protect, ctrl.updateSpeedProduct);
router.delete('/speed-products/:id', protect, ctrl.deleteSpeedProduct);

router.get('/', protect, ctrl.getSales);
router.post('/', protect, ctrl.createSale);

// PUT /api/product-sales/:id              → update a single sale line
router.put('/:id', protect, ctrl.updateSale);

// PUT /api/product-sales/transaction/:transaction_id → update all lines in a transaction
router.put('/transaction/:transaction_id', protect, ctrl.updateTransaction);

// DELETE /api/product-sales/:id            → delete a single sale line
router.delete('/:id', protect, ctrl.deleteSale);

module.exports = router;