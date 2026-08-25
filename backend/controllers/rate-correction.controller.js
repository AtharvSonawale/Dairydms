const pool = require("../config/db");

const tbl = (milk_type) => {
    if (milk_type === "buffalo") return "buffalo_milk_rates";
    if (milk_type === "mixed") return "mixed_milk_rates";
    return "cow_milk_rates";
};

// ── find the correct rate for a given fat/snf/date/milk_type ──
// Mirrors lookupRate's logic: search the type-specific table plus
// mixed_milk_rates, take the closest FAT/SNF match on that exact date.
const findCorrectRate = async (centreId, milk_type, fat, snf, date) => {
    const tablesToSearch =
        milk_type === "mixed" ? ["mixed_milk_rates"] : [tbl(milk_type), "mixed_milk_rates"];

    let best = null;
    for (const table of tablesToSearch) {
        // Step 1: find the most recent rate-chart "version" (effective_from)
        // that is on or before this entry's date and hasn't expired yet.
        // This is what lets a rate entered once on the 5th correctly apply
        // to the 6th–10th too, without requiring it to be copied to every day.
        const [[verRow]] = await pool.query(
            `SELECT MAX(effective_from) AS ver_date FROM ??
       WHERE centre_id = ? AND effective_from <= ?
         AND (effective_to IS NULL OR effective_to >= ?)`,
            [table, centreId, date, date],
        );
        if (!verRow?.ver_date) continue;

        // Step 2: within that version, find the closest FAT/SNF match.
        const [rows] = await pool.query(
            `SELECT rate, mrp, ABS(fat - ?) + ABS(snf - ?) AS diff
       FROM ?? WHERE centre_id = ? AND effective_from = ?
       ORDER BY diff ASC LIMIT 1`,
            [fat, snf, table, centreId, verRow.ver_date],
        );
        if (rows[0] && (!best || rows[0].diff < best.diff)) {
            best = rows[0];
        }
    }
    return best;
};

// ── check if an entry has already been included in a generated bill ──
const isEntryBilled = async (entryId) => {
    const [rows] = await pool.query(
        `SELECT bill_id FROM bill_milk_entries WHERE original_entry_id = ? LIMIT 1`,
        [entryId],
    );
    return rows[0]?.bill_id || null;
};

// ══════════════════════════════════════════════════════════════
// POST /api/rates/recompute-preview
// Body: { from_date, to_date, milk_type, seller_id? }
// Returns a diff list — nothing is written.
// ══════════════════════════════════════════════════════════════
exports.previewRecompute = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { from_date, to_date, milk_type, seller_id } = req.body;

        if (!from_date || !to_date || !milk_type) {
            return res.status(400).json({ message: "from_date, to_date and milk_type are required" });
        }

        let query = `
      SELECT me.entry_id, me.seller_id, s.name AS seller_name, s.seller_code,
             me.entry_date, me.shift, me.milk_type, me.quantity, me.fat, me.snf,
             me.rate_applied, me.total_amount, me.is_premium
      FROM milk_entries me
      JOIN sellers s ON s.seller_id = me.seller_id
      WHERE me.centre_id = ? AND me.entry_date BETWEEN ? AND ?
    `;
        const params = [centreId, from_date, to_date];

        // milk_entries.milk_type is only ever 'cow' or 'buffalo' — there is no
        // 'mixed' entry type. A mixed rate can still apply to those entries via
        // the mixed_milk_rates fallback inside findCorrectRate, so don't filter
        // entries out by comparing against a value that never exists on them.
        if (milk_type !== "mixed") {
            query += ` AND me.milk_type = ?`;
            params.push(milk_type);
        }

        if (seller_id) {
            query += ` AND me.seller_id = ?`;
            params.push(seller_id);
        }
        query += ` ORDER BY me.entry_date ASC, me.seller_id ASC`;

        const [entries] = await pool.query(query, params);

        const diffs = [];
        for (const entry of entries) {
            // Premium-rate sellers have a negotiated flat rate, not a FAT/SNF
            // lookup — skip auto-recompute for those and flag for manual review.
            if (entry.is_premium) {
                diffs.push({ ...entry, correct_rate: null, needsManualReview: true });
                continue;
            }

            const match = await findCorrectRate(
                centreId, entry.milk_type, entry.fat, entry.snf, entry.entry_date,
            );
            if (!match) continue; // no rate published for this date yet — nothing to compare

            const correctRate = parseFloat(match.rate);
            const currentRate = parseFloat(entry.rate_applied);
            if (Math.abs(correctRate - currentRate) < 0.005) continue; // already correct

            const correctTotal = parseFloat((entry.quantity * correctRate).toFixed(2));
            const billId = await isEntryBilled(entry.entry_id);

            diffs.push({
                entry_id: entry.entry_id,
                seller_id: entry.seller_id,
                seller_name: entry.seller_name,
                seller_code: entry.seller_code,
                entry_date: entry.entry_date,
                shift: entry.shift,
                old_rate: currentRate,
                new_rate: correctRate,
                old_total: parseFloat(entry.total_amount),
                new_total: correctTotal,
                delta: parseFloat((correctTotal - parseFloat(entry.total_amount)).toFixed(2)),
                already_billed: !!billId,
                bill_id: billId,
            });
        }

        res.json({ count: diffs.length, diffs });
    } catch (err) {
        console.error("previewRecompute error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ══════════════════════════════════════════════════════════════
// POST /api/rates/recompute-apply
// Body: { entry_ids: [...], reason? }
// Recomputes fresh (doesn't trust the preview payload) and writes.
// ══════════════════════════════════════════════════════════════
exports.applyRecompute = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const centreId = req.user.centre_id;
        const adminId = req.user.role === "admin" ? req.user.id : null;
        const { entry_ids, reason } = req.body;

        if (!Array.isArray(entry_ids) || entry_ids.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: "entry_ids array is required" });
        }

        let corrected = 0;
        let ledgered = 0;
        let skipped = 0;

        for (const entryId of entry_ids) {
            const [[entry]] = await conn.query(
                `SELECT * FROM milk_entries WHERE entry_id = ? AND centre_id = ?`,
                [entryId, centreId],
            );
            if (!entry || entry.is_premium) { skipped++; continue; }

            const match = await findCorrectRate(
                centreId, entry.milk_type, entry.fat, entry.snf, entry.entry_date,
            );
            if (!match) { skipped++; continue; }

            const correctRate = parseFloat(match.rate);
            const currentRate = parseFloat(entry.rate_applied);
            if (Math.abs(correctRate - currentRate) < 0.005) { skipped++; continue; }

            const correctTotal = parseFloat((entry.quantity * correctRate).toFixed(2));

            // Preserve the FIRST original value only — repeated corrections
            // shouldn't overwrite the true original with an intermediate one.
            await conn.query(
                `UPDATE milk_entries
         SET original_rate_applied = COALESCE(original_rate_applied, rate_applied),
             original_total_amount = COALESCE(original_total_amount, total_amount),
             rate_applied = ?,
             total_amount = ?,
             rate_corrected_at = NOW(),
             rate_corrected_by = ?
         WHERE entry_id = ? AND centre_id = ?`,
                [correctRate, correctTotal, adminId, entryId, centreId],
            );
            corrected++;

            // If this entry was already pulled into a generated bill, the bill's
            // own snapshot in bill_milk_entries stays untouched (by design) — so
            // record the delta to be settled in the seller's next payment cycle.
            const billId = await isEntryBilled(entryId);
            if (billId) {
                await conn.query(
                    `INSERT INTO rate_adjustments
             (entry_id, seller_id, centre_id, entry_date, milk_type,
              original_rate, corrected_rate, original_amount, corrected_amount,
              delta, reason, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        entryId, entry.seller_id, centreId, entry.entry_date, entry.milk_type,
                        currentRate, correctRate, entry.total_amount, correctTotal,
                        parseFloat((correctTotal - entry.total_amount).toFixed(2)),
                        reason || "Retroactive rate correction", adminId,
                    ],
                );
                ledgered++;
            }
        }

        await conn.commit();
        res.json({
            message: `${corrected} entrie(s) corrected, ${ledgered} queued as pending adjustment for next payment, ${skipped} skipped.`,
            corrected, ledgered, skipped,
        });
    } catch (err) {
        await conn.rollback();
        console.error("applyRecompute error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    } finally {
        conn.release();
    }
};

// ══════════════════════════════════════════════════════════════
// GET /api/rates/pending-adjustments?seller_id=...
// Used when generating the NEXT bill for a seller — pulls any
// unsettled correction deltas so they get folded into that payment.
// ══════════════════════════════════════════════════════════════
exports.getPendingAdjustments = async (req, res) => {
    try {
        const centreId = req.user.centre_id;
        const { seller_id } = req.query;
        let query = `SELECT * FROM rate_adjustments WHERE centre_id = ? AND status = 'pending'`;
        const params = [centreId];
        if (seller_id) { query += ` AND seller_id = ?`; params.push(seller_id); }
        query += ` ORDER BY entry_date ASC`;
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("getPendingAdjustments error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};