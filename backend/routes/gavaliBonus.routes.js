const express = require("express");
const router = express.Router();
const protect = require("../middleware/auth");
const {
    getGavaliEvents,
    createGavaliEvent,
    updateGavaliEvent,
    deleteGavaliEvent,
    getGavaliRegister,
    markGavaliBonusPaid,
    undoGavaliBonusPaid,
    getGavaliNoEventRegister,
    getGavaliMonthlyBreakdown,
} = require("../controllers/gavalibonus.controller");

router.use(protect);

// ── Static routes FIRST (before any /:eventId param routes) ──
router.get("/no-event-register", getGavaliNoEventRegister);
router.get("/monthly-breakdown", getGavaliMonthlyBreakdown);  // ✅ fixed path

// ── Event CRUD ────────────────────────────────────────────────
router.get("/events", getGavaliEvents);
router.post("/events", createGavaliEvent);
router.put("/events/:eventId", updateGavaliEvent);
router.delete("/events/:eventId", deleteGavaliEvent);

// ── Event-scoped register & payment routes ────────────────────
router.get("/events/:eventId/register", getGavaliRegister);
router.post("/events/:eventId/mark-paid", markGavaliBonusPaid);
router.post("/events/:eventId/undo-paid", undoGavaliBonusPaid);

module.exports = router;