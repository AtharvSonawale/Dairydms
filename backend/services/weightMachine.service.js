// src/services/weightMachine.service.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const pool = require('../config/db');

let activePort = null;       // live SerialPort instance, or null if not connected
let activeParser = null;
let latestReading = { value: null, unit: null, raw: null, timestamp: null, connected: false };
let ioInstance = null;        // socket.io server instance, set via init()

// ─── Parse a line like "+0005.460 Ltr" or "-0005.460 Ltr" ────────────────────
// Captures the unit (e.g. "Ltr", "Kg") rather than assuming it's always Ltr,
// so the UOM shown in the UI always reflects what the machine actually sent.
function parseWeightLine(line) {
    const trimmed = (line || '').trim();
    const match = trimmed.match(/^([+-])(\d+\.\d+)\s*([A-Za-z]+)/);
    if (!match) return null;

    const sign = match[1] === '-' ? -1 : 1;
    const value = sign * parseFloat(match[2]);
    const unit = match[3];
    return { value, unit, raw: trimmed };
}

// ─── Push the latest reading to all connected frontend clients ───────────────
function broadcast() {
    if (ioInstance) {
        ioInstance.emit('weight:update', latestReading);
    }
}

// ─── Open the serial port using saved settings for the weight machine ────────
async function connect(dairyId) {
    disconnect(); // close any existing connection first

    const [[settings]] = await pool.query(
        `SELECT serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity
         FROM port_settings WHERE dairy_id = ? AND machine_type = 'weight'`,
        [dairyId]
    );

    if (!settings || !settings.serial_port) {
        throw new Error('No weight machine port configured. Set it up in Port Settings first.');
    }

    return new Promise((resolve, reject) => {
        const sp = new SerialPort({
            path: settings.serial_port,
            baudRate: parseInt(settings.serial_baud_rate, 10) || 9600,
            dataBits: parseInt(settings.serial_data_bits, 10) || 8,
            stopBits: parseFloat(settings.serial_stop_bits) || 1,
            parity: settings.serial_parity || 'none',
            autoOpen: false,
        });

        const parser = sp.pipe(new ReadlineParser({ delimiter: '\n' }));

        // TEMPORARY DIAGNOSTIC — logs every raw byte that arrives on the port,
        // independent of line-parsing, so we can confirm bytes are actually
        // reaching this SerialPort instance at all. Remove once issue is fixed.
        sp.on('data', (chunk) => {
            console.log('[RAW BYTES]', chunk.toString('hex'), '|', JSON.stringify(chunk.toString()));
        });

        parser.on('data', (line) => {
            const parsed = parseWeightLine(line);
            if (parsed) {
                latestReading = {
                    value: parsed.value,
                    unit: parsed.unit,
                    raw: parsed.raw,
                    timestamp: new Date().toISOString(),
                    connected: true,
                };
                broadcast();
            }
        });

        sp.on('close', () => {
            latestReading = { ...latestReading, connected: false };
            broadcast();
            activePort = null;
            activeParser = null;
        });

        sp.on('error', (err) => {
            console.error('Weight machine serial error:', err.message);
        });

        // AFTER sp.open() succeeds, inside the open callback
        sp.open((err) => {
            if (err) return reject(err);
            activePort = sp;
            activeParser = parser;
            // "connected: true" now means the OS port handle opened successfully.
            // It does NOT guarantee the machine is sending valid data — check
            // latestReading.timestamp / isReceivingData() if you need that distinction.
            latestReading = { value: null, unit: null, raw: null, timestamp: null, connected: true };
            broadcast();
            resolve();
        });
    });
}

function disconnect() {
    if (activePort && activePort.isOpen) {
        activePort.close();
    }
    activePort = null;
    activeParser = null;
}

function getLatest() {
    return latestReading;
}

function isReceivingData() {
    // Consider it truly "live" only if we've gotten a real frame in the last 5 seconds
    if (!latestReading.timestamp) return false;
    return (Date.now() - new Date(latestReading.timestamp).getTime()) < 5000;
}

function init(io) {
    ioInstance = io;
    // Send the current reading immediately to any newly connected client
    io.on('connection', (socket) => {
        socket.emit('weight:update', latestReading);
    });
}

function isConnected() {
    return !!(activePort && activePort.isOpen);
}

module.exports = { connect, disconnect, getLatest, init, isConnected, isReceivingData, parseWeightLine };