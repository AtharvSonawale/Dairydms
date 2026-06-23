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
    saveRegister
} = require("../controllers/bonus.controller");

router.use(protect);

router.get("/events", getEvents);
router.post("/events", createEvent);
router.delete("/events/:eventId", deleteEvent);

router.get("/events/:eventId/slabs", getSlabs);
router.put("/events/:eventId/slabs", updateSlabs);
router.put("/events/:eventId", updateEvent);

router.get("/events/:eventId/register", getRegister);
router.post("/events/:eventId/mark-paid", markBonusPaid);
router.delete("/events/:eventId/mark-paid/:sellerId", undoBonusPaid);
router.get('/events/:eventId/paid-status', getPaidStatus);
router.post('/save-register', saveRegister);



module.exports = router;