const pool = require('../config/db');

exports.getUsbRoles = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;
        const [rows] = await pool.query(
            `SELECT device_key, device_name, vid, pid, product_name,
              manufacturer, role
       FROM usb_device_roles
       WHERE dairy_id = ?`,
            [dairyId]
        );
        res.json({ rows });
    } catch (err) {
        console.error('getUsbRoles error:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.saveUsbRoles = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;
        const isAdmin = req.user.role === 'admin';
        const operatorId = isAdmin ? null : req.user.id;
        const adminId = isAdmin ? req.user.id : null;
        const devices = Array.isArray(req.body?.devices) ? req.body.devices : [];
        if (!devices.length) return res.json({ ok: true });

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const d of devices) {
                if (!d.device_key) continue;
                await conn.query(
                    `INSERT INTO usb_device_roles
             (dairy_id, device_key, device_name, vid, pid, product_name,
              manufacturer, role, updated_by_operator_id, updated_by_admin_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             device_name = VALUES(device_name),
             vid = VALUES(vid),
             pid = VALUES(pid),
             product_name = VALUES(product_name),
             manufacturer = VALUES(manufacturer),
             role = VALUES(role),
             updated_by_operator_id = VALUES(updated_by_operator_id),
             updated_by_admin_id = VALUES(updated_by_admin_id)`,
                    [
                        dairyId,
                        d.device_key,
                        d.device_name ?? null,
                        d.vid ?? null,
                        d.pid ?? null,
                        d.product_name ?? null,
                        d.manufacturer ?? null,
                        d.role ?? 'unassigned',
                        operatorId,
                        adminId,
                    ]
                );
            }
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
        res.json({ ok: true });
    } catch (err) {
        console.error('saveUsbRoles error:', err);
        res.status(500).json({ error: err.message });
    }
};