const jwt = require('jsonwebtoken');

// req.user will contain: { id, role, name, centre_id, dairy_id }
// for both admins and operators (see auth.controller.js for token shape).
//
// This stays JWT-only by design (per your confirmed choice): centre_id /
// dairy_id are trusted as baked into the token at login time and are NOT
// re-checked against the DB on every request. If an admin/operator is
// reassigned to a different centre, their existing tokens keep the OLD
// centre_id until they expire or the user logs in again. If that
// staleness window ever becomes a problem, the fix is to shorten
// JWT_EXPIRES_IN or to add a DB check back into `authenticate` below --
// not something to silently reintroduce piecemeal in individual routes.

const authenticate = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
        return res.status(401).json({ message: 'No token provided' });

    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// requireRole('admin') / requireRole('operator')
// Use after `authenticate` on routes that only one role should reach.
const requireRole = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
        return res.status(403).json({ message: `Requires role: ${role}` });
    }
    next();
};

// requireSameCentre(getResourceCentreId)
// For routes that load a specific resource by id (e.g. PUT /sellers/:id).
// Pass an async function that returns that resource's centre_id from the
// DB; this 403s if it doesn't match req.user.centre_id (from the JWT).
// Use on every single-resource read/update/delete route across the
// centre-shared tables -- list endpoints get filtered by centre_id in
// their WHERE clause already, but a "get one by id" route is easy to
// forget and is exactly where cross-centre leaks tend to slip in.
//
// Example:
//   router.put('/sellers/:id', authenticate, requireSameCentre(async (req) => {
//     const [rows] = await pool.query('SELECT centre_id FROM sellers WHERE seller_id = ?', [req.params.id]);
//     return rows[0]?.centre_id;
//   }), updateSellerHandler);
const requireSameCentre = (getResourceCentreId) => async (req, res, next) => {
    try {
        const resourceCentreId = await getResourceCentreId(req);
        if (resourceCentreId == null) {
            return res.status(404).json({ message: 'Resource not found.' });
        }
        if (resourceCentreId !== req.user.centre_id) {
            return res.status(403).json({ message: 'This resource belongs to a different centre.' });
        }
        next();
    } catch (err) {
        next(err);
    }
};

// Default export unchanged (so every existing `require('../middleware/auth')`
// call site that does `const auth = require(...)` and uses it directly as
// a middleware function keeps working with zero changes).
module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.requireRole = requireRole;
module.exports.requireSameCentre = requireSameCentre;