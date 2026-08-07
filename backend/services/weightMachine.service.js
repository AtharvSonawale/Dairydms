// src/services/weightMachine.service.js
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const pool = require('../config/db');

const SUBTYPES = ['weight_gavali', 'weight_utpadak', 'weight'];
const SOCKET_EVENT = { weight_gavali: 'weight:update:gavali', weight_utpadak: 'weight:update:utpadak', weight: 'weight:update:default' };

const activePort = { weight_gavali: null, weight_utpadak: null, weight: null };     // live SerialPort instance per subtype, or null if not connected
const activeParser = { weight_gavali: null, weight_utpadak: null, weight: null };
const latestReading = {
    weight_gavali: { value: null, value2: null, unit: null, unit2: null, raw: null, timestamp: null, connected: false },
    weight_utpadak: { value: null, value2: null, unit: null, unit2: null, raw: null, timestamp: null, connected: false },
    weight: { value: null, value2: null, unit: null, unit2: null, raw: null, timestamp: null, connected: false },
};
let ioInstance = null;        // socket.io server instance, set via init()

// ─── Registry of external close functions, keyed by port path ────────────────
// Lets connect() reliably take over a port even if something else (e.g. the
// Port Settings "Test" flow in portController.js) still has a SerialPort
// instance open on the same path. registerCloser/unregisterCloser allow other
// modules to plug their own open handles into this same release path, without
// a circular require.
const externalClosers = new Map(); // path -> () => Promise<void>

// ─── Parse a line like "+0005.460 Ltr" or "-0005.460 Ltr" ────────────────────
// Captures the unit (e.g. "Ltr", "Kg") rather than assuming it's always Ltr,
// so the UOM shown in the UI always reflects what the machine actually sent.
// 
// Supports multiple values in a single line, e.g.:
// "+0005.460 Ltr +0003.200 Kg" → value: 5.460, unit: "Ltr", value2: 3.200, unit2: "Kg"
// This allows weight machines that send both liters and kilograms simultaneously.
// NEW
function parseWeightLine(line, kgLabel = 'Kg', ltrLabel = 'Ltr') {
    const trimmed = (line || '').trim();
    if (!trimmed) return null;

    // Matches a decimal number with an OPTIONAL sign and an OPTIONAL unit
    // suffix. The old pattern required BOTH — so a high-capacity (500+ kg)
    // scale sending a bare "20.0" (no sign, no unit) never matched and the
    // line was silently dropped.
    const pattern = /([+-]?)(\d+\.\d+)\s*([A-Za-z]+)?/g;

    const kgL = kgLabel.trim().toLowerCase();
    const ltrL = ltrLabel.trim().toLowerCase();

    let kg = null;   // → primary Weight fields (value / unit)
    let ltr = null;  // → secondary Ltr fields (value2 / unit2)
    let match;

    while ((match = pattern.exec(trimmed)) !== null) {
        const sign = match[1] === '-' ? -1 : 1;
        const value = sign * parseFloat(match[2]);
        const rawUnit = match[3] || null;

        if (rawUnit && rawUnit.toLowerCase() === ltrL) {
            ltr = { value, unit: rawUnit };
        } else if (rawUnit && rawUnit.toLowerCase() === kgL) {
            kg = { value, unit: rawUnit };
        } else if (!rawUnit && !kg) {
            // No unit sent at all — the high-capacity scale's format
            // ("20.0"). Treat it as the Kg reading.
            kg = { value, unit: kgLabel };
        }
    }

    if (!kg && !ltr) return null;
    return { raw: trimmed, kg, ltr };
}

// ─── Push the latest reading to all connected frontend clients ───────────────
function broadcast(subtype) {
    if (ioInstance) {
        ioInstance.emit(SOCKET_EVENT[subtype], latestReading[subtype]);
    }
}

// AFTER
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

// ─── Open the serial port using saved settings for the weight machine ────────
// AFTER
async function connect(dairyId, subtype) {
    if (!SUBTYPES.includes(subtype)) {
        throw new Error(`Invalid weight machine subtype: ${subtype}`);
    }

    await disconnectAndWait(subtype); // wait for any existing connection held by THIS module (this subtype) to fully release first

    const [[settings]] = await pool.query(
        `SELECT serial_port, serial_baud_rate, serial_data_bits, serial_stop_bits, serial_parity,
            kg_unit_label, ltr_unit_label
     FROM port_settings WHERE dairy_id = ? AND machine_type = ?`,
        [dairyId, subtype]
    );

const label = subtype === 'weight_gavali' ? 'Gavali'
        : subtype === 'weight_utpadak' ? 'Utpadak'
        : 'Default';
    if (!settings || !settings.serial_port) {
        throw new Error(`No ${label} weight machine port configured. Set it up in Port Settings first.`);
    }

    // Dairy-wide toggle (Settings page → "Weight Kg→Ltr Auto-Convert"). Off by
    // default so existing single-value machines are unaffected until an admin
    // explicitly turns this on.
    const [[globalSetting]] = await pool.query(
        `SELECT setting_value FROM global_settings WHERE dairy_id = ? AND setting_key = 'weight_kg_to_ltr_enabled'`,
        [dairyId]
    );
    const kgToLtrEnabled = globalSetting
        ? (globalSetting.setting_value === '1' || globalSetting.setting_value === 'true')
        : true;    const kgLabel = settings.kg_unit_label || 'Kg';
    const ltrLabel = settings.ltr_unit_label || 'Ltr';
    const KG_TO_LTR_FACTOR = 0.97;

    // Force-release any handle the test-connection flow (portController.js)
    // may still be holding on this exact port path, so a leftover "Test"
    // session never blocks the real weight-machine connection.
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
            const parsed = parseWeightLine(line, kgLabel, ltrLabel);
            if (parsed) {
                const prev = latestReading[subtype];

                // A scale may send its Kg reading and its Ltr reading on two
                // SEPARATE lines (e.g. "20.0" on one line, "+0005.460 Ltr" on the
                // next). Merge into whatever we already had instead of wiping the
                // other field to null every time only one of them arrives.
                // NEW
                let kgValue = parsed.kg ? parsed.kg.value : prev.value;
                let kgUnit = parsed.kg ? parsed.kg.unit : prev.unit;
                let ltrValue = parsed.ltr ? parsed.ltr.value : prev.value2;
                let ltrUnit = parsed.ltr ? parsed.ltr.unit : prev.unit2;

                // Bidirectional derive: whichever reading actually arrived on
                // THIS line drives the other one, every time. A Kg-only scale
                // keeps Ltr in sync; an Ltr-only scale (e.g. "+0005.460 Ltr")
                // keeps Kg in sync too. If a line ever carries BOTH (a genuine
                // dual-output machine), we trust the hardware's own numbers
                // and skip deriving entirely.
                if (kgToLtrEnabled) {
                    if (parsed.kg && !parsed.ltr) {
                        ltrValue = parseFloat((kgValue * KG_TO_LTR_FACTOR).toFixed(3));
                        ltrUnit = ltrLabel;
                    } else if (parsed.ltr && !parsed.kg) {
                        kgValue = parseFloat((ltrValue / KG_TO_LTR_FACTOR).toFixed(3));
                        kgUnit = kgLabel;
                    }
                }

                latestReading[subtype] = {
                    value: kgValue,
                    unit: kgUnit,
                    value2: ltrValue,
                    unit2: ltrUnit,
                    raw: parsed.raw,
                    timestamp: new Date().toISOString(),
                    connected: true,
                };
                broadcast(subtype);
            }
        });

        sp.on('close', () => {
            latestReading[subtype] = {
                ...latestReading[subtype],
                value2: null,
                unit2: null,
                connected: false
            };
            broadcast(subtype);
            activePort[subtype] = null;
            activeParser[subtype] = null;
        });

        sp.on('error', (err) => {
            console.error(`${label} weight machine serial error:`, err.message);
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
            // It does NOT guarantee the machine is sending valid data — check
            // latestReading[subtype].timestamp / isReceivingData(subtype) if you need that distinction.
            latestReading[subtype] = {
                value: null,
                value2: null,
                unit: null,
                unit2: null,
                raw: null,
                timestamp: null,
                connected: true
            };
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
    // Send the current reading for BOTH scales immediately to any newly connected client
    io.on('connection', (socket) => {
        SUBTYPES.forEach(subtype => socket.emit(SOCKET_EVENT[subtype], latestReading[subtype]));
    });
}

function isConnected(subtype) {
    return !!(activePort[subtype] && activePort[subtype].isOpen);
}

module.exports = {
    connect, disconnect, disconnectAndWait, getLatest, init, isConnected, isReceivingData, parseWeightLine,
    forceClosePortPath, registerCloser, unregisterCloser,
};