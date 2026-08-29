// controllers/fulfillment.controller.js
const pool = require('../config/db');

// ── Whitelisted config per fulfillment type ──
// NOTE: these values are NEVER taken from user input directly — `type` is
// validated against Object.keys(TYPE_CONFIG) before this object is touched,
// so interpolating table/column names below is safe (no SQL injection).
const TYPE_CONFIG = {
    feed: {
        fulfillmentTable: 'cattle_feed_fulfillments',
        salesTable: 'cattle_feed_sales',
        itemTable: 'cattle_feeds',
        itemIdCol: 'feed_id',
        itemNameCol: 'feed_name',
        namedBuyersTable: 'cattle_feed_named_buyers',
        successMessage: 'Feed collection confirmed.',
        alreadyUsedMessage: 'This receipt has already been used to collect feed.',
    },
    product: {
        fulfillmentTable: 'product_fulfillments',
        salesTable: 'product_sales',
        itemTable: 'products',
        itemIdCol: 'product_id',
        itemNameCol: 'product_name',
        namedBuyersTable: 'product_named_buyers',
        successMessage: 'Product collection confirmed.',
        alreadyUsedMessage: 'This receipt has already been used to collect the product.',
    },
};

const resolveType = (req, res) => {
    const type = String(req.params.type || '').toLowerCase();
    const config = TYPE_CONFIG[type];
    if (!config) {
        res.status(400).json({ error: `Invalid fulfillment type "${req.params.type}". Expected "feed" or "product".` });
        return null;
    }
    return config;
};

// ══════════════════════════════════════════════════════════════
// GET /api/fulfillment/:type/:token
//   Preview only — does NOT mark fulfilled.
// ══════════════════════════════════════════════════════════════
exports.getFulfillmentByToken = async (req, res) => {
    const cfg = resolveType(req, res);
    if (!cfg) return;

    try {
        const { token } = req.params;
        const centreId = req.user.centre_id;

        const [rows] = await pool.query(
            `SELECT f.fulfillment_id, f.transaction_id, f.status, f.fulfilled_at,
                    f.fulfilled_by_operator_id, o.name AS fulfilled_by_name
             FROM ${cfg.fulfillmentTable} f
             LEFT JOIN operators o ON o.operator_id = f.fulfilled_by_operator_id
             WHERE f.token = ? AND f.centre_id = ?`,
            [token, centreId]
        );
        if (!rows.length) {
            return res.status(404).json({ error: 'Invalid QR code for this centre.' });
        }
        const fulfillment = rows[0];

        const [items] = await pool.query(
            `SELECT s.sale_id, s.${cfg.itemIdCol}, it.${cfg.itemNameCol}, it.unit,
                    s.quantity, s.rate, s.total_amount,
                    s.buyer_type, s.buyer_name, s.sale_date, s.created_at,
                    sl.name AS seller_name, sl.seller_code,
                    nb.name AS registered_buyer_name
             FROM ${cfg.salesTable} s
             JOIN ${cfg.itemTable} it ON it.${cfg.itemIdCol} = s.${cfg.itemIdCol}
             LEFT JOIN sellers sl ON sl.seller_id = s.seller_id
             LEFT JOIN ${cfg.namedBuyersTable} nb ON nb.buyer_id = s.buyer_id
             WHERE s.transaction_id = ?`,
            [fulfillment.transaction_id]
        );

        // normalize the item name field so the frontend can use one key
        // ("item_name") regardless of fulfillment type
        const normalizedItems = items.map((row) => ({
            ...row,
            item_name: row[cfg.itemNameCol],
        }));

        res.json({
            type: req.params.type,
            transaction_id: fulfillment.transaction_id,
            status: fulfillment.status,
            fulfilled_at: fulfillment.fulfilled_at,
            fulfilled_by_name: fulfillment.fulfilled_by_name,
            items: normalizedItems,
        });
    } catch (err) {
        console.error('getFulfillmentByToken error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// POST /api/fulfillment/:type/:token/confirm
//   SELECT ... FOR UPDATE so two near-simultaneous scans can't both
//   succeed on the same QR.
// ══════════════════════════════════════════════════════════════
exports.confirmFulfillment = async (req, res) => {
    const cfg = resolveType(req, res);
    if (!cfg) return;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { token } = req.params;
        const centreId = req.user.centre_id;
        const scannerId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [rows] = await conn.query(
            `SELECT * FROM ${cfg.fulfillmentTable} WHERE token = ? AND centre_id = ? FOR UPDATE`,
            [token, centreId]
        );
        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Invalid QR code for this centre.' });
        }
        const fulfillment = rows[0];

        if (fulfillment.status === 'fulfilled') {
            await conn.rollback();
            return res.status(409).json({
                error: cfg.alreadyUsedMessage,
                fulfilled_at: fulfillment.fulfilled_at,
            });
        }
        if (fulfillment.status === 'cancelled') {
            await conn.rollback();
            return res.status(410).json({ error: 'This receipt was cancelled and cannot be redeemed.' });
        }

        let fulfilledByOperatorId = null;
        if (!isAdmin) {
            const [opCheck] = await conn.query(
                `SELECT operator_id FROM operators WHERE operator_id = ? AND centre_id = ?`,
                [scannerId, centreId]
            );
            if (opCheck.length) fulfilledByOperatorId = scannerId;
        }

        await conn.query(
            `UPDATE ${cfg.fulfillmentTable}
             SET status = 'fulfilled', fulfilled_at = NOW(), fulfilled_by_operator_id = ?
             WHERE fulfillment_id = ?`,
            [fulfilledByOperatorId, fulfillment.fulfillment_id]
        );

        await conn.commit();

        const [items] = await pool.query(
            `SELECT it.${cfg.itemNameCol} AS item_name, it.unit, s.quantity
             FROM ${cfg.salesTable} s
             JOIN ${cfg.itemTable} it ON it.${cfg.itemIdCol} = s.${cfg.itemIdCol}
             WHERE s.transaction_id = ?`,
            [fulfillment.transaction_id]
        );

        res.json({
            message: cfg.successMessage,
            transaction_id: fulfillment.transaction_id,
            items,
        });
    } catch (err) {
        await conn.rollback();
        console.error('confirmFulfillment error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    } finally {
        conn.release();
    }
};