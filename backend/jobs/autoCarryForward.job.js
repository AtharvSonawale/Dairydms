const cron = require('node-cron');
const pool = require('../config/db');
const {
    copyRatesForDate,
    backfillIfMissing,
} = require('../controllers/rate.controller');

const MILK_TYPES = ['cow', 'buffalo', 'mixed'];

// Does the actual work for "today": for every centre with
// auto_carry_forward_rates enabled —
//   1. backfill TODAY if it's missing rates (catch-up for a missed run)
//   2. push TODAY's rates forward onto TOMORROW
// Shared by both the nightly cron tick and the one-time startup check.
async function runAutoCarryForwardOnce() {
    const [centres] = await pool.query(
        `SELECT centre_id FROM centres WHERE auto_carry_forward_rates = 1 AND is_active = 1`,
    );
    if (centres.length === 0) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    for (const { centre_id } of centres) {
        for (const milkType of MILK_TYPES) {
            try {
                // Step 1: catch up today if a previous run was missed.
                const backfill = await backfillIfMissing(centre_id, milkType, today);
                if (backfill.copied) {
                    console.log(
                        `autoCarryForward: backfilled centre ${centre_id} (${milkType}) — copied ${backfill.from} -> ${today} (${backfill.inserted} row(s))`,
                    );
                }

                // Step 2: push today's rates onto tomorrow.
                await copyRatesForDate(centre_id, milkType, today, tomorrowStr);
            } catch (err) {
                console.error(
                    `autoCarryForward: failed for centre ${centre_id}, milk_type ${milkType}:`,
                    err.message,
                );
            }
        }
    }
    console.log(
        `autoCarryForward: completed for ${centres.length} centre(s) — ${today} -> ${tomorrowStr}`,
    );
}

// Registers the nightly 00:05 job AND runs one catch-up pass immediately
// on startup, so a server restart/deploy doesn't leave a gap until the
// next scheduled tick.
function scheduleAutoCarryForward() {
    runAutoCarryForwardOnce().catch((err) =>
        console.error('autoCarryForward: startup catch-up failed:', err),
    );

    cron.schedule('5 0 * * *', () => {
        runAutoCarryForwardOnce().catch((err) =>
            console.error('autoCarryForward job error:', err),
        );
    });
}

module.exports = scheduleAutoCarryForward;