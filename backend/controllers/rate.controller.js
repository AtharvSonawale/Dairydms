const pool = require("../config/db");

// ── helper — pick the right table ────────────────────────────
const tbl = (milk_type) => {
  if (milk_type === "buffalo") return "buffalo_milk_rates";
  if (milk_type === "mixed") return "mixed_milk_rates";
  return "cow_milk_rates";
};

// ── helper — for "mixed" rates only: checks whether a FAT/SNF combo on a
// given date is already covered by a cow or buffalo rate. Mixed rates
// should only ever fill in combos that neither cow nor buffalo defines —
// otherwise milk-entry lookups can pick either row ambiguously.
async function existsInCowOrBuffalo(centreId, fat, snf, date) {
  const [rows] = await pool.query(
    `SELECT rate_id FROM cow_milk_rates
       WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?
     UNION ALL
     SELECT rate_id FROM buffalo_milk_rates
       WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
    [centreId, fat, snf, date, centreId, fat, snf, date],
  );
  return rows.length > 0;
}

// ── GET /api/rates?date=YYYY-MM-DD&milk_type=cow|buffalo ─────
// Returns rates only for the EXACT selected date (effective_from = date).
// Rates saved for 2026-05-01 will NOT appear on 2026-05-02 unless copied.
exports.getRates = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const date = req.query.date || new Date().toISOString().split("T")[0];
    const milk_type = ["buffalo", "mixed"].includes(req.query.milk_type)
      ? req.query.milk_type
      : "cow";
    const table = tbl(milk_type);

    const [rows] = await pool.query(
      `SELECT *, '${milk_type}' AS milk_type
             FROM ${table}
             WHERE centre_id = ? AND effective_from = ?
             ORDER BY fat ASC, snf ASC`,
      [centreId, date],
    );

    res.json(rows);
  } catch (err) {
    console.error("getRates error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET /api/rates/range ─────────────────────────────────────
// Returns all rates in a date range for a specific milk type
exports.getRatesByDateRange = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { from_date, to_date, milk_type } = req.query;

    if (!from_date || !to_date || !milk_type) {
      return res.status(400).json({
        message: "from_date, to_date and milk_type are required"
      });
    }

    if (to_date < from_date) {
      return res.status(400).json({
        message: "to_date must be on or after from_date"
      });
    }

    const table = tbl(milk_type);

    const [rows] = await pool.query(
      `SELECT *, '${milk_type}' AS milk_type
       FROM ${table}
       WHERE centre_id = ? AND effective_from BETWEEN ? AND ?
       ORDER BY effective_from ASC, fat ASC, snf ASC`,
      [centreId, from_date, to_date]
    );

    res.json(rows);
  } catch (err) {
    console.error("getRatesByDateRange error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── DELETE /api/rates/range ──────────────────────────────────
// Deletes all rates in a date range for a specific milk type
exports.deleteRatesByDateRange = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { from_date, to_date, milk_type } = req.body;

    if (!from_date || !to_date || !milk_type) {
      return res.status(400).json({
        message: "from_date, to_date and milk_type are required"
      });
    }

    if (to_date < from_date) {
      return res.status(400).json({
        message: "to_date must be on or after from_date"
      });
    }

    const table = tbl(milk_type);

    // First, count how many will be deleted
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as count FROM ${table} 
       WHERE centre_id = ? AND effective_from BETWEEN ? AND ?`,
      [centreId, from_date, to_date]
    );

    const count = countResult[0].count;

    if (count === 0) {
      return res.status(404).json({
        message: `No ${milk_type} rates found in the date range ${from_date} to ${to_date}.`
      });
    }

    // Perform the deletion
    const [result] = await pool.query(
      `DELETE FROM ${table} 
       WHERE centre_id = ? AND effective_from BETWEEN ? AND ?`,
      [centreId, from_date, to_date]
    );

    const dateRangeStr = `${new Date(from_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(to_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    res.json({
      message: `${result.affectedRows} ${milk_type} rate(s) deleted for ${dateRangeStr}.`,
      deleted: result.affectedRows,
      from_date,
      to_date,
      milk_type
    });
  } catch (err) {
    console.error("deleteRatesByDateRange error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/rates ───────────────────────────────────────────
exports.createRate = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { milk_type, fat, snf, rate, mrp, effective_from, effective_to } =
      req.body;

    if (!milk_type || fat == null || snf == null || !rate || !effective_from)
      return res.status(400).json({
        message: "milk_type, fat, snf, rate and effective_from are required",
      });

    if (!["cow", "buffalo", "mixed"].includes(milk_type))
      return res
        .status(400)
        .json({ message: "milk_type must be 'cow', 'buffalo' or 'mixed'" });

    const table = tbl(milk_type);
    const fatNum = parseFloat(fat);
    const snfNum = parseFloat(snf);
    const rateNum = parseFloat(rate);
    const mrpNum = mrp ? parseFloat(mrp) : null;

    // build the list of dates this rate should apply to
    const targetDates = [];
    if (effective_to && effective_to > effective_from) {
      const cursor = new Date(effective_from);
      const end = new Date(effective_to);
      while (cursor <= end) {
        targetDates.push(cursor.toISOString().split("T")[0]);
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      targetDates.push(effective_from);
    }

    // For "mixed" rates, skip any date where this exact FAT/SNF combo is
    // already covered by a cow or buffalo rate — mixed should only fill
    // gaps, never overlap cow/buffalo.
    let overlapSkipped = 0;
    let datesToInsert = targetDates;
    if (milk_type === "mixed") {
      const checks = await Promise.all(
        targetDates.map((date) => existsInCowOrBuffalo(centreId, fatNum, snfNum, date)),
      );
      datesToInsert = targetDates.filter((_, idx) => !checks[idx]);
      overlapSkipped = targetDates.length - datesToInsert.length;
    }

    if (datesToInsert.length === 0) {
      return res.status(409).json({
        message: `FAT ${fatNum}, SNF ${snfNum} is already covered by a cow or buffalo rate on ${targetDates.length > 1 ? "every date in this range" : effective_from}. Mixed rates can only be added for FAT/SNF combinations not already defined for cow or buffalo.`,
      });
    }

    // one row per date, mirroring how copyForward stores rows
    const values = datesToInsert.map((date) => [
      centreId,
      fatNum,
      snfNum,
      rateNum,
      mrpNum,
      date,
      null,
    ]);

    const [result] = await pool.query(
      `INSERT IGNORE INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to) VALUES ?`,
      [values],
    );

    const [newRow] = await pool.query(
      `SELECT *, '${milk_type}' AS milk_type FROM ${table}
             WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
      [centreId, fatNum, snfNum, datesToInsert.includes(effective_from) ? effective_from : datesToInsert[0]],
    );

    const messageParts = [];
    if (targetDates.length > 1) {
      messageParts.push(`Rate saved for ${result.affectedRows} of ${targetDates.length} day(s) from ${effective_from} to ${effective_to}.`);
    }
    if (overlapSkipped > 0) {
      messageParts.push(`${overlapSkipped} date(s) skipped — FAT ${fatNum}/SNF ${snfNum} already exists in cow or buffalo rates on those date(s).`);
    }

    res.status(201).json({
      ...newRow[0],
      message: messageParts.length > 0 ? messageParts.join(" ") : undefined,
    });
  } catch (err) {
    console.error("createRate error:", err);
    if (err.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ message: "A rate for this FAT, SNF and date already exists." });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── PUT /api/rates/:id?milk_type=cow|buffalo ─────────────────
exports.updateRate = async (req, res) => {
  try {
    const { id } = req.params;
    const centreId = req.user.centre_id;
    const milk_type = req.query.milk_type || req.body.milk_type || "cow";
    const { fat, snf, rate, mrp, effective_from, effective_to } = req.body;
    const table = tbl(milk_type);

    const [existing] = await pool.query(
      `SELECT * FROM ${table} WHERE rate_id = ? AND centre_id = ?`,
      [id, centreId],
    );
    if (!existing[0])
      return res.status(404).json({ message: "Rate not found in your centre" });

    // ── check for duplicate EXCLUDING the row being edited ──
    const [dup] = await pool.query(
      `SELECT rate_id FROM ${table}
             WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?
               AND rate_id != ?`,
      [centreId, parseFloat(fat), parseFloat(snf), effective_from, id],
    );
    if (dup[0])
      return res.status(409).json({
        message: `Another rate for FAT ${fat}, SNF ${snf} on ${effective_from} already exists.`,
      });

    await pool.query(
      `UPDATE ${table}
             SET fat = ?, snf = ?, rate = ?, mrp = ?, effective_from = ?, effective_to = ?
             WHERE rate_id = ? AND centre_id = ?`,
      [
        parseFloat(fat),
        parseFloat(snf),
        parseFloat(rate),
        parseFloat(mrp),
        effective_from,
        effective_to || null,
        id,
        centreId,
      ],
    );

    const [updated] = await pool.query(
      `SELECT *, '${milk_type}' AS milk_type FROM ${table} WHERE rate_id = ? AND centre_id = ?`,
      [id, centreId],
    );
    res.json(updated[0]);
  } catch (err) {
    console.error("updateRate error:", err);
    if (err.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ message: "A rate for this FAT, SNF and date already exists." });
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── DELETE /api/rates/:id?milk_type=cow|buffalo ──────────────
exports.deleteRate = async (req, res) => {
  try {
    const { id } = req.params;
    const centreId = req.user.centre_id;
    const milk_type = req.query.milk_type || "cow";
    const table = tbl(milk_type);

    const [existing] = await pool.query(
      `SELECT * FROM ${table} WHERE rate_id = ? AND centre_id = ?`,
      [id, centreId],
    );
    if (!existing[0])
      return res.status(404).json({ message: "Rate not found in your centre" });

    await pool.query(
      `DELETE FROM ${table} WHERE rate_id = ? AND centre_id = ?`,
      [id, centreId],
    );
    res.json({ message: "Rate deleted successfully" });
  } catch (err) {
    console.error("deleteRate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/rates/copy-forward ─────────────────────────────
// Copies rates from from_date to every date in [start_date, end_date] in ONE bulk insert.
exports.copyForward = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { from_date, start_date, end_date, milk_type } = req.body;

    if (!from_date || !start_date || !end_date || !milk_type)
      return res.status(400).json({
        message: "from_date, start_date, end_date and milk_type are required",
      });

    if (end_date < start_date)
      return res
        .status(400)
        .json({ message: "end_date must be on or after start_date" });

    const table = tbl(milk_type);

    // fetch source rates once
    const [rows] = await pool.query(
      `SELECT fat, snf, rate, mrp FROM ${table} WHERE centre_id = ? AND effective_from = ?`,
      [centreId, from_date],
    );

    if (rows.length === 0)
      return res.status(404).json({
        message: `No rates found for ${from_date}. Only dates with saved rates can be copied.`,
      });

    // build target date list
    const targetDates = [];
    const cursor = new Date(start_date);
    const end = new Date(end_date);
    while (cursor <= end) {
      targetDates.push(cursor.toISOString().split("T")[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    // cross join rows × target dates into one bulk value set
    const values = [];
    for (const date of targetDates) {
      for (const row of rows) {
        values.push([
          centreId,
          row.fat,
          row.snf,
          row.rate,
          row.mrp || null,
          date,
          null,
        ]);
      }
    }

    // chunk to keep any single query reasonably sized
    const CHUNK_SIZE = 2000;
    let inserted = 0;
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      const [result] = await pool.query(
        `INSERT IGNORE INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to) VALUES ?`,
        [chunk],
      );
      inserted += result.affectedRows;
    }

    const skipped = values.length - inserted;

    res.json({
      message: `${inserted} rate(s) copied across ${targetDates.length} date(s)${skipped ? `, ${skipped} skipped (already exist)` : ""}.`,
      inserted,
      skipped,
      days: targetDates.length,
    });
  } catch (err) {
    console.error("copyForward error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/rates/premium ───────────────────────────────────
exports.assignPremiumRate = async (req, res) => {
  try {
    const {
      seller_ids,
      milk_type,
      rate_per_liter,
      reason,
      effective_from,
      effective_to,
    } = req.body;
    const centreId = req.user.centre_id;
    const operatorId = req.user.id;
    const isAdmin = req.user.role === "admin";
    if (
      !seller_ids?.length ||
      !milk_type ||
      !rate_per_liter ||
      !effective_from ||
      !reason
    )
      return res.status(400).json({ message: "All fields are required" });

    // Verify sellers belong to the centre
    const placeholders = seller_ids.map(() => "?").join(",");
    const [sellers] = await pool.query(
      `SELECT seller_id FROM sellers 
             WHERE seller_id IN (${placeholders}) AND centre_id = ?`,
      [...seller_ids, centreId],
    );

    if (sellers.length !== seller_ids.length) {
      return res.status(403).json({
        message: "Some sellers not found in your centre.",
      });
    }

    // REMOVED operator ownership check - any operator can assign premium rates to any seller

    const values = seller_ids.map((id) => [
      id,
      centreId,
      milk_type,
      parseFloat(rate_per_liter),
      reason,
      effective_from,
      effective_to || null,
    ]);

    const [insertResult] = await pool.query(
      `INSERT INTO premium_rates
     (seller_id, centre_id, milk_type, rate_per_liter, reason, effective_from, effective_to)
     VALUES ?`,
      [values],
    );

    res.json({
      message: `Premium rate assigned to ${seller_ids.length} seller(s).`,
    });
  } catch (err) {
    console.error("assignPremiumRate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET /api/rates/lookup?fat=3.5&snf=8.4&milk_type=cow&date=2026-05-10 ──
exports.lookupRate = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { fat, snf, milk_type, date } = req.query;

    if (!fat || !snf || !milk_type || !date)
      return res
        .status(400)
        .json({ error: "fat, snf, milk_type and date are required" });

    // cow  -> search cow_milk_rates + mixed_milk_rates, take the closer match.
    // buffalo -> search buffalo_milk_rates + mixed_milk_rates, take the closer match.
    // mixed -> only mixed_milk_rates itself.
    const tablesToSearch =
      milk_type === "mixed"
        ? ["mixed_milk_rates"]
        : [tbl(milk_type), "mixed_milk_rates"];

    const fatNum = parseFloat(fat);
    const snfNum = parseFloat(snf);

    // priority ensures the seller's own milk-type table (cow/buffalo) always
    // wins over "mixed" when both have an equally-close (or exact) match —
    // mixed_milk_rates is always listed last in tablesToSearch, so it always
    // gets the higher (lower-priority) number here.
    const unionQuery = tablesToSearch
      .map(
        (_, idx) => `
          SELECT *, ABS(fat - ?) + ABS(snf - ?) AS diff, ${idx} AS priority
          FROM ??
          WHERE centre_id = ? AND effective_from = ?`,
      )
      .join(" UNION ALL");

    const params = tablesToSearch.flatMap((table) => [
      fatNum,
      snfNum,
      table,
      centreId,
      date,
    ]);

    const [rows] = await pool.query(
      `${unionQuery} ORDER BY diff ASC, priority ASC LIMIT 1`,
      params,
    );

    if (!rows.length)
      return res.status(404).json({ error: "No matching rate found" });

    res.json({ ...rows[0], milk_type });
  } catch (err) {
    console.error("lookupRate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET /api/rates/premium ────────────────────────────────────
// Returns all premium rates with seller info, newest first
exports.getPremiumRates = async (req, res) => {
  try {
    const centreId = req.user.centre_id;

    // REMOVED operator filter - both admin and operator see all premium rates
    const query = `
            SELECT
                pr.id,
                pr.seller_id,
                pr.milk_type,
                pr.rate_per_liter,
                pr.reason,
                pr.effective_from,
                pr.effective_to,
                pr.is_active,
                pr.created_at,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                o.name        AS operator_name
            FROM premium_rates pr
            JOIN sellers s ON s.seller_id = pr.seller_id
            LEFT JOIN operators o ON o.operator_id = s.operator_id
            WHERE s.centre_id = ?
            ORDER BY pr.created_at DESC
        `;

    const [rows] = await pool.query(query, [centreId]);
    res.json(rows);
  } catch (err) {
    console.error("getPremiumRates error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── PUT /api/rates/premium/:id ────────────────────────────────
exports.updatePremiumRate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      seller_id,
      milk_type,
      rate_per_liter,
      reason,
      effective_from,
      effective_to,
    } = req.body;
    const centreId = req.user.centre_id;
    const operatorId = req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!seller_id || !milk_type || !rate_per_liter || !effective_from)
      return res.status(400).json({
        message:
          "seller_id, milk_type, rate_per_liter and effective_from are required.",
      });

    // Verify seller belongs to centre
    const [sellerCheck] = await pool.query(
      `SELECT seller_id, operator_id FROM sellers WHERE seller_id = ? AND centre_id = ?`,
      [seller_id, centreId],
    );
    if (!sellerCheck.length) {
      return res
        .status(403)
        .json({ message: "Seller not found in your centre." });
    }

    if (!isAdmin && sellerCheck[0].operator_id !== operatorId) {
      return res.status(403).json({
        message:
          "Access denied. You can only update premium rates for your own sellers.",
      });
    }

    const [existing] = await pool.query(
      `SELECT id FROM premium_rates WHERE id = ?`,
      [id],
    );
    if (!existing[0])
      return res.status(404).json({ message: "Premium rate not found." });

    await pool.query(
      `UPDATE premium_rates
             SET seller_id      = ?,
                 milk_type      = ?,
                 rate_per_liter = ?,
                 reason         = ?,
                 effective_from = ?,
                 effective_to   = ?
             WHERE id = ?`,
      [
        seller_id,
        milk_type,
        parseFloat(rate_per_liter),
        reason || null,
        effective_from,
        effective_to || null,
        id,
      ],
    );

    const [updated] = await pool.query(
      `SELECT
                pr.*,
                s.name        AS seller_name,
                s.seller_code AS seller_code,
                o.name        AS operator_name
             FROM premium_rates pr
             JOIN sellers s ON s.seller_id = pr.seller_id
             LEFT JOIN operators o ON o.operator_id = s.operator_id
             WHERE pr.id = ?`,
      [id],
    );

    res.json(updated[0]);
  } catch (err) {
    console.error("updatePremiumRate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── PATCH /api/rates/premium/:id/deactivate ───────────────────
exports.deactivatePremiumRate = async (req, res) => {
  try {
    const { id } = req.params;
    const centreId = req.user.centre_id;

    // Verify premium rate belongs to a seller in the centre
    // (operator ownership check removed to match assignPremiumRate policy —
    // any operator/admin in the centre can manage any seller's premium rate)
    const verifyQuery = `
            SELECT pr.id, pr.is_active, pr.seller_id
            FROM premium_rates pr
            JOIN sellers s ON s.seller_id = pr.seller_id
            WHERE pr.id = ? AND s.centre_id = ?
        `;
    const verifyParams = [id, centreId];

    const [existing] = await pool.query(verifyQuery, verifyParams);
    if (!existing[0])
      return res.status(404).json({ message: "Premium rate not found." });

    if (!existing[0].is_active)
      return res.status(400).json({ message: "Rate is already inactive." });

    await pool.query(`UPDATE premium_rates SET is_active = 0 WHERE id = ?`, [
      id,
    ]);

    res.json({
      message: "Premium rate deactivated successfully.",
      id: Number(id),
      is_active: 0,
    });
  } catch (err) {
    console.error("deactivatePremiumRate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── DELETE /api/rates/premium/:id ────────────────────────────
exports.deletePremiumRate = async (req, res) => {
  try {
    const { id } = req.params;
    const centreId = req.user.centre_id;
    const operatorId = req.user.id;
    const isAdmin = req.user.role === "admin";

    // Verify premium rate belongs to a seller in the centre
    let verifyQuery = `
            SELECT pr.id, pr.is_active, pr.seller_id
            FROM premium_rates pr
            JOIN sellers s ON s.seller_id = pr.seller_id
            WHERE pr.id = ? AND s.centre_id = ?
        `;
    let verifyParams = [id, centreId];

    if (!isAdmin) {
      verifyQuery += ` AND s.operator_id = ?`;
      verifyParams.push(operatorId);
    }

    const [existing] = await pool.query(verifyQuery, verifyParams);
    if (!existing[0])
      return res.status(404).json({ message: "Premium rate not found." });

    if (existing[0].is_active)
      return res.status(400).json({
        message: "Cannot delete an active rate. Deactivate it first.",
      });

    await pool.query(`DELETE FROM premium_rates WHERE id = ?`, [id]);

    res.json({ message: "Premium rate deleted successfully." });
  } catch (err) {
    console.error("deletePremiumRate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/rates/generate ──────────────────────────────────
exports.generateRates = async (req, res) => {
  try {
    const { milk_type, rate_date, rates } = req.body;
    // operator_id has a FK to `operators` — admins don't have a row there,
    // so only pass a real operator's id; otherwise store NULL.
    const operatorId = req.user.role === "admin" ? null : req.user.id;
    const centreId = req.user.centre_id;

    if (!milk_type || !rate_date || !Array.isArray(rates) || rates.length === 0)
      return res
        .status(400)
        .json({ message: "milk_type, rate_date and rates array are required" });

    if (!["cow", "buffalo", "mixed"].includes(milk_type))
      return res
        .status(400)
        .json({ message: "milk_type must be 'cow', 'buffalo' or 'mixed'" });

    const table = tbl(milk_type);

    let inserted = 0;
    let skipped = 0;
    let overlapSkipped = 0;

    for (const row of rates) {
      const fat = parseFloat(row.fat);
      const snf = parseFloat(row.snf);
      const rate = parseFloat(row.rate);
      const mrp = row.mrp ? parseFloat(row.mrp) : null;

      // For mixed rates, skip any FAT/SNF combo already covered by cow or buffalo
      if (milk_type === "mixed" && (await existsInCowOrBuffalo(centreId, fat, snf, rate_date))) {
        overlapSkipped++;
        skipped++;
        continue;
      }

      // 1. insert into cow/buffalo_milk_rates (skip if duplicate)
      const [dup] = await pool.query(
        `SELECT rate_id FROM ${table} WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
        [centreId, fat, snf, rate_date],
      );
      if (dup.length > 0) {
        skipped++;
      } else {
        await pool.query(
          `INSERT INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to)
                     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [centreId, fat, snf, rate, mrp, rate_date],
        );
        inserted++;
      }
      // 2. always insert into generated_rates with centre_id
      await pool.query(
        `INSERT INTO generated_rates (milk_type, fat, snf, rate, mrp, rate_date, operator_id, centre_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [milk_type, fat, snf, rate, mrp, rate_date, operatorId, centreId],
      );
    }

    res.json({
      message: `${inserted} rate(s) inserted, ${skipped} skipped${overlapSkipped > 0 ? ` (${overlapSkipped} overlapping cow/buffalo, rest already existed)` : " (already exist)"} for ${rate_date}.`,
      inserted,
      skipped,
      overlapSkipped,
      total: rates.length,
    });
  } catch (err) {
    console.error("generateRates error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── DELETE /api/rates/all?date=YYYY-MM-DD&milk_type=cow|buffalo ──
exports.deleteAllRates = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { date, milk_type } = req.query;

    if (!date || !milk_type)
      return res
        .status(400)
        .json({ message: "date and milk_type are required" });

    const table = tbl(milk_type);

    const [result] = await pool.query(
      `DELETE FROM ${table} WHERE centre_id = ? AND effective_from = ?`,
      [centreId, date],
    );

    res.json({
      message: `${result.affectedRows} ${milk_type} rate(s) deleted for ${date}.`,
      deleted: result.affectedRows,
    });
  } catch (err) {
    console.error("deleteAllRates error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── GET /api/rates/generated-history ──────────────────────────
// Returns history of generated rates
exports.getGeneratedRatesHistory = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { from, to, milk_type } = req.query;

    // REMOVED operator filter - both admin and operator see all generated rates
    let query = `
            SELECT gr.*, o.name AS operator_name
            FROM generated_rates gr
            LEFT JOIN operators o ON o.operator_id = gr.operator_id
            WHERE gr.centre_id = ?
        `;
    let params = [centreId];

    if (milk_type) {
      query += ` AND gr.milk_type = ?`;
      params.push(milk_type);
    }

    if (from && to) {
      query += ` AND gr.rate_date BETWEEN ? AND ?`;
      params.push(from, to);
    }

    query += ` ORDER BY gr.generated_at DESC LIMIT 1000`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error("getGeneratedRatesHistory error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/rates/import ────────────────────────────────────
// Bulk-imports rates from a parsed Excel/CSV file. Each row can specify
// its own milk_type, and effective_to (if present) expands into one row
// per day, same as createRate does for a single manual entry.
exports.importRates = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { rates } = req.body;

    if (!Array.isArray(rates) || rates.length === 0)
      return res.status(400).json({ message: "rates array is required" });

    let added = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rates.length; i++) {
      const row = rates[i];
      const rowNum = row._rowIndex || i + 1;

      const milk_type = ["buffalo", "mixed"].includes(row.milk_type)
        ? row.milk_type
        : "cow";
      const fat = parseFloat(row.fat);
      const snf = parseFloat(row.snf);
      const rate = parseFloat(row.rate);
      const mrp =
        row.mrp !== "" && row.mrp != null && !isNaN(parseFloat(row.mrp))
          ? parseFloat(row.mrp)
          : null;
      const effective_from = row.effective_from;
      const effective_to = row.effective_to || null;

      if (isNaN(fat) || isNaN(snf) || isNaN(rate) || !effective_from) {
        errors.push({
          row: rowNum,
          error: "Missing or invalid FAT, SNF, Rate, or Effective From.",
        });
        skipped++;
        continue;
      }

      const table = tbl(milk_type);

      // build the list of dates this rate should apply to (mirrors createRate)
      const targetDates = [];
      if (effective_to && effective_to > effective_from) {
        const cursor = new Date(effective_from);
        const end = new Date(effective_to);
        while (cursor <= end) {
          targetDates.push(cursor.toISOString().split("T")[0]);
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        targetDates.push(effective_from);
      }

      // For "mixed" rates, skip any date already covered by a cow or buffalo rate
      let datesToInsert = targetDates;
      if (milk_type === "mixed") {
        const checks = await Promise.all(
          targetDates.map((date) => existsInCowOrBuffalo(centreId, fat, snf, date)),
        );
        datesToInsert = targetDates.filter((_, idx) => !checks[idx]);
        const overlapCount = targetDates.length - datesToInsert.length;
        if (overlapCount > 0) {
          errors.push({
            row: rowNum,
            error: `${overlapCount} date(s) skipped — FAT ${fat}/SNF ${snf} already exists in cow or buffalo rates on those date(s).`,
          });
          skipped += overlapCount;
        }
      }

      if (datesToInsert.length === 0) continue;

      const values = datesToInsert.map((date) => [
        centreId,
        fat,
        snf,
        rate,
        mrp,
        date,
        null,
      ]);

      try {
        const [result] = await pool.query(
          `INSERT IGNORE INTO ${table} (centre_id, fat, snf, rate, mrp, effective_from, effective_to) VALUES ?`,
          [values],
        );
        added += result.affectedRows;
        skipped += datesToInsert.length - result.affectedRows;
      } catch (rowErr) {
        errors.push({ row: rowNum, error: rowErr.message });
        skipped += datesToInsert.length;
      }
    }

    res.json({
      message: `${added} rate(s) imported, ${skipped} skipped.`,
      added,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("importRates error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ── POST /api/rates/import/update ─────────────────────────────
// Bulk-updates existing rates from a parsed Excel/CSV file.
// Matches by milk_type, fat, snf, and effective_from.
exports.importUpdateRates = async (req, res) => {
  try {
    const centreId = req.user.centre_id;
    const { rates } = req.body;

    if (!Array.isArray(rates) || rates.length === 0)
      return res.status(400).json({ message: "rates array is required" });

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rates.length; i++) {
      const row = rates[i];
      const rowNum = row._rowIndex || i + 1;

      const milk_type = ["buffalo", "mixed"].includes(row.milk_type)
        ? row.milk_type
        : "cow";
      const fat = parseFloat(row.fat);
      const snf = parseFloat(row.snf);
      const rate = parseFloat(row.rate);
      const mrp =
        row.mrp !== "" && row.mrp != null && !isNaN(parseFloat(row.mrp))
          ? parseFloat(row.mrp)
          : null;
      const effective_from = row.effective_from;
      const effective_to = row.effective_to || null;

      if (isNaN(fat) || isNaN(snf) || isNaN(rate) || !effective_from) {
        errors.push({
          row: rowNum,
          error: "Missing or invalid FAT, SNF, Rate, or Effective From.",
        });
        skipped++;
        continue;
      }

      const table = tbl(milk_type);

      // Check if the rate exists
      const [existing] = await pool.query(
        `SELECT rate_id FROM ${table} 
         WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
        [centreId, fat, snf, effective_from]
      );

      if (existing.length === 0) {
        errors.push({
          row: rowNum,
          error: `No existing rate found for FAT ${fat}, SNF ${snf} on ${effective_from}. Use "Add New Rates" mode to insert.`,
        });
        skipped++;
        continue;
      }

      try {
        await pool.query(
          `UPDATE ${table} 
           SET rate = ?, mrp = ?, effective_to = ?
           WHERE centre_id = ? AND fat = ? AND snf = ? AND effective_from = ?`,
          [rate, mrp, effective_to || null, centreId, fat, snf, effective_from]
        );
        updated++;
      } catch (rowErr) {
        errors.push({ row: rowNum, error: rowErr.message });
        skipped++;
      }
    }

    res.json({
      message: `${updated} rate(s) updated, ${skipped} skipped.`,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("importUpdateRates error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};