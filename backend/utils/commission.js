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
function applyCommissionToEntries(entries, sellerType, settingsMap) {
    let milkAmount = 0;
    let totalCommission = 0;

    const adjusted = (entries || []).map(e => {
        const qty = parseFloat(e.quantity || 0);
        const baseRate = parseFloat(e.rate_applied || 0);

        let commissionPerLitre = 0;
        if (sellerType === 'Gavali' && settingsMap) {
            const setting = settingsMap[e.milk_type];
            commissionPerLitre = computeCommissionAmount(setting, e.fat, e.snf);
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
            rate_applied: effectiveRate,   // overwritten with the effective (commission-inclusive) rate
            total_amount: totalAmt,        // overwritten with the commission-inclusive total
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
};