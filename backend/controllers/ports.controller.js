const pool = require('../config/db');
const net = require('net');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const { SerialPort } = require('serialport');

// ─── Helper: check admin role ─────────────────────────────────────────────────
function requireAdmin(req, res) {
    if (req.user.role !== 'admin') {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        return false;
    }
    return true;
}

// ─── GET /api/settings/ports ──────────────────────────────────────────────────
// Returns all port settings for the current dairy (admin only)
exports.getPortSettings = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const dairyId = req.user.dairy_id;

        const [rows] = await pool.query(
            `SELECT setting_key, setting_value
             FROM port_settings
             WHERE dairy_id = ?`,
            [dairyId]
        );

        const result = {};
        rows.forEach(r => { result[r.setting_key] = r.setting_value; });

        res.json(result);
    } catch (err) {
        console.error('getPortSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/settings/ports ─────────────────────────────────────────────────
// Saves all port settings for the current dairy (admin only)
exports.savePortSettings = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const dairyId = req.user.dairy_id;

        const allowedKeys = [
            'app_port', 'frontend_port',
            'db_host', 'db_port', 'db_name', 'db_user', 'db_password',
            'serial_port', 'serial_baud_rate', 'serial_data_bits',
            'serial_stop_bits', 'serial_parity',
            'cors_origin', 'api_base_url',
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_secure',
        ];

        const entries = allowedKeys
            .filter(key => req.body[key] !== undefined)
            .map(key => [dairyId, key, req.body[key] ?? '']);

        if (!entries.length) {
            return res.json({ message: 'Nothing to save.' });
        }

        await pool.query(
            `INSERT INTO port_settings (dairy_id, setting_key, setting_value)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               setting_value = VALUES(setting_value),
               updated_at    = CURRENT_TIMESTAMP`,
            [entries]
        );

        res.json({ message: 'Port settings saved successfully.' });
    } catch (err) {
        console.error('savePortSettings error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── POST /api/settings/ports/test ───────────────────────────────────────────
// Tests a connection based on type: 'app' | 'db' | 'serial' | 'smtp'
exports.testPortConnection = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    const { type, config } = req.body;

    if (!type || !config) {
        return res.status(400).json({ error: 'type and config are required.' });
    }

    try {
        switch (type) {

            // ── App port: try TCP connect to localhost:app_port ──────────────
            case 'app': {
                const port = parseInt(config.app_port, 10);
                if (!port || port < 1 || port > 65535) {
                    return res.json({ success: false, message: 'Invalid port number.' });
                }

                const reachable = await tcpPing('127.0.0.1', port);
                return res.json({
                    success: reachable,
                    message: reachable
                        ? `Backend is reachable on port ${port}.`
                        : `Nothing is listening on port ${port}.`,
                });
            }

            // ── Database: attempt real MySQL connection ───────────────────────
            case 'db': {
                const { db_host, db_port, db_name, db_user, db_password } = config;

                if (!db_host || !db_port || !db_name || !db_user) {
                    return res.json({ success: false, message: 'Host, port, database name, and username are required.' });
                }

                let conn;
                try {
                    conn = await mysql.createConnection({
                        host: db_host,
                        port: parseInt(db_port, 10),
                        database: db_name,
                        user: db_user,
                        password: db_password || '',
                        connectTimeout: 5000,
                    });
                    await conn.ping();
                    return res.json({ success: true, message: 'Database connection successful.' });
                } catch (dbErr) {
                    return res.json({
                        success: false,
                        message: `Database connection failed: ${dbErr.message}`,
                    });
                } finally {
                    if (conn) await conn.end().catch(() => { });
                }
            }

            // ── Serial: check if port exists / can be opened ─────────────────
            case 'serial': {
                const {
                    serial_port,
                    serial_baud_rate,
                    serial_data_bits,
                    serial_stop_bits,
                    serial_parity,
                } = config;

                if (!serial_port) {
                    return res.json({ success: false, message: 'COM port is required.' });
                }

                try {
                    // List available ports and check if requested port exists
                    const availablePorts = await SerialPort.list();
                    const portExists = availablePorts.some(
                        p => p.path.toLowerCase() === serial_port.toLowerCase()
                    );

                    if (!portExists) {
                        return res.json({
                            success: false,
                            message: `Port ${serial_port} not found. Available: ${availablePorts.map(p => p.path).join(', ') || 'none'}`,
                        });
                    }

                    // Try opening the port briefly
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
                            sp.close(() => resolve());
                        });
                    });

                    return res.json({
                        success: true,
                        message: `Serial port ${serial_port} opened successfully at ${serial_baud_rate} baud.`,
                    });
                } catch (serialErr) {
                    return res.json({
                        success: false,
                        message: `Serial port error: ${serialErr.message}`,
                    });
                }
            }

            // ── SMTP: verify transport credentials ───────────────────────────
            case 'smtp': {
                const { smtp_host, smtp_port, smtp_user, smtp_password, smtp_secure } = config;

                if (!smtp_host || !smtp_port) {
                    return res.json({ success: false, message: 'SMTP host and port are required.' });
                }

                const transporter = nodemailer.createTransport({
                    host: smtp_host,
                    port: parseInt(smtp_port, 10),
                    secure: smtp_secure === 'true',
                    auth: smtp_user && smtp_password
                        ? { user: smtp_user, pass: smtp_password }
                        : undefined,
                    connectionTimeout: 5000,
                    greetingTimeout: 5000,
                    socketTimeout: 5000,
                });

                try {
                    await transporter.verify();
                    return res.json({
                        success: true,
                        message: `SMTP connection to ${smtp_host}:${smtp_port} verified.`,
                    });
                } catch (smtpErr) {
                    return res.json({
                        success: false,
                        message: `SMTP connection failed: ${smtpErr.message}`,
                    });
                }
            }

            default:
                return res.status(400).json({ error: `Unknown test type: ${type}` });
        }
    } catch (err) {
        console.error('testPortConnection error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ─── TCP ping helper ──────────────────────────────────────────────────────────
function tcpPing(host, port, timeoutMs = 3000) {
    return new Promise(resolve => {
        const socket = new net.Socket();
        let resolved = false;

        const done = (result) => {
            if (!resolved) {
                resolved = true;
                socket.destroy();
                resolve(result);
            }
        };

        socket.setTimeout(timeoutMs);
        socket.connect(port, host, () => done(true));
        socket.on('error', () => done(false));
        socket.on('timeout', () => done(false));
    });
}