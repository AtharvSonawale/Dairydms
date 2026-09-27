// src/services/fatMachine.service.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const pool = require('../config/db');

const SUBTYPES = ['fat_gavali', 'fat_utpadak', 'fat'];
const SOCKET_EVENT = { fat_gavali: 'fat:update:gavali', fat_utpadak: 'fat:update:utpadak', fat: 'fat:update:default' };

const activePort = { fat_gavali: null, fat_utpadak: null, fat: null };     // live SerialPort instance per subtype, or null if not connected
const activeParser = { fat_gavali: null, fat_utpadak: null, fat: null };
const latestReading = {
    fat_gavali: { fat: null, snf: null, water: null, protein: null, raw: null, timestamp: null, connected: false },
    fat_utpadak: { fat: null, snf: null, water: null, protein: null, raw: null, timestamp: null, connected: false },
    fat: { fat: null, snf: null, water: null, protein: null, raw: null, timestamp: null, connected: false },
};
let ioInstance = null;        // socket.io server instance, set via init()

// ─── Registry of external close functions, keyed by port path ────────────────
// Lets connect() reliably take over a port even if something else (e.g. the
// Port Settings "Test" flow in portController.js) still has a SerialPort
// instance open on the same path. registerCloser/unregisterCloser allow other
// modules to plug their own open handles into this same release path, without
// a circular require.
const externalClosers = new Map(); // path -> () => Promise<void>

// ─── Parse a line like:
// "LE2.12|A|CH1|F03.90|S08.50|C29.40|P03.10|L04.70|s00.70|W00.00|T33.13"
// Pipe-delimited frame from the milk analyzer. Field prefixes:
//   LE.. = firmware version, A = analyzer status, CH.. = channel number,
//   F = Fat %, S = SNF % (uppercase — distinct from lowercase "s" = Salts %),
//   C = CLR, P = Protein %, L = Lactose %, W = Added Water %, T = Temp (°C).
// We only need Fat (F) and SNF (S, uppercase) for now; the regex is
// anchored to a literal uppercase "S" right after "|" so it never matches
// the lowercase "s00.70" (Salts) field that follows L04.70.
function parseAnalyzerLine(line) {
    const trimmed = (line || '').trim();
    if (!trimmed) return null;

    const fatMatch = trimmed.match(/\|F(\d+\.\d+)/);
    const snfMatch = trimmed.match(/\|S(\d+\.\d+)/);     // uppercase S only — not lowercase s (Salts)
    const waterMatch = trimmed.match(/\|W(\d+\.\d+)/);     // Added Water %
    const proteinMatch = trimmed.match(/\|P(\d+\.\d+)/);   // Protein %

    if (!fatMatch || !snfMatch) return null;

    const fat = parseFloat(fatMatch[1]);
    const snf = parseFloat(snfMatch[1]);
    const water = waterMatch ? parseFloat(waterMatch[1]) : null;
    const protein = proteinMatch ? parseFloat(proteinMatch[1]) : null;
    return { fat, snf, water, protein, raw: trimmed };
}

// ─── Push the latest reading to all connected frontend clients ───────────────
function broadcast(subtype) {
    if (ioInstance) {
        ioInstance.emit(SOCKET_EVENT[subtype], latestReading[subtype]);
    }
}

function disconnect(subtype) {
    if (activePort[subtype] && activePort[subtype].isOpen) {
        activePort[subtype].close();
    }
    activePort[subtype] = null;
    activeParser[subtype] = null;
}

// Awaitable version — used internally by connect() so a reopen never races
// the OS-level teardown of the previous handle on the same path.
function disconnectAndWait(subtype) {
    return new Promise((resolve) => {
        if (activePort[subtype] && activePort[subtype].isOpen) {
            activePort[subtype].close(() => {
                activePort[subtype] = null;
                activeParser[subtype] = null;
                resolve();
            });
        } else {
            activePort[subtype] = null;
            activeParser[subtype] = null;
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
    // 1) If this module itself still thinks it owns this path (under ANY
    //    subtype), close that subtype's handle and WAIT for the OS to
    //    actually release it, before the caller tries to reopen it.
    for (const st of SUBTYPES) {
        if (activePort[st] && activePort[st].path === path) {
            await disconnectAndWait(st);
        }
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
async function connect(dairyId, subtype) {
    if (!SUBTYPES.includes(subtype)) {
        throw new Error(`Invalid Fat & SNF machine subtype: ${subtype}`);
    }

    await disconnectAndWait(subtype); // wait for any existing connection held by THIS module (this subtype) to fully release first

    const [[settings]] = await pool.query(
        `SELECT serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity
         FROM port_settings WHERE dairy_id = ? AND machine_type = ?`,
        [dairyId, subtype]
    );

    const label = subtype === 'fat_gavali' ? 'Gavali'
        : subtype === 'fat_utpadak' ? 'Utpadak'
            : 'Default';

    if (!settings || !settings.serial_port) {
        throw new Error(`No ${label} Fat & SNF machine port configured. Set it up in Port Settings first.`);
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

        parser.on('data', (line) => {
            const parsed = parseAnalyzerLine(line);
            if (parsed) {
                latestReading[subtype] = {
                    fat: parsed.fat,
                    snf: parsed.snf,
                    water: parsed.water,
                    protein: parsed.protein,
                    raw: parsed.raw,
                    timestamp: new Date().toISOString(),
                    connected: true,
                };
                broadcast(subtype);
            }
        });

        sp.on('close', () => {
            latestReading[subtype] = { ...latestReading[subtype], connected: false };
            broadcast(subtype);
            activePort[subtype] = null;
            activeParser[subtype] = null;
        });

        sp.on('error', (err) => {
            console.error(`${label} Fat & SNF analyzer serial error:`, err.message);
        });

        sp.open((err) => {
            if (err) return reject(err);
            activePort[subtype] = sp;
            activeParser[subtype] = parser;

            // Some virtual null-modem pairs (com0com) only resume forwarding
            // once DTR/RTS are explicitly asserted by the listening side.
            sp.set({ dtr: true, rts: true }, (setErr) => {
                if (setErr) console.error('Failed to set DTR/RTS:', setErr.message);
            });

            // "connected: true" now means the OS port handle opened successfully.
            // It does NOT guarantee the analyzer is sending valid data — check
            // latestReading[subtype].timestamp / isReceivingData(subtype) if you need that distinction.
            latestReading[subtype] = { fat: null, snf: null, water: null, protein: null, raw: null, timestamp: null, connected: true };
            broadcast(subtype);
            resolve();
        });
    });
}

function getLatest(subtype) {
    return latestReading[subtype];
}

function isReceivingData(subtype) {
    // Consider it truly "live" only if we've gotten a real frame in the last 5 seconds
    const reading = latestReading[subtype];
    if (!reading.timestamp) return false;
    return (Date.now() - new Date(reading.timestamp).getTime()) < 5000;
}

function init(io) {
    ioInstance = io;
    // Send the current reading for ALL fat machines immediately to any newly connected client
    io.on('connection', (socket) => {
        SUBTYPES.forEach(subtype => socket.emit(SOCKET_EVENT[subtype], latestReading[subtype]));
    });
}

function isConnected(subtype) {
    return !!(activePort[subtype] && activePort[subtype].isOpen);
}

module.exports = {
    connect, disconnect, disconnectAndWait, getLatest, init, isConnected, isReceivingData, parseAnalyzerLine,
    forceClosePortPath, registerCloser, unregisterCloser,
};