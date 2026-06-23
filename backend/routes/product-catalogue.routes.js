const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/product-catalogue.controller');

// Product Catalogue Routes
router.get('/', protect, ctrl.getAllProducts);
router.post('/', protect, ctrl.createProduct);
router.put('/:id', protect, ctrl.updateProduct);
router.delete('/:id', protect, ctrl.deleteProduct);

module.exports = router;