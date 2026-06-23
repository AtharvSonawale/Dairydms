const pool = require("../config/db");

exports.getEvents = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        let query = `
            SELECT e.*, COUNT(s.slab_id) AS slab_count
            FROM bonus_events e
            LEFT JOIN bonus_slabs s ON s.event_id = e.event_id
            WHERE e.centre_id = ?
        `;
        let params = [centreId];

        if (!isAdmin) {
            query += ` AND e.created_by = ?`;
            params.push(operatorId);
        }

        query += ` GROUP BY e.event_id ORDER BY e.created_at DESC`;

        const [events] = await pool.query(query, params);
        res.json(events);
    } catch (err) {
        console.error("getEvents error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.createEvent = async (req, res) => {
    try {
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        const centreId = req.user.centre_id;
        const { event_name, occasion = "diwali", from_date, to_date, slabs } = req.body;

        if (!event_name || !from_date || !to_date)
            return res.status(400).json({ message: "event_name, from_date and to_date are required." });

        if (!slabs || !Array.isArray(slabs) || slabs.length === 0)
            return res.status(400).json({ message: "At least one slab is required." });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [evtResult] = await conn.query(
                `INSERT INTO bonus_events (event_name, occasion, from_date, to_date, created_by, centre_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
                [event_name, occasion, from_date, to_date, operatorId, centreId]
            );
            const eventId = evtResult.insertId;

            for (let i = 0; i < slabs.length; i++) {
                const { fat_min, fat_max, bonus = 0, vahatuk = 1, rate } = slabs[i];
                await conn.query(
                    `INSERT INTO bonus_slabs (event_id, centre_id, fat_min, fat_max, bonus, vahatuk, rate, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [eventId, centreId, fat_min, fat_max, bonus, vahatuk, rate, i + 1]
                );
            }

            await conn.commit();
            res.status(201).json({ message: "Bonus event created.", event_id: eventId });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error("createEvent error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getSlabs = async (req, res) => {
    try {
        const { eventId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        let query = `
            SELECT bs.* FROM bonus_slabs bs
            JOIN bonus_events e ON e.event_id = bs.event_id
            WHERE bs.event_id = ? AND bs.centre_id = ?
        `;
        let params = [eventId, centreId];

        if (!isAdmin) {
            query += ` AND e.created_by = ?`;
            params.push(operatorId);
        }

        query += ` ORDER BY bs.sort_order ASC`;

        const [slabs] = await pool.query(query, params);
        res.json(slabs);
    } catch (err) {
        console.error("getSlabs error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.updateSlabs = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { slabs } = req.body;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        if (!slabs || !Array.isArray(slabs) || slabs.length === 0)
            return res.status(400).json({ message: "At least one slab is required." });

        const [eventCheck] = await pool.query(
            `SELECT event_id FROM bonus_events WHERE event_id = ? AND centre_id = ?`,
            [eventId, centreId]
        );
        if (!eventCheck.length)
            return res.status(404).json({ message: "Bonus event not found in your centre." });

        if (!isAdmin) {
            const [ownerCheck] = await pool.query(
                `SELECT event_id FROM bonus_events WHERE event_id = ? AND created_by = ?`,
                [eventId, operatorId]
            );
            if (!ownerCheck.length)
                return res.status(403).json({ message: "Access denied." });
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(`DELETE FROM bonus_slabs WHERE event_id = ? AND centre_id = ?`, [eventId, centreId]);
            for (let i = 0; i < slabs.length; i++) {
                const { fat_min, fat_max, bonus = 0, vahatuk = 1, rate } = slabs[i];
                await conn.query(
                    `INSERT INTO bonus_slabs (event_id, centre_id, fat_min, fat_max, bonus, vahatuk, rate, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [eventId, centreId, fat_min, fat_max, bonus, vahatuk, rate, i + 1]
                );
            }
            await conn.commit();
            res.json({ message: "Slabs updated successfully." });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error("updateSlabs error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.getRegister = async (req, res) => {
    try {
        const { eventId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        let eventQuery = `SELECT * FROM bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];
        if (!isAdmin) { eventQuery += ` AND created_by = ?`; eventParams.push(operatorId); }

        const [[event]] = await pool.query(eventQuery, eventParams);
        if (!event) return res.status(404).json({ message: "Bonus event not found in your centre." });

        const [slabs] = await pool.query(
            `SELECT * FROM bonus_slabs WHERE event_id = ? AND centre_id = ? ORDER BY sort_order ASC`,
            [eventId, centreId]
        );
        if (slabs.length === 0) return res.status(400).json({ message: "No slabs configured for this event." });

        const fromFilter = req.query.from || event.from_date;
        const toFilter = req.query.to || event.to_date;
        const effectiveFrom = fromFilter > event.from_date ? fromFilter : event.from_date;
        const effectiveTo = toFilter < event.to_date ? toFilter : event.to_date;

        let entriesQuery = `
            SELECT me.seller_id, me.entry_date, me.fat, me.quantity, me.milk_type, s.name, s.seller_code
            FROM milk_entries me
            JOIN sellers s ON s.seller_id = me.seller_id
            WHERE me.entry_date BETWEEN ? AND ? AND me.centre_id = ?
        `;
        let entriesParams = [effectiveFrom, effectiveTo, centreId];
        if (!isAdmin) { entriesQuery += ` AND me.operator_id = ?`; entriesParams.push(operatorId); }
        entriesQuery += ` ORDER BY s.name ASC, me.entry_date ASC`;

        const [entries] = await pool.query(entriesQuery, entriesParams);

        const [paidRows] = await pool.query(
            `SELECT seller_id, total_bonus, CAST(is_paid AS UNSIGNED) AS is_paid, paid_at
             FROM bonus_payments WHERE event_id = ? AND centre_id = ?`,
            [eventId, centreId]
        );
        const paidMap = Object.fromEntries(paidRows.map(p => [p.seller_id, p]));

        const sellerMap = {};
        for (const e of entries) {
            if (!sellerMap[e.seller_id]) {
                sellerMap[e.seller_id] = {
                    seller_id: e.seller_id, seller_code: e.seller_code, name: e.name,
                    buckets: slabs.map(s => ({
                        slab_id: s.slab_id, fat_min: parseFloat(s.fat_min), fat_max: parseFloat(s.fat_max),
                        bonus: parseFloat(s.bonus), vahatuk: parseFloat(s.vahatuk), rate: parseFloat(s.rate),
                        qty: 0, amt: 0,
                    })),
                    total_qty: 0, total_amt: 0,
                };
            }
            const fat = parseFloat(e.fat);
            const qty = parseFloat(e.quantity);
            const seller = sellerMap[e.seller_id];
            const bucket = seller.buckets.find(b => fat >= b.fat_min && fat <= b.fat_max);
            if (bucket) {
                bucket.qty = parseFloat((bucket.qty + qty).toFixed(2));
                bucket.amt = parseFloat((bucket.amt + qty * bucket.rate).toFixed(2));
                seller.total_qty = parseFloat((seller.total_qty + qty).toFixed(2));
                seller.total_amt = parseFloat((seller.total_amt + qty * bucket.rate).toFixed(2));
            }
        }

        const result = Object.values(sellerMap).map(seller => {
            const payment = paidMap[seller.seller_id];
            return {
                ...seller,
                is_paid: payment ? Number(payment.is_paid) === 1 : false,
                paid_at: (payment && Number(payment.is_paid) === 1) ? payment.paid_at : null,
                total_bonus: payment?.total_bonus || seller.total_amt,
            };
        });

        res.json({ event, slabs, sellers: result });
    } catch (err) {
        console.error("getRegister error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.markBonusPaid = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { seller_id } = req.body;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';

        if (!seller_id) return res.status(400).json({ message: "seller_id is required." });

        let eventQuery = `SELECT * FROM bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];
        if (!isAdmin) { eventQuery += ` AND created_by = ?`; eventParams.push(operatorId); }

        const [[event]] = await pool.query(eventQuery, eventParams);
        if (!event) return res.status(404).json({ message: "Bonus event not found in your centre." });

        const [sellerCheck] = await pool.query(
            `SELECT seller_id FROM sellers WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!sellerCheck.length) return res.status(404).json({ message: "Seller not found in your centre." });

        const [slabs] = await pool.query(
            `SELECT * FROM bonus_slabs WHERE event_id = ? AND centre_id = ? ORDER BY sort_order ASC`,
            [eventId, centreId]
        );

        let entriesQuery = `SELECT fat, quantity FROM milk_entries WHERE seller_id = ? AND centre_id = ? AND entry_date BETWEEN ? AND ?`;
        let entriesParams = [seller_id, centreId, event.from_date, event.to_date];
        if (!isAdmin) { entriesQuery += ` AND operator_id = ?`; entriesParams.push(operatorId); }

        const [entries] = await pool.query(entriesQuery, entriesParams);

        let totalQty = 0, totalBonus = 0;
        for (const e of entries) {
            const fat = parseFloat(e.fat);
            const qty = parseFloat(e.quantity);
            const slab = slabs.find(s => fat >= parseFloat(s.fat_min) && fat <= parseFloat(s.fat_max));
            if (slab) {
                totalQty = parseFloat((totalQty + qty).toFixed(2));
                totalBonus = parseFloat((totalBonus + qty * parseFloat(slab.rate)).toFixed(2));
            }
        }

        await pool.query(
            `INSERT INTO bonus_payments (event_id, seller_id, centre_id, total_qty, total_bonus, is_paid, paid_at, paid_by)
             VALUES (?, ?, ?, ?, ?, 1, NOW(), ?)
             ON DUPLICATE KEY UPDATE total_qty=VALUES(total_qty), total_bonus=VALUES(total_bonus),
             is_paid=1, paid_at=NOW(), paid_by=VALUES(paid_by)`,
            [eventId, seller_id, centreId, totalQty, totalBonus, operatorId]
        );

        res.json({ message: "Bonus payment marked as paid.", total_qty: totalQty, total_bonus: totalBonus });
    } catch (err) {
        console.error("markBonusPaid error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.undoBonusPaid = async (req, res) => {
    try {
        const { eventId, sellerId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        if (!eventId || eventId === "null" || !sellerId || sellerId === "null")
            return res.status(400).json({ message: "Valid eventId and sellerId are required." });

        const [eventCheck] = await pool.query(
            `SELECT event_id FROM bonus_events WHERE event_id = ? AND centre_id = ?`, [eventId, centreId]
        );
        if (!eventCheck.length) return res.status(404).json({ message: "Bonus event not found in your centre." });

        if (!isAdmin) {
            const [ownerCheck] = await pool.query(
                `SELECT event_id FROM bonus_events WHERE event_id = ? AND created_by = ?`, [eventId, operatorId]
            );
            if (!ownerCheck.length) return res.status(403).json({ message: "Access denied." });
        }

        await pool.query(
            `UPDATE bonus_payments SET is_paid=0, paid_at=NULL, paid_by=NULL
             WHERE event_id=? AND seller_id=? AND centre_id=?`,
            [eventId, sellerId, centreId]
        );

        res.json({ message: "Bonus payment reversed successfully." });
    } catch (err) {
        console.error("undoBonusPaid error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.deleteEvent = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { eventId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        let eventQuery = `SELECT event_id FROM bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];
        if (!isAdmin) { eventQuery += ` AND created_by = ?`; eventParams.push(operatorId); }

        const [eventCheck] = await conn.query(eventQuery, eventParams);
        if (!eventCheck.length) return res.status(404).json({ message: "Bonus event not found in your centre." });

        await conn.beginTransaction();
        await conn.query(`DELETE FROM bonus_payments WHERE event_id = ? AND centre_id = ?`, [eventId, centreId]);
        await conn.query(`DELETE FROM bonus_slabs WHERE event_id = ? AND centre_id = ?`, [eventId, centreId]);
        await conn.query(`DELETE FROM bonus_events WHERE event_id = ? AND centre_id = ?`, [eventId, centreId]);
        await conn.commit();

        res.json({ message: "Bonus event deleted." });
    } catch (err) {
        await conn.rollback();
        console.error("deleteEvent error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        conn.release();
    }
};

exports.getPaidStatus = async (req, res) => {
    try {
        const { eventId } = req.params;
        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = req.user.role === 'admin' ? null : req.user.id;
        let query = `SELECT seller_id, is_paid, paid_at FROM bonus_payments WHERE event_id = ? AND centre_id = ? AND is_paid = 1`;
        let params = [eventId, centreId];
        if (!isAdmin) { query += ` AND paid_by = ?`; params.push(operatorId); }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("getPaidStatus error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const operatorId = req.user.role === 'admin' ? null : req.user.id;        const centreId = req.user.centre_id;
        const isAdmin = req.user.role === 'admin';
        const { event_name, occasion, from_date, to_date } = req.body;

        if (!event_name || !from_date || !to_date)
            return res.status(400).json({ message: "event_name, from_date and to_date are required." });

        let eventQuery = `SELECT * FROM bonus_events WHERE event_id = ? AND centre_id = ?`;
        let eventParams = [eventId, centreId];
        if (!isAdmin) { eventQuery += ` AND created_by = ?`; eventParams.push(operatorId); }

        const [[event]] = await pool.query(eventQuery, eventParams);
        if (!event) return res.status(404).json({ message: "Bonus event not found in your centre." });

        await pool.query(
            `UPDATE bonus_events SET event_name=?, occasion=?, from_date=?, to_date=? WHERE event_id=? AND centre_id=?`,
            [event_name, occasion, from_date, to_date, eventId, centreId]
        );

        res.json({ message: "Bonus event updated successfully." });
    } catch (err) {
        console.error("updateEvent error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

exports.saveRegister = async (req, res) => {
    try {
        const { sellers } = req.body;
        const centreId = req.user.centre_id;

        if (!sellers || !Array.isArray(sellers) || sellers.length === 0)
            return res.status(400).json({ message: "No seller data provided." });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const seller of sellers) {
                for (const bucket of seller.buckets) {
                    const [slabRows] = await conn.query(
                        `SELECT slab_id FROM bonus_slabs WHERE centre_id = ? AND fat_min = ? AND fat_max = ? LIMIT 1`,
                        [centreId, bucket.fat_min, bucket.fat_max]
                    );
                    if (!slabRows.length) continue;
                    await conn.query(
                        `INSERT INTO bonus_register (event_id, seller_id, centre_id, slab_id, total_qty, total_amount)
                         VALUES (0, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE total_qty=VALUES(total_qty), total_amount=VALUES(total_amount), computed_at=NOW()`,
                        [seller.seller_id, centreId, slabRows[0].slab_id, bucket.qty, bucket.amount]
                    );
                }
            }
            await conn.commit();
            res.json({ message: "Register saved successfully." });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error("saveRegister error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};
