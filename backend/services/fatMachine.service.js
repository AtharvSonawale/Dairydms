// src/services/fatMachine.service.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const pool = require('../config/db');

let activePort = null;       // live SerialPort instance, or null if not connected
let activeParser = null;
let latestReading = { fat: null, snf: null, raw: null, timestamp: null, connected: false };
let ioInstance = null;        // socket.io server instance, set via init()

// ─── Registry of external close functions, keyed by port path ────────────────
// Lets connect() reliably take over a port even if something else (e.g. the
// Port Settings "Test" flow in portController.js) still has a SerialPort
// instance open on the same path. registerCloser/unregisterCloser allow other
// modules to plug their own open handles into this same release path, without
// a circular require.
const externalClosers = new Map(); // path -> () => Promise<void>

// ─── Parse a line like "+004.20,+008.50" (fat,snf) ────────────────────────────
// NOTE: This regex assumes a comma-separated "<fat>,<snf>" frame, mirroring
// the signed-decimal style of the weight machine's "+0005.460 Ltr" format.
// Swap this out for whatever your actual analyzer's datasheet specifies —
// some devices send space-separated values, labeled fields (e.g. "F:4.20
// S:8.50"), or fixed-width columns instead.
function parseAnalyzerLine(line) {
    const trimmed = (line || '').trim();
    const match = trimmed.match(/^([+-]?\d+\.\d+)\s*,\s*([+-]?\d+\.\d+)/);
    if (!match) return null;

    const fat = parseFloat(match[1]);
    const snf = parseFloat(match[2]);
    return { fat, snf, raw: trimmed };
}

// ─── Push the latest reading to all connected frontend clients ───────────────
function broadcast() {
    if (ioInstance) {
        ioInstance.emit('fat:update', latestReading);
    }
}

// AFTER
function disconnect() {
    if (activePort && activePort.isOpen) {
        activePort.close();
    }
    activePort = null;
    activeParser = null;
}

// Awaitable version — used internally by connect() so a reopen never races
// the OS-level teardown of the previous handle on the same path.
function disconnectAndWait() {
    return new Promise((resolve) => {
        if (activePort && activePort.isOpen) {
            activePort.close(() => {
                activePort = null;
                activeParser = null;
                resolve();
            });
        } else {
            activePort = null;
            activeParser = null;
            resolve();
        }
    });
}

function registerCloser(path, closerFn) {
    externalClosers.set(path, closerFn);
}

function unregisterCloser(path) {
    externalClosers.delete(path);
}

// ─── Force-release any handle on a given port path, whoever holds it ─────────
async function forceClosePortPath(path) {
    // 1) If this module itself still thinks it owns this path, close it
    //    and WAIT for the OS to actually release the handle.
    if (activePort && activePort.path === path) {
        await disconnectAndWait();
    }
    // 2) If another module (e.g. portController's test-connection registry)
    //    registered a closer for this exact path, invoke it too.
    const externalClose = externalClosers.get(path);
    if (externalClose) {
        try {
            await externalClose();
        } catch (err) {
            console.error(`forceClosePortPath: failed to close external handle on ${path}:`, err.message);
        } finally {
            unregisterCloser(path);
        }
    }
}

// ─── Open the serial port using saved settings for the Fat & SNF analyzer ────
// AFTER
async function connect(dairyId) {
    await disconnectAndWait(); // wait for any existing connection held by THIS module to fully release first

    const [[settings]] = await pool.query(
        `SELECT serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity
         FROM port_settings WHERE dairy_id = ? AND machine_type = 'fat'`,
        [dairyId]
    );

    if (!settings || !settings.serial_port) {
        throw new Error('No Fat & SNF machine port configured. Set it up in Port Settings first.');
    }

    // Force-release any handle the test-connection flow (portController.js)
    // may still be holding on this exact port path, so a leftover "Test"
    // session never blocks the real analyzer connection.
    await forceClosePortPath(settings.serial_port);

    // Small grace period after closing — some drivers (notably virtual
    // null-modem pairs like com0com) need a brief moment after the close
    // callback fires before the OS truly frees the path for a new open.
    // Without this, a fast reopen on the same tick can still race the
    // underlying teardown and report "Access denied".
    await new Promise(resolve => setTimeout(resolve, 250));

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

        // Raw-byte diagnostic — logs every chunk that arrives on the port,
        // independent of line-parsing. Safe to leave in; harmless overhead.
        sp.on('data', (chunk) => {
            console.log('[RAW BYTES]', chunk.toString('hex'), '|', JSON.stringify(chunk.toString()));
        });

        parser.on('data', (line) => {
            const parsed = parseAnalyzerLine(line);
            if (parsed) {
                latestReading = {
                    fat: parsed.fat,
                    snf: parsed.snf,
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
            console.error('Fat & SNF analyzer serial error:', err.message);
        });

        sp.open((err) => {
            if (err) return reject(err);
            activePort = sp;
            activeParser = parser;

            // Some virtual null-modem pairs (com0com) only resume forwarding
            // once DTR/RTS are explicitly asserted by the listening side.
            sp.set({ dtr: true, rts: true }, (setErr) => {
                if (setErr) console.error('Failed to set DTR/RTS:', setErr.message);
            });

            // "connected: true" now means the OS port handle opened successfully.
            // It does NOT guarantee the analyzer is sending valid data — check
            // latestReading.timestamp / isReceivingData() if you need that distinction.
            latestReading = { fat: null, snf: null, raw: null, timestamp: null, connected: true };
            broadcast();
            resolve();
        });
    });
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
        socket.emit('fat:update', latestReading);
    });
}

function isConnected() {
    return !!(activePort && activePort.isOpen);
}

module.exports = {
    connect, disconnect, disconnectAndWait, getLatest, init, isConnected, isReceivingData, parseAnalyzerLine,
    forceClosePortPath, registerCloser, unregisterCloser,
};