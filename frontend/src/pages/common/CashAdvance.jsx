import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Wallet, Save, Sun, Moon, User, AlertTriangle, BadgeCheck,
    RefreshCw, X, TrendingUp, TrendingDown, Hash, Banknote,
    FileText, ChevronDown, FileDown,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
    d ? new Date(String(d).split("T")[0] + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmt = (v) => parseFloat(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const EMPTY_FORM = {
    seller_id: "",
    type: "given",
    amount: "",
    remarks: "",
};

// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1.5 shrink-0 self-end">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                {icon}{label}
            </span>
            {children}
        </div>
    );
}

function TinyInput({ className = "", style = {}, ...props }) {
    return (
        <input
            {...props}
            style={{ minWidth: 0, ...style }}
            className={`border border-gray-200 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function TypeToggle({ value, onChange, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {[
                { val: "given", label: t('cashAdvance.advanceGiven'), active: "bg-emerald-500 text-white" },
                { val: "received", label: t('cashAdvance.received'), active: "bg-blue-500 text-white" },
            ].map(({ val, label, active }) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {val === "given" ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                    {label}
                </button>
            ))}
        </div>
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CashAdvance() {
    const { t } = useTranslation();
    const [form, setForm] = useState(EMPTY_FORM);
    const [entries, setEntries] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [sellerSearch, setSellerSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(today());
    const [flash, setFlash] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchName, setSearchName] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);
    const [balance, setBalance] = useState(null);
    const [loadingBal, setLoadingBal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
    const [deletingEntryId, setDeletingEntryId] = useState(null);
    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerFrom, setRegisterFrom] = useState(today());
    const [registerTo, setRegisterTo] = useState(today());
    const [registerData, setRegisterData] = useState(null);
    const [loadingRegister, setLoadingRegister] = useState(false);

    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();
    const isAdmin = user?.role === "admin";
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        return { from: new Date(y, m, 1).toISOString().split("T")[0], to: new Date(y, m + 1, 0).toISOString().split("T")[0] };
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        setPdfReady(false);
        let newFrom = fromDate, newTo = toDate;
        if (mode === "daily") { newFrom = selectedDate; newTo = selectedDate; }
        else if (mode === "weekly") { const r = getWeekRange(selectedDate); newFrom = r.from; newTo = r.to; }
        else if (mode === "monthly") { const r = getMonthRange(selectedDate); newFrom = r.from; newTo = r.to; }
        setFromDate(newFrom);
        setToDate(newTo);
        if (mode !== "daily" && mode !== "custom") fetchRangeEntries(newFrom, newTo);
    };

    const fetchRangeEntries = async (overrideFrom, overrideTo) => {
        const f = overrideFrom || fromDate;
        const t2 = overrideTo || toDate;
        setLoadingRange(true);
        try {
            const url = f === t2
                ? `/cash-advance?date=${f}`
                : `/cash-advance?from=${f}&to=${t2}`;
            const { data } = await api.get(url);
            setRangeEntries(data);
            setPdfReady(true);
        } catch {
            showFlash("error", t('cashAdvance.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
    };

    const fetchSellerRegister = async () => {
        if (!form.seller_id) return;
        setLoadingRegister(true);
        try {
            const { data } = await api.get(
                `/cash-advance/register/${form.seller_id}?from=${registerFrom}&to=${registerTo}`
            );
            setRegisterData(data);
        } catch {
            showFlash("error", t('cashAdvance.registerLoadError'));
        } finally {
            setLoadingRegister(false);
        }
    };

    const handleSellerPassbookPDF = () => {
        if (!selectedSeller) {
            showFlash("error", t('cashAdvance.selectSellerError'));
            return;
        }

        const win = window.open("", "_blank", "width=1100,height=850");
        if (!win) return;

        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

        const sellerEntries = [...entries]
            .filter(e => String(e.seller_id) === String(selectedSeller.seller_id))
            .sort((a, b) =>
                new Date(a.transaction_date) - new Date(b.transaction_date) ||
                new Date(a.created_at) - new Date(b.created_at)
            );

        const byDate = [];
        for (const e of sellerEntries) {
            let group = byDate.find(g => g.date === e.transaction_date);
            if (!group) {
                group = { date: e.transaction_date, given: [], received: [], depositBalance: e.deposit_balance };
                byDate.push(group);
            }
            if (e.type === "given") group.given.push({ amount: parseFloat(e.amount), remarks: e.remarks });
            else group.received.push({ amount: parseFloat(e.amount), remarks: e.remarks });
            group.depositBalance = e.deposit_balance;
        }

        let runningBalance = 0;
        const rows = byDate.map(g => {
            const prevBalance = runningBalance;
            const givenTotal = g.given.reduce((a, x) => a + x.amount, 0);
            const receivedTotal = g.received.reduce((a, x) => a + x.amount, 0);
            runningBalance = Math.max(0, prevBalance + givenTotal - receivedTotal);

            const advanceText = g.given.length
                ? g.given.map(x => x.remarks ? `₹${x.amount.toFixed(2)} (${x.remarks})` : `₹${x.amount.toFixed(2)}`).join(" + ")
                : "—";

            const depositVal = parseFloat(g.depositBalance || 0);

            return `
        <tr>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;font-family:monospace;white-space:nowrap">${fmtD(g.date)}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right">${prevBalance > 0 ? `₹${prevBalance.toFixed(2)}` : "—"}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px">${advanceText}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right">${receivedTotal > 0 ? `₹${receivedTotal.toFixed(2)}` : "—"}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right;font-weight:700">₹${runningBalance.toFixed(2)}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right">₹${depositVal.toFixed(2)}</td>
        </tr>`;
        }).join("");

        win.document.write(`<!DOCTYPE html><html><head>
    <title>${selectedSeller.name} — ${t('cashAdvance.pdfTitle')}</title>
    <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 16px; background: #fff; }
        table { border-collapse: collapse; width: 100%; }
        @media print {
            @page { margin: 10mm; size: A4 portrait; }
            body { padding: 0; }
        }
        @media screen {
            body { max-width: 190mm; margin: 0 auto; }
        }
    </style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;border-bottom:2px solid #000;padding-bottom:8px">
    <div style="font-size:13px;font-weight:bold;color:#000">
        ${t('cashAdvance.colName')} : <span style="font-weight:normal;border-bottom:1px solid #000;padding:0 8px">${selectedSeller.name}</span>
    </div>
    <div style="font-size:13px;font-weight:bold;color:#000">
        ${t('cashAdvance.colNumber')} : ${selectedSeller.seller_code || selectedSeller.seller_id}
    </div>
</div>
<table>
    <thead>
        <tr style="background:#000;color:#fff">
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:left">${t('cashAdvance.colHeaderDate')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderPrevBalance')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:left">${t('cashAdvance.colHeaderAdvance')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderDeposit')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderClosing')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderDepositBal')}</th>
        </tr>
    </thead>
    <tbody>
        ${rows}
    </tbody>
</table>
<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#444">
    <span>${t('cashAdvance.pdfFooter')}</span>
    <span>${t('cashAdvance.pdfSignatory')}</span>
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body></html>`);
        win.document.close();
    };

    const handlePrintSellerRegister = () => {
        if (!selectedSeller || !registerData) return;

        const win = window.open("", "_blank", "width=1100,height=850");
        if (!win) return;

        const fmtD = (d) => d ? new Date(String(d).split("T")[0] + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

        const events = [];
        (registerData.cash_advance || []).forEach(e => events.push({
            date: e.transaction_date, created_at: e.created_at,
            kind: e.type === "given" ? "advance" : "received",
            amount: parseFloat(e.amount), remarks: e.remarks,
        }));
        (registerData.product_sales || []).forEach(e => events.push({
            date: e.transaction_date, created_at: e.created_at,
            kind: "purchase",
            amount: parseFloat(e.total_amount), remarks: e.remarks || "Product",
        }));
        (registerData.deposits || []).forEach(e => events.push({
            date: e.transaction_date, created_at: e.created_at,
            kind: "deposit",
            amount: parseFloat(e.amount), depositType: e.type,
            runningBalance: e.running_balance != null ? parseFloat(e.running_balance) : null,
        }));

        events.sort((a, b) =>
            new Date(a.date) - new Date(b.date) ||
            new Date(a.created_at) - new Date(b.created_at)
        );

        const byDate = [];
        for (const ev of events) {
            let g = byDate.find(x => x.date === ev.date);
            if (!g) { g = { date: ev.date, advance: [], received: [], purchase: [], deposit: [] }; byDate.push(g); }
            if (ev.kind === "advance") g.advance.push(ev);
            else if (ev.kind === "received") g.received.push(ev);
            else if (ev.kind === "purchase") g.purchase.push(ev);
            else g.deposit.push(ev);
        }

        let runningBalance = parseFloat(registerData.opening_balance || 0);
        let depositBalance = parseFloat(registerData.opening_deposit_balance || 0);

        const rows = byDate.map(g => {
            const prevBalance = runningBalance;
            const advanceTotal = g.advance.reduce((a, x) => a + x.amount, 0);
            const purchaseTotal = g.purchase.reduce((a, x) => a + x.amount, 0);
            const receivedTotal = g.received.reduce((a, x) => a + x.amount, 0);

            runningBalance = Math.max(0, prevBalance + advanceTotal - receivedTotal - purchaseTotal);

            if (g.deposit.length) {
                const last = g.deposit[g.deposit.length - 1];
                if (last.runningBalance != null) {
                    depositBalance = last.runningBalance;
                } else {
                    depositBalance += g.deposit.reduce((a, x) => a + (x.depositType === "credit" ? x.amount : -x.amount), 0);
                }
            }

            const advanceParts = [
                ...g.advance.map(x => x.remarks ? `₹${x.amount.toFixed(2)} (${x.remarks})` : `₹${x.amount.toFixed(2)}`),
                ...g.purchase.map(x => `₹${x.amount.toFixed(2)} (${x.remarks})`),
            ];
            const advanceText = advanceParts.length ? advanceParts.join(" + ") : "—";

            return `
        <tr>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;font-family:monospace;white-space:nowrap">${fmtD(g.date)}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right">${prevBalance > 0 ? `₹${prevBalance.toFixed(2)}` : "—"}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px">${advanceText}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right">${receivedTotal > 0 ? `₹${receivedTotal.toFixed(2)}` : "—"}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right;font-weight:700">₹${runningBalance.toFixed(2)}</td>
            <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right">₹${depositBalance.toFixed(2)}</td>
        </tr>`;
        }).join("");

        win.document.write(`<!DOCTYPE html><html><head>
<title>${selectedSeller.name} — ${t('cashAdvance.registerTitle')}</title>
    <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 16px; background: #fff; }
        table { border-collapse: collapse; width: 100%; }
        @media print {
            @page { margin: 10mm; size: A4 portrait; }
            body { padding: 0; }
        }
        @media screen {
            body { max-width: 190mm; margin: 0 auto; }
        }
    </style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;border-bottom:2px solid #000;padding-bottom:8px">
    <div style="font-size:13px;font-weight:bold;color:#000">
        ${t('cashAdvance.colName')} : <span style="font-weight:normal;border-bottom:1px solid #000;padding:0 8px">${selectedSeller.name}</span>
    </div>
    <div style="font-size:13px;font-weight:bold;color:#000">
        ${t('cashAdvance.colNumber')} : ${selectedSeller.seller_code || selectedSeller.seller_id}
    </div>
</div>
<table>
    <thead>
        <tr style="background:#000;color:#fff">
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:left">${t('cashAdvance.colHeaderDate')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderPrevBalance')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:left">${t('cashAdvance.colHeaderAdvance')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderDeposit')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderClosing')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:11px;text-align:right">${t('cashAdvance.colHeaderDepositBal')}</th>
        </tr>
    </thead>
    <tbody>
        ${rows}
    </tbody>
</table>
<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#444">
    <span>${t('cashAdvance.pdfFooter')}</span>
    <span>${t('cashAdvance.pdfSignatory')}</span>
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body></html>`);
        win.document.close();
    };

    const handleDownloadPDF = () => {
        const baseData = rangeMode === "daily" ? entries : (pdfReady ? rangeEntries : entries);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const fmtD = (d) => d ? new Date(String(d).split("T")[0] + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        const fmtT = (d) => d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
        const modeLabel = rangeMode === "daily" ? t('cashAdvance.pdfDaily')
            : rangeMode === "weekly" ? t('cashAdvance.pdfWeekly')
                : rangeMode === "monthly" ? t('cashAdvance.pdfMonthly')
                    : t('cashAdvance.pdfCustom');
        const periodLabel = fromDate === toDate ? fmtD(fromDate) : `${fmtD(fromDate)} ${t('cashAdvance.pdfTo')} ${fmtD(toDate)}`;

        const totalG = baseData.filter(e => e.type === "given").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
        const totalR = baseData.filter(e => e.type === "received").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
        const uniqueSellersCount = [...new Set(baseData.map(e => e.seller_id))].length;

        const rows = [...baseData].map((r, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#f2f2f2"}">
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;color:#000;font-family:monospace;white-space:nowrap">
            ${fmtD(r.transaction_date)}
        </td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:10px;color:#000;font-family:monospace">
            ${r.seller_code || "—"}
        </td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;font-weight:600;color:#000">
            ${r.seller_name || `ID:${r.seller_id}`}
        </td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;color:#000">
            ${r.remarks || "—"}
        </td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:right;font-weight:700;color:#000">
            ₹${parseFloat(r.amount).toFixed(2)}
        </td>
        <td style="padding:6px 10px;border:1px solid #999;font-size:11px;text-align:center">
            <span style="padding:2px 10px;border-radius:999px;font-size:10px;font-weight:700;
                background:${r.type === "given" ? "#e0e0e0" : "#c8c8c8"};
                color:#000;border:1px solid #666">
                ${r.type === "given" ? t('cashAdvance.self') : t('cashAdvance.other')}
            </span>
        </td>
    </tr>
`).join("");

        win.document.write(`<!DOCTYPE html><html><head>
    <title>${t('cashAdvance.pdfTitle')} — ${periodLabel}</title>
    <style>
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 16px; background: #fff; }
        table { border-collapse: collapse; width: 100%; }
        @media print {
            @page { margin: 10mm; size: A4 portrait; }
            body { padding: 0; }
        }
        @media screen {
            body { max-width: 190mm; margin: 0 auto; }
        }
    </style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
    <div>
        <div style="font-size:18px;font-weight:bold;color:#000">${t('cashAdvance.pdfTitle')}</div>
        <div style="font-size:11px;color:#333;margin-top:3px">${modeLabel} ${t('cashAdvance.pdfReport')} · ${periodLabel}</div>
        <div style="font-size:10px;color:#555;margin-top:2px">${t('cashAdvance.pdfGenerated')}: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
    </div>
    <div style="display:flex;gap:10px">
        <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
            <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashAdvance.pdfEntries')}</div>
            <div style="font-size:16px;font-weight:700;color:#000">${baseData.length}</div>
        </div>
        <div style="background:#e8e8e8;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
            <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashAdvance.pdfSellers')}</div>
            <div style="font-size:16px;font-weight:700;color:#000">${uniqueSellersCount}</div>
        </div>
        <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
            <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashAdvance.pdfTotalGiven')}</div>
            <div style="font-size:16px;font-weight:700;color:#000">₹${totalG.toFixed(2)}</div>
        </div>
        <div style="background:#e8e8e8;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
            <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashAdvance.pdfTotalReceived')}</div>
            <div style="font-size:16px;font-weight:700;color:#000">₹${totalR.toFixed(2)}</div>
        </div>
    </div>
</div>
<table>
    <thead>
        <tr style="background:#000;color:#fff">
            <th style="padding:8px 10px;border:1px solid #444;font-size:10px;text-align:left;min-width:100px">${t('cashAdvance.pdfDate')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:10px;text-align:left;min-width:80px">${t('cashAdvance.sellerId')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:10px;text-align:left;min-width:150px">${t('cashAdvance.sellerName')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:10px;text-align:left;min-width:150px">${t('cashAdvance.details')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:10px;text-align:right;min-width:90px">${t('cashAdvance.amount')}</th>
            <th style="padding:8px 10px;border:1px solid #444;font-size:10px;text-align:center;min-width:100px">${t('cashAdvance.receiveType')}</th>
        </tr>
    </thead>
    <tbody>
        ${rows}
        <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000">
            <td colspan="3" style="padding:8px 10px;border:1px solid #999;font-size:10px;font-weight:700;color:#000">
                ${t('cashAdvance.pdfGrandTotal')} — ${baseData.length} ${t('cashAdvance.pdfEntries')} · ${uniqueSellersCount} ${t('cashAdvance.seller')}${uniqueSellersCount !== 1 ? "s" : ""}
            </td>
            <td style="padding:8px 10px;border:1px solid #999;font-size:10px"></td>
            <td style="padding:8px 10px;border:1px solid #666;background:#d0d0d0;font-size:11px;text-align:right;font-weight:700;color:#000">
                <div>↓ ₹${totalG.toFixed(2)}</div>
                <div>↑ ₹${totalR.toFixed(2)}</div>
            </td>
            <td style="padding:8px 10px;border:1px solid #999;font-size:10px"></td>
        </tr>
    </tbody>
</table>
<div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#444">
    <span>${t('cashAdvance.pdfFooter')}</span>
    <span>${t('cashAdvance.pdfSignatory')}</span>
</div>
<script>window.onload = () => { window.print(); };<\/script>
</body></html>`);
        win.document.close();
    };

    // fetch sellers
    const fetchSellers = async () => {
        try {
            const { data } = await api.get("/sellers");
            setSellers(data);
        } catch { }
    };

    // fetch entries
    const fetchEntries = async (date) => {
        setLoading(true);
        try {
            const params = form.seller_id
                ? `/cash-advance?seller_id=${form.seller_id}`
                : `/cash-advance?date=${date}`;
            const { data } = await api.get(params);
            setEntries(data);
        } catch {
            showFlash("error", t('cashAdvance.loadError'));
        } finally {
            setLoading(false);
        }
    };

    // fetch running balance
    const fetchBalance = async (sellerId) => {
        if (!sellerId) { setBalance(null); return; }
        setLoadingBal(true);
        try {
            const { data } = await api.get(`/cash-advance/previous/${sellerId}`);
            setBalance(data);
        } catch {
            setBalance({ total_given: 0, total_received: 0, net_balance: 0, recent: [] });
        } finally {
            setLoadingBal(false);
        }
    };

    useEffect(() => { fetchSellers(); }, []);

    useEffect(() => {
        fetchEntries(selectedDate);
        setCurrentPage(1);
        setSearchName("");
    }, [selectedDate]);

    // seller selection
    const handleSellerSelect = (seller) => {
        setForm(p => ({ ...p, seller_id: String(seller.seller_id) }));
        setSellerSearch(seller.name);
        setDropdownOpen(false);
        fetchBalance(seller.seller_id);
        fetchEntries(selectedDate);
        if (seller.advance_enabled === 0) set("type", "received");
    };

    const clearSeller = () => {
        setForm(p => ({ ...p, seller_id: "" }));
        setSellerSearch("");
        setBalance(null);
        fetchEntries(selectedDate);
    };

    // save
    const handleSave = async () => {
        if (!form.seller_id) { showFlash("error", t('cashAdvance.selectSellerError')); return; }
        if (!form.amount || parseFloat(form.amount) <= 0) { showFlash("error", t('cashAdvance.amountError')); return; }
        if (saving) return;
        setSaving(true);
        try {
            await api.post("/cash-advance", {
                seller_id: Number(form.seller_id),
                type: form.type,
                amount: parseFloat(form.amount),
                transaction_date: selectedDate,
                remarks: form.remarks.trim() || null,
            });
            showFlash("success", form.type === "given" ? t('cashAdvance.advanceGivenSuccess') : t('cashAdvance.receivedSuccess'));
            await fetchEntries(selectedDate);
            await fetchBalance(form.seller_id);
            setForm(p => ({ ...p, amount: "", remarks: "" }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cashAdvance.saveError'));
        } finally {
            setSaving(false);
        }
    };

    // edit (admin only)
    const handleEdit = (entry) => {
        setEditingEntry(entry);
        const found = sellers.find(s => String(s.seller_id) === String(entry.seller_id));
        setSellerSearch(found?.name || "");
        setForm({
            seller_id: String(entry.seller_id),
            type: entry.type,
            amount: String(entry.amount),
            remarks: entry.remarks || "",
        });
        fetchBalance(entry.seller_id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleUpdate = async () => {
        if (!form.amount || parseFloat(form.amount) <= 0) { showFlash("error", t('cashAdvance.amountError')); return; }
        if (saving) return;
        setSaving(true);
        try {
            await api.put(`/cash-advance/${editingEntry.id}`, {
                type: form.type,
                amount: parseFloat(form.amount),
                transaction_date: selectedDate,
                remarks: form.remarks.trim() || null,
            });
            showFlash("success", t('cashAdvance.updateSuccess'));
            await fetchEntries(selectedDate);
            await fetchBalance(form.seller_id);
            setEditingEntry(null);
            setForm(EMPTY_FORM);
            setSellerSearch("");
            setBalance(null);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cashAdvance.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setForm(EMPTY_FORM);
        setSellerSearch("");
        setBalance(null);
    };

    const handleDeleteEntry = async () => {
        if (!confirmDeleteEntry) return;
        const entryId = confirmDeleteEntry.id;
        setConfirmDeleteEntry(null);
        setDeletingEntryId(entryId);
        try {
            await api.delete(`/cash-advance/${entryId}`);
            await fetchEntries(selectedDate);
            if (rangeMode !== "daily") await fetchRangeEntries();
            showFlash("success", t('cashAdvance.deleteSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Delete failed.");
        } finally {
            setDeletingEntryId(null);
        }
    };

    // filtered seller dropdown
    const filteredSellers = (() => {
        const sorted = [...sellers].sort((a, b) => a.name.localeCompare(b.name));
        if (!sellerSearch.trim()) return sorted.slice(0, 5);
        return sorted.filter(s =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            String(s.seller_id) === sellerSearch.trim() ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase())
        ).slice(0, 5);
    })();

    const selectedSeller = sellers.find(s => String(s.seller_id) === String(form.seller_id));

    // totals
    const activeData = rangeMode === "daily" ? entries : (pdfReady ? rangeEntries : entries);
    const totalGiven = activeData.filter(e => e.type === "given").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const totalReceived = activeData.filter(e => e.type === "received").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const filteredEntries = searchName.trim()
        ? activeData.filter(e => (e.seller_name || "").toLowerCase().includes(searchName.toLowerCase()))
        : activeData;
    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const COLS = [
        t('cashAdvance.colSeller'), t('cashAdvance.colCode'), t('cashAdvance.colType'),
        t('cashAdvance.colAmount'), t('cashAdvance.colRemarks'), t('cashAdvance.colDate'),
        t('cashAdvance.colTime'), ...(isAdmin ? [t('cashAdvance.colEdit'), ""] : []),
    ];
    const GRID = isAdmin
        ? "1.4fr 80px 110px 110px 1fr 100px 80px 70px 60px"
        : "1.4fr 80px 110px 110px 1fr 100px 80px";

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('cash_advance', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Wallet size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('cashAdvance.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('cashAdvance.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cashAdvance.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") { setFromDate(d); setToDate(d); }
                                    else if (rangeMode === "weekly") { const r = getWeekRange(d); setFromDate(r.from); setToDate(r.to); fetchRangeEntries(r.from, r.to); }
                                    else if (rangeMode === "monthly") { const r = getMonthRange(d); setFromDate(r.from); setToDate(r.to); fetchRangeEntries(r.from, r.to); }
                                }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cashAdvance.downloadPDF')}</span>

                            <div className="flex flex-col gap-2">

                                {/* Row 1: Range mode toggle + date label */}
                                <div className="flex items-center gap-1 flex-wrap">
                                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                        {[{ v: "daily", l: t('cashAdvance.day') }, { v: "weekly", l: t('cashAdvance.week') }, { v: "monthly", l: t('cashAdvance.month') }, { v: "custom", l: t('cashAdvance.custom') }].map(({ v, l }) => (
                                            <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                                className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>

                                    {rangeMode !== "custom" && (
                                        <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap">
                                            {fromDate === toDate
                                                ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                                : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                        </span>
                                    )}
                                </div>

                                {/* Row 2: Custom date inputs (only when custom) */}
                                {rangeMode === "custom" && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                        <input type="date" value={fromDate}
                                            onChange={e => { setFromDate(e.target.value); setPdfReady(false); }}
                                            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs shrink-0">→</span>
                                        <input type="date" value={toDate}
                                            onChange={e => {
                                                setToDate(e.target.value);
                                                setPdfReady(false);
                                                setTimeout(() => fetchRangeEntries(fromDate, e.target.value), 0);
                                            }}
                                            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {/* Row 3: Action buttons */}
                                <div className="flex gap-1.5">
                                    {rangeMode === "daily" ? (
                                        <button onClick={handleDownloadPDF} disabled={entries.length === 0}
                                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                            <FileDown size={13} /> PDF
                                        </button>
                                    ) : (
                                        <button onClick={handleDownloadPDF} disabled={!pdfReady || loadingRange}
                                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                            {loadingRange
                                                ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /></svg>
                                                : <FileDown size={13} />}
                                            PDF
                                        </button>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { label: rangeMode === "daily" ? t('cashAdvance.entriesToday') : t('cashAdvance.entriesInRange'), value: activeData.length, icon: <Wallet size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('cashAdvance.totalGiven'), value: `₹${fmt(totalGiven)}`, icon: <TrendingDown size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                        { label: t('cashAdvance.totalReceived'), value: `₹${fmt(totalReceived)}`, icon: <TrendingUp size={14} />, color: "text-violet-600 bg-violet-50 border-violet-100" },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                            <div className="shrink-0">{icon}</div>
                            <div>
                                <p className="text-xs text-gray-400 leading-none">{label}</p>
                                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Entry Form */}
                {can('cash_advance', 'C') && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                                {editingEntry ? t('cashAdvance.editEntry') : t('cashAdvance.newTransaction')}
                            </p>
                            {editingEntry && (
                                <button onClick={handleCancelEdit}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded-lg hover:bg-gray-100">
                                    <X size={12} /> {t('cashAdvance.cancelEdit')}
                                </button>
                            )}
                        </div>

                        {editingEntry && (
                            <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                                ✏ {t('cashAdvance.editingEntryFor')} <strong>{sellers.find(s => String(s.seller_id) === String(editingEntry.seller_id))?.name}</strong> · {editingEntry.type === "given" ? t('cashAdvance.given') : t('cashAdvance.received')} · {fmtDate(editingEntry.transaction_date)}
                            </div>
                        )}

                        <div className="flex items-start gap-3 flex-wrap">

                            {/* Seller */}
                            <Field label={t('cashAdvance.seller')} icon={<User size={12} />}>
                                <div className="relative" style={{ width: "160px" }}>
                                    <TinyInput
                                        value={sellerSearch}
                                        onFocus={() => { setDropdownOpen(true); setHighlightedIdx(-1); }}
                                        onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSellerSearch(val);
                                            setHighlightedIdx(-1);
                                            setDropdownOpen(true);
                                            if (!val) { set("seller_id", ""); setBalance(null); return; }
                                            const exact = sellers.find(s =>
                                                String(s.seller_id) === val.trim() ||
                                                (s.seller_code || "").toLowerCase() === val.trim().toLowerCase()
                                            );
                                            if (exact) { handleSellerSelect(exact); }
                                        }}
                                        onKeyDown={(e) => {
                                            if (!dropdownOpen || filteredSellers.length === 0) return;
                                            if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, filteredSellers.length - 1)); }
                                            else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)); }
                                            else if (e.key === "Enter") {
                                                e.preventDefault();
                                                const sel = highlightedIdx >= 0 ? filteredSellers[highlightedIdx] : filteredSellers[0];
                                                if (sel) handleSellerSelect(sel);
                                            } else if (e.key === "Escape") setDropdownOpen(false);
                                        }}
                                        disabled={!!editingEntry}
                                        placeholder={t('cashAdvance.searchPlaceholder')}
                                        className="pr-7"
                                        style={{ width: "160px" }}
                                    />
                                    {dropdownOpen && !form.seller_id && filteredSellers.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                {sellerSearch.trim() ? `${filteredSellers.length} ${filteredSellers.length !== 1 ? t('cashAdvance.matchesPlural') : t('cashAdvance.matches')}` : t('cashAdvance.sellersAZ')}
                                            </p>
                                            {filteredSellers.map((s, idx) => (
                                                <button key={s.seller_id} type="button"
                                                    onMouseEnter={() => setHighlightedIdx(idx)}
                                                    onClick={() => handleSellerSelect(s)}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition
                                                    ${highlightedIdx === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                                    ${highlightedIdx === idx ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                                                        {s.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-xs">{s.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-mono">{s.seller_code}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedSeller && !editingEntry && (
                                        <button type="button" onClick={clearSeller}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {selectedSeller && (
                                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                        {selectedSeller.seller_code} · {selectedSeller.seller_type || "—"}
                                        {selectedSeller.advance_enabled === 0 && (
                                            <span className="ml-1 text-rose-500 font-semibold">· {t('cashAdvance.advanceDisabled')}</span>
                                        )}
                                    </p>
                                )}
                            </Field>

                            {/* Type */}
                            <Field label={t('cashAdvance.transactionType')} icon={<TrendingUp size={12} />}>
                                <TypeToggle value={form.type} onChange={(v) => {
                                    if (v === "given" && selectedSeller?.advance_enabled === 0) return;
                                    set("type", v);
                                }} t={t} />
                            </Field>

                            {/* Amount */}
                            <Field label={t('cashAdvance.amount')} icon={<Banknote size={12} />}>
                                <TinyInput
                                    value={form.amount}
                                    onChange={(e) => { if (parseFloat(e.target.value) >= 0 || e.target.value === "") set("amount", e.target.value); }}
                                    placeholder="0.00" type="number" step="0.01"
                                    className={form.type === "given"
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 focus:ring-emerald-300"
                                        : "bg-blue-50 border-blue-200 text-blue-800 focus:ring-blue-300"}
                                    style={{ width: "120px" }}
                                />
                            </Field>

                            {/* Remarks */}
                            <Field label={t('cashAdvance.remarks')} icon={<FileText size={12} />}>
                                <TinyInput
                                    value={form.remarks}
                                    onChange={(e) => set("remarks", e.target.value)}
                                    placeholder={t('cashAdvance.remarksPlaceholder')}
                                    style={{ width: "200px" }}
                                />
                            </Field>
                        </div>

                        {/* Balance Panel */}
                        {selectedSeller && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                        {selectedSeller.name}'s {t('cashAdvance.runningBalance')}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRegisterFrom(selectedDate);
                                            setRegisterTo(selectedDate);
                                            setRegisterData(null);
                                            setShowRegisterModal(true);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition">
                                        <FileDown size={12} /> {t('cashAdvance.printRegister')}
                                    </button>
                                </div>
                                {loadingBal ? (
                                    <div className="h-12 flex items-center">
                                        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                                    </div>
                                ) : balance && (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex gap-3 flex-wrap">
                                            {[
                                                { label: t('cashAdvance.totalGiven'), value: balance.total_given, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                                                { label: t('cashAdvance.totalReceived'), value: balance.total_received, color: "text-blue-700 bg-blue-50 border-blue-100" },
                                                {
                                                    label: t('cashAdvance.netBalance'), value: balance.net_balance,
                                                    color: parseFloat(balance.net_balance) > 0
                                                        ? "text-amber-700 bg-amber-50 border-amber-100"
                                                        : "text-emerald-600 bg-emerald-50 border-emerald-100"
                                                },
                                            ].map(({ label, value, color }) => (
                                                <div key={label} className={`px-4 py-2.5 rounded-xl border flex flex-col gap-0.5 ${color}`}>
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                                    <p className="text-base font-bold leading-tight">₹{fmt(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {balance.recent?.length > 0 && (
                                            <div className="flex-1 bg-gray-50 rounded-xl border border-gray-100 px-3 py-2 min-w-0">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t('cashAdvance.recentHistory')}</p>
                                                <div className="flex flex-col gap-1">
                                                    {balance.recent.map((r) => (
                                                        <div key={r.id} className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.type === "given" ? "bg-emerald-400" : "bg-blue-400"}`} />
                                                                <span className={`font-semibold ${r.type === "given" ? "text-emerald-700" : "text-blue-700"}`}>
                                                                    {r.type === "given" ? "+" : "-"}₹{fmt(r.amount)}
                                                                </span>
                                                                {r.remarks && <span className="text-gray-400 truncate max-w-[100px]">{r.remarks}</span>}
                                                            </div>
                                                            <span className="text-gray-400 font-mono text-[10px] shrink-0 ml-2">{fmtDate(r.transaction_date)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Save button */}
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                {entries.length} {entries.length === 1 ? t('cashAdvance.transaction') : t('cashAdvance.transactions')} {t('cashAdvance.on')}{" "}
                                {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                            <button type="button" onClick={editingEntry ? handleUpdate : handleSave}
                                disabled={saving || !form.seller_id}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                                ${saving || !form.seller_id
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : editingEntry
                                            ? "bg-amber-600 hover:bg-amber-700 active:scale-95"
                                            : form.type === "given"
                                                ? "bg-emerald-500 hover:bg-emerald-600 active:scale-95"
                                                : "bg-blue-500 hover:bg-blue-600 active:scale-95"}`}>
                                <Save size={15} />
                                {saving
                                    ? (editingEntry ? t('cashAdvance.updating') : t('cashAdvance.saving'))
                                    : editingEntry
                                        ? t('cashAdvance.updateEntry')
                                        : form.type === "given" ? t('cashAdvance.recordAdvanceGiven') : t('cashAdvance.recordPaymentReceived')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Entries Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <input
                            type="text" value={searchName}
                            onChange={e => { setSearchName(e.target.value); setCurrentPage(1); }}
                            placeholder={t('cashAdvance.filterPlaceholder')}
                            className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-300
                                focus:outline-none focus:ring-2 focus:ring-black transition w-52"
                        />
                        {searchName && (
                            <button onClick={() => { setSearchName(""); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-600">
                                <X size={13} />
                            </button>
                        )}
                        <span className="ml-auto text-xs text-gray-400">
                            {filteredEntries.length} {filteredEntries.length === 1 ? t('cashAdvance.entry') : t('cashAdvance.entries')}
                            {searchName && ` ${t('cashAdvance.matching')} "${searchName}"`}
                        </span>
                    </div>

                    {/* Table Header */}
                    <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map(label => (
                            <div key={label} className="px-3 py-3 flex items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Wallet size={32} />
                            <p className="text-sm">
                                {rangeMode === "daily"
                                    ? t('cashAdvance.noTransactionsDaily')
                                    : pdfReady
                                        ? t('cashAdvance.noEntriesRange')
                                        : t('cashAdvance.fetchToLoad')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {paginatedEntries.map((r, i) => (
                                    <div key={r.id || i}
                                        className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}>

                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs shrink-0">
                                                    {(r.seller_name || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-gray-800 font-medium text-xs truncate">{r.seller_name || `ID:${r.seller_id}`}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <span className="font-mono text-xs text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">
                                                {r.seller_code || "—"}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
                                                ${r.type === "given"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                    : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                                                {r.type === "given" ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                                                {r.type === "given" ? t('cashAdvance.given') : t('cashAdvance.received')}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`font-mono font-bold text-sm ${r.type === "given" ? "text-emerald-600" : "text-blue-600"}`}>
                                                ₹{fmt(r.amount)}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-gray-500 text-xs">
                                            {r.remarks || <span className="text-gray-300">—</span>}
                                        </TableCell>

                                        <TableCell className="text-gray-500 font-mono text-xs">
                                            {fmtDate(r.transaction_date)}
                                        </TableCell>

                                        <TableCell className="text-gray-400 font-mono text-xs">
                                            {fmtTime(r.created_at)}
                                        </TableCell>

                                        {isAdmin && (
                                            <TableCell>
                                                <button onClick={() => handleEdit(r)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition border
                                                        ${editingEntry?.id === r.id
                                                            ? "bg-amber-100 text-amber-700 border-amber-200"
                                                            : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"}`}>
                                                    ✏ {editingEntry?.id === r.id ? t('cashAdvance.editing') : t('cashAdvance.edit')}
                                                </button>
                                            </TableCell>
                                        )}
                                        {isAdmin && (
                                            <TableCell>
                                                <button
                                                    onClick={() => setConfirmDeleteEntry({ id: r.id, label: `${r.seller_name} — ₹${fmt(r.amount)} (${r.type})` })}
                                                    disabled={deletingEntryId === r.id}
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 transition disabled:opacity-40"
                                                    title="Delete">
                                                    {deletingEntryId === r.id
                                                        ? <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0" /></svg>
                                                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                                    }
                                                </button>
                                            </TableCell>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredEntries.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('cashAdvance.prev')}
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .reduce((acc, p, idx, arr) => {
                                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, i) =>
                                        p === '...'
                                            ? <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">…</span>
                                            : <button key={p} onClick={() => setCurrentPage(p)}
                                                className={`w-7 h-7 rounded-lg text-xs font-semibold transition border
                                                    ${currentPage === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                                                {p}
                                            </button>
                                    )}
                            </div>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('cashAdvance.next')}
                            </button>
                            <span className="text-xs text-gray-400 ml-1">
                                {filteredEntries.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredEntries.length)}`} {t('cashAdvance.of')} {filteredEntries.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('cashAdvance.rowsPerPage')}</span>
                            <input type="number" min={1} max={filteredEntries.length || 1} value={pageSize}
                                onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>
                    </div>
                )}

                {/* Totals Footer */}
                {activeData.length > 0 && (
                    <div className="bg-white rounded-b-2xl border-t-2 border-gray-100 overflow-x-auto">
                        <div className="grid bg-gray-50/80 min-w-max" style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                {activeData.length} {t('cashAdvance.transactions')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold border-r border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-emerald-600">↓ ₹{fmt(totalGiven)}</span>
                                    <span className="text-blue-600">↑ ₹{fmt(totalReceived)}</span>
                                </div>
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5" />
                            {isAdmin && <div className="px-3 py-2.5" />}
                            {isAdmin && <div className="px-3 py-2.5" />}
                        </div>
                    </div>
                )}

            </main>

            {/* Seller Register Modal */}
            {showRegisterModal && selectedSeller && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[380px] flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-gray-800 font-semibold text-base">
                                {t('cashAdvance.registerModalTitle')} — {selectedSeller.name}
                            </h2>
                            <button
                                onClick={() => { setShowRegisterModal(false); setRegisterData(null); }}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cashAdvance.registerFrom')}</label>
                                <input type="date" value={registerFrom}
                                    onChange={(e) => { setRegisterFrom(e.target.value); setRegisterData(null); }}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cashAdvance.registerTo')}</label>
                                <input type="date" value={registerTo}
                                    onChange={(e) => { setRegisterTo(e.target.value); setRegisterData(null); }}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={fetchSellerRegister} disabled={loadingRegister}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                {loadingRegister && <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
                                {loadingRegister ? t('cashAdvance.registerLoading') : t('cashAdvance.registerLoadData')}
                            </button>
                            <button onClick={handlePrintSellerRegister} disabled={!registerData}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-40 transition flex items-center justify-center gap-2">
                                <FileDown size={14} /> {t('cashAdvance.registerPrintPDF')}
                            </button>
                        </div>

                        {registerData && (
                            <p className="text-xs text-gray-400 text-center">
                                {t('cashAdvance.registerSummary', {
                                    advances: registerData.cash_advance.length,
                                    purchases: registerData.product_sales.length,
                                    deposits: registerData.deposits.length
                                })}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Entry Modal */}
            {confirmDeleteEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[340px] flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.5">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('cashAdvance.confirmDelete')}</h2>
                                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                                    {t('cashAdvance.deleteWarning')}
                                    <span className="text-gray-700 font-semibold"> {confirmDeleteEntry.label}</span>.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDeleteEntry(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                {t('cashAdvance.cancel')}
                            </button>
                            <button
                                onClick={handleDeleteEntry}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition">
                                {t('cashAdvance.yesDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}