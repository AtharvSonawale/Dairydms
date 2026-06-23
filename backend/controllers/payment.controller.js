const pool = require('../config/db');
const ExcelJS = require('exceljs');

// ── GET /api/payments/seller-summary?from=YYYY-MM-DD&to=YYYY-MM-DD ───────────────────────────────────────────────────────────────────────────────
// Returns a summary of all sellers with milk entries in the given date range, including:
// - Total milk amount, quantity, and entries
// - Advance given, product deductions, walk-in deductions
// - Deposit amount (qty * deposit_per_litre)
// - Installment cut (from cash advance)
// - Final payable amount
// ═══════════════════════════════════════════════════════════════════════════════
exports.getSellerSummary = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ message: "from and to dates are required." });
        }

        const centreId = req.user.centre_id;

        // 1. Fetch all sellers with milk entries in the date range
        let sellerQuery = `
            SELECT
                s.seller_id,
                s.seller_code,
                s.name,
                s.seller_type,
                COALESCE(s.advance_deduction, 0) AS advance_deduction,
                COALESCE(s.deposit_per_litre, 0) AS deposit_per_litre,
                COALESCE(SUM(me.total_amount), 0) AS milk_amount,
                COALESCE(SUM(me.quantity), 0) AS total_milk_quantity,
                COALESCE(
                    JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'entry_date', COALESCE(me.entry_date, '1970-01-01'),
                            'shift', COALESCE(me.shift, 'morning'),
                            'milk_type', COALESCE(me.milk_type, 'cow'),
                            'quantity', COALESCE(me.quantity, 0),
                            'fat', COALESCE(me.fat, 0),
                            'snf', COALESCE(me.snf, 0),
                            'water', COALESCE(me.water, 0),
                            'rate_applied', COALESCE(me.rate_applied, 0),
                            'total_amount', COALESCE(me.total_amount, 0),
                            'is_premium', COALESCE(me.is_premium, 0)
                        )
                    ),
                    JSON_ARRAY()
                ) AS entries
            FROM sellers s
            LEFT JOIN milk_entries me ON me.seller_id = s.seller_id
                AND me.centre_id = s.centre_id
                AND me.entry_date BETWEEN ? AND ?
            WHERE s.centre_id = ?
            GROUP BY
                s.seller_id, s.seller_code, s.name, s.seller_type,
                s.advance_deduction, s.deposit_per_litre
            ORDER BY s.name ASC`;

        const [sellers] = await pool.query(sellerQuery, [from, to, centreId]);

        // 2. Fetch total advance given per seller
        const [advances] = await pool.query(
            `SELECT
                seller_id,
                COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS advance_balance
            FROM cash_advance
            WHERE centre_id = ?
            GROUP BY seller_id`,
            [centreId]
        );
        const advMap = Object.fromEntries(
            advances.map(a => [a.seller_id, parseFloat(a.advance_balance || 0)])
        );

        // 3. Fetch product sales deductions
        const [productSales] = await pool.query(
            `SELECT seller_id, COALESCE(SUM(total_amount), 0) AS product_total
            FROM product_sales
            WHERE centre_id = ? AND sale_date BETWEEN ? AND ?
            GROUP BY seller_id`,
            [centreId, from, to]
        );
        const productMap = Object.fromEntries(
            productSales.map(p => [p.seller_id, parseFloat(p.product_total || 0)])
        );

        // 4. Fetch walk-in sales deductions
        const [walkinSales] = await pool.query(
            `SELECT seller_id, COALESCE(SUM(total_amount), 0) AS walkin_total
            FROM walkin_sales
            WHERE centre_id = ? AND sale_date BETWEEN ? AND ? AND seller_id IS NOT NULL
            GROUP BY seller_id`,
            [centreId, from, to]
        );
        const walkinMap = Object.fromEntries(
            walkinSales.map(w => [w.seller_id, parseFloat(w.walkin_total || 0)])
        );

        // 5. Fetch already-paid records
        const [paid] = await pool.query(
            `SELECT
                seller_id, paid_at, bill_no, from_date, to_date,
                installment_cut, deposit_amount, product_deduction,
                walkin_deduction, final_payable, cash_paid
            FROM seller_payments
            WHERE paid_at IS NOT NULL
              AND centre_id = ?
              AND (
                (from_date = ? AND to_date = ?) OR
                (from_date <= ? AND to_date >= ?)
              )`,
            [centreId, from, to, to, from]
        );

        const paidMap = {};
        for (const p of paid) {
            const existing = paidMap[p.seller_id];
            if (!existing || new Date(p.paid_at) > new Date(existing.paid_at)) {
                paidMap[p.seller_id] = {
                    paid_at: p.paid_at,
                    bill_no: p.bill_no,
                    from_date: p.from_date,
                    to_date: p.to_date,
                    installment_cut: p.installment_cut,
                    deposit_amount: p.deposit_amount,
                    product_deduction: p.product_deduction,
                    walkin_deduction: p.walkin_deduction,
                    final_payable: p.final_payable,
                    cash_paid: p.cash_paid,
                };
            }
        }

        // 6. Fetch deposit balances for each seller
        const [deposits] = await pool.query(
            `SELECT
                seller_id,
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS deposit_balance
            FROM seller_deposits
            WHERE centre_id = ? AND transaction_date <= ?
            GROUP BY seller_id`,
            [centreId, to]
        );
        const depositMap = Object.fromEntries(
            deposits.map(d => [d.seller_id, parseFloat(d.deposit_balance || 0)])
        );

        // 7. Fetch cash balance (deposit and advance)
        const [cashBalances] = await pool.query(
            `SELECT
                seller_id,
                COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) AS deposit_total,
                COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) AS advance_total
            FROM cash_advance
            WHERE centre_id = ?
            GROUP BY seller_id`,
            [centreId]
        );
        const cashBalMap = Object.fromEntries(
            cashBalances.map(c => [c.seller_id, {
                deposit: parseFloat(c.deposit_total || 0),
                advance: parseFloat(c.advance_total || 0),
            }])
        );

        // 8. Build the result
        const result = sellers.map(s => {
            const paidRecord = paidMap[s.seller_id];
            const alreadyPaid = !!paidRecord?.paid_at;

            // Safely parse entries (handle NULL or string)
            let entries = [];
            if (s.entries) {
                try {
                    entries = typeof s.entries === "string"
                        ? JSON.parse(s.entries)
                        : (s.entries || []);
                } catch (e) {
                    console.error("Failed to parse entries for seller:", s.seller_id, e);
                    entries = [];
                }
            }
            entries.sort((a, b) => new Date(a.entry_date) - new Date(b.entry_date));

            // If already paid, return frozen data
            if (alreadyPaid) {
                return {
                    seller_id: s.seller_id,
                    seller_code: s.seller_code,
                    name: s.name,
                    seller_type: s.seller_type,
                    milk_amount: parseFloat(s.milk_amount || 0),
                    total_milk_quantity: parseFloat(s.total_milk_quantity || 0),
                    deposit_per_litre: parseFloat(s.deposit_per_litre || 0),
                    deposit_amount: parseFloat(paidRecord.deposit_amount || 0),
                    advance_given: advMap[s.seller_id] || 0,
                    installment_cut: parseFloat(paidRecord.installment_cut || 0),
                    product_deduction: parseFloat(paidRecord.product_deduction || 0),
                    walkin_deduction: parseFloat(paidRecord.walkin_deduction || 0),
                    deduction_amount: parseFloat(s.advance_deduction || 0),
                    cash_to_pay: parseFloat(paidRecord.final_payable || paidRecord.cash_paid || 0),
                    final_payable: parseFloat(paidRecord.final_payable || paidRecord.cash_paid || 0),
                    deposit_balance: depositMap[s.seller_id] || 0,
                    cash_net_balance: (depositMap[s.seller_id] || 0) - (cashBalMap[s.seller_id]?.advance || 0),
                    is_paid: true,
                    paid_at: paidRecord.paid_at,
                    bill_no: paidRecord.bill_no,
                    paid_cycle_from: paidRecord.from_date,
                    paid_cycle_to: paidRecord.to_date,
                    entries,
                };
            }

            // Unpaid: Compute everything fresh
            const milkAmt = parseFloat(s.milk_amount || 0);
            const totalMilkQty = parseFloat(s.total_milk_quantity || 0);
            const depositPerLitre = parseFloat(s.deposit_per_litre || 0);
            const depositAmount = totalMilkQty * depositPerLitre;
            const advGiven = advMap[s.seller_id] || 0;
            const productDeduction = productMap[s.seller_id] || 0;
            const walkinDeduction = walkinMap[s.seller_id] || 0;
            const deductionAmt = parseFloat(s.advance_deduction || 0);

            // Installment cut: min(deductionAmt, advGiven)
            const installmentCut = advGiven > 0
                ? (deductionAmt > 0 ? Math.min(deductionAmt, advGiven) : advGiven)
                : 0;

            // Deduct deposit from milk payable
            const milkAfterDeposit = milkAmt - depositAmount;

            // Deduct installment from milk payable
            const milkAfterInstallment = milkAfterDeposit - installmentCut;

            // Deduct product and walk-in sales
            const milkAfterProductWalkin = milkAfterInstallment - productDeduction - walkinDeduction;

            const finalPayable = parseFloat(milkAfterProductWalkin.toFixed(2));

            // Update deposit balance
            const updatedDepositBalance = depositMap[s.seller_id] || 0;

            // Update advance balance (subtract installmentCut)
            const updatedAdvanceBalance = advGiven - installmentCut;

            return {
                seller_id: s.seller_id,
                seller_code: s.seller_code,
                name: s.name,
                seller_type: s.seller_type,
                milk_amount: milkAmt,
                total_milk_quantity: totalMilkQty,
                deposit_per_litre: depositPerLitre,
                deposit_amount: depositAmount,
                advance_given: advGiven,
                installment_cut: installmentCut,
                product_deduction: productDeduction,
                walkin_deduction: walkinDeduction,
                deduction_amount: deductionAmt,
                cash_to_pay: milkAfterProductWalkin,
                final_payable: finalPayable,
                deposit_balance: updatedDepositBalance,
                advance_balance: updatedAdvanceBalance,
                is_paid: false,
                paid_at: null,
                bill_no: null,
                entries,
            };
        });

        res.json(result);
    } catch (err) {
        console.error("getSellerSummary error:", err);
        res.status(500).json({
            message: err.message,
            code: err.code,
            sqlMessage: err.sqlMessage,
            sql: err.sql
        });
    }
};

// ── POST /api/payments/mark-paid ───────────────────────────────────────────────────────────────────────────────
// Marks a seller's payment as paid and:
// 1. Deducts the installment from cash_advance (if applicable)
// 2. Adds the deposit amount to seller_deposits (if applicable)
// 3. Generates a bill number and updates seller_payments
// 4. Creates a bill snapshot with all granular data
// ═══════════════════════════════════════════════════════════════════════════════
exports.markPaid = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const { seller_id, from_date, to_date, installment_cut = 0, deposit_amount = 0 } = req.body;

        if (!seller_id || !from_date || !to_date) {
            await conn.rollback();
            return res.status(400).json({ error: "seller_id, from_date, and to_date are required." });
        }

        // 1. Verify seller exists and fetch deposit_per_litre and advance_deduction
        const [sellerRows] = await conn.query(
            `SELECT seller_id, deposit_per_litre, advance_deduction, name, seller_code
             FROM sellers
             WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        if (!sellerRows[0]) {
            await conn.rollback();
            return res.status(404).json({ error: "Seller not found." });
        }
        const seller = sellerRows[0];
        const depositPerLitre = parseFloat(seller.deposit_per_litre || 0);
        const advanceDeduction = parseFloat(seller.advance_deduction || 0);

        // 2. Calculate total milk quantity and amount for the period
        const [milkEntries] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS total_quantity,
                    COALESCE(SUM(total_amount), 0) AS milk_amount
             FROM milk_entries
             WHERE seller_id = ? AND centre_id = ? AND entry_date BETWEEN ? AND ?`,
            [seller_id, centreId, from_date, to_date]
        );
        const totalMilkQty = parseFloat(milkEntries[0].total_quantity || 0);
        const milkAmount = parseFloat(milkEntries[0].milk_amount || 0);

        // 3. Calculate deposit amount if not provided
        const finalDepositAmount = deposit_amount > 0
            ? parseFloat(deposit_amount)
            : totalMilkQty * depositPerLitre;

        // 4. Fetch advance balance BEFORE any changes (for snapshot)
        const [[advRowBefore]] = await conn.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END), 0) AS advance_balance
             FROM cash_advance
             WHERE seller_id = ? AND centre_id = ?`,
            [seller_id, centreId]
        );
        const advanceBalanceBefore = parseFloat(advRowBefore.advance_balance || 0);

        // 5. Calculate installment cut if not provided
        let finalInstallmentCut = parseFloat(installment_cut) || 0;
        if (finalInstallmentCut === 0) {
            finalInstallmentCut = advanceBalanceBefore > 0
                ? (advanceDeduction > 0
                    ? Math.min(advanceDeduction, advanceBalanceBefore)
                    : advanceBalanceBefore)
                : 0;
        }

        // 6. Deduct installment from cash_advance (if applicable)
        if (finalInstallmentCut > 0) {
            await conn.query(
                `INSERT INTO cash_advance
                 (seller_id, operator_id, centre_id, type, amount, transaction_date, remarks)
                 VALUES (?, ?, ?, 'received', ?, ?, ?)`,
                [seller_id, operatorId, centreId, finalInstallmentCut, to_date,
                    `Installment cut for ${from_date} to ${to_date}`]
            );
        }

        // 7. Add deposit to seller_deposits (if applicable)
        if (finalDepositAmount > 0) {
            await conn.query(
                `INSERT INTO seller_deposits
                 (seller_id, operator_id, centre_id, type, amount, transaction_date, remarks)
                 VALUES (?, ?, ?, 'credit', ?, ?, ?)`,
                [seller_id, operatorId, centreId, finalDepositAmount, to_date,
                    `Deposit for ${from_date} to ${to_date}`]
            );
        }

        // 8. Fetch product deductions
        const [[productRows]] = await conn.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS product_total
             FROM product_sales
             WHERE seller_id = ? AND centre_id = ? AND sale_date BETWEEN ? AND ?`,
            [seller_id, centreId, from_date, to_date]
        );
        const productDeduction = parseFloat(productRows.product_total || 0);

        // 9. Fetch walkin deductions
        const [[walkinRows]] = await conn.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS walkin_total
             FROM walkin_sales
             WHERE seller_id = ? AND centre_id = ? AND sale_date BETWEEN ? AND ?`,
            [seller_id, centreId, from_date, to_date]
        );
        const walkinDeduction = parseFloat(walkinRows.walkin_total || 0);

        // 10. Calculate final payable (no TDS)
        const milkAfterDeposit = milkAmount - finalDepositAmount;
        const milkAfterInstallment = milkAfterDeposit - finalInstallmentCut;
        const milkAfterDeductions = milkAfterInstallment - productDeduction - walkinDeduction;
        const finalPayable = parseFloat(milkAfterDeductions.toFixed(2));

        // 11. Generate bill number
        const toDateObj = new Date(to_date);
        const fromDateObj = new Date(from_date);
        const month = String(fromDateObj.getMonth() + 1).padStart(2, '0');
        const year = String(fromDateObj.getFullYear()).slice(-2);
        const toDay = String(toDateObj.getDate()).padStart(2, '0');
        const sellerSuffix = String(seller_id).padStart(4, '0');
        const bill_no = req.body.bill_no || `${month}${year}${toDay}${sellerSuffix}`;

        // 12. Create bill snapshot with all granular data
        try {
            await createBillSnapshot(conn, {
                bill_no,
                seller_id,
                operatorId,
                centreId,
                sellerInfo: seller,
                from_date,
                to_date,
                milkAmount,
                advanceBalance: advanceBalanceBefore,
                finalInstallmentCut,
                finalDepositAmount,
                productDeduction,
                walkinDeduction,
                finalPayable,
                totalMilkQty,
                depositPerLitre,
            });
        } catch (snapshotErr) {
            await conn.rollback();
            console.error("createBillSnapshot error:", snapshotErr);
            return res.status(500).json({
                error: "Failed to create bill snapshot",
                message: snapshotErr.message
            });
        }

        // 13. Insert into seller_payments (tds_amount always 0)
        await conn.query(
            `INSERT INTO seller_payments
             (seller_id, operator_id, centre_id, from_date, to_date, milk_amount, advance_given,
              installment_cut, deposit_amount, product_deduction, walkin_deduction,
              tds_amount, final_payable, cash_paid, bill_no, paid_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE
               installment_cut   = VALUES(installment_cut),
               deposit_amount    = VALUES(deposit_amount),
               product_deduction = VALUES(product_deduction),
               walkin_deduction  = VALUES(walkin_deduction),
               tds_amount        = 0,
               final_payable     = VALUES(final_payable),
               cash_paid         = VALUES(cash_paid),
               bill_no           = VALUES(bill_no),
               paid_at           = NOW()`,
            [
                seller_id, operatorId, centreId, from_date, to_date, milkAmount,
                advanceBalanceBefore, finalInstallmentCut, finalDepositAmount,
                productDeduction, walkinDeduction, finalPayable,
                finalPayable, bill_no
            ]
        );

        await conn.commit();

        res.json({
            message: "Payment marked as paid.",
            bill_no,
            milk_amount: milkAmount,
            deposit_added: finalDepositAmount,
            installment_deducted: finalInstallmentCut,
            product_deduction: productDeduction,
            walkin_deduction: walkinDeduction,
            cash_paid: finalPayable,
        });

    } catch (err) {
        await conn.rollback();
        console.error("markPaid error:", err);
        res.status(500).json({
            error: "Server error",
            message: err.message,
            code: err.code
        });
    } finally {
        conn.release();
    }
};

async function createBillSnapshot(conn, data) {
    const {
        bill_no, seller_id, operatorId, centreId, sellerInfo,
        from_date, to_date, milkAmount, advanceBalance,
        finalInstallmentCut, finalDepositAmount,
        productDeduction, walkinDeduction,
        finalPayable, totalMilkQty,
        depositPerLitre,
    } = data;

    // 1. Fetch milk entries for the period
    const [entries] = await conn.query(
        `SELECT * FROM milk_entries
         WHERE seller_id = ? AND centre_id = ? AND entry_date BETWEEN ? AND ?
         ORDER BY entry_date ASC, shift ASC`,
        [seller_id, centreId, from_date, to_date]
    );

    // 2. Insert / update bill_master (tds_amount = 0)
    await conn.query(
        `INSERT INTO bill_master (
            bill_no, seller_id, operator_id, centre_id, seller_code, seller_name,
            from_date, to_date, milk_amount, advance_balance, installment_cut,
            deposit_amount, product_deduction, walkin_deduction, tds_amount,
            final_payable, cash_paid, total_qty, total_entries, paid_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            milk_amount       = VALUES(milk_amount),
            advance_balance   = VALUES(advance_balance),
            installment_cut   = VALUES(installment_cut),
            deposit_amount    = VALUES(deposit_amount),
            product_deduction = VALUES(product_deduction),
            walkin_deduction  = VALUES(walkin_deduction),
            tds_amount        = 0,
            final_payable     = VALUES(final_payable),
            cash_paid         = VALUES(cash_paid),
            total_qty         = VALUES(total_qty),
            total_entries     = VALUES(total_entries),
            paid_at           = NOW()`,
        [
            bill_no, seller_id, operatorId, centreId, sellerInfo.seller_code, sellerInfo.name,
            from_date, to_date, milkAmount, advanceBalance, finalInstallmentCut,
            finalDepositAmount, productDeduction, walkinDeduction,
            finalPayable, finalPayable, totalMilkQty, entries.length
        ]
    );

    // 3. Get the bill_id
    const [[existingBill]] = await conn.query(
        `SELECT bill_id FROM bill_master WHERE bill_no = ? AND centre_id = ?`,
        [bill_no, centreId]
    );
    const billId = existingBill.bill_id;

    // 4. Insert milk entries snapshot
    for (const row of entries) {
        await conn.query(
            `INSERT IGNORE INTO bill_milk_entries (
                bill_id, centre_id, original_entry_id, entry_date, shift, milk_type,
                quantity, fat, snf, water, rate_applied, total_amount
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                billId, centreId, row.entry_id, row.entry_date, row.shift, row.milk_type,
                row.quantity, row.fat, row.snf, row.water, row.rate_applied, row.total_amount
            ]
        );
    }

    // 5. Insert product sales snapshot
    const [products] = await conn.query(
        `SELECT ps.*, p.product_name, p.unit
         FROM product_sales ps
         JOIN products p ON p.product_id = ps.product_id
         WHERE ps.seller_id = ? AND ps.centre_id = ? AND ps.sale_date BETWEEN ? AND ?`,
        [seller_id, centreId, from_date, to_date]
    );
    for (const p of products) {
        await conn.query(
            `INSERT IGNORE INTO bill_product_sales
             (bill_id, centre_id, sale_id, product_name, quantity, rate, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [billId, centreId, p.sale_id, p.product_name || 'Unknown', p.quantity, p.rate, p.total_amount]
        );
    }

    // 6. Insert walkin sales snapshot
    const [walkins] = await conn.query(
        `SELECT * FROM walkin_sales
         WHERE seller_id = ? AND centre_id = ? AND sale_date BETWEEN ? AND ?`,
        [seller_id, centreId, from_date, to_date]
    );
    for (const w of walkins) {
        await conn.query(
            `INSERT IGNORE INTO bill_walkin_sales
             (bill_id, centre_id, sale_id, buyer_name, milk_type, quantity, mrp,
              total_amount, payment_mode, shift, sale_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                billId, centreId, w.sale_id, w.buyer_name, w.milk_type, w.quantity,
                w.mrp, w.total_amount, w.payment_mode, w.shift, w.sale_date
            ]
        );
    }

    // 7. Insert deposit snapshot
    const [[depositRow]] = await conn.query(
        `SELECT
            COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN type='debit'  THEN amount ELSE 0 END), 0) AS balance_before
         FROM seller_deposits
         WHERE seller_id = ? AND centre_id = ? AND transaction_date < ?`,
        [seller_id, centreId, from_date]
    );
    const depositBalBefore = parseFloat(depositRow.balance_before || 0);

    await conn.query(
        `INSERT INTO bill_deposit_snapshot
         (bill_id, centre_id, deposit_per_litre, total_milk_qty, deposit_amount,
          deposit_balance_before, deposit_balance_after)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            billId, centreId, depositPerLitre, totalMilkQty, finalDepositAmount,
            depositBalBefore, depositBalBefore + finalDepositAmount
        ]
    );

    // 8. Insert cash advance snapshot
    await conn.query(
        `DELETE FROM bill_cash_advance_snapshot WHERE bill_id = ? AND centre_id = ?`,
        [billId, centreId]
    );
    await conn.query(
        `INSERT INTO bill_cash_advance_snapshot
         (bill_id, centre_id, advance_before, installment_cut, advance_after)
         VALUES (?, ?, ?, ?, ?)`,
        [billId, centreId, advanceBalance, finalInstallmentCut, advanceBalance - finalInstallmentCut]
    );

    return billId;
}

// ── GET /api/payments/bill/:bill_no ───────────────────────────────────────────────────────────────────────────────
// Fetches a bill by its bill_no, including:
// - Payment details
// - Milk entries for the period
// - Advance transactions for the period
// - Product sales for the period
// ════════════════════════════════════
exports.getBillByNo = async (req, res) => {
    try {
        const { bill_no } = req.params;
        const centreId = req.user.centre_id;

        // 1. Fetch payment details
        const [[payment]] = await pool.query(
            `SELECT sp.id, sp.seller_id, sp.operator_id, sp.from_date, sp.to_date,
                    sp.milk_amount, sp.advance_given, sp.installment_cut, sp.deposit_amount,
                    sp.product_deduction, sp.walkin_deduction,
                    sp.final_payable, sp.cash_paid, sp.bill_no, sp.paid_at,
                    s.name, s.seller_code, s.seller_type, s.mobile,
                    s.bank_account, s.bank_name, s.advance_deduction AS adv_deduction_setting,
                    s.deposit_per_litre
             FROM seller_payments sp
             JOIN sellers s ON s.seller_id = sp.seller_id
             WHERE sp.bill_no = ? AND sp.centre_id = ?`,
            [bill_no, centreId]
        );
        if (!payment) {
            return res.status(404).json({ message: "Bill not found." });
        }

        const [walkinSales] = await pool.query(
            `SELECT * FROM bill_walkin_sales WHERE bill_id = (
                SELECT bill_id FROM bill_master WHERE bill_no = ? AND centre_id = ? LIMIT 1
            ) ORDER BY sale_date ASC`,
            [bill_no, centreId]
        );

        const [[depositRow]] = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN type='debit'  THEN amount ELSE 0 END), 0) AS deposit_balance_before
             FROM seller_deposits
             WHERE seller_id = ? AND centre_id = ? AND transaction_date < ?`,
            [payment.seller_id, centreId, payment.from_date]
        );
        const depositSnapshot = [{ deposit_balance_before: parseFloat(depositRow.deposit_balance_before || 0) }];

        // 2. Fetch milk entries for the period
        const [entries] = await pool.query(
            `SELECT me.*, s.name AS seller_name, s.seller_code
             FROM milk_entries me
             JOIN sellers s ON s.seller_id = me.seller_id
             WHERE me.seller_id = ? AND me.centre_id = ? AND me.entry_date BETWEEN ? AND ?
             ORDER BY me.entry_date ASC, me.shift ASC`,
            [payment.seller_id, centreId, payment.from_date, payment.to_date]
        );

        // 3. Fetch advance transactions for the period
        const [advances] = await pool.query(
            `SELECT * FROM cash_advance
             WHERE seller_id = ? AND centre_id = ? AND transaction_date BETWEEN ? AND ?
             ORDER BY transaction_date ASC`,
            [payment.seller_id, centreId, payment.from_date, payment.to_date]
        );

        // 4. Fetch product sales for the period
        const [productSales] = await pool.query(
            `SELECT ps.*, p.product_name, p.unit
             FROM product_sales ps
             JOIN products p ON p.product_id = ps.product_id
             WHERE ps.seller_id = ? AND ps.centre_id = ? AND ps.sale_date BETWEEN ? AND ?
             ORDER BY ps.sale_date ASC`,
            [payment.seller_id, centreId, payment.from_date, payment.to_date]
        );

        // 5. Return all data
        res.json({
            payment,
            entries,
            advances,
            productSales,
            walkinSales,
            depositSnapshot
        });
    } catch (err) {
        console.error("getBillByNo error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ── GET /api/payments/bills/search ───────────────────────────────────────────────────────────────────────────────
exports.searchBills = async (req, res) => {
    try {
        const { q, seller_id, from, to } = req.query;
        const centreId = req.user.centre_id;

        let where = "WHERE sp.centre_id = ?";
        const params = [centreId];

        if (q) {
            where += " AND (sp.bill_no LIKE ? OR s.name LIKE ? OR s.seller_code LIKE ?)";
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        if (seller_id) {
            where += " AND sp.seller_id = ?";
            params.push(seller_id);
        }
        if (from) {
            where += " AND sp.from_date >= ?";
            params.push(from);
        }
        if (to) {
            where += " AND sp.to_date <= ?";
            params.push(to);
        }

        const [rows] = await pool.query(
            `SELECT sp.id, sp.seller_id, sp.bill_no, sp.from_date, sp.to_date,
                    sp.milk_amount, sp.advance_given, sp.installment_cut, sp.deposit_amount,
                    sp.product_deduction, sp.walkin_deduction,
                    sp.final_payable, sp.cash_paid, sp.paid_at,
                    s.name, s.seller_code
             FROM seller_payments sp
             JOIN sellers s ON s.seller_id = sp.seller_id
             ${where}
             ORDER BY sp.paid_at DESC
             LIMIT 200`,
            params
        );
        res.json(rows);
    } catch (err) {
        console.error("searchBills error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ── POST /api/payments/create-payment-cycle ────────────────
exports.createPaymentCycle = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const { from_date, to_date } = req.body;

        if (!from_date || !to_date) {
            await conn.rollback();
            return res.status(400).json({ error: "from_date and to_date are required." });
        }

        const [sellers] = await conn.query(
            `SELECT DISTINCT seller_id
             FROM milk_entries
             WHERE entry_date BETWEEN ? AND ? AND centre_id = ?`,
            [from_date, to_date, centreId]
        );

        if (sellers.length === 0) {
            await conn.rollback();
            return res.status(400).json({ error: "No sellers with milk entries in the given date range." });
        }

        for (const seller of sellers) {
            await conn.query(
                `INSERT INTO seller_payments
                (seller_id, operator_id, centre_id, from_date, to_date, is_paid)
                VALUES (?, ?, ?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE
                    from_date = VALUES(from_date),
                    to_date = VALUES(to_date),
                    is_paid = 0`,
                [seller.seller_id, operatorId, centreId, from_date, to_date]
            );
        }

        await conn.commit();
        res.json({ message: `Payment cycle created for ${sellers.length} sellers.` });
    } catch (err) {
        await conn.rollback();
        console.error("createPaymentCycle error:", err);
        res.status(500).json({ error: "Server error", message: err.message });
    } finally {
        conn.release();
    }
};

// ── DELETE /api/payments/bill/:bill_no ────────────────
exports.deleteBill = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const { bill_no } = req.params;
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;

        const [bills] = await conn.query(
            `SELECT * FROM seller_payments WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centreId]
        );

        if (!bills.length) {
            await conn.rollback();
            return res.status(404).json({ error: "Bill not found." });
        }

        const bill = bills[0];

        // Reverse installment cut
        if (parseFloat(bill.installment_cut || 0) > 0) {
            await conn.query(
                `INSERT INTO cash_advance
                 (seller_id, operator_id, centre_id, type, amount, transaction_date, remarks)
                 VALUES (?, ?, ?, 'given', ?, NOW(), ?)`,
                [bill.seller_id, operatorId, centreId, bill.installment_cut, `Reversal of installment cut for bill ${bill_no}`]
            );
        }

        // Reverse deposit credit
        if (parseFloat(bill.deposit_amount || 0) > 0) {
            await conn.query(
                `INSERT INTO seller_deposits
                 (seller_id, operator_id, centre_id, type, amount, transaction_date, remarks)
                 VALUES (?, ?, ?, 'debit', ?, NOW(), ?)`,
                [bill.seller_id, operatorId, centreId, bill.deposit_amount, `Reversal of deposit for bill ${bill_no}`]
            );
        }

        await conn.query(
            `DELETE FROM seller_payments WHERE bill_no = ? AND centre_id = ?`,
            [bill_no, centreId]
        );

        await conn.commit();
        return res.json({ success: true, message: `Bill ${bill_no} deleted successfully.` });
    } catch (err) {
        await conn.rollback();
        console.error("deleteBill error:", err);
        return res.status(500).json({ error: "Failed to delete bill." });
    } finally {
        conn.release();
    }
};

// ── GET /api/payments/cycle-config ────────────────
exports.getCycleConfig = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        const [[row]] = await pool.query(
            `SELECT seed_from, days_per_cycle FROM payment_cycle_config WHERE centre_id = ?`,
            [centreId]
        );
        if (!row) return res.json(null);
        res.json({ seed_from: row.seed_from, days_per_cycle: row.days_per_cycle });
    } catch (err) {
        console.error("getCycleConfig error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── POST /api/payments/cycle-config ────────────────
exports.saveCycleConfig = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const { seed_from, days_per_cycle } = req.body;

        if (!seed_from || !days_per_cycle) {
            return res.status(400).json({ error: "seed_from and days_per_cycle are required." });
        }

        await pool.query(
            `INSERT INTO payment_cycle_config (operator_id, centre_id, seed_from, days_per_cycle)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE seed_from = VALUES(seed_from), days_per_cycle = VALUES(days_per_cycle)`,
            [operatorId, centreId, seed_from, days_per_cycle]
        );
        res.json({ success: true, seed_from, days_per_cycle });
    } catch (err) {
        console.error("saveCycleConfig error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── GET /api/payments/export-excel?from=YYYY-MM-DD&to=YYYY-MM-DD ────────
// Exports paid sellers for the given cycle in the bank NEFT/RTGS upload format.
// ═══════════════════════════════════════════════════════════════════════
exports.exportExcel = async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ message: "from and to dates are required." });
        }

        const centreId = req.user.centre_id;

        const [rows] = await pool.query(
            `SELECT sp.bill_no, sp.from_date, sp.to_date, sp.final_payable, sp.cash_paid,
                    s.seller_code, s.name, s.bank_account, s.ifsc_code
             FROM seller_payments sp
             JOIN sellers s ON s.seller_id = sp.seller_id
             WHERE sp.centre_id = ?
               AND sp.from_date = ? AND sp.to_date = ?
               AND sp.paid_at IS NOT NULL
             ORDER BY s.name ASC`,
            [centreId, from, to]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "No paid sellers found for this cycle." });
        }

        const [[dbConfig]] = await pool.query(
            `SELECT plant_code, code, payment_mode, dairy_acc_no, code2
             FROM excel_export_config WHERE centre_id = ?`,
            [centreId]
        );
        const PLANT_CODE = dbConfig?.plant_code || 'DAIRYCMS';
        const CODE = dbConfig?.code || 'RPAY';
        const PAYMENT_MODE = dbConfig?.payment_mode || 'NEFT';
        const DAIRY_CURRENT_ACC_NO = dbConfig?.dairy_acc_no || '1111111111';
        const CODE2 = dbConfig?.code2 || 'M';

        const fmtDay = (d) => String(new Date(d).getDate()).padStart(2, '0');
        const fmtMonth = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short' });
        const fmtDateDDMMYYYY = (d) => {
            const dt = new Date(d);
            const dd = String(dt.getDate()).padStart(2, '0');
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            return `${dd}/${mm}/${dt.getFullYear()}`;
        };

        const todayStr = fmtDateDDMMYYYY(new Date());

        // ── ExcelJS workbook ──────────────────────────────────────
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payments');

        // Column widths (A–Y = 25 cols)
        worksheet.columns = [
            { width: 14 }, // A - Plant Code
            { width: 8 }, // B - Code
            { width: 14 }, // C - Payment Mode
            { width: 4 }, // D - empty
            { width: 14 }, // E - Date
            { width: 4 }, // F - empty
            { width: 22 }, // G - Dairy Acc No
            { width: 12 }, // H - Amount
            { width: 8 }, // I - Code2
            { width: 4 }, // J - empty
            { width: 32 }, // K - Seller Details
            { width: 4 }, // L - empty
            { width: 16 }, // M - IFSC
            { width: 18 }, // N - Acc_no
            { width: 4 }, // O
            { width: 4 }, // P
            { width: 4 }, // Q
            { width: 4 }, // R
            { width: 4 }, // S
            { width: 4 }, // T
            { width: 4 }, // U
            { width: 4 }, // V
            { width: 4 }, // W
            { width: 20 }, // X - Narration
            { width: 20 }, // Y - Narration
        ];

        // ── Header row ────────────────────────────────────────────
        const headerRow = worksheet.addRow([
            'Plant Code', 'Code', 'Payment Mode', '', 'Date', '',
            'Dairy Current Acc No.', 'Amount', 'Code2', '',
            'Seller Details', '', 'IFSC', 'Acc_no',
            '', '', '', '', '', '', '', '', '',
            'Narration', 'Narration'
        ]);
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = {
                type: 'pattern', pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' },
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            };
        });

        // ── Data rows ─────────────────────────────────────────────
        const whiteBorder = {
            top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
            right: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        };

        for (const r of rows) {
            const periodLabel = `${fmtDay(r.from_date)} to ${fmtDay(r.to_date)} ${fmtMonth(r.to_date)}`;
            const cleanCode = (r.seller_code || '').replace(/^S/i, '');
            const narration = `${cleanCode} ${(r.name || '').toUpperCase()}`;
            const amount = parseFloat(r.final_payable || r.cash_paid || 0);

            const dataRow = worksheet.addRow([
                PLANT_CODE,           // A col 0
                CODE,                 // B col 1
                PAYMENT_MODE,         // C col 2
                '',                   // D col 3
                todayStr,             // E col 4
                '',                   // F col 5
                DAIRY_CURRENT_ACC_NO, // G col 6
                amount,               // H col 7
                CODE2,                // I col 8
                '',                   // J col 9
                `${cleanCode} ${r.name} ${periodLabel}`, // K col 10
                '',                   // L col 11
                r.ifsc_code || '', // M col 12
                r.bank_account || '', // N col 13
                '', '', '', '', '', '', '', '', '', // O–W col 14-22
                narration,            // X col 23
                narration,            // Y col 24
            ]);

            // Amount cell (H) — white border
            const amtCell = dataRow.getCell(8);
            amtCell.numFmt = '0.00';
            amtCell.border = whiteBorder;

            // Seller Details cell (K) — white border
            dataRow.getCell(11).border = whiteBorder;

            // IFSC cell (M) — white border
            dataRow.getCell(13).border = whiteBorder;

            // Acc_no cell (N) — white border
            dataRow.getCell(14).border = whiteBorder;

            // Narration cells (X, Y) — yellow bg, black font, black border
            [24, 25].forEach(colNumber => {
                const cell = dataRow.getCell(colNumber);
                cell.fill = {
                    type: 'pattern', pattern: 'solid',
                    fgColor: { argb: 'FFFFFF00' },
                };
                cell.font = { color: { argb: 'FF000000' }, bold: false };
            });
        }

        // ── Stream response ───────────────────────────────────────
        res.setHeader('Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',
            `attachment; filename="payments_${from}_to_${to}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("exportExcel error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};

// ── GET /api/payments/excel-config ────────────────
exports.getExcelConfig = async (req, res) => {
    try {
        const centreId = req.user.centre_id;

        const [[row]] = await pool.query(
            `SELECT plant_code, code, payment_mode, dairy_acc_no, code2
             FROM excel_export_config WHERE centre_id = ?`,
            [centreId]
        );
        if (!row) return res.json(null);
        res.json(row);
    } catch (err) {
        console.error("getExcelConfig error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ── POST /api/payments/excel-config ────────────────
exports.saveExcelConfig = async (req, res) => {
    try {
        const operatorId = req.user.id;
        const centreId = req.user.centre_id;
        const { plant_code, code, payment_mode, dairy_acc_no, code2 } = req.body;

        if (!plant_code || !code || !payment_mode || !dairy_acc_no || !code2) {
            return res.status(400).json({ error: "All fields are required." });
        }

        await pool.query(
            `INSERT INTO excel_export_config
             (operator_id, centre_id, plant_code, code, payment_mode, dairy_acc_no, code2)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               plant_code    = VALUES(plant_code),
               code          = VALUES(code),
               payment_mode  = VALUES(payment_mode),
               dairy_acc_no  = VALUES(dairy_acc_no),
               code2         = VALUES(code2),
               updated_at    = NOW()`,
            [operatorId, centreId, plant_code, code, payment_mode, dairy_acc_no, code2]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("saveExcelConfig error:", err);
        res.status(500).json({ message: "Server error" });
    }
};