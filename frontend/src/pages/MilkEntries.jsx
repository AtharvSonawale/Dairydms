import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Droplets, Save, Sun, Moon, FlaskConical, Waves,
    User, AlertTriangle, BadgeCheck, X,
    TrendingUp, Hash, ChevronDown, Milk, Trash2
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { useAppConfig } from '../context/AppConfigContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
// ── helpers ───────────────────────────────────────────────────
const getShiftByTime = () => {
    const h = new Date().getHours();
    return h >= 5 && h < 14 ? "morning" : "evening";
};

const today = () => new Date().toISOString().split("T")[0];

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const waterRisk = (v) => parseFloat(v) > 5;

const EMPTY_FORM = {
    seller_id: "",
    seller_type: "Utpadak",
    shift: getShiftByTime(),
    milk_type: "cow",
    quantity: "",
    fat: "",
    snf: "",
    water: "",
    rate_applied: "",
};

const FAT_MIN = 2.5, FAT_MAX = 9.0;
const SNF_MIN = 6.5, SNF_MAX = 10.5;

const isValidFat = (v) => parseFloat(v) >= FAT_MIN && parseFloat(v) <= FAT_MAX;
const isValidSnf = (v) => parseFloat(v) >= SNF_MIN && parseFloat(v) <= SNF_MAX;

// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children, ...rest }) {
    return (
        <div className="flex flex-col gap-1.5 shrink-0 self-end" {...rest}>
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

function ShiftToggle({ value, onChange, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {["morning", "evening"].map((s) => (
                <button key={s} type="button" onClick={() => onChange(s)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === s
                            ? s === "morning"
                                ? "bg-yellow-400 text-yellow-900"
                                : "bg-indigo-500 text-white"
                            : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {s === "morning" ? <Sun size={12} /> : <Moon size={12} />}
                    {s === "morning" ? t('milkEntry.morning') : t('milkEntry.evening')}
                </button>
            ))}
        </div>
    );
}

function MilkTypeToggle({ value, onChange, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {[
                { val: "cow", label: t('milkEntry.cow'), active: "bg-amber-400 text-amber-900" },
                { val: "buffalo", label: t('milkEntry.buffalo'), active: "bg-blue-500 text-white" },
            ].map(({ val, label, active }) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}

function SellerTypeToggle({ value, onChange }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {[
                { val: "Utpadak", active: "bg-emerald-500 text-white" },
                { val: "Gavali", active: "bg-orange-400 text-white" },
            ].map(({ val, active }) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {val}
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
export default function MilkEntry() {
    const { t } = useTranslation();
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [entries, setEntries] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [sellerSearch, setSellerSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(today());
    const [liveStock, setLiveStock] = useState({ cow: 0, buffalo: 0 });
    const [flash, setFlash] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchName, setSearchName] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);
    const [editingEntry, setEditingEntry] = useState(null);
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const { appName } = useAppConfig();
    const { can, loading: permLoading } = usePermission();
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const startMilkEntryTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="seller-field"]',
                    popover: { title: 'Select Seller', description: 'Search and pick the seller for this entry.' },
                },
                {
                    element: '[data-tour="shift-field"]',
                    popover: { title: 'Shift', description: 'Choose morning or evening shift.' },
                },
                {
                    element: '[data-tour="qty-field"]',
                    popover: { title: 'Quantity', description: 'Enter the quantity of milk collected, in liters.' },
                },
                {
                    element: '[data-tour="fat-field"]',
                    popover: { title: 'Fat %', description: 'Enter the fat percentage — rate auto-fills once valid.' },
                },
                {
                    element: '[data-tour="save-btn"]',
                    popover: { title: 'Save Entry', description: 'Click here to save the milk entry.' },
                },
                {
                    element: '[data-tour="entries-table"]',
                    popover: { title: 'Entries Table', description: 'All saved entries for the selected date appear here.' },
                },
            ],
        });
        driverObj.drive();
    };
    // Date range & PDF
    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);

    const [pageSize, setPageSize] = useState(5);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const amount =
        form.quantity && form.rate_applied
            ? (parseFloat(form.quantity || 0) * parseFloat(form.rate_applied || 0)).toFixed(2)
            : null;

    const fetchSellers = async () => {
        try {
            const { data } = await api.get("/sellers");
            setSellers(data);
        } catch { /* silent */ }
    };

    const totalSellers = sellers.length;
    const morningSellers = new Set(entries.filter(e => e.shift === "morning").map(e => e.seller_id));
    const eveningSellers = new Set(entries.filter(e => e.shift === "evening").map(e => e.seller_id));

    const remainingMorningSellers = totalSellers - morningSellers.size;
    const remainingEveningSellers = totalSellers - eveningSellers.size;

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return {
            from: mon.toISOString().split("T")[0],
            to: sun.toISOString().split("T")[0],
        };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        return {
            from: new Date(y, m, 1).toISOString().split("T")[0],
            to: new Date(y, m + 1, 0).toISOString().split("T")[0],
        };
    };

    const fetchEntries = async (from, to) => {
        setLoading(true);
        try {
            const url = from === to
                ? `/milk-entries?date=${from}`
                : `/milk-entries?from=${from}&to=${to}`;
            const { data } = await api.get(url);
            setEntries(data);
        } catch {
            showFlash("error", t('milkEntry.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const autoRateTimer = useRef(null);
    const fetchAutoRate = (fat, snf, milk_type) => {
        if (!fat || !snf || !milk_type) return;
        if (!isValidFat(fat) || !isValidSnf(snf)) return;
        clearTimeout(autoRateTimer.current);
        autoRateTimer.current = setTimeout(async () => {
            try {
                const { data } = await api.get(
                    `/rates/lookup?fat=${fat}&snf=${snf}&milk_type=${milk_type}&date=${selectedDate}`
                );
                if (data?.rate) {
                    set("rate_applied", data.rate);
                    showFlash("success", t('milkEntry.rateAutoFilled', { rate: data.rate }));
                }
            } catch { /* no match found, leave rate as-is */ }
        }, 500);
    };

    const fetchPremiumRate = async (seller_id, milk_type, date) => {
        if (!seller_id || !milk_type || !date) return;
        try {
            const { data } = await api.get(
                `/milk-entries/premium-rate?seller_id=${seller_id}&milk_type=${milk_type}&date=${date}`
            );
            if (data?.rate_per_liter) {
                set("rate_applied", data.rate_per_liter);
                showFlash("success", t('milkEntry.premiumAutoFilled', { rate: data.rate_per_liter }));
            }
        } catch { /* no premium rate, fall through to normal rate lookup */ }
    };

    const fetchLiveStock = async (date) => {
        try {
            const { data } = await api.get(`/stock/available?date=${date}`);
            setLiveStock({
                cow: parseFloat(data.collected?.cow || 0),
                buffalo: parseFloat(data.collected?.buffalo || 0),
            });
        } catch { /* silent */ }
    };

    useEffect(() => { fetchSellers(); }, []);

    useEffect(() => {
        fetchEntries(fromDate, toDate);
        fetchLiveStock(selectedDate);
        setCurrentPage(1);
        setSearchName("");
    }, [selectedDate, fromDate, toDate]);

    const handleSellerChange = (id) => {
        const found = sellers.find((s) => String(s.seller_id) === String(id));
        const newMilkType = (found?.milk_type && found.milk_type !== "mixed")
            ? found.milk_type
            : form.milk_type;
        setForm(p => ({
            ...p,
            seller_id: id,
            seller_type: found?.seller_type || p.seller_type,
            milk_type: newMilkType,
        }));
        fetchPremiumRate(id, newMilkType, selectedDate);
    };

    const handleSave = async () => {
        if (!form.seller_id) { showFlash("error", t('milkEntry.selectSeller')); return; }
        if (!form.quantity) { showFlash("error", t('milkEntry.qtyRequired')); return; }
        if (!form.fat) { showFlash("error", t('milkEntry.fatRequired')); return; }
        if (!form.snf) { showFlash("error", t('milkEntry.snfRequired')); return; }
        if (!form.rate_applied) { showFlash("error", t('milkEntry.rateRequired')); return; }
        if (!isValidFat(form.fat)) { showFlash("error", t('milkEntry.fatRange', { min: FAT_MIN, max: FAT_MAX })); return; }
        if (!isValidSnf(form.snf)) { showFlash("error", t('milkEntry.snfRange', { min: SNF_MIN, max: SNF_MAX })); return; }
        if (saving) return;

        setSaving(true);
        try {
            await api.post("/milk-entries", {
                seller_id: Number(form.seller_id),
                seller_type: form.seller_type,
                entry_date: selectedDate,
                shift: form.shift,
                milk_type: form.milk_type,
                quantity: Number(form.quantity),
                fat: Number(form.fat),
                snf: Number(form.snf),
                water: Number(form.water || 0),
                rate_applied: Number(form.rate_applied),
                total_amount: Number(amount),
            });
            await fetchEntries(selectedDate, selectedDate);
            await fetchLiveStock(selectedDate);
            showFlash("success", t('milkEntry.savedSuccess'));
            setForm({ ...EMPTY_FORM, shift: getShiftByTime() });
            setSellerSearch("");
        } catch (err) {
            const msg = err.response?.data?.error ||
                err.response?.data?.message ||
                t('milkEntry.saveError');
            showFlash("error", msg);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        const found = sellers.find(s => String(s.seller_id) === String(entry.seller_id));
        setSellerSearch(entry.seller_name || "");
        setForm({
            seller_id: String(entry.seller_id),
            seller_type: entry.seller_type || "Utpadak",
            shift: entry.shift,
            milk_type: entry.milk_type,
            quantity: String(entry.quantity),
            fat: String(entry.fat),
            snf: String(entry.snf),
            water: String(entry.water || ""),
            rate_applied: String(entry.rate_applied),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleUpdate = async () => {
        if (!form.quantity || !form.fat || !form.snf || !form.rate_applied) {
            showFlash("error", t('milkEntry.allFieldsRequired')); return;
        }
        if (saving) return;
        if (!isValidFat(form.fat)) { showFlash("error", t('milkEntry.fatRange', { min: FAT_MIN, max: FAT_MAX })); return; }
        if (!isValidSnf(form.snf)) { showFlash("error", t('milkEntry.snfRange', { min: SNF_MIN, max: SNF_MAX })); return; }
        setSaving(true);
        try {
            const computedAmount = (parseFloat(form.quantity) * parseFloat(form.rate_applied)).toFixed(2);
            await api.put(`/milk-entries/${editingEntry.entry_id}`, {
                shift: form.shift,
                milk_type: form.milk_type,
                seller_type: form.seller_type,
                quantity: Number(form.quantity),
                fat: Number(form.fat),
                snf: Number(form.snf),
                water: Number(form.water || 0),
                rate_applied: Number(form.rate_applied),
                total_amount: Number(computedAmount),
            });
            showFlash("success", t('milkEntry.updatedSuccess'));
            await fetchEntries(selectedDate, selectedDate);
            setEditingEntry(null);
            setForm({ ...EMPTY_FORM, shift: getShiftByTime() });
            setSellerSearch("");
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('milkEntry.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setForm({ ...EMPTY_FORM, shift: getShiftByTime() });
        setSellerSearch("");
    };

    const handleDelete = async (entryId) => {
        setEntryToDelete(entryId);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!entryToDelete) return;

        try {
            await api.delete(`/milk-entries/${entryToDelete}`);
            showFlash("success", t('milkEntry.deletedSuccess'));
            await fetchEntries(selectedDate, selectedDate);
            await fetchLiveStock(selectedDate);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('milkEntry.deleteError'));
        } finally {
            setDeleteConfirmOpen(false);
            setEntryToDelete(null);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirmOpen(false);
        setEntryToDelete(null);
    };

    const fetchRangeEntries = async (from = fromDate, to = toDate) => {
        setLoadingRange(true);
        try {
            const url = from === to
                ? `/milk-entries?date=${from}`
                : `/milk-entries?from=${from}&to=${to}`;
            const { data } = await api.get(url);
            setRangeEntries(data);
            setPdfReady(true);
        } catch {
            showFlash("error", t('milkEntry.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
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

    const handleDownloadPDF = () => {
        const data = rangeMode === "daily" ? entries : (pdfReady ? rangeEntries : entries);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const modeLabel = rangeMode === "daily" ? t('milkEntry.pdfDaily')
            : rangeMode === "weekly" ? t('milkEntry.pdfWeekly')
                : rangeMode === "monthly" ? t('milkEntry.pdfMonthly')
                    : t('milkEntry.pdfCustom');

        const fmtD = (d) => d
            ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";
        const periodLabel = fromDate === toDate
            ? fmtD(fromDate)
            : `${fmtD(fromDate)} ${t('milkEntry.pdfTo')} ${fmtD(toDate)}`;

        const totalCow = data.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const totalBuf = data.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const totalAmt = data.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);

        const grouped = {};
        data.forEach(e => {
            const d = (e.entry_date || "").split("T")[0];
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(e);
        });

        const isMultiDay = Object.keys(grouped).length > 1;
        const cell = "border:1px solid #bbb;padding:4px 5px;";

        let globalCounter = 0;

        const tableRows = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayEntries]) => {
                const dayCow = dayEntries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                const dayBuf = dayEntries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                const dayAmt = dayEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);

                const dayRows = dayEntries.map((r, i) => {
                    globalCounter++;
                    const isFirst = i === 0;
                    const dateCell = isMultiDay && isFirst
                        ? `<td rowspan="${dayEntries.length}" style="${cell}font-size:8px;font-weight:700;text-align:center;vertical-align:middle;background:#e8e8e8;white-space:nowrap;min-width:30px">
    ${new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
    </td>`
                        : "";

                    return `
<tr style="background:${i % 2 === 0 ? "#fff" : "#f4f4f4"}">
    ${isMultiDay ? (isFirst ? dateCell : "") : ""}
    <td style="${cell}font-size:8px;text-align:center;color:#555;font-family:monospace">${globalCounter}</td>
    <td style="${cell}font-size:8.5px;font-weight:600">${r.seller_name || `ID:${r.seller_id}`}</td>
    <td style="${cell}font-size:8px;font-family:monospace;text-align:center">${r.seller_code || "—"}</td>
    <td style="${cell}font-size:8px;text-align:center;font-weight:600">${r.shift === "morning" ? t('milkEntry.pdfShiftM') : t('milkEntry.pdfShiftE')}</td>
    <td style="${cell}font-size:8px;text-align:center;font-weight:600">${r.milk_type === "cow" ? t('milkEntry.pdfCowShort') : t('milkEntry.pdfBufShort')}</td>
    <td style="${cell}font-size:8.5px;text-align:right;font-weight:700">${parseFloat(r.quantity || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.fat || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.snf || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right${parseFloat(r.water) > 5 ? ";font-weight:700;text-decoration:underline" : ""}">
        ${parseFloat(r.water || 0).toFixed(2)}${parseFloat(r.water) > 5 ? "!" : ""}
    </td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.rate_applied || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right;font-weight:700;background:#e8e8e8">${parseFloat(r.total_amount || 0).toFixed(2)}</td>
</tr>`;
                }).join("");

                const subtotal = isMultiDay ? `
<tr style="background:#ddd;border-top:2px solid #000">
    <td colspan="5" style="${cell}font-size:8px;font-weight:700">
        ${fmtD(date)} — ${dayEntries.length} ${t('milkEntry.pdfEntries')} &nbsp;|&nbsp; ${t('milkEntry.pdfCow')} ${dayCow.toFixed(2)} L &nbsp;|&nbsp; ${t('milkEntry.pdfBuf')} ${dayBuf.toFixed(2)} L
    </td>
    <td style="${cell}font-size:8px;text-align:right;font-weight:700">${(dayCow + dayBuf).toFixed(2)}</td>
    <td colspan="4" style="${cell}font-size:8px"></td>
    <td style="${cell}font-size:8px;text-align:right;font-weight:700;background:#ccc">${dayAmt.toFixed(2)}</td>
</tr>` : "";

                return dayRows + subtotal;
            }).join("");

        win.document.write(`<!DOCTYPE html><html><head>
<title>${t('milkEntry.pdfMilkCollection')} — ${modeLabel} — ${periodLabel}</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; background: #fff; margin: 0; padding: 12px; }
    table { border-collapse: collapse; width: 100%; border: 2px solid #000; }
    @media print {
        @page { margin: 6mm; size: A4 portrait; }
        body { padding: 0; }
    }
    @media screen { body { max-width: 177mm; margin: 0 auto; } }
</style>
</head><body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px">
    <div>
        <div style="font-size:16px;font-weight:900;color:#000;letter-spacing:0.5px">${appName}</div>
        <div style="font-size:10px;font-weight:600;color:#000;margin-top:2px">${t('milkEntry.pdfMilkCollection')} — ${modeLabel} · ${periodLabel}</div>
        <div style="font-size:8.5px;color:#555;margin-top:1px">${t('milkEntry.pdfGenerated')} ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:stretch">
        ${[
                { label: t('milkEntry.pdfCowMilk'), val: totalCow.toFixed(2) + " L" },
                { label: t('milkEntry.pdfBuffaloMilk'), val: totalBuf.toFixed(2) + " L" },
                { label: t('milkEntry.pdfTotalEntries'), val: data.length },
                { label: t('milkEntry.pdfTotalAmount'), val: "Rs. " + totalAmt.toFixed(2) },
            ].map(({ label, val }) =>
                `<div style="border:1.5px solid #000;padding:5px 10px;text-align:center;min-width:70px">
                <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#333">${label}</div>
                <div style="font-size:13px;font-weight:900;color:#000;margin-top:1px">${val}</div>
            </div>`
            ).join("")}
    </div>
</div>

<!-- Table -->
<table>
    <thead>
        <tr style="background:#000;color:#fff">
            ${isMultiDay ? `<th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:4%">${t('milkEntry.pdfDate')}</th>` : ""}
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:3%">${t('milkEntry.colNo')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:left;width:${isMultiDay ? "13" : "16"}%">${t('milkEntry.pdfSeller')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:6%">${t('milkEntry.pdfCode')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:5%">${t('milkEntry.pdfShift')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:5%">${t('milkEntry.pdfMilk')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:7%">${t('milkEntry.pdfQty')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfFat')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfSnf')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfWater')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:7%">${t('milkEntry.pdfRate')}</th>
            <th style="padding:4px 5px;border:1px solid #555;background:#222;font-size:8px;text-align:right;width:9%">${t('milkEntry.pdfAmountRs')}</th>
        </tr>
    </thead>
    <tbody>
        ${tableRows}
        <!-- Grand Total -->
        <tr style="background:#000;color:#fff;border-top:2px solid #000">
            <td colspan="${isMultiDay ? 6 : 5}" style="padding:5px 6px;border:1px solid #555;font-size:9px;font-weight:700">
                ${t('milkEntry.pdfGrandTotal')} — ${data.length} ${t('milkEntry.pdfEntries')} &nbsp;|&nbsp; ${t('milkEntry.pdfCow')} ${totalCow.toFixed(2)} L &nbsp;|&nbsp; ${t('milkEntry.pdfBuf')} ${totalBuf.toFixed(2)} L
            </td>
            <td style="padding:5px 6px;border:1px solid #555;font-size:9px;text-align:right;font-weight:700">
                ${(totalCow + totalBuf).toFixed(2)}
            </td>
            <td colspan="4" style="padding:5px 6px;border:1px solid #555;font-size:9px"></td>
            <td style="padding:5px 6px;border:1px solid #555;background:#333;font-size:9px;text-align:right;font-weight:900">
                Rs. ${totalAmt.toFixed(2)}
            </td>
        </tr>
    </tbody>
</table>

<div style="margin-top:16px;display:flex;justify-content:space-between;font-size:8px;color:#555;border-top:1px solid #ccc;padding-top:6px">
    <span>${t('milkEntry.pdfFooter')}</span>
    <span>${t('milkEntry.pdfSignatory')}</span>
</div>

<script>window.onload = () => { window.print(); };<\/script>
</body></html>`);
        win.document.close();
    };

    const filteredSellers = (() => {
        const sorted = [...sellers].sort((a, b) => a.name.localeCompare(b.name));
        if (!sellerSearch.trim()) return sorted.slice(0, 5);
        const matched = sorted.filter((s) =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            String(s.seller_id) === sellerSearch.trim() ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase())
        );
        return matched.slice(0, 5);
    })();

    const selectedSeller = sellers.find((s) => String(s.seller_id) === String(form.seller_id));

    const filteredEntries = searchName.trim()
        ? entries.filter(e => (e.seller_name || "").toLowerCase().includes(searchName.toLowerCase()))
        : entries;
    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const COLS = [
        t('milkEntry.colNo'), t('milkEntry.colSeller'), t('milkEntry.colCode'), t('milkEntry.colShift'), t('milkEntry.colMilk'),
        t('milkEntry.colQty'), t('milkEntry.colFat'), t('milkEntry.colSnf'), t('milkEntry.colWater'),
        t('milkEntry.colRate'), t('milkEntry.colAmount'), t('milkEntry.colTime'), t('milkEntry.colPremium'),
        ...(isAdmin ? [t('milkEntry.colActions')] : []),
    ];
    const GRID = isAdmin
        ? "40px 1.4fr 70px 100px 90px 72px 65px 65px 75px 80px 90px 75px 85px 120px"
        : "40px 1.4fr 70px 100px 90px 72px 65px 65px 75px 80px 90px 75px 85px";

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('milk_entry', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Droplets size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('milkEntry.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('milkEntry.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('milkEntry.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") { setFromDate(d); setToDate(d); }
                                    else if (rangeMode === "weekly") { const r = getWeekRange(d); setFromDate(r.from); setToDate(r.to); }
                                    else if (rangeMode === "monthly") { const r = getMonthRange(d); setFromDate(r.from); setToDate(r.to); }
                                }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        <button
                            type="button"
                            onClick={startMilkEntryTour}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition self-end"
                        >
                            <BadgeCheck size={13} /> {t('milkEntry.startTour') || 'Take a Tour'}
                        </button>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('milkEntry.downloadPDF')}</span>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[
                                        { v: "daily", l: t('milkEntry.day') },
                                        { v: "weekly", l: t('milkEntry.week') },
                                        { v: "monthly", l: t('milkEntry.month') },
                                        { v: "custom", l: t('milkEntry.custom') },
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button"
                                            onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate}
                                            onChange={e => { const v = e.target.value; setFromDate(v); setPdfReady(false); fetchRangeEntries(v, toDate); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate}
                                            onChange={e => { const v = e.target.value; setToDate(v); setPdfReady(false); fetchRangeEntries(fromDate, v); }}
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
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-40 transition">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[
                        { label: rangeMode === "daily" ? t('milkEntry.entriesToday') : t('milkEntry.totalEntries'), value: rangeMode === "daily" ? entries.length : rangeEntries.length, icon: <Droplets size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('milkEntry.cowMilk'), value: entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1) + " L", icon: <Milk size={14} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                        { label: t('milkEntry.buffaloMilk'), value: entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1) + " L", icon: <Milk size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('milkEntry.totalAmount'), value: "₹" + entries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0).toFixed(2), icon: <TrendingUp size={14} />, color: "text-violet-600 bg-violet-50 border-violet-100" },
                        { label: t('milkEntry.remainingMorning'), value: `${remainingMorningSellers} ${t('milkEntry.sellers')}`, icon: <Sun size={14} />, color: "text-yellow-600 bg-yellow-50 border-yellow-100" },
                        { label: t('milkEntry.remainingEvening'), value: `${remainingEveningSellers} ${t('milkEntry.sellers')}`, icon: <Moon size={14} />, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
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
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Entry Form */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                            {editingEntry ? t('milkEntry.editEntry') : t('milkEntry.newEntry')}
                        </p>
                        {editingEntry && (
                            <button onClick={handleCancelEdit}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition px-2 py-1 rounded-lg hover:bg-gray-100">
                                <X size={12} /> {t('milkEntry.cancelEdit')}
                            </button>
                        )}
                    </div>
                    {editingEntry && (
                        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
                            ✏ {t('milkEntry.editingBanner')} <strong>{editingEntry.seller_name}</strong> · {editingEntry.shift === "morning" ? t('milkEntry.morning') : t('milkEntry.evening')} · {editingEntry.milk_type === "cow" ? t('milkEntry.cow') : t('milkEntry.buffalo')} · {new Date(editingEntry.entry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </div>
                    )}
                    <div className="flex items-start gap-3 flex-wrap">

                        <Field label={t('milkEntry.sellerLabel')} icon={<User size={12} />} data-tour="seller-field">
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
                                        if (!val) { set("seller_id", ""); return; }
                                        const exact = sellers.find(
                                            (s) =>
                                                String(s.seller_id) === val.trim() ||
                                                (s.seller_code || "").toLowerCase() === val.trim().toLowerCase()
                                        );
                                        if (exact) {
                                            handleSellerChange(exact.seller_id);
                                            setSellerSearch(exact.name);
                                            setDropdownOpen(false);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (!dropdownOpen || filteredSellers.length === 0) return;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setHighlightedIdx(i => Math.min(i + 1, filteredSellers.length - 1));
                                        } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setHighlightedIdx(i => Math.max(i - 1, 0));
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            const sel = highlightedIdx >= 0 ? filteredSellers[highlightedIdx] : filteredSellers[0];
                                            if (sel) {
                                                handleSellerChange(sel.seller_id);
                                                setSellerSearch(sel.name);
                                                setDropdownOpen(false);
                                            }
                                        } else if (e.key === "Escape") {
                                            setDropdownOpen(false);
                                        }
                                    }}
                                    placeholder={t('milkEntry.searchPlaceholder')}
                                    className="pr-7"
                                    style={{ width: "160px" }}
                                />
                                {dropdownOpen && !form.seller_id && filteredSellers.length > 0 && (
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                        <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            {sellerSearch.trim() ? `${filteredSellers.length} ${filteredSellers.length !== 1 ? t('milkEntry.matchesPlural') : t('milkEntry.matches')}` : t('milkEntry.sellersAZ')}
                                        </p>
                                        {filteredSellers.map((s, idx) => (
                                            <button key={s.seller_id} type="button"
                                                onMouseEnter={() => setHighlightedIdx(idx)}
                                                onClick={() => {
                                                    handleSellerChange(s.seller_id);
                                                    setSellerSearch(s.name);
                                                    setDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition
                                                    ${highlightedIdx === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition
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
                                {selectedSeller && (
                                    <button type="button" onClick={() => { set("seller_id", ""); setSellerSearch(""); setDropdownOpen(false); }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                            {selectedSeller && (
                                <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                    ID: {selectedSeller.seller_id} · {selectedSeller.seller_type || "—"}
                                </p>
                            )}
                        </Field>

                        <Field label={t('milkEntry.shiftLabel')} icon={form.shift === "morning" ? <Sun size={12} /> : <Moon size={12} />} data-tour="shift-field">
                            <ShiftToggle value={form.shift} onChange={(v) => set("shift", v)} t={t} />
                        </Field>

                        <Field label={t('milkEntry.milkTypeLabel')} icon={<Milk size={12} />}>
                            <MilkTypeToggle
                                value={form.milk_type}
                                onChange={(v) => {
                                    set("milk_type", v);
                                    if (form.seller_id) fetchPremiumRate(form.seller_id, v, selectedDate);
                                    else fetchAutoRate(form.fat, form.snf, v);
                                }}
                                t={t}
                            />
                        </Field>

                        <Field label={t('milkEntry.sellerTypeLabel')} icon={<User size={12} />}>
                            <SellerTypeToggle value={form.seller_type} onChange={(v) => set("seller_type", v)} />
                        </Field>

                        <Field label={t('milkEntry.qtyLabel')} icon={<Droplets size={12} />} data-tour="qty-field">
                            <TinyInput value={form.quantity} onChange={(e) => set("quantity", e.target.value)}
                                placeholder="0.0" type="number" step="0.01"
                                className="bg-blue-50 border-blue-200 text-blue-700 focus:ring-blue-200"
                                style={{ width: "72px" }} />
                        </Field>

                        <Field label={t('milkEntry.fatLabel')} icon={<FlaskConical size={12} />} data-tour="fat-field">
                            <TinyInput
                                value={form.fat}
                                onChange={(e) => {
                                    set("fat", e.target.value);
                                    fetchAutoRate(e.target.value, form.snf, form.milk_type);
                                }}
                                placeholder="0.0" type="number" step="0.01"
                                className="bg-amber-50 border-amber-200 text-amber-700 focus:ring-amber-100"
                                style={{ width: "64px" }} />
                        </Field>

                        <Field label={t('milkEntry.snfLabel')} icon={<FlaskConical size={12} />}>
                            <TinyInput
                                value={form.snf}
                                onChange={(e) => {
                                    set("snf", e.target.value);
                                    fetchAutoRate(form.fat, e.target.value, form.milk_type);
                                }}
                                placeholder="0.0" type="number" step="0.01"
                                className="bg-violet-50 border-violet-200 text-violet-700 focus:ring-violet-100"
                                style={{ width: "64px" }} />
                        </Field>

                        <Field label={t('milkEntry.waterLabel')} icon={<Waves size={12} />}>
                            <div className="relative">
                                <TinyInput value={form.water} onChange={(e) => set("water", e.target.value)}
                                    placeholder="0.0" type="number" step="0.01"
                                    className={waterRisk(form.water)
                                        ? "bg-red-50 border-red-300 text-red-600 focus:ring-red-100"
                                        : "bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-100"}
                                    style={{ width: "64px" }} />
                                {waterRisk(form.water) && (
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center">
                                        <AlertTriangle size={8} className="text-white" />
                                    </span>
                                )}
                            </div>
                            {waterRisk(form.water) && (
                                <p className="text-[10px] text-red-500 font-semibold mt-0.5">{t('milkEntry.waterRisk')}</p>
                            )}
                        </Field>

                        <Field label={t('milkEntry.rateLabel')} icon={<TrendingUp size={12} />}>
                            <TinyInput value={form.rate_applied} onChange={(e) => set("rate_applied", e.target.value)}
                                placeholder="₹0.00" type="number" step="0.01"
                                className="bg-gray-50 border-gray-200 text-gray-800"
                                style={{ width: "80px" }} />
                        </Field>

                        {amount && (
                            <Field label={t('milkEntry.amountLabel')} icon={<TrendingUp size={12} />}>
                                <div className="h-[35px] px-3 flex items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm whitespace-nowrap">
                                    ₹{amount}
                                </div>
                            </Field>
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            {entries.length} {entries.length === 1 ? t('milkEntry.entry') : t('milkEntry.entries')} {t('milkEntry.entriesOn')}{" "}
                            {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                        <button type="button" onClick={editingEntry ? handleUpdate : handleSave} disabled={saving}
                            data-tour="save-btn"
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
        ${saving ? "bg-gray-300 cursor-not-allowed" : editingEntry ? "bg-amber-600 hover:bg-amber-700 active:scale-95" : "bg-black hover:bg-gray-800 active:scale-95"}`}>
                            <Save size={15} />
                            {saving ? (editingEntry ? t('milkEntry.updating') : t('milkEntry.saving')) : editingEntry ? t('milkEntry.updateEntry') : t('milkEntry.saveEntry')}
                        </button>
                    </div>
                </div>

                {/* Entries Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <input
                            type="text"
                            value={searchName}
                            onChange={e => { setSearchName(e.target.value); setCurrentPage(1); }}
                            placeholder={t('milkEntry.filterPlaceholder')}
                            className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black transition w-52"
                        />
                        {searchName && (
                            <button onClick={() => { setSearchName(""); setCurrentPage(1); }}
                                className="text-gray-400 hover:text-gray-600 transition">
                                <X size={13} />
                            </button>
                        )}
                        <span className="ml-auto text-xs text-gray-400">
                            {filteredEntries.length} {filteredEntries.length === 1 ? t('milkEntry.entry') : t('milkEntry.entries')}
                            {searchName && ` ${t('milkEntry.matching')} "${searchName}"`}
                        </span>
                    </div>

                    <div className="grid border-b border-gray-100 bg-gray-50/80" data-tour="entries-table" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 flex items-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Droplets size={32} />
                            <p className="text-sm">{t('milkEntry.noEntries')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {[...paginatedEntries].map((r, i) => (
                                    <div key={r.entry_id || i}
                                        className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}>

                                        <TableCell className="text-gray-400 font-mono text-xs justify-center">
                                            {(currentPage - 1) * pageSize + i + 1}
                                        </TableCell>

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
                                                ${r.shift === "morning"
                                                    ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                                                    : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}>
                                                {r.shift === "morning" ? <Sun size={10} /> : <Moon size={10} />}
                                                {r.shift === "morning" ? t('milkEntry.morning') : t('milkEntry.evening')}
                                            </span>
                                        </TableCell>

                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
                                                ${r.milk_type === "cow"
                                                    ? "bg-amber-50 text-amber-700 border-amber-100"
                                                    : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                                                {r.milk_type === "cow" ? t('milkEntry.cow') : t('milkEntry.buffalo')}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-blue-600 font-mono font-semibold text-xs">{r.quantity}</TableCell>
                                        <TableCell className="text-amber-600 font-mono font-semibold text-xs">{r.fat}</TableCell>
                                        <TableCell className="text-violet-600 font-mono font-semibold text-xs">{r.snf}</TableCell>

                                        <TableCell>
                                            <span className={`font-mono text-xs font-semibold ${parseFloat(r.water) > 5 ? "text-red-500" : "text-emerald-600"}`}>
                                                {r.water}
                                                {parseFloat(r.water) > 5 && <AlertTriangle size={10} className="inline ml-1 text-red-400" />}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-gray-700 font-mono text-xs font-semibold">₹{parseFloat(r.rate_applied || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-gray-900 font-bold text-xs">₹{parseFloat(r.total_amount || 0).toFixed(2)}</TableCell>
                                        <TableCell className="text-gray-400 font-mono text-xs">{fmtTime(r.entry_time)}</TableCell>

                                        <TableCell>
                                            {r.is_premium
                                                ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{t('milkEntry.premium')}</span>
                                                : <span className="text-gray-300 text-xs">—</span>}
                                        </TableCell>

                                        {isAdmin && (
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleEdit(r)}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition border
                            ${editingEntry?.entry_id === r.entry_id
                                                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                                                : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"}`}>
                                                        ✏ {editingEntry?.entry_id === r.entry_id ? t('milkEntry.editing') : t('milkEntry.edit')}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(r.entry_id)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition border bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100">
                                                        <Trash2 size={10} /> {t('milkEntry.delete')}
                                                    </button>
                                                </div>
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
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('milkEntry.prev')}
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
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('milkEntry.next')}
                            </button>
                            <span className="text-xs text-gray-400 ml-1">
                                {filteredEntries.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredEntries.length)}`} {t('milkEntry.of')} {filteredEntries.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('milkEntry.rowsPerPage')}</span>
                            <input
                                type="number" min={1} max={filteredEntries.length || 1}
                                value={pageSize}
                                onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                    </div>
                )}

                {/* Totals Footer */}
                {entries.length > 0 && (
                    <div className="bg-white rounded-b-2xl border-t-2 border-gray-100 overflow-x-auto">
                        <div className="grid bg-gray-50/80 min-w-max"
                            style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                {entries.length} {entries.length === 1 ? t('milkEntry.entry') : t('milkEntry.entries')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-amber-600 font-semibold">
                                        {entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)} L
                                    </span>
                                    <span className="text-[10px] text-blue-600 font-semibold">
                                        {entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)} L
                                    </span>
                                </div>
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-100">
                                ₹{entries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0).toFixed(2)}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5" />
                        </div>
                    </div>
                )}
            </main>

            {/* Delete Confirmation Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">{t('milkEntry.confirmDeletion')}</h2>
                                    <p className="text-[10px] text-gray-400">{t('milkEntry.cannotUndo')}</p>
                                </div>
                            </div>
                            <button onClick={cancelDelete} className="text-gray-300 hover:text-gray-500 transition">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-4">
                            <p className="text-sm text-gray-600">
                                {t('milkEntry.deleteWarning')}
                            </p>

                            {entryToDelete && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                                    <p className="text-xs text-gray-500 mb-1">{t('milkEntry.entryDetails')}</p>
                                    {(() => {
                                        const entry = entries.find(e => e.entry_id === entryToDelete);
                                        if (!entry) return null;

                                        return (
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailSeller')}</p>
                                                    <p className="font-medium text-gray-800">{entry.seller_name || `ID:${entry.seller_id}`}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailDate')}</p>
                                                    <p className="font-medium text-gray-800">{fmtDate(entry.entry_date)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailShift')}</p>
                                                    <p className="font-medium text-gray-800 capitalize">{entry.shift}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailMilkType')}</p>
                                                    <p className="font-medium text-gray-800 capitalize">{entry.milk_type}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailQty')}</p>
                                                    <p className="font-medium text-gray-800">{entry.quantity} L</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailAmount')}</p>
                                                    <p className="font-medium text-gray-800">₹{parseFloat(entry.total_amount || 0).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={cancelDelete}
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                {t('milkEntry.cancel')}
                            </button>
                            <button onClick={confirmDelete}
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition">
                                {t('milkEntry.deleteEntry')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}