// src/utils/printSettings.js
import api from "../api/axios";

const KEY = "receiptPrintSettings";

export const DEFAULT_PRINT_SETTINGS = {
    printerType: "thermal",   // "thermal" | "a4"
    paperWidthMm: 80,         // common thermal widths: 58 or 80
    autoPrint: true,          // auto-open print dialog right after a sale is recorded
};

// Synchronous — used by printReceipt() and anything that needs an
// instant read without waiting on a network call.
export const getPrintSettings = () => {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_PRINT_SETTINGS;
};

// Synchronous local cache write only (no server call).
export const cachePrintSettings = (settings) => {
    localStorage.setItem(KEY, JSON.stringify(settings));
};

// Pulls the centre's saved print settings from the server and refreshes
// the local cache. Call this on app start / Settings page load so every
// device at the centre stays in sync with what the admin configured.
export const fetchPrintSettings = async () => {
    try {
        const { data } = await api.get("/settings/print");
        const settings = {
            printerType: data.printerType || DEFAULT_PRINT_SETTINGS.printerType,
            paperWidthMm: data.paperWidthMm || DEFAULT_PRINT_SETTINGS.paperWidthMm,
            autoPrint: data.autoPrint === undefined ? DEFAULT_PRINT_SETTINGS.autoPrint : !!data.autoPrint,
        };
        cachePrintSettings(settings);
        return settings;
    } catch {
        return getPrintSettings();
    }
};

// Saves to the server (admin-only) and updates the local cache immediately.
export const savePrintSettings = async (settings) => {
    cachePrintSettings(settings); // instant local reflect, even if request is slow
    const { data } = await api.post("/settings/print", settings);
    const saved = {
        printerType: data.printerType,
        paperWidthMm: data.paperWidthMm,
        autoPrint: data.autoPrint === undefined ? DEFAULT_PRINT_SETTINGS.autoPrint : !!data.autoPrint,
    };
    cachePrintSettings(saved);
    return saved;
};