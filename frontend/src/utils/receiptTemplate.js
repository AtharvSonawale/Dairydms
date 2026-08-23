// src/utils/receiptTemplate.js
import api from "../api/axios";

const KEY = "receiptTemplateConfig";

export const DEFAULT_RECEIPT_TEMPLATE = {
    showTopSymbol: true,
    topSymbolText: "श्री",
    topSymbolFontSize: 28,
    showAppName: true,
    appNameFontSize: 20,
    showCentreName: true,
    centreNameOverride: "",
    centreNameFontSize: 14,
    showTransactionId: true,
    transactionIdLabel: "Transaction ID",
    transactionIdFontSize: 11,
    showDateTime: true,
    dateTimeFontSize: 13,
    showSellerCode: true,
    sellerNameFontSize: 13,
    sellerCodeFontSize: 11,
    tableHeaderFontSize: 11,
    tableBodyFontSize: 12.5,
    grandTotalFontSize: 15,
    footerText: "Thank you for your business",
    footerFontSize: 11,
    showGst: true,
    gstText: "GST: 27AABCQ1234D1ZP",
    showSignatory: true,
    signatoryText: "Authorized Signatory",
    signatoryFontSize: 12,
};

// Synchronous — used inside printReceipt()/printProductReceipt() where we
// can't await a network call.
export const getReceiptTemplate = () => {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return { ...DEFAULT_RECEIPT_TEMPLATE, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULT_RECEIPT_TEMPLATE;
};

const cacheReceiptTemplate = (config) => {
    localStorage.setItem(KEY, JSON.stringify(config));
};

// Pulls the centre's saved template on app/Settings load.
export const fetchReceiptTemplate = async () => {
    try {
        const { data } = await api.get("/settings/receipt-template");
        const config = { ...DEFAULT_RECEIPT_TEMPLATE, ...data };
        cacheReceiptTemplate(config);
        return config;
    } catch {
        return getReceiptTemplate();
    }
};

// Admin-only save.
export const saveReceiptTemplate = async (config) => {
    cacheReceiptTemplate(config); // instant local reflect
    const { data } = await api.post("/settings/receipt-template", { config });
    cacheReceiptTemplate(data.config);
    return data.config;
};