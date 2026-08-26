function round2(n) {
    return Math.round((parseFloat(n) || 0) * 100) / 100;
}

// Pure commission-per-litre calculation
function computeCommissionAmount(setting, fat, snf) {
    if (!setting) return 0;

    const baseFat = parseFloat(setting.base_fat);
    const baseSnf = parseFloat(setting.base_snf);
    const baseCommission = parseFloat(setting.base_commission);
    const fatStepCut = parseFloat(setting.fat_step_cut);
    const snfStepCut = parseFloat(setting.snf_step_cut);

    const fatSteps = round2(((parseFloat(fat) || 0) - baseFat) / 0.1);
    const snfSteps = round2(((parseFloat(snf) || 0) - baseSnf) / 0.1);

    let commission = baseCommission + fatSteps * fatStepCut + snfSteps * snfStepCut;
    commission = Math.max(0, round2(commission));
    return commission;
}

// Applies commission to a list of milk entries (Gavali only) and recomputes rate/total_amount
// entries: array of { quantity, fat, snf, milk_type, rate_applied, ... }
// sellerType: 'Utpadak' | 'Gavali'
// settingsMap: { cow: {...}, buffalo: {...} }

// ── NEW: pick the override that applies to this milk_type + date, if any ──
function findActiveOverride(overrides, entryDate) {
    if (!overrides || !overrides.length || !entryDate) return null;
    return overrides.find(o =>
        o.is_active &&
        o.effective_from <= entryDate &&
        (!o.effective_to || o.effective_to >= entryDate)
    ) || null;
}

// ── NEW: fetch a single Gavali seller's active overrides (all milk types) ──
async function getSellerCommissionOverrides(dbHandle, centreId, sellerId) {
    const [rows] = await dbHandle.query(
        `SELECT commission_rate, effective_from, effective_to, is_active
         FROM seller_commission_overrides
         WHERE centre_id = ? AND seller_id = ? AND is_active = 1`,
        [centreId, sellerId]
    );
    // normalise dates to 'YYYY-MM-DD' strings for string comparison against entry_date
    return rows.map(r => ({
        ...r,
        effective_from: r.effective_from.toISOString ? r.effective_from.toISOString().split('T')[0] : r.effective_from,
        effective_to: r.effective_to ? (r.effective_to.toISOString ? r.effective_to.toISOString().split('T')[0] : r.effective_to) : null,
    }));
}

// ── NEW: bulk fetch for a batch of sellers (e.g. cycle-billing all sellers at once) ──
async function getSellerCommissionOverridesMap(dbHandle, centreId, sellerIds) {
    if (!sellerIds || !sellerIds.length) return {};
    const placeholders = sellerIds.map(() => '?').join(',');
    const [rows] = await dbHandle.query(
        `SELECT seller_id, commission_rate, effective_from, effective_to, is_active
         FROM seller_commission_overrides
         WHERE centre_id = ? AND seller_id IN (${placeholders}) AND is_active = 1`,
        [centreId, ...sellerIds]
    );
    const map = {};
    for (const r of rows) {
        const norm = {
            ...r,
            effective_from: r.effective_from.toISOString ? r.effective_from.toISOString().split('T')[0] : r.effective_from,
            effective_to: r.effective_to ? (r.effective_to.toISOString ? r.effective_to.toISOString().split('T')[0] : r.effective_to) : null,
        };
        (map[r.seller_id] ||= []).push(norm);
    }
    return map;
}

// CHANGED signature: added sellerOverrides = []
function applyCommissionToEntries(entries, sellerType, settingsMap, sellerOverrides = []) {
    let milkAmount = 0;
    let totalCommission = 0;

    const adjusted = (entries || []).map(e => {
        const qty = parseFloat(e.quantity || 0);
        const baseRate = parseFloat(e.rate_applied || 0);

        let commissionPerLitre = 0;
        if (sellerType === 'Gavali' && settingsMap) {
            // entry_date may be a Date object or a string depending on caller
            const entryDate = e.entry_date
                ? (e.entry_date.toISOString ? e.entry_date.toISOString().split('T')[0] : e.entry_date)
                : null;

            // Flat seller override (applies to every milk_type) wins over standard fat/snf-based commission
            const override = findActiveOverride(sellerOverrides, entryDate);
            commissionPerLitre = override
                ? round2(parseFloat(override.commission_rate) || 0)
                : computeCommissionAmount(settingsMap[e.milk_type], e.fat, e.snf);
        }

        const effectiveRate = round2(baseRate + commissionPerLitre);
        const totalAmt = round2(effectiveRate * qty);
        const commissionAmt = round2(commissionPerLitre * qty);

        milkAmount = round2(milkAmount + totalAmt);
        totalCommission = round2(totalCommission + commissionAmt);

        return {
            ...e,
            base_rate: baseRate,
            commission_per_litre: commissionPerLitre,
            commission_amount: commissionAmt,
            rate_applied: effectiveRate,
            total_amount: totalAmt,
        };
    });

    return { entries: adjusted, milkAmount, totalCommission };
}

// Works with either `pool` or a transaction `conn` (both expose .query)
async function getCommissionSettingsMap(dbHandle, centreId) {
    const [rows] = await dbHandle.query(
        `SELECT milk_type, base_fat, base_snf, base_commission, fat_step_cut, snf_step_cut
         FROM commission_settings WHERE centre_id = ? AND is_active = 1`,
        [centreId]
    );
    const map = {};
    for (const r of rows) map[r.milk_type] = r;
    return map;
}

module.exports = {
    round2,
    computeCommissionAmount,
    applyCommissionToEntries,
    getCommissionSettingsMap,
    findActiveOverride,               // NEW
    getSellerCommissionOverrides,     // NEW
    getSellerCommissionOverridesMap,  // NEW
};