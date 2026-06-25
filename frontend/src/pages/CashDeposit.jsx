import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    PiggyBank, Save, User, AlertTriangle, BadgeCheck,
    RefreshCw, X, TrendingUp, TrendingDown, Banknote,
    FileText, Milk, Hash, ChevronDown, FileDown,
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmt = (v) => parseFloat(v || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const EMPTY_FORM = {
    seller_id: "",
    type: "credit",
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
                { val: "credit", label: t('cashDeposit.creditAdd'), active: "bg-emerald-500 text-white" },
                { val: "debit", label: t('cashDeposit.debitWithdraw'), active: "bg-rose-500 text-white" },
            ].map(({ val, label, active }) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {val === "credit" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
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
export default function CashDeposit() {
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
    const [sellerDepositRate, setSellerDepositRate] = useState(null);
    const [milkSummary, setMilkSummary] = useState(null);
    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);

    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();
    const isAdmin = user?.role === "admin";
    const [confirmDeleteEntry, setConfirmDeleteEntry] = useState(null);
    const [deletingEntryId, setDeletingEntryId] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [editSaving, setEditSaving] = useState(false);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startDepositTour = () => {
    const driverObj = driver({
        showProgress: true,
        allowClose: true,
        steps: [
            {
                element: '[data-tour="deposit-header-actions"]',
                popover: { title: t('cashDeposit.dateLabel'), description: 'Select a date to view or record deposit transactions. Switch between daily, weekly, monthly, or custom range — then download a PDF report.' },
            },
            {
                element: '[data-tour="deposit-stats"]',
                popover: { title: t('cashDeposit.entriesToday'), description: 'Live summary of total entries, total credited, total debited, and net balance for the selected period or seller.' },
            },
            {
                element: '[data-tour="deposit-form"]',
                popover: { title: t('cashDeposit.newDepositEntry'), description: 'Search for a seller, choose Credit or Debit, enter the amount and optional remarks. The seller\'s running deposit balance is shown below once selected.' },
            },
            {
                element: '[data-tour="deposit-table"]',
                popover: { title: t('cashDeposit.colSeller'), description: 'All deposit entries for the selected period. Filter by seller name, paginate through entries, and (if admin) edit or delete any record. Select a seller to see their full history with running balance.' },
            },
        ],
    });
    driverObj.drive();
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
        if (mode !== "daily") fetchRangeEntriesFor(newFrom, newTo);
    };

    const fetchRangeEntriesFor = async (from, to) => {
        setLoadingRange(true);
        try {
            const url = from === to
                ? `/deposits?date=${from}`
                : `/deposits?from=${from}&to=${to}`;
            const { data } = await api.get(url);
            const rows = Array.isArray(data) ? data : (data.ledger || []);
            setRangeEntries(rows);
            setPdfReady(true);
        } catch {
            showFlash("error", t('cashDeposit.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
    };

    const handleDownloadPDF = () => {
        const baseData = rangeMode === "daily" ? entries : (pdfReady ? rangeEntries : entries);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        const modeLabel = rangeMode === "daily" ? t('cashDeposit.pdfDaily')
            : rangeMode === "weekly" ? t('cashDeposit.pdfWeekly')
                : rangeMode === "monthly" ? t('cashDeposit.pdfMonthly')
                    : t('cashDeposit.pdfCustom');
        const periodLabel = fromDate === toDate ? fmtD(fromDate) : `${fmtD(fromDate)} ${t('cashDeposit.pdfTo')} ${fmtD(toDate)}`;

        const totalC = baseData.filter(e => e.type === "credit").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
        const totalD = baseData.filter(e => e.type === "debit").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
        const uniqueSellersCount = [...new Set(baseData.map(e => e.seller_id))].length;

        const rows = [...baseData].map((r, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f2f2f2"}">
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000;font-family:monospace">${fmtD(r.transaction_date)}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000;font-family:monospace">${r.seller_code || "—"}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;font-weight:600;color:#000">${r.seller_name || r.name || `ID:${r.seller_id}`}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000">${r.remarks || "—"}</td>
            <td style="padding:4px 6px;border:1px solid #666;background:#e0e0e0;font-size:9px;text-align:right;font-weight:700;color:#000">${r.type === "credit" ? "+" : "−"}₹${parseFloat(r.amount).toFixed(2)}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:center">
                <span style="padding:1px 6px;border-radius:999px;font-size:8px;font-weight:700;
                    background:${r.type === "credit" ? "#e0e0e0" : "#c8c8c8"};
                    color:#000;border:1px solid #666">
                    ${r.type === "credit" ? t('cashDeposit.cr') : t('cashDeposit.dr')}
                </span>
            </td>
        </tr>
    `).join("");

        win.document.write(`<!DOCTYPE html><html><head>
        <title>${t('cashDeposit.pdfTitle')} — ${periodLabel}</title>
        <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 16px; background: #fff; }
            table { border-collapse: collapse; width: 100%; }
            @media print {
                @page { margin: 8mm; size: A4 portrait; }
                body { padding: 0; font-size: 9px; }
            }
            @media screen {
                body { max-width: 175mm; margin: 0 auto; }
            }
        </style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
        <div>
            <div style="font-size:18px;font-weight:bold;color:#000">${t('cashDeposit.pdfTitle')}</div>
            <div style="font-size:11px;color:#333;margin-top:3px">${modeLabel} ${t('cashDeposit.pdfReport')} · ${periodLabel}</div>
            <div style="font-size:10px;color:#555;margin-top:2px">${t('cashDeposit.pdfGenerated')}: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
        </div>
        <div style="display:flex;gap:10px">
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashDeposit.pdfEntries')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${baseData.length}</div>
            </div>
            <div style="background:#e8e8e8;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashDeposit.pdfSellers')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${uniqueSellersCount}</div>
            </div>
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashDeposit.pdfTotalCredited')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">₹${totalC.toFixed(2)}</div>
            </div>
            <div style="background:#e8e8e8;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('cashDeposit.pdfTotalDebited')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">₹${totalD.toFixed(2)}</div>
            </div>
        </div>
    </div>
    <table>
        <thead>
            <tr style="background:#000;color:#fff">
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:16%">${t('cashDeposit.pdfDate')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:12%">${t('cashDeposit.customerId')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:24%">${t('cashDeposit.customerName')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:24%">${t('cashDeposit.details')}</th>
                <th style="padding:5px 6px;border:1px solid #333;background:#333;font-size:9px;text-align:right;width:14%">${t('cashDeposit.amount')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:center;width:10%">${t('cashDeposit.crDr')}</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000">
                <td colspan="3" style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:700;color:#000">
                    ${t('cashDeposit.pdfGrandTotal')} — ${baseData.length} ${t('cashDeposit.pdfEntries')} · ${uniqueSellersCount} ${t('cashDeposit.seller')}${uniqueSellersCount !== 1 ? "s" : ""}
                </td>
                <td style="padding:5px 6px;border:1px solid #999;font-size:9px"></td>
                <td style="padding:5px 6px;border:1px solid #666;background:#d0d0d0;font-size:9px;text-align:right;font-weight:700;color:#000">
                    <div>+ ₹${totalC.toFixed(2)}</div>
                    <div>− ₹${totalD.toFixed(2)}</div>
                </td>
                <td style="padding:5px 6px;border:1px solid #999;font-size:9px"></td>
            </tr>
        </tbody>
    </table>
    <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#444">
        <span>${t('cashDeposit.pdfFooter')}</span>
        <span>${t('cashDeposit.pdfSignatory')}</span>
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
        } catch (err) {
            console.error("Failed to fetch sellers:", err);
        }
    };

    // fetch entries
    const fetchEntries = async (date, sellerId = null) => {
        setLoading(true);
        try {
            const params = sellerId
                ? `/deposits?seller_id=${sellerId}`
                : `/deposits?date=${date}`;
            const { data } = await api.get(params);
            if (Array.isArray(data)) {
                setEntries(data);
            } else {
                setEntries(data.ledger || []);
            }
        } catch {
            showFlash("error", t('cashDeposit.loadError'));
        } finally {
            setLoading(false);
        }
    };

    // fetch running balance
    const fetchBalance = async (sellerId) => {
        if (!sellerId) { setBalance(null); return; }
        setLoadingBal(true);
        try {
            const { data } = await api.get(`/deposits/balance/${sellerId}`);
            setBalance(data);
        } catch {
            setBalance({ total_credit: 0, total_debit: 0, net_balance: 0 });
        } finally {
            setLoadingBal(false);
        }
    };

    // fetch today's milk qty for the seller
    const fetchMilkSummary = async (sellerId, date) => {
        if (!sellerId) { setMilkSummary(null); return; }
        try {
            const { data } = await api.get(`/milk-entries?date=${date}`);
            const sellerEntries = data.filter(e => String(e.seller_id) === String(sellerId));
            const qty = sellerEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
            setMilkSummary({ qty, entries: sellerEntries.length });
        } catch {
            setMilkSummary(null);
        }
    };

    useEffect(() => { fetchSellers(); }, []);

    useEffect(() => {
        if (form.seller_id) {
            fetchEntries(selectedDate, form.seller_id);
            fetchMilkSummary(form.seller_id, selectedDate);
        } else {
            fetchEntries(selectedDate);
        }
        setCurrentPage(1);
        setSearchName("");
    }, [selectedDate]);

    // seller selection
    const handleSellerSelect = (seller) => {
        setForm(p => ({ ...p, seller_id: String(seller.seller_id) }));
        setSellerSearch(seller.name);
        setDropdownOpen(false);

        const depositRate = seller.deposit_enabled && seller.deposit_per_litre !== null && seller.deposit_per_litre !== undefined
            ? parseFloat(seller.deposit_per_litre)
            : null;

        setSellerDepositRate(depositRate);

        fetchBalance(seller.seller_id);
        fetchEntries(selectedDate, seller.seller_id);
        fetchMilkSummary(seller.seller_id, selectedDate);
    };

    const clearSeller = () => {
        setForm(p => ({ ...p, seller_id: "" }));
        setSellerSearch("");
        setBalance(null);
        setSellerDepositRate(null);
        setMilkSummary(null);
        fetchEntries(selectedDate);
    };

    // save
    const handleSave = async () => {
        if (!form.seller_id) { showFlash("error", t('cashDeposit.selectSellerError')); return; }
        if (!form.amount || parseFloat(form.amount) <= 0) { showFlash("error", t('cashDeposit.amountError')); return; }
        if (saving) return;
        setSaving(true);
        try {
            await api.post("/deposits", {
                seller_id: Number(form.seller_id),
                type: form.type,
                amount: parseFloat(form.amount),
                transaction_date: selectedDate,
                remarks: form.remarks.trim() || null,
            });
            showFlash("success", form.type === "credit" ? t('cashDeposit.creditSuccess') : t('cashDeposit.debitSuccess'));
            await fetchEntries(selectedDate, form.seller_id);
            await fetchBalance(form.seller_id);
            setForm(p => ({ ...p, amount: "", remarks: "" }));
        } catch (err) {
            showFlash("error", err.response?.data?.message || err.response?.data?.error || t('cashDeposit.saveError'));
        } finally {
            setSaving(false);
        }
    };

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
        fetchEntries(selectedDate, entry.seller_id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleUpdate = async () => {
        if (!form.amount || parseFloat(form.amount) <= 0) { showFlash("error", t('cashDeposit.amountError')); return; }
        if (editSaving) return;
        setEditSaving(true);
        try {
            await api.put(`/deposits/${editingEntry.id}`, {
                type: form.type,
                amount: parseFloat(form.amount),
                transaction_date: selectedDate,
                remarks: form.remarks.trim() || null,
            });
            showFlash("success", t('cashDeposit.updateSuccess') || "Entry updated.");
            await fetchEntries(selectedDate, form.seller_id || null);
            await fetchBalance(form.seller_id);
            if (rangeMode !== "daily") await fetchRangeEntriesFor(fromDate, toDate);
            setEditingEntry(null);
            setForm(EMPTY_FORM);
            setSellerSearch("");
            setBalance(null);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('cashDeposit.updateError') || "Update failed.");
        } finally {
            setEditSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setForm(EMPTY_FORM);
        setSellerSearch("");
        setBalance(null);
        setSellerDepositRate(null);
        setMilkSummary(null);
        fetchEntries(selectedDate);
    };

    const isFormReady = () =>
        !!form.seller_id && !!form.amount && parseFloat(form.amount) > 0;

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        // Let the seller-search dropdown handle its own Enter
        if (dropdownOpen) return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        const isBusy = editingEntry ? editSaving : saving;
        if (isBusy || !isFormReady()) return;
        editingEntry ? handleUpdate() : handleSave();
    };

    const handleDeleteEntry = async () => {
        if (!confirmDeleteEntry) return;
        const entryId = confirmDeleteEntry.id;
        setConfirmDeleteEntry(null);
        setDeletingEntryId(entryId);
        try {
            await api.delete(`/deposits/${entryId}`);
            await fetchEntries(selectedDate, form.seller_id || null);
            if (rangeMode !== "daily") await fetchRangeEntriesFor(fromDate, toDate);
            if (form.seller_id) await fetchBalance(form.seller_id);
            showFlash("success", t('cashDeposit.deleteSuccess') || "Entry deleted.");
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Delete failed.");
        } finally {
            setDeletingEntryId(null);
        }
    };

    // auto-fill amount
    const handleAutoFill = () => {
        if (milkSummary && sellerDepositRate) {
            const computed = (milkSummary.qty * sellerDepositRate).toFixed(2);
            set("amount", computed);
            set("type", "credit");
            set("remarks", `${t('cashDeposit.autoFillPrefix')}: ${milkSummary.qty.toFixed(2)}L × ₹${sellerDepositRate}/L`);
        }
    };

    // filtered seller dropdown
    const filteredSellers = (() => {
        const sorted = [...sellers].sort((a, b) => a.name.localeCompare(b.name));
        if (!sellerSearch.trim()) return sorted.slice(0, 5);
        const matched = sorted.filter(s =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            String(s.seller_id) === sellerSearch.trim() ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase())
        );
        return matched.slice(0, 5);
    })();

    const selectedSeller = sellers.find(s => String(s.seller_id) === String(form.seller_id));

    // active data, totals, filters, pagination
    const activeData = rangeMode === "daily" ? entries : (pdfReady ? rangeEntries : entries);
    const totalCredit = activeData.filter(e => e.type === "credit").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const totalDebit = activeData.filter(e => e.type === "debit").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const filteredEntries = searchName.trim()
        ? activeData.filter(e => (e.seller_name || e.name || "").toLowerCase().includes(searchName.toLowerCase()))
        : activeData;
    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const COLS = [
        t('cashDeposit.colSeller'), t('cashDeposit.colCode'), t('cashDeposit.colType'),
        t('cashDeposit.colAmount'), t('cashDeposit.colRemarks'), t('cashDeposit.colDate'),
        t('cashDeposit.colTime'),
        ...(form.seller_id ? [t('cashDeposit.colRunningBal')] : []),
        ...(isAdmin ? [t('cashDeposit.colEdit') || "Edit", ""] : []),
    ];
    const GRID = form.seller_id
        ? isAdmin ? "1.4fr 80px 110px 110px 1fr 100px 80px 110px 70px 60px" : "1.4fr 80px 110px 110px 1fr 100px 80px 110px"
        : isAdmin ? "1.4fr 80px 110px 110px 1fr 100px 80px 70px 60px" : "1.4fr 80px 110px 110px 1fr 100px 80px";
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
                            <PiggyBank size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('cashDeposit.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('cashDeposit.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap" data-tour="deposit-header-actions">
    <button
        onClick={startDepositTour}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition"
    >
        <BadgeCheck size={13} /> Take a Tour
    </button>
    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cashDeposit.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") { setFromDate(d); setToDate(d); }
                                    else if (rangeMode === "weekly") { const r = getWeekRange(d); setFromDate(r.from); setToDate(r.to); fetchRangeEntriesFor(r.from, r.to); }
                                    else if (rangeMode === "monthly") { const r = getMonthRange(d); setFromDate(r.from); setToDate(r.to); fetchRangeEntriesFor(r.from, r.to); }
                                }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('cashDeposit.downloadPDF')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[{ v: "daily", l: t('cashDeposit.day') }, { v: "weekly", l: t('cashDeposit.week') }, { v: "monthly", l: t('cashDeposit.month') }, { v: "custom", l: t('cashDeposit.custom') }].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPdfReady(false); fetchRangeEntriesFor(e.target.value, toDate); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPdfReady(false); fetchRangeEntriesFor(fromDate, e.target.value); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap hidden sm:inline">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </span>
                                )}

                                {loadingRange ? (
                                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold">
                                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /></svg>
                                        {t('dashboard.loading')}
                                    </div>
                                ) : (
                                    <button onClick={handleDownloadPDF} disabled={rangeMode === "daily" ? entries.length === 0 : !pdfReady}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                        <FileDown size={13} /> PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="deposit-stats">
                        {[
                        { label: rangeMode === "daily" ? t('cashDeposit.entriesToday') : t('cashDeposit.entriesInRange'), value: activeData.length, icon: <PiggyBank size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('cashDeposit.totalCredited'), value: `₹${fmt(totalCredit)}`, icon: <TrendingUp size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                        { label: t('cashDeposit.totalDebited'), value: `₹${fmt(totalDebit)}`, icon: <TrendingDown size={14} />, color: "text-rose-600 bg-rose-50 border-rose-100" },
                        {
                            label: balance ? t('cashDeposit.netBalance') : t('cashDeposit.netPage'),
                            value: balance ? `₹${fmt(balance.net_balance)}` : `₹${fmt(totalCredit - totalDebit)}`,
                            icon: <Banknote size={14} />,
                            color: "text-violet-600 bg-violet-50 border-violet-100"
                        },
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
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5" data-tour="deposit-form">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                                {editingEntry ? t('cashDeposit.editEntry') || "Edit Entry" : t('cashDeposit.newDepositEntry')}
                            </p>
                            {editingEntry && (
                                <button onClick={handleCancelEdit}
                                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded-lg hover:bg-gray-100">
                                    <X size={12} /> {t('cashDeposit.cancelEdit') || "Cancel Edit"}
                                </button>
                            )}
                        </div>
                        {editingEntry && (
                            <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                                ✏ Editing entry for <strong>{sellers.find(s => String(s.seller_id) === String(editingEntry.seller_id))?.name}</strong> · {editingEntry.type} · {fmtDate(editingEntry.transaction_date)}
                            </div>
                        )}

                        <div className="flex items-start gap-3 flex-wrap" onKeyDown={handleFormKeyDown}>

                            {/* Seller */}
                            <Field label={t('cashDeposit.seller')} icon={<User size={12} />}>
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
                                            if (!val) { set("seller_id", ""); setBalance(null); setSellerDepositRate(null); setMilkSummary(null); return; }
                                            const exact = sellers.find(s =>
                                                String(s.seller_id) === val.trim() ||
                                                (s.seller_code || "").toLowerCase() === val.trim().toLowerCase()
                                            );
                                            if (exact) handleSellerSelect(exact);
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
                                        placeholder={t('cashDeposit.searchPlaceholder')}
                                        className="pr-7"
                                        style={{ width: "160px" }}
                                    />
                                    {dropdownOpen && !form.seller_id && filteredSellers.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                {sellerSearch.trim() ? `${filteredSellers.length} ${filteredSellers.length !== 1 ? t('cashDeposit.matchesPlural') : t('cashDeposit.matches')}` : t('cashDeposit.sellersAZ')}
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
                                                        <p className="text-[10px] text-gray-400 font-mono">
                                                            {s.seller_code}
                                                            {s.deposit_enabled && s.deposit_per_litre
                                                                ? <span className="ml-1 text-emerald-500">· ₹{parseFloat(s.deposit_per_litre).toFixed(2)}/L</span>
                                                                : <span className="ml-1 text-gray-300">· {t('cashDeposit.noDeposit')}</span>}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {selectedSeller && (
                                        <button type="button" onClick={clearSeller}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {selectedSeller && (
                                    <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                        {selectedSeller.seller_code} · {selectedSeller.seller_type || "—"}
                                        {sellerDepositRate
                                            ? <span className="ml-1 font-bold text-blue-600">· ₹{sellerDepositRate}/L {t('cashDeposit.deposit')}</span>
                                            : <span className="ml-1 text-gray-400">· {t('cashDeposit.noDepositRate')}</span>}
                                    </p>
                                )}
                            </Field>

                            {/* Type */}
                            <Field label={t('cashDeposit.transactionType')} icon={<ChevronDown size={12} />}>
                                <TypeToggle value={form.type} onChange={(v) => set("type", v)} t={t} />
                            </Field>

                            {/* Amount */}
                            <Field label={t('cashDeposit.amount')} icon={<Banknote size={12} />}>
                                <TinyInput
                                    value={form.amount}
                                    onChange={(e) => { if (parseFloat(e.target.value) >= 0 || e.target.value === "") set("amount", e.target.value); }}
                                    placeholder="0.00" type="number" step="0.01"
                                    className={form.type === "credit"
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 focus:ring-emerald-300"
                                        : "bg-rose-50 border-rose-200 text-rose-800 focus:ring-rose-300"}
                                    style={{ width: "120px" }}
                                />
                            </Field>

                            {/* Remarks */}
                            <Field label={t('cashDeposit.remarks')} icon={<FileText size={12} />}>
                                <TinyInput
                                    value={form.remarks}
                                    onChange={(e) => set("remarks", e.target.value)}
                                    placeholder={t('cashDeposit.remarksPlaceholder')}
                                    style={{ width: "200px" }}
                                />
                            </Field>
                        </div>

                        {/* Balance + Deposit Rate Panel */}
                        {selectedSeller && (
                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                        {selectedSeller.name}'s {t('cashDeposit.depositAccount')}
                                    </p>
                                    {sellerDepositRate && (
                                        <span className="text-[10px] px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 font-semibold">
                                            {t('cashDeposit.rate')}: ₹{sellerDepositRate}/{t('cashDeposit.litre')}
                                        </span>
                                    )}
                                </div>

                                {loadingBal ? (
                                    <div className="h-12 flex items-center">
                                        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                                    </div>
                                ) : balance && (
                                    <div className="flex gap-3 flex-wrap">
                                        {[
                                            { label: t('cashDeposit.totalCredited'), value: balance.total_credit, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                                            { label: t('cashDeposit.totalDebited'), value: balance.total_debit, color: "text-rose-700 bg-rose-50 border-rose-100" },
                                            {
                                                label: t('cashDeposit.netBalanceHeld'),
                                                value: balance.net_balance,
                                                color: parseFloat(balance.net_balance) >= 0
                                                    ? "text-blue-700 bg-blue-50 border-blue-100"
                                                    : "text-amber-700 bg-amber-50 border-amber-100"
                                            },
                                        ].map(({ label, value, color }) => (
                                            <div key={label} className={`px-4 py-2.5 rounded-xl border flex flex-col gap-0.5 ${color}`}>
                                                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                                <p className="text-base font-bold leading-tight">₹{fmt(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Deposit rate info box */}
                                {!sellerDepositRate && (
                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs">
                                        <AlertTriangle size={13} className="shrink-0" />
                                        <span>
                                            {t('cashDeposit.noDepositRateWarning')}
                                            <strong>{t('cashDeposit.sellerRegisterEdit')}</strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Save button */}
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                {entries.length} {entries.length === 1 ? t('cashDeposit.transaction') : t('cashDeposit.transactions')}
                                {form.seller_id ? ` ${t('cashDeposit.for')} ${selectedSeller?.name || t('cashDeposit.seller')}` : ` ${t('cashDeposit.on')} ${new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                            </p>
                            <button type="button" onClick={editingEntry ? handleUpdate : handleSave}
                                disabled={(editingEntry ? editSaving : saving) || !form.seller_id}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                                ${(editingEntry ? editSaving : saving) || !form.seller_id
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : editingEntry
                                            ? "bg-amber-600 hover:bg-amber-700 active:scale-95"
                                            : form.type === "credit"
                                                ? "bg-emerald-500 hover:bg-emerald-600 active:scale-95"
                                                : "bg-rose-500 hover:bg-rose-600 active:scale-95"}`}>
                                <Save size={15} />
                                {editingEntry
                                    ? (editSaving ? t('cashDeposit.saving') || "Saving..." : t('cashDeposit.updateEntry') || "Update Entry")
                                    : saving
                                        ? t('cashDeposit.saving')
                                        : form.type === "credit" ? t('cashDeposit.creditDeposit') : t('cashDeposit.debitDeposit')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Entries Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="deposit-table">

                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <input
                            type="text" value={searchName}
                            onChange={e => { setSearchName(e.target.value); setCurrentPage(1); }}
                            placeholder={t('cashDeposit.filterPlaceholder')}
                            className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-300
                                focus:outline-none focus:ring-2 focus:ring-black transition w-52"
                        />
                        {searchName && (
                            <button onClick={() => { setSearchName(""); setCurrentPage(1); }} className="text-gray-400 hover:text-gray-600">
                                <X size={13} />
                            </button>
                        )}
                        {form.seller_id && selectedSeller && (
                            <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                                {t('cashDeposit.showingFullHistory')} {selectedSeller.name}
                            </span>
                        )}
                        <span className="ml-auto text-xs text-gray-400">
                            {filteredEntries.length} {filteredEntries.length === 1 ? t('cashDeposit.entry') : t('cashDeposit.entries')}
                            {searchName && ` ${t('cashDeposit.matching')} "${searchName}"`}
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
                            <PiggyBank size={32} />
                            <p className="text-sm">
                                {form.seller_id
                                    ? `${t('cashDeposit.noDepositTransactions')} ${selectedSeller?.name}`
                                    : rangeMode === "daily"
                                        ? t('cashDeposit.noDepositEntriesDaily')
                                        : t('cashDeposit.noEntriesRange')}
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
                                                    {(r.seller_name || r.name || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-gray-800 font-medium text-xs truncate">
                                                    {r.seller_name || r.name || `ID:${r.seller_id}`}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <span className="font-mono text-xs text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">
                                                {r.seller_code || "—"}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
                                                ${r.type === "credit"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                    : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                                                {r.type === "credit" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                {r.type === "credit" ? t('cashDeposit.credit') : t('cashDeposit.debit')}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`font-mono font-bold text-sm ${r.type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                                                {r.type === "credit" ? "+" : "−"}₹{fmt(r.amount)}
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

                                        {/* Running balance */}
                                        {form.seller_id && (
                                            <TableCell>
                                                <span className={`font-mono font-semibold text-xs px-2 py-0.5 rounded-lg
                                                    ${parseFloat(r.running_balance || 0) >= 0
                                                        ? "bg-blue-50 text-blue-700"
                                                        : "bg-amber-50 text-amber-700"}`}>
                                                    ₹{fmt(r.running_balance || 0)}
                                                </span>
                                            </TableCell>
                                        )}
                                        {isAdmin && (
                                            <TableCell>
                                                <button onClick={() => handleEdit(r)}
                                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition border
                                                        ${editingEntry?.id === r.id
                                                            ? "bg-amber-100 text-amber-700 border-amber-200"
                                                            : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"}`}>
                                                    ✏ {editingEntry?.id === r.id ? t('cashDeposit.editing') || "Editing" : t('cashDeposit.edit') || "Edit"}
                                                </button>
                                            </TableCell>
                                        )}
                                        {isAdmin && (
                                            <TableCell>
                                                <button
                                                    onClick={() => setConfirmDeleteEntry({
                                                        id: r.id,
                                                        label: `${r.seller_name || r.name} — ${r.type === "credit" ? "+" : "−"}₹${fmt(r.amount)}`
                                                    })}
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
                                {t('cashDeposit.prev')}
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
                                {t('cashDeposit.next')}
                            </button>
                            <span className="text-xs text-gray-400 ml-1">
                                {filteredEntries.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredEntries.length)}`} {t('cashDeposit.of')} {filteredEntries.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('cashDeposit.rowsPerPage')}</span>
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
                                {activeData.length} {t('cashDeposit.transactions')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold border-r border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-emerald-600">+ ₹{fmt(totalCredit)}</span>
                                    <span className="text-rose-600">− ₹{fmt(totalDebit)}</span>
                                </div>
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-blue-700">
                                {t('cashDeposit.net')}: ₹{fmt(totalCredit - totalDebit)}
                            </div>
                            {form.seller_id && <div className="px-3 py-2.5" />}
                            {isAdmin && <div className="px-3 py-2.5" />}
                            {isAdmin && <div className="px-3 py-2.5" />}
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• <strong className="text-emerald-600">{t('cashDeposit.credit')}</strong> = {t('cashDeposit.creditDesc')}</span>
                    <span>• <strong className="text-rose-500">{t('cashDeposit.debit')}</strong> = {t('cashDeposit.debitDesc')}</span>
                    <span>• {t('cashDeposit.selectSellerTip')}</span>
                    <span>• {t('cashDeposit.autoFillTip')}</span>
                </div>

            </main>
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
                                <h2 className="text-gray-800 font-semibold text-base">Delete Entry?</h2>
                                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                                    This will permanently delete the entry for
                                    <span className="text-gray-700 font-semibold"> {confirmDeleteEntry.label}</span>.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmDeleteEntry(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteEntry}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition">
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}