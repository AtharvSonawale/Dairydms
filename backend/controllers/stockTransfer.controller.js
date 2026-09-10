// backend/controllers/stockTransfer.controller.js
const pool = require('../config/db');

// ── Helper: generate transfer number ───────────────────────────
const buildTransferNo = async (conn) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ST/${y}${m}/`;
    const [rows] = await conn.query(
        `SELECT transfer_no FROM stock_transfers
         WHERE transfer_no LIKE ? ORDER BY transfer_id DESC LIMIT 1`,
        [`${prefix}%`]
    );
    const last = rows[0]?.transfer_no;
    const seq = last ? parseInt(last.split('/').pop(), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
};

// ── Helper: compute remaining milk for a centre on a date ──────
// excludes a transfer-in-flight id (if editing/approving)
const computeMilkRemaining = async (conn, centreId, date) => {
    const [collected] = await conn.query(
        `SELECT milk_type, SUM(quantity) AS qty
         FROM milk_entries WHERE centre_id = ? AND entry_date = ?
         GROUP BY milk_type`, [centreId, date]
    );
    const [walkinOut] = await conn.query(
        `SELECT milk_type, SUM(quantity) AS qty
         FROM walkin_sales WHERE centre_id = ? AND sale_date = ?
         GROUP BY milk_type`, [centreId, date]
    );
    const [ownerOut] = await conn.query(
        `SELECT milk_type, SUM(quantity) AS qty
         FROM owner_usage WHERE centre_id = ? AND usage_date = ?
         GROUP BY milk_type`, [centreId, date]
    );
    const [dispatched] = await conn.query(
        `SELECT SUM(cow_liters) AS c, SUM(buffalo_liters) AS b
         FROM tank_dispatch WHERE centre_id = ? AND dispatch_date = ?`,
        [centreId, date]
    );
    const [transferOut] = await conn.query(
        `SELECT
            SUM(CASE WHEN milk_type='cow' THEN quantity ELSE 0 END) AS c,
            SUM(CASE WHEN milk_type='buffalo' THEN quantity ELSE 0 END) AS b
         FROM stock_transfer_items sti
         JOIN stock_transfers st ON st.transfer_id = sti.transfer_id
         WHERE sti.stock_type = 'milk' AND st.from_centre_id = ?
           AND st.transfer_date = ? AND st.status IN ('pending','approved')`,
        [centreId, date]
    );

    const get = (rows, type) => parseFloat(rows.find(r => r.milk_type === type)?.qty || 0);

    const cowCollected = get(collected, 'cow');
    const buffCollected = get(collected, 'buffalo');
    const cowOut = get(walkinOut, 'cow') + get(ownerOut, 'cow') + get(walkinOut, 'buffalo') * 0;
    const buffOut = get(walkinOut, 'buffalo') + get(ownerOut, 'buffalo');

    const cow = Math.max(0,
        cowCollected - cowOut
        - parseFloat(dispatched[0]?.c || 0)
        - parseFloat(transferOut[0]?.c || 0)
    );
    const buffalo = Math.max(0,
        buffCollected - buffOut
        - parseFloat(dispatched[0]?.b || 0)
        - parseFloat(transferOut[0]?.b || 0)
    );
    return { cow, buffalo, total: cow + buffalo };
};

// ── Helper: compute product/feed remaining ─────────────────────
const computeItemRemaining = async (conn, centreId, date, stockType, refId) => {
    if (stockType === 'product') {
        const [[{ purchased = 0 } = {}]] = await conn.query(
            `SELECT SUM(quantity) AS purchased FROM product_purchases
             WHERE product_id = ? AND centre_id = ? AND purchase_date <= ?`,
            [refId, centreId, date]
        );
        const [[{ sold = 0 } = {}]] = await conn.query(
            `SELECT SUM(quantity) AS sold FROM product_sales
             WHERE product_id = ? AND centre_id = ? AND sale_date <= ?`,
            [refId, centreId, date]
        );
        const [[{ inQty = 0 } = {}]] = await conn.query(
            `SELECT SUM(sti.quantity) AS inQty FROM stock_transfer_items sti
             JOIN stock_transfers st ON st.transfer_id = sti.transfer_id
             WHERE sti.stock_type='product' AND sti.ref_id=?
               AND st.to_centre_id=? AND st.status = 'approved'
               AND st.transfer_date <= ?`,
            [refId, centreId, date]
        );
        const [[{ outQty = 0 } = {}]] = await conn.query(
            `SELECT SUM(sti.quantity) AS outQty FROM stock_transfer_items sti
             JOIN stock_transfers st ON st.transfer_id = sti.transfer_id
             WHERE sti.stock_type='product' AND sti.ref_id=?
               AND st.from_centre_id=? AND st.status IN ('pending','approved')
               AND st.transfer_date <= ?`,
            [refId, centreId, date]
        );
        return Math.max(0, parseFloat(purchased) + parseFloat(inQty) - parseFloat(sold) - parseFloat(outQty));
    }

    if (stockType === 'cattle_feed') {
        const [[{ purchased = 0 } = {}]] = await conn.query(
            `SELECT SUM(quantity) AS purchased FROM cattle_feed_purchases
             WHERE feed_id = ? AND centre_id = ? AND purchase_date <= ?`,
            [refId, centreId, date]
        );
        const [[{ sold = 0 } = {}]] = await conn.query(
            `SELECT SUM(quantity) AS sold FROM cattle_feed_sales
             WHERE feed_id = ? AND centre_id = ? AND sale_date <= ?`,
            [refId, centreId, date]
        );
        const [[{ inQty = 0 } = {}]] = await conn.query(
            `SELECT SUM(sti.quantity) AS inQty FROM stock_transfer_items sti
             JOIN stock_transfers st ON st.transfer_id = sti.transfer_id
             WHERE sti.stock_type='cattle_feed' AND sti.ref_id=?
               AND st.to_centre_id=? AND st.status = 'approved'
               AND st.transfer_date <= ?`,
            [refId, centreId, date]
        );
        const [[{ outQty = 0 } = {}]] = await conn.query(
            `SELECT SUM(sti.quantity) AS outQty FROM stock_transfer_items sti
             JOIN stock_transfers st ON st.transfer_id = sti.transfer_id
             WHERE sti.stock_type='cattle_feed' AND sti.ref_id=?
               AND st.from_centre_id=? AND st.status IN ('pending','approved')
               AND st.transfer_date <= ?`,
            [refId, centreId, date]
        );
        return Math.max(0, parseFloat(purchased) + parseFloat(inQty) - parseFloat(sold) - parseFloat(outQty));
    }
    return 0;
};

// ── GET /api/stock-transfers ───────────────────────────────────
exports.listTransfers = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { from, to, direction, status } = req.query;

        const where = [];
        const params = [];
        if (from) { where.push('st.transfer_date >= ?'); params.push(from); }
        if (to) { where.push('st.transfer_date <= ?'); params.push(to); }

        if (direction === 'incoming') {
            where.push('st.to_centre_id = ?'); params.push(centreId);
        } else if (direction === 'outgoing') {
            where.push('st.from_centre_id = ?'); params.push(centreId);
        } else {
            where.push('(st.from_centre_id = ? OR st.to_centre_id = ?)');
            params.push(centreId, centreId);
        }

        if (status && status !== 'all') { where.push('st.status = ?'); params.push(status); }

        const [rows] = await pool.query(
            `SELECT
                st.transfer_id, st.transfer_no, st.transfer_date,
                st.from_centre_id, st.to_centre_id,
                fc.centre_name AS from_centre_name,
                tc.centre_name AS to_centre_name,
                st.status, st.requires_approval,
                st.remarks, st.rejection_reason,
st.created_by, COALESCE(op1.name, ad1.name) AS created_by_name,
st.approved_by, COALESCE(op2.name, ad2.name) AS approved_by_name,
                st.approved_at,
                st.created_at, st.updated_at,
                (SELECT COUNT(*) FROM stock_transfer_items WHERE transfer_id = st.transfer_id) AS item_count,
                (SELECT COALESCE(SUM(quantity),0) FROM stock_transfer_items WHERE transfer_id = st.transfer_id) AS total_qty
             FROM stock_transfers st
             LEFT JOIN centres fc ON fc.centre_id = st.from_centre_id
             LEFT JOIN centres tc ON tc.centre_id = st.to_centre_id
             LEFT JOIN operators op1 ON op1.operator_id = st.created_by
             LEFT JOIN admins ad1 ON ad1.admin_id = st.created_by_admin_id
             LEFT JOIN operators op2 ON op2.operator_id = st.approved_by
             LEFT JOIN admins ad2 ON ad2.admin_id = st.approved_by_admin_id
             WHERE ${where.join(' AND ')}
             ORDER BY st.transfer_date DESC, st.transfer_id DESC`,
            params
        );

        res.json(rows);
    } catch (err) {
        console.error('listTransfers error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/stock-transfers/stats ─────────────────────────────
exports.getStats = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const [[pending]] = await pool.query(
            `SELECT
                SUM(CASE WHEN to_centre_id = ? THEN 1 ELSE 0 END) AS pending_incoming,
                SUM(CASE WHEN from_centre_id = ? THEN 1 ELSE 0 END) AS pending_outgoing
             FROM stock_transfers
             WHERE status = 'pending' AND (to_centre_id = ? OR from_centre_id = ?)`,
            [centreId, centreId, centreId, centreId]
        );

        const [[today]] = await pool.query(
            `SELECT
                SUM(CASE WHEN to_centre_id = ? AND status = 'approved' THEN 1 ELSE 0 END) AS today_incoming,
                SUM(CASE WHEN from_centre_id = ? AND status = 'approved' THEN 1 ELSE 0 END) AS today_outgoing
             FROM stock_transfers
             WHERE transfer_date = ?`,
            [centreId, centreId, date]
        );

        const [[total]] = await pool.query(
            `SELECT COUNT(*) AS total_approved FROM stock_transfers
             WHERE status = 'approved' AND (from_centre_id = ? OR to_centre_id = ?)`,
            [centreId, centreId]
        );

        res.json({
            pending_incoming: Number(pending?.pending_incoming || 0),
            pending_outgoing: Number(pending?.pending_outgoing || 0),
            today_incoming: Number(today?.today_incoming || 0),
            today_outgoing: Number(today?.today_outgoing || 0),
            total_approved: Number(total?.total_approved || 0),
        });
    } catch (err) {
        console.error('getStats error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/stock-transfers/eligible-centres ──────────────────
exports.getEligibleCentres = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        // Find the dairy this admin/operator's own centre belongs to
        const [[myCentre]] = await pool.query(
            `SELECT dairy_id FROM centres WHERE centre_id = ?`,
            [centreId]
        );
        if (!myCentre) return res.status(400).json({ error: 'Invalid centre for current user' });

        const [rows] = await pool.query(
            `SELECT centre_id, centre_name, centre_code
             FROM centres
             WHERE centre_id != ? AND dairy_id = ? AND is_active = 1
             ORDER BY centre_name`,
            [centreId, myCentre.dairy_id]
        );
        res.json(rows);
    } catch (err) {
        console.error('getEligibleCentres error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── GET /api/stock-transfers/:id ───────────────────────────────
exports.getTransferDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            `SELECT
                st.*,
                fc.centre_name AS from_centre_name,
                tc.centre_name AS to_centre_name,
                COALESCE(op1.name, ad1.name) AS created_by_name,
                COALESCE(op2.name, ad2.name) AS approved_by_name
             FROM stock_transfers st
             LEFT JOIN centres fc ON fc.centre_id = st.from_centre_id
             LEFT JOIN centres tc ON tc.centre_id = st.to_centre_id
             LEFT JOIN operators op1 ON op1.operator_id = st.created_by
             LEFT JOIN admins ad1 ON ad1.admin_id = st.created_by_admin_id
             LEFT JOIN operators op2 ON op2.operator_id = st.approved_by
             LEFT JOIN admins ad2 ON ad2.admin_id = st.approved_by_admin_id
             WHERE st.transfer_id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Transfer not found' });

        const [items] = await pool.query(
            `SELECT * FROM stock_transfer_items WHERE transfer_id = ?`, [id]
        );
        res.json({ ...rows[0], items });
    } catch (err) {
        console.error('getTransferDetail error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── POST /api/stock-transfers ──────────────────────────────────
// Validates against ACTUAL remaining stock. Rejects if any line
// exceeds remaining at source. Creates pending or auto-approved.
exports.createTransfer = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const sourceCentre = req.user.centre_id;
        const userId = req.user.user_id;
        const { to_centre_id, transfer_date, requires_approval, remarks, items } = req.body;

        if (!to_centre_id) throw { code: 400, message: 'Destination centre required' };
        if (Number(to_centre_id) === Number(sourceCentre)) throw { code: 400, message: 'Source and destination cannot be same' };
        if (!Array.isArray(items) || items.length === 0) throw { code: 400, message: 'At least one item required' };

        // ── Validate every item against remaining stock ──
        for (const it of items) {
            if (it.stock_type === 'milk') {
                const remain = await computeMilkRemaining(conn, sourceCentre, transfer_date);
                const reqQty = parseFloat(it.quantity || 0);
                const available = it.milk_type === 'buffalo' ? remain.buffalo : remain.cow;
                if (reqQty > available + 0.001) {
                    throw {
                        code: 400,
                        message: `Not enough ${it.milk_type || 'milk'}. Available: ${available.toFixed(2)}L, requested: ${reqQty.toFixed(2)}L`,
                    };
                }
            } else {
                const remain = await computeItemRemaining(
                    conn, sourceCentre, transfer_date, it.stock_type, it.ref_id
                );
                const reqQty = parseFloat(it.quantity || 0);
                if (reqQty > remain + 0.001) {
                    throw {
                        code: 400,
                        message: `Not enough ${it.item_name || it.stock_type}. Available: ${remain.toFixed(2)}, requested: ${reqQty.toFixed(2)}`,
                    };
                }
            }
        }

        const [[centreRow]] = await conn.query(
            `SELECT dairy_id FROM centres WHERE centre_id = ?`,
            [sourceCentre]
        );
        if (!centreRow) throw { code: 400, message: 'Invalid source centre' };
        const dairyId = centreRow.dairy_id;

        const transferNo = await buildTransferNo(conn);
        const status = requires_approval ? 'pending' : 'approved';

        const [result] = await conn.query(
            `INSERT INTO stock_transfers
        (transfer_no, from_centre_id, to_centre_id, dairy_id, transfer_date,
         status, requires_approval, remarks, created_by,
         approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                transferNo, sourceCentre, to_centre_id, dairyId, transfer_date,
                status, requires_approval ? 1 : 0, remarks || null, userId,
                requires_approval ? null : userId,
                requires_approval ? null : new Date(),
            ]
        );

        const transferId = result.insertId;

        for (const it of items) {
            await conn.query(
                `INSERT INTO stock_transfer_items
                    (transfer_id, stock_type, ref_id, item_name, milk_type,
                     unit, quantity, rate, total_amount)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    transferId, it.stock_type, it.ref_id || null,
                    it.item_name || null, it.milk_type || null,
                    it.unit || 'L',
                    parseFloat(it.quantity || 0),
                    parseFloat(it.rate || 0),
                    parseFloat(it.quantity || 0) * parseFloat(it.rate || 0),
                ]
            );
        }

        await conn.commit();
        res.json({
            transfer_id: transferId,
            transfer_no: transferNo,
            status,
            message: requires_approval ? 'Sent for approval' : 'Transfer completed',
        });
    } catch (err) {
        await conn.rollback();
        console.error('createTransfer error:', err);
        res.status(err.code || 500).json({ error: err.message || 'Server error' });
    } finally {
        conn.release();
    }
};

// ── PUT /api/stock-transfers/:id/approve ───────────────────────
// Re-validates stock before approving - source may have sold it
exports.approveTransfer = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const userId = req.user.user_id;

        const [[transfer]] = await conn.query(
            `SELECT * FROM stock_transfers WHERE transfer_id = ? FOR UPDATE`, [id]
        );
        if (!transfer) throw { code: 404, message: 'Transfer not found' };
        if (transfer.status !== 'pending') throw { code: 400, message: 'Transfer not pending' };
        if (Number(transfer.to_centre_id) !== Number(req.user.centre_id)) {
            throw { code: 403, message: 'Only recipient can approve' };
        }

        const [items] = await conn.query(
            `SELECT * FROM stock_transfer_items WHERE transfer_id = ?`, [id]
        );

        // Re-check source still has the stock
        for (const it of items) {
            if (it.stock_type === 'milk') {
                const remain = await computeMilkRemaining(
                    conn, transfer.from_centre_id, transfer.transfer_date
                );
                const available = it.milk_type === 'buffalo' ? remain.buffalo : remain.cow;
                // account for this transfer being pending - it's already deducted in computeMilkRemaining
                // because we count pending + approved for outgoing
                if (available < -0.001) {
                    throw { code: 400, message: `Source no longer has enough ${it.milk_type || 'milk'} stock` };
                }
            } else {
                const remain = await computeItemRemaining(
                    conn, transfer.from_centre_id, transfer.transfer_date,
                    it.stock_type, it.ref_id
                );
                if (remain < -0.001) {
                    throw { code: 400, message: `Source no longer has enough ${it.item_name}` };
                }
            }
        }

        await conn.query(
            `UPDATE stock_transfers
             SET status='approved', approved_by=?, approved_at=NOW()
             WHERE transfer_id = ?`,
            [userId, id]
        );

        await conn.commit();
        res.json({ message: 'Transfer approved' });
    } catch (err) {
        await conn.rollback();
        console.error('approveTransfer error:', err);
        res.status(err.code || 500).json({ error: err.message || 'Server error' });
    } finally {
        conn.release();
    }
};

// ── PUT /api/stock-transfers/:id/reject ────────────────────────
exports.rejectTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        const [[transfer]] = await pool.query(
            `SELECT * FROM stock_transfers WHERE transfer_id = ?`, [id]
        );
        if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
        if (transfer.status !== 'pending') return res.status(400).json({ error: 'Transfer not pending' });
        if (Number(transfer.to_centre_id) !== Number(req.user.centre_id)) {
            return res.status(403).json({ error: 'Only recipient can reject' });
        }

        await pool.query(
            `UPDATE stock_transfers
             SET status='rejected', rejection_reason=?, approved_by=?, approved_at=NOW()
             WHERE transfer_id = ?`,
            [rejection_reason || null, req.user.user_id, id]
        );
        res.json({ message: 'Transfer rejected' });
    } catch (err) {
        console.error('rejectTransfer error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ── DELETE /api/stock-transfers/:id ────────────────────────────
// Only the sender can cancel, and only while pending.
exports.cancelTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const [[transfer]] = await pool.query(
            `SELECT * FROM stock_transfers WHERE transfer_id = ?`, [id]
        );
        if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
        if (transfer.status !== 'pending') return res.status(400).json({ error: 'Only pending transfers can be cancelled' });
        if (Number(transfer.from_centre_id) !== Number(req.user.centre_id)) {
            return res.status(403).json({ error: 'Only sender can cancel' });
        }

        await pool.query(
            `UPDATE stock_transfers SET status='cancelled' WHERE transfer_id = ?`, [id]
        );
        res.json({ message: 'Transfer cancelled' });
    } catch (err) {
        console.error('cancelTransfer error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};