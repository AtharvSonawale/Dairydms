const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const {
    getEvents,
    createEvent,
    updateEvent,
    getSlabs,
    updateSlabs,
    getRegister,
    markBonusPaid,
    deleteEvent,
    undoBonusPaid,
    getPaidStatus,
    saveRegister,
    getDefaultSlabs,
    updateDefaultSlabs,
} = require("../controllers/bonus.controller");

router.use(protect);

// Events
router.get("/events", getEvents);
router.post("/events", createEvent);
router.delete("/events/:eventId", deleteEvent);
router.put("/events/:eventId", updateEvent);

// Slabs (event-specific)
router.get("/events/:eventId/slabs", getSlabs);
router.put("/events/:eventId/slabs", updateSlabs);

// Register (fixed route to match frontend)
router.get("/register/:eventId", getRegister);   // <-- CHANGED

// Payments
router.post("/events/:eventId/mark-paid", markBonusPaid);
router.delete("/events/:eventId/mark-paid/:sellerId", undoBonusPaid);
router.get("/events/:eventId/paid-status", getPaidStatus);

// Save register (custom date range)
router.post("/save-register", saveRegister);

// Default slabs (centre-wide)
router.get("/default-slabs", getDefaultSlabs);
router.put("/default-slabs", updateDefaultSlabs);

module.exports = router;