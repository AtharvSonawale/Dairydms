// backend/controllers/stock.controller.js

const pool = require('../config/db');

// ── GET /api/stock/available?date=YYYY-MM-DD ─────────────────
// Computes remaining milk per type for the operator on that date.
//
// Formula:
//   collected  = SUM(milk_entries.quantity)      grouped by milk_type
//   walkin_out = SUM(walkin_sales.quantity)       grouped by milk_type
//   owner_out  = SUM(owner_usage.quantity)        grouped by milk_type
//   dispatched = SUM(tank_dispatch.total_liters)  (already dispatched today)
//   remaining  = collected - walkin_out - owner_out - dispatched
//
// Also returns weighted avg FAT and SNF from milk_entries for that date.

exports.getAvailableStock = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        // ── 1. Collected milk (from milk entries) ──
        const [collected] = await pool.query(
            `SELECT
                milk_type,
                SUM(quantity) AS total_qty,
                SUM(fat * quantity) / NULLIF(SUM(quantity), 0) AS avg_fat,
                SUM(snf * quantity) / NULLIF(SUM(quantity), 0) AS avg_snf
             FROM milk_entries
             WHERE centre_id = ? AND entry_date = ?
             GROUP BY milk_type`,
            [centreId, date]
        );

        // ── 2. Walk-in sales OUT ──
        const [walkinOut] = await pool.query(
            `SELECT milk_type, SUM(quantity) AS total_qty
             FROM walkin_sales
             WHERE centre_id = ? AND sale_date = ?
             GROUP BY milk_type`,
            [centreId, date]
        );

        // ── 3. Owner usage OUT ──
        const [ownerOut] = await pool.query(
            `SELECT milk_type, SUM(quantity) AS total_qty
             FROM owner_usage
             WHERE centre_id = ? AND usage_date = ?
             GROUP BY milk_type`,
            [centreId, date]
        );

        // ── 4. Already dispatched today (from tank_dispatch) ──
        const [dispatched] = await pool.query(
            `SELECT
                SUM(cow_liters) AS cow_dispatched,
                SUM(buffalo_liters) AS buffalo_dispatched
             FROM tank_dispatch
             WHERE centre_id = ? AND dispatch_date = ?`,
            [centreId, date]
        );
        const cowDispatched = parseFloat(dispatched[0]?.cow_dispatched || 0);
        const buffaloDispatched = parseFloat(dispatched[0]?.buffalo_dispatched || 0);

        // ── helpers to look up per type ──
        const getQty = (rows, type) => {
            const row = rows.find(r => r.milk_type === type);
            return parseFloat(row?.total_qty || 0);
        };
        const getFat = (rows, type) => {
            const row = rows.find(r => r.milk_type === type);
            return row?.avg_fat != null ? parseFloat(row.avg_fat) : null;
        };
        const getSnf = (rows, type) => {
            const row = rows.find(r => r.milk_type === type);
            return row?.avg_snf != null ? parseFloat(row.avg_snf) : null;
        };

        // ── per-type collected ──
        const cowCollected = getQty(collected, 'cow');
        const buffaloCollected = getQty(collected, 'buffalo');

        // ── per-type OUT (walkin + owner) ──
        const cowOut = getQty(walkinOut, 'cow') + getQty(ownerOut, 'cow');
        const buffaloOut = getQty(walkinOut, 'buffalo') + getQty(ownerOut, 'buffalo');

        // ── remaining after all deductions ──
        const cowRemaining = Math.max(0, cowCollected - cowOut - cowDispatched);
        const buffaloRemaining = Math.max(0, buffaloCollected - buffaloOut - buffaloDispatched);
        const totalRemaining = cowRemaining + buffaloRemaining;

        // ── weighted avg FAT/SNF from milk entries ──
        const cowFat = getFat(collected, 'cow');
        const cowSnf = getSnf(collected, 'cow');
        const buffaloFat = getFat(collected, 'buffalo');
        const buffaloSnf = getSnf(collected, 'buffalo');

        // combined weighted average
        const totalCollected = cowCollected + buffaloCollected;
        const avgFatTotal = totalCollected > 0
            ? ((cowFat || 0) * cowCollected + (buffaloFat || 0) * buffaloCollected) / totalCollected
            : null;
        const avgSnfTotal = totalCollected > 0
            ? ((cowSnf || 0) * cowCollected + (buffaloSnf || 0) * buffaloCollected) / totalCollected
            : null;

        res.json({
            date,
            available: {
                cow: parseFloat(cowRemaining.toFixed(2)),
                buffalo: parseFloat(buffaloRemaining.toFixed(2)),
                total: parseFloat(totalRemaining.toFixed(2)),
            },
            collected: {
                cow: parseFloat(cowCollected.toFixed(2)),
                buffalo: parseFloat(buffaloCollected.toFixed(2)),
                total: parseFloat(totalCollected.toFixed(2)),
            },
            avg_fat_cow: cowFat != null ? parseFloat(cowFat.toFixed(2)) : null,
            avg_snf_cow: cowSnf != null ? parseFloat(cowSnf.toFixed(2)) : null,
            avg_fat_buffalo: buffaloFat != null ? parseFloat(buffaloFat.toFixed(2)) : null,
            avg_snf_buffalo: buffaloSnf != null ? parseFloat(buffaloSnf.toFixed(2)) : null,
            avg_fat_total: avgFatTotal != null ? parseFloat(avgFatTotal.toFixed(2)) : null,
            avg_snf_total: avgSnfTotal != null ? parseFloat(avgSnfTotal.toFixed(2)) : null,
            breakdown: {
                cow_collected: parseFloat(cowCollected.toFixed(2)),
                buffalo_collected: parseFloat(buffaloCollected.toFixed(2)),
                cow_walkin_out: parseFloat(getQty(walkinOut, 'cow').toFixed(2)),
                buffalo_walkin_out: parseFloat(getQty(walkinOut, 'buffalo').toFixed(2)),
                cow_owner_out: parseFloat(getQty(ownerOut, 'cow').toFixed(2)),
                buffalo_owner_out: parseFloat(getQty(ownerOut, 'buffalo').toFixed(2)),
                cow_dispatched: cowDispatched,
                buffalo_dispatched: buffaloDispatched,
            },
        });

    } catch (err) {
        console.error('getAvailableStock error:', err);
        res.status(500).json({ error: 'Server error', message: err.message });
    }
};