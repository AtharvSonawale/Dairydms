const pool = require('../config/db');

// Admins only — this page is admin-facing in your Flutter app.
function requireAdmin(req, res) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return false;
    }
    return true;
}

// ─────────────────────────────────────────────────────────────
// GET /api/settings/usb-roles
// Returns the full list of saved devices for the current dairy.
// ─────────────────────────────────────────────────────────────
exports.getUsbRoles = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        const dairyId = req.user.dairy_id;
        const [rows] = await pool.query(
            `SELECT device_key, device_name, vid, pid, product_name, manufacturer,
              role, baud_rate, data_bits, stop_bits, parity,
              regex_pattern, regex_group, target_page, target_field,
              kg_unit_label, ltr_unit_label, default_weight_unit
       FROM usb_device_settings
       WHERE dairy_id = ? AND is_active = 1
       ORDER BY role, device_name`,
            [dairyId]
        );
        res.json({ rows });
    } catch (err) {
        console.error('getUsbRoles error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/settings/usb-roles
// Bulk upsert the device list. Payload:
// { devices: [ { device_key, device_name, vid, pid, product_name,
//                manufacturer, role, baud_rate, data_bits, stop_bits,
//                parity, regex_pattern, regex_group, target_page,
//                target_field, kg_unit_label, ltr_unit_label,
//                default_weight_unit }, ... ] }
// ─────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ['scale', 'analyzer', 'ignore', 'unassigned'];
const ALLOWED_PAGES = ['gavali_milk', 'utpadak_milk', 'both', 'none'];
const ALLOWED_FIELDS = ['weight', 'fat', 'snf', 'none'];

exports.saveUsbRoles = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const dairyId = req.user.dairy_id;
    const devices = Array.isArray(req.body?.devices) ? req.body.devices : [];

    if (!devices.length) {
        // Not an error — just means user cleared everything. Wipe all roles.
        try {
            await pool.query(
                `UPDATE usb_device_settings SET role='unassigned', target_page='none', target_field='none'
         WHERE dairy_id = ?`,
                [dairyId]
            );
            return res.json({ message: 'All role assignments cleared.' });
        } catch (err) {
            console.error('saveUsbRoles (clear) error:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const d of devices) {
            const key = String(d.device_key || '').trim();
            if (!key) continue;

            const role = ALLOWED_ROLES.includes(d.role) ? d.role : 'unassigned';
            const targetPage = ALLOWED_PAGES.includes(d.target_page) ? d.target_page : 'none';
            const targetField = ALLOWED_FIELDS.includes(d.target_field) ? d.target_field : 'none';
            const regexGroup = Number.isFinite(+d.regex_group) ? Math.max(0, +d.regex_group) : 1;

            // Basic regex sanity check — reject if it won't compile.
            let regexPattern = String(d.regex_pattern ?? '');
            if (regexPattern) {
                try { new RegExp(regexPattern); }
                catch (e) { return res.status(400).json({ error: `Invalid regex for ${key}: ${e.message}` }); }
            }

            await conn.query(
                `INSERT INTO usb_device_settings
          (dairy_id, device_key, device_name, vid, pid, product_name, manufacturer,
           role, baud_rate, data_bits, stop_bits, parity,
           regex_pattern, regex_group, target_page, target_field,
           kg_unit_label, ltr_unit_label, default_weight_unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           device_name      = VALUES(device_name),
           vid              = VALUES(vid),
           pid              = VALUES(pid),
           product_name     = VALUES(product_name),
           manufacturer     = VALUES(manufacturer),
           role             = VALUES(role),
           baud_rate        = VALUES(baud_rate),
           data_bits        = VALUES(data_bits),
           stop_bits        = VALUES(stop_bits),
           parity           = VALUES(parity),
           regex_pattern    = VALUES(regex_pattern),
           regex_group      = VALUES(regex_group),
           target_page      = VALUES(target_page),
           target_field     = VALUES(target_field),
           kg_unit_label    = VALUES(kg_unit_label),
           ltr_unit_label   = VALUES(ltr_unit_label),
           default_weight_unit = VALUES(default_weight_unit),
           is_active        = 1`,
                [
                    dairyId, key,
                    d.device_name ?? '',
                    d.vid ?? null, d.pid ?? null,
                    d.product_name ?? null, d.manufacturer ?? null,
                    role,
                    d.baud_rate ?? '9600',
                    d.data_bits ?? '8',
                    d.stop_bits ?? '1',
                    d.parity ?? 'none',
                    regexPattern, regexGroup,
                    targetPage, targetField,
                    d.kg_unit_label ?? 'Kg',
                    d.ltr_unit_label ?? 'Ltr',
                    d.default_weight_unit ?? 'ltr',
                ]
            );
        }

        await conn.commit();
        res.json({ message: 'USB roles saved successfully.' });
    } catch (err) {
        await conn.rollback();
        console.error('saveUsbRoles error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/settings/usb-settings/active
// Lightweight lookup used by Milk Entry pages at runtime: returns
// only rows that have a real role + a non-'none' target_page so the
// Flutter side can wire the stream directly to the right textfield.
// ─────────────────────────────────────────────────────────────
exports.getActiveUsbSettings = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;
        const [rows] = await pool.query(
            `SELECT device_key, role, baud_rate, data_bits, stop_bits, parity,
              regex_pattern, regex_group, target_page, target_field,
              kg_unit_label, ltr_unit_label, default_weight_unit
       FROM usb_device_settings
       WHERE dairy_id = ?
         AND is_active = 1
         AND role IN ('scale','analyzer')
         AND target_page <> 'none'
         AND target_field <> 'none'`,
            [dairyId]
        );
        res.json({ rows });
    } catch (err) {
        console.error('getActiveUsbSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};