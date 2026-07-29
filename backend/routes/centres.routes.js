const router = require('express').Router();
const centres = require('../controllers/centres.controller');
const { authenticate, requireRole } = require('../middleware/auth');

// Centre management is admin-only. Operators/farmers never see this.
router.use(authenticate, requireRole('admin'));
router.get('/', centres.listCentres);
router.post('/', centres.createCentre);
router.post('/switch', centres.switchCentre);
router.put('/:id', centres.updateCentre);
router.delete('/:id', centres.deleteCentre);

module.exports = router;

// ── Wiring reminder for app.js / server.js ──────────────────────────────
// const centresRoutes = require('./routes/centres.routes');
// app.use('/api/centres', centresRoutes);