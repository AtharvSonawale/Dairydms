const pool = require('../config/db');
const { SerialPort } = require('serialport');
const weightMachine = require('../services/weightMachine.service');

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

// ─── GET /api/settings/ports ──────────────────────────────────────────────────
// Returns serial settings for BOTH machine types for the current dairy (admin only)
exports.getPortSettings = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const dairyId = req.user.dairy_id;

        const [rows] = await pool.query(
            `SELECT machine_type, serial_port, serial_baud_rate,
                    serial_data_bits, serial_stop_bits, serial_parity
             FROM port_settings
             WHERE dairy_id = ?`,
            [dairyId]
        );

        const byMachine = {
            weight: { serial_port: '', serial_baud_rate: '9600', serial_data_bits: '8', serial_stop_bits: '1', serial_parity: 'none' },
            fat: { serial_port: '', serial_baud_rate: '9600', serial_data_bits: '8', serial_stop_bits: '1', serial_parity: 'none' },
        };

        rows.forEach(r => {
            if (r.machine_type === 'weight' || r.machine_type === 'fat') {
                byMachine[r.machine_type] = {
                    serial_port: r.serial_port,
                    serial_baud_rate: r.serial_baud_rate,
                    serial_data_bits: r.serial_data_bits,
                    serial_stop_bits: r.serial_stop_bits,
                    serial_parity: r.serial_parity,
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
        const machineType = (req.body.machine_type === 'fat') ? 'fat' : 'weight';

        const {
            serial_port = '',
            serial_baud_rate = '9600',
            serial_data_bits = '8',
            serial_stop_bits = '1',
            serial_parity = 'none',
        } = req.body;

        if (!serial_port) {
            return res.status(400).json({ error: 'serial_port is required.' });
        }

        await pool.query(
            `INSERT INTO port_settings
               (dairy_id, machine_type, serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               serial_port       = VALUES(serial_port),
               serial_baud_rate  = VALUES(serial_baud_rate),
               serial_data_bits  = VALUES(serial_data_bits),
               serial_stop_bits  = VALUES(serial_stop_bits),
               serial_parity     = VALUES(serial_parity),
               updated_at        = CURRENT_TIMESTAMP`,
            [dairyId, machineType, serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity]
        );

        // If this is the weight machine, reconnect the live reader with the new settings
        if (machineType === 'weight') {
            try {
                await weightMachine.connect(dairyId);
            } catch (connectErr) {
                console.error('weightMachine reconnect error:', connectErr.message);
                return res.json({
                    message: 'Port settings saved, but failed to connect to the weight machine.',
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
        weightMachine.disconnect();


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
                sp.on('close', () => openPorts.delete(serial_port));
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
    if (!requireAdmin(req, res)) return;
    res.json(weightMachine.getLatest());
};

// ─── POST /api/settings/ports/weight/connect ─────────────────────────────────
exports.connectWeightMachine = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    try {
        await weightMachine.connect(req.user.dairy_id);
        res.json({ success: true, message: 'Connected to the serial port.' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
// ─── POST /api/settings/ports/weight/disconnect ──────────────────────────────
exports.disconnectWeightMachine = async (req, res) => {
    if (!requireAdmin(req, res)) return;
    weightMachine.disconnect();
    res.json({ success: true, message: 'Disconnected from weight machine.' });
};