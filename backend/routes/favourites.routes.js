const router = require('express').Router();
const protect = require('../middleware/auth');
const ctrl = require('../controllers/favourites.controller');

router.use(protect); // all favourite routes require login

router.get('/', ctrl.listFavourites);
router.post('/', ctrl.addFavourite);
router.delete('/:id', ctrl.removeFavourite);

module.exports = router;