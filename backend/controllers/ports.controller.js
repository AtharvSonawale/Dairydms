const pool = require('../config/db');
const { SerialPort } = require('serialport');
const weightMachine = require('../services/weightMachine.service');
const fatMachine = require('../services/fatMachine.service');

// ─── In-memory registry of ports this server process currently holds open ────
// Key: port path (e.g. "COM3"), Value: live SerialPort instance.
// NOTE: this only tracks ports opened BY THIS SERVER. It cannot see ports
// held open by other programs (Arduino IDE, PuTTY, etc.) — the OS doesn't
// expose that information through SerialPort.list().
const openPorts = new Map();

// ─── Helper: check admin role ─────────────────────────────────────────────────
function requireAdmin(req, res) {
    if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return false;
    }
    return true;
}

// ─── Helper: check operator permission (admins always pass) ──────────────────
// op: 'R' | 'C' | 'U' | 'D' — checked against operator_permissions.page_key = 'port_settings'
async function canAccessPorts(req, res, op = 'R') {
    if (req.user.role === 'admin') return true;

    if (req.user.role !== 'operator') {
        res.status(403).json({ error: 'Access denied.' });
        return false;
    }

    try {
        const [[perm]] = await pool.query(
            `SELECT can_create, can_read, can_update, can_delete
             FROM operator_permissions
             WHERE operator_id = ? AND page_key = ?`,
            [req.user.id, 'port_settings']
        );

        const allowed = op === 'R' ? perm?.can_read
            : op === 'C' ? perm?.can_create
            : op === 'U' ? perm?.can_update
            : perm?.can_delete;

        if (!allowed) {
            res.status(403).json({ error: 'Access denied. Missing permission for port settings.' });
            return false;
        }
        return true;
    } catch (err) {
        console.error('canAccessPorts error:', err);
        res.status(500).json({ error: 'Failed to verify permissions.' });
        return false;
    }
}

// ─── GET /api/settings/ports ──────────────────────────────────────────────────
// Returns serial settings for BOTH machine types for the current dairy (admin only)
exports.getPortSettings = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'R'))) return;

    try {
        const dairyId = req.user.dairy_id;

        const [rows] = await pool.query(
            `SELECT machine_type, serial_port, serial_baud_rate,
    serial_data_bits, serial_stop_bits, serial_parity,
    kg_unit_label, ltr_unit_label, default_weight_unit
 FROM port_settings
 WHERE dairy_id = ?`,
            [dairyId]
        );

        const byMachine = {
            weight_gavali: { serial_port: '', serial_baud_rate: '9600', serial_data_bits: '8', serial_stop_bits: '1', serial_parity: 'none', kg_unit_label: 'Kg', ltr_unit_label: 'Ltr', default_weight_unit: 'ltr' },
            weight_utpadak: { serial_port: '', serial_baud_rate: '9600', serial_data_bits: '8', serial_stop_bits: '1', serial_parity: 'none', kg_unit_label: 'Kg', ltr_unit_label: 'Ltr', default_weight_unit: 'ltr' },
            weight: { serial_port: '', serial_baud_rate: '9600', serial_data_bits: '8', serial_stop_bits: '1', serial_parity: 'none', kg_unit_label: 'Kg', ltr_unit_label: 'Ltr', default_weight_unit: 'ltr' },
            fat: { serial_port: '', serial_baud_rate: '9600', serial_data_bits: '8', serial_stop_bits: '1', serial_parity: 'none' },
        };

        rows.forEach(r => {
            if (byMachine[r.machine_type]) {
                byMachine[r.machine_type] = {
                    serial_port: r.serial_port,
                    serial_baud_rate: r.serial_baud_rate,
                    serial_data_bits: r.serial_data_bits,
                    serial_stop_bits: r.serial_stop_bits,
                    serial_parity: r.serial_parity,
                    kg_unit_label: r.kg_unit_label ?? 'Kg',
                    ltr_unit_label: r.ltr_unit_label ?? 'Ltr',
                    default_weight_unit: r.default_weight_unit ?? 'ltr',
                };
            }
        });

        res.json(byMachine);
    } catch (err) {
        console.error('getPortSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/settings/ports ─────────────────────────────────────────────────
// Upserts serial settings for ONE machine type for the current dairy (admin only)
exports.savePortSettings = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const dairyId = req.user.dairy_id;
        const ALLOWED_MACHINE_TYPES = ['weight_gavali', 'weight_utpadak', 'weight', 'fat'];
        const machineType = ALLOWED_MACHINE_TYPES.includes(req.body.machine_type)
            ? req.body.machine_type
            : 'weight_utpadak';

        // AFTER
        const {
            serial_port = '',
            serial_baud_rate = '9600',
            serial_data_bits = '8',
            serial_stop_bits = '1',
            serial_parity = 'none',
            kg_unit_label = 'Kg',
            ltr_unit_label = 'Ltr',
            default_weight_unit = 'ltr',
        } = req.body;

        if (!serial_port) {
            return res.status(400).json({ error: 'serial_port is required.' });
        }
        if (!['kg', 'ltr'].includes(default_weight_unit)) {
            return res.status(400).json({ error: 'default_weight_unit must be "kg" or "ltr".' });
        }

        await pool.query(
            `INSERT INTO port_settings
   (dairy_id, machine_type, serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity, kg_unit_label, ltr_unit_label, default_weight_unit)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
 ON DUPLICATE KEY UPDATE
   serial_port         = VALUES(serial_port),
   serial_baud_rate    = VALUES(serial_baud_rate),
   serial_data_bits    = VALUES(serial_data_bits),
   serial_stop_bits    = VALUES(serial_stop_bits),
   serial_parity       = VALUES(serial_parity),
   kg_unit_label       = VALUES(kg_unit_label),
   ltr_unit_label      = VALUES(ltr_unit_label),
   default_weight_unit = VALUES(default_weight_unit),
   updated_at          = CURRENT_TIMESTAMP`,
            [dairyId, machineType, serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity, kg_unit_label, ltr_unit_label, default_weight_unit]
        );

        // Reconnect the matching live reader with the new settings
        if (machineType === 'weight_gavali' || machineType === 'weight_utpadak' || machineType === 'weight') {
            try {
                await weightMachine.connect(dairyId, machineType);
            } catch (connectErr) {
                console.error('weightMachine reconnect error:', connectErr.message);
                return res.json({
                    message: 'Port settings saved, but failed to connect to the weight machine.',
                    warning: connectErr.message,
                });
            }
        } else if (machineType === 'fat') {
            try {
                await fatMachine.connect(dairyId);
            } catch (connectErr) {
                console.error('fatMachine reconnect error:', connectErr.message);
                return res.json({
                    message: 'Port settings saved, but failed to connect to the Fat & SNF machine.',
                    warning: connectErr.message,
                });
            }
        }

        res.json({ message: 'Port settings saved successfully.' });
    } catch (err) {
        console.error('savePortSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── GET /api/settings/ports/available ───────────────────────────────────────
// Lists all serial ports currently visible to the OS (for the Scan button),
// flagging which ones this server currently holds open.
exports.listAvailablePorts = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const ports = await SerialPort.list();
        res.json({
            ports: ports.map(p => ({
                path: p.path,
                manufacturer: p.manufacturer || null,
                serialNumber: p.serialNumber || null,
                isOpen: openPorts.has(p.path),
            })),
        });
    } catch (err) {
        console.error('listAvailablePorts error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/settings/ports/close ──────────────────────────────────────────
// Closes a port this server currently holds open.
exports.closePort = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const { serial_port } = req.body;

    if (!serial_port) {
        return res.status(400).json({ error: 'serial_port is required.' });
    }

    const sp = openPorts.get(serial_port);
    if (!sp) {
        return res.json({ success: true, message: `Port ${serial_port} was not open.` });
    }

    try {
        await new Promise((resolve, reject) => {
            sp.close(err => {
                if (err) return reject(err);
                resolve();
            });
        });
        openPorts.delete(serial_port);
        res.json({ success: true, message: `Port ${serial_port} closed successfully.` });
    } catch (err) {
        console.error('closePort error:', err);
        res.status(500).json({ success: false, message: `Failed to close ${serial_port}: ${err.message}` });
    }
};

// ─── POST /api/settings/ports/test ───────────────────────────────────────────
// Tests the serial connection for the given machine config.
exports.testPortConnection = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const { config } = req.body;

    if (!config) {
        return res.status(400).json({ error: 'config is required.' });
    }

    const {
        serial_port,
        serial_baud_rate,
        serial_data_bits,
        serial_stop_bits,
        serial_parity,
    } = config;

    if (!serial_port) {
        return res.json({ success: false, message: 'A serial port must be selected.' });
    }

    try {
        const availablePorts = await SerialPort.list();
        const portExists = availablePorts.some(
            p => p.path.toLowerCase() === serial_port.toLowerCase()
        );

        if (!portExists) {
            console.warn(`Port ${serial_port} not in SerialPort.list() — attempting open anyway (may be a virtual/com0com port not yet enumerated).`);
            // Don't return early here — fall through and let sp.open() be the
            // real test. Virtual null-modem ports occasionally lag behind or are
            // named differently than the OS enumeration reports.
        }

        // Release any live machine connection that might be holding this exact
        // port path, on either machine type, before testing it.
        weightMachine.disconnect();
        fatMachine.disconnect();

        // If we already have this port open from a previous test, close it
        // first so we don't leak duplicate handles on repeated test clicks.
        if (openPorts.has(serial_port)) {
            await new Promise(resolve => openPorts.get(serial_port).close(() => resolve()));
            openPorts.delete(serial_port);
        }

        await new Promise((resolve, reject) => {
            const sp = new SerialPort({
                path: serial_port,
                baudRate: parseInt(serial_baud_rate, 10) || 9600,
                dataBits: parseInt(serial_data_bits, 10) || 8,
                stopBits: parseFloat(serial_stop_bits) || 1,
                parity: serial_parity || 'none',
                autoOpen: false,
            });

            sp.open(err => {
                if (err) return reject(err);
                openPorts.set(serial_port, sp);
                sp.on('close', () => {
                    openPorts.delete(serial_port);
                    weightMachine.unregisterCloser(serial_port);
                    fatMachine.unregisterCloser(serial_port);
                });

                // Let weightMachine.connect() OR fatMachine.connect() force-release
                // this exact handle later if the real machine connection needs the
                // same port path — prevents a leftover Test session from blocking it.
                weightMachine.registerCloser(serial_port, () => new Promise(res => sp.close(() => res())));
                fatMachine.registerCloser(serial_port, () => new Promise(res => sp.close(() => res())));

                resolve();
            });
        });

        return res.json({
            success: true,
            message: `Serial port ${serial_port} opened successfully at ${serial_baud_rate} baud and is now held open. Use "Close Port" to release it.`,
        });
    } catch (serialErr) {
        return res.json({
            success: false,
            message: `Serial port error: ${serialErr.message}`,
        });
    }
};


// ─── GET /api/settings/ports/weight/status ───────────────────────────────────
exports.getWeightStatus = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'R'))) return;
    const subtype =
    req.params.subtype === 'gavali' ? 'weight_gavali'
    : req.params.subtype === 'utpadak' ? 'weight_utpadak'
    : 'weight'; // 'default' subtype → the standalone Default Scale
    res.json(weightMachine.getLatest(subtype));
};

// ─── POST /api/settings/ports/weight/connect ─────────────────────────────────
exports.connectWeightMachine = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'U'))) return;
    const subtype =
    req.params.subtype === 'gavali' ? 'weight_gavali'
    : req.params.subtype === 'utpadak' ? 'weight_utpadak'
    : 'weight'; // 'default' subtype → the standalone Default Scale
    try {
        await weightMachine.connect(req.user.dairy_id, subtype);
        res.json({ success: true, message: 'Connected to the serial port.' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// ─── POST /api/settings/ports/weight/disconnect ──────────────────────────────
exports.disconnectWeightMachine = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'U'))) return;
    const subtype =
    req.params.subtype === 'gavali' ? 'weight_gavali'
    : req.params.subtype === 'utpadak' ? 'weight_utpadak'
    : 'weight'; // 'default' subtype → the standalone Default Scale
    weightMachine.disconnect(subtype);
    const label = subtype === 'weight_gavali' ? 'Gavali' : subtype === 'weight_utpadak' ? 'Utpadak' : 'Default';
res.json({ success: true, message: `Disconnected from ${label} weight machine.` });
};

// ─── GET /api/settings/ports/fat/status ──────────────────────────────────────
exports.getFatStatus = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'R'))) return;
    res.json(fatMachine.getLatest());
};

// ─── POST /api/settings/ports/fat/connect ────────────────────────────────────
exports.connectFatMachine = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'U'))) return;
    try {
        await fatMachine.connect(req.user.dairy_id);
        res.json({ success: true, message: 'Connected to the serial port.' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// ─── POST /api/settings/ports/fat/disconnect ─────────────────────────────────
exports.disconnectFatMachine = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'U'))) return;
    fatMachine.disconnect();
    res.json({ success: true, message: 'Disconnected from Fat & SNF machine.' });
};

// ─── GET /api/settings/weight-config ─────────────────────────────────────────
// Dairy-wide behavior toggles: whether Milk Entry auto-switches scales by
// seller_type, and which scale to use when switching is off.
exports.getWeightConfig = async (req, res) => {
    try {
        const dairyId = req.user.dairy_id;
        const [rows] = await pool.query(
            `SELECT setting_value FROM global_settings
             WHERE dairy_id = ? AND setting_key = 'weight_port_switching_enabled'`,
            [dairyId]
        );
        res.json({
            portSwitchingEnabled: rows[0]?.setting_value !== '0', // default ON
        });
    } catch (err) {
        console.error('getWeightConfig error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/settings/weight-config ────────────────────────────────────────
exports.saveWeightConfig = async (req, res) => {
    if (!(await canAccessPorts(req, res, 'U'))) return;
    try {
        const dairyId = req.user.dairy_id;
        const { portSwitchingEnabled } = req.body;

        if (typeof portSwitchingEnabled !== 'boolean') {
            return res.status(400).json({ error: 'portSwitchingEnabled (boolean) is required.' });
        }

        await pool.query(
            `INSERT INTO global_settings (dairy_id, setting_key, setting_value)
             VALUES (?, 'weight_port_switching_enabled', ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
            [dairyId, portSwitchingEnabled ? '1' : '0']
        );

        res.json({ message: 'Weight config saved.' });
    } catch (err) {
        console.error('saveWeightConfig error:', err);
        res.status(500).json({ error: err.message });
    }
};